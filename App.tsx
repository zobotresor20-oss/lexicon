"use client";

import { useEffect } from "react";
import Icon, { type IconName } from "./Icon";
import DictionaryView from "./DictionaryView";
import SearchView from "./SearchView";
import StudyView from "./StudyView";
import StatsView from "./StatsView";
import SettingsView from "./SettingsView";
import EntryDetail from "./EntryDetail";
import EntryForm from "./EntryForm";
import { ConfirmDialog, Toast } from "./Overlays";
import { db } from "@/lib/db";
import { seedDemoIfNeeded } from "@/lib/demo";
import { dueToday } from "@/lib/session";
import { useStore, type Tab } from "@/lib/store";
import { dkey } from "@/lib/util";

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: "dict", label: "Dictionnaire", icon: "book" },
  { id: "search", label: "Recherche", icon: "search" },
  { id: "study", label: "Étudier", icon: "zap" },
  { id: "stats", label: "Statistiques", icon: "chart" },
  { id: "settings", label: "Réglages", icon: "settings" },
];

const TITLES: Record<Tab, string> = {
  dict: "MyLexicon",
  search: "Recherche",
  study: "Étudier",
  stats: "Statistiques",
  settings: "Réglages",
};

export default function App() {
  const tab = useStore((s) => s.tab);
  const setTab = useStore((s) => s.setTab);
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const openId = useStore((s) => s.openId);
  const editor = useStore((s) => s.editor);
  const openEditor = useStore((s) => s.openEditor);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);

  // Premier lancement : fiches de démonstration
  useEffect(() => {
    seedDemoIfNeeded().catch(() => undefined);
  }, []);

  // Thème et taille du texte
  useEffect(() => {
    const root = document.documentElement;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => root.classList.toggle("dark", settings.theme === "dark" || (settings.theme === "system" && mq.matches));
    apply();
    root.style.fontSize = `${settings.fontSize}px`;
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, [settings.theme, settings.fontSize]);

  // Service worker (hors ligne)
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return;
    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then(() => navigator.serviceWorker.ready)
        .then((reg) => {
          // met en cache tout ce que la page a chargé, pour un usage hors ligne dès la première visite
          const urls = performance
            .getEntriesByType("resource")
            .map((r) => r.name)
            .filter((u) => u.startsWith(location.origin));
          reg.active?.postMessage({ type: "CACHE_URLS", urls });
        })
        .catch(() => undefined);
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  // Rappel quotidien (notification locale)
  useEffect(() => {
    if (!settings.reminderOn || typeof Notification === "undefined") return;
    const tick = async () => {
      if (Notification.permission !== "granted") return;
      const now = new Date();
      const today = dkey(now.getTime());
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (settings.lastReminder === today || hhmm < settings.reminderTime) return;
      const [entries, cards] = await Promise.all([db.entries.toArray(), db.cards.toArray()]);
      const n = dueToday(entries, cards, settings).cards.length;
      const body = n ? `${n} carte${n > 1 ? "s" : ""} à réviser aujourd'hui.` : "Un petit mot du jour ?";
      setSettings({ lastReminder: today });
      try {
        const reg = await navigator.serviceWorker?.getRegistration();
        if (reg) await reg.showNotification("MyLexicon", { body, icon: "/icons/icon-192.png", tag: "daily" });
        else new Notification("MyLexicon", { body, icon: "/icons/icon-192.png" });
      } catch {
        /* ignoré */
      }
    };
    tick();
    const t = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [settings, setSettings]);

  return (
    <div className="mx-auto flex h-dvh max-w-2xl flex-col bg-slate-50 dark:bg-slate-950">
      <header className="safe-t border-b border-slate-200 bg-white px-4 pb-3 pt-3 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-indigo-700 dark:text-indigo-300">{TITLES[tab]}</h1>
        </div>
        <div className="relative mt-2">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            className="inp !pl-10"
            placeholder="Chercher en français ou en anglais…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => tab !== "search" && setTab("search")}
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Rechercher dans le dictionnaire"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-40">
        {tab === "dict" && <DictionaryView />}
        {tab === "search" && <SearchView />}
        {tab === "study" && <StudyView />}
        {tab === "stats" && <StatsView />}
        {tab === "settings" && <SettingsView />}
      </main>

      <button
        onClick={() => openEditor()}
        aria-label="Ajouter une fiche"
        className="safe-b fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/40 active:scale-95"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
      >
        <Icon name="plus" size={28} />
      </button>

      <nav className="safe-b fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95" aria-label="Navigation principale">
        <div className="mx-auto grid max-w-2xl grid-cols-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`flex min-h-16 flex-col items-center justify-center gap-0.5 text-[0.68rem] font-semibold ${tab === t.id ? "text-indigo-700 dark:text-indigo-300" : "text-slate-500 dark:text-slate-400"}`}
            >
              <Icon name={t.icon} size={22} />
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      {openId && <EntryDetail id={openId} />}
      {editor && <EntryForm id={editor.id} key={editor.id ?? "new"} />}
      <ConfirmDialog />
      <Toast />
    </div>
  );
}
