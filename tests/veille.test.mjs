// Tests de la veille : lecture des flux, tri, journal. Aucun accès réseau : jeux d'essai dans tests/fixtures/veille.
// Spec : docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import YAML from 'yaml';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lireFlux, lireSitemap, lirePage, dateIso, normaliserUrl, identifiant, semaineIso,
  detecter, autoriseParRobots, retenir, journalMarkdown, collecter, sourcesMuettes, dictionnaire,
  blocsDeTexte, codesDeBlocs, comparerCodes, titreDePage, liensProgramme,
} from '../scripts/lib/veille.mjs';

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixture = (f) => readFileSync(join(RACINE, 'tests/fixtures/veille', f), 'utf8');

test('lireFlux : RSS (CDATA, entités, date RFC 822, sans date, chapô)', () => {
  const els = lireFlux(fixture('flux-rss.xml'));
  assert.equal(els.length, 3);
  assert.equal(els[0].titre, 'Édouard Philippe présente son plan & ses chiffres');
  assert.equal(els[0].date, '2026-11-06');
  assert.equal(els[0].chapo, 'Le candidat Horizons détaille ses mesures.');
  assert.equal(els[1].date, '2026-11-07');
  assert.equal(els[2].date, null);
  assert.ok(els[2].chapo.length <= 300);
  assert.doesNotMatch(els[0].chapo, /</);
});

test('lireFlux : Atom', () => {
  const els = lireFlux(fixture('flux-atom.xml'));
  assert.deepEqual(els.map((e) => [e.lien, e.date]), [
    ['https://parti.fr/communique-1', '2026-11-05'],
    ['https://parti.fr/communique-2', '2026-11-04'],
  ]);
  assert.equal(els[1].titre, 'Deuxième entrée');
});

test('lireSitemap', () => {
  const els = lireSitemap(fixture('sitemap.xml'));
  assert.deepEqual(els.map((e) => [e.lien, e.date]), [
    ['https://campagne.fr/actualites/meeting-lyon', '2026-11-03'],
    ['https://campagne.fr/actualites/programme', '2026-11-06'],
  ]);
});

test('lirePage : liens du même site, relatifs résolus, accueil et externes écartés', () => {
  const els = lirePage(fixture('page.html'), 'https://site.fr/actu/');
  assert.deepEqual(els.map((e) => e.lien), [
    'https://site.fr/actu/annonce-logement',
    'https://site.fr/actu/deplacement',
    'https://site.fr/actu/actu-relative',
  ]);
  assert.equal(els[0].titre, 'Annonce sur le logement');
  assert.ok(els.every((e) => e.date === null));
});

test('dateIso : formats acceptés et refusés', () => {
  assert.equal(dateIso('Fri, 06 Nov 2026 17:30:00 +0100'), '2026-11-06');
  assert.equal(dateIso('2026-11-06T23:30:00Z'), '2026-11-06');
  assert.equal(dateIso('2026-11-06'), '2026-11-06');
  assert.equal(dateIso('demain'), null);
  assert.equal(dateIso(''), null);
  assert.equal(dateIso(null), null);
});

test('normaliserUrl : paramètres de suivi, ancre, barre finale, hôte', () => {
  assert.equal(normaliserUrl('https://Site.fr/a/?utm_source=x&id=2#haut'), 'https://site.fr/a?id=2');
  assert.equal(normaliserUrl('https://site.fr/a?fbclid=1&gclid=2&xtor=3'), 'https://site.fr/a');
  assert.equal(normaliserUrl('https://site.fr/'), 'https://site.fr/');
});

test('identifiant : stable, daté, 8 caractères hexadécimaux', () => {
  const id = identifiant('2026-11-06', 'https://site.fr/a');
  assert.match(id, /^2026-11-06-[0-9a-f]{8}$/);
  assert.equal(identifiant('2026-11-06', 'https://site.fr/a'), id);
  assert.notEqual(identifiant('2026-11-06', 'https://site.fr/b'), id);
});

test('semaineIso : y compris à cheval sur deux années', () => {
  assert.equal(semaineIso('2026-11-07'), '2026-S45');
  assert.equal(semaineIso('2027-01-01'), '2026-S53');
  assert.equal(semaineIso('2027-01-04'), '2027-S01');
  assert.equal(semaineIso('2026-01-01'), '2026-S01');
});

const DICTIONNAIRE = {
  candidats: new Map([['philippe-edouard', ['Édouard Philippe']], ['le-pen-marine', ['Marine Le Pen']]]),
  motsCles: ['primaire', 'sondage'],
};

