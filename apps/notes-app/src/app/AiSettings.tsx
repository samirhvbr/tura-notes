import { useEffect, useState } from "react";
import * as ipc from "../ipc";
import { t } from "../i18n";

/**
 * The AI assistant's section of the settings (ADR-100).
 *
 * Off until the user turns it on, and it says what turning it on means in the
 * sentence it always shows. Every provider is checked in Rust, never here: this
 * only collects what the user typed and shows what came back.
 *
 * **The key.** Its field is write-only. It is sent once, to the system keychain,
 * and cleared from this component's state the moment the call returns, whether
 * it worked or not. Nothing here can read a key back, so nothing here can show
 * one: a provider shows "key saved" or "no key", from the keychain.
 */
export function AiSettingsSection() {
  const [view, setView] = useState<ipc.AiOverview | null>(null);
  const [editing, setEditing] = useState<ipc.AiProviderInput | null>(null);
  const [keyText, setKeyText] = useState("");
  const [asking, setAsking] = useState<string | null>(null);
  const [tests, setTests] = useState<Record<string, ipc.AiTest>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    ipc.aiOverview().then(setView).catch((e) => setMessage(say(e)));
  }, []);

  if (!view) return message ? <p role="alert" className="bad">{message}</p> : null;

  // Runs one command, shows the answer it returns, and turns a refusal into a
  // sentence. The key field is emptied either way.
  const run = async (work: () => Promise<ipc.AiOverview>, done = "") => {
    setBusy(true);
    setMessage("");
    try {
      setView(await work());
      setMessage(done);
      return true;
    } catch (e) {
      setMessage(say(e));
      return false;
    } finally {
      setKeyText("");
      setBusy(false);
    }
  };

  const save = async () => {
    if (!editing) return;
    const before = new Set(view.providers.map((p) => p.id));
    const ok = await run(() => ipc.aiProviderSave(editing));
    if (!ok) return;
    // A new provider's id is chosen in Rust; find it as the one that was not there.
    let id = editing.id;
    if (!id) {
      const fresh = await ipc.aiOverview();
      id = fresh.providers.find((p) => !before.has(p.id))?.id ?? null;
    }
    const key = keyText.trim();
    if (id && key) await run(() => ipc.aiKeySet(id as string, key));
    setEditing(null);
  };

  const test = async (p: ipc.AiProviderView) => {
    setTesting(p.id);
    setMessage("");
    try {
      const result = await ipc.aiTest(p.id);
      setTests((all) => ({ ...all, [p.id]: result }));
      setMessage(t("ai.tested", { count: result.models.length }));
    } catch (e) {
      setMessage(say(e));
    } finally {
      setTesting(null);
    }
  };

  const open = (p: ipc.AiProviderView | null) => {
    setKeyText("");
    setEditing(
      p
        ? { id: p.id, kind: p.kind, name: p.name, base_url: p.base_url, model: p.model }
        : { id: null, kind: "anthropic", name: "", base_url: "", model: "claude-opus-5-5" },
    );
  };

  const kind = editing?.kind ?? "anthropic";
  const models = editing?.id ? tests[editing.id]?.models ?? [] : [];

  return (
    <section className="ai-settings" aria-labelledby="ai-title">
      <h3 id="ai-title">{t("ai.title")}</h3>
      <label className="check">
        <input
          type="checkbox"
          checked={view.enabled}
          disabled={busy}
          onChange={(e) => void run(() => ipc.aiSetEnabled(e.target.checked))}
        />
        {t("ai.enable")}
      </label>
      <p className="note">{t("ai.sendsOut")}</p>
      {view.keychain !== "available" && (
        <p role="status" className="note">
          {t(`ai.keychain.${view.keychain}`)}
        </p>
      )}

      {view.enabled && (
        <>
          <h4>{t("ai.providers")}</h4>
          {view.providers.length === 0 && <p className="note">{t("ai.none")}</p>}
          <ul className="ai-providers">
            {view.providers.map((p) => (
              <li key={p.id}>
                <span>
                  {p.name} · {p.model} ·{" "}
                  {p.key_configured ? t("ai.key.configured") : t("ai.key.missing")}
                  {view.default_provider === p.id && ` · ${t("ai.default")}`}
                </span>
                <button type="button" disabled={busy || testing !== null} onClick={() => void test(p)}>
                  {testing === p.id ? t("ai.testing") : t("ai.test")}
                </button>
                <button type="button" disabled={busy} onClick={() => open(p)}>
                  {t("ai.edit")}
                </button>
                {view.default_provider !== p.id && (
                  <button type="button" disabled={busy} onClick={() => void run(() => ipc.aiSetDefault(p.id))}>
                    {t("ai.makeDefault")}
                  </button>
                )}
                {asking === p.id ? (
                  <span role="group" aria-label={t("ai.remove")}>
                    {t("ai.removeAsk", { name: p.name })}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void run(() => ipc.aiProviderRemove(p.id)).then(() => setAsking(null))}
                    >
                      {t("ai.removeYes")}
                    </button>
                    <button type="button" onClick={() => setAsking(null)}>
                      {t("ai.cancel")}
                    </button>
                  </span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => setAsking(p.id)}>
                    {t("ai.remove")}
                  </button>
                )}
              </li>
            ))}
          </ul>

          {!editing && (
            <button type="button" disabled={busy} onClick={() => open(null)}>
              {t("ai.add")}
            </button>
          )}

          {editing && (
            <fieldset disabled={busy}>
              <label htmlFor="ai-kind">{t("ai.kind")}</label>
              <select
                id="ai-kind"
                value={editing.kind}
                onChange={(e) =>
                  setEditing({ ...editing, kind: e.target.value as ipc.AiProviderKind })
                }
              >
                <option value="anthropic">{t("ai.kind.anthropic")}</option>
                <option value="openai_compatible">{t("ai.kind.openai_compatible")}</option>
              </select>

              <label htmlFor="ai-name">{t("ai.name")}</label>
              <input
                id="ai-name"
                value={editing.name}
                maxLength={60}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />

              <label htmlFor="ai-base">{t("ai.baseUrl")}</label>
              <input
                id="ai-base"
                type="url"
                autoComplete="off"
                value={editing.base_url}
                onChange={(e) => setEditing({ ...editing, base_url: e.target.value })}
              />
              <p className="note">{t(`ai.baseUrl.hint.${kind}`)}</p>

              <label htmlFor="ai-model">{t("ai.model")}</label>
              <input
                id="ai-model"
                list="ai-models"
                autoComplete="off"
                value={editing.model}
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
              />
              <datalist id="ai-models">
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </datalist>

              <label htmlFor="ai-key">{t("ai.key")}</label>
              <input
                id="ai-key"
                type="password"
                autoComplete="off"
                spellCheck={false}
                value={keyText}
                onChange={(e) => setKeyText(e.target.value)}
              />
              <p className="note">{t("ai.key.hint")}</p>

              <div className="actions">
                <button type="button" className="primary" onClick={() => void save()}>
                  {t("ai.save")}
                </button>
                {editing.id && (
                  <>
                    <button
                      type="button"
                      disabled={!keyText.trim()}
                      onClick={() => void run(() => ipc.aiKeySet(editing.id as string, keyText.trim()))}
                    >
                      {t("ai.key.set")}
                    </button>
                    <button
                      type="button"
                      onClick={() => void run(() => ipc.aiKeyClear(editing.id as string))}
                    >
                      {t("ai.key.clear")}
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setEditing(null)}>
                  {t("ai.cancel")}
                </button>
              </div>
            </fieldset>
          )}
        </>
      )}
      {message && (
        <p role="status" aria-live="polite">
          {message}
        </p>
      )}
    </section>
  );
}

function say(e: unknown): string {
  const error = ipc.asAiError(e);
  return t(`ai.error.${error.code}`, { detail: error.detail ?? "" });
}
