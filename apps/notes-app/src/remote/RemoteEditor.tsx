import { useMemo, useRef, useState } from "react";
import { Cloud, Eye, MoreVertical, Pencil } from "lucide-react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { Editor } from "../editor/Editor";
import { Preview } from "../preview/Preview";
import { Divider } from "../app/Divider";
import { Menu, type MenuRow } from "../app/Menu";
import { askConfirm } from "../app/dialog";
import { diffLines } from "../conflict/diff";
import { DiffColumns } from "../conflict/Compare";
import { useRemote } from "../stores/remote";
import { dirty, useRemoteDoc } from "../stores/remoteDoc";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";
import { askRemoteName, remoteErrorText } from "./RemoteBrowser";
import { useRemoteSync } from "./useRemoteSync";

/**
 * A note of the remote folder, open in the main area (ADR-099).
 *
 * The same editor and preview as a local note, fed from the remote store. The
 * banners are this note's states the local editor does not have: changed on
 * the server, gone from the server, and unsent.
 */
export function RemoteEditor() {
  const doc = useRemoteDoc((s) => s.doc);
  const edit = useRemoteDoc((s) => s.edit);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const config = useRemote((s) => s.config);
  const note = useWorkspace((s) => s.note);
  const panes = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [message, setMessage] = useState("");
  const trigger = useRef<HTMLButtonElement | null>(null);
  // The note on screen is read again every ten seconds; see useRemoteSync.
  useRemoteSync(!!doc?.path);

  if (!doc) {
    return (
      <div className="empty">
        <p className="muted">{t("remote.pick")}</p>
      </div>
    );
  }

  async function run(work: () => Promise<void>) {
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(remoteErrorText(ipc.asCoreError(e)));
    }
  }
  const openNote = (path: string) => void run(() => useRemoteDoc.getState().open(path));
  const name = doc.path.split("/").pop() ?? doc.path;
  const title = name.replace(/\.(md|markdown)$/i, "");
  const showing = view === "preview";
  const unsent = dirty(doc);

  const rows: MenuRow[] = [
    {
      id: "remote-rename",
      label: t("remote.rename"),
      // A rename carries the tag the note was saved at: unsent text would be
      // left behind at the old path.
      disabled: unsent,
      run: async () => {
        const target = await askRemoteName(doc.path);
        if (target && target !== doc.path) await run(() => useRemoteDoc.getState().rename(target));
      },
    },
    {
      id: "remote-copy-local",
      label: t("remote.copyToLocal"),
      run: () =>
        run(async () => {
          const path = await useRemoteDoc.getState().copyToLocal();
          note(t("remote.copiedToLocal", { path }));
        }),
    },
    {
      id: "remote-delete",
      label: t("remote.delete"),
      danger: true,
      run: async () => {
        const yes = await askConfirm({
          title: t("remote.delete.title", { name }),
          body: t("remote.delete.body"),
          confirmLabel: t("remote.delete"),
          danger: true,
        });
        if (yes) await run(() => useRemoteDoc.getState().remove());
      },
    },
  ];

  return (
    <>
      <header className="note-head">
        <div className="note-nav">
          <span className="remote-badge" title={config?.origin}>
            <Cloud size={14} aria-hidden="true" />
            <span className="sr-only">{t("remote.title")}</span>
          </span>
        </div>
        <h1 className="note-title" title={doc.path}>
          {title}
        </h1>
        <div className="note-actions">
          <button
            type="button"
            className="icon-btn"
            aria-label={showing ? t("note.toSource") : t("note.toPreview")}
            title={showing ? t("note.toSource") : t("note.toPreview")}
            onClick={() => setView(showing ? "source" : "preview")}
          >
            {showing ? <Pencil size={15} aria-hidden="true" /> : <Eye size={15} aria-hidden="true" />}
          </button>
          <button
            ref={trigger}
            type="button"
            className="icon-btn"
            aria-haspopup="menu"
            aria-expanded={menu}
            aria-label={t("note.more")}
            title={t("note.more")}
            onClick={() => setMenu((m) => !m)}
          >
            <MoreVertical size={15} aria-hidden="true" />
          </button>
          <Menu
            rows={rows}
            open={menu}
            onClose={() => setMenu(false)}
            label={t("note.more")}
            align="end"
            trigger={trigger}
          />
        </div>
      </header>

      {doc.conflict && (
        <div className="banner warn">
          <strong>{t("remote.conflict.title", { name })}</strong>
          <span>{t("remote.conflict.body")}</span>
          <button onClick={() => setComparing((c) => !c)}>{t("conflict.compare")}</button>
          <button onClick={() => void run(() => useRemoteDoc.getState().resolve("mine"))}>
            {t("remote.conflict.mine")}
          </button>
          <button onClick={() => void run(() => useRemoteDoc.getState().resolve("theirs"))}>
            {t("remote.conflict.theirs")}
          </button>
          <button onClick={() => void run(() => useRemoteDoc.getState().resolve("copy"))}>
            {t("remote.conflict.copy")}
          </button>
        </div>
      )}
      {doc.status === "gone" && (
        <div className="banner warn">
          <strong>{t("remote.gone.title", { name })}</strong>
          <span>{t("remote.gone.body")}</span>
          <button onClick={() => void run(() => useRemoteDoc.getState().recreate())}>
            {t("remote.gone.recreate")}
          </button>
          <button
            onClick={() =>
              void run(async () => {
                const path = await useRemoteDoc.getState().copyToLocal();
                note(t("remote.copiedToLocal", { path }));
              })
            }
          >
            {t("remote.copyToLocal")}
          </button>
        </div>
      )}
      {doc.status === "offline" && (
        <div className="banner">
          <span>{t("remote.offline")}</span>
          <button onClick={() => void useRemoteDoc.getState().save()}>{t("remote.retry")}</button>
        </div>
      )}
      {doc.readOnly && (
        <div className="banner">
          <span>{t("remote.readOnly")}</span>
        </div>
      )}
      {!!message && (
        <div className="banner warn" role="status">
          <span>{message}</span>
        </div>
      )}

      {comparing && doc.conflict ? (
        <RemoteCompare mine={doc.text} theirs={doc.conflict.text} name={name} onClose={() => setComparing(false)} />
      ) : (
        <div className={`panes pane-${view}`} ref={panes} id="note-panel" role="tabpanel">
          {view !== "preview" && (
            <Editor
              source={{
                id: `remote:${doc.path}`,
                text: doc.text,
                readOnly: !!doc.readOnly || doc.status === "gone",
                savedVersion: doc.savedVersion,
                externalRev: doc.externalRev,
                edit,
              }}
            />
          )}
          {view === "split" && <Divider panes={panes} />}
          {view !== "source" && (
            <Preview remote={{ path: doc.path, text: doc.text, openNote: (p) => openNote(p) }} />
          )}
        </div>
      )}
    </>
  );
}

/** The two texts, line by line: this buffer against the server's. Comparing
 *  changes nothing; the choice is made with the banner's buttons. */
function RemoteCompare({
  mine,
  theirs,
  name,
  onClose,
}: {
  mine: string;
  theirs: string;
  name: string;
  onClose: () => void;
}) {
  const diff = useMemo(() => diffLines(mine, theirs), [mine, theirs]);
  return (
    <div className="compare">
      <header className="compare-head">
        <strong>{t("remote.compare.title", { name })}</strong>
        <span className="muted">{t("conflict.compare.summary", { count: diff.changed })}</span>
        <span className="spacer" />
        <button onClick={onClose}>{t("conflict.compare.close")}</button>
      </header>
      <DiffColumns diff={diff} label={t("remote.compare.title", { name })} theirs={t("remote.compare.server")} />
    </div>
  );
}
