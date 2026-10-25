// Calcul de la proximité entre un utilisateur et les candidats.
// Implémentation de referentiel/methode-proximite.md.
//
// Module sans dépendance ni accès disque : il est destiné à tourner dans le navigateur
// de l'utilisateur, dont les réponses ne quittent jamais l'appareil.

export const SEUILS = Object.freeze({
  minReponses: 5,            // dilemmes répondus (hors « sans avis ») pour afficher un résultat
  couvertureComplete: 0.7,   // à partir de : score affiché normalement
  couvertureMinimale: 0.4,   // en dessous : pas de score
  ecartEgalite: 5,           // points d'écart en dessous desquels deux candidats sont à égalité
  minDuels: 3,               // duels comptés pour afficher la préférence à l'aveugle
});

export const SANS_AVIS = 'sans avis';
export const AUCUNE = 'aucune';
export const PAS_DE_POSITION = 'pas de position';

/** Accepte une Map ou un objet simple et renvoie ses entrées. */
function entrees(collection) {
  if (!collection) return [];
  return collection instanceof Map ? [...collection.entries()] : Object.entries(collection);
}

function lire(collection, cle) {
  if (!collection) return undefined;
  return collection instanceof Map ? collection.get(cle) : collection[cle];
}

function normaliserReponse(valeur) {
  const v = String(valeur ?? '').trim();
  if (/^[a-z]$/i.test(v)) return v.toUpperCase();
  return v.toLowerCase();
}

/** Vrai si l'utilisateur a réellement choisi une option. */
function estReponduParUtilisateur(valeur) {
  const v = normaliserReponse(valeur);
  return v !== '' && v !== SANS_AVIS;
}

/** Vrai si le candidat a une position exploitable (option ou « aucune »). */
function aUnePosition(valeur) {
  const v = normaliserReponse(valeur);
  return v !== '' && v !== PAS_DE_POSITION;
}

function sontVoisines(dilemme, a, b) {
  return (dilemme.voisines ?? []).some(([x, y]) => (x === a && y === b) || (x === b && y === a));
}

/**
 * Accord entre la réponse de l'utilisateur et celle d'un candidat sur un dilemme.
 * @returns {1|0.5|0|null} null si le dilemme est exclu du calcul
 */
export function accord(dilemme, reponseUtilisateur, reponseCandidat) {
  if (!estReponduParUtilisateur(reponseUtilisateur) || !aUnePosition(reponseCandidat)) return null;
  const u = normaliserReponse(reponseUtilisateur);
  const c = normaliserReponse(reponseCandidat);
  if (c === AUCUNE) return 0;
  if (u === c) return 1;
  return sontVoisines(dilemme, u, c) ? 0.5 : 0;
}

/**
 * Poids de chaque dilemme répondu : points du thème partagés entre les dilemmes
 * répondus de ce thème. Les thèmes à 0 point n'interviennent pas.
 * @returns {Map<string, number>}
 */
export function calculerPoids(dilemmes, pointsThemes, reponses) {
  const parTheme = new Map();
  for (const [id, valeur] of entrees(reponses)) {
    const d = lire(dilemmes, id);
    if (!d) throw new Error(`dilemme inconnu « ${id} »`);
    if (!estReponduParUtilisateur(valeur)) continue;
    const opt = normaliserReponse(valeur);
    if (!d.options.includes(opt)) throw new Error(`réponse « ${valeur} » invalide pour « ${id} »`);
    if (!(Number(lire(pointsThemes, d.theme)) > 0)) continue;
    if (!parTheme.has(d.theme)) parTheme.set(d.theme, []);
    parTheme.get(d.theme).push(id);
  }
  const poids = new Map();
  for (const [theme, ids] of parTheme) {
    const p = Number(lire(pointsThemes, theme)) / ids.length;
    for (const id of ids) poids.set(id, p);
  }
  return poids;
}

/** Score et couverture sur un ensemble de lignes de détail. */
function agreger(lignes) {
  const total = lignes.reduce((s, l) => s + l.poids, 0);
  const comptees = lignes.filter((l) => l.accord !== null);
  const couvert = comptees.reduce((s, l) => s + l.poids, 0);
  const points = comptees.reduce((s, l) => s + l.poids * l.accord, 0);
  const scoreBrut = couvert > 0 ? (points / couvert) * 100 : null;
  return {
    score: scoreBrut === null ? null : Math.round(scoreBrut),
    scoreBrut,
    couverture: total > 0 ? couvert / total : 0,
  };
}

