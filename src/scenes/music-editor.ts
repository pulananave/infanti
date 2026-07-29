import type { PackConfig, CharacterConfig, InstrumentConfig } from '@/core/types';
import { openInstrumentEditor } from '@/scenes/instrument-preview';

/**
 * Music Editor — full CRUD for packs, characters, instruments.
 * Renders as a full-screen overlay.
 */

const CHAR_IDS = ['boogar', 'ceval', 'dan', 'esper', 'gobu', 'grompy', 'ohle', 'rafog', 'teewong', 'zoem'];
const CHAR_NAMES: Record<string, string> = {
  boogar: 'Boogar', ceval: 'Ceval', dan: 'Dan', esper: 'Esper',
  gobu: 'Gobu', grompy: 'Grompy', ohle: 'Ohle', rafog: 'Rafog',
  teewong: 'Teewong', zoem: 'Zoem',
};

export function openEditor(onClose: () => void): void {
  const overlay = el('div', { style: `
    position: fixed; inset: 0; z-index: 99999;
    background: #1a1a2e; color: #eee;
    font-family: 'Nunito', sans-serif; font-size: 14px;
    overflow-y: auto; padding: 20px;
  `});

  const header = el('div', { style: `
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 20px; border-bottom: 2px solid #333; padding-bottom: 10px;
  `});
  header.appendChild(el('h1', { style: 'margin:0; font-size:24px; color:#f5e642;' }, '🎵 Editor de Músicas'));

  const btnRow = el('div', { style: 'display:flex; gap:10px;' });
  const newBtn = mkBtn('+ Nova Música', '#4caf50', () => editPack(null, overlay, refresh));
  const closeBtn = mkBtn('✕ Fechar', '#e53935', () => { overlay.remove(); onClose(); });
  btnRow.appendChild(newBtn);
  btnRow.appendChild(closeBtn);
  header.appendChild(btnRow);
  overlay.appendChild(header);

  const list = el('div', { style: 'display:flex; flex-direction:column; gap:12px;' });
  overlay.appendChild(list);

  document.body.appendChild(overlay);

  async function refresh() {
    list.innerHTML = '';
    const packIds = await getStoredPackIds();
    if (packIds.length === 0) {
      list.appendChild(el('p', { style: 'color:#888;' }, 'Nenhuma música. Clique "+ Nova Música" para criar.'));
      return;
    }
    for (const id of packIds) {
      const data = await loadPackData(id);
      if (!data) continue;
      list.appendChild(packCard(data, overlay, refresh));
    }
  }

  refresh();
}

function packCard(pack: PackConfig, overlay: HTMLElement, refresh: () => void): HTMLElement {
  const card = el('div', { style: `
    background: #16213e; border-radius: 12px; padding: 16px;
    display: flex; justify-content: space-between; align-items: center;
    border: 1px solid #333;
  `});

  const info = el('div', { style: 'display:flex; align-items:center; gap:16px;' });
  if (pack.cover) {
    const img = el('img', { src: pack.cover, style: 'width:60px;height:60px;border-radius:8px;object-fit:cover;' });
    img.onerror = () => { img.style.display = 'none'; };
    info.appendChild(img);
  }
  const meta = el('div');
  meta.appendChild(el('div', { style: 'font-size:18px;font-weight:bold;color:#f5e642;' }, pack.name));
  meta.appendChild(el('div', { style: 'color:#aaa;font-size:12px;' },
    `${pack.bpm} BPM · ${pack.bars} compassos · ${pack.characters?.length || 0} monstros`));
  info.appendChild(meta);
  card.appendChild(info);

  const actions = el('div', { style: 'display:flex;gap:8px;' });
  actions.appendChild(mkBtn('✏️ Editar', '#2196f3', () => editPack(pack, overlay, refresh)));
  actions.appendChild(mkBtn('🗑️ Apagar', '#e53935', () => deletePack(pack.id, refresh)));
  card.appendChild(actions);

  return card;
}

// ============================================================
// EDIT FORM
// ============================================================

