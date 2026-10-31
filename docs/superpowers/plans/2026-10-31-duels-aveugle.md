# Duels à l'aveugle — plan de travail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter aux fiches la proposition qui fonde chaque rattachement, puis produire les textes à l'aveugle, le module de tirage et d'évaluation des duels, et la méthode publiée.

**Architecture:** Les données vivent dans les fiches (nouvelle colonne), contrôlées par le validateur. L'anonymisation tourne à la génération (`npm run comparatifs`) et alimente `donnees/base.json` et `comparatifs/duels.md`. Le tirage et l'évaluation sont dans un module navigateur sans dépendance, au tirage injectable, comme `parcours.mjs`.

**Tech Stack:** Node.js ≥ 20, modules ES, `node:test`, dépendance unique `yaml`.

**Spec:** `docs/superpowers/specs/2026-10-31-duels-aveugle-design.md`

## Global Constraints

- Langue : français partout (code, messages, docs). Commits signés `-c user.name=Julien -c user.email=julien.terset@gmail.com`.
- `npm run valider` : 0 erreur ; `npm test` vert ; `npm run comparatifs -- --verifier` vert avant chaque PR.
- Nombre de duels : **6** ; plafond : **2** apparitions par candidat ; indicateur affiché si **≥ 3** duels comptés (`SEUILS.minDuels`, inchangé).
- Texte à l'aveugle : exclu s'il est vide, dépasse **300** caractères ou contient un terme interdit.
- `duels.mjs` : aucune dépendance, aucun accès disque, tirage `aleatoire` injectable (défaut `Math.random`).
- Deux PR : « données » (tâches 1-2), puis « duels » (tâches 3-6).

## Review Focus

