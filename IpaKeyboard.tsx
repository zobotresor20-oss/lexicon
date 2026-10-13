"use client";

const ROWS: string[][] = [
  ["ə", "ɚ", "ɝ", "ɪ", "ʊ", "æ", "ɑ", "ʌ", "ɛ", "ɔ", "i", "u"],
  ["aɪ", "aʊ", "ɔɪ", "eɪ", "oʊ", "ɑːr", "ɔːr"],
  ["ŋ", "θ", "ð", "ʃ", "ʒ", "tʃ", "dʒ", "ɹ", "ɾ", "ʔ"],
  ["ˈ", "ˌ", "ː", ".", "(", ")", " "],
];

let lastField: HTMLInputElement | HTMLTextAreaElement | null = null;

export function rememberIpaField(el: HTMLInputElement | HTMLTextAreaElement | null) {
  lastField = el;
}

/** Insère le texte à la position du curseur, en déclenchant l'événement React. */
export function insertAtCursor(el: HTMLInputElement | HTMLTextAreaElement, text: string) {
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? el.value.length;
  const next = el.value.slice(0, start) + text + el.value.slice(end);
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  const pos = start + text.length;
  el.focus();
  try {
    el.setSelectionRange(pos, pos);
  } catch {
    /* ignoré */
  }
}

export default function IpaKeyboard({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="border-t border-slate-200 bg-slate-100 p-2 dark:border-slate-700 dark:bg-slate-800"
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Clavier phonétique (API, américain)</span>
        <button type="button" onClick={onClose} className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Fermer
        </button>
      </div>
      <div className="space-y-1">
        {ROWS.map((row, r) => (
          <div key={r} className="flex flex-wrap gap-1">
            {row.map((s) => (
              <button
                key={s}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (lastField) insertAtCursor(lastField, s);
                }}
                className="min-h-10 min-w-10 flex-1 rounded-lg bg-white px-2 text-lg font-medium text-slate-900 shadow-sm active:bg-indigo-100 dark:bg-slate-700 dark:text-slate-100 dark:active:bg-indigo-900"
                style={{ maxWidth: "4.2rem" }}
                aria-label={s === " " ? "espace" : `symbole ${s}`}
              >
                {s === " " ? "␣" : s}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
