/**
 * Tiny synthesized sound set. No audio files exist yet (see ASSET_SPECS §11), so
 * everything here is generated with Web Audio: soft, short, and quiet. When real
 * files land in assets/audio/, swap the bodies of these functions for buffer playback.
 */
export type SfxName = 'place' | 'rotate' | 'remove' | 'invalid' | 'pop' | 'deliver' | 'order_complete' | 'unlock' | 'click';

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  soundOn = true;
  musicOn = true;
  private unlocked = false;

  /** Call from a user gesture. Browsers refuse to start audio otherwise. */
  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? 0.18 : 0;
      this.musicGain.connect(this.master);
      this.unlocked = true;
      void this.ctx.resume();
      this.startMusic();
    } catch {
      this.ctx = null;
    }
  }

  setSound(on: boolean): void {
    this.soundOn = on;
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (this.musicGain && this.ctx) {
      this.musicGain.gain.setTargetAtTime(on ? 0.18 : 0, this.ctx.currentTime, 0.2);
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, when = 0, dest?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + when;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(dest ?? this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, hp = 800): void {
    if (!this.ctx || !this.master) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = hp;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start();
  }

  play(name: SfxName): void {
    if (!this.soundOn || !this.ctx) return;
    switch (name) {
      case 'place':
        this.tone(220, 0.09, 'triangle', 0.25);
        this.noise(0.05, 0.08, 2000);
        break;
      case 'rotate':
        this.tone(660, 0.05, 'square', 0.06);
        break;
      case 'remove':
        this.noise(0.12, 0.12, 1200);
        this.tone(180, 0.12, 'sine', 0.12);
        break;
      case 'invalid':
        this.tone(140, 0.18, 'sine', 0.2);
        this.tone(120, 0.18, 'triangle', 0.1, 0.02);
        break;
      case 'pop':
        this.tone(520, 0.08, 'sine', 0.18);
        this.tone(780, 0.07, 'sine', 0.1, 0.03);
        break;
      case 'deliver':
        this.noise(0.08, 0.07, 3000);
        this.tone(880, 0.06, 'sine', 0.08, 0.02);
        break;
      case 'order_complete':
        this.tone(523, 0.35, 'sine', 0.2);
        this.tone(659, 0.35, 'sine', 0.2, 0.12);
        this.tone(784, 0.6, 'sine', 0.2, 0.24);
        this.tone(1047, 0.8, 'triangle', 0.08, 0.36);
        break;
      case 'unlock':
        for (let i = 0; i < 5; i++) this.tone(600 + i * 120, 0.12, 'sine', 0.1, i * 0.05);
        break;
      case 'click':
        this.tone(900, 0.03, 'square', 0.03);
        break;
    }
  }

  /** Very gentle pentatonic plucks over a soft pad; stops when music is off (gain 0). */
  private startMusic(): void {
    if (!this.ctx || !this.musicGain || this.musicTimer !== null) return;
    const scale = [261.6, 293.7, 329.6, 392.0, 440.0, 523.3, 587.3];
    const pad = this.ctx.createOscillator();
    pad.type = 'sine';
    pad.frequency.value = 130.8;
    const padGain = this.ctx.createGain();
    padGain.gain.value = 0.12;
    pad.connect(padGain);
    padGain.connect(this.musicGain);
    pad.start();
    const step = () => {
      if (!this.ctx || !this.musicGain) return;
      if (this.musicOn && Math.random() < 0.7) {
        const f = scale[Math.floor(Math.random() * scale.length)];
        this.tone(f, 1.4, 'sine', 0.35, 0, this.musicGain);
        if (Math.random() < 0.3) this.tone(f * 1.5, 1.2, 'sine', 0.15, 0.2, this.musicGain);
      }
      this.musicTimer = window.setTimeout(step, 900 + Math.random() * 1400);
    };
    this.musicTimer = window.setTimeout(step, 600);
  }
}

export const audio = new AudioEngine();