1. Parenthèses non équilibrées ou imbriquées dans un texte (« (dont (x) » ) : le nettoyage ne doit ni planter ni laisser de fragment ; texte éventuellement vide → exclu « vide ». Test en tâche 3.
2. Utilisateur dont l'option n'a que des adversaires voisins : duel avec adversaire voisin, et préférer sa mesure = écart. Test en tâche 5.
3. Base où aucun dilemme n'est éligible (utilisateur tout « sans avis ») : `preparerDuels` renvoie 0 duel sans erreur, `evaluerDuels([])` renvoie `taux: null`. Test en tâche 5.
4. Texte à l'aveugle contenant `|` ou un saut de ligne : la page `duels.md` reste un tableau valide. Test en tâche 4.
5. Une même proposition fondant deux rattachements d'un candidat : acceptée par le validateur, présente dans les deux dilemmes. Test en tâche 1.

---

### Task 1: Colonne « proposition » dans le tableau des dilemmes (PR « données »)

**Files:**
- Modify: `scripts/lib/validation.mjs` (section « Réponses aux dilemmes » de `validerFiche`)
- Modify: `candidats/_modele.md`, les 12 `candidats/*.md` (insertion de la colonne vide, par script ponctuel non committé)
- Modify: `README.md` (gabarit décrit, tableau des contrôles), `tests/validation.test.mjs` (helper `ficheValide`)
- Test: `tests/validation.test.mjs`

**Interfaces:**
- Produces: tableau `| dilemme | option | proposition | justification | source |` ; `fiche.dilemmes` du validateur inchangé (Map id → option).

- [ ] **Step 1: Tests qui échouent** dans `tests/validation.test.mjs` (adapter `ficheValide` pour produire la nouvelle colonne, `D-social-retraites` avec `eco-01`) :
  - `colonne proposition absente` → erreur `/tableau des réponses \(colonnes dilemme, option, proposition, justification, source\) introuvable/`
  - `proposition inconnue` (`eco-99`) → erreur `/« D-social-retraites » : proposition « eco-99 » absente des propositions de la fiche/`
  - `proposition avec pas de position` → erreur `/proposition renseignée pour une réponse « pas de position »/`
  - `lettre sans proposition` → avertissement `/« D-social-retraites » : option « A » sans proposition/`, aucune erreur
  - `même proposition pour deux dilemmes` → 0 erreur
- [ ] **Step 2:** `npm test` → les 5 tests échouent.
- [ ] **Step 3:** Dans `validerFiche`, exiger la colonne `proposition` et appliquer les règles du spec, section 2. Le contrôle d'existence se fait après la lecture des propositions (déplacer la vérification après la section « Propositions par thème », comme pour les phares).
- [ ] **Step 4:** Insérer la colonne vide dans `_modele.md` et les 12 fiches (alignement non requis). `npm test` vert ; `npm run valider` : 0 erreur, avertissements « sans proposition » attendus.
- [ ] **Step 5:** README : tableau des réponses du gabarit et ligne « Dilemmes (fiche) » du tableau des contrôles. Commit.

### Task 2: Remplissage des propositions et export (PR « données »)

**Files:**
- Modify: les 12 `candidats/*.md`
- Modify: `scripts/lib/extraction.mjs` (champ `proposition` dans `dilemmes`)
- Generate: `comparatifs/*`, `donnees/base.json`
- Test: `tests/generation.test.mjs`

**Interfaces:**
- Consumes: colonne de la tâche 1.
- Produces: `candidat.dilemmes[id] = { option, proposition, justification, sources }` (`proposition` : chaîne, vide si absente) dans `lireBase` et `base.json`.

- [ ] **Step 1: Test** `base réelle : proposition de dilemme présente dans la fiche` : pour chaque candidat et dilemme, `proposition === ''` ou l'id figure dans `c.propositions`.
- [ ] **Step 2:** Ajouter `proposition` à l'extraction ; test vert.
- [ ] **Step 3:** Script ponctuel (scratchpad, non committé) : pour chaque rattachement à une lettre, proposer le premier identifiant `<theme>-NN` cité dans la justification **avant** « il propose aussi » / « elle propose aussi » / « option X ». Classer : sûr (un seul id, de la fiche) ou douteux (aucun, plusieurs, id rattaché à une autre option).
- [ ] **Step 4:** Relire chaque proposition « sûre » contre la justification ; reporter les douteux dans la description de la PR (fiche, dilemme, option, candidats possibles, recommandation) pour arbitrage de Julien. Remplir les sûrs.
- [ ] **Step 5:** `npm run valider` (0 erreur), `npm run comparatifs`, `npm test`. Commit, PR « données » avec la liste des douteux. Appliquer les arbitrages de Julien avant fusion.

### Task 3: Anonymisation (PR « duels »)

**Files:**
- Create: `scripts/lib/anonymisation.mjs`, `referentiel/anonymisation.md`
- Test: `tests/anonymisation.test.mjs`

**Interfaces:**
- Produces:
  - `texteAveugle(texte: string): string`
  - `termesInterdits(candidats: Array<{ nom, parti }>, manuels: string[]): string[]`
  - `exclusion(texte: string, termes: string[]): null | 'vide' | 'trop long' | 'terme interdit : <terme>'`
  - `MAX_CARACTERES = 300`
  - `lireTermesManuels(racine): string[]` (tableau `| terme | motif |` de `referentiel/anonymisation.md`)

- [ ] **Step 1: Tests** :
  - `texteAveugle('Taxer les « méga héritages » (Public Sénat) [x](https://a.fr) ; ')` → `'Taxer les méga héritages'`
  - parenthèses imbriquées `'A (b (c) d) e'` → `'A e'` ; parenthèse non fermée `'A (b'` → `'A'`
  - `exclusion('x'.repeat(301), [])` → `'trop long'` ; `exclusion('', [])` → `'vide'`
  - `termesInterdits([{ nom: 'Marine Le Pen', parti: 'Rassemblement national' }], ['Jadot'])` contient `'Marine Le Pen'`, `'Le Pen'`, `'Rassemblement national'`, `'Jadot'`, pas `'Marine'`
  - `exclusion('accord avec yannick JADOT', ['Jadot'])` → `'terme interdit : Jadot'` ; `exclusion('la marine nationale', termes)` → `null` ; mot entier : `exclusion('Jadotisme', ['Jadot'])` → `null`
- [ ] **Step 2:** Tests en échec.
- [ ] **Step 3:** Implémenter (comparaison via `normaliser` de `markdown.mjs`). Créer `referentiel/anonymisation.md` : principe, renvoi au spec, tableau `| terme | motif |` initialisé avec `Jadot` et `Brossat` (personnalités citées dans les fiches).
- [ ] **Step 4:** Tests verts. Commit.

### Task 4: Génération des participants et de `duels.md` (PR « duels »)

**Files:**
- Modify: `scripts/lib/generation.mjs`, `scripts/lib/extraction.mjs` (termes manuels), `scripts/lib/validation.mjs` (exclure `duels.md` comme `dilemmes.md`)
- Generate: `comparatifs/duels.md`, `donnees/base.json`
- Test: `tests/generation.test.mjs`

**Interfaces:**
- Consumes: tâche 3 ; `dilemmes[id].proposition` (tâche 2).
- Produces: `base.json` → `duels: { participants: { [dilemme]: { [option]: [{ candidat, proposition, texte }] } }, exclusions: [{ dilemme, candidat, proposition, motif }] }` ; `lireBase` expose `termesManuels: string[]`.

- [ ] **Step 1: Tests** sur la base synthétique (ajouter `proposition: 'eco-01'` à Dupont) :
  - `json.duels.participants['D-eco-dette'].A` = `[{ candidat: 'dupont-jean', proposition: 'eco-01', texte: "Baisse de l'IR | partielle" }]`
  - un candidat dont le texte contient son nom → dans `exclusions` avec motif `terme interdit : …`, absent des participants
  - `duels.md` : tableau valide malgré `|` (cellule `Baisse de l'IR / partielle`), section « Exclusions »
  - `aucune` / `pas de position` jamais participants
- [ ] **Step 2:** Tests en échec.
- [ ] **Step 3:** Implémenter ; page `duels.md` : en-tête généré, puis par thème et dilemme un tableau `| option | candidat | proposition | texte à l'aveugle |`, puis `## Exclusions` `| dilemme | candidat | proposition | motif |`.
- [ ] **Step 4:** `npm run comparatifs`, `npm run valider`, `npm test`, `--verifier` verts. Relire `comparatifs/duels.md` : tout texte qui trahit son auteur → terme ajouté à `referentiel/anonymisation.md`, régénérer. Commit.

### Task 5: Module `duels.mjs` (PR « duels »)

**Files:**
- Create: `scripts/lib/duels.mjs`
- Modify: `scripts/lib/proximite.mjs` (supprimer `calculerPreferencesAveugle`), `tests/proximite.test.mjs` (supprimer son test)
- Test: `tests/duels.test.mjs`

**Interfaces:**
- Consumes: `SEUILS.minDuels` de `proximite.mjs` ; forme `duels.participants` de la tâche 4 ; `dilemmes` : id → `{ voisines: string[][] }`.
- Produces:
  - `DUELS = { nombre: 6, maxApparitions: 2 }`
  - `preparerDuels({ dilemmes, ordre, reponses, participants, aleatoire }) → { duels: Array<{ dilemme, optionUtilisateur, gauche, droite }>, eligibles: number }`, côté = `{ candidat, option, proposition, texte, utilisateur: boolean }`
  - `evaluerDuels(duels, choix: Array<'gauche'|'droite'|'aucune'|'les deux'>) → { details: Array<{ dilemme, statut: 'cohérent'|'écart'|'non compté' }>, coherents, comptes, taux: number|null }`

- [ ] **Step 1: Tests** (tirage injecté renvoyant une suite fixe) :
  - « sans avis » ignoré ; dilemme sans participant de l'option utilisateur ignoré ; sans adversaire ignoré
  - adversaire pris hors voisines quand il existe ; voisine seulement sinon
  - plafond : un candidat seul porteur de son option sur 3 dilemmes n'apparaît que 2 fois, le 3ᵉ dilemme est passé
  - au plus 6 duels, dans l'ordre de `ordre` ; `eligibles` compte tous les dilemmes éligibles
  - même tirage → même résultat ; côté utilisateur tantôt à gauche, tantôt à droite selon le tirage
  - `evaluerDuels` : choix du côté `utilisateur` → cohérent ; autre côté (y compris voisin) → écart ; `aucune`/`les deux` → non compté ; `comptes = 2` → `taux: null` ; `[]` → `{ details: [], coherents: 0, comptes: 0, taux: null }`
- [ ] **Step 2:** Tests en échec.
- [ ] **Step 3:** Implémenter (tirage uniforme : `Math.floor(aleatoire() * n)`, un appel par tirage, dans l'ordre utilisateur → adversaire → côté). Supprimer l'ancienne fonction et son test.
- [ ] **Step 4:** `npm test` vert. Commit.

### Task 6: Méthode publiée et documentation (PR « duels »)

**Files:**
- Modify: `referentiel/methode-proximite.md` (ligne « Choix à l'aveugle », section 5 réécrite, exemple chiffré des duels), `README.md`, `CLAUDE.md`
- Test: `tests/duels.test.mjs` (exemple de la méthode)

**Interfaces:**
- Consumes: `preparerDuels`, `evaluerDuels` (tâche 5).

- [ ] **Step 1:** Réécrire la section 5 avec les règles du spec, section 1 (éligibilité, tirage, plafond, côtés, indicateur, révélation, moins de 6 duels). Ajouter un exemple : 6 duels, choix de l'utilisateur, statuts, résultat « 4 duels cohérents sur 5 comptés ».
- [ ] **Step 2: Test** `exemple de la méthode` : reprend les choix et statuts de l'exemple et vérifie `coherents: 4, comptes: 5, taux: 0.8`.
- [ ] **Step 3:** README (section duels, arborescence : `anonymisation.md`, `duels.md`), CLAUDE.md (état, nombre de tests). `npm test`, `npm run valider`, `--verifier` verts. Commit, PR « duels ».
