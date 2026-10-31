// Tests du script de contrôle : une base de test est construite à partir du vrai
// référentiel et du vrai gabarit, puis altérée pour vérifier chaque contrôle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validerBase, lireReferentiel } from '../scripts/lib/validation.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const QUESTIONS = [...readFileSync(join(RACINE, 'referentiel/questions.md'), 'utf8')
  .matchAll(/^\| (Q-[a-z0-9]+-[a-z0-9]+)\s*\|/gm)].map((m) => m[1]);
const DILEMMES = [...readFileSync(join(RACINE, 'referentiel/dilemmes.md'), 'utf8')
  .matchAll(/^### (D-[a-z0-9-]+)$/gm)].map((m) => m[1]);
const CRITERES = ['F-fin', 'F-jur', 'F-pol', 'F-cal', 'F-ope', 'F-coh'];

/** Fiche complète et valide, construite depuis le gabarit. */
function ficheValide({ id = 'dupont-jean', notes = [3, 4, 3, 4, 3, 4], globale = '3,5', date = '2026-10-24' } = {}) {
  let t = readFileSync(join(RACINE, 'candidats/_modele.md'), 'utf8');
  t = t.replace(/^id: .*$/m, `id: ${id}`)
    .replace(/^nom: .*$/m, 'nom: Jean Dupont')
    .replace(/^statut: .*$/m, 'statut: déclaré')
    .replace(/^derniere_maj: .*$/m, 'derniere_maj: 2026-10-24');
  // Toutes les questions : « pas de position ».
  for (const q of QUESTIONS) {
    t = t.replace(new RegExp(`^\\| ${q}\\s*\\|.*$`, 'm'), `| ${q} | pas de position | | |`);
  }
  // Tous les dilemmes : « pas de position », sauf les retraites (option A sourcée).
  for (const d of DILEMMES) {
    t = t.replace(new RegExp(`^\\| ${d}\\s*\\|.*$`, 'm'), `| ${d} | pas de position | | | |`);
  }
  t = t.replace(/^\| D-social-retraites .*$/m, '| D-social-retraites | A | eco-01 | Report à 65 ans | [prog](https://exemple.fr) |');
  // Une proposition sourcée en éco.
  t = t.replace(/(### eco — Économie & fiscalité\n\|.*\n\|.*\n)/,
    '$1| eco-01 | Baisse de l\'IR | 8 Md€ | 11 Md€ (Institut Y) | 2028 | [prog](https://exemple.fr) |\n');
  // Une évolution.
  t = t.replace('## Évolutions / revirements\n', '## Évolutions / revirements\n- 2026-10-10 : précision sur les retraites [source](https://exemple.fr)\n');
  // Analyse datée.
  t = t.replace(/_Analysée le : .*_/, `_Analysée le : ${date} · sur programme v1 · confiance : moyen_`)
    .replace('### Note globale : – / 5', `### Note globale : ${globale} / 5`);
  CRITERES.forEach((c, i) => {
    t = t.replace(new RegExp(`^\\| ${c}\\s*\\|.*$`, 'm'), `| ${c} | ${notes[i]} | justification | eco-01 |`);
  });
  t = t.replace(/### Pourquoi cette note\n<!--[\s\S]*?-->/, '### Pourquoi cette note\nTexte de justification.');
  return t;
}

/** Crée une base de test ; `modifier(dossier)` peut altérer des fichiers avant validation. */
function valider(modifier = () => {}) {
  const dossier = mkdtempSync(join(tmpdir(), 'base-'));
  try {
    for (const d of ['referentiel', 'candidats', 'comparatifs']) cpSync(join(RACINE, d), join(dossier, d), { recursive: true });
    writeFileSync(join(dossier, 'candidats/dupont-jean.md'), ficheValide());
    modifier(dossier);
    return validerBase(dossier);
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

const ecrire = (d, f, t) => writeFileSync(join(d, f), t);
const editer = (d, f, fn) => ecrire(d, f, fn(readFileSync(join(d, f), 'utf8')));
const messages = (r) => r.erreurs.map((e) => e.message).join('\n');

test('la base réelle est valide', () => {
  const r = validerBase(RACINE);
  assert.equal(r.erreurs.length, 0, messages(r));
});

test('une fiche complète est valide', () => {
  const r = valider();
  assert.equal(r.erreurs.length, 0, messages(r));
});

test('id du frontmatter différent du nom de fichier', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t.replace('id: dupont-jean', 'id: autre')));
  assert.match(messages(r), /différent du nom de fichier/);
});

test('statut et date invalides', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace('statut: déclaré', 'statut: candidat')
    .replace('derniere_maj: 2026-10-24', 'derniere_maj: 24/10/2026')));
  assert.match(messages(r), /statut « candidat » invalide/);
  assert.match(messages(r), /derniere_maj .* n'est pas une date/);
});

test('question inconnue, en double ou manquante', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| Q-env-nuc .*$/m, '| Q-env-charbon | pour | | [s](https://x.fr) |')
    .replace(/^\| Q-eco-deficit .*$/m, '| Q-eco-impots | pas de position | | |')));
  const m = messages(r);
  assert.match(m, /question inconnue « Q-env-charbon »/);
  assert.match(m, /« Q-eco-impots » présente deux fois/);
  assert.match(m, /question active « Q-env-nuc » absente/);
});

