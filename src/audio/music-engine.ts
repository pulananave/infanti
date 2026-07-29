import { eventBus, Events } from '@/core/event-bus';

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private _bpm: number = 120;
  private _bars: number = 16;
  private _barDuration: number = 2.0; // 240 / bpm
  private _time: number = 0;
  private _state: 'playing' | 'stopped' = 'stopped';
  private _lastBar: number = -1;
  private _startTime: number = 0;
  private _pausedAt: number = 0;
  private _rafId: number = 0;

  get time(): number {
    return this._time;
  }

  get duration(): number {
    return this._barDuration * this._bars;
  }

  get bpm(): number {
    return this._bpm;
  }

  get isPlaying(): boolean {
    return this._state === 'playing';
  }

  async init(): Promise<void> {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  getContext(): AudioContext {
    if (!this.ctx) throw new Error('AudioContext not initialized. Call init() first.');
    return this.ctx;
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
    this._barDuration = 240 / bpm;
  }

  setBars(bars: number): void {
    this._bars = bars;
  }

  play(fromTime: number = 0): void {
    if (!this.ctx) return;
    this._time = fromTime;
    this._startTime = this.ctx.currentTime - fromTime;
    this._state = 'playing';
    this._lastBar = -1;
    eventBus.emit(Events.MUSIC_PLAYING_CHANGED, true);
    this.tick();
  }

  pause(): void {
    if (!this.ctx) return;
    this._pausedAt = this._time;
    this._state = 'stopped';
    cancelAnimationFrame(this._rafId);
    eventBus.emit(Events.MUSIC_PLAYING_CHANGED, false);
  }

  stop(): void {
    this._state = 'stopped';
    this._time = 0;
    this._lastBar = -1;
    this._pausedAt = 0;
    cancelAnimationFrame(this._rafId);
    eventBus.emit(Events.MUSIC_PLAYING_CHANGED, false);
  }

  resume(): void {
    if (this._pausedAt > 0) {
      this.play(this._pausedAt);
    }
  }

  seek(to: number): void {
    if (to <= this.duration) {
      this._time = to;
      if (this.ctx && this._state === 'playing') {
        this._startTime = this.ctx.currentTime - to;
      }
      eventBus.emit(Events.MUSIC_TICK, this._time);
    }
  }

  private tick = (): void => {
    if (this._state !== 'playing' || !this.ctx) return;

    this._time = this.ctx.currentTime - this._startTime;

    // Loop
    if (this._time >= this.duration) {
      this._time -= this.duration;
      this._startTime = this.ctx.currentTime - this._time;
      eventBus.emit(Events.MUSIC_LOOPED);
    }

    // Bar detection
    const currentBar = Math.floor(this._time / this._barDuration);
    if (currentBar !== this._lastBar && currentBar < this._bars) {
      eventBus.emit(Events.MUSIC_BAR, currentBar);
      this._lastBar = currentBar;
    }

    eventBus.emit(Events.MUSIC_TICK, this._time);
    this._rafId = requestAnimationFrame(this.tick);
  };
}

export const musicEngine = new MusicEngine();
