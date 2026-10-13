"use client";

import { useEffect, useMemo, useState } from "react";
import Pron from "./Pron";
import { useEntries } from "@/lib/hooks";
import { buildDocs, search } from "@/lib/search";
import { getKv, setKv } from "@/lib/db";
import { useStore } from "@/lib/store";

const KIND_STYLE: Record<string, string> = {
  Mot: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  Chunk: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  Collocation: "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-200",
  Expression: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/40 dark:text-fuchsia-200",
  Exemple: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
};

export default function SearchView() {
  const entries = useEntries();
  const query = useStore((s) => s.query);
  const setQuery = useStore((s) => s.setQuery);
  const openEntry = useStore((s) => s.openEntry);
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    getKv<string[]>("searchHistory", []).then(setHistory);
  }, []);

  const docs = useMemo(() => buildDocs(entries ?? []), [entries]);
  const hits = useMemo(() => search(docs, query), [docs, query]);
  const wordOf = useMemo(() => new Map((entries ?? []).map((e) => [e.id, e.word])), [entries]);

  async function remember(q: string) {
    const t = q.trim();
    if (t.length < 2) return;
    const next = [t, ...history.filter((h) => h !== t)].slice(0, 12);
    setHistory(next);
    await setKv("searchHistory", next);
  }

  async function clearHistory() {
    setHistory([]);
    await setKv("searchHistory", []);
  }

  const q = query.trim();
  return (
    <div className="space-y-3 p-4">
      {q.length < 2 ? (
        <>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Tapez en français ou en anglais (mot, fragment, phrase entière). La recherche tolère les fautes, les accents oubliés et les mots dans le désordre.
          </p>
          {history.length > 0 && (
            <div className="card">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">Dernières recherches</h2>
                <button className="text-sm font-semibold text-indigo-600 dark:text-indigo-300" onClick={clearHistory}>
                  Effacer
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {history.map((h) => (
                  <button key={h} className="chip bg-slate-100 !px-3 !py-1.5 text-sm text-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={() => setQuery(h)}>
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {hits.length} résultat{hits.length > 1 ? "s" : ""}
          </p>
          {hits.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucun résultat pour « {q} ».</p>}
          <ul className="space-y-2">
            {hits.map((h, i) => (
              <li key={`${h.entryId}-${h.kind}-${i}`}>
                <div
                  role="button"
                  tabIndex={0}
                  className="card anim-pop w-full cursor-pointer active:scale-[0.99]"
                  onClick={() => {
                    remember(q);
                    openEntry(h.entryId);
                  }}
                  onKeyDown={(k) => {
                    if (k.key === "Enter") {
                      remember(q);
                      openEntry(h.entryId);
                    }
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`chip ${KIND_STYLE[h.kind]}`}>{h.kind}</span>
                    <span className="truncate text-xs text-slate-500">
                      Fiche : <span className="font-semibold">{wordOf.get(h.entryId)}</span>
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">{h.text}</p>
                  <Pron ipa={h.ipa} say={h.text} className="text-sm" />
                  <p className="text-indigo-700 dark:text-indigo-300">{h.translation}</p>
                  <p className="mt-1 text-xs text-slate-400">trouvé dans : {h.via}</p>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
