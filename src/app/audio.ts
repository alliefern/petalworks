/**
 * Audio: plays the cue set in assets/audio per AUDIO_MANIFEST.md. Ogg is preferred,
 * MP3 is the fallback for decoders without Vorbis. Nothing sounds until the first
 * user gesture unlocks Web Audio. Sound and music have separate persisted toggles.
 */
const OGG = import.meta.glob('../../assets/audio/*.ogg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const MP3 = import.meta.glob('../../assets/audio/*.mp3', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

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
  | 'deliver'
  | 'music';

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
  music: 0.42,
};

const LOOPS: CueKey[] = ['music', 'machine_working', 'belt_tick'];

function findUrl(table: Record<string, string>, name: string): string | undefined {
  for (const [path, url] of Object.entries(table)) if (path.endsWith('/' + name)) return url;
  return undefined;
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private buffers = new Map<CueKey, AudioBuffer>();
  private loading = new Map<CueKey, Promise<AudioBuffer | null>>();
  private loops = new Map<CueKey, { src: AudioBufferSourceNode; gain: GainNode }>();
  private wantLoop = new Map<CueKey, boolean>();
  private lastPlay = new Map<CueKey, number>();
  private useOgg = true;
  sound = true;
  music = true;
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
      this.master = this.ctx.createGain();
      this.master.gain.value = 1;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sound ? 1 : 0;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.music ? 1 : 0;
      this.musicGain.connect(this.master);
      this.unlocked = true;
      void this.ctx.resume();
      // Warm the common cues, then start the music bed.
      void this.load('music').then(() => this.setLoop('music', true));
      for (const k of ['ui_click', 'build_place', 'ui_error', 'deliver', 'item_pop'] as CueKey[]) void this.load(k);
    } catch {
      this.ctx = null;
    }
  }

  private url(key: CueKey): string | undefined {
    return (this.useOgg ? findUrl(OGG, key + '.ogg') : undefined) ?? findUrl(MP3, key + '.mp3') ?? findUrl(OGG, key + '.ogg');
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
    if (this.sfxGain && this.ctx) this.sfxGain.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05);
    if (!on) {
      this.stopLoop('machine_working');
      this.stopLoop('belt_tick');
    }
  }

  setMusic(on: boolean): void {
    this.music = on;
    if (this.musicGain && this.ctx) this.musicGain.gain.setTargetAtTime(on ? (this.paused ? 0.35 : 1) : 0, this.ctx.currentTime, 0.2);
    if (on) this.setLoop('music', true);
    else this.stopLoop('music');
  }

  /** Fade music down and stop the factory loops while paused. */
  setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    if (this.musicGain && this.ctx && this.music) this.musicGain.gain.setTargetAtTime(paused ? 0.35 : 1, this.ctx.currentTime, 0.25);
    if (paused) {
      this.stopLoop('machine_working');
      this.stopLoop('belt_tick');
    } else {
      for (const k of ['machine_working', 'belt_tick'] as CueKey[]) if (this.wantLoop.get(k)) this.setLoop(k, true);
    }
  }

  play(key: CueKey, opts: { throttleMs?: number; delay?: number } = {}): void {
    if (!this.ctx || !this.sfxGain) return;
    if (key !== 'music' && !this.sound) return;
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
    if (key === 'music' ? !this.music : !this.sound || this.paused) return;
    void this.load(key).then((buf) => {
      if (!buf || !this.ctx || this.loops.has(key) || !this.wantLoop.get(key)) return;
      if (key === 'music' ? !this.music : !this.sound || this.paused) return;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = this.ctx.createGain();
      g.gain.value = GAIN[key];
      src.connect(g);
      g.connect(key === 'music' ? this.musicGain! : this.sfxGain!);
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

export const audio = new AudioEngine();
