// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { ReadOnlyBanner } from "./ReadOnlyBanner";

afterEach(cleanup);

it("says a newer version wrote the state, and which format", () => {
  render(<ReadOnlyBanner readOnly={{ reason: "schema_ahead", found: 3 }} />);
  expect(screen.getByRole("status").textContent).toContain("newer version");
  expect(screen.getByRole("status").textContent).toContain("format 3");
});

it("says the identities are missing, which is a different thing", () => {
  render(<ReadOnlyBanner readOnly={{ reason: "identity_lost" }} />);
  expect(screen.getByRole("status").textContent).toContain("identities is missing");
});

it("is absent from a writable workspace", () => {
  render(<ReadOnlyBanner readOnly={null} />);
  expect(screen.queryByRole("status")).toBeNull();
});
