// Vermilion Harbor — game configuration: districts, weapons, vehicles, crew, missions.
// A neon port city at dusk. Everything the simulation and the renderer share lives here.
export const WORLD_W = 3200;
export const WORLD_H = 2400;
export const ROAD_W = 96;
export const STEP = 1 / 60;

export const DISTRICTS = [
  { id: 'downtown', name: 'Downtown', x: 0, y: 0, w: 1480, h: 880, ground: '#3a3f4d', roof: '#565d70', accent: '#ff5a7a', label: 'DOWNTOWN' },
  { id: 'oldtown', name: 'Old Town', x: 1660, y: 0, w: 1540, h: 880, ground: '#4a3f33', roof: '#6e5641', accent: '#ffb347', label: 'OLD TOWN' },
  { id: 'hillside', name: 'Hillside', x: 1660, y: 900, w: 1540, h: 560, ground: '#2e4034', roof: '#4a6b52', accent: '#7dff9e', label: 'HILLSIDE' },
  { id: 'beachfront', name: 'Beachfront', x: 0, y: 900, w: 1480, h: 1500, ground: '#c2a878', roof: '#e8d9b0', accent: '#2ec4ff', label: 'BEACHFRONT' },
  { id: 'docks', name: 'The Docks', x: 1660, y: 1460, w: 1540, h: 940, ground: '#3d3a44', roof: '#5c5568', accent: '#ffcf3f', label: 'THE DOCKS' },
];

export const RIVER = { x: 1480, w: 180, y0: 880, y1: 2400 }; // water channel, crossed by two bridges
export const SEA = { y: 2260 }; // harbor water along the south edge
export const BRIDGES = [
  { x: 1480, y: 980, w: 180, h: 130 },
  { x: 1480, y: 1760, w: 180, h: 130 },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', key: '1', damage: 12, rate: 3.2, range: 46, spread: 0, ammo: -1, price: 0, color: '#e8e8e8' },
  { id: 'pistol', name: 'V9 Pistol', key: '2', damage: 22, rate: 4.5, range: 420, spread: 0.03, ammo: 120, price: 300, color: '#ffd23f' },
  { id: 'smg', name: 'VK-9 SMG', key: '3', damage: 14, rate: 11, range: 380, spread: 0.07, ammo: 240, price: 900, color: '#ff9f1c' },
  { id: 'shotgun', name: 'Harbor 12G', key: '4', damage: 16, rate: 1.6, range: 260, spread: 0.16, ammo: 48, price: 1400, color: '#ff5a7a', pellets: 6 },
  { id: 'rifle', name: 'AR-77 Rifle', key: '5', damage: 34, rate: 7, range: 560, spread: 0.02, ammo: 180, price: 2200, color: '#2ec4ff' },
  { id: 'rpg', name: 'Mako RPG', key: '6', damage: 160, rate: 0.8, range: 520, spread: 0, ammo: 12, price: 3200, color: '#c77dff', explosive: true },
];

export const CAR_TIERS = [
  { id: 'rust', name: 'Rustbucket', tier: 0, topSpeed: 320, accel: 150, grip: 0.9, hp: 100, price: 0, colors: ['#7a6a55', '#5d6b7a', '#6b5d4f'] },
  { id: 'street', name: 'Street Runner', tier: 1, topSpeed: 430, accel: 210, grip: 1.0, hp: 130, price: 1200, colors: ['#e63946', '#2a9d8f', '#e9c46a'] },
  { id: 'sport', name: 'Comet S', tier: 2, topSpeed: 560, accel: 280, grip: 1.12, hp: 160, price: 4500, colors: ['#ff6b35', '#4361ee', '#f72585'] },
  { id: 'super', name: 'Vermilion GT', tier: 3, topSpeed: 700, accel: 360, grip: 1.25, hp: 200, price: 12000, colors: ['#ffd60a', '#7209b7', '#06d6a0'] },
];

export const TRAFFIC_COLORS = ['#8d99ae', '#ef8354', '#4cc9f0', '#b5838d', '#90be6d', '#f9c74f', '#577590', '#e07a5f'];

