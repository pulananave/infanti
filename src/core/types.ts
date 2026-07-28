export interface InstrumentConfig {
  type: string;
  name: string;
  icon: string;
  audio: string;
  bars: number;
  minVolumeDb: number;
  maxVolumeDb: number;
  useLimit: number;
}

export interface CharacterConfig {
  id: string;
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
