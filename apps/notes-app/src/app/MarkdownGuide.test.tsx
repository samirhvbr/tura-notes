// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { listen } from "@tauri-apps/api/event";
import { MarkdownGuideDialog, matches, sections, useMarkdownGuideMenu } from "./MarkdownGuide";
import * as ipc from "../ipc";
import { setLocale } from "../i18n";

vi.mock("../ipc", async (original) => ({ ...(await original<typeof import("../ipc")>()), markdownGuide: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn(async () => () => {}) }));

// What the Rust side returns, in the shapes it really returns them (the HTML is
// the renderer's own output, copied from `crates/notes-markdown`'s guide).
const entry = (group: string, id: string, source: string, html: string): ipc.GuideEntry => ({ id, group, source, html });
const GUIDE: ipc.GuideEntry[] = [
  entry("headings", "headings", "# Heading 1\n## Heading 2", '<h1 id="heading-1">Heading 1</h1>\n<h2 id="heading-2">Heading 2</h2>\n'),
  entry("text", "bold", "**bold text**", "<p><strong>bold text</strong></p>\n"),
  entry("links", "link", "[Tura Notes](https://example.com)", '<p><a href="https://example.com" target="_blank" rel="noopener noreferrer">Tura Notes</a></p>\n'),
  entry("links", "image", "![A cat](images/cat.png)", ""),
  entry("blocks", "table", "| Item | Qty |\n| :--- | ---: |\n| Tea | 2 |", '<table><thead><tr><th style="text-align: left">Item</th><th style="text-align: right">Qty</th></tr></thead></table>'),
];

beforeEach(() => {
  setLocale("en");
  vi.mocked(ipc.markdownGuide).mockResolvedValue(GUIDE);
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const open = async (onClose = () => {}) => {
  render(<MarkdownGuideDialog onClose={onClose} />);
  await screen.findByText("Bold");
};

it("shows each construct with what to type and what the preview draws, in sections, in order", async () => {
  await open();
  const sectionTitles = screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
  expect(sectionTitles).toEqual(["Headings", "Text", "Links and pictures", "Blocks"]);
  const bold = screen.getByRole("article", { name: "Bold" });
  // The syntax is shown exactly as typed...
  expect(within(bold).getByText("**bold text**")).toBeInTheDocument();
  // ...and the picture is the renderer's HTML, drawn: a real <strong>, not the text of a tag.
  expect(bold.querySelector(".guide-result strong")?.textContent).toBe("bold text");
  const headings = screen.getByRole("article", { name: "Headings" });
  expect(headings.querySelector(".guide-result h1")?.textContent).toBe("Heading 1");
  expect(headings.querySelector(".guide-result h2")?.textContent).toBe("Heading 2");
  expect(screen.getByRole("article", { name: "Table" }).querySelector(".guide-result th")).not.toBeNull();
});

it("says what happens instead of drawing nothing, for a construct with no picture of its own", async () => {
  await open();
  const image = screen.getByRole("article", { name: "Picture" });
  expect(within(image).getByText("![A cat](images/cat.png)")).toBeInTheDocument();
  expect(image.querySelector(".guide-result")).toBeNull();
  expect(within(image).getByText(/Nothing is drawn for this one/)).toBeInTheDocument();
});

it("a link inside an example never navigates", async () => {
  await open();
  const link = screen.getByRole("article", { name: "Link" }).querySelector(".guide-result a")!;
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  act(() => {
    link.dispatchEvent(click);
  });
  expect(click.defaultPrevented).toBe(true);
});

it("copies exactly what is to be typed, and says so", async () => {
  const writeText = vi.fn(async (_text: string) => {});
  Object.assign(navigator, { clipboard: { writeText } });
  await open();
  const table = screen.getByRole("article", { name: "Table" });
  fireEvent.click(within(table).getByRole("button", { name: "Copy" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledWith("| Item | Qty |\n| :--- | ---: |\n| Tea | 2 |"));
  expect(await within(table).findByRole("button", { name: "Copied" })).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("Copied");
});

it("the search narrows the entries and hides a section it emptied", async () => {
  await open();
  fireEvent.change(screen.getByLabelText("Find a mark"), { target: { value: "table" } });
  expect(screen.getAllByRole("article")).toHaveLength(1);
  expect(screen.getByRole("article", { name: "Table" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Blocks"]);
  // The syntax is searchable too: a person may know the mark and not its name.
  fireEvent.change(screen.getByLabelText("Find a mark"), { target: { value: "~" } });
  expect(screen.queryAllByRole("article")).toHaveLength(0);
  fireEvent.change(screen.getByLabelText("Find a mark"), { target: { value: "**" } });
  expect(screen.getByRole("article", { name: "Bold" })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText("Find a mark"), { target: { value: "zzz" } });
  expect(screen.getByText("Nothing matches “zzz”.")).toBeInTheDocument();
});

it("the search ignores accents and capitals, in the language the person reads", () => {
  setLocale("pt-BR");
  const headings = GUIDE[0]!;
  expect(matches(headings, "titulos")).toBe(true); // "Títulos"
  expect(matches(headings, "TÍTULOS")).toBe(true);
  expect(matches(headings, "tabela")).toBe(false);
  expect(matches(GUIDE[4]!, "TABELA")).toBe(true);
  expect(sections(GUIDE, "").map(([g]) => g)).toEqual(["headings", "text", "links", "blocks"]);
  expect(sections(GUIDE, "negrito").map(([g, l]) => [g, l.map((e) => e.id)])).toEqual([["text", ["bold"]]]);
});

it("closes on Escape, on the button and on a click outside, and not on a click inside", async () => {
  const onClose = vi.fn();
  await open(onClose);
  fireEvent.mouseDown(screen.getByRole("dialog"));
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(onClose).toHaveBeenCalledTimes(2);
  fireEvent.mouseDown(screen.getByRole("dialog").parentElement!);
  expect(onClose).toHaveBeenCalledTimes(3);
});

it("says it could not load, instead of an empty dialog", async () => {
  vi.mocked(ipc.markdownGuide).mockRejectedValue(new Error("no bus"));
  render(<MarkdownGuideDialog onClose={() => {}} />);
  expect(await screen.findByRole("alert")).toHaveTextContent("The guide could not be loaded.");
});

it("opens on the native menu item and stops listening when it goes away", async () => {
  let fire: () => void = () => {};
  const off = vi.fn();
  vi.mocked(listen).mockImplementation((async (_event: string, handler: () => void) => {
    fire = handler;
    return off;
  }) as never);
  const open = vi.fn();
  const { unmount } = render(<Probe open={open} />);
  await waitFor(() => expect(listen).toHaveBeenCalledWith("menu://markdown-guide", expect.any(Function)));
  fire();
  expect(open).toHaveBeenCalledWith(true);
  unmount();
  await waitFor(() => expect(off).toHaveBeenCalledOnce());
});

it("a missing Tauri bus is the catch, not an error", async () => {
  vi.mocked(listen).mockRejectedValue(new Error("no bus"));
  render(<Probe open={() => {}} />);
  await waitFor(() => expect(listen).toHaveBeenCalled());
});

function Probe({ open }: { open: (v: boolean) => void }) {
  useMarkdownGuideMenu(open);
  return null;
}
