// Contrôle de cohérence de la base : référentiel, fiches candidats, comparatifs.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import {
  normaliser, lireFrontmatter, lireSections, lireTableaux, trouverTableau,
  contientSource, estDateIso, nettoyerId,
} from './markdown.mjs';

export const STATUTS_CANDIDAT = ['pressenti', 'déclaré', 'parrainages validés', 'retiré'];
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const MAX_PHARES = 3;
const STATUTS_DILEMME = ['actif', 'brouillon', 'obsolete'];
export const REPONSES_DILEMME_SPECIALES = ['aucune', 'pas de position'];
const SECTIONS_FICHE = [
  'Profil',
  'Positions sur les questions-clés',
  'Réponses aux dilemmes',
  'Propositions phares',
  'Propositions par thème',
  'Évolutions / revirements',
  'Analyse de faisabilité (Claude)',
];

/** Collecteur de constats (erreurs bloquantes et avertissements). */
class Rapport {
  constructor() { this.erreurs = []; this.avertissements = []; }
  erreur(fichier, ligne, message) { this.erreurs.push({ fichier, ligne, message }); }
  avertissement(fichier, ligne, message) { this.avertissements.push({ fichier, ligne, message }); }
}

function lire(racine, chemin) {
  return readFileSync(join(racine, chemin), 'utf8');
}

function listerMarkdown(racine, dossier) {
  const d = join(racine, dossier);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((f) => f.endsWith('.md')).sort().map((f) => `${dossier}/${f}`);
}

// ---------------------------------------------------------------------------
// Référentiel
// ---------------------------------------------------------------------------

export function lireReferentiel(racine, rapport) {
  const ref = {
    themes: new Map(),          // id -> libellé
    questions: new Map(),       // id -> { theme, type, statut }
    positions: [],              // valeurs autorisées
    criteres: [],               // F-xxx
    confiances: [],             // élevé | moyen | faible
    dilemmes: new Map(),        // id -> { theme, statut, options: string[], voisines: string[][] }
    preoccupations: new Map(),  // id -> { libelle, explication, principal, secondaire, dilemme }
  };

  // Thèmes
  const fThemes = 'referentiel/themes.md';
  const tThemes = trouverTableau(lireTableaux(lire(racine, fThemes)), ['id', 'Libellé']);
  if (!tThemes) rapport.erreur(fThemes, 1, 'tableau des thèmes (colonnes id, Libellé) introuvable');
  else {
    for (const { cellules, ligne } of tThemes.lignes) {
      const id = nettoyerId(cellules.id);
      if (!SLUG.test(id)) rapport.erreur(fThemes, ligne, `identifiant de thème invalide « ${id} »`);
      else if (ref.themes.has(id)) rapport.erreur(fThemes, ligne, `thème « ${id} » défini deux fois`);
      else ref.themes.set(id, cellules[normaliser('Libellé')]);
    }
  }

  // Questions et valeurs de position
  const fQuestions = 'referentiel/questions.md';
  const tabQ = lireTableaux(lire(racine, fQuestions));
  const tValeurs = trouverTableau(tabQ, ['valeur', 'Sens']);
  if (!tValeurs) rapport.erreur(fQuestions, 1, 'tableau des valeurs de position (colonnes valeur, Sens) introuvable');
  else ref.positions = tValeurs.lignes.map((l) => normaliser(l.cellules.valeur)).filter(Boolean);

  const tQuestions = trouverTableau(tabQ, ['id', 'Thème', 'Question', 'Type', 'Statut']);
  if (!tQuestions) rapport.erreur(fQuestions, 1, 'tableau des questions (colonnes id, Thème, Question, Type, Statut) introuvable');
  else {
    for (const { cellules, ligne } of tQuestions.lignes) {
      const id = nettoyerId(cellules.id);
      const theme = nettoyerId(cellules[normaliser('Thème')]);
      const type = normaliser(cellules.type);
      const statut = normaliser(cellules.statut);
      if (!/^Q-[a-z0-9]+-[a-z0-9]+$/.test(id)) {
        rapport.erreur(fQuestions, ligne, `identifiant de question invalide « ${id} » (format Q-<theme>-<mot>)`);
        continue;
      }
      if (ref.questions.has(id)) { rapport.erreur(fQuestions, ligne, `question « ${id} » définie deux fois`); continue; }
      if (!ref.themes.has(theme)) rapport.erreur(fQuestions, ligne, `question « ${id} » : thème inconnu « ${theme} »`);
      else if (!id.startsWith(`Q-${theme}-`)) rapport.erreur(fQuestions, ligne, `question « ${id} » : l'identifiant ne correspond pas au thème « ${theme} »`);
      if (!['ouverte', 'fermee'].includes(type)) rapport.erreur(fQuestions, ligne, `question « ${id} » : type « ${cellules.type} » invalide (ouverte | fermée)`);
      if (!['actif', 'obsolete'].includes(statut)) rapport.erreur(fQuestions, ligne, `question « ${id} » : statut « ${cellules.statut} » invalide (actif | obsolète)`);
      ref.questions.set(id, { theme, type, statut });
    }
  }

  // Grille de faisabilité
  const fFais = 'referentiel/faisabilite.md';
  const tabF = lireTableaux(lire(racine, fFais));
  const tCriteres = trouverTableau(tabF, ['id', 'Critère']);
  if (!tCriteres) rapport.erreur(fFais, 1, 'tableau des critères (colonnes id, Critère) introuvable');
  else {
    for (const { cellules, ligne } of tCriteres.lignes) {
      const id = nettoyerId(cellules.id);
      if (!/^F-[a-z]+$/.test(id)) rapport.erreur(fFais, ligne, `identifiant de critère invalide « ${id} »`);
      else ref.criteres.push(id);
    }
  }
  const tConf = trouverTableau(tabF, ['valeur', "Quand l'utiliser"]);
  if (!tConf) rapport.erreur(fFais, 1, "tableau de l'indice de confiance introuvable");
  else ref.confiances = tConf.lignes.map((l) => normaliser(l.cellules.valeur)).filter(Boolean);

  lireDilemmes(racine, ref, rapport);
  lirePreoccupations(racine, ref, rapport);
  return ref;
}

