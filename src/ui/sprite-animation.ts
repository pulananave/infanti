/**
 * SpriteAnimation — renders TexturePacker spritesheets with BPM-synced animation.
 *
 * Usage:
 *   const anim = new SpriteAnimation();
 *   await anim.load('assets/images/characters/Rafog/rafog_bombo.tpsheet');
 *   anim.setBpm(114, 2); // bpm, beats per animation cycle
 *   container.appendChild(anim.canvas);
 *   anim.play();
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
  private _displayW: number = 70;
  private _displayH: number = 70;

  constructor(width: number = 70, height: number = 70) {
    this._displayW = width;
    this._displayH = height;
    this._fps = 12;
    this._frameInterval = 1000 / 12;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.canvas.style.pointerEvents = 'none';
    this.canvas.style.display = 'block';
    this.ctx = this.canvas.getContext('2d')!;
  }

  /**
   * Load a .tpsheet file and its associated PNG.
   * The PNG path is derived from the tpsheet path.
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
   * Set animation speed based on BPM.
   * bpm = music BPM, beats = how many beats one animation cycle covers.
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

  /**
   * Go to a specific frame and draw it.
   */
  goToFrame(index: number): void {
    this._currentFrame = index % this.frames.length;
    this.drawFrame(this._currentFrame);
  }

  /**
   * Sync animation to a music time position.
   */
  syncToTime(musicTime: number, bpm: number, beats: number = 2): void {
    const frameCount = this.frames.length;
    const cycleDuration = (beats * 120) / bpm; // seconds per animation cycle
    const timeInCycle = musicTime % cycleDuration;
    const fps = (bpm * frameCount) / (beats * 120);
    const frame = Math.floor(timeInCycle * fps) % frameCount;
    this.drawFrame(frame);
    this._currentFrame = frame;
  }

  /**
   * Draw a specific frame onto the canvas.
   */
  private drawFrame(index: number): void {
    if (!this.image || this.frames.length === 0) return;

    const frame = this.frames[index];
    this.ctx.clearRect(0, 0, this._displayW, this._displayH);

    // Scale frame to fit display size while preserving aspect ratio
    const scale = Math.min(
      this._displayW / frame.w,
      this._displayH / frame.h
    );
    const dw = frame.w * scale;
    const dh = frame.h * scale;
    const dx = (this._displayW - dw) / 2;
    const dy = (this._displayH - dh) / 2;

    this.ctx.drawImage(
      this.image,
      frame.x, frame.y, frame.w, frame.h,
      dx, dy, dw, dh
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

/**
 * Cache for loaded sprite animations to avoid re-fetching.
 */
const spriteCache: Map<string, SpriteAnimation> = new Map();

export async function getSpriteAnimation(
  tpsheetPath: string,
  displaySize: number = 70
): Promise<SpriteAnimation> {
  const key = `${tpsheetPath}:${displaySize}`;
  if (spriteCache.has(key)) {
    return spriteCache.get(key)!;
  }

  const anim = new SpriteAnimation(displaySize, displaySize);
  await anim.load(tpsheetPath);
  spriteCache.set(key, anim);
  return anim;
}
