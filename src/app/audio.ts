/**
 * Audio: sound effects come from the cue set in assets/audio per AUDIO_MANIFEST.md (Ogg
 * preferred, MP3 for decoders without Vorbis). Background music is Allie's generative
 * Sugar Belt soundtrack (./music.ts), synthesized at runtime, so no music file is downloaded;
 * assets/audio/music.* stay in the repo as the audio team's source but are not loaded.
 * Nothing sounds until the first user gesture unlocks Web Audio. Sound and music have
 * separate persisted toggles.
 */
import { makeReverb, Music } from './music';

// music.ogg/.mp3 are excluded: the soundtrack is generated, see above.
const OGG = import.meta.glob(['../../assets/audio/*.ogg', '!**/music.ogg'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const MP3 = import.meta.glob(['../../assets/audio/*.mp3', '!**/music.mp3'], { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

/** Music bus level (Sugar Belt's default: a 0.55 slider on a squared curve, times 0.9). */
const MUSIC_LEVEL = 0.55 * 0.55 * 0.9;
const MUSIC_PAUSED_SCALE = 0.35;

export type CueKey =
  | 'ui_click'
  | 'ui_hover'
  | 'ui_error'
  | 'build_place'
  | 'build_rotate'
  | 'build_remove'
  | 'undo'
  | 'belt_tick'
  | 'item_pop'
  | 'flower_bloom'
  | 'machine_working'
  | 'blocked'
  | 'coins'
  | 'order_complete'
  | 'unlock'
  | 'final_celebration'
  | 'deliver';

/** Suggested gains from the manifest. */
const GAIN: Record<CueKey, number> = {
  ui_click: 0.55,
  ui_hover: 0.4,
  ui_error: 0.5,
  build_place: 0.62,
  build_rotate: 0.5,
  build_remove: 0.55,
  undo: 0.52,
  belt_tick: 0.3,
  item_pop: 0.6,
  flower_bloom: 0.62,
  machine_working: 0.38,
  blocked: 0.46,
  coins: 0.5,
  order_complete: 0.7,
  unlock: 0.68,
  final_celebration: 0.74,
  deliver: 0.48,
};

const LOOPS: CueKey[] = ['machine_working', 'belt_tick'];

function findUrl(table: Record<string, string>, name: string): string | undefined {
  for (const [path, url] of Object.entries(table)) if (path.endsWith('/' + name)) return url;
  return undefined;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTrack: Music | null = null;
  private buffers = new Map<CueKey, AudioBuffer>();
  private loading = new Map<CueKey, Promise<AudioBuffer | null>>();
  private loops = new Map<CueKey, { src: AudioBufferSourceNode; gain: GainNode }>();
  private wantLoop = new Map<CueKey, boolean>();
  private lastPlay = new Map<CueKey, number>();
  private useOgg = true;
  sound = true;
  music = true;
  /** Top-bar mute: everything silent, slider levels kept. */
  muted = false;
  /** Slider levels, 0..1. */
  sfxLevel = 0.8;
  musicLevel = 0.8;
  paused = false;
  unlocked = false;

  constructor() {
    if (typeof document !== 'undefined') {
      const probe = document.createElement('audio');
      const ogg = probe.canPlayType?.('audio/ogg; codecs="vorbis"') ?? '';
      this.useOgg = ogg === 'probably' || ogg === 'maybe';
    }
  }

  /** Call from a user gesture. Browsers refuse to start audio otherwise. */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      // Master: a gentle compressor keeps the generated band and the cues from clipping.
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.ratio.value = 3;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(comp).connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxTarget();
      this.sfxGain.connect(this.master);
      // Music: Sugar Belt's generative band on its own bus with a soft reverb return.
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0;
      this.musicGain.connect(this.master);
      const verb = makeReverb(this.ctx);
      const verbReturn = this.ctx.createGain();
      verbReturn.gain.value = 0.55;
      verb.connect(verbReturn).connect(this.musicGain);
      this.musicTrack = new Music(this.ctx, this.musicGain, (Math.random() * 2 ** 31) | 0, verb);
      this.musicTrack.setCrackle(0.05);
      this.musicTrack.nextBarTime = this.ctx.currentTime + 0.3;
      window.setInterval(() => this.pump(), 90);
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else void this.ctx.resume();
      });
      this.unlocked = true;
      void this.ctx.resume();
      // Fade the band in instead of starting at full level.
      if (this.musicTarget() > 0) {
        this.musicGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.musicGain.gain.linearRampToValueAtTime(this.musicTarget(), this.ctx.currentTime + 4);
      }
      for (const k of ['ui_click', 'build_place', 'ui_error', 'deliver', 'item_pop'] as CueKey[]) void this.load(k);
    } catch {
      this.ctx = null;
    }
  }

  private url(key: CueKey): string | undefined {
    if (this.useOgg) return findUrl(OGG, key + '.ogg') ?? findUrl(MP3, key + '.mp3');
    return findUrl(MP3, key + '.mp3') ?? findUrl(OGG, key + '.ogg');
  }

  /** Schedule the next bars of music a little ahead of time. Skips when muted to rest the CPU. */
  private pump(): void {
    if (!this.ctx || !this.musicTrack || !this.music || this.ctx.state !== 'running') return;
    try {
      let n = 0;
      while (this.musicTrack.tick(0.9) && n++ < 4) {
        /* schedule ahead */
      }
    } catch (e) {
      console.warn('music', e);
    }
  }

  private musicTarget(): number {
    return this.music && !this.muted ? MUSIC_LEVEL * this.musicLevel * (this.paused ? MUSIC_PAUSED_SCALE : 1) : 0;
  }

  private sfxTarget(): number {
    return this.sound && !this.muted ? this.sfxLevel : 0;
  }

  /** Push the current toggles and levels to both buses. */
  private applyLevels(): void {
    if (!this.ctx) return;
    if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(this.sfxTarget(), this.ctx.currentTime, 0.05);
    if (this.musicGain) {
      this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicGain.gain.setTargetAtTime(this.musicTarget(), this.ctx.currentTime, 0.2);
    }
    if (this.sfxTarget() === 0) {
      this.stopLoop('machine_working');
      this.stopLoop('belt_tick');
    }
  }

  /** The top-bar speaker: silence everything, keep the slider levels. */
  setMuted(on: boolean): void {
    const wasAudible = this.musicTarget() > 0;
    this.muted = on;
    this.applyLevels();
    if (!wasAudible && this.musicTarget() > 0 && this.musicTrack && this.ctx) this.musicTrack.nextBarTime = this.ctx.currentTime + 0.3;
  }

  /** Slider levels, 0..1 each. */
  setLevels(sfx: number, music: number): void {
    this.sfxLevel = Math.max(0, Math.min(1, sfx));
    this.musicLevel = Math.max(0, Math.min(1, music));
    this.applyLevels();
  }

  /** A short sample at the current effects level (the slider plays it on release). */
  preview(): void {
    this.play('build_place', { throttleMs: 0 });
  }

  /** For tests and the console: is the band running, and where is it. */
  musicDebug(): { state: string; bars: number; section: string | null; key: number | null; bpm: number | null; intensity: number | null; level: number } {
    return {
      state: this.ctx?.state ?? 'none',
      bars: this.musicTrack?.barsPlayed ?? 0,
      section: this.musicTrack?.section.kind ?? null,
      key: this.musicTrack?.section.key ?? null,
      bpm: this.musicTrack?.bpm ?? null,
      intensity: this.musicTrack?.intensity ?? null,
      level: this.musicGain?.gain.value ?? 0,
    };
  }

  /** 0..1: a bigger, busier factory gets a fuller arrangement (drums, hats, shaker). */
  setIntensity(v: number): void {
    if (this.musicTrack) this.musicTrack.intensity = Math.max(0, Math.min(1, v));
  }

  private load(key: CueKey): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = this.loading.get(key);
    if (pending) return pending;
    const ctx = this.ctx;
    const url = this.url(key);
    if (!ctx || !url) return Promise.resolve(null);
    const p = fetch(url)
      .then((r) => r.arrayBuffer())
      .then((ab) => ctx.decodeAudioData(ab))
      .then((buf) => {
        this.buffers.set(key, buf);
        return buf;
      })
      .catch(() => null);
    this.loading.set(key, p);
    return p;
  }

  setSound(on: boolean): void {
    this.sound = on;
    this.applyLevels();
  }

  setMusic(on: boolean): void {
    const was = this.music;
    this.music = on;
    if (!this.musicGain || !this.ctx) return;
    this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
    this.musicGain.gain.setTargetAtTime(this.musicTarget(), this.ctx.currentTime, 0.2);
    // Coming back from mute: pick the band up from "now" rather than a stale bar time.
    if (on && !was && this.musicTrack) this.musicTrack.nextBarTime = this.ctx.currentTime + 0.3;
  }

  /** Fade music down and stop the factory loops while paused. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (this.musicGain && this.ctx && this.music) this.musicGain.gain.setTargetAtTime(this.musicTarget(), this.ctx.currentTime, 0.25);
    if (paused) {
      this.stopLoop('machine_working');
      this.stopLoop('belt_tick');
    } else {
      for (const k of ['machine_working', 'belt_tick'] as CueKey[]) if (this.wantLoop.get(k)) this.setLoop(k, true);
    }
  }

  play(key: CueKey, opts: { throttleMs?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfxGain) return;
    if (!this.sound || this.muted) return;
    const now = performance.now();
    const throttle = opts.throttleMs ?? 40;
    if (now - (this.lastPlay.get(key) ?? -1e9) < throttle) return;
    this.lastPlay.set(key, now);
    void this.load(key).then((buf) => {
      if (!buf || !this.ctx || !this.sfxGain) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const g = this.ctx.createGain();
      g.gain.value = GAIN[key];
      src.connect(g);
      g.connect(this.sfxGain);
      src.start(this.ctx.currentTime + (opts.delay ?? 0));
    });
  }

  hover(): void {
    this.play('ui_hover', { throttleMs: 80 });
  }

  /** Start or stop one of the three loops. Only ever one instance of each. */
  setLoop(key: CueKey, on: boolean): void {
    if (!LOOPS.includes(key)) return;
    this.wantLoop.set(key, on);
    if (!on) {
      this.stopLoop(key);
      return;
    }
    if (this.loops.has(key) || !this.ctx) return;
    if (!this.sound || this.paused) return;
    void this.load(key).then((buf) => {
      if (!buf || !this.ctx || this.loops.has(key) || !this.wantLoop.get(key)) return;
      if (!this.sound || this.paused) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = GAIN[key];
      src.connect(g);
      g.connect(this.sfxGain!);
      src.start();
      this.loops.set(key, { src, gain: g });
    });
  }

  private stopLoop(key: CueKey): void {
    const l = this.loops.get(key);
    if (!l) return;
    try {
      l.src.stop();
    } catch {
      /* already stopped */
    }
    this.loops.delete(key);
  }
}

