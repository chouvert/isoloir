# Sujets émergents

Registre tenu par la mise à jour hebdomadaire (`CLAUDE.md`, « Mise à jour hebdomadaire ») : chaque
information retenue dans la veille reçoit un sujet, et ce tableau compte les sujets semaine après semaine.
Il sert à décider quand proposer une évolution du référentiel, sans refaire les recherches.
Spec : `docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md`, § 3.

## Déclencheurs d'une proposition

- **Sujet nouveau** : non couvert, abordé par au moins 3 candidats, ou par 2 candidats deux semaines de suite.
- **Dilemme qui ne départage plus** : tous les candidats inclus sauf un sur la même option, ou plus des deux
  tiers en `pas de position` après le 2027-01-15.
- **Question dépassée** : rendue sans objet par un événement (réforme votée, décision de justice…).
- **Nouveau thème** : seulement si un sujet ne relève d'aucun des 9 thèmes ; la proposition inclut alors la
  modification du budget de points du parcours (`scripts/lib/parcours.mjs`) et de ses tests.

Au plus un changement de référentiel par semaine, dans une PR « Référentiel : … ». Un sujet refusé par Julien
est noté « refusé le AAAA-MM-JJ » dans la colonne décision et n'est plus proposé sauf fait nouveau.

## Registre

| sujet | thème | semaines | candidats | couvert par | décision |
|-------|-------|----------|-----------|-------------|----------|
| Mix électrique et sortie du nucléaire (calendrier du 100 % renouvelables) | env | 2026-S45 | Mélenchon | D-env-electricite, Q-env-nuc, Q-env-renouv | |
| Règle verte dans la Constitution | env | 2026-S45 | Mélenchon | D-env-rythme, Q-instit-constit | |
| Service national ou conscription | europe | 2026-S45, 2026-S46 | Mélenchon (S45) ; Philippe (S46 : service militaire volontaire, écart avec un service obligatoire) | non couvert | |
| Objectif de dépenses militaires de l'OTAN (5 % du PIB) | europe | 2026-S45 | Mélenchon | Q-europe-defense | |
| Effort de défense : massification, armements européens | europe | 2026-S46 | Philippe | D-europe-defense, Q-europe-defense | |
| Moratoire sur des règles européennes | europe | 2026-S45 | Mélenchon | D-europe-regles, Q-europe-traites | |
| Avenir institutionnel de la Nouvelle-Calédonie | instit | 2026-S45 | Mélenchon | non couvert | |
| Pétitions citoyennes débattues au Parlement | instit | 2026-S45 | Mélenchon | Q-instit-referend | |
| Prévention et dépistage des cancers, santé environnementale | sante | 2026-S45 | Batho (parti : Génération écologie) | non couvert | |
| Effectifs de la fonction publique (recrutements ou suppressions de postes) | eco | 2026-S46 | Roussel (+500 000), Tondelier (+250 000 à 350 000), Zemmour (−800 000), Attal (−100 000), Mélenchon (22 Md€ pour les services publics) ; déjà dans les fiches Philippe, Retailleau | non couvert (en partie D-eco-dette, Q-eco-deficit) | déclencheur « sujet nouveau » atteint : PR « Référentiel : effectifs de la fonction publique » (2026-11-14) |
| Orientation scolaire et voie professionnelle (collège unique, bac pro) | educ | 2026-S46 | Philippe (orientation dès la 5e), Zemmour (fin du collège unique), Mélenchon (bac pro en 4 ans) | non couvert | déclencheur atteint, reporté (un changement de référentiel par semaine) |
| Plan d'investissement de transition chiffré et taxes sur les secteurs émetteurs | env | 2026-S46 | Glucksmann | D-env-rythme, Q-env-climat | |
| Taxation des très grands patrimoines | eco | 2026-S46 | Glucksmann | Q-eco-patrimoine | |
| Épargne réglementée fléchée (livret de souveraineté) | eco | 2026-S46 | Glucksmann | non couvert | |
| Loi de programmation écologique | env | 2026-S46 | Glucksmann | non couvert | |
| « République écologique » dans la Constitution | instit | 2026-S46 | Glucksmann | Q-instit-constit | |
| Concentration des médias | instit | 2026-S46 | Glucksmann (entretien non lu) | non couvert | |
| Salaire et recrutement des enseignants | educ | 2026-S46 | Philippe, Attal, Roussel, Glucksmann | D-educ-niveau, Q-educ-enseign | |
| Évaluations, fondamentaux, autonomie des établissements | educ | 2026-S46 | Philippe, Lisnard | D-educ-niveau | |
| Organisation du ministère (ministère du savoir) | educ | 2026-S46 | Lisnard | non couvert | |
| Parcoursup | educ | 2026-S46 | Glucksmann | Q-educ-univ | |
| Mixité sociale dans l'enseignement privé | educ | 2026-S46 | Glucksmann | non couvert | |
| Téléphone portable à l'école | educ | 2026-S46 | Philippe | non couvert | |
| Prisons et exécution des peines | secu | 2026-S46 | Philippe, Zemmour, Attal | D-secu-budget, Q-secu-justice | |
| Magistrats, greffiers, juges de paix | secu | 2026-S46 | Tondelier, Philippe | D-secu-budget, Q-secu-justice | |
| Effectifs de police et de gendarmerie | secu | 2026-S46 | Roussel, Glucksmann | D-secu-budget, Q-secu-effectifs | |
| LBD et polices municipales | secu | 2026-S46 | Roussel | non couvert | |
| Déserts médicaux : installation, délégation de tâches | sante | 2026-S46 | Tondelier, Zemmour | D-sante-deserts, Q-sante-acces | |
| Retraites : âge, durée, capitalisation | social | 2026-S46 | Philippe, Lisnard | D-social-retraites, Q-social-retraite | |
| Gestion des retraites par les partenaires sociaux | social | 2026-S46 | Philippe | non couvert | |
| Chômage et RSA, apprentissage | social | 2026-S46 | Philippe, Zemmour | D-social-chomage, Q-social-chomage | |
| Congés et temps partiel après une naissance | social | 2026-S46 | Philippe | non couvert | |
| Salaire net : financement de la protection sociale | eco | 2026-S46 | Philippe | D-eco-pouvoir-achat, Q-social-smic | |
| Aides énergie aux ménages (chèque, électrification, véhicule électrique) | env | 2026-S46 | Glucksmann, Philippe | D-eco-pouvoir-achat (en partie) | |
| Nucléaire et renouvelables | env | 2026-S46 | Philippe | D-env-electricite, Q-env-nuc, Q-env-renouv | |
| Prix du carbone aux frontières | env | 2026-S46 | Philippe | non couvert | |
| Agences de l'État et normes | eco | 2026-S46 | Philippe | non couvert | |
| Innovation, IA, agence de recherche de rupture | eco | 2026-S46 | Lisnard | non couvert | |
| Niveau de l'immigration et référendum migratoire | immig | 2026-S46 | Zemmour | Q-immig-niveau, Q-instit-referend | |
| Ukraine : vote des populations sur les frontières | europe | 2026-S46 | Mélenchon | Q-europe-ukraine | |
| Services publics de proximité (guichet à 15 minutes) | instit | 2026-S46 | Tondelier | non couvert | |
| Culture | non classé | 2026-S46 | Tondelier (propositions non lues) | non couvert | |
