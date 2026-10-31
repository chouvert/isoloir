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
  const { clair, sombre } = couleurs();
  assert.deepEqual({ clair, sombre }, {
    clair: { encre: '#23232B', papier: '#F5F0E6', petrole: '#1F6F73', sable: '#D9C9A8', encre_secondaire: '#4A4A55' },
    sombre: { encre: '#F5F0E6', papier: '#1C1C22', petrole: '#5FB3B3', sable: '#4A443A', encre_secondaire: '#B8B3A8' },
  });
});

test('couleurs : contrastes AA (4,5:1) en clair et en sombre', () => {
  const { clair, sombre } = couleurs();
  for (const [mode, c] of Object.entries({ clair, sombre })) {
    for (const [texte, fond] of [['encre', 'papier'], ['encre_secondaire', 'papier'], ['petrole', 'papier'], ['papier', 'petrole'], ['encre', 'sable']]) {
      const r = contraste(c[texte], c[fond]);
      assert.ok(r >= 4.5, `${mode} : ${texte} sur ${fond} = ${r.toFixed(2)}`);
    }
  }
});

const LOGOS = ['logo.svg', 'logo-sombre.svg', 'symbole.svg', 'symbole-sombre.svg', 'favicon.svg'];

test('logos : fichiers présents et SVG avec viewBox, xmlns et titre', () => {
  for (const f of LOGOS) {
    const svg = lire(`identite/${f}`).trim();
    assert.ok(svg.startsWith('<svg'), `${f} : doit commencer par <svg`);
    assert.match(svg, /viewBox="[^"]+"/, `${f} : viewBox`);
    assert.match(svg, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, `${f} : xmlns`);
    assert.match(svg, /<title>[^<]+<\/title>/, `${f} : titre`);
  }
});

test('logos : uniquement des couleurs de la palette (neutralité)', () => {
  const { clair, sombre } = couleurs();
  const palette = new Set([clair, sombre].flatMap((c) => Object.values(c)).map((h) => h.toUpperCase()));
  for (const f of LOGOS) {
    const trouvees = lire(`identite/${f}`).match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? [];
    assert.ok(trouvees.length > 0, `${f} : aucune couleur`);
    for (const h of trouvees) assert.ok(palette.has(h.toUpperCase()), `${f} : couleur hors palette ${h}`);
  }
});

test('logos : pas de dépendance à une police (nom en tracés)', () => {
  for (const f of LOGOS) assert.doesNotMatch(lire(`identite/${f}`), /<text\b/, f);
});

test('favicon : viewBox 32 × 32', () => {
  assert.match(lire('identite/favicon.svg'), /viewBox="0 0 32 32"/);
});

test('favicon : lisible à 16 px (traits et formes d\'au moins 3 unités sur 32)', () => {
  const svg = lire('identite/favicon.svg');
  for (const m of svg.matchAll(/stroke-width="([\d.]+)"/g)) assert.ok(Number(m[1]) >= 3, `trait de ${m[1]}`);
  for (const m of svg.matchAll(/<rect [^>]*height="([\d.]+)"/g)) assert.ok(Number(m[1]) >= 3, `hauteur de ${m[1]}`);
});

test('charte : taille minimale du symbole et repli sur le favicon', () => {
  assert.match(lire('identite/charte.md'), /symbole 32 px ; en dessous, `favicon\.svg`/);
});

test('README : logo adapté au thème sombre', () => {
  const r = lire('README.md');
  assert.match(r, /<source media="\(prefers-color-scheme: dark\)" srcset="identite\/logo-sombre\.svg">/);
  assert.match(r, /<img src="identite\/logo\.svg" alt="L’Isoloir"/);
});

test('couleurs : sens de l\'accord nommé et repris par la charte', () => {
  assert.deepEqual(couleurs().semantique, {
    accord_fort: 'petrole', accord_partiel: 'sable', accord_aucun: 'encre_secondaire', faisabilite: 'petrole',
  });
  assert.match(lire('identite/charte.md'), /## 4\. Couleurs porteuses de sens/);
});
