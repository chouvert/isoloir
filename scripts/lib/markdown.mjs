// Lecture des fichiers Markdown de la base : frontmatter, sections, tableaux.
import { parse as parseYaml } from 'yaml';

/** Normalise un libellé pour les comparaisons : minuscules, sans accents, espaces réduits. */
export function normaliser(texte) {
  return String(texte ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remplace les commentaires HTML par des lignes vides pour conserver les numéros de ligne. */
function retirerCommentaires(texte) {
  return texte.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ''));
}

/**
 * Sépare le frontmatter YAML du corps.
 * @returns {{ data: object|null, corps: string, decalage: number, erreur: string|null }}
 * `decalage` est le nombre de lignes occupées par le frontmatter.
 */
export function lireFrontmatter(texte) {
  const m = texte.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: null, corps: texte, decalage: 0, erreur: null };
  const decalage = m[0].split('\n').length - 1;
  try {
    const data = parseYaml(m[1]) ?? {};
    return { data, corps: texte.slice(m[0].length), decalage, erreur: null };
  } catch (e) {
    return { data: null, corps: texte.slice(m[0].length), decalage, erreur: e.message };
  }
}

/**
 * Découpe un texte en sections d'un niveau de titre donné.
 * @returns {Array<{ titre: string, contenu: string, ligne: number }>}
 * `ligne` est le numéro (base 1, relatif au texte) de la ligne du titre.
 */
export function lireSections(texte, niveau, ligneDepart = 1) {
  const prefixe = '#'.repeat(niveau) + ' ';
  const lignes = texte.split('\n');
  const sections = [];
  let courante = null;
  lignes.forEach((l, i) => {
    if (l.startsWith(prefixe)) {
      if (courante) sections.push(courante);
      courante = { titre: l.slice(prefixe.length).trim(), lignes: [], ligne: ligneDepart + i };
    } else if (courante) {
      courante.lignes.push(l);
    }
  });
  if (courante) sections.push(courante);
  return sections.map((s) => ({ titre: s.titre, contenu: s.lignes.join('\n'), ligne: s.ligne }));
}

function decouperLigne(l) {
  let s = l.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/**
 * Extrait les tableaux Markdown d'un texte.
 * @returns {Array<{ entetes: string[], cles: string[], lignes: Array<{ cellules: Record<string,string>, ligne: number }>, ligne: number }>}
 * `cles` sont les en-têtes normalisés, utilisés comme clés des cellules.
 */
export function lireTableaux(texte, ligneDepart = 1) {
  const lignes = retirerCommentaires(texte).split('\n');
  const tableaux = [];
  let i = 0;
  while (i < lignes.length) {
    const estTableau = lignes[i].trim().startsWith('|');
    const suivante = lignes[i + 1] ?? '';
    const separateur = /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/.test(suivante);
    if (estTableau && separateur) {
      const entetes = decouperLigne(lignes[i]);
      const cles = entetes.map(normaliser);
      const tableau = { entetes, cles, lignes: [], ligne: ligneDepart + i };
      i += 2;
      while (i < lignes.length && lignes[i].trim().startsWith('|')) {
        const valeurs = decouperLigne(lignes[i]);
        const cellules = {};
        cles.forEach((c, k) => { cellules[c] = valeurs[k] ?? ''; });
        tableau.lignes.push({ cellules, ligne: ligneDepart + i });
        i++;
      }
      tableaux.push(tableau);
    } else {
      i++;
    }
  }
  return tableaux;
}

/** Premier tableau dont les en-têtes contiennent toutes les colonnes demandées. */
export function trouverTableau(tableaux, colonnes) {
  const voulues = colonnes.map(normaliser);
  return tableaux.find((t) => voulues.every((c) => t.cles.includes(c))) ?? null;
}

/** Vrai si la cellule contient un lien Markdown ou une URL. */
export function contientSource(cellule) {
  return /\[[^\]]+\]\([^)\s]+\)/.test(cellule) || /https?:\/\/\S+/.test(cellule);
}

/** Vrai si la valeur est une date ISO AAAA-MM-JJ existante. */
export function estDateIso(valeur) {
  const v = valeur instanceof Date ? valeur.toISOString().slice(0, 10) : String(valeur ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Retire le marquage d'un identifiant éventuellement écrit en `code`. */
export function nettoyerId(valeur) {
  return String(valeur ?? '').replace(/`/g, '').trim();
}
