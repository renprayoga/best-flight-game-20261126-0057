// Flight model + mission state. Arcade on purpose: the stick answers at
// every speed, the plane banks into turns, the wing stalls if you get
// slow, and the ground is always there. Fixed 1/60 s steps.
import { CFG, MISSIONS, STEP } from './config.js';
import { groundHeight, ringCourse, STRIPS } from './terrain.js';

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASH = 4;
export const EVENT_FUEL_EMPTY = 8;
export const EVENT_STRIP = 16;
export const EVENT_MISSION_DONE = 32;

const TAU = Math.PI * 2;

function normAngle(a) {
  while (a > Math.PI) a -= TAU;
  while (a < -Math.PI) a += TAU;
  return a;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createWorld(seed) {
  const state = {
    screen: 'title', // title | play | paused | over | complete
    mission: MISSIONS[0],
    rings: [],
    ringIndex: 0,
    stripsVisited: [],
    score: 0,
    best: 0,
    elapsed: 0,
    fuel: CFG.FUEL_MAX,
    damage: 0,
    message: '',
    messageUntil: 0,
    overReason: '',
    // Plane state.
    x: 0, y: 0, z: 0,
    heading: 0, pitch: 0, roll: 0,
    speed: 0, throttle: 0, vspeed: 0,
    onGround: true,
    propAngle: 0,
    // For ring-pass detection: previous signed distance to ring plane.
    prevRingSide: 0,
  };

  function placeOnRunway() {
    const r = CFG.RUNWAY;
    state.x = r.x;
    state.z = r.z + r.length / 2 - 30; // south end, facing north (-Z)
    state.y = groundHeight(state.x, state.z) + 1.8;
    state.heading = 0; // forward is -Z (north) when heading = 0
    state.pitch = 0;
    state.roll = 0;
    state.speed = 0;
    state.throttle = 0;
    state.vspeed = 0;
    state.onGround = true;
  }

  // Forward vector from heading/pitch. Heading 0 faces north (-Z),
  // heading grows clockwise: 90 deg faces east (+X).
  function forward() {
    const h = state.heading;
    const p = state.pitch;
    return {
      x: Math.sin(h) * Math.cos(p),
      y: Math.sin(p),
      z: -Math.cos(h) * Math.cos(p),
    };
  }

  function startMission(mission) {
    state.mission = mission;
    state.rings = ringCourse(mission.id).map((r) => ({ ...r, passed: false }));
    state.ringIndex = 0;
    state.stripsVisited = [];
    state.score = 0;
    state.elapsed = 0;
    state.fuel = CFG.FUEL_MAX;
    state.damage = 0;
    state.message = `${mission.name} — ${mission.blurb}`;
    state.messageUntil = 4;
    state.overReason = '';
    state.prevRingSide = 0;
    placeOnRunway();
    state.screen = 'play';
  }

  function showMessage(text, seconds) {
    state.message = text;
    state.messageUntil = seconds;
  }

  function nearestStrip(x, z) {
    for (const s of STRIPS) {
      const dx = x - s.x;
      const dz = z - s.z;
      const along = Math.abs(dx * Math.sin(s.heading) + dz * Math.cos(s.heading));
      const across = Math.abs(dx * Math.cos(s.heading) - dz * Math.sin(s.heading));
      if (along < s.length / 2 && across < s.width / 2 + 6) return s;
    }
    return null;
  }

  function completeMission() {
    state.screen = 'complete';
    let bonus = CFG.LANDING_BONUS;
    const par = state.mission.par;
    if (state.elapsed < par) bonus += Math.round((par - state.elapsed) * CFG.TIME_BONUS_RATE);
    state.score += bonus;
    state.overReason = `Mission complete! Time ${fmtTime(state.elapsed)} · Landing bonus ${bonus}`;
    showMessage(`Mission complete — +${bonus} pts`, 6);
  }

  function crash(reason) {
    if (state.screen !== 'play') return EVENT_CRASH;
    state.screen = 'over';
    state.overReason = reason;
    state.damage = 100;
    return EVENT_CRASH;
  }

  function step(dt, input, attract) {
    let events = 0;
    state.propAngle += dt * (2 + state.throttle * 38);
    if (state.screen === 'title') {
      // Attract mode: the plane circles the island on autopilot behind
      // the title screen, so the menu sits over a living scene.
      if (attract) {
        state.speed = CFG.CRUISE_SPEED;
        state.throttle = 0.55;
        state.heading += dt * 0.11;
        state.roll = 0.35;
        state.pitch = 0.02;
        const f = forward();
        state.x += f.x * state.speed * dt;
        state.z += f.z * state.speed * dt;
        const targetY = 190 + 40 * Math.sin(state.elapsed * 0.05);
        state.y += (targetY - state.y) * dt * 0.5;
        state.elapsed += dt;
      }
      return 0;
    }
    if (state.screen !== 'play') return 0;
    state.elapsed += dt;
    if (state.messageUntil > 0) state.messageUntil -= dt;
    // Speed at the top of the step, before drag/friction move it: the
    // "rolled to a stop" check below compares against this, so a
    // crossing that happens in the drag update is not missed.
    const speedAtStepStart = state.speed;

    // --- Throttle and speed.
    if (input.throttleUp) state.throttle = clamp(state.throttle + dt * 0.9, 0, 1);
    if (input.throttleDown) state.throttle = clamp(state.throttle - dt * 0.9, 0, 1);
    if (input.throttleSet != null) state.throttle = clamp(input.throttleSet, 0, 1);
    const targetSpeed = state.throttle * CFG.MAX_SPEED;
    state.speed += clamp(targetSpeed - state.speed, -CFG.DRAG * 60 * dt, CFG.ACCEL * dt);
    if (state.speed < 0) state.speed = 0;

    // --- Attitude: stick moves pitch/roll toward targets, bank turns us.
    const pitchIn = (input.pitchUp ? 1 : 0) - (input.pitchDown ? 1 : 0) + (input.pitchAnalog || 0);
    const rollIn = (input.rollRight ? 1 : 0) - (input.rollLeft ? 1 : 0) + (input.rollAnalog || 0);
    const targetPitch = clamp(pitchIn * 0.45, -0.45, 0.45);
    const targetRoll = clamp(rollIn * 1.1, -1.1, 1.1);
    state.pitch += clamp(targetPitch - state.pitch, -CFG.PITCH_RATE * dt * 2, CFG.PITCH_RATE * dt * 2);
    state.roll += clamp(targetRoll - state.roll, -CFG.ROLL_RATE * dt * 2, CFG.ROLL_RATE * dt * 2);
    state.heading = normAngle(state.heading + Math.sin(state.roll) * CFG.TURN_RATE * dt * (0.5 + state.speed / CFG.MAX_SPEED));

    // --- Vertical: lift from speed and pitch; stall when slow. The
    // takeoff check runs first and falls through to the airborne climb
    // in the same step: with vy left at 0 the ground check below would
    // instantly re-land the plane on its own runway (the bounce that
    // kept every takeoff glued to the strip).
    const f = forward();
    const stalled = state.speed < CFG.MIN_SPEED && !state.onGround;
    let vy;
    if (state.onGround) {
      if (state.speed > 34 && state.pitch > 0.06) {
        state.onGround = false; // rotate!
        showMessage('Airborne — gear up, flaps up', 2.5);
      }
    }
    if (state.onGround) {
      vy = 0;
    } else if (stalled) {
      vy = f.y * state.speed - CFG.GRAVITY_SINK * (1 - state.speed / CFG.MIN_SPEED);
    } else {
      vy = f.y * state.speed * CFG.CLIMB_FACTOR + (state.pitch * state.speed * 0.4);
    }
    state.vspeed = vy;
    state.x += f.x * state.speed * dt;
    state.z += f.z * state.speed * dt;
    state.y += vy * dt;

    // --- Fuel.
    const burn = CFG.FUEL_BURN_IDLE + state.throttle * (CFG.FUEL_BURN_FULL - CFG.FUEL_BURN_IDLE);
    state.fuel = Math.max(0, state.fuel - burn * dt);
    if (state.fuel <= 0 && state.throttle > 0) {
      state.throttle = 0;
      showMessage('Fuel empty — glide her down!', 3);
      events |= EVENT_FUEL_EMPTY;
    }

    // --- Rings: pass when we cross the ring's plane inside its radius.
    const ring = state.rings[state.ringIndex];
    if (ring && !ring.passed) {
      const dx = state.x - ring.x;
      const dy = state.y - ring.y;
      const dz = state.z - ring.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      // Ring faces the incoming pilot: its plane is perpendicular to the
      // course direction (from previous ring / runway to this ring).
      const prev = state.ringIndex === 0
        ? { x: 0, y: 60, z: 120 }
        : state.rings[state.ringIndex - 1];
      const cx = ring.x - prev.x;
      const cz = ring.z - prev.z;
      const cl = Math.hypot(cx, cz) || 1;
      const side = (dx * cx + dz * cz) / cl;
      if (state.prevRingSide !== 0 && Math.sign(side) !== Math.sign(state.prevRingSide) && dist < ring.r * 1.05) {
        ring.passed = true;
        state.ringIndex += 1;
        state.score += CFG.RING_POINTS;
        showMessage(`Ring ${state.ringIndex} of ${state.rings.length}! +${CFG.RING_POINTS}`, 2.5);
        events |= EVENT_RING;
      }
      state.prevRingSide = side;
    }

    // --- Ground: only when descending onto it. A plane that just
    // rotated and is climbing away (vspeed > 0) is not touching down,
    // even while it is still within a wingspan of the ground.
    const ground = groundHeight(state.x, state.z);
    const strip = nearestStrip(state.x, state.z);
    if (state.y <= ground + 1.8 && state.vspeed <= 0.5) {
      const gentle = Math.abs(state.vspeed) < CFG.CRASH_VSPEED && state.speed < CFG.CRASH_SPEED + 40;
      if (state.onGround) {
        state.y = ground + 1.8;
        // Rolling friction: a gentle stop on a strip; rough ground
        // grabs the wheels hard (a fast taxi across hills is not a
        // thing — from a field stop she can still taxi back slowly).
        state.speed = Math.max(0, state.speed - (strip ? 1.5 : 8 + state.speed * 0.25) * dt);
      } else if (strip && gentle && state.speed < 55) {
        // Touchdown on a strip.
        state.y = ground + 1.8;
        state.onGround = true;
        state.pitch = 0;
        state.roll = 0;
        state.speed *= 0.92; // rolling friction
        events |= EVENT_LANDED;
      } else if (!strip && gentle && state.speed < 55) {
        // A survivable off-field ditching on flat ground.
        state.y = ground + 1.8;
        state.onGround = true;
        state.speed *= 0.9;
        showMessage('Off-field landing — she is dented but alive. Press R.', 3);
        state.damage = Math.min(100, state.damage + 25);
      } else {
        events |= crash(state.speed > CFG.CRASH_SPEED
          ? 'Crashed — too fast into the terrain.'
          : 'Crashed — came down too hard.');
      }
    }

    // --- Stopped on a strip: this is where missions are won. It runs
    // on the step the plane rolls to a stop (or touches down already
    // slow), NOT only on the touchdown step — a touchdown at 35 m/s
    // rolls for seconds before the speed falls under 8, and the old
    // code only checked on that one step, so no mission could ever
    // complete. A plane sitting on the home strip at mission start
    // cannot complete: no rings are done yet (and island-hop needs
    // both deliveries first).
    if (state.onGround && state.screen === 'play' && speedAtStepStart >= 8 && state.speed < 8) {
      const st = nearestStrip(state.x, state.z);
      if (st) {
        if (st.id === 'home') {
          const done = state.mission.id !== 'island-hop' || state.stripsVisited.length >= 2;
          if (done && (state.ringIndex >= state.rings.length || state.mission.id === 'island-hop')) {
            completeMission();
            events |= EVENT_MISSION_DONE;
          } else if (state.messageUntil <= 0) {
            showMessage(state.mission.id === 'island-hop'
              ? 'Home — but the mail run is not finished yet'
              : 'Landed at Nusa Field — rings left! Take off again', 3);
          }
        } else if (state.mission.id === 'island-hop' && !state.stripsVisited.includes(st.id)) {
          state.stripsVisited.push(st.id);
          state.score += 800;
          showMessage(`${st.name} — mail delivered! +800 (${state.stripsVisited.length}/2)`, 3);
          events |= EVENT_STRIP;
          if (state.stripsVisited.length >= 2) {
            showMessage('All deliveries done — fly home to Nusa Field!', 4);
          }
        } else if (state.messageUntil <= 0) {
          showMessage(`${st.name} — nice landing`, 2.5);
        }
      }
    }

    // --- World edge: turn back with a warning, never fall off the map.
    const edge = CFG.WORLD_SIZE / 2 - 60;
    if (Math.abs(state.x) > edge || Math.abs(state.z) > edge) {
      showMessage('Turn back — open sea ahead!', 2);
      state.heading = normAngle(state.heading + Math.PI * dt * 0.4);
    }
    return events;
  }

  function reset() {
    startMission(state.mission);
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  placeOnRunway();
  // Attract-mode start: circling over the island behind the title.
  state.x = 500;
  state.z = 300;
  state.y = 200;
  state.heading = 2.2;
  state.speed = CFG.CRUISE_SPEED;

  return {
    state,
    startMission,
    reset,
    step,
    forward,
    fmtTime,
    MISSIONS,
  };
}
