import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { t } from "../i18n";
import { acquireSyncBarrier, endSyncBarrier, isComposing, isSyncLocked } from "../ipc/barrier";
import { sameBuffer, useEditor } from "../stores/editor";
import { dirty as remoteDirty, type RemoteDoc, useRemoteDoc } from "../stores/remoteDoc";
import { preserveLocalBuffer } from "../stores/tabs";
import { askConfirm } from "./dialog";
import { errorText } from "./StatusBar";

function coversRemoteBuffer(confirmed: RemoteDoc | null, current: RemoteDoc | null): boolean {
  if (!current || !remoteDirty(current)) return true;
  return !!confirmed && current.path === confirmed.path && current.text === confirmed.text &&
    current.etag === confirmed.etag && current.bufferVersion === confirmed.bufferVersion &&
    current.externalRev === confirmed.externalRev;
}

/** The native window remains open until this handler calls destroy. */
export function useDesktopClose(): string | null {
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    let closing = false;
    let unlisten: (() => void) | undefined;
    const close = async () => {
      if (!live || closing) return;
      closing = true;
      setProblem(null);
      let locked = false;
      let destroying = false;
      try {
        if (isSyncLocked() || isComposing()) {
          setProblem(t("quit.busy"));
          return;
        }

        // ADR-099: remote text stays in memory unless the server takes it or
        // the user confirms leaving it behind. Only the confirmed buffer is
        // covered, including when a save or a confirmation took time.
        let confirmed: RemoteDoc | null = null;
        if (remoteDirty(useRemoteDoc.getState().doc)) {
          await useRemoteDoc.getState().save();
          const remote = useRemoteDoc.getState().doc;
          if (remote && remoteDirty(remote)) {
            const leave = await askConfirm({
              title: t("remote.unsent.title", { name: remote.path }),
              body: t("remote.unsent.window"),
              confirmLabel: t("remote.unsent.quit"),
              danger: true,
            });
            if (!leave) return;
            confirmed = remote;
          }
        }

        const durable = await preserveLocalBuffer();
        if (durable === false) {
          const error = useEditor.getState().doc?.lastError;
          setProblem(error ? t("quit.local", { reason: errorText(error) }) : t("quit.changed"));
          return;
        }

        locked = await acquireSyncBarrier();
        if (!locked || isComposing()) {
          setProblem(t("quit.busy"));
          return;
        }
        const local = useEditor.getState().doc;
        if ((local && local.bufferVersion !== local.savedVersion && !sameBuffer(local, durable)) ||
            !coversRemoteBuffer(confirmed, useRemoteDoc.getState().doc)) {
          setProblem(t("quit.changed"));
          return;
        }
        if (!live) return;
        await getCurrentWindow().destroy();
        destroying = true;
      } catch {
        setProblem(t("quit.failed"));
      } finally {
        if (locked && !destroying) endSyncBarrier();
        if (!destroying) closing = false;
      }
    };
    void listen("notes://close-requested", close)
      .then((off) => { if (live) unlisten = off; else off(); })
      .catch(() => { /* Browser previews have no Tauri event bus. */ });

    // An external shutdown may bypass the close request. This fallback is
    // best effort, and the guarded destroy already verified both buffers.
    const beforeUnload = () => {
      const { doc, keepDraft } = useEditor.getState();
      if (!isSyncLocked() && doc && doc.bufferVersion !== doc.savedVersion) void keepDraft("exit");
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      live = false;
      unlisten?.();
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, []);

  return problem;
}
