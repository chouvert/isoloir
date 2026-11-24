// Moyenne des sondages pour le rapport de la mise à jour hebdomadaire (voir CLAUDE.md).
// Usage : npm run sondages -- [--date AAAA-MM-JJ] [--releve chemin.json]
// Affiche la section « Sondages — moyenne » du corps de la PR, puis la ligne du résumé final.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FICHIER_SONDAGES, erreursReleve, rapportSondages } from './lib/sondages.mjs';

const args = process.argv.slice(2);
const option = (nom) => { const i = args.indexOf(`--${nom}`); return i >= 0 ? args[i + 1] : undefined; };
const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chemin = resolve(option('releve') ?? resolve(racine, FICHIER_SONDAGES));
const date = option('date') ?? new Date().toISOString().slice(0, 10);

const releve = JSON.parse(readFileSync(chemin, 'utf8'));
const erreurs = erreursReleve(releve);
if (erreurs.length) {
  erreurs.forEach((e) => console.error(`✖ ${e}`));
  process.exit(1);
}
const { section, resume } = rapportSondages(releve, date);
console.log(section);
console.log(`Résumé : ${resume}`);
