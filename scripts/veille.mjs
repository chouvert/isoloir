#!/usr/bin/env node
// Collecte quotidienne de la veille : lit veille/sources.yml, écrit le journal de la semaine.
// Usage : node scripts/veille.mjs --sortie <dossier> [--jour AAAA-MM-JJ]
//   <dossier> : copie de travail de la branche `veille` (etat.json, vus.txt, AAAA-Sxx.jsonl, AAAA-Sxx.md).
// Spec : docs/superpowers/specs/2026-11-07-veille-hebdomadaire-design.md
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

const lireUrl = async (url) => {
  const r = await fetch(url, { headers: { 'User-Agent': AGENT }, signal: AbortSignal.timeout(15000), redirect: 'follow' });
  return { statut: r.status, texte: await r.text(), url: r.url };
};
const attendre = () => new Promise((ok) => setTimeout(ok, 2000));

const resultat = await collecter({
  sources, candidats, motsCles: config.mots_cles ?? [], etat, vus, lireUrl, maintenant: jour, attendre,
});

const semaine = semaineIso(jour);
const jsonl = fichier(`${semaine}.jsonl`);
const anciennes = existsSync(jsonl) ? readFileSync(jsonl, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
const toutes = [...anciennes, ...resultat.infos];
writeFileSync(jsonl, toutes.map((i) => JSON.stringify(i)).join('\n') + (toutes.length ? '\n' : ''));
writeFileSync(fichier(`${semaine}.md`), journalMarkdown(toutes, { semaine, muettes: sourcesMuettes(resultat.etat) }));
writeFileSync(fichier('etat.json'), `${JSON.stringify(resultat.etat, null, 2)}\n`);
writeFileSync(fichier('vus.txt'), `${[...resultat.vus].sort().join('\n')}\n`);

const muettes = sourcesMuettes(resultat.etat);
console.log(`Veille ${jour} (${semaine}) : ${resultat.infos.length} information(s) nouvelle(s), ${sources.length} source(s), ${muettes.length} muette(s).`);
for (const s of sources) {
  const e = resultat.etat[s.id];
  console.log(`  ${e?.echecs ? '✖' : '✓'} ${s.id}${e?.echecs ? ` (${e.echecs} échec(s) consécutif(s))` : ''}`);
}
