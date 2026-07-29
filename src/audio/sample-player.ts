import { musicEngine } from './music-engine';
import { eventBus, Events } from '@/core/event-bus';

const audioBufferCache: Map<string, AudioBuffer> = new Map();

export async function loadAudio(url: string): Promise<AudioBuffer> {
  if (audioBufferCache.has(url)) {
    return audioBufferCache.get(url)!;
  }

  const ctx = musicEngine.getContext();
  const response = await fetch(url);
  const arrayBuffer = await response.arrayBuffer();
  const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
  audioBufferCache.set(url, audioBuffer);
  return audioBuffer;
}

export class SamplePlayer {
  private sources: AudioBufferSourceNode[] = [];
  private gainNode: GainNode;
  private panNode: StereoPannerNode;
  private _buffer: AudioBuffer | null = null;
  private _isPlaying: boolean = false;
  private _volume: number = 1.0;
  private _pan: number = 0;
  private _muted: boolean = false;
  private _bars: number = 1; // how many bars this sample covers
  private _onBarHandler: ((barNumber: number) => void) | null = null;

  constructor() {
    const ctx = musicEngine.getContext();
    this.panNode = ctx.createStereoPanner();
    this.gainNode = ctx.createGain();
    this.panNode.connect(this.gainNode);
    this.gainNode.connect(ctx.destination);
  }

  async load(url: string): Promise<void> {
    this._buffer = await loadAudio(url);
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Start playing synced to the music.
   * The sample triggers on bar boundaries: bar % instrumentBars === 0
   * On first call, plays immediately at the correct offset within the buffer.
   */
  playSynced(musicBarDuration: number, instrumentBars: number): void {
    if (!this._buffer) return;
    this.stop();

    this._bars = instrumentBars;

    const musicTime = musicEngine.time;
    const currentBarFloat = musicTime / musicBarDuration;
    const currentBar = Math.floor(currentBarFloat);

    // Which trigger cycle are we in?
    const cycleLength = instrumentBars * musicBarDuration; // duration in seconds of one cycle
    const timeIntoCycle = musicTime % cycleLength;

    // Play the sample at the correct offset
    this._playBuffer(timeIntoCycle);

    // Listen for future bar events to re-trigger
    this._onBarHandler = (barNumber: number) => {
      if (barNumber % instrumentBars === 0) {
        this._playBuffer(0);
      }
    };
    eventBus.on(Events.MUSIC_BAR, this._onBarHandler);
  }

  /**
   * Play immediately (no sync). Used for instant feedback.
   */
  play(): void {
    if (!this._buffer) return;
    this.stop();
    this._playBuffer(0);
    this._isPlaying = true;
  }

  /**
   * Internal: stop any current source and play buffer at offset.
   */
  private _playBuffer(offset: number): void {
    if (!this._buffer) return;

    // Stop previous sources
    for (const src of this.sources) {
      try { src.stop(); } catch {}
      src.disconnect();
    }
    this.sources = [];

    const ctx = musicEngine.getContext();
    const source = ctx.createBufferSource();
    source.buffer = this._buffer;
    source.loop = false; // NEVER loop — we trigger programmatically
    source.connect(this.panNode);
    source.start(0, offset);
    this.sources.push(source);
    this._isPlaying = true;
  }

  stop(): void {
    for (const src of this.sources) {
      try { src.stop(); } catch {}
      src.disconnect();
    }
    this.sources = [];

    if (this._onBarHandler) {
      eventBus.off(Events.MUSIC_BAR, this._onBarHandler);
      this._onBarHandler = null;
    }

    this._isPlaying = false;
  }

  setVolume(db: number): void {
    this._volume = Math.pow(10, db / 20);
    if (!this._muted) {
      this.gainNode.gain.value = this._volume;
    }
  }

  getVolume(): number {
    return this._volume;
  }

  setMuted(muted: boolean): void {
    this._muted = muted;
    this.gainNode.gain.value = muted ? 0 : this._volume;
  }

  isMuted(): boolean {
    return this._muted;
  }

  setPan(pan: number): void {
    this._pan = Math.max(-1, Math.min(1, pan));
    this.panNode.pan.value = this._pan;
  }

  getPan(): number {
    return this._pan;
  }

  getBuffer(): AudioBuffer | null {
    return this._buffer;
  }
}
