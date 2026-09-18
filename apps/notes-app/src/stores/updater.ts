import { create } from "zustand";
import { checkUpdate, installUpdate } from "../ipc/updater";
import { acquireSyncBarrier, endSyncBarrier } from "../ipc/barrier";
import { useWorkspace } from "./workspace";

type Phase = "idle" | "checking" | "available" | "current" | "unsupported" | "error" | "busy" | "closeWorkspace" | "installing";
interface State {
  phase: Phase;
  version: string | null;
  notes: string | null;
  /**
   * What actually failed, kept instead of thrown away.
   *
   * `update_install` already hands the plugin's own message across the IPC —
   * `.map_err(|e| e.to_string())` in `updater.rs` — and this store used to
   * `catch { set({ phase: "error" }) }` and drop it, leaving one sentence for
   * every cause: *"check your connection"*. On macOS the common failure has
   * nothing to do with the connection. The bundle is replaced by renaming the
   * running `.app` out of the way, and a `PermissionDenied` there escalates to
   * an administrator prompt while **any other error returns immediately with no
   * prompt at all** — usually `EXDEV`, a rename across filesystems, which is
   * what an application running from a mounted `.dmg` or from a
   * Gatekeeper-translocated path produces. Told to check their connection, a
   * user retries forever; told the real error, they move the app to
   * `/Applications`.
   */
  detail: string | null;
  check: (manual?: boolean) => Promise<void>;
  dismiss: () => void;
  install: () => Promise<void>;
}
const dismissedKey = "tura-dismissed-update";
/**
 * The rejection value of a Tauri command is whatever the Rust side returned —
 * a plain string here, because `update_install` returns `Result<(), String>`.
 * Anything else is still shown rather than swallowed: an unrecognised shape is
 * a worse thing to hide than to print.
 */
function describe(e: unknown): string | null {
  if (typeof e === "string") return e.trim() || null;
  if (e instanceof Error) return e.message.trim() || null;
  if (e == null) return null;
  try { return JSON.stringify(e); } catch { return String(e); }
}
function dismissed(): string | null { try { return localStorage.getItem(dismissedKey); } catch { return null; } }
export const useUpdater = create<State>((set, get) => ({
  phase: "idle", version: null, notes: null, detail: null,
  check: async (manual = false) => {
    if (["checking", "installing"].includes(get().phase)) return;
    const previous = get();
    set({ phase: "checking", detail: null });
    try {
      const result = await checkUpdate();
      if (!result.supported) { set({ phase: manual ? "unsupported" : "idle", version: null, notes: null }); return; }
      const show = result.version && (manual || result.version !== dismissed());
      set({ version: result.version, notes: result.notes, phase: show ? "available" : manual ? "current" : "idle" });
    } catch (e) {
      set({ phase: manual ? "error" : previous.phase, detail: describe(e) });
    }
  },
  dismiss: () => {
    try { if (get().version) localStorage.setItem(dismissedKey, get().version!); } catch { /* session-only dismissal */ }
    set({ phase: "idle" });
  },
  /**
   * ADR-074 puts the installation *after* the normal workspace-close flow, and
   * this is where that flow is run.
   *
   * It used to be a precondition left to the user: the banner said to close the
   * workspace and its only button repeated the sentence, while the one command
   * that closes a workspace lives in a menu in the sidebar footer. A guard that
   * states a rule and offers no way to obey it does not read as a guard — it
   * reads as an update that is broken, which is how it was reported.
   *
   * `leave()` is the same path the workspace menu takes, so unsaved work still
   * stops the close and is still named in the question it asks, and it answers
   * `false` when the user declines. The close is invisible across the restart:
   * `restore_last_workspace` opens the same workspace on the way back.
   */
  install: async () => {
    if (!["available", "closeWorkspace", "error", "busy"].includes(get().phase) || !get().version) return;
    const root = useWorkspace.getState().info?.root ?? null;
    if (root && !(await useWorkspace.getState().leave())) { set({ phase: "closeWorkspace" }); return; }
    // Waits for the calls in flight instead of losing a coin toss against
    // them. The close was itself one of those calls, and the index poll fires
    // every 500 ms whatever else is happening.
    if (await acquireSyncBarrier()) {
      set({ phase: "installing", detail: null });
      try { await installUpdate(); }
      catch (e) { set({ phase: "error", detail: describe(e) }); }
      finally { endSyncBarrier(); if (get().phase === "installing") set({ phase: "idle" }); }
    } else {
      // Not `error`: nothing was downloaded, nothing was extracted and nothing
      // was renamed, so the platform advice about where the application lives
      // is advice about a step that never ran. Reaching this now means a call
      // that did not finish inside the timeout, which is a real condition
      // rather than the scheduling accident it used to be.
      set({ phase: "busy", detail: null });
    }
    // Still running, so the restart did not happen and the workspace was closed
    // for an installation that did not take place. Put it back: `update_install`
    // never returns on success, so reaching this line at all means the failure
    // path, and stranding the user at the Welcome screen would be a second
    // failure caused by the first.
    if (root && !useWorkspace.getState().info) await useWorkspace.getState().switchTo(root);
  },
}));
