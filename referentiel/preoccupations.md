# Préoccupations

Première étape du parcours web. L'utilisateur choisit **jusqu'à 3** sujets qui le préoccupent
le plus, ou « Rien de tout ça en particulier ». Ses choix servent à :

1. pré-remplir le budget de priorités (étape 2), qu'il ajuste ensuite librement ;
2. poser en premier les dilemmes liés à ses préoccupations (étape 3).

Les règles de calcul sont dans `referentiel/methode-proximite.md`.

## Règles de rédaction

- **Des sujets, pas des opinions** : chaque libellé doit pouvoir être choisi quelle que soit
  l'opinion de l'utilisateur sur le sujet (« l'immigration et l'intégration », pas
  « maîtriser l'immigration » ni « l'accueil des réfugiés »).
- **Le vocabulaire du quotidien**, pas celui des programmes ni des slogans de campagne.
- **Chaque thème est le thème principal d'au moins une préoccupation.**
- **Ordre aléatoire** à l'affichage.
- **Identifiants** : `P-<mot>`, jamais réutilisés.

## Colonnes

- `thème principal` : thème auquel la préoccupation se rattache d'abord (2 parts dans le pré-remplissage).
- `thème secondaire` : thème lié, facultatif (1 part), `—` sinon.
- `dilemme` : dilemme posé en premier si la préoccupation est choisie, `—` sinon. Il doit
  appartenir au thème principal ou au thème secondaire.

## Liste

| id                  | libellé                                          | explication                                                          | thème principal | thème secondaire | dilemme                |
|---------------------|--------------------------------------------------|----------------------------------------------------------------------|-----------------|------------------|------------------------|
| P-fin-de-mois       | Boucler les fins de mois                         | Prix, salaires, impôts et aides : ce qui pèse sur le budget du foyer  | eco             | social           | D-eco-pouvoir-achat    |
| P-emploi            | Trouver ou garder un emploi                      | Chômage, conditions de travail, formation et reconversion             | social          | eco              | D-social-chomage       |
| P-logement          | Se loger à un prix abordable                     | Loyers, accès à la propriété, construction de logements               | social          | eco              | —                      |
| P-retraite          | La retraite                                      | Âge de départ, montant des pensions, financement du système           | social          | —                | D-social-retraites     |
| P-soins             | Accéder à un médecin, à l'hôpital                | Délais, déserts médicaux, situation de l'hôpital public               | sante           | —                | D-sante-deserts        |
| P-proche-dependant  | S'occuper d'un proche âgé ou dépendant           | Établissements, aide à domicile, soutien aux aidants                  | sante           | social           | —                      |
| P-securite          | La sécurité au quotidien                         | Délinquance, police, justice et exécution des peines                  | secu            | —                | D-secu-budget          |
| P-climat            | Le climat et l'environnement                     | Réchauffement, pollution, biodiversité, adaptation                    | env             | —                | D-env-rythme           |
| P-energie           | Le prix de l'énergie                             | Électricité, carburant, chauffage et choix de production              | env             | eco              | D-env-electricite      |
| P-ecole             | L'école et l'avenir des enfants                  | Niveau scolaire, enseignants, orientation, études supérieures         | educ            | —                | D-educ-niveau          |
| P-immigration       | L'immigration et l'intégration                   | Entrées sur le territoire, asile, intégration, nationalité            | immig           | —                | D-immig-travail        |
| P-dette             | La dette et les finances publiques               | Déficit, dette, dépenses de l'État                                    | eco             | —                | D-eco-dette            |
| P-international     | La guerre et la place de la France dans le monde | Défense, Europe, conflits, diplomatie                                 | europe          | —                | D-europe-defense       |
| P-confiance         | La confiance dans la politique                   | Fonctionnement des institutions, participation, représentation        | instit          | —                | D-instit-participation |
