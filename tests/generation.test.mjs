// Tests de la génération des comparatifs et de l'export JSON.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireBase, lireSources } from '../scripts/lib/extraction.mjs';
import { genererFichiers, donnees, AVERTISSEMENT, FICHIER_DONNEES } from '../scripts/lib/generation.mjs';
import { validerBase } from '../scripts/lib/validation.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Petite base synthétique : deux thèmes, deux candidats. */
function baseSynthetique() {
  const candidat = (id, nom, option, extra = {}) => ({
    id, nom, parti: '', famille_politique: '', statut: 'déclaré', date_declaration: '2026-01-01',
    programme_url: '', programme_version: '', derniere_maj: extra.derniere_maj ?? '2026-10-01',
    positions: { 'Q-eco-impots': { position: extra.position ?? 'baisse', detail: '', sources: [] } },
    dilemmes: { 'D-eco-dette': { option, justification: '', sources: [] } },
    phares: extra.phares ?? [],
    propositions: extra.propositions ?? [],
    evolutions: [],
    faisabilite: extra.faisabilite ?? null,
  });
  return {
    themes: [{ id: 'eco', libelle: 'Économie & fiscalité' }, { id: 'social', libelle: 'Social' }],
    questions: [{ id: 'Q-eco-impots', theme: 'eco', question: 'Impôts ?', type: 'ouverte', statut: 'actif' }],
    dilemmes: [{
      id: 'D-eco-dette', theme: 'eco', statut: 'actif', enonce: 'Quelle priorité ?', voisines: [],
      options: [{ option: 'A', libelle: 'Baisser les dépenses', contrepartie: 'x' }, { option: 'B', libelle: 'Hausser les impôts', contrepartie: 'y' }],
    }],
    preoccupations: [],
    criteres: ['F-fin', 'F-jur'],
    candidats: [
      candidat('dupont-jean', 'Jean Dupont', 'A', {
        derniere_maj: '2026-10-24',
        propositions: [{ id: 'eco-01', theme: 'eco', proposition: 'Baisse de l\'IR | partielle', chiffrage_annonce: '8 Md€', chiffrage_independant: '', calendrier: '', sources: [] }],
        phares: [{ rang: 1, proposition: 'eco-01', motif: 'Annonce dédiée', sources: [] }],
        faisabilite: { date: '2026-10-24', confiance: 'moyen', globale: 3.5, notes: { 'F-fin': 3, 'F-jur': 4 } },
      }),
      candidat('martin-anne', 'Anne Martin', 'pas de position'),
    ],
  };
}

test('lecture des sources d\'une cellule', () => {
  assert.deepEqual(lireSources('[LCP, 2026-10-05](https://lcp.fr/a) ; [Wikipédia](https://en.wikipedia.org/b)'), [
    { titre: 'LCP, 2026-10-05', url: 'https://lcp.fr/a' },
    { titre: 'Wikipédia', url: 'https://en.wikipedia.org/b' },
  ]);
  assert.deepEqual(lireSources(''), []);
});

test('page de thème : positions, dilemmes, coûts, en-tête stable', () => {
  const eco = genererFichiers(baseSynthetique()).get('comparatifs/eco.md');
  assert.match(eco, /^---\ntheme: eco\nderniere_maj: 2026-10-24\n---\n/);
  assert.ok(eco.includes(AVERTISSEMENT));
  assert.match(eco, /\| question \| dupont-jean \| martin-anne \|/);
  assert.match(eco, /\| Q-eco-impots \| baisse \| baisse \|/);
  assert.match(eco, /- \*\*A\*\* — Baisser les dépenses : Dupont/);
  assert.match(eco, /- \*\*B\*\* — Hausser les impôts : —/);
  assert.match(eco, /- \*pas de position\* : Martin/);
  // Une barre verticale dans une cellule casserait le tableau.
  assert.match(eco, /\| Jean Dupont \| eco-01 \| Baisse de l'IR \/ partielle \| 8 Md€ \| — \|/);
  const social = genererFichiers(baseSynthetique()).get('comparatifs/social.md');
  assert.match(social, /Aucune proposition chiffrée dans les fiches\./);
});

test('vues transversales : dilemmes, phares, faisabilité', () => {
  const f = genererFichiers(baseSynthetique());
  assert.match(f.get('comparatifs/dilemmes.md'), /\| Jean Dupont \| 1 \| 0 \| 0 \|\n\| Anne Martin \| 0 \| 0 \| 1 \|/);
  assert.match(f.get('comparatifs/phares.md'), /\| 1 \| eco-01 \| Baisse de l'IR \/ partielle \| Annonce dédiée \|/);
  assert.match(f.get('comparatifs/phares.md'), /Anne Martin[\s\S]*Aucune proposition phare désignée\./);
  const fais = f.get('comparatifs/faisabilite.md');
  assert.match(fais, /^---\ndate_analyse: 2026-10-24\n---/);
  assert.match(fais, /\| dupont-jean \| 3 \| 4 \| 3,5 \| moyen \| 2026-10-24 \|\n$/);
});

test('export JSON : complet et sérialisable', () => {
  const base = baseSynthetique();
  const json = JSON.parse(genererFichiers(base).get(FICHIER_DONNEES));
  assert.equal(json.format, 1);
  assert.equal(json.derniere_maj, '2026-10-24');
  assert.deepEqual(json, JSON.parse(JSON.stringify(donnees(base))));
  assert.equal(json.candidats[0].dilemmes['D-eco-dette'].option, 'A');
});

test('base réelle : génération déterministe et fichiers committés à jour', () => {
  const premiere = genererFichiers(lireBase(RACINE));
  const seconde = genererFichiers(lireBase(RACINE));
  assert.deepEqual([...premiere], [...seconde]);
  for (const [chemin, contenu] of premiere) {
    const complet = join(RACINE, chemin);
    assert.ok(existsSync(complet), `${chemin} absent : lancer « npm run comparatifs »`);
    assert.equal(readFileSync(complet, 'utf8'), contenu, `${chemin} périmé : lancer « npm run comparatifs »`);
  }
});

test('base réelle : modèle complet et cohérent avec le validateur', () => {
  const base = lireBase(RACINE);
  const questions = base.questions.filter((q) => q.statut === 'actif').map((q) => q.id);
  const dilemmes = base.dilemmes.filter((d) => d.statut === 'actif').map((d) => d.id);
  assert.ok(base.candidats.length > 0);
  for (const c of base.candidats) {
    assert.deepEqual(questions.filter((q) => !c.positions[q]), [], `${c.id} : questions manquantes`);
    assert.deepEqual(dilemmes.filter((d) => !c.dilemmes[d]), [], `${c.id} : dilemmes manquants`);
    const ids = new Set(c.propositions.map((p) => p.id));
    for (const ph of c.phares) assert.ok(ids.has(ph.proposition), `${c.id} : phare ${ph.proposition} introuvable`);
    for (const p of c.propositions) assert.ok(p.sources.every((s) => /^https?:\/\//.test(s.url)), `${c.id} ${p.id} : source illisible`);
  }
  // Les pages de thème générées reprennent exactement les positions des fiches.
  const rapport = validerBase(RACINE);
  assert.deepEqual(rapport.avertissements.filter((a) => a.fichier.startsWith('comparatifs/')), []);
});
