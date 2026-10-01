import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import * as ipc from "../ipc";
import { readSelection } from "../editor/selection";

/**
 * One conversation with the AI assistant (ADR-100), held in memory and nowhere
 * else: closing the window ends it, because a conversation about a document is
 * not a document and nothing here is written to disk.
 *
 * A reply arrives as events (`ai:delta`, then `ai:done` or `ai:error`) tagged
 * with the chat they belong to. The worker starts before the page has the
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

export interface Turn {
  id: number;
  role: ipc.AiRole;
  content: string;
  state: TurnState;
  error?: ipc.AiError;
  /** What was sent with this question, for the user's turn. */
  sent?: ipc.AiSentItem[];
}

type Early = { kind: "delta"; chat: string; text: string } | { kind: "done"; chat: string; stop: ipc.AiStop } | { kind: "error"; chat: string; error: ipc.AiError };

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
  clear: () => void;
  attach: (path: string) => void;
  detach: (path: string) => void;
  setIncludeCurrent: (on: boolean) => void;
  setIncludeSelection: (on: boolean) => void;
  setProvider: (id: string | null) => void;
  /** Subscribe to the three events. Returns the function that unsubscribes. */
  listen: () => Promise<() => void>;
}

let next = 1;
let early: Early[] = [];

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
    set((s) => {
      if (s.chat !== event.chat) return s;
      const turns = s.turns.slice();
      const last = turns[turns.length - 1];
      if (!last || last.role !== "assistant") return s;
      if (event.kind === "delta") {
        turns[turns.length - 1] = { ...last, content: last.content + event.text };
        return { turns };
      }
      turns[turns.length - 1] =
        event.kind === "done"
          ? { ...last, state: finish[event.stop] }
          : { ...last, state: "error", error: event.error };
      return { turns, busy: false, chat: null };
    });
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
        .filter((t) => t.content.trim() && !(t.role === "assistant" && t.state === "error"))
        .map((t) => ({ role: t.role, content: t.content }));
      const notes = [...(state.includeCurrent && current ? [current] : []), ...state.attached];
      const selection = state.includeSelection ? readSelection() : "";
      const request: ipc.AiChatRequest = {
        provider: state.provider,
        messages: [...history, { role: "user", content: question }],
        notes: [...new Set(notes)],
        selection: selection.trim() ? { path: current, text: selection } : null,
      };
      const userTurn: Turn = { id: next++, role: "user", content: question, state: "done" };
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
        listen<ipc.AiDone>("ai:done", (e) => route({ kind: "done", chat: e.payload.chat, stop: e.payload.stop })),
        listen<ipc.AiFailed>("ai:error", (e) => route({ kind: "error", chat: e.payload.chat, error: e.payload.error })),
      ]);
      return () => unlisten.forEach((u) => u());
    },
  };
});
