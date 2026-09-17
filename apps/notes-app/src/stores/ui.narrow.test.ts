import { beforeEach, describe, expect, it, vi } from "vitest";
import { NARROW, useUi } from "./ui";

/**
 * The drawer hands the screen back to the note.
 *
 * On a phone the sidebar overlays the editor, so opening a note from it without
 * closing it leaves the note the user asked for behind the thing that asked. On
 * a desktop the sidebar is a column and closing it on every open would be the
 * app fighting the user — so the same call has to do nothing there.
 */
function withViewport(narrow: boolean) {
  const asked: string[] = [];
  vi.stubGlobal("window", {
    matchMedia: (query: string) => {
      asked.push(query);
      return { matches: narrow && query === NARROW };
    },
  });
  return asked;
}

describe("collapseOnNarrow", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    useUi.setState({ panel: "files" });
  });

  it("collapses the sidebar when the window is narrow", () => {
    withViewport(true);
    useUi.getState().collapseOnNarrow();
    expect(useUi.getState().panel).toBeNull();
  });

  it("leaves a wide window alone", () => {
    withViewport(false);
    useUi.getState().collapseOnNarrow();
    expect(useUi.getState().panel).toBe("files");
  });

  it("asks for the same query the stylesheet opens its mobile block with", () => {
    const asked = withViewport(true);
    useUi.getState().collapseOnNarrow();
    // Two copies of a breakpoint drift, and the shape that drift takes is a
    // drawer that closes at one width and overlays at another.
    expect(asked).toEqual([NARROW]);
  });

  it("does nothing where there is no window to measure", () => {
    // A test runner or a prerender is not a narrow screen, and must not have a
    // sidebar closed underneath it.
    vi.stubGlobal("window", undefined);
    useUi.getState().collapseOnNarrow();
    expect(useUi.getState().panel).toBe("files");

    vi.stubGlobal("window", {});
    useUi.getState().collapseOnNarrow();
    expect(useUi.getState().panel).toBe("files");
  });
});
