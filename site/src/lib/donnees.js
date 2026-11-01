// Accès aux données de la base (donnees/base.json), généré par `npm run comparatifs`.
// Toutes les pages passent par ce module : aucune donnée n'est recopiée dans le site.
import base from '../../../donnees/base.json';

export const derniereMaj = base.derniere_maj;
export const themes = base.themes;

const collator = new Intl.Collator('fr', { sensitivity: 'base' });

/**
 * Candidats dans l'ordre alphabétique du nom de famille, le même pour tous (charte, règle 2).
 * L'identifiant suit le motif « nom-prenom », ce qui donne directement cet ordre.
 */
export const candidats = [...base.candidats].sort((a, b) => collator.compare(a.id, b.id));

export const dilemmesActifs = base.dilemmes.filter((d) => d.statut === 'actif');
export const questionsActives = base.questions.filter((q) => q.statut === 'actif');

export function theme(id) {
  return themes.find((t) => t.id === id);
}

export function dilemmesDuTheme(idTheme) {
  return dilemmesActifs.filter((d) => d.theme === idTheme);
}

export function questionsDuTheme(idTheme) {
  return questionsActives.filter((q) => q.theme === idTheme);
}

export function candidat(id) {
  return candidats.find((c) => c.id === id);
}

/** Libellé de l'option choisie par un candidat sur un dilemme, ou un texte neutre s'il n'y en a pas. */
export function reponseDilemme(c, d) {
  const r = c.dilemmes?.[d.id];
  if (!r || r.option === 'pas de position') {
    return { statut: 'sans', libelle: 'Pas de position trouvée' };
  }
  if (r.option === 'aucune') {
    return { statut: 'aucune', libelle: 'Une autre approche que les options proposées', ...r };
  }
  const opt = d.options.find((o) => o.option === r.option);
  return { statut: 'option', libelle: opt ? opt.libelle : r.option, ...r };
}

export function proposition(c, id) {
  if (!id) return undefined;
  return c.propositions.find((p) => p.id === id);
}

/** Retire la syntaxe des liens Markdown ([texte](url) → texte) pour un affichage en texte brut. */
export function texteBrut(s = '') {
  return s.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

export function dateLongue(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  });
}

/** Chemin interne, préfixé par la base du site (GitHub Pages sert le site sous /isoloir/). */
export function lien(chemin = '') {
  const b = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${b}/${chemin.replace(/^\//, '')}`;
}

export const DEPOT = 'https://github.com/chouvert/isoloir';
