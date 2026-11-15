// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.
// Nova Swarm: an arena-survival game. Waves of enemies close in on the player ship; the
// cannon auto-fires, enemies drop XP gems, level-ups offer upgrade cards, and the Wave 10
// boss must fall to win.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** How many waves there are; beating the boss on the last one wins the game. */
export const MAX_WAVE = 10;

/** Seconds of breathing room between waves, with a banner announcing the next one. */
export const WAVE_BREAK = 3;

export const PLAYER = {
  radius: 16,
  speed: 250,
  maxHp: 100,
  // Cannon: one shot every fireInterval seconds at the nearest enemy in range.
  fireInterval: 0.42,
  range: 460,
  damage: 14,
  projectileSpeed: 640,
  projectileRadius: 5,
  magnetRadius: 90,
  invulnerable: 0.6,
  // XP needed for level n (level starts at 1): base + per-level growth.
  xpBase: 6,
  xpPerLevel: 5,
};

/** Enemy kinds. Each entry is the blueprint a spawn copies and scales by wave. */
export const ENEMIES = {
  chaser: {
    name: 'Chaser', color: '#ff4d5e', glow: '#ff8a94',
    radius: 15, hp: 22, speed: 95, damage: 10, xp: 1, score: 10, shape: 'circle',
  },
  dart: {
    name: 'Dart', color: '#ffd23f', glow: '#ffe98a',
    radius: 11, hp: 12, speed: 185, damage: 7, xp: 1, score: 15, shape: 'triangle',
  },
  bulwark: {
    name: 'Bulwark', color: '#b06bff', glow: '#d0a5ff',
    radius: 26, hp: 85, speed: 48, damage: 18, xp: 3, score: 30, shape: 'hexagon',
  },
  splitter: {
    name: 'Splitter', color: '#3ddc84', glow: '#8ff0b3',
    radius: 19, hp: 34, speed: 78, damage: 9, xp: 2, score: 20, shape: 'square', splits: 2,
  },
  spitter: {
    name: 'Spitter', color: '#35d0ff', glow: '#8fe6ff',
    radius: 15, hp: 26, speed: 70, damage: 8, xp: 2, score: 25, shape: 'diamond',
    ranged: true, shootRange: 380, shootInterval: 2.4, projectileSpeed: 230,
  },
  // Splitter minis: small, quick, worth no XP on their own.
  mini: {
    name: 'Mini', color: '#3ddc84', glow: '#8ff0b3',
    radius: 9, hp: 8, speed: 150, damage: 5, xp: 0, score: 5, shape: 'circle',
  },
};

/** The Wave 10 boss: the Hive Tyrant. Big, slow, radial plasma bursts, spawns minions. */
export const BOSS = {
  name: 'Hive Tyrant', color: '#ff2e88', glow: '#ff7ab8',
  radius: 58, hp: 1500, speed: 38, damage: 25, xp: 20, score: 1000, shape: 'boss',
  shootInterval: 2.8, burstCount: 10, projectileSpeed: 190, spawnInterval: 6,
};

/** Elites (every 5th wave): a scaled-up chaser or bulwark, worth a burst of gems. */
export const ELITE = { hpScale: 6, radiusScale: 1.5, speedScale: 0.9, xpGems: 5, scoreScale: 5 };

/** Per-wave growth: enemy hp and speed rise, and so does the spawn budget. */
export const WAVE = {
  hpPerWave: 0.16,
  speedPerWave: 0.045,
  // Spawn budget: how many enemies a wave throws at the player, before elites/boss.
  budgetBase: 8,
  budgetPerWave: 6,
  spawnInterval: 0.85,
  spawnIntervalMin: 0.3,
};

/** The six upgrade types offered on level-up. Each stacks up to 5 times. */
export const UPGRADES = [
  { id: 'damage', name: 'Overcharged Rounds', icon: '✦', max: 5,
    desc: '+25% bullet damage', apply: (p) => { p.damage *= 1.25; } },
  { id: 'firerate', name: 'Rapid Cycler', icon: '≋', max: 5,
    desc: '+20% fire rate', apply: (p) => { p.fireInterval *= 0.83; } },
  { id: 'speed', name: 'Ion Thrusters', icon: '»', max: 5,
    desc: '+12% move speed', apply: (p) => { p.speed *= 1.12; } },
  { id: 'hull', name: 'Reinforced Hull', icon: '♥', max: 5,
    desc: '+25 max HP, heal 25', apply: (p) => { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); } },
  { id: 'magnet', name: 'Tractor Field', icon: '◎', max: 5,
    desc: '+40% gem magnet radius', apply: (p) => { p.magnetRadius *= 1.4; } },
  { id: 'multishot', name: 'Split Cannon', icon: '⁂', max: 3,
    desc: '+1 projectile per shot', apply: (p) => { p.projectiles += 1; } },
];

/** Pool caps: arrays are allocated once at boot and reused, so a frame allocates nothing. */
export const POOL = { enemies: 160, gems: 240, shots: 160, enemyShots: 120, particles: 320, floaters: 64 };

export const PALETTE = {
  backdrop: '#05060f',
  panel: 'rgba(10, 14, 32, 0.92)',
  panelEdge: '#2b3a6e',
  text: '#eef1ff',
  muted: '#8b93b8',
  gold: '#ffd23f',
  hp: '#3ddc84',
  hpLow: '#ff4d5e',
  xp: '#35d0ff',
  player: '#4fc3f7',
  playerGlow: '#8fe6ff',
  card: '#141a33',
  cardEdge: '#3d5afe',
  cardHover: '#1e2a55',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'nova-swarm.best';
