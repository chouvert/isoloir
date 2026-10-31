# Duels à l'aveugle — conception

Date : 2026-10-31. Statut : conception validée en discussion par Julien, à relire avant le plan de travail.

## Objectif

Les duels à l'aveugle sont l'étape 4 du parcours, après les dilemmes. Leur but premier est un
**contrôle de cohérence** : vérifier si l'utilisateur, sans voir le nom des candidats, préfère les
mesures qui correspondent aux options qu'il a choisies dans les dilemmes, et l'inviter à regarder
le détail en cas d'écart.

Principes inchangés de `referentiel/methode-proximite.md` : les duels **ne modifient pas** le score
de proximité ; tout est calculé dans le navigateur et rien n'en sort ; même règle pour tous les
candidats.

Hors périmètre : l'écran des duels (interface Astro, chantier suivant) ; le regroupement de
propositions comparables par sujet.

## Décisions de Julien (2026-10-31)

| Question | Décision |
|---|---|
| But | Contrôle de cohérence avec les dilemmes |
| Texte montré | Texte de la proposition dans la fiche, nettoyé automatiquement |
| Formation des paires | Par dilemme : deux candidats rattachés à des options différentes |
| Indicateur | Cohérence par dilemme ; remplace l'indicateur de préférence par candidat |
| Nombre | 6 duels |
| Révélation | À la fin des 6 duels |
| Données | Colonne « proposition » dans le tableau des dilemmes des fiches |

## 1. Déroulé pour l'utilisateur

### Dilemmes éligibles
Un dilemme donne un duel si :
1. l'utilisateur y a choisi une option X (pas « sans avis ») ;
2. au moins un candidat **participant** est rattaché à X ;
3. au moins un candidat participant est rattaché à une autre option.

Un candidat participe à un dilemme s'il y est rattaché à une lettre d'option, que sa fiche désigne
la proposition qui fonde ce rattachement, et que le texte à l'aveugle de cette proposition n'est
pas exclu (section 2). Les réponses `aucune` et `pas de position` ne participent jamais.

### Sélection
Les dilemmes sont parcourus **dans l'ordre où ils ont été posés** (`ordonnerDilemmes`, qui suit
déjà les thèmes les mieux dotés en points). Pour chaque dilemme éligible :
1. **Côté utilisateur** : tirage uniforme parmi les participants rattachés à X.
2. **Côté adverse** : tirage uniforme parmi les participants rattachés à une option différente
   **et non voisine** de X ; s'il n'y en a aucun, parmi ceux des options voisines de X.
3. **Plafond** : un candidat apparaît au plus **2 fois** sur l'ensemble des duels. Les candidats
   ayant atteint le plafond sont retirés des tirages ; si un côté devient vide, le dilemme est
   passé et l'on continue au suivant.
4. **Côtés** : la place à gauche ou à droite de la mesure côté utilisateur est tirée au sort.

On s'arrête à **6 duels**. S'il y a moins de 6 dilemmes éligibles, on propose ceux qui existent et
l'on indique pourquoi (dilemmes « sans avis », candidats peu renseignés). Le tirage au sort est
injectable pour les tests.

### Le duel
Deux mesures, sans nom ni source. Quatre réponses : la mesure de gauche, la mesure de droite,
« aucune des deux », « les deux ».

### Indicateur de cohérence
- **Cohérent** : l'utilisateur préfère la mesure du candidat rattaché à son option X.
- **Écart** : il préfère l'autre (y compris quand l'adversaire est d'une option voisine).
- **Non compté** : « aucune des deux » ou « les deux ».

Affichage : « k duels cohérents sur n comptés », seulement si **n ≥ 3** (`SEUILS.minDuels`,
inchangé). Sinon : « pas assez de duels comptés pour un indicateur ».

### Révélation, à la fin
Pour chaque duel : les deux auteurs, l'option de chacun et son libellé, le statut (cohérent,
écart, non compté), un lien vers les deux fiches. Un écart affiche : « Au dilemme, vous avez choisi
A — <libellé> ; à l'aveugle, vous avez préféré une mesure rattachée à B — <libellé> », avec un
lien vers le dilemme.

## 2. Données et anonymisation

### Colonne « proposition » dans les fiches
Le tableau « Réponses aux dilemmes » devient :

```
| dilemme | option | proposition | justification | source |
```

Règles contrôlées par `npm run valider` :
- colonne présente (erreur sinon) ;
- si renseignée : identifiant d'une proposition **de la fiche** (erreur sinon) ;
- interdite avec `aucune` ou `pas de position` (erreur) ;
- vide avec une lettre d'option : **avertissement** (le candidat ne participe pas aux duels de ce
  dilemme).

Le gabarit `candidats/_modele.md` et le README (conventions, tableau des contrôles) sont mis à jour.

### Remplissage initial
Un script ponctuel (non conservé dans le dépôt) propose, pour chaque rattachement à une lettre,
l'identifiant cité dans la justification pour l'option retenue. Chaque proposition est relue ;
les cas douteux (plusieurs identifiants possibles, identifiant d'une autre option, aucun
identifiant) sont soumis à Julien avant fusion, comme un changement de rattachement.

### Texte à l'aveugle
Calculé à partir du texte (colonne « proposition » du tableau « Propositions par thème ») de la
proposition désignée, dans cet ordre :
1. suppression des liens Markdown `[…](…)` et des URL ;
2. suppression de tout passage entre parenthèses `(…)` ou crochets `[…]`, imbrications comprises ;
3. suppression des guillemets `« »` et `" "` (le texte cité reste, en prose) ;
4. réduction des espaces et de la ponctuation orpheline (` ;` final, espaces avant virgule).

