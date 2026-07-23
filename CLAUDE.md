# Pasto — repo guide for Claude

Pasto is a **local-first Italian macro/nutrition + strength-training PWA** for a single user
(the owner). Live at https://gray-man-69.github.io/pasto (GitHub Pages).

## Layout

- `app/` — the PWA. Next.js 16 **static export** (`output: "export"` → `out/`), TypeScript,
  Tailwind + DaisyUI, Dexie (IndexedDB). See `app/AGENTS.md`: this Next version has breaking
  changes — read `node_modules/next/dist/docs/` before writing Next-specific code.
- `worker/` — Cloudflare Worker that proxies nutrition-label OCR to OCR.space (the API key
  lives only as a Worker secret; never commit keys).
- `reminders/` — water-reminder web-push sender (VAPID private key only in GitHub secrets).
- `pipeline/` — food-data build scripts.

## Deploy

Push to `main` → `.github/workflows/deploy.yml` builds `app/` and publishes to GitHub Pages.
Base path `/pasto` is applied in CI via `NEXT_PUBLIC_BASE_PATH`. There is no staging env.

## Architecture facts that bite

- **Local-first**: all user data is in the browser (Dexie/IndexedDB, schema in
  `app/src/lib/db.ts`, currently v8). Optional Firebase sync mirrors state to Firestore
  `users/{uid}/state/main` (merge logic in the sync module). Never assume a server DB.
- **Schema changes need a Dexie version bump + migration** in `db.ts`, and the backup
  (`exportData`/`importData`) + sync (`getSyncState`/`applySyncState`/`mergeState`) must be
  extended for any new table. Backups merge by id (`bulkPut`) — imports must stay idempotent.
- **Service worker** (`app/public/sw.js`): network-first for navigations + `foods.json` +
  `exercises.json`, cache-first otherwise. A postbuild script (`app/scripts/stamp-sw.mjs`)
  stamps `out/sw.js` with the Next BUILD_ID so every deploy changes sw.js → clients
  auto-reload once on next launch (`ServiceWorkerRegister.tsx`). Don't remove the stamp step;
  don't add caching that defeats it. Data fetches that must be fresh use `cache: "no-cache"`
  (GitHub Pages serves JSON with `max-age=600`).
- **Exercise library**: `app/public/exercises.json` (ids are kebab-case, muscles come from
  the fixed list in `app/src/lib/exercises.ts` `MUSCLES`). Muscle figures render from
  `app/src/lib/muscleAtlas.ts` via `MuscleMap.tsx` — new muscle names must map in its
  `HIGHLIGHT` table.
- **Training model**: routines → sessions with per-set weight/reps/RIR; fixed target reps
  (repMin === repMax); progression helpers in `app/src/lib/progression.ts` (a set only counts
  once it's ticked ✓ done — reps alone don't count); mesocycle blocks in `app/src/lib/mesocycle.ts`
  (per-MUSCLE ramp ~+1 set/week distributed across that muscle's exercises, cap +2/lift,
  deload halves sets ×0.9 load); coach tips in `app/src/lib/coach.ts`.
- **Static export**: only top-level routes exist; feature UIs are modals/query params.
  Don't add dynamic server features — everything must work as static files.

## Design rules (owner is opinionated)

- Dark theme with a single **lime** accent (`--color-primary`); macro colors are fixed
  (protein rose-400, carbs amber-400, fat sky-400, fiber emerald-400).
- Desktop must be a real desktop layout (left `SideNav`, multi-column dashboard) — never a
  centered phone column. Bottom tab bar is mobile-only (`lg:hidden`).
- Match existing component idioms (DaisyUI + the custom `Ring.tsx`); keep UI copy short.
- The owner trains with 2 herniated discs: training features must never recommend
  spine-loading exercises (barbell squat/deadlift/RDL/good morning) as substitutions.

## Working on bugs/todos (async agent workflow)

- The backlog is **GitHub Issues** (labels `bug` / `todo`); `BUGS.md` at the repo root may
  hold quick notes not yet turned into issues.
- Fix ONE issue per run/PR. Pick the highest-value `bug` first, else oldest `todo`.
- Never push to `main` directly: branch (`fix/<slug>`), commit, open a PR that references
  the issue (`Fixes #N`). Never merge PRs — the owner reviews everything.
- Verify with `cd app && npm run build` (build must pass; postbuild stamp runs) and
  `npx tsc --noEmit` for type checks. There is no test suite.
- Never commit secrets; never touch `FIREBASE_SERVICE_ACCOUNT`, VAPID keys, or the OCR key.
