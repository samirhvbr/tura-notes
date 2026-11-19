import { AlertCircle, Folder, FolderOpen, FolderPlus } from "lucide-react";
import { UpdateButton } from "./Updater";
import { Dialog } from "./DialogHost";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { t } from "../i18n";
import { askConfirm, askText } from "./dialog";
import { errorText } from "./StatusBar";
import * as ipc from "../ipc";
import { useWorkspace } from "../stores/workspace";
import type { WorkspaceEntry } from "../ipc";

export function Welcome() { return <><WelcomeContent/><Dialog/></>; }
function WelcomeContent() {
  const adopt = useWorkspace((s) => s.adopt);
  const fail = useWorkspace((s) => s.fail);
  const error = useWorkspace((s) => s.error);
  const [recent, setRecent] = useState<WorkspaceEntry[]>([]);
  const [refused, setRefused] = useState<string | null>(null);
  const reload = () => ipc.workspaceRecent().then(setRecent).catch(() => setRecent([]));

  useEffect(() => {
    void reload();
  }, []);

  // ADR-091: what Tura keeps about the user's notes can be removed from here.
  // A refusal (an unsaved draft, the workspace open elsewhere) is shown where
  // the action was taken, with the reason.
  const forget = async (w: WorkspaceEntry) => {
    const ok = await askConfirm({
      title: t("welcome.forget.title", { name: w.display_name }),
      body: t("welcome.forget.body"),
      confirmLabel: t("welcome.forget"),
      danger: true,
    });
    if (!ok) return;
    try {
      await ipc.workspaceForget(w.id);
      setRefused(null);
      await reload();
    } catch (e) {
      setRefused(errorText(ipc.asCoreError(e)));
    }
  };
  const removeAll = async () => {
    const ok = await askConfirm({
      title: t("welcome.removeData.title"),
      body: t("welcome.removeData.body"),
      confirmLabel: t("welcome.removeData.confirm"),
      danger: true,
    });
    if (!ok) return;
    try {
      await ipc.appDataRemove();
    } catch (e) {
      setRefused(errorText(ipc.asCoreError(e)));
    }
  };

  const pick = async (create: boolean) => {
    try {
      const picked = await openDialog({ directory: true, multiple: false });
      if (typeof picked !== "string") return;
      if (create) {
        const name = await askText({
          title: t("welcome.create"),
          label: t("welcome.createName"),
          initial: "notes",
          confirmLabel: t("dialog.create"),
          validate: (v) => (v.trim() ? null : t("dialog.nameRequired")),
        });
        if (!name) return;
        await adopt(await ipc.workspaceCreate(picked, name));
      } else {
        await adopt(await ipc.workspaceOpen(picked));
      }
    } catch (e) {
      fail(e);
    }
  };

  return (
    <main className="welcome">
      <div className="welcome-inner">
        <header className="welcome-brand">
          <img src="/tura-icon.svg" width="42" height="42" alt="" />
          <span>{t("welcome.title")}</span>
        </header>
        <h1>{t("welcome.heading")}</h1>
        <p className="welcome-lead">{t("welcome.subtitle")}</p>
        <div className="workspace-actions">
          <button className="action-button action-primary" onClick={() => void pick(false)}>
            <FolderOpen size={17} aria-hidden="true" />{t("welcome.open")}
          </button>
          <button className="action-button" onClick={() => void pick(true)}>
            <FolderPlus size={17} aria-hidden="true" />{t("welcome.create")}
          </button>
        </div>
        {error && <p className="workspace-feedback" role="alert"><AlertCircle size={16} aria-hidden="true" />{errorText(error)}</p>}
        {recent.length > 0 && (
          <section className="recent">
            <h2>{t("welcome.recent")}</h2>
            <ul>
              {recent.slice(0, 8).map((w) => (
                <li key={w.id}>
                  <button className="recent-open" title={w.root}
                    onClick={() => ipc.workspaceOpen(w.root).then(adopt).catch(fail)}>
                    <Folder size={18} aria-hidden="true" />
                    <span className="recent-location">
                      <strong>{w.display_name}</strong>
                      <span>{w.root}</span>
                    </span>
                  </button>
                  <button className="quiet-button" onClick={() => void forget(w)}
                    aria-label={t("welcome.forget.title", { name: w.display_name })}>
                    {t("welcome.forget")}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
        {refused && <p className="workspace-feedback" role="alert"><AlertCircle size={16} aria-hidden="true" />{refused}</p>}
        <footer className="welcome-tools">
          <UpdateButton />
          <button className="quiet-button" onClick={() => void removeAll()}>{t("welcome.removeData")}</button>
        </footer>
      </div>
    </main>
  );
}
