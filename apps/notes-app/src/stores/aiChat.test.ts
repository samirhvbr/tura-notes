import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
import { useAiChat } from "./aiChat";
import { registerEditorBridge, registerSelection, type EditorBridge } from "../editor/selection";
import { useEditor } from "./editor";
import { useTabs } from "./tabs";
import { useWorkspace } from "./workspace";

// The events are the Tauri ones; the test plays them by hand.
type Handler = (e: { payload: unknown }) => void;
const handlers: Record<string, Handler> = {};
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, h: Handler) => {
    handlers[name] = h;
    return () => delete handlers[name];
  }),
}));
vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  aiChatStart: vi.fn(),
  aiChatCancel: vi.fn(async () => {}),
  noteCreate: vi.fn(),
}));

const fire = (name: string, payload: unknown) => handlers[name]({ payload });
const reset = () =>
  useAiChat.setState({ turns: [], chat: null, busy: false, attached: [], includeCurrent: true, includeSelection: true, provider: null });

let unlisten: () => void;
beforeEach(async () => {
  reset();
  registerSelection(null);
  unlisten = await useAiChat.getState().listen();
});
afterEach(() => {
  unlisten();
  vi.clearAllMocks();
});

const started = (chat: string, sent: ipc.AiSentItem[] = []) => vi.mocked(ipc.aiChatStart).mockResolvedValue({ chat, sent });
const last = () => {
  const turns = useAiChat.getState().turns;
  return turns[turns.length - 1];
};

it("sends the conversation with the current note and the attached ones, by path, and the selection by text", async () => {
  registerSelection(() => "trecho escolhido");
  started("c1", [{ label: "a.md", chars: 10, truncated: false }]);
  useAiChat.getState().attach("b/outra.md");
  useAiChat.getState().attach("a.md"); // already the current note: sent once
  await useAiChat.getState().send("  resuma  ", "a.md");
  expect(ipc.aiChatStart).toHaveBeenCalledWith({
    provider: null,
    messages: [{ role: "user", content: "resuma" }],
    notes: ["a.md", "b/outra.md"],
    selection: { path: "a.md", text: "trecho escolhido" },
  });
  const turns = useAiChat.getState().turns;
  expect(turns.map((t) => t.role)).toEqual(["user", "assistant"]);
  expect(turns[0].sent).toEqual([{ label: "a.md", chars: 10, truncated: false }]);
});

it("leaves out what the user switched off", async () => {
  registerSelection(() => "trecho");
  started("c1");
  useAiChat.setState({ includeCurrent: false, includeSelection: false });
  await useAiChat.getState().send("oi", "a.md");
  const request = vi.mocked(ipc.aiChatStart).mock.calls[0][0];
  expect(request.notes).toEqual([]);
  expect(request.selection).toBeNull();
});

it("writes the reply as the pieces arrive and ends it on done", async () => {
  started("c1");
  await useAiChat.getState().send("oi", null);
  fire("ai:delta", { chat: "c1", text: "Olá, " });
  fire("ai:delta", { chat: "c1", text: "mundo" });
  expect(last()).toMatchObject({ content: "Olá, mundo", state: "streaming" });
  expect(useAiChat.getState().busy).toBe(true);
  fire("ai:done", { chat: "c1", stop: "end_turn" });
  expect(last().state).toBe("done");
  expect(useAiChat.getState().busy).toBe(false);
});

it("holds events that arrive before the chat's id is known, and replays them in order", async () => {
  let release!: (s: ipc.AiChatStarted) => void;
  vi.mocked(ipc.aiChatStart).mockReturnValue(new Promise((r) => (release = r)));
  const sending = useAiChat.getState().send("oi", null);
  // The worker already runs: its events beat the answer to the command.
  fire("ai:delta", { chat: "c9", text: "um " });
  fire("ai:delta", { chat: "c9", text: "dois" });
  fire("ai:done", { chat: "c9", stop: "end_turn" });
  expect(last().content).toBe("");
  release({ chat: "c9", sent: [] });
  await sending;
  expect(last()).toMatchObject({ content: "um dois", state: "done" });
  expect(useAiChat.getState().busy).toBe(false);
});

