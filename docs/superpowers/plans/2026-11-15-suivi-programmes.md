# Suivi des programmes — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** qu'une page de programme nouvelle ou modifiée apparaisse dans le journal de veille le lendemain, qu'elle
soit lue en entier le samedi ou demandée à Julien, et qu'un programme non lu soit visible dans la fiche et dans
`npm run valider`.

**Architecture :** le collecteur existant (`scripts/lib/veille.mjs`, pur et testé hors réseau ;
`scripts/veille.mjs` pour le réseau et le disque) reçoit un type de source `programme` qui compare chaque jour
l'empreinte du texte des pages d'un programme à celle de la veille, enregistrée dans `empreintes.json` sur la
branche `veille`. La procédure du samedi (`CLAUDE.md`) traite ces informations hors plafond. Les fiches déclarent
leur couverture du programme, contrôlée par `scripts/lib/validation.mjs`.

**Tech stack :** Node ≥ 20 (CI en Node 22), modules ES, `node:test`, `node:crypto`, dépendance existante `yaml` ;
aucune nouvelle dépendance. GitHub Actions.

**Spec :** `docs/superpowers/specs/2026-11-15-suivi-programmes-design.md` (à lire en entier avant la tâche 1 : elle
fixe les règles ; ce plan fixe l'ordre, les fichiers et les tests).

## Global Constraints

- Toutes les contraintes du plan `2026-11-07-veille-hebdomadaire.md` restent en vigueur (client HTTP
  `isoloir-veille`, une requête à la fois, 2 s d'attente, expiration à 15 s, `robots.txt`, chapô ≤ 300 caractères,
  identifiant `AAAA-MM-JJ-<8 hex>`, écriture sur la seule branche `veille`).
- **Aucun texte de programme enregistré** : codes de blocs (10 caractères hexadécimaux), titre de page, dates.
- Les formats de `etat.json`, `vus.txt`, `AAAA-Sxx.jsonl` et `AAAA-Sxx.md` ne changent pas pour les types existants ;
  les 131 tests existants passent sans modification de leurs attentes.
- Constantes : `MAX_PAGES_PROGRAMME = 120`, `PROFONDEUR_PROGRAMME = 3`, `MIN_BLOC = 20`, `LONGUEUR_CODE = 10` ;
  page retirée après `SEUIL_MUETTE` (3) absences consécutives.
- Le poste de développement ne joint pas les sites des candidats (proxy) : ne pas contourner. Les adresses sont
  éprouvées par le lancement manuel du workflow en mode essai (tâche 4).
- Travailler dans une worktree depuis `main` à jour (`git fetch origin main` puis
  `git worktree add -b <branche> <dossier> FETCH_HEAD`). Le dépôt local principal peut être en retard.
- Commits signés `-c user.name=Julien -c user.email=julien.terset@gmail.com` ; PR via
  `gh api repos/chouvert/isoloir/pulls`. Après toute modification de fiche : `npm run comparatifs` et committer.
- Deux PR : **PR 1** « Veille : suivi des programmes » (tâches 1 à 4), **PR 2** « Programmes : couverture et règle du
  samedi » (tâches 5 à 7). La tâche 8 se fait une fiche par PR.

## Review Focus

1. **Fausse modification** : une page en erreur, vide ou réordonnée ne doit rien signaler. Tests de la tâche 1 et 2.
2. **Premier passage** : une source `programme` neuve ne déverse pas 100 « pages nouvelles » dans le journal, mais
   une seule information « suivi commencé ». Test de la tâche 2.
3. **Budget réseau** : plafond de pages et de profondeur respectés, `robots.txt` contrôlé page par page, jamais
   deux lectures de la même adresse dans un passage. Test de la tâche 2.
4. **Compatibilité** : `collecter()` appelé sans `empreintes` ni `lireEntete` (tests existants) se comporte comme
   avant.
5. **Contrôle bloquant** : la tâche 6 ne doit pas rendre `npm run valider` rouge sur `main` ; les 13 fiches sont
   renseignées dans la même PR.

---

### Task 1 : empreinte et comparaison (fonctions pures)

**Fichiers :** `scripts/lib/veille.mjs`, `tests/veille.test.mjs`,
`tests/fixtures/veille/programme-chapitre-v1.html`, `programme-chapitre-v2.html`.

- [ ] Écrire les deux pages d'essai : une page de chapitre avec `<header>`, `<nav>`, `<main>` contenant un `h1`,
      six `p` ou `li` de plus de 20 caractères, un bouton court, `<footer>`, un `<script>`. La v2 : mêmes blocs dans
      un autre ordre, un paragraphe ajouté (« Relocaliser les productions essentielles… », texte d'essai inventé),
      un retiré, la date du pied de page changée, les classes CSS changées.
- [ ] Tests d'abord (ils échouent) :
  - `blocsDeTexte` : ne rend que les blocs de `<main>` ; ignore `nav`, `header`, `footer`, `script`, le bouton court ;
    page sans `<main>` ni `<article>` → blocs du `<body>` ; HTML vide → `[]`.
  - `codesDeBlocs` : codes de 10 caractères hexadécimaux, sans doublon, triés ; insensibles à la casse, aux accents
    et aux espaces multiples.
  - `comparerCodes(avant, apres)` : v1 → v2 donne `{ ajoutes: 1, retires: 1 }` ; v1 → v1 réordonnée donne `0 / 0`.
  - `titreDePage` : contenu de `<title>`, sinon premier `h1`, sinon l'adresse.
- [ ] Réaliser dans `scripts/lib/veille.mjs` (section « Programmes », après « Lecture des sources ») :
  - `export function blocsDeTexte(html)` → `string[]` (texte lisible de chaque bloc, dans l'ordre), selon la
    section « Empreinte d'une page » de la spec ; réutiliser `texte()` et `decoderEntites()`.
  - `export function codesDeBlocs(blocs)` → `string[]` ; réutiliser `plier()` et `createHash('sha1')`.
  - `export function comparerCodes(avant, apres)` → `{ ajoutes, retires, premierAjoute }` où `premierAjoute` est
    l'indice dans `apres` du premier code absent de `avant` (ou `-1`).
  - `export function titreDePage(html, url)`.
- [ ] `node --test tests/veille.test.mjs` : tout passe. Commit « Veille : empreinte des pages de programme ».

### Task 2 : suivi d'une source `programme` dans `collecter()`

**Fichiers :** `scripts/lib/veille.mjs`, `tests/veille.test.mjs`, `tests/fixtures/veille/programme-sommaire.html`.

- [ ] Page d'essai `programme-sommaire.html` : liens vers `/programme/livre/chapitre1/`, `/programme/livre/chapitre2/`
      (deux fois, dont une avec ancre `#section`), `/programme/plan.pdf`, `/evenement/reunion/` (hors préfixe),
      un site externe.
- [ ] Tests d'abord, avec un `lireUrl` et un `lireEntete` simulés (table adresse → réponse) :
  1. Premier passage : une seule information, `nature: 'programme-suivi'`, chapô « 4 pages suivies » ;
     `empreintes` rendu avec 4 adresses (sommaire, deux chapitres, PDF) ; le lien hors préfixe et le lien externe
     ne sont pas lus (vérifier la liste des adresses demandées).
  2. Deuxième passage, rien n'a changé → aucune information.
  3. Chapitre 2 passé en v2 → une information `programme-modifie`, titre « Programme : page modifiée — … »,
     chapô commençant par « +1 / −1 blocs · » suivi du début du bloc ajouté, ≤ 300 caractères ; rattachée au
     candidat de la source.
  4. Nouveau lien `/programme/livre/chapitre3/` dans le sommaire → `programme-nouveau` pour le chapitre 3 **et**
     `programme-modifie` pour le sommaire.
  5. Chapitre 1 en erreur 500 un jour → aucune information, empreinte conservée, `absences: 1` ; trois jours de
     suite → une information `programme-retire`, puis plus rien les jours suivants.
  6. PDF : `etag` changé → `programme-modifie` ; aucun en-tête → jamais « modifié ».
  7. `robots.txt` interdisant `/programme/livre/` → ces pages ne sont pas demandées ; point d'entrée interdit →
     échec de la source (`etat[source.id].echecs` augmente), aucune information.
  8. Plafond : avec `MAX_PAGES_PROGRAMME` ramené à 2 par un paramètre de test, 2 pages lues et une information
     `programme-plafond` ; pas de seconde information `programme-plafond` la même semaine ISO.
  9. Source avec `plan` : une adresse du plan du site sous le préfixe, absente des liens, est suivie.
  10. `collecter()` appelé sans `empreintes` ni `lireEntete` avec les seules sources existantes : résultat identique
      à avant (les tests existants suffisent ; ajouter une assertion que `resultat.empreintes` vaut `{}`).
- [ ] Réaliser :
  - `TYPES` gagne `'programme'`.
  - `export function liensProgramme(html, urlPage, prefixes)` → adresses normalisées du même site sous un préfixe
    (s'appuie sur la logique de `lirePage`, sans exiger de texte de lien).
  - `export async function suivreProgramme({ source, empreintes, lire, lireEntete, autorise, jour, maxPages })` →
    `{ infos, empreintes, succes }`. Parcours en largeur depuis `source.url`, profondeur ≤ `PROFONDEUR_PROGRAMME`,
    un ensemble des adresses déjà demandées ; `.pdf` par `lireEntete` ; règles de signalement de la spec.
  - `collecter()` : nouveaux paramètres facultatifs `empreintes = {}` et `lireEntete` ; pour `source.type ===
    'programme'`, appeler `suivreProgramme` au lieu de `LECTEURS` ; les informations reçoivent `id`, `semaine`,
    `source`, `categorie`, `date: jour`, `collecte: jour`, `candidats`, `motsCles: []`, `nature`. Rendre
    `{ infos, etat, vus, empreintes }`.
  - Le dédoublonnage par `vus` ne s'applique pas aux informations `programme-*` (une page modifiée est par
    définition déjà vue) ; leur adresse est tout de même ajoutée à `vus`.
- [ ] `node --test tests/*.test.mjs` : tout passe. Commit « Veille : source de type programme ».

### Task 3 : motifs, journal, script et workflow

**Fichiers :** `scripts/lib/veille.mjs`, `scripts/veille.mjs`, `.github/workflows/veille.yml`, `tests/veille.test.mjs`.

- [ ] Tests d'abord :
  - source `sitemap` avec `motifs: [programme, projet]` : après l'étalonnage, une adresse nouvelle
    `/notre-projet/sante` est gardée avec `nature: 'programme-apparu'` et le titre « Programme : page apparue — … » ;
    `/actualites/meeting` est écartée ; sans `motifs`, comportement inchangé.
  - `journalMarkdown` : dans la section d'un candidat, les informations `programme-*` viennent d'abord, précédées
    de « **Programme** · » ; le reste est inchangé (les attentes du test existant ne bougent pas).
  - `sources.yml : entrées bien formées` (test existant à étendre) : `programme` exige `url` et `candidats` en
    liste ; `prefixes` et `motifs` sont des listes de chaînes ; `plan` est une URL http(s).
- [ ] Réaliser `motifs` dans `collecter()` et l'ordre dans `journalMarkdown`.
- [ ] `scripts/veille.mjs` :
  - lire et écrire `empreintes.json` dans le dossier de sortie (JSON indenté, clés triées) ;
  - `lireEntete(url)` : `fetch` en `HEAD`, mêmes en-têtes et expiration ; rend `{ statut, etag, modifie, taille }` ;
  - option `--essai` : n'écrit aucun fichier ; affiche pour chaque source `programme` le nombre de pages suivies,
    le nombre de blocs par page (0 bloc = page construite par JavaScript) et les pages refusées ; pour chaque
    source à motifs, le nombre d'adresses du plan et celles qui correspondent ;
  - ligne de résumé : ajouter « N page(s) de programme suivie(s) ».
- [ ] `.github/workflows/veille.yml` : `workflow_dispatch` avec l'entrée booléenne `essai` (défaut `false`) ; en
      essai, l'étape « Collecte » passe `--essai` et l'étape « Publication » est sautée (`if:`).
- [ ] `node --test tests/*.test.mjs`, `npm run valider`. Commit « Veille : motifs, journal et mode essai ».

### Task 4 : sources et mise à l'épreuve

**Fichiers :** `veille/sources.yml`.

- [ ] Ajouter une source `programme` par programme publié, à partir du champ `programme_url` de chaque fiche
      (`grep -n programme_url candidats/*.md`) ; au 2026-11-15 :

  | id | url | prefixes |
  |----|-----|----------|
  | `attal-programme` | `https://attalpresident.fr/programme` | `[/programme]` |
  | `dupont-aignan-programme` | `https://www.dupontaignan.fr/actualite/presentation-du-projet-economique-2027/` | à fixer à l'essai (pages « Projet » citées dans la fiche) |
  | `lisnard-programme` | `https://www.unenouvelleenergie.fr/notre-programme/` | `[/notre-programme]` |
  | `melenchon-programme` | `https://melenchon2027.fr/programme/decouvrir/` | `[/programme/]` |
  | `philippe-programme` | `https://www.edouardphilippe.fr/programme` | `[/programme]` |
  | `ruffin-programme` | `https://nouspresident.fr/cahiers-de-campagne/` | `[/cahiers-de-campagne]` |
  | `tondelier-programme` | `https://lesecologistes.fr/pages/6ImK65GKUnvibm33WGkjkj/projet-2027` | à fixer à l'essai |

  `plan` : seulement si l'essai montre un `sitemap.xml` lisible. Ne pas inventer d'adresse : une adresse qui n'est
  ni dans une fiche ni dans `sources.yml` se vérifie d'abord à l'essai.
- [ ] Candidats sans `programme_url` (Batho, Glucksmann, Le Pen, Retailleau, Roussel, Zemmour) : pour chaque site
      de campagne ou de parti déjà présent dans `sources.yml` ou cité dans la fiche, ajouter une source `sitemap`
      avec `motifs: [programme, projet, propositions, mesures]` si le plan du site existe à l'essai. Sinon, le noter
      dans l'en-tête de `sources.yml` (« sans plan de site : recherche web le samedi »).
- [ ] Mettre à jour l'en-tête de `sources.yml` (types, champs `prefixes`, `plan`, `motifs`).
- [ ] Pousser la branche, ouvrir la PR 1, puis lancer l'essai :
      `gh workflow run veille.yml --ref <branche> -f essai=true`, lire le journal d'exécution
      (`gh run list --workflow veille.yml -L 1`, `gh run view <id> --log`).
- [ ] Corriger d'après l'essai : préfixes, sources à 0 bloc (JavaScript) remplacées par un plan de site ou
      retirées, sources refusées par `robots.txt` retirées. **Chaque source retirée devient une ligne de
      `veille/a-recuperer.md`** (programme du candidat, état `demandé`, date du jour) : le Drive en tient lieu.
- [ ] Écrire dans le corps de la PR 1 le tableau « source | résultat de l'essai | pages suivies ».
- [ ] Après la fusion par Julien : vérifier le lendemain sur la branche `veille` que `empreintes.json` existe et
      que le journal porte une information « suivi commencé » par source.

### Task 5 : couverture du programme dans les fiches

**Fichiers :** `candidats/_modele.md`, les 13 fiches de `candidats/`, `README.md`.

- [ ] Gabarit : ajouter après `programme_version` les champs `programme_lu:` (`complet | partiel | non`, vide sans
      programme) et `programme_lu_le:` ; ajouter après « Évolutions / revirements » la section facultative
      `## Couverture du programme` avec le tableau `| partie | adresse | lu le | état |` et un commentaire
      (« seulement si programme_lu vaut partiel ou non »).
- [ ] Vérifier que la section nouvelle ne perturbe ni `scripts/lib/extraction.mjs` ni `generation.mjs`
      (`npm run comparatifs` sans différence autre que celles attendues, `npm test`).
- [ ] Renseigner les 13 fiches **sans relire les programmes** : d'après `programme_version` et la section
      « Sources » de chaque fiche. Règle : `complet` seulement si la fiche dit avoir consulté tout le programme ;
      « non lu », « tronqué », « chapitre N non lu », « inaccessible » → `partiel` ou `non`, avec la section de
      couverture listant ce qui manque. Mélenchon : `non` pour le livre du 2026-11-06 (lu par comptes rendus),
      couverture listant les parties du livre d'après son sommaire si la tâche 4 l'a rendu lisible, sinon une ligne
      « livre entier ». En cas de doute : `partiel`.
- [ ] `README.md`, section des conventions : trois lignes sur `programme_lu` et la section de couverture.
- [ ] `npm run comparatifs`, commit « Fiches : couverture du programme ».

### Task 6 : contrôle dans `npm run valider`

**Fichiers :** `scripts/lib/validation.mjs`, `tests/validation.test.mjs`.

- [ ] Tests d'abord (fiches d'essai construites comme dans les tests existants de `validerFiche`) :
  - `programme_url` rempli, `programme_lu` absent ou invalide → erreur ;
  - `programme_lu: complet` → ni erreur ni avertissement ;
  - `partiel` avec section de couverture → avertissement « programme non lu en entier », pas d'erreur ;
  - `partiel` ou `non` sans section, sans ligne `demandé` dans `veille/a-recuperer.md` → erreur ;
  - `non` sans section mais avec une ligne `demandé` citant le candidat → avertissement seulement ;
  - `programme_url` vide et `programme_lu` vide → rien ; le gabarit (`{ gabarit: true }`) → rien ;
  - `programme_lu_le` présent et mal formé → erreur.
- [ ] Réaliser dans `validerFiche` (près du contrôle de `programme_url`, ligne ≈ 290) et lire
      `veille/a-recuperer.md` une fois dans `validerBase`. La correspondance avec le candidat se fait sur la colonne
      `candidat` du tableau (nom de famille, insensible à la casse et aux accents).
- [ ] `npm run valider` : 0 erreur sur le dépôt ; `npm test`. Commit « Contrôle : couverture du programme ».

### Task 7 : procédure du samedi

**Fichiers :** `CLAUDE.md`, `docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md` (renvoi d'une ligne).

- [ ] `CLAUDE.md`, « Mise à jour hebdomadaire » :
  - étape 1 : pour chaque candidat sans `programme_url`, une recherche web « programme » + nom ;
  - étape 3 : les informations « **Programme** » du journal sont hors du plafond des 8 liens et traitées d'abord ;
    page lue en entier, sinon ligne dans `veille/a-recuperer.md` ; programme entier nouveau : lecture étalée,
    chapitres liés aux dilemmes et aux questions d'abord ; mettre à jour `programme_lu`, `programme_lu_le` et la
    section de couverture (une page modifiée après lecture passe à `à relire`) ;
  - corps de la PR : section « ## Programmes » après « Candidats », tableau
    `| candidat | page | nouvelle ou modifiée | lue | effet sur la fiche |`, puis la liste des programmes non lus
    en entier (avertissements de `npm run valider`).
- [ ] `CLAUDE.md`, « Commandes » : nombre de tests à jour ; « État et suite » : point « Suivi des programmes »
      avec la remise à niveau restante (tâche 8).
- [ ] Ouvrir la PR 2 ; présenter à Julien les valeurs `programme_lu` retenues pour les 13 fiches.

### Task 8 : remise à niveau (une fiche par session et par PR)

- [ ] Ordre : Mélenchon (chapitre 2 signalé par Julien le 2026-11-15, mesure « Relocaliser les productions
      essentielles à la vie de notre pays »), puis les fiches `partiel` ou `non`, par score de sondage décroissant.
- [ ] Pour chaque fiche : méthode de `CLAUDE.md` (« Méthode de travail ») — lecture du programme page par page
      d'après la section de couverture, grille R1 à R5, vérification par un agent neuf, `npm run valider`,
      `npm run comparatifs`, PR ; présenter à Julien les changements de rattachement et de phares.
- [ ] Une page illisible (tronquée, refusée) : ligne dans `veille/a-recuperer.md`, la fiche reste `partiel`.
- [ ] Fin : toutes les fiches à programme publié sont `complet`, ou leur reste est demandé dans `a-recuperer.md`.

## Ce que ce plan ne fait pas

- Afficher la couverture du programme sur le site.
- Champ `ignorer` pour les textes changeants (seulement si l'essai ou les premières semaines montrent du bruit).
- Comparer deux versions d'un programme mesure par mesure (seul le nombre de blocs changés est donné).