### Exclusions
Un texte est exclu (le candidat ne participe pas à ce dilemme), avec un motif, si après nettoyage :
- il est vide ;
- il dépasse **300 caractères** ;
- il contient un **terme interdit**, comparé sans accents ni casse et en mot entier.

Termes interdits :
- automatiques, tirés des fiches : nom complet de chaque candidat, son nom de famille (le nom
  complet privé de son premier mot : « Le Pen », « Mélenchon »), son parti (`parti` du frontmatter).
  Les prénoms seuls ne sont pas interdits (« Marine » est aussi un mot courant) ;
- manuels : liste dans un nouveau fichier `referentiel/anonymisation.md` (tableau `terme`, `motif`),
  pour les personnalités et mots qui trahissent un camp (Jadot, Brossat…).

## 3. Génération et export

Au moment de `npm run comparatifs` :
- `donnees/base.json` reçoit une section `duels` :
  ```json
  "duels": {
    "participants": { "<dilemme>": { "<option>": [ { "candidat": "…", "proposition": "env-01", "texte": "…" } ] } },
    "exclusions": [ { "dilemme": "…", "candidat": "…", "proposition": "…", "motif": "…" } ]
  }
  ```
- nouvelle page générée `comparatifs/duels.md` : pour chaque dilemme et chaque option, les textes à
  l'aveugle des participants ; puis la liste des exclusions avec leur motif. Elle sert à vérifier
  d'un coup d'œil qu'aucun texte ne trahit son auteur ; son diff montre les textes qui changent.
  Comme `dilemmes.md` et `phares.md`, elle est contrôlée par `--verifier`, pas par le validateur.

## 4. Code

- `scripts/lib/anonymisation.mjs` — fonctions pures : `texteAveugle(texte)`,
  `termesInterdits(candidats, manuels)`, `exclusion(texte, termes)` → motif ou `null`.
  Appelées par la génération.
- `scripts/lib/duels.mjs` — module navigateur sans dépendance, tirage injectable :
  - `preparerDuels({ dilemmes, ordre, reponses, participants, aleatoire })` → liste d'au plus
    6 duels `{ dilemme, optionUtilisateur, gauche, droite }`, chaque côté
    `{ candidat, option, proposition, texte }`, et le nombre de dilemmes éligibles ;
  - `evaluerDuels(duels, choix)` avec `choix` ∈ `gauche | droite | aucune | les deux` →
    statut par duel, `coherents`, `comptes`, `taux` (`null` si `comptes < 3`).
  - constantes `DUELS = { nombre: 6, maxApparitions: 2 }`.
- `scripts/lib/proximite.mjs` — suppression de `calculerPreferencesAveugle` et de ses tests ;
  `SEUILS.minDuels` reste à 3 et sert à `evaluerDuels`.
- `scripts/lib/extraction.mjs`, `generation.mjs`, `validation.mjs` — colonne « proposition »,
  section `duels` du JSON, page `duels.md`.

## 5. Méthode publiée

Réécriture de la section 5 de `referentiel/methode-proximite.md` (et de la ligne « Choix à
l'aveugle » du tableau des données) avec les règles de la section 1 ci-dessus, de sorte que
n'importe qui puisse refaire le tirage et le calcul. Un exemple chiffré (6 duels, réponses et
statuts) y est ajouté et repris comme test, comme pour le score.

## 6. Tests

- Éligibilité : « sans avis » ignoré ; dilemme écarté sans participant de l'option de l'utilisateur
  ou sans adversaire ; `aucune` et `pas de position` jamais participants.
- Tirage : repli sur une option voisine ; plafond de 2 apparitions et dilemme passé si un côté est
  vide ; moins de 6 duels possibles ; ordre des dilemmes respecté ; résultats reproductibles avec un
  tirage injecté.
- Indicateur : cohérent, écart (y compris adversaire voisin), non compté ; taux `null` sous 3.
- Anonymisation : liens, parenthèses imbriquées, crochets, guillemets ; longueur ; termes interdits
  automatiques et manuels, sans accents ni casse, en mot entier ; prénom seul non interdit.
- Validation : colonne manquante ; identifiant inconnu ; proposition avec `aucune` ; avertissement
  si vide avec une lettre.
- Génération : section `duels` du JSON et page `duels.md`, déterministes.
- Exemple chiffré de la méthode.

## 7. Livraison

1. **PR « données »** : colonne dans le gabarit et les 12 fiches, contrôle du validateur, README ;
   liste des cas douteux soumise à Julien.
2. **PR « duels »** : `anonymisation.md`, anonymisation, génération (`base.json`, `duels.md`),
   `duels.mjs`, suppression de l'ancien indicateur, méthode réécrite, tests.

## Limites connues

- Le nettoyage automatique ne garantit pas l'anonymat : un style ou un chiffre emblématique peut
  trahir l'auteur. La page `duels.md` sert à le repérer ; le terme fautif va dans
  `referentiel/anonymisation.md`.
- Avec 6 duels, un seul écart fait varier le taux de près de 17 points : l'indicateur invite à
  regarder le détail, il ne mesure rien finement.
- Un candidat peu renseigné dans les dilemmes apparaît rarement dans les duels.
