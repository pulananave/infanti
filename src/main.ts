import { musicEngine } from '@/audio/music-engine';
import { SamplePlayer } from '@/audio/sample-player';
import { exportRecordingWav, downloadBlob } from '@/audio/audio-exporter';
import { eventBus, Events } from '@/core/event-bus';
import { gameState, GameState } from '@/core/game-state';
import type { PackConfig, InstrumentConfig, CharacterConfig } from '@/core/types';
import { dragSystem } from '@/drag/drag-system';
import type { Recording, StateSnapshot, InstrumentState } from '@/recording/recording';
import { recordingStorage } from '@/recording/storage';
import { loadPack } from '@/packs/pack-loader';
import { remap, clamp } from '@/utils/math';

// ============================================================
// APP STATE
// ============================================================

interface InstrumentInstance {
  id: string;
  config: InstrumentConfig;
  characterId: string;
  player: SamplePlayer;
  element: HTMLElement;
  shelfBtn: HTMLElement | null;
  onStage: boolean;
  muted: boolean;
  stageElement: HTMLElement | null;
  normalizedPosition: { x: number; y: number };
  stageX: number;
  stageY: number;
  audioLoaded: boolean;
}

interface CharacterInstance {
  config: CharacterConfig;
  element: HTMLElement;
  instrumentBox: HTMLElement;
  instrumentsVisible: boolean;
  instruments: InstrumentInstance[];
}

let currentPack: PackConfig | null = null;
let characters: CharacterInstance[] = [];
let instrumentsOnStage: InstrumentInstance[] = [];
let allInstruments: Map<string, InstrumentInstance> = new Map();
let activeRecording: Recording | null = null;
let recordingStates: StateSnapshot[] = [];
let recordingStartTime: number = 0;
let timesLooped: number = 0;

const STAGE_BOUNDS = { minX: 0, maxX: 1, minY: 0, maxY: 1 };

// ============================================================
// DOM HELPERS
// ============================================================

function el(tag: string, attrs: Record<string, string> = {}, ...children: (Node | string)[]): HTMLElement {
  const elem = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'class') elem.className = val;
    else if (key.startsWith('data-')) elem.setAttribute(key, val);
    else (elem as any)[key] = val;
  }
  for (const child of children) {
    if (typeof child === 'string') elem.appendChild(document.createTextNode(child));
    else elem.appendChild(child);
  }
  return elem;
}

// ============================================================
// SCENES
// ============================================================

const app = document.getElementById('app')!;
const splash = document.getElementById('splash')!;

async function showMainMenu(): Promise<void> {
  app.innerHTML = '';

  const menu = el('div', { class: 'main-menu', style: `
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    width: 100%; height: 100%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    font-family: 'Nunito', sans-serif; gap: 30px;
  `});

  const title = el('h1', { style: `
    font-size: 48px; color: white; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
  ` }, '🎵 Infanti');
  menu.appendChild(title);

  const packsContainer = el('div', { style: `
    display: flex; gap: 20px; flex-wrap: wrap; justify-content: center; padding: 20px;
  ` });

  // Load available packs
  const packIds = ['dona-aranha', 'sapo', 'pintinho', 'canoa', 'coelho'];
  for (const id of packIds) {
    try {
      const pack = await loadPack(id);
      const btn = el('button', { style: `
        width: 160px; height: 180px; border-radius: 20px; border: 3px solid rgba(255,255,255,0.3);
        background: rgba(255,255,255,0.15); backdrop-filter: blur(10px);
        cursor: pointer; display: flex; flex-direction: column; align-items: center;
        justify-content: center; gap: 10px; transition: transform 0.2s, background 0.2s;
        color: white; font-size: 16px; font-weight: bold; font-family: inherit;
      `});

      const img = el('img', {
        src: pack.cover,
        style: 'width: 80px; height: 80px; object-fit: contain;',
        alt: pack.name,
      });
      img.onerror = () => { img.style.display = 'none'; };

      btn.appendChild(img);
      btn.appendChild(el('span', {}, pack.name));

      btn.addEventListener('pointerenter', () => { btn.style.transform = 'scale(1.05)'; btn.style.background = 'rgba(255,255,255,0.3)'; });
      btn.addEventListener('pointerleave', () => { btn.style.transform = 'scale(1)'; btn.style.background = 'rgba(255,255,255,0.15)'; });
      btn.addEventListener('click', () => startStage(pack));

      packsContainer.appendChild(btn);
    } catch {
      // Pack not available yet
    }
  }

  menu.appendChild(packsContainer);
  app.appendChild(menu);
}

