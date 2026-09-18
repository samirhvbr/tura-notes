// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import { IndexControls } from "./IndexControls";
import * as ipc from "../ipc";

vi.mock("../ipc", async original => ({
  ...(await original<typeof import("../ipc")>()),
  indexStart: vi.fn(), indexStatus: vi.fn(), indexCancel: vi.fn(),
}));

const status = (over: Partial<ipc.IndexStatus> = {}): ipc.IndexStatus => ({
  running: false, stale: false, cancelled: false,
  scanned: 4, indexed: 4, unchanged: 0, skipped: 0, error: null, ...over,
});

beforeEach(() => { vi.useFakeTimers(); vi.clearAllMocks(); });
afterEach(() => { cleanup(); vi.useRealTimers(); });

/** Let the mocked promises settle and the component re-render. */
async function settle(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}

it("says nothing about a run that is over before anyone could read it", async () => {
  // Saving a note makes the index stale and a run starts within half a second.
  // On four notes it is over in milliseconds — and it still swapped this line's
  // text and turned "Rebuild index" into "Cancel", moving the button at the
  // bottom of the sidebar. Every save.
  vi.mocked(ipc.indexStart).mockResolvedValue(status());
  vi.mocked(ipc.indexStatus)
    .mockResolvedValueOnce(status({ running: true, scanned: 1 }))
    .mockResolvedValue(status());
  render(<IndexControls workspace="w" />);
  await settle();
  const before = screen.getByText(/Index checked/).textContent;

  // The poll at 500ms brings `running: true`. The assertion has to happen
  // *here* — between that reading and the threshold — because this is the only
  // window in which the old behaviour was visible. Asserting after everything
  // settles passes either way, which is what the first version of this test
  // did and why it was worth nothing.
  await settle(510);
  expect(screen.queryByText(/Indexing:/)).toBeNull();
  expect(screen.queryByRole("button", { name: /cancel/i })).toBeNull();
  expect(screen.getByText(/Index checked/).textContent).toBe(before);

  // And the run is over by the next poll, so it is never announced at all.
  await settle(1000);
  expect(screen.queryByText(/Indexing:/)).toBeNull();
  expect(screen.getByRole("button", { name: "Rebuild index" })).toBeInTheDocument();
});

it("still reports a rebuild that actually takes time", async () => {
  // The delay is on announcing a state, not on doing the work: a run that keeps
  // running has to say so, or the panel is lying in the other direction.
  vi.mocked(ipc.indexStart).mockResolvedValue(status({ running: true, scanned: 0 }));
  vi.mocked(ipc.indexStatus).mockResolvedValue(status({ running: true, scanned: 120 }));
  render(<IndexControls workspace="w" />);
  await settle();            // the first reading lands, already running
  expect(screen.queryByText(/Indexing:/)).toBeNull();   // and is not announced yet
  await settle(600);         // past the threshold, with the run still going
  expect(screen.getByText("Indexing: 120 notes")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
});

it("reserves the height the status line can take, so the button cannot move", async () => {
  // The sentences wrap at different line counts in a column this narrow, and
  // the button sits directly underneath.
  vi.mocked(ipc.indexStart).mockResolvedValue(status());
  vi.mocked(ipc.indexStatus).mockResolvedValue(status());
  render(<IndexControls workspace="w" />);
  await settle();
  expect(screen.getByText(/Index checked/)).toHaveClass("index-status");
});