/** Préoccupations : un tableau, chaque thème principal d'au moins une préoccupation. */
function lirePreoccupations(racine, ref, rapport) {
  const fichier = 'referentiel/preoccupations.md';
  const colonnes = ['id', 'libellé', 'explication', 'thème principal', 'thème secondaire', 'dilemme'];
  const t = trouverTableau(lireTableaux(lire(racine, fichier)), colonnes);
  if (!t) { rapport.erreur(fichier, 1, `tableau des préoccupations (${colonnes.join(', ')}) introuvable`); return; }
  const vide = (v) => v === '' || v === '—' || v === '-';
  const libelles = new Set();
  for (const { cellules, ligne } of t.lignes) {
    const id = nettoyerId(cellules.id);
    if (!/^P-[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) { rapport.erreur(fichier, ligne, `identifiant de préoccupation invalide « ${id} » (format P-<mot>)`); continue; }
    if (ref.preoccupations.has(id)) { rapport.erreur(fichier, ligne, `préoccupation « ${id} » définie deux fois`); continue; }
    const libelle = cellules[normaliser('libellé')];
    const explication = cellules.explication;
    const principal = nettoyerId(cellules[normaliser('thème principal')]);
    const secondaireBrut = nettoyerId(cellules[normaliser('thème secondaire')]);
    const dilemmeBrut = nettoyerId(cellules.dilemme);
    const secondaire = vide(secondaireBrut) ? null : secondaireBrut;
    const dilemme = vide(dilemmeBrut) ? null : dilemmeBrut;

    if (!libelle) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : libellé vide`);
    else if (libelles.has(normaliser(libelle))) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : libellé déjà utilisé`);
    libelles.add(normaliser(libelle));
    if (!explication) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : explication vide`);
    if (!ref.themes.has(principal)) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : thème principal inconnu « ${principal} »`);
    if (secondaire && !ref.themes.has(secondaire)) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : thème secondaire inconnu « ${secondaire} »`);
    if (secondaire && secondaire === principal) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : thème secondaire identique au principal`);
    if (dilemme) {
      const d = ref.dilemmes.get(dilemme);
      if (!d) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : dilemme inconnu « ${dilemme} »`);
      else {
        if (d.statut !== 'actif') rapport.erreur(fichier, ligne, `préoccupation « ${id} » : dilemme « ${dilemme} » non actif`);
        if (d.theme !== principal && d.theme !== secondaire) rapport.erreur(fichier, ligne, `préoccupation « ${id} » : dilemme « ${dilemme} » hors de ses thèmes`);
      }
    }
    ref.preoccupations.set(id, { libelle, explication, principal, secondaire, dilemme });
  }
  const couverts = new Set([...ref.preoccupations.values()].map((p) => p.principal));
  for (const theme of ref.themes.keys()) {
    if (!couverts.has(theme)) rapport.erreur(fichier, t.ligne, `thème « ${theme} » : aucune préoccupation ne l'a pour thème principal`);
  }
}

/**
 * Ligne « - voisines : A-B, C-D (raison) » ou « - voisines : aucune (raison) ».
 * @returns {string[][]} paires d'options voisines
 */
