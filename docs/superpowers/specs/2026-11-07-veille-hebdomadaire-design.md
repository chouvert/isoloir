# Veille et mise à jour hebdomadaire — conception

Date : 2026-11-07. Statut : conception validée en discussion par Julien, à relire avant le plan de travail.

## Objectif

Tenir la base à jour jusqu'au premier tour (2027-04-18) avec **15 minutes de validation par semaine**
pour Julien, le week-end, sans épuiser le quota Claude Pro. La mise à jour couvre :

1. les **fiches des candidats** (nouvelles mesures, revirements, propositions phares, dilemmes) ;
2. la **liste des candidats inclus** (sondages, déclarations, retraits, primaires — par exemple une
   primaire du centre droit qui remplacerait plusieurs candidats par un seul) ;
3. le **référentiel** (questions, dilemmes, thèmes) quand l'actualité fait émerger un sujet ou rend un
   élément caduc.

Hors périmètre : l'affichage côté utilisateurs (pages, libellés, date de mise à jour visible) — chantier
interface, à reprendre avec les remarques de lisibilité de Julien. Seule la règle « aucune donnée
utilisateur conservée » et son contrôle sont traités ici.

## Décisions de Julien (2026-11-07)

| Question | Décision |
|---|---|
| Rythme | Une mise à jour par semaine, prête le samedi ; validation en 15 minutes |
| Format | Une seule PR hebdomadaire, résumé de ce qui change les scores en tête |
| Liste des candidats | Revue chaque semaine dans la même PR |
| Référentiel | La veille propose **et rédige** (seconde PR) ; Julien accepte ou refuse |
| Utilisateurs | Refaire le parcours après un changement de référentiel est acceptable |
| Données utilisateurs | Aucune conservation : ni cookie, ni stockage du navigateur, ni base de données |
| Architecture | Collecte quotidienne gratuite (GitHub Actions) + session Claude le samedi |
| Évolution possible | Plus tard, une issue GitHub par information (approche « au fil de l'eau ») |

## 1. Collecte quotidienne (GitHub Actions, sans Claude)

### Sources — `veille/sources.yml`
Une entrée par source :

```yaml
- id: public-senat-politique
  nom: Public Sénat — politique
  type: rss            # rss | page | sitemap
  url: https://…
  categorie: presse    # campagne | parti | presse | sondages | institution
  candidats: transverse  # ou liste d'identifiants de fiches
```

Départ : sites de campagne et de parti des 12 candidats inclus (flux ou page d'actualités), Public Sénat,
LCP, La Gazette France (dépêches AFP), en.wikipedia « Opinion polling for the 2027 French presidential
election », Commission des sondages (notices). Ajouter une source = ajouter une entrée, sans toucher au code.

### Script — `scripts/veille.mjs`
- Lancé chaque jour à 6 h (heure de Paris) par `.github/workflows/veille.yml` (cron + lancement manuel).
- Pour chaque source : récupère les éléments publiés depuis le dernier passage (titre, date, lien, chapô).
  `rss` : lecture du flux ; `page` : liens de la page d'actualités avec leur titre ; `sitemap` : entrées datées.
- **Filtre** : garde un élément s'il cite un candidat inclus ou à surveiller (noms et alias, tirés des
  fiches et de `referentiel/candidats-inclus.md`), ou un mot de campagne (`veille/mots-cles.yml` :
  primaire, sondage, candidature, retrait, programme, parrainages…). Les sources de catégorie `campagne`
  et `parti` sont gardées sans filtre.
- **Dédoublonnage** sur l'URL normalisée (sans paramètres de suivi), sur toute la campagne
  (`veille/vus.txt`, une URL par ligne).
- Requêtes polies : client nommé « isoloir-veille » (sans adresse personnelle), une requête à la fois,
  délai entre deux requêtes, délai d'expiration court, respect de `robots.txt`.
- Aucune nouvelle dépendance : lecture RSS/Atom et des plans de site par un analyseur minimal écrit
  dans `scripts/lib/veille.mjs` (balises `item`/`entry`, `title`, `link`, `pubDate`/`updated`, `description`/`summary`),
  `fetch` natif de Node 22.
- Le cron GitHub est en UTC : `0 5 * * *` (6 h à Paris en hiver, 7 h en été).

### Ce qui est enregistré
- `veille/AAAA-Sxx.jsonl` : une ligne par information, **identifiant stable** (`AAAA-MM-JJ-<hash court de l'URL>`),
  source, date, titre, lien, chapô (300 caractères au plus), candidats détectés, mots-clés détectés.
  C'est ce format qui permettra plus tard de créer une issue par information.
- `veille/AAAA-Sxx.md` : même contenu, lisible, classé par candidat puis « transverse ».
- `veille/etat.json` : dernier passage réussi et nombre d'échecs consécutifs par source.
- Jamais le texte intégral d'un article (droit d'auteur).
- Semaine ISO, du lundi au dimanche ; la session du samedi lit la semaine en cours et le reliquat de la précédente.

