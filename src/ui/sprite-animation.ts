/**
 * SpriteAnimation — renders TexturePacker spritesheets with fixed frame dimensions.
 *
 * All frames are rendered at a single fixed size (based on the largest frame),
 * preventing distortion between frames of different dimensions.
 */

interface SpriteFrame {
  filename: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface TPSheetData {
  textures: Array<{
    image: string;
    size: { w: number; h: number };
    sprites: Array<{
      filename: string;
      region: { x: number; y: number; w: number; h: number };
      margin?: { x: number; y: number };
    }>;
  }>;
}

export class SpriteAnimation {
  canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private image: HTMLImageElement | null = null;
  private frames: SpriteFrame[] = [];
  private _currentFrame: number = 0;
  private _playing: boolean = false;
  private _fps: number = 12;
  private _rafId: number = 0;
  private _lastFrameTime: number = 0;
  private _frameInterval: number = 1000 / 12;
  // Fixed render dimensions (based on largest frame in the sheet)
  private _fixedW: number = 0;
  private _fixedH: number = 0;
  // Display scale multiplier (per-character)
  private _scale: number = 1.0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Load a .tpsheet file and its associated PNG.
   */
  async load(tpsheetPath: string): Promise<void> {
    const resp = await fetch(tpsheetPath);
    const data: TPSheetData = await resp.json();

    if (!data.textures || data.textures.length === 0) {
      console.warn(`No textures in ${tpsheetPath}`);
      return;
    }

    const tex = data.textures[0];
    const basePath = tpsheetPath.substring(0, tpsheetPath.lastIndexOf('/') + 1);
    const pngPath = basePath + tex.image;

    // Extract frames
    this.frames = tex.sprites.map(s => ({
      filename: s.filename,
      x: s.region.x,
      y: s.region.y,
      w: s.region.w,
      h: s.region.h,
    }));

    // Calculate fixed dimensions from the largest frame
    this._fixedW = Math.max(...this.frames.map(f => f.w));
    this._fixedH = Math.max(...this.frames.map(f => f.h));

    // Set canvas size
    this._updateCanvasSize();

    // Load image
    this.image = new Image();
    this.image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      this.image!.onload = () => resolve();
      this.image!.onerror = () => reject(new Error(`Failed to load ${pngPath}`));
      this.image!.src = pngPath;
    });

    // Draw first frame
    this.drawFrame(0);
  }

  /**
   * Set per-character scale multiplier.
   */
  setScale(scale: number): void {
    this._scale = scale;
    this._updateCanvasSize();
    if (this.frames.length > 0) {
      this.drawFrame(this._currentFrame);
    }
  }

  getScale(): number {
    return this._scale;
  }

  private _updateCanvasSize(): void {
    this.canvas.width = Math.round(this._fixedW * this._scale);
    this.canvas.height = Math.round(this._fixedH * this._scale);
    this.canvas.style.width = `${this.canvas.width}px`;
    this.canvas.style.height = `${this.canvas.height}px`;
  }

  /**
   * Set animation speed based on BPM.
   */
  setBpm(bpm: number, beats: number = 2): void {
    const frameCount = this.frames.length || 1;
    this._fps = (bpm * frameCount) / (beats * 120);
    this._frameInterval = 1000 / this._fps;
  }

  /**
   * Set raw FPS (overrides BPM calculation).
   */
  setFps(fps: number): void {
    this._fps = fps;
    this._frameInterval = 1000 / fps;
  }

  get currentFrame(): number {
    return this._currentFrame;
  }

  get totalFrames(): number {
    return this.frames.length;
  }

  get isPlaying(): boolean {
    return this._playing;
  }

  play(): void {
    if (this._playing || this.frames.length === 0) return;
    this._playing = true;
    this._lastFrameTime = performance.now();
    this._tick();
  }

  stop(): void {
    this._playing = false;
    cancelAnimationFrame(this._rafId);
  }

  pause(): void {
    this._playing = false;
    cancelAnimationFrame(this._rafId);
  }

  goToFrame(index: number): void {
    this._currentFrame = index % this.frames.length;
    this.drawFrame(this._currentFrame);
  }

  syncToTime(musicTime: number, bpm: number, beats: number = 2): void {
    const frameCount = this.frames.length;
    const cycleDuration = (beats * 120) / bpm;
    const timeInCycle = musicTime % cycleDuration;
    const fps = (bpm * frameCount) / (beats * 120);
    const frame = Math.floor(timeInCycle * fps) % frameCount;
    this.drawFrame(frame);
    this._currentFrame = frame;
  }

  /**
   * Draw frame with fixed dimensions and pivot at bottom-center.
   * All frames use the same _fixedW/_fixedH as the destination size,
   * preserving consistent proportions across frames.
   */
  private drawFrame(index: number): void {
    if (!this.image || this.frames.length === 0) return;

    const frame = this.frames[index];
    const cw = this.canvas.width;
    const ch = this.canvas.height;
    this.ctx.clearRect(0, 0, cw, ch);

    // Fixed destination size = fixed dimensions * scale
    const dw = this._fixedW * this._scale;
    const dh = this._fixedH * this._scale;

    // Center horizontally, anchor at bottom
    const dx = (cw - dw) / 2;
    const dy = ch - dh;

    this.ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h,  // source (variable size)
      dx, dy, dw, dh                         // dest (fixed size)
    );
  }

  private _tick = (): void => {
    if (!this._playing) return;

    const now = performance.now();
    if (now - this._lastFrameTime >= this._frameInterval) {
      this._currentFrame = (this._currentFrame + 1) % this.frames.length;
      this.drawFrame(this._currentFrame);
      this._lastFrameTime = now;
    }

    this._rafId = requestAnimationFrame(this._tick);
  };

  destroy(): void {
    this.stop();
    this.image = null;
    this.frames = [];
  }
}