// ============================================================
// STAGE
// ============================================================

async function startStage(pack: PackConfig): Promise<void> {
  try {
    await musicEngine.init();
  } catch (e) {
    console.warn('AudioContext init failed, continuing without audio:', e);
  }
  musicEngine.setBpm(pack.bpm);
  musicEngine.setBars(pack.bars);

  currentPack = pack;
  characters = [];
  instrumentsOnStage = [];
  allInstruments.clear();

  app.innerHTML = '';

  const stageLayout = el('div', { style: `
    display: flex; flex-direction: column;
    width: 100%; height: 100%; background: #e8e8e8;
    font-family: 'Nunito', sans-serif;
  `});

  // Stage area fills remaining space, with sidebar on the right
  const stageRow = el('div', { style: `
    display: flex; flex-direction: row; flex: 1; min-height: 0;
  `});

  const stageArea = el('div', { class: 'stage-area', style: `
    flex: 1; position: relative; overflow: hidden;
    background: url('assets/images/stage-bg.jpg') center/cover no-repeat;
    background-color: #e8e8e8;
  `});

  // Close all open instrument boxes when clicking on stage
  stageArea.addEventListener('pointerdown', () => {
    for (const c of characters) {
      if (c.instrumentsVisible) {
        c.instrumentBox.style.display = 'none';
        c.instrumentsVisible = false;
      }
    }
  });

  // Make stage a drop target
  const stageTarget = {
    acceptsDrop: (drag: any) => true,
    receiveDrop: (drag: any) => {
      const inst = drag.node as InstrumentInstance;
      if (!inst || !inst.id) return;
      placeOnStage(inst, drag.globalX, drag.globalY);
    },
    getPriority: () => 10,
  };
  dragSystem.registerDropTarget(stageTarget);

  // Sidebar (right) — vertical colored blocks
  const sidebar = createSidebar(pack);
  stageRow.appendChild(stageArea);
  stageRow.appendChild(sidebar);

  // Character shelf (bottom) — square colored buttons
  const shelf = el('div', { style: `
    display: flex; flex-direction: row; align-items: center; justify-content: center;
    background: #d8d8d8; padding: 6px 10px; gap: 6px;
    min-height: 80px; flex-shrink: 0;
    overflow-x: auto; position: relative; z-index: 200;
  `});

  // Close all popups when mouse leaves shelf (with 1s delay)
  let shelfLeaveTimeout: ReturnType<typeof setTimeout> | null = null;
  shelf.addEventListener('pointerleave', () => {
    shelfLeaveTimeout = setTimeout(() => {
      for (const c of characters) {
        if (c.instrumentsVisible) {
          c.instrumentBox.style.display = 'none';
          c.instrumentsVisible = false;
        }
      }
    }, 1000);
  });
  shelf.addEventListener('pointerenter', () => {
    if (shelfLeaveTimeout) {
      clearTimeout(shelfLeaveTimeout);
      shelfLeaveTimeout = null;
    }
  });

  for (const charConfig of pack.characters) {
    try {
      const charInstance = await createCharacter(charConfig, stageArea);
      characters.push(charInstance);
      shelf.appendChild(charInstance.element);
    } catch (e) {
      console.warn(`Failed to create character ${charConfig.id}:`, e);
    }
  }

  // Timeline bar (top) — teal capsule
  const timeline = createTimeline();
  stageLayout.appendChild(timeline);
  stageLayout.appendChild(stageRow);
  stageLayout.appendChild(shelf);
  app.appendChild(stageLayout);

  // Pointer events for drag
  setupPointerEvents(stageArea);

  // Music events
  eventBus.on(Events.MUSIC_LOOPED, () => {
    timesLooped++;
    if (gameState.current === GameState.RECORDING) {
      if (timesLooped >= (currentPack?.loops ?? 2)) {
        stopRecording();
      }
    }
  });
}

