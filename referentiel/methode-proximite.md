# Méthode de calcul de la proximité

Ce document décrit comment le parcours web calcule la proximité entre un utilisateur et
chaque candidat. Il est publié tel quel dans l'outil : n'importe qui doit pouvoir refaire
le calcul à la main.

## Principes

1. **Proximité, pas recommandation.** Le résultat indique quels programmes rejoignent le plus
   les arbitrages de l'utilisateur. Il ne désigne pas un « meilleur candidat ».
2. **Même règle pour tous.** Aucun candidat n'a de poids, de bonus ou de traitement particulier.
3. **Tout est expliqué.** Chaque score est accompagné du détail dilemme par dilemme, avec la
   justification et la source du rattachement du candidat.
4. **Rien ne quitte le navigateur.** Le calcul se fait sur l'appareil de l'utilisateur ; ses
   réponses ne sont ni envoyées ni conservées.
5. **La faisabilité est affichée, jamais mélangée.** Être d'accord avec un programme et le juger
   réaliste sont deux questions différentes.

## Données utilisées

| Donnée                       | Origine                                         | Étape du parcours |
|------------------------------|-------------------------------------------------|-------------------|
| Préoccupations choisies      | Jusqu'à 3, parmi `referentiel/preoccupations.md` | 1 — Préoccupations |
| Poids des thèmes             | 100 points répartis par l'utilisateur           | 2 — Priorités     |
| Réponses de l'utilisateur    | Une option par dilemme, ou « sans avis »        | 3 — Dilemmes      |
| Réponses des candidats       | Section « Réponses aux dilemmes » des fiches    | —                 |
| Options voisines             | Ligne `voisines` de chaque dilemme              | —                 |
| Choix à l'aveugle            | Duels de propositions (`comparatifs/duels.md`)  | 4 — Duels         |
| Notes de faisabilité         | Section « Analyse de faisabilité » des fiches   | —                 |

## 0. Préoccupations : pré-remplissage du budget et ordre des dilemmes

Les préoccupations n'entrent pas dans le calcul de proximité. Elles préparent les deux étapes
suivantes, que l'utilisateur garde entièrement en main.

### Pré-remplissage du budget
L'utilisateur choisit jusqu'à 3 préoccupations. Le budget de 100 points est pré-rempli ainsi :

1. **60 points** sont répartis à parts égales entre les 9 thèmes ;
2. **40 points** sont répartis entre les thèmes des préoccupations choisies : chaque préoccupation
   donne 2 parts à son thème principal et 1 part à son thème secondaire ; les parts s'additionnent
   quand plusieurs préoccupations touchent le même thème ;
3. sans préoccupation choisie (« Rien de tout ça en particulier »), les 100 points sont répartis
   à parts égales ;
4. les valeurs sont arrondies à l'entier en gardant un total de 100 (méthode du plus fort reste) :
   chaque thème reçoit la partie entière de sa valeur, puis les points restants vont, un par un,
   aux thèmes dont la partie décimale est la plus grande. **Les égalités sont départagées par
   tirage au sort**, pour qu'aucun thème ne soit systématiquement avantagé par l'arrondi.

L'écran indique que le budget est pré-rempli d'après les choix de l'utilisateur, qui l'ajuste
librement, y compris jusqu'à 0 point pour un thème.

**Exemple.** Préoccupations : « Boucler les fins de mois » (eco 2 parts, social 1 part),
« La retraite » (social 2 parts), « Le climat et l'environnement » (env 2 parts). Soit 7 parts :
eco 2, social 3, env 2.

| thème              | 60 / 9 | part des 40 | valeur exacte | arrondi |
|--------------------|--------|-------------|---------------|---------|
| eco                | 6,67   | 40 × 2/7    | 18,10         | 18      |
| social             | 6,67   | 40 × 3/7    | 23,81         | 24      |
| env                | 6,67   | 40 × 2/7    | 18,10         | 18      |
| 6 autres thèmes    | 6,67   | 0           | 6,67          | 7 pour 4 d'entre eux, 6 pour 2 (tirage) |

