"use client";

import { useEffect, useState } from "react";
import Icon from "./Icon";
import { canSpeak, speak } from "@/lib/speech";
import { showIpa } from "@/lib/util";
import { useStore } from "@/lib/store";

interface Props {
  ipa?: string;
  /** Texte lu par la synthèse vocale (en-US). */
  say?: string;
  /** Masquer la transcription tant que l'utilisateur ne l'a pas révélée. */
  hidden?: boolean;
  className?: string;
}

export default function Pron({ ipa = "", say, hidden = false, className = "" }: Props) {
  const rate = useStore((s) => s.settings.speechRate);
  const [revealed, setRevealed] = useState(false);
  const [can, setCan] = useState(false);
  useEffect(() => setCan(canSpeak()), []);
  const txt = showIpa(ipa);
  const audio = can && !!say?.trim();
  if (!txt && !audio) return null;

  if (hidden && !revealed) {
    return (
      <button type="button" onClick={() => setRevealed(true)} className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-950 ${className}`}>
        <Icon name="eye" size={14} /> Révéler la prononciation
      </button>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      {txt && <span className="font-mono text-[0.9em] text-slate-600 dark:text-slate-300">{txt}</span>}
      {audio && (
        <button
          type="button"
          aria-label="Écouter (anglais américain)"
          onClick={(e) => {
            e.stopPropagation();
            speak(say!, rate);
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200"
        >
          <Icon name="volume" size={16} />
        </button>
      )}
    </span>
  );
}
