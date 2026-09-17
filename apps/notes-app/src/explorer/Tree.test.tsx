// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Tree } from "./Tree";
import * as ipc from "../ipc";
import { useWorkspace } from "../stores/workspace";
import { askText } from "../app/dialog";

vi.mock("../ipc", async (original) => ({
  ...(await original<typeof import("../ipc")>()),
  noteCreate: vi.fn(async (dir: string, name: string) => ({
    path: dir ? `${dir}/${name}.md` : `${name}.md`, name: `${name}.md`,
    kind: "File", size: 0, is_note: true,
  })),
  dirCreate: vi.fn(async () => ({})),
}));
vi.mock("../app/dialog", () => ({ askText: vi.fn(), askConfirm: vi.fn() }));

const folder = { path: "BLUE3", name: "BLUE3", kind: "Dir", size: null, is_note: false } as const;
const note = { path: "ShvIA.md", name: "ShvIA.md", kind: "File", size: 4, is_note: true } as const;
const original = useWorkspace.getState();

beforeEach(() => {
  useWorkspace.setState({
    listings: { "": [folder, note] as never },
    expanded: new Set<string>(),
    refresh: vi.fn(async () => {}),
    fail: vi.fn(),
    note: vi.fn(),
  } as never);
});
afterEach(() => { cleanup(); useWorkspace.setState(original); vi.clearAllMocks(); });

function show() { render(<Tree />); }

/** Open the row's own menu: the `⋮` button beside it, one per entry. */
function openMenu(index: number) {
  fireEvent.click(screen.getAllByRole("button", { name: /right-click for rename/ })[index]);
}

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
