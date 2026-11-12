// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Tree } from "./Tree";
import * as ipc from "../ipc";
import { useWorkspace } from "../stores/workspace";
import { useEditor } from "../stores/editor";
import { useTabs } from "../stores/tabs";
import { useSync } from "../stores/sync";
import { askText } from "../app/dialog";
import { reviewedMove } from "../app/ReferenceReview";

vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  noteCreate: vi.fn(async (dir: string, name: string) => ({
    path: dir ? `${dir}/${name}.md` : `${name}.md`, name: `${name}.md`,
    kind: "File", size: 0, is_note: true,
  })),
  dirCreate: vi.fn(async () => ({})),
  noteOpen: vi.fn(),
  noteReload: vi.fn(),
  reconcileAll: vi.fn(),
}));
vi.mock("../app/dialog", () => ({ askText: vi.fn(), askConfirm: vi.fn() }));
vi.mock("../app/ReferenceReview", () => ({ reviewedMove: vi.fn() }));

const folder = { path: "BLUE3", name: "BLUE3", kind: "Dir", size: null, is_note: false } as const;
const note = { path: "ShvIA.md", name: "ShvIA.md", kind: "File", size: 4, is_note: true } as const;
const original = useWorkspace.getState();

beforeEach(() => {
  useTabs.getState().reset();
  useEditor.setState({ doc: null });
  useWorkspace.setState({
    listings: { "": [folder, note] as never },
    expanded: new Set<string>(),
    refresh: vi.fn(async () => {}),
    fail: vi.fn(),
    note: vi.fn(),
  } as never);
});
afterEach(() => {
  cleanup();
  useTabs.getState().reset();
  useEditor.setState({ doc: null });
  useWorkspace.setState(original);
  vi.clearAllMocks();
});

function show() { render(<Tree />); }

/** Open the row's own menu: the `⋮` button beside it, one per entry. */
function openMenu(index: number) {
  fireEvent.click(screen.getAllByRole("button", { name: /right-click for rename/ })[index]);
}

const path = (value: string) => value as ipc.RelPath;
function opened(name: string, id: string, content = id): ipc.OpenedNote {
  return {
    path: path(name), note_id: id as ipc.NoteId, text: content, read_only: null,
    base_rev: { size: 0, mtime_ns: "0", hash: "" },
    draft: null, profile: { bom: false, eol: "Lf", encoding: "Utf8", final_newline: false },
  };
}

it("reopens the renamed inactive tab even when the old path has been reused", async () => {
  const original = opened(note.path, "original");
  const other = opened("other.md", "other");
  const renamed = { ...original, path: path("renamed.md") };
  const notes = new Map([[original.path, original], [other.path, other]]);
  vi.mocked(ipc.noteOpen).mockImplementation(async (path) => notes.get(path)!);
  vi.mocked(ipc.noteReload).mockResolvedValue(other);
  vi.mocked(askText).mockResolvedValue("renamed.md");
  vi.mocked(reviewedMove).mockImplementation(async () => {
    notes.set(renamed.path, renamed);
    notes.set(original.path, opened(note.path, "replacement"));
    return { path: renamed.path, updated: [], failed: [], backup: "" };
  });
  await useTabs.getState().openPath(original.path);
  useTabs.getState().noteCursor(original.note_id, 5, 2, 10);
  await useTabs.getState().openPath(other.path);
  show();
  openMenu(1);
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename…" }));
  await waitFor(() => expect(ipc.noteReload).toHaveBeenCalledWith(other.note_id));

  await useTabs.getState().activate(original.note_id);

  expect(useEditor.getState().doc).toMatchObject({ noteId: original.note_id, path: renamed.path });
  expect(useTabs.getState().tabs[0]).toMatchObject({ path: renamed.path, line: 5, col: 2, scrollTop: 10 });
});

it("updates every descendant tab when the tree moves a directory", async () => {
  const first = opened("BLUE3/one.md", "one");
  const second = opened("BLUE3/sub/two.md", "two");
  const sibling = opened("BLUE30/three.md", "three");
  vi.mocked(ipc.noteOpen).mockResolvedValueOnce(first).mockResolvedValueOnce(second).mockResolvedValueOnce(sibling);
  vi.mocked(ipc.noteReload).mockResolvedValue(sibling);
  vi.mocked(askText).mockResolvedValue("archive");
  vi.mocked(reviewedMove).mockResolvedValue({ path: path("archive/BLUE3"), updated: [], failed: [], backup: "" });
  for (const note of [first, second, sibling]) await useTabs.getState().openPath(note.path);
  show();
  openMenu(0);
  fireEvent.click(screen.getByRole("menuitem", { name: "Move to…" }));
  await waitFor(() => expect(ipc.noteReload).toHaveBeenCalledWith(sibling.note_id));

  expect(useTabs.getState().tabs.map((tab) => tab.path)).toEqual([
    "archive/BLUE3/one.md", "archive/BLUE3/sub/two.md", "BLUE30/three.md",
  ]);
});

