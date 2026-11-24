// Moyenne des sondages de premier tour, pour le rapport de la mise à jour hebdomadaire.
// Ces chiffres ne modifient aucune fiche ni aucun résultat de l'outil.
//
// Relevé : veille/sondages.json, liste cumulée (une entrée par sondage, une seule hypothèse) :
// { "institut", "commanditaire", "terrain": ["AAAA-MM-JJ", "AAAA-MM-JJ"], "publie": "AAAA-MM-JJ",
//   "echantillon": "1 501", "hypothese": "…", "lien": "https://…", "scores": { "Prénom Nom": 12.5, … } }

export const FICHIER_SONDAGES = 'veille/sondages.json';
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Erreurs de forme d'un relevé (liste de messages, vide si tout va bien). */
export function erreursReleve(releve) {
  if (!Array.isArray(releve)) return ['le relevé doit être une liste'];
  const erreurs = [];
  releve.forEach((s, i) => {
    const ou = `sondage ${i + 1}${s?.institut ? ` (${s.institut})` : ''}`;
    for (const champ of ['institut', 'commanditaire', 'echantillon', 'hypothese', 'lien']) {
      if (typeof s?.[champ] !== 'string' || !s[champ].trim()) erreurs.push(`${ou} : champ « ${champ} » manquant`);
    }
    if (typeof s?.lien === 'string' && !/^https?:\/\//.test(s.lien)) erreurs.push(`${ou} : lien « ${s.lien} » n'est pas une URL`);
    if (!DATE.test(s?.publie ?? '')) erreurs.push(`${ou} : date de publication « ${s?.publie ?? ''} » n'est pas AAAA-MM-JJ`);
    if (!Array.isArray(s?.terrain) || s.terrain.length !== 2 || !s.terrain.every((d) => DATE.test(d))) {
      erreurs.push(`${ou} : terrain doit être [début, fin] en AAAA-MM-JJ`);
    } else if (s.terrain[0] > s.terrain[1] || (DATE.test(s.publie ?? '') && s.terrain[1] > s.publie)) {
      erreurs.push(`${ou} : dates incohérentes (terrain ${s.terrain.join(' – ')}, publié ${s.publie})`);
    }
    const scores = Object.entries(s?.scores ?? {});
    if (!scores.length) erreurs.push(`${ou} : aucun score`);
    for (const [nom, v] of scores) {
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 100) erreurs.push(`${ou} : score de ${nom} invalide (${v})`);
    }
  });
  return erreurs;
}

function decaler(dateIso, jours) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

/** Arrondi au demi-point le plus proche. */
export const arrondiDemiPoint = (x) => Math.round(x * 2) / 2;

/**
 * Sondages publiés dans les `jours` derniers jours (bornes comprises) ; si aucun, fenêtre élargie à `repli` jours.
 * Renvoie { sondages, jours, elargi }.
 */
export function fenetre(releve, date, { jours = 30, repli = 60 } = {}) {
  for (const [j, elargi] of [[jours, false], [repli, true]]) {
    const debut = decaler(date, j);
    const sondages = releve.filter((s) => s.publie >= debut && s.publie <= date);
    if (sondages.length) return { sondages, jours: j, elargi };
  }
  return { sondages: [], jours: repli, elargi: true };
}

/** Moyenne simple par candidat, triée par moyenne décroissante puis par nom. */
export function moyennes(sondages) {
  const parCandidat = new Map();
  for (const s of sondages) {
    for (const [nom, v] of Object.entries(s.scores)) {
      const cle = nom.trim();
      if (!parCandidat.has(cle)) parCandidat.set(cle, []);
      parCandidat.get(cle).push(v);
    }
  }
  return [...parCandidat].map(([candidat, v]) => ({
    candidat,
    moyenne: arrondiDemiPoint(v.reduce((a, b) => a + b, 0) / v.length),
    nombre: v.length,
    partiel: v.length < sondages.length / 2,
  })).sort((a, b) => b.moyenne - a.moyenne || a.candidat.localeCompare(b.candidat, 'fr'));
}

const nombreFr = (x) => String(x).replace('.', ',');
const dateCourte = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;

/** Section « Sondages — moyenne » du corps de la PR et ligne du résumé final. */
export function rapportSondages(releve, date, options) {
  const { sondages, jours, elargi } = fenetre(releve, date, options);
  if (!sondages.length) {
    return { section: '## Sondages — moyenne\n\nAucun sondage trouvé.\n', resume: 'Sondages : aucun sondage trouvé' };
  }
  const tri = [...sondages].sort((a, b) => a.publie.localeCompare(b.publie));
  const premier = tri[0].publie;
  const dernier = tri[tri.length - 1].publie;
  const lignes = moyennes(tri);
  const n = tri.length;
  const s = n > 1 ? 's' : '';
  const out = ['## Sondages — moyenne', ''];
  out.push(`Moyenne simple de ${n} sondage${s} de premier tour publié${s} du ${dateCourte(premier)} au ${dateCourte(dernier)}`
    + ` (${elargi ? `aucun sur 30 jours : fenêtre élargie à ${jours} jours` : `${jours} derniers jours`}),`
    + ' une hypothèse par sondage, arrondie au demi-point.', '');
  out.push('| candidat | moyenne | sondages |', '|---|---|---|');
  for (const l of lignes) {
    out.push(`| ${l.candidat} | ${nombreFr(l.moyenne)} % | ${l.nombre}${l.partiel ? ` (testé dans ${l.nombre} sondage${l.nombre > 1 ? 's' : ''} seulement)` : ''} |`);
  }
  out.push('', 'Sondages utilisés :', '');
  for (const x of tri) {
    out.push(`- ${x.institut} pour ${x.commanditaire}, terrain du ${dateCourte(x.terrain[0])} au ${dateCourte(x.terrain[1])},`
      + ` ${x.echantillon} personnes, hypothèse retenue : ${x.hypothese} ([source](${x.lien}))`);
  }
  out.push('', 'Un sondage est une photographie à un instant donné, pas une prédiction. La liste se limite aux sondages'
    + ' accessibles en ligne. Ces chiffres ne modifient aucune fiche ni aucun résultat de l\'outil.', '');
  const resume = `Sondages (moyenne de ${n} sondage${s}, du ${dateCourte(premier)} au ${dateCourte(dernier)}) : `
    + lignes.map((l) => `${l.candidat} ${nombreFr(l.moyenne)} %`).join(', ');
  return { section: out.join('\n'), resume };
}
