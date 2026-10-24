# Élection présidentielle 2027 — base comparative

Base de données versionnée des candidats et de leurs programmes, conçue pour les comparer
thème par thème et évaluer la faisabilité de chaque programme.

Les fichiers Markdown sont la source de vérité. Le frontmatter YAML et les identifiants
stables (thèmes, questions, propositions, critères) rendent les données exploitables
par une interface de visualisation.

## Arborescence

```
election-2027/
├── README.md                     # ce fichier : conventions
├── referentiel/
│   ├── themes.md                 # liste fermée des thèmes
│   ├── questions.md              # questions-clés posées à tous les candidats
│   └── faisabilite.md            # grille et barème de faisabilité
├── candidats/
│   ├── _modele.md                # gabarit à copier pour chaque candidat
│   └── nom-prenom.md             # une fiche par candidat
├── comparatifs/
│   ├── _modele-theme.md          # gabarit de matrice thématique
│   ├── faisabilite.md            # comparatif des notes de faisabilité
│   └── <id-theme>.md             # une matrice par thème
└── sources.md                    # sources transverses
```

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

### Faits et analyse
- Les sections « Profil », « Positions », « Propositions » et « Évolutions » ne contiennent que
  des faits sourcés.
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