/**
 * Render the generated soundtrack offline and measure it (used by tools/music-check.mjs).
 * Builds the same chain as unlock(): music bus level, reverb return, 0.9 master, compressor.
 */
export async function renderMusic(seconds: number, seed: number, intensity: number): Promise<{ peak: number; rms: number; clipped: number; silentSeconds: number; bars: number; bpm: number; kinds: string[] }> {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, Math.floor(sr * seconds), sr);
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.ratio.value = 3;
  comp.attack.value = 0.01;
  comp.release.value = 0.25;
  const master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(comp).connect(ctx.destination);
  const bus = ctx.createGain();
  bus.gain.value = MUSIC_LEVEL;
  bus.connect(master);
  const verb = makeReverb(ctx);
  const ret = ctx.createGain();
  ret.gain.value = 0.55;
  verb.connect(ret).connect(bus);
  const m = new Music(ctx, bus, seed, verb);
  m.setCrackle(0.05);
  m.intensity = intensity;
  const kinds: string[] = [];
  let t = 0.3;
  let bars = 0;
  let lastSection = -1;
  while (t < seconds) {
    if (m.sectionCount !== lastSection) {
      kinds.push(m.section.kind);
      lastSection = m.sectionCount;
    }
    m.scheduleBar(t);
    t += m.barLen;
    bars++;
  }
  const buf = await ctx.startRendering();
  let peak = 0;
  let sum = 0;
  let clipped = 0;
  const n = buf.length;
  const silent = new Array(Math.ceil(seconds)).fill(true);
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < n; i++) {
      const a = Math.abs(d[i]);
      if (a > peak) peak = a;
      if (a >= 0.999) clipped++;
      sum += d[i] * d[i];
      if (a > 0.004) silent[Math.floor(i / sr)] = false;
    }
  }
  return { peak, rms: Math.sqrt(sum / (n * buf.numberOfChannels)), clipped, silentSeconds: silent.filter(Boolean).length, bars, bpm: m.bpm, kinds };
}

export const audio = new AudioEngine();
if (typeof window !== 'undefined') (window as unknown as { petalworksAudio?: unknown }).petalworksAudio = { audio, renderMusic };
