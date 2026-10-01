import { afterEach, beforeEach, expect, it, vi } from "vitest";
import * as ipc from "../ipc";
import { useAiChat } from "./aiChat";
import { registerSelection } from "../editor/selection";

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
