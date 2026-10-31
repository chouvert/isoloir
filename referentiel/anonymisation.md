# Anonymisation des duels à l'aveugle

Dans les duels à l'aveugle, chaque mesure est montrée sans le nom de son auteur. Le texte affiché
est celui de la proposition de la fiche (colonne `proposition` du tableau des dilemmes), nettoyé
automatiquement : liens et sources supprimés, passages entre parenthèses ou crochets supprimés,
guillemets retirés (le texte cité reste, en prose).

Quand le texte nettoyé dépasse 300 caractères ou contient un terme interdit, on écrit un **texte
court** dans la colonne `texte court` du tableau des dilemmes de la fiche : reformulation neutre et
fidèle de la proposition, 300 caractères au plus, sans guillemets, nom, parenthèse ni source. Il est
montré à la place du texte nettoyé et passe les mêmes contrôles. La source de la proposition est
montrée à la révélation de l'auteur.

Un texte est **exclu** des duels, avec son motif, s'il est vide après nettoyage, s'il dépasse
300 caractères ou s'il contient un terme interdit (comparaison sans accents ni casse, en mot entier).
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
