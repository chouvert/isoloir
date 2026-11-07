// Veille : lecture des flux et des pages d'actualités, tri, journal hebdomadaire.
// Fonctions pures (aucun accès réseau ni disque) sauf `collecter`, qui reçoit sa fonction de lecture.
// Spec : docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md
import { createHash } from 'node:crypto';

export const CLIENT = 'isoloir-veille';
export const AGENT = `${CLIENT} (+https://github.com/chouvert/isoloir)`;
export const MAX_CHAPO = 300;
export const SEUIL_MUETTE = 3;
export const CATEGORIES = ['campagne', 'parti', 'presse', 'sondages', 'institution'];
export const TYPES = ['rss', 'page', 'sitemap'];

const PARAMETRES_SUIVI = /^(utm_.*|fbclid|gclid|xtor|mc_cid|mc_eid)$/i;
const MOIS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

// ---------------------------------------------------------------------------
// Texte
// ---------------------------------------------------------------------------

function decoderEntites(s) {
  const noms = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return noms[e.toLowerCase()] ?? m;
  });
}

/** Texte brut d'un fragment XML ou HTML : sans CDATA, sans balises, entités décodées, espaces réduits. */
function texte(fragment = '') {
  const sansCdata = fragment.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
  const sansBalises = (s) => s.replace(/<[^>]*>/g, ' ');
  return sansBalises(decoderEntites(sansBalises(sansCdata))).replace(/\s+/g, ' ').trim();
}

function couper(s, max = MAX_CHAPO) {
  return s.length <= max ? s : `${s.slice(0, max - 1).trimEnd()}…`;
}

/** Minuscules sans accents, pour comparer des noms. */
function plier(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// Dates et identifiants
// ---------------------------------------------------------------------------

/** Date AAAA-MM-JJ d'un texte ISO 8601 ou RFC 822, ou null. La date est celle écrite dans le texte, sans conversion de fuseau. */
export function dateIso(valeur) {
  if (!valeur) return null;
  const s = String(valeur).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const rfc = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (rfc && MOIS[rfc[2].toLowerCase()]) {
    return `${rfc[3]}-${String(MOIS[rfc[2].toLowerCase()]).padStart(2, '0')}-${rfc[1].padStart(2, '0')}`;
  }
  return null;
}

/** Semaine ISO 8601 d'une date AAAA-MM-JJ, notée AAAA-Sxx. */
export function semaineIso(date) {
  const [a, m, j] = date.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour); // jeudi de la même semaine
  const annee = d.getUTCFullYear();
  const numero = Math.ceil(((d - Date.UTC(annee, 0, 1)) / 86400000 + 1) / 7);
  return `${annee}-S${String(numero).padStart(2, '0')}`;
}

/** URL sans paramètres de suivi, sans ancre, sans barre finale (sauf racine), hôte en minuscules. */
export function normaliserUrl(url) {
  const u = new URL(url);
  u.hash = '';
  for (const k of [...u.searchParams.keys()]) if (PARAMETRES_SUIVI.test(k)) u.searchParams.delete(k);
  if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, '');
  return u.toString();
}

/** Identifiant stable d'une information : AAAA-MM-JJ-<8 premiers caractères du SHA-1 de l'URL normalisée>. */
export function identifiant(date, url) {
  return `${date}-${createHash('sha1').update(normaliserUrl(url)).digest('hex').slice(0, 8)}`;
}

// ---------------------------------------------------------------------------
// Lecture des sources
// ---------------------------------------------------------------------------

const champ = (bloc, ...noms) => {
  for (const n of noms) {
    const m = bloc.match(new RegExp(`<${n}\\b[^>]*>([\\s\\S]*?)</${n}>`, 'i'));
    if (m) return m[1];
  }
  return '';
};

function lienAtom(bloc) {
  const liens = [...bloc.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1]);
  const alt = liens.find((a) => !/rel=["']/.test(a) || /rel=["']alternate["']/.test(a)) ?? liens[0];
  return alt?.match(/href=["']([^"']+)["']/)?.[1] ?? '';
}

/** Éléments d'un flux RSS 2.0 (`item`) ou Atom (`entry`). */
export function lireFlux(xml) {
  const blocs = [...xml.matchAll(/<(item|entry)\b[\s\S]*?<\/\1>/gi)];
  return blocs.map(([bloc, type]) => ({
    titre: texte(champ(bloc, 'title')),
    lien: type.toLowerCase() === 'entry' ? lienAtom(bloc) : texte(champ(bloc, 'link')),
    date: dateIso(texte(champ(bloc, 'pubDate', 'dc:date', 'published', 'updated'))),
    chapo: couper(texte(champ(bloc, 'description', 'summary', 'content'))),
  })).filter((e) => e.lien);
}