test('question fermée avec valeur non autorisée', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| Q-env-nuc .*$/m, '| Q-env-nuc | oui | | [s](https://x.fr) |')));
  assert.match(messages(r), /question fermée : position « oui » non autorisée/);
});

test('position sans source', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| Q-social-retraite .*$/m, '| Q-social-retraite | 64 ans | avec dérogations | programme |')));
  assert.match(messages(r), /« Q-social-retraite » : position sans source/);
});

test('position vide : avertissement seulement', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| Q-env-nuc .*$/m, '| Q-env-nuc | | | |')));
  assert.equal(r.erreurs.length, 0, messages(r));
  assert.match(r.avertissements.map((a) => a.message).join('\n'), /1 question\(s\) non renseignée/);
});

test('proposition mal identifiée, en double ou sans source', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t.replace(
    /^\| eco-01 .*$/m,
    '| eco-01 | A | | | | [s](https://x.fr) |\n| eco-01 | B | | | | [s](https://x.fr) |\n| env-01 | C | | | | [s](https://x.fr) |\n| eco-02 | D | | | | programme |')));
  const m = messages(r);
  assert.match(m, /« eco-01 » définie deux fois/);
  assert.match(m, /« env-01 » invalide \(format eco-NN\)/);
  assert.match(m, /« eco-02 » : source manquante/);
});

test('évolution sans date', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace('- 2026-10-10 :', '- le 10 octobre :')));
  assert.match(messages(r), /format attendu « - AAAA-MM-JJ : description »/);
});

test('note globale incohérente avec les critères', () => {
  const r = valider((d) => ecrire(d, 'candidats/dupont-jean.md', ficheValide({ globale: '4' })));
  assert.match(messages(r), /note globale 4 incohérente : la moyenne arrondie au demi-point donne 3,5/);
});

test('note de critère hors barème et confiance invalide', () => {
  const r = valider((d) => ecrire(d, 'candidats/dupont-jean.md',
    ficheValide({ notes: [6, 4, 3, 4, 3, 4] }).replace('confiance : moyen', 'confiance : bonne')));
  const m = messages(r);
  assert.match(m, /« F-fin » : note « 6 » invalide/);
  assert.match(m, /indice de confiance « bonne » invalide/);
});

test('notes présentes sans date d\'analyse', () => {
  const r = valider((d) => ecrire(d, 'candidats/dupont-jean.md',
    ficheValide().replace(/_Analysée le : .*_/, '_Analysée le : AAAA-MM-JJ · sur programme vX · confiance : moyen_')));
  assert.match(messages(r), /notes de faisabilité présentes sans date d'analyse/);
});

test('analyses à des dates différentes : avertissement', () => {
  const r = valider((d) => ecrire(d, 'candidats/martin-anne.md',
    ficheValide({ id: 'martin-anne', date: '2026-11-02' })));
  assert.equal(r.erreurs.length, 0, messages(r));
  assert.match(r.avertissements.map((a) => a.message).join('\n'), /dates différentes/);
});

test('comparatif de faisabilité désynchronisé de la fiche', () => {
  const r = valider((d) => editer(d, 'comparatifs/faisabilite.md', (t) =>
    `${t}| dupont-jean | 3 | 4 | 3 | 4 | 3 | 5 | 3,5 | moyen | 2026-10-24 |\n| inconnu | 1 | 1 | 1 | 1 | 1 | 1 | 1 | faible | 2026-10-24 |\n`));
  const m = messages(r);
  assert.match(m, /« dupont-jean » F-coh : 5 au comparatif, 4 dans la fiche/);
  assert.match(m, /candidat inconnu « inconnu »/);
});

test('comparatif thématique : question d\'un autre thème et candidat inconnu', () => {
  const r = valider((d) => ecrire(d, 'comparatifs/env.md',
    '---\ntheme: env\n---\n\n| question | dupont-jean | fantome |\n|---|---|---|\n| Q-env-nuc | pas de position | pour |\n| Q-eco-impots | pas de position | |\n'));
  const m = messages(r);
  assert.match(m, /colonne « fantome » : pas de fiche/);
  assert.match(m, /« Q-eco-impots » n'appartient pas au thème « env »/);
});

test('gabarit désynchronisé du référentiel', () => {
  const r = valider((d) => editer(d, 'referentiel/questions.md', (t) => t.replace(
    '| Q-instit-constit',
    '| Q-instit-mandat  | instit | Durée du mandat présidentiel ? | ouverte | actif |\n| Q-instit-constit')));
  assert.match(messages(r), /candidats\/_modele\.md|question active « Q-instit-mandat » absente/);
  assert.ok(r.erreurs.some((e) => e.fichier === 'candidats/_modele.md'));
});

test('tous les dilemmes du référentiel sont lus', () => {
  const r = { erreur: () => {}, avertissement: () => {} };
  const ref = lireReferentiel(RACINE, r);
  assert.ok(DILEMMES.length > 0);
  assert.deepEqual([...ref.dilemmes.keys()], DILEMMES);
  assert.deepEqual(ref.dilemmes.get('D-social-retraites').options, ['A', 'B', 'C', 'D']);
});

test('réponse à un dilemme : option inexistante, sans source, dilemme manquant', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| D-eco-dette .*$/m, '| D-eco-dette | E | | x | [s](https://x.fr) |')
    .replace(/^\| D-env-rythme .*$/m, '| D-env-rythme | aucune | | approche différente | programme |')
    .replace(/^\| D-sante-deserts .*$/m, '| D-sante-deserts | B | eco-01 | | [s](https://x.fr) |')
    .replace(/^\| D-educ-niveau .*\n/m, '')));
  const m = messages(r);
  assert.match(m, /« D-eco-dette » : réponse « E » invalide/);
  assert.match(m, /« D-env-rythme » : réponse sans source/);
  assert.match(m, /« D-sante-deserts » : justification manquante/);
  assert.match(m, /dilemme actif « D-educ-niveau » absent/);
});

