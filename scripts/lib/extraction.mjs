// Lecture complète de la base (référentiel et fiches) en un modèle de données,
// utilisé pour générer les comparatifs et l'export JSON.
// À n'appeler que sur une base valide : la structure est supposée contrôlée par validation.mjs.
import { readFileSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  normaliser, lireFrontmatter, lireSections, lireTableaux, trouverTableau, nettoyerId,
} from './markdown.mjs';
import { lireReferentiel, validerFiche } from './validation.mjs';

const lire = (racine, chemin) => readFileSync(join(racine, chemin), 'utf8');
const rapportMuet = () => ({ erreur() {}, avertissement() {} });

/** Valeur de frontmatter en texte (les dates YAML peuvent arriver en objet Date). */
function texte(valeur) {
  if (valeur === undefined || valeur === null) return '';
  if (valeur instanceof Date) return valeur.toISOString().slice(0, 10);
  return String(valeur).trim();
}

/** Liens Markdown d'une cellule : [{ titre, url }]. */
export function lireSources(cellule) {
  return [...String(cellule ?? '').matchAll(/\[([^\]]+)\]\(([^)\s]+)\)/g)]
    .map((m) => ({ titre: m[1], url: m[2] }));
}

/** Cellule d'un tableau, par libellé de colonne (insensible aux accents et à la casse). */
const cellule = (cellules, colonne) => cellules[normaliser(colonne)] ?? '';

function lireTheme(racine) {
  const t = trouverTableau(lireTableaux(lire(racine, 'referentiel/themes.md')), ['id', 'Libellé']);
  return t.lignes.map(({ cellules }) => ({ id: nettoyerId(cellules.id), libelle: cellule(cellules, 'Libellé') }));
}

function lireQuestions(racine) {
  const t = trouverTableau(lireTableaux(lire(racine, 'referentiel/questions.md')), ['id', 'Thème', 'Question', 'Type', 'Statut']);
  return t.lignes.map(({ cellules }) => ({
    id: nettoyerId(cellules.id),
    theme: nettoyerId(cellule(cellules, 'Thème')),
    question: cellule(cellules, 'Question'),
    type: normaliser(cellules.type) === 'fermee' ? 'fermée' : 'ouverte',
    statut: normaliser(cellules.statut) === 'actif' ? 'actif' : 'obsolète',
  }));
}

function lireDilemmes(racine, ref) {
  const dilemmes = [];
  for (const s of lireSections(lire(racine, 'referentiel/dilemmes.md'), 2)) {
    for (const d of lireSections(s.contenu, 3)) {
      const id = nettoyerId(d.titre);
      const structure = ref.dilemmes.get(id);
      if (!structure) continue;
      const enonce = d.contenu.split('\n')
        .filter((l) => /^>\s?/.test(l))
        .map((l) => l.replace(/^>\s?/, '').trim())
        .join(' ');
      const t = trouverTableau(lireTableaux(d.contenu), ['option', 'libellé', 'contrepartie souvent avancée']);
      dilemmes.push({
        id,
        theme: structure.theme,
        statut: structure.statut === 'obsolete' ? 'obsolète' : structure.statut,
        enonce,
        options: t.lignes.map(({ cellules }) => ({
          option: nettoyerId(cellules.option),
          libelle: cellule(cellules, 'libellé'),
          contrepartie: cellule(cellules, 'contrepartie souvent avancée'),
        })),
        voisines: structure.voisines,
      });
    }
  }
  return dilemmes;
}

