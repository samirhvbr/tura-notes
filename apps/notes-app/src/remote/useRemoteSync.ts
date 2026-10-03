import { useEffect } from "react";
import { useRemote } from "../stores/remote";
import { syncDelay, useRemoteDoc } from "../stores/remoteDoc";

/** How often the server's list of notes is read: it is the heavier request, and
 *  a new note elsewhere is not as urgent as the words of the one being edited. */
export const LIST_MS = 60_000;

const seen = () => document.visibilityState === "visible";

/**
 * Keep the open remote note up to date with the server while it is on screen.
 *
 * **Visible, not focused.** Two windows side by side is the case this is for:
 * the one the person is not typing in is still looking at the note, and it is
 * the one that must change. A window that is minimized or on another desktop
 * stops asking, and asks once when it comes back.
 *
 * The wait is [`syncDelay`]: ten seconds, longer after failures.
 */
export function useRemoteSync(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const tick = async () => {
      if (seen()) await useRemoteDoc.getState().sync();
      if (!stopped) timer = setTimeout(() => void tick(), syncDelay());
    };
    const wake = () => {
      if (seen()) void useRemoteDoc.getState().sync();
    };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    // The first read is at once: coming back to the note is when it is stale.
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
      window.removeEventListener("focus", wake);
    };
  }, [active]);
}

/** The same for the tree of notes: once a minute while it is on screen, and
 *  when the window is looked at again. */
export function useRemoteListSync(active: boolean) {
  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (seen()) void useRemote.getState().refresh();
    };
    const timer = setInterval(refresh, LIST_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [active]);
}
