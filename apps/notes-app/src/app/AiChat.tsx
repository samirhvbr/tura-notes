import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import * as ipc from "../ipc";
import { t } from "../i18n";
import { useAi, usable } from "../stores/ai";
import { useAiChat, type EditCard, type Turn } from "../stores/aiChat";
import { useEditor } from "../stores/editor";
import { useUi } from "../stores/ui";
import { useSelection } from "../editor/selection";

/**
 * The AI assistant's chat (ADR-100), in the sidebar.
 *
 * The one thing it never hides is what goes out with a question. Above the
 * composer, every note and the selection that will be sent is a chip the user can
 * remove, and under each question the chat says what was sent and whether any of
 * it was cut. Nothing is sent that is not in that row.
 *
 * Replies are shown as plain text with their line breaks. They are not rendered
 * as Markdown here: the reply is something to read and copy into a note, and
 * rendering model output as markup is a surface this first version does not open.
 */
export function AiChat({ onOpenSettings }: { onOpenSettings: () => void }) {
  const overview = useAi((s) => s.overview);
  const load = useAi((s) => s.load);
  useEffect(() => {
    if (!overview) void load();
  }, [overview, load]);
  useEffect(() => {
    let off: (() => void) | undefined;
    let live = true;
    void useAiChat
      .getState()
      .listen()
      .then((u) => (live ? (off = u) : u()))
      .catch(() => {
        /* Outside Tauri there is nothing to listen to. */
      });
    return () => {
      live = false;
      off?.();
    };
  }, []);

  if (!overview?.enabled) {
    return (
      <section className="ai-chat" aria-label={t("ai.chat.title")}>
        <h3>{t("ai.chat.title")}</h3>
        <p className="note">{t("ai.chat.disabled")}</p>
        <button type="button" onClick={onOpenSettings}>{t("ai.chat.openSettings")}</button>
      </section>
    );
  }
  if (!usable(overview)) {
    return (
      <section className="ai-chat" aria-label={t("ai.chat.title")}>
        <h3>{t("ai.chat.title")}</h3>
        <p className="note">{t("ai.chat.noProvider")}</p>
        <button type="button" onClick={onOpenSettings}>{t("ai.chat.openSettings")}</button>
      </section>
    );
  }
  return <Conversation overview={overview} />;
}

function Conversation({ overview }: { overview: ipc.AiOverview }) {
  const chat = useAiChat();
  const doc = useEditor((s) => s.doc);
  const mainView = useUi((s) => s.mainView);
  const selected = useSelection((s) => s.chars);
  const [text, setText] = useState("");
  const [attaching, setAttaching] = useState(false);
  const log = useRef<HTMLDivElement>(null);

  // Only a local note can be read by the core; a note of the server's cannot be sent yet.
  const current = mainView === "local" && doc ? doc.path : null;
  const remote = mainView === "remote";

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.turns]);

  const submit = () => {
    const question = text;
    if (!question.trim() || chat.busy) return;
    setText("");
    void chat.send(question, current);
  };

  const name = (path: string) => path.split("/").pop() ?? path;
  const provider = chat.provider ?? overview.default_provider ?? "";

  return (
    <section className="ai-chat" aria-label={t("ai.chat.title")}>
      <header>
        <h3>{t("ai.chat.title")}</h3>
        {overview.providers.length > 1 && (
          <select
            aria-label={t("ai.chat.provider")}
            value={provider}
            disabled={chat.busy}
            onChange={(e) => chat.setProvider(e.target.value)}
          >
            {overview.providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.model}
              </option>
            ))}
          </select>
        )}
        {chat.turns.length > 0 && (
          <button type="button" onClick={chat.clear}>{t("ai.chat.clear")}</button>
        )}
      </header>

      <div className="ai-log" ref={log} role="log" aria-live="polite">
        {chat.turns.length === 0 && <p className="note">{t("ai.chat.empty")}</p>}
        {chat.turns.map((turn) => (
          <Message key={turn.id} turn={turn} />
        ))}
      </div>

      <div className="ai-context" aria-label={t("ai.chat.context")}>
        <span className="note">{t("ai.chat.context")}</span>
        {current && (
          <Chip
            on={chat.includeCurrent}
            label={`${t("ai.chat.currentNote")} · ${name(current)}`}
            remove={t("ai.chat.remove", { name: name(current) })}
            toggle={() => chat.setIncludeCurrent(!chat.includeCurrent)}
          />
        )}
        {remote && <span className="note">{t("ai.chat.remoteNote")}</span>}
        {selected > 0 && (
          <Chip
            on={chat.includeSelection}
            label={t("ai.chat.selection", { count: selected })}
            remove={t("ai.chat.remove", { name: t("ai.chat.selection", { count: selected }) })}
            toggle={() => chat.setIncludeSelection(!chat.includeSelection)}
          />
        )}
        {chat.attached.map((path) => (
          <Chip
            key={path}
            on
            label={name(path)}
            remove={t("ai.chat.remove", { name: name(path) })}
            toggle={() => chat.detach(path)}
          />
        ))}
        <button type="button" onClick={() => setAttaching(!attaching)} aria-expanded={attaching}>
          {t("ai.chat.attach")}
        </button>
        {attaching && (
          <Finder
            onPick={(path) => {
              chat.attach(path);
              setAttaching(false);
            }}
          />
        )}
      </div>

      <div className="ai-composer">
        <textarea
          aria-label={t("ai.chat.placeholder")}
          placeholder={t("ai.chat.placeholder")}
          value={text}
          rows={3}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter breaks the line; an IME's own Enter,
            // which confirms a composition, sends nothing.
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {chat.busy ? (
          <button type="button" onClick={() => void chat.stop()}>{t("ai.chat.stop")}</button>
        ) : (
          <button type="button" className="primary" disabled={!text.trim()} onClick={submit}>
            {t("ai.chat.send")}
          </button>
        )}
      </div>
    </section>
  );
}

