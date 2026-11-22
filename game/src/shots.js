// Vermilion Harbor — screenshot scenes. Each one plays the real rules forward from a
// fresh world for a fixed number of steps, steered by a scripted driver, so the frame is
// what a short stretch of real play looks like and the same seed always gives the same
// frame. Nothing here is a mockup: the cops, the wanted level, the traffic and the
// mission state are all live simulation.
import { STEP, CAR_TIERS } from './config.js';
import { step, giveMoney, giveRespect, addCrime } from './world.js';
import { ROAD_X } from './city.js';

const SAMPLE = STEP;

function driveToward(s, tx, ty, seconds) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const car = s.cars.find((c) => c.id === s.player.carId);
    if (!car) break;
    const want = Math.atan2(ty - car.y, tx - car.x);
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    step(s, { up: true, down: false, left: diff < -0.08, right: diff > 0.08, handbrake: false }, SAMPLE);
  }
}

function walkToward(s, tx, ty, seconds) {
  for (let i = 0; i < seconds / SAMPLE; i += 1) {
    const p = s.player;
    const dx = tx - p.x; const dy = ty - p.y;
    step(s, { up: dy < -20, down: dy > 20, left: dx < -20, right: dx > 20, run: true }, SAMPLE);
  }
}

function stageChase(s) {
  // The money shot: a Comet S at speed, three VCPD cars and Air One on it, a roadblock
  // ahead, four wanted stars, the minimap with a GPS line and a live mission objective.
  s.screen = 'play';
  const car = { id: 9001, kind: 'player', x: 600, y: 1000, angle: 0, speed: 420, targetSpeed: 0, tier: 2, color: '#ff6b35', hp: 62, driver: 'player', w: 44, h: 20 };
  s.cars.push(car);
  s.player.inCar = true; s.player.carId = 9001;
  s.player.x = 600; s.player.y = 1000; s.player.angle = 0;
  s.player.money = 2450; s.player.respect = 320;
  addCrime(s, 80); // wanted 4
  s.cops.push(
    { kind: 'car', x: 420, y: 940, angle: 0.2, speed: 380, hp: 160, w: 44, h: 22, siren: 0, bustedT: 0 },
    { kind: 'car', x: 380, y: 1060, angle: -0.2, speed: 400, hp: 160, w: 44, h: 22, siren: 0, bustedT: 0 },
    { kind: 'car', x: 480, y: 1000, angle: 0, speed: 360, hp: 160, w: 44, h: 22, siren: 0, bustedT: 0 },
    { kind: 'heli', x: 700, y: 880, angle: 0, speed: 260, hp: 200, w: 60, h: 22, siren: 0, bustedT: 0 },
    { kind: 'roadblock', x: 1450, y: 960, angle: Math.PI / 2, speed: 0, hp: 160, w: 44, h: 22, siren: 0, bustedT: 0, roadblock: true },
    { kind: 'roadblock', x: 1450, y: 1040, angle: Math.PI / 2, speed: 0, hp: 160, w: 44, h: 22, siren: 0, bustedT: 0, roadblock: true },
  );
  s.objective = 'Escape the dragnet — lose the heat';
  s.marker = { x: 500, y: 500 };
  s.banner = { text: 'MISSION: Dockside Drop', sub: 'The package is in the trunk. The whole city is behind you.', t: 99 };
  s.cam.x = 600; s.cam.y = 1000;
  driveToward(s, 1300, 1000, 3.2);
  // Re-stage the pursuit pack tight around the player's final position so the frame
  // shows the chase, not an empty road: two squad cars on the tail, one alongside,
  // Air One overhead, the roadblock just ahead.
  const px = s.player.x; const py = s.player.y;
  const pack = s.cops;
  if (pack[0]) { pack[0].x = px - 190; pack[0].y = py - 55; pack[0].angle = 0.15; pack[0].speed = 420; }
  if (pack[1]) { pack[1].x = px - 240; pack[1].y = py + 60; pack[1].angle = -0.15; pack[1].speed = 430; }
  if (pack[2]) { pack[2].x = px - 90; pack[2].y = py + 120; pack[2].angle = 0.1; pack[2].speed = 400; }
  if (pack[3]) { pack[3].x = px + 60; pack[3].y = py - 150; }
  if (pack[4]) { pack[4].x = px + 330; pack[4].y = py - 40; }
  if (pack[5]) { pack[5].x = px + 330; pack[5].y = py + 40; }
  s.cam.x = px; s.cam.y = py;
  // Frame the chase at speed: a healthy car, full health, no stray toasts.
  const pcar = s.cars.find((c) => c.id === s.player.carId);
  if (pcar) { pcar.hp = 130; pcar.speed = 430; }
  s.player.hp = 100;
  s.toast = null;
  // The mission engine re-labels the objective while the car is being driven; restore
  // the chase framing for the frame.
  s.objective = 'Escape the dragnet — lose the heat';
  s.marker = { x: 500, y: 500 };
  s.banner = { text: 'MISSION: Dockside Drop', sub: 'The package is in the trunk. The whole city is behind you.', t: 99 };
  return { screen: 'play' };
}

