import { musicEngine } from './music-engine';

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
  private source: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private panNode: StereoPannerNode;
  private _buffer: AudioBuffer | null = null;
  private _isPlaying: boolean = false;
  private _volume: number = 1.0;
  private _pan: number = 0; // -1 (left) to 1 (right)
  private _muted: boolean = false;

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
   * Play the sample synced to the current music progress.
   * The sample loops to fill the total music duration.
   * offset = where in the music we are (in seconds).
   */
  playSynced(musicOffset: number): void {
    if (!this._buffer) return;
    this.stop();

    const ctx = musicEngine.getContext();
    const bufferDuration = this._buffer.duration;

    // Where within the looped sample we should start
    // If the buffer is 4s and music is at 10s, we start at 10 % 4 = 2s into the buffer
    const offsetInBuffer = bufferDuration > 0
      ? musicOffset % bufferDuration
      : 0;

    this.source = ctx.createBufferSource();
    this.source.buffer = this._buffer;
    this.source.loop = true;
    this.source.connect(this.panNode);
    this.source.start(0, offsetInBuffer);
    this._isPlaying = true;
  }

  /**
   * Play without syncing (for immediate effects).
   */
  play(offset: number = 0): void {
    if (!this._buffer) return;
    this.stop();

    const ctx = musicEngine.getContext();
    this.source = ctx.createBufferSource();
    this.source.buffer = this._buffer;
    this.source.loop = true;
    this.source.connect(this.panNode);
    this.source.start(0, offset);
    this._isPlaying = true;
  }

  stop(): void {
    if (this.source) {
      try { this.source.stop(); } catch {}
      this.source.disconnect();
      this.source = null;
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

  /**
   * Set stereo pan: -1 = full left, 0 = center, 1 = full right
   */
  setPan(pan: number): void {
    this._pan = clamp(pan, -1, 1);
    this.panNode.pan.value = this._pan;
  }

  getPan(): number {
    return this._pan;
  }

  getOutputNode(): GainNode {
    return this.gainNode;
  }

  getBuffer(): AudioBuffer | null {
    return this._buffer;
  }
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}
