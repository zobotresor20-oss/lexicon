import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type Tab = "dict" | "search" | "study" | "stats" | "settings";

export interface Settings {
  theme: "system" | "light" | "dark";
  fontSize: number;
  hidePron: boolean;
  speechRate: number;
  newPerDay: number;
  reviewsPerDay: number;
  reminderOn: boolean;
  reminderTime: string;
  lastReminder: string;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  fontSize: 16,
  hidePron: false,
  speechRate: 0.9,
  newPerDay: 3,
  reviewsPerDay: 15,
  reminderOn: false,
  reminderTime: "19:00",
  lastReminder: "",
};

export interface ConfirmState {
  title: string;
  message: string;
  okLabel?: string;
  danger?: boolean;
  onOk: () => void | Promise<void>;
}

interface State {
  tab: Tab;
  setTab: (t: Tab) => void;
  query: string;
  setQuery: (q: string) => void;
  openId: string | null;
  openEntry: (id: string | null) => void;
  editor: { id?: string } | null;
  openEditor: (id?: string) => void;
  closeEditor: () => void;
  settings: Settings;
  setSettings: (p: Partial<Settings>) => void;
  toast: string | null;
  showToast: (m: string) => void;
  confirm: ConfirmState | null;
  askConfirm: (c: ConfirmState) => void;
  closeConfirm: () => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<State>()(
  persist(
    (set) => ({
      tab: "dict",
      setTab: (tab) => set({ tab }),
      query: "",
      setQuery: (query) => set(query.trim() ? { query, tab: "search" } : { query }),
      openId: null,
      openEntry: (openId) => set({ openId }),
      editor: null,
      openEditor: (id) => set({ editor: { id } }),
      closeEditor: () => set({ editor: null }),
      settings: DEFAULT_SETTINGS,
      setSettings: (p) => set((s) => ({ settings: { ...s.settings, ...p } })),
      toast: null,
      showToast: (m) => {
        set({ toast: m });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null }), 2600);
      },
      confirm: null,
      askConfirm: (confirm) => set({ confirm }),
      closeConfirm: () => set({ confirm: null }),
    }),
    {
      name: "mylexicon-settings",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ settings: s.settings }),
      merge: (persisted, current) => ({
        ...current,
        settings: { ...current.settings, ...((persisted as { settings?: Partial<Settings> } | undefined)?.settings ?? {}) },
      }),
    }
  )
);
