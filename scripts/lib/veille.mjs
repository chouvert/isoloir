// Veille : lecture des flux et des pages d'actualités, tri, journal hebdomadaire.
// Fonctions pures (aucun accès réseau ni disque) sauf `collecter`, qui reçoit sa fonction de lecture.
// Spec : docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md
import { createHash } from 'node:crypto';

export const CLIENT = 'isoloir-veille';
export const AGENT = `${CLIENT} (+https://github.com/chouvert/isoloir)`;
export const MAX_CHAPO = 300;
export const SEUIL_MUETTE = 3;
export const CATEGORIES = ['campagne', 'parti', 'presse', 'sondages', 'institution'];
export const TYPES = ['rss', 'page', 'sitemap', 'programme'];

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

const sansWww = (hote) => hote.replace(/^www\./, '');

const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// ---------------------------------------------------------------------------
// Dates et identifiants
// ---------------------------------------------------------------------------

/** Date AAAA-MM-JJ d'un texte ISO 8601 ou RFC 822, ou null. La date est celle écrite dans le texte, sans conversion de fuseau. */
export function dateIso(valeur) {
  if (!valeur) return null;
  const s = String(valeur).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return dateValide(+iso[1], +iso[2], +iso[3]);
  const rfc = s.match(/(\d{1,2})\s+([A-Za-z]{3})[a-z]*\s+(\d{4})/);
  if (rfc && MOIS[rfc[2].toLowerCase()]) return dateValide(+rfc[3], MOIS[rfc[2].toLowerCase()], +rfc[1]);
  return null;
}

