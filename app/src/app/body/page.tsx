"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import BodyTrend from "@/components/BodyTrend";
import NumberField from "@/components/NumberField";
import {
  addDays,
  addMedia,
  allMedia,
  allWeights,
  dailyTotalsBetween,
  deleteMedia,
  deleteWeight,
  localDate,
  setWeight,
  updateMediaDate,
  weightsBetween,
} from "@/lib/db";
import type { ProgressMedia } from "@/lib/types";

const RANGES = [
  { label: "4w", days: 28 },
  { label: "12w", days: 84 },
  { label: "6m", days: 182 },
  { label: "1y", days: 365 },
] as const;

const MAX_MEDIA_MB = 100;

export default function BodyPage() {
  const today = localDate();
  const [range, setRange] = useState<(typeof RANGES)[number]>(RANGES[1]);
  const [logDate, setLogDate] = useState(today);
  const [kg, setKg] = useState(0);
  const [viewing, setViewing] = useState<ProgressMedia | null>(null);
  const [compare, setCompare] = useState<number[] | null>(null); // media ids picked for compare
  const fileRef = useRef<HTMLInputElement>(null);

  const start = addDays(today, -(range.days - 1));
  const days = useMemo(
    () => Array.from({ length: range.days }, (_, i) => addDays(start, i)),
    [start, range.days],
  );

  const weights = useLiveQuery(() => weightsBetween(start, today), [start, today]);
  const everyWeight = useLiveQuery(() => allWeights(), []);
  const dayTotals = useLiveQuery(() => dailyTotalsBetween(start, today), [start, today]);
  const media = useLiveQuery(() => allMedia(), []);

  // Prefill the weight box with the selected day's reading (or the latest one).
  const forDate = weights?.find((w) => w.date === logDate);
  const latest = weights?.length ? weights[weights.length - 1] : undefined;
  useEffect(() => {
    setKg(forDate?.kg ?? latest?.kg ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logDate, forDate?.kg]);

  async function saveWeight() {
    if (kg > 0) await setWeight(logDate, Math.round(kg * 10) / 10);
  }

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const f of Array.from(files)) {
      if (f.size > MAX_MEDIA_MB * 1024 * 1024) {
        alert(`"${f.name}" is over ${MAX_MEDIA_MB} MB — trim it and retry.`);
        continue;
      }
      // Default the date to when the file was made (photo-library uploads keep
      // their capture-ish date), clamped to today. Editable in the viewer.
      const taken = f.lastModified ? new Date(f.lastModified) : null;
      const takenDate =
        taken && !isNaN(taken.getTime())
          ? `${taken.getFullYear()}-${String(taken.getMonth() + 1).padStart(2, "0")}-${String(taken.getDate()).padStart(2, "0")}`
          : today;
      await addMedia(f, takenDate <= today ? takenDate : today);
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const comparePair =
    compare && compare.length === 2
      ? (compare.map((id) => media?.find((m) => m.id === id)).filter(Boolean) as ProgressMedia[])
      : null;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Body</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r.label}
              onClick={() => setRange(r)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                r.label === range.label
                  ? "bg-primary/15 text-primary"
                  : "text-base-content/50 hover:bg-base-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Log weight */}
      <div className="flex items-end gap-2 rounded-2xl border border-base-300 bg-base-100 p-3">
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-base-content/40">Date</span>
          <input
            type="date"
            value={logDate}
            max={today}
            onChange={(e) => e.target.value && setLogDate(e.target.value)}
            className="input input-sm input-bordered w-full"
          />
        </label>
        <label className="flex w-24 flex-col gap-1">
          <span className="text-[11px] uppercase tracking-wide text-base-content/40">Weight kg</span>
          <NumberField value={kg} onChange={setKg} min={0} max={400} className="input input-sm input-bordered w-full text-right tabular-nums" />
        </label>
        <button onClick={saveWeight} disabled={kg <= 0} className="btn btn-primary btn-sm">
          {forDate ? "Update" : "Log"}
        </button>
        {forDate && (
          <button
            onClick={() => deleteWeight(logDate)}
            aria-label="Delete this weigh-in"
            className="btn btn-ghost btn-sm btn-circle text-base-content/40"
          >
            ✕
          </button>
        )}
      </div>

      <BodyTrend
        days={days}
        weights={weights ?? []}
        allWeights={everyWeight ?? []}
        dayTotals={dayTotals ?? new Map()}
      />

      {/* Progress photos & videos */}
      <div className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-base-content/40">
            Progress photos
          </span>
          <div className="flex gap-2">
            {(media?.filter((m) => m.kind === "photo").length ?? 0) >= 2 && (
              <button
                onClick={() => setCompare(compare ? null : [])}
                className={`btn btn-sm ${compare ? "btn-primary" : "btn-ghost"}`}
              >
                {compare ? (compare.length < 2 ? `Pick ${2 - compare.length}` : "Compare") : "Compare"}
              </button>
            )}
            <button onClick={() => fileRef.current?.click()} className="btn btn-primary btn-sm">
              + Add
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              multiple
              onChange={(e) => onFiles(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {media?.length ? (
          <div className="grid grid-cols-3 gap-2">
            {media.map((m) => (
              <Thumb
                key={m.id}
                m={m}
                picked={compare?.includes(m.id!) ?? false}
                onTap={() => {
                  if (compare) {
                    if (m.kind !== "photo") return;
                    setCompare((c) =>
                      c!.includes(m.id!) ? c!.filter((i) => i !== m.id) : c!.length < 2 ? [...c!, m.id!] : c,
                    );
                  } else setViewing(m);
                }}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-base-300 py-10 text-center text-sm text-base-content/40">
            Add a first photo or video to track how you change.
          </div>
        )}
        <p className="text-[11px] text-base-content/35">
          Photos & videos stay on this device only — they are not synced or included in backups.
        </p>
      </div>

      {/* Fullscreen viewer */}
      {viewing && (
        <Viewer
          m={viewing}
          maxDate={today}
          onClose={() => setViewing(null)}
          onDate={async (date) => {
            await updateMediaDate(viewing.id!, date);
            setViewing({ ...viewing, date });
          }}
          onDelete={async () => {
            if (confirm("Delete this forever? It exists only on this device.")) {
              await deleteMedia(viewing.id!);
              setViewing(null);
            }
          }}
        />
      )}

      {/* Side-by-side compare */}
      {comparePair && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-3" onClick={() => setCompare(null)}>
          <div className="grid flex-1 grid-cols-2 items-center gap-2">
            {comparePair.map((m) => (
              <figure key={m.id} className="flex h-full flex-col items-center justify-center gap-1.5">
                <BlobMedia m={m} className="max-h-full w-full rounded-xl object-contain" />
                <figcaption className="text-xs text-white/60">
                  {new Date(m.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </figcaption>
              </figure>
            ))}
          </div>
          <button className="btn btn-ghost mt-2 text-white/70">Close</button>
        </div>
      )}
    </div>
  );
}

/** Renders a media blob via an object URL that is revoked on unmount. */
function BlobMedia({ m, className, controls = false }: { m: ProgressMedia; className: string; controls?: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(m.blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [m.blob]);
  if (!url) return null;
  return m.kind === "video" ? (
    <video src={url} className={className} controls={controls} muted={!controls} playsInline preload="metadata" />
  ) : (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt={`Progress photo, ${m.date}`} className={className} />
  );
}

function Thumb({ m, picked, onTap }: { m: ProgressMedia; picked: boolean; onTap: () => void }) {
  return (
    <button
      onClick={onTap}
      className={`relative aspect-[3/4] overflow-hidden rounded-xl bg-base-200 ${
        picked ? "ring-2 ring-primary" : ""
      }`}
    >
      <BlobMedia m={m} className="h-full w-full object-cover" />
      {m.kind === "video" && (
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white">▶</span>
      )}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-3 text-left text-[10px] text-white/90">
        {new Date(m.date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
      </span>
    </button>
  );
}

function Viewer({
  m,
  maxDate,
  onClose,
  onDate,
  onDelete,
}: {
  m: ProgressMedia;
  maxDate: string;
  onClose: () => void;
  onDate: (date: string) => void;
  onDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95 p-3">
      <div className="flex items-center justify-between text-white/70">
        <label className="flex items-center gap-1.5 text-sm">
          Taken
          <input
            type="date"
            value={m.date}
            max={maxDate}
            onChange={(e) => e.target.value && onDate(e.target.value)}
            className="input input-sm border-white/20 bg-transparent text-white/90"
          />
        </label>
        <button onClick={onClose} className="btn btn-ghost btn-sm text-white/70">Close</button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <BlobMedia m={m} className="max-h-full max-w-full rounded-xl object-contain" controls />
      </div>
      <button onClick={onDelete} className="btn btn-ghost btn-sm mt-2 self-center text-red-400">
        Delete
      </button>
    </div>
  );
}
