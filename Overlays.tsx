"use client";

import { useStore } from "@/lib/store";

export function Toast() {
  const t = useStore((s) => s.toast);
  if (!t) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex justify-center px-4">
      <div role="status" className="anim-up max-w-sm rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
        {t}
      </div>
    </div>
  );
}

export function ConfirmDialog() {
  const c = useStore((s) => s.confirm);
  const close = useStore((s) => s.closeConfirm);
  if (!c) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/50 p-4 sm:items-center" role="dialog" aria-modal="true">
      <div className="anim-pop w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl dark:bg-slate-900">
        <h2 className="text-lg font-bold">{c.title}</h2>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">{c.message}</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn-ghost" onClick={close}>
            Annuler
          </button>
          <button
            className={c.danger ? "btn-danger" : "btn-primary"}
            onClick={async () => {
              close();
              await c.onOk();
            }}
          >
            {c.okLabel ?? "Confirmer"}
          </button>
        </div>
      </div>
    </div>
  );
}
