import { create } from "zustand";

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
