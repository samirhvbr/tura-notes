import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import * as ipc from "../ipc";
import { isSyncLocked } from "../ipc/barrier";
import { editorBridge, readSelection, type EditorBridge } from "../editor/selection";
import type { EditOp, Skip } from "../editor/aiEdits";
import { useEditor } from "./editor";
import { useTabs } from "./tabs";
import { useWorkspace } from "./workspace";

/**
 * One conversation with the AI assistant (ADR-100), held in memory and nowhere
 * else: closing the window ends it, because a conversation about a document is
 * not a document and nothing here is written to disk.
 *
 * A reply arrives as events (`ai:delta`, any `ai:tool`, then `ai:done` or
 * `ai:error`) tagged with the chat they belong to. The worker starts before the page has the
 * chat's id, so an event can arrive first; those are held and replayed once the
 * id is known, and an event for a chat that is not the current one is dropped.
 */
export type TurnState =
  | "streaming"
  | "done"
  | "stopped"
  | "max_tokens"
  | "refusal"
  | "other"
  | "error";

/** Why a change the assistant asked for was not made. Every one of these is
 *  shown to the user in words; none is silent. */
export type NotApplied =
  | Skip
  | "not_shared"
  | "read_only"
  | "busy"
  | "interrupted"
  | "open_failed"
  | "failed"
  | ipc.AiRejection;

/**
 * What became of one change the assistant asked for, shown on the chat as a
 * card. `undo` is how to take it back from here while the note is still open
 * and nothing has been typed in it since; after that the note's own Ctrl+Z is
 * the way, and the card says so.
 */
export interface EditCard {
  id: number;
  kind: "edit" | "create" | "rejected";
  /** The note's path, or for a rejected call, the tool's name. */
  path: string;
  state: "applied" | "undone" | "not_applied";
  why?: NotApplied;
  detail?: string;
  undo?: { noteId: string; token: number };
  undoBlocked?: boolean;
}

export interface Turn {
  id: number;
  role: ipc.AiRole;
  content: string;
  state: TurnState;
  error?: ipc.AiError;
  /** What was sent with this question, for the user's turn. */
  sent?: ipc.AiSentItem[];
  /** The selection's text and note, for the user's turn: what a
   *  `replace_selection` is allowed to replace. */
  shared?: { path: string | null; text: string };
  /** Tool calls that arrived with this reply, until the turn ends. */
  tools?: ipc.AiTool[];
  /** What became of them. */
  edits?: EditCard[];
}

type Early = { kind: "delta"; chat: string; text: string } | { kind: "tool"; chat: string; tool: ipc.AiTool } | { kind: "done"; chat: string; stop: ipc.AiStop } | { kind: "error"; chat: string; error: ipc.AiError };

interface ChatState {
  turns: Turn[];
  chat: string | null;
  busy: boolean;
  attached: string[];
  includeCurrent: boolean;
  includeSelection: boolean;
  provider: string | null;
  send: (text: string, current: string | null) => Promise<void>;
  stop: () => Promise<void>;
  /** Take back what a card says the assistant did, if it can still be taken back. */
  undoEdit: (turnId: number, cardId: number) => boolean;
  clear: () => void;
  attach: (path: string) => void;
  detach: (path: string) => void;
  setIncludeCurrent: (on: boolean) => void;
  setIncludeSelection: (on: boolean) => void;
  setProvider: (id: string | null) => void;
  /** Subscribe to the four events. Returns the function that unsubscribes. */
  listen: () => Promise<() => void>;
}

let next = 1;
let early: Early[] = [];

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** The editor holding `path`, opening the note first if it is not on screen.
 *  The editor is rebuilt when a note opens, so it is awaited rather than assumed. */
async function editorFor(path: string): Promise<EditorBridge | null> {
  const on = () => {
    const doc = useEditor.getState().doc;
    const bridge = editorBridge();
    return doc && doc.path === path && bridge && bridge.noteId === doc.noteId ? bridge : null;
  };
  const shown = on();
  if (shown) return shown;
  await useTabs.getState().openPath(path as ipc.RelPath);
  for (let waited = 0; waited < 3000; waited += 25) {
    const bridge = on();
    if (bridge) return bridge;
    await sleep(25);
  }
  return null;
}

type Group =
  | { kind: "edit"; path: string; ops: EditOp[] }
  | { kind: "create"; path: string; text: string }
  | { kind: "rejected"; name: string; reason: ipc.AiRejection };

/** Consecutive edits to one note are one group, so they become one transaction
 *  and one undo. */
function grouped(tools: ipc.AiTool[]): Group[] {
  const out: Group[] = [];
  for (const tool of tools) {
    const last = out[out.length - 1];
    if (tool.kind === "edit") {
      const op: EditOp = { op: tool.operation, text: tool.text };
      if (last?.kind === "edit" && last.path === tool.path) last.ops.push(op);
      else out.push({ kind: "edit", path: tool.path, ops: [op] });
    } else if (tool.kind === "create") {
      out.push({ kind: "create", path: tool.path, text: tool.text });
    } else {
      out.push({ kind: "rejected", name: tool.name, reason: tool.reason });
    }
  }
  return out;
}

