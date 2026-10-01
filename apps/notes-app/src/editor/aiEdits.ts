/**
 * What the AI assistant's edits do to a note's text (ADR-100), as pure functions.
 *
 * The editor applies the result as **one** transaction, so a turn is one undo,
 * and nothing here knows about CodeMirror: the same text and selection in give
 * the same text out, which is what makes it testable without a browser.
 */
export type EditOpName = "replace_selection" | "insert_at_cursor" | "replace_all";

export interface EditOp {
  op: EditOpName;
  text: string;
}

export interface Sel {
  from: number;
  to: number;
}

/** Why an operation was left out. The text it would have written is not applied
 *  anywhere: a guess at where it belonged is worse than saying it did not apply. */
export type Skip = "no_selection" | "selection_changed";

export interface Simulated {
  text: string;
  sel: Sel;
  applied: number;
  skipped: Skip[];
}

/** What applying a turn's operations to the editor came to. */
export interface Applied {
  applied: number;
  skipped: Skip[];
  /** The note is read-only; nothing was applied. */
  readOnly: boolean;
  /** Names the transaction for `undo`; null when nothing changed. */
  token: number | null;
}

/**
 * Run a turn's operations, in order, over the note as it is now.
 *
 * `replace_selection` acts on the selection **the user shared**, and only while
 * it is still what was shared: the model was shown that text and wrote its
 * replacement for it, so a different selection would receive an answer to a
 * question about other words. After any operation the cursor sits at the end of
 * what was written and nothing is selected, so a second `replace_selection` in
 * the same turn has nothing to act on and is skipped, not guessed.
 */
export function simulate(text: string, sel: Sel, ops: EditOp[], shared: string | null): Simulated {
  let doc = text;
  let at: Sel = { from: Math.min(sel.from, sel.to), to: Math.max(sel.from, sel.to) };
  let applied = 0;
  const skipped: Skip[] = [];
  for (const { op, text: insert } of ops) {
    if (op === "replace_all") {
      doc = insert;
      at = { from: insert.length, to: insert.length };
    } else if (op === "insert_at_cursor") {
      doc = doc.slice(0, at.to) + insert + doc.slice(at.to);
      const end = at.to + insert.length;
      at = { from: end, to: end };
    } else {
      if (at.from === at.to || !shared) {
        skipped.push("no_selection");
        continue;
      }
      if (doc.slice(at.from, at.to) !== shared) {
        skipped.push("selection_changed");
        continue;
      }
      doc = doc.slice(0, at.from) + insert + doc.slice(at.to);
      const end = at.from + insert.length;
      at = { from: end, to: end };
    }
    applied++;
  }
  return { text: doc, sel: at, applied, skipped };
}

/**
 * The smallest single change that turns `before` into `after`: what a
 * transaction should replace, so the cursor, the scroll position and the undo
 * entry stay as small as the edit was. Never splits a surrogate pair.
 */
export function minimalChange(before: string, after: string): { from: number; to: number; insert: string } {
  const limit = Math.min(before.length, after.length);
  let start = 0;
  while (start < limit && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  if (start > 0 && isHigh(before.charCodeAt(start - 1))) start--;
  let endB = before.length;
  let endA = after.length;
  while (endB > start && endA > start && before.charCodeAt(endB - 1) === after.charCodeAt(endA - 1)) {
    endB--;
    endA--;
  }
  if (endB < before.length && isLow(before.charCodeAt(endB))) {
    endB++;
    endA++;
  }
  return { from: start, to: endB, insert: after.slice(start, endA) };
}

const isHigh = (c: number) => c >= 0xd800 && c <= 0xdbff;
const isLow = (c: number) => c >= 0xdc00 && c <= 0xdfff;
