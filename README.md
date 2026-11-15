[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/asenamapr/best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/asenamapr/best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# Nova Swarm

An original 2D arena-survival game (Vampire Survivors-like), built with vanilla JavaScript
on canvas — no libraries, no network requests, fully offline from static files.

You are a lone starship in a dark nebula. Waves of alien swarmers close in from every
direction. Your cannon fires automatically at the nearest enemy; you steer, dodge, collect
the XP gems they drop, and level up to pick upgrade cards. Elites appear every 5 waves.
Survive all 10 waves and defeat the Wave 10 boss — the Hive Tyrant — to win.

## Features

- **Escalating waves** — 10 waves, denser and faster each time, with an intermission banner.
- **5 enemy types** — Chaser, Dart (fast), Bulwark (tank), Splitter (bursts into minis),
  Spitter (ranged, keeps its distance and fires plasma).
- **Elites & boss** — an elite every 5 waves; the Wave 10 boss fires radial plasma bursts
  and spawns minions. Kill it to win.
- **Level-up choices** — 6 upgrade types (damage, fire rate, move speed, max HP, magnet
  radius, multi-shot), pick 1 of 3 cards on every level-up.
- **Juice** — particles, screen shake, floating damage numbers, neon glow over a twinkling
  starfield, WebAudio synth SFX and a simple ambient music loop (mutable).
- **Persistence** — best score saved in `localStorage`.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrow keys | Move |
| Mouse | Aim (optional — otherwise auto-aims at the nearest enemy) |
| Enter / Click | Start, confirm |
| 1 / 2 / 3 or Click | Pick a level-up card |
| P | Pause / resume |
| M | Mute / unmute |
| R | Restart (from pause, game over, or victory) |

Desktop browser, keyboard + mouse.

## How to run

```sh
node serve.ts
```

Then open http://localhost:8080.

No build step, no dependencies. The game is `game/index.html` plus ES modules under
`game/src/`. Screenshots are staged deterministically with `?shot=start|play|levelup|end&seed=N`.

## License

MIT — see [LICENSE](LICENSE).
