/** One synchronous gate shared by input, stores and IPC. No editor mutation is
 * admitted between its snapshot and the verified recovery reload. */
let locked = false;
let claiming = false;
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
 * Take the barrier, waiting for the calls already in flight to finish.
 *
 * **Why this replaced a synchronous attempt.** `beginSyncBarrier()` asked
 * `pending === 0` and set `locked = true` in one instant, which means it could
 * never *become* true — it could only happen to be. This application polls the
 * index every 500 ms, the knowledge panel every 3 s and the device status every
 * 15 s, and every one of those goes through `tracked()`. Against that drumbeat
 * a single instantaneous attempt is a coin toss, and installing an update lost
 * it over and over: reported for weeks, and fixed twice without being fixed,
 * because each fix made the *window* wider instead of making the attempt able
 * to wait.
 *
 * So it is two phases, in the order that actually works:
 *
 * 1. **Claim** — shut the door. `tracked()` refuses while `claiming`, exactly
 *    as it already did while `locked`, so nothing new gets in.
 * 2. **Drain** — wait for the calls inside to leave. `pending` only falls from
 *    here, because step 1 stopped it rising. That is what makes the wait
 *    terminate rather than chase a moving number.
 * 3. **Hold** — `locked = true`, and the door stays shut on the way out.
 *
 * The timeout exists so a call that never settles is *reported* rather than
 * hung on, and the caller says so in its own words.
 */
export async function acquireSyncBarrier(timeoutMs = 5000): Promise<boolean> {
  if (locked || claiming || composing) return false;
  claiming = true;
  try {
    const deadline = Date.now() + timeoutMs;
    while (pending > 0) {
      if (Date.now() >= deadline) return false;
      await new Promise(resolve => { setTimeout(resolve, 5); });
    }
    locked = true;
    listeners.forEach(f => f());
    return true;
  } finally {
    // On success `locked` is already holding the door; on failure this is what
    // reopens it.
    claiming = false;
  }
}
export function endSyncBarrier() {
  locked = false;
  listeners.forEach(f => f());
}
export async function tracked<T>(call: () => Promise<T>): Promise<T> {
  // `claiming` refuses for the same reason `locked` does, and it is what lets
  // `pending` drain instead of being topped up by the next poll.
  if (locked || claiming) throw { code: "unsupported", cap: "sync application in progress" };
  pending++;
  try { return await call(); }
  finally {
    // Include callers' response continuations, not just the transport promise.
    setTimeout(() => { pending--; }, 0);
  }
}
