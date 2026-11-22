// Vermilion Harbor — the simulation: player, cars, traffic, pedestrians, police, wanted
// level, missions, crew, economy, weather and time. Deterministic from one seed: no
// Math.random anywhere in here, only the seeded rng.
import {
  WORLD_W, WORLD_H, STEP, DISTRICTS, WEAPONS, CAR_TIERS, TRAFFIC_COLORS, CREW,
  RESPECT_RANKS, MISSIONS, SHOPS, GARAGE_UPGRADES, RADIO_STATIONS,
} from './config.js';
import { mulberry32, pick, range, int, clamp, lerp, dist2, angleTo, angleDiff, fmtMoney } from './random.js';
import { generateCity, districtAt, onRoad, inRiver, onBridge, collideBuildings, hitsBuilding, randomRoadPoint, nearestRoadPoint, ROAD_X, ROAD_Y } from './city.js';

export const SAVE_KEY = 'vermilion-harbor-save-v1';

export function createWorld(seed) {
  const rng = mulberry32(seed);
  const city = generateCity(seed);
  const s = {
    seed, rng, city,
    time: 0, clock: 19.4, weather: 'clear', weatherT: 90, rain: 0,
    screen: 'title', paused: false, over: false, overReason: '',
    player: {
      x: 500, y: 620, angle: -Math.PI / 2, hp: 100, armor: 50, speed: 0,
      inCar: false, carId: -1, weapon: 1, ammo: { pistol: 60, smg: 120, shotgun: 24, rifle: 90, rpg: 6 },
      ownedWeapons: ['fists', 'pistol'], money: 800, respect: 0,
      territory: { downtown: 0, oldtown: 0, hillside: 0, beachfront: 0, docks: 0 },
      garageCars: [0], garageUpgrades: { engine: 0, armor: 0 }, currentTier: 0,
      crewCd: { mara: 0, dex: 0, brick: 0 }, allyT: 0, boostT: 0,
      lastCrime: -99, bustedT: 0, onFootT: 0,
    },
    cars: [], peds: [], cops: [], enemies: [], allies: [], bullets: [], parts: [], skids: [],
    boats: [], wanted: 0, heat: 0,
    missionIdx: 0, mission: null, missionDone: [], marker: null, objective: 'Steal a car and meet Mara at the garage.',
    banner: null, toast: null, race: null, boat: null,
    shopOpen: null, garageOpen: false, wheelOpen: false, heistChoice: false,
    cam: { x: 500, y: 620 },
    stats: { shots: 0, carsStolen: 0, missions: 0, busted: 0, wasted: 0, moneyEarned: 0 },
    events: [], log: [],
    saveMsg: '',
  };
  spawnTraffic(s, 34);
  spawnPeds(s, 44);
  spawnParked(s, 12);
  startMission(s, 0);
  return s;
}

export function logEvent(s, kind, data) { s.events.push({ t: +s.time.toFixed(2), kind, ...data }); }
export function say(s, text, sub) { s.banner = { text, sub: sub || '', t: 3.2 }; }
export function toast(s, text) { s.toast = { text, t: 2.6 }; }

export function rankName(respect) {
  let name = RESPECT_RANKS[0].name;
  for (const r of RESPECT_RANKS) if (respect >= r.at) name = r.name;
  return name;
}

export function playerCar(s) {
  if (!s.player.inCar) return null;
  return s.cars.find((c) => c.id === s.player.carId) || null;
}

function nextId(s) { s._id = (s._id || 0) + 1; return s._id; }

export function spawnTraffic(s, n) {
  for (let i = 0; i < n; i += 1) {
    const p = randomRoadPoint(s.rng);
    const tier = int(s.rng, 0, 2);
    s.cars.push({
      id: nextId(s), kind: 'traffic', x: p.x, y: p.y, angle: s.rng() * Math.PI * 2,
      speed: 0, targetSpeed: range(s.rng, 110, 190), tier, color: pick(s.rng, TRAFFIC_COLORS),
      hp: 120, driver: true, w: 44, h: 20, stuck: 0,
    });
  }
}

export function spawnParked(s, n) {
  for (let i = 0; i < n; i += 1) {
    // Inset from the map edge so a stolen car has road ahead of it in both directions.
    const p = { x: range(s.rng, 320, WORLD_W - 320), y: range(s.rng, 320, WORLD_H - 320) };
    const rp = nearestRoadPoint(p.x, p.y);
    const tier = int(s.rng, 0, 3);
    // Park facing along the road it sits on, like a real parked car.
    const vertical = ROAD_X.includes(rp.x);
    const angle = vertical ? pick(s.rng, [Math.PI / 2, -Math.PI / 2]) : pick(s.rng, [0, Math.PI]);
    s.cars.push({
      id: nextId(s), kind: 'parked', x: rp.x, y: rp.y,
      angle, speed: 0, targetSpeed: 0,
      tier, color: pick(s.rng, TRAFFIC_COLORS), hp: CAR_TIERS[tier].hp, driver: false, w: 44, h: 20, stuck: 0,
    });
  }
}

export function spawnPeds(s, n) {
  for (let i = 0; i < n; i += 1) {
    const p = randomRoadPoint(s.rng);
    s.peds.push({
      x: p.x + range(s.rng, -60, 60), y: p.y + range(s.rng, -60, 60),
      angle: s.rng() * Math.PI * 2, speed: range(s.rng, 28, 55), color: pick(s.rng, ['#e07a5f', '#81b29a', '#f2cc8f', '#b5838d', '#6d6875', '#e5989b']),
      flee: 0, w: 10, h: 10,
    });
  }
}

export function addCrime(s, amount) {
  s.heat = clamp(s.heat + amount, 0, 120);
  s.player.lastCrime = s.time;
  const w = Math.min(5, Math.floor(s.heat / 20));
  if (w > s.wanted) { s.wanted = w; if (w >= 1) toast(s, 'WANTED LEVEL ' + w + (w >= 3 ? ' — roadblocks ahead!' : w >= 4 ? ' — Air One is up!' : '')); }
  else s.wanted = w;
}

export function giveMoney(s, n) { s.player.money += n; s.stats.moneyEarned += n; }
export function giveRespect(s, n) { s.player.respect += n; }

// ---- player movement ----
function movePlayerFoot(s, input, dt) {
  const p = s.player;
  let mx = 0; let my = 0;
  if (input.up) my -= 1; if (input.down) my += 1;
  if (input.left) mx -= 1; if (input.right) mx += 1;
  const run = input.run ? 1.7 : 1;
  const sp = 165 * run;
  if (mx || my) {
    const len = Math.hypot(mx, my);
    p.x += (mx / len) * sp * dt; p.y += (my / len) * sp * dt;
    p.angle = Math.atan2(my, mx);
    p.onFootT += dt;
  }
  const pos = collideBuildings(s.city, p.x, p.y, 12);
  p.x = pos.x; p.y = pos.y;
  if (inRiver(p.x, p.y)) { p.x = clamp(p.x, 60, WORLD_W - 60); p.y = clamp(p.y, 60, WORLD_H - 60); }
  p.x = clamp(p.x, 40, WORLD_W - 40); p.y = clamp(p.y, 40, WORLD_H - 40);
}

