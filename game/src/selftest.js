// Vermilion Harbor — scripted playtest. Drives the real simulation with scripted inputs
// and reports what actually happened: steal a car, wanted rises, police chase, a mission
// completes, shooting works, pause freezes the clock, save/load round-trips. Runs in the
// browser under ?selftest=1 and writes its JSON report into the page.
import { STEP } from './config.js';
import { step, stealCar, saveGame, loadSave, fireWeapon, addCrime } from './world.js';

export function runSelfTest(s) {
  const results = [];
  const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail: detail || '' });
  const nearCar = () => s.cars.find((c) => c.kind === 'parked' && c.hp > 0);

  s.screen = 'play';
  // 1. Steal a car.
  const car = nearCar();
  s.player.x = car.x + 10; s.player.y = car.y + 10;
  stealCar(s);
  check('steal_car', s.player.inCar === true, 'inCar=' + s.player.inCar);
  check('steal_crime', s.wanted >= 1 || s.heat > 0, 'wanted=' + s.wanted + ' heat=' + Math.round(s.heat));

  // 2. Drive: the car must actually move (steered along the road, like a real player).
  const x0 = s.player.x; const y0 = s.player.y;
  const pc0 = s.cars.find((c) => c.id === s.player.carId);
  const tx = pc0.x + Math.cos(pc0.angle) * 900;
  const ty = pc0.y + Math.sin(pc0.angle) * 900;
  for (let i = 0; i < 180; i += 1) {
    const car = s.cars.find((c) => c.id === s.player.carId);
    let diff = Math.atan2(ty - car.y, tx - car.x) - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    step(s, { up: true, left: diff < -0.08, right: diff > 0.08 }, STEP);
  }
  const moved = Math.hypot(s.player.x - x0, s.player.y - y0);
  check('drive_moves', moved > 200, 'moved=' + Math.round(moved));

  // 3. Wanted rises and police respond.
  addCrime(s, 45);
  for (let i = 0; i < 240; i += 1) step(s, { up: true }, STEP);
  check('wanted_rises', s.wanted >= 2, 'wanted=' + s.wanted);
  check('police_chase', s.cops.length > 0, 'cops=' + s.cops.length);

  // 4. Mission 1 completes: drive the stolen car to the garage marker.
  const pc = s.cars.find((c) => c.id === s.player.carId);
  if (pc) { pc.x = 520; pc.y = 510; s.player.x = 520; s.player.y = 510; }
  for (let i = 0; i < 120; i += 1) step(s, {}, STEP);
  check('mission1_complete', s.missionDone.includes('m1'), 'done=' + s.missionDone.join(','));

  // 5. Shooting: on foot, SMG at a spawned enemy.
  s.player.inCar = false; s.player.carId = -1;
  s.player.ownedWeapons = ['fists', 'pistol', 'smg'];
  s.player.weapon = 2;
  s.enemies.push({ id: 99901, x: s.player.x + 120, y: s.player.y, angle: 0, hp: 60, lastShot: 0 });
  const hpBefore = s.enemies[0].hp;
  for (let i = 0; i < 90; i += 1) step(s, { shoot: true, aimX: s.player.x + 120, aimY: s.player.y }, STEP);
  const enemy = s.enemies[0];
  check('shooting_hits', !enemy || enemy.hp < hpBefore, 'hp ' + hpBefore + ' -> ' + (enemy ? enemy.hp : 'dead'));
  check('shots_fired', s.stats.shots > 0, 'shots=' + s.stats.shots);

  // 6. Pause freezes the clock.
  const t0 = s.time;
  s.paused = true;
  for (let i = 0; i < 60; i += 1) step(s, { up: true }, STEP);
  check('pause_freezes', s.time === t0, 'time ' + t0 + ' -> ' + s.time);
  s.paused = false;

  // 7. Save / load round-trip.
  const moneyBefore = s.player.money;
  const saved = saveGame(s);
  s.player.money = 0;
  const loaded = loadSave(s);
  check('save_load', saved && loaded && s.player.money === moneyBefore, 'saved=' + saved + ' loaded=' + loaded + ' money=' + s.player.money);

  // 8. No NaNs anywhere in the player state.
  const bad = [s.player.x, s.player.y, s.player.hp, s.player.money, s.cam.x, s.cam.y].some((v) => Number.isNaN(v));
  check('no_nan', !bad, '');

  const passed = results.every((r) => r.ok);
  return { passed, results, summary: { wanted: s.wanted, cops: s.cops.length, missions: s.missionDone.length, money: s.player.money, time: +s.time.toFixed(1) } };
}
