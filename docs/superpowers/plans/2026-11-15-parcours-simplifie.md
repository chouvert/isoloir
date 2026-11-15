# Parcours « Me situer » simplifié — plan de travail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Objectif :** ramener le parcours à trois étapes compréhensibles (vos sujets, les dilemmes, les duels), remplacer les 100 points par un réglage facultatif à réglettes, et montrer dans les duels des mesures en langage courant avec leur contexte.

**Architecture :** les règles de calcul nouvelles (niveaux ↔ points, rapport « N fois plus », définition du glossaire) vont dans `scripts/lib/` avec leurs tests ; `site/src/scripts/parcours.ts` ne fait qu'afficher et appeler ces modules. Les textes courts et le glossaire sont des données du dépôt, exportées dans `donnees/base.json`.

**Outils :** Node (`node --test`), Astro statique, Markdown versionné.

**Spec :** `docs/superpowers/specs/2026-11-15-parcours-simplifie-design.md` (à lire avant toute tâche).

## Contraintes générales

- Le calcul de proximité ne change pas : sans réglage manuel, mêmes scores qu'aujourd'hui pour les mêmes sujets et réponses.
- `site/src/scripts/parcours.ts` n'invente aucune règle de calcul ; aucun stockage des réponses (contrôlé par `npm run valider`).
- `identite/charte.md` : pétrole seul accent, un seul bouton principal par écran, aucune couleur de candidat, vouvoiement, pas de point d'exclamation, cibles tactiles de 44 px.
- Aucun nombre de points affiché à l'utilisateur, nulle part.
- Texte court : 200 caractères au plus ; définition de glossaire : 120 caractères au plus ; 4 duels ; réglettes de 0 à 10.
- Git : worktree depuis `FETCH_HEAD` (`git fetch origin main`), commits `-c user.name=Julien -c user.email=julien.terset@gmail.com`, PR par l'API REST, `npm run comparatifs` commité avant chaque PR.
- Avant chaque PR : `npm run valider` (0 erreur), `npm run comparatifs`, `npm test`, `cd site && npm run build`.

## Points de vigilance à la relecture

1. Toutes les réglettes à 0 : pas de division par zéro, bouton désactivé avec message (test en tâche 1, écran en tâche 3).
2. Retour aux sujets après un réglage manuel : le réglage est effacé et l'utilisateur en est prévenu ; les réponses déjà données aux dilemmes sont conservées (tâche 3).
3. Moins de 4 duels possibles (beaucoup de « sans avis », peu de textes courts) : l'écran de transition annonce le nombre réel, et zéro duel mène droit au résultat (tâche 3).
4. Terme du glossaire présent dans un mot plus long ou avec une autre casse (« TVA » dans « activation ») : la recherche se fait sur le mot entier, sans tenir compte de la casse (test en tâche 5).
5. Réglage manuel qui met à 0 le thème d'un sujet choisi : ses dilemmes ne sont pas posés (règle existante, test en tâche 1).

---

## PR 1 — « Parcours simplifié » (branche `parcours-simplifie`)

### Tâche 1 : règles des réglettes et du rapport

**Fichiers :** modifier `scripts/lib/parcours.mjs` ; tests dans `tests/parcours.test.mjs`.

**Interfaces produites :**
- `PARCOURS` gagne `niveauMax: 10` et `pointsParCran: 3`.
- `niveauxDepuisBudget(points: Record<string, number>): Record<string, number>` — `min(10, Math.round(points / 3))` par thème.
- `budgetDepuisNiveaux({ niveaux, aleatoire = Math.random }): Record<string, number>` — `100 × niveau / somme`, arrondi par `arrondirPlusFortReste` ; lève `Error('aucun thème retenu')` si la somme vaut 0 ; refuse un niveau hors de 0–10 ou non entier.
- `rapportSujets({ themes, preoccupations, choisies }): number | null` — sur les valeurs exactes avant arrondi : `(base + 40 × parts max / total des parts) / base`, avec `base = 60 / nombre de thèmes`, arrondi à l'entier ; `null` sans sujet choisi.

- [ ] **Étape 1 : écrire les tests** (ils échouent)

