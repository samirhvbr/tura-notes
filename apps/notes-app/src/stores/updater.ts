import { create } from "zustand";
import { checkUpdate, installUpdate } from "../ipc/updater";
import { beginSyncBarrier, endSyncBarrier } from "../ipc/barrier";
import { useWorkspace } from "./workspace";

type Phase = "idle" | "checking" | "available" | "current" | "unsupported" | "error" | "closeWorkspace" | "installing";
interface State {
  phase: Phase;
  version: string | null;
  notes: string | null;
  check: (manual?: boolean) => Promise<void>;
  dismiss: () => void;
  install: () => Promise<void>;
}
const dismissedKey = "tura-dismissed-update";
function dismissed(): string | null { try { return localStorage.getItem(dismissedKey); } catch { return null; } }
export const useUpdater = create<State>((set, get) => ({
  phase: "idle", version: null, notes: null,
  check: async (manual = false) => {
    if (["checking", "installing"].includes(get().phase)) return;
    const previous = get();
    set({ phase: "checking" });
    try {
      const result = await checkUpdate();
      if (!result.supported) { set({ phase: manual ? "unsupported" : "idle", version: null, notes: null }); return; }
      const show = result.version && (manual || result.version !== dismissed());
      set({ version: result.version, notes: result.notes, phase: show ? "available" : manual ? "current" : "idle" });
    } catch {
      set({ phase: manual ? "error" : previous.phase });
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
    if (!["available", "closeWorkspace", "error"].includes(get().phase) || !get().version) return;
    const root = useWorkspace.getState().info?.root ?? null;
    if (root && !(await useWorkspace.getState().leave())) { set({ phase: "closeWorkspace" }); return; }
    if (beginSyncBarrier()) {
      set({ phase: "installing" });
      try { await installUpdate(); }
      catch { set({ phase: "error" }); }
      finally { endSyncBarrier(); if (get().phase === "installing") set({ phase: "idle" }); }
    } else {
      set({ phase: "error" });
    }
    // Still running, so the restart did not happen and the workspace was closed
    // for an installation that did not take place. Put it back: `update_install`
    // never returns on success, so reaching this line at all means the failure
    // path, and stranding the user at the Welcome screen would be a second
    // failure caused by the first.
    if (root && !useWorkspace.getState().info) await useWorkspace.getState().switchTo(root);
  },
}));
