#!/usr/bin/env node
// Contrôle de la base. Usage : node scripts/valider.mjs [dossier-racine]
// Code de sortie 1 s'il y a au moins une erreur. Les avertissements ne bloquent pas.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validerBase } from './lib/validation.mjs';

const racine = resolve(process.argv[2] ?? resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const rapport = validerBase(racine);
const enCI = process.env.GITHUB_ACTIONS === 'true';

function afficher(niveau, { fichier, ligne, message }) {
  if (enCI) {
    // Annotations affichées directement sur les fichiers dans la pull request.
    console.log(`::${niveau === 'erreur' ? 'error' : 'warning'} file=${fichier},line=${ligne}::${message}`);
  } else {
    console.log(`${niveau === 'erreur' ? '✖' : '⚠'} ${fichier}:${ligne}  ${message}`);
  }
}

rapport.erreurs.forEach((c) => afficher('erreur', c));
rapport.avertissements.forEach((c) => afficher('avertissement', c));

const bilan = `${rapport.erreurs.length} erreur(s), ${rapport.avertissements.length} avertissement(s)`;
console.log(rapport.erreurs.length ? `\nContrôle en échec : ${bilan}` : `\nBase valide : ${bilan}`);
process.exit(rapport.erreurs.length ? 1 : 0);
