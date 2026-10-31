// Tests du calcul de proximité, à partir du vrai référentiel des dilemmes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireReferentiel } from '../scripts/lib/validation.mjs';
import {
  accord, calculerPoids, calculerProximite, grouperEgalites,
} from '../scripts/lib/proximite.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { dilemmes } = lireReferentiel(RACINE, { erreur: () => {}, avertissement: () => {} });

// Exemple de referentiel/methode-proximite.md
const POINTS = { eco: 30, social: 30, env: 20, europe: 20 };
const REPONSES = {
  'D-eco-dette': 'A',
  'D-eco-pouvoir-achat': 'sans avis',
  'D-social-retraites': 'B',
  'D-social-chomage': 'C',
  'D-env-electricite': 'C',
  'D-env-rythme': 'sans avis',
  'D-europe-regles': 'B',
  'D-europe-defense': 'B',
};
const X = {
  id: 'candidat-x', nom: 'Candidat X',
  reponses: {
    'D-eco-dette': 'A', 'D-social-retraites': 'A', 'D-social-chomage': 'C',
    'D-env-electricite': 'A', 'D-europe-regles': 'C', 'D-europe-defense': 'pas de position',
  },
};
const Y = {
  id: 'candidat-y', nom: 'Candidat Y',
  reponses: {
    'D-eco-dette': 'B', 'D-social-retraites': 'B', 'D-social-chomage': 'B',
    'D-env-electricite': 'C', 'D-europe-regles': 'B', 'D-europe-defense': 'C',
  },
};
const calcul = (candidats, reponses = REPONSES, points = POINTS) =>
  calculerProximite({ dilemmes, pointsThemes: points, reponses, candidats });
const parId = (res, id) => res.candidats.find((c) => c.id === id);

test('les voisinages du référentiel sont lus', () => {
  assert.deepEqual(dilemmes.get('D-env-electricite').voisines, [['A', 'C'], ['B', 'C']]);
  assert.deepEqual(dilemmes.get('D-europe-defense').voisines, []);
});

test('accord : identique, voisine, différente, aucune, exclusions', () => {
  const d = dilemmes.get('D-env-electricite');
  assert.equal(accord(d, 'C', 'C'), 1);
  assert.equal(accord(d, 'C', 'A'), 0.5);
  assert.equal(accord(d, 'A', 'C'), 0.5);
  assert.equal(accord(d, 'A', 'B'), 0);
  assert.equal(accord(d, 'A', 'aucune'), 0);
  assert.equal(accord(d, 'A', 'pas de position'), null);
  assert.equal(accord(d, 'A', ''), null);
  assert.equal(accord(d, 'sans avis', 'A'), null);
});

test('exemple de la méthode : poids', () => {
  const poids = calculerPoids(dilemmes, POINTS, REPONSES);
  assert.deepEqual(Object.fromEntries(poids), {
    'D-eco-dette': 30, 'D-social-retraites': 15, 'D-social-chomage': 15,
    'D-env-electricite': 20, 'D-europe-regles': 10, 'D-europe-defense': 10,
  });
});

test('exemple de la méthode : X 67 % (couverture 90 %), Y 45 % (couverture 100 %)', () => {
  const res = calcul([X, Y]);
  assert.equal(res.suffisant, true);
  assert.equal(res.nbReponses, 6);
  const x = parId(res, 'candidat-x');
  const y = parId(res, 'candidat-y');
  assert.equal(x.score, 67);
  assert.equal(x.couverture, 0.9);
  assert.equal(x.affichage, 'complet');
  assert.equal(y.score, 45);
  assert.equal(y.couverture, 1);
  assert.deepEqual(res.groupes, [['candidat-x'], ['candidat-y']]);
});

test('exemple de la méthode : détail par thème de X', () => {
  const x = parId(calcul([X]), 'candidat-x');
  assert.deepEqual(
    Object.fromEntries(Object.entries(x.parTheme).map(([t, v]) => [t, [v.score, v.couverture]])),
    { eco: [100, 1], social: [50, 1], env: [50, 1], europe: [50, 0.5] },
  );
  const defense = x.detail.find((l) => l.dilemme === 'D-europe-defense');
  assert.deepEqual([defense.candidat, defense.accord], ['pas de position', null]);
});

test('moins de 5 dilemmes répondus : pas de résultat', () => {
  const res = calcul([X], { 'D-eco-dette': 'A', 'D-social-retraites': 'B', 'D-env-electricite': 'C', 'D-europe-regles': 'B', 'D-env-rythme': 'sans avis' });
  assert.equal(res.suffisant, false);
  assert.equal(res.nbReponses, 4);
  assert.deepEqual(res.groupes, []);
});

test('un thème à 0 point n\'intervient pas', () => {
  const reponses = { ...REPONSES, 'D-secu-budget': 'A' };
  const poids = calculerPoids(dilemmes, { ...POINTS, secu: 0 }, reponses);
  assert.equal(poids.has('D-secu-budget'), false);
});

test('« aucune » compte comme un désaccord, pas comme une absence', () => {
  const z = { id: 'z', nom: 'Z', reponses: { ...Y.reponses, 'D-eco-dette': 'aucune' } };
  const r = parId(calcul([z]), 'z');
  assert.equal(r.couverture, 1);
  assert.equal(r.score, 45);
});

test('couverture : incomplet entre 40 et 70 %, pas de score en dessous de 40 %', () => {
  const incomplet = { id: 'i', nom: 'I', reponses: { 'D-eco-dette': 'A', 'D-env-electricite': 'C' } }; // 50 %
  const insuffisant = { id: 's', nom: 'S', reponses: { 'D-eco-dette': 'A' } };                       // 30 %
  const res = calcul([X, incomplet, insuffisant]);
  assert.equal(parId(res, 'i').affichage, 'incomplet');
  assert.equal(parId(res, 'i').score, 100);
  assert.equal(parId(res, 's').affichage, 'insuffisant');
  assert.equal(parId(res, 's').score, null);
  assert.deepEqual(res.sansScore, ['s']);
  assert.ok(res.groupes.flat().every((id) => id !== 's'));
});

test('égalités : regroupement par rapport au premier du groupe, ordre alphabétique', () => {
  const r = (id, nom, score) => ({ id, nom, score });
  assert.deepEqual(
    grouperEgalites([r('d', 'Durand', 50), r('b', 'Bernard', 67), r('m', 'Martin', 64), r('a', 'Albert', 70)]),
    [['a', 'b'], ['m'], ['d']],
  );
  assert.deepEqual(grouperEgalites([r('z', 'Zola', 60), r('a', 'Arnaud', 60)]), [['a', 'z']]);
});

test('réponse utilisateur invalide ou dilemme inconnu : erreur', () => {
  assert.throws(() => calculerPoids(dilemmes, POINTS, { 'D-eco-dette': 'Z' }), /invalide/);
  assert.throws(() => calculerPoids(dilemmes, POINTS, { 'D-inconnu': 'A' }), /inconnu/);
});
