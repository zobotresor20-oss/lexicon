import type { Entry, Example, Item, Kind } from "./types";
import { getKv, saveEntry, setKv } from "./db";
import { uid } from "./util";

type T = [string, string, string?];
interface Ex {
  on: string; // "w" | "c0".."c2" | "k0".."k2" | "i0".."i2"
  en: string;
  fr: string;
  ipa?: string;
}

function mk(
  word: string,
  translation: string,
  ipa: string,
  pos: string,
  register: string,
  context: string,
  chunks: T[],
  colls: T[],
  idioms: T[],
  exs: Ex[],
  notes = "",
  tags: string[] = ["démo"]
): Entry {
  const now = Date.now();
  const id = uid();
  const items: Item[] = [];
  const idMap: Record<string, string> = { w: id };
  const add = (kind: Kind, prefix: string, list: T[]) =>
    list.forEach((t, n) => {
      const iid = uid();
      idMap[`${prefix}${n}`] = iid;
      items.push({ id: iid, kind, text: t[0], translation: t[1], ipa: t[2] || "" });
    });
  add("chunk", "c", chunks);
  add("collocation", "k", colls);
  add("idiom", "i", idioms);
  const examples: Example[] = exs.map((x) => ({
    id: uid(),
    ownerId: idMap[x.on] || id,
    text: x.en,
    translation: x.fr,
    ipa: x.ipa || "",
  }));
  return {
    id,
    word,
    translation,
    ipa,
    pos,
    register,
    context,
    notes,
    tags,
    items,
    examples,
    createdAt: now,
    updatedAt: now,
    demo: true,
  };
}