Total : 18 + 24 + 18 + 4 × 7 + 2 × 6 = 100.

### Ordre des dilemmes
Une fois le budget validé :

1. les dilemmes associés aux préoccupations choisies sont posés en premier, dans l'ordre où
   l'utilisateur a choisi ses préoccupations ;
2. viennent ensuite les autres dilemmes, par thème du plus doté au moins doté en points (égalités
   tirées au sort), et dans l'ordre du référentiel au sein d'un thème ;
3. les dilemmes des thèmes à 0 point ne sont pas posés, même s'ils sont liés à une
   préoccupation choisie.

L'utilisateur peut s'arrêter dès 5 dilemmes répondus (voir « Minimum de réponses »).

## 1. Accord sur un dilemme

Pour un dilemme auquel l'utilisateur a répondu, l'accord avec un candidat vaut :

| Situation                                                    | Accord           |
|--------------------------------------------------------------|------------------|
| Même option                                                  | 1                |
| Options déclarées voisines dans le référentiel                | 0,5              |
| Options différentes                                          | 0                |
| Candidat `aucune` (approche hors des options proposées)       | 0                |
| Candidat `pas de position`                                   | exclu du calcul  |
| Utilisateur « sans avis »                                    | exclu du calcul  |

### Options voisines
Les options d'un dilemme ne sont pas rangées sur une échelle : « reculer l'âge » et
« taxer le capital » ne sont pas plus ou moins éloignées l'une de l'autre, elles sont différentes.
Mais certaines options vont dans le même sens (« accélérer la transition » et « accélérer en
faisant contribuer les gros émetteurs »). Elles sont alors déclarées **voisines** et un accord
partiel est compté.

Règles :
- deux options ne sont voisines que si elles poursuivent la même orientation avec des moyens
  ou des degrés différents ;
- au plus deux paires voisines par dilemme, sauf pour un dilemme explicitement gradué ;
- les voisinages sont déclarés dans `referentiel/dilemmes.md` et ne dépendent jamais d'un candidat.

## 2. Poids d'un dilemme

Le poids d'un thème est le nombre de points que l'utilisateur lui a attribués. Ce poids est
partagé entre les dilemmes du thème auxquels il a répondu :

```
poids(dilemme) = points(thème) / nombre de dilemmes répondus dans ce thème
```

Ainsi, un thème qui comporte deux dilemmes ne pèse pas deux fois plus qu'un thème qui n'en
comporte qu'un. Un thème à 0 point n'intervient pas, et ses dilemmes ne sont pas posés.

## 3. Score de proximité

Pour chaque candidat, sur les dilemmes que l'utilisateur a répondus et sur lesquels le candidat
a une position :

```
proximité = Σ poids × accord  /  Σ poids
```

Le résultat est exprimé en pourcentage, arrondi à l'unité.

### Couverture
Un candidat silencieux sur beaucoup de dilemmes ne doit pas obtenir un score flatteur calculé
sur deux réponses. On calcule donc :

```
couverture = Σ poids des dilemmes où le candidat a une position  /  Σ poids des dilemmes répondus
```

| Couverture       | Affichage                                                          |
|------------------|--------------------------------------------------------------------|
| 70 % ou plus     | Score affiché normalement                                          |
| de 40 % à 70 %   | Score affiché avec la mention « programme incomplet sur vos priorités » |
| moins de 40 %    | Pas de score : « pas assez de positions connues sur vos priorités » |

### Égalités
Avec une dizaine de dilemmes, changer une seule réponse peut déplacer un score de 10 points.
Un écart de quelques points n'a donc pas de sens. Les candidats dont les scores sont à
**moins de 5 points** l'un de l'autre sont présentés comme **à égalité**, regroupés et rangés
par ordre alphabétique.

