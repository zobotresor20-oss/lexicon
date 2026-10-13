"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { Chunks, Cloze, Colloc, Dictee, Flash, Match, Mini, Prod, Qcm, Recall } from "./Exercises";
import { db } from "@/lib/db";
import { useCards, useEntries, useLogs } from "@/lib/hooks";
import { reviewCard } from "@/lib/srs";
import { MODES, buildSession, dueToday, startedTodayCount, type Mode, type Q, type Result, type Scope, type SessionConfig } from "@/lib/session";
import { useStore } from "@/lib/store";
import { fmtDuration, startOfDay } from "@/lib/util";

interface Tally {
  total: number;
  ok: number;
  ms: number;
  wrong: Q[];
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, Math.round((value / Math.max(1, max)) * 100));
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold">
        <span>{label}</span>
        <span>
          {value}/{max}
        </span>
      </div>
      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className={`h-full rounded-full transition-all ${value >= max ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function StudyView() {
  const entries = useEntries();
  const cards = useCards();
  const logs = useLogs();
  const settings = useStore((s) => s.settings);
  const [cfg, setCfg] = useState<SessionConfig>({ mode: "flash", scope: "due", tag: "", count: 10, dir: "mixed", hidePron: settings.hidePron });
  const [qs, setQs] = useState<Q[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [tally, setTally] = useState<Tally>({ total: 0, ok: 0, ms: 0, wrong: [] });
  const [msg, setMsg] = useState("");
  const startRef = useRef(Date.now());
  const answered = useRef(false);
  const cardsRef = useRef(cards);
  cardsRef.current = cards;

  useEffect(() => {
    startRef.current = Date.now();
    answered.current = false;
  }, [idx, qs]);

  const tags = useMemo(() => Array.from(new Set((entries ?? []).flatMap((e) => e.tags))).sort(), [entries]);
  const due = useMemo(() => (entries && cards ? dueToday(entries, cards, settings) : null), [entries, cards, settings]);

  if (!entries || !cards || !logs || !due) return <p className="p-6 text-center text-sm text-slate-500">Chargement…</p>;

  const s0 = startOfDay();
  const reviewsToday = logs.filter((l) => l.ts >= s0 && l.scored).length;
  const newWordsToday = startedTodayCount(cards);

  function start(c: SessionConfig) {
    const out = buildSession(c, entries!, cards!, settings);
    if (out.error || !out.qs.length) {
      setMsg(out.error ?? "Rien à travailler.");
      return;
    }
    setMsg("");
    setCfg(c);
    setTally({ total: 0, ok: 0, ms: 0, wrong: [] });
    setIdx(0);
    setQs(out.qs);
  }

  async function record(q: Q, r: Result) {
    if (answered.current) return;
    answered.current = true;
    const ms = Math.min(Date.now() - startRef.current, 5 * 60000);
    const scored = q.mode !== "prod" && q.mode !== "mini";
    const now = Date.now();
    const updates: { cardKey: string; entryId: string; correct: boolean; grade: number }[] = [];
    if (r.extra) for (const x of r.extra) updates.push({ cardKey: x.cardKey, entryId: x.entryId, correct: x.correct, grade: x.correct ? 4 : 1 });
    else if (q.cardKey) updates.push({ cardKey: q.cardKey, entryId: q.entryId, correct: r.correct, grade: r.q ?? (r.correct ? 4 : 1) });

    await db.transaction("rw", db.cards, db.logs, async () => {
      if (!updates.length) {
        await db.logs.add({ ts: now, entryId: q.entryId, cardKey: q.cardKey ?? "", correct: r.correct, isNew: false, ms, mode: q.mode, scored });
        return;
      }
      for (const u of updates) {
        const c = await db.cards.get(u.cardKey);
        const isNew = !!c && c.firstAt === 0;
        if (c) await db.cards.put(reviewCard(c, u.grade, now));
        await db.logs.add({ ts: now, entryId: u.entryId, cardKey: u.cardKey, correct: u.correct, isNew, ms: Math.round(ms / updates.length), mode: q.mode, scored });
      }
    });
    setTally((t) => ({ total: t.total + 1, ok: t.ok + (r.correct ? 1 : 0), ms: t.ms + ms, wrong: r.correct ? t.wrong : [...t.wrong, q] }));
  }

  /* ---------- Session en cours ---------- */
  if (qs) {
    const finished = idx >= qs.length;
    if (finished) {
      return (
        <div className="space-y-4 p-4">
          <div className="card anim-pop text-center">
            <p className="text-5xl">{tally.total && tally.ok / tally.total >= 0.7 ? "🎉" : "💪"}</p>
            <h2 className="mt-2 text-2xl font-extrabold">Session terminée</h2>
            <p className="mt-1 text-slate-600 dark:text-slate-300">
              {tally.ok}/{tally.total} réussies · {fmtDuration(tally.ms)}
            </p>
          </div>
          {tally.wrong.length > 0 && (
            <div className="card">
              <h3 className="font-bold">À revoir</h3>
              <p className="text-sm text-slate-500">Ces éléments reviendront plus souvent.</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button className="btn-ghost" onClick={() => setQs(null)}>
              Retour
            </button>
            <button className="btn-primary" onClick={() => start(cfg)}>
              Refaire une session
            </button>
          </div>
        </div>
      );
    }
    const q = qs[idx];
    const next = () => setIdx((i) => i + 1);
    const common = { hidePron: cfg.hidePron, onResult: (r: Result) => void record(q, r), onNext: next };
    return (
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-3">
          <button className="btn-ghost !px-3" onClick={() => setQs(null)} aria-label="Arrêter la session">
            <Icon name="x" />
          </button>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(idx / qs.length) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold tabular-nums">
            {idx + 1}/{qs.length}
          </span>
        </div>
        <div key={`${idx}-${q.mode}`} className="anim-up">
          {q.mode === "flash" && <Flash q={q} {...common} />}
          {q.mode === "recall" && <Recall q={q} {...common} />}
          {q.mode === "cloze" && <Cloze q={q} {...common} />}
          {q.mode === "colloc" && <Colloc q={q} {...common} />}
          {q.mode === "chunks" && <Chunks q={q} {...common} />}
          {q.mode === "qcm" && <Qcm q={q} {...common} />}
          {q.mode === "match" && <Match q={q} {...common} />}
          {q.mode === "dictee" && <Dictee q={q} {...common} />}
          {q.mode === "prod" && <Prod q={q} {...common} />}
          {q.mode === "mini" && <Mini q={q} {...common} />}
        </div>
      </div>
    );
  }

  /* ---------- Menu ---------- */
  const set = <K extends keyof SessionConfig>(k: K, v: SessionConfig[K]) => setCfg((c) => ({ ...c, [k]: v }));

  return (
    <div className="space-y-4 p-4">
      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">À réviser aujourd'hui</h2>
          <span className="chip bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200">{due.cards.length} cartes</span>
        </div>
        <p className="text-sm text-slate-500">
          {due.reviewed} révision{due.reviewed > 1 ? "s" : ""} due{due.reviewed > 1 ? "s" : ""} · {due.fresh} nouvelle{due.fresh > 1 ? "s" : ""} carte{due.fresh > 1 ? "s" : ""}
        </p>
        <Bar label="Nouveaux mots du jour" value={Math.min(newWordsToday, settings.newPerDay)} max={settings.newPerDay} />
        <Bar label="Révisions du jour" value={Math.min(reviewsToday, settings.reviewsPerDay)} max={settings.reviewsPerDay} />
        <button className="btn-primary w-full" disabled={!due.cards.length} onClick={() => start({ ...cfg, mode: "flash", scope: "due", count: Math.max(5, Math.min(due.cards.length, 30)), dir: "mixed" })}>
          <Icon name="zap" size={18} /> {due.cards.length ? "Commencer la révision du jour" : "Rien à réviser pour le moment"}
        </button>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">Session personnalisée</h2>
        <div className="grid grid-cols-2 gap-2">
          {MODES.map((m) => (
            <button key={m.id} onClick={() => set("mode", m.id as Mode)} className={`rounded-xl border p-3 text-left transition ${cfg.mode === m.id ? "border-indigo-600 bg-indigo-50 ring-2 ring-indigo-300 dark:bg-indigo-950 dark:ring-indigo-800" : "border-slate-200 dark:border-slate-700"}`}>
              <span className="text-xl">{m.emoji}</span>
              <p className="text-sm font-bold">{m.label}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{m.desc}</p>
            </button>
          ))}
        </div>
        {cfg.mode !== "mini" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="lbl">Fiches concernées</label>
              <select className="inp" value={cfg.scope} onChange={(e) => set("scope", e.target.value as Scope)}>
                <option value="due">À réviser aujourd'hui</option>
                <option value="errors">Mes erreurs</option>
                <option value="all">Toutes les fiches</option>
                {tags.length > 0 && <option value="tag">Une étiquette…</option>}
              </select>
            </div>
            <div>
              <label className="lbl">Nombre de questions</label>
              <select className="inp" value={cfg.count} onChange={(e) => set("count", Number(e.target.value))}>
                {[5, 10, 15, 20, 30, 50].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            {cfg.scope === "tag" && (
              <div className="col-span-2">
                <label className="lbl">Étiquette</label>
                <select className="inp" value={cfg.tag} onChange={(e) => set("tag", e.target.value)}>
                  <option value="">Choisir…</option>
                  {tags.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}
            {cfg.mode === "flash" && (
              <div className="col-span-2">
                <label className="lbl">Sens</label>
                <select className="inp" value={cfg.dir} onChange={(e) => set("dir", e.target.value as SessionConfig["dir"])}>
                  <option value="mixed">Les deux sens</option>
                  <option value="en-fr">Anglais → français</option>
                  <option value="fr-en">Français → anglais</option>
                </select>
              </div>
            )}
          </div>
        )}
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="h-5 w-5" checked={cfg.hidePron} onChange={(e) => set("hidePron", e.target.checked)} />
          Masquer la prononciation pendant les exercices
        </label>
        {msg && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">{msg}</p>}
        <button className="btn-primary w-full" disabled={cfg.scope === "tag" && !cfg.tag && cfg.mode !== "mini"} onClick={() => start(cfg)}>
          Démarrer la session
        </button>
      </section>
    </div>
  );
}
