// Étape 4 du parcours : tirage des duels à l'aveugle et indicateur de cohérence avec les dilemmes.
// Implémentation de la section 5 de referentiel/methode-proximite.md.
//
// Module sans dépendance ni accès disque, destiné au navigateur de l'utilisateur.
// Le tirage au sort est injectable (`aleatoire`) pour les tests.
import { SEUILS, SANS_AVIS } from './proximite.mjs';

export const DUELS = Object.freeze({ nombre: 6, maxApparitions: 2 });

const lire = (collection, cle) => (collection instanceof Map ? collection.get(cle) : collection?.[cle]);
const tirer = (liste, aleatoire) => liste[Math.min(liste.length - 1, Math.floor(aleatoire() * liste.length))];

const voisines = (dilemme, x, y) => (dilemme?.voisines ?? [])
  .some(([a, b]) => (a === x && b === y) || (a === y && b === x));

/**
 * Choisit les duels : les premiers dilemmes éligibles, dans l'ordre où ils ont été posés.
 * @param {object} p
 * @param {Map|object} p.dilemmes      id -> { voisines: string[][] }
 * @param {string[]} p.ordre           dilemmes dans l'ordre où ils ont été posés
 * @param {Map|object} p.reponses      id -> option choisie ou « sans avis »
 * @param {object} p.participants      id -> option -> [{ candidat, proposition, texte }] (base.json, duels.participants)
 * @returns {{ duels: Array<{ dilemme, optionUtilisateur, gauche, droite }>, eligibles: number }}
 */
export function preparerDuels({ dilemmes, ordre, reponses, participants, aleatoire = Math.random }) {
  const apparitions = new Map();
  const disponible = (p) => (apparitions.get(p.candidat) ?? 0) < DUELS.maxApparitions;
  const duels = [];
  let eligibles = 0;

  for (const id of ordre) {
    const x = lire(reponses, id);
    const parOption = participants?.[id];
    if (!x || x === SANS_AVIS || !parOption?.[x]?.length) continue;
    const autres = Object.keys(parOption).filter((o) => o !== x);
    const avec = (options) => options.flatMap((o) => parOption[o].map((p) => ({ ...p, option: o })));
    const nonVoisins = avec(autres.filter((o) => !voisines(lire(dilemmes, id), x, o)));
    const adversaires = nonVoisins.length ? nonVoisins : avec(autres);
    if (!adversaires.length) continue;
    eligibles++;
    if (duels.length >= DUELS.nombre) continue;

    const cote = parOption[x].map((p) => ({ ...p, option: x })).filter(disponible);
    const contre = adversaires.filter(disponible);
    if (!cote.length || !contre.length) continue;
    const utilisateur = { ...tirer(cote, aleatoire), utilisateur: true };
    const adversaire = { ...tirer(contre, aleatoire), utilisateur: false };
    for (const p of [utilisateur, adversaire]) apparitions.set(p.candidat, (apparitions.get(p.candidat) ?? 0) + 1);
    const aGauche = aleatoire() < 0.5;
    const cotes = (p) => ({ candidat: p.candidat, option: p.option, proposition: p.proposition, texte: p.texte, utilisateur: p.utilisateur });
    duels.push({
      dilemme: id,
      optionUtilisateur: x,
      gauche: cotes(aGauche ? utilisateur : adversaire),
      droite: cotes(aGauche ? adversaire : utilisateur),
    });
  }
  return { duels, eligibles };
}

/**
 * Indicateur de cohérence : un duel est cohérent si l'utilisateur préfère la mesure rattachée
 * à l'option qu'il a choisie au dilemme, un écart s'il préfère l'autre.
 * @param {Array} duels   résultat de preparerDuels
 * @param {Array<'gauche'|'droite'|'aucune'|'les deux'>} choix  une réponse par duel
 */
export function evaluerDuels(duels, choix) {
  const details = duels.map((d, i) => {
    const c = choix[i];
    const statut = c === 'gauche' || c === 'droite' ? (d[c].utilisateur ? 'cohérent' : 'écart') : 'non compté';
    return { dilemme: d.dilemme, statut };
  });
  const coherents = details.filter((d) => d.statut === 'cohérent').length;
  const comptes = details.filter((d) => d.statut !== 'non compté').length;
  return { details, coherents, comptes, taux: comptes >= SEUILS.minDuels ? coherents / comptes : null };
}
