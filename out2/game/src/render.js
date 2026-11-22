// Vermilion Harbor — canvas renderer: the city, every entity, the HUD, the minimap and
// the menus. Top-down 2D, one camera, drawn fresh every frame from the simulation state.
import { WORLD_W, WORLD_H, ROAD_W, DISTRICTS, RIVER, SEA, BRIDGES, WEAPONS, CAR_TIERS, CREW, RADIO_STATIONS } from './config.js';
import { clamp, lerp, fmtMoney } from './random.js';
import { districtAt, onBridge, ROAD_X, ROAD_Y } from './city.js';
import { rankName, timeOfDay, districtNameAt } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCar(ctx, x, y, angle, color, opts) {
  const o = opts || {};
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  roundRect(ctx, -21, -9, 46, 22, 6);
  ctx.fill();
  ctx.translate(0, -2);
  // Wheels.
  ctx.fillStyle = '#111';
  ctx.fillRect(-15, -13, 10, 5); ctx.fillRect(7, -13, 10, 5);
  ctx.fillRect(-15, 8, 10, 5); ctx.fillRect(7, 8, 10, 5);
  // Body.
  ctx.fillStyle = color;
  roundRect(ctx, -22, -10, 44, 20, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  roundRect(ctx, -8, -8, 16, 16, 4);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = '#1b2a3a';
  ctx.fillRect(8, -8, 6, 16);
  ctx.fillRect(-18, -8, 4, 16);
  if (o.cop) {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(-4, -10, 12, 20);
    const t = (o.time || 0) * 6;
    ctx.fillStyle = Math.sin(t) > 0 ? '#ff2d55' : '#2ec4ff';
    ctx.fillRect(-2, -11, 5, 4);
    ctx.fillStyle = Math.sin(t) > 0 ? '#2ec4ff' : '#ff2d55';
    ctx.fillRect(-2, 7, 5, 4);
  }
  if (o.headlights) {
    ctx.fillStyle = '#ffe66d';
    ctx.beginPath(); ctx.arc(22, -7, 2.5, 0, Math.PI * 2); ctx.arc(22, 7, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  if (o.damaged) {
    ctx.fillStyle = 'rgba(40,40,40,0.5)';
    ctx.fillRect(-22, -10, 10, 20);
  }
  ctx.restore();
}

function drawPed(ctx, x, y, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.arc(1, 2, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(4, 0, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

export function render(s, ctx, W, H) {
  const cam = s.cam;
  const night = s.clock < 6 || s.clock >= 20;
  const dusk = (s.clock >= 17 && s.clock < 20) || (s.clock >= 6 && s.clock < 8);
  ctx.fillStyle = '#1a1d26';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  const ZOOM = 1.25;
  ctx.translate(W / 2, H / 2);
  ctx.scale(ZOOM, ZOOM);
  ctx.translate(-cam.x, -cam.y);

  // Ground: district blocks.
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x, d.y, d.w, d.h);
  }
  // Beach sand strip and the harbor water.
  ctx.fillStyle = '#cbb27f';
  ctx.fillRect(0, 2100, 1480, 150);
  ctx.fillStyle = '#1d4e6b';
  const wave = Math.sin(s.time * 0.8) * 6;
  ctx.fillRect(RIVER.x, RIVER.y0, RIVER.w, RIVER.y1 - RIVER.y0);
  ctx.fillRect(0, SEA.y + wave * 0.3, WORLD_W, WORLD_H - SEA.y);
  ctx.fillStyle = 'rgba(120,200,255,0.25)';
  for (let i = 0; i < 8; i += 1) {
    const wy = SEA.y + 20 + i * 18 + Math.sin(s.time * 1.3 + i) * 4;
    ctx.fillRect(0, wy, WORLD_W, 2);
  }
  // Parks and plaza.
  for (const pr of s.city.props) {
    ctx.fillStyle = pr.kind === 'park' ? '#2f6b3a' : '#8a7a5c';
    ctx.fillRect(pr.x, pr.y, pr.w, pr.h);
    if (pr.kind === 'park') {
      ctx.fillStyle = '#3f8a4a';
      for (let i = 0; i < 6; i += 1) { ctx.beginPath(); ctx.arc(pr.x + 20 + i * 40, pr.y + 40 + (i % 2) * 70, 16, 0, Math.PI * 2); ctx.fill(); }
    }
  }
  // Roads.
  ctx.fillStyle = '#23262e';
  for (const rx of ROAD_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD_H);
  for (const ry of ROAD_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  // Bridges over the river.
  for (const b of BRIDGES) {
    ctx.fillStyle = '#2e323c';
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#c8b06a';
    ctx.fillRect(b.x, b.y, 6, b.h); ctx.fillRect(b.x + b.w - 6, b.y, 6, b.h);
  }
  // Lane dashes.
  ctx.fillStyle = 'rgba(230,230,160,0.5)';
  for (const rx of ROAD_X) for (let y = 40; y < WORLD_H; y += 80) ctx.fillRect(rx - 2, y, 4, 34);
  for (const ry of ROAD_Y) for (let x = 40; x < WORLD_W; x += 80) ctx.fillRect(x, ry - 2, 34, 4);
  // Sidewalks.
  ctx.strokeStyle = 'rgba(200,200,200,0.25)';
  ctx.lineWidth = 6;
  for (const rx of ROAD_X) { ctx.beginPath(); ctx.moveTo(rx - ROAD_W / 2 - 4, 0); ctx.lineTo(rx - ROAD_W / 2 - 4, WORLD_H); ctx.stroke(); ctx.beginPath(); ctx.moveTo(rx + ROAD_W / 2 + 4, 0); ctx.lineTo(rx + ROAD_W / 2 + 4, WORLD_H); ctx.stroke(); }
  // Buildings with roof detail.
  for (const b of s.city.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
    const d = DISTRICTS.find((x) => x.id === b.d) || DISTRICTS[0];
    ctx.fillStyle = d.roof;
    ctx.globalAlpha = b.shade;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, 8);
    if (b.tall > 0.6) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.2, b.w * 0.6, b.h * 0.6);
    }
    if (b.lit && night) {
      ctx.fillStyle = 'rgba(255,214,120,0.85)';
      for (let i = 0; i < 3; i += 1) ctx.fillRect(b.x + 10 + i * ((b.w - 20) / 3), b.y + 10, 5, 7);
    }
  }
  // Containers, palms, lamps.
  for (const c of s.city.containers) { ctx.fillStyle = c.c; ctx.fillRect(c.x, c.y, c.w, c.h); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.strokeRect(c.x, c.y, c.w, c.h); }
  for (const pl of s.city.palms) {
    ctx.strokeStyle = '#5d4a2f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(pl.x, pl.y); ctx.lineTo(pl.x + 3, pl.y - 12); ctx.stroke();
    ctx.fillStyle = '#2f8a4a';
    ctx.beginPath(); ctx.arc(pl.x + 3, pl.y - 14, pl.r, 0, Math.PI * 2); ctx.fill();
  }
  if (night) for (const l of s.city.lamps) { ctx.fillStyle = 'rgba(255,220,130,0.25)'; ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill(); }
  // Shops.
  for (const sh of s.city.shops) {
    ctx.fillStyle = sh.kind === 'garage' ? '#4361ee' : sh.kind === 'weapons' ? '#e63946' : sh.kind === 'repair' ? '#2a9d8f' : '#f3722c';
    ctx.fillRect(sh.x - 26, sh.y - 18, 52, 36);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(sh.kind === 'garage' ? 'GARAGE' : sh.kind === 'weapons' ? 'AMMU' : sh.kind === 'repair' ? 'SPRAY' : 'BAR', sh.x, sh.y + 4);
  }
  // Skid marks.
  for (const sk of s.skids) {
    ctx.save(); ctx.translate(sk.x, sk.y); ctx.rotate(sk.a);
    ctx.fillStyle = 'rgba(0,0,0,' + (sk.t * 0.35) + ')';
    ctx.fillRect(-16, -12, 32, 4); ctx.fillRect(-16, 8, 32, 4);
    ctx.restore();
  }
  // Mission marker beacon.
  if (s.marker) {
    const pulse = 1 + Math.sin(s.time * 4) * 0.15;
    ctx.strokeStyle = '#ffd60a';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(s.marker.x, s.marker.y, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(255,214,10,0.18)';
    ctx.beginPath(); ctx.arc(s.marker.x, s.marker.y, 34 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(s.marker.x, s.marker.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,10,0.10)';
    ctx.fillRect(s.marker.x - 8, s.marker.y - 260, 16, 260);
  }
  // Race checkpoints.
  if (s.race) {
    const cp = s.race.cps[s.race.cp];
    ctx.strokeStyle = '#06d6a0'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(cp.x, cp.y, 46, 0, Math.PI * 2); ctx.stroke();
  }
  // Boats.
  for (const b of s.boats) {
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillStyle = b.kind === 'smuggler' ? '#111' : '#f8f9fa';
    roundRect(ctx, -30, -10, 60, 20, 8); ctx.fill();
    ctx.fillStyle = '#4361ee'; ctx.fillRect(-6, -6, 14, 12);
    ctx.restore();
  }
  if (s.boat) {
    const b = s.boat;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.angle);
    ctx.fillStyle = '#ff6b35'; roundRect(ctx, -30, -10, 60, 20, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillRect(-6, -6, 14, 12);
    ctx.restore();
  }
  // Cars.
  for (const c of s.cars) {
    if (c.hp <= 0 || c.dead) continue;
    const isPlayer = s.player.inCar && s.player.carId === c.id;
    const isCop = c.kind === 'cop' || c.kind === 'roadblock' || c.kind === 'swat';
    drawCar(ctx, c.x, c.y, c.angle, isCop ? '#222' : c.color, { cop: isCop, headlights: night, time: s.time, damaged: c.hp < 50 });
    if (isPlayer) {
      ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 34, 0, Math.PI * 2); ctx.stroke();
    }
    if (c.hp < 60) {
      ctx.fillStyle = 'rgba(120,120,120,0.6)';
      ctx.beginPath(); ctx.arc(c.x - 10, c.y - 8, 6 + Math.sin(s.time * 9) * 2, 0, Math.PI * 2); ctx.fill();
    }
  }
  // Police on the ground live in s.cops, not s.cars — draw them too.
  for (const c of s.cops) {
    if (c.kind === 'heli') continue;
    drawCar(ctx, c.x, c.y, c.angle, '#222', { cop: true, headlights: night, time: s.time, damaged: c.hp < 50 });
    if (c.roadblock) {
      ctx.fillStyle = 'rgba(255,45,85,0.9)';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('VCPD', c.x, c.y - 26);
    }
  }
  // Police helicopter: shadow + body + spotlight.
  for (const c of s.cops) {
    if (c.kind !== 'heli') continue;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(c.x + 30, c.y + 40, 34, 16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,240,170,0.13)';
    ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(s.player.x - 40, s.player.y - 40); ctx.lineTo(s.player.x + 40, s.player.y + 40); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(c.angle);
    ctx.fillStyle = '#e8ecf4'; roundRect(ctx, -26, -10, 52, 20, 9); ctx.fill();
    ctx.fillStyle = '#e63946'; ctx.fillRect(-26, -3, 52, 6);
    ctx.strokeStyle = '#555'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(30, 0); ctx.stroke();
    ctx.restore();
  }
  // Cops on the ground are cars; draw their light glow.
  // Pedestrians, enemies, allies.
  for (const ped of s.peds) drawPed(ctx, ped.x, ped.y, ped.angle, ped.color);
  for (const e of s.enemies) {
    drawPed(ctx, e.x, e.y, e.angle, e.boss ? '#7b2cbf' : '#e63946');
    ctx.fillStyle = '#222'; ctx.fillRect(e.x - 14, e.y - 20, 28, 4);
    ctx.fillStyle = e.boss ? '#c77dff' : '#ff5a5a';
    ctx.fillRect(e.x - 14, e.y - 20, 28 * clamp(e.hp / (e.boss ? 220 : 60), 0, 1), 4);
  }
  for (const al of s.allies) drawPed(ctx, al.x, al.y, al.angle, '#06d6a0');
  // Bullets and particles.
  for (const b of s.bullets) {
    ctx.strokeStyle = b.from === 'player' ? '#ffe66d' : '#ff8a7a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  for (const pt of s.parts) {
    ctx.globalAlpha = clamp(pt.t / pt.max, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  // Player on foot.
  const p = s.player;
  if (!p.inCar && !s.boat) {
    drawPed(ctx, p.x, p.y, p.angle, '#ffd60a');
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI * 2); ctx.stroke();
  }
  // Stealth patrol cones (mission 3).
  if (s.mission && s.mission.stages[s.mission.stage].kind === 'stealth') {
    const st = s.mission.stages[s.mission.stage];
    if (st.guards) for (const g of st.guards) {
      ctx.fillStyle = 'rgba(255,80,80,0.16)';
      ctx.beginPath(); ctx.moveTo(g.x, g.y);
      ctx.arc(g.x, g.y, 260, g.a - 0.5, g.a + 0.5); ctx.closePath(); ctx.fill();
      drawPed(ctx, g.x, g.y, g.a, '#e63946');
    }
  }
  ctx.restore();

  // Day / dusk / night tint + rain, screen space.
  if (night) { ctx.fillStyle = 'rgba(10,14,40,0.30)'; ctx.fillRect(0, 0, W, H); }
  else if (dusk) { ctx.fillStyle = 'rgba(255,110,40,0.10)'; ctx.fillRect(0, 0, W, H); }
  if (s.rain > 0.05) {
    ctx.strokeStyle = 'rgba(180,210,255,' + (0.35 * s.rain) + ')';
    ctx.lineWidth = 1;
    for (let i = 0; i < 60; i += 1) {
      const rx = ((i * 173 + s.time * 700) % (W + 40)) - 20;
      const ry = (i * 97 + s.time * 900) % H;
      ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx - 6, ry + 14); ctx.stroke();
    }
  }
  if (s.screen !== 'title') drawHUD(s, ctx, W, H);
  if (s.screen === 'title') drawTitle(s, ctx, W, H);
  if (s.paused) drawPause(s, ctx, W, H);
  if (s.over) drawOver(s, ctx, W, H);
  if (s.shopOpen) drawShop(s, ctx, W, H);
  if (s.heistChoice) drawHeist(s, ctx, W, H);
  if (s.wheelOpen) drawWheel(s, ctx, W, H);
}

// ---- HUD, minimap and overlays ----
function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,12,20,0.72)';
  roundRect(ctx, x, y, w, h, 8); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.stroke();
}

function drawHUD(s, ctx, W, H) {
  const p = s.player;
  const tod = timeOfDay(s);
  // Top-left: health, armor, money, respect, district.
  panel(ctx, 14, 14, 250, 108);
  ctx.textAlign = 'left';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.fillText('♥ ' + Math.ceil(p.hp), 26, 36);
  ctx.fillStyle = '#222'; ctx.fillRect(90, 26, 150, 10);
  ctx.fillStyle = p.hp > 40 ? '#06d6a0' : '#ff5a5a';
  ctx.fillRect(90, 26, 150 * clamp(p.hp / 100, 0, 1), 10);
  ctx.fillStyle = '#2ec4ff'; ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('ARMOR ' + Math.ceil(p.armor), 26, 58);
  ctx.fillStyle = '#222'; ctx.fillRect(90, 50, 150, 8);
  ctx.fillStyle = '#2ec4ff'; ctx.fillRect(90, 50, 150 * clamp(p.armor / 100, 0, 1), 8);
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 17px system-ui, sans-serif';
  ctx.fillText(fmtMoney(p.money), 26, 84);
  ctx.fillStyle = '#c77dff'; ctx.font = 'bold 13px system-ui, sans-serif';
  ctx.fillText(rankName(p.respect) + '  •  ' + districtNameAt(s), 26, 106);

  // Wanted stars, top-centre.
  const starW = 34;
  const sx = W / 2 - (starW * 5) / 2;
  for (let i = 0; i < 5; i += 1) {
    const on = i < s.wanted;
    const pulse = on && s.wanted >= 3 ? 1 + Math.sin(s.time * 6) * 0.18 : 1;
    ctx.save();
    ctx.translate(sx + i * starW + 14, 34);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = on ? '#ffd60a' : 'rgba(255,255,255,0.22)';
    ctx.font = '26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★', 0, 9);
    ctx.restore();
  }
  if (s.wanted > 0) {
    ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(s.wanted >= 4 ? 'AIR ONE IS UP' : s.wanted >= 3 ? 'ROADBLOCKS AHEAD' : 'WANTED', W / 2, 62);
  }

  // Top-right: clock, weather, radio.
  panel(ctx, W - 214, 14, 200, 66);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 16px system-ui, sans-serif'; ctx.textAlign = 'right';
  ctx.fillText(tod.text + '  ' + tod.label, W - 28, 38);
  ctx.fillStyle = '#9db4d8'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText((s.weather === 'rain' ? '☂ Rain' : '☀ Clear') + '  •  ' + RADIO_STATIONS[s.audio ? s.audio.station : 0].name, W - 28, 60);

  // Objective banner, under the stars.
  if (s.objective) {
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(10,12,20,0.66)';
    const ow = Math.min(640, ctx.measureText(s.objective).width + 36);
    roundRect(ctx, W / 2 - ow / 2, 76, ow, 30, 8); ctx.fill();
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('▸ ' + s.objective, W / 2, 96);
  }
  // Mission banner.
  if (s.banner) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(s.banner.t, 0, 1);
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 34px system-ui, sans-serif';
    ctx.fillText(s.banner.text, W / 2, H * 0.32);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(s.banner.sub, W / 2, H * 0.32 + 26);
    ctx.globalAlpha = 1;
  }
  if (s.toast) {
    ctx.textAlign = 'center';
    ctx.globalAlpha = clamp(s.toast.t, 0, 1);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText(s.toast.text, W / 2, H - 210);
    ctx.globalAlpha = 1;
  }
  if (s.saveMsg) {
    ctx.textAlign = 'center'; ctx.fillStyle = '#06d6a0'; ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(s.saveMsg, W / 2, H - 180);
  }
  // Bottom-left: weapon + crew.
  panel(ctx, 14, H - 92, 300, 78);
  const w = WEAPONS[p.weapon];
  ctx.textAlign = 'left';
  ctx.fillStyle = w.color; ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.fillText(w.name + (w.ammo > 0 ? '  [' + (p.ammo[w.id] || 0) + ']' : ''), 26, H - 62);
  ctx.fillStyle = '#9db4d8'; ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('Q wheel  •  1-6 weapons  •  E enter car  •  F steal', 26, H - 40);
  ctx.fillStyle = '#fff'; ctx.font = 'bold 12px system-ui, sans-serif';
  ctx.fillText('CREW  7 Mara ' + (p.crewCd.mara > 0 ? Math.ceil(p.crewCd.mara) + 's' : 'READY') +
    '   8 Dex ' + (p.crewCd.dex > 0 ? Math.ceil(p.crewCd.dex) + 's' : 'READY') +
    '   9 Brick ' + (p.crewCd.brick > 0 ? Math.ceil(p.crewCd.brick) + 's' : 'READY'), 26, H - 22);
  // Speed + car state, bottom-centre.
  const pc = s.player.inCar ? s.cars.find((c) => c.id === s.player.carId) : null;
  if (pc) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff'; ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillText(Math.round(Math.abs(pc.speed) * 0.36) + ' km/h', W / 2, H - 34);
    ctx.fillStyle = '#ff5a5a'; ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('CAR ' + Math.ceil(pc.hp) + ' HP', W / 2, H - 16);
  }
  if (s.nearShop) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('Press E — ' + s.nearShop.name, W / 2, H - 130);
  }
  if (s.mission && s.mission.stages[s.mission.stage].kind === 'boat' && !s.boat) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#2ec4ff'; ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.fillText('Press E at the pier to board the speedboat', W / 2, H - 130);
  }
  drawMinimap(s, ctx, W, H);
}