// ============================================================
// CHARACTER + INSTRUMENT CREATION
// ============================================================

async function createCharacter(config: CharacterConfig, stageArea: HTMLElement): Promise<CharacterInstance> {
  const instruments: InstrumentInstance[] = [];

  for (const instConfig of config.instruments) {
    const player = new SamplePlayer();
    // Audio loads lazily when instrument is first placed on stage
    let audioLoaded = false;

    const inst: InstrumentInstance = {
      id: `${config.id}_${instConfig.type}`,
      config: instConfig,
      characterId: config.id,
      player,
      element: null as any,
      shelfBtn: null,
      onStage: false,
      muted: false,
      stageElement: null,
      normalizedPosition: { x: 0.5, y: 0.5 },
      stageX: 0,
      stageY: 0,
      audioLoaded: false,
    };

    // Create instrument icon element
    const instEl = el('div', {
      class: 'instrument-icon',
      'data-instrument-id': inst.id,
      style: `
        width: 60px; height: 60px; border-radius: 50%;
        background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        cursor: grab; display: flex; align-items: center; justify-content: center;
        transition: transform 0.2s; position: absolute; opacity: 0;
        pointer-events: none;
      `,
    });

    const icon = el('img', {
      src: instConfig.icon,
      style: 'width: 40px; height: 40px; object-fit: contain; pointer-events: none;',
      draggable: 'false',
    });
    icon.onerror = () => { icon.style.display = 'none'; instEl.textContent = instConfig.type.charAt(0).toUpperCase(); };
    instEl.appendChild(icon);

    inst.element = instEl;
    instruments.push(inst);
    allInstruments.set(inst.id, inst);
  }

  // Character button — square with colored background, monster icon
  const charBtn = el('div', { style: `
    width: 60px; height: 60px; border-radius: 8px;
    background: #888; color: white;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 6px rgba(0,0,0,0.25);
    transition: transform 0.15s, box-shadow 0.15s;
    overflow: hidden; flex-shrink: 0;
  ` });

  const charImg = el('img', {
    src: config.icon,
    style: 'width: 52px; height: 52px; object-fit: contain; pointer-events: none;',
    draggable: 'false',
  });
  charImg.onerror = () => {
    charImg.style.display = 'none';
    charBtn.textContent = config.id.charAt(0).toUpperCase();
    charBtn.style.fontSize = '20px';
    charBtn.style.fontWeight = 'bold';
  };
  charBtn.appendChild(charImg);

  // Hover effect
  charBtn.addEventListener('pointerenter', () => {
    charBtn.style.transform = 'scale(1.08)';
    charBtn.style.boxShadow = '0 4px 12px rgba(0,0,0,0.35)';
  });
  charBtn.addEventListener('pointerleave', () => {
    charBtn.style.transform = 'scale(1)';
    charBtn.style.boxShadow = '0 2px 6px rgba(0,0,0,0.25)';
  });

  const instrumentBox = el('div', { style: `
    display: none; position: fixed; z-index: 9000;
    background: #f5e642; border-radius: 14px;
    padding: 8px 12px;
    flex-direction: row; gap: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
  ` });

  // Speech bubble tail (triangle pointing down)
  const tail = el('div', { style: `
    position: absolute; bottom: -10px; left: 50%; transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid #f5e642;
  ` });
  instrumentBox.appendChild(tail);

  for (const inst of instruments) {
    const instBtn = el('div', { style: `
      width: 56px; height: 56px;
      cursor: grab; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 1px; font-size: 8px; color: #555;
      border-radius: 6px;
    `});

    const img = el('img', {
      src: inst.config.icon,
      style: 'width: 36px; height: 36px; object-fit: contain; pointer-events: none;',
      draggable: 'false',
    });
    img.onerror = () => { img.style.display = 'none'; };
    instBtn.appendChild(img);
    instBtn.appendChild(el('span', { style: 'pointer-events: none; text-align: center; max-width: 50px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;' }, inst.config.name));

    // Store shelf button reference
    inst.shelfBtn = instBtn;

    // Drag start on pointerdown
    instBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

      // Don't allow drag if already on stage
      if (inst.onStage) return;

      // Create a floating copy for dragging
      const dragCopy = el('div', { style: `
        position: fixed; width: 60px; height: 60px; border-radius: 50%;
        background: white; box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        display: flex; align-items: center; justify-content: center;
        z-index: 9999; pointer-events: none;
        left: ${e.clientX - 30}px; top: ${e.clientY - 30}px;
      ` });
      const copyImg = el('img', {
        src: inst.config.icon,
        style: 'width: 40px; height: 40px; object-fit: contain;',
      });
      dragCopy.appendChild(copyImg);
      document.body.appendChild(dragCopy);

      dragSystem.startDrag(e.pointerId, { ...inst, _dragCopy: dragCopy, position: { x: e.clientX, y: e.clientY } }, config.id, -30, -30, e.clientX, e.clientY);

      // Hide instrument box
      instrumentBox.style.display = 'none';
      charInstance.instrumentsVisible = false;
    });

    instrumentBox.appendChild(instBtn);
  }

  const charInstance: CharacterInstance = {
    config,
    element: el('div', { style: 'position: relative;' }, charBtn, instrumentBox),
    instrumentBox,
    instrumentsVisible: false,
    instruments,
  };

  // Toggle instrument box
  charBtn.addEventListener('click', () => {
    if (gameState.current === GameState.PLAYING) return;

    // Close all other open instrument boxes
    for (const c of characters) {
      if (c !== charInstance && c.instrumentsVisible) {
        c.instrumentBox.style.display = 'none';
        c.instrumentsVisible = false;
      }
    }

    if (charInstance.instrumentsVisible) {
      instrumentBox.style.display = 'none';
      charInstance.instrumentsVisible = false;
    } else {
      // Position box above character (fixed positioning)
      const rect = charBtn.getBoundingClientRect();
      instrumentBox.style.display = 'flex';
      instrumentBox.style.left = `${rect.left + rect.width / 2}px`;
      instrumentBox.style.bottom = '';
      instrumentBox.style.transform = 'translateX(-50%)';
      instrumentBox.style.top = `${rect.top - 10}px`;
      instrumentBox.style.transform = 'translate(-50%, -100%)';
      charInstance.instrumentsVisible = true;
    }
  });

  return charInstance;
}