/** Fiche candidat complète. */
function lireFiche(racine, fichier, ref) {
  const { data, corps } = lireFrontmatter(lire(racine, fichier));
  const sections = lireSections(corps, 2);
  const section = (titre) => sections.find((s) => normaliser(s.titre) === normaliser(titre));
  const tableau = (titre, colonnes) => {
    const s = section(titre);
    return s ? trouverTableau(lireTableaux(s.contenu), colonnes) : null;
  };

  const positions = {};
  for (const { cellules } of tableau('Positions sur les questions-clés', ['question', 'position', 'détail', 'source'])?.lignes ?? []) {
    positions[nettoyerId(cellules.question)] = {
      position: cellules.position,
      detail: cellule(cellules, 'détail'),
      sources: lireSources(cellules.source),
    };
  }

  const dilemmes = {};
  for (const { cellules } of tableau('Réponses aux dilemmes', ['dilemme', 'option', 'proposition', 'justification', 'source'])?.lignes ?? []) {
    dilemmes[nettoyerId(cellules.dilemme)] = {
      option: nettoyerId(cellules.option),
      proposition: nettoyerId(cellules.proposition),
      justification: cellules.justification,
      sources: lireSources(cellules.source),
    };
  }

  const propositions = [];
  const sProp = section('Propositions par thème');
  for (const ss of sProp ? lireSections(sProp.contenu, 3) : []) {
    const theme = ss.titre.split(/\s+[—–-]\s+/)[0].trim();
    const t = trouverTableau(lireTableaux(ss.contenu), ['id', 'proposition', 'source']);
    for (const { cellules } of t?.lignes ?? []) {
      propositions.push({
        id: nettoyerId(cellules.id),
        theme,
        proposition: cellules.proposition,
        chiffrage_annonce: cellule(cellules, 'chiffrage annoncé'),
        chiffrage_independant: cellule(cellules, 'chiffrage indépendant'),
        calendrier: cellules.calendrier ?? '',
        sources: lireSources(cellules.source),
      });
    }
  }

  const phares = (tableau('Propositions phares', ['rang', 'proposition', 'motif', 'source'])?.lignes ?? [])
    .map(({ cellules }) => ({
      rang: Number(nettoyerId(cellules.rang)),
      proposition: nettoyerId(cellules.proposition),
      motif: cellules.motif,
      sources: lireSources(cellules.source),
    }));

  const evolutions = [];
  const sEvo = section('Évolutions / revirements');
  const contenuEvo = sEvo ? sEvo.contenu.replace(/<!--[\s\S]*?-->/g, '') : '';
  for (const l of contenuEvo.split('\n')) {
    const m = l.trim().match(/^- (\d{4}-\d{2}-\d{2})\s*:\s*(.+)$/);
    if (m) evolutions.push({ date: m[1], description: m[2], sources: lireSources(m[2]) });
  }

  // La faisabilité est lue par le validateur, qui en contrôle déjà la cohérence.
  const { analyse } = validerFiche(racine, fichier, ref, rapportMuet());
  const faisabilite = analyse && {
    date: analyse.date,
    confiance: analyse.confiance,
    globale: analyse.globale,
    notes: Object.fromEntries(analyse.notes),
  };

  return {
    id: basename(fichier, '.md'),
    nom: texte(data.nom),
    parti: texte(data.parti),
    famille_politique: texte(data.famille_politique),
    statut: texte(data.statut),
    date_declaration: texte(data.date_declaration),
    programme_url: texte(data.programme_url),
    programme_version: texte(data.programme_version),
    derniere_maj: texte(data.derniere_maj),
    positions,
    dilemmes,
    phares,
    propositions,
    evolutions,
    faisabilite: faisabilite || null,
  };
}

/** Modèle de données complet de la base. */
export function lireBase(racine) {
  const ref = lireReferentiel(racine, rapportMuet());
  const fichiers = readdirSync(join(racine, 'candidats'))
    .filter((f) => f.endsWith('.md') && !f.startsWith('_'))
    .sort()
    .map((f) => `candidats/${f}`);
  return {
    themes: lireTheme(racine),
    questions: lireQuestions(racine),
    dilemmes: lireDilemmes(racine, ref),
    preoccupations: [...ref.preoccupations].map(([id, p]) => ({ id, ...p })),
    criteres: ref.criteres,
    candidats: fichiers.map((f) => lireFiche(racine, f, ref)),
  };
}
