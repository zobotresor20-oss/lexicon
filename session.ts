import type { Card, Dir, Entry, Kind } from "./types";
import { KIND_LABEL } from "./types";
import { findTarget, targetsOf, type Target } from "./entry";
import type { Settings } from "./store";
import { DAY, endOfDay, escapeRegExp, norm, shuffle, startOfDay, weightedShuffle } from "./util";

export type Mode = "flash" | "recall" | "cloze" | "colloc" | "chunks" | "qcm" | "match" | "dictee" | "prod" | "mini";
export type Scope = "due" | "errors" | "all" | "tag";

export interface SessionConfig {
  mode: Mode;
  scope: Scope;
  tag: string;
  count: number;
  dir: "mixed" | Dir;
  hidePron: boolean;
}

export const MODES: { id: Mode; label: string; desc: string; emoji: string }[] = [
  { id: "flash", label: "Flashcards", desc: "Anglais ↔ français, mots et éléments", emoji: "🃏" },
  { id: "recall", label: "Rappel libre", desc: "Écrire de mémoire chunks, collocations, expressions", emoji: "🧠" },
  { id: "cloze", label: "Texte à trous", desc: "À partir de vos phrases d'exemple", emoji: "✏️" },
  { id: "colloc", label: "Collocations", desc: "Retrouver le mot manquant", emoji: "🔗" },
  { id: "chunks", label: "Chunks mélangés", desc: "Remettre les mots dans l'ordre", emoji: "🔀" },
  { id: "qcm", label: "QCM expressions", desc: "Choisir le bon sens", emoji: "✅" },
  { id: "match", label: "Association", desc: "Relier mots et traductions", emoji: "🧩" },
  { id: "dictee", label: "Dictée", desc: "Écouter puis écrire", emoji: "🎧" },
  { id: "prod", label: "Production", desc: "Écrire votre propre phrase", emoji: "💬" },
  { id: "mini", label: "Mini-texte du jour", desc: "3 à 5 mots tirés au hasard", emoji: "📝" },
];

export interface Base {
  entryId: string;
  cardKey: string | null;
}
export type Q =
  | (Base & { mode: "flash"; dir: Dir; front: string; back: string; frontIpa: string; backIpa: string; label: string; speakText: string })
  | (Base & { mode: "recall"; word: string; translation: string; ipa: string; items: { kind: Kind; text: string; translation: string }[] })
  | (Base & { mode: "cloze"; before: string; after: string; answer: string; translation: string; full: string })
  | (Base & { mode: "colloc"; shown: string; answer: string; translation: string; full: string })
  | (Base & { mode: "chunks"; tokens: string[]; answer: string; translation: string })
  | (Base & { mode: "qcm"; prompt: string; ipa: string; options: string[]; answer: string })
  | (Base & { mode: "match"; pairs: { cardKey: string; entryId: string; en: string; fr: string }[] })
  | (Base & { mode: "dictee"; text: string; translation: string; ipa: string })
  | (Base & { mode: "prod"; targetId: string; text: string; translation: string; ipa: string })
  | (Base & { mode: "mini"; words: { id: string; word: string; translation: string; ipa: string }[] });

export interface Result {
  correct: boolean;
  q?: number;
  hinted?: boolean;
  extra?: { cardKey: string; entryId: string; correct: boolean }[];
}

export interface DueInfo {
  cards: Card[];
  reviewed: number;
  fresh: number;
}

export function startedTodayCount(cards: Card[], now = Date.now()): number {
  const s = startOfDay(now);
  const byEntry = new Map<string, number>();
  for (const c of cards) {
    if (c.firstAt > 0) byEntry.set(c.entryId, Math.min(byEntry.get(c.entryId) ?? Infinity, c.firstAt));
  }
  let n = 0;
  for (const v of byEntry.values()) if (v >= s) n++;
  return n;
}

const MAX_NEW_ITEMS = 10;

