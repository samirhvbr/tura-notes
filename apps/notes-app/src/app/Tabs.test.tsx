// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { Tabs } from "./Tabs";
import { useTabs } from "../stores/tabs";
import { useEditor } from "../stores/editor";
import { useRemoteDoc } from "../stores/remoteDoc";
import { useUi } from "../stores/ui";
import { useWorkspace } from "../stores/workspace";

const activate = vi.fn(async (id: string) => { useTabs.setState({ activeId: id as never }); });
const close = vi.fn(async () => {});
beforeEach(() => {
  useEditor.setState({ doc: null });
  useTabs.setState({
    tabs: ["a", "b", "c"].map((n) => ({ noteId: n, path: `${n}.md` })) as never,
    activeId: "b" as never,
    activate: activate as never,
    close: close as never,
  });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); });

// R6-40: the role the bar announces, and the behaviour behind it.
it("owns its tabs, with one stop in the Tab order", () => {
  render(<Tabs onNew={() => {}} />);
  const tabs = screen.getAllByRole("tab");
  expect(tabs).toHaveLength(3);
  expect(tabs.every((tab) => tab.closest("[role=tablist]"))).toBe(true);
  expect(tabs.map((tab) => tab.tabIndex)).toEqual([-1, 0, -1]);
  expect(tabs.every((tab) => tab.getAttribute("aria-controls") === "note-panel")).toBe(true);
  expect(screen.getAllByRole("button", { name: /close/i }).every((b) => b.tabIndex === -1)).toBe(true);
  expect(screen.getByRole("tablist").querySelector("[aria-label='New note']")).toBeNull();
});

it("arrows, Home and End open the tab they land on; Delete closes the focused one", async () => {
  render(<Tabs onNew={() => {}} />);
  const [a, b, c] = screen.getAllByRole("tab");
  b.focus();
  await act(async () => { fireEvent.keyDown(b, { key: "ArrowRight" }); });
  expect(activate).toHaveBeenLastCalledWith("c");
  expect(document.activeElement).toBe(c);
  await act(async () => { fireEvent.keyDown(c, { key: "ArrowRight" }); });
  expect(activate).toHaveBeenLastCalledWith("a");
  await act(async () => { fireEvent.keyDown(a, { key: "End" }); });
  expect(activate).toHaveBeenLastCalledWith("c");
  await act(async () => { fireEvent.keyDown(c, { key: "Home" }); });
  expect(activate).toHaveBeenLastCalledWith("a");
  await act(async () => { fireEvent.keyDown(a, { key: "Delete" }); });
  expect(close).toHaveBeenCalledWith("a");
});

it("clicking a remote tab the app refuses to leave for says why, instead of nothing", async () => {
  // The refusal is deliberate: a note whose text the server did not take stays
  // open, because it is the only copy. The click used to end in
  // `.catch(() => {})`, so the owner pressed a tab and nothing at all happened,
  // with no way to tell a refusal from a broken button.
  const refusal = { code: "unsupported", cap: "remote note has unsent changes" };
  const before = useRemoteDoc.getState();
  useWorkspace.setState({ error: null });
  useUi.setState({ mainView: "remote" });
  useRemoteDoc.setState({
    tabs: ["r1.md", "r2.md"],
    doc: { path: "r1.md", text: "x", etag: '"e"', base: "x", readOnly: null, bufferVersion: 1, savedVersion: 0,
           status: "error", externalRev: 0, conflict: null, lastError: null, synced: null } as never,
    open: vi.fn(async () => { throw refusal; }) as never,
  });
  try {
    render(<Tabs onNew={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByRole("tab", { name: /r2\.md/ })); });
    expect(useWorkspace.getState().error).toEqual(refusal);
  } finally {
    useRemoteDoc.setState(before, true);
    useUi.setState({ mainView: "local" });
    useWorkspace.setState({ error: null });
  }
});
