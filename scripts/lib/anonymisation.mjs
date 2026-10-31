// Texte « à l'aveugle » des propositions montrées dans les duels : nettoyage du texte de la fiche,
// puis exclusion des textes encore reconnaissables. Règles : docs/superpowers/specs/2026-10-31-duels-aveugle-design.md.
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normaliser, lireTableaux, trouverTableau } from './markdown.mjs';

export const MAX_CARACTERES = 300;

/** Retire les passages entre délimiteurs, en partant des plus intérieurs ; un délimiteur non fermé coupe le reste. */
function retirerEntre(texte, ouvrant, fermant) {
  const interieur = new RegExp(`\\${ouvrant}[^\\${ouvrant}\\${fermant}]*\\${fermant}`, 'g');
  let t = texte;
  for (let avant = null; avant !== t;) { avant = t; t = t.replace(interieur, ' '); }
  const i = t.indexOf(ouvrant);
  return (i >= 0 ? t.slice(0, i) : t).replaceAll(fermant, ' ');
}

/** Texte de la proposition sans sources, attributions, crochets ni guillemets. */
export function texteAveugle(texte) {
  let t = String(texte ?? '')
    .replace(/\[[^\]]*\]\([^)\s]*\)/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\b[a-z]+-\d{2,}\b/g, ' ') // identifiants internes (eco-01…)
    .replace(/,?\s*\b(rapporté|annoncé)e?s?\s+le\s+\d{4}-\d{2}-\d{2}/gi, ' ') // mention de source datée
    .replace(/,?\s*\bselon (lui|elle)\b,?/gi, ' '); // indice du genre de l'auteur
  t = retirerEntre(t, '(', ')');
  t = retirerEntre(t, '[', ']');
  return t
    .replace(/[«»"“”]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.])/g, '$1')
    .replace(/;(\s*;)+/g, ';')
    .replace(/^[\s,;:.]+|[\s,;:]+$/g, '')
    .trim();
}

/** Termes qui trahissent l'auteur : nom complet, nom de famille et parti de chaque candidat, puis termes manuels. */
export function termesInterdits(candidats, manuels = []) {
  const termes = [];
  for (const { nom, parti } of candidats) {
    const mots = String(nom ?? '').trim().split(/\s+/).filter(Boolean);
    if (mots.length) termes.push(mots.join(' '));
    if (mots.length > 1) termes.push(mots.slice(1).join(' '));
    if (parti) termes.push(String(parti).trim());
  }
  termes.push(...manuels);
  return [...new Set(termes.filter(Boolean))];
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Motif d'exclusion du texte à l'aveugle, ou null s'il peut être montré. */
export function exclusion(texte, termes) {
  if (!texte) return 'vide';
  if (texte.length > MAX_CARACTERES) return 'trop long';
  const n = normaliser(texte);
  for (const terme of termes) {
    const motif = new RegExp(`(^|[^a-z0-9])${echapper(normaliser(terme))}($|[^a-z0-9])`);
    if (motif.test(n)) return `terme interdit : ${terme}`;
  }
  return null;
}

/** Termes manuels du tableau « terme | motif » de referentiel/anonymisation.md. */
export function lireTermesManuels(racine) {
  const fichier = join(racine, 'referentiel/anonymisation.md');
  if (!existsSync(fichier)) return [];
  const t = trouverTableau(lireTableaux(readFileSync(fichier, 'utf8')), ['terme', 'motif']);
  return (t?.lignes ?? []).map((l) => l.cellules.terme).filter(Boolean);
}
