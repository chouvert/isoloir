// Parcours « Me situer » : préoccupations, priorités, dilemmes, duels à l'aveugle, résultat.
// Tout le calcul se fait ici, dans le navigateur, avec les modules testés de scripts/lib.
// Les réponses restent sur l'appareil (localStorage) ; rien n'est envoyé.
import { preremplirBudget, ordonnerDilemmes, PARCOURS } from '../../../scripts/lib/parcours.mjs';
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
type Etape = 'accueil' | 'preoccupations' | 'priorites' | 'dilemmes' | 'duels' | 'resultat';
type Etat = {
  etape: Etape;
  ordrePreoccupations: string[];
  choisies: string[];
  points: Record<string, number>;
  ordre: string[];
  ordreOptions: Record<string, string[]>;
  index: number;
  reponses: Record<string, string>;
  duels: Duel[];
  choixDuels: string[];
  indexDuel: number;
  vue: 'themes' | 'synthese';
};

const CLE = 'isoloir-parcours-v1';
const ETAPES: Etape[] = ['preoccupations', 'priorites', 'dilemmes', 'duels'];

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

  const nouvelEtat = (): Etat => ({
    etape: 'accueil',
    ordrePreoccupations: melanger(d.preoccupations.map((p) => p.id)),
    choisies: [], points: {}, ordre: [], ordreOptions: {}, index: 0, reponses: {},
    duels: [], choixDuels: [], indexDuel: 0, vue: 'themes',
  });

  let etat: Etat = nouvelEtat();
  try {
    const lu = JSON.parse(localStorage.getItem(CLE) ?? 'null');
    if (lu && lu.ordrePreoccupations?.length === d.preoccupations.length) etat = { ...nouvelEtat(), ...lu };
  } catch { /* stockage indisponible : le parcours fonctionne quand même, sans reprise */ }

  const sauver = () => { try { localStorage.setItem(CLE, JSON.stringify(etat)); } catch { /* idem */ } };
  const aller = (e: Partial<Etat>) => { etat = { ...etat, ...e }; sauver(); afficher(true); };

  const repondus = () => etat.ordre.filter((id) => etat.reponses[id] && etat.reponses[id] !== SANS_AVIS).length;

  function proximite() {
    const reponses: Record<string, string> = {};
    for (const id of etat.ordre) if (etat.reponses[id]) reponses[id] = etat.reponses[id];
    return calculerProximite({ dilemmes: dilemmesCalcul, pointsThemes: etat.points, reponses, candidats: d.candidats });
  }

  // ---------- éléments communs ----------

  function tringle(etape: Etape) {
    const i = ETAPES.indexOf(etape);
    let fraction = i / (ETAPES.length - 1);
    if (etape === 'dilemmes' && etat.ordre.length) fraction = (2 + etat.index / etat.ordre.length) / 3;
    if (etape === 'duels' && etat.duels.length) fraction = 1;
    const anneaux = ETAPES.map((_, k) => `<span class="anneau ${k < i ? 'fait' : k === i ? 'encours' : ''}"></span>`).join('');
    const libelles = ['vos sujets', 'vos priorités', 'les dilemmes', 'les duels'];
    return `<div class="tringle-etapes" role="img" aria-label="Étape ${i + 1} sur 4 : ${libelles[i]}">
      <span class="rail"></span><span class="rempli" style="width: calc((100% - 14px) * ${Math.min(1, fraction).toFixed(3)})"></span>
      <span class="anneaux">${anneaux}</span></div>`;
  }

  // ---------- écrans ----------

  function ecranAccueil() {
    const enCours = etat.choisies.length > 0 || Object.keys(etat.reponses).length > 0;
    return `<section class="etape" tabindex="-1">
      <h1 class="titre-2">Me situer</h1>
      <p class="voix">Il n’y a pas de mauvaise réponse.</p>
      <p>En une dizaine de minutes, voyez de quels programmes vous êtes proche, thème par thème. Le parcours se fait en quatre étapes :</p>
      <ol>
        <li>vos sujets : jusqu’à 3 préoccupations ;</li>
        <li>vos priorités : 100 points à répartir entre les thèmes ;</li>
        <li>les dilemmes : des arbitrages concrets, chacun avec sa contrepartie ;</li>
        <li>les duels à l’aveugle : des mesures à comparer sans savoir de qui elles viennent.</li>
      </ol>
      <p class="legende">Le calcul se fait sur votre appareil. Vos réponses ne sont ni envoyées ni conservées ailleurs.
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
    return `${tringle('preoccupations')}<section class="etape" tabindex="-1">
      <p class="voix">Il n’y a pas de mauvaise réponse.</p>
      <h1 class="titre-2">Qu’est-ce qui vous préoccupe le plus ?</h1>
      <p class="secondaire">Choisissez jusqu’à 3 sujets parmi les ${d.preoccupations.length} de la liste. Ils préparent l’étape suivante.</p>
      <ul class="choix-liste defile" aria-label="Sujets">${items}</ul>
      <p class="legende" aria-live="polite">${n === 0 ? 'Aucun sujet choisi.' : n === 1 ? '1 sujet choisi.' : `${n} sujets choisis${n === 3 ? ', le maximum' : ''}.`}</p>
      <div class="actions">
        <button class="bouton" data-action="vers-priorites" ${n === 0 ? 'disabled' : ''}>Continuer${n ? ` avec ${n} sujet${n > 1 ? 's' : ''}` : ''}</button>
        <button class="lien-bouton" data-action="aucune-preoccupation">Rien de tout ça en particulier</button>
      </div>
      <button class="lien-bouton" data-action="vers-accueil">Retour</button>
    </section>`;
  }

  function ecranPriorites() {
    const total = Object.values(etat.points).reduce((s, v) => s + v, 0);
    const lignes = d.themes.map((t) => {
      const v = etat.points[t.id] ?? 0;
      return `<li>
        <span class="theme-nom"><label for="pts-${t.id}">${echapper(t.libelle)}</label><span class="jauge"><span style="width:${v}%"></span></span></span>
        <button aria-label="Retirer un point à ${echapper(t.libelle)}" data-action="moins" data-id="${t.id}" ${v <= 0 ? 'disabled' : ''}>−</button>
        <input id="pts-${t.id}" type="number" inputmode="numeric" min="0" max="100" value="${v}" data-action="saisie" data-id="${t.id}">
        <button aria-label="Ajouter un point à ${echapper(t.libelle)}" data-action="plus" data-id="${t.id}" ${total >= 100 ? 'disabled' : ''}>+</button>
      </li>`;
    }).join('');
    const juste = total === PARCOURS.totalPoints;
    const message = juste ? '100 points répartis sur 100'
      : total < 100 ? `${total} points répartis : il en reste ${100 - total} à placer`
      : `${total} points répartis : retirez-en ${total - 100}`;
    return `${tringle('priorites')}<section class="etape" tabindex="-1">
      <p class="voix">Rien n’est figé, vous pourrez y revenir.</p>
      <h1 class="titre-2">Répartissez 100 points entre les thèmes</h1>
      <p class="secondaire">${etat.choisies.length ? 'Pré-rempli d’après vos sujets.' : 'Répartis à parts égales pour commencer.'} Un thème à 0 point n’est pas abordé.</p>
      <ul class="budget">${lignes}</ul>
      <p class="total ${juste ? 'juste' : ''}" aria-live="polite">${message}</p>
      <div class="actions">
        <button class="bouton" data-action="vers-dilemmes" ${juste ? '' : 'disabled'}>Passer aux dilemmes</button>
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
        <button class="lien-bouton" data-action="precedent">${etat.index > 0 ? 'Dilemme précédent' : 'Revenir aux priorités'}</button>
        ${n >= SEUILS.minReponses && etat.index < etat.ordre.length - 1 ? '<button class="lien-bouton" data-action="fin-dilemmes">Arrêter ici et passer aux duels</button>' : ''}
      </div>
      ${apercu()}
    </section>`;
  }

  function ecranDuel() {
    const duel = etat.duels[etat.indexDuel];
    const choix = etat.choixDuels[etat.indexDuel];
    const bouton = (cote: 'gauche' | 'droite') => `<button class="choix mesure-duel" aria-pressed="${choix === cote}" data-action="duel" data-choix="${cote}"
        aria-label="Choisir cette mesure : ${echapper(duel[cote].texte)}">${bulletin(choix === cote)}<span class="libelle">${echapper(duel[cote].texte)}</span></button>`;
    return `${tringle('duels')}<section class="etape" tabindex="-1">
      <p class="surtitre">Duel ${etat.indexDuel + 1} sur ${etat.duels.length}, ${echapper(themes.get(dilemmes.get(duel.dilemme)!.theme)?.libelle)}</p>
      <h1 class="titre-2">Laquelle de ces deux mesures préférez-vous ?</h1>
      <p class="voix">Ne cherchez pas l’auteur, fiez-vous à la mesure. Les noms apparaîtront à la fin.</p>
      ${bouton('gauche')}
      <p class="ou voix" aria-hidden="true">ou</p>
      ${bouton('droite')}
      <div class="actions">
        <button class="bouton-second" data-action="duel" data-choix="les deux" aria-pressed="${choix === 'les deux'}">Les deux</button>
        <button class="bouton-second" data-action="duel" data-choix="aucune" aria-pressed="${choix === 'aucune'}">Aucune des deux</button>
        <button class="lien-bouton" data-action="duel-precedent">${etat.indexDuel > 0 ? 'Duel précédent' : 'Revenir aux dilemmes'}</button>
      </div>
      <p class="legende">Les duels ne changent pas votre proximité. Ils vérifient si vos préférences, sans les noms, rejoignent vos choix aux dilemmes.</p>
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
      return `<section class="bloc-resultat"><h3>${echapper(t.libelle)} <small>${etat.points[t.id]} points</small></h3>
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
      <p class="legende">D’après ${r.nbReponses} dilemmes répondus et vos priorités.</p>
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
    aller({ etape: 'dilemmes', ordre, ordreOptions, reponses, index: premier === -1 ? 0 : premier });
  }

  function versDuels() {
    const { duels } = preparerDuels({
      dilemmes: dilemmesCalcul, ordre: etat.ordre, reponses: etat.reponses, participants: d.participants,
    });
    if (!duels.length) { aller({ etape: 'resultat', duels: [], choixDuels: [] }); return; }
    aller({ etape: 'duels', duels, choixDuels: [], indexDuel: 0 });
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
        try { localStorage.removeItem(CLE); } catch { /* rien */ }
        etat = nouvelEtat(); aller({ etape: 'preoccupations' }); break;
      case 'vers-accueil': aller({ etape: 'accueil' }); break;
      case 'preoccupation': {
        const id = cible.dataset.id!;
        const choisies = etat.choisies.includes(id) ? etat.choisies.filter((x) => x !== id) : [...etat.choisies, id];
        etat = { ...etat, choisies }; sauver(); afficher(false, `[data-id="${id}"]`); break;
      }
      case 'aucune-preoccupation': etat = { ...etat, choisies: [] }; // puis comme « continuer »
      // falls through
      case 'vers-priorites':
        aller({ etape: 'priorites', points: preremplirBudget({ themes: d.themes.map((t) => t.id), preoccupations, choisies: etat.choisies }) });
        break;
      case 'vers-preoccupations': aller({ etape: 'preoccupations' }); break;
      case 'moins': case 'plus': {
        const id = cible.dataset.id!;
        const v = (etat.points[id] ?? 0) + (a === 'plus' ? 1 : -1);
        etat = { ...etat, points: { ...etat.points, [id]: Math.max(0, Math.min(100, v)) } };
        sauver(); afficher(false, `[data-action="${a}"][data-id="${id}"]`); break;
      }
      case 'vers-dilemmes': versDilemmes(); break;
      case 'option': repondre(cible.dataset.option!); break;
      case 'sans-avis': repondre(SANS_AVIS); break;
      case 'precedent':
        if (etat.index > 0) aller({ index: etat.index - 1 }); else aller({ etape: 'priorites' });
        break;
      case 'fin-dilemmes': versDuels(); break;
      case 'duel': {
        const choixDuels = [...etat.choixDuels];
        choixDuels[etat.indexDuel] = cible.dataset.choix!;
        if (etat.indexDuel < etat.duels.length - 1) aller({ choixDuels, indexDuel: etat.indexDuel + 1 });
        else aller({ choixDuels, etape: 'resultat' });
        break;
      }
      case 'duel-precedent':
        if (etat.indexDuel > 0) aller({ indexDuel: etat.indexDuel - 1 });
        else aller({ etape: 'dilemmes', index: Math.max(0, etat.ordre.length - 1) });
        break;
      case 'vue': etat = { ...etat, vue: cible.dataset.vue as Etat['vue'] }; sauver(); afficher(false, `[data-vue="${etat.vue}"]`); break;
      case 'reprendre-dilemmes': aller({ etape: 'dilemmes', index: 0 }); break;
      case 'revoir': aller({ etape: 'dilemmes', index: Math.max(0, etat.ordre.indexOf(cible.dataset.id!)) }); break;
    }
  });

  racine.addEventListener('change', (ev) => {
    const champ = ev.target as HTMLInputElement;
    if (champ.dataset.action !== 'saisie') return;
    const v = Math.max(0, Math.min(100, Math.round(Number(champ.value) || 0)));
    etat = { ...etat, points: { ...etat.points, [champ.dataset.id!]: v } };
    sauver(); afficher(false, `#pts-${champ.dataset.id}`);
  });

  /** Redessine l'écran ; au changement d'étape, place le focus sur son titre (lecteurs d'écran). */
  function afficher(nouvelleEtape = true, garderFocus?: string) {
    const ecrans: Record<Etape, () => string> = {
      accueil: ecranAccueil, preoccupations: ecranPreoccupations, priorites: ecranPriorites,
      dilemmes: ecranDilemme, duels: ecranDuel, resultat: ecranResultat,
    };
    if (etat.etape === 'dilemmes' && !etat.ordre.length) etat.etape = 'priorites';
    if (etat.etape === 'duels' && !etat.duels.length) etat.etape = 'resultat';
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
