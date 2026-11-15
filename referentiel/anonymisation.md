# Anonymisation des duels à l'aveugle

Dans les duels à l'aveugle, chaque mesure est montrée sans le nom de son auteur, **en langage
courant**. Le texte affiché est le **texte court** de la colonne `texte court` du tableau des
dilemmes de la fiche : une reformulation de la proposition qui fonde le rattachement (colonne
`proposition`). Le texte de la proposition elle-même, écrit pour être exact et sourcé, n'est plus
montré dans les duels. La source de la proposition est montrée à la révélation de l'auteur.

## Rédiger un texte court

- **200 caractères au plus, une seule phrase, une seule idée** : la mesure qui fonde le rattachement
  à l'option, pas tout le contenu de la proposition.
- Commence par un **verbe à l'infinitif** ; vocabulaire du quotidien.
- **Pas de sigle non développé** (écrire « impôt sur la fortune », « salaire minimum »), pas de
  « % du PIB », pas de « Md€ » (écrire « milliards d'euros ») ; **au plus un chiffre**, celui qui dit
  la mesure (un âge, un montant, un taux).
- **Fidèle** : rien d'ajouté ; aucun bénéfice ni inconvénient qui ne soit dans la proposition ; aucun
  mot de jugement ; le financement n'est mentionné que s'il fait partie de la mesure.
- **Anonyme** : sans guillemets, nom, parenthèse ni source ; aucun terme interdit (ci-dessous).
- **Même registre pour tous les candidats** : ni slogan, ni citation.

Exemple : « Rétablir un ISF renforcé » devient « Rétablir l'impôt sur la fortune, à un niveau plus
élevé qu'avant ».

Les termes techniques qui restent nécessaires sont expliqués par `referentiel/glossaire.md` : la
même définition pour tous, affichée sous la mesure.

## Exclusions

Un rattachement **ne participe pas** aux duels, avec son motif, s'il n'a pas de texte court, si
celui-ci est vide après nettoyage, s'il dépasse 300 caractères ou s'il contient un terme interdit
(comparaison sans accents ni casse, en mot entier). Au-delà de 200 caractères, `npm run valider`
émet un avertissement.
Les termes interdits sont :

- automatiques, tirés des fiches : nom complet de chaque candidat, son nom de famille et son parti ;
- manuels : le tableau ci-dessous, pour les personnalités et les mots qui trahissent un camp.

Quand la page générée `comparatifs/duels.md` montre un texte qui trahit encore son auteur, ajouter
le terme fautif ici, puis lancer `npm run comparatifs`.

| terme   | motif                                                        |
|---------|--------------------------------------------------------------|
| Jadot   | soutien de Raphaël Glucksmann cité dans sa fiche             |
| Brossat | directeur de campagne de Fabien Roussel cité dans sa fiche   |
| RN      | sigle du Rassemblement national (« le groupe RN »)           |
| président de la République | référence au président sortant, qui situe l'auteur |
| Entrevue | média cité en attribution (« Selon Entrevue : »)            |
