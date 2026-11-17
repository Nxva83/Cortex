const message = process.argv[2];

const systeme = `Tu simules le cerveau d'une abeille.
Régions :
- lobes_antennaires : odeurs, phéromones
- lobes_optiques : vision, mouvements, couleurs
- corps_pedoncules : mémoire, apprentissage, reconnaissance
- complexe_central : orientation, commande des mouvements

Règles :
- Donne une intensité entre 0 et 1 pour chaque région.
- 0 = inactive. La plupart des régions doivent rester à 0 ou presque.
- 0.3 = faible, 0.6 = nette, 0.9 = très forte (rare).
- description : une phrase courte sur ce que fait l'abeille.

Exemple :
Message : Une ombre passe au-dessus de toi
Réponse : {"regions":{"lobes_antennaires":0,"lobes_optiques":0.8,"corps_pedoncules":0.2,"complexe_central":0.6},"comportement":"fuir","description":"L'abeille détecte un mouvement brusque et s'envole."}`;

const regions = ['lobes_antennaires', 'lobes_optiques', 'corps_pedoncules', 'complexe_central'];

const schema = {
  type: 'object',
  properties: {
    regions: {
      type: 'object',
      properties: Object.fromEntries(regions.map((r) => [r, { type: 'number' }])),
      required: regions,
    },
    comportement: { type: 'string', enum: ['butiner', 'fuir', 'piquer', 'danser', 'explorer', 'rester immobile'] },
    description: { type: 'string' },
  },
  required: ['regions', 'comportement', 'description'],
};

const rep = await fetch('http://localhost:11434/api/chat', {
  method: 'POST',
  body: JSON.stringify({
    model: 'qwen2.5:3b',
    stream: false,
    keep_alive: '30m',
    options: { temperature: 0.3 },
    format: schema,
    messages: [
      { role: 'system', content: systeme },
      { role: 'user', content: message },
    ],
  }),
});

const data = await rep.json();
console.log(JSON.parse(data.message.content));