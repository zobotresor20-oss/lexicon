"use client";

import dynamic from "next/dynamic";

// Toute l'application dépend du navigateur (IndexedDB, window, speechSynthesis, Notification) :
// elle n'est donc jamais rendue côté serveur.
const App = dynamic(() => import("./App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh items-center justify-center text-sm text-slate-500">Chargement de MyLexicon…</div>
  ),
});

export default function Boot() {
  return <App />;
}