// ============================================================
// STAGE OPERATIONS
// ============================================================

function placeOnStage(inst: InstrumentInstance, globalX: number, globalY: number): void {
  if (inst.onStage) return;

  const stageArea = document.querySelector('.stage-area') as HTMLElement;
  if (!stageArea) return;

  const rect = stageArea.getBoundingClientRect();
  const localX = clamp(globalX - rect.left, 0, rect.width);
  const localY = clamp(globalY - rect.top, 0, rect.height);

  inst.onStage = true;
  inst.stageX = localX;
  inst.stageY = localY;
  inst.normalizedPosition = {
    x: localX / rect.width,
    y: localY / rect.height,
  };

  // Create stage representation (positioned with left/top as center point)
  const stageEl = el('div', {
    style: `
      position: absolute; width: 70px; height: 70px; border-radius: 50%;
      background: white; box-shadow: 0 4px 16px rgba(0,0,0,0.2);
      display: flex; align-items: center; justify-content: center;
      cursor: grab; z-index: 10;
      left: ${localX}px; top: ${localY}px;
      margin-left: -35px; margin-top: -35px;
      transition: box-shadow 0.2s;
    `,
    'data-instrument-id': inst.id,
  });

  const img = el('img', {
    src: inst.config.icon,
    style: 'width: 45px; height: 45px; object-fit: contain; pointer-events: none;',
    draggable: 'false',
  });
  img.onerror = () => { img.style.display = 'none'; };
  stageEl.appendChild(img);

  // Mute button (visible, click to toggle)
  const muteBtn = el('div', {
    'data-mute-btn': 'true',
    style: `
    position: absolute; top: -8px; right: -8px; width: 24px; height: 24px;
    border-radius: 50%; background: #666; color: white;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; cursor: pointer; z-index: 20;
    opacity: 0.6; transition: opacity 0.2s;
  ` }, '🔊');
  muteBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation(); // prevent drag
    e.preventDefault();
    toggleMute(inst);
    muteBtn.textContent = inst.muted ? '🔇' : '🔊';
    muteBtn.style.background = inst.muted ? '#ff4444' : '#666';
    muteBtn.style.opacity = '1';
  });
  stageEl.appendChild(muteBtn);

  // Direct drag handler on the stage element
  stageEl.addEventListener('pointerdown', (e) => {
    // Ignore if clicking mute button
    if ((e.target as HTMLElement).closest('[data-mute-btn]')) return;
    e.preventDefault();
    e.stopPropagation();

    const areaRect = stageArea.getBoundingClientRect();
    const offsetX = e.clientX - areaRect.left - inst.stageX;
    const offsetY = e.clientY - areaRect.top - inst.stageY;

    const onMove = (ev: PointerEvent) => {
      const r = stageArea.getBoundingClientRect();
      const x = clamp(ev.clientX - r.left - offsetX, 0, r.width);
      const y = clamp(ev.clientY - r.top - offsetY, 0, r.height);
      stageEl.style.left = `${x}px`;
      stageEl.style.top = `${y}px`;
      // Update position effects in real-time during drag
      inst.stageX = x;
      inst.stageY = y;
      inst.normalizedPosition = { x: x / r.width, y: y / r.height };
      applyPositionEffects(inst);
    };

    const onUp = (ev: PointerEvent) => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);

      const r = stageArea.getBoundingClientRect();
      const x = clamp(ev.clientX - r.left - offsetX, 0, r.width);
      const y = clamp(ev.clientY - r.top - offsetY, 0, r.height);
      inst.stageX = x;
      inst.stageY = y;
      inst.normalizedPosition = { x: x / r.width, y: y / r.height };
      applyPositionEffects(inst);
      eventBus.emit(Events.INSTRUMENT_MOVED, inst);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });

  inst.stageElement = stageEl;
  stageArea.appendChild(stageEl);

  // Apply position effects (volume, pan, scale)
  applyPositionEffects(inst);

  // Load audio if not loaded yet, then play
  const barDuration = 240 / (currentPack?.bpm ?? 120);
  if (!(inst as any).audioLoaded) {
    inst.player.load(inst.config.audio).then(() => {
      (inst as any).audioLoaded = true;
      inst.player.playSynced(barDuration, inst.config.bars);
    }).catch((e: any) => {
      console.warn(`Audio load failed for ${inst.config.name}:`, e);
    });
  } else {
    inst.player.playSynced(barDuration, inst.config.bars);
  }

  // Disable shelf button visually
  if (inst.shelfBtn) {
    inst.shelfBtn.style.opacity = '0.35';
    inst.shelfBtn.style.filter = 'grayscale(1)';
    inst.shelfBtn.style.cursor = 'not-allowed';
    inst.shelfBtn.style.pointerEvents = 'none';
  }

  instrumentsOnStage.push(inst);
  eventBus.emit(Events.INSTRUMENT_ADDED, inst);

  if (instrumentsOnStage.length === 1) {
    eventBus.emit(Events.STAGE_FIRST_INSTRUMENT, inst);
    if (!musicEngine.isPlaying && gameState.current === GameState.FREE) {
      musicEngine.play();
    }
  }
}