function driveCar(s, car, input, dt) {
  const p = s.player;
  const tier = CAR_TIERS[car.tier];
  const up = s.player.garageUpgrades;
  const top = tier.topSpeed * (1 + 0.14 * up.engine) * (p.boostT > 0 ? 1.25 : 1);
  const grip = tier.grip * (s.rain > 0.4 ? 0.85 : 1);
  const accel = tier.accel * (1 + 0.12 * up.engine);
  let throttle = 0;
  if (input.up) throttle = 1; else if (input.down) throttle = -0.7;
  car.speed += throttle * accel * dt;
  if (!input.up && !input.down) car.speed *= Math.pow(0.4, dt);
  if (input.handbrake) car.speed *= Math.pow(0.05, dt);
  car.speed = clamp(car.speed, -top * 0.45, top);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  const steerRate = 2.6 * grip * clamp(Math.abs(car.speed) / 120, 0.25, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += steer * steerRate * dt * (input.handbrake ? 1.6 : 1);
  const vx = Math.cos(car.angle) * car.speed;
  const vy = Math.sin(car.angle) * car.speed;
  // Axis-separated collision so the car slides along walls instead of stopping dead.
  let nx = car.x + vx * dt; let ny = car.y + vy * dt;
  const hitX = hitsBuilding(s.city, nx, car.y, 20);
  const hitY = hitsBuilding(s.city, car.x, ny, 20);
  if (hitX || hitY) {
    if (hitX && !hitsBuilding(s.city, car.x, ny, 20)) { nx = car.x; }
    else if (hitY && !hitsBuilding(s.city, nx, car.y, 20)) { ny = car.y; }
    else { nx = car.x; ny = car.y; }
    car.speed *= -0.25;
    car.hp -= Math.abs(car.speed) * 0.02 + 2;
    spawnParts(s, nx, ny, '#ffb347', 6);
    if (car.hp <= 0) explodeCar(s, car);
  }
  if (inRiver(nx, ny) && !onBridge(nx, ny)) { nx = car.x; ny = car.y; car.speed *= 0.4; }
  car.x = clamp(nx, 30, WORLD_W - 30); car.y = clamp(ny, 30, WORLD_H - 30);
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = car.speed;
  if (Math.abs(car.speed) > 240 && input.handbrake) {
    s.skids.push({ x: car.x, y: car.y, a: car.angle, t: 1.6 });
  }
  if (car.hp < 45 && s.rng() < dt * 6) spawnParts(s, car.x, car.y, '#888888', 2);
}

function nearestCar(s, maxD) {
  const p = s.player;
  let best = null; let bd = maxD * maxD;
  for (const c of s.cars) {
    if (c.kind === 'cop' || c.hp <= 0) continue;
    const d = dist2(p.x, p.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(s, car) {
  const p = s.player;
  p.inCar = true; p.carId = car.id; car.driver = 'player'; car.kind = 'player';
  if (car.stolen !== true && car.kind !== 'player') { /* first entry */ }
  logEvent(s, 'enter_car', { tier: car.tier });
}

export function stealCar(s) {
  const p = s.player;
  const car = nearestCar(s, 64);
  if (!car) return false;
  if (car.driver && car.kind === 'traffic') {
    addCrime(s, 18);
    toast(s, 'Car jacked! The driver ran for it.');
  } else {
    addCrime(s, 10);
    toast(s, 'Car stolen — the cops will notice.');
  }
  car.stolen = true;
  s.stats.carsStolen += 1;
  enterCar(s, car);
  logEvent(s, 'steal_car', { tier: car.tier });
  return true;
}

export function exitCar(s) {
  const p = s.player;
  const car = playerCar(s);
  if (!car) return;
  p.inCar = false; p.carId = -1; car.driver = false;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  car.speed = 0;
}

export function explodeCar(s, car) {
  if (car.dead) return;
  car.dead = true; car.hp = 0;
  spawnParts(s, car.x, car.y, '#ff5a3c', 26);
  spawnParts(s, car.x, car.y, '#ffd23f', 14);
  spawnParts(s, car.x, car.y, '#555555', 18);
  if (s.audio) s.audio.explosion();
  addCrime(s, 6);
  logEvent(s, 'car_exploded', { tier: car.tier });
  if (s.player.inCar && s.player.carId === car.id) {
    s.player.hp -= 35;
    exitCar(s);
    if (s.player.hp <= 0) wasted(s);
  }
}

export function spawnParts(s, x, y, color, n) {
  for (let i = 0; i < n; i += 1) {
    const a = s.rng() * Math.PI * 2;
    const sp = range(s.rng, 40, 260);
    s.parts.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: range(s.rng, 0.4, 1.1), max: 1.1, color, size: range(s.rng, 2, 5) });
  }
  if (s.parts.length > 420) s.parts.splice(0, s.parts.length - 420);
}

export function wasted(s) {
  const p = s.player;
  p.hp = 100; p.armor = 0;
  const loss = Math.min(p.money, 300);
  p.money -= loss;
  s.wanted = 0; s.heat = 0; s.cops.length = 0; s.enemies.length = 0;
  s.stats.wasted += 1;
  p.x = 500; p.y = 620; p.inCar = false; p.carId = -1;
  s.over = true; s.overReason = 'WASTED — you lost ' + fmtMoney(loss) + ' at the hospital.';
  say(s, 'WASTED', 'The harbor keeps what it takes. Press R to restart.');
  logEvent(s, 'wasted', {});
}

export function busted(s) {
  const p = s.player;
  const loss = Math.min(p.money, 200);
  p.money -= loss;
  s.wanted = 0; s.heat = 0; s.cops.length = 0;
  s.stats.busted += 1;
  p.x = 500; p.y = 620; p.inCar = false; p.carId = -1;
  say(s, 'BUSTED', 'VCPD took ' + fmtMoney(loss) + '. The garage posted your bail.');
  logEvent(s, 'busted', {});
}

// ---- traffic + pedestrians ----
function updateTraffic(s, dt) {
  const p = s.player;
  for (const c of s.cars) {
    if (c.kind !== 'traffic' || c.hp <= 0) continue;
    // Pick a new target intersection when close to the current one.
    if (!c.tx || dist2(c.x, c.y, c.tx, c.ty) < 60) {
      const vertical = s.rng() < 0.5;
      if (vertical) { c.tx = pick(s.rng, ROAD_X); c.ty = range(s.rng, 120, WORLD_H - 120); }
      else { c.tx = range(s.rng, 120, WORLD_W - 120); c.ty = pick(s.rng, ROAD_Y); }
    }
    // Brake for the car ahead.
    let blocked = false;
    for (const o of s.cars) {
      if (o === c || o.hp <= 0) continue;
      const d = dist2(c.x, c.y, o.x, o.y);
      if (d < 70 * 70) { const a = angleDiff(c.angle, angleTo(c.x, c.y, o.x, o.y)); if (Math.abs(a) < 0.7) blocked = true; }
    }
    const want = angleTo(c.x, c.y, c.tx, c.ty);
    c.angle += clamp(angleDiff(c.angle, want), -1.8 * dt, 1.8 * dt);
    const target = blocked ? 0 : c.targetSpeed * (s.wanted >= 3 && dist2(c.x, c.y, p.x, p.y) < 500 * 500 ? 1.4 : 1);
    c.speed = lerp(c.speed, target, Math.min(1, dt * 1.2));
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!hitsBuilding(s.city, nx, ny, 18) && !inRiver(nx, ny)) { c.x = nx; c.y = ny; }
    else { c.tx = null; c.angle += 1.2; }
    // Collision with the player's car.
    const pc = playerCar(s);
    if (pc && pc !== c && dist2(c.x, c.y, pc.x, pc.y) < 46 * 46) {
      c.hp -= 8 * dt * 10; pc.hp -= 6 * dt * 10;
      c.speed *= 0.5; pc.speed *= 0.7;
      spawnParts(s, (c.x + pc.x) / 2, (c.y + pc.y) / 2, '#ffb347', 4);
      if (c.hp <= 0) explodeCar(s, c);
      if (pc.hp <= 0) explodeCar(s, pc);
    }
  }
}

function updatePeds(s, dt) {
  const p = s.player;
  for (const ped of s.peds) {
    const dPlayer = dist2(ped.x, ped.y, p.x, p.y);
    let flee = ped.flee;
    if (dPlayer < 130 * 130 || s.wanted >= 3) flee = 1.2;
    if (flee > 0) {
      ped.flee = flee - dt;
      const away = angleTo(p.x, p.y, ped.x, ped.y);
      ped.angle += clamp(angleDiff(ped.angle, away), -3 * dt, 3 * dt);
      ped.x += Math.cos(ped.angle) * ped.speed * 2.1 * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * 2.1 * dt;
    } else {
      if (s.rng() < dt * 0.25) ped.angle += range(s.rng, -1.2, 1.2);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!onRoad(ped.x, ped.y) && s.rng() < dt * 0.5) ped.angle += Math.PI / 2;
    }
    const pos = collideBuildings(s.city, ped.x, ped.y, 8);
    ped.x = clamp(pos.x, 40, WORLD_W - 40); ped.y = clamp(pos.y, 40, WORLD_H - 40);
    // Player car hitting a ped.
    const pc = playerCar(s);
    if (pc && Math.abs(pc.speed) > 60 && dist2(ped.x, ped.y, pc.x, pc.y) < 30 * 30) {
      ped.flee = 2; ped.x += Math.cos(pc.angle) * 60; ped.y += Math.sin(pc.angle) * 60;
      addCrime(s, 22);
      toast(s, 'You hit a pedestrian!');
      logEvent(s, 'hit_ped', {});
    }
  }
}

