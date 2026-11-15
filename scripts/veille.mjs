#!/usr/bin/env node
// Collecte quotidienne de la veille : lit veille/sources.yml, écrit le journal de la semaine.
// Usage : node scripts/veille.mjs --sortie <dossier> [--jour AAAA-MM-JJ] [--essai]
//   <dossier> : copie de travail de la branche `veille` (etat.json, vus.txt, empreintes.json, AAAA-Sxx.jsonl, AAAA-Sxx.md).
//   --essai : n'écrit rien ; affiche les pages suivies par source `programme` et les adresses des sources à motifs.
// Specs : docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md, 2026-11-15-suivi-programmes-design.md
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { lireFrontmatter } from './lib/markdown.mjs';
import { AGENT, collecter, dictionnaire, journalMarkdown, semaineIso, sourcesMuettes } from './lib/veille.mjs';

const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(nom); return i >= 0 ? args[i + 1] : undefined; };
const sortie = resolve(option('--sortie') ?? 'veille-donnees');
const jour = option('--jour') ?? new Date().toISOString().slice(0, 10);
const essai = args.includes('--essai');
const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const lireYaml = (f) => YAML.parse(readFileSync(join(racine, f), 'utf8'));
const sources = lireYaml('veille/sources.yml');
const config = lireYaml('veille/mots-cles.yml');

// Noms cherchés : candidats inclus (champ nom + alias), puis candidats à surveiller.
const fiches = readdirSync(join(racine, 'candidats')).filter((n) => n.endsWith('.md') && !n.startsWith('_')).sort()
  .map((f) => ({ id: f.replace(/\.md$/, ''), ...(lireFrontmatter(readFileSync(join(racine, 'candidats', f), 'utf8')).data ?? {}) }));
const candidats = dictionnaire(fiches, config);

mkdirSync(sortie, { recursive: true });
const fichier = (f) => join(sortie, f);
const etat = existsSync(fichier('etat.json')) ? JSON.parse(readFileSync(fichier('etat.json'), 'utf8')) : {};
const vus = new Set(existsSync(fichier('vus.txt')) ? readFileSync(fichier('vus.txt'), 'utf8').split('\n').filter(Boolean) : []);
const empreintes = existsSync(fichier('empreintes.json')) ? JSON.parse(readFileSync(fichier('empreintes.json'), 'utf8')) : {};

const lireUrl = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  return { statut: r.status, texte: await r.text(), url: r.url };
};
const lireEntete = async (url) => {
  const r = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  const h = (n) => r.headers.get(n);
  return { statut: r.status, etag: h('etag'), modifie: h('last-modified'), taille: h('content-length') };
};
const attendre = () => new Promise((ok) => setTimeout(ok, 2000));

const resultat = await collecter({
  sources, candidats, motsCles: config.mots_cles ?? [], etat, vus, lireUrl, maintenant: jour, attendre, empreintes, lireEntete,
});
const pagesSuivies = Object.keys(resultat.empreintes).length;

if (essai) {
  console.log(`Essai ${jour} : rien n'est écrit. ${resultat.infos.length} information(s) auraient été ajoutées.`);
  for (const s of sources) {
    const e = resultat.etat[s.id];
    const p = resultat.programmes[s.id];
    console.log(`${e?.echecs ? '✖' : '✓'} ${s.id} (${s.type})`);
    if (s.type === 'programme' && p) {
      console.log(`    ${p.pages.filter((x) => x.statut === 200).length} page(s) suivie(s), ${p.refusees.length} refusée(s) par robots.txt`);
      for (const x of p.pages) console.log(`    ${x.statut === 200 ? `${String(x.blocs).padStart(4)} bloc(s)${x.blocs ? '' : ' — page construite par JavaScript ?'}` : `statut ${x.statut}`}  ${x.url}`);
      for (const u of p.refusees) console.log(`    refusée  ${u}`);
    } else if (p) {
      console.log(`    ${p.adresses} adresse(s) dans le plan, ${p.correspondantes.length} sous un motif`);
      for (const u of p.correspondantes.slice(0, 20)) console.log(`    motif  ${u}`);
    }
  }
  for (const i of resultat.infos) console.log(`  + ${i.nature ?? i.categorie} · ${i.titre} · ${i.lien}`);
  process.exit(0);
}

const semaine = semaineIso(jour);
const jsonl = fichier(`${semaine}.jsonl`);
const anciennes = existsSync(jsonl) ? readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const toutes = [...anciennes, ...resultat.infos];
writeFileSync(jsonl, toutes.map((i) => JSON.stringify(i)).join('\n') + (toutes.length ? '\n' : ''));
writeFileSync(fichier(`${semaine}.md`), journalMarkdown(toutes, { semaine, muettes: sourcesMuettes(resultat.etat) }));
writeFileSync(fichier('etat.json'), `${JSON.stringify(resultat.etat, null, 2)}\n`);
writeFileSync(fichier('vus.txt'), `${[...resultat.vus].sort().join('\n')}\n`);
const triees = Object.fromEntries(Object.keys(resultat.empreintes).sort().map((k) => [k, resultat.empreintes[k]]));
writeFileSync(fichier('empreintes.json'), `${JSON.stringify(triees, null, 2)}\n`);

const muettes = sourcesMuettes(resultat.etat);
console.log(`Veille ${jour} (${semaine}) : ${resultat.infos.length} information(s) nouvelle(s), ${sources.length} source(s), ${muettes.length} muette(s), ${pagesSuivies} page(s) de programme suivie(s).`);
for (const s of sources) {
  const e = resultat.etat[s.id];
  console.log(`  ${e?.echecs ? '✖' : '✓'} ${s.id}${e?.echecs ? ` (${e.echecs} échec(s) consécutif(s))` : ''}`);
}