function removeFromStage(inst: InstrumentInstance): void {
  if (!inst.onStage) return;

  inst.onStage = false;
  inst.player.stop();

  if (inst.stageElement) {
    inst.stageElement.remove();
    inst.stageElement = null;
  }

  // Re-enable shelf button
  if (inst.shelfBtn) {
    inst.shelfBtn.style.opacity = '1';
    inst.shelfBtn.style.filter = 'none';
    inst.shelfBtn.style.cursor = 'grab';
    inst.shelfBtn.style.pointerEvents = 'auto';
  }

  instrumentsOnStage = instrumentsOnStage.filter(i => i.id !== inst.id);
  eventBus.emit(Events.INSTRUMENT_REMOVED, inst);

  if (instrumentsOnStage.length === 0) {
    eventBus.emit(Events.STAGE_EMPTY);
    if (gameState.current === GameState.FREE) {
      musicEngine.stop();
    }
  }
}

function toggleMute(inst: InstrumentInstance): void {
  inst.muted = !inst.muted;
  inst.player.setMuted(inst.muted);

  if (inst.stageElement) {
    inst.stageElement.style.opacity = inst.muted ? '0.5' : '1';
  }

  eventBus.emit(Events.INSTRUMENT_MUTE_TOGGLED, inst);

  if (gameState.current === GameState.RECORDING) {
    saveRecordingState();
  }
}

