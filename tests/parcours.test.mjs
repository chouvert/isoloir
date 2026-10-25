// Tests du pré-remplissage du budget et de l'ordre des dilemmes, sur le vrai référentiel.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lireReferentiel } from '../scripts/lib/validation.mjs';
import { preremplirBudget, ordonnerDilemmes, arrondirPlusFortReste } from '../scripts/lib/parcours.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ref = lireReferentiel(RACINE, { erreur: () => {}, avertissement: () => {} });
const THEMES = [...ref.themes.keys()];
const somme = (o) => Object.values(o).reduce((s, v) => s + v, 0);

/** Tirage déterministe : suite de valeurs croissantes, donc l'ordre du référentiel départage. */
const tirageFixe = () => { let i = 0; return () => (i++) / 1000; };

const budget = (choisies, aleatoire = tirageFixe()) =>
  preremplirBudget({ themes: THEMES, preoccupations: ref.preoccupations, choisies, aleatoire });

test('les préoccupations du référentiel sont lues', () => {
  assert.equal(ref.preoccupations.size, 14);
  assert.deepEqual(ref.preoccupations.get('P-fin-de-mois'),
    { libelle: 'Boucler les fins de mois', explication: 'Prix, salaires, impôts et aides : ce qui pèse sur le budget du foyer', principal: 'eco', secondaire: 'social', dilemme: 'D-eco-pouvoir-achat' });
  assert.equal(ref.preoccupations.get('P-logement').dilemme, null);
});

test('exemple de la méthode : fins de mois, retraite, climat', () => {
  const b = budget(['P-fin-de-mois', 'P-retraite', 'P-climat']);
  assert.equal(somme(b), 100);
  assert.deepEqual([b.eco, b.social, b.env], [18, 24, 18]);
  const autres = THEMES.filter((t) => !['eco', 'social', 'env'].includes(t)).map((t) => b[t]).sort();
  assert.deepEqual(autres, [6, 6, 7, 7, 7, 7]);
});

test('les égalités d\'arrondi ne favorisent aucun thème', () => {
  const recus = new Map(THEMES.map((t) => [t, new Set()]));
  for (let i = 0; i < 300; i++) {
    const b = budget(['P-fin-de-mois', 'P-retraite', 'P-climat'], Math.random);
    assert.equal(somme(b), 100);
    for (const t of THEMES) recus.get(t).add(b[t]);
  }
  for (const t of THEMES.filter((x) => !['eco', 'social', 'env'].includes(x))) {
    assert.deepEqual([...recus.get(t)].sort(), [6, 7], `thème ${t}`);
  }
});

test('sans préoccupation : 100 points à parts égales', () => {
  const b = budget([]);
  assert.equal(somme(b), 100);
  assert.deepEqual(Object.values(b).sort((x, y) => x - y), [11, 11, 11, 11, 11, 11, 11, 11, 12]);
});

test('les parts s\'additionnent quand deux préoccupations touchent le même thème', () => {
  // eco : 2 + 2 parts, social : 1 part → eco 60/9 + 32, social 60/9 + 8
  const b = budget(['P-fin-de-mois', 'P-dette']);
  assert.equal(somme(b), 100);
  assert.ok([38, 39].includes(b.eco), `eco ${b.eco}`);
  assert.ok([14, 15].includes(b.social), `social ${b.social}`);
});

test('choix invalides : plus de 3, doublon, inconnu', () => {
  assert.throws(() => budget(['P-retraite', 'P-climat', 'P-dette', 'P-ecole']), /au plus 3/);
  assert.throws(() => budget(['P-retraite', 'P-retraite']), /deux fois/);
  assert.throws(() => budget(['P-inconnu']), /inconnue/);
});

test('arrondi au plus fort reste : total conservé', () => {
  const r = arrondirPlusFortReste(new Map([['a', 33.4], ['b', 33.3], ['c', 33.3]]), 100, tirageFixe());
  assert.deepEqual(r, { a: 34, b: 33, c: 33 });
});

const POINTS = { eco: 18, social: 24, env: 18, secu: 7, immig: 7, europe: 7, educ: 7, sante: 6, instit: 6 };
const ordre = (choisies, points = POINTS, aleatoire = tirageFixe()) =>
  ordonnerDilemmes({ dilemmes: ref.dilemmes, preoccupations: ref.preoccupations, choisies, points, aleatoire });

test('ordre : dilemmes des préoccupations d\'abord, puis par thème le plus doté', () => {
  const o = ordre(['P-retraite', 'P-climat', 'P-logement']);
  assert.deepEqual(o.slice(0, 3), ['D-social-retraites', 'D-env-rythme', 'D-social-chomage']);
  assert.equal(o.length, 13);
  assert.equal(new Set(o).size, 13);
  // eco et env sont à égalité (18) : leurs dilemmes viennent juste après social.
  assert.deepEqual(new Set(o.slice(3, 6)), new Set(['D-eco-dette', 'D-eco-pouvoir-achat', 'D-env-electricite']));
  // Les thèmes à 6 points sont posés en dernier.
  assert.deepEqual(new Set(o.slice(-2)), new Set(['D-sante-deserts', 'D-instit-participation']));
});

test('ordre : un thème à 0 point n\'est pas posé, même lié à une préoccupation', () => {
  const o = ordre(['P-ecole', 'P-retraite'], { ...POINTS, educ: 0 });
  assert.equal(o.includes('D-educ-niveau'), false);
  assert.equal(o[0], 'D-social-retraites');
});

test('ordre : dans un thème, ordre du référentiel', () => {
  const o = ordre([]);
  assert.ok(o.indexOf('D-eco-dette') < o.indexOf('D-eco-pouvoir-achat'));
  assert.ok(o.indexOf('D-europe-regles') < o.indexOf('D-europe-defense'));
});
