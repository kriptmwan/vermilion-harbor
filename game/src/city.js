// Vermilion Harbor — city generation. A deterministic road grid, five districts, a river
// with two bridges, a harbor along the south edge, and the props that make it a city.
import { DISTRICTS, RIVER, SEA, BRIDGES, ROAD_W, WORLD_W, WORLD_H, SHOPS } from './config.js';
import { mulberry32, range, int, pick } from './random.js';

export const ROAD_X = [200, 600, 1000, 1400, 1800, 2200, 2600, 3000];
export const ROAD_Y = [200, 600, 1000, 1400, 1800, 2200];

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  return DISTRICTS[0];
}

export function onBridge(x, y) {
  for (const b of BRIDGES) if (x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h) return true;
  return false;
}

export function inRiver(x, y) {
  if (x >= RIVER.x && x < RIVER.x + RIVER.w && y >= RIVER.y0 && y < RIVER.y1 && !onBridge(x, y)) return true;
  if (y >= SEA.y && !(x >= 2600 && x < 2900)) return true; // south harbor water, pier gap at 2600-2900
  return false;
}

export function onRoad(x, y) {
  if (inRiver(x, y)) return false;
  const hw = ROAD_W / 2;
  for (const rx of ROAD_X) if (Math.abs(x - rx) < hw) return true;
  for (const ry of ROAD_Y) if (Math.abs(y - ry) < hw) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  let bx = ROAD_X[0]; let bd = Math.abs(x - bx);
  for (const rx of ROAD_X) if (Math.abs(x - rx) < bd) { bd = Math.abs(x - rx); bx = rx; }
  let by = ROAD_Y[0]; bd = Math.abs(y - by);
  for (const ry of ROAD_Y) if (Math.abs(y - ry) < bd) { bd = Math.abs(y - ry); by = ry; }
  return Math.abs(x - bx) < Math.abs(y - by) ? { x: bx, y } : { x, y: by };
}

export function generateCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const props = [];
  const palms = [];
  const containers = [];
  const lamps = [];
  // Buildings fill the blocks between roads, never on roads, river or sea.
  for (let gx = 0; gx < ROAD_X.length - 1; gx += 1) {
    for (let gy = 0; gy < ROAD_Y.length - 1; gy += 1) {
      const x0 = ROAD_X[gx] + ROAD_W / 2 + 14;
      const x1 = ROAD_X[gx + 1] - ROAD_W / 2 - 14;
      const y0 = ROAD_Y[gy] + ROAD_W / 2 + 14;
      const y1 = ROAD_Y[gy + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      const d = districtAt((x0 + x1) / 2, (y0 + y1) / 2);
      const n = int(rng, 2, 4);
      for (let i = 0; i < n; i += 1) {
        const w = range(rng, 70, Math.min(170, (x1 - x0) / 2));
        const h = range(rng, 60, Math.min(150, (y1 - y0) / 2));
        const bx = range(rng, x0, Math.max(x0 + 1, x1 - w));
        const by = range(rng, y0, Math.max(y0 + 1, y1 - h));
        if (inRiver(bx + w / 2, by + h / 2)) continue;
        const tall = d.id === 'downtown' ? range(rng, 0.5, 1) : range(rng, 0.1, 0.45);
        buildings.push({ x: bx, y: by, w, h, d: d.id, tall, shade: range(rng, 0.82, 1.08), lit: rng() < 0.5 });
      }
      // District props: palms on Beachfront, containers at the Docks, lamps everywhere.
      if (d.id === 'beachfront') {
        for (let i = 0; i < 3; i += 1) palms.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 5, 8) });
      }
      if (d.id === 'docks') {
        for (let i = 0; i < 2; i += 1) containers.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), w: range(rng, 50, 90), h: 24, c: pick(rng, ['#e63946', '#2a9d8f', '#e9c46a', '#4361ee', '#f3722c']) });
      }
      if (rng() < 0.6) lamps.push({ x: (x0 + x1) / 2, y: y0 - 4 });
    }
  }
  // Park in Hillside, plaza in Old Town.
  props.push({ kind: 'park', x: 2400, y: 1050, w: 260, h: 160 });
  props.push({ kind: 'plaza', x: 2050, y: 350, w: 220, h: 140 });
  return { buildings, props, palms, containers, lamps, shops: SHOPS.map((s) => ({ ...s })) };
}

export function collideBuildings(city, x, y, r) {
  // Push a circle out of building AABBs; returns corrected position.
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx; const dy = y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 0.001) { x = b.x - r; continue; }
      const d = Math.sqrt(d2);
      x = cx + (dx / d) * r; y = cy + (dy / d) * r;
    }
  }
  return { x, y };
}

export function hitsBuilding(city, x, y, r) {
  for (const b of city.buildings) {
    if (x + r > b.x && x - r < b.x + b.w && y + r > b.y && y - r < b.y + b.h) return b;
  }
  return null;
}

export function randomRoadPoint(rng) {
  const vertical = rng() < 0.5;
  if (vertical) return { x: pick(rng, ROAD_X), y: range(rng, 120, WORLD_H - 120) };
  return { x: range(rng, 120, WORLD_W - 120), y: pick(rng, ROAD_Y) };
}
