import { expect, it } from "vitest";
import { errorText } from "./StatusBar";
import en from "../i18n/en.json";
import ptBR from "../i18n/pt-BR.json";
import type { SyncCause } from "../ipc/generated/SyncCause";

// A `Record` over the union, so a cause added in Rust and regenerated here fails
// to compile until it is listed -- and then fails below until it has words.
const causes: Record<SyncCause, true> = {
  application_blocked: true,
  unsupported_application: true,
  invalid: true,
  storage: true,
  busy: true,
  offline: true,
  denied: true,
  conflict: true,
  limit: true,
  protocol: true,
  receiving: true,
};

it("every sync refusal has its own sentence in both languages", () => {
  for (const cause of Object.keys(causes)) {
    const key = `error.sync.${cause}`;
    expect(en, key).toHaveProperty([key]);
    expect(ptBR, key).toHaveProperty([key]);
  }
});

it("a sync conflict no longer reads as unsupported storage", () => {
  const text = errorText({ code: "sync", cause: "conflict" });
  expect(text).not.toBe(en["error.unsupported"]);
  expect(text).toBe(en["error.sync.conflict"]);
  expect(errorText({ code: "sync", cause: "receiving", received: 20 })).toContain("20 revisions");
});