it("updates a background tab when reconciliation reports a move", async () => {
  const original = opened(note.path, "original");
  const other = opened("other.md", "other");
  const to = path("renamed.md");
  vi.mocked(ipc.noteOpen).mockResolvedValueOnce(original).mockResolvedValueOnce(other);
  await useTabs.getState().openPath(original.path);
  await useTabs.getState().openPath(other.path);
  vi.mocked(ipc.reconcileAll).mockResolvedValue({
    events: [{ event: "note_moved", note_id: original.note_id, from: original.path, to }],
    queued: 0,
  });

  await useSync.getState().scan();

  expect(useTabs.getState().tabs[0]).toMatchObject({ noteId: original.note_id, path: to });
  expect(useEditor.getState().doc?.noteId).toBe(other.note_id);
});

it("offers to create inside the folder, and creates there", async () => {
  // The toolbar's two buttons pass the workspace root and nothing else did:
  // `create_note` has taken a directory since 0.1a, so a folder in the tree was
  // something you could expand and could not put anything into.
  vi.mocked(askText).mockResolvedValue("ata");
  show();
  openMenu(0);
  const create = screen.getByRole("menuitem", { name: "New note in BLUE3" });
  fireEvent.click(create);
  await waitFor(() => expect(ipc.noteCreate).toHaveBeenCalledWith("BLUE3", "ata"));
});

it("does not offer to create inside a note", async () => {
  show();
  openMenu(1);
  expect(screen.queryByRole("menuitem", { name: /New note in/ })).toBeNull();
  expect(screen.getByRole("menuitem", { name: "Rename…" })).toBeInTheDocument();
});

it("draws a folder as a folder and a note as a file", () => {
  // It was `▸` against `•` — two characters a few pixels apart, which asks the
  // reader to learn a legend before they can tell one from the other.
  show();
  // `.row`, not a role query: the `⋮` button carries the entry path in its
  // own label, so a name match returns four buttons and every other one has
  // no glyph at all.
  const rows = document.querySelectorAll(".row");
  const icon = (row: Element) => row.querySelector(".glyph svg")?.getAttribute("class") ?? "";
  expect(icon(rows[0])).toMatch(/folder/i);
  expect(icon(rows[1])).toMatch(/file/i);
  expect(icon(rows[0])).not.toEqual(icon(rows[1]));
});

it("a folder announces that it opens, and a file leaves the column empty", () => {
  // The collapsed folder's only signal used to be the folder icon, and the
  // open/closed state was carried by that icon swapping — which you can only
  // read *after* clicking. The chevron says it before.
  show();
  const rows = document.querySelectorAll(".row");
  const twist = (row: Element) => row.querySelector(".twist svg")?.getAttribute("class") ?? "";
  expect(twist(rows[0])).toMatch(/chevron-right/i);
  expect(twist(rows[1])).toBe("");
  // The empty box is still there, so the two names start in one column.
  expect(rows[1].querySelector(".twist")).toBeInTheDocument();
});

it("carries its depth, which is what draws the indent guides", () => {
  // Reported from use: a note inside a folder read as a third sibling of the
  // folder, because 14px of indent is the whole of what said "inside".
  useWorkspace.setState({
    listings: { "": [folder] as never, BLUE3: [{ ...note, path: "BLUE3/ShvIA.md" }] as never },
    expanded: new Set<string>(["BLUE3"]),
  } as never);
  show();
  // A static NodeList, so there is nothing to wait for: the second row exists
  // or the child was never rendered, and both are answers.
  const wraps = document.querySelectorAll<HTMLElement>(".row-wrap");
  expect(wraps).toHaveLength(2);
  expect(wraps[0].style.getPropertyValue("--depth")).toBe("0");
  expect(wraps[1].style.getPropertyValue("--depth")).toBe("1");
});

it("opens the folders on the way to a note, so the tree can show it", async () => {
  // The session restores the editor and the tab strip. Without this the sidebar
  // came back with every folder shut, and a note inside one was the only thing
  // on screen with no visible home — reported as opening "sem foco no arquivo".
  const inside = { path: "BLUE3/FINANCEIRO-V1.md", name: "FINANCEIRO-V1.md", kind: "File", size: 9, is_note: true } as const;
  const listed: Record<string, unknown> = { "": [folder], BLUE3: [inside] };
  useWorkspace.setState({
    listings: { "": [folder] } as never,
    expanded: new Set<string>(),
    list: async (dir: string) => {
      useWorkspace.setState(s => ({ listings: { ...s.listings, [dir]: listed[dir] } } as never));
    },
  } as never);
  await useWorkspace.getState().reveal("BLUE3/FINANCEIRO-V1.md" as never);
  expect([...useWorkspace.getState().expanded]).toEqual(["BLUE3"]);
  show();
  expect(screen.getByText("FINANCEIRO-V1.md")).toBeInTheDocument();
});

it("stops at a folder that is no longer there instead of guessing", async () => {
  useWorkspace.setState({
    listings: {} as never,
    expanded: new Set<string>(),
    list: async () => {},     // the folder is gone; nothing gets listed
  } as never);
  await useWorkspace.getState().reveal("GONE/note.md" as never);
  expect([...useWorkspace.getState().expanded]).toEqual([]);
});