function editPack(pack: PackConfig | null, overlay: HTMLElement, refresh: () => void): void {
  const isNew = !pack;
  const data: PackConfig = pack ? JSON.parse(JSON.stringify(pack)) : {
    id: '', name: '', bpm: 120, bars: 16, loops: 2,
    cover: '', characters: [],
  };

  if (isNew) {
    data.id = 'nova-musica-' + Date.now();
    data.characters = CHAR_IDS.map(id => ({
      id, icon: '', iconActive: '', boxDirection: 'right' as const,
      instruments: [],
    }));
  }

  const form = el('div', { style: `
    position: fixed; inset: 0; z-index: 100000;
    background: #0f3460; color: #eee;
    font-family: 'Nunito', sans-serif; font-size: 14px;
    overflow-y: auto; padding: 20px;
  `});

  // Header
  const fh = el('div', { style: 'display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;border-bottom:2px solid #333;padding-bottom:10px;' });
  fh.appendChild(el('h2', { style: 'margin:0;color:#f5e642;' }, isNew ? '+ Nova Música' : `✏️ ${data.name}`));
  const fhBtns = el('div', { style: 'display:flex;gap:10px;' });
  fhBtns.appendChild(mkBtn('💾 Salvar', '#4caf50', async () => {
    await savePackData(data);
    form.remove();
    refresh();
  }));
  fhBtns.appendChild(mkBtn('✕ Cancelar', '#666', () => form.remove()));
  fh.appendChild(fhBtns);
  form.appendChild(fh);

  // Metadata section
  const metaSection = section('Metadados');
  metaSection.appendChild(fieldRow('ID', data.id, v => data.id = v, isNew));
  metaSection.appendChild(fieldRow('Nome', data.name, v => data.name = v));
  metaSection.appendChild(fieldRow('BPM', String(data.bpm), v => data.bpm = Number(v), false, 'number'));
  metaSection.appendChild(fieldRow('Compassos', String(data.bars), v => data.bars = Number(v), false, 'number'));
  metaSection.appendChild(fieldRow('Loops', String(data.loops), v => data.loops = Number(v), false, 'number'));
  metaSection.appendChild(fieldRow('Capa (URL)', data.cover, v => data.cover = v));
  form.appendChild(metaSection);

  // Characters section
  for (const char of data.characters) {
    const charSection = section(`🎭 ${CHAR_NAMES[char.id] || char.id}`);
    charSection.appendChild(fieldRow('Box Direction', char.boxDirection, v => char.boxDirection = v as any));

    // Instruments list
    const instList = el('div', { style: 'display:flex;flex-direction:column;gap:8px;margin-top:8px;' });
    const refreshInstruments = () => {
      instList.innerHTML = '';
      for (let i = 0; i < char.instruments.length; i++) {
        instList.appendChild(instrumentRow(char, i, refreshInstruments));
      }
    };
    refreshInstruments();
    charSection.appendChild(instList);

    charSection.appendChild(mkBtn('+ Instrumento', '#4caf50', () => {
      char.instruments.push({
        type: '', name: '', icon: '', sprite: '', audio: '',
        bars: 1, minVolumeDb: -20, maxVolumeDb: 0, useLimit: 0,
      });
      refreshInstruments();
    }, 'margin-top:8px;'));

    form.appendChild(charSection);
  }

  overlay.appendChild(form);
}

function instrumentRow(char: CharacterConfig, index: number, refresh: () => void): HTMLElement {
  const inst = char.instruments[index];

  const card = el('div', { style: `
    background: #1a1a3e; border-radius: 10px; padding: 12px;
    display: flex; gap: 12px; align-items: center;
    border: 1px solid #333; cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
  `});

  // Icon/thumbnail
  const thumb = el('div', { style: `
    width: 56px; height: 56px; border-radius: 8px;
    background: #0f3460; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; overflow: hidden;
  `});
  if (inst.icon) {
    const img = el('img', { src: inst.icon, style: 'width:40px;height:40px;object-fit:contain;' });
    img.onerror = () => { img.style.display = 'none'; };
    thumb.appendChild(img);
  } else {
    thumb.appendChild(el('span', { style: 'font-size:24px;' }, '🎵'));
  }
  card.appendChild(thumb);

  // Info
  const info = el('div', { style: 'flex:1;min-width:0;' });
  info.appendChild(el('div', { style: 'font-weight:bold;font-size:14px;color:#f5e642;' }, inst.name || inst.type || 'Sem nome'));
  info.appendChild(el('div', { style: 'font-size:11px;color:#aaa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' },
    `${inst.type} · ${inst.bars} compass · ${inst.audio ? '🔊' : '🔇'}`));
  if (inst.sprite) info.appendChild(el('div', { style: 'font-size:10px;color:#6a6;' }, '🎬 spritesheet'));
  card.appendChild(info);

  // Actions
  const actions = el('div', { style: 'display:flex;flex-direction:column;gap:4px;flex-shrink:0;' });
  actions.appendChild(mkBtn('👁️ Preview', '#2196f3', () => {
    openInstrumentEditor(inst, char.id, (updated) => {
      char.instruments[index] = updated;
      refresh();
    });
  }));
  actions.appendChild(mkBtn('🗑️', '#e53935', () => {
    char.instruments.splice(index, 1);
    refresh();
  }));
  card.appendChild(actions);

  // Hover
  card.addEventListener('pointerenter', () => { card.style.borderColor = '#f5e642'; card.style.background = '#1f2a50'; });
  card.addEventListener('pointerleave', () => { card.style.borderColor = '#333'; card.style.background = '#1a1a3e'; });

  return card;
}

