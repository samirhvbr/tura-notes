// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useRemoteListSync, useRemoteSync, LIST_MS } from "./useRemoteSync";
import { SYNC_MS, useRemoteDoc } from "../stores/remoteDoc";
import { useRemote } from "../stores/remote";

function Probe({ on }: { on: boolean }) {
  useRemoteSync(on);
  return null;
}
function ListProbe({ on }: { on: boolean }) {
  useRemoteListSync(on);
  return null;
}

const visibility = (state: "visible" | "hidden") =>
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });

let sync: ReturnType<typeof vi.fn>;
let refresh: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.useFakeTimers();
  visibility("visible");
  sync = vi.fn(async () => {});
  refresh = vi.fn(async () => {});
  useRemoteDoc.setState({ sync } as never);
  useRemote.setState({ refresh } as never);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  visibility("visible");
});

it("reads the note at once, then every ten seconds while it is on screen", async () => {
  render(<Probe on />);
  await vi.advanceTimersByTimeAsync(0);
  expect(sync).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(SYNC_MS);
  expect(sync).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(SYNC_MS * 3);
  expect(sync).toHaveBeenCalledTimes(5);
});

it("ten seconds is the figure that was asked for", () => {
  expect(SYNC_MS).toBe(10_000);
});

it("asks nothing while the window cannot be seen, and once when it can again", async () => {
  visibility("hidden");
  render(<Probe on />);
  await vi.advanceTimersByTimeAsync(SYNC_MS * 3);
  expect(sync).not.toHaveBeenCalled();
  visibility("visible");
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.advanceTimersByTimeAsync(0);
  expect(sync).toHaveBeenCalledTimes(1);
});

it("a window that is visible but not focused keeps reading: it is the one being watched", async () => {
  vi.spyOn(document, "hasFocus").mockReturnValue(false);
  render(<Probe on />);
  await vi.advanceTimersByTimeAsync(SYNC_MS);
  expect(sync).toHaveBeenCalledTimes(2);
});

it("stops when the note leaves the screen", async () => {
  const { rerender, unmount } = render(<Probe on />);
  await vi.advanceTimersByTimeAsync(0);
  rerender(<Probe on={false} />);
  await vi.advanceTimersByTimeAsync(SYNC_MS * 5);
  expect(sync).toHaveBeenCalledTimes(1);
  unmount();
});

it("never starts a second read before the first has come back", async () => {
  let release!: () => void;
  sync.mockReturnValue(new Promise<void>((r) => (release = r)));
  render(<Probe on />);
  await vi.advanceTimersByTimeAsync(SYNC_MS * 4);
  expect(sync).toHaveBeenCalledTimes(1);
  release();
});

it("the tree is read again once a minute while it is on screen, and not when hidden", async () => {
  render(<ListProbe on />);
  await vi.advanceTimersByTimeAsync(LIST_MS);
  expect(refresh).toHaveBeenCalledTimes(1);
  visibility("hidden");
  await vi.advanceTimersByTimeAsync(LIST_MS * 2);
  expect(refresh).toHaveBeenCalledTimes(1);
});