Règle exacte, sur les scores arrondis : on range les candidats par score décroissant ; le
premier ouvre un groupe ; chaque candidat suivant rejoint ce groupe si son score est à moins
de 5 points du **premier du groupe**, sinon il ouvre un nouveau groupe. Les candidats sans
score (couverture insuffisante) sont listés à part.

### Minimum de réponses
Le résultat n'est affiché qu'à partir de **5 dilemmes répondus** (hors « sans avis »).
En dessous, l'utilisateur est invité à répondre à davantage de dilemmes.

## 4. Détail par thème

Le même calcul, restreint aux dilemmes d'un thème, donne une proximité par thème. Le résultat
peut ainsi dire : « proche de X sur l'écologie, éloigné sur l'Europe ». C'est l'affichage
principal du résultat ; le score global n'en est que la synthèse.

## 5. Duels à l'aveugle

Les duels ne modifient **pas** le score de proximité. Ils servent de **contrôle de cohérence** :
sans voir le nom des candidats, l'utilisateur préfère-t-il les mesures qui correspondent aux
options qu'il a choisies dans les dilemmes ?

### Ce qui est montré
Pour chaque dilemme, chaque candidat rattaché à une option est représenté par la proposition de
sa fiche qui fonde ce rattachement (colonne `proposition` du tableau des dilemmes). Elle est
montrée sans nom ni source, après le nettoyage décrit dans `referentiel/anonymisation.md`. Quand ce
texte dépasse 300 caractères ou trahit son auteur, la fiche fournit un **texte court** : une
reformulation neutre et fidèle de la même proposition, montrée à sa place. Un texte encore trop long
ou reconnaissable est exclu, et le candidat ne participe pas à ce dilemme. Les
réponses `aucune` et `pas de position` ne participent jamais. La liste des textes montrés et des
exclusions est publiée dans `comparatifs/duels.md`.

### Choix des duels
1. Un dilemme donne un duel si l'utilisateur y a choisi une option X (pas « sans avis »), si au
   moins un candidat participant est rattaché à X et au moins un à une autre option.
2. Les dilemmes sont parcourus dans l'ordre où ils ont été posés ; on retient les **6 premiers**.
3. D'un côté, un candidat rattaché à X, tiré au sort ; de l'autre, un candidat rattaché à une
   option différente **et non voisine** de X, tiré au sort, ou, s'il n'y en a aucun, à une option
   voisine.
4. Un candidat apparaît au plus **2 fois** ; s'il n'y a plus de candidat disponible d'un côté, le
   dilemme est passé.
5. La place à gauche ou à droite de chaque mesure est tirée au sort.

S'il y a moins de 6 dilemmes éligibles (beaucoup de « sans avis », candidats peu renseignés), tous
les duels possibles sont proposés et l'utilisateur en est informé.

### Réponses et indicateur
Pour chaque duel, l'utilisateur choisit l'une des deux mesures, « aucune des deux » ou « les deux ».

| Réponse                                                 | Statut      |
|---------------------------------------------------------|-------------|
| Mesure du candidat rattaché à l'option X                | cohérent    |
| Mesure de l'autre candidat (y compris option voisine)   | écart       |
| « Aucune des deux » ou « les deux »                     | non compté  |

```
cohérence = duels cohérents / duels comptés (cohérents + écarts)
```

L'indicateur n'est affiché qu'à partir de **3 duels comptés**.

### Révélation
Les auteurs ne sont révélés qu'**à la fin des duels**, pour ne pas influencer les suivants. Pour
chaque duel : les deux candidats, l'option de chacun, le statut, la **source** de chaque mesure
(et la mention « texte court » le cas échéant) et un lien vers les deux fiches. Un
écart renvoie au dilemme : « Au dilemme, vous avez choisi A ; à l'aveugle, vous avez préféré une
mesure rattachée à B. »

