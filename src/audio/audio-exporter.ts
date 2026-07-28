import { SamplePlayer, loadAudio } from './sample-player';
import type { Recording, StateSnapshot } from '@/recording/recording';
import type { PackConfig, InstrumentConfig } from '@/core/types';

function encodeWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  let interleaved: Float32Array;
  if (numChannels === 2) {
    const left = buffer.getChannelData(0);
    const right = buffer.getChannelData(1);
    interleaved = new Float32Array(left.length * 2);
    for (let i = 0; i < left.length; i++) {
      interleaved[i * 2] = left[i];
      interleaved[i * 2 + 1] = right[i];
    }
  } else {
    interleaved = buffer.getChannelData(0);
  }

  const dataLength = interleaved.length * (bitDepth / 8);
  const headerLength = 44;
  const totalLength = headerLength + dataLength;
  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  // WAV header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(view, 8, 'WAVE');
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // chunk size
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
  view.setUint16(32, numChannels * (bitDepth / 8), true);
  view.setUint16(34, bitDepth, true);
  writeString(view, 36, 'data');
  view.setUint32(40, dataLength, true);

  // Write samples
  let offset = 44;
  for (let i = 0; i < interleaved.length; i++) {
    const sample = Math.max(-1, Math.min(1, interleaved[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
    offset += 2;
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export async function exportRecordingWav(
  recording: Recording,
  pack: PackConfig
): Promise<Blob> {
  // First pass: load all audio buffers needed
  const instrumentMap = new Map<string, InstrumentConfig>();
  for (const char of pack.characters) {
    for (const inst of char.instruments) {
      instrumentMap.set(`${char.id}_${inst.type}`, inst);
    }
  }

  // Pre-load all audio files
  for (const inst of instrumentMap.values()) {
    await loadAudio(inst.audio);
  }

  // Create offline context
  const sampleRate = 44100;
  const durationSec = recording.duration;
  const offlineCtx = new OfflineAudioContext(
    2,
    Math.ceil(durationSec * sampleRate),
    sampleRate
  );

  // Schedule all instrument states
  const sortedStates = [...recording.states].sort((a, b) => a.time - b.time);

  for (let i = 0; i < sortedStates.length; i++) {
    const state = sortedStates[i];
    const nextState = sortedStates[i + 1];
    const segmentDuration = nextState
      ? nextState.time - state.time
      : durationSec - state.time;

    for (const [instKey, instState] of Object.entries(state.instruments)) {
      if (!instState.isOnStage) continue;

      const instConfig = instrumentMap.get(instKey);
      if (!instConfig) continue;

      try {
        const response = await fetch(instConfig.audio);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await offlineCtx.decodeAudioData(arrayBuffer);

        const source = offlineCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.loop = true;

        // Apply volume based on normalized position
        const gainNode = offlineCtx.createGain();
        const volumeDb = instConfig.minVolumeDb +
          (instState.normalizedPosition.y * (instConfig.maxVolumeDb - instConfig.minVolumeDb));
        const gainValue = Math.pow(10, volumeDb / 20);
        gainNode.gain.value = instState.isMuted ? 0 : gainValue;

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        source.start(state.time);
        source.stop(state.time + segmentDuration);
      } catch {
        // Skip instrument if audio fails to load
      }
    }
  }

  const renderedBuffer = await offlineCtx.startRendering();
  return encodeWav(renderedBuffer);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
