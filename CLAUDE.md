# Consignes pour Claude — L’Isoloir (présidentielle 2027)

**L’Isoloir** : base Markdown versionnée des candidats à la présidentielle française de 2027 (premier tour le
2027-04-18), destinée à une interface (Astro sur GitHub Pages, à venir) avec un parcours qui aide
l'utilisateur à trouver les candidats proches de ses positions. Propriétaire : Julien (fusionne les PR).
Langue de travail : français.

## Où sont les règles
Ne pas les recopier ici : elles font foi dans les fichiers suivants.
- `README.md` : conventions, règle d'inclusion des candidats, sources, propositions phares.
- `referentiel/dilemmes.md` : 13 dilemmes et **règles de rattachement** (orientation principale,
  départage, position de la campagne, `aucune` / `pas de position`).
- `referentiel/questions.md` (26 questions-clés), `themes.md`, `preoccupations.md`,
  `methode-proximite.md`, `faisabilite.md`, `candidats-inclus.md` (12 candidats retenus au 2026-10-28).
- `candidats/_modele.md` : gabarit. Fiches de référence conformes : `tondelier-marine.md`,
  `ruffin-francois.md`, `roussel-fabien.md`.

## Identité
- Nom : L’Isoloir ; toute interface, page ou visuel suit `identite/charte.md` (neutralité en tête :
  aucune couleur de candidat ou de parti ; couleurs dans `identite/couleurs.json` ; logos dans `identite/`).

## Commandes
```sh
npm install
npm run valider          # contrôle des données (0 erreur exigé)
npm run comparatifs      # régénérer comparatifs/ et donnees/base.json après toute modification de fiche
node --test tests/*.test.mjs   # ou npm test (95 tests)
```

