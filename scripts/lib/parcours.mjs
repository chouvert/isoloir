// Étape 1 du parcours et son réglage facultatif : budget des thèmes à partir des sujets choisis
// (préoccupations) ou des réglettes, puis ordre dans lequel les dilemmes sont posés.
// Implémentation de la section 0 de referentiel/methode-proximite.md.
//
// Module sans dépendance ni accès disque, destiné au navigateur de l'utilisateur.
// Le tirage au sort est injectable (`aleatoire`) pour les tests.

export const PARCOURS = Object.freeze({
  maxPreoccupations: 3,
  totalPoints: 100,
  pointsPreoccupations: 40,   // le reste (60) est réparti à parts égales entre tous les thèmes
  partsPrincipal: 2,
  partsSecondaire: 1,
  niveauMax: 10,              // réglage facultatif : une réglette par thème, de 0 à 10
  pointsParCran: 3,           // position de départ d'une réglette : points / 3, plafonné à niveauMax
});

const PRECISION = 1e9;
const arrondiCalcul = (x) => Math.round(x * PRECISION) / PRECISION;

function lire(collection, cle) {
  if (!collection) return undefined;
  return collection instanceof Map ? collection.get(cle) : collection[cle];
}

function entrees(collection) {
  if (!collection) return [];
  return collection instanceof Map ? [...collection.entries()] : Object.entries(collection);
}

function verifierChoix(preoccupations, choisies) {
  if (choisies.length > PARCOURS.maxPreoccupations) {
    throw new Error(`au plus ${PARCOURS.maxPreoccupations} préoccupations (${choisies.length} choisies)`);
  }
  if (new Set(choisies).size !== choisies.length) throw new Error('préoccupation choisie deux fois');
  for (const id of choisies) {
    if (!lire(preoccupations, id)) throw new Error(`préoccupation inconnue « ${id} »`);
  }
}

/** Associe à chaque clé une valeur de tirage, fixée une fois pour tout un tri. */
function tirage(cles, aleatoire) {
  return new Map(cles.map((c) => [c, aleatoire()]));
}

/**
 * Arrondit des valeurs à l'entier en conservant leur total (méthode du plus fort reste).
 * Les égalités de reste sont départagées par tirage au sort.
 * @param {Map<string, number>} valeurs
 * @returns {Record<string, number>}
 */
export function arrondirPlusFortReste(valeurs, total, aleatoire = Math.random) {
  const cles = [...valeurs.keys()];
  const resultat = {};
  const restes = [];
  for (const [cle, v] of valeurs) {
    const exact = arrondiCalcul(v);
    resultat[cle] = Math.floor(exact);
    restes.push({ cle, reste: arrondiCalcul(exact - Math.floor(exact)) });
  }
  const sort = tirage(cles, aleatoire);
  restes.sort((a, b) => b.reste - a.reste || sort.get(a.cle) - sort.get(b.cle));
  let manquant = total - Object.values(resultat).reduce((s, v) => s + v, 0);
  for (const { cle } of restes) {
    if (manquant <= 0) break;
    resultat[cle]++;
    manquant--;
  }
  return resultat;
}

/** Parts de chaque thème d'après les sujets choisis : 2 pour le thème principal, 1 pour le secondaire. */
function partsThemes(themes, preoccupations, choisies) {
  const parts = new Map(themes.map((t) => [t, 0]));
  for (const id of choisies) {
    const p = lire(preoccupations, id);
    parts.set(p.principal, parts.get(p.principal) + PARCOURS.partsPrincipal);
    if (p.secondaire) parts.set(p.secondaire, parts.get(p.secondaire) + PARCOURS.partsSecondaire);
  }
  return { parts, totalParts: [...parts.values()].reduce((s, v) => s + v, 0) };
}

/**
 * Pré-remplit le budget de priorités à partir des préoccupations choisies.
 * @param {object} p
 * @param {string[]} p.themes          identifiants des thèmes, dans l'ordre du référentiel
 * @param {Map|object} p.preoccupations id -> { principal, secondaire }
 * @param {string[]} p.choisies        0 à 3 identifiants de préoccupations
 * @returns {Record<string, number>}   points entiers par thème, total 100
 */
