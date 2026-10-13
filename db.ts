import Dexie, { type Table } from "dexie";
import type { Card, Entry, Kv, Log } from "./types";
import { newCard } from "./srs";

class LexDB extends Dexie {
  entries!: Table<Entry, string>;
  cards!: Table<Card, string>;
  logs!: Table<Log, number>;
  kv!: Table<Kv, string>;

  constructor() {
    super("mylexicon");
    this.version(1).stores({
      entries: "id,word,createdAt,updatedAt",
      cards: "key,entryId,due,firstAt",
      logs: "++id,ts,entryId",
      kv: "key",
    });
  }
}

export const db = new LexDB();

export async function getKv<T>(key: string, def: T): Promise<T> {
  const r = await db.kv.get(key);
  return r ? (r.value as T) : def;
}
export async function setKv(key: string, value: unknown): Promise<void> {
  await db.kv.put({ key, value });
}

/** Crée / supprime les cartes de révision d'une fiche (2 sens par cible). */
export async function syncCards(e: Entry): Promise<void> {
  const ids = [e.id, ...e.items.map((i) => i.id)];
  const keys = ids.flatMap((id) => [`${id}|en-fr`, `${id}|fr-en`]);
  const have = (await db.cards.where("entryId").equals(e.id).primaryKeys()) as string[];
  const haveSet = new Set(have);
  const keySet = new Set(keys);
  const add: Card[] = [];
  for (const id of ids) {
    for (const dir of ["en-fr", "fr-en"] as const) {
      if (!haveSet.has(`${id}|${dir}`)) add.push(newCard(id, e.id, dir));
    }
  }
  const del = have.filter((k) => !keySet.has(k));
  if (del.length) await db.cards.bulkDelete(del);
  if (add.length) await db.cards.bulkAdd(add);
}

export async function saveEntry(e: Entry): Promise<void> {
  await db.transaction("rw", db.entries, db.cards, async () => {
    await db.entries.put(e);
    await syncCards(e);
  });
}

export async function deleteEntry(id: string): Promise<void> {
  await db.transaction("rw", db.entries, db.cards, async () => {
    await db.entries.delete(id);
    await db.cards.where("entryId").equals(id).delete();
  });
}

export async function deleteDemo(): Promise<number> {
  const all = await db.entries.toArray();
  const ids = all.filter((e) => e.demo).map((e) => e.id);
  for (const id of ids) await deleteEntry(id);
  return ids.length;
}

export async function resetAll(): Promise<void> {
  await db.transaction("rw", db.entries, db.cards, db.logs, db.kv, async () => {
    await Promise.all([db.entries.clear(), db.cards.clear(), db.logs.clear(), db.kv.clear()]);
  });
}