export function demoEntries(): Entry[] {
  return [
    mk(
      "reliable", "fiable", "rɪˈlaɪəbəl", "adjectif", "courant",
      "Pour décrire une personne, une source, une machine ou un service sur lesquels on peut compter.",
      [
        ["How reliable is it?", "Est-ce que c'est fiable ?", "haʊ rɪˈlaɪəbəl ɪz ɪt"],
        ["a reliable way to", "un moyen fiable de", "ə rɪˈlaɪəbəl weɪ tu"],
        ["not entirely reliable", "pas tout à fait fiable"],
      ],
      [
        ["reliable source", "source fiable", "rɪˈlaɪəbəl sɔːrs"],
        ["reliable information", "information fiable"],
        ["reliable service", "service fiable"],
      ],
      [
        ["rock solid", "solide comme un roc", "ˌrɑːk ˈsɑːlɪd"],
        ["as good as gold", "irréprochable, en qui on peut avoir toute confiance", "æz ɡʊd æz ɡoʊld"],
        ["count on someone", "compter sur quelqu'un", "ˈkaʊnt ɑːn ˈsʌmwʌn"],
      ],
      [
        { on: "w", en: "He is a very reliable colleague.", fr: "C'est un collègue très fiable." },
        { on: "c0", en: "I need a new car. How reliable is it?", fr: "Il me faut une voiture neuve. Est-ce qu'elle est fiable ?" },
        { on: "k0", en: "Journalists must use a reliable source.", fr: "Les journalistes doivent utiliser une source fiable." },
        { on: "i2", en: "You can count on me.", fr: "Tu peux compter sur moi." },
      ]
    ),
    mk(
      "afford", "avoir les moyens de, se permettre", "əˈfɔːrd", "verbe", "courant",
      "Parler de ce que l'on peut se permettre financièrement ou en temps.",
      [
        ["can't afford to", "ne pas pouvoir se permettre de", "kænt əˈfɔːrd tu"],
        ["afford to wait", "se permettre d'attendre"],
        ["if you can afford it", "si vous en avez les moyens"],
      ],
      [
        ["afford a house", "s'offrir une maison"],
        ["barely afford", "pouvoir à peine s'offrir"],
        ["can well afford", "avoir largement les moyens de"],
      ],
      [
        ["cost an arm and a leg", "coûter les yeux de la tête", "kɔːst æn ɑːrm ænd ə lɛɡ"],
        ["break the bank", "coûter une fortune, ruiner son budget", "breɪk ðə bæŋk"],
        ["live beyond one's means", "vivre au-dessus de ses moyens"],
      ],
      [
        { on: "w", en: "We can't afford a new car this year.", fr: "Nous ne pouvons pas nous offrir une voiture neuve cette année." },
        { on: "i0", en: "That watch costs an arm and a leg.", fr: "Cette montre coûte les yeux de la tête." },
        { on: "c2", en: "Buy it if you can afford it.", fr: "Achète-le si tu en as les moyens." },
      ]
    ),
    mk(
      "deadline", "date limite, échéance", "ˈdɛdlaɪn", "nom", "professionnel",
      "Date ou heure limite pour remettre un travail ou terminer une tâche.",
      [
        ["The deadline is on Friday.", "La date limite est vendredi."],
        ["well ahead of the deadline", "bien avant la date limite"],
        ["push back the deadline", "repousser l'échéance"],
      ],
      [
        ["meet a deadline", "respecter un délai", "miːt ə ˈdɛdlaɪn"],
        ["miss a deadline", "dépasser un délai"],
        ["extend the deadline", "prolonger le délai"],
      ],
      [
        ["down to the wire", "à la toute dernière minute", "daʊn tu ðə waɪr"],
        ["against the clock", "contre la montre"],
        ["under the gun", "sous pression"],
      ],
      [
        { on: "w", en: "I have to meet the deadline.", fr: "Je dois respecter la date limite." },
        { on: "k1", en: "She never misses a deadline.", fr: "Elle ne dépasse jamais un délai." },
        { on: "i0", en: "The project went down to the wire.", fr: "Le projet s'est joué à la dernière minute." },
      ]
    ),
    mk(
      "overwhelmed", "submergé, débordé", "ˌoʊvərˈwɛlmd", "adjectif", "courant",
      "Se sentir submergé par le travail, les émotions ou les informations.",
      [
        ["I'm a bit overwhelmed right now.", "Je suis un peu dépassé en ce moment."],
        ["completely overwhelmed by", "complètement submergé par"],
        ["feel overwhelmed", "se sentir dépassé"],
      ],
      [
        ["overwhelmed by work", "submergé de travail"],
        ["overwhelmed with emotion", "submergé par l'émotion"],
        ["overwhelmed with gratitude", "rempli d'une immense gratitude"],
      ],
      [
        ["have a lot on one's plate", "avoir beaucoup de choses à gérer"],
        ["be swamped", "être débordé"],
        ["up to one's neck in work", "avoir du travail par-dessus la tête"],
      ],
      [
        { on: "w", en: "She felt overwhelmed by all the emails.", fr: "Elle se sentait submergée par tous les e-mails." },
        { on: "i1", en: "Sorry, I'm swamped this week.", fr: "Désolé, je suis débordé cette semaine." },
      ]
    ),
    mk(
      "worth", "qui vaut, qui vaut la peine", "wɝːθ", "adjectif", "courant",
      "Valeur d'une chose, ou intérêt de lui consacrer du temps ou de l'argent.",
      [
        ["Is it worth it?", "Est-ce que ça en vaut la peine ?"],
        ["It's not worth the trouble.", "Ça ne vaut pas la peine."],
        ["well worth a visit", "vaut vraiment le détour"],
      ],
      [
        ["worth the effort", "valoir l'effort"],
        ["worth the money", "valoir son prix"],
        ["worth considering", "à envisager"],
      ],
      [
        ["worth its weight in gold", "valoir de l'or", "wɝːθ ɪts weɪt ɪn ɡoʊld"],
        ["for what it's worth", "pour ce que ça vaut"],
        ["worth every penny", "valoir chaque centime"],
      ],
      [
        { on: "w", en: "This book is worth reading.", fr: "Ce livre vaut la peine d'être lu." },
        { on: "i1", en: "For what it's worth, I think you're right.", fr: "Pour ce que ça vaut, je pense que tu as raison." },
      ]
    ),
    mk(
      "schedule", "emploi du temps, planning", "ˈskɛdʒuːl", "nom", "courant",
      "Organisation du temps : réunions, voyages, tâches.",
      [["ahead of schedule", "en avance sur le planning"]],
      [
        ["tight schedule", "emploi du temps chargé"],
        ["schedule a meeting", "planifier une réunion"],
      ],
      [],
      [{ on: "w", en: "My schedule is full today.", fr: "Mon emploi du temps est complet aujourd'hui." }],
      "Fiche de démonstration incomplète : il reste des collocations, des chunks et des expressions à ajouter."
    ),
    mk(
      "attend", "assister à", "əˈtɛnd", "verbe", "courant",
      "Être présent à un événement, un cours, une réunion.",
      [["attend a meeting", "assister à une réunion"]],
      [],
      [],
      [],
      "Fiche de démonstration incomplète et sans prononciation pour les éléments."
    ),
  ];
}

export async function seedDemoIfNeeded(): Promise<void> {
  const done = await getKv<boolean>("seeded", false);
  if (done) return;
  for (const e of demoEntries()) await saveEntry(e);
  await setKv("seeded", true);
}

export async function reloadDemo(): Promise<void> {
  for (const e of demoEntries()) await saveEntry(e);
}
