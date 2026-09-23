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
  const error=useWorkspace(s=>s.error);
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
    const picked = await openDialog({ directory: true, multiple: false });
    if (typeof picked !== "string") return;
    try {
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
    <div className="welcome">
      <img src="/tura-icon.svg" width="88" height="88" alt="" />
      <h1>{t("welcome.title")}</h1>
      <UpdateButton />
      {error && <p role="alert">{t(`error.${error.code}`)}</p>}
      <p className="muted">{t("welcome.subtitle")}</p>
      <div className="actions">
        <button onClick={() => pick(false)}>{t("welcome.open")}</button>
        <button onClick={() => pick(true)}>{t("welcome.create")}</button>
      </div>
      {recent.length > 0 && (
        <section className="recent">
          <h2>{t("welcome.recent")}</h2>
          <ul>
            {recent.slice(0, 8).map((w) => (
              <li key={w.id}>
                <button
                  onClick={() =>
                    ipc.workspaceOpen(w.root).then(adopt).catch(fail)
                  }
                  title={w.root}
                >
                  {w.display_name}
                  <span className="muted"> — {w.root}</span>
                </button>
                <button
                  className="forget"
                  onClick={() => void forget(w)}
                  aria-label={t("welcome.forget.title", { name: w.display_name })}
                >
                  {t("welcome.forget")}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {refused && <p role="alert">{refused}</p>}
      <button className="remove-data" onClick={() => void removeAll()}>
        {t("welcome.removeData")}
      </button>
    </div>
  );
}