## Git et GitHub
- Dépôt `chouvert/isoloir`. Une PR par fiche (ou par lot de relecture).
- Travailler dans une worktree : `git fetch origin main` puis `git worktree add -b <branche> <dossier> FETCH_HEAD`
  (`origin/main` n'existe pas localement : utiliser FETCH_HEAD).
- PR via l'API REST : `gh api repos/chouvert/isoloir/pulls -f base=main -f head=<b> -f title=… -f body=…`
  (GraphQL bloqué). Vérifier la CI : `gh api …/commits/<sha>/check-runs`.
- Impossible de supprimer une branche distante (403) : c'est Julien qui le fait.
- Commits signés `-c user.name=Julien -c user.email=julien.terset@gmail.com`.

## Recherche web
- WebFetch n'accepte qu'une URL apparue d'abord dans un résultat de WebSearch.
- fr.wikipedia est bloqué : utiliser en.wikipedia. curl vers les sites de presse ou de partis est refusé
  par le proxy : ne pas contourner ; demander le fichier à Julien (il peut le déposer dans le Project claude.ai).
- WebFetch tronque les longs PDF (≈ 94 000 caractères) : le signaler (« chapitre N non lu »).
- Jamais citer une page non lue ; guillemets mot pour mot ; ÉlyséeScope exclu ; agrégateurs
  (votons-2027, repere2027, monvote2027…) seulement pour repérer des sources ou comme relevé signalé.

## Méthode de travail (économe en quota)
1. **Rédaction** : un agent par fiche, au plus deux en parallèle (le quota Pro s'épuise vite).
   Prompt : lire ce fichier, le gabarit, une fiche de référence ; ne toucher que sa fiche ; pas de git ;
   finir par `npm run valider`. Avant d'ouvrir la PR : `npm run comparatifs` et committer le résultat
   (la CI vérifie qu'ils sont à jour).
2. **Vérification indépendante** : un agent neuf qui n'a pas vu la rédaction. Contrôle complet des
   dilemmes, des phares et des attributions (qui parle) ; citations vérifiées par échantillon, contrôle
   complet seulement si l'échantillon révèle des erreurs. Prompt : lire ce fichier, README, `dilemmes.md`,
   `questions.md`, le gabarit, **sans fiche de référence** (la grille suffit) ; rapport sans liste des
   citations exactes (leur nombre seulement). Coût observé : ≈ 165 000 à 205 000 tokens par fiche.
   - **Contrôle rapide** de fiches déjà relues : **un seul agent pour toutes**, qui ne lit que l'en-tête,
     les dilemmes, les phares et les évolutions de chaque fiche (Grep puis Read avec offset/limit), avec
     une ou deux recherches d'actualité par candidat (≈ 120 000 tokens pour quatre fiches).
   - **Fin de vérification** : s'il ne reste que deux ou trois pages à lire (vérificateur coupé par le
     quota, point à confirmer), les lire soi-même (WebSearch puis WebFetch ciblé) plutôt que lancer un agent.
   - Agent coupé par le quota : le reprendre par SendMessage après la remise à zéro, sans en relancer un neuf.
3. **Corrections** : les appliquer soi-même (Edit ciblés) ou par un agent neuf qui ne lit que la fiche
   et la liste des corrections. **Ne pas relancer le rédacteur** (SendMessage recharge toute sa
   conversation, ≈ 300 000 tokens).
4. Arbitrer les points litigieux selon le référentiel, harmoniser entre fiches, ouvrir la PR,
   présenter à Julien les changements de rattachement et de phares (ce sont eux qui changent les scores).

## Grille de relecture d'une fiche
- R1 Dilemmes : orientation principale (euros > ordre de présentation ; départage entre plusieurs
  chiffrages) ; autres options mentionnées ; une idée par option ; `aucune` réservé.
- R2 Qui parle : candidat, programme, équipe, parti qui l'a investi (sauf primaire ouverte ou coalition) ;
  élu à titre personnel ou militant local = « (indice : …) » ; « avant la candidature » signalé.
- R3 Phares : résumé du candidat, sinon 3 annonces dédiées les plus récentes au contenu vérifiable ;
  commentaire des annonces écartées.
- R4 Sources (voir plus haut). R5 Actualité depuis `derniere_maj` ; mettre `derniere_maj` à jour.

## État au 2026-10-31 et suite
- 12 fiches dans `main`. Relecture transversale terminée : lot A (PR #21) et
  lot B (Glucksmann, Attal, Lisnard ; contrôle rapide de Roussel, Tondelier, Batho, Ruffin) (PR #22), fusionnés.
- Décisions de Julien (2026-10-31) : phares limités aux annonces postérieures à la déclaration (README) ;
  quotas d'immigration de travail = option A de D-immig-travail.
- **À faire, dans l'ordre :**
  1. Harmonisation faite le 2026-10-31 (PR `harmonisation`) : Philippe D-immig-travail → A ; Ruffin
     D-env-electricite → D ; Tondelier D-secu-budget → A et D-educ-niveau → A ; Roussel D-educ-niveau B
     maintenu (fragile, à revoir dès une mesure de campagne).
  2. Mélenchon : mise à jour et relecture après le 2026-11-06.
  3. Tondelier : réexamen après le vote des adhérents des Écologistes (10–13 décembre 2026).
  4. Le Pen : audience de la Cour de cassation le 2026-12-16.
  5. Candidats à surveiller : Cazeneuve (inclus dès sa déclaration), Bertrand, Polony (1–1,5 %), Hollande,
     Bardella si retrait de Le Pen. Réexaminer `candidats-inclus.md` à chaque vague de sondages.
  6. Duels à l'aveugle (spec et plan : `docs/superpowers/`) : données (PR `duels-donnees`) puis moteur
     (PR `duels-moteur`). Une option sans proposition dans le tableau des dilemmes = pas de duel ;
     un texte qui trahit son auteur dans `comparatifs/duels.md` → terme dans `referentiel/anonymisation.md` ;
     texte trop long ou reconnaissable → colonne `texte court` (reformulation neutre, ≤ 300 car.).
  7. Identité « L’Isoloir » (2026-10-31, PR #28 conception, PR #29 réalisation) : charte, couleurs, logos, design system.
  8. Plus tard : propositions comparables (étiquette « sujet »), analyse de faisabilité (début 2027, même date
     pour tous), mise à jour automatique (veille → issues → PR), interface Astro.
