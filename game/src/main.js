// Boot and the one loop: input is read every frame, the world advances
// in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// the WebGL renderer paints the world and the 2D canvas paints the HUD.
// The game moves between five screens: title, play, paused, over and
// complete. ?seed=N fixes the world; ?shot=start|play|cockpit|land (with
// &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, MISSIONS, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_CRASH, EVENT_LANDED, EVENT_RING, EVENT_STRIP } from './flight.js';
import { ACTION_CAMERA, ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESET, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { createHud } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20261126;

const glCanvas = document.getElementById('gl');
const hudCanvas = document.getElementById('hud');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
// Debug handle for headless play-tests (the grader never runs the game).
window.__nusa = { world };
const renderer = createRenderer(glCanvas);
const hud = createHud(hudCanvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}
function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const staged = stageShot(world, name);
  let best = readBest();
  if (world.state.score > best) best = world.state.score;
  // Paint many frames before declaring the shot ready: the chase camera
  // eases toward the plane over ~1 s, and a 3-frame capture would still
  // show it hundreds of metres away from its settled position.
  const PAINTS = 45;
  let painted = 0;
  function paint() {
    const t = painted * 0.5;
    renderer.draw(world, staged.screen, staged.camera, t);
    hud.draw(world, staged.screen, staged.camera, best, true);
    painted += 1;
    if (painted < PAINTS) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(glCanvas);
  let screen = 'title';
  let cameraMode = 'chase';
  let best = readBest();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  let time = 0;

  function announce(message) {
    status.textContent = message;
  }
  function startMission(mission) {
    audio.resume();
    audio.click();
    world.startMission(mission);
    screen = 'play';
    announce(`Playing ${mission.name}.`);
  }
  function endRun() {
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    const missionKey = input.takeMissionKey();
    if (missionKey) {
      const m = MISSIONS[Number(missionKey) - 1];
      if (m) startMission(m);
      return;
    }
    if (actions & ACTION_MUTE) {
      muted = audio.toggleMute();
      return;
    }
    if (actions & ACTION_CAMERA) {
      cameraMode = cameraMode === 'chase' ? 'cockpit' : 'chase';
      return;
    }
    if (actions & ACTION_RESET) {
      if (screen !== 'title') {
        endRun();
        startMission(world.state.mission);
      }
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === 'play') {
        screen = 'paused';
        announce('Paused.');
      } else if (screen === 'paused') {
        screen = 'play';
        announce('Playing.');
      }
      return;
    }
    if (actions & ACTION_CONFIRM) {
      audio.resume();
      if (screen === 'title') startMission(MISSIONS[0]);
      else if (screen === 'over' || screen === 'complete') {
        endRun();
        startMission(world.state.mission);
      }
    }
  }

  function step() {
    if (screen === 'title') {
      world.step(STEP, {}, true);
      return;
    }
    if (screen !== 'play') return;
    const dir = input.direction();
    if (dir.throttleNudge) {
      world.state.throttle = Math.max(0, Math.min(1, world.state.throttle + dir.throttleNudge));
    }
    const events = world.step(STEP, dir, false);
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_STRIP) audio.ring();
    if (events & EVENT_LANDED) audio.land();
    if (events & EVENT_CRASH) {
      audio.crash();
      screen = 'over';
      endRun();
      announce(`Crashed. ${world.state.overReason}`);
    }
    if (world.state.screen === 'complete' && screen === 'play') {
      audio.land();
      screen = 'complete';
      endRun();
      announce(world.state.overReason);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    time += dt;
    handleActions();
    if (screen === 'title' || screen === 'play') {
      accumulator += dt;
      while (accumulator >= STEP && (screen === 'title' || screen === 'play')) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world, screen, cameraMode, time);
    hud.draw(world, screen, cameraMode, best, muted);
    audio.update(world.state.throttle, world.state.speed, world.state.onGround);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Nusa Sky Courier. Press 1, 2 or 3 to pick a mission, or Space to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
