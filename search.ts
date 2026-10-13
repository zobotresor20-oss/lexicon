import type { Entry } from "./types";
import { lev, norm } from "./util";

export type DocKind = "Mot" | "Chunk" | "Collocation" | "Expression" | "Exemple";

interface Field {
  n: string;
  toks: string[];
  w: number;
  label: string;
  ipa?: boolean;
}

export interface Doc {
  entryId: string;
  kind: DocKind;
  text: string;
  translation: string;
  ipa: string;
  fields: Field[];
}

export interface Hit extends Doc {
  score: number;
  via: string;
}

const STOP = new Set(
  (
    "je tu il elle on nous vous ils elles me te se ne n pas plus de des du la le les un une l d s c m t j qu que qui et ou a au aux en dans sur sous avec pour par mon ma mes ton ta tes son sa ses ce cet cette ces y est suis es sont ai as avons avez ont etre avoir " +
    "i you he she it we they the an of to in on at by for with and or is are was were be been am my your his her its our their this that these those do does did have has had"
  ).split(" ")
);

const IPA_CHARS = /[ɪʊəæɑʌŋθðʃʒɛɔɝɚɹɾʔˈˌː]/;

function ipaNorm(s: string): string {
  return (s || "").toLowerCase().replace(/[/[\]ˈˌː.\s]/g, "");
}

function mkField(v: string, w: number, label: string, ipa = false): Field | null {
  if (!v || !v.trim()) return null;
  if (ipa) {
    const n = ipaNorm(v);
    return n ? { n, toks: [n], w, label, ipa: true } : null;
  }
  const n = norm(v);
  return n ? { n, toks: n.split(" "), w, label } : null;
}

function fields(list: (Field | null)[]): Field[] {
  return list.filter((f): f is Field => !!f);
}

export function buildDocs(entries: Entry[]): Doc[] {
  const docs: Doc[] = [];
  for (const e of entries) {
    docs.push({
      entryId: e.id,
      kind: "Mot",
      text: e.word,
      translation: e.translation,
      ipa: e.ipa,
      fields: fields([
        mkField(e.word, 1, "mot"),
        mkField(e.translation, 1, "traduction"),
        mkField(e.ipa, 0.6, "prononciation", true),
        mkField(e.context, 0.55, "contexte d'utilisation"),
        mkField(e.notes, 0.5, "notes"),
        mkField(e.tags.join(" "), 0.5, "étiquettes"),
        mkField(e.pos, 0.3, "nature"),
      ]),
    });
    for (const i of e.items) {
      docs.push({
        entryId: e.id,
        kind: i.kind === "chunk" ? "Chunk" : i.kind === "collocation" ? "Collocation" : "Expression",
        text: i.text,
        translation: i.translation,
        ipa: i.ipa || "",
        fields: fields([
          mkField(i.text, 1, "texte"),
          mkField(i.translation, 1, "traduction"),
          mkField(i.ipa || "", 0.6, "prononciation", true),
        ]),
      });
    }
    for (const x of e.examples) {
      docs.push({
        entryId: e.id,
        kind: "Exemple",
        text: x.text,
        translation: x.translation,
        ipa: x.ipa || "",
        fields: fields([
          mkField(x.text, 0.85, "phrase"),
          mkField(x.translation, 0.85, "traduction"),
          mkField(x.ipa || "", 0.5, "prononciation", true),
        ]),
      });
    }
  }
  return docs;
}

function tokScore(q: string, toks: string[]): number {
  let best = 0;
  for (const t of toks) {
    let s = 0;
    if (t === q) s = 1;
    else if (q.length >= 2 && t.startsWith(q)) s = 0.85;
    else if (t.length >= 4 && q.startsWith(t)) s = 0.75;
    else if (q.length >= 3 && t.includes(q)) s = 0.62;
    else {
      const tol = q.length >= 8 ? 2 : q.length >= 4 ? 1 : 0;
      if (tol && Math.abs(q.length - t.length) <= tol && lev(q, t) <= tol) s = 0.6;
    }
    if (s > best) best = s;
    if (best === 1) break;
  }
  return best;
}

export function search(docs: Doc[], raw: string, limit = 80): Hit[] {
  const q = raw.trim();
  if (q.length < 2) return [];
  const ipaQuery = IPA_CHARS.test(q);
  const nq = norm(q);
  const qt = nq.split(" ").filter(Boolean);
  const out: Hit[] = [];

  if (ipaQuery) {
    const iq = ipaNorm(q);
    for (const d of docs) {
      for (const f of d.fields) {
        if (f.ipa && f.n.includes(iq)) {
          out.push({ ...d, score: f.n === iq ? 1 : 0.8, via: f.label });
          break;
        }
      }
    }
    return out.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  if (!qt.length) return [];
  const weights = qt.map((t) => (STOP.has(t) || t.length < 2 ? 0.25 : 1));
  const total = weights.reduce((a, b) => a + b, 0);
  const hasContent = weights.some((w) => w === 1);
  const threshold = qt.length === 1 ? 0.6 : 0.5;

  for (const d of docs) {
    let best = 0;
    let via = "";
    for (const f of d.fields) {
      if (f.ipa) continue;
      let sum = 0;
      let contentHit = false;
      for (let i = 0; i < qt.length; i++) {
        const s = tokScore(qt[i], f.toks);
        if (s > 0 && weights[i] === 1) contentHit = true;
        sum += s * weights[i];
      }
      if (hasContent && !contentHit) continue;
      let cov = sum / total;
      if (cov < threshold) continue;
      if (f.n.includes(nq)) cov += 0.25;
      else if (qt.length > 1 && f.n.startsWith(qt[0])) cov += 0.05;
      const sc = Math.min(1.25, cov) * f.w;
      if (sc > best) {
        best = sc;
        via = f.label;
      }
    }
    if (best > 0) out.push({ ...d, score: best - Math.min(0.1, d.text.length / 1000), via });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
