"use client";

import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/components/LanguageProvider";
import { useAuth } from "@/components/SyncProvider";
import { LANGS, LANG_LABEL } from "@/lib/i18n";
import { exportData, importData, localDate } from "@/lib/db";
import { disableReminders, enableReminders, pushSupported, remindersEnabled } from "@/lib/push";

// App & account settings: cross-device sync, water reminders, and local backup.
// These used to live at the bottom of Goals — they aren't goals, they're config.
export default function SettingsPage() {
  const t = useT();
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
      <h1 className="text-xl font-bold">{t("Settings")}</h1>
      <LanguageCard />
      <SyncCard />
      <RemindersCard />
      <BackupCard />
    </div>
  );
}

function LanguageCard() {
  const { lang, setLang, t } = useLang();
  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <span className="font-medium">{t("Language")}</span>
        <div className="flex overflow-hidden rounded-xl border border-base-300 text-sm">
          {LANGS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`flex-1 px-3 py-2 font-medium transition-colors ${
                lang === l
                  ? "bg-primary text-primary-content"
                  : "text-base-content/60 hover:bg-base-200"
              }`}
            >
              {LANG_LABEL[l]}
            </button>
          ))}
        </div>
        <p className="text-xs text-base-content/50">
          {t("Changes the app's language. Your food names and notes stay as you wrote them.")}
        </p>
      </div>
    </div>
  );
}

function RemindersCard() {
  const t = useT();
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
      setErr(e instanceof Error ? e.message : t("Couldn't change reminders."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t("💧 Water reminders")}</span>
          {on && <span className="text-xs text-success">{t("on ✓")}</span>}
        </div>
        {!supported ? (
          <p className="text-xs text-base-content/50">
            {t("This device doesn't support notifications. On iPhone, add Pasto to your Home Screen (Share → Add to Home Screen) and open it from there.")}
          </p>
        ) : !user ? (
          <p className="text-xs text-base-content/50">
            {t("Sign in above first — reminders need an account so they can be sent across the day.")}
          </p>
        ) : (
          <>
            <p className="text-xs text-base-content/50">
              {t("Get a gentle nudge a few times a day when you're behind on water. Tap the notification to open the app and log a glass.")}
            </p>
            {err && <div className="text-xs text-error">{err}</div>}
            <button
              className={`btn btn-sm self-start ${on ? "btn-outline" : "btn-primary"}`}
              onClick={toggle}
              disabled={busy}
            >
              {busy ? "…" : on ? t("Turn off reminders") : t("Turn on reminders")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function SyncCard() {
  const t = useT();
  const { user, ready, signIn, signUp, resetPassword, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setErr(prettyAuthError(e, t));
    } finally {
      setBusy(false);
    }
  }

  async function forgotPassword() {
    if (!email) {
      setErr(t("Enter your email above first, then tap “Forgot password”."));
      return;
    }
    await run(async () => {
      await resetPassword(email);
      setMsg(t("Password-reset link sent to {email}. Check your inbox (and spam).", { email: email.trim() }));
    });
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t("Sync across devices")}</span>
          {user && <span className="text-xs text-success">{t("on ✓")}</span>}
        </div>

        {!ready ? (
          <div className="text-xs text-base-content/40">…</div>
        ) : user ? (
          <>
            <p className="text-xs text-base-content/50">
              {t("Signed in as")} <span className="text-base-content/80">{user.email}</span>.{" "}
              {t("Your log, meals, custom foods and goals sync automatically to every device where you sign in.")}
            </p>
            <button
              className="btn btn-outline btn-sm self-start"
              onClick={() => run(signOut)}
              disabled={busy}
            >
              {t("Sign out")}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-base-content/50">
              {t("Sign in on your Mac and your phone with the same account to keep everything in sync. Your current data uploads on first sign-in — nothing is lost.")}
            </p>
            <input
              type="email"
              autoComplete="email"
              placeholder={t("Email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            <input
              type="password"
              autoComplete="current-password"
              placeholder={t("Password (min 6 characters)")}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="input input-bordered input-sm w-full"
            />
            {err && <div className="text-xs text-error">{err}</div>}
            {msg && <div className="text-xs text-success">{msg}</div>}
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm flex-1"
                disabled={busy || !email || pw.length < 6}
                onClick={() => run(() => signIn(email, pw))}
              >
                {t("Sign in")}
              </button>
              <button
                className="btn btn-outline btn-sm flex-1"
                disabled={busy || !email || pw.length < 6}
                onClick={() => run(() => signUp(email, pw))}
              >
                {t("Create account")}
              </button>
            </div>
            <button
              className="link link-hover self-start text-xs text-base-content/50"
              disabled={busy}
              onClick={forgotPassword}
            >
              {t("Forgot password?")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function prettyAuthError(e: unknown, t: (k: string) => string): string {
  const code = (e as { code?: string })?.code ?? "";
  if (code.includes("invalid-credential") || code.includes("wrong-password"))
    return t("Wrong email or password.");
  if (code.includes("email-already-in-use"))
    return t("That email already has an account — use Sign in.");
  if (code.includes("weak-password")) return t("Password must be at least 6 characters.");
  if (code.includes("invalid-email")) return t("That doesn't look like a valid email.");
  if (code.includes("user-not-found")) return t("No account found for that email.");
  if (code.includes("too-many-requests")) return t("Too many attempts — wait a bit and try again.");
  if (code.includes("network")) return t("Network error — check your connection.");
  return t("Couldn't complete that. Please try again.");
}

function BackupCard() {
  const t = useT();
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
      t("Backed up {entries} log entries, {meals} meals, {foods} custom foods.", {
        entries: data.entries.length,
        meals: data.meals.length,
        foods: data.customFoods.length,
      }),
    );
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      await importData(data);
      // Reload so every page reflects the restored data.
      window.location.reload();
    } catch {
      setMsg(t("Couldn't read that file — is it a Pasto backup?"));
    }
  }

  return (
    <div className="card bg-base-100 shadow-sm">
      <div className="card-body gap-3 py-5">
        <div className="flex items-center justify-between">
          <span className="font-medium">{t("Backup & restore")}</span>
          {persistent !== null && (
            <span className={`text-xs ${persistent ? "text-success" : "text-warning"}`}>
              {t("storage:")} {persistent ? t("persistent ✓") : t("best-effort")}
            </span>
          )}
        </div>
        <p className="text-xs text-base-content/50">
          {t("Your data lives only in this browser. Export a backup file to keep it safe or move it to another browser or device.")}
        </p>
        <div className="flex gap-2">
          <button className="btn btn-primary btn-sm flex-1" onClick={doExport}>
            {t("Export backup")}
          </button>
          <button className="btn btn-outline btn-sm flex-1" onClick={() => fileRef.current?.click()}>
            {t("Restore…")}
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