/** Écran « À réviser aujourd'hui » : cartes dues + quota de nouveaux mots/éléments. */
export function dueToday(entries: Entry[], cards: Card[], settings: Settings, now = Date.now()): DueInfo {
  const end = endOfDay(now);
  const s = startOfDay(now);
  const exists = new Set(entries.map((e) => e.id));
  const live = cards.filter((c) => exists.has(c.entryId));
  const reviewed = live.filter((c) => c.firstAt > 0 && c.due <= end);

  const entryStarted = new Set(live.filter((c) => c.firstAt > 0).map((c) => c.entryId));
  const wordsLeft = Math.max(0, settings.newPerDay - startedTodayCount(live, now));
  const newEntries = entries
    .filter((e) => !entryStarted.has(e.id))
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, wordsLeft)
    .map((e) => e.id);
  const newWordCards = live.filter((c) => c.firstAt === 0 && newEntries.includes(c.entryId) && c.targetId === c.entryId);

  const newItemsToday = live.filter((c) => c.firstAt >= s && c.targetId !== c.entryId).length;
  const itemsLeft = Math.max(0, MAX_NEW_ITEMS - newItemsToday);
  const newItemCards = live
    .filter((c) => c.firstAt === 0 && c.targetId !== c.entryId && entryStarted.has(c.entryId))
    .sort((a, b) => (a.dir === b.dir ? 0 : a.dir === "en-fr" ? -1 : 1))
    .slice(0, itemsLeft);

  const fresh = [...newWordCards, ...newItemCards];
  return { cards: [...reviewed, ...fresh], reviewed: reviewed.length, fresh: fresh.length };
}

function scopeEntries(cfg: SessionConfig, entries: Entry[], cards: Card[], settings: Settings): Entry[] {
  if (cfg.scope === "all") return entries;
  if (cfg.scope === "tag") return entries.filter((e) => e.tags.includes(cfg.tag));
  if (cfg.scope === "errors") {
    const ids = new Set(cards.filter((c) => c.lapses > 0).map((c) => c.entryId));
    return entries.filter((e) => ids.has(e.id));
  }
  const ids = new Set(dueToday(entries, cards, settings).cards.map((c) => c.entryId));
  return entries.filter((e) => ids.has(e.id));
}

function scopeCards(cfg: SessionConfig, entries: Entry[], cards: Card[], settings: Settings): Card[] {
  const ids = new Set(entries.map((e) => e.id));
  const live = cards.filter((c) => ids.has(c.entryId));
  if (cfg.scope === "due") return dueToday(entries, cards, settings).cards;
  if (cfg.scope === "errors") return live.filter((c) => c.lapses > 0);
  if (cfg.scope === "tag") {
    const tagged = new Set(entries.filter((e) => e.tags.includes(cfg.tag)).map((e) => e.id));
    return live.filter((c) => tagged.has(c.entryId));
  }
  return live;
}

function tokensOf(s: string): string[] {
  return s.trim().split(/\s+/).filter(Boolean);
}
function stripPunct(s: string): string {
  return s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
}

export interface BuildOut {
  qs: Q[];
  error?: string;
}