function affichage(couverture) {
  if (couverture >= SEUILS.couvertureComplete) return 'complet';
  if (couverture >= SEUILS.couvertureMinimale) return 'incomplet';
  return 'insuffisant';
}

/**
 * Regroupe les candidats à égalité : rangés par score décroissant, chacun rejoint le groupe
 * courant s'il est à moins de `ecartEgalite` points du premier du groupe.
 * Dans un groupe, ordre alphabétique.
 */
export function grouperEgalites(resultats) {
  const tri = [...resultats].sort((a, b) => b.score - a.score || a.nom.localeCompare(b.nom, 'fr'));
  const groupes = [];
  for (const r of tri) {
    const courant = groupes[groupes.length - 1];
    if (courant && courant[0].score - r.score < SEUILS.ecartEgalite) courant.push(r);
    else groupes.push([r]);
  }
  return groupes.map((g) => g.sort((a, b) => a.nom.localeCompare(b.nom, 'fr')).map((r) => r.id));
}

/**
 * Calcule la proximité de l'utilisateur avec chaque candidat.
 *
 * @param {object} p
 * @param {Map|object} p.dilemmes      id -> { theme, options: string[], voisines: string[][] }
 * @param {Map|object} p.pointsThemes  id de thème -> points (budget de priorités)
 * @param {Map|object} p.reponses      id de dilemme -> option choisie ou « sans avis »
 *                                     (seuls les dilemmes posés y figurent)
 * @param {Array<{ id: string, nom: string, reponses: Map|object }>} p.candidats
 */
export function calculerProximite({ dilemmes, pointsThemes, reponses, candidats }) {
  const poids = calculerPoids(dilemmes, pointsThemes, reponses);
  const nbReponses = poids.size;
  if (nbReponses < SEUILS.minReponses) {
    return { suffisant: false, nbReponses, minimum: SEUILS.minReponses, candidats: [], groupes: [], sansScore: [] };
  }

  const resultats = candidats.map((c) => {
    const detail = [...poids].map(([id, p]) => {
      const d = lire(dilemmes, id);
      const repCandidat = normaliserReponse(lire(c.reponses, id));
      return {
        dilemme: id,
        theme: d.theme,
        poids: p,
        utilisateur: normaliserReponse(lire(reponses, id)),
        candidat: repCandidat || PAS_DE_POSITION,
        accord: accord(d, lire(reponses, id), repCandidat),
      };
    });

    const global = agreger(detail);
    const parTheme = {};
    for (const theme of new Set(detail.map((l) => l.theme))) {
      parTheme[theme] = agreger(detail.filter((l) => l.theme === theme));
    }

    const mode = affichage(global.couverture);
    return {
      id: c.id,
      nom: c.nom,
      score: mode === 'insuffisant' ? null : global.score,
      scoreBrut: mode === 'insuffisant' ? null : global.scoreBrut,
      couverture: global.couverture,
      affichage: mode,
      parTheme,
      detail,
    };
  });

  const avecScore = resultats.filter((r) => r.score !== null);
  return {
    suffisant: true,
    nbReponses,
    minimum: SEUILS.minReponses,
    candidats: resultats,
    groupes: grouperEgalites(avecScore),
    sansScore: resultats.filter((r) => r.score === null).map((r) => r.id).sort(),
  };
}

/**
 * Préférence à l'aveugle, indicateur séparé du score.
 * @param {Array<{ a: string, b: string, choix: 'a'|'b'|'aucune'|'les deux' }>} duels
 *        a et b sont les identifiants des candidats auteurs des deux propositions.
 * @returns {Record<string, { apparitions: number, preferee: number, taux: number|null }>}
 */
export function calculerPreferencesAveugle(duels) {
  const stats = {};
  const compter = (id) => (stats[id] ??= { apparitions: 0, preferee: 0, taux: null });
  for (const { a, b, choix } of duels) {
    if (choix !== 'a' && choix !== 'b') continue; // « aucune » et « les deux » ne comptent pas
    compter(a).apparitions++;
    compter(b).apparitions++;
    compter(choix === 'a' ? a : b).preferee++;
  }
  for (const s of Object.values(stats)) {
    s.taux = s.apparitions >= SEUILS.minDuels ? s.preferee / s.apparitions : null;
  }
  return stats;
}
