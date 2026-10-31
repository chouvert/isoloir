// Génération des comparatifs (Markdown) et de l'export de données (JSON) à partir du
// modèle produit par extraction.mjs. Fonctions pures : même base, même sortie, octet pour octet.

export const AVERTISSEMENT = '<!-- Fichier généré par `npm run comparatifs` à partir des fiches candidats : ne pas modifier à la main. -->';
export const FICHIER_DONNEES = 'donnees/base.json';

const SPECIALES = ['aucune', 'pas de position'];

/** Cellule de tableau Markdown : une seule ligne, sans barre verticale. */
function cel(valeur) {
  const v = String(valeur ?? '').replace(/\s*\n\s*/g, ' ').replace(/\|/g, '/').trim();
  return v === '' ? '—' : v;
}

function tableau(entetes, lignes) {
  return [
    `| ${entetes.join(' | ')} |`,
    `|${entetes.map(() => '---').join('|')}|`,
    ...lignes.map((l) => `| ${l.map(cel).join(' | ')} |`),
  ].join('\n');
}

/** Date la plus récente parmi les fiches : rend la sortie stable d'une exécution à l'autre. */
function derniereMaj(candidats) {
  return candidats.map((c) => c.derniere_maj).filter(Boolean).sort().at(-1) ?? '';
}

const lienFiche = (c, prefixe = '../candidats') => `[${c.nom}](${prefixe}/${c.id}.md)`;
const listeCandidats = (candidats) => `Candidats (${candidats.length}) : ${candidats.map((c) => lienFiche(c)).join(' · ')}.`;
const nomCourt = (c) => c.nom.split(' ').slice(1).join(' ') || c.nom;

function enTete(frontmatter, titre, intro = []) {
  const yaml = Object.entries(frontmatter).map(([k, v]) => `${k}: ${v ?? ''}`.trimEnd());
  return ['---', ...yaml, '---', '', AVERTISSEMENT, '', `# ${titre}`, '', ...intro].join('\n');
}

/** Bloc d'un dilemme : énoncé, puis chaque option avec les candidats qui la retiennent. */
function blocDilemme(d, candidats) {
  const choix = (option) => candidats.filter((c) => c.dilemmes[d.id]?.option === option).map(nomCourt);
  const lignes = [`### ${d.id}`, '', `> ${d.enonce}`, ''];
  for (const o of d.options) {
    const qui = choix(o.option);
    lignes.push(`- **${o.option}** — ${o.libelle} : ${qui.length ? qui.join(', ') : '—'}`);
  }
  for (const s of SPECIALES) {
    const qui = choix(s);
    if (qui.length) lignes.push(`- *${s}* : ${qui.join(', ')}`);
  }
  return lignes.join('\n');
}

const dilemmesActifs = (base, theme) => base.dilemmes.filter((d) => d.statut === 'actif' && (!theme || d.theme === theme));

function pageTheme(base, theme) {
  const { candidats } = base;
  const questions = base.questions.filter((q) => q.theme === theme.id && q.statut === 'actif');
  const dilemmes = dilemmesActifs(base, theme.id);
  const ids = candidats.map((c) => c.id);
  const parties = [enTete(
    { theme: theme.id, derniere_maj: derniereMaj(candidats) },
    `Comparatif — ${theme.libelle}`,
    [listeCandidats(candidats), '', 'Le détail et les sources de chaque position sont dans les fiches.', ''],
  )];

  parties.push('## Positions sur les questions-clés', '');
  parties.push(...questions.map((q) => `- **${q.id}** : ${q.question}`), '');
  parties.push(tableau(['question', ...ids], questions.map((q) => [q.id, ...candidats.map((c) => c.positions[q.id]?.position)])), '');

  if (dilemmes.length) {
    parties.push('## Dilemmes du thème', '');
    parties.push(tableau(['dilemme', ...ids], dilemmes.map((d) => [d.id, ...candidats.map((c) => c.dilemmes[d.id]?.option)])), '');
    parties.push(...dilemmes.map((d) => `${blocDilemme(d, candidats)}\n`));
  }

  const chiffrees = candidats.flatMap((c) => c.propositions
    .filter((p) => p.theme === theme.id && (p.chiffrage_annonce || p.chiffrage_independant))
    .map((p) => [c.nom, p.id, p.proposition, p.chiffrage_annonce, p.chiffrage_independant]));
  parties.push('## Coûts des propositions du thème', '');
  parties.push(chiffrees.length
    ? tableau(['candidat', 'id', 'proposition', 'chiffrage annoncé', 'chiffrage indépendant'], chiffrees)
    : 'Aucune proposition chiffrée dans les fiches.');
  return `${parties.join('\n').trimEnd()}\n`;
}