it("ignores events of another chat", async () => {
  started("c1");
  await useAiChat.getState().send("oi", null);
  fire("ai:delta", { chat: "old", text: "de outra conversa" });
  fire("ai:done", { chat: "old", stop: "end_turn" });
  expect(last()).toMatchObject({ content: "", state: "streaming" });
});

it("keeps what came before a failure and shows its reason", async () => {
  started("c1");
  await useAiChat.getState().send("oi", null);
  fire("ai:delta", { chat: "c1", text: "meio" });
  fire("ai:error", { chat: "c1", error: { code: "offline", detail: null } });
  expect(last()).toMatchObject({ content: "meio", state: "error", error: { code: "offline" } });
  expect(useAiChat.getState().busy).toBe(false);
});

it("maps every way a reply can end to its own state", async () => {
  for (const [stop, state] of [["max_tokens", "max_tokens"], ["refusal", "refusal"], ["other", "other"], ["cancelled", "stopped"]] as const) {
    reset();
    started("c1");
    await useAiChat.getState().send("oi", null);
    fire("ai:done", { chat: "c1", stop });
    expect(last().state, stop).toBe(state);
  }
});

it("a refused start becomes an error on the reply and frees the chat", async () => {
  vi.mocked(ipc.aiChatStart).mockRejectedValue({ code: "disabled", detail: null });
  await useAiChat.getState().send("oi", null);
  expect(last()).toMatchObject({ state: "error", error: { code: "disabled" } });
  expect(useAiChat.getState().busy).toBe(false);
});

it("does not send while a reply is running, or an empty question", async () => {
  started("c1");
  await useAiChat.getState().send("   ", null);
  expect(ipc.aiChatStart).not.toHaveBeenCalled();
  await useAiChat.getState().send("oi", null);
  await useAiChat.getState().send("outra", null);
  expect(ipc.aiChatStart).toHaveBeenCalledTimes(1);
});

it("the next question carries the earlier turns, a partial reply included, and not a failed one", async () => {
  started("c1");
  await useAiChat.getState().send("primeira", null);
  fire("ai:delta", { chat: "c1", text: "resposta parcial" });
  fire("ai:done", { chat: "c1", stop: "cancelled" });
  started("c2");
  await useAiChat.getState().send("segunda", null);
  expect(vi.mocked(ipc.aiChatStart).mock.calls[1][0].messages).toEqual([
    { role: "user", content: "primeira" },
    { role: "assistant", content: "resposta parcial" },
    { role: "user", content: "segunda" },
  ]);
  fire("ai:error", { chat: "c2", error: { code: "offline", detail: null } });
  started("c3");
  await useAiChat.getState().send("terceira", null);
  const roles = vi.mocked(ipc.aiChatStart).mock.calls[2][0].messages.map((m) => m.content);
  expect(roles).toEqual(["primeira", "resposta parcial", "segunda", "terceira"]);
});

it("stop asks Rust to cancel the running chat, and clear ends it and empties the conversation", async () => {
  started("c1");
  await useAiChat.getState().send("oi", null);
  await useAiChat.getState().stop();
  expect(ipc.aiChatCancel).toHaveBeenCalledWith("c1");
  useAiChat.getState().clear();
  expect(useAiChat.getState()).toMatchObject({ turns: [], busy: false, chat: null });
  fire("ai:delta", { chat: "c1", text: "tarde demais" });
  expect(useAiChat.getState().turns).toEqual([]);
});

// ---- the assistant's edits --------------------------------------------------

const shownDoc = (path: string, noteId = "n1") =>
  useEditor.setState({ doc: { noteId, path } as never });

/** An editor that records what it was asked to do and answers as scripted. */
function fakeEditor(noteId: string, answer: Partial<ReturnType<EditorBridge["apply"]>> = {}) {
  const bridge = {
    noteId,
    apply: vi.fn(() => ({ applied: 1, skipped: [], readOnly: false, token: 7, ...answer })),
    undo: vi.fn(() => true),
  } satisfies EditorBridge;
  registerEditorBridge(bridge);
  return bridge;
}

