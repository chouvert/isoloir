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
| Poids des thèmes             | 100 points répartis par l'utilisateur           | 2 — Priorités     |
| Réponses de l'utilisateur    | Une option par dilemme, ou « sans avis »        | 3 — Dilemmes      |
| Réponses des candidats       | Section « Réponses aux dilemmes » des fiches    | —                 |
| Options voisines             | Ligne `voisines` de chaque dilemme              | —                 |
| Choix à l'aveugle            | Duels de propositions                           | 4 — Duels         |
| Notes de faisabilité         | Section « Analyse de faisabilité » des fiches   | —                 |

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

Les duels ne modifient **pas** le score de proximité. Selon les réponses, tous les candidats
n'apparaissent pas le même nombre de fois dans les duels, ce qui fausserait une moyenne.

Ils donnent un indicateur séparé, affiché à côté :

```
préférence à l'aveugle = duels où la proposition du candidat a été préférée
                         / duels où le candidat apparaissait
```

Seuls comptent les duels où l'utilisateur a choisi l'une des deux propositions : les réponses
« aucune des deux » et « les deux » ne comptent ni pour ni contre, et ne sont pas comptées
comme apparitions. L'indicateur n'est affiché que pour les candidats apparus dans au moins
3 duels ainsi comptés.

C'est un contrôle de cohérence utile : un candidat proche selon les dilemmes mais peu choisi
à l'aveugle (ou l'inverse) invite l'utilisateur à regarder le détail.

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
