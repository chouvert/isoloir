# Suivi des programmes — conception

Date : 2026-11-15. Complète `2026-11-07-veille-hebdomadaire-design.md` (la veille quotidienne et la session du samedi).

## Objectif

Ne manquer aucune publication ni aucune modification d'un programme de candidat : une page de programme nouvelle
ou modifiée doit apparaître dans le journal de veille le lendemain, et être lue en entier par la session du samedi
ou, à défaut, demandée à Julien.

## Ce qui a manqué (constat du 2026-11-15)

Julien a trouvé sur melenchon2027.fr, chapitre 2 du programme, la mesure « Relocaliser les productions essentielles
à la vie de notre pays », absente de la fiche. Quatre causes, toutes dans le dispositif et non dans les tâches
planifiées (qui ont bien tourné) :

1. **Le collecteur ne signale que les adresses nouvelles.** `collecter()` écarte toute adresse présente dans
   `vus.txt`. Une page modifiée sur place (programme de Philippe, « Mise à jour le 12 novembre 2026 ») n'est jamais
   resignalée, même si le plan du site donne une nouvelle date `lastmod`.
2. **La source de melenchon2027.fr est son flux RSS**, qui ne publie que les événements de campagne. Les pages
   `/programme/...` n'y figurent pas ; aucune n'a jamais été collectée.
3. **Six candidats n'ont pas de `programme_url`** (Batho, Glucksmann, Le Pen, Retailleau, Roussel, Zemmour) :
   rien ne surveille l'apparition de leur programme.
4. **Le samedi, la lecture est plafonnée à 8 liens par candidat** et rien n'oblige à demander un programme non lu :
   la fiche Mélenchon porte « livre non lu » dans `programme_version`, sans ligne dans `veille/a-recuperer.md`.

## Décisions de Julien (2026-11-15)

- Suivre les programmes par leur contenu, les plans de site servant de complément.
- Plan écrit dans le dépôt pour pouvoir être exécuté par un autre modèle ou une autre session.
- La lecture complète du programme de Mélenchon vient après la mise en place (remise à niveau, section 5).

## 1. Source de type `programme` (collecte quotidienne)

Nouveau type dans `veille/sources.yml`, à côté de `rss`, `page` et `sitemap` :

```yaml
- id: melenchon-programme
  nom: Mélenchon 2027 — programme
  type: programme
  url: https://melenchon2027.fr/programme/decouvrir/   # point d'entrée (programme_url de la fiche)
  prefixes: [/programme/]                               # pages suivies : même site, chemin sous un préfixe
  plan: https://melenchon2027.fr/sitemap.xml            # facultatif : plan du site, filtré par les préfixes
  categorie: campagne
  candidats: [melenchon-jean-luc]
```

### Pages suivies

- Le point d'entrée, puis les liens du même site dont le chemin commence par un des `prefixes`, suivis de proche
  en proche sur 3 niveaux au plus ; `prefixes` absent = le dossier du point d'entrée.
- Si `plan` est donné : les adresses du plan du site sous les préfixes s'ajoutent à la liste (pages orphelines).
- Plafond de 120 pages par source et par passage, point d'entrée d'abord, puis dans l'ordre de découverte. Plafond
  atteint : une information « Programme : plafond de pages atteint » (une fois par semaine au plus), pour que
  le plafond ou les préfixes soient revus.
- Mêmes règles réseau que le reste : `robots.txt` contrôlé pour chaque page, une requête à la fois, 2 s d'attente,
  expiration à 15 s. Les ancres sont ignorées (`normaliserUrl`).
- Documents liés (`.pdf`) : non téléchargés. Une requête d'en-tête (`HEAD`) donne `etag`, `last-modified` et
  `content-length` ; leur concaténation tient lieu d'empreinte. Sans aucun de ces en-têtes, le PDF n'est signalé
  qu'à son apparition.

### Empreinte d'une page

- Texte utile : contenu de `<main>` ou, à défaut, de `<article>`, sinon `<body>` ; sans `script`, `style`,
  `noscript`, `nav`, `header`, `footer`, `aside`, `form`.
- Découpage en blocs à la fermeture des éléments `p`, `li`, `h1` à `h6`, `td`, `th`, `blockquote`, `dd`, `dt` ;
  le texte hors de ces éléments forme un bloc par élément `div` ou `section`. Bloc de moins de 20 caractères écarté
  (menus, boutons).
- Chaque bloc est plié (minuscules, sans accents, espaces réduits) puis réduit aux 10 premiers caractères
  hexadécimaux de son SHA-1. L'empreinte d'une page est l'**ensemble** de ces codes : l'ordre des blocs et la mise
  en page ne comptent pas.
- Aucun texte de programme n'est enregistré : seulement les codes, la date et le titre de la page.

### Ce qui est signalé

| cas | information ajoutée au journal | chapô (300 caractères au plus) |
|-----|--------------------------------|--------------------------------|
| premier succès de la source | une seule : « Programme : suivi commencé » | nombre de pages suivies |
| page inconnue jusque-là | « Programme : page nouvelle — titre de la page » | début du premier bloc |
| au moins un bloc ajouté ou retiré | « Programme : page modifiée — titre » | « +N / −M blocs » puis début du premier bloc ajouté |
| page absente (statut ≠ 200 ou plus aucun lien) 3 passages de suite | « Programme : page retirée — titre » | dernière date de succès |

- Champ supplémentaire dans le JSONL : `nature` = `programme-suivi` | `programme-nouveau` | `programme-modifie` |
  `programme-retire` | `programme-plafond`. Les autres informations n'ont pas ce champ.
- Identifiant inchangé (`AAAA-MM-JJ-<8 hex du SHA-1 de l'URL>`) : une page modifiée deux jours différents donne deux
  informations ; deux fois le même jour, une seule.
