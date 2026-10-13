import type { Card, Dir } from "./types";
import { DAY } from "./util";

export function newCard(targetId: string, entryId: string, dir: Dir): Card {
  return {
    key: `${targetId}|${dir}`,
    entryId,
    targetId,
    dir,
    due: 0,
    interval: 0,
    ease: 2.5,
    reps: 0,
    lapses: 0,
    lastAt: 0,
    lastWrong: 0,
    firstAt: 0,
  };
}

/** SM-2 simplifié. q : 0-5 (< 3 = échec). */
export function reviewCard(c: Card, q: number, now: number = Date.now()): Card {
  const n: Card = { ...c };
  if (!n.firstAt) n.firstAt = now;
  if (q < 3) {
    n.reps = 0;
    n.interval = 0;
    n.lapses += 1;
    n.lastWrong = now;
    n.ease = Math.max(1.3, n.ease - 0.2);
    n.due = now + 10 * 60000;
  } else {
    n.reps += 1;
    if (n.reps === 1) n.interval = 1;
    else if (n.reps === 2) n.interval = 3;
    else n.interval = Math.round(Math.max(1, n.interval) * n.ease);
    n.ease = Math.max(1.3, n.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
    n.due = now + n.interval * DAY;
  }
  n.lastAt = now;
  return n;
}