function lireVoisines(fichier, d, id, options, rapport) {
  const m = d.contenu.match(/^- voisines\s*:\s*(.+)$/m);
  if (!m) { rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : ligne « - voisines : … » manquante (« aucune » si pas de voisinage)`); return []; }
  const valeur = m[1].replace(/\(.*\)\s*$/, '').trim();
  if (normaliser(valeur) === 'aucune') return [];
  const paires = [];
  for (const brut of valeur.split(',').map((s) => s.trim())) {
    const p = brut.match(/^([A-Z])-([A-Z])$/);
    if (!p || p[1] === p[2]) { rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : paire voisine « ${brut} » invalide (format A-B)`); continue; }
    const inconnues = [p[1], p[2]].filter((o) => !options.includes(o));
    if (inconnues.length) { rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : paire voisine « ${brut} » avec option inexistante`); continue; }
    const cle = [p[1], p[2]].sort().join('-');
    if (paires.some((q) => q.join('-') === cle)) { rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : paire voisine « ${brut} » en double`); continue; }
    paires.push(cle.split('-'));
  }
  const gradue = /^- type\s*:\s*gradu[ée]\s*$/m.test(d.contenu);
  if (paires.length > 2 && !gradue) rapport.avertissement(fichier, d.ligne, `dilemme « ${id} » : ${paires.length} paires voisines (plus de deux : réservé aux dilemmes déclarés « - type : gradué »)`);
  return paires;
}

/**
 * Dilemmes : sections « ## <theme> — … » contenant des sous-sections « ### D-<theme>-<mot> »
 * avec une ligne « - statut : … », un énoncé en citation (>) et un tableau d'options.
 */
