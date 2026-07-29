/**
 * SpriteAnimation — renders TexturePacker spritesheets with fixed frame dimensions.
 * All frames render at the same size (largest frame), pivot at bottom-center.
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
  private _fixedW: number = 0;
  private _fixedH: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d')!;
  }

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

    this.frames = tex.sprites.map(s => ({
      filename: s.filename,
      x: s.region.x,
      y: s.region.y,
      w: s.region.w,
      h: s.region.h,
    }));

    // Fixed dimensions from largest frame
    this._fixedW = Math.max(...this.frames.map(f => f.w));
    this._fixedH = Math.max(...this.frames.map(f => f.h));
    this.canvas.width = this._fixedW;
    this.canvas.height = this._fixedH;

    this.image = new Image();
    this.image.crossOrigin = 'anonymous';
    await new Promise<void>((resolve, reject) => {
      this.image!.onload = () => resolve();
      this.image!.onerror = () => reject(new Error(`Failed to load ${pngPath}`));
      this.image!.src = pngPath;
    });

    this.drawFrame(0);
  }

  setBpm(bpm: number, beats: number = 2): void {
    const frameCount = this.frames.length || 1;
    this._fps = (bpm * frameCount) / (beats * 120);
    this._frameInterval = 1000 / this._fps;
  }

  setFps(fps: number): void {
    this._fps = fps;
    this._frameInterval = 1000 / fps;
  }

  get currentFrame(): number { return this._currentFrame; }
  get totalFrames(): number { return this.frames.length; }
  get isPlaying(): boolean { return this._playing; }

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

  /**
   * Draw frame: fixed destination size, pivot at bottom-center.
   */
  private drawFrame(index: number): void {
    if (!this.image || this.frames.length === 0) return;

    const frame = this.frames[index];
    this.ctx.clearRect(0, 0, this._fixedW, this._fixedH);

    // Center horizontally, anchor at bottom
    const dx = (this._fixedW - frame.w) / 2;
    const dy = this._fixedH - frame.h;

    this.ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h,
      dx, dy, frame.w, frame.h
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
