# Élection présidentielle 2027 — base comparative

Base de données versionnée des candidats et de leurs programmes, conçue pour les comparer
thème par thème et évaluer la faisabilité de chaque programme.

Les fichiers Markdown sont la source de vérité. Le frontmatter YAML et les identifiants
stables (thèmes, questions, propositions, critères) rendent les données exploitables
par une interface de visualisation.

## Arborescence

```
comparatif-programme-presidentielles/
├── README.md                     # ce fichier : conventions
├── referentiel/
│   ├── themes.md                 # liste fermée des thèmes
│   ├── questions.md              # questions-clés posées à tous les candidats
│   ├── preoccupations.md         # préoccupations proposées en entrée du parcours web
│   ├── dilemmes.md               # dilemmes posés aux utilisateurs du parcours web
│   ├── methode-proximite.md      # méthode de calcul de la proximité utilisateur-candidats
│   └── faisabilite.md            # grille et barème de faisabilité
├── candidats/
│   ├── _modele.md                # gabarit à copier pour chaque candidat
│   └── nom-prenom.md             # une fiche par candidat
├── comparatifs/
│   ├── _modele-theme.md          # gabarit de matrice thématique
│   ├── faisabilite.md            # comparatif des notes de faisabilité
│   └── <id-theme>.md             # une matrice par thème
├── sources.md                    # sources transverses
├── scripts/                      # contrôle de la base et calcul de proximité
├── tests/                        # tests des scripts
└── .github/workflows/            # contrôle automatique sur GitHub
```

## Candidats inclus

La base retient, selon une règle identique pour tous :

1. **Jusqu'à la publication de la liste officielle** par le Conseil constitutionnel :
   - les candidats déclarés ou investis par un parti disposant d'au moins un député ou un sénateur ;
   - les candidats déclarés qui atteignent au moins 2 % des intentions de vote au premier tour
     dans au moins deux instituts de sondage différents, sur les sondages du dernier mois.
2. **Après la publication de la liste officielle** : tous les candidats officiels, et eux seuls.

Un candidat qui retire sa candidature passe au statut `retiré` ; sa fiche est conservée.
La règle est réexaminée à chaque mise à jour importante des sondages.

## Contrôle de la base

Un script vérifie la cohérence des données à chaque push et sur chaque pull request
(GitHub Actions). Une erreur bloque ; un avertissement signale un point à surveiller.

En local (Node.js 20 ou plus) :

```sh
npm install
npm run valider     # contrôle des données
npm test            # tests des scripts
```

Ce qui est vérifié :

| Domaine          | Contrôles                                                                                     |
|------------------|-----------------------------------------------------------------------------------------------|
| Référentiel      | Identifiants uniques et bien formés ; chaque question et chaque dilemme rattachés à un thème existant |
| Préoccupations   | Identifiants et libellés uniques ; thèmes existants ; dilemme actif appartenant au thème principal ou secondaire ; chaque thème principal d'au moins une préoccupation |
| Dilemmes         | Statut autorisé (actif, brouillon, obsolète) ; énoncé présent ; au moins deux options, chacune avec libellé et contrepartie ; voisinages entre options existantes |
| Gabarit          | `_modele.md` contient toutes les questions actives, tous les dilemmes actifs et tous les thèmes du référentiel |
| Frontmatter      | Champs obligatoires (`id`, `nom`, `statut`, `derniere_maj`) ; `id` = nom du fichier ; statut autorisé ; dates ISO |
| Positions        | Toutes les questions actives présentes une seule fois ; valeurs autorisées pour les questions fermées ; une source par position renseignée |
| Dilemmes (fiche) | Tous les dilemmes actifs présents une seule fois ; réponse = option existante, `aucune` ou `pas de position` ; justification et source pour toute réponse autre que `pas de position` |
| Phares           | Au plus 3 ; chacune renvoie à une proposition de la fiche, une seule fois, avec motif et source du choix |
| Propositions     | Une sous-section par thème ; identifiants `<theme>-NN` uniques ; texte et source présents      |
| Évolutions       | Format `- AAAA-MM-JJ : description`                                                           |
| Faisabilité      | Tous les critères notés de 1 à 5 avec justification ; note globale = moyenne arrondie au demi-point ; confiance autorisée ; texte « Pourquoi cette note » présent |
| Comparatifs      | Candidats et questions existants ; valeurs identiques à celles des fiches                     |

Avertissements (non bloquants) : questions ou dilemmes non renseignés, analyses à des dates
différentes selon les candidats, comparatif thématique désynchronisé des fiches.

