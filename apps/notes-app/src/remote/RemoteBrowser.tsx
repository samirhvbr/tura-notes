import { useEffect, useRef, useState, type CSSProperties } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cloud,
  Diff,
  FileText,
  Folder,
  FolderOpen,
  FolderPlus,
  Minus,
  MoreVertical,
  Plus,
  RefreshCw,
} from "lucide-react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { buildTree, useRemote, type RemoteDir } from "../stores/remote";
import { dirty, useRemoteDoc } from "../stores/remoteDoc";
import { Menu, type MenuRow } from "../app/Menu";
import { useUi } from "../stores/ui";
import { askText } from "../app/dialog";
import { remoteFolderPath, remoteNotePath } from "./names";
import { useRemoteListSync } from "./useRemoteSync";
import { SignIn } from "../app/SignIn";
import { remoteErrorText } from "./errorText";

// Other modules import it from here as they always did.
export { remoteErrorText };

/**
 * The remote folder's panel (ADR-099): the server's notes workspace as a tree,
 * each note marked against the local folder.
 *
 * Not configured, it is the connection form. Configured, it asks the server
 * for the tree when it opens and when the user refreshes — never on a timer,
 * because the server allows a credential 60 requests a minute and a panel that
 * polls spends them while nobody is looking.
 */
export function RemoteBrowser({ onOpen }: { onOpen?: (entry: ipc.RemoteEntry) => void }) {
  const config = useRemote((s) => s.config);
  const entries = useRemote((s) => s.entries);
  const pending = useRemote((s) => s.pending);
  const loading = useRemote((s) => s.loading);
  const error = useRemote((s) => s.error);
  const adopted = useRemote((s) => s.adopted);
  const suggestion = useRemote((s) => s.suggestion);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  // The tree follows the server while it is on screen; see useRemoteSync.
  useRemoteListSync(!!config);

  useEffect(() => {
    const s = useRemote.getState();
    if (s.config === undefined) void s.hydrate();
  }, []);
  useEffect(() => {
    const s = useRemote.getState();
    if (config && s.entries === null && !s.loading) void s.refresh();
  }, [config]);

  if (config === undefined) return <p className="muted remote-pad">{t("remote.loading")}</p>;
  if (!config || editing)
    return (
      <div className="side-scroll">
        <RemoteConnect
          initial={config ?? suggestion}
          onDone={() => setEditing(false)}
          cancellable={!!config}
        />
      </div>
    );

  const root = entries ? buildTree(entries, pending) : null;
  const count = (mark: ipc.LocalMark) => entries?.filter((e) => e.local === mark).length ?? 0;
  let host = config.origin;
  try {
    host = new URL(config.origin).host;
  } catch {
    /* The configuration was validated in Rust; this is only for display. */
  }
  return (
    <>
      <div className="remote-head">
        <span className="remote-where" title={config.origin}>
          <Cloud size={14} aria-hidden="true" />
          {t("remote.connected", { workspace: config.workspace, host })}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("remote.refresh")}
          title={t("remote.refresh")}
          disabled={loading}
          onClick={() => void useRemote.getState().refresh()}
        >
          <RefreshCw size={14} aria-hidden="true" className={loading ? "spin" : undefined} />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("remote.new")}
          title={t("remote.new")}
          onClick={() => void newNote(setMessage)}
        >
          <Plus size={14} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="icon-btn"
          aria-label={t("remote.newFolder")}
          title={t("remote.newFolder")}
          onClick={() => void newFolder("")}
        >
          <FolderPlus size={14} aria-hidden="true" />
        </button>
        <button type="button" className="link-btn" onClick={() => setEditing(true)}>
          {t("remote.change")}
        </button>
      </div>
      {adopted && <p className="muted remote-pad">{t("remote.adopted")}</p>}
      {entries && (
        <p className="muted remote-pad" role="status">
          {t("remote.summary", {
            total: entries.length,
            absent: count("absent"),
            differs: count("differs"),
          })}
        </p>
      )}
      {!!message && (
        <p role="status" className="remote-pad">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="remote-pad">
          {remoteErrorText(error)}
        </p>
      )}
      <div className="side-scroll">
        {loading && !entries && <p className="muted remote-pad">{t("remote.loading")}</p>}
        {entries && !entries.length && !pending.length && <p className="muted remote-pad">{t("remote.empty")}</p>}
        {root && (
          <ul className="tree" aria-label={t("remote.title")}>
            <Level dir={root} depth={0} onOpen={onOpen} say={setMessage} />
          </ul>
        )}
      </div>
    </>
  );
}

