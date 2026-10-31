// Tests du tirage et de l'évaluation des duels à l'aveugle (section 5 de referentiel/methode-proximite.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DUELS, preparerDuels, evaluerDuels } from '../scripts/lib/duels.mjs';

/** Tirage injecté : renvoie les valeurs dans l'ordre, puis 0. */
const suite = (...valeurs) => () => (valeurs.length ? valeurs.shift() : 0);
const p = (candidat, option = '') => ({ candidat, proposition: `x-${candidat}${option}`, texte: `mesure de ${candidat}` });

/** Dilemmes D1…Dn à deux options A/B, sans voisinage ; participants : a1 en A, b1 en B. */
function cas(n, { participants } = {}) {
  const ids = Array.from({ length: n }, (_, i) => `D${i + 1}`);
  return {
    dilemmes: Object.fromEntries(ids.map((id) => [id, { voisines: [] }])),
    ordre: ids,
    reponses: Object.fromEntries(ids.map((id) => [id, 'A'])),
    participants: participants ?? Object.fromEntries(ids.map((id, i) => [id, { A: [p(`a${i}`)], B: [p(`b${i}`)] }])),
  };
}

test('constantes', () => {
  assert.deepEqual(DUELS, { nombre: 6, maxApparitions: 2 });
});

test('au plus 6 duels, dans l\'ordre des dilemmes, éligibles tous comptés', () => {
  const { duels, eligibles } = preparerDuels({ ...cas(8), aleatoire: suite() });
  assert.equal(eligibles, 8);
  assert.deepEqual(duels.map((d) => d.dilemme), ['D1', 'D2', 'D3', 'D4', 'D5', 'D6']);
  assert.deepEqual(duels[0], {
    dilemme: 'D1', optionUtilisateur: 'A',
    gauche: { candidat: 'a0', option: 'A', proposition: 'x-a0', texte: 'mesure de a0', utilisateur: true },
    droite: { candidat: 'b0', option: 'B', proposition: 'x-b0', texte: 'mesure de b0', utilisateur: false },
  });
});

test('sans avis, sans participant de l\'option ou sans adversaire : dilemme ignoré', () => {
  const c = cas(3);
  c.reponses.D1 = 'sans avis';
  c.participants.D2.A = [];
  c.participants.D3.B = [];
  assert.deepEqual(preparerDuels({ ...c, aleatoire: suite() }), { duels: [], eligibles: 0 });
});

test('adversaire hors voisines quand il existe, voisin sinon', () => {
  const dilemmes = { D1: { voisines: [['A', 'B']] }, D2: { voisines: [['A', 'B']] } };
  const participants = {
    D1: { A: [p('a')], B: [p('b')], C: [p('c')] },
    D2: { A: [p('d')], B: [p('e')], C: [] },
  };
  const { duels } = preparerDuels({ dilemmes, ordre: ['D1', 'D2'], reponses: { D1: 'A', D2: 'A' }, participants, aleatoire: suite() });
  assert.equal(duels[0].droite.option, 'C');
  assert.equal(duels[1].droite.option, 'B');
});

test('plafond de 2 apparitions : dilemme passé si un côté devient vide', () => {
  const participants = { D1: { A: [p('x')], B: [p('b1')] }, D2: { A: [p('x')], B: [p('b2')] }, D3: { A: [p('x')], B: [p('b3')] }, D4: { A: [p('a4')], B: [p('b4')] } };
  const { duels, eligibles } = preparerDuels({ ...cas(4, { participants }), aleatoire: suite() });
  assert.equal(eligibles, 4);
  assert.deepEqual(duels.map((d) => d.dilemme), ['D1', 'D2', 'D4']);
});

test('tirage : candidat et côté choisis par le tirage, reproductibles', () => {
  const participants = { D1: { A: [p('a1'), p('a2')], B: [p('b1'), p('b2')] } };
  const tirer = () => preparerDuels({ ...cas(1, { participants }), aleatoire: suite(0.9, 0.6, 0.7) }).duels[0];
  const d = tirer();
  assert.equal(d.droite.candidat, 'a2');
  assert.equal(d.droite.utilisateur, true);
  assert.equal(d.gauche.candidat, 'b2');
  assert.deepEqual(tirer(), d);
});

test('moins de 6 duels possibles : tous proposés, aucune erreur', () => {
  const { duels, eligibles } = preparerDuels({ ...cas(2), aleatoire: suite() });
  assert.equal(duels.length, 2);
  assert.equal(eligibles, 2);
});

test('évaluation : cohérent, écart (adversaire voisin compris), non compté', () => {
  const { duels } = preparerDuels({ ...cas(4), aleatoire: suite(0, 0, 0.9) });
  // D1 : utilisateur à droite (0,9) ; D2-D4 : à gauche.
  const r = evaluerDuels(duels, ['droite', 'droite', 'aucune', 'les deux']);
  assert.deepEqual(r.details.map((d) => d.statut), ['cohérent', 'écart', 'non compté', 'non compté']);
  assert.equal(r.coherents, 1);
  assert.equal(r.comptes, 2);
  assert.equal(r.taux, null);
});

test('évaluation : taux à partir de 3 duels comptés ; aucun duel', () => {
  const { duels } = preparerDuels({ ...cas(3), aleatoire: suite() });
  assert.deepEqual(evaluerDuels(duels, ['gauche', 'gauche', 'droite']), {
    details: [{ dilemme: 'D1', statut: 'cohérent' }, { dilemme: 'D2', statut: 'cohérent' }, { dilemme: 'D3', statut: 'écart' }],
    coherents: 2, comptes: 3, taux: 2 / 3,
  });
  assert.deepEqual(evaluerDuels([], []), { details: [], coherents: 0, comptes: 0, taux: null });
});

test('Map acceptée comme objet', () => {
  const c = cas(1);
  const r = preparerDuels({ ...c, dilemmes: new Map(Object.entries(c.dilemmes)), reponses: new Map(Object.entries(c.reponses)), aleatoire: suite() });
  assert.equal(r.duels.length, 1);
});

test('exemple de la méthode : 4 duels cohérents sur 5 comptés', () => {
  // Utilisateur toujours à gauche (tirage 0) ; réponses de l'exemple de la section 5.
  const ids = ['D-eco-dette', 'D-social-retraites', 'D-social-chomage', 'D-env-electricite', 'D-europe-regles', 'D-europe-defense'];
  const options = ['A', 'B', 'C', 'C', 'B', 'B'];
  const autres = ['B', 'D', 'A', 'A', 'A', 'A'];
  const participants = Object.fromEntries(ids.map((id, i) => [id, { [options[i]]: [p(`u${i}`)], [autres[i]]: [p(`v${i}`)] }]));
  const { duels } = preparerDuels({
    dilemmes: Object.fromEntries(ids.map((id) => [id, { voisines: [] }])),
    ordre: ids,
    reponses: Object.fromEntries(ids.map((id, i) => [id, options[i]])),
    participants,
    aleatoire: suite(),
  });
  const r = evaluerDuels(duels, ['gauche', 'droite', 'gauche', 'les deux', 'gauche', 'gauche']);
  assert.deepEqual(r.details.map((d) => d.statut), ['cohérent', 'écart', 'cohérent', 'non compté', 'cohérent', 'cohérent']);
  assert.deepEqual([r.coherents, r.comptes, r.taux], [4, 5, 0.8]);
});