test('detecter : noms complets, casse et accents, mots entiers', () => {
  assert.deepEqual(detecter('Edouard PHILIPPE à Lyon', DICTIONNAIRE).candidats, ['philippe-edouard']);
  assert.deepEqual(detecter('le roi Philippe', DICTIONNAIRE).candidats, []);
  assert.deepEqual(detecter('Marine Le Penhoat', DICTIONNAIRE).candidats, []);
  assert.deepEqual(detecter('les primaires de la droite', DICTIONNAIRE).motsCles, ['primaire']);
  assert.deepEqual(detecter('rien à signaler', DICTIONNAIRE), { candidats: [], motsCles: [] });
});

test('autoriseParRobots', () => {
  const robots = fixture('robots.txt');
  assert.equal(autoriseParRobots(robots, '/prive/x'), false);
  assert.equal(autoriseParRobots(robots, '/actu'), true);
  assert.equal(autoriseParRobots('', '/actu'), true);
  assert.equal(autoriseParRobots('User-agent: isoloir-veille\nDisallow: /', '/actu'), false);
});

test('retenir : sources de campagne sans filtre, presse filtrée', () => {
  const vide = { candidats: [], motsCles: [] };
  assert.equal(retenir({}, { categorie: 'campagne' }, vide), true);
  assert.equal(retenir({}, { categorie: 'parti' }, vide), true);
  assert.equal(retenir({}, { categorie: 'sondages' }, vide), true);
  assert.equal(retenir({}, { categorie: 'presse' }, vide), false);
  assert.equal(retenir({}, { categorie: 'presse' }, { candidats: ['x'], motsCles: [] }), true);
});

