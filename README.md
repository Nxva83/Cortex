# Cortex — visualiseur de système neuronal

Cerveau 3D procédural (~6 700 neurones, ~42 000 synapses) avec simulation d'activité en temps réel.

## Lancer
- Menu des applications : **Cortex**
- Terminal : `./lancer.sh` (ou `npm start`)

## Ce qu'on voit
- **Neurones** colorés par région, qui s'illuminent quand ils déchargent (potentiel d'action).
- **Impulsions** qui voyagent le long des synapses, avec un délai proportionnel à la distance.
- **Faisceaux** longs entre régions (thalamo-corticaux, corps calleux, circuit limbique, voies motrices…).
- **Scénarios** : repos, vision, mouvement, mémoire (thêta), peur, sommeil profond (ondes lentes), crise épileptique.

## Contrôles
Clic sur un neurone ou une région = isoler + fiche · glisser = tourner · molette = zoom
`Espace` pause · `S` stimuler la région sélectionnée · `1`–`7` scénarios · `Échap` désélectionner · `F11` plein écran · `F12` outils dev

## Structure
- `main.js` — fenêtre Electron
- `src/anatomy.js` — régions et placement des neurones
- `src/sim.js` — connectome + simulation (intègre-et-tire à fuite, délais, homéostasie)
- `src/scenarios.js` — scénarios d'activité
- `src/brain.js` — enveloppes 3D (hémisphères plissés, cervelet, tronc)
- `src/app.js` — rendu Three.js, interface, graphique

## Capture (dev)
`npx electron . --screenshot=out.png "--hash=scenario=vision&select=thalamus"`

## Espèces et arène
- Chaque espèce a sa fiche dans `src/species/` (régions, connexions, scénarios, IA, formes 3D). Choix dans le menu **Espèce**.
- **Souris** : arène en boucle fermée (`src/arena.js`) — narines G/D → bulbes olfactifs, moustaches → cortex des tonneaux (côté opposé),
  odeur de chat → amygdale + hypothalamus, ombre → colliculus. Le décodeur moteur lit l'activité G/D du cerveau pour la vitesse et la rotation.
  Réglages dans `REGLAGES` en haut de `src/arena.js`.
- Dev : `npx electron . --screenshot=out.png "--hash=espece=souris" "--js=document.getElementById('arene-ombre').click()"`
