import { errorText } from "../app/StatusBar";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, FileText, Search, X } from "lucide-react";
import { t } from "../i18n";
import * as ipc from "../ipc";
import type { SearchHit, SearchId, SearchMode } from "../ipc";
import { useEditor } from "../stores/editor";
import { useTabs } from "../stores/tabs";

/**
 * Global search: a panel, not a modal.
 *
 * Results are something you work through — open one, come back, open another —
 * so the panel stays while a note is open. It polls the core the same way
 * reconciliation does, because the core collects and the frontend asks.
 *
 * Two things it must say out loud, both from scope §10: **the search reads what
 * is on disk**, so an unsaved buffer has not been searched; and when the hit cap
 * is reached the list is the first N rather than all of them.
 */
export function SearchPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<SearchMode>("literal");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [phase, setPhase] = useState<"idle" | "searching" | "finished" | "cancelled" | "failed">("idle");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const running = phase === "searching";
  const [truncated, setTruncated] = useState(false);
  const [partial, setPartial] = useState(false);
  const [scanned, setScanned] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const idRef = useRef<SearchId | null>(null);
  const generation = useRef(0);
  const input = useRef<HTMLInputElement | null>(null);
  const openAt = useTabs((s) => s.openAt);
  const doc = useEditor((s) => s.doc);
  const dirty = !!doc && doc.bufferVersion !== doc.savedVersion;

  useEffect(() => {
    const id = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(id);
  }, []);

  const cancelActive = useCallback(() => {
    generation.current += 1;
    const id = idRef.current;
    idRef.current = null;
    if (id !== null) void ipc.searchCancel(id).catch(() => {});
  }, []);

  // Cancel on unmount: a panel that is closed must not leave a walk running.
  useEffect(() => cancelActive, [cancelActive]);

  const start = useCallback(async () => {
    cancelActive();
    setHits([]);
    setTruncated(false);
    setPartial(false);
    setScanned(0);
    setError(null);
    if (!query.trim()) {
      setPhase("idle");
      return;
    }
    setSubmittedQuery(query);

    const ticket = generation.current;
    setPhase("searching");
    let id: SearchId;
    try {
      id = await ipc.searchStart(query, { mode, case_sensitive: mode === "words" ? false : caseSensitive });
    } catch (e) {
      if (ticket !== generation.current) return;
      setPhase("failed");
      const err = ipc.asCoreError(e);
      setError(err.code === "invalid_path" ? t("search.badPattern") : errorText(err));
      return;
    }
    if (ticket !== generation.current) {
      void ipc.searchCancel(id).catch(() => {});
      return;
    }
    idRef.current = id;

    // Polling rather than an event stream, following `reconcile_tick`. Fast
    // enough that the first result appears as soon as the core has it — it
    // arrives in about 11 ms on a 10 000-note workspace.
    const poll = async () => {
      if (idRef.current !== id) return;
      try {
        const p = await ipc.searchPoll(id);
        if (idRef.current !== id) return;
        if (p.hits.length) setHits((h) => h.concat(p.hits));
        setScanned(p.files_scanned);
        setTruncated(p.truncated);
        setPartial(p.partial);
        if (p.done || p.cancelled) {
          idRef.current = null;
          setPhase(p.cancelled ? "cancelled" : "finished");
          return;
        }
      } catch (e) {
        if (idRef.current !== id) return;
        setError(errorText(ipc.asCoreError(e)));
        idRef.current = null;
        setPhase("failed");
        return;
      }
      setTimeout(() => void poll(), 30);
    };
    void poll();
  }, [query, mode, caseSensitive, cancelActive]);

  let summary = "";
  if (running) summary = t("search.inProgress");
  if (phase === "cancelled") summary = t("search.cancelled");
  if (phase === "finished") {
    summary = hits.length || partial
      ? t("search.results", { query: submittedQuery })
      : t("search.noMatches", { query: submittedQuery });
  }

  return (
    <section className="search-panel" aria-labelledby="workspace-search-heading">
      <header>
        <h2 id="workspace-search-heading">{t("search.title")}</h2>
        <button type="button" className="icon-btn" onClick={onClose}
          aria-label={t("search.close")} title={t("search.close")}>
          <X size={16} aria-hidden="true" />
        </button>
      </header>
      <form onSubmit={(e) => { e.preventDefault(); void start(); }}>
        <label className="search-field">
          <span>{t("search.placeholder")}</span>
          <input
            ref={input}
            type="text"
            value={query}
            spellCheck={false}
            autoComplete="off"
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
        </label>
        <div className="search-options">
          <label className="search-mode">
            <span>{t("search.mode")}</span>
            <select value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
              <option value="literal">{t("search.mode.literal")}</option>
              <option value="words">{t("search.mode.words")}</option>
              <option value="regex">{t("search.mode.regex")}</option>
            </select>
          </label>
          <label className="search-case">
            <input type="checkbox"
              disabled={mode === "words"}
              checked={mode !== "words" && caseSensitive}
              onChange={(e) => setCaseSensitive(e.target.checked)}
            />
            {t("search.caseSensitive")}
          </label>
        </div>
        {running ? (
          <button type="button" className="action-button" onClick={() => {
            cancelActive();
            setPhase("cancelled");
          }}>{t("search.cancel")}</button>
        ) : (
          <button type="submit" className="action-button action-primary" disabled={!query.trim()}>
            <Search size={15} aria-hidden="true" />{t("search.run")}
          </button>
        )}
      </form>
      <p className="search-disclosure">
        {t("search.readsDisk")}
        {dirty && <strong> {t("search.unsavedWarning")}</strong>}
      </p>
      {error && <p className="search-error" role="alert"><AlertCircle size={16} aria-hidden="true" />{error}</p>}
      {partial && <p className="search-warning">{t("search.partial")}</p>}
      <p className="search-summary" role="status">
        {summary}
      </p>
      {(running || hits.length > 0 || partial) && (
        <p className="search-progress">
          {t("search.found", { files: scanned, hits: hits.length })}
          {truncated && ` · ${t("search.truncated", { hits: hits.length })}`}
        </p>
      )}
      {phase === "finished" && !hits.length && !partial && <p className="search-hint">{t("search.tryAgain")}</p>}
      {!!hits.length && <ul className="hits" aria-label={t("search.results", { query: submittedQuery })}>
        {hits.map((hit, index) => {
          const split = hit.path.lastIndexOf("/");
          const folder = hit.path.slice(0, Math.max(0, split));
          return (
            <li key={`${hit.path}:${hit.line}:${hit.col}:${index}`}>
              <button type="button" onClick={() => void openAt(hit.path, hit.line, hit.col)}
                title={`${hit.path}:${hit.line}`}>
                <span className="hit-file">
                  <FileText size={14} aria-hidden="true" />
                  <span>{hit.path.slice(split + 1)}</span>
                  <small>{t("search.line", { line: hit.line })}</small>
                </span>
                {folder && <span className="hit-folder">{folder}</span>}
                <span className="hit-context">{hit.context}</span>
              </button>
            </li>
          );
        })}
      </ul>}
    </section>
  );
}