// ---- police ----
function spawnCop(s, kind) {
  const p = s.player;
  const a = s.rng() * Math.PI * 2;
  const d = range(s.rng, 520, 780);
  let x = clamp(p.x + Math.cos(a) * d, 120, WORLD_W - 120);
  let y = clamp(p.y + Math.sin(a) * d, 120, WORLD_H - 120);
  if (inRiver(x, y)) { const rp = { x: 1800, y: 1000 }; x = rp.x; y = rp.y; }
  const cop = {
    kind, x, y, angle: angleTo(x, y, p.x, p.y), speed: 0,
    hp: kind === 'swat' ? 320 : kind === 'heli' ? 200 : 160, w: kind === 'heli' ? 60 : 44, h: 22,
    siren: 0, bustedT: 0, roadblock: kind === 'roadblock',
  };
  s.cops.push(cop);
  return cop;
}

function updatePolice(s, dt) {
  const p = s.player;
  const wantCount = s.wanted === 0 ? 0 : s.wanted === 1 ? 1 : s.wanted === 2 ? 2 : s.wanted === 3 ? 3 : s.wanted === 4 ? 4 : 6;
  const cars = s.cops.filter((c) => c.kind === 'car' || c.kind === 'roadblock' || c.kind === 'swat');
  while (cars.length < wantCount && s.wanted > 0) { spawnCop(s, s.wanted >= 5 && s.rng() < 0.3 ? 'swat' : 'car'); cars.push(s.cops[s.cops.length - 1]); }
  if (s.wanted >= 4 && !s.cops.some((c) => c.kind === 'heli')) spawnCop(s, 'heli');
  if (s.wanted >= 3 && s.time - (s.lastRoadblock || -99) > 22) {
    s.lastRoadblock = s.time;
    const ahead = p.angle;
    for (const off of [-70, 70]) {
      const c = spawnCop(s, 'roadblock');
      c.x = p.x + Math.cos(ahead) * 420 + Math.cos(ahead + Math.PI / 2) * off;
      c.y = p.y + Math.sin(ahead) * 420 + Math.sin(ahead + Math.PI / 2) * off;
      c.angle = ahead + Math.PI / 2;
    }
    toast(s, 'Roadblock ahead!');
  }
  if (s.wanted === 0) {
    for (const c of s.cops) if (c.kind !== 'heli') { c.speed = lerp(c.speed, 0, dt); }
    s.cops = s.cops.filter((c) => c.kind === 'heli' ? false : dist2(c.x, c.y, p.x, p.y) > 900 * 900);
    return;
  }
  for (const c of s.cops) {
    if (c.kind === 'heli') {
      const ta = angleTo(c.x, c.y, p.x + Math.cos(p.angle) * 60, p.y + Math.sin(p.angle) * 60);
      c.angle += clamp(angleDiff(c.angle, ta), -1.4 * dt, 1.4 * dt);
      c.speed = 260;
      c.x += Math.cos(c.angle) * c.speed * dt; c.y += Math.sin(c.angle) * c.speed * dt;
      continue;
    }
    if (c.roadblock) continue; // parked across the road
    const want = angleTo(c.x, c.y, p.x, p.y);
    const top = 300 + s.wanted * 62;
    c.angle += clamp(angleDiff(c.angle, want), -2.4 * dt, 2.4 * dt);
    c.speed = lerp(c.speed, top, Math.min(1, dt * 1.4));
    const nx = c.x + Math.cos(c.angle) * c.speed * dt;
    const ny = c.y + Math.sin(c.angle) * c.speed * dt;
    if (!hitsBuilding(s.city, nx, ny, 18)) { c.x = nx; c.y = ny; }
    else { c.angle += 1.5; c.speed *= 0.6; }
    const pc = playerCar(s);
    if (pc && dist2(c.x, c.y, pc.x, pc.y) < 48 * 48) {
      pc.hp -= 14 * dt * 3; c.hp -= 6 * dt * 3;
      pc.speed *= 0.92;
      if (s.rng() < dt * 8) spawnParts(s, (c.x + pc.x) / 2, (c.y + pc.y) / 2, '#ffb347', 3);
      if (pc.hp <= 0) explodeCar(s, pc);
      if (c.hp <= 0) explodeCar(s, c);
    }
    // Busted: cop touches the player on foot.
    if (!p.inCar && dist2(c.x, c.y, p.x, p.y) < 34 * 34) {
      c.bustedT += dt;
      if (c.bustedT > 1.5) { busted(s); return; }
    } else c.bustedT = 0;
  }
  s.cops = s.cops.filter((c) => c.hp > 0 && !c.dead);
}

