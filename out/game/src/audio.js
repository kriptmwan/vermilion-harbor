// Vermilion Harbor — procedural audio. No audio files: engine hum, sirens, gunfire and
// three radio stations are all synthesized with WebAudio. Silent until the player
// interacts (browser autoplay rules); every call is safe before the context exists.
import { RADIO_STATIONS } from './config.js';

export function createAudio() {
  const a = {
    ctx: null, master: null, musicGain: null, muted: false, station: 0,
    engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null,
    musicTimer: null, step: 0,
    ensure() {
      if (this.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain(); this.master.gain.value = 0.5; this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = 0.16; this.musicGain.connect(this.master);
        this.engineGain = this.ctx.createGain(); this.engineGain.gain.value = 0; this.engineGain.connect(this.master);
        this.engineOsc = this.ctx.createOscillator(); this.engineOsc.type = 'sawtooth'; this.engineOsc.frequency.value = 55;
        this.engineOsc.connect(this.engineGain); this.engineOsc.start();
        this.sirenGain = this.ctx.createGain(); this.sirenGain.gain.value = 0; this.sirenGain.connect(this.master);
        this.sirenOsc = this.ctx.createOscillator(); this.sirenOsc.type = 'sine'; this.sirenOsc.frequency.value = 700;
        this.sirenOsc.connect(this.sirenGain); this.sirenOsc.start();
      } catch (e) { return false; }
      return true;
    },
    setEngine(speed01, on) {
      if (!this.ctx) return;
      this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, this.ctx.currentTime, 0.1);
      this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, this.ctx.currentTime, 0.08);
    },
    setSiren(on, wanted) {
      if (!this.ctx) return;
      this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.2);
      if (on) this.sirenOsc.frequency.setTargetAtTime(wanted >= 4 ? 950 : 720, this.ctx.currentTime, 0.3);
    },
    blip(freq, dur, type, vol) {
      if (!this.ensure()) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type || 'square'; o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
    },
    shot() { this.blip(180, 0.09, 'sawtooth', 0.2); this.blip(90, 0.12, 'square', 0.14); },
    explosion() { this.blip(60, 0.5, 'sawtooth', 0.3); this.blip(40, 0.7, 'sine', 0.3); },
    pickup() { this.blip(660, 0.08, 'sine', 0.14); this.blip(990, 0.12, 'sine', 0.12); },
    missionOk() { [523, 659, 784].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'sine', 0.16), i * 110)); },
    cycleStation() {
      this.station = (this.station + 1) % RADIO_STATIONS.length;
      this.step = 0;
      return RADIO_STATIONS[this.station];
    },
    toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; },
    // Tiny sequencer: one bass note + one arp note per step, station-flavoured.
    musicTick() {
      if (!this.ctx || this.muted) return;
      const st = RADIO_STATIONS[this.station];
      const bassRoots = [55, 55, 65.4, 49];
      const arpSets = [[220, 261.6, 329.6, 392], [174.6, 220, 261.6, 349.2], [110, 130.8, 164.8, 196]];
      const bar = Math.floor(this.step / 8) % 4;
      const root = bassRoots[bar];
      const arp = arpSets[this.station][this.step % 4];
      const t = this.ctx.currentTime;
      const play = (freq, dur, type, vol) => {
        const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
        o.type = type; o.frequency.value = freq;
        g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.musicGain); o.start(t); o.stop(t + dur);
      };
      if (this.step % 2 === 0) play(root, 0.42, 'triangle', 0.5);
      if (this.station !== 1 || this.step % 4 === 0) play(arp * 2, 0.18, 'square', 0.10);
      this.step += 1;
    },
    startMusic() {
      if (this.musicTimer || !this.ensure()) return;
      const st = RADIO_STATIONS[this.station];
      const ms = Math.round(60000 / st.bpm / 2);
      this.musicTimer = setInterval(() => this.musicTick(), ms);
    },
  };
  return a;
}
