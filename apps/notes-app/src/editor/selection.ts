import { create } from "zustand";
import type { Applied, EditOp } from "./aiEdits";

/**
 * What the editor has selected, for the AI assistant's chat (ADR-100).
 *
 * The editor's view is private to `Editor.tsx`, and a selection's text can be
 * long, so this keeps only its size, which is cheap to update on every cursor
 * move, and a reader the editor registers, which the chat calls once, when a
 * question is sent. Nothing here keeps text.
 */
export const useSelection = create<{ chars: number }>(() => ({ chars: 0 }));

let reader: (() => string) | null = null;

/** The editor registers a reader for its current selection, and clears it
 *  when it goes. A reader that is not the one registered does not clear. */
export function registerSelection(next: (() => string) | null, owner?: () => string): void {
  if (next === null && owner && reader !== owner) return;
  reader = next;
  if (next === null) useSelection.setState({ chars: 0 });
}

export function setSelectionSize(chars: number): void {
  if (useSelection.getState().chars !== chars) useSelection.setState({ chars });
}

/** The selected text, or an empty string. */
export function readSelection(): string {
  try {
    return reader?.() ?? "";
  } catch {
    return "";
  }
}

/**
 * The editor's side of the assistant's edits (ADR-100). The view is private to
 * `Editor.tsx`, so the chat reaches it through what the editor registers: apply
 * a turn's operations to the note it holds, as one transaction, and undo that
 * transaction if nothing has been typed since.
 */
export interface EditorBridge {
  /** The note the view holds. An edit is only ever applied to the note it names. */
  noteId: string;
  /**
   * Apply the operations as one transaction. `token` identifies that
   * transaction for [`undo`], and is null when nothing changed.
   */
  apply: (ops: EditOp[], shared: string | null) => Applied;
  /** Undo the transaction `token` names, only if it is still the last thing
   *  done in this editor. Returns whether it undid anything. */
  undo: (token: number) => boolean;
}

let bridge: EditorBridge | null = null;

export function registerEditorBridge(next: EditorBridge | null, owner?: EditorBridge): void {
  if (next === null && owner && bridge !== owner) return;
  bridge = next;
}

export function editorBridge(): EditorBridge | null {
  return bridge;
}