// ---- combat ----
export function fireWeapon(s, aimX, aimY) {
  const p = s.player;
  const w = WEAPONS[p.weapon];
  if (p.inCar) return;
  const now = s.time;
  if (now - (p.lastShot || -99) < 1 / w.rate) return;
  if (w.ammo > 0 && (p.ammo[w.id] || 0) <= 0) { toast(s, w.name + ' is dry — visit Ammu-Nation.'); p.lastShot = now; return; }
  p.lastShot = now;
  if (w.ammo > 0) p.ammo[w.id] -= 1;
  s.stats.shots += 1;
  addCrime(s, 2);
  if (s.audio) s.audio.shot();
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    const base = angleTo(p.x, p.y, aimX, aimY);
    const a = base + (s.rng() - 0.5) * 2 * w.spread + (s.rng() - 0.5) * 0.02;
    s.bullets.push({ x: p.x + Math.cos(a) * 20, y: p.y + Math.sin(a) * 20, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: w.range / 900, dmg: w.damage, from: 'player', explosive: !!w.explosive });
  }
  p.angle = angleTo(p.x, p.y, aimX, aimY);
  spawnParts(s, p.x + Math.cos(p.angle) * 24, p.y + Math.sin(p.angle) * 24, '#ffd23f', 3);
}

function updateBullets(s, dt) {
  for (const b of s.bullets) {
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (hitsBuilding(s.city, b.x, b.y, 2)) { b.life = 0; spawnParts(s, b.x, b.y, '#c9c9c9', 2); continue; }
    if (b.from === 'player') {
      for (const e of s.enemies) {
        if (e.hp > 0 && dist2(b.x, b.y, e.x, e.y) < 18 * 18) {
          e.hp -= b.dmg; b.life = 0;
          spawnParts(s, b.x, b.y, '#ff5a5a', 4);
          if (e.hp <= 0) { giveMoney(s, 50); logEvent(s, 'enemy_down', { id: e.id }); }
          break;
        }
      }
      if (b.explosive && b.life <= 0) {
        spawnParts(s, b.x, b.y, '#ff5a3c', 20);
        for (const e of s.enemies) if (dist2(b.x, b.y, e.x, e.y) < 120 * 120) e.hp -= 120;
      }
      for (const c of s.cars) {
        if (c.kind === 'cop') continue;
        if (c.hp > 0 && dist2(b.x, b.y, c.x, c.y) < 24 * 24) { c.hp -= b.dmg; b.life = 0; if (c.hp <= 0) explodeCar(s, c); break; }
      }
    } else {
      const p = s.player;
      if (!p.inCar && dist2(b.x, b.y, p.x, p.y) < 14 * 14) {
        b.life = 0;
        const dmg = Math.max(0, b.dmg - (p.armor > 0 ? 8 : 0));
        if (p.armor > 0) p.armor = Math.max(0, p.armor - b.dmg);
        p.hp -= dmg;
        spawnParts(s, b.x, b.y, '#ff5a5a', 3);
        if (p.hp <= 0) wasted(s);
      }
    }
  }
  s.bullets = s.bullets.filter((b) => b.life > 0);
}

function updateEnemies(s, dt) {
  const p = s.player;
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.sqrt(dist2(e.x, e.y, p.x, p.y));
    if (d < 420 && d > 60) {
      const a = angleTo(e.x, e.y, p.x, p.y);
      e.angle = a;
      e.x += Math.cos(a) * 70 * dt; e.y += Math.sin(a) * 70 * dt;
    }
    if (d < 420 && s.time - (e.lastShot || -99) > 1.1) {
      e.lastShot = s.time;
      const a = angleTo(e.x, e.y, p.x, p.y) + (s.rng() - 0.5) * 0.24;
      s.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 620, vy: Math.sin(a) * 620, life: 0.9, dmg: 9, from: 'enemy' });
    }
    const pos = collideBuildings(s.city, e.x, e.y, 11);
    e.x = pos.x; e.y = pos.y;
  }
  s.enemies = s.enemies.filter((e) => e.hp > 0 || s.time - (e.diedAt || 0) < 0.01 || e.hp > 0);
  for (const e of s.enemies) if (e.hp <= 0 && !e.diedAt) e.diedAt = s.time;
  s.enemies = s.enemies.filter((e) => e.hp > 0);
  // Allies fight alongside the player.
  for (const al of s.allies) {
    const tgt = s.enemies.find((e) => e.hp > 0);
    if (!tgt) continue;
    const d = Math.sqrt(dist2(al.x, al.y, tgt.x, tgt.y));
    if (d > 80) { const a = angleTo(al.x, al.y, tgt.x, tgt.y); al.x += Math.cos(a) * 90 * dt; al.y += Math.sin(a) * 90 * dt; }
    else if (s.time - (al.lastShot || -99) > 0.9) {
      al.lastShot = s.time;
      const a = angleTo(al.x, al.y, tgt.x, tgt.y);
      s.bullets.push({ x: al.x, y: al.y, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 0.8, dmg: 12, from: 'player' });
    }
  }
  s.allies = s.allies.filter((al) => s.time < al.until);
}

// ---- missions ----
export function missionDef(idx) { return MISSIONS[idx]; }

export function startMission(s, idx) {
  const m = MISSIONS[idx];
  if (!m) { s.mission = null; s.objective = 'All ten story jobs done. The harbor is yours, Harbor King.'; s.marker = null; return; }
  s.missionIdx = idx;
  const stages = buildStages(s, m);
  s.mission = { idx, id: m.id, title: m.title, stage: 0, stages, t: 0 };
  s.objective = stages[0].text;
  s.marker = { x: stages[0].x, y: stages[0].y };
  say(s, 'MISSION: ' + m.title, m.brief);
  logEvent(s, 'mission_start', { id: m.id });
}

