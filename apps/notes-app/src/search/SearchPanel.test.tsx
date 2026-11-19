// @vitest-environment jsdom
import {cleanup,render,screen,waitFor} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {afterEach,expect,it,vi} from "vitest";
import {SearchPanel} from "./SearchPanel";
import * as ipc from "../ipc";
import { useTabs } from "../stores/tabs";
vi.mock("../ipc",async original=>({...await original<typeof import("../ipc")>(),searchStart:vi.fn(),searchCancel:vi.fn(async()=>{}),searchPoll:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it("cancels a search whose start arrives after the panel was closed",async()=>{
 let resolve!:(id:number)=>void;vi.mocked(ipc.searchStart).mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const user=userEvent.setup();const {unmount}=render(<SearchPanel onClose={()=>{}}/>);
 await user.type(screen.getByRole("textbox"),"query{Enter}");unmount();resolve(42);
 await waitFor(()=>expect(ipc.searchCancel).toHaveBeenCalledWith(42));expect(ipc.searchPoll).not.toHaveBeenCalled();
});
it("keeps words separate from literal and regex with no case-sensitive promise",async()=>{
 const user=userEvent.setup();render(<SearchPanel onClose={()=>{}}/>);
 await user.selectOptions(screen.getByRole("combobox"),"words");expect(screen.getByRole("checkbox")).toBeDisabled();
 await user.selectOptions(screen.getByRole("combobox"),"regex");expect(screen.getByRole("checkbox")).toBeEnabled();
});

it("shows an empty result only after its search finishes and keeps the submitted term", async () => {
  vi.mocked(ipc.searchStart).mockResolvedValue(4);
  vi.mocked(ipc.searchPoll).mockResolvedValue({
    id: 4, hits: [], files_scanned: 6, total_hits: 0,
    done: true, cancelled: false, truncated: false, partial: false,
  });
  const user = userEvent.setup();
  render(<SearchPanel onClose={() => {}} />);
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
  expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
  const input = screen.getByRole("textbox");
  await user.type(input, "deadline{Enter}");
  await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("No matches for “deadline”"));
  await user.clear(input);
  await user.type(input, "hearing");
  expect(screen.getByRole("status")).toHaveTextContent("deadline");
});

it("distinguishes a cancelled search from an empty search and cancels a late native start", async () => {
  let resolve!: (id: number) => void;
  vi.mocked(ipc.searchStart).mockImplementation(() => new Promise(r => { resolve = r; }));
  const user = userEvent.setup();
  render(<SearchPanel onClose={() => {}} />);
  await user.type(screen.getByRole("textbox"), "deadline{Enter}");
  expect(screen.getByRole("status")).toHaveTextContent("Searching");
  await user.click(screen.getByRole("button", { name: "Cancel" }));
  resolve(7);
  await waitFor(() => expect(ipc.searchCancel).toHaveBeenCalledWith(7));
  expect(screen.getByRole("status")).toHaveTextContent("Search stopped");
  expect(ipc.searchPoll).not.toHaveBeenCalled();
});

it("exposes invalid patterns as an alert without claiming an empty result", async () => {
  vi.mocked(ipc.searchStart).mockRejectedValue({ code: "invalid_path" });
  const user = userEvent.setup();
  render(<SearchPanel onClose={() => {}} />);
  await user.selectOptions(screen.getByRole("combobox"), "regex");
  await user.type(screen.getByRole("textbox"), "({Enter}");
  expect(await screen.findByRole("alert")).toHaveTextContent("regular expression");
  expect(screen.getByRole("status")).toBeEmptyDOMElement();
});

it("opens a keyboard-selected result using the full path and native cursor position", async () => {
  const path = "Cases/Appeal with several witnesses/Notes on the settlement hearing.md";
  const hit = { path, line: 17, col: 6, context: "Next hearing on Monday" };
  vi.mocked(ipc.searchStart).mockResolvedValue(3);
  vi.mocked(ipc.searchPoll).mockResolvedValue({
    id: 3, hits: [hit], files_scanned: 8, total_hits: 1,
    done: true, cancelled: false, truncated: false, partial: false,
  });
  const originalOpenAt = useTabs.getState().openAt;
  const openAt = vi.fn(async () => {});
  useTabs.setState({ openAt });
  try {
    const user = userEvent.setup();
    render(<SearchPanel onClose={() => {}} />);
    await user.type(screen.getByRole("textbox"), "hearing{Enter}");

    const result = await screen.findByRole("button", { name: /Notes on the settlement hearing/ });
    expect(result).toHaveTextContent("Line 17");
    expect(result).toHaveTextContent("Cases/Appeal with several witnesses");
    result.focus();
    await user.keyboard("{Enter}");

    expect(openAt).toHaveBeenCalledWith(path, 17, 6);
  } finally {
    useTabs.setState({ openAt: originalOpenAt });
  }
});