test('réponse vide à un dilemme : avertissement seulement', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| D-eco-dette .*$/m, '| D-eco-dette | | | | |')));
  assert.equal(r.erreurs.length, 0, messages(r));
  assert.match(r.avertissements.map((a) => a.message).join('\n'), /1 dilemme\(s\) non renseigné/);
});

test('dilemmes : colonne proposition absente', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| dilemme +\| option +\| proposition +\| justification +\| source +\|$/m, '| dilemme | option | justification | source |')
    .replace(/^\|-+\|-+\|-+\|-+\|-+\|$/m, '|---|---|---|---|')
    .replace(/^(\| D-[a-z-]+ \| [^|]*\|)[^|]*\|/gm, '$1')));
  assert.match(messages(r), /tableau des réponses \(colonnes dilemme, option, proposition, justification, source\) introuvable/);
});

test('dilemmes : proposition inconnue', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| D-social-retraites .*$/m, '| D-social-retraites | A | eco-99 | Report à 65 ans | [prog](https://exemple.fr) |')));
  assert.match(messages(r), /« D-social-retraites » : proposition « eco-99 » absente des propositions de la fiche/);
});

test('dilemmes : proposition avec pas de position', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| D-eco-dette .*$/m, '| D-eco-dette | pas de position | eco-01 | | |')));
  assert.match(messages(r), /« D-eco-dette » : proposition renseignée pour une réponse « pas de position »/);
});

test('dilemmes : lettre sans proposition, avertissement seulement', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| D-social-retraites .*$/m, '| D-social-retraites | A | | Report à 65 ans | [prog](https://exemple.fr) |')));
  assert.equal(r.erreurs.length, 0, messages(r));
  assert.match(r.avertissements.map((a) => a.message).join('\n'), /« D-social-retraites » : option « A » sans proposition/);
});

test('dilemmes : même proposition pour deux dilemmes', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', (t) => t
    .replace(/^\| D-eco-dette .*$/m, '| D-eco-dette | A | eco-01 | Baisse des dépenses | [s](https://x.fr) |')));
  assert.equal(r.erreurs.length, 0, messages(r));
});

test('référentiel des dilemmes : erreurs de rédaction', () => {
  const r = valider((d) => editer(d, 'referentiel/dilemmes.md', (t) => t
    .replace('### D-eco-pouvoir-achat\n- statut : actif\n- voisines : B-C (deux baisses de prélèvements)\n\n>', '### D-eco-pouvoir-achat\n- statut : en cours\n- voisines : B-C (deux baisses de prélèvements)\n\n')
    .replace('### D-secu-budget', '### D-env-budget')
    .replace(/^\| B      \| Baisser les cotisations sur les salaires pour augmenter le net  \| .*$/m,
      '| B | Baisser les cotisations | |')));
  const m = messages(r);
  assert.match(m, /« D-eco-pouvoir-achat » : statut « en cours » invalide/);
  assert.match(m, /« D-eco-pouvoir-achat » : énoncé manquant/);
  assert.match(m, /« D-env-budget » placé dans le thème « secu »/);
  assert.match(m, /option B : contrepartie vide/);
});