function applyPositionEffects(inst: InstrumentInstance): void {
  const pos = inst.normalizedPosition;
  const stageArea = document.querySelector('.stage-area') as HTMLElement;
  if (!stageArea) return;

  // Reference point: center-bottom of stage
  const refX = 0.5;
  const refY = 1.0;

  // Distance from center-bottom (0 = at reference, 1 = farthest corner)
  const dx = pos.x - refX;
  const dy = pos.y - refY;
  // Max possible distance (top-left or top-right corner from center-bottom)
  const maxDist = Math.sqrt(refX * refX + 1.0);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const normalizedDist = clamp(dist / maxDist, 0, 1);

  // Volume: closer to center-bottom = louder, further = quieter
  const minDb = inst.config.minVolumeDb; // e.g. -20
  const maxDb = inst.config.maxVolumeDb; // e.g. 0
  const volumeDb = remap(normalizedDist, 0, 1, maxDb, minDb);
  inst.player.setVolume(inst.muted ? -80 : volumeDb);

  // Pan: left side = -1, center = 0, right side = +1
  const pan = remap(pos.x, 0, 1, -1, 1);
  inst.player.setPan(inst.muted ? 0 : pan);

  // Scale: closer = bigger, further = smaller
  const scale = remap(normalizedDist, 0, 1, 1.2, 0.5);

  if (inst.stageElement) {
    const size = 70 * scale;
    inst.stageElement.style.width = `${size}px`;
    inst.stageElement.style.height = `${size}px`;
    inst.stageElement.style.marginLeft = `${-size / 2}px`;
    inst.stageElement.style.marginTop = `${-size / 2}px`;
    const img = inst.stageElement.querySelector('img') as HTMLElement;
    if (img) {
      img.style.width = `${size * 0.65}px`;
      img.style.height = `${size * 0.65}px`;
    }
  }
}

// ============================================================
// TIMELINE
// ============================================================

