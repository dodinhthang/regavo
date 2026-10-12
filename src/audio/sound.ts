import type { Snapshot } from '../game/types.ts';
import { readProjectStorage, STORAGE_KEYS } from '../storage.ts';
const iso = (p: { x: number; y: number }) => ({ x: (p.x - p.y) * 32, y: (p.x + p.y) * 16 });

export type Cue =
  | 'select'
  | 'order'
  | 'build'
  | 'complete'
  | 'age'
  | 'victory'
  | 'axe'
  | 'pick'
  | 'harvest'
  | 'step'
  | 'arrow'
  | 'hit'
  | 'gun'
  | 'cannon';
/** Original synthesised score and effects. No recordings or external sound assets. */
class Soundscape {
  context?: AudioContext;
  master?: GainNode;
  timer?: ReturnType<typeof setInterval>;
  muted = false;
  volume = 0.35;
  active = false;
  beat = 0;
  lastTick = -1;
  age = 1;
  winner: Snapshot['winner'] = null;
  seen = new Map<number, { progress: number; cooldown: number; fired: boolean }>();
  listeners = new Set<() => void>();
  lastCue = new Map<string, number>();
  constructor() {
    try {
      const p = JSON.parse(readProjectStorage(localStorage, STORAGE_KEYS.audio) ?? '{}');
      this.muted = !!p.muted;
      this.volume = Number.isFinite(p.volume) ? Math.max(0, Math.min(1, p.volume)) : 0.35;
    } catch {
      /* Default settings. */
    }
  }
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }
  settings() {
    try {
      localStorage.setItem(
        STORAGE_KEYS.audio,
        JSON.stringify({ muted: this.muted, volume: this.volume }),
      );
    } catch {
      /* Audio still works without storage. */
    }
    this.apply();
    this.listeners.forEach((fn) => fn());
  }
  toggle() {
    this.muted = !this.muted;
    void this.unlock();
    this.settings();
  }
  setVolume(value: number) {
    this.volume = value;
    this.settings();
  }
  apply() {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(
        this.muted || !this.active || document.hidden ? 0 : this.volume,
        this.context.currentTime,
        0.12,
      );
  }
  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0;
      this.master.connect(this.context.destination);
      this.timer = setInterval(() => this.ambience(), 1800);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    this.apply();
  }
  setActive(value: boolean) {
    this.active = value;
    this.apply();
  }
  reset() {
    this.lastTick = -1;
    this.seen.clear();
    this.winner = null;
    this.age = 1;
  }
  tone(
    freq: number,
    duration: number,
    gain = 0.1,
    type: OscillatorType = 'sine',
    end = freq,
    delay = 0,
    pan = 0,
  ) {
    const ctx = this.context;
    if (!ctx || !this.master || ctx.state !== 'running' || this.muted || document.hidden) return;
    const at = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain(),
      p = ctx.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), at + duration);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    p.pan.value = pan;
    o.connect(g);
    g.connect(p);
    p.connect(this.master);
    o.start(at);
    o.stop(at + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
      p.disconnect();
    };
  }
  noise(duration: number, gain: number, cutoff: number, pan = 0) {
    const ctx = this.context;
    if (!ctx || !this.master || this.muted || document.hidden) return;
    const b = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate),
      v = b.getChannelData(0);
    for (let i = 0; i < v.length; i++)
      v[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / v.length, 2);
    const source = ctx.createBufferSource(),
      f = ctx.createBiquadFilter(),
      g = ctx.createGain(),
      p = ctx.createStereoPanner();
    source.buffer = b;
    f.type = 'lowpass';
    f.frequency.value = cutoff;
    g.gain.value = gain;
    p.pan.value = pan;
    source.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(this.master);
    source.start();
    source.onended = () => {
      source.disconnect();
      f.disconnect();
      g.disconnect();
      p.disconnect();
    };
  }
  play(cue: Cue, pan = 0) {
    if (!this.active || this.muted) return;
    const now = performance.now(),
      minimum = ['select', 'order'].includes(cue) ? 90 : cue === 'cannon' ? 350 : 250;
    if (now - (this.lastCue.get(cue) ?? -10000) < minimum) return;
    this.lastCue.set(cue, now);
    if (cue === 'select') this.tone(560, 0.12, 0.055, 'triangle', 420, 0, pan);
    if (cue === 'order') {
      this.tone(330, 0.14, 0.055, 'triangle', 270, 0, pan);
      this.tone(440, 0.18, 0.035, 'sine', 440, 0.06, pan);
    }
    if (cue === 'build' || cue === 'axe' || cue === 'hit') {
      this.noise(0.14, 0.1, 700, pan);
      this.tone(cue === 'axe' ? 150 : 105, 0.16, 0.075, 'triangle', 65, 0, pan);
    }
    if (cue === 'pick') {
      this.tone(1600, 0.13, 0.035, 'sine', 1100, 0, pan);
      this.noise(0.08, 0.04, 2500, pan);
    }
    if (cue === 'harvest') this.noise(0.17, 0.035, 1700, pan);
    if (cue === 'step') this.noise(0.08, 0.025, 450, pan);
    if (cue === 'arrow') {
      this.noise(0.18, 0.045, 4500, pan);
      this.tone(900, 0.15, 0.025, 'sine', 170, 0, pan);
    }
    if (cue === 'gun') {
      this.noise(0.28, 0.13, 1400, pan);
      this.tone(145, 0.22, 0.08, 'triangle', 45, 0, pan);
    }
    if (cue === 'cannon') {
      this.noise(0.8, 0.24, 400, pan);
      this.tone(75, 0.65, 0.18, 'sine', 25, 0, pan);
    }
    if (['complete', 'age', 'victory'].includes(cue)) {
      const notes =
        cue === 'complete'
          ? [392, 523]
          : cue === 'age'
            ? [262, 330, 392, 523]
            : [262, 392, 440, 523, 659];
      notes.forEach((f, i) => this.tone(f, 0.65, 0.08, 'triangle', f, i * 0.16, pan));
    }
  }
  ambience() {
    if (!this.active || this.muted || document.hidden) return;
    this.noise(1.5, 0.025, 350);
    const melody = [196, 0, 294, 247, 0, 262, 220, 0, 294, 330, 0, 247, 220, 0, 196, 0];
    const f = melody[this.beat++ % melody.length];
    if (f) {
      this.tone(f, 1.4, 0.024, 'sine');
      this.tone(f * 2, 0.75, 0.008, 'triangle', f * 2, 0.1);
    }
    if (this.beat % 5 === 0) {
      this.tone(2100, 0.17, 0.016, 'sine', 2900, 0, -0.5);
      this.tone(2400, 0.12, 0.012, 'sine', 3000, 0.2, -0.4);
    }
  }
  observe(s: Snapshot, center: { x: number; y: number }) {
    this.setActive(!s.paused && s.winner === null);
    if (s.tick === this.lastTick) return;
    const first = this.lastTick < 0;
    this.lastTick = s.tick;
    if (!first && s.player.age > this.age) this.play('age');
    this.age = s.player.age;
    if (s.winner !== null && this.winner === null && !first) {
      this.setActive(true);
      this.play('victory');
    }
    this.winner = s.winner;
    let count = 0;
    const live = new Set<number>();
    for (const e of s.entities) {
      live.add(e.id);
      const old = this.seen.get(e.id);
      this.seen.set(e.id, { progress: e.progress, cooldown: e.cooldown, fired: !!e.strike?.fired });
      const p = iso({ x: e.x - center.x, y: e.y - center.y });
      if (Math.abs(p.x) > 620 || Math.abs(p.y) > 320 || count >= 3 || s.paused) continue;
      const pan = Math.max(-0.8, Math.min(0.8, p.x / 620));
      if (
        !first &&
        e.team === 0 &&
        ((old && old.progress < 1 && e.progress === 1) || (!old && e.kind === 'unit'))
      ) {
        this.play('complete', pan);
        count++;
      } else if (
        e.state === 'attack' &&
        old &&
        ((e.strike?.fired && !old.fired) ||
          (e.kind === 'animal' && e.cooldown > old.cooldown + 0.1))
      ) {
        this.play(
          ['cannon', 'daivietcannon'].includes(e.type)
            ? 'cannon'
            : ['musketeer', 'handcannoneer'].includes(e.type)
              ? 'gun'
              : e.kind === 'unit' &&
                  [
                    'archer',
                    'crossbowman',
                    'guardarcher',
                    'horsearcher',
                    'catapult',
                    'villager',
                    'engineer',
                  ].includes(e.type)
                ? 'arrow'
                : 'hit',
          pan,
        );
        count++;
      } else if (e.state === 'work' && (s.tick + e.id * 7) % 22 < 2) {
        const target = s.entities.find((t) => t.id === e.orders[0]?.target);
        this.play(
          e.orders[0]?.kind === 'build' || e.orders[0]?.kind === 'repair'
            ? 'build'
            : target?.type === 'tree'
              ? 'axe'
              : target?.type === 'gold' || target?.type === 'stone'
                ? 'pick'
                : 'harvest',
          pan,
        );
        count++;
      } else if (e.state === 'walk' && (s.tick + e.id * 3) % 26 < 2) {
        this.play('step', pan);
        count++;
      }
    }
    for (const id of this.seen.keys()) if (!live.has(id)) this.seen.delete(id);
  }
}
export const sound = new Soundscape();
