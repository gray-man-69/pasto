"use client";

import { useEffect, useRef, useState } from "react";

// After the camera shot, the nutrition table is usually a small patch of a big
// photo — too low-res to OCR. This lets the user drag a box around just the
// table; we then crop to that box, upscale it, and boost contrast so the small
// text is legible before it reaches tesseract. This is what makes the scan work.

type Rect = { x: number; y: number; w: number; h: number }; // all as 0..1 fractions of the image
type Handle = "move" | "nw" | "ne" | "sw" | "se";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const MIN = 0.1; // smallest crop, as a fraction

export default function LabelCropper({
  file,
  onCancel,
  onConfirm,
}: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [url, setUrl] = useState("");
  const imgRef = useRef<HTMLImageElement>(null);
  const [rect, setRect] = useState<Rect>({ x: 0.12, y: 0.25, w: 0.76, h: 0.5 });
  const drag = useRef<{ mode: Handle; sx: number; sy: number; start: Rect; rw: number; rh: number } | null>(null);

  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  function down(e: React.PointerEvent, mode: Handle) {
    e.preventDefault();
    e.stopPropagation();
    const r = imgRef.current?.getBoundingClientRect();
    if (!r) return;
    drag.current = { mode, sx: e.clientX, sy: e.clientY, start: { ...rect }, rw: r.width, rh: r.height };
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }
  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d) return;
    const dx = (e.clientX - d.sx) / d.rw;
    const dy = (e.clientY - d.sy) / d.rh;
    let { x, y, w, h } = d.start;
    if (d.mode === "move") {
      x = clamp(x + dx, 0, 1 - w);
      y = clamp(y + dy, 0, 1 - h);
    } else {
      if (d.mode === "ne" || d.mode === "se") w = clamp(w + dx, MIN, 1 - x);
      if (d.mode === "sw" || d.mode === "se") h = clamp(h + dy, MIN, 1 - y);
      if (d.mode === "nw" || d.mode === "sw") {
        const nx = clamp(x + dx, 0, x + w - MIN);
        w += x - nx;
        x = nx;
      }
      if (d.mode === "nw" || d.mode === "ne") {
        const ny = clamp(y + dy, 0, y + h - MIN);
        h += y - ny;
        y = ny;
      }
    }
    setRect({ x, y, w, h });
  }
  function up() {
    drag.current = null;
  }

  async function confirm() {
    const imgEl = imgRef.current;
    if (!imgEl) return;

    // Decode the real pixels with createImageBitmap (orientation-corrected). This
    // avoids two iOS traps: EXIF-rotated iPhone photos (the <img> shows them
    // rotated but naturalWidth/Height are the un-rotated size, so cropping from
    // the element cuts the wrong region) and large-photo subsampling. Fall back
    // to the <img> element if the browser lacks createImageBitmap.
    let src: CanvasImageSource = imgEl;
    let nw = imgEl.naturalWidth;
    let nh = imgEl.naturalHeight;
    try {
      // `as` guards against older TS DOM libs that don't list "from-image".
      const opts = { imageOrientation: "from-image" } as unknown as ImageBitmapOptions;
      const bmp = await createImageBitmap(file, opts);
      src = bmp;
      nw = bmp.width;
      nh = bmp.height;
    } catch {
      /* keep the <img> element */
    }
    if (!nw || !nh) return;

    const cx = Math.round(rect.x * nw);
    const cy = Math.round(rect.y * nh);
    const cw = Math.max(1, Math.round(rect.w * nw));
    const ch = Math.max(1, Math.round(rect.h * nh));

    // Aim for ~1700px on the long side: enlarge small crops so text is legible,
    // and SHRINK big ones (a full-res iPhone crop is many MB — over the OCR
    // service's size limit, which makes it silently read nothing).
    const scale = clamp(1700 / Math.max(cw, ch), 0.15, 3);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cw * scale);
    canvas.height = Math.round(ch * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, cx, cy, cw, ch, 0, 0, canvas.width, canvas.height);

    // Grayscale + contrast stretch — packaging often has low black-on-color
    // contrast that tesseract struggles with.
    const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = id.data;
    const contrast = 1.5;
    const intercept = 128 * (1 - contrast);
    for (let i = 0; i < px.length; i += 4) {
      let g = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      g = clamp(g * contrast + intercept, 0, 255);
      px[i] = px[i + 1] = px[i + 2] = g;
    }
    ctx.putImageData(id, 0, 0);
    // JPEG, and re-encode at lower quality if it's still over ~900KB so the
    // upload stays safely under the OCR free-tier size limit.
    const send = (b: Blob | null) => b && onConfirm(b);
    canvas.toBlob((b) => {
      if (b && b.size > 900_000) canvas.toBlob((b2) => send(b2 ?? b), "image/jpeg", 0.55);
      else send(b);
    }, "image/jpeg", 0.82);
  }

  const pct = (n: number) => `${n * 100}%`;
  const corner =
    "absolute h-7 w-7 rounded-full border-2 border-primary bg-base-100 shadow touch-none";

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button className="btn btn-ghost btn-sm text-white" onClick={onCancel}>
          Cancel
        </button>
        <span className="text-sm font-medium">Frame the nutrition table</span>
        <button className="btn btn-primary btn-sm" onClick={confirm} disabled={!url}>
          Scan
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden p-2">
        {url && (
          <div className="relative inline-block max-h-full max-w-full leading-none">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={url}
              alt="Captured label"
              draggable={false}
              className="block max-h-[78vh] max-w-full select-none"
            />
            <div
              className="absolute inset-0 touch-none"
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
            >
              {/* the crop box; box-shadow dims everything outside it */}
              <div
                className="absolute cursor-move touch-none border-2 border-primary"
                style={{
                  left: pct(rect.x),
                  top: pct(rect.y),
                  width: pct(rect.w),
                  height: pct(rect.h),
                  boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                }}
                onPointerDown={(e) => down(e, "move")}
              >
                <span className={`${corner} -left-3.5 -top-3.5 cursor-nwse-resize`} onPointerDown={(e) => down(e, "nw")} />
                <span className={`${corner} -right-3.5 -top-3.5 cursor-nesw-resize`} onPointerDown={(e) => down(e, "ne")} />
                <span className={`${corner} -bottom-3.5 -left-3.5 cursor-nesw-resize`} onPointerDown={(e) => down(e, "sw")} />
                <span className={`${corner} -bottom-3.5 -right-3.5 cursor-nwse-resize`} onPointerDown={(e) => down(e, "se")} />
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="px-6 pb-5 text-center text-xs text-white/60">
        Drag the box so it covers only the “Valori nutrizionali” table, then tap Scan.
      </p>
    </div>
  );
}
