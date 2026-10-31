# Charte de L’Isoloir

![L’Isoloir](logo.svg)

Cette charte s’applique à tout ce qui porte le nom de L’Isoloir : l’interface, les pages du site,
les visuels de communication. Les valeurs de couleurs font foi dans `couleurs.json` ; les tests
(`tests/identite.test.mjs`) vérifient les contrastes et les couleurs des logos.

## 1. Neutralité — règles non négociables

1. **Aucune couleur associée à un candidat ou à un parti.** Les candidats se distinguent par leur
   nom, jamais par une couleur.
2. **Ordre des candidats** : alphabétique (nom de famille) ou tiré au sort, et le même pour tous.
3. **Aucun pictogramme, aucune photo, aucune mise en avant** qui favorise un candidat. Si des
   photos sont un jour utilisées : même format, même cadrage, même taille pour tous.
4. **Seules couleurs porteuses de sens : l’accord** (dilemmes, duels) **et la faisabilité.** Elles
   utilisent les tons de la palette (pétrole, sable, encre) et une échelle d’intensité ; jamais de
   rouge, rose, bleu franc, vert franc, orange ou violet, même pour dire « d’accord » ou « pas
   d’accord ».

## 2. Plateforme de marque

- **Nom** : L’Isoloir — avec l’apostrophe typographique (’) dans les textes ; « L'Isoloir » en
  texte brut quand l’apostrophe typographique n’est pas disponible.
- **Signature** : « Choisissez en toute connaissance. » — variante longue : « Choisissez en toute
  connaissance, et en toute discrétion. »
- **Présentation** : « L’Isoloir vous aide à voir de quels programmes vous êtes proche, sur la base
  de sources vérifiées, sans jamais vous dire pour qui voter. »
- **Pourquoi ce nom** : l’isoloir est le lieu du choix personnel. Il dit deux principes de l’outil :
  on décide seul (aucune recommandation) et rien de ce que l’on répond ne quitte le navigateur.

### Ton
Chaleureux et clair : on vouvoie, on fait des phrases courtes, on évite le jargon, on explique
plutôt qu’on ne juge.

- Casse de phrase partout : « Commencer le parcours », pas « Commencer Le Parcours ».
- Pas de point d’exclamation ; pas d’humour aux dépens d’un candidat ou d’un électorat.
- Jamais d’injonction à voter pour quiconque ; « proche de », jamais « fait pour vous ».

## 3. Couleurs — « Encre et papier »

| Rôle | Clair | Sombre | Usage |
|---|---|---|---|
| Encre | `#23232B` | `#F5F0E6` | textes, logo |
| Papier | `#F5F0E6` | `#1C1C22` | fonds |
| Pétrole | `#1F6F73` | `#5FB3B3` | accent unique : boutons, liens, rideau du logo |
| Sable | `#D9C9A8` | `#4A443A` | fonds secondaires, séparateurs |
| Encre secondaire | `#4A4A55` | `#B8B3A8` | textes secondaires |

Contrastes (WCAG AA ≥ 4,5:1, vérifiés par les tests) : encre sur papier 13,7 (clair) / 14,9
(sombre) ; encre secondaire sur papier 7,7 / 8,1 ; pétrole sur papier et papier sur pétrole
5,2 / 6,9 ; encre sur sable 9,6 / 8,5.

Le pétrole est le seul accent : un seul bouton principal par écran ; le reste en encre et sable.

## 4. Typographie

| Usage | Police | Graisses |
|---|---|---|
| Titres, logo | [Fraunces](https://fonts.google.com/specimen/Fraunces) | 400, 500 |
| Texte, interface | [Atkinson Hyperlegible](https://fonts.google.com/specimen/Atkinson+Hyperlegible) | 400, 700 |

Atkinson Hyperlegible est conçue pour la lisibilité (malvoyance) : elle reste la police du texte
courant, y compris dans les boutons et les formulaires.

## 5. Logo

| Fichier | Usage |
|---|---|
| `logo.svg` | logo complet sur fond clair (papier ou blanc) |
| `logo-sombre.svg` | logo complet sur fond sombre |
| `symbole.svg` | symbole seul sur fond clair (icône d’application, réseaux) |
| `symbole-sombre.svg` | symbole seul sur fond sombre |
| `favicon.svg` | onglet du navigateur (pastille papier incluse, lisible sur tout fond) |

- **Symbole** : une tringle, un rideau pétrole entrouvert, un bulletin coché.
- **Zone de protection** : autour du logo, un espace libre au moins égal à la hauteur du bulletin.
- **Tailles minimales** : symbole 16 px ; logo complet 120 px de large.
- **Interdits** : déformer, recolorer, ajouter une ombre ou un dégradé, placer le logo sur une
  photo chargée, lui associer une couleur de parti, utiliser la version claire sur fond sombre (ou
  l’inverse).
- Le nom est dessiné en tracés dans les fichiers : il s’affiche même sans la police Fraunces.

## Références

- Design system (tokens, composants, logos) : https://claude.ai/artifact/NYSNKChvLpwkwJimVfK2ZG — privé tant qu’il n’est pas partagé depuis son menu Partager
- Conception : `docs/superpowers/specs/2026-10-31-identite-isoloir-design.md`
- Couleurs : `identite/couleurs.json`