function lireDilemmes(racine, ref, rapport) {
  const fichier = 'referentiel/dilemmes.md';
  const sections = lireSections(lire(racine, fichier), 2);
  for (const s of sections) {
    const sous = lireSections(s.contenu, 3, s.ligne + 1);
    const themeSection = s.titre.split(/\s+[—–-]\s+/)[0].trim();
    const estTheme = ref.themes.has(themeSection);
    for (const d of sous) {
      const id = nettoyerId(d.titre);
      if (!estTheme) { rapport.erreur(fichier, d.ligne, `dilemme « ${id} » hors d'une section de thème (« ## <id> — <libellé> »)`); continue; }
      const m = id.match(/^D-([a-z0-9]+)-[a-z0-9-]+$/);
      if (!m) { rapport.erreur(fichier, d.ligne, `identifiant de dilemme invalide « ${id} » (format D-<theme>-<mot>)`); continue; }
      if (m[1] !== themeSection) rapport.erreur(fichier, d.ligne, `dilemme « ${id} » placé dans le thème « ${themeSection} »`);
      if (ref.dilemmes.has(id)) { rapport.erreur(fichier, d.ligne, `dilemme « ${id} » défini deux fois`); continue; }

      const mStatut = d.contenu.match(/^- statut\s*:\s*(.+)$/m);
      const statut = mStatut ? normaliser(mStatut[1]) : '';
      if (!STATUTS_DILEMME.includes(statut)) {
        rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : statut « ${mStatut ? mStatut[1].trim() : ''} » invalide (actif | brouillon | obsolète)`);
      }
      if (!/^>\s*\S/m.test(d.contenu)) rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : énoncé manquant (ligne commençant par « > »)`);

      const options = [];
      const t = trouverTableau(lireTableaux(d.contenu, d.ligne + 1), ['option', 'libellé', 'contrepartie souvent avancée']);
      if (!t) rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : tableau des options (option, libellé, contrepartie souvent avancée) introuvable`);
      else {
        for (const { cellules, ligne } of t.lignes) {
          const opt = nettoyerId(cellules.option);
          if (!/^[A-Z]$/.test(opt)) { rapport.erreur(fichier, ligne, `dilemme « ${id} » : option « ${opt} » invalide (une lettre majuscule)`); continue; }
          if (options.includes(opt)) { rapport.erreur(fichier, ligne, `dilemme « ${id} » : option « ${opt} » définie deux fois`); continue; }
          options.push(opt);
          if (!cellules[normaliser('libellé')]) rapport.erreur(fichier, ligne, `dilemme « ${id} » option ${opt} : libellé vide`);
          if (!cellules[normaliser('contrepartie souvent avancée')]) rapport.erreur(fichier, ligne, `dilemme « ${id} » option ${opt} : contrepartie vide`);
        }
        if (options.length < 2) rapport.erreur(fichier, d.ligne, `dilemme « ${id} » : au moins deux options attendues`);
      }
      const voisines = lireVoisines(fichier, d, id, options, rapport);
      ref.dilemmes.set(id, { theme: m[1], statut, options, voisines });
    }
  }
}

// ---------------------------------------------------------------------------
// Fiches candidats
// ---------------------------------------------------------------------------

function parserNote(texte) {
  const v = String(texte ?? '').replace(',', '.').trim();
  if (v === '' || v === '–' || v === '-') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Contrôle une fiche. En mode gabarit, seule la structure est vérifiée
 * (sections, questions et thèmes présents), pas le contenu.
 * @returns {object} données extraites, utilisées pour les contrôles croisés
 */
export function validerFiche(racine, fichier, ref, rapport, { gabarit = false } = {}) {
  const texte = lire(racine, fichier);
  const { data, corps, decalage, erreur } = lireFrontmatter(texte);
  const fiche = { id: basename(fichier, '.md'), fichier, positions: new Map(), analyse: null };

  // Frontmatter
  if (erreur) rapport.erreur(fichier, 1, `frontmatter YAML illisible : ${erreur}`);
  else if (!data) rapport.erreur(fichier, 1, 'frontmatter YAML absent');
  else if (!gabarit) {
    for (const champ of ['id', 'nom', 'statut', 'derniere_maj']) {
      if (data[champ] === undefined || data[champ] === null || data[champ] === '') {
        rapport.erreur(fichier, 1, `champ « ${champ} » manquant dans le frontmatter`);
      }
    }
    if (!SLUG.test(fiche.id)) rapport.erreur(fichier, 1, 'nom de fichier invalide (minuscules, sans accents, tirets)');
    if (data.id && data.id !== fiche.id) rapport.erreur(fichier, 1, `id « ${data.id} » différent du nom de fichier « ${fiche.id} »`);
    if (data.statut && !STATUTS_CANDIDAT.includes(data.statut)) {
      rapport.erreur(fichier, 1, `statut « ${data.statut} » invalide (${STATUTS_CANDIDAT.join(' | ')})`);
    }
    for (const champ of ['date_declaration', 'derniere_maj']) {
      if (data[champ] && !estDateIso(data[champ])) rapport.erreur(fichier, 1, `${champ} « ${data[champ]} » n'est pas une date AAAA-MM-JJ`);
    }
    if (data.programme_url && !/^https?:\/\//.test(data.programme_url)) {
      rapport.erreur(fichier, 1, 'programme_url doit être une URL http(s)');
    }
    fiche.nom = data.nom;
  }

  const sections = lireSections(corps, 2, decalage + 1);
  const section = (titre) => sections.find((s) => normaliser(s.titre) === normaliser(titre));
  for (const titre of SECTIONS_FICHE) {
    if (!section(titre)) rapport.erreur(fichier, 1, `section « ## ${titre} » manquante`);
  }

  // Positions sur les questions-clés
  const sPos = section('Positions sur les questions-clés');
  if (sPos) {
    const t = trouverTableau(lireTableaux(sPos.contenu, sPos.ligne + 1), ['question', 'position', 'détail', 'source']);
    if (!t) rapport.erreur(fichier, sPos.ligne, 'tableau des positions (colonnes question, position, détail, source) introuvable');
    else {
      let nonRenseignees = 0;
      for (const { cellules, ligne } of t.lignes) {
        const id = nettoyerId(cellules.question);
        const q = ref.questions.get(id);
        if (!q) { rapport.erreur(fichier, ligne, `question inconnue « ${id} »`); continue; }
        if (fiche.positions.has(id)) { rapport.erreur(fichier, ligne, `question « ${id} » présente deux fois`); continue; }
        if (q.statut === 'obsolete') rapport.avertissement(fichier, ligne, `question « ${id} » marquée obsolète dans le référentiel`);
        const position = cellules.position;
        fiche.positions.set(id, position);
        if (gabarit) continue;
        if (!position) { nonRenseignees++; continue; }
        if (q.type === 'fermee' && !ref.positions.includes(normaliser(position))) {
          rapport.erreur(fichier, ligne, `« ${id} » est une question fermée : position « ${position} » non autorisée (${ref.positions.join(' | ')})`);
        }
        if (normaliser(position) !== 'pas de position' && !contientSource(cellules.source)) {
          rapport.erreur(fichier, ligne, `« ${id} » : position sans source (lien attendu)`);
        }
      }
      for (const [id, q] of ref.questions) {
        if (q.statut === 'actif' && !fiche.positions.has(id)) {
          rapport.erreur(fichier, sPos.ligne, `question active « ${id} » absente du tableau des positions`);
        }
      }
      if (nonRenseignees > 0) {
        rapport.avertissement(fichier, sPos.ligne, `${nonRenseignees} question(s) non renseignée(s) (mettre « pas de position » si aucune prise de position trouvée)`);
      }
    }
  }

  // Réponses aux dilemmes
  fiche.dilemmes = new Map();
  const propositionsDilemmes = []; // vérifiées une fois les propositions de la fiche lues
  const sDil = section('Réponses aux dilemmes');
  if (sDil) {
    const t = trouverTableau(lireTableaux(sDil.contenu, sDil.ligne + 1), ['dilemme', 'option', 'proposition', 'justification', 'source']);
    if (!t) rapport.erreur(fichier, sDil.ligne, 'tableau des réponses (colonnes dilemme, option, proposition, justification, source) introuvable');
    else {
      let nonRenseignes = 0;
      for (const { cellules, ligne } of t.lignes) {
        const id = nettoyerId(cellules.dilemme);
        const d = ref.dilemmes.get(id);
        if (!d) { rapport.erreur(fichier, ligne, `dilemme inconnu « ${id} »`); continue; }
        if (fiche.dilemmes.has(id)) { rapport.erreur(fichier, ligne, `dilemme « ${id} » présent deux fois`); continue; }
        if (d.statut !== 'actif') rapport.avertissement(fichier, ligne, `dilemme « ${id} » n'est pas actif dans le référentiel`);
        const option = nettoyerId(cellules.option);
        fiche.dilemmes.set(id, option);
        if (gabarit) continue;
        if (!option) { nonRenseignes++; continue; }
        const speciale = REPONSES_DILEMME_SPECIALES.includes(normaliser(option));
        const proposition = nettoyerId(cellules.proposition);
        if (speciale && proposition) {
          rapport.erreur(fichier, ligne, `« ${id} » : proposition renseignée pour une réponse « ${normaliser(option)} »`);
        } else if (!speciale && !proposition) {
          rapport.avertissement(fichier, ligne, `« ${id} » : option « ${option} » sans proposition (pas de duel à l'aveugle pour ce dilemme)`);
        } else if (proposition) {
          propositionsDilemmes.push({ id, proposition, ligne });
        }
        if (!speciale && !d.options.includes(option)) {
          rapport.erreur(fichier, ligne, `« ${id} » : réponse « ${option} » invalide (${[...d.options, ...REPONSES_DILEMME_SPECIALES].join(' | ')})`);
          continue;
        }
        if (normaliser(option) !== 'pas de position') {
          if (!cellules.justification) rapport.erreur(fichier, ligne, `« ${id} » : justification manquante pour la réponse « ${option} »`);
          if (!contientSource(cellules.source)) rapport.erreur(fichier, ligne, `« ${id} » : réponse sans source (lien attendu)`);
        }
      }
      for (const [id, d] of ref.dilemmes) {
        if (d.statut === 'actif' && !fiche.dilemmes.has(id)) {
          rapport.erreur(fichier, sDil.ligne, `dilemme actif « ${id} » absent du tableau des réponses`);
        }
      }
      if (nonRenseignes > 0) {
        rapport.avertissement(fichier, sDil.ligne, `${nonRenseignes} dilemme(s) non renseigné(s) (mettre « pas de position » si aucune prise de position trouvée)`);
      }
    }
  }

  // Propositions par thème
  const sProp = section('Propositions par thème');
  if (sProp) {
    const sousSections = lireSections(sProp.contenu, 3, sProp.ligne + 1);
    const vus = new Set();
    const idsProp = new Set();
    for (const ss of sousSections) {
      const theme = ss.titre.split(/\s+[—–-]\s+/)[0].trim();
      if (!ref.themes.has(theme)) { rapport.erreur(fichier, ss.ligne, `thème inconnu « ${theme} » (titre attendu « ### <id> — <libellé> »)`); continue; }
      if (vus.has(theme)) { rapport.erreur(fichier, ss.ligne, `thème « ${theme} » présent deux fois`); continue; }
      vus.add(theme);
      const t = trouverTableau(lireTableaux(ss.contenu, ss.ligne + 1), ['id', 'proposition', 'source']);
      if (!t) { rapport.erreur(fichier, ss.ligne, `thème « ${theme} » : tableau des propositions introuvable`); continue; }
      if (gabarit) continue;
      for (const { cellules, ligne } of t.lignes) {
        const id = nettoyerId(cellules.id);
        if (!new RegExp(`^${theme}-\\d{2,}$`).test(id)) rapport.erreur(fichier, ligne, `identifiant de proposition « ${id} » invalide (format ${theme}-NN)`);
        else if (idsProp.has(id)) rapport.erreur(fichier, ligne, `proposition « ${id} » définie deux fois`);
        idsProp.add(id);
        if (!cellules.proposition) rapport.erreur(fichier, ligne, `proposition « ${id} » : texte vide`);
        if (!contientSource(cellules.source)) rapport.erreur(fichier, ligne, `proposition « ${id} » : source manquante (lien attendu)`);
      }
    }
    for (const theme of ref.themes.keys()) {
      if (!vus.has(theme)) rapport.erreur(fichier, sProp.ligne, `sous-section « ### ${theme} — … » manquante`);
    }
    fiche.propositions = idsProp;
  }

  if (!gabarit) {
    for (const { id, proposition, ligne } of propositionsDilemmes) {
      if (!fiche.propositions?.has(proposition)) {
        rapport.erreur(fichier, ligne, `« ${id} » : proposition « ${proposition} » absente des propositions de la fiche`);
      }
    }
  }

  // Propositions phares
  const sPhares = section('Propositions phares');
  if (sPhares) {
    const t = trouverTableau(lireTableaux(sPhares.contenu, sPhares.ligne + 1), ['rang', 'proposition', 'motif', 'source']);
    if (!t) rapport.erreur(fichier, sPhares.ligne, 'tableau des propositions phares (colonnes rang, proposition, motif, source) introuvable');
    else if (!gabarit) {
      const ids = [];
      t.lignes.forEach(({ cellules, ligne }, i) => {
        const id = nettoyerId(cellules.proposition);
        if (nettoyerId(cellules.rang) !== String(i + 1)) rapport.erreur(fichier, ligne, `rang « ${cellules.rang} » : attendu ${i + 1}`);
        if (!fiche.propositions?.has(id)) { rapport.erreur(fichier, ligne, `proposition phare « ${id} » absente des propositions de la fiche`); return; }
        if (ids.includes(id)) { rapport.erreur(fichier, ligne, `proposition phare « ${id} » citée deux fois`); return; }
        ids.push(id);
        if (!cellules.motif) rapport.erreur(fichier, ligne, `proposition phare « ${id} » : motif du choix manquant`);
        if (!contientSource(cellules.source)) rapport.erreur(fichier, ligne, `proposition phare « ${id} » : source du choix manquante (lien attendu)`);
      });
      if (t.lignes.length > MAX_PHARES) rapport.erreur(fichier, sPhares.ligne, `${t.lignes.length} propositions phares : ${MAX_PHARES} au maximum`);
      if (t.lignes.length === 0 && (fiche.propositions?.size ?? 0) >= MAX_PHARES) {
        rapport.avertissement(fichier, sPhares.ligne, 'aucune proposition phare désignée');
      }
      fiche.phares = ids;
    }
  }

  if (gabarit) return fiche;

  // Évolutions / revirements
  const sEvo = section('Évolutions / revirements');
  if (sEvo) {
    const lignes = sEvo.contenu.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, '')).split('\n');
    lignes.forEach((l, i) => {
      if (!l.trim().startsWith('- ')) return;
      const m = l.trim().match(/^- (\S+)\s*:/);
      if (!m || !estDateIso(m[1])) rapport.erreur(fichier, sEvo.ligne + 1 + i, 'entrée d\'évolution : format attendu « - AAAA-MM-JJ : description »');
      else if (!contientSource(l)) rapport.avertissement(fichier, sEvo.ligne + 1 + i, 'entrée d\'évolution sans source');
    });
  }

  // Analyse de faisabilité
  const sAna = section('Analyse de faisabilité (Claude)');
  if (sAna) fiche.analyse = validerAnalyse(fichier, sAna, ref, rapport);

  return fiche;
}