function pageDilemmes(base) {
  const { candidats } = base;
  const dilemmes = dilemmesActifs(base);
  const parties = [enTete(
    { derniere_maj: derniereMaj(candidats) },
    'Comparatif — Réponses aux dilemmes',
    [listeCandidats(candidats), '', 'Ces réponses alimentent le calcul de proximité (`referentiel/methode-proximite.md`). Justifications et sources : fiches candidats.', ''],
  )];
  parties.push('## Vue d\'ensemble', '');
  parties.push(tableau(['dilemme', ...candidats.map((c) => c.id)], dilemmes.map((d) => [d.id, ...candidats.map((c) => c.dilemmes[d.id]?.option)])), '');

  const compte = (c, valeur) => dilemmes.filter((d) => c.dilemmes[d.id]?.option === valeur).length;
  parties.push('## Couverture par candidat', '');
  parties.push(tableau(['candidat', 'option retenue', 'aucune', 'pas de position'], candidats.map((c) => {
    const pdp = compte(c, 'pas de position');
    const aucune = compte(c, 'aucune');
    return [c.nom, String(dilemmes.length - pdp - aucune), String(aucune), String(pdp)];
  })), '');

  for (const theme of base.themes) {
    const ds = dilemmes.filter((d) => d.theme === theme.id);
    if (!ds.length) continue;
    parties.push(`## ${theme.libelle}`, '', ...ds.map((d) => `${blocDilemme(d, candidats)}\n`));
  }
  return `${parties.join('\n').trimEnd()}\n`;
}

function pagePhares(base) {
  const { candidats } = base;
  const parties = [enTete(
    { derniere_maj: derniereMaj(candidats) },
    'Comparatif — Propositions phares',
    ['Règle de choix : README, « Propositions phares ». Motifs détaillés et sources : fiches candidats.', ''],
  )];
  for (const c of candidats) {
    parties.push(`## ${lienFiche(c)}`, '');
    if (!c.phares.length) { parties.push('Aucune proposition phare désignée.', ''); continue; }
    const props = new Map(c.propositions.map((p) => [p.id, p]));
    parties.push(tableau(['rang', 'id', 'proposition', 'motif'], c.phares.map((ph) => [
      String(ph.rang), ph.proposition, props.get(ph.proposition)?.proposition, ph.motif,
    ])), '');
  }
  return `${parties.join('\n').trimEnd()}\n`;
}

const noteFr = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));

function pageFaisabilite(base) {
  const analyses = base.candidats.filter((c) => c.faisabilite);
  const dates = [...new Set(analyses.map((c) => c.faisabilite.date))];
  const lignes = [
    '---',
    `date_analyse: ${dates.length === 1 ? dates[0] : ''}`.trimEnd(),
    '---',
    '',
    AVERTISSEMENT,
    '',
    '# Comparatif de faisabilité',
    '',
    'Notes reprises de la section « Analyse de faisabilité » de chaque fiche.',
    'Grille : `referentiel/faisabilite.md`.',
    '',
    tableau(['candidat', ...base.criteres, 'global', 'confiance', 'analysé le'], analyses.map((c) => [
      c.id,
      ...base.criteres.map((cr) => noteFr(c.faisabilite.notes[cr])),
      noteFr(c.faisabilite.globale),
      c.faisabilite.confiance,
      c.faisabilite.date,
    ])),
  ];
  return `${lignes.join('\n')}\n`;
}

/** Export JSON destiné à l'interface et au calcul de proximité. */
export function donnees(base) {
  return {
    format: 1,
    derniere_maj: derniereMaj(base.candidats),
    themes: base.themes,
    questions: base.questions,
    dilemmes: base.dilemmes,
    preoccupations: base.preoccupations,
    criteres_faisabilite: base.criteres,
    candidats: base.candidats,
  };
}

/** Tous les fichiers générés : Map chemin relatif → contenu. */
export function genererFichiers(base) {
  const fichiers = new Map();
  for (const theme of base.themes) fichiers.set(`comparatifs/${theme.id}.md`, pageTheme(base, theme));
  fichiers.set('comparatifs/dilemmes.md', pageDilemmes(base));
  fichiers.set('comparatifs/phares.md', pagePhares(base));
  fichiers.set('comparatifs/faisabilite.md', pageFaisabilite(base));
  fichiers.set(FICHIER_DONNEES, `${JSON.stringify(donnees(base), null, 2)}\n`);
  return fichiers;
}
