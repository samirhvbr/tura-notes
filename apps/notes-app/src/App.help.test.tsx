// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";

// The one door every command goes through, and the one event bus. Everything
// between them is the real application.
const handlers = new Map<string, () => void>();
const env = { version: "1.11.22", copyright: "", os: "macos", arch: "aarch64", tauriVersion: "2.12.3", session: "x", dataDir: "/data" };
const answers: Record<string, unknown> = { env_report: env, workspace_recent: [] };
vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(async (command: string) => answers[command] ?? null) }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(async (name: string, cb: () => void) => {
    handlers.set(name, cb);
    return () => handlers.delete(name);
  }),
}));

const { default: App } = await import("./App");

beforeEach(() => handlers.clear());
afterEach(() => cleanup());

it("shows the welcome screen when no workspace is open", async () => {
  render(<App />);
  expect(await screen.findByRole("button", { name: /open a folder|create/i })).toBeInTheDocument();
});

it("Help ▸ About opens from the welcome screen too, and not later when a folder opens", async () => {
  render(<App />);
  await waitFor(() => expect(handlers.has("menu://about")).toBe(true));
  act(() => handlers.get("menu://about")!());
  expect(await screen.findByRole("dialog", { name: /About/ })).toBeInTheDocument();
});