### Rangement
Branche dédiée **`veille`**, jamais fusionnée dans `main` : les commits quotidiens ne déclenchent ni la
publication du site ni le contrôle de la base, et l'historique de `main` reste lisible. Le workflow a la
seule permission d'écrire sur cette branche.

### Pannes
- Une source en erreur est réessayée le lendemain ; au-delà de 3 échecs consécutifs, elle est listée en
  tête du journal (« muette depuis N jours »).
- Une source qui ne renvoie plus rien de daté (changement de format) est signalée de la même façon.
- Le samedi, Claude compense les sources muettes par des recherches web ciblées et les signale dans la PR.

### Tests
`tests/veille.test.mjs` : lecture d'un flux et d'une page d'exemple (fichiers de test, pas de réseau),
filtre, dédoublonnage, identifiant stable, format JSONL et Markdown, comptage des échecs.

## 2. Session du samedi (tâche planifiée Claude)

### Déclenchement
- Tâche planifiée « Mise à jour hebdomadaire » le **samedi à 6 h** ; notification quand la PR est prête.
- Tâche de **rattrapage le dimanche à 6 h** : ne fait rien si la PR de la semaine existe ; sinon reprend
  depuis la branche de travail (le travail est commité au fil de l'eau, à chaque candidat traité).
- Le texte des deux tâches renvoie à `CLAUDE.md`, section « Mise à jour hebdomadaire », qui décrit les
  étapes ci-dessous ; modifier la méthode = modifier `CLAUDE.md`, pas les tâches.

### Étapes
1. **Préparer** : lire `CLAUDE.md`, le journal de la semaine (branche `veille`), `referentiel/candidats-inclus.md`,
   `referentiel/sujets-emergents.md`. Branche de travail `maj-AAAA-Sxx` depuis `main`.
2. **Candidats** : relever les sondages de premier tour de la semaine (instituts, dates, scores),
   déclarations, retraits, primaires, puis appliquer la règle d'inclusion du README.
   - **Sortie** : la fiche est conservée ; `inclus: non` dans son frontmatter (nouveau champ, voir
     § Données) et le candidat passe dans « Non inclus » de `candidats-inclus.md` avec la raison ;
     statut `retiré` s'il renonce. Un candidat dont le parti a un parlementaire ne sort pas sous 2 %.
   - **Entrée** : ajout à `candidats-inclus.md` ; fiche rédigée dans une PR séparée, la même session si le
     quota le permet, sinon la semaine suivante (signalé dans la PR hebdomadaire).
   - **Primaire** : le vainqueur reste ou entre, les autres sortent (statut `retiré` s'ils se rallient).
3. **Fiches** : pour chaque candidat ayant des entrées dans le journal, classer chaque information
   (nouvelle mesure, revirement, annonce dédiée candidate aux phares, sans objet) ; n'ouvrir que les liens
   retenus ; appliquer la grille R1 à R5 de `CLAUDE.md` ; mettre à jour `derniere_maj` ; consigner un
   revirement dans « Évolutions ». Commit après chaque candidat.
4. **Sujets** : attribuer un sujet à chaque information retenue et mettre à jour
   `referentiel/sujets-emergents.md` (voir § 3).
5. **Vérification** : un agent neuf contrôle **uniquement** les rattachements modifiés, les phares
   modifiés, les entrées et sorties de candidats (sources lues, règles appliquées). Corrections appliquées
   directement, sans relancer le rédacteur.
6. **Clôture** : `npm run valider`, `npm run comparatifs`, tests ; PR « Mise à jour AAAA-Sxx ».

### Plafonds (quota)
- Au plus **8 informations ouvertes par candidat** et par semaine, les plus récentes et les plus
  importantes d'abord (programme, annonce dédiée, revirement) ; le reste est reporté à la semaine
  suivante et noté dans la PR.
- Au plus **une fiche nouvelle** et **un changement de référentiel** par semaine.
- Semaine sans information pour un candidat : sa fiche n'est pas ouverte.

### Corps de la PR hebdomadaire (lu en 15 minutes)
1. **Candidats** : entrées, sorties, changements de statut, sondages de la semaine retenus.
2. **Ce qui modifie les scores** : tableau candidat | dilemme | avant | après | justification d'une phrase | source.
3. **Phares modifiés** : candidat | ancien | nouveau | motif.
4. **À arbitrer** : trois points au plus, chacun avec la recommandation de Claude ; sans réponse de Julien,
   la recommandation s'applique à la fusion.
5. **Sources muettes** et compensations.
6. **Le reste** (replié) : sources ajoutées, citations précisées, informations reportées.

Semaine sans changement : la PR est quand même ouverte, avec le seul journal des sources et la mention
« aucun changement », pour que Julien sache que la veille a tourné.

## 3. Évolution du référentiel

### Registre — `referentiel/sujets-emergents.md`
Tableau : sujet | thème | semaines où il apparaît | candidats qui s'expriment | couvert par (question,
dilemme, ou « non ») | décision. Mis à jour chaque samedi ; les preuves s'accumulent sans nouvelles recherches.

### Déclencheurs d'une proposition
- **Sujet nouveau** : non couvert, abordé par au moins 3 candidats, ou par 2 candidats deux semaines de suite.
- **Dilemme qui ne départage plus** : tous les candidats inclus sauf un sur la même option, ou plus des deux
  tiers en `pas de position` après le 2027-01-15.
- **Question dépassée** : rendue sans objet par un événement (réforme votée, décision de justice…).
- **Nouveau thème** : seulement si un sujet ne relève d'aucun des 9 thèmes ; la proposition inclut alors la
  modification du budget de points du parcours (`scripts/lib/parcours.mjs`) et de ses tests.

### Seconde PR « Référentiel : … »
- Une par semaine au plus, ouverte à partir de la branche hebdomadaire (Julien fusionne d'abord la
  mise à jour de la semaine, puis celle du référentiel).
- Contenu : l'élément rédigé selon les règles de `referentiel/dilemmes.md` ou `questions.md` (contrainte
  explicite, options réelles, une idée par option, voisinages, contreparties neutres) ; le rattachement
  ou la position des 12 candidats, sourcés ; le lien à une préoccupation si besoin ; la mise à jour du
  gabarit `candidats/_modele.md`.
