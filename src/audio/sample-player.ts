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
  private _buffer: AudioBuffer | null = null;
  private _loop: boolean = true;
  private _isPlaying: boolean = false;
  private _volume: number = 1.0;

  constructor() {
    const ctx = musicEngine.getContext();
    this.gainNode = ctx.createGain();
    this.gainNode.connect(ctx.destination);
  }

  async load(url: string): Promise<void> {
    this._buffer = await loadAudio(url);
  }

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  setVolume(db: number): void {
    // Convert dB to linear gain
    this._volume = Math.pow(10, db / 20);
    this.gainNode.gain.value = this._volume;
  }

  setMuted(muted: boolean): void {
    this.gainNode.gain.value = muted ? 0 : this._volume;
  }

  play(offset: number = 0): void {
    if (!this._buffer) return;
    this.stop();

    const ctx = musicEngine.getContext();
    this.source = ctx.createBufferSource();
    this.source.buffer = this._buffer;
    this.source.loop = this._loop;
    this.source.connect(this.gainNode);
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

  getOutputNode(): GainNode {
    return this.gainNode;
  }

  getBuffer(): AudioBuffer | null {
    return this._buffer;
  }
}
