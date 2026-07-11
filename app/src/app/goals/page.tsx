"use client";

import { useEffect, useRef, useState } from "react";
import NumberField from "@/components/NumberField";
import { useAuth } from "@/components/SyncProvider";
import { exportData, getGoals, importData, localDate, saveGoals } from "@/lib/db";
import { disableReminders, enableReminders, pushSupported, remindersEnabled } from "@/lib/push";
import type { Goals } from "@/lib/types";

// Mifflin-St Jeor BMR × activity, then a balanced macro split:
// protein 1.8 g/kg, fat 25% of kcal, carbs the remainder.
function suggestGoals(input: {
  sex: "m" | "f";
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number;
}): Omit<Goals, "id"> {
  const { sex, age, heightCm, weightKg, activity } = input;
  const bmr =
    10 * weightKg + 6.25 * heightCm - 5 * age + (sex === "m" ? 5 : -161);
  const kcal = Math.round((bmr * activity) / 10) * 10;
  const protein_g = Math.round(weightKg * 1.8);
  const fat_g = Math.round((kcal * 0.25) / 9);
  const carbs_g = Math.max(0, Math.round((kcal - protein_g * 4 - fat_g * 9) / 4));
  const fiber_g = Math.round((14 * kcal) / 1000); // ~14 g per 1000 kcal guideline
  const water_glasses = Math.max(6, Math.round((weightKg * 35) / 250)); // ~35 ml/kg, 250 ml glasses
  return { kcal, protein_g, carbs_g, fat_g, fiber_g, water_glasses };
}

const ACTIVITY = [
  { label: "Sedentary", value: 1.2 },
  { label: "Light", value: 1.375 },
  { label: "Moderate", value: 1.55 },
  { label: "Active", value: 1.725 },
];

export default function GoalsPage() {
  const [goals, setGoals] = useState<Omit<Goals, "id"> | null>(null);
  const [saved, setSaved] = useState(false);
  const [calc, setCalc] = useState({
    sex: "m" as "m" | "f",
    age: 30,
    heightCm: 178,
    weightKg: 75,
    activity: 1.55,
  });

  useEffect(() => {
    getGoals().then(({ id: _id, ...rest }) => setGoals(rest));
  }, []);

  function update(field: keyof Omit<Goals, "id">, value: number) {
    setGoals((g) => (g ? { ...g, [field]: value } : g));
    setSaved(false);
  }

  async function persist() {
    if (!goals) return;
    await saveGoals(goals);
    setSaved(true);
  }

  if (!goals) return <div className="py-10 text-center text-base-content/40">Loading…</div>;

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">Daily goals</h1>

      <div className="card bg-base-100 shadow-sm">
        <div className="card-body gap-3 py-5">
          <Field label="Calories" unit="kcal" value={goals.kcal} onChange={(v) => update("kcal", v)} />
          <Field label="Protein" unit="g" value={goals.protein_g} onChange={(v) => update("protein_g", v)} />
          <Field label="Carbs" unit="g" value={goals.carbs_g} onChange={(v) => update("carbs_g", v)} />
          <Field label="Fat" unit="g" value={goals.fat_g} onChange={(v) => update("fat_g", v)} />
          <Field label="Fiber" unit="g" value={goals.fiber_g} onChange={(v) => update("fiber_g", v)} />
          <Field
            label="Water"
            unit="glasses"
            value={goals.water_glasses}
            onChange={(v) => update("water_glasses", v)}
          />
        </div>
      </div>

      <button className="btn btn-primary" onClick={persist}>
        {saved ? "Saved ✓" : "Save goals"}
      </button>

      {/* Optional calculator */}
      <div className="collapse collapse-arrow bg-base-100 shadow-sm">
        <input type="checkbox" />
        <div className="collapse-title font-medium">Calculate from body stats (TDEE)</div>
        <div className="collapse-content flex flex-col gap-3">
          <div className="join">
            <button
              className={`btn join-item btn-sm ${calc.sex === "m" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCalc((c) => ({ ...c, sex: "m" }))}
            >
              Male
            </button>
            <button
              className={`btn join-item btn-sm ${calc.sex === "f" ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setCalc((c) => ({ ...c, sex: "f" }))}
            >
              Female
            </button>
          </div>
          <Field label="Age" unit="yr" value={calc.age} onChange={(v) => setCalc((c) => ({ ...c, age: v }))} />
          <Field label="Height" unit="cm" value={calc.heightCm} onChange={(v) => setCalc((c) => ({ ...c, heightCm: v }))} />
          <Field label="Weight" unit="kg" value={calc.weightKg} onChange={(v) => setCalc((c) => ({ ...c, weightKg: v }))} />
          <label className="flex items-center justify-between gap-3">
            <span className="text-sm text-base-content/60">Activity</span>
            <select
              className="select select-bordered select-sm"
              value={calc.activity}
              onChange={(e) => setCalc((c) => ({ ...c, activity: Number(e.target.value) }))}
            >
              {ACTIVITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setGoals(suggestGoals(calc));
              setSaved(false);
            }}
          >
            Use suggested goals
          </button>
        </div>
      </div>

      <p className="px-1 text-xs text-base-content/40">
        Suggestion uses Mifflin-St Jeor BMR × activity, protein 1.8 g/kg, fat 25%
        of calories. Tune the numbers above to your plan, then Save.
      </p>

      <SyncCard />
      <RemindersCard />
      <BackupCard />
    </div>
  );
}

