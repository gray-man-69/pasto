"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import type { IScannerControls } from "@zxing/browser";

// Full-screen camera barcode scanner (EAN/UPC) with a manual-entry fallback.
export default function BarcodeScanner({
  onDetected,
  onClose,
}: {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let done = false;
    const finish = (code: string) => {
      if (done) return;
      done = true;
      controls?.stop();
      onDetected(code);
    };
    reader
      .decodeFromConstraints({ video: { facingMode: "environment" } }, videoRef.current!, (result) => {
        if (result) finish(result.getText());
      })
      .then((c) => {
        controls = c;
        if (done) c.stop();
      })
      .catch(() => setError("Couldn't open the camera — type the barcode below instead."));
    return () => {
      done = true;
      controls?.stop();
    };
  }, [onDetected]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black">
      <div className="flex items-center justify-between p-4 text-white">
        <span className="font-semibold">Scan a barcode</span>
        <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-lg hover:bg-white/10">
          ✕
        </button>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-28 w-72 rounded-2xl border-2 border-primary shadow-[0_0_0_100vmax_rgba(0,0,0,0.45)]" />
        </div>
        <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/70">
          Point the camera at the product barcode
        </p>
      </div>
      <div className="flex flex-col gap-2 border-t border-base-300 bg-base-100 p-4">
        {error && <div className="text-xs text-warning">{error}</div>}
        <div className="flex gap-2">
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value.replace(/\D/g, ""))}
            inputMode="numeric"
            placeholder="…or type the barcode number"
            className="input input-bordered input-sm flex-1"
          />
          <button
            className="btn btn-primary btn-sm"
            disabled={manual.length < 8}
            onClick={() => onDetected(manual)}
          >
            Look up
          </button>
        </div>
      </div>
    </div>
  );
}
