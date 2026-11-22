// Vermilion Harbor — boot, input, screens and the game loop.
import { createWorld, step, saveGame, loadSave, buyWeapon, buyCar, buyUpgrade, startMission, SAVE_KEY } from './world.js';
import { render } from './render.js';
import { stageShot } from './shots.js';
import { runSelfTest } from './selftest.js';
import { createAudio } from './audio.js';
import { WEAPONS, CAR_TIERS } from './config.js';
import { hashSeed } from './random.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const params = new URLSearchParams(location.search);
const seedParam = params.get('seed');
const seed = seedParam ? hashSeed(seedParam) : (Date.now() % 2147483647);

const world = createWorld(seed);
world.audio = createAudio();
world.hasSave = false;
try { world.hasSave = !!localStorage.getItem(SAVE_KEY); } catch (e) { /* private mode */ }

function resize() {
  if (params.get('shot')) { canvas.width = 1280; canvas.height = 800; }
  else { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
}
resize();
window.addEventListener('resize', resize);

// ---- input ----
const keys = {};
const edges = {};
let mouse = { x: 0, y: 0, down: false };
const input = {};

function aimWorld() {
  return {
    x: world.cam.x + (mouse.x - canvas.width / 2),
    y: world.cam.y + (mouse.y - canvas.height / 2),
  };
}

function buildInput() {
  const aim = aimWorld();
  const inp = {
    up: !!(keys.KeyW || keys.ArrowUp), down: !!(keys.KeyS || keys.ArrowDown),
    left: !!(keys.KeyA || keys.ArrowLeft), right: !!(keys.KeyD || keys.ArrowRight),
    run: !!keys.ShiftLeft || !!keys.ShiftRight,
    handbrake: !!keys.Space,
    shoot: mouse.down,
    aimX: aim.x, aimY: aim.y,
    enter: !!edges.enter, steal: !!edges.steal, exit: !!edges.exit,
    interact: !!edges.interact, choice: edges.choice ?? null,
    weaponKey: edges.weaponKey ?? null, crewKey: edges.crewKey ?? null,
  };
  edges.enter = false; edges.steal = false; edges.exit = false; edges.interact = false;
  edges.choice = null; edges.weaponKey = null; edges.crewKey = null;
  return inp;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  const s = world;
  if (e.code === 'Space') e.preventDefault();
  if (s.screen === 'title') {
    if (e.code === 'Enter') { s.screen = 'play'; s.audio.ensure(); s.audio.startMusic(); }
    else if (e.code === 'KeyC' && s.hasSave) { if (loadSave(s)) { s.screen = 'play'; s.audio.ensure(); s.audio.startMusic(); } }
    return;
  }
  if (s.over) {
    if (e.code === 'KeyR') {
      const fresh = createWorld(seed);
      Object.assign(s, fresh);
      s.audio = world.audio; s.screen = 'play';
    }
    return;
  }
  if (e.code === 'KeyP' || e.code === 'Escape') {
    if (s.shopOpen) { s.shopOpen = null; return; }
    s.paused = !s.paused;
    return;
  }
  if (s.paused) {
    if (e.code === 'KeyS') saveGame(s);
    if (e.code === 'KeyR') { const fresh = createWorld(seed); Object.assign(s, fresh); s.audio = world.audio; s.screen = 'play'; s.paused = false; }
    return;
  }
  if (s.shopOpen) {
    if (e.code === 'Escape') { s.shopOpen = null; return; }
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
    if (n >= 0) {
      if (s.shopOpen === 'weapons') buyWeapon(s, n);
      else if (s.shopOpen === 'garage' && n < 4) buyCar(s, n);
    }
    if (e.code === 'Digit7') buyUpgrade(s, 'engine');
    if (e.code === 'Digit8') buyUpgrade(s, 'armor');
    return;
  }
  if (s.heistChoice) {
    if (e.code === 'Digit1') edges.choice = 1;
    if (e.code === 'Digit2') edges.choice = 2;
    return;
  }
  if (e.code === 'KeyE') { if (s.nearShop && !s.player.inCar) edges.interact = true; else edges.enter = true; }
  if (e.code === 'KeyF') edges.steal = true;
  if (e.code === 'KeyQ') s.wheelOpen = true;
  if (e.code === 'KeyS' && !keys.ShiftLeft) { /* S is also drive-down; save only via pause */ }
  if (e.code === 'KeyR') { const st = s.audio.cycleStation(); s.saveMsg = 'Radio: ' + st.name; }
  if (e.code === 'KeyM') { s.audio.toggleMute(); }
  if (e.code === 'KeyG') edges.exit = true;
  const wn = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'].indexOf(e.code);
  if (wn >= 0) edges.weaponKey = wn;
  const cn = ['Digit7', 'Digit8', 'Digit9'].indexOf(e.code);
  if (cn >= 0) edges.crewKey = cn;
});

window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'KeyQ') world.wheelOpen = false;
});

canvas.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.down = true; world.audio.ensure(); });
window.addEventListener('mouseup', () => { mouse.down = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---- modes ----
const shotName = params.get('shot');
if (shotName) {
  stageShot(shotName, world);
  render(world, ctx, canvas.width, canvas.height);
  document.title = 'Vermilion Harbor — shot ' + shotName;
} else if (params.get('selftest')) {
  const report = runSelfTest(world);
  render(world, ctx, canvas.width, canvas.height);
  const pre = document.createElement('pre');
  pre.id = 'selftest';
  pre.textContent = JSON.stringify(report, null, 2);
  document.body.appendChild(pre);
  document.title = report.passed ? 'SELFTEST PASS' : 'SELFTEST FAIL';
} else {
  let last = performance.now();
  let acc = 0;
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (world.screen === 'play' && !world.paused && !world.over) {
      acc += dt;
      const stepDt = 1 / 60;
      let guard = 0;
      while (acc >= stepDt && guard < 5) {
        step(world, buildInput(), stepDt);
        acc -= stepDt; guard += 1;
      }
      if (guard === 5) acc = 0;
    }
    render(world, ctx, canvas.width, canvas.height);
    statusEl.textContent = world.screen === 'title'
      ? 'Vermilion Harbor. Press Enter to start.'
      : 'Mission: ' + (world.mission ? world.mission.title : 'free roam') + '. ' + world.objective;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