function drawMinimap(s, ctx, W, H) {
  const mw = 210; const mh = 158;
  const mx = W - mw - 14; const my = H - mh - 14;
  const kx = mw / WORLD_W; const ky = mh / WORLD_H;
  panel(ctx, mx, my, mw, mh);
  ctx.save();
  ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
  // Districts + water.
  for (const d of DISTRICTS) { ctx.fillStyle = d.ground; ctx.fillRect(mx + d.x * kx, my + d.y * ky, d.w * kx, d.h * ky); }
  ctx.fillStyle = '#1d4e6b';
  ctx.fillRect(mx + RIVER.x * kx, my + RIVER.y0 * ky, RIVER.w * kx, (RIVER.y1 - RIVER.y0) * ky);
  ctx.fillRect(mx, my + SEA.y * ky, mw, (WORLD_H - SEA.y) * ky);
  // Roads.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 1;
  for (const rx of ROAD_X) { ctx.beginPath(); ctx.moveTo(mx + rx * kx, my); ctx.lineTo(mx + rx * kx, my + mh); ctx.stroke(); }
  for (const ry of ROAD_Y) { ctx.beginPath(); ctx.moveTo(mx, my + ry * ky); ctx.lineTo(mx + mw, my + ry * ky); ctx.stroke(); }
  // GPS route line to the marker.
  if (s.marker) {
    ctx.strokeStyle = '#ffd60a'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(mx + s.player.x * kx, my + s.player.y * ky);
    ctx.lineTo(mx + s.marker.x * kx, my + s.marker.y * ky);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath(); ctx.arc(mx + s.marker.x * kx, my + s.marker.y * ky, 4, 0, Math.PI * 2); ctx.fill();
  }
  // Cops, enemies, player.
  ctx.fillStyle = '#ff2d55';
  for (const c of s.cops) { ctx.beginPath(); ctx.arc(mx + c.x * kx, my + c.y * ky, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#ff5a5a';
  for (const e of s.enemies) { ctx.beginPath(); ctx.arc(mx + e.x * kx, my + e.y * ky, 2.5, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(mx + s.player.x * kx, my + s.player.y * ky, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#9db4d8'; ctx.font = 'bold 10px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('VERMILION HARBOR', mx + 6, my + 12);
}

function drawTitle(s, ctx, W, H) {
  ctx.fillStyle = 'rgba(8,8,16,0.62)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a7a';
  ctx.font = 'bold 64px system-ui, sans-serif';
  ctx.fillText('VERMILION', W / 2, H * 0.30);
  ctx.fillStyle = '#ffd60a';
  ctx.fillText('HARBOR', W / 2, H * 0.30 + 66);
  ctx.fillStyle = '#fff';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText('An open-world crime story in a neon port city — five districts, ten story jobs,', W / 2, H * 0.30 + 108);
  ctx.fillText('a five-star police force, a crew that has your back, and a harbor to take.', W / 2, H * 0.30 + 132);
  ctx.fillStyle = '#2ec4ff';
  ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('ENTER — New game' + (s.hasSave ? '      C — Continue saved game' : ''), W / 2, H * 0.52);
  ctx.fillStyle = '#c9d4e6';
  ctx.font = '14px system-ui, sans-serif';
  ctx.fillText('WASD move / drive   •   E enter car   •   F steal   •   Mouse aim, click shoot   •   Q weapon wheel', W / 2, H * 0.62);
  ctx.fillText('7/8/9 call crew   •   R radio   •   S save   •   P pause   •   Space handbrake', W / 2, H * 0.62 + 24);
  ctx.fillStyle = '#8a97ad';
  ctx.font = '12px system-ui, sans-serif';
  ctx.fillText('A game built for make.fun — “Make GTA 6”. No network requests. Saves live in your browser.', W / 2, H - 30);
}

function drawPause(s, ctx, W, H) {
  ctx.fillStyle = 'rgba(8,8,16,0.66)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff'; ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('PAUSED', W / 2, H * 0.4);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillStyle = '#c9d4e6';
  ctx.fillText('P resume   •   S save game   •   R restart the story', W / 2, H * 0.4 + 36);
  ctx.fillText('Missions done: ' + s.missionDone.length + ' / 10   •   Respect: ' + s.player.respect + ' (' + rankName(s.player.respect) + ')', W / 2, H * 0.4 + 64);
}

function drawOver(s, ctx, W, H) {
  ctx.fillStyle = 'rgba(8,8,16,0.7)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 52px system-ui, sans-serif';
  ctx.fillText(s.overReason.startsWith('WASTED') ? 'WASTED' : 'BUSTED', W / 2, H * 0.42);
  ctx.fillStyle = '#fff'; ctx.font = '16px system-ui, sans-serif';
  ctx.fillText(s.overReason, W / 2, H * 0.42 + 34);
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 18px system-ui, sans-serif';
  ctx.fillText('Press R to get back on the streets', W / 2, H * 0.42 + 72);
}

function drawShop(s, ctx, W, H) {
  const p = s.player;
  ctx.fillStyle = 'rgba(8,8,16,0.7)';
  ctx.fillRect(0, 0, W, H);
  panel(ctx, W / 2 - 260, H / 2 - 210, 520, 420);
  ctx.textAlign = 'left';
  if (s.shopOpen === 'weapons') {
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('AMMU-NATION', W / 2 - 230, H / 2 - 172);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui, sans-serif';
    WEAPONS.forEach((w, i) => {
      if (w.id === 'fists') return;
      const owned = p.ownedWeapons.includes(w.id);
      ctx.fillStyle = owned ? '#06d6a0' : '#fff';
      ctx.fillText((i + 1) + '. ' + w.name + ' — ' + (owned ? 'OWNED, ammo ' + (p.ammo[w.id] || 0) + ' (restock ' + fmtMoney(w.price / 3) + ')' : fmtMoney(w.price)), W / 2 - 230, H / 2 - 134 + i * 30);
    });
    ctx.fillStyle = '#9db4d8'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Press 1-6 to buy • Esc to leave • Your cash: ' + fmtMoney(p.money), W / 2 - 230, H / 2 + 150);
  } else if (s.shopOpen === 'garage') {
    ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('VERMILION GARAGE', W / 2 - 230, H / 2 - 172);
    ctx.fillStyle = '#fff'; ctx.font = '15px system-ui, sans-serif';
    CAR_TIERS.forEach((t, i) => {
      const owned = p.garageCars.includes(i);
      ctx.fillStyle = owned ? (p.currentTier === i ? '#ffd60a' : '#06d6a0') : '#fff';
      ctx.fillText((i + 1) + '. ' + t.name + ' — top ' + Math.round(t.topSpeed * 0.36) + ' km/h — ' + (owned ? (p.currentTier === i ? 'YOUR RIDE' : 'OWNED') : fmtMoney(t.price)), W / 2 - 230, H / 2 - 134 + i * 30);
    });
    ctx.fillStyle = '#fff';
    ctx.fillText('7. Engine Lv' + p.garageUpgrades.engine + '/3 — ' + fmtMoney([800, 1600, 3200][p.garageUpgrades.engine] || 0), W / 2 - 230, H / 2 + 6);
    ctx.fillText('8. Armor Lv' + p.garageUpgrades.armor + '/3 — ' + fmtMoney([600, 1200, 2400][p.garageUpgrades.armor] || 0), W / 2 - 230, H / 2 + 36);
    ctx.fillStyle = '#9db4d8'; ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('Press 1-4 buy car • 7 engine • 8 armor • Esc to leave • Cash: ' + fmtMoney(p.money), W / 2 - 230, H / 2 + 150);
    ctx.fillText('Respect: ' + p.respect + ' (' + rankName(p.respect) + ')  •  Missions: ' + s.missionDone.length + '/10', W / 2 - 230, H / 2 + 174);
  }
}

function drawHeist(s, ctx, W, H) {
  ctx.fillStyle = 'rgba(8,8,16,0.72)';
  ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd60a'; ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.fillText('THE VERMILION JOB', W / 2, H * 0.38);
  ctx.fillStyle = '#fff'; ctx.font = '18px system-ui, sans-serif';
  ctx.fillText('The vault is behind that door. How do you go in?', W / 2, H * 0.38 + 34);
  ctx.fillStyle = '#ff5a5a'; ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillText('1 — LOUD: guns out, 4 stars, maximum chaos', W / 2, H * 0.5);
  ctx.fillStyle = '#2ec4ff';
  ctx.fillText('2 — QUIET: roof entry, 2 stars, walk away clean', W / 2, H * 0.5 + 40);
}

function drawWheel(s, ctx, W, H) {
  const cx = W / 2; const cy = H / 2;
  ctx.fillStyle = 'rgba(8,8,16,0.55)';
  ctx.fillRect(0, 0, W, H);
  const R = 150;
  WEAPONS.forEach((w, i) => {
    const a = (i / WEAPONS.length) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * R;
    const y = cy + Math.sin(a) * R;
    const owned = s.player.ownedWeapons.includes(w.id);
    const sel = s.player.weapon === i;
    ctx.fillStyle = sel ? 'rgba(255,214,10,0.85)' : owned ? 'rgba(20,24,36,0.9)' : 'rgba(20,24,36,0.45)';
    ctx.beginPath(); ctx.arc(x, y, 44, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = sel ? '#ffd60a' : 'rgba(255,255,255,0.25)';
    ctx.stroke();
    ctx.fillStyle = sel ? '#111' : owned ? w.color : '#666';
    ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(w.name, x, y - 2);
    ctx.font = '11px system-ui, sans-serif';
    ctx.fillText(w.key + (w.ammo > 0 ? ' • ' + (s.player.ammo[w.id] || 0) : ''), x, y + 14);
  });
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('WEAPON WHEEL — press 1-6', cx, cy + R + 70);
}
