export function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const DAY = 86400000;

export function startOfDay(ts: number = Date.now()): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
export function endOfDay(ts: number = Date.now()): number {
  return startOfDay(ts) + DAY - 1;
}
export function dkey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Normalisation : minuscules, sans accents, sans ponctuation. */
export function norm(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/œ/g, "oe")
    .replace(/æ/g, "ae")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function lev(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

export function stripIpa(s: string): string {
  return (s || "").trim().replace(/^[/[]+|[/\]]+$/g, "").trim();
}
export function showIpa(s: string): string {
  const t = stripIpa(s);
  return t ? `/${t}/` : "";
}

export interface DiffSeg {
  c: string;
  ok: boolean;
}

function sameChar(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

/** Différence caractère par caractère (plus longue sous-séquence commune). */
export function diffSegs(typed: string, expected: string): { typed: DiffSeg[]; expected: DiffSeg[] } {
  const a = Array.from(typed);
  const b = Array.from(expected);
  const dp: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = sameChar(a[i], b[j]) ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const okA = new Array(a.length).fill(false);
  const okB = new Array(b.length).fill(false);
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (sameChar(a[i], b[j])) {
      okA[i] = true;
      okB[j] = true;
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return {
    typed: a.map((c, k) => ({ c, ok: okA[k] })),
    expected: b.map((c, k) => ({ c, ok: okB[k] })),
  };
}

function variants(expected: string): string[] {
  const out = new Set<string>();
  const parts = expected.split(/\s*(?:\/|;)\s*/).filter(Boolean);
  for (const p of parts.length ? parts : [expected]) {
    out.add(p);
    out.add(p.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim());
  }
  return Array.from(out).filter(Boolean);
}

export interface Check {
  ok: boolean;
  near: boolean;
  best: string;
}

/** Correction tolérante : accents, casse, ponctuation, petite faute de frappe. */
export function checkAnswer(typed: string, expected: string): Check {
  const nt = norm(typed);
  const vs = variants(expected);
  if (!nt) return { ok: false, near: false, best: vs[0] ?? expected };
  let bestNear: string | null = null;
  for (const v of vs) {
    const nv = norm(v);
    if (nv === nt) return { ok: true, near: false, best: v };
    const tol = nv.length <= 4 ? 0 : nv.length <= 7 ? 1 : Math.max(2, Math.floor(nv.length * 0.15));
    if (tol > 0 && lev(nt, nv) <= tol) bestNear = v;
  }
  if (bestNear) return { ok: true, near: true, best: bestNear };
  return { ok: false, near: false, best: vs[0] ?? expected };
}

export function hintText(answer: string, n: number): string {
  let shown = 0;
  return Array.from(answer)
    .map((ch) => {
      if (/\s/.test(ch)) return ch;
      if (!/[\p{L}\p{N}]/u.test(ch)) return ch;
      if (shown < n) {
        shown++;
        return ch;
      }
      return "_";
    })
    .join("");
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Tirage pondéré sans remise (Efraimidis–Spirakis). */
export function weightedShuffle<T>(arr: T[], weight: (t: T) => number): T[] {
  return arr
    .map((t) => ({ t, k: -Math.log(Math.random() || 1e-9) / Math.max(0.01, weight(t)) }))
    .sort((x, y) => x.k - y.k)
    .map((x) => x.t);
}

export function fmtDuration(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return `${Math.round(ms / 1000)} s`;
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

export function fmtDate(ts: number): string {
  return new Date(ts).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