test('journalMarkdown : sources muettes en tête, candidats puis transverse', () => {
  const info = (id, candidats, titre) => ({
    id, semaine: '2026-S45', source: 'src', categorie: 'presse', date: '2026-11-06', collecte: '2026-11-07',
    titre, lien: `https://site.fr/${id}`, chapo: 'Chapô.', candidats, motsCles: [],
  });
  const md = journalMarkdown(
    [info('b', ['zemmour-eric'], 'Titre B'), info('a', ['attal-gabriel'], 'Titre A'), info('c', [], 'Titre C')],
    { semaine: '2026-S45', muettes: [{ source: 'lcp', depuis: '2026-11-03' }] },
  );
  assert.match(md, /^# Veille — 2026-S45\n/);
  const pos = (s) => md.indexOf(s);
  assert.ok(pos('Sources muettes') < pos('## attal-gabriel'));
  assert.ok(pos('## attal-gabriel') < pos('## zemmour-eric'));
  assert.ok(pos('## zemmour-eric') < pos('## transverse'));
  assert.match(md, /- 2026-11-06 · \[Titre C\]\(https:\/\/site\.fr\/c\) · src — Chapô\./);
  assert.match(md, /lcp.*2026-11-03/);
});

// ---------------------------------------------------------------------------
// Collecte (faux accès réseau)
// ---------------------------------------------------------------------------

const rss = (items) => `<rss><channel>${items.map(([titre, lien, date]) => `<item><title>${titre}</title><link>${lien}</link>${date ? `<pubDate>${date}</pubDate>` : ''}</item>`).join('')}</channel></rss>`;

/** Faux lecteur : table url → { statut, texte } ; robots.txt absent par défaut (404). */
function lecteur(table) {
  return async (url) => {
    if (table[url] instanceof Error) throw table[url];
    return table[url] ?? { statut: 404, texte: '' };
  };
}

const SOURCES = [
  { id: 'presse-a', type: 'rss', url: 'https://a.fr/rss', categorie: 'presse', candidats: 'transverse' },
  { id: 'presse-b', type: 'rss', url: 'https://b.fr/rss', categorie: 'presse', candidats: 'transverse' },
];
const BASE = { candidats: DICTIONNAIRE.candidats, motsCles: DICTIONNAIRE.motsCles, maintenant: '2026-11-07' };

test('collecter : même article sous deux URL dans deux sources → une seule information', async () => {
  const { infos } = await collecter({
    ...BASE, sources: SOURCES, etat: {}, vus: new Set(),
    lireUrl: lecteur({
      'https://a.fr/rss': { statut: 200, texte: rss([['Marine Le Pen à Orléans', 'https://x.fr/art?utm_source=a', '2026-11-06']]) },
      'https://b.fr/rss': { statut: 200, texte: rss([['Marine Le Pen à Orléans', 'https://x.fr/art', '2026-11-06']]) },
    }),
  });
  assert.equal(infos.length, 1);
  assert.deepEqual(infos[0].candidats, ['le-pen-marine']);
  assert.equal(infos[0].semaine, '2026-S45');
  assert.match(infos[0].id, /^2026-11-06-[0-9a-f]{8}$/);
});

test('collecter : URL déjà vue ignorée ; élément sans date daté du jour ; ancien élément écarté', async () => {
  const { infos, vus } = await collecter({
    ...BASE, sources: [SOURCES[0]], etat: {}, vus: new Set(['https://x.fr/vu']),
    lireUrl: lecteur({ 'https://a.fr/rss': { statut: 200, texte: rss([
      ['Sondage Ifop', 'https://x.fr/vu', '2026-11-06'],
      ['Sondage Elabe', 'https://x.fr/sans-date', null],
      ['Sondage ancien', 'https://x.fr/ancien', '2026-09-01'],
    ]) } }),
  });
  assert.deepEqual(infos.map((i) => [i.titre, i.date]), [['Sondage Elabe', '2026-11-07']]);
  assert.ok(vus.has('https://x.fr/sans-date'));
});

test('collecter : échecs consécutifs, source muette au bout de 3, remise à zéro par un succès', async () => {
  const lire500 = lecteur({ 'https://a.fr/rss': { statut: 500, texte: '' } });
  let etat = {};
  for (let i = 0; i < 3; i++) ({ etat } = await collecter({ ...BASE, sources: [SOURCES[0]], etat, vus: new Set(), lireUrl: lire500 }));
  assert.equal(etat['presse-a'].echecs, 3);
  assert.deepEqual(sourcesMuettes(etat), [{ source: 'presse-a', depuis: null }]);
  ({ etat } = await collecter({ ...BASE, sources: [SOURCES[0]], etat, vus: new Set(),
    lireUrl: lecteur({ 'https://a.fr/rss': { statut: 200, texte: rss([['Rien', 'https://x.fr/r', '2026-11-07']]) } }) }));
  assert.deepEqual(etat['presse-a'], { dernierSucces: '2026-11-07', echecs: 0 });
  assert.deepEqual(sourcesMuettes(etat), []);
});

test('collecter : réponse 200 sans élément lisible ou erreur réseau → échec', async () => {
  const { etat } = await collecter({ ...BASE, sources: SOURCES, etat: {}, vus: new Set(),
    lireUrl: lecteur({ 'https://a.fr/rss': { statut: 200, texte: '<html>Erreur</html>' }, 'https://b.fr/rss': new Error('délai dépassé') }) });
  assert.equal(etat['presse-a'].echecs, 1);
  assert.equal(etat['presse-b'].echecs, 1);
});

test('collecter : robots.txt interdisant le chemin → source non lue', async () => {
  let lue = false;
  const { infos, etat } = await collecter({ ...BASE, sources: [SOURCES[0]], etat: {}, vus: new Set(),
    lireUrl: async (url) => {
      if (url === 'https://a.fr/robots.txt') return { statut: 200, texte: 'User-agent: *\nDisallow: /rss' };
      lue = true;
      return { statut: 200, texte: rss([['Sondage', 'https://x.fr/s', '2026-11-07']]) };
    } });
  assert.equal(lue, false);
  assert.equal(infos.length, 0);
  assert.equal(etat['presse-a'].echecs, 1);
});

test('collecter : source de campagne gardée sans filtre et rattachée à son candidat', async () => {
  const { infos } = await collecter({ ...BASE, etat: {}, vus: new Set(),
    sources: [{ id: 'site-attal', type: 'rss', url: 'https://c.fr/rss', categorie: 'campagne', candidats: ['attal-gabriel'] }],
    lireUrl: lecteur({ 'https://c.fr/rss': { statut: 200, texte: rss([['Déplacement à Lille', 'https://c.fr/lille', '2026-11-06']]) } }) });
  assert.deepEqual(infos.map((i) => i.candidats), [['attal-gabriel']]);
});

test('sources.yml : entrées bien formées', () => {
  const sources = YAML.parse(readFileSync(join(RACINE, 'veille/sources.yml'), 'utf8'));
  const fiches = new Set(readFileSync(join(RACINE, 'referentiel/candidats-inclus.md'), 'utf8').match(/`[a-z]+(?:-[a-z]+)+`/g).map((s) => s.slice(1, -1)));
  const ids = sources.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'identifiants en double');
  for (const s of sources) {
    assert.match(s.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, s.id);
    assert.ok(['rss', 'page', 'sitemap', 'programme'].includes(s.type), `${s.id} : type`);
    if (s.type === 'programme') assert.ok(Array.isArray(s.candidats) && s.candidats.length, `${s.id} : programme sans candidat`);
    for (const champ of ['prefixes', 'motifs']) {
      if (s[champ] !== undefined) assert.ok(Array.isArray(s[champ]) && s[champ].every((x) => typeof x === 'string' && x), `${s.id} : ${champ}`);
    }
    if (s.prefixes) assert.ok(s.prefixes.every((x) => x.startsWith('/')), `${s.id} : préfixe sans « / » initial`);
    if (s.plan !== undefined) assert.match(s.plan, /^https?:\/\//, `${s.id} : plan`);
    assert.ok(['campagne', 'parti', 'presse', 'sondages', 'institution'].includes(s.categorie), `${s.id} : catégorie`);
    assert.match(s.url, /^https:\/\//, `${s.id} : url`);
    assert.ok(s.candidats === 'transverse' || (Array.isArray(s.candidats) && s.candidats.every((c) => fiches.has(c))), `${s.id} : candidats`);
  }
});

// ---------------------------------------------------------------------------
// Corrections de la revue finale
// ---------------------------------------------------------------------------

test('revue : premier succès d’une source page ou sitemap → liens marqués vus, aucune information', async () => {
  const src = { id: 'site', type: 'page', url: 'https://c.fr/actu', categorie: 'campagne', candidats: ['attal-gabriel'] };
  const html = (liens) => liens.map((l) => `<a href="/${l}">${l}</a>`).join('');
  const premier = await collecter({ ...BASE, sources: [src], etat: {}, vus: new Set(),
    lireUrl: lecteur({ 'https://c.fr/actu': { statut: 200, texte: html(['faire-un-don', 'mentions-legales']) } }) });
  assert.equal(premier.infos.length, 0);
  assert.ok(premier.vus.has('https://c.fr/faire-un-don'));
  const second = await collecter({ ...BASE, sources: [src], etat: premier.etat, vus: premier.vus,
    lireUrl: lecteur({ 'https://c.fr/actu': { statut: 200, texte: html(['faire-un-don', 'mentions-legales', 'annonce-lille']) } }) });
  assert.deepEqual(second.infos.map((i) => i.lien), ['https://c.fr/annonce-lille']);
});

test('revue : page redirigée vers www → liens lus avec l’adresse finale', async () => {
  const src = { id: 'pcf', type: 'page', url: 'https://pcf.fr/', categorie: 'parti', candidats: ['roussel-fabien'] };
  const { etat } = await collecter({ ...BASE, sources: [src], etat: {}, vus: new Set(),
    lireUrl: lecteur({ 'https://pcf.fr/': { statut: 200, url: 'https://www.pcf.fr/', texte: '<a href="https://www.pcf.fr/actu/meeting">Meeting</a>' } }) });
  assert.deepEqual(etat.pcf, { dernierSucces: '2026-11-07', echecs: 0 });
});

test('revue : robots.txt — Allow le plus long l’emporte', () => {
  const robots = 'User-agent: *\nDisallow: /w/\nAllow: /w/api.php';
  assert.equal(autoriseParRobots(robots, '/w/index.php'), false);
  assert.equal(autoriseParRobots(robots, '/w/api.php?x=1'), true);
});

test('revue : dates impossibles ou par défaut → null (date de collecte appliquée)', () => {
  assert.equal(dateIso('Thu, 01 Jan 1970 00:00:00 GMT'), null);
  assert.equal(dateIso('2026-00-10'), null);
  assert.equal(dateIso('2026-02-30'), null);
  assert.equal(dateIso('2026-02-28'), '2026-02-28');
});

test('revue : dictionnaire réel — noms de famille déclarés, pas « Philippe » seul', () => {
  const config = YAML.parse(readFileSync(join(RACINE, 'veille/mots-cles.yml'), 'utf8'));
  const dico = dictionnaire([
    { id: 'melenchon-jean-luc', nom: 'Jean-Luc Mélenchon' }, { id: 'philippe-edouard', nom: 'Édouard Philippe' },
  ], config);
  assert.deepEqual(detecter('Melenchon répond à ses critiques', { candidats: dico, motsCles: [] }).candidats, ['melenchon-jean-luc']);
  assert.deepEqual(detecter('Le prince Philippe en visite', { candidats: dico, motsCles: [] }).candidats, []);
  assert.ok(dico.has('villepin-dominique') && dico.has('borne-elisabeth') && dico.has('le-maire-bruno'));
});

// ---------------------------------------------------------------------------
// Programmes : empreinte des pages (spec 2026-11-15-suivi-programmes-design.md)
// ---------------------------------------------------------------------------

test('blocsDeTexte : blocs de <main> seulement, menus, pied, scripts et bouton court écartés', () => {
  const blocs = blocsDeTexte(fixture('programme-chapitre-v1.html'));
  assert.deepEqual(blocs, [
    'Chapitre 2 : produire en France',
    'Ce chapitre présente les mesures d’essai pour l’industrie.',
    'Créer une banque publique d’investissement d’essai.',
    'Planifier la formation des ouvriers et des techniciens.',
    'Réduire la dépendance aux importations de médicaments.',
    'Un encadré de texte libre assez long pour compter.',
    'Soutenir les coopératives ouvrières de production.',
  ]);
  assert.ok(!blocs.some((b) => /Partager|Accueil|Mise à jour|compteur|Tout le programme/.test(b)));
});

test('blocsDeTexte : sans <main> ni <article> → <body> ; <article> ; HTML vide → []', () => {
  const corps = '<html><body><nav><p>Menu de navigation du site entier</p></nav><p>Un paragraphe du corps de la page.</p></body></html>';
  assert.deepEqual(blocsDeTexte(corps), ['Un paragraphe du corps de la page.']);
  const article = '<body><p>Paragraphe hors article, assez long.</p><article><p>Paragraphe dans l’article, assez long.</p></article></body>';
  assert.deepEqual(blocsDeTexte(article), ['Paragraphe dans l’article, assez long.']);
  assert.deepEqual(blocsDeTexte(''), []);
});

test('codesDeBlocs : 10 hexadécimaux, sans doublon, triés, insensibles à la casse, aux accents et aux espaces', () => {
  const codes = codesDeBlocs(['Réduire la dépendance', 'REDUIRE  la   dependance', 'Autre bloc de texte']);
  assert.equal(codes.length, 2);
  assert.ok(codes.every((c) => /^[0-9a-f]{10}$/.test(c)));
  assert.deepEqual(codes, [...codes].sort());
});

test('comparerCodes : v1 → v2 donne +1 / −1 ; v1 → v1 réordonnée donne 0 / 0', () => {
  const v1 = codesDeBlocs(blocsDeTexte(fixture('programme-chapitre-v1.html')));
  const v2 = codesDeBlocs(blocsDeTexte(fixture('programme-chapitre-v2.html')));
  const d = comparerCodes(v1, v2);
  assert.equal(d.ajoutes, 1);
  assert.equal(d.retires, 1);
  assert.ok(d.premierAjoute >= 0 && !v1.includes(v2[d.premierAjoute]));
  assert.deepEqual(comparerCodes(v1, [...v1].reverse()), { ajoutes: 0, retires: 0, premierAjoute: -1 });
});

test('titreDePage : <title>, sinon premier h1, sinon l’adresse', () => {
  assert.equal(titreDePage(fixture('programme-chapitre-v1.html'), 'https://c.fr/p'), 'Chapitre 2 — Produire en France | Campagne d’essai');
  assert.equal(titreDePage('<body><h1>Le <em>projet</em></h1></body>', 'https://c.fr/p'), 'Le projet');
  assert.equal(titreDePage('<body></body>', 'https://c.fr/p'), 'https://c.fr/p');
});

// ---------------------------------------------------------------------------
// Programmes : suivi d'une source `programme` dans collecter()
// ---------------------------------------------------------------------------

const PROG = { id: 'essai-programme', nom: 'Essai — programme', type: 'programme', url: 'https://c.fr/programme/',
  prefixes: ['/programme/'], categorie: 'campagne', candidats: ['attal-gabriel'] };
const SOMMAIRE = fixture('programme-sommaire.html');
const CH_V1 = fixture('programme-chapitre-v1.html');
const CH_V2 = fixture('programme-chapitre-v2.html');
const ok = (texte) => ({ statut: 200, texte });

/** Site d'essai : pages (table url → réponse), en-têtes de PDF, journal des adresses demandées. */
function site({ pages = {}, entetes = {} } = {}) {
  const demandees = [];
  const table = {
    'https://c.fr/programme/': ok(SOMMAIRE),
    'https://c.fr/programme/livre/chapitre1': ok(CH_V1),
    'https://c.fr/programme/livre/chapitre2': ok(CH_V1),
    ...pages,
  };
  const enTetes = { 'https://c.fr/programme/plan.pdf': { statut: 200, etag: '"a1"', modifie: null, taille: '1000' }, ...entetes };
  return {
    demandees,
    lireUrl: async (url) => { demandees.push(url); return table[url] ?? { statut: 404, texte: '' }; },
    lireEntete: async (url) => { demandees.push(`HEAD ${url}`); return enTetes[url] ?? { statut: 404 }; },
  };
}

async function passage(s, precedent = {}, extra = {}) {
  return collecter({ ...BASE, sources: [PROG], etat: precedent.etat ?? {}, vus: precedent.vus ?? new Set(),
    empreintes: precedent.empreintes ?? {}, lireUrl: s.lireUrl, lireEntete: s.lireEntete, ...extra });
}

test('programme : premier passage → une seule information « suivi commencé », 4 pages suivies', async () => {
  const s = site();
  const r = await passage(s);
  assert.equal(r.infos.length, 1);
  assert.equal(r.infos[0].nature, 'programme-suivi');
  assert.match(r.infos[0].chapo, /^4 pages suivies/);
  assert.deepEqual(r.infos[0].candidats, ['attal-gabriel']);
  assert.deepEqual(Object.keys(r.empreintes).sort(), [
    'https://c.fr/programme', 'https://c.fr/programme/livre/chapitre1',
    'https://c.fr/programme/livre/chapitre2', 'https://c.fr/programme/plan.pdf',
  ]);
  assert.ok(Object.values(r.empreintes).every((e) => e.source === 'essai-programme' && e.vu === '2026-11-07' && e.absences === 0));
  assert.ok(!s.demandees.some((u) => /evenement|autre\.fr/.test(u)), s.demandees.join(' '));
  assert.equal(new Set(s.demandees).size, s.demandees.length, 'adresse demandée deux fois');
  assert.equal(r.etat['essai-programme'].echecs, 0);
  assert.doesNotMatch(JSON.stringify(r.empreintes), /importations|coop[ée]ratives|banque publique/i, 'aucun texte de programme enregistré');
});

test('programme : deuxième passage sans changement → aucune information', async () => {
  const s = site();
  const r1 = await passage(s);
  const r2 = await passage(s, r1, { maintenant: '2026-11-08' });
  assert.deepEqual(r2.infos, []);
});

test('programme : chapitre modifié → « page modifiée », +1 / −1 blocs et début du bloc ajouté', async () => {
  const r1 = await passage(site());
  const r2 = await passage(site({ pages: { 'https://c.fr/programme/livre/chapitre2': ok(CH_V2) } }), r1, { maintenant: '2026-11-08' });
  assert.equal(r2.infos.length, 1);
  const i = r2.infos[0];
  assert.equal(i.nature, 'programme-modifie');
  assert.equal(i.lien, 'https://c.fr/programme/livre/chapitre2');
  assert.equal(i.titre, 'Programme : page modifiée — Chapitre 2 — Produire en France | Campagne d’essai');
  assert.match(i.chapo, /^\+1 \/ −1 blocs · Relocaliser les productions essentielles/);
  assert.ok(i.chapo.length <= 300);
  assert.deepEqual(i.candidats, ['attal-gabriel']);
  assert.match(i.id, /^2026-11-08-[0-9a-f]{8}$/);
  assert.ok(r2.vus.has('https://c.fr/programme/livre/chapitre2'));
});

test('programme : page modifiée déjà vue → signalée malgré vus.txt', async () => {
  const r1 = await passage(site());
  r1.vus.add('https://c.fr/programme/livre/chapitre2');
  const r2 = await passage(site({ pages: { 'https://c.fr/programme/livre/chapitre2': ok(CH_V2) } }), r1, { maintenant: '2026-11-08' });
  assert.deepEqual(r2.infos.map((i) => i.nature), ['programme-modifie']);
});

test('programme : nouveau chapitre → « page nouvelle » et sommaire modifié', async () => {
  const r1 = await passage(site());
  const sommaire2 = SOMMAIRE.replace('<!-- CHAPITRE3 -->', '<li><a href="/programme/livre/chapitre3/">Chapitre 3 : apprendre et chercher ensemble</a></li>');
  const r2 = await passage(site({ pages: {
    'https://c.fr/programme/': ok(sommaire2), 'https://c.fr/programme/livre/chapitre3': ok(CH_V2),
  } }), r1, { maintenant: '2026-11-08' });
  const parNature = Object.fromEntries(r2.infos.map((i) => [i.nature, i]));
  assert.deepEqual(r2.infos.map((i) => i.nature).sort(), ['programme-modifie', 'programme-nouveau']);
  assert.equal(parNature['programme-nouveau'].lien, 'https://c.fr/programme/livre/chapitre3');
  assert.match(parNature['programme-nouveau'].titre, /^Programme : page nouvelle — Chapitre 2/);
  assert.equal(parNature['programme-modifie'].lien, 'https://c.fr/programme');
});

test('programme : page en erreur → empreinte conservée ; retirée au 3e passage, puis plus rien', async () => {
  let r = await passage(site());
  const empreinteAvant = r.empreintes['https://c.fr/programme/livre/chapitre1'].blocs;
  const panne = site({ pages: { 'https://c.fr/programme/livre/chapitre1': { statut: 500, texte: '' } } });
  const jours = ['2026-11-08', '2026-11-09', '2026-11-10', '2026-11-11'];
  const natures = [];
  for (const [n, jour] of jours.entries()) {
    r = await passage(panne, r, { maintenant: jour });
    natures.push(r.infos.map((i) => i.nature));
    if (n === 0) {
      assert.deepEqual(r.empreintes['https://c.fr/programme/livre/chapitre1'].blocs, empreinteAvant);
      assert.equal(r.empreintes['https://c.fr/programme/livre/chapitre1'].absences, 1);
    }
  }
  assert.deepEqual(natures, [[], [], ['programme-retire'], []]);
  assert.equal(r.etat['essai-programme'].echecs, 0);
});

test('programme : PDF — etag changé → modifié ; sans en-tête → jamais modifié', async () => {
  const r1 = await passage(site());
  const r2 = await passage(site({ entetes: { 'https://c.fr/programme/plan.pdf': { statut: 200, etag: '"b2"', modifie: null, taille: '1000' } } }), r1, { maintenant: '2026-11-08' });
  assert.deepEqual(r2.infos.map((i) => [i.nature, i.lien]), [['programme-modifie', 'https://c.fr/programme/plan.pdf']]);
  const nu = { 'https://c.fr/programme/plan.pdf': { statut: 200 } };
  const r3 = await passage(site({ entetes: nu }));
  const r4 = await passage(site({ entetes: nu }), r3, { maintenant: '2026-11-08' });
  assert.deepEqual(r4.infos, []);
  const r5 = await passage(site(), r4, { maintenant: '2026-11-09' });
  assert.deepEqual(r5.infos, [], 'un PDF sans empreinte n’est pas « modifié » quand des en-têtes apparaissent');
});

test('programme : robots.txt — pages interdites non demandées ; point d’entrée interdit → échec', async () => {
  const s = site({ pages: { 'https://c.fr/robots.txt': ok('User-agent: *\nDisallow: /programme/livre/') } });
  const r = await passage(s);
  assert.ok(!s.demandees.some((u) => u.includes('/livre/')), s.demandees.join(' '));
  assert.match(r.infos[0].chapo, /^2 pages suivies/);
  const t = site({ pages: { 'https://c.fr/robots.txt': ok('User-agent: *\nDisallow: /programme') } });
  const r2 = await passage(t);
  assert.deepEqual(r2.infos, []);
  assert.equal(r2.etat['essai-programme'].echecs, 1);
  assert.deepEqual(r2.empreintes, {});
  assert.deepEqual(t.demandees, ['https://c.fr/robots.txt']);
});

test('programme : point d’entrée en erreur → échec de la source, empreintes inchangées', async () => {
  const r1 = await passage(site());
  const r2 = await passage(site({ pages: { 'https://c.fr/programme/': { statut: 503, texte: '' } } }), r1, { maintenant: '2026-11-08' });
  assert.deepEqual(r2.infos, []);
  assert.equal(r2.etat['essai-programme'].echecs, 1);
  assert.deepEqual(r2.empreintes, r1.empreintes);
});

test('programme : plafond de pages → 2 pages lues, une information « plafond » par semaine', async () => {
  const s = site();
  const r1 = await passage(s, {}, { maxPagesProgramme: 2 });
  assert.equal(Object.keys(r1.empreintes).length, 2);
  assert.equal(s.demandees.filter((u) => u !== 'https://c.fr/robots.txt').length, 2);
  assert.equal(r1.infos.filter((i) => i.nature === 'programme-plafond').length, 1);
  const r2 = await passage(site(), r1, { maxPagesProgramme: 2, maintenant: '2026-11-08' });
  assert.deepEqual(r2.infos, [], 'même semaine ISO : pas de seconde information « plafond »');
  const r3 = await passage(site(), r2, { maxPagesProgramme: 2, maintenant: '2026-11-09' });
  assert.deepEqual(r3.infos.map((i) => i.nature), ['programme-plafond'], 'semaine suivante');
});

test('programme : plan du site → page orpheline sous le préfixe suivie', async () => {
  const plan = '<urlset><url><loc>https://c.fr/programme/annexe</loc></url><url><loc>https://c.fr/blog/x</loc></url></urlset>';
  const s = site({ pages: { 'https://c.fr/sitemap.xml': ok(plan), 'https://c.fr/programme/annexe': ok(CH_V2) } });
  const r = await collecter({ ...BASE, sources: [{ ...PROG, plan: 'https://c.fr/sitemap.xml' }], etat: {}, vus: new Set(),
    empreintes: {}, lireUrl: s.lireUrl, lireEntete: s.lireEntete });
  assert.ok(r.empreintes['https://c.fr/programme/annexe']);
  assert.ok(!s.demandees.includes('https://c.fr/blog/x'));
});

test('programme : collecter sans empreintes ni lireEntete → empreintes vides', async () => {
  const r = await collecter({ ...BASE, sources: [SOURCES[0]], etat: {}, vus: new Set(),
    lireUrl: lecteur({ 'https://a.fr/rss': { statut: 200, texte: rss([['Sondage', 'https://x.fr/s', '2026-11-07']]) } }) });
  assert.deepEqual(r.empreintes, {});
  assert.equal(r.infos.length, 1);
  assert.equal('nature' in r.infos[0], false);
});

test('liensProgramme : même site, sous un préfixe, ancres retirées, sans doublon', () => {
  assert.deepEqual(liensProgramme(SOMMAIRE, 'https://c.fr/programme/', ['/programme/']), [
    'https://c.fr/programme/livre/chapitre1', 'https://c.fr/programme/livre/chapitre2', 'https://c.fr/programme/plan.pdf',
  ]);
});

// ---------------------------------------------------------------------------
// Programmes : motifs, journal
// ---------------------------------------------------------------------------

const plan = (chemins) => `<urlset>${chemins.map((c) => `<url><loc>https://d.fr${c}</loc></url>`).join('')}</urlset>`;

test('motifs : plan de site — adresse nouvelle sous un motif gardée comme « page apparue », le reste écarté', async () => {
  const src = { id: 'site-d', type: 'sitemap', url: 'https://d.fr/sitemap.xml', categorie: 'campagne',
    candidats: ['zemmour-eric'], motifs: ['programme', 'projet'] };
  const r1 = await collecter({ ...BASE, sources: [src], etat: {}, vus: new Set(),
    lireUrl: lecteur({ 'https://d.fr/sitemap.xml': ok(plan(['/accueil'])) }) });
  assert.deepEqual(r1.infos, []);
  const r2 = await collecter({ ...BASE, sources: [src], etat: r1.etat, vus: r1.vus, maintenant: '2026-11-08',
    lireUrl: lecteur({ 'https://d.fr/sitemap.xml': ok(plan(['/accueil', '/notre-projet/sante', '/actualites/meeting'])) }) });
  assert.deepEqual(r2.infos.map((i) => [i.lien, i.nature]), [['https://d.fr/notre-projet/sante', 'programme-apparu']]);
  assert.equal(r2.infos[0].titre, 'Programme : page apparue — https://d.fr/notre-projet/sante');
  assert.deepEqual(r2.infos[0].candidats, ['zemmour-eric']);
  const sans = { ...src, motifs: undefined };
  const r3 = await collecter({ ...BASE, sources: [sans], etat: r1.etat, vus: r1.vus, maintenant: '2026-11-08',
    lireUrl: lecteur({ 'https://d.fr/sitemap.xml': ok(plan(['/accueil', '/notre-projet/sante', '/actualites/meeting'])) }) });
  assert.equal(r3.infos.length, 2);
  assert.ok(r3.infos.every((i) => !('nature' in i)));
});

test('journalMarkdown : informations « programme » d’abord dans la section du candidat, marquées', () => {
  const info = (id, date, nature) => ({
    id, semaine: '2026-S46', source: 'src', categorie: 'campagne', date, collecte: date,
    titre: `Titre ${id}`, lien: `https://site.fr/${id}`, chapo: '', candidats: ['attal-gabriel'], motsCles: [], ...(nature ? { nature } : {}),
  });
  const md = journalMarkdown([info('recent', '2026-11-12'), info('prog', '2026-11-10', 'programme-modifie'), info('autre', '2026-11-11')],
    { semaine: '2026-S46' });
  const lignes = md.split('\n').filter((l) => l.startsWith('- '));
  assert.deepEqual(lignes, [
    '- **Programme** · 2026-11-10 · [Titre prog](https://site.fr/prog) · src',
    '- 2026-11-12 · [Titre recent](https://site.fr/recent) · src',
    '- 2026-11-11 · [Titre autre](https://site.fr/autre) · src',
  ]);
});

test('liensProgramme : vues filtrées (adresse avec paramètres) écartées', () => {
  const html = '<a href="/programme?thematique=sante">Santé</a><a href="/programme/sante">Santé</a><a href="/programme/x?utm_source=y">X</a>';
  assert.deepEqual(liensProgramme(html, 'https://c.fr/programme', ['/programme']), ['https://c.fr/programme/sante', 'https://c.fr/programme/x']);
});

test('programme : diagnostic de l’essai — statut du point d’entrée en échec, liens hors préfixes', async () => {
  const r = await passage(site({ pages: { 'https://c.fr/programme/': { statut: 403, texte: '' } } }));
  assert.deepEqual(r.programmes['essai-programme'].pages, [{ url: 'https://c.fr/programme', statut: 403, blocs: 0 }]);
  const r2 = await passage(site());
  assert.deepEqual(r2.programmes['essai-programme'].horsPrefixes, ['https://c.fr/', 'https://c.fr/evenement/reunion']);
});
