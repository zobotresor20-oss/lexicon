"use client";

import { useMemo, useState } from "react";
import Pron from "./Pron";
import { useCards, useEntries } from "@/lib/hooks";
import { POS_LIST, type Entry } from "@/lib/types";
import { STATUS_STYLE, missingText, pronMissing, statusOf, type Status } from "@/lib/entry";
import { useStore } from "@/lib/store";
import { DAY, dkey, hashStr, norm } from "@/lib/util";

type Sort = "recent" | "old" | "az" | "incomplete";

export default function DictionaryView() {
  const entries = useEntries();
  const cards = useCards();
  const openEntry = useStore((s) => s.openEntry);
  const openEditor = useStore((s) => s.openEditor);

  const [status, setStatus] = useState<"" | Status>("");
  const [pos, setPos] = useState("");
  const [tag, setTag] = useState("");
  const [period, setPeriod] = useState<"" | "7" | "30" | "365">("");
  const [noPron, setNoPron] = useState(false);
  const [sort, setSort] = useState<Sort>("recent");
  const [open, setOpen] = useState(false);

  const allTags = useMemo(() => Array.from(new Set((entries ?? []).flatMap((e) => e.tags))).sort(), [entries]);

  const rows = useMemo(() => {
    if (!entries || !cards) return [];
    const now = Date.now();
    const list = entries
      .map((e) => ({ e, st: statusOf(e, cards) }))
      .filter(({ e, st }) => {
        if (status && st !== status) return false;
        if (pos && e.pos !== pos) return false;
        if (tag && !e.tags.includes(tag)) return false;
        if (period && now - e.createdAt > Number(period) * DAY) return false;
        if (noPron && pronMissing(e) === 0) return false;
        return true;
      });
    list.sort((a, b) => {
      if (sort === "az") return norm(a.e.word).localeCompare(norm(b.e.word));
      if (sort === "old") return a.e.createdAt - b.e.createdAt;
      if (sort === "incomplete") {
        const ia = a.st === "Incomplète" ? 0 : 1;
        const ib = b.st === "Incomplète" ? 0 : 1;
        return ia - ib || b.e.createdAt - a.e.createdAt;
      }
      return b.e.createdAt - a.e.createdAt;
    });
    return list;
  }, [entries, cards, status, pos, tag, period, noPron, sort]);

  const wod: Entry | undefined = useMemo(() => {
    if (!entries || !entries.length) return undefined;
    const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
    return sorted[hashStr(dkey(Date.now())) % sorted.length];
  }, [entries]);

  if (!entries || !cards) return <p className="p-6 text-center text-sm text-slate-500">Chargement…</p>;

  const active = [status, pos, tag, period].filter(Boolean).length + (noPron ? 1 : 0);

  return (
    <div className="space-y-3 p-4">
      {wod && (
        <button onClick={() => openEntry(wod.id)} className="card anim-pop w-full bg-gradient-to-br from-indigo-600 to-violet-600 text-left text-white !border-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-100">Mot du jour</p>
          <p className="mt-1 text-2xl font-extrabold">{wod.word}</p>
          <p className="text-indigo-100">{wod.translation}</p>
        </button>
      )}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold">
          Mes fiches <span className="text-sm font-normal text-slate-500">({rows.length}/{entries.length})</span>
        </h2>
        <button className="btn-ghost !min-h-10" onClick={() => setOpen((o) => !o)}>
          Filtres{active ? ` (${active})` : ""} · Tri
        </button>
      </div>

      {open && (
        <div className="card anim-pop grid grid-cols-2 gap-3">
          <div>
            <label className="lbl">Statut</label>
            <select className="inp" value={status} onChange={(e) => setStatus(e.target.value as "" | Status)}>
              <option value="">Tous</option>
              {(["Incomplète", "Complète", "En apprentissage", "Maîtrisée"] as Status[]).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Nature</label>
            <select className="inp" value={pos} onChange={(e) => setPos(e.target.value)}>
              <option value="">Toutes</option>
              {POS_LIST.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Étiquette</label>
            <select className="inp" value={tag} onChange={(e) => setTag(e.target.value)}>
              <option value="">Toutes</option>
              {allTags.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="lbl">Date d'ajout</label>
            <select className="inp" value={period} onChange={(e) => setPeriod(e.target.value as "" | "7" | "30" | "365")}>
              <option value="">Toutes</option>
              <option value="7">7 derniers jours</option>
              <option value="30">30 derniers jours</option>
              <option value="365">12 derniers mois</option>
            </select>
          </div>
          <div>
            <label className="lbl">Tri</label>
            <select className="inp" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="recent">Plus récentes</option>
              <option value="old">Plus anciennes</option>
              <option value="az">A → Z</option>
              <option value="incomplete">Incomplètes d'abord</option>
            </select>
          </div>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm font-medium">
            <input type="checkbox" className="h-5 w-5" checked={noPron} onChange={(e) => setNoPron(e.target.checked)} />
            Sans prononciation
          </label>
          {active > 0 && (
            <button
              className="btn-soft col-span-2"
              onClick={() => {
                setStatus("");
                setPos("");
                setTag("");
                setPeriod("");
                setNoPron(false);
              }}
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      )}

      {entries.length === 0 && (
        <div className="card text-center">
          <p className="font-semibold">Votre dictionnaire est vide.</p>
          <p className="mt-1 text-sm text-slate-500">Appuyez sur « + » pour créer votre première fiche.</p>
          <button className="btn-primary mt-3" onClick={() => openEditor()}>
            Créer une fiche
          </button>
        </div>
      )}
      {entries.length > 0 && rows.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucune fiche ne correspond à ces filtres.</p>}

      <ul className="space-y-2">
        {rows.map(({ e, st }) => {
          const miss = missingText(e);
          return (
            <li key={e.id}>
              <div role="button" tabIndex={0} onClick={() => openEntry(e.id)} onKeyDown={(k) => k.key === "Enter" && openEntry(e.id)} className="card flex w-full cursor-pointer items-start justify-between gap-3 active:scale-[0.99]">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold">{e.word}</p>
                  <Pron ipa={e.ipa} say={e.word} className="text-sm" />
                  <p className="truncate text-indigo-700 dark:text-indigo-300">{e.translation}</p>
                  {miss && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{miss}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`chip ${STATUS_STYLE[st]}`}>{st}</span>
                  {e.pos && <span className="text-xs text-slate-500">{e.pos}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
