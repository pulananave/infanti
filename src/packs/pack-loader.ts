import type { PackConfig } from '@/core/types';

const packCache: Map<string, PackConfig> = new Map();

export async function loadPack(id: string): Promise<PackConfig> {
  if (packCache.has(id)) {
    return packCache.get(id)!;
  }

  const response = await fetch(`/packs/${id}.json`);
  if (!response.ok) {
    throw new Error(`Pack not found: ${id}`);
  }

  const pack: PackConfig = await response.json();
  packCache.set(id, pack);
  return pack;
}

export async function loadAllPacks(): Promise<PackConfig[]> {
  // Known pack IDs — in production, this could come from a manifest
  const packIds = [
    'dona-aranha',
    'sapo',
    'pintinho',
    'canoa',
    'coelho',
  ];

  const packs: PackConfig[] = [];
  for (const id of packIds) {
    try {
      const pack = await loadPack(id);
      packs.push(pack);
    } catch {
      console.warn(`Failed to load pack: ${id}`);
    }
  }

  return packs;
}
