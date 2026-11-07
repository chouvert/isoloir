# Veille et mise à jour hebdomadaire — plan de réalisation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal :** collecter chaque jour, sans Claude, l'actualité des candidats dans un journal hebdomadaire, et
outiller la session Claude du samedi (liste des candidats, fiches, référentiel) pour une PR lisible en 15 minutes.

**Architecture :** une bibliothèque pure `scripts/lib/veille.mjs` (lecture des flux, filtre, dédoublonnage,
journal) testée hors réseau ; un script d'entrée `scripts/veille.mjs` qui fait les accès réseau et disque ;
un workflow GitHub quotidien qui écrit sur la branche `veille`. Côté base : champ `inclus` des fiches, date
de version du référentiel, contrôle « aucune donnée utilisateur conservée ». La procédure du samedi vit
dans `CLAUDE.md` ; deux tâches planifiées Claude y renvoient.

**Tech stack :** Node ≥ 20 (CI en Node 22), modules ES, `node:test`, dépendance existante `yaml` ; aucune
nouvelle dépendance. GitHub Actions. Tâches planifiées Claude.

**Spec :** `docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md`

## Global Constraints

- Aucune nouvelle dépendance npm ; `fetch` natif ; analyseur RSS/Atom/sitemap minimal maison.
- Client HTTP nommé `isoloir-veille (+https://github.com/chouvert/isoloir)`, sans adresse personnelle ;
  une requête à la fois, 2 s entre deux requêtes, expiration à 15 s, respect de `robots.txt`.
- Jamais le texte intégral d'un article : titre, lien, date, chapô de 300 caractères au plus.
- Identifiant d'information : `AAAA-MM-JJ-<8 premiers caractères hexadécimaux du SHA-1 de l'URL normalisée>`.
- Semaine ISO, notée `AAAA-Sxx` (deux chiffres).
- Source muette : au-delà de 3 échecs consécutifs (erreur réseau, statut HTTP ≠ 200, ou aucun élément lu).
- Cron du workflow : `0 5 * * *` (UTC) ; écriture uniquement sur la branche `veille`, jamais fusionnée dans `main`.
- Plafonds du samedi : 8 informations ouvertes par candidat, 1 fiche nouvelle, 1 changement de référentiel par semaine.
- Champ `inclus` : `oui` | `non`, `oui` si absent.
- Interdits dans `site/src` : `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `fetch(` vers une URL `http(s)://`.
- Commits signés `-c user.name=Julien -c user.email=julien.terset@gmail.com` ; PR via `gh api repos/chouvert/isoloir/pulls`.
- Après toute modification de fiche ou de référentiel : `npm run comparatifs` et committer le résultat (la CI le vérifie).

## Review Focus

1. **Dates de flux hétérogènes** (RSS `pubDate` au format RFC 822, Atom `updated` ISO, date absente ou illisible) :
   l'élément est gardé avec la date de collecte, jamais perdu ni daté en 1970. Test dans la tâche 4.
2. **Noms ambigus** (« Philippe » est aussi un prénom, « Attal » apparaît dans un nom composé) : la détection ne
   s'appuie que sur les noms complets et les alias déclarés, insensible à la casse et aux accents, en mots
   entiers. Test dans la tâche 4.
3. **Même article sous deux URL** (paramètres `utm_*`, `fbclid`, ancre, barre finale) ou dans deux sources : une
   seule information. Test dans la tâche 4.
