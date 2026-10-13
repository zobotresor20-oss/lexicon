"use client";

import { useRef, useState } from "react";
import Icon from "./Icon";
import { exportCsv, exportJson, parseBackup, restoreBackup } from "@/lib/backup";
import { db, deleteDemo, resetAll } from "@/lib/db";
import { reloadDemo } from "@/lib/demo";
import { useEntries } from "@/lib/hooks";
import { useStore } from "@/lib/store";

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {desc && <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export default function SettingsView() {
  const entries = useEntries();
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const askConfirm = useStore((s) => s.askConfirm);
  const showToast = useStore((s) => s.showToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const demoCount = (entries ?? []).filter((e) => e.demo).length;

  async function toggleReminder(on: boolean) {
    if (!on) return setSettings({ reminderOn: false });
    if (typeof Notification === "undefined") {
      showToast("Les notifications ne sont pas disponibles sur ce navigateur.");
      return;
    }
    const perm = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    if (perm === "granted") {
      setSettings({ reminderOn: true });
      showToast("Rappel activé.");
    } else {
      showToast("Notification refusée : autorisez-les dans les réglages du navigateur.");
    }
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const b = parseBackup(await f.text());
      askConfirm({
        title: "Restaurer cette sauvegarde ?",
        message: `Cette opération REMPLACE tout le dictionnaire et la progression actuels par la sauvegarde (${b.entries.length} fiches, exportée le ${new Date(b.exportedAt).toLocaleDateString("fr-FR")}). Cette action est irréversible.`,
        okLabel: "Remplacer et restaurer",
        danger: true,
        onOk: async () => {
          await restoreBackup(b);
          const s = b.settings as Partial<typeof settings> | undefined;
          if (s && typeof s === "object") setSettings(s);
          showToast("Sauvegarde restaurée.");
        },
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Fichier illisible.");
    }
  }

  return (
    <div className="space-y-4 p-4">
      <section className="card divide-y divide-slate-100 dark:divide-slate-800">
        <h2 className="pb-2 font-bold">Affichage</h2>
        <Row title="Thème">
          <select className="inp !w-auto" value={settings.theme} onChange={(e) => setSettings({ theme: e.target.value as typeof settings.theme })}>
            <option value="system">Automatique</option>
            <option value="light">Clair</option>
            <option value="dark">Sombre</option>
          </select>
        </Row>
        <Row title="Taille du texte">
          <select className="inp !w-auto" value={settings.fontSize} onChange={(e) => setSettings({ fontSize: Number(e.target.value) })}>
            <option value={14}>Petite</option>
            <option value={16}>Normale</option>
            <option value={18}>Grande</option>
            <option value={20}>Très grande</option>
          </select>
        </Row>
      </section>

      <section className="card divide-y divide-slate-100 dark:divide-slate-800">
        <h2 className="pb-2 font-bold">Prononciation</h2>
        <Row title="Masquer la prononciation pendant les exercices" desc="Flashcards, rappel libre, dictée, texte à trous. Un bouton permet de la révéler.">
          <input type="checkbox" className="h-6 w-6" checked={settings.hidePron} onChange={(e) => setSettings({ hidePron: e.target.checked })} />
        </Row>
        <Row title="Vitesse de la voix (en-US)">
          <select className="inp !w-auto" value={settings.speechRate} onChange={(e) => setSettings({ speechRate: Number(e.target.value) })}>
            <option value={0.6}>Lente</option>
            <option value={0.9}>Normale</option>
            <option value={1.1}>Rapide</option>
          </select>
        </Row>
      </section>

      <section className="card divide-y divide-slate-100 dark:divide-slate-800">
        <h2 className="pb-2 font-bold">Objectifs et rappel</h2>
        <Row title="Nouveaux mots par jour">
          <input type="number" min={0} max={50} className="inp !w-20 text-center" value={settings.newPerDay} onChange={(e) => setSettings({ newPerDay: Math.max(0, Math.min(50, Number(e.target.value) || 0)) })} />
        </Row>
        <Row title="Révisions par jour">
          <input type="number" min={1} max={500} className="inp !w-20 text-center" value={settings.reviewsPerDay} onChange={(e) => setSettings({ reviewsPerDay: Math.max(1, Math.min(500, Number(e.target.value) || 1)) })} />
        </Row>
        <Row title="Rappel quotidien" desc="Notification locale, envoyée seulement si l'application est ouverte ou active en arrière-plan à l'heure choisie.">
          <input type="checkbox" className="h-6 w-6" checked={settings.reminderOn} onChange={(e) => toggleReminder(e.target.checked)} />
        </Row>
        {settings.reminderOn && (
          <Row title="Heure du rappel">
            <input type="time" className="inp !w-auto" value={settings.reminderTime} onChange={(e) => setSettings({ reminderTime: e.target.value })} />
          </Row>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Sauvegarde et export</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Vos données restent uniquement sur cet appareil. Faites une sauvegarde régulière : si vous effacez les données du navigateur ou désinstallez l'application, tout est perdu.</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-primary"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const n = await exportJson(settings);
              setBusy(false);
              showToast(`Sauvegarde exportée (${n} fiches).`);
            }}
          >
            Sauvegarder (JSON)
          </button>
          <button className="btn-ghost" onClick={() => fileRef.current?.click()}>
            Restaurer…
          </button>
          <button
            className="btn-ghost col-span-2"
            onClick={async () => {
              const n = await exportCsv();
              showToast(`Dictionnaire exporté en CSV (${n} fiches).`);
            }}
          >
            Exporter le dictionnaire (CSV)
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={onFile} />
      </section>

      <section className="card space-y-3">
        <h2 className="font-bold">Données</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            className="btn-ghost"
            disabled={!demoCount}
            onClick={() =>
              askConfirm({
                title: "Supprimer les fiches de démonstration ?",
                message: `${demoCount} fiche${demoCount > 1 ? "s" : ""} de démonstration (et leur progression) seront supprimées. Vos propres fiches ne sont pas touchées.`,
                okLabel: "Supprimer",
                danger: true,
                onOk: async () => {
                  const n = await deleteDemo();
                  showToast(`${n} fiche${n > 1 ? "s" : ""} supprimée${n > 1 ? "s" : ""}.`);
                },
              })
            }
          >
            <Icon name="trash" size={16} /> Supprimer la démo ({demoCount})
          </button>
          <button
            className="btn-ghost"
            onClick={async () => {
              await reloadDemo();
              showToast("Fiches de démonstration ajoutées.");
            }}
          >
            Recharger la démo
          </button>
        </div>
        <button
          className="btn-danger w-full"
          onClick={() =>
            askConfirm({
              title: "Tout effacer ?",
              message: "Toutes vos fiches, votre progression et votre historique seront supprimés définitivement de cet appareil. Pensez à faire une sauvegarde avant.",
              okLabel: "Tout effacer",
              danger: true,
              onOk: async () => {
                await resetAll();
                await db.kv.put({ key: "seeded", value: true });
                showToast("Toutes les données ont été effacées.");
              },
            })
          }
        >
          Effacer toutes mes données
        </button>
      </section>

      <p className="pb-4 text-center text-xs text-slate-400">MyLexicon 1.0 · 100 % local, aucune donnée envoyée en ligne</p>
    </div>
  );
}