export function buildSession(cfg: SessionConfig, entries: Entry[], cards: Card[], settings: Settings): BuildOut {
  const emptyMsg = "Rien à travailler avec ces réglages. Essayez une autre portée (« Toutes les fiches ») ou ajoutez des éléments.";
  const cardMap = new Map(cards.map((c) => [c.key, c]));
  const lapses = (key: string | null) => (key ? cardMap.get(key)?.lapses ?? 0 : 0);
  const pool = scopeEntries(cfg, entries, cards, settings);
  const n = Math.max(1, cfg.count);

  if (cfg.mode === "flash") {
    let list = scopeCards(cfg, entries, cards, settings);
    if (cfg.dir !== "mixed") list = list.filter((c) => c.dir === cfg.dir);
    list = weightedShuffle(list, (c) => 1 + c.lapses * 2).slice(0, n);
    const emap = new Map(entries.map((e) => [e.id, e]));
    const qs: Q[] = [];
    for (const c of list) {
      const e = emap.get(c.entryId);
      const t = e && findTarget(e, c.targetId);
      if (!t) continue;
      const label = t.kind === "word" ? "Mot" : KIND_LABEL[t.kind];
      qs.push({
        mode: "flash",
        entryId: e!.id,
        cardKey: c.key,
        dir: c.dir,
        front: c.dir === "en-fr" ? t.text : t.translation,
        back: c.dir === "en-fr" ? t.translation : t.text,
        frontIpa: c.dir === "en-fr" ? t.ipa : "",
        backIpa: c.dir === "fr-en" ? t.ipa : "",
        label,
        speakText: t.text,
      });
    }
    return qs.length ? { qs } : { qs, error: emptyMsg };
  }

  if (cfg.mode === "recall") {
    const list = weightedShuffle(pool, (e) => 1 + lapses(`${e.id}|fr-en`) * 2).slice(0, n);
    const qs: Q[] = list.map((e) => ({
      mode: "recall",
      entryId: e.id,
      cardKey: `${e.id}|fr-en`,
      word: e.word,
      translation: e.translation,
      ipa: e.ipa,
      items: e.items.map((i) => ({ kind: i.kind, text: i.text, translation: i.translation })),
    }));
    return qs.length ? { qs } : { qs, error: emptyMsg };
  }

  if (cfg.mode === "cloze") {
    const cands: Q[] = [];
    for (const e of pool) {
      for (const x of e.examples) {
        const t = findTarget(e, x.ownerId) ?? findTarget(e, e.id)!;
        let m: RegExpExecArray | null = null;
        if (t.text.trim()) {
          m = new RegExp(escapeRegExp(t.text.trim()), "i").exec(x.text);
          if (!m && t.kind === "word") m = new RegExp(`\\b${escapeRegExp(t.text.trim())}\\w*`, "i").exec(x.text);
        }
        let start: number;
        let answer: string;
        if (m) {
          start = m.index;
          answer = m[0];
        } else {
          const words = x.text.match(/[\p{L}']+/gu) ?? [];
          const longest = words.sort((a, b) => b.length - a.length)[0];
          if (!longest || longest.length < 3) continue;
          start = x.text.indexOf(longest);
          answer = longest;
        }
        cands.push({
          mode: "cloze",
          entryId: e.id,
          cardKey: `${t.id}|fr-en`,
          before: x.text.slice(0, start),
          after: x.text.slice(start + answer.length),
          answer,
          translation: x.translation,
          full: x.text,
        });
      }
    }
    const qs = weightedShuffle(cands, (q) => 1 + lapses(q.cardKey) * 2).slice(0, n);
    return qs.length ? { qs } : { qs, error: "Aucune phrase d'exemple disponible. Ajoutez des phrases d'exemple à vos fiches." };
  }

  if (cfg.mode === "colloc") {
    const cands: Q[] = [];
    for (const e of pool) {
      for (const i of e.items.filter((x) => x.kind === "collocation")) {
        const toks = tokensOf(i.text);
        if (toks.length < 2) continue;
        const nw = norm(e.word);
        let idx = toks
          .map((t, k) => ({ t, k }))
          .filter((x) => stripPunct(x.t).length >= 2 && !norm(x.t).startsWith(nw.slice(0, Math.max(3, nw.length - 2))))
          .sort((a, b) => b.t.length - a.t.length)[0]?.k;
        if (idx === undefined) idx = toks.map((t, k) => ({ t, k })).sort((a, b) => b.t.length - a.t.length)[0].k;
        const answer = stripPunct(toks[idx]);
        const shown = toks.map((t, k) => (k === idx ? t.replace(answer, "_____") : t)).join(" ");
        cands.push({ mode: "colloc", entryId: e.id, cardKey: `${i.id}|fr-en`, shown, answer, translation: i.translation, full: i.text });
      }
    }
    const qs = weightedShuffle(cands, (q) => 1 + lapses(q.cardKey) * 2).slice(0, n);
    return qs.length ? { qs } : { qs, error: "Aucune collocation disponible (il en faut au moins une de deux mots)." };
  }

  if (cfg.mode === "chunks") {
    const cands: Q[] = [];
    for (const e of pool) {
      for (const i of e.items.filter((x) => x.kind === "chunk")) {
        const toks = tokensOf(i.text);
        if (toks.length < 2) continue;
        let sh = shuffle(toks);
        for (let k = 0; k < 6 && sh.join(" ") === toks.join(" "); k++) sh = shuffle(toks);
        cands.push({ mode: "chunks", entryId: e.id, cardKey: `${i.id}|fr-en`, tokens: sh, answer: i.text, translation: i.translation });
      }
    }
    const qs = weightedShuffle(cands, (q) => 1 + lapses(q.cardKey) * 2).slice(0, n);
    return qs.length ? { qs } : { qs, error: "Aucun chunk de plusieurs mots disponible." };
  }

  if (cfg.mode === "qcm") {
    const everyTr = new Map<string, string>();
    for (const e of entries) {
      everyTr.set(norm(e.translation), e.translation);
      for (const i of e.items) everyTr.set(norm(i.translation), i.translation);
    }
    const cands: Q[] = [];
    for (const e of pool) {
      for (const i of e.items.filter((x) => x.kind === "idiom")) {
        const nc = norm(i.translation);
        const others = shuffle(Array.from(everyTr.entries()).filter(([k]) => k !== nc).map(([, v]) => v)).slice(0, 3);
        if (others.length < 2) continue;
        cands.push({
          mode: "qcm",
          entryId: e.id,
          cardKey: `${i.id}|en-fr`,
          prompt: i.text,
          ipa: i.ipa || "",
          options: shuffle([i.translation, ...others]),
          answer: i.translation,
        });
      }
    }
    const qs = weightedShuffle(cands, (q) => 1 + lapses(q.cardKey) * 2).slice(0, n);
    return qs.length ? { qs } : { qs, error: "Aucune expression disponible (ajoutez des expressions et au moins 3 traductions différentes)." };
  }

  if (cfg.mode === "match") {
    const list = weightedShuffle(pool, (e) => 1 + lapses(`${e.id}|en-fr`) * 2);
    if (list.length < 3) return { qs: [], error: "Il faut au moins 3 fiches pour cet exercice." };
    const rounds = Math.max(1, Math.ceil(n / 5));
    const qs: Q[] = [];
    for (let r = 0; r < rounds; r++) {
      const chunk = shuffle(list).slice(0, Math.min(5, list.length));
      qs.push({
        mode: "match",
        entryId: chunk[0].id,
        cardKey: null,
        pairs: chunk.map((e) => ({ cardKey: `${e.id}|en-fr`, entryId: e.id, en: e.word, fr: e.translation })),
      });
    }
    return { qs };
  }

  if (cfg.mode === "dictee") {
    const cands: Q[] = [];
    for (const e of pool) {
      for (const t of targetsOf(e)) {
        if (t.text.trim()) cands.push({ mode: "dictee", entryId: e.id, cardKey: `${t.id}|fr-en`, text: t.text, translation: t.translation, ipa: t.ipa });
      }
      for (const x of e.examples) {
        cands.push({ mode: "dictee", entryId: e.id, cardKey: null, text: x.text, translation: x.translation, ipa: x.ipa || "" });
      }
    }
    const qs = shuffle(cands).slice(0, n);
    return qs.length ? { qs } : { qs, error: emptyMsg };
  }

  if (cfg.mode === "prod") {
    const cands: Target[] = pool.flatMap((e) => targetsOf(e));
    const qs: Q[] = shuffle(cands)
      .slice(0, n)
      .map((t) => ({ mode: "prod", entryId: t.entry.id, cardKey: null, targetId: t.id, text: t.text, translation: t.translation, ipa: t.ipa }));
    return qs.length ? { qs } : { qs, error: emptyMsg };
  }

  // mini-texte du jour
  const src = pool.length >= 3 ? pool : entries;
  if (src.length < 3) return { qs: [], error: "Il faut au moins 3 fiches pour le mini-texte du jour." };
  const k = Math.min(src.length, 3 + Math.floor(Math.random() * 3));
  const words = shuffle(src).slice(0, k).map((e) => ({ id: e.id, word: e.word, translation: e.translation, ipa: e.ipa }));
  return { qs: [{ mode: "mini", entryId: words[0].id, cardKey: null, words }] };
}

export const NEXT_DAY = DAY;
