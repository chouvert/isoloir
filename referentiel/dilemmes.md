# Dilemmes

Questions posées **à l'utilisateur** dans le parcours web. Chaque dilemme présente un
arbitrage réel : l'utilisateur ne dit pas ce qu'il souhaite (tout le monde souhaite
la même chose), mais quel compromis il accepte.

Chaque candidat est ensuite rattaché à l'option correspondant à son programme, avec une
source, dans la section « Réponses aux dilemmes » de sa fiche.

## Règles de rédaction

- **Une contrainte explicite** : l'énoncé rappelle pourquoi il faut choisir (budget limité,
  déficit, ressource rare). Sans contrainte, ce n'est pas un dilemme.
- **Des options réelles** : chaque option est défendue par au moins une famille politique.
  Aucune option « épouvantail » que personne ne soutient.
- **Des options équilibrées** : longueur comparable, aucun adjectif valorisant ou péjoratif,
  pas de vocabulaire propre à un camp.
- **Une contrepartie par option** : l'inconvénient le plus couramment avancé, formulé
  avec la même neutralité pour toutes les options.
- **Une sortie toujours possible** : l'interface propose « Aucune de ces options / sans avis »
  (non listée ici) et affiche les options dans un ordre aléatoire.
- **Identifiants** : `D-<theme>-<mot>` pour le dilemme, `A` à `D` pour les options.
  Comme pour les questions, un identifiant n'est jamais réutilisé.
- **Options voisines** : ligne `- voisines : A-B, C-D (raison)` ou `- voisines : aucune (raison)`.
  Deux options ne sont voisines que si elles poursuivent la même orientation avec des moyens
  ou des degrés différents ; au plus deux paires, sauf pour un dilemme gradué
  (options rangées du plus au moins, déclaré par la ligne `- type : gradué`).
  Voir `referentiel/methode-proximite.md`.

## Statuts
- `actif` : posé dans le parcours, à renseigner dans toutes les fiches candidats.
- `brouillon` : en cours de rédaction, ni posé ni exigé dans les fiches.
- `obsolète` : retiré du parcours ; conservé pour l'historique, identifiant jamais réutilisé.

## Réponses des candidats
Dans la fiche de chaque candidat, chaque dilemme actif reçoit une valeur :
- une lettre d'option (`A`, `B`…) : l'option qui correspond au programme ;
- `aucune` : le programme défend une approche qui ne correspond à aucune option ;
- `pas de position` : aucune prise de position trouvée.

Une lettre ou `aucune` exige une justification et une source. Le rattachement est une
interprétation du programme : il doit pouvoir être vérifié par n'importe quel lecteur.

---

## eco — Économie & fiscalité

### D-eco-dette
- statut : actif
- voisines : C-D (deux façons de réduire le déficit plus lentement)

> La dette publique a fortement augmenté ces dernières années. Pour les finances publiques,
> quelle priorité vous paraît la plus juste ?

| option | libellé                                                              | contrepartie souvent avancée                               |
|--------|----------------------------------------------------------------------|------------------------------------------------------------|
| A      | Réduire le déficit surtout en baissant les dépenses publiques         | Moins de moyens pour certains services publics et aides     |
| B      | Réduire le déficit surtout en augmentant certains impôts              | Risque de peser sur l'activité et l'investissement          |
| C      | Réduire le déficit plus lentement pour préserver l'investissement public | La dette continue d'augmenter plus longtemps             |
| D      | Miser d'abord sur la croissance, qui réduira le déficit ensuite       | Pari incertain si la croissance n'est pas au rendez-vous    |

### D-eco-pouvoir-achat
- statut : actif
- voisines : B-C (deux baisses de prélèvements)

> Une seule mesure peut être financée pour améliorer le pouvoir d'achat. Laquelle choisir ?

| option | libellé                                                        | contrepartie souvent avancée                                  |
|--------|----------------------------------------------------------------|---------------------------------------------------------------|
| A      | Augmenter le salaire minimum par la loi                         | Coût supplémentaire pour les petites entreprises              |
| B      | Baisser les cotisations sur les salaires pour augmenter le net  | Moins de recettes pour la protection sociale                  |
| C      | Baisser les taxes sur la consommation (TVA, carburants)         | Moins de recettes pour l'État, bénéfice pour tous les revenus |
| D      | Augmenter les aides ciblées sur les ménages modestes            | Peu d'effet pour les classes moyennes                          |

---

## social — Travail, retraites, social

