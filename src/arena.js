// Arène de la souris : boucle fermée monde -> capteurs -> cerveau -> décodeur moteur -> mouvement.
// Coordonnées : arène carrée de 0 à 1, y vers le haut ; angle 0 = vers la droite, positif = vers la gauche.
import { REGION_INDEX } from './anatomy.js';
import { SIM_HZ } from './sim.js';

const G = 0, D = 1; // côté gauche / droit du cerveau
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = (v) => clamp(v, 0, 1);

// Réglages du décodeur moteur (modifiables pour expérimenter)
export const REGLAGES = {
  odeurNourriture: 0.12,   // distance à laquelle l'odeur d'une graine est divisée par 2
  odeurChat: 0.25,         // idem pour l'odeur du chat (kairomones)
  longueurMoustache: 0.09,
  gainOdorat: 16,          // rotation (rad/s) pour une différence relative gauche/droite de 100 % dans l'odorat
  gainPeur: 20,            // rotation pour s'éloigner du côté où l'amygdale est la plus active
  gainMoustaches: 1.4,     // rotation par Hz de différence du cortex somatosensoriel
  gainMoteur: 0.6,         // petites asymétries spontanées du cortex moteur = exploration
  vitesseBase: 0.07,       // unités d'arène par seconde
};

export class Arene {
  constructor(sim) {
    this.sim = sim;
    // Neurones de chaque région, par côté
    this.groupes = {};
    for (const id of Object.keys(REGION_INDEX)) this.groupes[id] = [[], []];
    const ids = Object.keys(REGION_INDEX);
    for (let i = 0; i < sim.N; i++) this.groupes[ids[sim.region[i]]][sim.side[i]].push(i);
    this.reset();
  }

  reset() {
    this.souris = { x: 0.5, y: 0.5, a: Math.PI / 2, v: 0 };
    this.graines = [];
    this.chat = null;
    this.ombre = 0;
    this.faim = 0.6;
    this.mangees = 0;
    this.trace = [];
    this.aRemettre = [];
    this.reserveFige = 1;
    this.tournerLisse = 0;
    this._t = 0;
    this.mode = 'exploration';
    this.capteurs = {};
    for (let k = 0; k < 3; k++) this.ajouterGraine();
    this.sim.input.fill(0);
  }

  ajouterGraine(x = 0.1 + Math.random() * 0.8, y = 0.1 + Math.random() * 0.8) {
    this.graines.push({ x, y });
  }
  basculerChat(x = 0.85, y = 0.85) {
    this.chat = this.chat ? null : { x, y };
  }
  declencherOmbre() {
    this.ombre = 1.5; // secondes
  }

  // Activité (Hz) d'une région d'un côté, ou moyenne des deux côtés
  act(id, cote) {
    const r = REGION_INDEX[id], sr = this.sim.sideRate;
    if (cote === undefined) return ((sr[r * 2] + sr[r * 2 + 1]) / 2) * SIM_HZ;
    return sr[r * 2 + cote] * SIM_HZ;
  }

  // Applique une entrée sensorielle aux neurones d'une région d'un côté
  stimuler(id, cote, valeur) {
    if (valeur <= 0) return;
    const input = this.sim.input;
    for (const i of this.groupes[id][cote]) input[i] += valeur;
  }

  lireCapteurs() {
    const m = this.souris, R = REGLAGES;
    const nez = (cote) => {
      const a = m.a + (cote === G ? 0.6 : -0.6);
      return [m.x + Math.cos(a) * 0.035, m.y + Math.sin(a) * 0.035];
    };
    // Panache d'odeur : décroît en 1 / (1 + (d/portée)²), garde une direction même tout près de la source
    const odeur = ([x, y], src, portee) => 1 / (1 + ((x - src.x) ** 2 + (y - src.y) ** 2) / (portee * portee));
    const moustache = (cote) => {
      const a = m.a + (cote === G ? 0.75 : -0.75), dx = Math.cos(a), dy = Math.sin(a);
      let t = Infinity;
      if (dx > 0) t = Math.min(t, (1 - m.x) / dx); else if (dx < 0) t = Math.min(t, -m.x / dx);
      if (dy > 0) t = Math.min(t, (1 - m.y) / dy); else if (dy < 0) t = Math.min(t, -m.y / dy);
      return clamp01(1 - t / R.longueurMoustache);
    };
    const c = {};
    for (const cote of [G, D]) {
      const p = nez(cote);
      c['nourriture' + cote] = this.graines.reduce((s, g) => s + odeur(p, g, R.odeurNourriture), 0);
      c['chat' + cote] = this.chat ? odeur(p, this.chat, R.odeurChat) : 0;
      c['moustache' + cote] = moustache(cote);
    }
    c.ombre = this.ombre > 0 ? 1 : 0;
    this.capteurs = c;
    return c;
  }