export const CREW = [
  { id: 'mara', name: 'Mara', role: 'Getaway Driver', key: '7', cooldown: 45, desc: 'Delivers a fast car + 10s speed boost' },
  { id: 'dex', name: 'Dex', role: 'Hacker', key: '8', cooldown: 60, desc: 'Drops your wanted level by 1 star' },
  { id: 'brick', name: 'Brick', role: 'Muscle', key: '9', cooldown: 75, desc: 'Sends an armed ally for 45s' },
];

export const RESPECT_RANKS = [
  { at: 0, name: 'Street Punk' },
  { at: 200, name: 'Hustler' },
  { at: 500, name: 'Wheelman' },
  { at: 900, name: 'Shot Caller' },
  { at: 1500, name: 'Harbor King' },
];

export const MISSIONS = [
  { id: 'm1', title: 'First Wheels', district: 'downtown', type: 'drive', brief: 'Mara needs wheels. Steal any car and bring it to the garage on Vesper Row.', reward: 400, respect: 60 },
  { id: 'm2', title: 'Dockside Drop', district: 'docks', type: 'deliver', brief: 'Pick up the package at Pier 9 and deliver it to the Sandbar on Beachfront. Cops are watching the docks.', reward: 650, respect: 90 },
  { id: 'm3', title: 'Quiet Entry', district: 'oldtown', type: 'stealth', brief: 'Slip into the Old Town warehouse without raising heat. Stay out of the patrol cones. No guns.', reward: 800, respect: 120 },
  { id: 'm4', title: 'Hot Pursuit', district: 'hillside', type: 'chase', brief: 'A courier is running the Hillside road with our ledger. Ram his car until it stops, then grab the case.', reward: 900, respect: 130 },
  { id: 'm5', title: 'Beachfront Brawl', district: 'beachfront', type: 'shootout', brief: 'The Salt Dogs took the boardwalk. Clear all five of them off the sand.', reward: 1100, respect: 160 },
  { id: 'm6', title: 'The Vermilion Job', district: 'downtown', type: 'heist', brief: 'The Vermilion Bank vault. LOUD: shoot your way in and out (4 stars). QUIET: slip in through the roof (2 stars). Choose at the door.', reward: 2500, respect: 300 },
  { id: 'm7', title: 'Midnight Grand Prix', district: 'beachfront', type: 'race', brief: 'Three laps of the Harbor Circuit at midnight. Bet $500 if you trust your driving.', reward: 1800, respect: 220 },
  { id: 'm8', title: 'Harbor Run', district: 'docks', type: 'boat', brief: 'Take the speedboat at Pier 9. Chase the smuggler boat down the channel and sink it.', reward: 1600, respect: 200 },
  { id: 'm9', title: 'Turf War', district: 'oldtown', type: 'territory', brief: 'Old Town belongs to the Salt Dogs. Survive three waves at the plaza and plant our flag.', reward: 2000, respect: 280 },
  { id: 'm10', title: 'King of the Harbor', district: 'docks', type: 'finale', brief: 'Rook, the Salt Dogs boss, is leaving on a convoy. Stop the convoy, take him down, and lose the 5-star heat. The harbor is yours.', reward: 5000, respect: 600 },
];

export const SHOPS = [
  { id: 'ammu', name: 'Ammu-Nation', x: 700, y: 300, kind: 'weapons' },
  { id: 'spray', name: "Pay 'n Spray", x: 2100, y: 1200, kind: 'repair' },
  { id: 'garage', name: 'Vermilion Garage', x: 500, y: 500, kind: 'garage' },
  { id: 'bar', name: 'The Sandbar', x: 400, y: 2000, kind: 'bar' },
];

export const GARAGE_UPGRADES = [
  { id: 'engine', name: 'Engine', max: 3, prices: [800, 1600, 3200] },
  { id: 'armor', name: 'Armor', max: 3, prices: [600, 1200, 2400] },
];

export const RADIO_STATIONS = [
  { id: 'vermilion', name: 'VERMILION FM', desc: 'synthwave', bpm: 112 },
  { id: 'harbor98', name: 'HARBOR 98', desc: 'late-night lo-fi', bpm: 76 },
  { id: 'dockrock', name: 'DOCKSIDE ROCK', desc: 'driving rock', bpm: 138 },
];

export const KEYS = {
  up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
};
