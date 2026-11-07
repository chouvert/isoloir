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
    assert.ok(['rss', 'page', 'sitemap'].includes(s.type), `${s.id} : type`);
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
