// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AiSettingsSection } from "./AiSettings";
import * as ipc from "../ipc";
import en from "../i18n/en.json";
import ptBR from "../i18n/pt-BR.json";

vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  aiOverview: vi.fn(),
  aiSetEnabled: vi.fn(),
  aiProviderSave: vi.fn(),
  aiProviderRemove: vi.fn(),
  aiSetDefault: vi.fn(),
  aiKeySet: vi.fn(),
  aiKeyClear: vi.fn(),
  aiTest: vi.fn(),
  aiShviaCatalog: vi.fn(),
}));

const SECRET = "sk-test-0123456789";

const off: ipc.AiOverview = { enabled: false, default_provider: null, keychain: "available", providers: [] };
const on: ipc.AiOverview = { ...off, enabled: true };
const ollama: ipc.AiProviderView = {
  id: "p1",
  kind: "openai_compatible",
  name: "Ollama",
  base_url: "http://localhost:11434/v1",
  model: "llama3.1",
  key_configured: false,
};
const withOllama: ipc.AiOverview = { ...on, default_provider: "p1", providers: [ollama] };

beforeEach(() => vi.mocked(ipc.aiOverview).mockResolvedValue(off));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

it("is off by default, says what turning it on means, and shows no provider controls", async () => {
  render(<AiSettingsSection />);
  const box = await screen.findByRole("checkbox", { name: "Turn on the AI assistant" });
  expect(box).not.toBeChecked();
  expect(screen.getByText(/leaves this computer for the provider you choose/)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Add a provider" })).toBeNull();
});

it("turning it on asks Rust to, and only then shows the providers", async () => {
  vi.mocked(ipc.aiSetEnabled).mockResolvedValue(on);
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("checkbox", { name: "Turn on the AI assistant" }));
  expect(await screen.findByRole("button", { name: "Add a provider" })).toBeInTheDocument();
  expect(ipc.aiSetEnabled).toHaveBeenCalledWith(true);
  expect(screen.getByText("No provider yet.")).toBeInTheDocument();
});

it("says so when the system has no keychain", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue({ ...on, keychain: "unavailable" });
  render(<AiSettingsSection />);
  expect(await screen.findByText(/has no keychain, so an API key cannot be stored/)).toBeInTheDocument();
});

it("adds a provider, then sends the key once and leaves it nowhere on the screen", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValueOnce(on).mockResolvedValue(withOllama);
  vi.mocked(ipc.aiProviderSave).mockResolvedValue(withOllama);
  vi.mocked(ipc.aiKeySet).mockResolvedValue({ ...withOllama, providers: [{ ...ollama, key_configured: true }] });
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Add a provider" }));

  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "openai_compatible" } });
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Ollama" } });
  fireEvent.change(screen.getByLabelText("Server address"), { target: { value: "http://localhost:11434/v1" } });
  fireEvent.change(screen.getByLabelText("Model"), { target: { value: "llama3.1" } });
  const key = screen.getByLabelText("API key") as HTMLInputElement;
  expect(key.type).toBe("password");
  expect(key.autocomplete).toBe("off");
  fireEvent.change(key, { target: { value: SECRET } });
  fireEvent.click(screen.getByRole("button", { name: "Save provider" }));

  await waitFor(() => expect(ipc.aiKeySet).toHaveBeenCalledWith("p1", SECRET));
  expect(ipc.aiProviderSave).toHaveBeenCalledWith({
    id: null,
    kind: "openai_compatible",
    name: "Ollama",
    base_url: "http://localhost:11434/v1",
    model: "llama3.1",
  });
  await screen.findByText(/key saved/);
  // The key was typed into a field that is gone, and it is in no text on the page.
  expect(document.body.textContent).not.toContain(SECRET);
  expect(document.body.innerHTML).not.toContain(SECRET);
});

it("shows a provider's key as saved or missing and never as a value", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue({ ...withOllama, providers: [{ ...ollama, key_configured: true }] });
  render(<AiSettingsSection />);
  expect(await screen.findByText(/Ollama · llama3.1 · key saved · default/)).toBeInTheDocument();
});