function createTimeline(): HTMLElement {
  const container = el('div', { style: `
    padding: 8px 12px 4px 12px; background: #e8e8e8;
    display: flex; flex-direction: column; gap: 4px;
    flex-shrink: 0;
  `});

  const barContainer = el('div', { style: `
    width: 100%; height: 18px; background: #80c4b8;
    border-radius: 9px; border: 3px solid #3d2b5a;
    overflow: hidden; cursor: pointer; position: relative;
  `});

  const fill = el('div', { style: `
    height: 100%; background: #5a9e92; border-radius: 6px;
    width: 0%; transition: none;
  `});
  barContainer.appendChild(fill);

  const timeLabel = el('span', { style: `
    font-size: 12px; color: #3d8b7a; min-width: 50px;
    font-variant-numeric: tabular-nums; text-align: right;
    align-self: flex-end;
  `}, '0:00');

  container.appendChild(barContainer);
  container.appendChild(timeLabel);

  // Seek on click/drag
  let seeking = false;
  barContainer.addEventListener('pointerdown', (e) => {
    if (gameState.current !== GameState.FREE) return;
    seeking = true;
    seekFromPointer(e, barContainer);
  });
  barContainer.addEventListener('pointermove', (e) => {
    if (seeking) seekFromPointer(e, barContainer);
  });
  document.addEventListener('pointerup', () => { seeking = false; });

  function seekFromPointer(e: PointerEvent, bar: HTMLElement) {
    const rect = bar.getBoundingClientRect();
    const ratio = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    const newTime = ratio * musicEngine.duration;

    // Stop all instruments and music
    musicEngine.stop();
    for (const inst of instrumentsOnStage) {
      inst.player.stop();
    }

    // Seek to new position
    musicEngine.seek(newTime);

    // Restart music and re-trigger all instruments at new position
    musicEngine.play(newTime);
    const barDuration = 240 / (currentPack?.bpm ?? 120);
    for (const inst of instrumentsOnStage) {
      if (!inst.muted) {
        inst.player.playSynced(barDuration, inst.config.bars);
      }
    }
  }

  // Update on tick
  eventBus.on(Events.MUSIC_TICK, (time: number) => {
    const maxTime = musicEngine.duration;
    const pct = maxTime > 0 ? (time / maxTime) * 100 : 0;
    fill.style.width = `${pct}%`;
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    timeLabel.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
  });

  return container;
}

// ============================================================
// SIDEBAR (right) — vertical colored blocks
// ============================================================

function createSidebar(pack: PackConfig): HTMLElement {
  const container = el('div', { style: `
    width: 56px; display: flex; flex-direction: column;
    flex-shrink: 0; gap: 0;
  `});

  // Home — teal
  const homeBtn = createSidebarBtn('#4db6ac', '🏠', () => {
    musicEngine.stop();
    clearStage();
    showMainMenu();
  });

  // Record — pink
  const recBtn = createSidebarBtn('#e57399', '⏺', () => {
    if (gameState.current === GameState.RECORDING) {
      stopRecording();
    } else if (gameState.current === GameState.FREE) {
      startRecording();
    }
  });

  // Library — purple
  const libBtn = createSidebarBtn('#b39ddb', '📂', () => {
    // TODO: open recordings library
  });

  // Reset — yellow
  const resetBtn = createSidebarBtn('#ffd54f', '🔄', () => {
    clearStage();
  });

  container.appendChild(homeBtn);
  container.appendChild(recBtn);
  container.appendChild(libBtn);
  container.appendChild(resetBtn);

  return container;
}

function createSidebarBtn(color: string, icon: string, onClick: () => void): HTMLElement {
  const btn = el('button', { style: `
    width: 56px; height: 56px; border: none;
    background: ${color}; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; color: white;
    transition: opacity 0.2s;
  ` }, icon);
  btn.addEventListener('click', onClick);
  btn.addEventListener('pointerenter', () => { btn.style.opacity = '0.8'; });
  btn.addEventListener('pointerleave', () => { btn.style.opacity = '1'; });
  return btn;
}

function clearStage(): void {
  for (const inst of [...instrumentsOnStage]) {
    removeFromStage(inst);
  }
  for (const inst of allInstruments.values()) {
    inst.player.stop();
    inst.onStage = false;
    inst.muted = false;
    inst.stageElement?.remove();
    inst.stageElement = null;
  }
}

// ============================================================
// RECORDING
// ============================================================