const settle = () => new Promise((r) => setTimeout(r, 0));
const edit = (path: string, operation: ipc.AiEditOp, text: string): ipc.AiTool => ({ kind: "edit", path, operation, text });

async function turnWith(tools: ipc.AiTool[], stop: ipc.AiStop = "end_turn", sent: ipc.AiSentItem[] = [{ label: "a.md", chars: 5, truncated: false }]) {
  started("c1", sent);
  await useAiChat.getState().send("reescreve", "a.md");
  fire("ai:delta", { chat: "c1", text: "Feito." });
  for (const tool of tools) fire("ai:tool", { chat: "c1", tool });
  fire("ai:done", { chat: "c1", stop });
  await settle();
  return last();
}

afterEach(() => {
  registerEditorBridge(null);
  useEditor.setState({ doc: null });
});

it("edits to the open note go to the editor together, as one transaction, with a card that can undo it", async () => {
  shownDoc("a.md");
  const bridge = fakeEditor("n1");
  const reply = await turnWith([edit("a.md", "replace_all", "novo"), edit("a.md", "insert_at_cursor", "!")]);
  expect(bridge.apply).toHaveBeenCalledTimes(1);
  expect(bridge.apply).toHaveBeenCalledWith(
    [{ op: "replace_all", text: "novo" }, { op: "insert_at_cursor", text: "!" }],
    null,
  );
  expect(reply.edits).toEqual([
    { id: 1, kind: "edit", path: "a.md", state: "applied", undo: { noteId: "n1", token: 7 } },
  ]);
  expect(reply.tools).toBeUndefined();

  expect(useAiChat.getState().undoEdit(reply.id, 1)).toBe(true);
  expect(bridge.undo).toHaveBeenCalledWith(7);
  expect(last().edits?.[0].state).toBe("undone");
});

it("a card cannot undo once the editor has moved on, and says so instead of undoing something else", async () => {
  shownDoc("a.md");
  const bridge = fakeEditor("n1");
  const reply = await turnWith([edit("a.md", "replace_all", "novo")]);
  bridge.undo.mockReturnValue(false);
  expect(useAiChat.getState().undoEdit(reply.id, 1)).toBe(false);
  expect(last().edits?.[0]).toMatchObject({ state: "applied", undoBlocked: true });
  // Another note on screen: the editor is not the one the card names.
  registerEditorBridge(null);
  fakeEditor("n2");
  expect(useAiChat.getState().undoEdit(reply.id, 1)).toBe(false);
});

it("replace_selection acts on the text that was sent, only for the note it came from", async () => {
  shownDoc("a.md");
  registerSelection(() => "trecho");
  const bridge = fakeEditor("n1");
  await turnWith([edit("a.md", "replace_selection", "x")]);
  expect(bridge.apply).toHaveBeenCalledWith([{ op: "replace_selection", text: "x" }], "trecho");
  registerSelection(null);
});

it("a note the user did not share is left alone, and the card says why", async () => {
  shownDoc("a.md");
  const bridge = fakeEditor("n1");
  const reply = await turnWith([edit("secret.md", "replace_all", "x")]);
  expect(bridge.apply).not.toHaveBeenCalled();
  expect(reply.edits).toEqual([{ id: 1, kind: "edit", path: "secret.md", state: "not_applied", why: "not_shared" }]);
});

it("after Stop or a failure nothing is applied, and each change says it was not", async () => {
  shownDoc("a.md");
  const bridge = fakeEditor("n1");
  const stopped = await turnWith([edit("a.md", "replace_all", "x")], "cancelled");
  expect(bridge.apply).not.toHaveBeenCalled();
  expect(stopped.edits?.[0]).toMatchObject({ state: "not_applied", why: "interrupted" });

  reset();
  started("c2");
  await useAiChat.getState().send("outra", "a.md");
  fire("ai:tool", { chat: "c2", tool: edit("a.md", "replace_all", "x") });
  fire("ai:error", { chat: "c2", error: { code: "offline", detail: null } });
  await settle();
  expect(bridge.apply).not.toHaveBeenCalled();
  expect(last()).toMatchObject({ state: "error", edits: [{ why: "interrupted" }] });
});

