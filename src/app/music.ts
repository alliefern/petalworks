// Petalworks background music: Allie's generative Web Audio soundtrack, ported from her
// game Sugar Belt (/workspace/marshmallow-factory/game/src/music.ts) at her request.
// Everything is synthesized at runtime: no sample files. The composer strings together short
// sections (music box, marimba, lo-fi keys, breathers) over gentle jazzy progressions and
// modulates between keys every few sections, so a long session never loops the same way twice.
// Keep this file in step with the Sugar Belt original when she updates it.

export type SectionKind = 'musicbox' | 'marimba' | 'lofi' | 'breather';

interface Chord { root: number; tones: number[] } // semitones above key tonic; tones relative to chord root
interface Section { kind: SectionKind; bars: number; prog: Chord[]; motif: Motif; key: number }
interface Motif { slots: number[]; contour: number[] }

const MAJ = [0, 2, 4, 5, 7, 9, 11];
const PENTA = [0, 2, 4, 7, 9];

// Diatonic chord helpers (7ths and 9ths keep it soft and warm)
const C = (root: number, tones: number[]): Chord => ({ root, tones });
const Imaj7 = C(0, [0, 4, 7, 11]), Imaj9 = C(0, [0, 4, 7, 11, 14]), Iadd9 = C(0, [0, 4, 7, 14]);
const ii7 = C(2, [0, 3, 7, 10]), ii9 = C(2, [0, 3, 7, 10, 14]);
const iii7 = C(4, [0, 3, 7, 10]);
const IVmaj7 = C(5, [0, 4, 7, 11]), IVmaj9 = C(5, [0, 4, 7, 11, 14]), iv6 = C(5, [0, 3, 7, 9]);
const V7sus = C(7, [0, 5, 7, 10]), V9 = C(7, [0, 4, 7, 10, 14]);
const vi7 = C(9, [0, 3, 7, 10]), vi9 = C(9, [0, 3, 7, 10, 14]);
const bVIImaj7 = C(10, [0, 4, 7, 11]);

const PROGS: Chord[][] = [
  [Imaj7, vi7, IVmaj7, V7sus],
  [IVmaj7, iii7, ii7, V7sus],
  [Imaj9, IVmaj9, Imaj9, IVmaj9],
  [ii9, V9, Imaj9, vi9],
  [Imaj7, iii7, IVmaj7, iv6],
  [vi7, IVmaj7, Iadd9, V7sus],
  [IVmaj9, V7sus, iii7, vi9],
  [Imaj7, bVIImaj7, IVmaj7, Imaj7],
];

