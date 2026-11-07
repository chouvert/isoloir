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