function buildStages(s, m) {
  const R = s.rng;
  switch (m.id) {
    case 'm1': return [
      { kind: 'steal', text: 'Steal any car (walk up and press F)', x: 500, y: 620, r: 90 },
      { kind: 'goto', text: 'Drive to the Vermilion Garage', x: 500, y: 500, r: 70 },
    ];
    case 'm2': return [
      { kind: 'goto', text: 'Pick up the package at Pier 9', x: 2700, y: 2100, r: 70 },
      { kind: 'goto', text: 'Deliver it to The Sandbar — avoid the heat', x: 400, y: 2000, r: 70 },
    ];
    case 'm3': return [
      { kind: 'stealth', text: 'Reach the Old Town warehouse unseen (stay out of the cones)', x: 2050, y: 420, r: 60 },
      { kind: 'goto', text: 'Grab the ledger and get out', x: 2400, y: 600, r: 60 },
    ];
    case 'm4': return [
      { kind: 'chase', text: 'Ram the courier car until it stops', x: 2600, y: 1100, r: 400, target: 'courier' },
      { kind: 'goto', text: 'Grab the case from the wreck', x: 2600, y: 1100, r: 80 },
    ];
    case 'm5': return [
      { kind: 'kill', text: 'Clear the Salt Dogs off the boardwalk (0/5)', x: 700, y: 1500, r: 320, count: 5, spawned: false },
    ];
    case 'm6': return [
      { kind: 'goto', text: 'Reach the Vermilion Bank', x: 800, y: 400, r: 70 },
      { kind: 'heist', text: 'Choose: LOUD (press 1) or QUIET (press 2)', x: 800, y: 400, r: 70 },
      { kind: 'goto', text: 'Escape to the garage', x: 500, y: 500, r: 70 },
    ];
    case 'm7': return [
      { kind: 'race', text: 'Midnight Grand Prix — 3 laps of the Harbor Circuit', x: 600, y: 1000, r: 80, lap: 0, cp: 0 },
    ];
    case 'm8': return [
      { kind: 'goto', text: 'Take the speedboat at Pier 9', x: 2700, y: 2280, r: 70 },
      { kind: 'boat', text: 'Chase the smuggler boat and sink it', x: 2000, y: 2300, r: 500, target: 'smuggler' },
    ];
    case 'm9': return [
      { kind: 'waves', text: 'Hold the Old Town plaza — wave 1 of 3', x: 2050, y: 350, r: 200, wave: 1, spawned: false },
    ];
    case 'm10': return [
      { kind: 'chase', text: 'Stop Rook\u2019s convoy — ram the lead car', x: 2200, y: 1800, r: 400, target: 'rook' },
      { kind: 'kill', text: 'Take Rook down (0/1)', x: 2200, y: 1800, r: 300, count: 1, spawned: false, boss: true },
      { kind: 'escape', text: 'Lose the 5-star heat — hide until it drops', x: 500, y: 500, r: 400 },
    ];
    default: return [{ kind: 'goto', text: 'Go to the marker', x: 600, y: 600, r: 70 }];
  }
}

function spawnEnemy(s, x, y, hp, boss) {
  const e = { id: nextId(s), x: x + range(s.rng, -40, 40), y: y + range(s.rng, -40, 40), angle: 0, hp: hp || 60, boss: !!boss, lastShot: 0 };
  s.enemies.push(e);
  return e;
}

function spawnTargetCar(s, kind) {
  const p = s.player;
  const spots = { courier: { x: 2600, y: 1100 }, rook: { x: 2200, y: 1800 }, smuggler: { x: 2000, y: 2300 } };
  const sp = spots[kind] || { x: p.x + 300, y: p.y };
  if (kind === 'smuggler') {
    const b = { kind: 'smuggler', x: sp.x, y: sp.y, angle: Math.PI, speed: 200, hp: 120 };
    s.boats.push(b);
    return b;
  }
  const c = { id: nextId(s), kind: 'target', x: sp.x, y: sp.y, angle: 0, speed: 0, targetSpeed: 300, tier: 2, color: '#111111', hp: 220, driver: true, w: 44, h: 20, stuck: 0, tx: sp.x + 400, ty: sp.y };
  s.cars.push(c);
  return c;
}

function advanceStage(s) {
  const m = s.mission;
  m.stage += 1;
  if (m.stage >= m.stages.length) { completeMission(s); return; }
  const st = m.stages[m.stage];
  s.objective = st.text;
  s.marker = { x: st.x, y: st.y };
  if (st.kind === 'chase') spawnTargetCar(s, st.target);
  if (s.audio) s.audio.pickup();
}

function completeMission(s) {
  const m = MISSIONS[s.missionIdx];
  giveMoney(s, m.reward);
  giveRespect(s, m.respect);
  s.player.territory[m.district] = Math.min(100, s.player.territory[m.district] + 12);
  s.missionDone.push(m.id);
  s.stats.missions += 1;
  if (s.audio) s.audio.missionOk();
  say(s, 'JOB DONE: ' + m.title, '+' + fmtMoney(m.reward) + '  •  +' + m.respect + ' respect  •  ' + m.district + ' control up');
  logEvent(s, 'mission_complete', { id: m.id, reward: m.reward });
  s.mission = null; s.marker = null;
  startMission(s, s.missionIdx + 1);
}

