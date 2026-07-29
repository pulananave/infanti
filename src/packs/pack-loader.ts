import type { PackConfig } from '@/core/types';

const PACK_REGISTRY_KEY = 'infanti_pack_registry';
const packCache: Map<string, PackConfig> = new Map();

function getStoredPackIds(): string[] {
  const reg = localStorage.getItem(PACK_REGISTRY_KEY);
  if (reg) return JSON.parse(reg);
  const builtIn = ['dona-aranha', 'canoa', 'coelho', 'pintinho', 'sapo'];
  localStorage.setItem(PACK_REGISTRY_KEY, JSON.stringify(builtIn));
  return builtIn;
}

export async function loadPack(id: string): Promise<PackConfig> {
  if (packCache.has(id)) {
    return packCache.get(id)!;
  }

  // Check localStorage override first (from editor)
  const stored = localStorage.getItem(`infanti_pack_${id}`);
  if (stored) {
    const pack = JSON.parse(stored);
    packCache.set(id, pack);
    return pack;
  }

  // Fall back to built-in JSON
  const response = await fetch(`/packs/${id}.json`);
  if (!response.ok) {
    throw new Error(`Pack not found: ${id}`);
  }

  const pack: PackConfig = await response.json();
  packCache.set(id, pack);
  return pack;
}

export async function loadAllPacks(): Promise<PackConfig[]> {
  const packIds = getStoredPackIds();
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

export function clearPackCache(): void {
  packCache.clear();
}
