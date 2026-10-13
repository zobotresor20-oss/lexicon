import { db } from "./db";
import type { Card, Entry, Kv, Log } from "./types";
import { KIND_LABEL } from "./types";
import { isComplete, missingText, statusOf } from "./entry";

export interface Backup {
  app: "MyLexicon";
  version: 1;
  exportedAt: string;
  entries: Entry[];
  cards: Card[];
  logs: Log[];
  kv: Kv[];
  settings: unknown;
}

function download(name: string, mime: string, content: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function exportJson(settings: unknown): Promise<number> {
  const [entries, cards, logs, kv] = await Promise.all([db.entries.toArray(), db.cards.toArray(), db.logs.toArray(), db.kv.toArray()]);
  const data: Backup = { app: "MyLexicon", version: 1, exportedAt: new Date().toISOString(), entries, cards, logs, kv, settings };
  download(`mylexicon-sauvegarde-${stamp()}.json`, "application/json", JSON.stringify(data));
  return entries.length;
}

function csvCell(v: string): string {
  return `"${(v ?? "").replace(/"/g, '""').replace(/\r?\n/g, " ")}"`;
}

export async function exportCsv(): Promise<number> {
  const [entries, cards] = await Promise.all([db.entries.toArray(), db.cards.toArray()]);
  const head = ["fiche", "type", "anglais", "français", "prononciation (API)", "nature", "registre", "contexte", "notes", "étiquettes", "statut", "rattaché à"];
  const rows: string[][] = [head];
  for (const e of entries) {
    const st = statusOf(e, cards);
    const label = isComplete(e) ? st : `${st} (${missingText(e)})`;
    const tags = e.tags.join(", ");
    rows.push([e.word, "mot", e.word, e.translation, e.ipa, e.pos, e.register, e.context, e.notes, tags, label, ""]);
    const names = new Map<string, string>([[e.id, e.word]]);
    for (const i of e.items) {
      names.set(i.id, i.text);
      rows.push([e.word, KIND_LABEL[i.kind].toLowerCase(), i.text, i.translation, i.ipa || "", "", "", "", "", "", "", ""]);
    }
    for (const x of e.examples) {
      rows.push([e.word, "exemple", x.text, x.translation, x.ipa || "", "", "", "", "", "", "", names.get(x.ownerId) || e.word]);
    }
  }
  const csv = "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  download(`mylexicon-dictionnaire-${stamp()}.csv`, "text/csv;charset=utf-8", csv);
  return entries.length;
}

export function parseBackup(text: string): Backup {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n'est pas un JSON valide.");
  }
  const d = data as Partial<Backup>;
  if (!d || d.app !== "MyLexicon" || !Array.isArray(d.entries) || !Array.isArray(d.cards) || !Array.isArray(d.logs) || !Array.isArray(d.kv)) {
    throw new Error("Ce fichier n'est pas une sauvegarde MyLexicon.");
  }
  return d as Backup;
}

export async function restoreBackup(b: Backup): Promise<void> {
  await db.transaction("rw", db.entries, db.cards, db.logs, db.kv, async () => {
    await Promise.all([db.entries.clear(), db.cards.clear(), db.logs.clear(), db.kv.clear()]);
    await db.entries.bulkPut(b.entries);
    await db.cards.bulkPut(b.cards);
    await db.logs.bulkPut(b.logs);
    await db.kv.bulkPut(b.kv);
  });
  // la carte « seeded » évite de recréer les fiches de démonstration après restauration
  await db.kv.put({ key: "seeded", value: true });
}