function updateMission(s, dt, input) {
  const m = s.mission;
  if (!m) return;
  m.t += dt;
  const st = m.stages[m.stage];
  if (!st) return;
  const p = s.player;
  const dPlayer = st.x !== undefined ? Math.sqrt(dist2(p.x, p.y, st.x, st.y)) : 9999;
  switch (st.kind) {
    case 'steal':
      if (p.inCar) advanceStage(s);
      break;
    case 'goto':
      if (dPlayer < st.r) advanceStage(s);
      break;
    case 'stealth': {
      // Patrol cones: two patrolling guards with vision cones near the warehouse.
      if (!st.guards) {
        st.guards = [{ x: 1980, y: 380, a: 0 }, { x: 2120, y: 480, a: Math.PI }];
        st.spotted = 0;
      }
      let seen = false;
      for (const g of st.guards) {
        g.a += dt * 0.5;
        const d = Math.sqrt(dist2(p.x, p.y, g.x, g.y));
        if (d < 260) {
          const a = angleDiff(g.a, angleTo(g.x, g.y, p.x, p.y));
          if (Math.abs(a) < 0.5) seen = true;
        }
      }
      if (seen) { st.spotted = (st.spotted || 0) + dt; if (st.spotted > 0.8) { addCrime(s, 25); say(s, 'SPOTTED!', 'The warehouse guards raised the alarm. Slip away and try again.'); st.spotted = 0; } }
      if (dPlayer < st.r) advanceStage(s);
      if (s.wanted > 1) { say(s, 'TOO HOT', 'The job needs a cold trail — lose the heat and come back.'); }
      break;
    }
    case 'chase': {
      const tgt = s.cars.find((c) => c.kind === 'target' && c.hp > 0);
      if (!tgt) { advanceStage(s); break; }
      // Target car flees along the roads.
      if (!tgt.tx || dist2(tgt.x, tgt.y, tgt.tx, tgt.ty) < 80) {
        tgt.tx = pick(s.rng, ROAD_X); tgt.ty = range(s.rng, 200, 2200);
      }
      const want = angleTo(tgt.x, tgt.y, tgt.tx, tgt.ty);
      tgt.angle += clamp(angleDiff(tgt.angle, want), -1.6 * dt, 1.6 * dt);
      tgt.speed = lerp(tgt.speed, tgt.targetSpeed, dt);
      const nx = tgt.x + Math.cos(tgt.angle) * tgt.speed * dt;
      const ny = tgt.y + Math.sin(tgt.angle) * tgt.speed * dt;
      if (!hitsBuilding(s.city, nx, ny, 18)) { tgt.x = nx; tgt.y = ny; }
      const pc = playerCar(s);
      if (pc && dist2(tgt.x, tgt.y, pc.x, pc.y) < 50 * 50) {
        tgt.hp -= 26 * dt * 10 * 0.12; pc.speed *= 0.94;
        if (s.rng() < dt * 6) spawnParts(s, tgt.x, tgt.y, '#ffb347', 2);
        if (tgt.hp <= 0) { explodeCar(s, tgt); s.marker = { x: tgt.x, y: tgt.y }; }
      }
      if (tgt.hp <= 0) { advanceStage(s); }
      break;
    }
    case 'kill': {
      if (!st.spawned) {
        st.spawned = true;
        const n = st.count;
        for (let i = 0; i < n; i += 1) spawnEnemy(s, st.x, st.y, st.boss ? 220 : 60, st.boss);
        if (st.boss) say(s, 'ROOK IS HERE', 'Take him down.');
      }
      const left = s.enemies.filter((e) => e.hp > 0).length;
      st.text = st.boss ? 'Take Rook down' : 'Clear the Salt Dogs off the boardwalk (' + (st.count - left) + '/' + st.count + ')';
      s.objective = st.text;
      if (left === 0 && st.spawned) advanceStage(s);
      break;
    }
    case 'heist': {
      s.heistChoice = true;
      if (input.choice === 1) {
        s.heistChoice = false;
        addCrime(s, 80); giveMoney(s, 800);
        for (let i = 0; i < 3; i += 1) spawnEnemy(s, st.x, st.y, 60);
        say(s, 'LOUD IT IS', 'The vault is open. Get to the garage — 4 stars and counting.');
        advanceStage(s);
      } else if (input.choice === 2) {
        s.heistChoice = false;
        addCrime(s, 40); giveMoney(s, 800);
        say(s, 'QUIET AS A GHOST', 'Vault cracked, no alarms. Walk away clean.');
        advanceStage(s);
      }
      break;
    }
    case 'race': {
      if (!s.race) {
        const cps = [{ x: 600, y: 1000 }, { x: 1400, y: 600 }, { x: 2600, y: 1000 }, { x: 2600, y: 1800 }, { x: 1400, y: 2200 }, { x: 600, y: 1800 }];
        s.race = { cps, cp: 0, lap: 1, laps: 3, t: 0, rivals: [] };
        for (let i = 0; i < 3; i += 1) {
          const c = { id: nextId(s), kind: 'rival', x: 600 + i * 50, y: 1060, angle: -Math.PI / 2, speed: 0, targetSpeed: 330 + i * 30, tier: 1 + (i % 2), color: pick(s.rng, TRAFFIC_COLORS), hp: 200, driver: true, w: 44, h: 20, cp: 0, lap: 1 };
          s.cars.push(c); s.race.rivals.push(c);
        }
        say(s, 'MIDNIGHT GRAND PRIX', '3 laps. First through the checkpoints wins.');
      }
      s.race.t += dt;
      const cp = s.race.cps[s.race.cp];
      if (Math.sqrt(dist2(p.x, p.y, cp.x, cp.y)) < 90) {
        s.race.cp += 1;
        if (s.race.cp >= s.race.cps.length) {
          s.race.cp = 0; s.race.lap += 1;
          if (s.race.lap > s.race.laps) {
            const won = s.race.rivals.every((r) => (r.lap < s.race.lap) || (r.lap === s.race.lap && r.cp <= s.race.cp));
            giveMoney(s, won ? 1200 : 300);
            say(s, won ? 'YOU WIN THE GRAND PRIX' : 'GRAND PRIX OVER', won ? '+$1,200 and the crowd chants your name.' : 'You finished, but the cup went to a rival. +$300.');
            s.race = null;
            advanceStage(s);
          } else toast(s, 'Lap ' + s.race.lap + ' of 3');
        }
      }
      s.marker = { x: cp.x, y: cp.y };
      s.objective = 'Grand Prix — lap ' + s.race.lap + '/3, checkpoint ' + (s.race.cp + 1) + '/' + s.race.cps.length;
      // Rivals run the same checkpoints.
      for (const r of s.race.rivals) {
        const rcp = s.race.cps[r.cp];
        const a = angleTo(r.x, r.y, rcp.x, rcp.y);
        r.angle += clamp(angleDiff(r.angle, a), -1.8 * dt, 1.8 * dt);
        r.speed = lerp(r.speed, r.targetSpeed, dt);
        r.x += Math.cos(r.angle) * r.speed * dt; r.y += Math.sin(r.angle) * r.speed * dt;
        if (Math.sqrt(dist2(r.x, r.y, rcp.x, rcp.y)) < 90) {
          r.cp += 1;
          if (r.cp >= s.race.cps.length) { r.cp = 0; r.lap += 1; }
        }
      }
      break;
    }
    case 'boat': {
      const b = s.boats.find((x) => x.kind === 'smuggler');
      if (!b) { advanceStage(s); break; }
      b.angle += Math.sin(s.time * 0.3) * 0.4 * dt;
      b.x += Math.cos(b.angle) * b.speed * dt; b.y += Math.sin(b.angle) * b.speed * dt;
      b.x = clamp(b.x, 1500, 3150); b.y = clamp(b.y, 2280, 2380);
      const pb = s.boat;
      if (pb && dist2(pb.x, pb.y, b.x, b.y) < 90 * 90) {
        b.hp -= 30 * dt;
        if (s.rng() < dt * 5) spawnParts(s, b.x, b.y, '#ff5a3c', 3);
        if (b.hp <= 0) { spawnParts(s, b.x, b.y, '#ff5a3c', 30); s.boats = s.boats.filter((x) => x !== b); }
      }
      break;
    }
    case 'waves': {
      if (!st.spawned) {
        st.spawned = true;
        for (let i = 0; i < 3 + st.wave; i += 1) spawnEnemy(s, st.x, st.y, 60);
        say(s, 'TURF WAR — WAVE ' + st.wave, 'Hold the plaza.');
      }
      const left = s.enemies.filter((e) => e.hp > 0).length;
      if (left === 0) {
        if (st.wave >= 3) {
          s.player.territory.oldtown = 100;
          say(s, 'OLD TOWN IS YOURS', 'Territory 100%. The Salt Dogs are done here.');
          advanceStage(s);
        } else {
          st.wave += 1; st.spawned = false;
          st.text = 'Hold the Old Town plaza — wave ' + st.wave + ' of 3';
          s.objective = st.text;
        }
      }
      break;
    }
    case 'escape': {
      if (s.wanted === 0) { addCrime(s, 0); advanceStage(s); }
      s.objective = 'Lose the heat — wanted ' + s.wanted + ' stars. Stay out of sight.';
      break;
    }
    default: break;
  }
}