- Vérification par un agent neuf centrée sur la **neutralité des options** et sur les rattachements.
- Corps : pourquoi (extrait du registre), l'élément proposé, le tableau des 12 rattachements, l'effet sur
  le parcours.
- Refus par Julien : la décision est notée dans le registre (« refusé le … ») et le sujet n'est plus
  proposé sauf fait nouveau.

### Règles de changement (déjà en vigueur, rappelées)
- Reformulation sans changement de sens : même identifiant, ligne `historique`.
- Changement de sens : nouvel identifiant, l'ancien passe `obsolète`.
- Un identifiant n'est jamais réutilisé.

## 4. Données et contrôles

- **Champ `inclus`** dans le frontmatter des fiches (`oui` | `non`, `oui` par défaut s'il est absent) :
  lu par la génération de `donnees/base.json` ; un candidat `inclus: non` reste dans la base mais est
  marqué comme tel. Contrôle : cohérence entre le champ et `referentiel/candidats-inclus.md`.
- **Version du référentiel** : `donnees/base.json` porte `referentiel_maj`, date de la dernière modification
  d'une question, d'un dilemme ou d'un thème actif (calculée par la génération).
- **Aucune donnée utilisateur conservée** : règle écrite dans le README et `identite/charte.md`. Le contrôle
  de la base échoue si le code du site (`site/src`) utilise `localStorage`, `sessionStorage`, `indexedDB`,
  `document.cookie` ou envoie les réponses à un serveur (`fetch` vers une autre origine que les fichiers du site).

## 5. Ce qui change dans le dépôt

| Fichier | Nature |
|---|---|
| `veille/sources.yml`, `veille/mots-cles.yml` | nouveaux (branche `main`, configuration) |
| `scripts/veille.mjs`, `scripts/lib/veille.mjs` | nouveaux |
| `.github/workflows/veille.yml` | nouveau (écrit sur la branche `veille`) |
| `tests/veille.test.mjs` | nouveau |
| `referentiel/sujets-emergents.md` | nouveau |
| `scripts/lib/validation.mjs`, `scripts/lib/generation.mjs` | champ `inclus`, `referentiel_maj`, contrôle « aucun stockage » |
| `candidats/_modele.md` | champ `inclus` |
| `CLAUDE.md` | section « Mise à jour hebdomadaire » |
| `README.md`, `identite/charte.md` | règle « aucune donnée utilisateur conservée » |
| Tâches planifiées Claude | samedi 6 h et dimanche 6 h (créées après la fusion) |

## 6. Évolution prévue plus tard (hors périmètre)

Approche « une issue par information » : une étape ajoutée au workflow lit le JSONL de la veille et crée
une issue par identifiant nouveau (étiquettes par candidat et par sujet). Julien trie les issues ; la
session du samedi ne traite alors que les issues retenues. Le format JSONL est prévu pour cela.

## Risques

- **Sites sans flux ou qui bloquent les robots** : compensation par recherches le samedi ; source retirée
  si elle reste muette un mois.
- **Quota coupé le samedi** : travail commité par candidat, rattrapage le dimanche.
- **Bruit du filtre** (homonymes, articles sans rapport) : coût limité, le tri du samedi les écarte ; mots
  ambigus ajustés dans `veille/mots-cles.yml`.
- **Changement de référentiel mal neutre** : vérification dédiée et décision de Julien à chaque fois.
