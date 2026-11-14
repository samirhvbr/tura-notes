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
  rejected: true,
  storage: true,
  busy: true,
  offline: true,
  denied: true,
  conflict: true,
  limit: true,
  protocol: true,
  receiving: true,
  own_device: true,
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

// `errorText` builds most keys from the error's own fields, which
// `tools/i18n-keys.py` cannot resolve, so a code with no sentence reached the
// status bar as its key. Renaming or deleting an entry whose identity registry
// cannot be read refuses with this code.
it("an unreadable state file is explained in both languages, not printed as its key", () => {
  for (const [name, table] of [["en", en], ["pt-BR", ptBR]] as const) {
    expect(table, name).toHaveProperty(["error.state_unreadable"]);
  }
  const text = errorText({ code: "state_unreadable", store: "registry", path: "state/registry.db" });
  expect(text).not.toBe("error.state_unreadable");
  expect(text).toContain("(registry)");
});
