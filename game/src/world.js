// The game's rules and state, with no drawing and no browser in it: the player ship, the
// enemy swarm, XP gems, projectiles, particles, waves, elites, the boss, level-ups and
// upgrades. step() advances one fixed step and returns what happened as bit flags, so the
// caller can react (sounds, announcements) without the world knowing about screens.
// Pools are allocated once at boot and reused; a frame allocates nothing.
import {
  BOSS, ELITE, ENEMIES, FIELD, MAX_WAVE, PLAYER, POOL, UPGRADES, WAVE, WAVE_BREAK,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_GEM = 4;
export const EVENT_LEVELUP = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_SHOOT = 64;
export const EVENT_BOSS = 128;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, angle: -Math.PI / 2,
    radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, level: 1, xp: 0,
    xpNext: PLAYER.xpBase, speed: PLAYER.speed, damage: PLAYER.damage,
    fireInterval: PLAYER.fireInterval, projectiles: 1, magnetRadius: PLAYER.magnetRadius,
    invulnerable: 0, fireTimer: 0,
  };
  const counts = {};
  for (const upgrade of UPGRADES) counts[upgrade.id] = 0;

  const enemies = [];
  for (let i = 0; i < POOL.enemies; i += 1) {
    enemies.push({ active: false, kind: '', x: 0, y: 0, hp: 1, maxHp: 1, speed: 0, radius: 10,
      damage: 0, xp: 0, score: 0, shape: 'circle', color: '#fff', glow: '#fff', elite: false,
      boss: false, shootTimer: 0, spawnTimer: 0, wobble: 0, splits: 0, touchTimer: 0 });
  }
  const gems = [];
  for (let i = 0; i < POOL.gems; i += 1) gems.push({ active: false, x: 0, y: 0, value: 1, vx: 0, vy: 0 });
  const shots = [];
  for (let i = 0; i < POOL.shots; i += 1) shots.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0 });
  const enemyShots = [];
  for (let i = 0; i < POOL.enemyShots; i += 1) enemyShots.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, radius: 6 });
  const particles = [];
  for (let i = 0; i < POOL.particles; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: '#fff' });
  const floaters = [];
  for (let i = 0; i < POOL.floaters; i += 1) floaters.push({ active: false, x: 0, y: 0, life: 0, text: '', color: '#fff' });

  const state = {
    player, enemies, gems, shots, enemyShots, particles, floaters,
    score: 0, kills: 0, time: 0, wave: 0, waveState: 'break', waveTimer: WAVE_BREAK,
    spawnQueue: [], spawnTimer: 0, shake: 0, banner: '', bannerTimer: 0,
    pendingUpgrades: null, pendingLevels: 0, victory: false, gameOver: false,
    boss: null, stars: [],
  };

  // The starfield: fixed stars with a twinkle phase, drawn behind everything.
  for (let i = 0; i < 130; i += 1) {
    state.stars.push({ x: random() * FIELD.width, y: random() * FIELD.height,
      r: 0.6 + random() * 1.6, phase: random() * TAU, speed: 0.5 + random() * 1.5 });
  }

  function free(list) {
    for (let i = 0; i < list.length; i += 1) if (!list[i].active) return list[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (p === null) return;
      const angle = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true; p.x = x; p.y = y;
      p.vx = Math.cos(angle) * v; p.vy = Math.sin(angle) * v;
      p.maxLife = 0.4 + random() * 0.5; p.life = p.maxLife;
      p.size = 1.5 + random() * 2.5; p.color = color;
    }
  }

  function floater(x, y, text, color) {
    const f = free(floaters);
    if (f === null) return;
    f.active = true; f.x = x + (random() - 0.5) * 14; f.y = y; f.life = 0.9; f.text = text; f.color = color;
  }

  function dropGems(x, y, xpValue) {
    // One gem per XP point is too many; chunk into 1s and a 5-gem for elites/bosses.
    let remaining = xpValue;
    while (remaining >= 5) {
      const g = free(gems);
      if (g === null) return;
      g.active = true; g.x = x; g.y = y; g.value = 5;
      g.vx = (random() - 0.5) * 120; g.vy = (random() - 0.5) * 120;
      remaining -= 5;
    }
    while (remaining > 0) {
      const g = free(gems);
      if (g === null) return;
      g.active = true; g.x = x; g.y = y; g.value = 1;
      g.vx = (random() - 0.5) * 120; g.vy = (random() - 0.5) * 120;
      remaining -= 1;
    }
  }

  function edgePoint() {
    const side = Math.floor(random() * 4);
    const margin = 30;
    if (side === 0) return { x: -margin + random() * (FIELD.width + margin * 2), y: -margin };
    if (side === 1) return { x: FIELD.width + margin, y: -margin + random() * (FIELD.height + margin * 2) };
    if (side === 2) return { x: -margin + random() * (FIELD.width + margin * 2), y: FIELD.height + margin };
    return { x: -margin, y: -margin + random() * (FIELD.height + margin * 2) };
  }

  function spawnEnemy(kind, elite) {
    const e = free(enemies);
    if (e === null) return null;
    const base = kind === 'boss' ? BOSS : ENEMIES[kind];
    const at = edgePoint();
    const hpScale = (1 + WAVE.hpPerWave * (state.wave - 1)) * (elite ? ELITE.hpScale : 1);
    const speedScale = (1 + WAVE.speedPerWave * (state.wave - 1)) * (elite ? ELITE.speedScale : 1);
    e.active = true; e.kind = kind; e.x = at.x; e.y = at.y;
    e.maxHp = Math.round(base.hp * hpScale); e.hp = e.maxHp;
    e.speed = base.speed * speedScale;
    e.radius = base.radius * (elite ? ELITE.radiusScale : 1);
    e.damage = base.damage; e.xp = base.xp * (elite ? ELITE.xpGems : 1);
    e.score = base.score * (elite ? ELITE.scoreScale : 1);
    e.shape = base.shape; e.color = base.color; e.glow = base.glow;
    e.elite = elite; e.boss = kind === 'boss';
    e.shootTimer = 1 + random(); e.spawnTimer = 3 + random() * 2;
    e.wobble = random() * TAU; e.splits = base.splits ?? 0; e.touchTimer = 0;
    if (e.boss) state.boss = e;
    return e;
  }

  /** Wave composition: which kinds a wave throws, weighted toward the newer kinds later. */
  function waveComposition(wave) {
    const kinds = ['chaser', 'chaser', 'dart'];
    if (wave >= 2) kinds.push('splitter');
    if (wave >= 3) kinds.push('dart', 'bulwark');
    if (wave >= 4) kinds.push('spitter');
    if (wave >= 6) kinds.push('bulwark', 'spitter', 'dart');
    if (wave >= 8) kinds.push('splitter', 'bulwark', 'spitter');
    return kinds;
  }

  function startWave(wave) {
    state.wave = wave;
    state.spawnQueue = [];
    const budget = WAVE.budgetBase + WAVE.budgetPerWave * (wave - 1);
    const kinds = waveComposition(wave);
    for (let i = 0; i < budget; i += 1) state.spawnQueue.push(kinds[Math.floor(random() * kinds.length)]);
    if (wave === MAX_WAVE) state.spawnQueue.unshift('boss');
    else if (wave % 5 === 0) state.spawnQueue.unshift('elite-chaser');
    state.waveState = 'spawning';
    state.spawnTimer = 0.5;
    state.banner = wave === MAX_WAVE ? 'WAVE 10 — THE HIVE TYRANT' : `WAVE ${wave}`;
    state.bannerTimer = 2.2;
  }

  function rollUpgrades() {
    const available = UPGRADES.filter((u) => counts[u.id] < u.max);
    const picks = [];
    const pool = available.slice();
    while (picks.length < 3 && pool.length > 0) {
      picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    // Everything maxed out: offer a repair instead, so a level-up is never empty.
    while (picks.length < 3) {
      picks.push({ id: 'repair', name: 'Emergency Repair', icon: '✚', max: 99,
        desc: 'Restore 40 HP now', apply: (p) => { p.hp = Math.min(p.maxHp, p.hp + 40); } });
    }
    state.pendingUpgrades = picks;
  }

  function applyUpgrade(index) {
    const pick = state.pendingUpgrades?.[index];
    if (!pick) return false;
    pick.apply(player);
    if (pick.id !== 'repair') counts[pick.id] += 1;
    state.pendingUpgrades = null;
    state.pendingLevels -= 1;
    if (state.pendingLevels > 0) rollUpgrades();
    return true;
  }

  function gainXp(value) {
    player.xp += value;
    let leveled = false;
    while (player.xp >= player.xpNext) {
      player.xp -= player.xpNext;
      player.level += 1;
      player.xpNext = PLAYER.xpBase + (player.level - 1) * PLAYER.xpPerLevel;
      state.pendingLevels += 1;
      leveled = true;
    }
    if (leveled && state.pendingUpgrades === null) rollUpgrades();
    return leveled;
  }

  function killEnemy(e, events) {
    e.active = false;
    state.kills += 1;
    state.score += e.score;
    burst(e.x, e.y, e.color, e.boss ? 60 : e.elite ? 30 : 12, e.boss ? 320 : 200);
    floater(e.x, e.y - e.radius, `+${e.score}`, e.glow);
    dropGems(e.x, e.y, e.xp);
    if (e.splits > 0) {
      for (let i = 0; i < e.splits; i += 1) {
        const m = spawnEnemy('mini', false);
        if (m !== null) { m.x = e.x + (random() - 0.5) * 30; m.y = e.y + (random() - 0.5) * 30; }
      }
    }
    if (e.boss) {
      state.boss = null;
      state.shake = Math.max(state.shake, 16);
      state.victory = true;
      return events | EVENT_WIN;
    }
    state.shake = Math.max(state.shake, e.elite ? 8 : 2);
    return events | EVENT_KILL;
  }

  function nearestEnemy(maxRange) {
    let best = null;
    let bestD = maxRange * maxRange;
    for (const e of enemies) {
      if (!e.active) continue;
      const d = dist2(e.x, e.y, player.x, player.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function fireAt(angle) {
    const spread = 0.14;
    const n = player.projectiles;
    for (let i = 0; i < n; i += 1) {
      const s = free(shots);
      if (s === null) return;
      const offset = (i - (n - 1) / 2) * spread;
      const a = angle + offset;
      s.active = true;
      s.x = player.x + Math.cos(a) * (player.radius + 6);
      s.y = player.y + Math.sin(a) * (player.radius + 6);
      s.vx = Math.cos(a) * PLAYER.projectileSpeed;
      s.vy = Math.sin(a) * PLAYER.projectileSpeed;
      s.dmg = player.damage;
      s.life = 1.1;
    }
    player.angle = angle;
  }

  function reset() {
    player.x = FIELD.width / 2; player.y = FIELD.height / 2;
    player.hp = PLAYER.maxHp; player.maxHp = PLAYER.maxHp;
    player.level = 1; player.xp = 0; player.xpNext = PLAYER.xpBase;
    player.speed = PLAYER.speed; player.damage = PLAYER.damage;
    player.fireInterval = PLAYER.fireInterval; player.projectiles = 1;
    player.magnetRadius = PLAYER.magnetRadius; player.invulnerable = 0; player.fireTimer = 0;
    for (const upgrade of UPGRADES) counts[upgrade.id] = 0;
    for (const list of [enemies, gems, shots, enemyShots, particles, floaters]) {
      for (const item of list) item.active = false;
    }
    state.score = 0; state.kills = 0; state.time = 0;
    state.wave = 0; state.waveState = 'break'; state.waveTimer = WAVE_BREAK;
    state.spawnQueue = []; state.spawnTimer = 0; state.shake = 0;
    state.banner = 'WAVE 1 INCOMING'; state.bannerTimer = 2.2;
    state.pendingUpgrades = null; state.pendingLevels = 0;
    state.victory = false; state.gameOver = false; state.boss = null;
  }

  /**
   * One fixed step. `dir` is the normalised steering vector, `aim` is {x, y, useMouse}
   * for the optional mouse aim. With `harmless` set (the title screen's backdrop) enemies
   * drift in but nothing fires, nothing scores and nothing can hurt the player.
   */
  function step(dt, dir, aim, harmless) {
    let events = 0;
    state.time += dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
    if (state.bannerTimer > 0) state.bannerTimer -= dt;
    if (player.invulnerable > 0) player.invulnerable = Math.max(0, player.invulnerable - dt);

    // Title backdrop: a few drifters wander the field, purely decorative.
    if (harmless) {
      if (state.spawnTimer <= 0 && enemies.filter((e) => e.active).length < 10) {
        const kinds = ['chaser', 'dart', 'splitter'];
        spawnEnemy(kinds[Math.floor(random() * kinds.length)], false);
        state.spawnTimer = 1.2;
      }
      state.spawnTimer -= dt;
      for (const e of enemies) {
        if (!e.active) continue;
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const d = Math.hypot(dx, dy) || 1;
        e.x += (dx / d) * e.speed * 0.3 * dt;
        e.y += (dy / d) * e.speed * 0.3 * dt;
      }
      return events;
    }

    // --- Player movement ---
    player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + dir.x * player.speed * dt));
    player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + dir.y * player.speed * dt));

    // --- Wave flow ---
    if (state.waveState === 'break') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) startWave(state.wave + 1);
    } else {
      state.spawnTimer -= dt;
      if (state.spawnQueue.length > 0 && state.spawnTimer <= 0) {
        const kind = state.spawnQueue.shift();
        if (kind === 'elite-chaser') spawnEnemy('chaser', true);
        else spawnEnemy(kind, false);
        if (kind === 'boss') events |= EVENT_BOSS;
        const interval = Math.max(WAVE.spawnIntervalMin, WAVE.spawnInterval * (1 - 0.04 * (state.wave - 1)));
        state.spawnTimer = interval;
      }
      if (state.spawnQueue.length === 0 && !enemies.some((e) => e.active)) {
        state.score += 50 * state.wave;
        if (state.wave >= MAX_WAVE) {
          // Boss wave cleared without the boss flag means the boss was already killed.
          if (state.victory) return events | EVENT_WIN;
        }
        state.waveState = 'break';
        state.waveTimer = WAVE_BREAK;
        state.banner = `WAVE ${state.wave} CLEARED  +${50 * state.wave}`;
        state.bannerTimer = 2.2;
      }
    }

    // --- Auto-fire ---
    player.fireTimer -= dt;
    if (player.fireTimer <= 0) {
      let angle = null;
      if (aim.useMouse) {
        const dx = aim.x - player.x;
        const dy = aim.y - player.y;
        if (Math.hypot(dx, dy) > 24) angle = Math.atan2(dy, dx);
      }
      if (angle === null) {
        const target = nearestEnemy(PLAYER.range);
        if (target !== null) angle = Math.atan2(target.y - player.y, target.x - player.x);
      }
      if (angle !== null) {
        fireAt(angle);
        player.fireTimer = player.fireInterval;
        events |= EVENT_SHOOT;
      } else {
        player.fireTimer = 0.05;
      }
    }

    // --- Player projectiles ---
    for (const s of shots) {
      if (!s.active) continue;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
      if (s.life <= 0 || s.x < -20 || s.x > FIELD.width + 20 || s.y < -20 || s.y > FIELD.height + 20) {
        s.active = false; continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + PLAYER.projectileRadius;
        if (dist2(s.x, s.y, e.x, e.y) < rr * rr) {
          s.active = false;
          e.hp -= s.dmg;
          burst(s.x, s.y, e.glow, 3, 120);
          floater(e.x, e.y - e.radius, String(Math.round(s.dmg)), '#ffffff');
          if (e.hp <= 0) events = killEnemy(e, events);
          break;
        }
      }
    }

    // --- Enemies: move, shoot, touch ---
    for (const e of enemies) {
      if (!e.active) continue;
      e.wobble += dt * 3;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const nx = dx / d;
      const ny = dy / d;
      if (e.kind === 'spitter') {
        // Keep a firing distance: close in when far, back off when too close, strafe sideways.
        const strafe = Math.sin(e.wobble) * 0.6;
        let mx = 0;
        let my = 0;
        if (d > ENEMIES.spitter.shootRange) { mx = nx; my = ny; }
        else if (d < 240) { mx = -nx; my = -ny; }
        e.x += (mx + -ny * strafe) * e.speed * dt;
        e.y += (my + nx * strafe) * e.speed * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && d < ENEMIES.spitter.shootRange + 60) {
          const es = free(enemyShots);
          if (es !== null) {
            es.active = true; es.x = e.x; es.y = e.y;
            es.vx = nx * ENEMIES.spitter.projectileSpeed; es.vy = ny * ENEMIES.spitter.projectileSpeed;
            es.dmg = e.damage; es.life = 3; es.radius = 6;
          }
          e.shootTimer = ENEMIES.spitter.shootInterval * (0.9 + random() * 0.2);
        }
      } else if (e.boss) {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          // Radial plasma burst.
          for (let i = 0; i < BOSS.burstCount; i += 1) {
            const es = free(enemyShots);
            if (es === null) break;
            const a = (i / BOSS.burstCount) * TAU + e.wobble * 0.1;
            es.active = true; es.x = e.x; es.y = e.y;
            es.vx = Math.cos(a) * BOSS.projectileSpeed; es.vy = Math.sin(a) * BOSS.projectileSpeed;
            es.dmg = 12; es.life = 4; es.radius = 7;
          }
          e.shootTimer = BOSS.shootInterval;
          events |= EVENT_BOSS;
        }
        e.spawnTimer -= dt;
        if (e.spawnTimer <= 0) {
          const m = spawnEnemy('dart', false);
          if (m !== null) { m.x = e.x + (random() - 0.5) * 80; m.y = e.y + (random() - 0.5) * 80; }
          e.spawnTimer = BOSS.spawnInterval;
        }
      } else {
        // Chasers, darts, bulwarks, splitters and minis all home in, with a slight wobble.
        const wob = Math.sin(e.wobble) * 0.25;
        e.x += (nx + -ny * wob) * e.speed * dt;
        e.y += (ny + nx * wob) * e.speed * dt;
      }
      // Touch damage: one hit, then the player is briefly invulnerable.
      if (player.invulnerable === 0 && d < e.radius + player.radius - 2) {
        player.hp -= e.damage;
        player.invulnerable = PLAYER.invulnerable;
        burst(player.x, player.y, '#ff4d5e', 16, 260);
        state.shake = Math.max(state.shake, 7);
        floater(player.x, player.y - 24, `-${e.damage}`, '#ff8a94');
        events |= EVENT_HIT;
        if (player.hp <= 0) {
          player.hp = 0;
          state.gameOver = true;
          burst(player.x, player.y, '#4fc3f7', 60, 340);
          return events | EVENT_OVER;
        }
      }
    }

    // --- Enemy plasma ---
    for (const es of enemyShots) {
      if (!es.active) continue;
      es.x += es.vx * dt; es.y += es.vy * dt; es.life -= dt;
      if (es.life <= 0 || es.x < -20 || es.x > FIELD.width + 20 || es.y < -20 || es.y > FIELD.height + 20) {
        es.active = false; continue;
      }
      if (player.invulnerable === 0 && dist2(es.x, es.y, player.x, player.y) < (es.radius + player.radius) ** 2) {
        es.active = false;
        player.hp -= es.dmg;
        player.invulnerable = PLAYER.invulnerable;
        burst(player.x, player.y, '#ff4d5e', 12, 240);
        state.shake = Math.max(state.shake, 6);
        floater(player.x, player.y - 24, `-${es.dmg}`, '#ff8a94');
        events |= EVENT_HIT;
        if (player.hp <= 0) {
          player.hp = 0;
          state.gameOver = true;
          burst(player.x, player.y, '#4fc3f7', 60, 340);
          return events | EVENT_OVER;
        }
      }
    }

    // --- XP gems: drift, get magnetised, get collected ---
    for (const g of gems) {
      if (!g.active) continue;
      const d = Math.hypot(player.x - g.x, player.y - g.y) || 1;
      if (d < player.magnetRadius) {
        const pull = 900 * (1 - d / (player.magnetRadius + 40));
        g.vx += ((player.x - g.x) / d) * pull * dt;
        g.vy += ((player.y - g.y) / d) * pull * dt;
      } else {
        g.vx *= (1 - 2 * dt);
        g.vy *= (1 - 2 * dt);
      }
      g.x += g.vx * dt;
      g.y += g.vy * dt;
      if (d < player.radius + 12) {
        g.active = false;
        state.score += g.value;
        if (gainXp(g.value)) events |= EVENT_LEVELUP;
        else events |= EVENT_GEM;
      }
    }

    // --- Particles and floating numbers decay ---
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 3 * dt); p.vy *= (1 - 3 * dt);
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      f.y -= 42 * dt;
    }
    return events;
  }

  reset();
  return { state, reset, step, applyUpgrade, rollUpgrades };
}
