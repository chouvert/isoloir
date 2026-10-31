# Identité « L'Isoloir » — plan de travail

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produire les livrables de l'identité validée : couleurs en fichier de référence, logos SVG, charte, documentation, design system.

**Architecture:** Une source unique des couleurs (`identite/couleurs.json`), lue par les tests (contrastes, couleurs autorisées dans les SVG) et reprise par la charte et le design system. Les logos sont des SVG écrits à la main. Le design system est un artefact de type « Design System » publié à partir de ces fichiers.

**Tech Stack:** SVG, Markdown, Node.js ≥ 20 (`node:test`), Google Fonts (Fraunces, Atkinson Hyperlegible), artefact Design System.

**Spec:** `docs/superpowers/specs/2026-10-31-identite-isoloir-design.md`

## Global Constraints

- Couleurs (clair / sombre) : encre `#23232B` / `#F5F0E6` ; papier `#F5F0E6` / `#1C1C22` ; pétrole `#1F6F73` / `#5FB3B3` ; sable `#D9C9A8` / `#4A443A` ; encre secondaire `#4A4A55` / `#B8B3A8`.
- Contraste texte/fond ≥ 4,5:1 (WCAG AA) pour tous les couples d'usage.
- Neutralité : aucune couleur de candidat ou de parti ; aucune autre couleur que la palette dans les fichiers d'identité.
- Polices : Fraunces 400/500 (titres, logo) ; Atkinson Hyperlegible 400/700 (texte).
- Nom : « L'Isoloir » (L’Isoloir avec apostrophe typographique dans les textes) ; signature « Choisissez en toute connaissance. »
- Livraison dans la PR #28 (branche `identite`) ; `npm test`, `npm run valider`, `npm run comparatifs -- --verifier` verts.

## Review Focus

1. Favicon illisible à 16 px (traits trop fins, détails perdus) : symbole simplifié, traits ≥ 2 unités sur 32. Vérification visuelle en tâche 2.
2. Logo sombre affiché sur fond clair (ou l'inverse) par erreur d'usage : la charte dit quelle version sur quel fond. Tâche 3.
3. Texte du logo dépendant d'une police absente (SVG affiché sans Fraunces) : le texte du logo est converti en tracés ou accompagné d'une pile de repli serif. Test en tâche 2.
4. Couleur hors palette glissée dans un SVG : test de la tâche 2.
5. Usage d'une couleur d'accord perçue comme partisane (rouge/vert) dans l'interface future : règle écrite en tête de charte et dans le design system. Tâches 3 et 4.

---

### Task 1: Couleurs de référence et contrastes

**Files:**
- Create: `identite/couleurs.json`
- Test: `tests/identite.test.mjs`

**Interfaces:**
- Produces: `identite/couleurs.json` = `{ "clair": { "encre", "papier", "petrole", "sable", "encre_secondaire" }, "sombre": { …mêmes clés } }` (valeurs `#RRGGBB`) ; dans le test, `contraste(a, b): number` (ratio WCAG).

- [ ] **Step 1: Tests** `couleurs : valeurs de la charte` (deepEqual avec les valeurs des Global Constraints) et `couleurs : contrastes AA` : pour `clair` et `sombre`, ≥ 4,5 pour encre/papier, encre_secondaire/papier, petrole/papier, papier/petrole (texte de bouton), encre/sable.
- [ ] **Step 2:** `npm test` → échec (fichier absent).
- [ ] **Step 3:** Créer `identite/couleurs.json`.
- [ ] **Step 4:** Tests verts. Commit.

### Task 2: Logos SVG

**Files:**
- Create: `identite/logo.svg`, `identite/logo-sombre.svg`, `identite/symbole.svg`, `identite/symbole-sombre.svg`, `identite/favicon.svg`
- Test: `tests/identite.test.mjs`

**Interfaces:**
- Consumes: `identite/couleurs.json` (tâche 1).

- [ ] **Step 1: Tests** :
  - `logos : fichiers présents et SVG avec viewBox` (les 5 fichiers commencent par `<svg`, ont `viewBox`, `xmlns`, un `<title>`)
  - `logos : uniquement des couleurs de la palette` (toutes les couleurs `#RRGGBB` / `#RGB` trouvées ∈ valeurs de `couleurs.json`, comparaison insensible à la casse)
  - `logos : pas de dépendance à une police` (`logo*.svg` ne contiennent pas de `<text>` ; le nom est en tracés)
  - `favicon : viewBox 32 × 32, pas de texte`
- [ ] **Step 2:** Tests en échec.
- [ ] **Step 3:** Dessiner : symbole = tringle encre, rideau pétrole entrouvert, bulletin au trait encre avec coche (spec, section 3) ; viewBox symbole `0 0 64 64`, favicon `0 0 32 32` simplifié (rideau + coche), logo = symbole + « L'Isoloir » en Fraunces 500 **converti en tracés** (police chargée via `opentype.js` installé temporairement hors du dépôt, ou tracés dessinés à la main) ; versions sombres avec les couleurs `sombre`.
- [ ] **Step 4:** Tests verts ; rendu visuel vérifié (aperçu PNG à 16, 32 et 256 px par `rsvg-convert` ou équivalent).
- [ ] **Step 5:** Commit.

### Task 3: Charte et documentation

**Files:**
- Create: `identite/charte.md`
- Modify: `README.md` (titre, présentation, arborescence `identite/`), `CLAUDE.md` (nom de l'outil, renvoi à la charte, état)

- [ ] **Step 1:** `identite/charte.md` : neutralité en tête (4 règles du spec), nom et signature, présentation, ton, couleurs (tableau clair/sombre et contrastes), typographie (liens Google Fonts), logo (versions, fond clair/sombre, zone de protection = hauteur de la tringle, taille minimale : symbole 16 px, logo 120 px de large), interdits (déformer, recolorer, ajouter une couleur de parti).
- [ ] **Step 2:** README : titre « L'Isoloir », phrase de présentation, logo en tête (`identite/logo.svg`), arborescence. CLAUDE.md : l'outil s'appelle L'Isoloir ; toute interface ou visuel suit `identite/charte.md` ; état mis à jour.
- [ ] **Step 3:** `npm test`, `npm run valider`, `npm run comparatifs -- --verifier` verts. Commit.

### Task 4: Design system

**Files:**
- Artefact de type « Design System » (« L'Isoloir »), créé depuis son type et rempli selon ses instructions.

**Interfaces:**
- Consumes: `identite/couleurs.json`, logos SVG, `identite/charte.md`.

- [ ] **Step 1:** Créer l'artefact depuis le type Design System ; suivre les instructions retournées.
- [ ] **Step 2:** Renseigner : README de marque (charte résumée, neutralité en tête), tokens (couleurs clair/sombre, échelle typographique Fraunces/Atkinson, espacements, rayons), composants avec aperçu (bouton, carte de dilemme, duel à l'aveugle, badge de faisabilité en tons pétrole/sable/encre), logos en assets.
- [ ] **Step 3:** Ouvrir l'aperçu et vérifier clair/sombre, polices chargées, aucune couleur hors palette. Lien de l'artefact ajouté à la charte et à la PR. Commit.
