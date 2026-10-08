import { create } from "zustand";
import * as ipc from "../ipc";

/**
 * The remote folder (ADR-099): the server's notes workspace, as the rail's
 * cloud icon shows it.
 *
 * The list is **not persisted** and not cached across sessions: it is asked of
 * the server when the panel opens and when the user refreshes, because a tree
 * remembered from yesterday is a tree that shows notes somebody deleted. Only
 * which folders are expanded is remembered, per viewer, in `localStorage`.
 */
export interface RemoteState {
  /** `undefined` until the saved configuration has been read. */
  config: ipc.RemoteConfig | null | undefined;
  /** The connection was taken from Device sync rather than typed here. */
  adopted: boolean;
  /** Not configured, but Device sync's half-filled form names a server: what
   *  the connection form starts from, so nothing is typed twice. */
  suggestion: ipc.RemoteConfig | null;
  entries: ipc.RemoteEntry[] | null;
  /** The server's folders, empty ones included (1.11.0). */
  folders: string[];
  /** The server lists folders and can be asked to make one. False on an older
   *  server, and before the first listing. */
  foldersSupported: boolean;
  /** Folders made here that the server cannot hold: only on a server older than
   *  1.11.0, whose tree is its notes. Such a folder is this window's until a
   *  note is created in it, and is forgotten when the application closes. */
  pending: string[];
  loading: boolean;
  error: ipc.CoreError | null;
  expanded: Record<string, boolean>;
  hydrate(): Promise<void>;
  configure(config: ipc.RemoteConfig | null): Promise<void>;
  refresh(): Promise<void>;
  toggle(dir: string): void;
  /** Make an empty folder — on the server when it knows folders, else only in
   *  this window — and open it and its parents so it is seen. Rejects with the
   *  server's refusal. */
  addFolder(path: string): Promise<void>;
  /** Forget a folder that only exists here. */
  forgetFolder(path: string): void;
}

const EXPANDED = "tura-remote-expanded";
function remembered(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(EXPANDED);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}
function remember(expanded: Record<string, boolean>) {
  try {
    localStorage.setItem(EXPANDED, JSON.stringify(expanded));
  } catch {
    /* A private window or blocked storage: the tree still works, it just forgets. */
  }
}

/** One refresh at a time: a second click while the first is on the wire would
 *  spend a request of the server's 60 a minute on the same answer. */
let inflight: Promise<void> | null = null;

export const useRemote = create<RemoteState>((set, get) => ({
  config: undefined,
  adopted: false,
  suggestion: null,
  entries: null,
  folders: [],
  foldersSupported: false,
  pending: [],
  loading: false,
  error: null,
  expanded: remembered(),

  async hydrate() {
    try {
      const config = await ipc.remoteConfigGet();
      if (config) {
        set({ config });
        return;
      }
      // The same server, the same workspace, the same credential file that
      // Device sync already holds: asking for them again was the panel's first
      // question, and the owner had answered it once already.
      const { paired, draft } = await fromDeviceSync();
      if (paired) {
        try {
          await ipc.remoteConfigSet(paired);
          set({ config: paired, adopted: true });
          return;
        } catch {
          /* Refused (a path the folder rules reject): fall back to the form. */
        }
      }
      set({ config: null, suggestion: paired ?? draft });
    } catch (e) {
      set({ config: null, error: ipc.asCoreError(e) });
    }
  },

  async configure(config) {
    await ipc.remoteConfigSet(config);
    set({ config, entries: null, folders: [], foldersSupported: false, error: null, adopted: false });
    if (config) await get().refresh();
  },

  refresh() {
    if (inflight) return inflight;
    set({ loading: true, error: null });
    inflight = ipc
      .remoteList()
      .then((tree) =>
        set((s) => ({
          entries: tree.entries,
          folders: tree.folders,
          foldersSupported: tree.folders_supported,
          // A folder that now has a note or a folder under it, or is one, is on
          // the server and is no longer this window's to remember.
          pending: s.pending.filter(
            (p) =>
              !tree.entries.some((e) => e.path.startsWith(`${p}/`)) &&
              !tree.folders.some((f) => f === p || f.startsWith(`${p}/`)),
          ),
        })),
      )
      .catch((e) => set({ error: ipc.asCoreError(e) }))
      .finally(() => {
        set({ loading: false });
        inflight = null;
      });
    return inflight;
  },

  toggle(dir) {
    const expanded = { ...get().expanded, [dir]: !get().expanded[dir] };
    set({ expanded });
    remember(expanded);
  },

  async addFolder(path) {
    const parts = path.split("/");
    const levels = parts.map((_, i) => parts.slice(0, i + 1).join("/"));
    const server = get().foldersSupported;
    // Before anything is shown: a refusal leaves no folder behind.
    if (server) await ipc.remoteCreateFolder(path);
    const expanded = { ...get().expanded };
    // Every level is opened, or the new folder would be made and not shown.
    for (const level of levels) expanded[level] = true;
    set((s) =>
      server
        ? { expanded, folders: [...new Set([...s.folders, ...levels])] }
        : { expanded, pending: s.pending.includes(path) ? s.pending : [...s.pending, path] },
    );
    remember(expanded);
  },

  forgetFolder(path) {
    set((s) => ({ pending: s.pending.filter((p) => p !== path && !p.startsWith(`${path}/`)) }));
  },
}));