const RHYTHMS = [
  [0, 3, 4, 6], [0, 2, 3, 6], [0, 4, 5, 7], [1, 3, 4], [0, 3, 6], [0, 2, 4, 5, 6], [2, 4, 7], [0, 6],
];

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  readonly ctx: BaseAudioContext;
  readonly out: GainNode;
  private buses: Record<string, GainNode> = {};
  private noise: AudioBuffer;
  private R: () => number;
  bpm: number;
  key = 65; // F
  intensity = 0.3; // 0..1, grows with the factory
  section!: Section;
  barInSection = 0;
  sectionCount = 0;
  barsPlayed = 0;
  nextBarTime = 0;
  private lastMel = 77;
  private lastKind: SectionKind = 'breather';
  /** current chord in absolute MIDI (for harmonizing sfx) */
  currentChord: number[] = [65, 69, 72, 76];

  constructor(ctx: BaseAudioContext, dest: AudioNode, seed: number, reverb?: AudioNode) {
    this.ctx = ctx;
    this.R = rng(seed);
    this.bpm = 72 + Math.floor(this.R() * 8);
    this.key = [65, 62, 67, 63, 60][Math.floor(this.R() * 5)];
    this.out = ctx.createGain();
    this.out.gain.value = 3;
    // warm it up: gentle lowpass on the whole band
    const warm = ctx.createBiquadFilter();
    warm.type = 'lowpass'; warm.frequency.value = 5200; warm.Q.value = 0.5;
    this.out.connect(warm).connect(dest);
    const send = ctx.createGain(); send.gain.value = 0.42;
    this.out.connect(send);
    if (reverb) send.connect(reverb);
    const mk = (name: string, gain: number, pan: number) => {
      const g = ctx.createGain(); g.gain.value = gain;
      const p = ctx.createStereoPanner(); p.pan.value = pan;
      g.connect(p).connect(this.out);
      this.buses[name] = g;
    };
    mk('bell', 0.27, 0.22); mk('marimba', 0.32, -0.18); mk('keys', 0.22, 0.0); mk('pad', 0.075, 0.0);
    mk('bass', 0.17, 0.0); mk('drums', 0.16, 0.05); mk('crackle', 0.0, 0.0);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.startCrackle();
    this.section = this.newSection();
  }

  get beat() { return 60 / this.bpm; }
  get barLen() { return this.beat * 4; }

  private startCrackle() {
    // faint vinyl hiss/crackle bed, rendered as a looping buffer
    const ctx = this.ctx, sr = ctx.sampleRate;
    const buf = ctx.createBuffer(1, sr * 4, sr);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * 0.05;
      if (Math.random() < 0.0004) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.6);
    }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3000; hp.Q.value = 0.4;
    src.connect(hp).connect(this.buses.crackle);
    src.start();
  }

  // ---------------------------------------------------------------- composer
  private pick<T>(a: T[]): T { return a[Math.floor(this.R() * a.length)]; }

  private newSection(): Section {
    const n = this.sectionCount++;
    // modulate every 3-4 sections: up a 4th, down a 5th, to the relative key... always gentle
    if (n > 0 && this.R() < 0.3) {
      const shift = this.pick([5, -7, -2, 2, 3, -3, 5]);
      this.key += shift;
      while (this.key > 68) this.key -= 12;
      while (this.key < 58) this.key += 12;
    }
    let kind: SectionKind;
    if (n === 0) kind = 'musicbox';
    else {
      const opts: SectionKind[] = ['musicbox', 'marimba', 'lofi', 'lofi', 'marimba', 'musicbox'];
      if (this.lastKind !== 'breather' && n % 3 === 0) opts.push('breather', 'breather');
      do kind = this.pick(opts); while (kind === this.lastKind);
    }
    this.lastKind = kind;
    const prog = this.pick(PROGS);
    const bars = kind === 'breather' ? 4 : 8;
    const slots = this.pick(RHYTHMS);
    const contour = slots.map((_, i) => (i === 0 ? 0 : this.pick([-2, -1, -1, 1, 1, 2, 0, 3, -3])));
    return { kind, bars, prog, motif: { slots, contour }, key: this.key };
  }

  /** Schedule the next bar if it starts within `ahead` seconds. Returns true if a bar was scheduled. */
  tick(ahead = 0.8): boolean {
    const now = this.ctx.currentTime;
    if (this.nextBarTime < now) this.nextBarTime = now + 0.08;
    if (this.nextBarTime > now + ahead) return false;
    this.scheduleBar(this.nextBarTime);
    this.nextBarTime += this.barLen;
    return true;
  }

  scheduleBar(t0: number) {
    const s = this.section;
    const bar = this.barInSection;
    const ch = s.prog[bar % s.prog.length];
    const root = s.key + ch.root;
    const chordAbs = ch.tones.map((x) => root + x);
    this.currentChord = chordAbs;
    const b = this.beat;
    const sw = (slot: number) => t0 + Math.floor(slot / 2) * b + (slot % 2 ? b * 0.58 : 0); // swung eighths
    const hum = () => (this.R() - 0.5) * 0.014;
    const I = this.intensity;
    const last = bar === s.bars - 1;
    const sectionStart = bar === 0;

    // pad: always, very soft bed
    const padNotes = chordAbs.slice(0, 4).map((m) => { let x = m; while (x < 55) x += 12; while (x > 70) x -= 12; return x; });
    for (const m of padNotes) this.pad(t0, mtof(m), this.barLen * 1.02, s.kind === 'breather' ? 1.1 : 0.8);

    // bass
    const bassM = root - 24 + (root - 24 < 36 ? 12 : 0);
    if (s.kind !== 'musicbox' || bar % 2 === 0) {
      if (s.kind === 'breather') this.bass(t0, mtof(bassM), this.barLen * 0.9, 0.6);
      else {
        this.bass(t0 + hum(), mtof(bassM), b * 1.8, 0.85);
        if (s.kind !== 'musicbox') {
          this.bass(sw(5) + hum(), mtof(bassM + (this.R() < 0.5 ? 7 : 12)), b * 0.9, 0.55);
          if (this.R() < 0.4) this.bass(sw(7) + hum(), mtof(bassM + 7), b * 0.4, 0.4);
        }
      }
    }

    // melody pitches
    const scale = (this.R() < 0.75 ? PENTA : MAJ).map((x) => x + s.key);
    const inScale = (m: number) => scale.some((x) => ((m - x) % 12 + 12) % 12 === 0);
    const nearestChordTone = (m: number) => {
      let best = m, bd = 99;
      for (let o = -24; o <= 24; o += 12) for (const c of chordAbs) { const d = Math.abs(c + o - m); if (d < bd) { bd = d; best = c + o; } }
      return best;
    };
    const stepScale = (m: number, steps: number) => {
      let x = m; const dir = Math.sign(steps);
      for (let k = 0; k < Math.abs(steps); k++) { x += dir; while (!inScale(x)) x += dir; }
      return x;
    };
    const phrase = bar % 4; // A A' B A''
    const melody: [number, number][] = [];
    if (s.kind !== 'breather' && !(phrase === 3 && this.R() < 0.4)) {
      const slots = phrase === 2 ? RHYTHMS[(RHYTHMS.indexOf(s.motif.slots) + 3) % RHYTHMS.length] : s.motif.slots;
      let m = nearestChordTone(this.lastMel + (phrase === 2 ? 3 : 0));
      slots.forEach((slot, i) => {
        if (i > 0) m = stepScale(m, (phrase === 1 ? -1 : 1) * (s.motif.contour[i] ?? 1));
        if (slot % 4 === 0) m = nearestChordTone(m);
        if (m > 86) m -= 12; if (m < 70) m += 12;
        melody.push([slot, m]);
      });
      if (last) melody.push([6, nearestChordTone(s.key + 12 * Math.round((m - s.key) / 12))]);
      this.lastMel = m;
    }

    if (s.kind === 'musicbox') {
      // rolling arpeggio + tinkly melody
      const arp = chordAbs.map((m) => m + 12).concat(chordAbs.map((m) => m + 24)).filter((m) => m < 98);
      const pat = [0, 1, 2, 3, 2, 1, 2, 3];
      for (let k = 0; k < 8; k++) {
        if (k % 2 === 1 && this.R() < 0.25) continue;
        this.bell(sw(k) + hum(), mtof(arp[pat[k] % arp.length]), 0.22 + this.R() * 0.06, 1.4);
      }
      for (const [slot, m] of melody) this.bell(sw(slot) + hum(), mtof(m + 12), 0.42, 2.2);
    } else if (s.kind === 'marimba') {
      for (const [slot, m] of melody) this.marimba(sw(slot) + hum(), mtof(m), 0.6 + this.R() * 0.15);
      // comping dyads on off-beats
      const lo = chordAbs.map((m) => { let x = m; while (x < 60) x += 12; while (x > 72) x -= 12; return x; }).sort((a, z) => a - z);
      for (const slot of [1, 3, 5, 7]) {
        if (this.R() < 0.3) continue;
        this.marimba(sw(slot) + hum(), mtof(lo[0]), 0.28);
        this.marimba(sw(slot) + hum(), mtof(lo[2] ?? lo[1]), 0.24);
      }
      if (I > 0.35) this.shaker(t0, b);
      if (bar % 2 === 1 && this.R() < 0.5) this.bell(sw(7), mtof(chordAbs[2] + 24), 0.18, 1.2);
    } else if (s.kind === 'lofi') {
      const voicing = chordAbs.map((m) => { let x = m; while (x < 57) x += 12; while (x > 74) x -= 12; return x; });
      this.keys(t0 + 0.012, voicing, b * 2.6, 0.55);
      if (this.R() < 0.6) this.keys(sw(3) + hum(), voicing.slice(1), b * 1.6, 0.36);
      for (const [slot, m] of melody) if (this.R() < 0.85) this.bell(sw(slot) + hum(), mtof(m), 0.3, 1.6);
      if (I > 0.18) this.drums(t0, b, I, sw);
    } else {
      // breather: just the bed and a couple of distant bells
      if (this.R() < 0.7) this.bell(t0 + b * (1 + Math.floor(this.R() * 2)), mtof(chordAbs[1] + 24), 0.16, 2.8);
    }
    if (sectionStart && s.kind !== 'breather' && this.barsPlayed > 0) this.bell(t0, mtof(Math.min(96, chordAbs[0] + 24)), 0.12, 3.0); // soft sparkle on new section

    this.barsPlayed++;
    this.barInSection++;
    if (this.barInSection >= s.bars) { this.barInSection = 0; this.section = this.newSection(); }
  }

  // ---------------------------------------------------------------- instruments
  private env(g: AudioParam, t: number, peak: number, attack: number, decay: number) {
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(peak, t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  bell(t: number, f: number, vel: number, dur: number, dest?: AudioNode) {
    t = Math.max(t, this.ctx.currentTime);
    // music-box tine: sine carrier with a short bright FM "ping"
    const c = this.ctx;
    const o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    o.frequency.value = f; m.frequency.value = Math.min(f * 3.5, this.ctx.sampleRate * 0.4);
    mg.gain.setValueAtTime(f * 1.2, t); mg.gain.exponentialRampToValueAtTime(f * 0.01, t + 0.25);
    m.connect(mg).connect(o.frequency);
    this.env(g.gain, t, vel, 0.004, dur);
    o.connect(g).connect(dest ?? this.buses.bell);
    o.start(t); m.start(t); o.stop(t + dur + 0.1); m.stop(t + dur + 0.1);
  }

  marimba(t: number, f: number, vel: number, dest?: AudioNode) {
    t = Math.max(t, this.ctx.currentTime);
    const c = this.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), g2 = c.createGain();
    o.frequency.value = f; o2.frequency.value = Math.min(f * 3.93, this.ctx.sampleRate * 0.4);
    this.env(g.gain, t, vel, 0.003, 0.75);
    this.env(g2.gain, t, vel * 0.35, 0.002, 0.07);
    o.connect(g).connect(dest ?? this.buses.marimba); o2.connect(g2).connect(dest ?? this.buses.marimba);
    o.start(t); o2.start(t); o.stop(t + 0.9); o2.stop(t + 0.2);
  }

  keys(t: number, notes: number[], dur: number, vel: number) {
    t = Math.max(t, this.ctx.currentTime);
    // soft electric piano: FM with ratio 1, decaying brightness, a hair of detune
    const c = this.ctx;
    notes.forEach((n, i) => {
      const f = mtof(n), st = t + i * 0.011;
      const o = c.createOscillator(), m = c.createOscillator(), mg = c.createGain(), g = c.createGain();
      o.frequency.value = f; o.detune.value = (i % 2 ? 4 : -4); m.frequency.value = f;
      mg.gain.setValueAtTime(f * 0.9, st); mg.gain.exponentialRampToValueAtTime(f * 0.08, st + 0.6);
      m.connect(mg).connect(o.frequency);
      this.env(g.gain, st, vel / Math.sqrt(notes.length), 0.006, dur);
      o.connect(g).connect(this.buses.keys);
      o.start(st); m.start(st); o.stop(st + dur + 0.1); m.stop(st + dur + 0.1);
    });
  }

  pad(t: number, f: number, dur: number, vel: number) {
    t = Math.max(t, this.ctx.currentTime);
    const c = this.ctx;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.3;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel * 0.5, t + dur * 0.35);
    g.gain.linearRampToValueAtTime(vel * 0.4, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
    lp.connect(g).connect(this.buses.pad);
    for (const det of [-7, 7]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.7);
    }
  }

  bass(t: number, f: number, dur: number, vel: number) {
    t = Math.max(t, this.ctx.currentTime);
    const c = this.ctx;
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain();
    o.frequency.value = f; o2.type = 'triangle'; o2.frequency.value = f;
    const g2 = c.createGain(); g2.gain.value = 0.6;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.02);
    g.gain.exponentialRampToValueAtTime(vel * 0.5, t + dur * 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); o2.connect(g2).connect(g); g.connect(this.buses.bass);
    o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }

  private noiseHit(t: number, type: BiquadFilterType, freq: number, q: number, vel: number, dur: number) {
    t = Math.max(t, this.ctx.currentTime);
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noise;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    this.env(g.gain, t, vel, 0.004, dur);
    s.connect(f).connect(g).connect(this.buses.drums);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }

  private kick(t: number, vel: number) {
    t = Math.max(t, this.ctx.currentTime);
    const c = this.ctx;
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(44, t + 0.14);
    this.env(g.gain, t, vel, 0.004, 0.3);
    o.connect(g).connect(this.buses.drums); o.start(t); o.stop(t + 0.4);
  }

  private shaker(t0: number, b: number) {
    for (let k = 0; k < 8; k++) this.noiseHit(t0 + k * b / 2 + (k % 2 ? b * 0.08 : 0), 'highpass', 6500, 0.7, k % 2 ? 0.1 : 0.16, 0.05);
  }

  private drums(t0: number, b: number, I: number, sw: (s: number) => number) {
    this.kick(t0, 0.75);
    if (this.R() < 0.6) this.kick(sw(5), 0.5);
    else this.kick(sw(4), 0.55);
    this.noiseHit(t0 + b, 'bandpass', 1900, 0.8, 0.32, 0.16); // brushy snare
    this.noiseHit(t0 + b * 3, 'bandpass', 1900, 0.8, 0.32, 0.16);
    if (I > 0.45) for (let k = 0; k < 8; k++) this.noiseHit(sw(k), 'highpass', 8000, 0.7, k % 2 ? 0.06 : 0.1, 0.035);
  }

  setCrackle(v: number) { this.buses.crackle.gain.value = v; }
}

/** Build a soft stereo reverb impulse (no files needed). */
export function makeReverb(ctx: BaseAudioContext, seconds = 2.6, decay = 3): ConvolverNode {
  const sr = ctx.sampleRate, len = Math.floor(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const n = Math.random() * 2 - 1;
      lp = lp * 0.6 + n * 0.4; // darker tail
      d[i] = lp * Math.pow(1 - i / len, decay) * (i < sr * 0.01 ? i / (sr * 0.01) : 1);
    }
  }
  const cv = ctx.createConvolver(); cv.buffer = buf;
  return cv;
}

export { mtof };
