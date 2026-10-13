import type { Card, Entry, Kind } from "./types";
import { KINDS } from "./types";

export const MIN_PER_KIND = 3;

export type Status = "Incomplète" | "Complète" | "En apprentissage" | "Maîtrisée";

export function countKinds(e: Entry): Record<Kind, number> {
  const c: Record<Kind, number> = { chunk: 0, collocation: 0, idiom: 0 };
  for (const i of e.items) c[i.kind]++;
  return c;
}

const NOUN: Record<Kind, [string, string]> = {
  chunk: ["chunk", "chunks"],
  collocation: ["collocation", "collocations"],
  idiom: ["expression", "expressions"],
};

export function missingList(e: Entry): string[] {
  const c = countKinds(e);
  const out: string[] = [];
  for (const k of KINDS) {
    const m = MIN_PER_KIND - c[k];
    if (m > 0) out.push(`${m} ${NOUN[k][m > 1 ? 1 : 0]}`);
  }
  return out;
}

export function missingText(e: Entry): string {
  const m = missingList(e);
  return m.length ? `il manque ${m.join(", ")}` : "";
}

export function isComplete(e: Entry): boolean {
  return missingList(e).length === 0;
}

export function statusOf(e: Entry, cards: Card[]): Status {
  if (!isComplete(e)) return "Incomplète";
  const mine = cards.filter((c) => c.entryId === e.id);
  if (!mine.some((c) => c.firstAt > 0)) return "Complète";
  if (mine.length > 0 && mine.every((c) => c.firstAt > 0 && c.interval >= 21)) return "Maîtrisée";
  return "En apprentissage";
}

export function pronMissing(e: Entry): number {
  let n = e.ipa.trim() ? 0 : 1;
  for (const i of e.items) if (!(i.ipa || "").trim()) n++;
  for (const x of e.examples) if (!(x.ipa || "").trim()) n++;
  return n;
}

export interface Target {
  entry: Entry;
  id: string;
  kind: "word" | Kind;
  text: string;
  translation: string;
  ipa: string;
}

export function targetsOf(e: Entry): Target[] {
  const t: Target[] = [{ entry: e, id: e.id, kind: "word", text: e.word, translation: e.translation, ipa: e.ipa }];
  for (const i of e.items) t.push({ entry: e, id: i.id, kind: i.kind, text: i.text, translation: i.translation, ipa: i.ipa || "" });
  return t;
}

export function findTarget(e: Entry, id: string): Target | undefined {
  return targetsOf(e).find((t) => t.id === id);
}

export const STATUS_STYLE: Record<Status, string> = {
  Incomplète: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  Complète: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200",
  "En apprentissage": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-200",
  Maîtrisée: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
};
