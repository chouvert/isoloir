// Tests de la moyenne des sondages du rapport hebdomadaire.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { erreursReleve, fenetre, moyennes, rapportSondages, arrondiDemiPoint } from '../scripts/lib/sondages.mjs';

const sondage = (publie, scores, extra = {}) => ({
  institut: 'Institut', commanditaire: 'Média', terrain: [publie, publie], publie,
  echantillon: '1 000', hypothese: 'H1', lien: 'https://exemple.fr/notice.pdf', scores, ...extra,
});

test('arrondi au demi-point', () => {
  assert.equal(arrondiDemiPoint(12.24), 12);
  assert.equal(arrondiDemiPoint(12.25), 12.5);
  assert.equal(arrondiDemiPoint(12.76), 13);
});

test('moyenne simple, tri décroissant, candidat testé dans moins de la moitié signalé', () => {
  const l = moyennes([
    sondage('2026-11-01', { A: 30, B: 10, C: 3 }),
    sondage('2026-11-05', { A: 31, B: 12 }),
    sondage('2026-11-10', { A: 33, B: 11 }),
  ]);
  assert.deepEqual(l.map((x) => [x.candidat, x.moyenne, x.nombre, x.partiel]),
    [['A', 31.5, 3, false], ['B', 11, 3, false], ['C', 3, 1, true]]);
});

test('fenêtre de 30 jours, élargie à 60 si vide', () => {
  const releve = [sondage('2026-09-20', { A: 1 }), sondage('2026-10-26', { A: 2 })];
  assert.deepEqual(fenetre(releve, '2026-11-24').sondages.map((s) => s.publie), ['2026-10-26']);
  assert.equal(fenetre(releve, '2026-11-24').elargi, false);
  const r = fenetre([sondage('2026-10-01', { A: 1 })], '2026-11-24');
  assert.equal(r.elargi, true);
  assert.equal(r.sondages.length, 1);
  assert.equal(fenetre([sondage('2026-09-01', { A: 1 })], '2026-11-24').sondages.length, 0);
});

test('rapport : section et ligne de résumé', () => {
  const { section, resume } = rapportSondages([
    sondage('2026-11-03', { A: 30.5, B: 10 }), sondage('2026-11-12', { A: 31 }),
  ], '2026-11-24');
  assert.match(section, /^## Sondages — moyenne/);
  assert.match(section, /\| A \| 31 % \| 2 \|/);
  assert.match(section, /pas une prédiction/);
  assert.equal(resume, 'Sondages (moyenne de 2 sondages, du 03/11 au 12/11) : A 31 %, B 10 %');
  assert.equal(rapportSondages([], '2026-11-24').resume, 'Sondages : aucun sondage trouvé');
});

test('contrôle du relevé', () => {
  assert.deepEqual(erreursReleve([]), []);
  assert.deepEqual(erreursReleve([sondage('2026-11-03', { A: 30 })]), []);
  const e = erreursReleve([sondage('2026-11-03', { A: 130 }, { lien: 'notice', terrain: ['2026-11-05', '2026-11-04'] })]);
  assert.equal(e.length, 3);
});