function RemindersCard() {
  const { user } = useAuth();
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const supported = pushSupported();

  useEffect(() => {
    if (user) remindersEnabled(user.uid).then(setOn);
    else setOn(false);
  }, [user]);

  async function toggle() {
    if (!user) return;
    setBusy(true);
    setErr(null);
    try {
      if (on) {
        await disableReminders(user.uid);
        setOn(false);
      } else {
        await enableReminders(user.uid);
        setOn(true);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't change reminders.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">💧 Water reminders</span>
          {on && <span className="text-xs text-success">on ✓</span>}
        </div>
        {!supported ? (
          <p className="text-xs text-base-content/50">
            This device doesn&apos;t support notifications. On iPhone, add Pasto to your Home Screen
            (Share → Add to Home Screen) and open it from there.
          </p>
        ) : !user ? (
          <p className="text-xs text-base-content/50">
            Sign in above first — reminders need an account so they can be sent across the day.
          </p>
        ) : (
          <>
            <p className="text-xs text-base-content/50">
              Get a gentle nudge a few times a day when you&apos;re behind on water. Tap the
              notification to open the app and log a glass.
            </p>
            {err && <div className="text-xs text-error">{err}</div>}
            <button
              className={`btn btn-sm self-start ${on ? "btn-outline" : "btn-primary"}`}
              onClick={toggle}
              disabled={busy}
            >
              {busy ? "…" : on ? "Turn off reminders" : "Turn on reminders"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SyncCard() {
  const { user, ready, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
    } catch (e) {
      setErr(prettyAuthError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">Sync across devices</span>
          {user && <span className="text-xs text-success">on ✓</span>}
        </div>

        {!ready ? (
          <div className="text-xs text-base-content/40">…</div>
        ) : user ? (
          <>
            <p className="text-xs text-base-content/50">
              Signed in as <span className="text-base-content/80">{user.email}</span>. Your log,
              meals, custom foods and goals sync automatically to every device where you sign in.
            </p>
            <button
              className="btn btn-outline btn-sm self-start"
              onClick={() => run(signOut)}
              disabled={busy}
            >
              Sign out
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-base-content/50">
              Sign in on your Mac and your phone with the same account to keep everything in sync.
              Your current data uploads on first sign-in — nothing is lost.
            </p>
            <input
              type="email"
              autoComplete="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder="Password (min 6 characters)"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            {err && <div className="text-xs text-error">{err}</div>}
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm flex-1"
                disabled={busy || !email || pw.length < 6}
                onClick={() => run(() => signIn(email, pw))}
              >
                Sign in
              </button>
              <button
                className="btn btn-outline btn-sm flex-1"
                disabled={busy || !email || pw.length < 6}
                onClick={() => run(() => signUp(email, pw))}
              >
                Create account
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function prettyAuthError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return "Wrong email or password.";
  if (code.includes("email-already-in-use"))
    return "That email already has an account — use Sign in.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  if (code.includes("invalid-email")) return "That doesn't look like a valid email.";
  if (code.includes("network")) return "Network error — check your connection.";
  return "Couldn't complete that. Please try again.";
}

function BackupCard() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [persistent, setPersistent] = useState<boolean | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersistent).catch(() => setPersistent(null));
  }, []);

  async function doExport() {
    const data = await exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pasto-backup-${localDate()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg(
      `Backed up ${data.entries.length} log entries, ${data.meals.length} meals, ${data.customFoods.length} custom foods.`,
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importData(data);
      // Reload so every page (and the goals form) reflects the restored data.
      window.location.reload();
    } catch {
      setMsg("Couldn't read that file — is it a Pasto backup?");
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">Backup &amp; restore</span>
          {persistent !== null && (
            <span className={`text-xs ${persistent ? "text-success" : "text-warning"}`}>
              storage: {persistent ? "persistent ✓" : "best-effort"}
            </span>
          )}
        </div>
        <p className="text-xs text-base-content/50">
          Your data lives only in this browser. Export a backup file to keep it safe or move it to
          another browser or device.
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm flex-1" onClick={doExport}>
            Export backup
          </button>
          <button className="btn btn-outline btn-sm flex-1" onClick={() => fileRef.current?.click()}>
            Restore…
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={onFile}
          />
        </div>
        {msg && <div className="text-xs text-base-content/60">{msg}</div>}
      </div>
    </div>
  );
}

function Field({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span className="text-sm text-base-content/70">{label}</span>
      <span className="flex items-center gap-2">
        <NumberField
          inputMode="numeric"
          min={0}
          value={value}
          onChange={onChange}
          className="input input-bordered input-sm w-24 text-right tabular-nums"
        />
        <span className="w-8 text-sm text-base-content/50">{unit}</span>
      </span>
    </label>
  );
}
