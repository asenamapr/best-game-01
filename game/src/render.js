// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred, the margin filled with the backdrop
// colour. Neon glow (shadowBlur) over a twinkling starfield, distinct enemy shapes, HUD bars,
// and panels for every screen. Text that holds a number is rebuilt only when it changes.
import { FIELD, FONT, PALETTE } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVELUP = 'levelup';
export const SCREEN_OVER = 'over';
export const SCREEN_VICTORY = 'victory';

const PANEL = { width: 640, top: 150, line: 32, bottom: 76 };
const CARD = { width: 300, height: 230, gap: 24 };

function cachedLabel(prefix) {
  let value = null;
  let text = '';
  return function label(next) {
    if (next !== value) {
      value = next;
      text = prefix + next;
    }
    return text;
  };
}

function fmtTime(seconds) {
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const scoreLabel = cachedLabel('SCORE ');
  const waveLabel = cachedLabel('WAVE ');
  const levelLabel = cachedLabel('LV ');
  const timeLabel = cachedLabel('');
  const killsLabel = cachedLabel('KILLS ');
  const finalLabel = cachedLabel('SCORE ');
  const bestLabel = cachedLabel('BEST ');
  const hpLabel = cachedLabel('');
  /** Level-up card hit rects in logical coordinates, for click picking. */
  const cards = [];

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  /** Client pixels -> logical playfield coordinates. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const px = (clientX - rect.left) * ratio;
    const py = (clientY - rect.top) * ratio;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight ?? ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  function glow(color, blur) {
    context.shadowColor = color;
    context.shadowBlur = blur;
  }

  function noGlow() {
    context.shadowBlur = 0;
  }

  function shapePath(shape, x, y, r, angle) {
    context.beginPath();
    if (shape === 'circle') {
      context.arc(x, y, r, 0, Math.PI * 2);
    } else if (shape === 'triangle') {
      for (let i = 0; i < 3; i += 1) {
        const a = angle + (i / 3) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    } else if (shape === 'square') {
      context.rect(x - r * 0.85, y - r * 0.85, r * 1.7, r * 1.7);
    } else if (shape === 'diamond') {
      context.moveTo(x, y - r);
      context.lineTo(x + r, y);
      context.lineTo(x, y + r);
      context.lineTo(x - r, y);
      context.closePath();
    } else if (shape === 'hexagon') {
      for (let i = 0; i < 6; i += 1) {
        const a = angle + (i / 6) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const py = y + Math.sin(a) * r;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    } else if (shape === 'boss') {
      // Spiked star: the Hive Tyrant.
      for (let i = 0; i < 16; i += 1) {
        const a = angle + (i / 16) * Math.PI * 2;
        const rr = i % 2 === 0 ? r : r * 0.62;
        const px = x + Math.cos(a) * rr;
        const py = y + Math.sin(a) * rr;
        if (i === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      }
      context.closePath();
    }
  }

  function drawStars(state, time) {
    for (const star of state.stars) {
      const twinkle = 0.45 + 0.55 * Math.abs(Math.sin(time * star.speed + star.phase));
      context.globalAlpha = 0.25 + 0.65 * twinkle;
      context.fillStyle = '#cdd7ff';
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function drawField(state, time) {
    // Deep-space backdrop with a faint nebula wash.
    const nebula = context.createRadialGradient(640, 300, 60, 640, 300, 620);
    nebula.addColorStop(0, '#0d1230');
    nebula.addColorStop(0.6, '#080a1c');
    nebula.addColorStop(1, '#05060f');
    context.fillStyle = nebula;
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    drawStars(state, time);

    // XP gems: cyan diamonds, bigger and gold-rimmed when worth 5.
    for (const g of state.gems) {
      if (!g.active) continue;
      const pulse = 1 + 0.12 * Math.sin(time * 6 + g.x);
      glow('#35d0ff', 10);
      context.fillStyle = g.value >= 5 ? '#ffd23f' : '#35d0ff';
      shapePath('diamond', g.x, g.y, (g.value >= 5 ? 11 : 7) * pulse, 0);
      context.fill();
      noGlow();
    }

    // Enemy plasma.
    for (const es of state.enemyShots) {
      if (!es.active) continue;
      glow('#ff2e88', 12);
      context.fillStyle = '#ff5ca8';
      context.beginPath();
      context.arc(es.x, es.y, es.radius, 0, Math.PI * 2);
      context.fill();
      noGlow();
    }

    // Enemies, each shape and colour distinct; elites get a gold ring, the boss a HP bar.
    for (const e of state.enemies) {
      if (!e.active) continue;
      glow(e.glow, e.boss ? 30 : 14);
      context.fillStyle = e.color;
      shapePath(e.shape, e.x, e.y, e.radius, e.wobble * 0.4);
      context.fill();
      noGlow();
      if (e.elite) {
        context.strokeStyle = PALETTE.gold;
        context.lineWidth = 3;
        context.beginPath();
        context.arc(e.x, e.y, e.radius + 6, 0, Math.PI * 2);
        context.stroke();
      }
      if (e.hp < e.maxHp && (e.elite || e.boss || e.radius >= 24)) {
        const w = e.radius * 2;
        context.fillStyle = 'rgba(0,0,0,0.55)';
        context.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        context.fillStyle = e.boss ? '#ff2e88' : '#ff4d5e';
        context.fillRect(e.x - w / 2, e.y - e.radius - 12, w * (e.hp / e.maxHp), 5);
      }
    }

    // Player projectiles: bright cyan bolts.
    for (const s of state.shots) {
      if (!s.active) continue;
      glow('#8fe6ff', 10);
      context.strokeStyle = '#bff3ff';
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(s.x - s.vx * 0.016, s.y - s.vy * 0.016);
      context.lineTo(s.x, s.y);
      context.stroke();
      noGlow();
    }

    // Particles.
    for (const p of state.particles) {
      if (!p.active) continue;
      context.globalAlpha = Math.max(0, p.life / p.maxLife);
      context.fillStyle = p.color;
      context.beginPath();
      context.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;

    // The player ship: a glowing arrow, blinking while invulnerable after a hit.
    const player = state.player;
    if (player.invulnerable === 0 || Math.floor(player.invulnerable * 12) % 2 === 0) {
      glow(PALETTE.playerGlow, 18);
      context.fillStyle = PALETTE.player;
      shapePath('triangle', player.x, player.y, player.radius + 6, player.angle);
      context.fill();
      noGlow();
      context.fillStyle = '#eafcff';
      context.beginPath();
      context.arc(player.x, player.y, 5, 0, Math.PI * 2);
      context.fill();
      // Magnet radius, faint, so the player can see what pulls gems in.
      context.strokeStyle = 'rgba(53, 208, 255, 0.12)';
      context.lineWidth = 1;
      context.beginPath();
      context.arc(player.x, player.y, player.magnetRadius, 0, Math.PI * 2);
      context.stroke();
    }

    // Floating damage numbers.
    context.textBaseline = 'alphabetic';
    for (const f of state.floaters) {
      if (!f.active) continue;
      context.globalAlpha = Math.min(1, f.life / 0.5);
      text(f.text, f.x, f.y, 16, f.color, 'center', '700 ');
    }
    context.globalAlpha = 1;
  }

  function drawHud(state) {
    const player = state.player;
    context.textBaseline = 'top';
    // HP bar, top left.
    text('HULL', 24, 18, 15, PALETTE.muted, 'left', '700 ');
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(24, 38, 220, 16);
    const hpFrac = Math.max(0, player.hp / player.maxHp);
    context.fillStyle = hpFrac < 0.3 ? PALETTE.hpLow : PALETTE.hp;
    context.fillRect(24, 38, 220 * hpFrac, 16);
    text(hpLabel(`${Math.ceil(player.hp)} / ${player.maxHp}`), 250, 36, 16, PALETTE.text, 'left');
    // Score, wave, timer, level across the top.
    text(scoreLabel(state.score), FIELD.width / 2 - 130, 16, 26, PALETTE.text, 'center', '700 ');
    text(waveLabel(state.wave === 0 ? 1 : state.wave), FIELD.width / 2 + 130, 16, 26, PALETTE.gold, 'center', '700 ');
    text(timeLabel(fmtTime(state.time)), FIELD.width - 24, 16, 26, PALETTE.text, 'right', '700 ');
    text(levelLabel(player.level), FIELD.width - 24, 48, 18, PALETTE.xp, 'right', '700 ');
    text(killsLabel(state.kills), FIELD.width - 24, 72, 18, PALETTE.muted, 'right');
    // Boss HP bar, top centre, while the Tyrant lives.
    if (state.boss && state.boss.active) {
      const boss = state.boss;
      text('HIVE TYRANT', FIELD.width / 2, 52, 16, '#ff7ab8', 'center', '700 ');
      context.fillStyle = 'rgba(0,0,0,0.6)';
      context.fillRect(FIELD.width / 2 - 220, 74, 440, 12);
      context.fillStyle = '#ff2e88';
      context.fillRect(FIELD.width / 2 - 220, 74, 440 * Math.max(0, boss.hp / boss.maxHp), 12);
    }
    // XP bar along the bottom.
    const xpFrac = Math.max(0, Math.min(1, player.xp / player.xpNext));
    context.fillStyle = 'rgba(0,0,0,0.55)';
    context.fillRect(0, FIELD.height - 12, FIELD.width, 12);
    context.fillStyle = PALETTE.xp;
    context.fillRect(0, FIELD.height - 12, FIELD.width * xpFrac, 12);
    // Wave banner.
    if (state.bannerTimer > 0 && state.banner) {
      context.globalAlpha = Math.min(1, state.bannerTimer);
      text(state.banner, FIELD.width / 2, 120, 40, PALETTE.gold, 'center', '800 ');
      context.globalAlpha = 1;
    }
  }

  function drawPanel(title, lines, prompt, titleColor) {
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (FIELD.width - PANEL.width) / 2;
    const y = (FIELD.height - height) / 2;
    context.fillStyle = PALETTE.panel;
    context.fillRect(x, y, PANEL.width, height);
    context.strokeStyle = PALETTE.panelEdge;
    context.lineWidth = 2;
    context.strokeRect(x, y, PANEL.width, height);
    context.textBaseline = 'alphabetic';
    text(title, FIELD.width / 2, y + 78, 48, titleColor ?? PALETTE.text, 'center', '800 ');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], FIELD.width / 2, y + PANEL.top + index * PANEL.line, 21, PALETTE.muted, 'center');
    }
    text(prompt, FIELD.width / 2, y + height - 38, 23, PALETTE.gold, 'center', '700 ');
  }

  function drawCards(state, mouse) {
    const picks = state.pendingUpgrades;
    if (!picks) return;
    cards.length = 0;
    const totalWidth = picks.length * CARD.width + (picks.length - 1) * CARD.gap;
    const startX = (FIELD.width - totalWidth) / 2;
    const y = 250;
    context.textBaseline = 'alphabetic';
    text('LEVEL UP!', FIELD.width / 2, 150, 52, PALETTE.gold, 'center', '800 ');
    text(`Level ${state.player.level} — choose an upgrade`, FIELD.width / 2, 196, 22, PALETTE.muted, 'center');
    for (let i = 0; i < picks.length; i += 1) {
      const pick = picks[i];
      const x = startX + i * (CARD.width + CARD.gap);
      const hover = mouse.active && mouse.x >= x && mouse.x <= x + CARD.width && mouse.y >= y && mouse.y <= y + CARD.height;
      cards.push({ x, y, width: CARD.width, height: CARD.height });
      context.fillStyle = hover ? PALETTE.cardHover : PALETTE.card;
      context.fillRect(x, y, CARD.width, CARD.height);
      context.strokeStyle = hover ? PALETTE.gold : PALETTE.cardEdge;
      context.lineWidth = hover ? 3 : 2;
      context.strokeRect(x, y, CARD.width, CARD.height);
      text(pick.icon, x + CARD.width / 2, y + 78, 52, PALETTE.gold, 'center');
      text(pick.name, x + CARD.width / 2, y + 128, 22, PALETTE.text, 'center', '700 ');
      text(pick.desc, x + CARD.width / 2, y + 164, 18, PALETTE.muted, 'center');
      text(`Press ${i + 1} or click`, x + CARD.width / 2, y + CARD.height - 22, 16, PALETTE.xp, 'center');
    }
  }

  const TITLE_LINES = [
    'Survive 10 waves. Defeat the Hive Tyrant.',
    'Your cannon fires on its own — you steer and dodge.',
    'Collect XP gems, level up, pick upgrade cards.',
    'Chasers, Darts, Bulwarks, Splitters, Spitters — and elites.',
    'WASD / Arrows move · Mouse aims · P pause · M mute · R restart',
    '',
  ];

  /** Paint one frame: the field, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, mouse, muted, time) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    // Screen shake: a decaying random offset around the playfield.
    const shake = state.shake;
    const sx = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const sy = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    context.setTransform(view.scale, 0, 0, view.scale, view.x + sx * view.scale, view.y + sy * view.scale);
    drawField(state, time);
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[5] = bestLabel(best);
      drawPanel('NOVA SWARM', TITLE_LINES, 'Press Enter or click to launch', PALETTE.playerGlow);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) {
      drawPanel('PAUSED', ['The swarm waits for no one — except now.'], 'Press P to resume · R to restart');
    } else if (screen === SCREEN_LEVELUP) {
      drawCards(state, mouse);
    } else if (screen === SCREEN_OVER) {
      const lines = [
        `Score ${state.score} · Best ${best}`,
        `Reached wave ${state.wave} · ${state.kills} kills · survived ${fmtTime(state.time)}`,
        `Level ${state.player.level}`,
      ];
      drawPanel('SHIP DESTROYED', lines, 'Press R or Enter to fly again', '#ff4d5e');
    } else if (screen === SCREEN_VICTORY) {
      const lines = [
        `Score ${state.score} · Best ${best}`,
        `The Hive Tyrant is dust. All 10 waves cleared.`,
        `${state.kills} kills · survived ${fmtTime(state.time)} · level ${state.player.level}`,
      ];
      drawPanel('VICTORY', lines, 'Press R or Enter to play again', PALETTE.gold);
    } else if (screen === SCREEN_PLAY && mouse.active) {
      // Aim reticle at the mouse while playing.
      context.strokeStyle = 'rgba(143, 230, 255, 0.7)';
      context.lineWidth = 2;
      context.beginPath();
      context.arc(mouse.x, mouse.y, 10, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(mouse.x - 15, mouse.y);
      context.lineTo(mouse.x - 6, mouse.y);
      context.moveTo(mouse.x + 6, mouse.y);
      context.lineTo(mouse.x + 15, mouse.y);
      context.moveTo(mouse.x, mouse.y - 15);
      context.lineTo(mouse.x, mouse.y - 6);
      context.moveTo(mouse.x, mouse.y + 6);
      context.lineTo(mouse.x, mouse.y + 15);
      context.stroke();
    }
    if (muted) text('MUTED', FIELD.width - 24, FIELD.height - 28, 15, PALETTE.muted, 'right', '700 ');
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, cards, toLogical };
}