4. **Source qui répond 200 mais ne donne rien** (page d'erreur, changement de format) : comptée comme échec,
   donc signalée muette au bout de 3 jours. Test dans la tâche 5.
5. **Semaine à cheval sur deux années** : le 2027-01-01 appartient à `2026-S53`. Test dans la tâche 4.

---

### Task 1 : champ `inclus` des fiches

**Files :**
- Modify : `candidats/_modele.md` (frontmatter), `scripts/lib/validation.mjs` (`validerFiche`, `validerBase`),
  `scripts/lib/extraction.mjs` (`lireFiche`), `site/src/lib/donnees.js` (`candidats`)
- Test : `tests/validation.test.mjs`, `tests/generation.test.mjs`

**Interfaces :**
- Produces : `candidat.inclus: boolean` dans `lireBase(racine).candidats[]` et dans `donnees/base.json` ;
  constante `VALEURS_INCLUS = ['oui', 'non']` exportée par `validation.mjs`.

- [ ] **Step 1 : tests qui échouent**
  - `validation` : `inclus: peut-être` → erreur contenant « inclus » et « oui | non ».
  - `validation` : fiche `dupont-jean` sans `inclus` et sans mention dans `referentiel/candidats-inclus.md`
    de la base de test → erreur « `dupont-jean` incluse mais absente des sections « Inclus » de candidats-inclus.md ».
  - `validation` : même fiche avec `inclus: non` et absente des sections « Inclus » → aucune erreur ;
    avec `inclus: non` mais présente (`` `dupont-jean` `` dans une section « Inclus ») → erreur.
  - `generation` : `lireBase` renvoie `inclus: true` sans champ, `inclus: false` avec `inclus: non`.
  (La base de test copie déjà le référentiel : y ajouter `` `dupont-jean` `` dans la section
  « Inclus au titre des sondages » pour les cas valides existants.)
- [ ] **Step 2 :** `npm test` → les nouveaux tests échouent.
- [ ] **Step 3 : implémenter.**
  - Gabarit : ligne `inclus: oui            # oui | non (voir referentiel/candidats-inclus.md)` après `statut`.
  - `validerFiche` : contrôle de la valeur.
  - `validerBase` : lire `referentiel/candidats-inclus.md` ; les sections `##` dont le titre commence par
    « Inclus » forment l'ensemble des identifiants cités entre accents graves ; contrôle croisé dans les deux sens
    (fichier absent → contrôle sauté, pas d'erreur).
  - `lireFiche` : `inclus: data.inclus !== 'non'`.
  - `donnees.js` : `candidats` ne garde que `c.inclus !== false` ; ajouter `tousLesCandidats` (tous, même ordre).
- [ ] **Step 4 :** `npm test`, `npm run valider`, `npm run comparatifs`, `cd site && npm run build` → tout passe.
- [ ] **Step 5 :** commit « Fiches : champ inclus et contrôle croisé avec candidats-inclus.md ».

### Task 2 : date de version du référentiel

**Files :**
- Create : `referentiel/version.yml` (`date: 2026-11-07`, commentaire : « à mettre à jour à chaque modification
  d'une question, d'un dilemme, d'un thème ou d'une préoccupation »)
- Modify : `scripts/lib/validation.mjs`, `scripts/lib/extraction.mjs` (`lireBase`), `scripts/lib/generation.mjs` (`donnees`)
- Test : `tests/validation.test.mjs`, `tests/generation.test.mjs`

**Interfaces :**
- Produces : `lireBase(racine).referentielMaj: string` (AAAA-MM-JJ) ; `donnees(base).referentiel_maj`.

Écart assumé avec la spec (« calculée ») : la génération ne lit pas Git ; la date est déclarée dans
`version.yml`, et la procédure du samedi (tâche 7) impose de la mettre à jour dans toute PR « Référentiel ».

- [ ] **Step 1 : tests qui échouent** — `version.yml` absent → erreur « fichier obligatoire manquant » ;
  `date: hier` → erreur « n'est pas une date AAAA-MM-JJ » ; `donnees(lireBase(base de test)).referentiel_maj === '2026-11-07'`.
- [ ] **Step 2 :** `npm test` → échec.
- [ ] **Step 3 :** ajouter `referentiel/version.yml` à la liste des fichiers obligatoires de `validerBase`, contrôler la date
  (`estDateIso`), la lire dans `lireBase` (`yaml`), l'exporter dans `donnees`.
- [ ] **Step 4 :** `npm test`, `npm run valider`, `npm run comparatifs` → passe.
- [ ] **Step 5 :** commit « Référentiel : date de version exportée dans base.json ».

### Task 3 : aucune donnée utilisateur conservée

**Files :**
- Modify : `scripts/lib/validation.mjs` (`validerBase`), `README.md` (section « Calcul de proximité »),
  `identite/charte.md` (règles de neutralité)
- Test : `tests/validation.test.mjs`

**Interfaces :**
- Produces : `MOTIFS_STOCKAGE` (tableau de `{ motif: RegExp, libelle: string }`) exporté par `validation.mjs`.

- [ ] **Step 1 : tests qui échouent** — base de test avec `site/src/pages/x.astro` contenant
  `localStorage.setItem('a', 1)` → erreur sur ce fichier et cette ligne, message contenant « localStorage » et
  « aucune donnée utilisateur ne doit être conservée » ; idem `document.cookie`, `sessionStorage`, `indexedDB`,
  `fetch('https://exemple.fr/api')` ; `fetch('/isoloir/donnees.json')` et le mot « cookie » dans un texte affiché
  (`<p>Aucun cookie</p>`) → aucune erreur ; dossier `site/src` absent → aucune erreur.
- [ ] **Step 2 :** `npm test` → échec.
- [ ] **Step 3 :** parcours récursif de `site/src` (extensions `.astro`, `.js`, `.mjs`, `.ts`, `.jsx`, `.tsx`, `.vue`, `.svelte`),
  une erreur par ligne fautive. Motifs : `\blocalStorage\b`, `\bsessionStorage\b`, `\bindexedDB\b`, `document\.cookie`,
  `fetch\(\s*['"\`]https?://`. Texte dans le README et la charte : « L'Isoloir ne conserve aucune réponse : ni cookie, ni
  stockage du navigateur, ni base de données. Recharger la page efface le parcours. Le contrôle de la base le vérifie. »
- [ ] **Step 4 :** `npm test`, `npm run valider` → passe (le site actuel n'utilise aucun de ces motifs).
- [ ] **Step 5 :** commit « Contrôle : aucune donnée utilisateur conservée par le site ».

### Task 4 : bibliothèque de veille

**Files :**
- Create : `scripts/lib/veille.mjs`, `tests/veille.test.mjs`, `tests/fixtures/veille/flux-rss.xml`,
  `flux-atom.xml`, `sitemap.xml`, `page.html`, `robots.txt`

**Interfaces (toutes pures, sans réseau ni disque) :**
- `lireFlux(xml: string): Element[]` — RSS `item` et Atom `entry`.
- `lireSitemap(xml: string): Element[]` — `url` avec `loc` et `lastmod`.
- `lirePage(html: string, urlPage: string): Element[]` — liens `<a href>` absolus ou résolus, texte du lien comme titre,
  mêmes hôte que la page uniquement, sans date.
- `Element = { titre: string, lien: string, date: string|null, chapo: string }` ; `chapo` sans balises, ≤ 300 caractères.
- `dateIso(texte: string|null): string|null` — accepte RFC 822 et ISO 8601, renvoie `AAAA-MM-JJ` ou `null`.
- `normaliserUrl(url: string): string` — retire `utm_*`, `fbclid`, `gclid`, `xtor`, l'ancre, la barre finale ; hôte en minuscules.
- `identifiant(date: string, url: string): string` — voir Global Constraints (`node:crypto`).
- `semaineIso(date: string): string` — `AAAA-Sxx`.
- `detecter(texte: string, { candidats: Map<id, string[]>, motsCles: string[] }): { candidats: string[], motsCles: string[] }`
  — insensible à la casse et aux accents, mots entiers.
- `autoriseParRobots(robots: string, chemin: string): boolean` — règles `User-agent: *` et `isoloir-veille`, `Disallow` par préfixe.
- `retenir(element, source, detection): boolean` — vrai si `source.categorie` ∈ {`campagne`, `parti`} ou si la détection
  trouve un candidat ou un mot-clé.
- `Info = { id, semaine, source, categorie, date, collecte, titre, lien, chapo, candidats, motsCles }` ;
  `candidats` = détectés ∪ `source.candidats` (sauf `transverse`).
- `journalMarkdown(infos: Info[], { semaine, muettes: {source, depuis}[] }): string` — titre `# Veille — AAAA-Sxx`,
  bloc « Sources muettes » en tête s'il y en a, puis une section `## <id candidat>` par candidat (ordre alphabétique),
  puis `## transverse` ; une ligne par info : `- AAAA-MM-JJ · [titre](lien) · source — chapô`.

- [ ] **Step 1 : tests qui échouent** (fixtures : un RSS de 3 items dont un sans date et un avec `pubDate`
  « Fri, 06 Nov 2026 17:30:00 +0100 », un Atom de 2 entrées, un sitemap de 2 URL, une page de 4 liens dont un externe) :
  - `lireFlux(rss).length === 3` ; date RFC 822 → `'2026-11-06'` ; item sans date → `date === null` ;
    `chapo` sans balise et ≤ 300 caractères.
  - `lireFlux(atom)` : 2 éléments, dates ISO.
  - `lirePage(html, 'https://site.fr/actu/')` : 3 éléments (lien externe écarté), liens relatifs résolus.
  - `normaliserUrl('https://Site.fr/a/?utm_source=x&id=2#haut') === 'https://site.fr/a?id=2'`.
  - `identifiant('2026-11-06', 'https://site.fr/a')` : motif `/^2026-11-06-[0-9a-f]{8}$/`, stable entre deux appels.
  - `semaineIso('2026-11-07') === '2026-S45'` ; `semaineIso('2027-01-01') === '2026-S53'` ; `semaineIso('2027-01-04') === '2027-S01'`.
  - `detecter('Édouard PHILIPPE à Lyon', …)` trouve `philippe-edouard` ; `detecter('le roi Philippe', …)` ne trouve rien
    (alias = noms complets) ; `detecter('les primaires', { motsCles: ['primaire'] })` trouve « primaire » (pluriel accepté :
    le mot-clé correspond en début de mot).
  - `autoriseParRobots('User-agent: *\nDisallow: /prive', '/prive/x') === false`, `'/actu' → true`.
  - `retenir` : source `campagne` sans détection → vrai ; source `presse` sans détection → faux.
  - `journalMarkdown` : sources muettes en tête, sections dans l'ordre attendu, information sans candidat sous « transverse ».
- [ ] **Step 2 :** `node --test tests/veille.test.mjs` → échec (module absent).
- [ ] **Step 3 :** implémenter avec des expressions régulières (pas d'analyseur DOM) ; décoder les entités HTML courantes
  et les sections `CDATA`.
- [ ] **Step 4 :** `npm test` → tout passe.
- [ ] **Step 5 :** commit « Veille : bibliothèque de lecture et de tri des flux ».

### Task 5 : collecte et workflow quotidien

**Files :**
- Create : `scripts/veille.mjs`, `veille/sources.yml` (2 sources de démonstration : un flux RSS de Public Sénat et
  la page des sondages en.wikipedia), `veille/mots-cles.yml`, `.github/workflows/veille.yml`
- Modify : `scripts/lib/veille.mjs` (fonction `collecter`), `tests/veille.test.mjs`, `package.json` (script `"veille"`)

**Interfaces :**
- Consumes : tâche 4.
- Produces : `collecter({ sources, candidats, motsCles, etat, vus, lireUrl, maintenant }): Promise<{ infos: Info[], etat, vus: Set<string> }>`
  où `lireUrl(url): Promise<{ statut: number, texte: string }>` est injecté (le vrai `fetch` dans le script, un faux
  dans les tests) ; `etat = { [sourceId]: { dernierSucces: string|null, echecs: number } }` ;
  `sourcesMuettes(etat, seuil = 3): { source, depuis }[]`.
- Format de `veille/mots-cles.yml` : `mots_cles: [primaire, sondage, candidature, retrait, programme, parrainages, investiture, désistement]`
  et `a_surveiller: { cazeneuve-bernard: [Bernard Cazeneuve], bertrand-xavier: [Xavier Bertrand], polony-natacha: [Natacha Polony],
  hollande-francois: [François Hollande], bardella-jordan: [Jordan Bardella] }`.
- Alias des candidats inclus : champ `nom` de chaque fiche (`inclus` ≠ `non`) ; complétés par `alias:` facultatif dans
  `mots-cles.yml` (`alias: { le-pen-marine: [Marine Le Pen] }`).

- [ ] **Step 1 : tests qui échouent** (faux `lireUrl`) :
  - deux sources renvoyant le même article sous deux URL (une avec `utm_source`) → une seule `Info` ;
  - URL déjà dans `vus` → ignorée ;
  - source en 500 trois jours de suite → `echecs === 3` et présente dans `sourcesMuettes` ; un succès remet `echecs` à 0 ;
  - source en 200 sans aucun élément lisible → comptée comme échec ;
  - `robots.txt` interdisant le chemin → source non lue, comptée comme échec, aucune `Info` ;
  - élément sans date → `date` = date de `maintenant`.
- [ ] **Step 2 :** `node --test tests/veille.test.mjs` → échec.
- [ ] **Step 3 : implémenter.**
  - `collecter` : sources lues l'une après l'autre ; `robots.txt` lu une fois par hôte.
  - `scripts/veille.mjs --sortie <dossier>` : lit `veille/*.yml` et les fiches, lit et réécrit dans `<dossier>` les fichiers
    `etat.json`, `vus.txt`, `AAAA-Sxx.jsonl` (ajout), `AAAA-Sxx.md` (régénéré depuis le JSONL de la semaine) ;
    vrai `lireUrl` : `fetch` avec l'en-tête `User-Agent`, `AbortSignal.timeout(15000)`, 2 s entre deux requêtes.
  - Workflow : déclencheurs `schedule: cron '0 5 * * *'` et `workflow_dispatch` ; `permissions: contents: write` ;
    `actions/checkout@v4` de `main`, puis de la branche `veille` dans `veille-donnees/` (créée orpheline si absente) ;
    `npm ci` ; `node scripts/veille.mjs --sortie veille-donnees` ; commit « Veille AAAA-MM-JJ » et push sur `veille`
    seulement s'il y a des changements.
- [ ] **Step 4 :** `npm test` → passe ; `npm run valider` → passe.
- [ ] **Step 5 :** commit « Veille : collecte quotidienne sur la branche veille ».
- [ ] **Step 6 : vérification réelle après fusion** — lancer le workflow à la main
  (`gh api -X POST repos/chouvert/isoloir/actions/workflows/veille.yml/dispatches -f ref=main`), puis lire sur la branche `veille`
  `etat.json` (les 2 sources en succès) et le journal de la semaine (au moins une information).

### Task 6 : liste des sources

**Files :**
- Modify : `veille/sources.yml`

Le réseau du poste de développement ne permet pas de tester les sources : on les découvre par recherche web, on les
inscrit, et c'est le workflow (tâche 5, étape 6) qui les éprouve.

- [ ] **Step 1 :** pour chacun des 12 candidats inclus : site de campagne et site du parti — flux RSS s'il existe
  (`/feed`, `/rss`, `<link rel="alternate" type="application/rss+xml">`), sinon page d'actualités (`type: page`) ou plan de site.
  Transverses : Public Sénat (politique), LCP (actualités), La Gazette France (politique), en.wikipedia « Opinion polling for the
  2027 French presidential election » (`type: page`), Commission des sondages (notices présidentielle 2027, `type: page`).
  Chaque entrée : `id` en kebab-case, `nom`, `type`, `url`, `categorie`, `candidats`.
- [ ] **Step 2 :** `npm test` (un test de `veille.test.mjs` lit le vrai `sources.yml` : identifiants uniques, `type` et `categorie`
  autorisés, `url` en https, `candidats` = `transverse` ou identifiants de fiches existantes) → passe.
- [ ] **Step 3 :** commit, PR, fusion par Julien, puis lancement manuel du workflow ; les sources en échec sont corrigées ou
  retirées dans une PR de suivi, en notant dans le commentaire de `sources.yml` celles qui restent sans flux.

### Task 7 : procédure du samedi et registre des sujets

**Files :**
- Create : `referentiel/sujets-emergents.md`
- Modify : `CLAUDE.md` (nouvelle section « Mise à jour hebdomadaire » ; état et liste « À faire » mis à jour)

- [ ] **Step 1 :** `sujets-emergents.md` : rôle du fichier, déclencheurs (repris mot pour mot de la spec, § 3), tableau
  `sujet | thème | semaines | candidats | couvert par | décision`, vide.
- [ ] **Step 2 :** section « Mise à jour hebdomadaire » de `CLAUDE.md`, qui fait foi pour les tâches planifiées :
  étapes 1 à 6 de la spec (§ 2) ; plafonds ; règles de sortie, d'entrée et de primaire ; branche `maj-AAAA-Sxx` ; commit après
  chaque candidat ; reprise du dimanche (ne rien faire si une PR « Mise à jour AAAA-Sxx » existe, sinon repartir de la branche) ;
  seconde PR « Référentiel : … » (contenu de la spec § 3, mise à jour de `referentiel/version.yml`) ; gabarit exact du corps
  de la PR hebdomadaire (six rubriques de la spec, dans l'ordre, avec les en-têtes de tableaux) ; PR « aucun changement » les semaines creuses.
- [ ] **Step 3 :** `npm run valider` → passe.
- [ ] **Step 4 :** commit « Procédure de mise à jour hebdomadaire et registre des sujets émergents ».

### Task 8 : tâches planifiées

À faire après la fusion des tâches 1 à 7 et un premier passage réussi du workflow.

- [ ] **Step 1 :** consulter les tâches planifiées existantes, puis créer « L'Isoloir — mise à jour hebdomadaire » :
  `CRON_TZ=Europe/Paris 0 6 * * 6`, notification push, texte : « Dépôt chouvert/isoloir. Lis CLAUDE.md, section « Mise à jour
  hebdomadaire », et exécute-la pour la semaine en cours. »
- [ ] **Step 2 :** créer « L'Isoloir — rattrapage du dimanche » : `CRON_TZ=Europe/Paris 0 6 * * 0`, même texte précédé de
  « Rattrapage : si la PR de la semaine existe déjà, ne fais rien. »
- [ ] **Step 3 :** indiquer à Julien le réglage d'approbation obtenu par chaque tâche ; lancer la première à la main
  pour une semaine d'essai et vérifier que la PR suit le gabarit.