test('voisinages : format, options inexistantes, ligne manquante, trop de paires', () => {
  const r = valider((d) => editer(d, 'referentiel/dilemmes.md', (t) => t
    .replace('- voisines : C-D (deux façons', '- voisines : C-E, AB (deux façons')
    .replace('- voisines : B-D (deux formes', '- voisines : B-D, D-B (deux formes')
    .replace(/- voisines : A-B \(deux renforcements.*\n/, '')
    .replace('- voisines : A-B (deux hausses de moyens humains)', '- voisines : A-B, B-C, C-D (test)')));
  const m = messages(r);
  assert.match(m, /« D-eco-dette » : paire voisine « C-E » avec option inexistante/);
  assert.match(m, /« D-eco-dette » : paire voisine « AB » invalide/);
  assert.match(m, /« D-social-chomage » : paire voisine « D-B » en double/);
  assert.match(m, /« D-secu-budget » : ligne « - voisines : … » manquante/);
  assert.match(r.avertissements.map((a) => a.message).join('\n'), /« D-educ-niveau » : 3 paires voisines/);
  assert.ok(!r.avertissements.some((a) => /D-europe-regles.*paires voisines/.test(a.message)), 'dilemme gradué : pas d\'avertissement');
});

test('dilemme ajouté au référentiel mais absent du gabarit', () => {
  const r = valider((d) => editer(d, 'referentiel/dilemmes.md', (t) => `${t}
### D-instit-mandat
- statut : actif

> Question test

| option | libellé | contrepartie souvent avancée |
|--------|---------|------------------------------|
| A      | Un      | x                            |
| B      | Deux    | y                            |
`));
  assert.ok(r.erreurs.some((e) => e.fichier === 'candidats/_modele.md' && /D-instit-mandat/.test(e.message)), messages(r));
});

test('référentiel : question rattachée à un thème inconnu', () => {
  const r = valider((d) => editer(d, 'referentiel/questions.md', (t) => t.replace(
    '| Q-instit-constit', '| Q-sport-jo | sport | JO ? | ouverte | actif |\n| Q-instit-constit')));
  assert.match(messages(r), /thème inconnu « sport »/);
});

test('préoccupations : thème inconnu, dilemme hors thème, thème non couvert, doublon', () => {
  const r = valider((d) => editer(d, 'referentiel/preoccupations.md', (t) => t
    .replace(/^\| P-logement .*$/m, '| P-logement | Se loger | Loyers | habitat | — | — |')
    .replace(/^\| P-dette .*$/m, '| P-dette | La dette | Déficit | eco | — | D-env-rythme |')
    .replace(/^\| P-confiance .*$/m, '| P-confiance | La retraite | Institutions | social | — | — |')));
  const m = messages(r);
  assert.match(m, /« P-logement » : thème principal inconnu « habitat »/);
  assert.match(m, /« P-dette » : dilemme « D-env-rythme » hors de ses thèmes/);
  assert.match(m, /« P-confiance » : libellé déjà utilisé/);
  assert.match(m, /thème « instit » : aucune préoccupation ne l'a pour thème principal/);
});

const PHARES_ENTETE = '| rang | proposition | motif | source |\n|------|-------------|-------|--------|\n';
const avecPhares = (lignes) => (t) => t.replace(/\| rang \| proposition \| motif \| source \|\n\|[-|]+\|\n/, PHARES_ENTETE + lignes);

test('propositions phares valides', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md',
    avecPhares('| 1 | eco-01 | 1re mesure du résumé | [s](https://x.fr) |\n')));
  assert.equal(r.erreurs.length, 0, messages(r));
});

test('propositions phares : inconnue, en double, sans source, rang faux, plus de 3', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md', avecPhares(
    '| 1 | eco-01 | motif | [s](https://x.fr) |\n'
    + '| 2 | eco-01 | motif | [s](https://x.fr) |\n'
    + '| 4 | env-09 | motif | [s](https://x.fr) |\n'
    + '| 4 | eco-01 | | programme |\n')));
  const m = messages(r);
  assert.match(m, /« eco-01 » citée deux fois/);
  assert.match(m, /« env-09 » absente des propositions/);
  assert.match(m, /rang « 4 » : attendu 3/);
  assert.match(m, /4 propositions phares : 3 au maximum/);
});

test('propositions phares : motif et source obligatoires', () => {
  const r = valider((d) => editer(d, 'candidats/dupont-jean.md',
    avecPhares('| 1 | eco-01 | | programme |\n')));
  const m = messages(r);
  assert.match(m, /motif du choix manquant/);
  assert.match(m, /source du choix manquante/);
});
