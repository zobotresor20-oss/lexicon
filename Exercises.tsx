"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import Pron from "./Pron";
import { db, getKv, setKv } from "@/lib/db";
import type { Q, Result } from "@/lib/session";
import { KIND_LABEL, type Example } from "@/lib/types";
import { speak, canSpeak } from "@/lib/speech";
import { useStore } from "@/lib/store";
import { checkAnswer, diffSegs, dkey, hintText, lev, norm, shuffle, uid, type Check } from "@/lib/util";

export interface ExProps<T extends Q = Q> {
  q: T;
  hidePron: boolean;
  onResult: (r: Result) => void;
  onNext: () => void;
}

function Segs({ segs, bad }: { segs: { c: string; ok: boolean }[]; bad: string }) {
  return (
    <span className="font-mono text-base break-words">
      {segs.map((s, i) => (
        <span key={i} className={s.ok ? "" : `${bad} font-bold underline`}>
          {s.c}
        </span>
      ))}
    </span>
  );
}

/* ---------- Réponse saisie (texte à trous, collocations, dictée) ---------- */
function Typed({
  prompt,
  answer,
  placeholder,
  onResult,
  onNext,
  after,
}: {
  prompt: React.ReactNode;
  answer: string;
  placeholder: string;
  onResult: (r: Result) => void;
  onNext: () => void;
  after?: React.ReactNode;
}) {
  const [val, setVal] = useState("");
  const [hint, setHint] = useState(0);
  const [res, setRes] = useState<Check | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);

  function check() {
    if (res) return;
    const r = checkAnswer(val, answer);
    setRes(r);
    onResult({ correct: r.ok, q: r.ok ? (hint > 0 ? 3 : r.near ? 4 : 5) : 1, hinted: hint > 0 });
  }
  function giveUp() {
    if (res) return;
    setGaveUp(true);
    setRes({ ok: false, near: false, best: answer });
    onResult({ correct: false, q: 0 });
  }

  const d = res && !res.ok ? diffSegs(val, res.best) : null;

  return (
    <div className="space-y-4">
      {prompt}
      {!res && (
        <>
          {hint > 0 && <p className="font-mono text-lg tracking-widest text-indigo-700 dark:text-indigo-300">{hintText(answer, hint)}</p>}
          <input
            ref={ref}
            className="inp"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && check()}
            placeholder={placeholder}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
          />
          <div className="grid grid-cols-3 gap-2">
            <button className="btn-ghost" onClick={() => setHint((h) => Math.min(h + 1, answer.length))}>
              Indice{hint ? ` (${hint})` : ""}
            </button>
            <button className="btn-ghost" onClick={giveUp}>
              Je ne sais pas
            </button>
            <button className="btn-primary" onClick={check}>
              Vérifier
            </button>
          </div>
        </>
      )}
      {res && (
        <div className={`anim-pop rounded-2xl p-4 ${res.ok ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" : "anim-shake bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100"}`}>
          <p className="font-bold">{res.ok ? (res.near ? "Presque ! Attention à l'orthographe." : "Correct !") : gaveUp ? "Voici la réponse :" : "Pas tout à fait."}</p>
          {res.ok && res.near && (
            <p className="mt-1">
              Réponse exacte : <span className="font-mono font-bold">{res.best}</span>
            </p>
          )}
          {!res.ok && (
            <div className="mt-2 space-y-1 text-sm">
              <p>
                Réponse : <span className="font-mono font-bold">{res.best}</span>
              </p>
              {d && val.trim() && (
                <>
                  <p>
                    Votre saisie : <Segs segs={d.typed} bad="text-rose-700 dark:text-rose-300" />
                  </p>
                  <p>
                    Attendu : <Segs segs={d.expected} bad="text-emerald-700 dark:text-emerald-300" />
                  </p>
                </>
              )}
            </div>
          )}
          {hint > 0 && res.ok && <p className="mt-1 text-xs">Indice utilisé : le fait de la progression est un peu réduit.</p>}
          {after}
          <button className="btn-primary mt-4 w-full" onClick={onNext} autoFocus>
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Flashcards ---------- */
export function Flash({ q, hidePron, onResult, onNext }: ExProps<Extract<Q, { mode: "flash" }>>) {
  const [flipped, setFlipped] = useState(false);
  const enFront = q.dir === "en-fr";
  return (
    <div className="space-y-4">
      <div role="button" tabIndex={0} onClick={() => setFlipped(true)} onKeyDown={(e) => e.key === "Enter" && setFlipped(true)} className="card anim-pop flex min-h-64 cursor-pointer flex-col items-center justify-center gap-3 text-center">
        <span className="chip bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
          {q.label} · {enFront ? "anglais → français" : "français → anglais"}
        </span>
        <p className="text-3xl font-extrabold">{q.front}</p>
        {enFront && (
          <div onClick={(e) => e.stopPropagation()}>
            <Pron ipa={q.frontIpa} say={q.speakText} hidden={hidePron} />
          </div>
        )}
        {flipped ? (
          <div className="anim-pop mt-2 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-300">{q.back}</p>
            {!enFront && (
              <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                <Pron ipa={q.backIpa} say={q.speakText} hidden={hidePron} />
              </div>
            )}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-400">Touchez la carte pour voir la réponse</p>
        )}
      </div>
      {flipped ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-danger"
            onClick={() => {
              onResult({ correct: false, q: 1 });
              onNext();
            }}
          >
            <Icon name="x" size={18} /> Je ne le savais pas
          </button>
          <button
            className="btn-ok"
            onClick={() => {
              onResult({ correct: true, q: 4 });
              onNext();
            }}
          >
            <Icon name="check" size={18} /> Je le savais
          </button>
        </div>
      ) : (
        <button className="btn-primary w-full" onClick={() => setFlipped(true)}>
          Afficher la réponse
        </button>
      )}
    </div>
  );
}

/* ---------- Rappel libre ---------- */
export function Recall({ q, hidePron, onResult, onNext }: ExProps<Extract<Q, { mode: "recall" }>>) {
  const [txt, setTxt] = useState({ chunk: "", collocation: "", idiom: "" });
  const [done, setDone] = useState(false);
  const lines = (s: string) => s.split("\n").map((l) => l.trim()).filter(Boolean);
  const typedAll = useMemo(() => [...lines(txt.chunk), ...lines(txt.collocation), ...lines(txt.idiom)].map(norm), [txt]);
  const hit = (t: string) => {
    const n = norm(t);
    return typedAll.some((x) => x === n || (n.length > 5 && lev(x, n) <= 2));
  };
  const found = q.items.filter((i) => hit(i.text)).length;
  const ratio = q.items.length ? found / q.items.length : 0;

  return (
    <div className="space-y-4">
      <div className="card text-center">
        <p className="text-xs font-semibold uppercase text-slate-500">Rappel libre</p>
        <p className="mt-1 text-3xl font-extrabold">{q.word}</p>
        <Pron ipa={q.ipa} say={q.word} hidden={hidePron} />
        <p className="text-indigo-700 dark:text-indigo-300">{q.translation}</p>
      </div>
      {!done ? (
        <>
          <p className="text-sm text-slate-500">Écrivez de mémoire, un élément par ligne.</p>
          {(["chunk", "collocation", "idiom"] as const).map((k) => (
            <div key={k}>
              <label className="lbl">{k === "chunk" ? "Chunks" : k === "collocation" ? "Collocations" : "Expressions"}</label>
              <textarea className="inp" rows={3} value={txt[k]} onChange={(e) => setTxt({ ...txt, [k]: e.target.value })} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
            </div>
          ))}
          <button className="btn-primary w-full" onClick={() => setDone(true)}>
            Comparer avec ma fiche
          </button>
        </>
      ) : (
        <div className="anim-pop space-y-3">
          <p className="font-semibold">
            Retrouvés : {found}/{q.items.length}
          </p>
          <ul className="space-y-2">
            {q.items.map((i, k) => {
              const ok = hit(i.text);
              return (
                <li key={k} className={`rounded-xl p-3 text-sm ${ok ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" : "bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100"}`}>
                  <span className="text-xs font-semibold uppercase opacity-70">{KIND_LABEL[i.kind]}</span>
                  <p className="font-semibold">{i.text}</p>
                  <p className="opacity-80">{i.translation}</p>
                </li>
              );
            })}
          </ul>
          <p className="text-sm text-slate-500">Vous le saviez ?{ratio >= 0.6 ? " Beau score !" : ""}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="btn-danger"
              onClick={() => {
                onResult({ correct: false, q: 1 });
                onNext();
              }}
            >
              Je ne le savais pas
            </button>
            <button
              className="btn-ok"
              onClick={() => {
                onResult({ correct: true, q: 4 });
                onNext();
              }}
            >
              Je le savais
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Texte à trous ---------- */
export function Cloze({ q, onResult, onNext }: ExProps<Extract<Q, { mode: "cloze" }>>) {
  return (
    <Typed
      answer={q.answer}
      placeholder="Mot manquant"
      onResult={onResult}
      onNext={onNext}
      prompt={
        <div className="card space-y-2">
          <p className="text-xs font-semibold uppercase text-slate-500">Texte à trous</p>
          <p className="text-xl leading-relaxed">
            {q.before}
            <span className="mx-1 inline-block min-w-16 border-b-2 border-indigo-500 text-center">&nbsp;&nbsp;&nbsp;</span>
            {q.after}
          </p>
          <p className="text-indigo-700 dark:text-indigo-300">{q.translation}</p>
        </div>
      }
      after={<p className="mt-2 text-sm">{q.full}</p>}
    />
  );
}

/* ---------- Collocation à compléter ---------- */
export function Colloc({ q, onResult, onNext }: ExProps<Extract<Q, { mode: "colloc" }>>) {
  return (
    <Typed
      answer={q.answer}
      placeholder="Mot manquant"
      onResult={onResult}
      onNext={onNext}
      prompt={
        <div className="card space-y-2 text-center">
          <p className="text-xs font-semibold uppercase text-slate-500">Complétez la collocation</p>
          <p className="text-3xl font-extrabold">{q.shown}</p>
          <p className="text-indigo-700 dark:text-indigo-300">{q.translation}</p>
        </div>
      }
      after={<p className="mt-2 text-sm font-semibold">{q.full}</p>}
    />
  );
}

/* ---------- Dictée ---------- */
export function Dictee({ q, onResult, onNext }: ExProps<Extract<Q, { mode: "dictee" }>>) {
  const rate = useStore((s) => s.settings.speechRate);
  const [can, setCan] = useState(true);
  useEffect(() => {
    setCan(canSpeak());
    const t = setTimeout(() => speak(q.text, rate), 300);
    return () => clearTimeout(t);
  }, [q.text, rate]);
  if (!can) {
    return (
      <div className="card text-center">
        <p>La synthèse vocale n'est pas disponible sur cet appareil ou ce navigateur.</p>
        <button className="btn-primary mt-3" onClick={onNext}>
          Passer
        </button>
      </div>
    );
  }
  return (
    <Typed
      answer={q.text}
      placeholder="Écrivez ce que vous entendez"
      onResult={onResult}
      onNext={onNext}
      prompt={
        <div className="card flex flex-col items-center gap-3 text-center">
          <p className="text-xs font-semibold uppercase text-slate-500">Dictée</p>
          <button className="btn-primary !min-h-16 !px-8 text-lg" onClick={() => speak(q.text, rate)}>
            <Icon name="volume" size={24} /> Écouter
          </button>
          <button className="text-sm font-semibold text-indigo-600 dark:text-indigo-300" onClick={() => speak(q.text, Math.max(0.4, rate - 0.4))}>
            Écouter plus lentement
          </button>
        </div>
      }
      after={
        <div className="mt-2 text-sm">
          <p className="text-indigo-800 dark:text-indigo-200">{q.translation}</p>
          <Pron ipa={q.ipa} say={q.text} />
        </div>
      }
    />
  );
}

/* ---------- Chunks mélangés ---------- */
export function Chunks({ q, onResult, onNext }: ExProps<Extract<Q, { mode: "chunks" }>>) {
  const [picked, setPicked] = useState<number[]>([]);
  const [res, setRes] = useState<null | boolean>(null);
  const sentence = picked.map((i) => q.tokens[i]).join(" ");
  function verify() {
    const ok = norm(sentence) === norm(q.answer);
    setRes(ok);
    onResult({ correct: ok, q: ok ? 5 : 1 });
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-2 text-center">
        <p className="text-xs font-semibold uppercase text-slate-500">Remettez les mots dans l'ordre</p>
        <p className="text-indigo-700 dark:text-indigo-300">{q.translation}</p>
      </div>
      <div className="card min-h-20 flex flex-wrap gap-2">
        {picked.length === 0 && <span className="text-sm text-slate-400">Touchez les mots ci-dessous…</span>}
        {picked.map((i, k) => (
          <button key={k} disabled={res !== null} className="btn-soft !min-h-10 !px-3 text-base" onClick={() => setPicked(picked.filter((_, x) => x !== k))}>
            {q.tokens[i]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {q.tokens.map((t, i) => (
          <button key={i} disabled={picked.includes(i) || res !== null} className="btn-ghost !min-h-10 !px-3 text-base disabled:opacity-30" onClick={() => setPicked([...picked, i])}>
            {t}
          </button>
        ))}
      </div>
      {res === null ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-ghost"
            onClick={() => {
              setRes(false);
              onResult({ correct: false, q: 0 });
            }}
          >
            Je ne sais pas
          </button>
          <button className="btn-primary" disabled={picked.length !== q.tokens.length} onClick={verify}>
            Vérifier
          </button>
        </div>
      ) : (
        <div className={`anim-pop rounded-2xl p-4 ${res ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" : "anim-shake bg-rose-100 text-rose-900 dark:bg-rose-900/40 dark:text-rose-100"}`}>
          <p className="font-bold">{res ? "Correct !" : "Pas tout à fait."}</p>
          <p className="mt-1 font-mono">{q.answer}</p>
          <button className="btn-primary mt-4 w-full" onClick={onNext}>
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- QCM ---------- */
export function Qcm({ q, hidePron, onResult, onNext }: ExProps<Extract<Q, { mode: "qcm" }>>) {
  const [sel, setSel] = useState<string | null>(null);
  function pick(o: string) {
    if (sel !== null) return;
    setSel(o);
    onResult({ correct: o === q.answer, q: o === q.answer ? 4 : 1 });
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-center">
        <p className="text-xs font-semibold uppercase text-slate-500">Que signifie cette expression ?</p>
        <p className="text-2xl font-extrabold">{q.prompt}</p>
        <Pron ipa={q.ipa} say={q.prompt} hidden={hidePron} />
      </div>
      <div className="space-y-2">
        {q.options.map((o) => {
          const state = sel === null ? "" : o === q.answer ? "!bg-emerald-600 !text-white !border-emerald-600" : o === sel ? "!bg-rose-600 !text-white !border-rose-600 anim-shake" : "opacity-50";
          return (
            <button key={o} className={`btn-ghost w-full !justify-start !py-3 text-left ${state}`} onClick={() => pick(o)}>
              {o}
            </button>
          );
        })}
      </div>
      {sel !== null && (
        <button className="btn-primary w-full" onClick={onNext}>
          Suivant
        </button>
      )}
    </div>
  );
}

/* ---------- Association mot ↔ traduction ---------- */
export function Match({ q, onResult, onNext }: ExProps<Extract<Q, { mode: "match" }>>) {
  const right = useMemo(() => shuffle(q.pairs.map((p, i) => ({ i, fr: p.fr }))), [q]);
  const [left, setLeft] = useState<number | null>(null);
  const [okSet, setOkSet] = useState<number[]>([]);
  const [wrongSet, setWrongSet] = useState<number[]>([]);
  const [flash, setFlash] = useState<number | null>(null);
  const finished = okSet.length === q.pairs.length;

  function pickRight(i: number) {
    if (left === null || okSet.includes(i)) return;
    if (i === left) {
      const next = [...okSet, i];
      setOkSet(next);
      setLeft(null);
      if (next.length === q.pairs.length) {
        const bad = new Set(wrongSet);
        onResult({
          correct: bad.size <= 1,
          q: bad.size === 0 ? 5 : bad.size <= 1 ? 4 : 2,
          extra: q.pairs.map((p, k) => ({ cardKey: p.cardKey, entryId: p.entryId, correct: !bad.has(k) })),
        });
      }
    } else {
      setWrongSet((w) => (w.includes(left) ? w : [...w, left]));
      setFlash(i);
      setTimeout(() => setFlash(null), 350);
      setLeft(null);
    }
  }
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-slate-500">Touchez un mot anglais, puis sa traduction.</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          {q.pairs.map((p, i) => (
            <button key={i} disabled={okSet.includes(i)} onClick={() => setLeft(i)} className={`btn-ghost w-full !py-3 ${okSet.includes(i) ? "!bg-emerald-600 !text-white !border-emerald-600" : left === i ? "!border-indigo-600 !ring-2 !ring-indigo-300" : ""}`}>
              {p.en}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {right.map((r) => (
            <button key={r.i} disabled={okSet.includes(r.i)} onClick={() => pickRight(r.i)} className={`btn-ghost w-full !py-3 text-sm ${okSet.includes(r.i) ? "!bg-emerald-600 !text-white !border-emerald-600" : flash === r.i ? "!bg-rose-600 !text-white anim-shake" : ""}`}>
              {r.fr}
            </button>
          ))}
        </div>
      </div>
      {finished && (
        <div className="anim-pop space-y-2">
          <p className="text-center font-semibold">
            {wrongSet.length === 0 ? "Sans faute !" : `${wrongSet.length} erreur${wrongSet.length > 1 ? "s" : ""}`}
          </p>
          <button className="btn-primary w-full" onClick={onNext}>
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Production personnelle ---------- */
export function Prod({ q, onResult, onNext }: ExProps<Extract<Q, { mode: "prod" }>>) {
  const showToast = useStore((s) => s.showToast);
  const [en, setEn] = useState("");
  const [fr, setFr] = useState("");
  const [err, setErr] = useState("");
  async function save() {
    if (!en.trim()) return setErr("Écrivez d'abord votre phrase.");
    if (!fr.trim()) return setErr("La traduction française est obligatoire pour sauvegarder.");
    const e = await db.entries.get(q.entryId);
    if (!e) return onNext();
    const ex: Example = { id: uid(), ownerId: q.targetId, text: en.trim(), translation: fr.trim(), ipa: "" };
    await db.entries.put({ ...e, examples: [...e.examples, ex], updatedAt: Date.now() });
    showToast("Phrase ajoutée comme exemple.");
    onResult({ correct: true });
    onNext();
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-1 text-center">
        <p className="text-xs font-semibold uppercase text-slate-500">Production personnelle</p>
        <p className="text-2xl font-extrabold">{q.text}</p>
        <p className="text-indigo-700 dark:text-indigo-300">{q.translation}</p>
      </div>
      <textarea className="inp" rows={3} value={en} onChange={(e) => setEn(e.target.value)} placeholder="Votre phrase en anglais, avec cet élément" autoCapitalize="sentences" />
      <textarea className="inp" rows={2} value={fr} onChange={(e) => setFr(e.target.value)} placeholder="Sa traduction en français" />
      {err && <p className="text-sm text-rose-600">{err}</p>}
      <div className="grid grid-cols-2 gap-3">
        <button
          className="btn-ghost"
          onClick={() => {
            onResult({ correct: true });
            onNext();
          }}
        >
          Passer
        </button>
        <button className="btn-primary" onClick={save}>
          Sauvegarder comme exemple
        </button>
      </div>
    </div>
  );
}

/* ---------- Mini-texte du jour ---------- */
export function Mini({ q, hidePron, onResult, onNext }: ExProps<Extract<Q, { mode: "mini" }>>) {
  const showToast = useStore((s) => s.showToast);
  const [txt, setTxt] = useState("");
  const [show, setShow] = useState(false);
  async function save() {
    if (!txt.trim()) return onNext();
    const key = "minitexts";
    const list = await getKv<{ date: string; words: string[]; text: string }[]>(key, []);
    await setKv(key, [{ date: dkey(Date.now()), words: q.words.map((w) => w.word), text: txt.trim() }, ...list].slice(0, 60));
    showToast("Mini-texte enregistré.");
    onResult({ correct: true });
    onNext();
  }
  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <p className="text-xs font-semibold uppercase text-slate-500">Mini-texte du jour</p>
        <p className="text-sm text-slate-500">Écrivez quelques phrases en anglais qui utilisent tous ces mots.</p>
        <ul className="space-y-2">
          {q.words.map((w) => (
            <li key={w.id}>
              <span className="text-xl font-bold">{w.word}</span>
              {show && <span className="ml-2 text-indigo-700 dark:text-indigo-300">{w.translation}</span>}
              <div>
                <Pron ipa={w.ipa} say={w.word} hidden={hidePron} className="text-sm" />
              </div>
            </li>
          ))}
        </ul>
        <button className="text-sm font-semibold text-indigo-600 dark:text-indigo-300" onClick={() => setShow((s) => !s)}>
          {show ? "Masquer" : "Afficher"} les traductions
        </button>
      </div>
      <textarea className="inp" rows={6} value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Votre mini-texte…" autoCapitalize="sentences" />
      <button className="btn-primary w-full" onClick={save}>
        Enregistrer et terminer
      </button>
    </div>
  );
}
