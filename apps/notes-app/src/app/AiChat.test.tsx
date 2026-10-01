// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiChat } from "./AiChat";
import * as ipc from "../ipc";
import { useAi } from "../stores/ai";
import { useAiChat, type EditCard, type NotApplied } from "../stores/aiChat";
import { useEditor } from "../stores/editor";
import { useUi } from "../stores/ui";
import { registerEditorBridge, registerSelection, setSelectionSize } from "../editor/selection";
import en from "../i18n/en.json";
import ptBR from "../i18n/pt-BR.json";

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
  aiOverview: vi.fn(),
  aiChatStart: vi.fn(),
  aiChatCancel: vi.fn(async () => {}),
  quickOpen: vi.fn(),
}));

const provider = (id: string, name: string): ipc.AiProviderView => ({
  id,
  kind: "anthropic",
  name,
  base_url: "https://api.anthropic.com",
  model: "claude-opus-5-5",
  key_configured: true,
});
const on: ipc.AiOverview = { enabled: true, default_provider: "p1", keychain: "available", providers: [provider("p1", "Claude")] };

const fire = (name: string, payload: unknown) => act(() => handlers[name]({ payload }));

beforeEach(() => {
  useAi.setState({ overview: on });
  useAiChat.setState({ turns: [], chat: null, busy: false, attached: [], includeCurrent: true, includeSelection: true, provider: null });
  useUi.setState({ mainView: "local" });
  useEditor.setState({ doc: { path: "notas/ideia.md", noteId: "n1" } as never });
  registerSelection(null);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const open = () => render(<AiChat onOpenSettings={() => {}} />);

it("says it is off, and offers the settings, when the assistant is off", () => {
  useAi.setState({ overview: { ...on, enabled: false } });
  const onOpenSettings = vi.fn();
  render(<AiChat onOpenSettings={onOpenSettings} />);
  expect(screen.getByText(/The AI assistant is off/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Open settings" }));
  expect(onOpenSettings).toHaveBeenCalled();
  expect(screen.queryByRole("textbox")).toBeNull();
});

it("asks for a provider when there is none", () => {
  useAi.setState({ overview: { ...on, providers: [], default_provider: null } });
  open();
  expect(screen.getByText("Add a provider in the settings to start.")).toBeInTheDocument();
});

it("shows what will be sent as chips, the current note and the selection, each one removable", () => {
  setSelectionSize(42);
  open();
  expect(screen.getByLabelText("This note · ideia.md")).toBeChecked();
  expect(screen.getByLabelText("Selection (42)")).toBeChecked();
  fireEvent.click(screen.getByRole("button", { name: "Do not send ideia.md" }));
  expect(useAiChat.getState().includeCurrent).toBe(false);
  expect(screen.getByLabelText("This note · ideia.md")).not.toBeChecked();
});

it("sends with Enter, keeps a line break on Shift+Enter, and shows what was sent", async () => {
  vi.mocked(ipc.aiChatStart).mockResolvedValue({
    chat: "c1",
    sent: [{ label: "notas/ideia.md", chars: 1234, truncated: true }],
  });
  open();
  const box = screen.getByRole("textbox", { name: /Write your question/ });
  fireEvent.change(box, { target: { value: "resuma" } });
  fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
  expect(ipc.aiChatStart).not.toHaveBeenCalled();
  fireEvent.keyDown(box, { key: "Enter" });
  await waitFor(() => expect(ipc.aiChatStart).toHaveBeenCalled());
  expect(vi.mocked(ipc.aiChatStart).mock.calls[0][0]).toMatchObject({ messages: [{ role: "user", content: "resuma" }], notes: ["notas/ideia.md"] });
  expect(await screen.findByText("Sent: notas/ideia.md (1234, cut)")).toBeInTheDocument();
  expect(box).toHaveValue("");
});

it("streams the reply, offers Stop while it runs, and Copy when it is done", async () => {
  vi.mocked(ipc.aiChatStart).mockResolvedValue({ chat: "c1", sent: [] });
  open();
  fireEvent.change(screen.getByRole("textbox", { name: /Write your question/ }), { target: { value: "oi" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Stop" });
  fireEvent.click(screen.getByRole("button", { name: "Stop" }));
  await waitFor(() => expect(ipc.aiChatCancel).toHaveBeenCalledWith("c1"));
  fire("ai:delta", { chat: "c1", text: "Olá" });
  fire("ai:done", { chat: "c1", stop: "cancelled" });
  expect(await screen.findByText("Olá")).toBeInTheDocument();
  expect(screen.getByText("You stopped this reply.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Send" })).toBeDisabled(); // nothing typed
});

it("says in words what went wrong, with the provider's own sentence only as detail", async () => {
  vi.mocked(ipc.aiChatStart).mockResolvedValue({ chat: "c1", sent: [] });
  open();
  fireEvent.change(screen.getByRole("textbox", { name: /Write your question/ }), { target: { value: "oi" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await screen.findByRole("button", { name: "Stop" });
  fire("ai:error", { chat: "c1", error: { code: "provider", detail: "model not found" } });
  expect(await screen.findByRole("alert")).toHaveTextContent("The provider said: model not found");
});

it("attaches a note found by name and sends it with the question", async () => {
  vi.mocked(ipc.quickOpen).mockResolvedValue({
    matches: [{ path: "arquivo/velha.md", name: "velha", score: 1 }],
    indexed: 1,
    building: false,
    unreadable: 0,
  });
  vi.mocked(ipc.aiChatStart).mockResolvedValue({ chat: "c1", sent: [] });
  open();
  fireEvent.click(screen.getByRole("button", { name: "Attach a note" }));
  fireEvent.click(await screen.findByRole("button", { name: /velha/ }));
  expect(screen.getByLabelText("velha.md")).toBeChecked();
  fireEvent.change(screen.getByRole("textbox", { name: /Write your question/ }), { target: { value: "compare" } });
  fireEvent.click(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(ipc.aiChatStart).toHaveBeenCalled());
  expect(vi.mocked(ipc.aiChatStart).mock.calls[0][0].notes).toEqual(["notas/ideia.md", "arquivo/velha.md"]);
});

it("does not offer a note of the server as the current one, and says why", () => {
  useUi.setState({ mainView: "remote" });
  open();
  expect(screen.getByText("A note on the server cannot be sent yet.")).toBeInTheDocument();
  expect(screen.queryByLabelText(/This note/)).toBeNull();
});

it("lets the user choose the provider when there are several", () => {
  useAi.setState({ overview: { ...on, providers: [provider("p1", "Claude"), provider("p2", "Ollama")] } });
  open();
  fireEvent.change(screen.getByLabelText("Provider"), { target: { value: "p2" } });
  expect(useAiChat.getState().provider).toBe("p2");
});

// ---- the cards of what the assistant did --------------------------------------

const withCards = (edits: EditCard[]) =>
  useAiChat.setState({
    turns: [
      { id: 1, role: "user", content: "reescreve", state: "done" },
      { id: 2, role: "assistant", content: "Feito.", state: "done", edits },
    ],
  });

it("shows what was edited, by name, with an Undo that takes it back while the editor still can", () => {
  const undo = vi.fn(() => true);
  registerEditorBridge({ noteId: "n1", apply: vi.fn(), undo } as never);
  withCards([{ id: 1, kind: "edit", path: "notas/ideia.md", state: "applied", undo: { noteId: "n1", token: 4 } }]);
  open();
  expect(screen.getByRole("group", { name: "Edited ideia.md" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(undo).toHaveBeenCalledWith(4);
  expect(screen.getByRole("group", { name: "Undid the change to ideia.md" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
  registerEditorBridge(null);
});

it("says so, and points at Ctrl+Z, when the card can no longer undo", () => {
  registerEditorBridge({ noteId: "n9", apply: vi.fn(), undo: vi.fn(() => true) } as never);
  withCards([{ id: 1, kind: "edit", path: "a.md", state: "applied", undo: { noteId: "n1", token: 4 } }]);
  open();
  fireEvent.click(screen.getByRole("button", { name: "Undo" }));
  expect(screen.getByText(/Use Ctrl\+Z in the note/)).toBeInTheDocument();
  registerEditorBridge(null);
});

it("a change that was not made says which note and why, with no Undo", () => {
  withCards([
    { id: 1, kind: "edit", path: "secret.md", state: "not_applied", why: "not_shared" },
    { id: 2, kind: "create", path: "x.md", state: "not_applied", why: "failed", detail: "already_exists" },
  ]);
  open();
  expect(screen.getByRole("group", { name: "Did not change secret.md" })).toBeInTheDocument();
  expect(screen.getByText(/was not shared with the assistant/)).toBeInTheDocument();
  expect(screen.getByText(/It failed\. already_exists/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
});

// A `Record` over the union: a reason added in code fails to compile until it is
// listed here, and then fails below until it has words in both languages.
const reasons: Record<NotApplied, true> = {
  no_selection: true,
  selection_changed: true,
  not_shared: true,
  read_only: true,
  busy: true,
  interrupted: true,
  open_failed: true,
  failed: true,
  unknown_tool: true,
  bad_arguments: true,
  too_large: true,
  too_many: true,
};

it("every reason a change may not be made has its words in both languages", () => {
  for (const reason of Object.keys(reasons)) {
    expect(en, reason).toHaveProperty([`ai.edit.why.${reason}`]);
    expect(ptBR, reason).toHaveProperty([`ai.edit.why.${reason}`]);
  }
});
