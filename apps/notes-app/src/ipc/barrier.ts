/** One synchronous gate shared by input, stores and IPC. No editor mutation is
 * admitted between its snapshot and the verified recovery reload. */
let locked = false;
let pending = 0;
let composing = false;
export const setComposing = (value: boolean) => { composing = value; };
const listeners = new Set<() => void>();
export const isSyncLocked = () => locked;
export const subscribeBarrier = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};
/**
 * Wait for the releases `tracked()` has already scheduled.
 *
 * `tracked()` gives its slot back inside `setTimeout(…, 0)` on purpose — the
 * point is to cover the caller's own response continuation, not just the
 * transport promise. The consequence is that `pending` is still counting a call
 * you have just finished awaiting: `await` resumes in a microtask and the
 * release runs in a macrotask, so the code immediately after an IPC call always
 * sees a barrier it cannot take, refused by its own completed work.
 *
 * One `setTimeout(…, 0)` is enough and is not a guess: timers with an equal
 * delay fire in the order they were queued, so a yield queued after those
 * releases runs after all of them. A call still genuinely in flight has not
 * scheduled anything yet and still holds the barrier shut, which is the
 * refusal that means something.
 */
export const settleSyncBarrier = () => new Promise<void>(resolve => { setTimeout(resolve, 0); });

export function beginSyncBarrier(): boolean {
  if (locked || pending || composing) return false;
  locked = true;
  listeners.forEach(f => f());
  return true;
}
export function endSyncBarrier() {
  locked = false;
  listeners.forEach(f => f());
}
export async function tracked<T>(call: () => Promise<T>): Promise<T> {
  if (locked) throw { code: "unsupported", cap: "sync application in progress" };
  pending++;
  try { return await call(); }
  finally {
    // Include callers' response continuations, not just the transport promise.
    setTimeout(() => { pending--; }, 0);
  }
}