### Exemple
Six dilemmes éligibles ; l'utilisateur répond :

| duel | dilemme            | option choisie au dilemme | mesure préférée à l'aveugle         | statut     |
|------|--------------------|---------------------------|-------------------------------------|------------|
| 1    | D-eco-dette        | A                         | celle du candidat rattaché à A      | cohérent   |
| 2    | D-social-retraites | B                         | celle du candidat rattaché à D      | écart      |
| 3    | D-social-chomage   | C                         | celle du candidat rattaché à C      | cohérent   |
| 4    | D-env-electricite  | C                         | « les deux »                        | non compté |
| 5    | D-europe-regles    | B                         | celle du candidat rattaché à B      | cohérent   |
| 6    | D-europe-defense   | B                         | celle du candidat rattaché à B      | cohérent   |

Résultat : **4 duels cohérents sur 5 comptés**. Le duel 2 invite à revoir le dilemme des
retraites : la mesure préférée à l'aveugle relève d'une autre option que celle choisie.

## 6. Faisabilité

La note globale de faisabilité et son indice de confiance sont affichés à côté de chaque
candidat, avec un lien vers le texte « Pourquoi cette note ». L'utilisateur peut trier ou
filtrer sur la faisabilité, mais elle n'entre jamais dans le score de proximité.

## Exemple

L'utilisateur répartit ses points : `eco` 30, `social` 30, `env` 20, `europe` 20,
autres thèmes 0. Il répond :

| dilemme            | thème  | réponse   | poids |
|--------------------|--------|-----------|-------|
| D-eco-dette        | eco    | A         | 30    |
| D-eco-pouvoir-achat| eco    | sans avis | —     |
| D-social-retraites | social | B         | 15    |
| D-social-chomage   | social | C         | 15    |
| D-env-electricite  | env    | C         | 20    |
| D-env-rythme       | env    | sans avis | —     |
| D-europe-regles    | europe | B         | 10    |
| D-europe-defense   | europe | B         | 10    |

Les deux dilemmes « sans avis » sont exclus : `eco` et `env` reportent tout leur poids sur
leur seul dilemme répondu. Le total des poids vaut 100.

**Candidat X**

| dilemme            | réponse X       | accord | poids × accord |
|--------------------|-----------------|--------|----------------|
| D-eco-dette        | A               | 1      | 30             |
| D-social-retraites | A               | 0      | 0              |
| D-social-chomage   | C               | 1      | 15             |
| D-env-electricite  | A (voisine de C)| 0,5    | 10             |
| D-europe-regles    | C (voisine de B)| 0,5    | 5              |
| D-europe-defense   | pas de position | exclu  | —              |

Proximité = 60 / 90 = **67 %** · couverture = 90 / 100 = 90 %

**Candidat Y** : B, B, B, C, B, C → accords 0, 1, 0, 1, 1, 0

Proximité = (15 + 20 + 10) / 100 = **45 %** · couverture = 100 %

L'écart dépasse 5 points : X est présenté comme plus proche que Y. Le détail montre en
revanche que Y rejoint l'utilisateur sur les retraites, que X ne rejoint pas.

## Limites connues

- Le résultat dépend du choix des dilemmes et de leur formulation. Les règles de rédaction de
  `referentiel/dilemmes.md` visent à limiter ce biais sans pouvoir l'éliminer.
- Le rattachement d'un candidat à une option est une interprétation de son programme ; elle est
  justifiée et sourcée pour pouvoir être contestée.
- Les voisinages entre options sont un choix éditorial, publié et identique pour tous.
- Un programme peut évoluer pendant la campagne : la date de mise à jour de chaque fiche est
  affichée avec le résultat.
- Les duels reposent sur un nettoyage automatique des textes, qui ne garantit pas l'anonymat ; les
  textes courts sont des reformulations, relues comme le reste de la fiche. Un candidat peu
  renseigné dans les dilemmes apparaît moins souvent dans les duels.
