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
  private gainNode: GainNode;
  private panNode: StereoPannerNode;
  private _buffer: AudioBuffer | null = null;
  private _isPlaying: boolean = false;
  private _volume: number = 1.0;
  private _pan: number = 0;
  private _muted: boolean = false;
  private _instrumentBars: number = 1;
  private _onBarHandler: ((barNumber: number) => void) | null = null;
  private _activeSources: AudioBufferSourceNode[] = [];

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
   * Start playing synced to bar boundaries.
   * - Plays immediately at the correct offset within the current cycle
   * - Re-triggers at bar boundaries (bar % instrumentBars === 0)
   * - Previous sources are NOT stopped — they play out naturally (audio tail)
   */
  playSynced(barDuration: number, instrumentBars: number): void {
    if (!this._buffer) return;
    this._removeBarListener();

    this._instrumentBars = instrumentBars;

    const musicTime = musicEngine.time;
    const bufferDur = this._buffer.duration;

    // Cycle length in seconds
    const cycleSeconds = instrumentBars * barDuration;

    // Where in the cycle are we?
    const timeIntoCycle = musicTime % cycleSeconds;

    // Cap offset to buffer duration (sample might be shorter than cycle)
    const offset = Math.min(timeIntoCycle, bufferDur - 0.01);
    this._triggerBuffer(offset);

    // Register bar listener for re-triggering
    this._onBarHandler = (barNumber: number) => {
      if (barNumber % instrumentBars === 0) {
        this._triggerBuffer(0);
      }
    };
    eventBus.on(Events.MUSIC_BAR, this._onBarHandler);
  }

  play(): void {
    if (!this._buffer) return;
    this._removeBarListener();
    this._triggerBuffer(0);
  }

  /**
   * Trigger a fresh playback. Does NOT stop previous sources —
   * they play out naturally so audio tails aren't cut.
   * Old sources are cleaned up after they finish.
   */
  private _triggerBuffer(offset: number): void {
    if (!this._buffer) return;

    const ctx = musicEngine.getContext();
    const source = ctx.createBufferSource();
    source.buffer = this._buffer;
    source.loop = false;
    source.connect(this.panNode);
    source.start(0, offset);

    this._activeSources.push(source);
    this._isPlaying = true;

    // Clean up this source when it ends
    source.onended = () => {
      source.disconnect();
      this._activeSources = this._activeSources.filter(s => s !== source);
    };
  }

  stop(): void {
    // Stop and disconnect ALL active sources
    for (const src of this._activeSources) {
      try { src.stop(); } catch {}
      src.disconnect();
    }
    this._activeSources = [];
    this._removeBarListener();
    this._isPlaying = false;
  }

  private _removeBarListener(): void {
    if (this._onBarHandler) {
      eventBus.off(Events.MUSIC_BAR, this._onBarHandler);
      this._onBarHandler = null;
    }
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
