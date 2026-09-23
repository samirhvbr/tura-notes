// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Preview } from "./Preview";
import * as ipc from "../ipc";
import { useEditor } from "../stores/editor";
import { useUi } from "../stores/ui";

vi.mock("../ipc", async original => ({
  ...await original<typeof import("../ipc")>(),
  markdownRender: vi.fn(),
  markdownRemoteImagesSet: vi.fn(async () => {}),
}));

const rev = { hash: "b3:abc", size: 3, mtime_ns: "1" } as ipc.BaseRev;
const url = "https://example.invalid/t.png";
const rendered = (blocked: string[], shown: string[]) =>
  ({ html: "<p>x</p>", outline: [], blocked_remote: blocked, shown_remote: shown }) as ipc.Rendered;

beforeEach(() => {
  vi.useFakeTimers();
  useUi.setState({ view: "preview" });
  useEditor.setState({ doc: { noteId: "note", path: "n.md", text: `![t](${url})`, baseRev: rev, readOnly: null, bufferVersion: 0, savedVersion: 0, status: "saved", externalRev: 0, conflict: null, draft: null, lastError: null } });
});
afterEach(() => {
  cleanup(); vi.useRealTimers(); vi.clearAllMocks();
  useEditor.setState({ doc: null });
});

async function mount() {
  render(<Preview />);
  await act(async () => { await vi.advanceTimersByTimeAsync(300); });
}

it("allowing remote images touches only that switch, and the banner then offers to block them", async () => {
  vi.mocked(ipc.markdownRender)
    .mockResolvedValueOnce(rendered([url], []))
    .mockResolvedValue(rendered([], [url]));
  await mount();

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Allow remote images in this workspace" })); });
  expect(ipc.markdownRemoteImagesSet).toHaveBeenCalledWith(true);
  expect(screen.queryByRole("button", { name: "Allow remote images in this workspace" })).toBeNull();
  expect(screen.getByText(/1 remote image\(s\) loaded/)).toBeTruthy();

  vi.mocked(ipc.markdownRender).mockResolvedValue(rendered([url], []));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Block remote images in this workspace" })); });
  expect(ipc.markdownRemoteImagesSet).toHaveBeenLastCalledWith(false);
  expect(screen.getByRole("button", { name: "Allow remote images in this workspace" })).toBeTruthy();
  expect(screen.queryByText(/remote image\(s\) loaded/)).toBeNull();
});

it("says nothing about remote images when the note has none", async () => {
  vi.mocked(ipc.markdownRender).mockResolvedValue(rendered([], []));
  await mount();
  expect(screen.queryByRole("button")).toBeNull();
});
