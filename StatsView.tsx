"use client";

import { useMemo } from "react";
import { useCards, useEntries, useLogs } from "@/lib/hooks";
import { isComplete, pronMissing, statusOf } from "@/lib/entry";
import { startedTodayCount } from "@/lib/session";
import { useStore } from "@/lib/store";
import { DAY, dkey, fmtDuration, startOfDay } from "@/lib/util";

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="card !p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-extrabold">{value}</p>
      {sub && <p className="text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function Bars({ data, labels, color }: { data: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...data);
  const w = 300;
  const h = 120;
  const bw = w / data.length;
  return (
    <svg viewBox={`0 0 ${w} ${h + 18}`} className="w-full" role="img" aria-label="Graphique en barres">
      {data.map((v, i) => {
        const bh = (v / max) * h;
        return (
          <g key={i}>
            <rect x={i * bw + 3} y={h - bh} width={bw - 6} height={Math.max(bh, v ? 2 : 0)} rx={3} className={color} />
            {v > 0 && (
              <text x={i * bw + bw / 2} y={h - bh - 3} textAnchor="middle" fontSize={8} className="fill-slate-500">
                {v}
              </text>
            )}
            <text x={i * bw + bw / 2} y={h + 12} textAnchor="middle" fontSize={8} className="fill-slate-400">
              {labels[i]}
            </text>
          </g>
        );
      })}
      <line x1={0} y1={h} x2={w} y2={h} className="stroke-slate-300 dark:stroke-slate-600" />
    </svg>
  );
}

function Line({ data, labels }: { data: (number | null)[]; labels: string[] }) {
  const w = 300;
  const h = 100;
  const step = w / (data.length - 1 || 1);
  const pts = data.map((v, i) => (v === null ? null : { x: i * step, y: h - v * h, v }));
  const path = pts
    .filter((p): p is { x: number; y: number; v: number } => !!p)
    .map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h + 22}`} className="w-full" role="img" aria-label="Taux de réussite par jour">
      {[0, 0.5, 1].map((g) => (
        <g key={g}>
          <line x1={0} y1={h - g * h} x2={w} y2={h - g * h} className="stroke-slate-200 dark:stroke-slate-700" strokeDasharray="3 3" />
          <text x={0} y={h - g * h - 2} fontSize={8} className="fill-slate-400">
            {Math.round(g * 100)}%
          </text>
        </g>
      ))}
      {path && <path d={path} fill="none" strokeWidth={2.5} className="stroke-indigo-500" />}
      {pts.map((p, i) => p && <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-indigo-500" />)}
      {labels.map((l, i) => (i % 2 === 0 ? <text key={i} x={i * step} y={h + 14} textAnchor="middle" fontSize={8} className="fill-slate-400">{l}</text> : null))}
    </svg>
  );
}

export default function StatsView() {
  const entries = useEntries();
  const cards = useCards();
  const logs = useLogs();
  const settings = useStore((s) => s.settings);

  const d = useMemo(() => {
    if (!entries || !cards || !logs) return null;
    const live = new Set(entries.map((e) => e.id));
    const scored = logs.filter((l) => l.scored);
    const ok = scored.filter((l) => l.correct).length;
    const days = new Set(logs.map((l) => dkey(l.ts)));
    let streak = 0;
    let cursor = startOfDay();
    if (!days.has(dkey(cursor))) cursor -= DAY;
    while (days.has(dkey(cursor))) {
      streak++;
      cursor -= DAY;
    }
    const today = startOfDay();
    const labels: string[] = [];
    const counts: number[] = [];
    const rates: (number | null)[] = [];
    for (let i = 13; i >= 0; i--) {
      const s = today - i * DAY;
      const dayLogs = scored.filter((l) => l.ts >= s && l.ts < s + DAY);
      labels.push(String(new Date(s).getDate()));
      counts.push(dayLogs.length);
      rates.push(dayLogs.length ? dayLogs.filter((l) => l.correct).length / dayLogs.length : null);
    }
    // éléments maîtrisés : les deux sens avec un intervalle >= 21 jours
    const byTarget = new Map<string, boolean>();
    for (const c of cards) {
      if (!live.has(c.entryId)) continue;
      const mastered = c.firstAt > 0 && c.interval >= 21;
      byTarget.set(c.targetId, (byTarget.get(c.targetId) ?? true) && mastered);
    }
    const masteredItems = Array.from(byTarget.values()).filter(Boolean).length;
    return {
      total: entries.length,
      incomplete: entries.filter((e) => !isComplete(e)).length,
      noPron: entries.reduce((n, e) => n + pronMissing(e), 0),
      masteredItems,
      masteredEntries: entries.filter((e) => statusOf(e, cards) === "Maîtrisée").length,
      rate: scored.length ? Math.round((ok / scored.length) * 100) : null,
      time: logs.reduce((n, l) => n + l.ms, 0),
      streak,
      labels,
      counts,
      rates,
      reviewsToday: scored.filter((l) => l.ts >= today).length,
      newToday: startedTodayCount(cards),
    };
  }, [entries, cards, logs]);

  if (!d) return <p className="p-6 text-center text-sm text-slate-500">Chargement…</p>;

  return (
    <div className="space-y-4 p-4">
      <section className="card space-y-3">
        <h2 className="font-bold">Objectif du jour</h2>
        {[
          { l: "Nouveaux mots", v: d.newToday, m: settings.newPerDay },
          { l: "Révisions", v: d.reviewsToday, m: settings.reviewsPerDay },
        ].map((g) => (
          <div key={g.l}>
            <div className="flex justify-between text-sm font-semibold">
              <span>{g.l}</span>
              <span>
                {Math.min(g.v, g.m)}/{g.m}
              </span>
            </div>
            <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <div className={`h-full rounded-full transition-all ${g.v >= g.m ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, (g.v / Math.max(1, g.m)) * 100)}%` }} />
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Stat label="Fiches" value={d.total} />
        <Stat label="Incomplètes" value={d.incomplete} />
        <Stat label="Sans prononciation" value={d.noPron} sub="éléments" />
        <Stat label="Maîtrisés" value={d.masteredItems} sub={`éléments · ${d.masteredEntries} fiche${d.masteredEntries > 1 ? "s" : ""}`} />
        <Stat label="Réussite" value={d.rate === null ? "—" : `${d.rate} %`} />
        <Stat label="Temps d'étude" value={fmtDuration(d.time)} />
        <Stat label="Série" value={`${d.streak} j`} sub="jours consécutifs" />
      </div>

      <section className="card">
        <h2 className="mb-2 font-bold">Exercices par jour (14 j)</h2>
        <Bars data={d.counts} labels={d.labels} color="fill-indigo-500" />
      </section>
      <section className="card">
        <h2 className="mb-2 font-bold">Taux de réussite (14 j)</h2>
        <Line data={d.rates} labels={d.labels} />
      </section>
    </div>
  );
}