function Chip({ on, label, remove, toggle }: { on: boolean; label: string; remove: string; toggle: () => void }) {
  // A chip that is off stays visible and says so, so a note that is not being
  // sent is never mistaken for one that is.
  return (
    <span className={on ? "ai-chip on" : "ai-chip"}>
      <label>
        <input type="checkbox" checked={on} onChange={toggle} aria-label={label} />
        {label}
      </label>
      {on && (
        <button type="button" className="ai-chip-x" aria-label={remove} title={remove} onClick={toggle}>
          <X size={12} aria-hidden="true" />
        </button>
      )}
    </span>
  );
}

/** Find a workspace note to attach, by the same quick-open the palette uses. */
function Finder({ onPick }: { onPick: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<ipc.QuickMatch[]>([]);
  useEffect(() => {
    let live = true;
    ipc
      .quickOpen(query, 8)
      .then((r) => live && setMatches(r.matches))
      .catch(() => live && setMatches([]));
    return () => {
      live = false;
    };
  }, [query]);
  return (
    <div className="ai-finder">
      <input
        autoFocus
        aria-label={t("ai.chat.attachSearch")}
        placeholder={t("ai.chat.attachSearch")}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {matches.length === 0 ? (
        <p className="note">{t("ai.chat.noMatches")}</p>
      ) : (
        <ul>
          {matches.map((m) => (
            <li key={m.path}>
              <button type="button" onClick={() => onPick(m.path)}>
                {m.name} <span className="note">{m.path}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Message({ turn }: { turn: Turn }) {
  const [copied, setCopied] = useState(false);
  const mine = turn.role === "user";
  const ending: Partial<Record<Turn["state"], string>> = {
    stopped: t("ai.chat.stopped"),
    max_tokens: t("ai.chat.maxTokens"),
    refusal: t("ai.chat.refusal"),
    other: t("ai.chat.other"),
  };
  const items = turn.sent?.map((s) => `${s.label} (${s.chars}${s.truncated ? `, ${t("ai.chat.cut")}` : ""})`);
  return (
    <article className={mine ? "ai-msg mine" : "ai-msg"}>
      <h4>{mine ? t("ai.chat.you") : t("ai.chat.assistant")}</h4>
      <div className="ai-text">
        {turn.content || (turn.state === "streaming" ? <em>{t("ai.chat.thinking")}</em> : null)}
      </div>
      {mine && items && items.length > 0 && (
        <p className="note">{t("ai.chat.sent", { items: items.join(", ") })}</p>
      )}
      {ending[turn.state] && <p className="note">{ending[turn.state]}</p>}
      {turn.edits?.map((card) => (
        <EditCardView key={card.id} turn={turn.id} card={card} />
      ))}
      {turn.state === "error" && turn.error && (
        <p role="alert" className="bad">
          {t(`ai.error.${turn.error.code}`, { detail: turn.error.detail ?? "" })}
        </p>
      )}
      {!mine && turn.content && turn.state !== "streaming" && (
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(turn.content).then(() => setCopied(true));
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? t("ai.chat.copied") : t("ai.chat.copy")}
        </button>
      )}
    </article>
  );
}

/**
 * One change the assistant made, or was asked to make and did not. Every card
 * names the note, so what happened to the user's files is never implied, and an
 * applied one can be undone from here while that is still safe: after the user
 * has typed in the note, or opened another, the note's own Ctrl+Z is the way.
 */
function EditCardView({ turn, card }: { turn: number; card: EditCard }) {
  const undoEdit = useAiChat((s) => s.undoEdit);
  const name = card.path.split("/").pop() ?? card.path;
  const applied = card.state === "applied";
  const headline =
    card.state === "undone"
      ? t("ai.edit.undone", { name })
      : applied
        ? t(card.kind === "create" ? "ai.edit.created" : "ai.edit.edited", { name })
        : card.kind === "rejected"
          ? t("ai.edit.rejected", { name })
          : t("ai.edit.notApplied", { name });
  return (
    <div className={applied ? "ai-edit applied" : "ai-edit"} role="group" aria-label={headline}>
      <p>{headline}</p>
      {card.why && (
        <p className="note">
          {t(`ai.edit.why.${card.why}`, { name })}
          {card.detail ? ` ${card.detail}` : ""}
        </p>
      )}
      {applied && card.undo && (
        <button type="button" onClick={() => undoEdit(turn, card.id)}>
          {t("ai.edit.undo")}
        </button>
      )}
      {card.undoBlocked && <p className="note">{t("ai.edit.undoBlocked")}</p>}
    </div>
  );
}