/** An assistant turn as the model should remember it: what it said, and the
 *  changes it made, so a later question about "what you just did" has an answer.
 *  This is for the model, not the user, and stays in English. */
function remembered(turn: Turn): string {
  const made = (turn.edits ?? [])
    .filter((c) => c.state !== "not_applied" && c.kind !== "rejected")
    .map((c) => `[${c.kind === "create" ? "created" : "edited"} ${c.path}]`);
  return [turn.content, ...made].filter((s) => s.trim()).join("\n\n");
}

const finish: Record<ipc.AiStop, TurnState> = {
  end_turn: "done",
  max_tokens: "max_tokens",
  refusal: "refusal",
  other: "other",
  cancelled: "stopped",
};

export const useAiChat = create<ChatState>((set, get) => {
  /** Apply one event to the reply being written, the last turn. */
  const apply = (event: Early) => {
    const before = get();
    if (before.chat !== event.chat) return;
    const last = before.turns[before.turns.length - 1];
    if (!last || last.role !== "assistant") return;
    set((s) => {
      const turns = s.turns.slice();
      if (event.kind === "delta") {
        turns[turns.length - 1] = { ...last, content: last.content + event.text };
        return { turns };
      }
      if (event.kind === "tool") {
        turns[turns.length - 1] = { ...last, tools: [...(last.tools ?? []), event.tool] };
        return { turns };
      }
      turns[turns.length - 1] =
        event.kind === "done"
          ? { ...last, state: finish[event.stop], tools: undefined }
          : { ...last, state: "error", error: event.error, tools: undefined };
      return { turns, busy: false, chat: null };
    });
    if (event.kind === "done" || event.kind === "error") {
      // A change is made only by a reply that finished: after Stop or a failure
      // the user is told what was not applied instead of having it happen.
      const finished = event.kind === "done" && event.stop !== "cancelled";
      if (last.tools?.length) void runTools(last.id, last.tools, !finished);
    }
  };

  const patch = (turnId: number, edits: EditCard[]) =>
    set((s) => ({ turns: s.turns.map((t) => (t.id === turnId ? { ...t, edits } : t)) }));

  /** Make the changes a reply asked for, one note at a time, and leave a card
   *  for each saying what happened. */
  const runTools = async (turnId: number, tools: ipc.AiTool[], interrupted: boolean) => {
    const turns = get().turns;
    const at = turns.findIndex((t) => t.id === turnId);
    const asked = turns[at - 1];
    // Only a note the user chose to share may be edited, and one the assistant
    // created in this same reply.
    const allowed = new Set((asked?.sent ?? []).map((i) => i.label).filter((l) => l !== "selection"));
    const cards: EditCard[] = [];
    const card = (c: Omit<EditCard, "id">) => {
      cards.push({ ...c, id: cards.length + 1 });
      patch(turnId, cards.slice());
    };
    const refused = (kind: "edit" | "create", path: string, why: NotApplied, detail?: string) =>
      card({ kind, path, state: "not_applied", why, detail });

    for (const g of grouped(tools)) {
      if (g.kind === "rejected") {
        card({ kind: "rejected", path: g.name, state: "not_applied", why: g.reason });
        continue;
      }
      if (interrupted) {
        refused(g.kind, g.path, "interrupted");
        continue;
      }
      if (g.kind === "edit" && !allowed.has(g.path)) {
        refused("edit", g.path, "not_shared");
        continue;
      }
      if (isSyncLocked()) {
        refused(g.kind, g.path, "busy");
        continue;
      }
      try {
        let path = g.path;
        let ops: EditOp[];
        if (g.kind === "create") {
          const slash = g.path.lastIndexOf("/");
          const dir = (slash < 0 ? ipc.ROOT : g.path.slice(0, slash)) as ipc.RelPath;
          const entry = await ipc.noteCreate(dir, g.path.slice(slash + 1));
          path = entry.path;
          allowed.add(path);
          await useWorkspace.getState().refresh(dir);
          ops = g.text ? [{ op: "replace_all", text: g.text }] : [];
        } else {
          ops = g.ops;
        }
        const bridge = await editorFor(path);
        if (!bridge) {
          // A note that was just created exists even if it could not be shown.
          if (g.kind === "create") card({ kind: "create", path, state: "applied" });
          else refused("edit", path, "open_failed");
          continue;
        }
        const shared = asked?.shared && asked.shared.path === path ? asked.shared.text : null;
        const result = ops.length
          ? bridge.apply(ops, shared)
          : { applied: 0, skipped: [], readOnly: false, token: null };
        if (result.readOnly) {
          refused(g.kind, path, "read_only");
        } else if (g.kind === "create") {
          // The note exists whatever became of its text.
          card({
            kind: "create",
            path,
            state: "applied",
            undo: result.token === null ? undefined : { noteId: bridge.noteId, token: result.token },
            why: result.applied === 0 && ops.length ? "busy" : result.skipped[0],
          });
        } else if (result.applied === 0 || result.token === null) {
          refused("edit", path, result.skipped[0] ?? "busy");
        } else {
          card({
            kind: "edit",
            path,
            state: "applied",
            undo: { noteId: bridge.noteId, token: result.token },
            why: result.skipped[0],
          });
        }
      } catch (e) {
        const error = e as { code?: string; reason?: string };
        refused(g.kind, g.path, "failed", String(error.reason ?? error.code ?? ""));
      }
    }
  };

  return {
    turns: [],
    chat: null,
    busy: false,
    attached: [],
    includeCurrent: true,
    includeSelection: true,
    provider: null,

    send: async (text, current) => {
      const state = get();
      const question = text.trim();
      if (state.busy || !question) return;
      // The conversation so far, as the provider should see it: finished turns
      // and a partial reply, but not a turn that only failed or came back empty.
      const history: ipc.AiChatMessage[] = state.turns
        .filter((t) => !(t.role === "assistant" && t.state === "error"))
        .map((t) => ({ role: t.role, content: remembered(t) }))
        .filter((m) => m.content.trim());
      const notes = [...(state.includeCurrent && current ? [current] : []), ...state.attached];
      const selection = state.includeSelection ? readSelection() : "";
      const request: ipc.AiChatRequest = {
        provider: state.provider,
        messages: [...history, { role: "user", content: question }],
        notes: [...new Set(notes)],
        selection: selection.trim() ? { path: current, text: selection } : null,
      };
      const userTurn: Turn = {
        id: next++,
        role: "user",
        content: question,
        state: "done",
        shared: selection.trim() ? { path: current, text: selection } : undefined,
      };
      const replyTurn: Turn = { id: next++, role: "assistant", content: "", state: "streaming" };
      early = [];
      set({ turns: [...state.turns, userTurn, replyTurn], busy: true, chat: null });
      try {
        const started = await ipc.aiChatStart(request);
        set((s) => ({
          chat: started.chat,
          turns: s.turns.map((t) => (t.id === userTurn.id ? { ...t, sent: started.sent } : t)),
        }));
        const held = early.filter((e) => e.chat === started.chat);
        early = [];
        held.forEach(apply);
      } catch (e) {
        early = [];
        set((s) => ({
          busy: false,
          chat: null,
          turns: s.turns.map((t) =>
            t.id === replyTurn.id ? { ...t, state: "error", error: ipc.asAiError(e) } : t,
          ),
        }));
      }
    },

    undoEdit: (turnId, cardId) => {
      const turn = get().turns.find((t) => t.id === turnId);
      const card = turn?.edits?.find((c) => c.id === cardId);
      if (!turn || !card?.undo || card.state !== "applied") return false;
      const bridge = editorBridge();
      const done = !!bridge && bridge.noteId === card.undo.noteId && bridge.undo(card.undo.token);
      patch(
        turnId,
        (turn.edits ?? []).map((c) =>
          c.id === cardId ? (done ? { ...c, state: "undone" as const } : { ...c, undoBlocked: true }) : c,
        ),
      );
      return done;
    },

    stop: async () => {
      const chat = get().chat;
      if (chat) await ipc.aiChatCancel(chat).catch(() => {});
    },

    clear: () => {
      void get().stop();
      early = [];
      set({ turns: [], chat: null, busy: false });
    },

    attach: (path) => set((s) => (s.attached.includes(path) ? s : { attached: [...s.attached, path] })),
    detach: (path) => set((s) => ({ attached: s.attached.filter((p) => p !== path) })),
    setIncludeCurrent: (on) => set({ includeCurrent: on }),
    setIncludeSelection: (on) => set({ includeSelection: on }),
    setProvider: (id) => set({ provider: id }),

    listen: async () => {
      // Before the chat id is known (`chat` is null while `busy`), an event is
      // held; once it is known, only that chat's events count.
      const route = (event: Early) => {
        const s = get();
        if (s.chat === null && s.busy) early.push(event);
        else apply(event);
      };
      const unlisten = await Promise.all([
        listen<ipc.AiDelta>("ai:delta", (e) => route({ kind: "delta", chat: e.payload.chat, text: e.payload.text })),
        listen<ipc.AiToolCall>("ai:tool", (e) => route({ kind: "tool", chat: e.payload.chat, tool: e.payload.tool })),
        listen<ipc.AiDone>("ai:done", (e) => route({ kind: "done", chat: e.payload.chat, stop: e.payload.stop })),
        listen<ipc.AiFailed>("ai:error", (e) => route({ kind: "error", chat: e.payload.chat, error: e.payload.error })),
      ]);
      return () => unlisten.forEach((u) => u());
    },
  };
});
