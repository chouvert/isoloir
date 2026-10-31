// Tests de l'identité visuelle de L'Isoloir : couleurs de référence, contrastes, logos.
// Règles : identite/charte.md et docs/superpowers/specs/2026-10-31-identite-isoloir-design.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lire = (f) => readFileSync(join(RACINE, f), 'utf8');
const couleurs = () => JSON.parse(lire('identite/couleurs.json'));

/** Ratio de contraste WCAG entre deux couleurs #RRGGBB. */
function contraste(a, b) {
  const luminance = (hex) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

test('couleurs : valeurs de la charte', () => {
  assert.deepEqual(couleurs(), {
    clair: { encre: '#23232B', papier: '#F5F0E6', petrole: '#1F6F73', sable: '#D9C9A8', encre_secondaire: '#4A4A55' },
    sombre: { encre: '#F5F0E6', papier: '#1C1C22', petrole: '#5FB3B3', sable: '#4A443A', encre_secondaire: '#B8B3A8' },
  });
});

test('couleurs : contrastes AA (4,5:1) en clair et en sombre', () => {
  for (const [mode, c] of Object.entries(couleurs())) {
    for (const [texte, fond] of [['encre', 'papier'], ['encre_secondaire', 'papier'], ['petrole', 'papier'], ['papier', 'petrole'], ['encre', 'sable']]) {
      const r = contraste(c[texte], c[fond]);
      assert.ok(r >= 4.5, `${mode} : ${texte} sur ${fond} = ${r.toFixed(2)}`);
    }
  }
});
