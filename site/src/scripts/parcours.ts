// Parcours « Me situer » : vos sujets (réglage facultatif des poids), dilemmes, duels à l'aveugle, résultat.
// Tout le calcul se fait ici, dans le navigateur, avec les modules testés de scripts/lib.
// Les réponses ne vivent qu'en mémoire, le temps de la visite : rien n'est conservé ni envoyé,
// et recharger la page efface le parcours (README, « Calcul de proximité »).
import { preremplirBudget, ordonnerDilemmes, niveauxDepuisBudget, budgetDepuisNiveaux, rapportSujets, PARCOURS } from '../../../scripts/lib/parcours.mjs';
import { calculerProximite, SEUILS, SANS_AVIS } from '../../../scripts/lib/proximite.mjs';
import { preparerDuels, evaluerDuels } from '../../../scripts/lib/duels.mjs';

type Option = { option: string; libelle: string; contrepartie: string };
type Dilemme = { id: string; theme: string; statut: string; enonce: string; options: Option[]; voisines: string[][] };
type Preoccupation = { id: string; libelle: string; explication: string; principal: string; secondaire: string | null; dilemme: string | null };
type Candidat = { id: string; nom: string; reponses: Record<string, string> };
type Participant = { candidat: string; proposition: string; texte: string };
type Donnees = {
  themes: { id: string; libelle: string }[];
  preoccupations: Preoccupation[];
  dilemmes: Dilemme[];
  candidats: Candidat[];
  participants: Record<string, Record<string, Participant[]>>;
  liens: { candidats: string; methode: string; comparer: string };
};
type Cote = { candidat: string; option: string; proposition: string; texte: string; utilisateur: boolean };
type Duel = { dilemme: string; optionUtilisateur: string; gauche: Cote; droite: Cote };
type Etape = 'accueil' | 'preoccupations' | 'reglage' | 'dilemmes' | 'intro-duels' | 'duels' | 'resultat';
type Etat = {
  etape: Etape;
  ordrePreoccupations: string[];
  choisies: string[];
  points: Record<string, number>;
  /** Réglage manuel des poids ; null tant qu'aucune réglette n'a été déplacée. */
  niveaux: Record<string, number> | null;
  avisReglage: boolean;
  ordre: string[];
  ordreOptions: Record<string, string[]>;
  index: number;
  reponses: Record<string, string>;
  duels: Duel[];
  choixDuels: string[];
  indexDuel: number;
  vue: 'themes' | 'synthese';
};

const ETAPES: Etape[] = ['preoccupations', 'dilemmes', 'duels'];
const RANG_ETAPE: Partial<Record<Etape, number>> = { preoccupations: 0, reglage: 0, dilemmes: 1, 'intro-duels': 2, duels: 2 };

/** Niveau d'une réglette dit en mots (lecteurs d'écran et libellé affiché). */
const motNiveau = (n: number) => (n === 0 ? 'ne compte pas' : n <= 3 ? 'compte peu' : n <= 6 ? 'compte' : 'compte beaucoup');

const echapper = (s: unknown) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function melanger<T>(liste: T[]): T[] {
  const l = [...liste];
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [l[i], l[j]] = [l[j], l[i]];
  }
  return l;
}

/** « Contexte. Question ? » → { contexte, question } (la question est la dernière phrase). */
function decouper(enonce: string) {
  const texte = enonce.replace(/\s+/g, ' ').trim();
  const m = texte.match(/^(.*[.!])\s+([^.!]*\?)$/);
  return m ? { contexte: m[1], question: m[2] } : { contexte: '', question: texte };
}

const bulletin = (coche: boolean, taille = 22) => `<svg class="case" aria-hidden="true" width="${taille * 0.79}" height="${taille}" viewBox="0 0 22 28">
  <rect x="1.5" y="1.5" width="19" height="25" rx="2" stroke-width="2"/>${coche ? '<path d="M5.5 14.5l4 4 7-8" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' : ''}</svg>`;

const rideauMini = `<svg class="rideau-mini" aria-hidden="true" width="26" height="30" viewBox="0 0 26 30">
  <rect x="0" y="0" width="26" height="3" rx="1.5" fill="var(--encre)"/>
  <path d="M1 3 H12 C9 12 9 21 12 30 H1 Z" fill="var(--petrole)"/><path d="M25 3 H18 C20 12 20 21 18 30 H25 Z" fill="var(--petrole)"/></svg>`;

