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
  id: string; // "rafog_bombo"
  config: InstrumentConfig;
  characterId: string;
  player: SamplePlayer;
  element: HTMLElement;
  onStage: boolean;
  muted: boolean;
  stageElement: HTMLElement | null;
  normalizedPosition: { x: number; y: number };
  stageX: number;
  stageY: number;
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
    width: 100%; height: 100%; background: #e6e6e6;
    font-family: 'Nunito', sans-serif;
  `});

  // Stage area (top, fills remaining space)
  const stageArea = el('div', { class: 'stage-area', style: `
    flex: 1; position: relative; overflow: hidden;
    background: linear-gradient(180deg, #f0f0f0 0%, #ddd 100%);
  `});

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

  // Control buttons (top-right of stage, stays in place)
  const controls = createControlButtons(pack, stageArea);
  stageArea.appendChild(controls);

  // Character shelf (bottom)
  const shelf = el('div', { style: `
    display: flex; flex-direction: row; align-items: center; justify-content: center;
    background: #c0c0c0; padding: 8px 16px; gap: 16px;
    border-top: 2px solid #aaa; min-height: 100px; flex-shrink: 0;
    overflow-x: auto; position: relative; z-index: 200;
  `});

  for (const charConfig of pack.characters) {
    try {
      const charInstance = await createCharacter(charConfig, stageArea);
      characters.push(charInstance);
      shelf.appendChild(charInstance.element);
    } catch (e) {
      console.warn(`Failed to create character ${charConfig.id}:`, e);
    }
  }

  // Timeline bar (top)
  const timeline = createTimeline();
  stageLayout.appendChild(timeline);
  stageLayout.appendChild(stageArea);
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
    try {
      await player.load(instConfig.audio);
    } catch (e) {
      console.warn(`Failed to load audio for ${instConfig.type}:`, e);
    }

    const inst: InstrumentInstance = {
      id: `${config.id}_${instConfig.type}`,
      config: instConfig,
      characterId: config.id,
      player,
      element: null as any,
      onStage: false,
      muted: false,
      stageElement: null,
      normalizedPosition: { x: 0.5, y: 0.5 },
      stageX: 0,
      stageY: 0,
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

  // Character button with monster icon
  const charBtn = el('div', { style: `
    width: 80px; height: 80px; border-radius: 50%;
    background: #475af3; color: white;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(71,90,243,0.4);
    transition: transform 0.2s;
    overflow: hidden;
  ` });

  const charImg = el('img', {
    src: config.icon,
    style: 'width: 70px; height: 70px; object-fit: contain; pointer-events: none;',
    draggable: 'false',
  });
  charImg.onerror = () => {
    charImg.style.display = 'none';
    charBtn.textContent = config.id.charAt(0).toUpperCase();
    charBtn.style.fontSize = '24px';
    charBtn.style.fontWeight = 'bold';
  };
  charBtn.appendChild(charImg);

  const instrumentBox = el('div', { style: `
    display: none; position: fixed; z-index: 9000;
    background: rgba(255,255,255,0.95); border-radius: 16px;
    padding: 10px; box-shadow: 0 8px 32px rgba(0,0,0,0.15);
    flex-direction: row; gap: 8px;
  ` });

  for (const inst of instruments) {
    const instBtn = el('div', { style: `
      width: 60px; height: 60px; border-radius: 50%;
      background: white; box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      cursor: grab; display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 2px; font-size: 9px; color: #333;
    `});

    const img = el('img', {
      src: inst.config.icon,
      style: 'width: 32px; height: 32px; object-fit: contain; pointer-events: none;',
      draggable: 'false',
    });
    img.onerror = () => { img.style.display = 'none'; };
    instBtn.appendChild(img);
    instBtn.appendChild(el('span', { style: 'pointer-events: none; text-align: center; max-width: 55px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;' }, inst.config.name));

    // Drag start on pointerdown
    instBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();

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

  // Mute button
  const muteBtn = el('div', { style: `
    position: absolute; top: -5px; right: -5px; width: 22px; height: 22px;
    border-radius: 50%; background: #ff4444; color: white;
    display: none; align-items: center; justify-content: center;
    font-size: 12px; cursor: pointer;
  ` }, '🔇');
  stageEl.appendChild(muteBtn);

  // Double tap to mute
  let lastTap = 0;
  stageEl.addEventListener('pointerdown', (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      e.stopPropagation();
      toggleMute(inst);
    }
    lastTap = now;
  });

  inst.stageElement = stageEl;
  stageArea.appendChild(stageEl);

  // Apply position effects (volume, pan, scale)
  applyPositionEffects(inst);

  // Start playing synced to current music progress
  inst.player.playSynced(musicEngine.time);

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
    const muteBtn = inst.stageElement.querySelector('div') as HTMLElement;
    if (muteBtn) muteBtn.style.display = inst.muted ? 'flex' : 'none';
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
    height: 40px; background: rgba(0,0,0,0.08);
    display: flex; align-items: center; padding: 0 15px; gap: 10px;
    flex-shrink: 0; border-bottom: 1px solid rgba(0,0,0,0.1);
  `});

  const timeLabel = el('span', { style: 'font-size: 14px; color: #666; min-width: 60px; font-variant-numeric: tabular-nums;' }, '0:00');

  const barContainer = el('div', { style: `
    flex: 1; height: 20px; background: rgba(0,0,0,0.1); border-radius: 10px;
    overflow: hidden; cursor: pointer; position: relative;
  `});

  const fill = el('div', { style: `
    height: 100%; background: #475af3; border-radius: 10px;
    width: 0%; transition: none;
  `});
  barContainer.appendChild(fill);

  container.appendChild(timeLabel);
  container.appendChild(barContainer);

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
    musicEngine.seek(ratio * musicEngine.duration);
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
// CONTROL BUTTONS
// ============================================================