/**
 * What Device sync knows about the server. `paired` comes from a real pairing
 * (the snapshot's endpoint and the credential path of its connection) and is
 * used as is. `draft` is the pairing form as the user left it, kept only to
 * pre-fill: nobody confirmed it.
 */
export async function fromDeviceSync(): Promise<{
  paired: ipc.RemoteConfig | null;
  draft: ipc.RemoteConfig | null;
}> {
  let paired: ipc.RemoteConfig | null = null;
  try {
    const s = await ipc.deviceStatus();
    if (s.paired && s.connection?.token_file)
      paired = {
        origin: s.paired.origin,
        workspace: s.paired.workspace,
        token_file: s.connection.token_file,
        allow_private: s.paired.allow_private,
      };
  } catch {
    /* No device sync, or it cannot be read: there is simply nothing to adopt. */
  }
  let draft: ipc.RemoteConfig | null = null;
  try {
    const raw = localStorage.getItem("tura-pair-draft");
    const d = raw ? (JSON.parse(raw) as Partial<ipc.SyncPairRequest>) : null;
    if (d?.origin && d.token_file)
      draft = {
        origin: d.origin,
        workspace: d.workspace ?? "",
        token_file: d.token_file,
        allow_private: !!d.allow_private,
      };
  } catch {
    /* A draft is a convenience. */
  }
  return { paired, draft };
}

/** A folder of the remote tree, built from the flat list of note paths. */
export interface RemoteDir {
  name: string;
  path: string;
  dirs: RemoteDir[];
  notes: ipc.RemoteEntry[];
  /** Nothing of the server's is in it: it is a folder made here, still empty. */
  virtual?: boolean;
}

/**
 * Every folder here is a prefix of some note's path, or one the server listed
 * (1.11.0), or one made in this window against an older server (`pending`).
 * Folders first, then notes, each by name — the order the local tree uses.
 */
export function buildTree(
  entries: ipc.RemoteEntry[],
  pending: string[] = [],
  folders: string[] = [],
): RemoteDir {
  const root: RemoteDir = { name: "", path: "", dirs: [], notes: [] };
  const descend = (parts: string[], virtual: boolean): RemoteDir => {
    let dir = root;
    for (const part of parts) {
      const path = dir.path ? `${dir.path}/${part}` : part;
      let next = dir.dirs.find((d) => d.name === part);
      if (!next) {
        next = { name: part, path, dirs: [], notes: [], ...(virtual ? { virtual: true } : {}) };
        dir.dirs.push(next);
      }
      dir = next;
    }
    return dir;
  };
  for (const entry of entries) {
    const parts = entry.path.split("/");
    descend(parts.slice(0, -1), false).notes.push(entry);
  }
  // Folders the server holds, the empty ones among them.
  for (const path of folders) descend(path.split("/"), false);
  // Folders made here and still empty. A folder the server's notes already
  // make is left as it is: it is not "only here".
  for (const path of pending) descend(path.split("/"), true);
  const order = (d: RemoteDir) => {
    d.dirs.sort((a, b) => a.name.localeCompare(b.name));
    d.notes.sort((a, b) => a.path.localeCompare(b.path));
    d.dirs.forEach(order);
  };
  order(root);
  return root;
}
