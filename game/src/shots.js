// The screenshot scenes behind ?shot=start|play|levelup|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, steered by a simple autopilot
// (flee the nearest enemies, drift toward the nearest gem when it is safe), so the frame is
// what a short game really looks like and the same seed always gives the same frame. The
// victory scene stages the end of a won run directly: the boss is already dust, the field
// holds the last of the swarm, and the victory panel is up.
import { FIELD, STEP } from './config.js';
import { EVENT_LEVELUP, EVENT_OVER, EVENT_WIN } from './world.js';
import { SCREEN_LEVELUP, SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 50;
const LEVELUP_LIMIT_SECONDS = 150;
const END_SECONDS = 24;

/** Steer away from close enemies and toward the nearest gem when nothing is too close. */
function autopilot(state) {
  const player = state.player;
  let ax = 0;
  let ay = 0;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 220) {
      const w = (220 - d) / 220;
      ax += (dx / d) * w * 2;
      ay += (dy / d) * w * 2;
    }
  }
  // Gems pull gently, but never into danger.
  let gem = null;
  let gemD = Infinity;
  for (const g of state.gems) {
    if (!g.active) continue;
    const d = Math.hypot(g.x - player.x, g.y - player.y);
    if (d < gemD) { gemD = d; gem = g; }
  }
  if (gem !== null && Math.hypot(ax, ay) < 1.2) {
    ax += ((gem.x - player.x) / (gemD || 1)) * 0.6;
    ay += ((gem.y - player.y) / (gemD || 1)) * 0.6;
  }
  // Stay inside the field: the walls push back.
  if (player.x < 120) ax += 1;
  if (player.x > FIELD.width - 120) ax -= 1;
  if (player.y < 120) ay += 1;
  if (player.y > FIELD.height - 120) ay -= 1;
  const length = Math.hypot(ax, ay);
  if (length < 0.05) return { x: 0, y: 0 };
  return { x: ax / length, y: ay / length };
}

function idleAim() {
  return { x: 640, y: 360, useMouse: false };
}

/**
 * Set `world` to the named scene (start, play, levelup or end; any other name is start)
 * and return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'levelup' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, { x: 0, y: 0 }, idleAim(), true);
    return { screen: SCREEN_TITLE, best: 12340 };
  }
  if (name === 'levelup') {
    for (let index = 0; index < LEVELUP_LIMIT_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state), idleAim(), false);
      if (events & EVENT_LEVELUP) break;
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    // If the autopilot died or never levelled, roll the cards directly so they still show.
    if (world.state.pendingUpgrades === null) world.rollUpgrades();
    return { screen: SCREEN_LEVELUP, best: 12340 };
  }
  if (name === 'end') {
    for (let index = 0; index < END_SECONDS / STEP; index += 1) {
      const events = world.step(STEP, autopilot(world.state), idleAim(), false);
      if (events & (EVENT_OVER | EVENT_WIN)) break;
    }
    // Stage the victory: the Tyrant is dust, the run's stats stand, the field is clearing.
    const state = world.state;
    for (const e of state.enemies) if (e.active && e.boss) e.active = false;
    state.boss = null;
    state.victory = true;
    state.wave = 10;
    state.score = Math.max(state.score, 18450);
    state.kills = Math.max(state.kills, 212);
    state.player.level = Math.max(state.player.level, 9);
    // A full 10-wave run takes minutes, not the 24 s this staging simulated.
    state.time = Math.max(state.time, 512);
    return { screen: SCREEN_VICTORY, best: 18450 };
  }
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    const events = world.step(STEP, autopilot(world.state), idleAim(), false);
    if (events & (EVENT_OVER | EVENT_WIN)) break;
  }
  const over = world.state.gameOver;
  return { screen: over ? SCREEN_OVER : SCREEN_PLAY, best: 12340 };
}