```js
test('niveaux de départ', () => {
  const n = niveauxDepuisBudget(budget(['P-fin-de-mois', 'P-retraite', 'P-climat']));
  assert.deepEqual([n.eco, n.social, n.env, n.secu], [6, 8, 6, 2]);
  assert.ok(Object.values(niveauxDepuisBudget(budget([]))).every((v) => v === 4));
  assert.equal(niveauxDepuisBudget({ eco: 47 }).eco, 10);
});
test('budget depuis les niveaux', () => {
  const egal = Object.fromEntries(THEMES.map((t) => [t, 4]));
  const b = budgetDepuisNiveaux({ niveaux: egal, aleatoire: tirageFixe() });
  assert.equal(somme(b), 100);
  assert.ok(Object.values(b).every((v) => v === 11 || v === 12));
  const seul = Object.fromEntries(THEMES.map((t) => [t, t === 'eco' ? 10 : 0]));
  assert.equal(budgetDepuisNiveaux({ niveaux: seul }).eco, 100);
  const zero = Object.fromEntries(THEMES.map((t) => [t, 0]));
  assert.throws(() => budgetDepuisNiveaux({ niveaux: zero }), /aucun thème retenu/);
  assert.throws(() => budgetDepuisNiveaux({ niveaux: { ...egal, eco: 11 } }));
});
test('rapport entre un thème choisi et un thème non choisi', () => {
  const r = (choisies) => rapportSujets({ themes: THEMES, preoccupations: ref.preoccupations, choisies });
  assert.equal(r([]), null);
  assert.equal(r(['P-retraite']), 7);
  assert.equal(r(['P-retraite', 'P-climat', 'P-dette']), 3);
  assert.equal(r(['P-fin-de-mois', 'P-retraite', 'P-climat']), 4);
});
test('un thème mis à 0 par réglage n’est pas abordé, même lié à un sujet choisi', () => {
  const niveaux = { ...Object.fromEntries(THEMES.map((t) => [t, 4])), social: 0 };
  const points = budgetDepuisNiveaux({ niveaux, aleatoire: tirageFixe() });
  const ordre = ordonnerDilemmes({ dilemmes: ref.dilemmes, preoccupations: ref.preoccupations, choisies: ['P-retraite'], points, aleatoire: tirageFixe() });
  assert.ok(!ordre.includes('D-social-retraites'));
});
```

- [ ] **Étape 2 :** `node --test tests/parcours.test.mjs` → échec (fonctions absentes).
- [ ] **Étape 3 :** écrire les trois fonctions et les deux constantes.
- [ ] **Étape 4 :** `node --test tests/parcours.test.mjs` → tout passe.
- [ ] **Étape 5 :** commit « Parcours : niveaux des réglettes et rapport des sujets ».

### Tâche 2 : quatre duels et méthode

**Fichiers :** `scripts/lib/duels.mjs` (`nombre: 4`), `tests/duels.test.mjs` (ligne 22 et tout test qui suppose 6), `referentiel/methode-proximite.md`, `referentiel/preoccupations.md`, `referentiel/version.yml` (date du jour).

- [ ] **Étape 1 :** passer l'assertion à `{ nombre: 4, maxApparitions: 2 }` ; lancer les tests → échec.
- [ ] **Étape 2 :** `nombre: 4` ; tests → passent.
- [ ] **Étape 3 :** mettre à jour la méthode : tableau des données (étapes 1 sujets, 2 dilemmes, 3 duels ; ligne « Poids des thèmes : déduits des sujets, réglables par des réglettes ») ; section 0 (budget calculé mais non affiché ; réglage facultatif ; niveau de départ ; conversion niveau → points ; budget pré-rempli conservé tant qu'aucune réglette n'est touchée) ; section 5 (« 4 premiers », contexte affiché, exemple ramené à 4 duels dont 3 comptés au moins). `preoccupations.md` : introduction (« Tout compte autant », étapes renumérotées).
- [ ] **Étape 4 :** `npm run valider && npm run comparatifs && npm test` → 0 erreur.
- [ ] **Étape 5 :** commit « Méthode : trois étapes, réglettes, quatre duels ».

### Tâche 3 : écrans du parcours

**Fichiers :** `site/src/scripts/parcours.ts`, `site/src/pages/me-situer.astro` (styles), `site/src/pages/index.astro` et `methode.astro` si elles citent les 4 étapes ou les 100 points.

**Interfaces consommées :** tâche 1 (`niveauxDepuisBudget`, `budgetDepuisNiveaux`, `rapportSujets`, `PARCOURS.niveauMax`).

