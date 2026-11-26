# Nusa Sky Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/renprayoga/best-flight-game-20261126-0057/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/renprayoga/best-flight-game-20261126-0057/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Nusa Sky Courier** is an original 3D flight game that runs offline in a
desktop browser from static files — no network requests, no libraries, no
build step. Fly the mail plane *Merpati Nusa* over a volcanic Indonesian
island: thread the gold rings, mind your fuel, and bring her home to Nusa
Field.

The island is one procedural place: a volcano in the north-west, a ridge
down the east, a river valley between them, rice terraces on the south
slopes, a coastal town and beach at the south-east, open sea all around.
The renderer is hand-written WebGL1 (no engine, no vendored library);
every mesh, the terrain, the plane and the sky are built in code, and all
sound is synthesized with WebAudio.

Three missions, each a different way to fly the same island:

- **Ring Run** — thread 8 gold rings over the valley, the volcano shoulder
  and the coast, then land back on Nusa Field. Par 4:00.
- **Island Hop** — deliver the mail: touch down on Ridge Strip and Palm
  Strip, then fly home. Par 5:00.
- **Time Trial** — 8 rings down the river valley against a 2:30 clock.
  Full throttle drinks fuel, so throttle discipline decides the run.

Flying rewards throttle and turn discipline: bank to turn, keep speed
above the stall, watch fuel burn, and land gently — a hard touchdown
breaks the plane. Score comes from rings, deliveries, a landing bonus
and a time bonus against par.

## Controls

- **W/S or ↑/↓** pitch · **A/D or ←/→** bank · **Shift/Ctrl** throttle
- **Mouse drag** steers · **mouse wheel** throttle
- **C** camera (chase / cockpit) · **P** pause · **M** mute · **R** restart
- **1 / 2 / 3** pick a mission · **Space** start

## Play

```sh
node serve.ts   # then open http://localhost:8080
```

## Screenshots

Deterministic staged renders of the game's own code
(`?shot=start|play|cockpit|land&seed=1`): takeoff from Nusa Field,
mid-flight through a gold ring over the valley, the cockpit view over
the river, and the touchdown that completes the mission.

## Entry

Built for the [make.fun bounty](https://make.fun/bounty/best-flight-game-20261126-0057):
`main.ts` (Node 22) hands in `game/`, `screenshots/` and `dossier.json`
via the kit's `vendor/makefun-game.ts`.
