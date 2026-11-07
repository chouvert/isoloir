// Tests de la veille : lecture des flux, tri, journal. Aucun accès réseau : jeux d'essai dans tests/fixtures/veille.
// Spec : docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lireFlux, lireSitemap, lirePage, dateIso, normaliserUrl, identifiant, semaineIso,
  detecter, autoriseParRobots, retenir, journalMarkdown,
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