// ---- crew ----
export function useCrew(s, idx) {
  const p = s.player;
  const c = CREW[idx];
  if (!c || p.crewCd[c.id] > 0) return false;
  p.crewCd[c.id] = c.cooldown;
  if (c.id === 'mara') {
    const car = { id: nextId(s), kind: 'parked', x: p.x + 120, y: p.y + 40, angle: p.angle, speed: 0, targetSpeed: 0, tier: 2, color: '#ff6b35', hp: CAR_TIERS[2].hp, driver: false, w: 44, h: 20 };
    s.cars.push(car);
    p.boostT = 10;
    say(s, 'MARA: WHEELS UP', 'A Comet S is waiting nearby. 10 seconds of boost — go.');
  } else if (c.id === 'dex') {
    s.heat = Math.max(0, s.heat - 20);
    s.wanted = Math.min(5, Math.floor(s.heat / 20));
    say(s, 'DEX: GHOST PROTOCOL', 'Cameras looped. Wanted down a star.');
  } else if (c.id === 'brick') {
    s.allies.push({ x: p.x + 50, y: p.y + 50, angle: 0, until: s.time + 45, lastShot: 0 });
    p.allyT = 45;
    say(s, 'BRICK IS IN', 'An armed friend watches your back for 45 seconds.');
  }
  logEvent(s, 'crew', { id: c.id });
  return true;
}

// ---- shops / garage ----
export function nearestShop(s) {
  const p = s.player;
  for (const sh of s.city.shops) if (Math.sqrt(dist2(p.x, p.y, sh.x, sh.y)) < 90) return sh;
  return null;
}

export function buyWeapon(s, idx) {
  const p = s.player;
  const w = WEAPONS[idx];
  if (!w || w.id === 'fists') return false;
  if (p.money < w.price) { toast(s, 'Not enough cash for the ' + w.name + '.'); return false; }
  if (p.ownedWeapons.includes(w.id)) {
    p.ammo[w.id] = (p.ammo[w.id] || 0) + w.ammo;
    p.money -= Math.floor(w.price / 3);
    toast(s, 'Ammo restocked: ' + w.name + '.');
    return true;
  }
  p.money -= w.price;
  p.ownedWeapons.push(w.id);
  p.ammo[w.id] = w.ammo;
  p.weapon = idx;
  toast(s, 'Bought the ' + w.name + '!');
  logEvent(s, 'buy_weapon', { id: w.id });
  return true;
}

export function buyCar(s, tier) {
  const p = s.player;
  const t = CAR_TIERS[tier];
  if (!t || p.garageCars.includes(tier)) return false;
  if (p.money < t.price) { toast(s, 'Not enough cash for the ' + t.name + '.'); return false; }
  p.money -= t.price;
  p.garageCars.push(tier);
  p.currentTier = tier;
  toast(s, 'The ' + t.name + ' is yours. It is waiting outside.');
  const car = { id: nextId(s), kind: 'parked', x: p.x + 90, y: p.y, angle: 0, speed: 0, targetSpeed: 0, tier, color: t.colors[0], hp: t.hp, driver: false, w: 44, h: 20 };
  s.cars.push(car);
  logEvent(s, 'buy_car', { tier });
  return true;
}

export function buyUpgrade(s, id) {
  const p = s.player;
  const u = GARAGE_UPGRADES.find((x) => x.id === id);
  if (!u) return false;
  const lvl = p.garageUpgrades[id];
  if (lvl >= u.max) { toast(s, u.name + ' is already maxed.'); return false; }
  const price = u.prices[lvl];
  if (p.money < price) { toast(s, 'Not enough cash for ' + u.name + ' Lv' + (lvl + 1) + '.'); return false; }
  p.money -= price;
  p.garageUpgrades[id] = lvl + 1;
  toast(s, u.name + ' upgraded to Lv' + (lvl + 1) + '.');
  return true;
}

// ---- save / load ----
export function serialize(s) {
  const p = s.player;
  return JSON.stringify({
    money: p.money, respect: p.respect, territory: p.territory, garageCars: p.garageCars,
    garageUpgrades: p.garageUpgrades, currentTier: p.currentTier, ownedWeapons: p.ownedWeapons,
    ammo: p.ammo, missionIdx: s.missionIdx, missionDone: s.missionDone, clock: s.clock,
  });
}

export function saveGame(s) {
  try {
    localStorage.setItem(SAVE_KEY, serialize(s));
    s.saveMsg = 'Game saved.';
    logEvent(s, 'save', {});
    return true;
  } catch (e) { s.saveMsg = 'Save failed.'; return false; }
}

export function loadSave(s) {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const d = JSON.parse(raw);
    const p = s.player;
    p.money = d.money; p.respect = d.respect; p.territory = d.territory;
    p.garageCars = d.garageCars; p.garageUpgrades = d.garageUpgrades; p.currentTier = d.currentTier;
    p.ownedWeapons = d.ownedWeapons; p.ammo = d.ammo;
    s.clock = d.clock || 19.4;
    s.missionDone = d.missionDone || [];
    startMission(s, d.missionIdx || 0);
    s.saveMsg = 'Save loaded.';
    logEvent(s, 'load', {});
    return true;
  } catch (e) { return false; }
}

// ---- boats ----
function boardBoat(s) {
  const p = s.player;
  s.boat = { kind: 'player', x: 2700, y: 2300, angle: Math.PI, speed: 0, hp: 150 };
  p.x = s.boat.x; p.y = s.boat.y;
  say(s, 'ON THE WATER', 'Chase the smuggler boat. Ram it to sink it.');
  logEvent(s, 'board_boat', {});
}