it("tests a provider and offers the models it listed", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue(withOllama);
  vi.mocked(ipc.aiTest).mockResolvedValue({ models: [{ id: "llama3.1", name: "llama3.1" }, { id: "mistral", name: "mistral" }] });
  const { container } = render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Test" }));
  expect(await screen.findByText("It works: 2 models available.")).toBeInTheDocument();
  expect(ipc.aiTest).toHaveBeenCalledWith("p1");
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  const options = [...container.querySelectorAll("#ai-models option")].map((o) => o.getAttribute("value"));
  expect(options).toEqual(["llama3.1", "mistral"]);
});

it("turns a refusal into a sentence and keeps the provider's own words only as detail", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue(on);
  vi.mocked(ipc.aiProviderSave).mockRejectedValue({
    code: "invalid_endpoint",
    detail: "plain http is only for this machine",
  });
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Add a provider" }));
  fireEvent.click(screen.getByRole("button", { name: "Save provider" }));
  expect(
    await screen.findByText("That server address is not allowed. plain http is only for this machine"),
  ).toBeInTheDocument();
});

it("asks before removing a provider, because its key goes with it", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue(withOllama);
  vi.mocked(ipc.aiProviderRemove).mockResolvedValue(on);
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Remove" }));
  expect(screen.getByText("Remove “Ollama” and its key?")).toBeInTheDocument();
  expect(ipc.aiProviderRemove).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Remove it" }));
  await waitFor(() => expect(ipc.aiProviderRemove).toHaveBeenCalledWith("p1"));
});

// A `Record` over the union, so a code added in Rust and regenerated here fails to
// compile until it is listed, and then fails below until it has words in both
// languages. `t()` returns the key for a missing entry, and the checker that
// guards the literal keys cannot see these, which are built from the code.
const codes: Record<ipc.AiErrorCode, true> = {
  disabled: true,
  keychain_unavailable: true,
  keychain_failed: true,
  unknown_provider: true,
  invalid_name: true,
  invalid_endpoint: true,
  invalid_model: true,
  invalid_key: true,
  no_key: true,
  too_many_providers: true,
  unauthorized: true,
  rate_limited: true,
  offline: true,
  protocol: true,
  provider: true,
  internal: true,
  invalid_request: true,
  no_provider: true,
  too_large: true,
  unreadable_note: true,
};
const states: Record<Exclude<ipc.AiKeychainState, "available">, true> = { unavailable: true, failed: true };
const kinds: Record<ipc.AiProviderKind, true> = { anthropic: true, openai_compatible: true, shvia: true };

it("every error code, keychain state and provider kind has its words in both languages", () => {
  const keys = [
    ...Object.keys(codes).map((c) => `ai.error.${c}`),
    ...Object.keys(states).map((s) => `ai.keychain.${s}`),
    ...Object.keys(kinds).flatMap((k) => [`ai.kind.${k}`, `ai.baseUrl.hint.${k}`]),
    ...Object.keys(en).filter((k) => k.startsWith("ai.shvia.")),
  ];
  for (const key of keys) {
    expect(en, key).toHaveProperty([key]);
    expect(ptBR, key).toHaveProperty([key]);
  }
});

const catalog: ipc.AiCatalog = {
  default_infra: "gpu1",
  infras: [
    {
      key: "gpu1",
      label: "GPU remota 1",
      driver: "ollama",
      online: true,
      models: [
        { name: "anna-blue3@gpu1", model: "anna-blue3", parameter_size: "7B" },
        { name: "zeta@gpu1", model: "zeta", parameter_size: null },
      ],
    },
    {
      key: "cold",
      label: "Fria",
      driver: null,
      online: false,
      models: [{ name: "slow@cold", model: "slow", parameter_size: null }],
    },
  ],
};
const shvia: ipc.AiProviderView = {
  id: "s1",
  kind: "shvia",
  name: "SHVIA",
  base_url: "https://ai.shvia.org",
  model: "",
  key_configured: true,
};
const withShvia: ipc.AiOverview = { ...on, default_provider: "s1", providers: [shvia] };

