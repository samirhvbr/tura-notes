/**
 * What each Markdown toolbar button does to a document and a selection.
 *
 * Pure on purpose, and separate from the button that calls it. CodeMirror does
 * not run meaningfully under jsdom, so logic left inside a click handler is
 * logic nobody tests; here the interesting half — where the caret lands, what
 * happens to an empty selection, whether a second press undoes the first — is
 * ordinary input and output.
 *
 * Every action is a **toggle**. A toolbar whose bold button only ever adds
 * asterisks teaches the user to reach for the keyboard to undo it, which on a
 * phone is the keyboard this toolbar exists to avoid.
 */

export type Action = "bold" | "italic" | "code" | "link" | "list" | "heading";

/** A document and where the selection sits in it, in UTF-16 offsets. */
export interface Selection {
  text: string;
  from: number;
  to: number;
}

const WRAPS: Record<"bold" | "italic" | "code", string> = {
  bold: "**",
  italic: "*",
  code: "`",
};

const PREFIXES: Record<"list" | "heading", string> = {
  list: "- ",
  heading: "# ",
};

/** Wrap or unwrap, keeping the selection on the text rather than the marks. */
function toggleWrap(s: Selection, mark: string): Selection {
  const { text, from, to } = s;
  const inside = text.slice(from, to);

  // Already wrapped, marks inside the selection: unwrap.
  if (
    inside.length >= mark.length * 2 &&
    inside.startsWith(mark) &&
    inside.endsWith(mark)
  ) {
    const bare = inside.slice(mark.length, inside.length - mark.length);
    return {
      text: text.slice(0, from) + bare + text.slice(to),
      from,
      to: from + bare.length,
    };
  }

  // Already wrapped, marks just outside it: unwrap those instead. This is the
  // case that makes a second press work after the first one left the selection
  // on the text.
  const before = text.slice(Math.max(0, from - mark.length), from);
  const after = text.slice(to, to + mark.length);
  if (before === mark && after === mark) {
    return {
      text: text.slice(0, from - mark.length) + inside + text.slice(to + mark.length),
      from: from - mark.length,
      // From the *new* start, not the old one. Taking `to - mark.length` looks
      // symmetric and is wrong by the length of the selection: it left the
      // selection running past the text it had just unwrapped.
      to: from - mark.length + inside.length,
    };
  }

  return {
    text: text.slice(0, from) + mark + inside + mark + text.slice(to),
    from: from + mark.length,
    to: to + mark.length,
  };
}

/** The bounds of every line the selection touches, including a partial one. */
function lineSpan(text: string, from: number, to: number): [number, number] {
  const start = text.lastIndexOf("\n", from - 1) + 1;
  const endIndex = text.indexOf("\n", to);
  return [start, endIndex === -1 ? text.length : endIndex];
}

/**
 * Add the prefix to every touched line, or remove it from all of them when all
 * of them already carry it.
 *
 * All rather than some, deliberately: on a mixed block the useful move is to
 * finish the job, not to undo the part that was already done.
 */
function togglePrefix(s: Selection, prefix: string): Selection {
  const { text, from, to } = s;
  const [start, end] = lineSpan(text, from, to);
  const lines = text.slice(start, end).split("\n");
  const all = lines.every((l) => l.startsWith(prefix));
  const next = lines
    .map((l) => (all ? l.slice(prefix.length) : prefix + l))
    .join("\n");
  const delta = (all ? -1 : 1) * prefix.length;

  return {
    text: text.slice(0, start) + next + text.slice(end),
    // The caret keeps its place on the line rather than jumping to the margin,
    // and never slides behind the prefix it just gained.
    from: Math.max(start, from + delta),
    to: to + delta * lines.length,
  };
}

/**
 * `[selection](url)`, with the caret on `url` so the next keystroke types it.
 *
 * An empty selection produces `[](url)` rather than nothing: the user pressed
 * the button because they want a link, and an empty label is one keystroke from
 * correct while no output at all is a button that looked broken.
 */
function link(s: Selection): Selection {
  const { text, from, to } = s;
  const label = text.slice(from, to);
  const inserted = `[${label}](url)`;
  const urlAt = from + label.length + 3;
  return {
    text: text.slice(0, from) + inserted + text.slice(to),
    from: urlAt,
    to: urlAt + 3,
  };
}

export function apply(action: Action, s: Selection): Selection {
  switch (action) {
    case "bold":
    case "italic":
    case "code":
      return toggleWrap(s, WRAPS[action]);
    case "list":
    case "heading":
      return togglePrefix(s, PREFIXES[action]);
    case "link":
      return link(s);
  }
}
