# MyLexicon

Dictionnaire personnel d'anglais pour francophone, avec étude active. Application web installable (PWA), **100 % hors ligne** et **uniquement locale** : pas de compte, pas de serveur, pas de base distante. Les données sont stockées dans IndexedDB sur l'appareil.

Stack : Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Zustand, Dexie (IndexedDB).

## 1. Lancer le projet en local

Prérequis : Node.js 20.9 ou plus récent (https://nodejs.org).

```bash
npm install
npm run dev
```

Ouvrez http://localhost:3000. Pour tester la version de production (nécessaire pour le service worker et le mode hors ligne) :

```bash
npm run build
npm run start
```

## 2. Créer un dépôt GitHub et y déposer le code

**Avec git :**

1. Sur https://github.com/new, créez un dépôt vide nommé `mylexicon` (sans README ni .gitignore).
2. Dans le dossier du projet :

```bash
git init
git add .
git commit -m "MyLexicon : première version"
git branch -M main
git remote add origin https://github.com/VOTRE-NOM/mylexicon.git
git push -u origin main
```

**Sans git (interface web) :** créez le dépôt, cliquez sur « uploading an existing file », glissez-y TOUT le contenu du dossier (dossiers `src`, `public`, `scripts` compris, mais pas `node_modules` ni `.next`), puis « Commit changes ».

## 3. Importer le dépôt dans Vercel et déployer

1. Sur https://vercel.com, connectez-vous avec GitHub.
2. « Add New… » → « Project » → choisissez le dépôt `mylexicon` → « Import ».
3. Ne changez rien : Next.js est détecté automatiquement, aucune variable d'environnement n'est nécessaire.
4. Cliquez sur « Deploy ». Après une minute, vous obtenez une adresse `https://mylexicon-xxxx.vercel.app`.

## 4. Installer l'application sur un téléphone

- **Android (Chrome)** : ouvrez l'adresse, menu ⋮ → « Installer l'application » (ou « Ajouter à l'écran d'accueil »).
- **iPhone (Safari obligatoire)** : ouvrez l'adresse, bouton Partager → « Sur l'écran d'accueil » → « Ajouter ».

## 5. Tester le mode hors ligne

1. Ouvrez l'application une première fois avec Internet et attendez quelques secondes.
2. Fermez-la, passez en mode avion, rouvrez-la : tout doit fonctionner (fiches, recherche, exercices).
3. Sur ordinateur : DevTools → Application → Service Workers → « Offline ».

## 6. Sauvegarder et restaurer

Réglages → « Sauvegarder (JSON) » télécharge toutes vos fiches et votre progression. « Restaurer… » charge ce fichier (avec confirmation : il remplace les données actuelles). « Exporter le dictionnaire (CSV) » produit un tableau lisible dans Excel. Faites une sauvegarde régulière : effacer les données du navigateur supprime le dictionnaire.

## Notes

- Au premier lancement, 5 fiches complètes et 2 incomplètes de démonstration sont ajoutées. Réglages → « Supprimer la démo » les retire (« Recharger la démo » les remet).
- Le rappel quotidien est une notification locale : elle ne part que si l'application est ouverte ou active en arrière-plan (sans serveur, pas de notification push).
- La synthèse vocale dépend des voix installées sur l'appareil (en-US).
- Icônes : déjà fournies dans `public/icons` ; `python3 scripts/generate-icons.py` (Pillow) les régénère.