**Décisions :**
- `Etape` : `'accueil' | 'preoccupations' | 'reglage' | 'dilemmes' | 'intro-duels' | 'duels' | 'resultat'` ; `ETAPES` de la tringle : `['preoccupations', 'dilemmes', 'duels']` (`reglage` compte comme étape 1, `intro-duels` comme étape 3).
- `Etat` gagne `niveaux: Record<string, number> | null` (`null` = réglage jamais touché). `points` vaut toujours `preremplirBudget(...)` si `niveaux === null`, sinon `budgetDepuisNiveaux({ niveaux })`.
- Écran « sujets » : textes de la spec (titre, consigne, encadré « À quoi ça sert », ligne « environ N fois plus » dès un sujet choisi) ; bouton principal « Passer aux questions avec N sujet(s) » → dilemmes ; liens « Tout compte autant » (vide `choisies`, → dilemmes) et « Régler moi-même » (→ réglage).
- Écran « réglage » : une `<input type="range" min="0" max="10" step="1">` par thème, `aria-valuetext` en mots (0 « ne compte pas », 1–3 « compte peu », 4–6 « compte », 7–10 « compte beaucoup ») ; événement `input` ; toutes à 0 → bouton désactivé et message « Gardez au moins un thème. » ; lien « Revenir à mes sujets ».
- Changer de sujets alors que `niveaux !== null` : remettre `niveaux` à `null` et afficher sur l'écran des sujets « Votre réglage a été remplacé par celui de vos nouveaux sujets. » ; les réponses aux dilemmes sont conservées (comportement actuel de `versDilemmes`).
- Écran « intro-duels » : la phrase de la spec avec le nombre réel de duels ; bouton « Commencer ». Zéro duel → résultat directement (comportement actuel).
- Écran « duel » : bandeau « Le sujet : <thème> » + énoncé complet du dilemme ; titre « Deux candidats proposent ceci. Que préférez-vous ? » ; légende de la spec.
- Résultat : retirer « N points » des titres de thème ; le reste est inchangé. Accueil : trois étapes, sans mention de points.
- Supprimer `ecranPriorites`, les actions `moins`, `plus`, `saisie` et les styles `.budget`.

