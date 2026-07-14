// Cross-device sync engine. Keeps the local IndexedDB (Dexie) as the app's store
// and mirrors it to a single Firestore document per user (users/{uid}/state/main).
// Merge is loss-averse: newest-wins per record by syncId/updatedAt, and a record
// is only dropped when a tombstone is newer than it. Bugs therefore tend to keep
// extra data rather than lose it.
import { doc, getDoc, onSnapshot, setDoc } from "firebase/firestore";
import { firestore } from "./firebase";
import { applySyncState, getSyncState, onLocalChange, type SyncState } from "./db";
import type {
  Exercise,
  Food,
  Goals,
  LogEntry,
  Meal,
  Routine,
  Tombstone,
  Water,
  WorkoutSession,
} from "./types";

function emptyState(): SyncState {
  return {
    goals: null,
    entries: [],
    meals: [],
    customFoods: [],
    water: [],
    routines: [],
    sessions: [],
    customExercises: [],
    tombstones: [],
  };
}

function normalize(d: Partial<SyncState> | undefined): SyncState {
  return {
    goals: d?.goals ?? null,
    entries: d?.entries ?? [],
    meals: d?.meals ?? [],
    customFoods: d?.customFoods ?? [],
    water: d?.water ?? [],
    routines: d?.routines ?? [],
    sessions: d?.sessions ?? [],
    customExercises: d?.customExercises ?? [],
    tombstones: d?.tombstones ?? [],
  };
}

/** Pure merge of two states (exported for testing). Newest-wins per record; a
 * tombstone that is at least as new as a record removes it. */
export function mergeState(local: SyncState, remote: SyncState): SyncState {
  const tomb = new Map<string, number>();
  for (const t of [...local.tombstones, ...remote.tombstones]) {
    if (t.deletedAt > (tomb.get(t.syncId) ?? 0)) tomb.set(t.syncId, t.deletedAt);
  }
  const tombstones: Tombstone[] = [...tomb].map(([syncId, deletedAt]) => ({ syncId, deletedAt }));

  function pick<T extends { updatedAt?: number }>(list: T[], keyOf: (t: T) => string | undefined): T[] {
    const by = new Map<string, T>();
    for (const r of list) {
      const k = keyOf(r);
      if (!k) continue;
      const ex = by.get(k);
      if (!ex || (r.updatedAt ?? 0) >= (ex.updatedAt ?? 0)) by.set(k, r);
    }
    const out: T[] = [];
    for (const [k, r] of by) {
      const d = tomb.get(k);
      if (d != null && d >= (r.updatedAt ?? 0)) continue; // deletion wins
      out.push(r);
    }
    return out;
  }

  const entries = pick<LogEntry>([...local.entries, ...remote.entries], (e) => e.syncId);
  const meals = pick<Meal>([...local.meals, ...remote.meals], (m) => m.syncId);
  const customFoods = pick<Food>([...local.customFoods, ...remote.customFoods], (f) => f.id);
  const water = pick<Water>([...local.water, ...remote.water], (w) => w.syncId);
  const routines = pick<Routine>([...local.routines, ...remote.routines], (r) => r.syncId);
  const sessions = pick<WorkoutSession>([...local.sessions, ...remote.sessions], (x) => x.syncId);
  const customExercises = pick<Exercise>(
    [...local.customExercises, ...remote.customExercises],
    (e) => e.id,
  );

  const goalCandidates = [local.goals, remote.goals].filter(Boolean) as Goals[];
  goalCandidates.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));

  return {
    goals: goalCandidates[0] ?? null,
    entries,
    meals,
    customFoods,
    water,
    routines,
    sessions,
    customExercises,
    tombstones,
  };
}

let unsub: (() => void) | null = null;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let currentUid: string | null = null;
let applyingRemote = false;

const userDoc = (uid: string) => doc(firestore, "users", uid, "state", "main");

async function pushNow(uid: string) {
  const local = await getSyncState();
  await setDoc(userDoc(uid), { ...local, syncedAt: Date.now() });
}

function schedulePush() {
  if (!currentUid || applyingRemote) return;
  const uid = currentUid;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => pushNow(uid).catch((e) => console.error("[sync] push", e)), 1200);
}

async function mergeIntoLocal(remoteState: SyncState) {
  const local = await getSyncState();
  const merged = mergeState(local, remoteState);
  applyingRemote = true;
  try {
    await applySyncState(merged);
  } finally {
    applyingRemote = false;
  }
  return merged;
}

/** Begin syncing for a signed-in user. Reconciles once, then keeps local and
 * cloud in step (debounced pushes on local edits, live pulls on remote edits). */
export async function startSync(uid: string) {
  if (currentUid === uid) return;
  await stopSync();
  currentUid = uid;

  const snap = await getDoc(userDoc(uid));
  const merged = await mergeIntoLocal(normalize(snap.exists() ? (snap.data() as SyncState) : emptyState()));
  await setDoc(userDoc(uid), { ...merged, syncedAt: Date.now() });

  onLocalChange(schedulePush);

  unsub = onSnapshot(userDoc(uid), (s) => {
    // Skip our own just-written echo (still pending) to avoid feedback loops.
    if (!s.exists() || s.metadata.hasPendingWrites) return;
    mergeIntoLocal(normalize(s.data() as SyncState)).catch((e) => console.error("[sync] pull", e));
  });
}

export async function stopSync() {
  onLocalChange(null);
  if (unsub) unsub();
  unsub = null;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = null;
  currentUid = null;
}