function Level({
  dir,
  depth,
  onOpen,
  say,
}: {
  dir: RemoteDir;
  depth: number;
  onOpen?: (entry: ipc.RemoteEntry) => void;
  say: (message: string) => void;
}) {
  return (
    <>
      {dir.dirs.map((d) => (
        <RemoteDirRow key={d.path} dir={d} depth={depth} onOpen={onOpen} say={say} />
      ))}
      {dir.notes.map((n) => (
        <RemoteNoteRow key={n.path} note={n} depth={depth} onOpen={onOpen} say={say} />
      ))}
    </>
  );
}

/**
 * One folder of the server's tree, with the rest of what is inside it. Right-click
 * (or the ⋮ button) offers a note or a folder made in it, and, for a folder that
 * only exists in this window, forgetting it.
 */
function RemoteDirRow({
  dir,
  depth,
  onOpen,
  say,
}: {
  dir: RemoteDir;
  depth: number;
  onOpen?: (entry: ipc.RemoteEntry) => void;
  say: (message: string) => void;
}) {
  const isOpen = useRemote((s) => !!s.expanded[dir.path]);
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const rows: MenuRow[] = [
    { id: "remote-dir-note", label: t("remote.folder.note"), run: () => newNote(say, `${dir.path}/`) },
    { id: "remote-dir-folder", label: t("remote.folder.folder"), run: () => newFolder(`${dir.path}/`) },
    ...(dir.virtual
      ? [
          { separator: true } as const,
          {
            id: "remote-dir-forget",
            label: t("remote.folder.forget"),
            run: () => useRemote.getState().forgetFolder(dir.path),
          },
        ]
      : []),
  ];
  return (
    <li>
      <div
        className="row-wrap"
        style={{ "--depth": depth } as CSSProperties}
        onContextMenu={(ev) => {
          ev.preventDefault();
          setMenu(true);
        }}
      >
        <button
          className="row"
          style={{ paddingLeft: 8 + depth * 14 }}
          aria-expanded={isOpen}
          title={dir.virtual ? t("remote.folder.virtual", { path: dir.path }) : dir.path}
          onClick={() => useRemote.getState().toggle(dir.path)}
        >
          <span className="twist" aria-hidden="true">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="glyph" aria-hidden="true">
            {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
          </span>
          <span className="label">{dir.name}</span>
          {dir.virtual && <span className="muted">{t("remote.folder.empty")}</span>}
        </button>
        <button
          ref={trigger}
          type="button"
          className="row-more"
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={t("tree.actions.hint", { path: dir.path })}
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
        >
          <MoreVertical size={14} aria-hidden="true" />
        </button>
        <Menu
          rows={rows}
          open={menu}
          onClose={() => setMenu(false)}
          label={t("tree.actions.hint", { path: dir.path })}
          align="end"
          trigger={trigger}
        />
      </div>
      {isOpen && (
        <ul className="tree">
          <Level dir={dir} depth={depth + 1} onOpen={onOpen} say={say} />
        </ul>
      )}
    </li>
  );
}

/**
 * One note of the server's tree. Right-click, or the ⋮ button for whoever has no
 * right button, opens its actions; for now that is renaming, which the server
 * does as a move (`POST /moves`) and which needs no folder of its own.
 */
function RemoteNoteRow({
  note,
  depth,
  onOpen,
  say,
}: {
  note: ipc.RemoteEntry;
  depth: number;
  onOpen?: (entry: ipc.RemoteEntry) => void;
  say: (message: string) => void;
}) {
  const mainView = useUi((s) => s.mainView);
  const open = useRemoteDoc((s) => s.doc);
  const [menu, setMenu] = useState(false);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const current = mainView === "remote" && open?.path === note.path;
  // Text not yet sent would be left behind at the old path.
  const unsent = open?.path === note.path && dirty(open);
  const rows: MenuRow[] = [
    {
      id: "remote-rename",
      label: t("remote.rename"),
      disabled: unsent,
      run: async () => {
        const to = await askRemoteName(note.path);
        if (!to || to === note.path) return;
        say("");
        try {
          await useRemoteDoc.getState().renameNote(note.path, to, note.etag);
        } catch (e) {
          say(remoteErrorText(ipc.asCoreError(e)));
        }
      },
    },
  ];
  return (
    <li>
      <div
        className={current ? "row-wrap on" : "row-wrap"}
        style={{ "--depth": depth } as CSSProperties}
        onContextMenu={(ev) => {
          ev.preventDefault();
          setMenu(true);
        }}
      >
        <button
          className="row"
          aria-current={current || undefined}
          style={{ paddingLeft: 8 + depth * 14 }}
          title={note.path}
          disabled={!onOpen}
          onClick={() => onOpen?.(note)}
        >
          <span className="twist" aria-hidden="true" />
          <span className="glyph" aria-hidden="true">
            <FileText size={14} />
          </span>
          <span className="label">{note.path.split("/").pop()}</span>
          <Mark mark={note.local} />
        </button>
        <button
          ref={trigger}
          type="button"
          className="row-more"
          aria-haspopup="menu"
          aria-expanded={menu}
          aria-label={t("tree.actions.hint", { path: note.path })}
          onClick={(e) => {
            e.stopPropagation();
            setMenu((m) => !m);
          }}
        >
          <MoreVertical size={14} aria-hidden="true" />
        </button>
        <Menu
          rows={rows}
          open={menu}
          onClose={() => setMenu(false)}
          label={t("tree.actions.hint", { path: note.path })}
          align="end"
          trigger={trigger}
        />
      </div>
    </li>
  );
}

/** Ask for a note's new name or path on the server. Null when the person
 *  cancelled, or typed what is not a note. */
export async function askRemoteName(path: string): Promise<string | null> {
  const to = await askText({
    title: t("remote.rename"),
    label: t("remote.newPath"),
    initial: path,
    confirmLabel: t("remote.rename"),
    validate: (v) => (remoteNotePath(v) ? null : t("remote.nameInvalid")),
  });
  return to ? remoteNotePath(to) : null;
}

/** A new note on the server, under folders that need not exist yet: the
 *  server makes them (`parents`, 1.9.8). */
async function newNote(say: (m: string) => void, initial = "") {
  const path = await askText({
    title: t("remote.new"),
    label: t("remote.newPath"),
    initial,
    confirmLabel: t("remote.create"),
    validate: (v) => (remoteNotePath(v) ? null : t("remote.nameInvalid")),
  });
  const note = path ? remoteNotePath(path) : null;
  if (!note) return;
  say("");
  try {
    await useRemoteDoc.getState().create(note);
  } catch (e) {
    say(remoteErrorText(ipc.asCoreError(e)));
  }
}

/**
 * A new folder on the server. The server's tree is its notes, so a folder is
 * only a prefix of some note's path: this one is made here, shown, and becomes the
 * server's when the first note is created in it (`parents`, 1.9.8). `initial` is
 * the folder it is made in, so a subfolder is a prefix away.
 */
async function newFolder(initial: string) {
  const typed = await askText({
    title: t("remote.newFolder"),
    label: t("remote.newFolder.prompt"),
    initial,
    confirmLabel: t("remote.create"),
    validate: (v) => (remoteFolderPath(v) ? null : t("remote.folderInvalid")),
  });
  const path = typed ? remoteFolderPath(typed) : null;
  if (path) useRemote.getState().addFolder(path);
}

/** An icon **and** a name for it: a colour alone says nothing to a screen
 *  reader, and nothing to someone who cannot tell the two greens apart. */
function Mark({ mark }: { mark: ipc.LocalMark }) {
  const said: Record<ipc.LocalMark, string> = {
    absent: t("remote.mark.absent"),
    same: t("remote.mark.same"),
    differs: t("remote.mark.differs"),
    unknown: t("remote.mark.unknown"),
  };
  const icon: Record<ipc.LocalMark, React.ReactNode> = {
    absent: <Cloud size={12} aria-hidden="true" />,
    same: <Check size={12} aria-hidden="true" />,
    differs: <Diff size={12} aria-hidden="true" />,
    unknown: <Minus size={12} aria-hidden="true" />,
  };
  return (
    <span className={`remote-mark ${mark}`} title={said[mark]}>
      {icon[mark]}
      <span className="sr-only">{said[mark]}</span>
    </span>
  );
}

/** The remote folder's own sentences for the causes it meets. The device-sync
 *  ones talk about pending revisions and pairing, which mean nothing here. */

/** Where the remote folder is: the same fields and connection test as the
 *  device-sync form, and nothing else. */
function RemoteConnect({
  initial,
  onDone,
  cancellable,
}: {
  initial: ipc.RemoteConfig | null;
  onDone: () => void;
  cancellable: boolean;
}) {
  const [form, setForm] = useState<ipc.RemoteConfig>(
    initial ?? { origin: "", workspace: "", token_file: "", allow_private: false },
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [probe, setProbe] = useState<ipc.SyncProbe | null>(null);
  const said: Record<ipc.SyncProbeOutcome, string> = {
    address: t("device.probe.address"),
    credential_file: t("device.probe.credentialFile"),
    credential_shape: t("device.probe.credentialShape"),
    unreachable: t("device.probe.unreachable"),
    refused: t("device.probe.refused"),
    unexpected: t("device.probe.unexpected"),
    granted: t("device.probe.granted"),
  };
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setMessage("");
    try {
      await work();
    } catch (e) {
      setMessage(remoteErrorText(ipc.asCoreError(e)));
    } finally {
      setBusy(false);
    }
  }
  async function test() {
    const found = await ipc.remoteProbe(form.origin, form.allow_private, form.token_file);
    setProbe(found);
    // The credential decides the workspace: fill an empty field, never
    // overwrite a different one.
    if (found.outcome === "granted" && found.workspace && !form.workspace)
      setForm((f) => ({ ...f, workspace: found.workspace! }));
  }
  async function pick() {
    const value = await open({ directory: false, multiple: false, title: t("device.token_file") });
    if (typeof value === "string") setForm((f) => ({ ...f, token_file: value }));
  }
  const ready = !!form.origin && !!form.workspace && !!form.token_file;
  return (
    <>
    <SignIn
      allowPrivate={form.allow_private}
      signedIn={form.token_file.startsWith("keychain:")}
      onPaired={async (paired) => {
        await useRemote.getState().configure({
          origin: paired.origin,
          workspace: paired.workspace,
          token_file: paired.token_file,
          allow_private: form.allow_private,
        });
        onDone();
      }}
      onSignedOut={() => useRemote.getState().configure(null)}
    />
    <fieldset className="remote-connect" disabled={busy}>
      <legend>{t("remote.title")}</legend>
      <p className="muted">{t("remote.explain")}</p>
      <label>
        {t("device.server")}
        <input
          type="url"
          placeholder="https://notes.example.com"
          value={form.origin}
          onChange={(e) => setForm({ ...form, origin: e.target.value })}
        />
      </label>
      <label>
        {t("device.token_file")}
        <span>
          <input
            value={form.token_file}
            onChange={(e) => setForm({ ...form, token_file: e.target.value })}
          />
          <button
            type="button"
            onClick={() => void pick()}
            aria-label={t("device.chooseField", { field: t("device.token_file") })}
          >
            {t("device.choose")}
          </button>
        </span>
      </label>
      <label>
        {t("device.remoteWorkspace")}
        <input
          value={form.workspace}
          onChange={(e) => setForm({ ...form, workspace: e.target.value })}
        />
      </label>
      <label>
        <input
          type="checkbox"
          checked={form.allow_private}
          onChange={(e) => setForm({ ...form, allow_private: e.target.checked })}
        />
        {t("device.private")}
      </label>
      <div className="device-actions">
        <button
          type="button"
          disabled={busy || !form.origin || !form.token_file}
          onClick={() => void run(test)}
        >
          {busy ? t("device.testing") : t("device.test")}
        </button>
        <button
          type="button"
          disabled={busy || !ready}
          onClick={() =>
            void run(async () => {
              await useRemote.getState().configure(form);
              onDone();
            })
          }
        >
          {t("remote.connect")}
        </button>
        {cancellable && (
          <>
            <button type="button" onClick={onDone}>
              {t("remote.cancel")}
            </button>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  await useRemote.getState().configure(null);
                  onDone();
                })
              }
            >
              {t("remote.disconnect")}
            </button>
          </>
        )}
      </div>
      {probe && (
        <p role="status" className="device-probe">
          {said[probe.outcome]}
          {probe.status !== null && ` (HTTP ${probe.status})`}
          {probe.outcome === "granted" &&
            ` · ${t("device.probe.workspace", { name: probe.workspace ?? "" })}`}
          {probe.outcome === "granted" &&
            !!probe.scope &&
            ` · ${t("device.probe.scope", { path: probe.scope })}`}
        </p>
      )}
      {!!message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </fieldset>
    </>
  );
}