## Calcul de proximité

`scripts/lib/parcours.mjs` (pré-remplissage du budget, ordre des dilemmes) et
`scripts/lib/proximite.mjs` (score) implémentent `referentiel/methode-proximite.md`. Ces modules
n'ont aucune dépendance et n'accèdent pas au disque : ils sont conçus pour tourner dans le navigateur de
l'utilisateur, dont les réponses ne quittent jamais l'appareil. Les exemples chiffrés de la méthode
servent de tests (`tests/parcours.test.mjs`, `tests/proximite.test.mjs`) : toute modification du calcul qui changerait ce
résultat fait échouer les tests.

## Conventions

### Nommage
- Fiches candidats : `candidats/nom-prenom.md`, en minuscules, sans accents, tirets entre les mots.
- L'`id` du frontmatter est identique au nom de fichier (sans `.md`).
- Les fichiers préfixés par `_` sont des gabarits, jamais des données.

### Identifiants
| Objet        | Format                 | Exemple         | Défini dans                 |
|--------------|------------------------|-----------------|-----------------------------|
| Thème        | `<id>`                 | `eco`           | `referentiel/themes.md`     |
| Question     | `Q-<theme>-<mot>`      | `Q-env-nuc`     | `referentiel/questions.md`  |
| Proposition  | `<theme>-<nn>`         | `eco-01`        | fiche du candidat           |
| Critère      | `F-<code>`             | `F-fin`         | `referentiel/faisabilite.md`|
| Dilemme      | `D-<theme>-<mot>`      | `D-env-electricite` | `referentiel/dilemmes.md` |
| Option       | `A`, `B`, `C`…         | `B`             | `referentiel/dilemmes.md`   |

Un identifiant n'est jamais réutilisé ni renommé. Une question abandonnée est marquée
`obsolète` dans le référentiel plutôt que supprimée.

### Dates
Format ISO `AAAA-MM-JJ` partout.

### Sources
- Chaque position et chaque proposition porte au moins une source, sous forme de lien Markdown.
- On privilégie les sources primaires : programme officiel, site du candidat, déclarations
  en débat ou interview (avec date).
- Les chiffrages indépendants sont cités avec le nom de l'organisme, en croisant plusieurs
  organismes de sensibilités différentes quand c'est possible.
- Les agrégateurs (sites qui compilent les programmes des candidats) ne sont jamais cités comme
  source d'un fait. Exception : quand la source primaire n'est pas consultable en ligne, un
  agrégateur qui la cite peut servir de relevé, mentionné à côté de la source primaire.
- ÉlyséeScope est exclu, y compris comme relevé : chiffres incohérents et sources invérifiables
  constatés lors du pilote.

### Propositions phares
Chaque fiche désigne jusqu'à 3 propositions mises en avant dans l'interface. Pour que ce choix
ne soit pas éditorial, il suit une règle identique pour tous :

1. **Le résumé du candidat.** S'il résume lui-même son programme en quelques mesures (accroche du
   programme, page d'accueil, affiche, profession de foi), on retient les 3 premières, dans son ordre.
2. **À défaut, ses annonces dédiées.** On retient les 3 annonces les plus récentes que le candidat a
   consacrées à un thème (discours, déplacement, publication), à condition que leur contenu soit
   vérifiable, et pour chacune la mesure principale présentée.

Chaque phare renvoie à une proposition sourcée de la fiche et indique le motif et la source du
choix. Les phares sont revus à chaque mise à jour du programme.

### Faits et analyse
- Les sections « Profil », « Positions », « Propositions » et « Évolutions » ne contiennent que
  des faits sourcés.
- La section « Réponses aux dilemmes » rattache le programme à une option : c'est une
  interprétation, toujours justifiée et sourcée pour rester vérifiable.
- La section « Analyse de faisabilité » est une évaluation produite à partir de ces faits,
  selon la grille de `referentiel/faisabilite.md`, identique pour tous les candidats.

### Mises à jour
- Mettre à jour `derniere_maj` dans le frontmatter à chaque modification de fiche.
- Quand un programme change de version, incrémenter `programme_version` et consigner le
  changement dans « Évolutions / revirements ».
- Les analyses de faisabilité sont refaites pour tous les candidats à la même date afin de
  garder une base de comparaison homogène.
- L'historique Git sert de journal : un commit par mise à jour cohérente, avec un message
  explicite (ex. `dupont-jean: ajout positions thème env`).
