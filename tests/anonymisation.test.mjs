// Tests de l'anonymisation des propositions montrées dans les duels à l'aveugle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  texteAveugle, termesInterdits, exclusion, lireTermesManuels, MAX_CARACTERES,
} from '../scripts/lib/anonymisation.mjs';

test('nettoyage : guillemets, parenthèses, liens, ponctuation finale', () => {
  assert.equal(texteAveugle('Taxer les « méga héritages » (Public Sénat) [x](https://a.fr) ; '), 'Taxer les méga héritages');
});

test('nettoyage : parenthèses imbriquées ou non fermées, crochets', () => {
  assert.equal(texteAveugle('A (b (c) d) e'), 'A e');
  assert.equal(texteAveugle('A (b'), 'A');
  assert.equal(texteAveugle('Nous le ferons [la régularisation] vite'), 'Nous le ferons vite');
  assert.equal(texteAveugle('Mesure , suivie ; ; puis "citée" https://x.fr/y'), 'Mesure, suivie ; puis citée');
});

test('exclusion : vide et trop long', () => {
  assert.equal(MAX_CARACTERES, 300);
  assert.equal(exclusion('', []), 'vide');
  assert.equal(exclusion('x'.repeat(301), []), 'trop long');
  assert.equal(exclusion('x'.repeat(300), []), null);
});

test('termes interdits automatiques et manuels', () => {
  const termes = termesInterdits([{ nom: 'Marine Le Pen', parti: 'Rassemblement national' }], ['Jadot']);
  for (const t of ['Marine Le Pen', 'Le Pen', 'Rassemblement national', 'Jadot']) assert.ok(termes.includes(t), t);
  assert.ok(!termes.includes('Marine'));
});

test('exclusion : terme interdit sans accents ni casse, en mot entier', () => {
  const termes = termesInterdits([{ nom: 'Marine Le Pen', parti: 'Rassemblement national' }], ['Jadot']);
  assert.equal(exclusion('accord avec yannick JADOT', termes), 'terme interdit : Jadot');
  assert.equal(exclusion('soutien du rassemblement NATIONAL', termes), 'terme interdit : Rassemblement national');
  assert.equal(exclusion('la marine nationale', termes), null);
  assert.equal(exclusion('le jadotisme', termes), null);
});

test('termes manuels lus dans referentiel/anonymisation.md', () => {
  const d = mkdtempSync(join(tmpdir(), 'anon-'));
  try {
    mkdirSync(join(d, 'referentiel'));
    writeFileSync(join(d, 'referentiel/anonymisation.md'), '# x\n\n| terme | motif |\n|---|---|\n| Jadot | soutien cité |\n| Brossat | directeur de campagne |\n');
    assert.deepEqual(lireTermesManuels(d), ['Jadot', 'Brossat']);
  } finally { rmSync(d, { recursive: true, force: true }); }
});