// ============================================================
// STORAGE (localStorage-based pack registry + file data)
// ============================================================

const PACK_REGISTRY_KEY = 'infanti_pack_registry';

async function getStoredPackIds(): Promise<string[]> {
  const reg = localStorage.getItem(PACK_REGISTRY_KEY);
  if (reg) return JSON.parse(reg);

  // Bootstrap from built-in packs
  const builtIn = ['dona-aranha', 'canoa', 'coelho', 'pintinho', 'sapo'];
  localStorage.setItem(PACK_REGISTRY_KEY, JSON.stringify(builtIn));
  return builtIn;
}

async function loadPackData(id: string): Promise<PackConfig | null> {
  // Check localStorage override first
  const stored = localStorage.getItem(`infanti_pack_${id}`);
  if (stored) return JSON.parse(stored);

  // Fall back to built-in JSON
  try {
    const resp = await fetch(`/packs/${id}.json`);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

async function savePackData(data: PackConfig): Promise<void> {
  // Save to localStorage
  localStorage.setItem(`infanti_pack_${data.id}`, JSON.stringify(data));

  // Register in pack list
  const ids = await getStoredPackIds();
  if (!ids.includes(data.id)) {
    ids.push(data.id);
    localStorage.setItem(PACK_REGISTRY_KEY, JSON.stringify(ids));
  }
}

async function deletePack(id: string, refresh: () => void): Promise<void> {
  if (!confirm(`Apagar "${id}"? Esta ação não pode ser desfeita.`)) return;
  localStorage.removeItem(`infanti_pack_${id}`);
  const ids = await getStoredPackIds();
  localStorage.setItem(PACK_REGISTRY_KEY, JSON.stringify(ids.filter(i => i !== id)));
  refresh();
}

// ============================================================
// UI HELPERS
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

function mkBtn(text: string, color: string, onClick: () => void, extraStyle: string = ''): HTMLElement {
  const btn = el('button', { style: `
    background: ${color}; color: white; border: none; border-radius: 6px;
    padding: 6px 14px; cursor: pointer; font-size: 13px; font-weight: bold;
    font-family: inherit; ${extraStyle}
  ` }, text);
  btn.addEventListener('click', onClick);
  return btn;
}

function section(title: string): HTMLElement {
  const s = el('div', { style: `
    background: #16213e; border-radius: 12px; padding: 16px;
    margin-bottom: 16px; border: 1px solid #333;
  ` });
  s.appendChild(el('h3', { style: 'margin:0 0 10px 0;color:#f5e642;font-size:16px;' }, title));
  return s;
}

function fieldRow(label: string, value: string, onChange: (v: string) => void, disabled: boolean = false, type: string = 'text'): HTMLElement {
  const row = el('div', { style: 'display:flex;align-items:center;gap:8px;margin-bottom:4px;' });
  row.appendChild(el('label', { style: 'min-width:120px;color:#aaa;font-size:12px;' }, label));
  const input = el('input', {
    style: `flex:1;background:#0f3460;border:1px solid #444;border-radius:4px;
      padding:4px 8px;color:#eee;font-size:13px;font-family:inherit;
      ${disabled ? 'opacity:0.5;cursor:not-allowed;' : ''}`,
  }) as HTMLInputElement;
  input.type = type;
  input.value = value;
  if (disabled) input.disabled = true;
  input.addEventListener('change', () => onChange(input.value));
  input.addEventListener('input', () => onChange(input.value));
  row.appendChild(input);
  return row;
}