function validerAnalyse(fichier, sAna, ref, rapport) {
  const contenu = sAna.contenu;
  const mDate = contenu.match(/Analysée le\s*:\s*([^·_\n]+)/);
  const dateTexte = mDate ? mDate[1].trim() : '';
  const tCrit = trouverTableau(lireTableaux(contenu, sAna.ligne + 1), ['critère', 'note', 'justification courte', 'sources']);

  // Analyse non encore réalisée : rien ne doit être noté.
  if (!dateTexte || dateTexte === 'AAAA-MM-JJ') {
    if (tCrit && tCrit.lignes.some((l) => l.cellules.note)) {
      rapport.erreur(fichier, sAna.ligne, 'notes de faisabilité présentes sans date d\'analyse');
    }
    return null;
  }

  const analyse = { date: dateTexte, notes: new Map(), globale: null, confiance: null };
  if (!estDateIso(dateTexte)) rapport.erreur(fichier, sAna.ligne, `date d'analyse « ${dateTexte} » invalide (AAAA-MM-JJ)`);

  const mConf = contenu.match(/confiance\s*:\s*([^·_\n]+)/);
  analyse.confiance = mConf ? normaliser(mConf[1]) : '';
  if (!ref.confiances.includes(analyse.confiance)) {
    rapport.erreur(fichier, sAna.ligne, `indice de confiance « ${mConf ? mConf[1].trim() : ''} » invalide (${ref.confiances.join(' | ')})`);
  }

  if (!tCrit) {
    rapport.erreur(fichier, sAna.ligne, 'tableau des critères (colonnes critère, note, justification courte, sources) introuvable');
    return analyse;
  }
  for (const { cellules, ligne } of tCrit.lignes) {
    const id = nettoyerId(cellules[normaliser('critère')]);
    if (!ref.criteres.includes(id)) { rapport.erreur(fichier, ligne, `critère inconnu « ${id} »`); continue; }
    if (analyse.notes.has(id)) { rapport.erreur(fichier, ligne, `critère « ${id} » présent deux fois`); continue; }
    const note = parserNote(cellules.note);
    if (note === null || !Number.isInteger(note) || note < 1 || note > 5) {
      rapport.erreur(fichier, ligne, `critère « ${id} » : note « ${cellules.note} » invalide (entier de 1 à 5)`);
    } else analyse.notes.set(id, note);
    if (!cellules['justification courte']) rapport.erreur(fichier, ligne, `critère « ${id} » : justification manquante`);
  }
  for (const id of ref.criteres) {
    if (!tCrit.lignes.some((l) => nettoyerId(l.cellules[normaliser('critère')]) === id)) {
      rapport.erreur(fichier, sAna.ligne, `critère « ${id} » absent de l'analyse`);
    }
  }

  const mGlob = contenu.match(/###\s*Note globale\s*:\s*([^/\n]+)\/\s*5/);
  analyse.globale = mGlob ? parserNote(mGlob[1]) : null;
  if (analyse.globale === null || Number.isNaN(analyse.globale)) {
    rapport.erreur(fichier, sAna.ligne, 'note globale absente ou illisible (« ### Note globale : x / 5 »)');
  } else if (analyse.notes.size === ref.criteres.length) {
    const notes = [...analyse.notes.values()];
    const attendue = Math.round((notes.reduce((a, b) => a + b, 0) / notes.length) * 2) / 2;
    if (analyse.globale !== attendue) {
      rapport.erreur(fichier, sAna.ligne, `note globale ${String(analyse.globale).replace('.', ',')} incohérente : la moyenne arrondie au demi-point donne ${String(attendue).replace('.', ',')}`);
    }
  }

  const sous = lireSections(contenu, 3, sAna.ligne + 1);
  const pourquoi = sous.find((s) => normaliser(s.titre) === normaliser('Pourquoi cette note'));
  const texte = pourquoi ? pourquoi.contenu.replace(/<!--[\s\S]*?-->/g, '').trim() : '';
  if (!texte) rapport.erreur(fichier, sAna.ligne, 'section « ### Pourquoi cette note » absente ou vide');

  return analyse;
}

// ---------------------------------------------------------------------------
// Comparatifs
// ---------------------------------------------------------------------------

function validerComparatifFaisabilite(racine, fichier, fiches, rapport) {
  const { data, corps, decalage } = lireFrontmatter(lire(racine, fichier));
  const t = trouverTableau(lireTableaux(corps, decalage + 1), ['candidat', 'global', 'confiance', 'analysé le']);
  if (!t) { rapport.erreur(fichier, 1, 'tableau comparatif (colonnes candidat, …, global, confiance, analysé le) introuvable'); return; }
  const dateRef = data?.date_analyse;
  if (dateRef && !estDateIso(dateRef)) rapport.erreur(fichier, 1, `date_analyse « ${dateRef} » invalide`);

  const listes = new Set();
  for (const { cellules, ligne } of t.lignes) {
    const id = nettoyerId(cellules.candidat);
    const fiche = fiches.get(id);
    if (!fiche) { rapport.erreur(fichier, ligne, `candidat inconnu « ${id} » (pas de fiche candidats/${id}.md)`); continue; }
    listes.add(id);
    if (!fiche.analyse) { rapport.erreur(fichier, ligne, `« ${id} » figure au comparatif mais sa fiche n'a pas d'analyse datée`); continue; }
    for (const [critere, note] of fiche.analyse.notes) {
      const v = parserNote(cellules[normaliser(critere)]);
      if (v !== note) rapport.erreur(fichier, ligne, `« ${id} » ${critere} : ${cellules[normaliser(critere)] || 'vide'} au comparatif, ${note} dans la fiche`);
    }
    if (parserNote(cellules.global) !== fiche.analyse.globale) rapport.erreur(fichier, ligne, `« ${id} » : note globale différente de la fiche`);
    if (normaliser(cellules.confiance) !== fiche.analyse.confiance) rapport.erreur(fichier, ligne, `« ${id} » : confiance différente de la fiche`);
    if (cellules[normaliser('analysé le')] !== fiche.analyse.date) rapport.erreur(fichier, ligne, `« ${id} » : date d'analyse différente de la fiche`);
    if (dateRef && fiche.analyse.date !== String(dateRef)) rapport.avertissement(fichier, ligne, `« ${id} » analysé le ${fiche.analyse.date}, différent de date_analyse ${dateRef}`);
  }
  for (const [id, fiche] of fiches) {
    if (fiche.analyse && !listes.has(id)) rapport.avertissement(fichier, t.ligne, `« ${id} » a une analyse datée mais n'apparaît pas au comparatif`);
  }
}

function validerComparatifTheme(racine, fichier, ref, fiches, rapport) {
  const { data, corps, decalage, erreur } = lireFrontmatter(lire(racine, fichier));
  if (erreur || !data) { rapport.erreur(fichier, 1, 'frontmatter YAML absent ou illisible'); return; }
  const theme = data.theme;
  if (!ref.themes.has(theme)) { rapport.erreur(fichier, 1, `thème inconnu « ${theme} »`); return; }
  if (basename(fichier, '.md') !== theme) rapport.erreur(fichier, 1, `le fichier devrait s'appeler comparatifs/${theme}.md`);
  if (data.derniere_maj && !estDateIso(data.derniere_maj)) rapport.erreur(fichier, 1, 'derniere_maj invalide');

  const t = trouverTableau(lireTableaux(corps, decalage + 1), ['question']);
  if (!t) return;
  const candidats = t.cles.filter((c) => c !== 'question');
  for (const c of candidats) {
    if (!fiches.has(c)) rapport.erreur(fichier, t.ligne, `colonne « ${c} » : pas de fiche candidats/${c}.md`);
  }
  for (const { cellules, ligne } of t.lignes) {
    const id = nettoyerId(cellules.question);
    const q = ref.questions.get(id);
    if (!q) { rapport.erreur(fichier, ligne, `question inconnue « ${id} »`); continue; }
    if (q.theme !== theme) rapport.erreur(fichier, ligne, `question « ${id} » n'appartient pas au thème « ${theme} »`);
    for (const c of candidats) {
      const fiche = fiches.get(c);
      if (!fiche) continue;
      const attendu = fiche.positions.get(id) ?? '';
      if (normaliser(cellules[c]) !== normaliser(attendu)) {
        rapport.avertissement(fichier, ligne, `« ${id} » / ${c} : « ${cellules[c]} » ici, « ${attendu} » dans la fiche`);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

export function validerBase(racine) {
  const rapport = new Rapport();
  for (const f of ['referentiel/themes.md', 'referentiel/questions.md', 'referentiel/faisabilite.md', 'referentiel/dilemmes.md', 'referentiel/preoccupations.md', 'candidats/_modele.md']) {
    if (!existsSync(join(racine, f))) rapport.erreur(f, 1, 'fichier obligatoire manquant');
  }
  if (rapport.erreurs.length) return rapport;

  const ref = lireReferentiel(racine, rapport);

  // Le gabarit doit rester synchronisé avec le référentiel.
  validerFiche(racine, 'candidats/_modele.md', ref, rapport, { gabarit: true });

  const fiches = new Map();
  for (const f of listerMarkdown(racine, 'candidats')) {
    if (basename(f).startsWith('_')) continue;
    const fiche = validerFiche(racine, f, ref, rapport);
    fiches.set(fiche.id, fiche);
  }

  // Les analyses doivent être faites à la même date pour tous les candidats.
  const dates = new Set([...fiches.values()].filter((f) => f.analyse).map((f) => f.analyse.date));
  if (dates.size > 1) {
    rapport.avertissement('candidats', 1, `analyses de faisabilité à des dates différentes (${[...dates].sort().join(', ')}) : la comparaison n'est pas homogène`);
  }

  for (const f of listerMarkdown(racine, 'comparatifs')) {
    if (basename(f).startsWith('_')) continue;
    // Vues transversales générées par scripts/comparatifs.mjs, contrôlées par « npm run comparatifs -- --verifier ».
    if (['dilemmes.md', 'phares.md'].includes(basename(f))) continue;
    if (basename(f) === 'faisabilite.md') validerComparatifFaisabilite(racine, f, fiches, rapport);
    else validerComparatifTheme(racine, f, ref, fiches, rapport);
  }

  return rapport;
}
