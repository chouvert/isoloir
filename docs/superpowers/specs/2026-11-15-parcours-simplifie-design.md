# Parcours « Me situer » simplifié — conception

Date : 2026-11-15. Statut : conception validée en discussion par Julien, à relire avant le plan de travail.

Maquettes : artefact « L’Isoloir — parcours », rangée « Parcours simplifié : proposition »
(écrans « 1 · Ce qui compte pour vous », « Réglage facultatif des poids », « Duel avec son contexte »).
La maquette « Résultat, puis invitation aux duels » est **abandonnée** (voir les décisions).

## Pourquoi

Premiers retours des bêta-testeurs sur le parcours actuel (4 étapes : préoccupations, 100 points,
dilemmes, duels) :

1. on ne comprend pas à quoi sert le choix des 3 préoccupations ;
2. on ne comprend pas l'idée des 100 points à répartir, et la saisie (boutons + / −, champ
   numérique, total à faire tomber juste) est compliquée ;
3. les phrases des duels sont souvent trop techniques et arrivent sans contexte.

Constat à la lecture du code et de la méthode : les préoccupations et les 100 points font le même
travail (dire ce qui compte le plus), les premières ne servant qu'à pré-remplir les seconds. Les
textes des duels sont ceux des fiches, écrits pour être exacts et sourcés, pas pour être lus à
froid.

## Objectif

Qu'une personne qui n'a jamais vu l'outil comprenne à chaque écran ce qu'on lui demande et à quoi
sa réponse sert, sans changer ce que le score de proximité mesure.

- **Non-objectifs** : modifier le calcul de proximité (accord, voisines, couverture, égalités),
  les dilemmes, l'écran de résultat, les règles de formation des duels autres que leur nombre.
- **À éviter absolument** : un texte de duel en langage courant qui déforme la mesure, la rend plus
  ou moins séduisante que l'original, ou trahit son auteur ; toute explication qui ne serait pas
  la même pour tous les candidats.

## Décisions de Julien (2026-11-15)