export function preremplirBudget({ themes, preoccupations, choisies, aleatoire = Math.random }) {
  verifierChoix(preoccupations, choisies);

  const { parts, totalParts } = partsThemes(themes, preoccupations, choisies);

  const aRepartir = totalParts > 0 ? PARCOURS.pointsPreoccupations : 0;
  const base = (PARCOURS.totalPoints - aRepartir) / themes.length;
  const valeurs = new Map(themes.map((t) => [
    t, base + (totalParts > 0 ? (aRepartir * parts.get(t)) / totalParts : 0),
  ]));
  return arrondirPlusFortReste(valeurs, PARCOURS.totalPoints, aleatoire);
}

/**
 * Position de départ des réglettes du réglage facultatif, d'après un budget en points.
 * @param {Record<string, number>} points thème -> points
 * @returns {Record<string, number>}      thème -> niveau entier de 0 à 10
 */
export function niveauxDepuisBudget(points) {
  return Object.fromEntries(entrees(points).map(([t, p]) => [
    t, Math.min(PARCOURS.niveauMax, Math.round(Number(p) / PARCOURS.pointsParCran)),
  ]));
}

/**
 * Budget en points à partir des niveaux réglés par l'utilisateur : 100 × niveau / somme des niveaux,
 * arrondi par la méthode du plus fort reste.
 * @param {object} p
 * @param {Record<string, number>} p.niveaux thème -> niveau entier de 0 à 10
 * @returns {Record<string, number>}         points entiers par thème, total 100
 */
export function budgetDepuisNiveaux({ niveaux, aleatoire = Math.random }) {
  const liste = entrees(niveaux);
  for (const [t, n] of liste) {
    if (!Number.isInteger(n) || n < 0 || n > PARCOURS.niveauMax) {
      throw new Error(`niveau invalide pour « ${t} » : ${n} (entier de 0 à ${PARCOURS.niveauMax})`);
    }
  }
  const total = liste.reduce((s, [, n]) => s + n, 0);
  if (total === 0) throw new Error('aucun thème retenu');
  const valeurs = new Map(liste.map(([t, n]) => [t, (PARCOURS.totalPoints * n) / total]));
  return arrondirPlusFortReste(valeurs, PARCOURS.totalPoints, aleatoire);
}

/**
 * Combien de fois le thème le plus doté par les sujets choisis pèse plus qu'un thème non choisi.
 * Calculé sur les valeurs exactes du pré-remplissage (avant arrondi), arrondi à l'entier.
 * @returns {number|null} null sans sujet choisi
 */
export function rapportSujets({ themes, preoccupations, choisies }) {
  verifierChoix(preoccupations, choisies);
  const { parts, totalParts } = partsThemes(themes, preoccupations, choisies);
  if (totalParts === 0) return null;
  const base = (PARCOURS.totalPoints - PARCOURS.pointsPreoccupations) / themes.length;
  const max = base + (PARCOURS.pointsPreoccupations * Math.max(...parts.values())) / totalParts;
  return Math.round(arrondiCalcul(max / base));
}

/**
 * Ordre dans lequel poser les dilemmes.
 * @param {object} p
 * @param {Map|object} p.dilemmes       id -> { theme, statut }, dans l'ordre du référentiel
 * @param {Map|object} p.preoccupations id -> { dilemme }
 * @param {string[]} p.choisies         préoccupations, dans l'ordre où l'utilisateur les a choisies
 * @param {Map|object} p.points         budget validé : thème -> points
 * @returns {string[]} identifiants de dilemmes
 */
export function ordonnerDilemmes({ dilemmes, preoccupations, choisies, points, aleatoire = Math.random }) {
  verifierChoix(preoccupations, choisies);
  const actifs = entrees(dilemmes)
    .filter(([, d]) => (d.statut ?? 'actif') === 'actif')
    .filter(([, d]) => Number(lire(points, d.theme)) > 0);
  const posables = new Set(actifs.map(([id]) => id));

  const ordre = [];
  for (const id of choisies) {
    const d = lire(preoccupations, id).dilemme;
    if (d && posables.has(d) && !ordre.includes(d)) ordre.push(d);
  }

  const themes = [...new Set(actifs.map(([, d]) => d.theme))];
  const sort = tirage(themes, aleatoire);
  themes.sort((a, b) => Number(lire(points, b)) - Number(lire(points, a)) || sort.get(a) - sort.get(b));
  for (const theme of themes) {
    for (const [id, d] of actifs) {
      if (d.theme === theme && !ordre.includes(id)) ordre.push(id);
    }
  }
  return ordre;
}