/** Entrées d'un plan de site (`url` avec `loc` et `lastmod`). */
export function lireSitemap(xml) {
  return [...xml.matchAll(/<url\b[\s\S]*?<\/url>/gi)].map(([bloc]) => {
    const lien = texte(champ(bloc, 'loc'));
    return { titre: lien, lien, date: dateIso(texte(champ(bloc, 'lastmod'))), chapo: '' };
  }).filter((e) => e.lien);
}

/** Liens d'une page d'actualités vers le même site (hors accueil et page elle-même), sans date. */
export function lirePage(html, urlPage) {
  const page = new URL(urlPage);
  const vus = new Set();
  const els = [];
  for (const [, href, contenu] of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u;
    try { u = new URL(decoderEntites(href), page); } catch { continue; }
    if (!/^https?:$/.test(u.protocol) || u.host !== page.host) continue;
    const lien = normaliserUrl(u.toString());
    if (u.pathname === '/' || lien === normaliserUrl(page.toString()) || vus.has(lien)) continue;
    const titre = texte(contenu);
    if (!titre) continue;
    vus.add(lien);
    els.push({ titre, lien: u.toString(), date: null, chapo: '' });
  }
  return els;
}

// ---------------------------------------------------------------------------
// Tri
// ---------------------------------------------------------------------------

/**
 * Candidats et mots-clés cités dans un texte. Noms complets ou alias déclarés, en mots entiers ;
 * un mot-clé correspond en début de mot (« primaire » trouve « primaires »). Insensible à la casse et aux accents.
 */
export function detecter(texteBrut, { candidats, motsCles }) {
  const t = plier(texteBrut);
  const borne = '(^|[^a-z0-9])';
  const trouves = [...candidats].filter(([, noms]) => noms
    .some((n) => new RegExp(`${borne}${echapper(plier(n))}($|[^a-z0-9])`).test(t))).map(([id]) => id);
  const mots = motsCles.filter((m) => new RegExp(`${borne}${echapper(plier(m))}`).test(t));
  return { candidats: trouves, motsCles: mots };
}

/** Le chemin est-il autorisé pour ce client par un robots.txt (groupes `isoloir-veille`, sinon `*`) ? */
export function autoriseParRobots(robots, chemin) {
  const groupes = [];
  let courant = null;
  let dansRegles = false;
  for (const brute of robots.split('\n')) {
    const l = brute.replace(/#.*$/, '').trim();
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const [cle, valeur] = [m[1].toLowerCase(), m[2].trim()];
    if (cle === 'user-agent') {
      if (!courant || dansRegles) { courant = { agents: [], interdits: [] }; groupes.push(courant); dansRegles = false; }
      courant.agents.push(valeur.toLowerCase());
    } else if (courant && (cle === 'disallow' || cle === 'allow')) {
      dansRegles = true;
      if (cle === 'disallow' && valeur) courant.interdits.push(valeur);
    }
  }
  const groupe = groupes.find((g) => g.agents.includes(CLIENT)) ?? groupes.find((g) => g.agents.includes('*'));
  return !groupe || !groupe.interdits.some((p) => chemin.startsWith(p));
}

/** Une information est gardée si elle vient d'un site de campagne ou de parti, ou si elle cite un candidat ou un mot-clé. */
export function retenir(element, source, detection) {
  return ['campagne', 'parti'].includes(source.categorie) || detection.candidats.length > 0 || detection.motsCles.length > 0;
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

/** Journal lisible d'une semaine : sources muettes, puis une section par candidat (ordre alphabétique), puis « transverse ». */
export function journalMarkdown(infos, { semaine, muettes = [] }) {
  const parties = [`# Veille — ${semaine}`, ''];
  if (muettes.length) {
    parties.push('## Sources muettes', '', ...muettes.map((m) => `- ${m.source} : muette depuis ${m.depuis ?? 'le premier passage'}`), '');
  }
  const groupes = new Map();
  for (const i of infos) {
    for (const c of i.candidats.length ? i.candidats : ['transverse']) {
      if (!groupes.has(c)) groupes.set(c, []);
      groupes.get(c).push(i);
    }
  }
  const cles = [...groupes.keys()].filter((c) => c !== 'transverse').sort();
  if (groupes.has('transverse')) cles.push('transverse');
  for (const c of cles) {
    parties.push(`## ${c}`, '');
    const lignes = groupes.get(c).sort((a, b) => b.date.localeCompare(a.date) || a.titre.localeCompare(b.titre));
    for (const i of lignes) parties.push(`- ${i.date} · [${i.titre.replace(/[[\]]/g, '')}](${i.lien}) · ${i.source}${i.chapo ? ` — ${i.chapo}` : ''}`);
    parties.push('');
  }
  if (!infos.length) parties.push('Aucune information cette semaine.', '');
  return `${parties.join('\n').trimEnd()}\n`;
}