it("a refusal from the editor becomes a card with its reason", async () => {
  shownDoc("a.md");
  fakeEditor("n1", { applied: 0, skipped: ["selection_changed"], token: null });
  const moved = await turnWith([edit("a.md", "replace_selection", "x")]);
  expect(moved.edits?.[0]).toMatchObject({ state: "not_applied", why: "selection_changed" });

  reset();
  shownDoc("a.md");
  fakeEditor("n1", { applied: 0, skipped: [], readOnly: true, token: null });
  const locked = await turnWith([edit("a.md", "replace_all", "x")]);
  expect(locked.edits?.[0]).toMatchObject({ state: "not_applied", why: "read_only" });
});

it("a part of a turn that could not be applied is mentioned on the card that was applied", async () => {
  shownDoc("a.md");
  fakeEditor("n1", { applied: 1, skipped: ["no_selection"], token: 3 });
  const reply = await turnWith([edit("a.md", "replace_all", "x")]);
  expect(reply.edits?.[0]).toMatchObject({ state: "applied", why: "no_selection" });
});

it("calls the model got wrong show as ignored requests, never as edits", async () => {
  shownDoc("a.md");
  const bridge = fakeEditor("n1");
  const reply = await turnWith([{ kind: "rejected", name: "rm_rf", reason: "unknown_tool" }]);
  expect(bridge.apply).not.toHaveBeenCalled();
  expect(reply.edits).toEqual([{ id: 1, kind: "rejected", path: "rm_rf", state: "not_applied", why: "unknown_tool" }]);
});

it("create_note makes the note through the core, opens it, writes its text and may undo that", async () => {
  shownDoc("a.md");
  vi.mocked(ipc.noteCreate).mockResolvedValue({ path: "ideas/plan.md", name: "plan.md" } as ipc.Entry);
  const refresh = vi.fn(async () => {});
  useWorkspace.setState({ refresh } as never);
  const bridge = fakeEditor("n2");
  const open = vi.fn(async () => shownDoc("ideas/plan.md", "n2"));
  useTabs.setState({ openPath: open } as never);
  const reply = await turnWith([{ kind: "create", path: "ideas/plan.md", text: "# Plano" }]);
  expect(ipc.noteCreate).toHaveBeenCalledWith("ideas", "plan.md");
  expect(refresh).toHaveBeenCalledWith("ideas");
  expect(open).toHaveBeenCalledWith("ideas/plan.md");
  expect(bridge.apply).toHaveBeenCalledWith([{ op: "replace_all", text: "# Plano" }], null);
  expect(reply.edits?.[0]).toMatchObject({ kind: "create", path: "ideas/plan.md", state: "applied", undo: { noteId: "n2", token: 7 } });
});

it("create_note that the core refuses is a card, and no editor is touched", async () => {
  shownDoc("a.md");
  vi.mocked(ipc.noteCreate).mockRejectedValue({ code: "already_exists" });
  const bridge = fakeEditor("n1");
  const reply = await turnWith([{ kind: "create", path: "a.md", text: "x" }]);
  expect(bridge.apply).not.toHaveBeenCalled();
  expect(reply.edits?.[0]).toMatchObject({ kind: "create", state: "not_applied", why: "failed", detail: "already_exists" });
});

it("what the assistant changed is remembered for the next question, and what it did not change is not", async () => {
  shownDoc("a.md");
  fakeEditor("n1");
  await turnWith([edit("a.md", "replace_all", "x"), { kind: "rejected", name: "x", reason: "unknown_tool" }]);
  started("c3");
  await useAiChat.getState().send("e agora?", "a.md");
  const messages = (vi.mocked(ipc.aiChatStart).mock.calls[vi.mocked(ipc.aiChatStart).mock.calls.length - 1]?.[0].messages ?? []);
  expect(messages.map((m) => m.content)).toEqual(["reescreve", "Feito.\n\n[edited a.md]", "e agora?"]);
});
