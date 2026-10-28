// PITCH Ligas — workspace sync (the "bridge": the league is one state document
// saved per account through league_workspace_* RPCs).
//
// Pure queue logic, no React and no Supabase import: the caller injects `api`
// ({ get(), save(state, expectedVersion) }, each resolving to { data } or
// { error: <code> }). Rules:
//   • changes are saved after a short pause, one request at a time;
//   • a change made while a save is in flight is sent right after it;
//   • "version_conflict" (the document changed on another device) stops saving
//     and keeps the local copy untouched — nothing is overwritten silently;
//   • any other error keeps the pending state and retries with a growing delay.

export const SYNC_STATUS = Object.freeze({ IDLE: "idle", SAVING: "saving", SAVED: "saved", ERROR: "error", CONFLICT: "conflict" });

const RETRY_MS = [2000, 5000, 15000, 30000];

export function createWorkspaceSync({ api, debounceMs = 800, onStatus = () => {}, schedule = setTimeout, cancel = clearTimeout } = {}) {
  let version = 0;
  let pending = null; // latest local state not yet confirmed by the server
  let inFlight = false;
  let timer = null;
  let attempts = 0;
  let status = SYNC_STATUS.IDLE;
  let stopped = false;

  const setStatus = (s) => { if (s !== status) { status = s; onStatus(s); } };
  const clearTimer = () => { if (timer) { cancel(timer); timer = null; } };

  async function flush() {
    clearTimer();
    if (stopped || inFlight || pending === null || status === SYNC_STATUS.CONFLICT) return;
    const sending = pending;
    inFlight = true;
    setStatus(SYNC_STATUS.SAVING);
    const r = await api.save(sending, version);
    inFlight = false;
    if (stopped) return;
    if (r.error === "version_conflict") { setStatus(SYNC_STATUS.CONFLICT); return; }
    if (r.error) {
      setStatus(SYNC_STATUS.ERROR);
      timer = schedule(flush, RETRY_MS[Math.min(attempts, RETRY_MS.length - 1)]);
      attempts += 1;
      return;
    }
    attempts = 0;
    version = r.data?.version ?? version + 1;
    if (pending === sending) pending = null; // nothing newer arrived while saving
    if (pending !== null) { timer = schedule(flush, 0); return; }
    setStatus(SYNC_STATUS.SAVED);
  }

  return {
    /** Loads the server copy → { state, version, slug, published } or { state: null } for a new account. */
    async load() {
      const r = await api.get();
      if (r.error) return { error: r.error };
      const d = r.data;
      version = d?.version ?? 0;
      pending = null;
      attempts = 0;
      setStatus(SYNC_STATUS.IDLE);
      return d ? { state: d.state, version, slug: d.slug || null, published: Boolean(d.published) } : { state: null, version: 0, slug: null, published: false };
    },
    /** A local change: save soon. */
    change(state) {
      if (stopped) return;
      pending = state;
      if (status === SYNC_STATUS.CONFLICT) return;
      clearTimer();
      if (!inFlight) timer = schedule(flush, debounceMs);
    },
    /** Save now (before leaving the page, or the "tentar outra vez" button). */
    flush,
    /** Retry after an error. */
    retry() { attempts = 0; return flush(); },
    hasPending: () => pending !== null || inFlight,
    version: () => version,
    status: () => status,
    stop() { stopped = true; clearTimer(); },
  };
}
