export interface InstrumentState {
  isOnStage: boolean;
  isMuted: boolean;
  normalizedPosition: { x: number; y: number };
}

export interface StateSnapshot {
  time: number;
  instruments: Record<string, InstrumentState>;
}

export interface Recording {
  name: string;
  duration: number;
  packId: string;
  states: StateSnapshot[];
  usedInstruments: string[];
  createdAt: number;
}
