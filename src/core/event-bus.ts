type EventCallback = (...args: any[]) => void;

class EventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  off(event: string, callback: EventCallback): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, ...args: any[]): void {
    this.listeners.get(event)?.forEach(cb => cb(...args));
  }

  clear(): void {
    this.listeners.clear();
  }
}

export const eventBus = new EventBus();

// Event names
export const Events = {
  // Scene
  SCENE_CHANGE_REQUESTED: 'scene:change_requested',
  SCENE_CHANGED: 'scene:changed',

  // Character
  CHARACTER_SELECTED: 'character:selected',
  CHARACTER_DESELECTED: 'character:deselected',

  // Instrument
  INSTRUMENT_ADDED: 'instrument:added',
  INSTRUMENT_REMOVED: 'instrument:removed',
  INSTRUMENT_MOVED: 'instrument:moved',
  INSTRUMENT_MUTE_TOGGLED: 'instrument:mute_toggled',

  // Stage
  STAGE_FIRST_INSTRUMENT: 'stage:first_instrument',
  STAGE_EMPTY: 'stage:empty',
  STAGE_FULL: 'stage:full',
  STAGE_AVAILABLE: 'stage:available',

  // Recording
  RECORDING_START: 'recording:start',
  RECORDING_STOP: 'recording:stop',
  RECORDING_SAVED: 'recording:saved',
  RECORD_PLAY_REQUESTED: 'record:play_requested',
  RECORD_EJECT_REQUESTED: 'record:eject_requested',
  CLEAR_REQUESTED: 'clear:requested',

  // Music
  MUSIC_BAR: 'music:bar',
  MUSIC_LOOPED: 'music:looped',
  MUSIC_PLAYING_CHANGED: 'music:playing_changed',
  MUSIC_TICK: 'music:tick',
} as const;