function startRecording(): void {
  if (!currentPack) return;

  gameState.change(GameState.RECORDING);
  recordingStates = [];
  recordingStartTime = musicEngine.time;
  timesLooped = 0;

  // Save initial state
  saveRecordingState();

  if (instrumentsOnStage.length > 0 && !musicEngine.isPlaying) {
    musicEngine.play();
  }

  eventBus.emit(Events.RECORDING_START);
}

function stopRecording(): void {
  if (gameState.current !== GameState.RECORDING) return;

  gameState.change(GameState.FREE);

  const duration = getElapsedTime();

  // Create recording
  const recording: Recording = {
    name: `${Date.now()}`,
    duration,
    packId: currentPack!.id,
    states: recordingStates,
    usedInstruments: [...new Set(recordingStates.flatMap(s => Object.keys(s.instruments)))],
    createdAt: Date.now(),
  };

  // Auto-save
  recordingStorage.save(currentPack!.id, recording).then(async () => {
    const num = await recordingStorage.getNextNumber(currentPack!.id);
    recording.name = `${num}`;
    await recordingStorage.save(currentPack!.id, recording);
    eventBus.emit(Events.RECORDING_SAVED, recording);
  });

  eventBus.emit(Events.RECORDING_STOP);
}

function saveRecordingState(): void {
  const time = getElapsedTime();
  const instruments: Record<string, InstrumentState> = {};

  for (const inst of allInstruments.values()) {
    instruments[inst.id] = {
      isOnStage: inst.onStage,
      isMuted: inst.muted,
      normalizedPosition: { ...inst.normalizedPosition },
    };
  }

  recordingStates.push({ time, instruments });
}

function getElapsedTime(): number {
  return musicEngine.duration * timesLooped + musicEngine.time;
}

// ============================================================
// POINTER EVENTS (DRAG & DROP)
// ============================================================

function setupPointerEvents(stageArea: HTMLElement): void {
  // Drag from shelf (floating copy follows pointer)
  document.addEventListener('pointermove', (e) => {
    if (!dragSystem.hasDrag(e.pointerId)) return;
    e.preventDefault();

    dragSystem.updateDrag(e.pointerId, e.clientX, e.clientY);
    const drag = dragSystem.getDrag(e.pointerId);
    if (drag && (drag.node as any)._dragCopy) {
      const copy = (drag.node as any)._dragCopy as HTMLElement;
      copy.style.left = `${e.clientX - 30}px`;
      copy.style.top = `${e.clientY - 30}px`;
    }
  });

  // Drop from shelf onto stage
  document.addEventListener('pointerup', (e) => {
    if (!dragSystem.hasDrag(e.pointerId)) return;

    const drag = dragSystem.endDrag(e.pointerId);
    if (!drag) return;

    // Remove drag copy
    if ((drag.node as any)._dragCopy) {
      (drag.node as any)._dragCopy.remove();
    }

    // Check if dropped on stage area
    const rect = stageArea.getBoundingClientRect();
    if (e.clientX >= rect.left && e.clientX <= rect.right &&
        e.clientY >= rect.top && e.clientY <= rect.bottom) {
      placeOnStage(drag.node as InstrumentInstance, e.clientX, e.clientY);
    }
  });

  // Record state on move during recording
  eventBus.on(Events.INSTRUMENT_MOVED, (inst: InstrumentInstance) => {
    if (gameState.current === GameState.RECORDING) {
      saveRecordingState();
    }
  });
}

// ============================================================
// MUSIC SYNC — handled per-instrument by SamplePlayer.playSynced()
// ============================================================

// ============================================================
// INIT
// ============================================================

async function init(): Promise<void> {
  // Wait for first user interaction to unlock AudioContext
  const unlock = async () => {
    document.removeEventListener('pointerdown', unlock);
    document.removeEventListener('keydown', unlock);

    await musicEngine.init();
    splash.classList.add('hidden');
    setTimeout(() => splash.remove(), 500);

    showMainMenu();
  };

  document.addEventListener('pointerdown', unlock);
  document.addEventListener('keydown', unlock);
}

init();