export function demarrer(racine: HTMLElement, d: Donnees) {
  const dilemmes = new Map(d.dilemmes.map((x) => [x.id, x]));
  const preoccupations = new Map(d.preoccupations.map((p) => [p.id, p]));
  const themes = new Map(d.themes.map((t) => [t.id, t]));
  const noms = new Map(d.candidats.map((c) => [c.id, c.nom]));
  // Format attendu par les modules de calcul : options sous forme de lettres.
  const dilemmesCalcul = new Map(d.dilemmes.map((x) => [x.id, {
    theme: x.theme, statut: x.statut, voisines: x.voisines, options: x.options.map((o) => o.option),
  }]));

  const idsThemes = d.themes.map((t) => t.id);
  const budgetSujets = (choisies: string[]): Record<string, number> => preremplirBudget({ themes: idsThemes, preoccupations, choisies });
  const sommeNiveaux = (n: Record<string, number>) => Object.values(n).reduce((s, v) => s + v, 0);

  const nouvelEtat = (): Etat => ({
    etape: 'accueil',
    ordrePreoccupations: melanger(d.preoccupations.map((p) => p.id)),
    choisies: [], points: budgetSujets([]), niveaux: null, avisReglage: false,
    ordre: [], ordreOptions: {}, index: 0, reponses: {},
    duels: [], choixDuels: [], indexDuel: 0, vue: 'themes',
  });

  let etat: Etat = nouvelEtat();
  const aller = (e: Partial<Etat>) => { etat = { ...etat, ...e }; afficher(true); };

  const repondus = () => etat.ordre.filter((id) => etat.reponses[id] && etat.reponses[id] !== SANS_AVIS).length;

  function proximite() {
    const reponses: Record<string, string> = {};
    for (const id of etat.ordre) if (etat.reponses[id]) reponses[id] = etat.reponses[id];
    return calculerProximite({ dilemmes: dilemmesCalcul, pointsThemes: etat.points, reponses, candidats: d.candidats });
  }

  // ---------- éléments communs ----------

  function tringle(etape: Etape) {
    const i = RANG_ETAPE[etape] ?? 0;
    let fraction = i / (ETAPES.length - 1);
    if (etape === 'dilemmes' && etat.ordre.length) fraction = (1 + etat.index / etat.ordre.length) / 2;
    const anneaux = ETAPES.map((_, k) => `<span class="anneau ${k < i ? 'fait' : k === i ? 'encours' : ''}"></span>`).join('');
    const libelles = ['vos sujets', 'les dilemmes', 'les duels'];
    return `<div class="tringle-etapes" role="img" aria-label="Étape ${i + 1} sur ${ETAPES.length} : ${libelles[i]}">
      <span class="rail"></span><span class="rempli" style="width: calc((100% - 14px) * ${Math.min(1, fraction).toFixed(3)})"></span>
      <span class="anneaux">${anneaux}</span></div>`;
  }

  // ---------- écrans ----------

  function ecranAccueil() {
    const enCours = etat.choisies.length > 0 || Object.keys(etat.reponses).length > 0;
    return `<section class="etape" tabindex="-1">
      <h1 class="titre-2">Me situer</h1>
      <p class="voix">Il n’y a pas de mauvaise réponse.</p>
      <p>En une dizaine de minutes, voyez de quels programmes vous êtes proche, thème par thème. Le parcours se fait en trois étapes :</p>
      <ol>
        <li>vos sujets : jusqu’à 3 sujets qui comptent le plus pour vous ;</li>
        <li>les dilemmes : des arbitrages concrets, chacun avec sa contrepartie ;</li>
        <li>les duels à l’aveugle : des mesures à comparer sans savoir de qui elles viennent.</li>
      </ol>
      <p class="legende">Le calcul se fait sur votre appareil. Vos réponses ne sont ni envoyées ni conservées : recharger la page efface le parcours.
        <a href="${d.liens.methode}">Comment la proximité est calculée</a></p>
      <div class="actions">
        <button class="bouton" data-action="commencer">${enCours ? 'Reprendre où j’en étais' : 'Commencer'}</button>
        ${enCours ? '<button class="lien-bouton" data-action="recommencer">Recommencer depuis le début</button>' : ''}
      </div>
    </section>`;
  }

  function ecranPreoccupations() {
    const n = etat.choisies.length;
    const items = etat.ordrePreoccupations.map((id) => {
      const p = preoccupations.get(id)!;
      const coche = etat.choisies.includes(id);
      const bloque = !coche && n >= PARCOURS.maxPreoccupations;
      return `<li><button class="choix" role="checkbox" aria-checked="${coche}" ${bloque ? 'disabled' : ''} data-action="preoccupation" data-id="${id}">
        ${bulletin(coche)}<span><span class="libelle">${echapper(p.libelle)}</span><span class="detail">${echapper(p.explication)}</span></span>
      </button></li>`;
    }).join('');
    const rapport = rapportSujets({ themes: idsThemes, preoccupations, choisies: etat.choisies });
    const effet = rapport === null ? 'Aucun sujet choisi.'
      : `${n === 1 ? '1 sujet choisi' : `${n} sujets choisis${n === PARCOURS.maxPreoccupations ? ', le maximum' : ''}`}. Leurs thèmes compteront environ ${rapport} fois plus qu’un thème non choisi.`;
    return `${tringle('preoccupations')}<section class="etape" tabindex="-1">
      <p class="voix">Il n’y a pas de mauvaise réponse.</p>
      <h1 class="titre-2">Qu’est-ce qui compte le plus pour vous ?</h1>
      <p class="secondaire">Choisissez jusqu’à ${PARCOURS.maxPreoccupations} sujets.</p>
      <div class="a-quoi"><strong>À quoi ça sert</strong>
        <p>Vos sujets pèseront plus que les autres dans votre résultat, et les questions commenceront par eux.</p></div>
      ${etat.avisReglage ? '<p class="legende" role="status">Votre réglage a été remplacé par celui de vos nouveaux sujets.</p>' : ''}
      <ul class="choix-liste defile" aria-label="Sujets">${items}</ul>
      <p class="legende" aria-live="polite">${effet}</p>
      <div class="actions">
        <button class="bouton" data-action="vers-dilemmes" ${n === 0 ? 'disabled' : ''}>Passer aux questions${n ? ` avec ${n} sujet${n > 1 ? 's' : ''}` : ''}</button>
        <button class="lien-bouton" data-action="aucune-preoccupation">Tout compte autant</button>
        <button class="lien-bouton" data-action="vers-reglage">Régler moi-même</button>
      </div>
      <button class="lien-bouton" data-action="vers-accueil">Retour</button>
    </section>`;
  }

  function ecranReglage() {
    const niveaux = etat.niveaux ?? niveauxDepuisBudget(etat.points);
    const vide = sommeNiveaux(niveaux) === 0;
    const lignes = d.themes.map((t) => {
      const v = niveaux[t.id] ?? 0;
      return `<li><label for="niv-${t.id}">${echapper(t.libelle)}</label><span class="mot" data-mot="${t.id}">${motNiveau(v)}</span>
        <input id="niv-${t.id}" type="range" min="0" max="${PARCOURS.niveauMax}" step="1" value="${v}" aria-valuetext="${motNiveau(v)}" data-action="niveau" data-id="${t.id}"></li>`;
    }).join('');
    return `${tringle('reglage')}<section class="etape" tabindex="-1">
      <p class="surtitre">Réglage facultatif</p>
      <h1 class="titre-2">Le poids de chaque thème</h1>
      <p class="secondaire">${etat.choisies.length ? 'Déjà réglé d’après vos sujets.' : 'Tous les thèmes comptent autant pour commencer.'} Poussez une réglette à droite pour qu’un thème compte plus, tout à gauche pour l’écarter : ses questions ne seront pas posées.</p>
      <p class="echelle" aria-hidden="true"><span>Ne compte pas</span><span>Compte beaucoup</span></p>
      <ul class="reglettes">${lignes}</ul>
      <p class="legende" id="avis-reglage" role="status" ${vide ? '' : 'hidden'}>Gardez au moins un thème.</p>
      <div class="actions">
        <button class="bouton" id="fin-reglage" data-action="vers-dilemmes" ${vide ? 'disabled' : ''}>Passer aux questions</button>
        <button class="lien-bouton" data-action="vers-preoccupations">Revenir à mes sujets</button>
      </div>
    </section>`;
  }

  function apercu() {
    const n = repondus();
    if (n < SEUILS.minReponses) {
      const reste = SEUILS.minReponses - n;
      return `<aside class="apercu" aria-label="Aperçu de vos proximités">${rideauMini}<p><strong class="titre">Aperçu de vos proximités</strong>
        Il apparaîtra après ${SEUILS.minReponses} réponses, encore ${reste}.</p></aside>`;
    }
    const r = proximite();
    // Groupes d'égalité entiers, jusqu'à au moins trois noms : on ne coupe jamais une égalité.
    const ids: string[] = [];
    for (const g of r.groupes as string[][]) { if (ids.length >= 3) break; ids.push(...g); }
    const liste = ids.map((id: string) => `<strong>${echapper(noms.get(id))}</strong>`);
    const phrase = liste.length > 1 ? `${liste.slice(0, -1).join(', ')} et ${liste[liste.length - 1]}` : liste[0] ?? '';
    return `<aside class="apercu" aria-label="Aperçu de vos proximités">${rideauMini}<p><strong class="titre">Aperçu après ${n} réponses</strong>
      ${phrase ? `À ce stade, vous êtes proche de ${phrase}. Cela peut encore bouger.` : 'Pas encore assez de positions connues pour un aperçu.'}</p></aside>`;
  }

  function ecranDilemme() {
    const id = etat.ordre[etat.index];
    const dil = dilemmes.get(id)!;
    const { contexte, question } = decouper(dil.enonce);
    const ordreOptions = etat.ordreOptions[id] ?? dil.options.map((o) => o.option);
    const choisi = etat.reponses[id];
    const options = ordreOptions.map((lettre) => {
      const o = dil.options.find((x) => x.option === lettre)!;
      const coche = choisi === lettre;
      return `<li><button class="choix" role="radio" aria-checked="${coche}" data-action="option" data-option="${lettre}">
        ${bulletin(coche, 20)}<span><span class="libelle">${echapper(o.libelle)}</span><span class="detail">En contrepartie : ${echapper(o.contrepartie.charAt(0).toLowerCase() + o.contrepartie.slice(1))}</span></span>
      </button></li>`;
    }).join('');
    const n = repondus();
    return `${tringle('dilemmes')}<section class="etape" tabindex="-1">
      <p class="surtitre">Dilemme ${etat.index + 1} sur ${etat.ordre.length}</p>
      <h1 class="titre-2">${echapper(themes.get(dil.theme)?.libelle)}</h1>
      ${contexte ? `<p class="voix contexte-dilemme">${echapper(contexte)}</p>` : ''}
      <h2 class="question">${echapper(question)}</h2>
      <ul class="choix-liste" role="radiogroup" aria-label="Options">${options}</ul>
      <div class="actions">
        <button class="bouton-second" data-action="sans-avis" aria-pressed="${choisi === SANS_AVIS}">Sans avis</button>
        <button class="lien-bouton" data-action="precedent">${etat.index > 0 ? 'Dilemme précédent' : 'Revenir à mes sujets'}</button>
        ${n >= SEUILS.minReponses && etat.index < etat.ordre.length - 1 ? '<button class="lien-bouton" data-action="fin-dilemmes">Arrêter ici et passer aux duels</button>' : ''}
      </div>
      ${apercu()}
    </section>`;
  }

  function ecranIntroDuels() {
    const n = etat.duels.length;
    return `${tringle('intro-duels')}<section class="etape" tabindex="-1">
      <p class="voix">Dernière étape.</p>
      <h1 class="titre-2">Et sans les noms, choisiriez-vous pareil ?</h1>
      <p>Pour finir, ${n === 1 ? '1 comparaison' : `${n} comparaisons`} sans les noms : ${n === 1 ? 'elle vous montre' : 'elles vous montrent'} si, à l’aveugle, vous préférez les mesures qui vont avec vos réponses.</p>
      <p class="legende">Les duels ne changent pas votre résultat.</p>
      <div class="actions">
        <button class="bouton" data-action="commencer-duels">Commencer</button>
        <button class="lien-bouton" data-action="duel-precedent">Revenir aux dilemmes</button>
      </div>
    </section>`;
  }

  function ecranDuel() {
    const duel = etat.duels[etat.indexDuel];
    const choix = etat.choixDuels[etat.indexDuel];
    const dil = dilemmes.get(duel.dilemme)!;
    const bouton = (cote: 'gauche' | 'droite') => `<button class="choix mesure-duel" aria-pressed="${choix === cote}" data-action="duel" data-choix="${cote}"
        aria-label="Choisir cette mesure : ${echapper(duel[cote].texte)}">${bulletin(choix === cote)}<span class="libelle">${echapper(duel[cote].texte)}</span></button>`;
    return `${tringle('duels')}<section class="etape" tabindex="-1">
      <p class="surtitre">Duel ${etat.indexDuel + 1} sur ${etat.duels.length}</p>
      <div class="contexte-duel"><strong>Le sujet : ${echapper(themes.get(dil.theme)?.libelle)}</strong>
        <p>${echapper(dil.enonce.replace(/\s+/g, ' ').trim())}</p></div>
      <h1 class="titre-2">Deux candidats proposent ceci. Que préférez-vous ?</h1>
      ${bouton('gauche')}
      <p class="ou voix" aria-hidden="true">ou</p>
      ${bouton('droite')}
      <div class="actions">
        <button class="bouton-second" data-action="duel" data-choix="les deux" aria-pressed="${choix === 'les deux'}">Les deux</button>
        <button class="bouton-second" data-action="duel" data-choix="aucune" aria-pressed="${choix === 'aucune'}">Aucune des deux</button>
        <button class="lien-bouton" data-action="duel-precedent">${etat.indexDuel > 0 ? 'Duel précédent' : 'Retour'}</button>
      </div>
      <p class="legende">Les noms des deux candidats apparaîtront après le dernier duel. Votre résultat ne change pas.</p>
    </section>`;
  }

  function pastille(accord: number | null) {
    if (accord === 1) return '<span class="pastille fort">Même choix</span>';
    if (accord === 0.5) return '<span class="pastille voisin">Choix voisin</span>';
    if (accord === 0) return '<span class="pastille autre">Autre choix</span>';
    return '<span class="pastille sans">Pas de position</span>';
  }

  const libelleOption = (idDil: string, lettre: string) => {
    const o = dilemmes.get(idDil)?.options.find((x) => x.option === lettre);
    if (o) return o.libelle;
    if (lettre === 'aucune') return 'une autre approche que les options proposées';
    return 'pas de position trouvée';
  };

  function ecranResultat() {
    const r = proximite();
    const rideau = `<svg class="rideau-ouvert" viewBox="0 0 390 120" preserveAspectRatio="none" aria-hidden="true">
      <rect x="0" y="0" width="390" height="6" rx="3" fill="var(--encre)"/>
      <path d="M0 6 H70 C40 40 26 64 30 80 C38 96 44 108 36 120 H0 Z" fill="currentColor"/>
      <path d="M390 6 H320 C350 40 364 64 360 80 C352 96 346 108 354 120 H390 Z" fill="currentColor"/></svg>`;
    if (!r.suffisant) {
      return `<section class="etape resultat" tabindex="-1">${rideau}
        <h1 class="titre-2">Encore quelques réponses</h1>
        <p>Le résultat s’affiche à partir de ${r.minimum} dilemmes répondus (hors « sans avis »). Vous en avez ${r.nbReponses}.</p>
        <div class="actions"><button class="bouton" data-action="reprendre-dilemmes">Répondre à d’autres dilemmes</button></div>
      </section>`;
    }
    const parId = new Map(r.candidats.map((c: any) => [c.id, c]));
    const lien = (id: string) => `<a href="${d.liens.candidats}${id}/">${echapper(noms.get(id))}</a>`;
    const rang = (id: string, score: number) => `<li class="rang">${lien(id)}<span class="score">${score} %</span>
      <span class="barre" aria-hidden="true"><span style="width:${score}%"></span></span></li>`;

    // Vue par thème : l'affichage principal (méthode, section 4).
    const themesRepondus = d.themes.filter((t) => (etat.points[t.id] ?? 0) > 0
      && etat.ordre.some((id) => dilemmes.get(id)!.theme === t.id && etat.reponses[id] && etat.reponses[id] !== SANS_AVIS));
    const vueThemes = themesRepondus.map((t) => {
      const lignes = r.candidats
        .map((c: any) => ({ id: c.id, nom: c.nom, s: c.parTheme[t.id]?.score }))
        .filter((x: any) => x.s !== null && x.s !== undefined)
        .sort((a: any, b: any) => b.s - a.s || a.nom.localeCompare(b.nom, 'fr'));
      // Les 3 plus proches d'abord ; les autres restent à un clic (tous gardent le même traitement).
      // Un candidat à égalité avec le troisième est montré lui aussi : la coupure ne départage personne.
      const seuil = lignes[Math.min(2, lignes.length - 1)]?.s ?? 0;
      const premiers = lignes.filter((x: any) => x.s >= seuil);
      const autres = lignes.filter((x: any) => x.s < seuil);
      return `<section class="bloc-resultat"><h3>${echapper(t.libelle)}</h3>
        <ul class="rangs">${premiers.map((x: any) => rang(x.id, x.s)).join('')}</ul>
        ${autres.length ? `<details class="detail-candidat"><summary>Voir les ${autres.length} autres candidats</summary>
          <ul class="rangs" style="margin-top:10px">${autres.map((x: any) => rang(x.id, x.s)).join('')}</ul></details>` : ''}</section>`;
    }).join('');

    // Synthèse : groupes d'égalité, puis le détail dilemme par dilemme.
    const groupes = r.groupes.map((g: string[]) => {
      const items = g.map((id) => {
        const c: any = parId.get(id);
        const note = c.affichage === 'incomplet' ? '<p class="legende">Score indicatif : positions connues sur une partie seulement de vos dilemmes.</p>' : '';
        const detail = c.detail.map((l: any) => `<li>${pastille(l.accord)} ${echapper(decouper(dilemmes.get(l.dilemme)!.enonce).question)}<br>
          <span class="legende">Vous : ${echapper(libelleOption(l.dilemme, l.utilisateur))}. ${echapper(c.nom)} : ${echapper(libelleOption(l.dilemme, l.candidat))}.</span></li>`).join('');
        return `${rang(id, c.score)}<li>${note}<details class="detail-candidat"><summary>Le détail, dilemme par dilemme</summary><ul class="lignes-detail">${detail}</ul></details></li>`;
      }).join('');
      return g.length > 1
        ? `<div class="groupe-egalite"><p class="legende">À égalité, à moins de ${SEUILS.ecartEgalite} points d’écart :</p><ul class="rangs">${items}</ul></div>`
        : `<ul class="rangs">${items}</ul>`;
    }).join('');
    const sansScore = r.sansScore.length
      ? `<p class="legende">Pas assez de positions connues sur vos dilemmes pour un score : ${r.sansScore.map((id: string) => echapper(noms.get(id))).join(', ')}.</p>` : '';
    const vueSynthese = `<section class="bloc-resultat"><h3>Tous thèmes confondus</h3>${groupes}${sansScore}</section>`;

    // Duels à l'aveugle : indicateur de cohérence puis révélation des auteurs.
    let duels = '';
    if (etat.duels.length) {
      const ev = evaluerDuels(etat.duels, etat.choixDuels);
      const indicateur = ev.taux !== null
        ? `${ev.coherents} duel${ev.coherents > 1 ? 's' : ''} cohérent${ev.coherents > 1 ? 's' : ''} sur ${ev.comptes} comptés`
        : 'Pas assez de duels comptés pour un indicateur';
      const items = etat.duels.map((du, i) => {
        const st = ev.details[i].statut;
        const cote = (c: Cote) => `<p>${echapper(c.texte)} <span class="legende">(${echapper(noms.get(c.candidat))})</span></p>`;
        const ecart = st === 'écart'
          ? `<p class="legende">Au dilemme, vous avez choisi « ${echapper(libelleOption(du.dilemme, du.optionUtilisateur))} » ; à l’aveugle, vous avez préféré une mesure d’une autre option. <button class="lien-bouton" data-action="revoir" data-id="${du.dilemme}">Revoir ce dilemme</button></p>` : '';
        return `<li><p><strong>${st === 'cohérent' ? 'Cohérent' : st === 'écart' ? 'Écart' : 'Non compté'}</strong> · ${echapper(decouper(dilemmes.get(du.dilemme)!.enonce).question)}</p>${cote(du.gauche)}${cote(du.droite)}${ecart}</li>`;
      }).join('');
      duels = `<section class="bloc-resultat"><h3>Duels à l’aveugle</h3><p>${indicateur}.</p>
        <details class="detail-candidat"><summary>Voir les ${etat.duels.length} duels et leurs auteurs</summary>
        <ul class="duels-revelation" style="margin-top:12px">${items}</ul></details></section>`;
    }

    return `<section class="etape resultat" tabindex="-1">${rideau}
      <p class="voix">Le rideau s’ouvre.</p>
      <h1 class="titre-2">Les programmes proches de vos choix</h1>
      <p class="legende">D’après ${r.nbReponses} dilemmes répondus et le poids de vos sujets.</p>
      <div class="onglets-resultat" role="tablist" aria-label="Affichage">
        <button role="tab" aria-selected="${etat.vue === 'themes'}" data-action="vue" data-vue="themes">Par thème</button>
        <button role="tab" aria-selected="${etat.vue === 'synthese'}" data-action="vue" data-vue="synthese">Synthèse</button>
      </div>
      ${etat.vue === 'themes' ? vueThemes : vueSynthese}
      ${duels}
      <p class="legende">Ce résultat montre des proximités, pas une consigne de vote. La faisabilité des programmes sera publiée à part, début 2027 ; elle n’entre jamais dans ce calcul.
        <a href="${d.liens.methode}">Comment la proximité est calculée</a></p>
      <div class="actions">
        <a class="bouton" href="${d.liens.comparer}">Comparer les programmes</a>
        <button class="lien-bouton" data-action="reprendre-dilemmes">Modifier mes réponses</button>
        <button class="lien-bouton" data-action="recommencer">Recommencer depuis le début</button>
      </div>
    </section>`;
  }

  // ---------- transitions ----------

  function versDilemmes() {
    const ordre = ordonnerDilemmes({
      dilemmes: dilemmesCalcul, preoccupations, choisies: etat.choisies, points: etat.points,
    });
    const ordreOptions = { ...etat.ordreOptions };
    for (const id of ordre) {
      if (!ordreOptions[id]) ordreOptions[id] = melanger(dilemmes.get(id)!.options.map((o) => o.option));
    }
    const reponses: Record<string, string> = {};
    for (const id of ordre) if (etat.reponses[id]) reponses[id] = etat.reponses[id];
    const premier = ordre.findIndex((id) => !reponses[id]);
    aller({ etape: 'dilemmes', ordre, ordreOptions, reponses, avisReglage: false, index: premier === -1 ? 0 : premier });
  }

  function versDuels() {
    const { duels } = preparerDuels({
      dilemmes: dilemmesCalcul, ordre: etat.ordre, reponses: etat.reponses, participants: d.participants,
    });
    if (!duels.length) { aller({ etape: 'resultat', duels: [], choixDuels: [] }); return; }
    aller({ etape: 'intro-duels', duels, choixDuels: [], indexDuel: 0 });
  }

  function repondre(valeur: string) {
    const id = etat.ordre[etat.index];
    const reponses = { ...etat.reponses, [id]: valeur };
    etat = { ...etat, reponses };
    if (etat.index < etat.ordre.length - 1) aller({ index: etat.index + 1 });
    else versDuels();
  }

  racine.addEventListener('click', (ev) => {
    const cible = (ev.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!cible || (cible as HTMLButtonElement).disabled) return;
    const a = cible.dataset.action;
    switch (a) {
      case 'commencer': {
        const suite: Etape = etat.etape !== 'accueil' ? etat.etape
          : Object.keys(etat.reponses).length ? 'dilemmes' : etat.choisies.length ? 'preoccupations' : 'preoccupations';
        if (suite === 'dilemmes' && !etat.ordre.length) versDilemmes(); else aller({ etape: suite });
        break;
      }
      case 'recommencer':
        etat = nouvelEtat(); aller({ etape: 'preoccupations' }); break;
      case 'vers-accueil': aller({ etape: 'accueil' }); break;
      case 'preoccupation': {
        const id = cible.dataset.id!;
        const choisies = etat.choisies.includes(id) ? etat.choisies.filter((x) => x !== id) : [...etat.choisies, id];
        // Changer de sujets recalcule le poids des thèmes et efface un réglage manuel (annoncé à l'écran).
        etat = { ...etat, choisies, points: budgetSujets(choisies), niveaux: null, avisReglage: etat.avisReglage || etat.niveaux !== null };
        afficher(false, `[data-id="${id}"]`); break;
      }
      case 'aucune-preoccupation':
        etat = { ...etat, choisies: [], points: budgetSujets([]), niveaux: null };
        versDilemmes(); break;
      case 'vers-reglage': aller({ etape: 'reglage', avisReglage: false }); break;
      case 'vers-preoccupations':
        // Un réglage laissé entièrement à zéro n'est pas gardé : on revient au poids des sujets.
        if (etat.niveaux && sommeNiveaux(etat.niveaux) === 0) etat = { ...etat, niveaux: null, points: budgetSujets(etat.choisies) };
        aller({ etape: 'preoccupations' }); break;
      case 'vers-dilemmes': versDilemmes(); break;
      case 'option': repondre(cible.dataset.option!); break;
      case 'sans-avis': repondre(SANS_AVIS); break;
      case 'precedent':
        if (etat.index > 0) aller({ index: etat.index - 1 }); else aller({ etape: 'preoccupations' });
        break;
      case 'fin-dilemmes': versDuels(); break;
      case 'commencer-duels': aller({ etape: 'duels' }); break;
      case 'duel': {
        const choixDuels = [...etat.choixDuels];
        choixDuels[etat.indexDuel] = cible.dataset.choix!;
        if (etat.indexDuel < etat.duels.length - 1) aller({ choixDuels, indexDuel: etat.indexDuel + 1 });
        else aller({ choixDuels, etape: 'resultat' });
        break;
      }
      case 'duel-precedent':
        if (etat.etape === 'duels' && etat.indexDuel > 0) aller({ indexDuel: etat.indexDuel - 1 });
        else if (etat.etape === 'duels') aller({ etape: 'intro-duels' });
        else aller({ etape: 'dilemmes', index: Math.max(0, etat.ordre.length - 1) });
        break;
      case 'vue': etat = { ...etat, vue: cible.dataset.vue as Etat['vue'] }; afficher(false, `[data-vue="${etat.vue}"]`); break;
      case 'reprendre-dilemmes': aller({ etape: 'dilemmes', index: 0 }); break;
      case 'revoir': aller({ etape: 'dilemmes', index: Math.max(0, etat.ordre.indexOf(cible.dataset.id!)) }); break;
    }
  });

  // Réglettes : l'écran n'est pas redessiné pendant le geste (la réglette serait remplacée sous le doigt) ;
  // seuls le libellé du niveau, l'avertissement et le bouton sont mis à jour.
  racine.addEventListener('input', (ev) => {
    const champ = ev.target as HTMLInputElement;
    if (champ.dataset.action !== 'niveau') return;
    const id = champ.dataset.id!;
    const v = Math.max(0, Math.min(PARCOURS.niveauMax, Math.round(Number(champ.value) || 0)));
    const niveaux = { ...(etat.niveaux ?? niveauxDepuisBudget(etat.points)), [id]: v };
    const vide = sommeNiveaux(niveaux) === 0;
    etat = { ...etat, niveaux, points: vide ? etat.points : budgetDepuisNiveaux({ niveaux }) };
    champ.setAttribute('aria-valuetext', motNiveau(v));
    const mot = racine.querySelector<HTMLElement>(`[data-mot="${id}"]`);
    if (mot) mot.textContent = motNiveau(v);
    const avis = racine.querySelector<HTMLElement>('#avis-reglage');
    if (avis) avis.hidden = !vide;
    const fin = racine.querySelector<HTMLButtonElement>('#fin-reglage');
    if (fin) fin.disabled = vide;
  });

  /** Redessine l'écran ; au changement d'étape, place le focus sur son titre (lecteurs d'écran). */
  function afficher(nouvelleEtape = true, garderFocus?: string) {
    const ecrans: Record<Etape, () => string> = {
      accueil: ecranAccueil, preoccupations: ecranPreoccupations, reglage: ecranReglage,
      dilemmes: ecranDilemme, 'intro-duels': ecranIntroDuels, duels: ecranDuel, resultat: ecranResultat,
    };
    if (etat.etape === 'dilemmes' && !etat.ordre.length) etat.etape = 'preoccupations';
    if ((etat.etape === 'duels' || etat.etape === 'intro-duels') && !etat.duels.length) etat.etape = 'resultat';
    const defilement = nouvelleEtape ? 0 : racine.querySelector('.defile')?.scrollTop ?? 0;
    racine.innerHTML = ecrans[etat.etape]();
    const liste = racine.querySelector('.defile');
    if (liste) liste.scrollTop = defilement;
    if (nouvelleEtape) {
      const section = racine.querySelector<HTMLElement>('.etape');
      section?.focus({ preventScroll: true });
      window.scrollTo({ top: 0 });
    } else if (garderFocus) {
      racine.querySelector<HTMLElement>(garderFocus)?.focus();
    }
  }

  afficher(false);
}