  update(dt) {
    const m = this.souris, R = REGLAGES, c = this.lireCapteurs();
    this.ombre = Math.max(0, this.ombre - dt);
    this.aRemettre = this.aRemettre.map((t) => t - dt).filter((t) => t > 0 || (this.ajouterGraine(), false));
    this.faim = Math.min(1, this.faim + dt * 0.02);

    // 1. Capteurs -> neurones (même côté pour l'odorat, côté opposé pour le toucher)
    this.sim.input.fill(0);
    for (const cote of [G, D]) {
      const oppose = 1 - cote;
      const odeurs = c['nourriture' + cote] * (0.4 + this.faim);
      this.stimuler('bulbe_olfactif', cote, 9 * odeurs);
      this.stimuler('piriforme', cote, 5 * odeurs);
      // Odeur de prédateur : voie voméronasale -> amygdale + hypothalamus (peur innée)
      this.stimuler('bulbe_olfactif', cote, 3 * c['chat' + cote]);
      this.stimuler('amygdale', cote, 16 * c['chat' + cote]);
      this.stimuler('hypothalamus', cote, 9 * c['chat' + cote]);
      this.stimuler('tronc', cote, 10 * c['moustache' + cote]);     // nerf trijumeau
      this.stimuler('thalamus', oppose, 8 * c['moustache' + cote]);
      this.stimuler('somato', oppose, 16 * c['moustache' + cote]);  // cortex des tonneaux, côté opposé
      this.stimuler('colliculus', cote, 22 * c.ombre);
      this.stimuler('visuel', cote, 6 * c.ombre);
      this.stimuler('hypothalamus', cote, 1.5 * this.faim);
    }

    // 2. Activité du cerveau -> commandes motrices (décodeur)
    const odorat = (cote) => this.act('bulbe_olfactif', cote) + 0.5 * this.act('piriforme', cote);
    // Peur innée : il faut l'amygdale ET l'hypothalamus de défense
    const peur = Math.min(this.act('amygdale'), 1.3 * this.act('hypothalamus'));
    const fuite = this.act('colliculus');
    const evite = clamp01((peur - 2.2) / 1.2);          // amygdale forte -> on s'éloigne de l'odeur
    const approche = (1 - evite) * (0.3 + this.faim);   // sinon, la faim pousse vers l'odeur
    let tourner =
      R.gainOdorat * ((odorat(G) - odorat(D)) / (odorat(G) + odorat(D) + 1)) * approche
      - R.gainPeur * ((this.act('amygdale', G) - this.act('amygdale', D)) / (this.act('amygdale', G) + this.act('amygdale', D) + 1)) * evite
      + R.gainMoustaches * (this.act('somato', G) - this.act('somato', D))
      + R.gainMoteur * (this.act('moteur', D) - this.act('moteur', G));
    // Lissage (~0,3 s) : la commande motrice intègre l'activité, comme les neurones moteurs
    this.tournerLisse += (clamp(tourner, -6, 6) - this.tournerLisse) * Math.min(1, dt / 0.3);
    tourner = this.tournerLisse;

    let vitesse = R.vitesseBase * (1 + 0.6 * this.act('moteur') + 0.8 * evite) + 0.35 * clamp01((fuite - 0.8) / 2);
    // Immobilisation (freezing) : forte peur sans signal de fuite, limitée par une réserve qui s'épuise
    let fige = clamp01((peur - 2.5) / 1.2) * (1 - clamp01((fuite - 0.8) / 2)) * this.reserveFige;
    this.reserveFige = clamp01(this.reserveFige + (fige > 0.3 ? -dt / 4 : dt / 20));
    vitesse *= 1 - 0.85 * fige;

    // 3. Mouvement
    m.a += tourner * dt;
    m.v = vitesse;
    m.x += Math.cos(m.a) * vitesse * dt;
    m.y += Math.sin(m.a) * vitesse * dt;
    const marge = 0.02;
    if (m.x < marge || m.x > 1 - marge || m.y < marge || m.y > 1 - marge) {
      m.x = clamp(m.x, marge, 1 - marge);
      m.y = clamp(m.y, marge, 1 - marge);
      m.a += Math.PI * (0.5 + Math.random() * 0.5); // rebond si les moustaches n'ont pas suffi
    }

    // 4. Manger -> récompense (dopamine)
    for (let k = this.graines.length - 1; k >= 0; k--) {
      const g = this.graines[k];
      if ((g.x - m.x) ** 2 + (g.y - m.y) ** 2 < 0.035 ** 2) {
        this.graines.splice(k, 1);
        this.mangees++;
        this.faim = Math.max(0, this.faim - 0.5);
        this.sim.stimulate(REGION_INDEX.vta, 70);
        this.sim.stimulate(REGION_INDEX.striatum, 25);
        this.aRemettre.push(1.5); // une nouvelle graine apparaît 1,5 s plus tard
      }
    }

    // État affiché
    this.mode = fuite > 1.3 ? 'fuite' : fige > 0.4 ? 'figée' : evite > 0.4 ? 'évitement'
      : Math.max(c.nourriture0, c.nourriture1) > 0.15 ? 'approche' : 'exploration';
    this._t += dt;
    if (this._t > 0.08) {
      this._t = 0;
      this.trace.push([m.x, m.y]);
      if (this.trace.length > 250) this.trace.shift();
    }
  }
}
