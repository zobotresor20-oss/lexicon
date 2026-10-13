import { useLiveQuery } from "dexie-react-hooks";
import { db } from "./db";

export function useEntries() {
  return useLiveQuery(() => db.entries.toArray(), []);
}
export function useCards() {
  return useLiveQuery(() => db.cards.toArray(), []);
}
export function useLogs() {
  return useLiveQuery(() => db.logs.toArray(), []);
}