/** AAAA-MM-JJ si la date existe et n'est pas une valeur par défaut (année < 2000), sinon null. */
function dateValide(a, m, j) {
  const d = new Date(Date.UTC(a, m - 1, j));
  if (a < 2000 || d.getUTCFullYear() !== a || d.getUTCMonth() !== m - 1 || d.getUTCDate() !== j) return null;
  return `${a}-${String(m).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
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
    if (!/^https?:$/.test(u.protocol) || sansWww(u.host) !== sansWww(page.host)) continue;
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
// Programmes : empreinte des pages
// Spec : docs/superpowers/specs/2026-11-15-suivi-programmes-design.md
// ---------------------------------------------------------------------------

export const MAX_PAGES_PROGRAMME = 120;
export const PROFONDEUR_PROGRAMME = 3;
export const MIN_BLOC = 20;
export const LONGUEUR_CODE = 10;

const HORS_TEXTE = ['script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside', 'form'];
// Ouverture ou fermeture de ces éléments : fin du bloc en cours.
const COUPURES = /<\/?(p|li|h[1-6]|td|th|blockquote|dd|dt|div|section|article|main|ul|ol|dl|table|tr|tbody|thead|figure|figcaption)\b[^>]*>/gi;

const contenu = (html, balise) => html.match(new RegExp(`<${balise}\\b[^>]*>([\\s\\S]*)</${balise}>`, 'i'))?.[1];

/** Texte lisible de chaque bloc de la partie utile d'une page (main, sinon article, sinon body), dans l'ordre. */
export function blocsDeTexte(html = '') {
  let utile = html.replace(/<!--[\s\S]*?-->/g, ' ');
  utile = contenu(utile, 'main') ?? contenu(utile, 'article') ?? contenu(utile, 'body') ?? utile;
  for (const b of HORS_TEXTE) utile = utile.replace(new RegExp(`<${b}\\b[\\s\\S]*?</${b}>`, 'gi'), ' ');
  return utile.split(COUPURES).filter((_, i) => i % 2 === 0) // split capture le nom de balise aux indices impairs
    .map((s) => texte(s)).filter((s) => s.length >= MIN_BLOC);
}

/** Code d'un bloc : 10 premiers caractères hexadécimaux du SHA-1 du texte plié (casse, accents, espaces). */
function codeDeBloc(bloc) {
  return createHash('sha1').update(plier(bloc).replace(/\s+/g, ' ').trim()).digest('hex').slice(0, LONGUEUR_CODE);
}

/** Empreinte d'une page : ensemble des codes de ses blocs, triés. */
export function codesDeBlocs(blocs) {
  return [...new Set(blocs.map(codeDeBloc))].sort();
}

/** Blocs ajoutés et retirés ; `premierAjoute` : indice dans `apres` du premier code absent de `avant`, ou -1. */
export function comparerCodes(avant, apres) {
  const a = new Set(avant);
  const b = new Set(apres);
  return {
    ajoutes: [...b].filter((c) => !a.has(c)).length,
    retires: [...a].filter((c) => !b.has(c)).length,
    premierAjoute: apres.findIndex((c) => !a.has(c)),
  };
}

/** Titre d'une page : `<title>`, sinon premier `h1`, sinon l'adresse. */
export function titreDePage(html, url) {
  return texte(contenuCourt(html, 'title')) || texte(contenuCourt(html, 'h1')) || url;
}

const contenuCourt = (html, balise) => html.match(new RegExp(`<${balise}\\b[^>]*>([\\s\\S]*?)</${balise}>`, 'i'))?.[1] ?? '';

/** L'adresse est-elle sur le même site que `base` et sous un des préfixes (le dossier lui-même compris) ? */
function sousPrefixes(u, base, prefixes) {
  if (!/^https?:$/.test(u.protocol) || sansWww(u.host) !== sansWww(base.host)) return false;
  const chemin = u.pathname.endsWith('/') ? u.pathname : `${u.pathname}/`;
  return prefixes.some((p) => chemin.startsWith(p.endsWith('/') ? p : `${p}/`) || u.pathname.startsWith(p));
}

/** Liens d'une page vers le même site sous un des préfixes : adresses normalisées, sans doublon, dans l'ordre. */
export function liensProgramme(html, urlPage, prefixes) {
  const page = new URL(urlPage);
  const soi = normaliserUrl(page.toString());
  const liens = [];
  for (const [, href] of html.replace(/<!--[\s\S]*?-->/g, ' ').matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)) {
    let u;
    try { u = new URL(decoderEntites(href), page); } catch { continue; }
    if (prefixes ? !sousPrefixes(u, page, prefixes) : (!/^https?:$/.test(u.protocol) || sansWww(u.host) !== sansWww(page.host))) continue;
    const lien = normaliserUrl(u.toString());
    if (new URL(lien).search) continue; // vue filtrée d'une page déjà suivie
    if (lien !== soi && !liens.includes(lien)) liens.push(lien);
  }
  return liens;
}

function nomDeFichier(url) {
  const nom = new URL(url).pathname.split('/').pop();
  try { return decodeURIComponent(nom); } catch { return nom; }
}

const estPdf = (url) => /\.pdf$/i.test(new URL(url).pathname);

/** Préfixes d'une source : champ `prefixes`, sinon le dossier du point d'entrée. */
function prefixesDe(source) {
  if (Array.isArray(source.prefixes) && source.prefixes.length) return source.prefixes;
  const chemin = new URL(source.url).pathname;
  return [chemin.slice(0, chemin.lastIndexOf('/') + 1) || '/'];
}

/**
 * Suit les pages d'un programme et compare leur empreinte à celle du passage précédent.
 * `lire(url)` → { statut, texte, url? } ; `lireEntete(url)` → { statut, etag, modifie, taille } (PDF) ;
 * `autorise(url)` → booléen (robots.txt). `empreintes` : toutes les sources ; seules celles de `source.id` sont touchées.
 * Rend { infos: [{ nature, titre, lien, chapo }], empreintes, succes, plafond, pages, refusees }.
 */
export async function suivreProgramme({ source, empreintes = {}, lire, lireEntete, autorise, jour, maxPages: maxGeneral = MAX_PAGES_PROGRAMME, plafondSignale = false }) {
  const prefixes = prefixesDe(source);
  const maxPages = Number.isInteger(source.max_pages) && source.max_pages > 0 ? source.max_pages : maxGeneral;
  // Textes changeants sans rapport avec le programme (compteurs, encarts d'actualité) : blocs retirés avant l'empreinte.
  const ignores = (Array.isArray(source.ignorer) ? source.ignorer : []).map((m) => new RegExp(m, 'iu'));
  const entree = normaliserUrl(source.url);
  const base = new URL(source.url);
  const anciennes = Object.fromEntries(Object.entries(empreintes).filter(([, e]) => e.source === source.id));
  const premierPassage = Object.keys(anciennes).length === 0;
  const echec = (statut) => ({ infos: [], empreintes, succes: false, plafond: false, pages: [{ url: entree, statut, blocs: 0 }], refusees: [], horsPrefixes: [] });
  let horsPrefixes = [];

  const file = [{ url: entree, profondeur: 0, brute: source.url }];
  const connues = new Set([entree]);
  const lues = new Map(); // url → { titre, blocs, premier } pour les pages lues avec succès
  const enErreur = new Set();
  const pages = [];
  const refusees = [];
  let plafond = null;
  let planAjoute = !source.plan;

  const ajouter = (url, profondeur) => {
    if (connues.has(url)) return;
    connues.add(url);
    file.push({ url, profondeur });
  };

  while (file.length) {
    const { url, profondeur, brute } = file.shift();
    if (pages.length >= maxPages) { plafond = url; break; }
    if (!(await autorise(url))) {
      if (url === entree) return { ...echec('robots.txt'), refusees: [url] };
      refusees.push(url);
      continue;
    }
    if (estPdf(url)) {
      let r;
      try { r = lireEntete ? await lireEntete(url) : { statut: 0 }; } catch { r = { statut: 0 }; }
      pages.push({ url, statut: r.statut, blocs: 0 });
      if (r.statut !== 200) { enErreur.add(url); continue; }
      const empreinte = [r.etag, r.modifie, r.taille].filter(Boolean).join('|');
      const code = empreinte ? createHash('sha1').update(empreinte).digest('hex').slice(0, LONGUEUR_CODE) : null;
      lues.set(url, { titre: nomDeFichier(url), blocs: code ? [code] : [], premier: '', pdf: true });
      continue;
    }
    const r = await lire(brute ?? url);
    if (r.statut !== 200) {
      if (url === entree) return echec(r.statut);
      pages.push({ url, statut: r.statut, blocs: 0 });
      enErreur.add(url);
      continue;
    }
    const blocs = blocsDeTexte(r.texte).filter((b) => !ignores.some((m) => m.test(b)));
    pages.push({ url, statut: 200, blocs: blocs.length });
    lues.set(url, { titre: titreDePage(r.texte, url), blocsOrdonnes: blocs, blocs: codesDeBlocs(blocs) });
    if (url === entree) {
      const sous = new Set(liensProgramme(r.texte, r.url ?? url, prefixes));
      horsPrefixes = liensProgramme(r.texte, r.url ?? url, null).filter((l) => !sous.has(l)).slice(0, 30);
    }
    if (profondeur < PROFONDEUR_PROGRAMME) {
      for (const lien of liensProgramme(r.texte, r.url ?? url, prefixes)) ajouter(lien, profondeur + 1);
    }
    if (!planAjoute) {
      planAjoute = true;
      if (await autorise(source.plan)) {
        const p = await lire(source.plan);
        if (p.statut === 200) {
          for (const el of lireSitemap(p.texte)) {
            let u;
            try { u = new URL(el.lien); } catch { continue; }
            if (sousPrefixes(u, base, prefixes)) ajouter(normaliserUrl(u.toString()), 1);
          }
        }
      }
    }
  }

  // Un bloc présent sur plusieurs pages de la source (encadré, résumé d'une mesure repris sur une liste) n'appartient
  // à aucune : ses changements sont comptés une seule fois pour la source, pas page par page.
  const frequence = (ensembles) => {
    const f = new Map();
    for (const codes of ensembles) for (const c of new Set(codes)) f.set(c, (f.get(c) ?? 0) + 1);
    return f;
  };
  const textes = [...lues.values()].filter((p) => !p.pdf);
  const fAvant = frequence(Object.values(anciennes).map((e) => e.blocs));
  const fApres = frequence(textes.map((p) => p.blocs));
  const propre = (f, c) => (f.get(c) ?? 0) <= 1;

  const infos = [];
  const modifiees = [];
  const nouvelles = { ...empreintes };
  const codesNouvellesPages = new Set();
  for (const [url, page] of lues) {
    const avant = anciennes[url];
    if (!premierPassage && !avant) {
      for (const c of page.blocs) codesNouvellesPages.add(c);
      infos.push({ nature: 'programme-nouveau', titre: `Programme : page nouvelle — ${page.titre}`, lien: url,
        chapo: couper(page.blocsOrdonnes?.[0] ?? '') });
    } else if (avant && !page.pdf) {
      const ordonnes = page.blocsOrdonnes.map(codeDeBloc);
      // Ajouté : bloc propre à la page, absent hier. Retiré : bloc propre à la page hier, absent aujourd'hui.
      const ajoutes = [...new Set(page.blocsOrdonnes.filter((_, i) => propre(fApres, ordonnes[i]) && !avant.blocs.includes(ordonnes[i])))];
      const d = { ajoutes: new Set(ajoutes.map(codeDeBloc)).size,
        retires: avant.blocs.filter((c) => propre(fAvant, c) && !page.blocs.includes(c)).length };
      if (d.ajoutes || d.retires) {
        modifiees.push({ url, ajoutes: ajoutes.map((b) => couper(b, 150)), retires: d.retires });
        const debut = ajoutes.length ? ` · ${ajoutes[0]}` : '';
        infos.push({ nature: 'programme-modifie', titre: `Programme : page modifiée — ${page.titre}`, lien: url,
          chapo: couper(`+${d.ajoutes} / −${d.retires} blocs${debut}`) });
      }
    } else if (avant && page.pdf && avant.blocs.length && page.blocs.length && avant.blocs[0] !== page.blocs[0]) {
      infos.push({ nature: 'programme-modifie', titre: `Programme : page modifiée — ${page.titre}`, lien: url,
        chapo: 'Document modifié (en-têtes etag, last-modified ou content-length).' });
    }
    // Un PDF devenu muet garde son ancienne empreinte : il ne sera pas signalé à tort au retour de ses en-têtes.
    const blocs = page.pdf && !page.blocs.length && avant ? avant.blocs : page.blocs;
    nouvelles[url] = { source: source.id, titre: page.titre, blocs, vu: jour, absences: 0 };
  }

  // Blocs communs apparus ou disparus de toute la source (hors pages nouvelles, déjà signalées).
  if (!premierPassage) {
    const tousAvant = new Set(fAvant.keys());
    const tousApres = new Set(fApres.keys());
    const lus = new Set([...lues.keys()]);
    const communsAjoutes = [];
    for (const p of textes) {
      p.blocsOrdonnes.forEach((b) => {
        const c = codeDeBloc(b);
        if (!propre(fApres, c) && !tousAvant.has(c) && !codesNouvellesPages.has(c) && !communsAjoutes.some((x) => x.c === c)) communsAjoutes.push({ c, b });
      });
    }
    // Un bloc commun disparu ne compte que si toutes les pages qui le portaient ont été relues.
    const communsRetires = [...fAvant.keys()].filter((c) => !propre(fAvant, c) && !tousApres.has(c)
      && Object.entries(anciennes).every(([u, e]) => !e.blocs.includes(c) || lus.has(u)));
    if (communsAjoutes.length || communsRetires.length) {
      modifiees.push({ url: entree, ajoutes: communsAjoutes.map((x) => couper(x.b, 150)), retires: communsRetires.length, communs: true });
      const debut = communsAjoutes.length ? ` · ${communsAjoutes[0].b}` : '';
      infos.push({ nature: 'programme-communs', titre: `Programme : blocs communs modifiés — ${source.nom ?? source.id}`, lien: entree,
        chapo: couper(`+${communsAjoutes.length} / −${communsRetires.length} blocs communs${debut}`) });
    }
  }
  for (const [url, avant] of Object.entries(anciennes)) {
    if (lues.has(url)) continue;
    // Page non atteinte faute de place sous le plafond : ni présente ni absente.
    if (plafond && !enErreur.has(url) && !refusees.includes(url)) continue;
    const absences = (avant.absences ?? 0) + 1;
    if (absences >= SEUIL_MUETTE) {
      delete nouvelles[url];
      infos.push({ nature: 'programme-retire', titre: `Programme : page retirée — ${avant.titre}`, lien: url,
        chapo: `Dernière lecture réussie : ${avant.vu}.` });
    } else {
      nouvelles[url] = { ...avant, absences };
    }
  }
  if (premierPassage) {
    infos.length = 0;
    infos.push({ nature: 'programme-suivi', titre: `Programme : suivi commencé — ${source.nom ?? source.id}`, lien: entree,
      chapo: `${lues.size} pages suivies.` });
  }
  if (plafond && !plafondSignale) {
    infos.push({ nature: 'programme-plafond', titre: `Programme : plafond de pages atteint — ${source.nom ?? source.id}`,
      lien: plafond, chapo: `${maxPages} pages lues ; revoir le plafond ou les préfixes de la source.` });
  }
  return { infos, empreintes: nouvelles, succes: true, plafond: Boolean(plafond), pages, refusees, horsPrefixes, modifiees };
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
      if (!courant || dansRegles) { courant = { agents: [], regles: [] }; groupes.push(courant); dansRegles = false; }
      courant.agents.push(valeur.toLowerCase());
    } else if (courant && (cle === 'disallow' || cle === 'allow')) {
      dansRegles = true;
      if (valeur) courant.regles.push({ autorise: cle === 'allow', prefixe: valeur });
    }
  }
  const groupe = groupes.find((g) => g.agents.includes(CLIENT)) ?? groupes.find((g) => g.agents.includes('*'));
  if (!groupe) return true;
  // Règle la plus longue qui s'applique ; à longueur égale, Allow l'emporte.
  const regle = groupe.regles.filter((r) => chemin.startsWith(r.prefixe))
    .sort((x, y) => y.prefixe.length - x.prefixe.length || Number(y.autorise) - Number(x.autorise))[0];
  return !regle || regle.autorise;
}

/** Catégories gardées sans filtre : tout ce qu'elles publient concerne la campagne. */
export const SANS_FILTRE = ['campagne', 'parti', 'sondages'];

/** Une information est gardée si sa source est sans filtre, ou si elle cite un candidat ou un mot-clé. */
export function retenir(element, source, detection) {
  return SANS_FILTRE.includes(source.categorie) || detection.candidats.length > 0 || detection.motsCles.length > 0;
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

const estProgramme = (info) => typeof info.nature === 'string' && info.nature.startsWith('programme-');

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
    const lignes = groupes.get(c).sort((a, b) => Number(estProgramme(b)) - Number(estProgramme(a))
      || b.date.localeCompare(a.date) || a.titre.localeCompare(b.titre));
    for (const i of lignes) parties.push(`- ${estProgramme(i) ? '**Programme** · ' : ''}${i.date} · [${i.titre.replace(/[[\]]/g, '')}](${i.lien}) · ${i.source}${i.chapo ? ` — ${i.chapo}` : ''}`);
    parties.push('');
  }
  if (!infos.length) parties.push('Aucune information cette semaine.', '');
  return `${parties.join('\n').trimEnd()}\n`;
}

// ---------------------------------------------------------------------------
// Collecte
// ---------------------------------------------------------------------------

/** Les éléments datés de plus de FENETRE_JOURS avant la collecte sont écartés (premier passage sur un plan de site, archives). */
export const FENETRE_JOURS = 14;

const LECTEURS = { rss: (t) => lireFlux(t), sitemap: (t) => lireSitemap(t), page: (t, url) => lirePage(t, url) };

function joursEntre(a, b) {
  return (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000;
}

/**
 * Lit les sources l'une après l'autre et renvoie les nouvelles informations retenues.
 * `lireUrl(url)` → Promise<{ statut, texte }> est injecté (fetch réel dans scripts/veille.mjs).
 * Échec d'une source : erreur réseau, statut ≠ 200, robots.txt qui l'interdit, ou aucun élément lisible.
 */
export async function collecter({
  sources, candidats, motsCles, etat, vus, lireUrl, maintenant, attendre = async () => {},
  empreintes = {}, lireEntete, maxPagesProgramme = MAX_PAGES_PROGRAMME,
}) {
  const jour = typeof maintenant === 'string' ? maintenant : maintenant.toISOString().slice(0, 10);
  const semaine = semaineIso(jour);
  const nouvelEtat = { ...etat };
  const dejaVus = new Set(vus);
  const robots = new Map();
  const infos = [];
  const programmes = {};
  let nouvellesEmpreintes = { ...empreintes };

  const lire = async (url) => {
    await attendre();
    try { return await lireUrl(url); } catch { return { statut: 0, texte: '' }; }
  };
  const echec = (id) => {
    const avant = nouvelEtat[id] ?? { dernierSucces: null, echecs: 0 };
    nouvelEtat[id] = { dernierSucces: avant.dernierSucces, echecs: avant.echecs + 1 };
  };

  const autorise = async (adresse) => {
    const u = new URL(adresse);
    if (!robots.has(u.origin)) {
      const r = await lire(`${u.origin}/robots.txt`);
      robots.set(u.origin, r.statut === 200 ? r.texte : '');
    }
    return autoriseParRobots(robots.get(u.origin), u.pathname);
  };
  const lireEnTete = lireEntete && (async (url) => {
    await attendre();
    try { return await lireEntete(url); } catch { return { statut: 0 }; }
  });

  for (const source of sources) {
    if (source.type === 'programme') {
      const precedent = nouvelEtat[source.id];
      const suivi = await suivreProgramme({ source, empreintes: nouvellesEmpreintes, lire, lireEntete: lireEnTete, autorise, jour,
        maxPages: maxPagesProgramme, plafondSignale: precedent?.plafond === semaine });
      programmes[source.id] = { pages: suivi.pages, refusees: suivi.refusees, horsPrefixes: suivi.horsPrefixes, modifiees: suivi.modifiees ?? [] };
      if (!suivi.succes) { echec(source.id); continue; }
      nouvellesEmpreintes = suivi.empreintes;
      const plafond = suivi.plafond && precedent?.plafond !== semaine ? semaine : precedent?.plafond;
      nouvelEtat[source.id] = { dernierSucces: jour, echecs: 0, ...(plafond ? { plafond } : {}) };
      const propres = Array.isArray(source.candidats) ? [...source.candidats].sort() : [];
      for (const i of suivi.infos) {
        dejaVus.add(i.lien);
        infos.push({
          id: identifiant(jour, i.lien), semaine, source: source.id, categorie: source.categorie, date: jour, collecte: jour,
          titre: i.titre, lien: i.lien, chapo: i.chapo, candidats: propres, motsCles: [], nature: i.nature,
        });
      }
      continue;
    }
    if (!(await autorise(source.url))) { echec(source.id); continue; }

    const reponse = await lire(source.url);
    const elements = reponse.statut === 200 ? LECTEURS[source.type](reponse.texte, reponse.url ?? source.url) : [];
    const motifs = Array.isArray(source.motifs) && source.motifs.length ? source.motifs.map(plier) : null;
    if (motifs && !elements.length) programmes[source.id] = { statut: reponse.statut, adresses: 0, correspondantes: [] };
    if (!elements.length) { echec(source.id); continue; }
    const sousMotif = (lien) => { try { return motifs.some((m) => plier(new URL(lien).pathname).includes(m)); } catch { return false; } };
    if (motifs) programmes[source.id] = { adresses: elements.length, correspondantes: elements.map((e) => e.lien).filter(sousMotif) };
    // Premier succès d'une page ou d'un plan de site : tout ce qui s'y trouve déjà (menus, archives) est marqué vu.
    const etalonnage = source.type !== 'rss' && !nouvelEtat[source.id]?.dernierSucces;
    nouvelEtat[source.id] = { dernierSucces: jour, echecs: 0 };
    if (etalonnage) {
      for (const el of elements) { try { dejaVus.add(normaliserUrl(el.lien)); } catch { /* lien illisible */ } }
      continue;
    }

    const propres = Array.isArray(source.candidats) ? source.candidats : [];
    for (const el of elements) {
      let lien;
      try { lien = normaliserUrl(el.lien); } catch { continue; }
      if (dejaVus.has(lien)) continue;
      dejaVus.add(lien);
      if (el.date && joursEntre(el.date, jour) > FENETRE_JOURS) continue;
      if (motifs) {
        // Source à motifs : seules les adresses de programme sont gardées.
        if (!sousMotif(lien)) continue;
        infos.push({
          id: identifiant(jour, lien), semaine, source: source.id, categorie: source.categorie, date: jour, collecte: jour,
          titre: `Programme : page apparue — ${el.titre}`, lien, chapo: el.chapo, candidats: [...propres].sort(), motsCles: [],
          nature: 'programme-apparu',
        });
        continue;
      }
      const detection = detecter(`${el.titre} ${el.chapo}`, { candidats, motsCles });
      if (!retenir(el, source, detection)) continue;
      const date = el.date && el.date <= jour ? el.date : jour;
      infos.push({
        id: identifiant(date, lien),
        semaine,
        source: source.id,
        categorie: source.categorie,
        date,
        collecte: jour,
        titre: el.titre,
        lien,
        chapo: el.chapo,
        candidats: [...new Set([...propres, ...detection.candidats])].sort(),
        motsCles: detection.motsCles,
      });
    }
  }
  return { infos, etat: nouvelEtat, vus: dejaVus, empreintes: nouvellesEmpreintes, programmes };
}

/** Sources en échec depuis au moins `seuil` passages consécutifs. */
export function sourcesMuettes(etat, seuil = SEUIL_MUETTE) {
  return Object.entries(etat)
    .filter(([, e]) => e.echecs >= seuil)
    .map(([source, e]) => ({ source, depuis: e.dernierSucces }))
    .sort((a, b) => a.source.localeCompare(b.source));
}

/**
 * Noms cherchés par candidat : champ `nom` des fiches incluses et alias de veille/mots-cles.yml,
 * puis candidats à surveiller. `fiches` : [{ id, nom, inclus? }].
 */
export function dictionnaire(fiches, config) {
  const d = new Map();
  for (const f of fiches) {
    if (f.inclus === false || f.inclus === 'non') continue;
    d.set(f.id, [f.nom, ...(config.alias?.[f.id] ?? [])].filter(Boolean));
  }
  for (const [id, noms] of Object.entries(config.a_surveiller ?? {})) d.set(id, noms);
  return d;
}
