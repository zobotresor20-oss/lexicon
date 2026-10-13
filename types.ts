export type Kind = "chunk" | "collocation" | "idiom";
export type Dir = "en-fr" | "fr-en";

export interface Item {
  id: string;
  kind: Kind;
  text: string;
  translation: string;
  ipa?: string;
}

export interface Example {
  id: string;
  ownerId: string; // id de la fiche (le mot) ou id d'un élément
  text: string;
  translation: string;
  ipa?: string;
}

export interface Entry {
  id: string;
  word: string;
  translation: string;
  ipa: string;
  pos: string;
  register: string;
  context: string;
  notes: string;
  tags: string[];
  items: Item[];
  examples: Example[];
  createdAt: number;
  updatedAt: number;
  demo?: boolean;
}

export interface Card {
  key: string; // `${targetId}|${dir}`
  entryId: string;
  targetId: string;
  dir: Dir;
  due: number;
  interval: number;
  ease: number;
  reps: number;
  lapses: number;
  lastAt: number;
  lastWrong: number;
  firstAt: number; // 0 = jamais révisée
}

export interface Log {
  id?: number;
  ts: number;
  entryId: string;
  cardKey: string;
  correct: boolean;
  isNew: boolean;
  ms: number;
  mode: string;
  scored: boolean;
}

export interface Kv {
  key: string;
  value: unknown;
}

export const KIND_LABEL: Record<Kind, string> = {
  chunk: "Chunk",
  collocation: "Collocation",
  idiom: "Expression",
};
export const KIND_PLURAL: Record<Kind, string> = {
  chunk: "chunks",
  collocation: "collocations",
  idiom: "expressions",
};
export const KINDS: Kind[] = ["chunk", "collocation", "idiom"];

export const POS_LIST = [
  "nom",
  "verbe",
  "adjectif",
  "adverbe",
  "préposition",
  "conjonction",
  "pronom",
  "déterminant",
  "interjection",
  "verbe à particule",
  "locution",
  "autre",
];
export const REGISTERS = ["", "familier", "courant", "soutenu", "professionnel", "technique", "argotique"];