- Une page en erreur un jour donné garde son empreinte précédente : pas de fausse « modification ».
- Échec de la source (point d'entrée illisible, interdit par `robots.txt`, aucune page lue) : compté comme pour les
  autres types, donc source muette au bout de 3 passages. La compensation est le dépôt de PDF dans le Drive.

### Rangement (branche `veille`)

Nouveau fichier `empreintes.json` : `{ "<url normalisée>": { "source", "titre", "blocs": [...], "vu": "AAAA-MM-JJ",
"absences": 0 } }`. `etat.json`, `vus.txt` et les journaux gardent leur format.

### Journal

Dans la section de chaque candidat, les informations de nature `programme-*` viennent en premier, précédées de
« **Programme** · », avant les autres (toujours triées par date décroissante).

## 2. Candidats sans programme publié

- Pour chaque candidat sans `programme_url`, une source `sitemap` du site de campagne ou du parti (quand il en
  existe un) avec un champ `motifs` : seules les adresses nouvelles dont le chemin contient un des motifs
  (`programme`, `projet`, `propositions`, `mesures`) sont gardées, avec `nature: programme-apparu` et le titre
  « Programme : page apparue ».
- Sans plan de site exploitable : la session du samedi fait une recherche web par candidat sans programme
  (« programme » + nom + mois), comme compensation permanente.
- Dès qu'un programme paraît : `programme_url` dans la fiche, et une source `programme` remplace la source à motifs.

## 3. Session du samedi

- Une information de nature `programme-*` est **hors du plafond des 8 liens** et passe avant tout le reste.
- Page nouvelle ou modifiée : lue en entier. Si elle ne peut pas l'être (tronquée, refusée) : ligne dans
  `veille/a-recuperer.md`, état `demandé`. Un programme n'est jamais `abandonné` (règle déjà en vigueur).
- Programme entier nouveau (plus de 10 pages) : lecture étalée sur plusieurs sessions, les chapitres liés aux
  13 dilemmes et aux 26 questions d'abord ; la couverture est tenue dans la fiche (section 4).
- Corps de la PR hebdomadaire : nouvelle section « Programmes » (pages nouvelles, modifiées, lues, restant à lire).

## 4. Couverture du programme dans la fiche et contrôle

- Deux champs d'en-tête : `programme_lu` (`complet` | `partiel` | `non`) et `programme_lu_le` (`AAAA-MM-JJ`).
  Vides quand `programme_url` est vide.
- `partiel` ou `non` : ce qui reste à lire est écrit quelque part. Soit la fiche porte une section
  `## Couverture du programme` (après « Évolutions / revirements »), tableau `| partie | adresse | lu le | état |`
  avec l'état `lu` | `non lu` | `à relire` (page modifiée depuis la lecture) ; soit une ligne de
  `veille/a-recuperer.md` cite le candidat avec l'état `demandé` (programme illisible par Claude).
- `npm run valider` :
  - erreur si `programme_url` est rempli sans `programme_lu` valide ;
  - erreur si `programme_lu` vaut `partiel` ou `non` sans section de couverture ni ligne `demandé` ;
  - avertissement « programme non lu en entier » si `partiel` ou `non`.
- Le site n'affiche pas ces champs pour l'instant (hors périmètre).

## 5. Remise à niveau (une fois)

Les sept programmes publiés (Attal, Dupont-Aignan, Lisnard, Mélenchon, Philippe, Ruffin, Tondelier) sont lus en
entier, un candidat par session, Mélenchon d'abord (chapitre 2 signalé par Julien). Méthode de `CLAUDE.md` :
rédaction, vérification par un agent neuf, PR par fiche, changements de rattachement et de phares présentés à Julien.

## 6. Ce qui change dans le dépôt

| fichier | changement |
|---------|------------|
| `scripts/lib/veille.mjs` | type `programme`, empreintes, comparaison, champ `motifs`, ordre du journal |
| `scripts/veille.mjs` | lecture et écriture de `empreintes.json`, requête d'en-tête, option `--essai` |
| `.github/workflows/veille.yml` | entrée `essai` du lancement manuel (aucune publication) |
| `veille/sources.yml` | une source `programme` par programme publié ; sources à motifs |
| `tests/veille.test.mjs`, `tests/fixtures/veille/` | cas de la section 1 et 2 |
| `scripts/lib/validation.mjs`, `tests/validation.test.mjs` | contrôles de la section 4 |
| `candidats/_modele.md`, 13 fiches | `programme_lu`, `programme_lu_le`, section de couverture |
| `CLAUDE.md`, `README.md` | règle du samedi, corps de la PR, convention de couverture |

## Risques

- **Fausses alertes** : texte qui change sans que le programme change (compteur, date du jour, bandeau). Le
  découpage en blocs limite l'effet à « +1 / −1 bloc » ; si une page en produit chaque jour, ajouter à la source un
  champ `ignorer` (expressions à retirer avant l'empreinte). Non réalisé d'emblée.
- **Sites qui refusent les robots** (marinetondelier.fr le fait déjà ; attalpresident.fr était inaccessible le
  2026-10-31) : la source sera muette ; le dépôt de PDF reste le seul moyen.
- **Pages construites par JavaScript** : le texte n'est pas dans le HTML reçu, l'empreinte est vide ou constante.
  Détecté à l'essai (0 bloc) : la source est alors remplacée par un plan de site avec dates, ou par le Drive.
- **Adresses non éprouvées** : le poste de développement ne joint pas ces sites. Seul le lancement manuel du
  workflow en mode essai dit quelles sources fonctionnent.
- **Durée** : 7 programmes × 120 pages × 2 s ≈ 28 minutes au pire ; acceptable pour un workflow quotidien.
