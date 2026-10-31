#!/usr/bin/env node
// Génère les comparatifs (comparatifs/*.md) et l'export de données (donnees/base.json)
// à partir des fiches candidats.
// Usage : node scripts/comparatifs.mjs [--verifier] [dossier-racine]
//   --verifier : n'écrit rien ; code de sortie 1 si un fichier généré n'est pas à jour.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validerBase } from './lib/validation.mjs';
import { lireBase } from './lib/extraction.mjs';
import { genererFichiers } from './lib/generation.mjs';

const args = process.argv.slice(2);
const verifier = args.includes('--verifier');
const racine = resolve(args.find((a) => !a.startsWith('--')) ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));

const rapport = validerBase(racine);
if (rapport.erreurs.length) {
  console.log(`Base invalide (${rapport.erreurs.length} erreur(s)) : lancer « npm run valider » et corriger avant de générer.`);
  process.exit(1);
}

const fichiers = genererFichiers(lireBase(racine));
const perimes = [];
for (const [chemin, contenu] of fichiers) {
  const complet = join(racine, chemin);
  const actuel = existsSync(complet) ? readFileSync(complet, 'utf8') : null;
  if (actuel === contenu) continue;
  perimes.push(chemin);
  if (!verifier) {
    mkdirSync(dirname(complet), { recursive: true });
    writeFileSync(complet, contenu);
  }
}

if (verifier) {
  if (perimes.length) {
    for (const f of perimes) {
      const msg = `${f} n'est pas à jour : lancer « npm run comparatifs » et committer le résultat`;
      console.log(process.env.GITHUB_ACTIONS === 'true' ? `::error file=${f}::${msg}` : `✖ ${msg}`);
    }
    process.exit(1);
  }
  console.log(`Comparatifs à jour (${fichiers.size} fichiers).`);
} else {
  console.log(perimes.length
    ? `${perimes.length} fichier(s) mis à jour sur ${fichiers.size} : ${perimes.join(', ')}`
    : `Rien à changer (${fichiers.size} fichiers à jour).`);
}
