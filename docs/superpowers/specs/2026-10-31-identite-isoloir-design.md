# Identité de marque « L'Isoloir » — conception

Date : 2026-10-31. Statut : conception validée en discussion par Julien, à relire avant la réalisation.

## Objectif

Donner à l'outil un nom et une identité visuelle avant de construire l'interface (Astro, GitHub
Pages), pour un **public grand public**, y compris peu politisé ou indécis. La marque doit inspirer
confiance par sa **neutralité** et rester **chaleureuse et claire**.

## Décisions de Julien (2026-10-31)

| Question | Décision |
|---|---|
| Public | Grand public |
| Personnalité | Chaleureuse et claire |
| Genre de nom | Mot-image |
| Nom | **L'Isoloir** |
| Palette | Encre et papier |
| Logo | Le rideau entrouvert et le bulletin coché |
| Typographie | Fraunces (titres) + Atkinson Hyperlegible (texte) |

« Boussole » a été écarté : déjà porté par la Boussole électorale de Radio-Canada et par celle de
20 Minutes et du CEVIPOF. Aucun outil électoral nommé « L'Isoloir » n'a été trouvé ; la disponibilité
de la marque (INPI) et du nom de domaine n'est pas vérifiée.

## 1. Plateforme de marque

- **Nom** : L'Isoloir (avec l'apostrophe typographique ’ dans les textes : L’Isoloir).
- **Signature** : « Choisissez en toute connaissance. » ; variante longue : « Choisissez en toute
  connaissance, et en toute discrétion. »
- **Présentation en une phrase** : « L'Isoloir vous aide à voir de quels programmes vous êtes proche,
  sur la base de sources vérifiées, sans jamais vous dire pour qui voter. »
- **Pourquoi ce nom** : le lieu du choix personnel, connu de tous ; il dit deux principes de l'outil —
  on décide seul (aucune recommandation) et rien de ce que l'on répond ne quitte le navigateur.

### Ton
Chaleureux et clair : vouvoiement, phrases courtes, pas de jargon, on explique plutôt qu'on ne juge.
Pas de point d'exclamation, pas d'humour aux dépens d'un candidat ou d'un électorat, pas
d'injonction à voter pour quiconque. Casse de phrase partout (« Commencer le parcours », pas
« Commencer Le Parcours »).

## 2. Règles de neutralité (non négociables)

1. **Aucune couleur associée à un candidat ou à un parti.** Les candidats se distinguent par leur
   nom, jamais par une couleur.
2. **Ordre des candidats** : alphabétique (nom de famille) ou tiré au sort, et le même pour tous.
3. **Aucun pictogramme, photo ou mise en avant** qui favorise un candidat ; si des photos sont un
   jour utilisées, même format, même cadrage et même taille pour tous.
4. **Seules couleurs porteuses de sens** : l'accord (dilemmes, duels) et la faisabilité. Elles
   utilisent des tons du système (pétrole, sable, encre) et une échelle d'intensité, jamais du rouge,
   du rose, du bleu franc, du vert franc, de l'orange ou du violet.

## 3. Identité visuelle

### Couleurs — « Encre et papier »

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| Encre | `#23232B` | `#F5F0E6` (texte) | textes, logo |
| Papier | `#F5F0E6` | `#1C1C22` (fond) | fonds |
| Pétrole | `#1F6F73` | `#5FB3B3` | accent unique : boutons, liens, rideau du logo |
| Sable | `#D9C9A8` | `#4A443A` | fonds secondaires, séparateurs |
| Encre secondaire | `#4A4A55` | `#B8B3A8` | textes secondaires |

Les contrastes texte/fond respectent WCAG AA (vérifiés lors de la réalisation, corrigés si besoin).

### Typographie
- **Fraunces** (Google Fonts) : titres et logo, graisses 400 et 500.
- **Atkinson Hyperlegible** (Google Fonts) : texte courant et interface, 400 et 700 ; conçue pour la
  lisibilité (malvoyance).

### Logo
- **Symbole** : une tringle, un rideau pétrole entrouvert, un bulletin au trait encre avec une coche.
- **Logo complet** : symbole + « L'Isoloir » en Fraunces 500.
- **Déclinaisons** : logo complet, symbole seul (icône d'application), favicon (symbole simplifié,
  lisible à 16 px) ; versions claire et sombre.

## 4. Livrables

1. **Design system « L'Isoloir »** (artefact de type Design System) : README de la marque, tokens
   (couleurs clair/sombre, échelle typographique, espacements, rayons), composants avec aperçu
   (bouton, carte de dilemme, duel, badge de faisabilité), règles de ton et de neutralité, logo.
2. **Fichiers du logo** dans `identite/` : `logo.svg`, `logo-sombre.svg`, `symbole.svg`,
   `symbole-sombre.svg`, `favicon.svg`.
3. **Charte** `identite/charte.md` : plateforme de marque, neutralité en tête, couleurs, typographie,
   logo et règles d'usage.
4. **README et CLAUDE.md** : l'outil s'appelle L'Isoloir ; la charte s'applique aux tâches suivantes
   (interface comprise).

Hors périmètre : renommage du dépôt GitHub (changerait l'adresse du site), nom de domaine,
dépôt de marque. Recommandé avant toute communication publique : recherche gratuite d'antériorité
sur le site de l'INPI.

## Vérification

- Les SVG s'affichent et restent lisibles à 16 px (favicon) et 32 px (symbole).
- Contrastes AA des couples texte/fond de la palette, en clair et en sombre.
- `npm run valider` et `npm test` restent verts (aucun changement de données).
