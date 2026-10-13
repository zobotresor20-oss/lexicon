"use client";

import Icon from "./Icon";
import Pron from "./Pron";
import { deleteEntry } from "@/lib/db";
import { KINDS, KIND_PLURAL, type Entry, type Example } from "@/lib/types";
import { MIN_PER_KIND, STATUS_STYLE, countKinds, missingText, statusOf } from "@/lib/entry";
import { useCards, useEntries } from "@/lib/hooks";
import { useStore } from "@/lib/store";
import { fmtDate } from "@/lib/util";

function Examples({ list }: { list: Example[] }) {
  if (!list.length) return null;
  return (
    <ul className="mt-2 space-y-2 border-l-2 border-indigo-200 pl-3 dark:border-indigo-800">
      {list.map((x) => (
        <li key={x.id} className="text-sm">
          <p className="italic">{x.text}</p>
          <p className="text-slate-500 dark:text-slate-400">{x.translation}</p>
          <Pron ipa={x.ipa} say={x.text} className="text-xs" />
        </li>
      ))}
    </ul>
  );
}

export default function EntryDetail({ id }: { id: string }) {
  const entries = useEntries();
  const cards = useCards();
  const openEntry = useStore((s) => s.openEntry);
  const openEditor = useStore((s) => s.openEditor);
  const askConfirm = useStore((s) => s.askConfirm);
  const showToast = useStore((s) => s.showToast);

  const e: Entry | undefined = entries?.find((x) => x.id === id);
  if (!entries || !cards) return null;
  if (!e) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-slate-50 p-6 dark:bg-slate-950">
        <p>Cette fiche n'existe plus.</p>
        <button className="btn-primary" onClick={() => openEntry(null)}>
          Retour
        </button>
      </div>
    );
  }
  const st = statusOf(e, cards);
  const c = countKinds(e);
  const miss = missingText(e);
  const exOf = (oid: string) => e.examples.filter((x) => x.ownerId === oid);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-slate-50 dark:bg-slate-950">
      <header className="safe-t flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button className="btn-ghost !px-3" onClick={() => openEntry(null)} aria-label="Retour">
          <Icon name="back" />
        </button>
        <h1 className="flex-1 truncate text-lg font-bold">Fiche</h1>
        <button className="btn-soft !px-3" onClick={() => openEditor(e.id)} aria-label="Modifier">
          <Icon name="edit" size={18} /> Modifier
        </button>
        <button
          className="btn-ghost !px-3 text-rose-600"
          aria-label="Supprimer la fiche"
          onClick={() =>
            askConfirm({
              title: "Supprimer cette fiche ?",
              message: `« ${e.word} » et tous ses éléments (chunks, collocations, expressions, phrases) ainsi que sa progression seront supprimés définitivement.`,
              okLabel: "Supprimer",
              danger: true,
              onOk: async () => {
                await deleteEntry(e.id);
                openEntry(null);
                showToast("Fiche supprimée.");
              },
            })
          }
        >
          <Icon name="trash" size={18} />
        </button>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto p-4 pb-10">
        <section className="card anim-pop">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`chip ${STATUS_STYLE[st]}`}>{st}</span>
            {miss && <span className="text-xs font-medium text-amber-700 dark:text-amber-300">{miss}</span>}
          </div>
          <h2 className="mt-3 text-3xl font-extrabold">{e.word}</h2>
          <Pron ipa={e.ipa} say={e.word} className="mt-1" />
          <p className="mt-2 text-xl text-indigo-700 dark:text-indigo-300">{e.translation}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {e.pos && <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{e.pos}</span>}
            {e.register && <span className="chip bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">{e.register}</span>}
            {e.tags.map((t) => (
              <span key={t} className="chip bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200">
                #{t}
              </span>
            ))}
          </div>
          {e.context && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{e.context}</p>}
          {e.notes && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              <span className="font-semibold">Notes : </span>
              {e.notes}
            </p>
          )}
          <Examples list={exOf(e.id)} />
          <p className="mt-3 text-xs text-slate-400">Ajoutée le {fmtDate(e.createdAt)}</p>
        </section>

        {KINDS.map((k) => {
          const list = e.items.filter((i) => i.kind === k);
          const title = KIND_PLURAL[k][0].toUpperCase() + KIND_PLURAL[k].slice(1);
          return (
            <section key={k} className="card">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">{title}</h3>
                <span className={`chip ${c[k] >= MIN_PER_KIND ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
                  {c[k]}/{MIN_PER_KIND}
                </span>
              </div>
              {list.length === 0 && <p className="mt-2 text-sm text-slate-500">Aucun élément pour le moment.</p>}
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {list.map((i) => (
                  <li key={i.id} className="py-3">
                    <p className="font-semibold">{i.text}</p>
                    <Pron ipa={i.ipa} say={i.text} className="text-sm" />
                    <p className="text-indigo-700 dark:text-indigo-300">{i.translation}</p>
                    <Examples list={exOf(i.id)} />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