| Question | Décision |
|---|---|
| Préoccupations et points | Une seule étape visible : les 3 sujets. Les points ne sont plus montrés. |
| Réglage des poids | Facultatif, derrière un lien, avec une réglette par thème |
| Place des duels | **Dans le parcours**, avant le résultat, non optionnels (comme aujourd'hui) |
| Textes des duels | Rédigés en langage courant |

La décision du 2026-10-31 « texte montré = texte de la proposition, nettoyé automatiquement » est
remplacée par la dernière ligne.

Choix de conception proposés par Claude, à confirmer à la relecture de cette spec :

| Sujet | Choix | Raison |
|---|---|---|
| Nombre de duels | 4 au lieu de 6 | Le parcours reste à trois étapes obligatoires ; l'indicateur s'affiche dès 3 duels comptés |
| Contexte d'un duel | L'énoncé du dilemme, affiché au-dessus des deux mesures | Déjà rédigé, neutre, identique pour tous |
| Explication des termes | Un glossaire commun, pas une phrase par mesure | La même définition pour tous les candidats ; relecture de neutralité faite une fois |
| Longueur d'un texte de duel | 200 caractères au plus | Lisible sur téléphone à côté d'un second texte |
| Échelle des réglettes | 0 à 10 | Voir « Réglage facultatif » |

## Approches envisagées

1. **Fusionner les deux réglages et réécrire les duels** (retenue). Aucun changement de ce que le
   score mesure ; le travail est surtout rédactionnel.
2. **Pondérer chaque dilemme** (« ce sujet est-il important pour vous ? », à la manière du
   Wahl-O-Mat). Plus intuitif, mais change la règle de calcul (poids par dilemme et non par thème)
   et ajoute un clic par question. Écartée.
3. **Duels après le résultat, en option.** Raccourcit le chemin vers le résultat, mais Julien veut
   que tout le monde passe par les duels. Écartée.

## Le parcours

Trois étapes au lieu de quatre : **vos sujets → les dilemmes → les duels**, puis le résultat. La
tringle de progression passe à trois anneaux. L'écran d'accueil annonce ces trois étapes.

### Étape 1 — « Ce qui compte pour vous »

- Titre : « Qu’est-ce qui compte le plus pour vous ? » ; consigne : « Choisissez jusqu’à 3 sujets. »
- Encadré « À quoi ça sert » : « Vos sujets pèseront plus que les autres dans votre résultat, et
  les questions commenceront par eux. »
- Dès qu'un sujet est choisi, une ligne chiffrée sous la liste, calculée à partir du budget réel :
  « Les thèmes de vos sujets compteront environ N fois plus qu'un thème non choisi. » N = points du
  thème le plus doté ÷ points d'un thème sans part, arrondi à l'entier. (Avec les règles actuelles,
  N va d'environ 3 pour trois sujets distincts à 7 pour un seul sujet : une phrase fixe serait fausse.)
- Liste, ordre aléatoire, maximum de 3 : inchangés.
- Actions : bouton principal « Passer aux questions avec N sujet(s) » ; lien « Tout compte autant »
  (aucun sujet, budget à parts égales, remplace « Rien de tout ça en particulier ») ; lien
  « Régler moi-même ».
- Le budget est calculé par `preremplirBudget`, inchangé, et n'est jamais affiché en points.

### Réglage facultatif des poids

Accessible par « Régler moi-même » ; on peut ne jamais l'ouvrir.

- Une réglette par thème (9), de « Ne compte pas » à « Compte beaucoup », 11 crans (0 à 10).
- Position de départ : `niveau = min(10, arrondi(points / 3))`, d'après le budget pré-rempli
  (parts égales : cran 4 ; thème d'un sujet choisi : cran 6 à 10).
- **Tant qu'aucune réglette n'est touchée, le budget pré-rempli est conservé tel quel.** Dès la
  première modification, le budget est recalculé pour tous les thèmes :
  `points(thème) = 100 × niveau / somme des niveaux`, arrondi par la méthode du plus fort reste
  déjà en place (`arrondirPlusFortReste`).
- Cran 0 : le thème n'est pas abordé (règle existante des thèmes à 0 point), ce que l'écran dit.
- Toutes les réglettes à 0 : le bouton « Passer aux questions » est désactivé, avec un message.
- Revenir aux sujets et en changer recalcule le pré-remplissage et efface le réglage manuel, après
  l'avoir annoncé.
- Aucun nombre de points n'est affiché, ni ici ni au résultat (« 27 points » à côté d'un thème
  disparaît ; les thèmes restent rangés du plus au moins doté).

Le calcul niveau → points est une règle : elle va dans `scripts/lib/parcours.mjs`, avec ses tests,
et non dans `site/src/scripts/parcours.ts`.

### Étape 2 — Les dilemmes

Inchangés. Le lien de retour du premier dilemme mène à « vos sujets ».

### Étape 3 — Les duels

- Toujours avant le résultat. **4 duels** (`DUELS.nombre`), les autres règles de choix inchangées.
- En tête de chaque duel, un bandeau « Le sujet » : le thème et l'énoncé du dilemme dont le duel
  est tiré. La réponse que l'utilisateur a donnée à ce dilemme n'est pas rappelée, pour ne pas
  orienter son choix.
- Titre : « Deux candidats proposent ceci. Que préférez-vous ? »
- Chaque mesure : son **texte en langage courant** ; dessous, en petit, la définition des termes du
  glossaire qu'il contient (au plus une par mesure, la première rencontrée).
- Boutons « Les deux » et « Aucune des deux », indicateur, révélation : inchangés.
- Légende : « Les noms des deux candidats apparaîtront après le dernier duel. Votre résultat ne
  change pas. »
- Un écran de transition d'une phrase avant le premier duel dit à quoi ils servent : « Pour finir,
  4 comparaisons sans les noms : elles vous montrent si, à l'aveugle, vous préférez les mesures qui
  vont avec vos réponses. »

## Les textes en langage courant

### Règle

Tout candidat qui participe à un duel sur un dilemme y est représenté par un **texte court**
(colonne `texte court` du tableau des dilemmes de sa fiche), désormais **obligatoire** et non plus
réservé aux textes de plus de 300 caractères. Un rattachement sans texte court ne participe pas
aux duels (et `npm run valider` le signale).

Règles de rédaction, à ajouter à `referentiel/anonymisation.md` et au gabarit `_modele.md` :

- **200 caractères au plus**, une seule phrase, **une seule idée** : la mesure qui fonde le
  rattachement, pas le paquet entier de la proposition ;
- commence par un verbe à l'infinitif ; vocabulaire du quotidien ;
- pas de sigle non développé (ISF, CSG, TVA…), pas de « % du PIB », pas de « Md€ » (écrire
  « milliards d'euros ») ; **au plus un chiffre**, celui qui dit la mesure (âge, montant, taux) ;
- **fidèle** : rien d'ajouté, aucun bénéfice ni inconvénient qui ne soit dans la proposition, pas
  de mot de jugement ; le financement n'est mentionné que s'il fait partie de la mesure ;
- **anonyme** : les règles actuelles de `anonymisation.md` continuent de s'appliquer ;
- même registre pour tous : pas de slogan, pas de citation.

Exemple : « Rétablir un ISF renforcé » → « Rétablir l’impôt sur la fortune, à un niveau plus élevé
qu’avant ».

### Glossaire

Nouveau fichier `referentiel/glossaire.md` : `terme | définition` (une phrase factuelle, 120
caractères au plus, sans jugement). Exemples : « dépenses publiques : celles de l'État, de la
Sécurité sociale et des collectivités » ; « impôt sur la fortune : payé par les ménages les plus
fortunés, supprimé en 2018 ». Il est exporté dans `donnees/base.json` et affiché sous une mesure
quand son texte contient le terme. Une définition ne dépend jamais d'un candidat.

### Volume et relecture

`comparatifs/duels.md` compte aujourd'hui 106 textes, dont 24 ont déjà un texte court (à reprendre
selon les nouvelles règles). Rédaction par lots de fiches, selon la méthode du `CLAUDE.md` :
rédaction, puis **vérification indépendante** par un agent neuf centrée sur la fidélité et la
neutralité (le texte court dit-il la même chose que la proposition, sans l'embellir ni
l'affaiblir ?). Tant qu'une fiche n'est pas traitée, ses rattachements sans texte court sortent des
duels : l'écran de duels ne mélange jamais anciens et nouveaux textes.

## Ce qui change dans le dépôt

| Fichier | Changement |
|---|---|
| `referentiel/methode-proximite.md` | Étapes ; section 0 (budget non affiché, réglettes, conversion niveau → points) ; section 5 (4 duels, texte court obligatoire, contexte, glossaire) ; exemples à jour |
| `referentiel/preoccupations.md` | Texte d'introduction (« Tout compte autant », étapes) |
| `referentiel/anonymisation.md`, `candidats/_modele.md`, `README.md` | Règles du texte court |
| `referentiel/glossaire.md` | Nouveau |
| `scripts/lib/parcours.mjs` | Niveaux de départ, conversion niveau → points, rapport « N fois plus » |
| `scripts/lib/duels.mjs` | `nombre: 4` |
| `scripts/lib/validation.mjs`, génération | Texte court obligatoire et ≤ 200 caractères pour participer ; glossaire dans `base.json` |
| `site/src/scripts/parcours.ts`, `me-situer.astro` | Écrans, tringle à 3 anneaux, réglettes, bandeau de contexte |
| `candidats/*.md` | Textes courts, par lots |
| `tests/` | Tests des nouvelles règles ; nombre de tests du `CLAUDE.md` à mettre à jour |
| `referentiel/version.yml` | À la date de fusion : le parcours change, les utilisateurs le refont |

## Ordre de livraison

1. **PR « Parcours simplifié »** : étapes 1 à 3, réglettes, méthode, 4 duels, bandeau de contexte.
   Les duels montrent encore les textes actuels. Répond aux retours 1 et 2.
2. **PR « Duels en langage courant : règles »** : règles de rédaction, glossaire, validation,
   affichage des définitions, exclusion des rattachements sans texte court.
3. **PR par lot de fiches** : textes courts et leur vérification. Les duels se remplissent au fil
   des lots.

## Laissé à la réalisation

- Rendu des réglettes (élément natif `range` stylé ou composant), dans le respect de
  `identite/charte.md` : pétrole pour l'action, pas d'autre couleur, cibles tactiles de 44 px.
- Formulation exacte des messages d'état (aucun sujet, toutes réglettes à 0, réglage effacé).
- Accessibilité des réglettes : étiquette, valeur annoncée en mots (« compte peu », « compte
  beaucoup »), utilisables au clavier.

## Contrôles

- `npm run valider` (0 erreur), `npm run comparatifs`, `npm test`.
- Parcours fait de bout en bout sur téléphone et sur ordinateur, sans ouvrir le réglage puis en
  l'ouvrant ; vérifier que, sans réglage, les scores sont identiques à ceux du parcours actuel pour
  les mêmes sujets et les mêmes réponses.
- Nouvelle passe de bêta-test sur les trois points de départ.
