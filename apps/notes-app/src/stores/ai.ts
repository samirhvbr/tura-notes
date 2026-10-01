import { create } from "zustand";
import * as ipc from "../ipc";

/**
 * Whether the AI assistant is on, and which providers it has (ADR-100).
 *
 * Read from Rust, which is the only place that decides: this holds the last
 * answer so the rail and the chat panel can show the right thing without asking
 * again, and the settings section replaces it with every answer it gets.
 */
interface AiState {
  overview: ipc.AiOverview | null;
  load: () => Promise<void>;
  set: (overview: ipc.AiOverview) => void;
}

export const useAi = create<AiState>((set) => ({
  overview: null,
  load: async () => {
    try {
      set({ overview: await ipc.aiOverview() });
    } catch {
      // Outside Tauri, or the command failed: the assistant simply is not there.
      set({ overview: null });
    }
  },
  set: (overview) => set({ overview }),
}));

/** The assistant is on and has something to ask. */
export function usable(o: ipc.AiOverview | null): boolean {
  return !!o && o.enabled && o.providers.length > 0;
}
