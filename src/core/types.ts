export interface InstrumentConfig {
  type: string;
  name: string;
  icon: string;
  sprite?: string;
  audio: string;
  bars: number;
  minVolumeDb: number;
  maxVolumeDb: number;
  useLimit: number;
  pivotX?: number; // 0-100, default 50
  pivotY?: number; // 0-100, default 100
}

export interface CharacterConfig {
  id: string;
  icon: string;
  iconActive: string;
  boxDirection: 'left' | 'middle' | 'right';
  instruments: InstrumentConfig[];
}

export interface PackConfig {
  id: string;
  name: string;
  bpm: number;
  bars: number;
  loops: number;
  cover: string;
  characters: CharacterConfig[];
}