- [ ] **Étape 1 :** appliquer les décisions ci-dessus.
- [ ] **Étape 2 :** `cd site && npm run build` → sans erreur ; `npm run valider` → 0 erreur (contrôle du stockage).
- [ ] **Étape 3 :** `cd site && npm run dev`, puis parcourir dans le navigateur, en 390 px et en large : (a) 3 sujets sans réglage jusqu'au résultat ; (b) réglage, une réglette à 0, vérifier que les dilemmes du thème ne sont pas posés ; (c) toutes à 0 ; (d) retour aux sujets après réglage ; (e) « sans avis » partout sauf 5 dilemmes, vérifier l'annonce du nombre de duels.
- [ ] **Étape 4 :** comparer les scores de (a) avec ceux de `main` pour les mêmes sujets et réponses (mêmes pourcentages, à l'arrondi aléatoire du budget près).
- [ ] **Étape 5 :** commit « Site : parcours en trois étapes, réglettes, duels avec leur contexte » ; mettre à jour le nombre de tests et la section « Site » du `CLAUDE.md` ; ouvrir la PR.

---

## PR 2 — « Duels en langage courant : règles » (branche `duels-langage-courant`, depuis PR 1 fusionnée)

À fusionner **le même jour que le premier lot de la PR 3** : entre les deux, peu de rattachements participent aux duels.

### Tâche 4 : règles de rédaction et validation du texte court

**Fichiers :** `referentiel/anonymisation.md`, `candidats/_modele.md`, `README.md` (règles de la spec, mot pour mot) ; `scripts/lib/anonymisation.mjs` ; `scripts/lib/validation.mjs` (lignes 363–366 et 426–433) ; `scripts/lib/generation.mjs` (`participantsDuels`) ; tests `validation.test.mjs`, `generation.test.mjs`, fixtures.

**Interfaces produites :** `MAX_TEXTE_COURT = 200` dans `anonymisation.mjs` (`MAX_CARACTERES` reste pour le nettoyage). `participantsDuels(base)` ne retient qu'un rattachement dont `texte_court` est rempli ; les autres vont dans `exclusions` avec le motif `'sans texte court'`.

- [ ] **Étape 1 : tests** — fixture avec trois rattachements : texte court de 201 caractères (avertissement « texte court de 201 caractères (200 au plus) » ; l'erreur au-delà de 300 reste), proposition sans texte court (avertissement « ajouter un texte court », absent de `participants`, présent dans `exclusions`), texte court conforme (présent dans `participants` avec ce texte).
- [ ] **Étape 2 :** tests → échec. **Étape 3 :** écrire. **Étape 4 :** tests → passent.
- [ ] **Étape 5 :** `npm run valider` → 0 erreur. La limite de 200 n'est qu'un **avertissement** dans cette PR, parce que des textes courts existants la dépassent et ne sont repris qu'en PR 3 ; la dernière PR de lot la transforme en erreur. Le noter dans le corps de la PR.
- [ ] **Étape 6 :** `npm run comparatifs` ; commit « Duels : texte court obligatoire, règles de rédaction ».

### Tâche 5 : glossaire

**Fichiers :** créer `referentiel/glossaire.md` (tableau `terme | définition`, 8 à 12 termes relevés dans `comparatifs/duels.md` : dépenses publiques, déficit, dette publique, impôt sur la fortune, CSG, TVA, cotisations, SMIC, âge légal, taux plein…) ; `scripts/lib/validation.mjs` (`lireReferentiel` → `ref.glossaire: Map<terme, definition>` ; erreurs : terme en double, définition vide ou de plus de 120 caractères) ; `scripts/lib/generation.mjs` (`base.glossaire: [{ terme, definition }]`) ; `scripts/lib/duels.mjs` ; `site/src/pages/me-situer.astro` et `parcours.ts` ; tests.

**Interface produite :** `definitionPour(texte: string, glossaire: { terme: string, definition: string }[]): { terme, definition } | null` dans `duels.mjs` — le terme dont la première occurrence est la plus à gauche dans le texte ; mot entier, sans tenir compte de la casse.

- [ ] **Étape 1 : tests**

```js
const g = [{ terme: 'TVA', definition: 'd1' }, { terme: 'impôt sur la fortune', definition: 'd2' }];
assert.equal(definitionPour('Baisser la tva sur le gaz', g).terme, 'TVA');
assert.equal(definitionPour('Faciliter l’activation des droits', g), null);
assert.equal(definitionPour('Rétablir l’impôt sur la fortune et baisser la TVA', g).terme, 'impôt sur la fortune');
assert.equal(definitionPour('Porter le salaire minimum à 1 700 euros', g), null);
```

- [ ] **Étape 2 :** échec. **Étape 3 :** écrire lecture, export et fonction. **Étape 4 :** tests → passent.
- [ ] **Étape 5 :** écran de duel : sous chaque mesure, en petit, « <terme> : <définition> » si `definitionPour` renvoie un résultat. Les définitions sont relues pour la neutralité par un agent neuf (prompt : `CLAUDE.md`, `README.md`, le glossaire ; question : une définition avantage-t-elle ou dessert-elle une option d'un dilemme ?).
- [ ] **Étape 6 :** `referentiel/version.yml` au jour ; contrôles ; commit « Glossaire des duels » ; ouvrir la PR.

---

## PR 3 — textes courts, par lots de trois fiches (branches `textes-courts-lot-1` à `-4`)

Méthode du `CLAUDE.md` (« Méthode de travail ») ; lots par ordre alphabétique des 12 fiches incluses.

### Tâche 6 (répétée par lot)

- [ ] **Étape 1 : rédaction.** Un agent par fiche, deux en parallèle au plus. Prompt : lire `CLAUDE.md`, `referentiel/anonymisation.md` (règles du texte court), `referentiel/dilemmes.md`, la fiche ; pour chaque ligne du tableau des dilemmes qui a une proposition, écrire ou réécrire la colonne `texte court` ; ne toucher à rien d'autre ; pas de git ; finir par `npm run valider`.
- [ ] **Étape 2 : vérification indépendante.** Un agent neuf pour le lot, qui lit les règles, puis pour chaque ligne la proposition et son texte court. Questions : même mesure ? rien d'ajouté ni d'omis qui change le sens ? aucun mot de jugement ? auteur non reconnaissable ? Rapport : liste des lignes à corriger avec le motif.
- [ ] **Étape 3 :** appliquer les corrections soi-même ; `npm run valider`, `npm run comparatifs`, `npm test` ; relire `comparatifs/duels.md` d'une traite pour l'homogénéité du registre entre candidats.
- [ ] **Étape 4 :** commit, PR « Textes courts : lot N », avec dans le corps le tableau `candidat | dilemme | avant | après` des textes déjà courts qui ont changé.
- [ ] **Dernier lot seulement :** passer la limite de 200 caractères d'avertissement à erreur (tâche 4, étape 5), vérifier qu'aucun rattachement avec proposition n'est exclu pour « sans texte court », et ajouter à la grille de relecture du `CLAUDE.md` (R3) : « texte court présent, ≤ 200 caractères, en langage courant ».

## Après la dernière fusion

Nouvelle passe de bêta-test sur les trois retours de départ (sujets, poids, duels) avant toute autre évolution du parcours.
