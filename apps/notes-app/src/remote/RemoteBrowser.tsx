import { useEffect, useState, type CSSProperties } from "react";
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
  Minus,
  RefreshCw,
} from "lucide-react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { errorText } from "../app/StatusBar";
import { buildTree, useRemote, type RemoteDir } from "../stores/remote";

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
  const loading = useRemote((s) => s.loading);
  const error = useRemote((s) => s.error);
  const [editing, setEditing] = useState(false);

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
        <RemoteConnect initial={config} onDone={() => setEditing(false)} cancellable={!!config} />
      </div>
    );

  const root = entries ? buildTree(entries) : null;
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
        <button type="button" className="link-btn" onClick={() => setEditing(true)}>
          {t("remote.change")}
        </button>
      </div>
      {entries && (
        <p className="muted remote-pad" role="status">
          {t("remote.summary", {
            total: entries.length,
            absent: count("absent"),
            differs: count("differs"),
          })}
        </p>
      )}
      {error && (
        <p role="alert" className="remote-pad">
          {remoteErrorText(error)}
        </p>
      )}
      <div className="side-scroll">
        {loading && !entries && <p className="muted remote-pad">{t("remote.loading")}</p>}
        {entries && !entries.length && <p className="muted remote-pad">{t("remote.empty")}</p>}
        {root && (
          <ul className="tree" aria-label={t("remote.title")}>
            <Level dir={root} depth={0} onOpen={onOpen} />
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
}: {
  dir: RemoteDir;
  depth: number;
  onOpen?: (entry: ipc.RemoteEntry) => void;
}) {
  const expanded = useRemote((s) => s.expanded);
  return (
    <>
      {dir.dirs.map((d) => {
        const isOpen = !!expanded[d.path];
        return (
          <li key={d.path}>
            <div className="row-wrap" style={{ "--depth": depth } as CSSProperties}>
              <button
                className="row"
                style={{ paddingLeft: 8 + depth * 14 }}
                aria-expanded={isOpen}
                title={d.path}
                onClick={() => useRemote.getState().toggle(d.path)}
              >
                <span className="twist" aria-hidden="true">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
                <span className="glyph" aria-hidden="true">
                  {isOpen ? <FolderOpen size={14} /> : <Folder size={14} />}
                </span>
                <span className="label">{d.name}</span>
              </button>
            </div>
            {isOpen && (
              <ul className="tree">
                <Level dir={d} depth={depth + 1} onOpen={onOpen} />
              </ul>
            )}
          </li>
        );
      })}
      {dir.notes.map((n) => (
        <li key={n.path}>
          <div className="row-wrap" style={{ "--depth": depth } as CSSProperties}>
            <button
              className="row"
              style={{ paddingLeft: 8 + depth * 14 }}
              title={n.path}
              disabled={!onOpen}
              onClick={() => onOpen?.(n)}
            >
              <span className="twist" aria-hidden="true" />
              <span className="glyph" aria-hidden="true">
                <FileText size={14} />
              </span>
              <span className="label">{n.path.split("/").pop()}</span>
              <Mark mark={n.local} />
            </button>
          </div>
        </li>
      ))}
    </>
  );
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
export function remoteErrorText(e: ipc.CoreError): string {
  if (e.code === "sync") {
    const said: Partial<Record<ipc.SyncCause, string>> = {
      offline: t("remote.error.offline"),
      denied: t("remote.error.denied"),
      busy: t("remote.error.busy"),
      limit: t("remote.error.limit"),
      protocol: t("remote.error.protocol"),
      invalid: t("remote.error.invalid"),
    };
    return said[e.cause] ?? errorText(e);
  }
  return errorText(e);
}

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
  );
}
