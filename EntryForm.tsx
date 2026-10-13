"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import IpaKeyboard, { rememberIpaField } from "./IpaKeyboard";
import { db, saveEntry } from "@/lib/db";
import { KINDS, KIND_LABEL, KIND_PLURAL, POS_LIST, REGISTERS, type Entry, type Kind } from "@/lib/types";
import { MIN_PER_KIND } from "@/lib/entry";
import { norm, uid } from "@/lib/util";
import { useStore } from "@/lib/store";

interface DItem {
  id: string;
  kind: Kind;
  text: string;
  translation: string;
  ipa: string;
}
interface DEx {
  id: string;
  ownerId: string;
  text: string;
  translation: string;
  ipa: string;
}

const blank = (kind: Kind): DItem => ({ id: uid(), kind, text: "", translation: "", ipa: "" });

export default function EntryForm({ id }: { id?: string }) {
  const closeEditor = useStore((s) => s.closeEditor);
  const showToast = useStore((s) => s.showToast);
  const askConfirm = useStore((s) => s.askConfirm);
  const openEntry = useStore((s) => s.openEntry);

  const [loaded, setLoaded] = useState(!id);
  const [base, setBase] = useState<Entry | null>(null);
  const [entryId] = useState(() => id ?? uid());
  const [word, setWord] = useState("");
  const [translation, setTranslation] = useState("");
  const [ipa, setIpa] = useState("");
  const [pos, setPos] = useState("");
  const [register, setRegister] = useState("");
  const [context, setContext] = useState("");
  const [notes, setNotes] = useState("");
  const [tags, setTags] = useState("");
  const [items, setItems] = useState<DItem[]>(() => KINDS.flatMap((k) => [blank(k), blank(k), blank(k)]));
  const [examples, setExamples] = useState<DEx[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [kb, setKb] = useState(false);
  const [saving, setSaving] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    db.entries.get(id).then((e) => {
      if (e) {
        setBase(e);
        setWord(e.word);
        setTranslation(e.translation);
        setIpa(e.ipa);
        setPos(e.pos);
        setRegister(e.register);
        setContext(e.context);
        setNotes(e.notes);
        setTags(e.tags.join(", "));
        const its: DItem[] = e.items.map((i) => ({ id: i.id, kind: i.kind, text: i.text, translation: i.translation, ipa: i.ipa || "" }));
        for (const k of KINDS) {
          let n = its.filter((i) => i.kind === k).length;
          while (n < MIN_PER_KIND) {
            its.push(blank(k));
            n++;
          }
        }
        setItems(its);
        setExamples(e.examples.map((x) => ({ id: x.id, ownerId: x.ownerId, text: x.text, translation: x.translation, ipa: x.ipa || "" })));
      }
      setLoaded(true);
    });
  }, [id]);

  const owners = useMemo(
    () => [{ id: entryId, label: `Le mot : ${word || "…"}` }, ...items.filter((i) => i.text.trim()).map((i) => ({ id: i.id, label: `${KIND_LABEL[i.kind]} : ${i.text}` }))],
    [entryId, word, items]
  );

  const upItem = (iid: string, p: Partial<DItem>) => setItems((l) => l.map((i) => (i.id === iid ? { ...i, ...p } : i)));
  const upEx = (xid: string, p: Partial<DEx>) => setExamples((l) => l.map((x) => (x.id === xid ? { ...x, ...p } : x)));

  function onFocusCapture(e: React.FocusEvent<HTMLDivElement>) {
    const t = e.target as HTMLInputElement;
    if (t.dataset && t.dataset.ipa === "1") {
      rememberIpaField(t);
      setKb(true);
    } else if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT") {
      setKb(false);
    }
  }

  async function save(force = false) {
    const err: Record<string, string> = {};
    if (!word.trim()) err.word = "Le mot est obligatoire.";
    if (!translation.trim()) err.translation = "La traduction française est obligatoire.";
    for (const i of items) {
      const has = i.text.trim() || i.translation.trim() || i.ipa.trim();
      if (has && !i.text.trim()) err[i.id] = "Texte anglais manquant.";
      else if (has && !i.translation.trim()) err[i.id] = "Traduction française obligatoire.";
    }
    for (const x of examples) {
      const has = x.text.trim() || x.translation.trim() || x.ipa.trim();
      if (has && !x.text.trim()) err[x.id] = "Phrase anglaise manquante.";
      else if (has && !x.translation.trim()) err[x.id] = "Traduction française obligatoire.";
    }
    setErrors(err);
    if (Object.keys(err).length) {
      showToast("Corrigez les champs en rouge.");
      setTimeout(() => scroller.current?.querySelector("[data-err='1']")?.scrollIntoView({ block: "center", behavior: "smooth" }), 50);
      return;
    }
    if (!id && !force) {
      const dup = (await db.entries.toArray()).find((e) => norm(e.word) === norm(word));
      if (dup) {
        askConfirm({
          title: "Fiche déjà existante",
          message: `Une fiche « ${dup.word} » existe déjà. Créer quand même une nouvelle fiche ?`,
          okLabel: "Créer quand même",
          onOk: () => save(true),
        });
        return;
      }
    }
    setSaving(true);
    const keptItems = items.filter((i) => i.text.trim());
    const validOwners = new Set([entryId, ...keptItems.map((i) => i.id)]);
    const now = Date.now();
    const entry: Entry = {
      id: entryId,
      word: word.trim(),
      translation: translation.trim(),
      ipa: ipa.trim(),
      pos,
      register,
      context: context.trim(),
      notes: notes.trim(),
      tags: Array.from(new Set(tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean))),
      items: keptItems.map((i) => ({ id: i.id, kind: i.kind, text: i.text.trim(), translation: i.translation.trim(), ipa: i.ipa.trim() })),
      examples: examples
        .filter((x) => x.text.trim())
        .map((x) => ({
          id: x.id,
          ownerId: validOwners.has(x.ownerId) ? x.ownerId : entryId,
          text: x.text.trim(),
          translation: x.translation.trim(),
          ipa: x.ipa.trim(),
        })),
      createdAt: base?.createdAt ?? now,
      updatedAt: now,
    };
    await saveEntry(entry);
    setSaving(false);
    showToast(id ? "Fiche modifiée." : "Fiche enregistrée.");
    closeEditor();
    if (!id) openEntry(entryId);
  }

  function cancel() {
    askConfirm({
      title: "Quitter sans enregistrer ?",
      message: "Les modifications en cours seront perdues.",
      okLabel: "Quitter",
      danger: true,
      onOk: closeEditor,
    });
  }

  const ipaInput = (value: string, onChange: (v: string) => void) => (
    <input
      className="inp font-mono"
      data-ipa="1"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Prononciation (API, américain)"
      autoCapitalize="off"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      aria-label="Prononciation (API, américain)"
    />
  );

  if (!loaded) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-950" onFocusCapture={onFocusCapture}>
      <header className="safe-t flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
        <button className="btn-ghost !px-3" onClick={cancel} aria-label="Fermer">
          <Icon name="x" />
        </button>
        <h1 className="flex-1 text-lg font-bold">{id ? "Modifier la fiche" : "Nouvelle fiche"}</h1>
      </header>

      <div ref={scroller} className="flex-1 space-y-4 overflow-y-auto p-4 pb-6">
        <section className="card space-y-3">
          <div data-err={errors.word ? "1" : "0"}>
            <label className="lbl">Mot (anglais) *</label>
            <input className={`inp ${errors.word ? "inp-err" : ""}`} value={word} onChange={(e) => setWord(e.target.value)} autoFocus={!id} autoCapitalize="off" autoCorrect="off" spellCheck={false} placeholder="ex. reliable" />
            {errors.word && <p className="mt-1 text-xs text-rose-600">{errors.word}</p>}
          </div>
          <div data-err={errors.translation ? "1" : "0"}>
            <label className="lbl">Traduction française *</label>
            <input className={`inp ${errors.translation ? "inp-err" : ""}`} value={translation} onChange={(e) => setTranslation(e.target.value)} placeholder="ex. fiable" />
            {errors.translation && <p className="mt-1 text-xs text-rose-600">{errors.translation}</p>}
          </div>
          <div>
            <label className="lbl">Prononciation (API, américain)</label>
            {ipaInput(ipa, setIpa)}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">Nature</label>
              <select className="inp" value={pos} onChange={(e) => setPos(e.target.value)}>
                <option value="">—</option>
                {POS_LIST.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="lbl">Registre</label>
              <select className="inp" value={register} onChange={(e) => setRegister(e.target.value)}>
                {REGISTERS.map((r) => (
                  <option key={r} value={r}>
                    {r || "—"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="lbl">Contexte d'utilisation</label>
            <textarea className="inp" rows={2} value={context} onChange={(e) => setContext(e.target.value)} placeholder="Situation, nuance… ex. au travail, à l'oral" />
          </div>
          <div>
            <label className="lbl">Étiquettes (séparées par des virgules)</label>
            <input className="inp" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="travail, voyage…" autoCapitalize="off" />
          </div>
          <div>
            <label className="lbl">Notes personnelles</label>
            <textarea className="inp" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </section>

        {KINDS.map((k) => {
          const rows = items.filter((i) => i.kind === k);
          const filled = rows.filter((i) => i.text.trim() && i.translation.trim()).length;
          return (
            <section key={k} className="card space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold">
                  {KIND_PLURAL[k][0].toUpperCase() + KIND_PLURAL[k].slice(1)}
                </h2>
                <span className={`chip ${filled >= MIN_PER_KIND ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200" : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"}`}>
                  {filled}/{MIN_PER_KIND} minimum
                </span>
              </div>
              {rows.map((i) => (
                <div key={i.id} data-err={errors[i.id] ? "1" : "0"} className="space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
                  <div className="flex gap-2">
                    <input className={`inp ${errors[i.id] && !i.text.trim() ? "inp-err" : ""}`} value={i.text} onChange={(e) => upItem(i.id, { text: e.target.value })} placeholder={`${KIND_LABEL[k]} (anglais)`} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
                    <button type="button" className="btn-ghost !px-3 text-rose-600" aria-label="Supprimer cet élément" onClick={() => setItems((l) => l.filter((x) => x.id !== i.id))}>
                      <Icon name="trash" size={18} />
                    </button>
                  </div>
                  <input className={`inp ${errors[i.id] && i.text.trim() && !i.translation.trim() ? "inp-err" : ""}`} value={i.translation} onChange={(e) => upItem(i.id, { translation: e.target.value })} placeholder="Traduction ou sens en français *" />
                  {ipaInput(i.ipa, (v) => upItem(i.id, { ipa: v }))}
                  {errors[i.id] && <p className="text-xs text-rose-600">{errors[i.id]}</p>}
                </div>
              ))}
              <button type="button" className="btn-soft w-full" onClick={() => setItems((l) => [...l, blank(k)])}>
                <Icon name="plus" size={18} /> Ajouter {k === "idiom" ? "une expression" : k === "chunk" ? "un chunk" : "une collocation"}
              </button>
            </section>
          );
        })}

        <section className="card space-y-3">
          <h2 className="font-bold">Phrases d'exemple</h2>
          {examples.map((x) => (
            <div key={x.id} data-err={errors[x.id] ? "1" : "0"} className="space-y-2 rounded-xl border border-slate-200 p-2.5 dark:border-slate-700">
              <div className="flex gap-2">
                <select className="inp" value={owners.some((o) => o.id === x.ownerId) ? x.ownerId : entryId} onChange={(e) => upEx(x.id, { ownerId: e.target.value })} aria-label="Rattachée à">
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <button type="button" className="btn-ghost !px-3 text-rose-600" aria-label="Supprimer cette phrase" onClick={() => setExamples((l) => l.filter((y) => y.id !== x.id))}>
                  <Icon name="trash" size={18} />
                </button>
              </div>
              <textarea className={`inp ${errors[x.id] && !x.text.trim() ? "inp-err" : ""}`} rows={2} value={x.text} onChange={(e) => upEx(x.id, { text: e.target.value })} placeholder="Phrase en anglais" autoCapitalize="sentences" />
              <textarea className={`inp ${errors[x.id] && x.text.trim() && !x.translation.trim() ? "inp-err" : ""}`} rows={2} value={x.translation} onChange={(e) => upEx(x.id, { translation: e.target.value })} placeholder="Traduction française *" />
              {ipaInput(x.ipa, (v) => upEx(x.id, { ipa: v }))}
              {errors[x.id] && <p className="text-xs text-rose-600">{errors[x.id]}</p>}
            </div>
          ))}
          <button type="button" className="btn-soft w-full" onClick={() => setExamples((l) => [...l, { id: uid(), ownerId: entryId, text: "", translation: "", ipa: "" }])}>
            <Icon name="plus" size={18} /> Ajouter une phrase d'exemple
          </button>
        </section>
      </div>

      <div className="safe-b border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        {kb && <IpaKeyboard onClose={() => setKb(false)} />}
        <div className="flex gap-3 p-3">
          <button className="btn-ghost flex-1" onClick={cancel}>
            Annuler
          </button>
          <button className="btn-primary flex-[2]" onClick={() => save()} disabled={saving}>
            <Icon name="check" size={18} /> Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