function createControlButtons(pack: PackConfig, stageArea: HTMLElement): HTMLElement {
  const container = el('div', { style: `
    position: absolute; top: 10px; right: 10px;
    display: flex; gap: 10px; z-index: 50;
  `});

  // Home button
  const homeBtn = createButton('🏠', () => {
    musicEngine.stop();
    clearStage();
    showMainMenu();
  });

  // Record button
  const recBtn = createButton('🔴', () => {
    if (gameState.current === GameState.RECORDING) {
      stopRecording();
    } else if (gameState.current === GameState.FREE) {
      startRecording();
    }
  });
  recBtn.style.background = '#ff4444';

  // Clear button
  const clearBtn = createButton('🗑️', () => {
    clearStage();
  });

  container.appendChild(homeBtn);
  container.appendChild(recBtn);
  container.appendChild(clearBtn);

  return container;
}

function createButton(emoji: string, onClick: () => void): HTMLElement {
  const btn = el('button', { style: `
    width: 50px; height: 50px; border-radius: 50%;
    border: none; background: rgba(0,0,0,0.2);
    font-size: 24px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s;
  ` }, emoji);
  btn.addEventListener('click', onClick);
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
  document.addEventListener('pointermove', (e) => {
    if (!dragSystem.hasDrag(e.pointerId)) return;
    e.preventDefault();

    const drag = dragSystem.getDrag(e.pointerId);

    // If dragging an instrument already on stage, move its DOM element
    if (drag && (drag.node as any)._onStageDrag) {
      const inst = drag.node as unknown as InstrumentInstance;
      const stageEl = inst.stageElement;
      const area = (drag.node as any)._stageArea as HTMLElement;
      if (stageEl && area) {
        const rect = area.getBoundingClientRect();
        const localX = clamp(e.clientX - rect.left, 0, rect.width);
        const localY = clamp(e.clientY - rect.top, 0, rect.height);
        stageEl.style.left = `${localX}px`;
        stageEl.style.top = `${localY}px`;
      }
      return;
    }

    // Normal drag (from shelf) — move the floating copy
    dragSystem.updateDrag(e.pointerId, e.clientX, e.clientY);
    if (drag && (drag.node as any)._dragCopy) {
      const copy = (drag.node as any)._dragCopy as HTMLElement;
      copy.style.left = `${e.clientX - 30}px`;
      copy.style.top = `${e.clientY - 30}px`;
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (!dragSystem.hasDrag(e.pointerId)) return;

    const drag = dragSystem.getDrag(e.pointerId);
    if (!drag) return;

    // If was dragging on stage — update position
    if ((drag.node as any)._onStageDrag) {
      const inst = drag.node as unknown as InstrumentInstance;
      const area = (drag.node as any)._stageArea as HTMLElement;
      if (area) {
        const rect = area.getBoundingClientRect();
        const localX = clamp(e.clientX - rect.left, 0, rect.width);
        const localY = clamp(e.clientY - rect.top, 0, rect.height);
        inst.stageX = localX;
        inst.stageY = localY;
        inst.normalizedPosition = {
          x: localX / rect.width,
          y: localY / rect.height,
        };
        applyPositionEffects(inst);
        eventBus.emit(Events.INSTRUMENT_MOVED, inst);
      }
      dragSystem.endDrag(e.pointerId);
      return;
    }

    // Normal drag end (from shelf)
    dragSystem.endDrag(e.pointerId);

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

  // Drag instruments already on stage
  stageArea.addEventListener('pointerdown', (e) => {
    const target = e.target as HTMLElement;
    const stageEl = target.closest('[data-instrument-id]') as HTMLElement;
    if (!stageEl) return;

    const instId = stageEl.getAttribute('data-instrument-id');
    const inst = allInstruments.get(instId!);
    if (!inst || !inst.onStage) return;

    e.preventDefault();
    e.stopPropagation();

    const rect = stageArea.getBoundingClientRect();
    const offsetX = e.clientX - (rect.left + inst.stageX);
    const offsetY = e.clientY - (rect.top + inst.stageY);

    dragSystem.startDrag(
      e.pointerId,
      { ...inst, _onStageDrag: true, _stageArea: stageArea, _offsetX: offsetX, _offsetY: offsetY },
      'stage',
      -offsetX,
      -offsetY,
      e.clientX,
      e.clientY
    );
  });

  // Record state on move during recording
  eventBus.on(Events.INSTRUMENT_MOVED, (inst: InstrumentInstance) => {
    if (gameState.current === GameState.RECORDING) {
      saveRecordingState();
    }
  });
}

// ============================================================
// MUSIC SYNC
// ============================================================

eventBus.on(Events.MUSIC_BAR, (barNumber: number) => {
  // Ensure all stage instruments are playing in sync
  for (const inst of instrumentsOnStage) {
    if (!inst.muted && !inst.player.isPlaying) {
      inst.player.play();
    }
  }
});

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