function updateBoat(s, input, dt) {
  const b = s.boat;
  if (!b) return;
  const p = s.player;
  let throttle = 0;
  if (input.up) throttle = 1; else if (input.down) throttle = -0.6;
  b.speed = clamp(b.speed + throttle * 260 * dt, -120, 520);
  if (!input.up && !input.down) b.speed *= Math.pow(0.5, dt);
  const steer = (input.left ? -1 : 0) + (input.right ? 1 : 0);
  b.angle += steer * 1.9 * dt * clamp(Math.abs(b.speed) / 150, 0.3, 1) * (b.speed >= 0 ? 1 : -1);
  b.x = clamp(b.x + Math.cos(b.angle) * b.speed * dt, 1500, 3180);
  b.y = clamp(b.y + Math.sin(b.angle) * b.speed * dt, 2260, 2390);
  p.x = b.x; p.y = b.y; p.angle = b.angle;
  if (s.rng() < dt * 4) spawnParts(s, b.x - Math.cos(b.angle) * 20, b.y - Math.sin(b.angle) * 20, '#bfe9ff', 1);
}

// ---- the main step ----
export function step(s, input, dt) {
  if (s.screen !== 'play' || s.paused || s.over) return;
  s.time += dt;
  s.clock = (s.clock + dt * 0.04) % 24;
  // Weather: clear stretches, then rain.
  s.weatherT -= dt;
  if (s.weatherT <= 0) {
    if (s.weather === 'clear') { s.weather = 'rain'; s.weatherT = 45; }
    else { s.weather = 'clear'; s.weatherT = 90; }
  }
  s.rain = lerp(s.rain, s.weather === 'rain' ? 1 : 0, Math.min(1, dt * 0.5));

  const p = s.player;
  // Timers.
  for (const k of Object.keys(p.crewCd)) if (p.crewCd[k] > 0) p.crewCd[k] -= dt;
  if (p.boostT > 0) p.boostT -= dt;
  if (p.allyT > 0) p.allyT -= dt;
  if (s.banner) { s.banner.t -= dt; if (s.banner.t <= 0) s.banner = null; }
  if (s.toast) { s.toast.t -= dt; if (s.toast.t <= 0) s.toast = null; }
  if (s.saveMsg) { s._saveT = (s._saveT || 2) - dt; if (s._saveT <= 0) { s.saveMsg = ''; s._saveT = 2; } }

  // Wanted decay when the trail is cold.
  if (s.time - p.lastCrime > 6 && s.wanted > 0) {
    let nearCop = false;
    for (const c of s.cops) if (dist2(c.x, c.y, p.x, p.y) < 500 * 500) { nearCop = true; break; }
    if (!nearCop) {
      s.heat = Math.max(0, s.heat - 4 * dt);
      s.wanted = Math.min(5, Math.floor(s.heat / 20));
    }
  }
  // Passive income from controlled territory, once a game minute.
  s._incomeT = (s._incomeT || 0) + dt;
  if (s._incomeT >= 60) {
    s._incomeT = 0;
    let income = 0;
    for (const d of Object.keys(p.territory)) income += Math.floor(p.territory[d] / 100 * 6);
    if (income > 0) { giveMoney(s, income); toast(s, 'Territory income +' + fmtMoney(income)); }
  }
  // Slow health regen out of combat.
  if (s.time - p.lastCrime > 10 && p.hp > 0 && p.hp < 100) p.hp = Math.min(100, p.hp + 1.5 * dt);

  // Movement.
  if (s.boat) updateBoat(s, input, dt);
  else if (p.inCar) { const car = playerCar(s); if (car) driveCar(s, car, input, dt); else { p.inCar = false; p.carId = -1; } }
  else movePlayerFoot(s, input, dt);

  // Enter / steal / board.
  if (input.enter) {
    if (s.mission && s.mission.stages[s.mission.stage].kind === 'boat' && !s.boat && Math.sqrt(dist2(p.x, p.y, 2700, 2280)) < 110) boardBoat(s);
    else if (!p.inCar && !s.boat) {
      const car = nearestCar(s, 64);
      if (car) enterCar(s, car);
    }
  }
  if (input.steal && !p.inCar && !s.boat) stealCar(s);
  if (input.exit && (p.inCar || s.boat)) {
    if (s.boat) { s.boat = null; p.x = clamp(p.x, 60, WORLD_W - 60); p.y = 2240; }
    else exitCar(s);
  }

  // Combat.
  if (input.shoot && input.aimX !== undefined) fireWeapon(s, input.aimX, input.aimY);
  if (input.weaponKey !== undefined && input.weaponKey !== null) {
    const w = WEAPONS[input.weaponKey];
    if (w && p.ownedWeapons.includes(w.id)) p.weapon = input.weaponKey;
  }
  if (input.crewKey !== undefined && input.crewKey !== null) useCrew(s, input.crewKey);

  // Shops.
  const shop = nearestShop(s);
  s.nearShop = shop;
  if (input.interact && shop && !p.inCar) {
    if (shop.kind === 'repair') {
      if (p.money >= 150) {
        p.money -= 150; s.heat = 0; s.wanted = 0;
        const car = playerCar(s);
        toast(s, "Pay 'n Spray — clean plates, no heat.");
      } else toast(s, "Pay 'n Spray costs $150.");
    } else if (shop.kind === 'weapons') s.shopOpen = 'weapons';
    else if (shop.kind === 'garage') s.shopOpen = 'garage';
    else if (shop.kind === 'bar') { p.hp = 100; toast(s, 'The Sandbar — a drink, a story, full health.'); }
  }

  updateTraffic(s, dt);
  updatePeds(s, dt);
  updatePolice(s, dt);
  updateBullets(s, dt);
  updateEnemies(s, dt);
  updateMission(s, dt, input);

  // Particles and skid marks.
  for (const pt of s.parts) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vx *= 0.96; pt.vy *= 0.96; pt.t -= dt; }
  s.parts = s.parts.filter((pt) => pt.t > 0);
  for (const sk of s.skids) sk.t -= dt;
  s.skids = s.skids.filter((sk) => sk.t > 0);

  // Camera follows the player.
  const tx = clamp(p.x, 640, WORLD_W - 640);
  const ty = clamp(p.y, 400, WORLD_H - 400);
  s.cam.x = lerp(s.cam.x, tx, Math.min(1, dt * 4));
  s.cam.y = lerp(s.cam.y, ty, Math.min(1, dt * 4));

  // Audio follows the game.
  if (s.audio) {
    const pc = playerCar(s);
    s.audio.setEngine(pc ? Math.abs(pc.speed) / 700 : 0, !!pc);
    s.audio.setSiren(s.wanted > 0 && s.cops.length > 0, s.wanted);
  }
}

export function districtNameAt(s) {
  return districtAt(s.player.x, s.player.y).name;
}

export function timeOfDay(s) {
  const h = Math.floor(s.clock);
  const m = Math.floor((s.clock - h) * 60);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  const label = s.clock < 5 ? 'Night' : s.clock < 8 ? 'Dawn' : s.clock < 17 ? 'Day' : s.clock < 20 ? 'Dusk' : 'Night';
  return { text: hh + ':' + mm, label };
}