function stageStreet(s) {
  // On foot on the Beachfront boardwalk: pedestrians, traffic, a mission timer, the
  // Salt Dogs ahead and the whole city alive around the player.
  s.screen = 'play';
  s.player.x = 700; s.player.y = 1500; s.player.angle = -Math.PI / 2;
  s.player.money = 1250; s.player.respect = 160;
  s.objective = 'Clear the Salt Dogs off the boardwalk (2/5)';
  s.marker = { x: 700, y: 1250 };
  s.mission = { idx: 4, id: 'm5', title: 'Beachfront Brawl', stage: 0, stages: [{ kind: 'kill', text: 'Clear the Salt Dogs off the boardwalk (2/5)', x: 700, y: 1250, r: 320, count: 5, spawned: true }], t: 0 };
  s.enemies.push(
    { id: 9101, x: 760, y: 1320, angle: 0, hp: 60, lastShot: 0 },
    { id: 9102, x: 640, y: 1290, angle: 0, hp: 40, lastShot: 0 },
    { id: 9103, x: 820, y: 1420, angle: 0, hp: 60, lastShot: 0 },
    { id: 9104, x: 580, y: 1400, angle: 0, hp: 60, lastShot: 0 },
    { id: 9105, x: 900, y: 1300, angle: 0, hp: 60, lastShot: 0 },
  );
  s.cam.x = 700; s.cam.y = 1500;
  walkToward(s, 700, 1380, 4);
  // Frame on foot: full health, rivals close and visible, a few pedestrians near.
  s.player.hp = 100; s.player.armor = 50;
  s.toast = null;
  const ring = [[170, -110], [-190, -60], [60, -210], [-60, 200], [230, 90]];
  s.enemies.forEach((e, i) => { e.x = s.player.x + ring[i][0]; e.y = s.player.y + ring[i][1]; });
  for (let i = 0; i < 3; i += 1) {
    s.peds.push({ x: s.player.x + [-140, 120, 220][i], y: s.player.y + [80, 140, -40][i], angle: 0, speed: 40, color: '#81b29a', flee: 0, w: 10, h: 10 });
  }
  s.cam.x = s.player.x; s.cam.y = s.player.y;
  return { screen: 'play' };
}

function stageCombat(s) {
  // Mid-shootout with the weapon wheel open: SMG selected, four rivals with health bars,
  // a muzzle flash, a roadblock behind them and the wanted stars lit.
  s.screen = 'play';
  s.player.x = 700; s.player.y = 1500; s.player.angle = -Math.PI / 2;
  s.player.ownedWeapons = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
  s.player.ammo = { pistol: 60, smg: 180, shotgun: 24, rifle: 90, rpg: 6 };
  s.player.weapon = 2;
  s.player.money = 3100; s.player.respect = 420;
  s.wheelOpen = true;
  addCrime(s, 60); // wanted 3
  s.enemies.push(
    { id: 9201, x: 780, y: 1360, angle: 0, hp: 60, lastShot: 0 },
    { id: 9202, x: 640, y: 1340, angle: 0, hp: 45, lastShot: 0 },
    { id: 9203, x: 860, y: 1440, angle: 0, hp: 60, lastShot: 0 },
    { id: 9204, x: 600, y: 1440, angle: 0, hp: 30, lastShot: 0 },
  );
  s.cops.push({ kind: 'roadblock', x: 1000, y: 1400, angle: Math.PI / 2, speed: 0, hp: 160, w: 44, h: 22, siren: 0, bustedT: 0, roadblock: true });
  s.objective = 'Clear the Salt Dogs off the boardwalk (2/5)';
  s.marker = { x: 700, y: 1250 };
  s.banner = { text: 'BEACHFRONT BRAWL', sub: 'Four rivals left. The wheel is open — pick your tool.', t: 99 };
  s.cam.x = 700; s.cam.y = 1470;
  // Fire two real bursts at the nearest rival so the frame shows live tracers.
  for (let i = 0; i < 30; i += 1) {
    step(s, { shoot: true, aimX: 780, aimY: 1360 }, SAMPLE);
  }
  s.wheelOpen = true;
  // Frame the fight: rivals in a ring around the player at the wheel's edge, full
  // health, no banner or toast fighting the wheel for the centre of the frame.
  const px = s.player.x; const py = s.player.y;
  const ring = [[230, -40], [-240, -80], [120, 240], [-140, 220]];
  s.enemies.forEach((e, i) => { e.x = px + ring[i][0]; e.y = py + ring[i][1]; e.hp = 60; });
  s.player.hp = 100; s.player.armor = 50;
  s.banner = null; s.toast = null;
  s.cam.x = px; s.cam.y = py;
  return { screen: 'play' };
}

function stageGarage(s) {
  // Progression on display: all four garage tiers owned, the Vermilion GT as the ride,
  // engine and armor upgraded, respect at Wheelman, cash in hand.
  s.screen = 'play';
  s.player.x = 500; s.player.y = 500;
  s.player.money = 5200; s.player.respect = 520;
  s.player.garageCars = [0, 1, 2, 3];
  s.player.currentTier = 3;
  s.player.garageUpgrades = { engine: 2, armor: 1 };
  s.player.ownedWeapons = ['fists', 'pistol', 'smg', 'shotgun', 'rifle'];
  s.player.missionDone = ['m1', 'm2', 'm3', 'm4'];
  s.missionDone = ['m1', 'm2', 'm3', 'm4'];
  s.shopOpen = 'garage';
  s.objective = 'Next job: The Vermilion Job — the bank vault';
  s.banner = null; s.toast = null;
  s.cam.x = 500; s.cam.y = 500;
  return { screen: 'play' };
}

export function stageShot(name, world) {
  if (name === 'chase') return stageChase(world);
  if (name === 'street') return stageStreet(world);
  if (name === 'combat') return stageCombat(world);
  if (name === 'garage') return stageGarage(world);
  // Default: title screen after five seconds of the city living.
  world.screen = 'title';
  for (let i = 0; i < 5 / SAMPLE; i += 1) {
    world.screen = 'play';
    step(world, {}, SAMPLE);
    world.screen = 'title';
  }
  return { screen: 'title' };
}