### D-social-retraites
- statut : actif
- voisines : B-C (deux hausses de ressources plutôt qu'un allongement)

> Le système de retraite doit être rééquilibré financièrement. Quelle piste vous paraît
> la moins mauvaise ?

| option | libellé                                                                  | contrepartie souvent avancée                                  |
|--------|--------------------------------------------------------------------------|---------------------------------------------------------------|
| A      | Reculer progressivement l'âge de départ ou allonger la durée de cotisation | Travailler plus longtemps, difficile pour les métiers pénibles |
| B      | Augmenter les cotisations des salariés et des employeurs                 | Baisse du salaire net et hausse du coût du travail            |
| C      | Faire contribuer davantage les revenus du capital et les patrimoines élevés | Risque de départ de capitaux, rendement incertain           |
| D      | Ajouter une part de retraite par capitalisation                          | Pensions dépendantes des marchés financiers                   |

### D-social-chomage
- statut : actif
- voisines : B-D (deux formes d'accompagnement des demandeurs d'emploi)

> Des emplois restent vacants alors que le chômage persiste. Quelle approche privilégier ?

| option | libellé                                                                | contrepartie souvent avancée                             |
|--------|------------------------------------------------------------------------|----------------------------------------------------------|
| A      | Renforcer les obligations des demandeurs d'emploi et réduire certaines indemnités | Pression accrue sur des personnes en difficulté |
| B      | Investir davantage dans la formation et l'accompagnement               | Coût élevé, effets lents                                 |
| C      | Rendre les métiers en tension plus attractifs (salaires, conditions)   | Hausse des coûts pour les employeurs et des prix         |
| D      | Faciliter la mobilité géographique (logement, transport)               | Effet limité si les ménages ne veulent pas déménager     |

---

## env — Écologie & énergie

### D-env-electricite
- statut : actif
- voisines : A-C, B-C (l'option mixte rejoint en partie chacune des deux autres)

> Les besoins en électricité vont augmenter. Sur quoi miser en priorité ?

| option | libellé                                                       | contrepartie souvent avancée                              |
|--------|---------------------------------------------------------------|-----------------------------------------------------------|
| A      | Construire de nouveaux réacteurs nucléaires                    | Coûts élevés, délais longs, gestion des déchets           |
| B      | Développer massivement l'éolien et le solaire                  | Production variable, besoins de stockage, impact paysager |
| C      | Combiner nucléaire et renouvelables à parts comparables       | Deux programmes d'investissement à financer en parallèle  |
| D      | Réduire d'abord la consommation (sobriété, efficacité)        | Changements de modes de vie, possible frein à l'activité  |

### D-env-rythme
- statut : actif
- voisines : A-B, C-D (accélérer d'un côté, ralentir ou maintenir de l'autre)

> Accélérer la transition écologique a un coût à court terme. Quel rythme vous paraît le bon ?

| option | libellé                                                                   | contrepartie souvent avancée                            |
|--------|---------------------------------------------------------------------------|---------------------------------------------------------|
| A      | Accélérer, même si cela pèse sur certains prix et certaines activités     | Effort ressenti par les ménages et certains secteurs    |
| B      | Accélérer en faisant contribuer d'abord les plus gros émetteurs           | Risque de délocalisation de certaines activités          |
| C      | Garder le rythme actuel des engagements                                   | Objectifs climatiques plus difficiles à tenir           |
| D      | Assouplir certaines normes pour préserver pouvoir d'achat et compétitivité | Retard sur les objectifs climatiques                   |

---

## secu — Sécurité & justice

### D-secu-budget
- statut : actif
- voisines : A-B (deux renforcements de la réponse pénale)

> Le budget sécurité-justice ne peut augmenter que sur un seul poste. Lequel choisir ?

| option | libellé                                                    | contrepartie souvent avancée                                |
|--------|------------------------------------------------------------|-------------------------------------------------------------|
| A      | Plus de policiers et de gendarmes sur le terrain            | Effet limité si la chaîne judiciaire ne suit pas            |
| B      | Plus de places de prison pour exécuter les peines           | Coût élevé, effet discuté sur la récidive                   |
| C      | Plus de magistrats et de greffiers pour juger plus vite     | Effets visibles seulement à moyen terme                     |
| D      | Plus de prévention (éducateurs, médiation, insertion)       | Résultats lents et difficiles à mesurer                     |

---

## immig — Immigration

### D-immig-travail
- statut : actif
- voisines : A-B, C-D (recours à l'immigration d'un côté, à l'emploi local de l'autre)

> Certains secteurs manquent de main-d'œuvre (bâtiment, restauration, soins). Quelle réponse
> privilégier ?

| option | libellé                                                                 | contrepartie souvent avancée                               |
|--------|-------------------------------------------------------------------------|------------------------------------------------------------|
| A      | Faciliter l'immigration de travail dans ces métiers                     | Hausse de l'immigration, enjeux d'intégration               |
| B      | Régulariser les travailleurs sans titre de séjour déjà en emploi        | Risque perçu d'incitation à l'immigration irrégulière       |
| C      | Former et orienter en priorité les demandeurs d'emploi vers ces métiers | Délais longs, besoins non couverts dans l'intervalle        |
| D      | Augmenter les salaires dans ces métiers pour attirer des candidats      | Hausse des prix des services concernés                      |

---

## europe — Europe & international

### D-europe-regles
- statut : actif
- type : gradué
- voisines : A-B, B-C, C-D (dilemme gradué, du plus au moins européen)

> Une règle européenne s'oppose à une décision prise en France. Que devrait faire la France ?

| option | libellé                                                          | contrepartie souvent avancée                               |
|--------|------------------------------------------------------------------|------------------------------------------------------------|
| A      | Appliquer la règle européenne, les engagements communs priment     | Marge de manœuvre nationale réduite                        |
| B      | L'appliquer tout en négociant sa modification au niveau européen  | Négociations longues, issue incertaine                     |
| C      | Pouvoir y déroger dans quelques domaines jugés essentiels        | Risque de sanctions et de tensions avec les partenaires    |
| D      | Faire primer le droit national de manière générale               | Remise en cause du fonctionnement de l'Union               |

### D-europe-defense
- statut : actif
- voisines : aucune (quatre orientations distinctes)

> Le contexte international pousse à renforcer la défense. Quelle orientation privilégier ?

| option | libellé                                                       | contrepartie souvent avancée                               |
|--------|---------------------------------------------------------------|------------------------------------------------------------|
| A      | Augmenter fortement le budget militaire national               | Moins de moyens pour d'autres politiques                   |
| B      | Bâtir une défense européenne commune                           | Partage de décisions de souveraineté avec les partenaires  |
| C      | Renforcer l'engagement au sein de l'OTAN                       | Dépendance accrue envers les États-Unis                    |
| D      | Privilégier la diplomatie et limiter la hausse des dépenses    | Capacités réduites face à une menace directe               |

---

## educ — Éducation & recherche

### D-educ-niveau
- statut : actif
- voisines : A-B (deux hausses de moyens humains)

> Pour améliorer le niveau des élèves, un seul effort peut être financé. Lequel ?

| option | libellé                                                        | contrepartie souvent avancée                             |
|--------|----------------------------------------------------------------|----------------------------------------------------------|
| A      | Réduire le nombre d'élèves par classe                           | Coût élevé, besoin de recruter beaucoup d'enseignants    |
| B      | Mieux payer et mieux former les enseignants                     | Coût élevé, effets progressifs                            |
| C      | Donner plus d'autonomie aux établissements                      | Risque d'écarts accrus entre établissements              |
| D      | Recentrer sur les fondamentaux avec des évaluations régulières  | Moins de place pour d'autres enseignements               |

---

## sante — Santé

### D-sante-deserts
- statut : actif
- voisines : A-B, C-D (agir sur les médecins d'un côté, contourner la pénurie de l'autre)

> Pour lutter contre les déserts médicaux, quelle mesure accepteriez-vous en priorité ?

| option | libellé                                                                      | contrepartie souvent avancée                            |
|--------|------------------------------------------------------------------------------|---------------------------------------------------------|
| A      | Obliger les jeunes médecins à exercer quelques années dans les zones sous-dotées | Risque de détourner des étudiants de la médecine générale |
| B      | Mieux rémunérer les médecins qui s'installent dans ces zones                 | Coût élevé, résultats incertains                         |
| C      | Confier davantage d'actes aux pharmaciens et aux infirmiers                  | Réserves sur la qualité de certains suivis               |
| D      | Développer fortement la téléconsultation                                     | Pas d'examen physique, difficultés pour certains publics |

---

## instit — Institutions & démocratie

### D-instit-participation
- statut : actif
- voisines : A-C (deux formes de participation directe des citoyens)

> Pour que les citoyens pèsent davantage sur les décisions, quelle réforme privilégier ?

| option | libellé                                                            | contrepartie souvent avancée                               |
|--------|--------------------------------------------------------------------|------------------------------------------------------------|
| A      | Créer un référendum d'initiative citoyenne                          | Risque de décisions sur des sujets complexes ou émotionnels |
| B      | Introduire la proportionnelle aux élections législatives            | Majorités plus difficiles à former                          |
| C      | Généraliser les conventions de citoyens tirés au sort               | Légitimité discutée, avis non contraignants                 |
| D      | Garder les institutions actuelles et en améliorer le fonctionnement | Peu de changement pour ceux qui se sentent peu représentés  |
