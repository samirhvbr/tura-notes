import { expect, it } from "vitest";
import { remoteNotePath } from "./names";

it("adds .md when it is missing, and leaves a Markdown name alone", () => {
  expect(remoteNotePath("today")).toBe("today.md");
  expect(remoteNotePath("  ideas/today ")).toBe("ideas/today.md");
  expect(remoteNotePath("today.md")).toBe("today.md");
  expect(remoteNotePath("Today.MD")).toBe("Today.MD");
  expect(remoteNotePath("long.markdown")).toBe("long.markdown");
  // A dot in the name is not an extension the server takes.
  expect(remoteNotePath("v1.2 notes")).toBe("v1.2 notes.md");
  expect(remoteNotePath("/ideas/today")).toBe("ideas/today.md");
});

it("refuses what has no right answer", () => {
  for (const typed of ["", "   ", "ideas/", "a//b", "../x", "ideas/./x", "/"]) {
    expect(remoteNotePath(typed), typed).toBeNull();
  }
});
