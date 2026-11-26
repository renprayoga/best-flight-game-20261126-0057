// Nusa Sky Courier — tunables in one place. Every number here is a
// gameplay decision, not a magic constant scattered through the code.
export const CFG = {
  // World: a 4000 x 4000 m volcanic island in a bright tropical sea.
  WORLD_SIZE: 4000,
  SEA_LEVEL: 0,
  // Flight model (arcade, forgiving, but throttle discipline matters).
  MAX_SPEED: 92, // m/s at full throttle, level flight
  MIN_SPEED: 26, // below this the wing stops flying and she sinks
  CRUISE_SPEED: 55,
  ACCEL: 14, // m/s^2 toward the throttle's target speed
  DRAG: 0.12,
  PITCH_RATE: 0.85, // rad/s at full stick
  ROLL_RATE: 1.9,
  TURN_RATE: 0.55, // rad/s of heading per radian of bank
  CLIMB_FACTOR: 0.55, // how much of forward speed becomes climb
  GRAVITY_SINK: 9.5, // m/s^2 sink when stalled
  // Fuel: a full tank is ~6 minutes of mixed flying; full throttle drinks.
  FUEL_MAX: 100,
  FUEL_BURN_IDLE: 0.12, // per second
  FUEL_BURN_FULL: 0.55, // per second at full throttle
  // Damage: hard hits hurt; a gentle touchdown does not.
  CRASH_VSPEED: 9, // m/s vertical speed that breaks the plane on land
  CRASH_SPEED: 30, // m/s forward speed that breaks her on terrain
  // Rings: 8 gold rings per mission, generous so a first flight can finish.
  RING_RADIUS: 26,
  RING_POINTS: 500,
  // Scoring.
  LANDING_BONUS: 1500,
  TIME_BONUS_RATE: 10, // per second under par, ring-run mission
  PAR_TIME_RING_RUN: 240,
  // Runway: home strip "Nusa Field", heading north (-Z).
  RUNWAY: { x: 0, z: 120, length: 420, width: 34, heading: 0 },
  // Camera.
  CHASE_DIST: 30,
  CHASE_HEIGHT: 9,
};

export const MISSIONS = [
  {
    id: 'ring-run',
    key: '1',
    name: 'Ring Run',
    blurb: 'Thread 8 gold rings over the valley, then bring her home.',
    par: 240,
  },
  {
    id: 'island-hop',
    key: '2',
    name: 'Island Hop',
    blurb: 'Deliver the mail: touch down on 3 island strips, then home.',
    par: 300,
  },
  {
    id: 'time-trial',
    key: '3',
    name: 'Time Trial',
    blurb: '8 rings against the clock. Full throttle drinks fuel — choose.',
    par: 150,
  },
];

export const BEST_KEY = 'nusa-sky-courier-best';
export const STEP = 1 / 60;
