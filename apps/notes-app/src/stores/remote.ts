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
  loading: boolean;
  error: ipc.CoreError | null;
  expanded: Record<string, boolean>;
  hydrate(): Promise<void>;
  configure(config: ipc.RemoteConfig | null): Promise<void>;
  refresh(): Promise<void>;
  toggle(dir: string): void;
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
    set({ config, entries: null, error: null, adopted: false });
    if (config) await get().refresh();
  },

  refresh() {
    if (inflight) return inflight;
    set({ loading: true, error: null });
    inflight = ipc
      .remoteList()
      .then((entries) => set({ entries }))
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
}

/**
 * The server lists notes, not folders: every folder here is a prefix of some
 * note's path. Folders first, then notes, each by name — the order the local
 * tree uses.
 */
export function buildTree(entries: ipc.RemoteEntry[]): RemoteDir {
  const root: RemoteDir = { name: "", path: "", dirs: [], notes: [] };
  for (const entry of entries) {
    const parts = entry.path.split("/");
    let dir = root;
    for (const part of parts.slice(0, -1)) {
      const path = dir.path ? `${dir.path}/${part}` : part;
      let next = dir.dirs.find((d) => d.name === part);
      if (!next) {
        next = { name: part, path, dirs: [], notes: [] };
        dir.dirs.push(next);
      }
      dir = next;
    }
    dir.notes.push(entry);
  }
  const order = (d: RemoteDir) => {
    d.dirs.sort((a, b) => a.name.localeCompare(b.name));
    d.notes.sort((a, b) => a.path.localeCompare(b.path));
    d.dirs.forEach(order);
  };
  order(root);
  return root;
}