it("SHVIA: the address is filled in, the key is sent once, and the model waits for the list", async () => {
  // The first answer is the screen opening; the provider's new id is found in
  // the next one, which has it.
  vi.mocked(ipc.aiOverview).mockResolvedValueOnce(on).mockResolvedValue(withShvia);
  vi.mocked(ipc.aiProviderSave).mockResolvedValue(withShvia);
  vi.mocked(ipc.aiKeySet).mockResolvedValue(withShvia);
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Add a provider" }));
  fireEvent.change(screen.getByLabelText("Type"), { target: { value: "shvia" } });
  expect(screen.getByLabelText("Server address")).toHaveValue("https://ai.shvia.org");
  expect(screen.getByText(/Save the provider with its key first/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Load infrastructures and models" })).toBeDisabled();
  expect(screen.queryByLabelText("Infrastructure")).toBeNull();
  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "SHVIA" } });
  fireEvent.change(screen.getByLabelText("API key"), { target: { value: "shvia_usr_7_abc" } });
  fireEvent.click(screen.getByRole("button", { name: "Save provider" }));
  await waitFor(() => expect(ipc.aiKeySet).toHaveBeenCalledWith("s1", "shvia_usr_7_abc"));
  expect(ipc.aiProviderSave).toHaveBeenCalledWith(
    expect.objectContaining({ kind: "shvia", base_url: "https://ai.shvia.org", model: "" }),
  );
});

it("SHVIA: loading the list offers the infrastructures, then the models of the one chosen, and saves the name the gateway gave", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue(withShvia);
  vi.mocked(ipc.aiShviaCatalog).mockResolvedValue(catalog);
  vi.mocked(ipc.aiProviderSave).mockResolvedValue({
    ...withShvia,
    providers: [{ ...shvia, model: "anna-blue3@gpu1" }],
  });
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  expect(screen.getByText(/No model picked yet/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load infrastructures and models" }));
  expect(await screen.findByText("2 infrastructures and 3 models loaded.")).toBeInTheDocument();
  expect(ipc.aiShviaCatalog).toHaveBeenCalledWith("s1");
  const infra = screen.getByLabelText("Infrastructure") as HTMLSelectElement;
  expect(infra.value, "the gateway's own default first").toBe("gpu1");
  expect([...infra.options].map((o) => o.textContent)).toEqual(["GPU remota 1", "Fria (offline)"]);
  const model = screen.getByLabelText("Model") as HTMLSelectElement;
  expect([...model.options].map((o) => o.textContent)).toEqual([
    "Choose a model…",
    "anna-blue3 (7B)",
    "zeta",
  ]);
  fireEvent.change(model, { target: { value: "anna-blue3@gpu1" } });
  fireEvent.click(screen.getByRole("button", { name: "Save provider" }));
  await waitFor(() =>
    expect(ipc.aiProviderSave).toHaveBeenCalledWith(
      expect.objectContaining({ id: "s1", kind: "shvia", model: "anna-blue3@gpu1" }),
    ),
  );
});

it("SHVIA: changing the infrastructure drops the model, which belonged to the other one", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue({
    ...withShvia,
    providers: [{ ...shvia, model: "anna-blue3@gpu1" }],
  });
  vi.mocked(ipc.aiShviaCatalog).mockResolvedValue(catalog);
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  expect(screen.getByText("Saved model: anna-blue3@gpu1. Load the list to change it.")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Load infrastructures and models" }));
  const model = (await screen.findByLabelText("Model")) as HTMLSelectElement;
  expect(model.value, "it starts on the infrastructure the saved model is in").toBe("anna-blue3@gpu1");
  fireEvent.change(screen.getByLabelText("Infrastructure"), { target: { value: "cold" } });
  expect((screen.getByLabelText("Model") as HTMLSelectElement).value).toBe("");
  expect([...(screen.getByLabelText("Model") as HTMLSelectElement).options].map((o) => o.value)).toEqual([
    "",
    "slow@cold",
  ]);
});

it("SHVIA: a key the gateway refuses is said in words and no list is shown", async () => {
  vi.mocked(ipc.aiOverview).mockResolvedValue(withShvia);
  vi.mocked(ipc.aiShviaCatalog).mockRejectedValue({ code: "unauthorized" });
  render(<AiSettingsSection />);
  fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  fireEvent.click(screen.getByRole("button", { name: "Load infrastructures and models" }));
  expect(await screen.findByText(/did not accept|not accept/i)).toBeInTheDocument();
  expect(screen.queryByLabelText("Infrastructure")).toBeNull();
});
