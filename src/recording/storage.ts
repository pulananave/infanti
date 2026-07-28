import Dexie, { type Table } from 'dexie';
import type { Recording } from './recording';

interface StoredRecording {
  id?: number;
  packId: string;
  name: string;
  data: Recording;
}

class RecordingDB extends Dexie {
  recordings!: Table<StoredRecording>;

  constructor() {
    super('infanti-recordings');
    this.version(1).stores({
      recordings: '++id, packId, name',
    });
  }
}

const db = new RecordingDB();

export const recordingStorage = {
  async save(packId: string, recording: Recording): Promise<void> {
    await db.recordings.add({
      packId,
      name: recording.name,
      data: recording,
    });
  },

  async getAll(packId: string): Promise<Recording[]> {
    const records = await db.recordings
      .where('packId')
      .equals(packId)
      .toArray();
    return records.map(r => r.data);
  },

  async delete(packId: string, name: string): Promise<void> {
    await db.recordings
      .where({ packId, name })
      .delete();
  },

  async getNextNumber(packId: string): Promise<number> {
    const records = await db.recordings
      .where('packId')
      .equals(packId)
      .toArray();
    return records.length + 1;
  },
};
