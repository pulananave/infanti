import type { PackConfig, CharacterConfig, InstrumentConfig } from '@/core/types';
import { SpriteAnimation } from '@/ui/sprite-animation';

/**
 * Visual editor for instrument preview, pivot positioning, and audio playback.
 */

// ============================================================
// OPEN INSTRUMENT EDITOR
// ============================================================

export function openInstrumentEditor(
  inst: InstrumentConfig,
  charId: string,
  onUpdate: (updated: InstrumentConfig) => void
): void {
  const overlay = el('div', { style: `
    position: fixed; inset: 0; z-index: 100001;
    background: #0a0a1a; color: #eee;
    font-family: 'Nunito', sans-serif; font-size: 14px;
    display: flex; flex-direction: column;
    overflow: hidden;
  `});

  // Header
  const header = el('div', { style: `
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 20px; background: #16213e; border-bottom: 2px solid #333;
    flex-shrink: 0;
  `});
  header.appendChild(el('h2', { style: 'margin:0;color:#f5e642;font-size:18px;' },
    `🎵 ${inst.name || 'Novo Instrumento'} — ${charId}`));

  const headerBtns = el('div', { style: 'display:flex;gap:10px;' });
  headerBtns.appendChild(mkBtn('💾 Salvar', '#4caf50', () => {
    onUpdate({ ...inst });
    overlay.remove();
  }));
  headerBtns.appendChild(mkBtn('✕ Fechar', '#666', () => overlay.remove()));
  header.appendChild(headerBtns);
  overlay.appendChild(header);

  // Body: 3-column layout
  const body = el('div', { style: `
    display: grid; grid-template-columns: 1fr 300px 300px;
    flex: 1; overflow: hidden;
  `});

  // Column 1: Preview area
  body.appendChild(createPreviewPanel(inst));

  // Column 2: Fields
  body.appendChild(createFieldsPanel(inst, onUpdate));

  // Column 3: Audio preview + pivot
  body.appendChild(createAudioPanel(inst));

  overlay.appendChild(body);
  document.body.appendChild(overlay);
}

// ============================================================
// PREVIEW PANEL (left)
// ============================================================

function createPreviewPanel(inst: InstrumentConfig): HTMLElement {
  const panel = el('div', { style: `
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; background: #111; position: relative;
    overflow: hidden;
  `});

  const stageBg = el('div', { style: `
    width: 100%; height: 100%;
    background: url('assets/images/stage-bg.jpg') center/cover no-repeat;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 40px;
  `});

  const charContainer = el('div', { style: `
    position: relative; display: flex; align-items: flex-end; justify-content: center;
  `});

  // Sprite animation or static icon
  const animCanvas = el('canvas', { style: 'display:block;' }) as HTMLCanvasElement;
  const staticImg = el('img', { style: 'max-width:200px;max-height:300px;object-fit:contain;display:none;' }) as HTMLImageElement;
  charContainer.appendChild(animCanvas);
  charContainer.appendChild(staticImg);

  // Pivot crosshair overlay
  const crosshair = el('div', { style: `
    position: absolute; width: 20px; height: 20px;
    border: 2px solid #ff0; border-radius: 50%;
    pointer-events: none; display: none;
    transform: translate(-50%, -50%);
  `});
  const crossLineH = el('div', { style: `
    position: absolute; width: 30px; height: 2px;
    background: #ff0; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  `});
  const crossLineV = el('div', { style: `
    position: absolute; width: 2px; height: 30px;
    background: #ff0; top: 50%; left: 50%;
    transform: translate(-50%, -50%);
  `});
  crosshair.appendChild(crossLineH);
  crosshair.appendChild(crossLineV);
  charContainer.appendChild(crosshair);

  stageBg.appendChild(charContainer);
  panel.appendChild(stageBg);

  // Load sprite or icon
  let currentAnim: SpriteAnimation | null = null;

  const loadPreview = () => {
    if (currentAnim) { currentAnim.stop(); currentAnim = null; }

    if (inst.sprite) {
      currentAnim = new SpriteAnimation();
      animCanvas.style.display = 'block';
      staticImg.style.display = 'none';
      currentAnim.load(inst.sprite).then(() => {
        currentAnim!.setFps(12);
        currentAnim!.play();
        // Replace canvas element
        charContainer.insertBefore(currentAnim!.canvas, crosshair);
        animCanvas.style.display = 'none';
        crosshair.style.display = 'block';
        updatePivot(currentAnim!.canvas, crosshair, inst);
      }).catch(() => {
        animCanvas.style.display = 'none';
        showFallback();
      });
    } else if (inst.icon) {
      animCanvas.style.display = 'none';
      staticImg.src = inst.icon;
      staticImg.style.display = 'block';
      staticImg.onload = () => {
        crosshair.style.display = 'block';
        updatePivot(staticImg, crosshair, inst);
      };
      staticImg.onerror = () => showFallback();
    } else {
      showFallback();
    }
  };

  const showFallback = () => {
    animCanvas.style.display = 'none';
    staticImg.style.display = 'none';
    charContainer.appendChild(el('div', { style: 'color:#666;font-size:48px;' }, '🎵'));
  };

  // Store loadPreview for external access
  (panel as any)._loadPreview = loadPreview;
  (panel as any)._anim = () => currentAnim;
  (panel as any)._crosshair = crosshair;

  // Load on creation
  setTimeout(loadPreview, 100);

  return panel;
}

function updatePivot(targetEl: HTMLElement, crosshair: HTMLElement, inst: InstrumentConfig): void {
  // Default pivot at center-bottom
  const rect = targetEl.getBoundingClientRect();
  const parentRect = targetEl.parentElement!.getBoundingClientRect();
  const cx = targetEl.offsetLeft + targetEl.offsetWidth / 2;
  const cy = targetEl.offsetTop + targetEl.offsetHeight;
  crosshair.style.left = `${cx}px`;
  crosshair.style.top = `${cy}px`;
}

// ============================================================
// FIELDS PANEL (middle)
// ============================================================

function createFieldsPanel(inst: InstrumentConfig, onUpdate: (u: InstrumentConfig) => void): HTMLElement {
  const panel = el('div', { style: `
    background: #16213e; padding: 16px; overflow-y: auto;
    border-left: 1px solid #333;
  `});

  panel.appendChild(el('h3', { style: 'margin:0 0 12px;color:#f5e642;' }, 'Configurações'));

  panel.appendChild(fileField('Tipo', inst.type, v => inst.type = v));
  panel.appendChild(fileField('Nome', inst.name, v => inst.name = v));
  panel.appendChild(fileField('Ícone (URL)', inst.icon, v => inst.icon = v, true, 'image/*'));
  panel.appendChild(fileField('Spritesheet (tpsheet)', inst.sprite || '', v => inst.sprite = v || undefined, true, '.tpsheet,.json'));
  panel.appendChild(fileField('Áudio (URL)', inst.audio, v => inst.audio = v, true, 'audio/*'));
  panel.appendChild(numberField('Compassos', inst.bars, v => inst.bars = v));
  panel.appendChild(numberField('Volume Min (dB)', inst.minVolumeDb, v => inst.minVolumeDb = v));
  panel.appendChild(numberField('Volume Max (dB)', inst.maxVolumeDb, v => inst.maxVolumeDb = v));

  return panel;
}

// ============================================================
// AUDIO + PIVOT PANEL (right)
// ============================================================

function createAudioPanel(inst: InstrumentConfig): HTMLElement {
  const panel = el('div', { style: `
    background: #1a1a3e; padding: 16px; overflow-y: auto;
    border-left: 1px solid #333; display: flex; flex-direction: column; gap: 16px;
  `});

  // Audio preview section
  const audioSection = el('div', { style: `
    background: #0f3460; border-radius: 10px; padding: 14px;
  `});
  audioSection.appendChild(el('h4', { style: 'margin:0 0 10px;color:#f5e642;' }, '🔊 Preview Áudio'));

  let audioEl: HTMLAudioElement | null = null;

  const playBtn = mkBtn('▶️ Play', '#4caf50', () => {
    if (!inst.audio) return;
    if (!audioEl) {
      audioEl = new Audio(inst.audio);
      audioEl.addEventListener('ended', () => {
        playBtn.textContent = '▶️ Play';
      });
    }
    if (audioEl.paused) {
      audioEl.currentTime = 0;
      audioEl.play();
      playBtn.textContent = '⏸ Pause';
    } else {
      audioEl.pause();
      playBtn.textContent = '▶️ Play';
    }
  });
  playBtn.style.width = '100%';
  playBtn.style.padding = '10px';
  playBtn.style.fontSize = '16px';
  audioSection.appendChild(playBtn);

  const stopBtn = mkBtn('⏹ Stop', '#e53935', () => {
    if (audioEl) {
      audioEl.pause();
      audioEl.currentTime = 0;
      playBtn.textContent = '▶️ Play';
    }
  });
  stopBtn.style.width = '100%';
  audioSection.appendChild(stopBtn);

  // Audio info
  const audioInfo = el('div', { style: 'color:#888;font-size:11px;margin-top:8px;word-break:break-all;' },
    inst.audio || 'Nenhum áudio selecionado');
  audioSection.appendChild(audioInfo);
  panel.appendChild(audioSection);

  // Pivot section
  const pivotSection = el('div', { style: `
    background: #0f3460; border-radius: 10px; padding: 14px;
  `});
  pivotSection.appendChild(el('h4', { style: 'margin:0 0 10px;color:#f5e642;' }, '📌 Pivot Point'));

  pivotSection.appendChild(el('p', { style: 'color:#aaa;font-size:12px;margin:0 0 10px;' },
    'Posição de ancoragem da imagem. Centro-inferior é o padrão (personagem de pé no palco).'));

  const pivotX = numberField('Pivot X (%)', 50, () => {});
  const pivotY = numberField('Pivot Y (%)', 100, () => {});
  pivotSection.appendChild(pivotX);
  pivotSection.appendChild(pivotY);

  // Preset buttons
  const presets = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:10px;' });
  const presetBtns = [
    { label: '↖ Top-Left', x: 0, y: 0 },
    { label: '↑ Top', x: 50, y: 0 },
    { label: '↗ Top-Right', x: 100, y: 0 },
    { label: '← Left', x: 0, y: 50 },
    { label: '⊙ Center', x: 50, y: 50 },
    { label: '→ Right', x: 100, y: 50 },
    { label: '↙ Bot-Left', x: 0, y: 100 },
    { label: '↓ Bottom', x: 50, y: 100 },
    { label: '↘ Bot-Right', x: 100, y: 100 },
  ];
  for (const p of presetBtns) {
    const b = mkBtn(p.label, '#333', () => {});
    b.style.fontSize = '10px';
    b.style.padding = '4px';
    presets.appendChild(b);
  }
  pivotSection.appendChild(presets);
  panel.appendChild(pivotSection);

  // Animation controls
  const animSection = el('div', { style: `
    background: #0f3460; border-radius: 10px; padding: 14px;
  `});
  animSection.appendChild(el('h4', { style: 'margin:0 0 10px;color:#f5e642;' }, '🎬 Animação'));

  const fpsField = numberField('FPS', 12, () => {});
  animSection.appendChild(fpsField);

  const playAnimBtn = mkBtn('▶️ Play Animação', '#2196f3', () => {});
  playAnimBtn.style.width = '100%';
  const stopAnimBtn = mkBtn('⏹ Parar', '#e53935', () => {});
  stopAnimBtn.style.width = '100%';
  animSection.appendChild(playAnimBtn);
  animSection.appendChild(stopAnimBtn);
  panel.appendChild(animSection);

  return panel;
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

function mkBtn(text: string, color: string, onClick: () => void): HTMLButtonElement {
  const btn = el('button', { style: `
    background: ${color}; color: white; border: none; border-radius: 6px;
    padding: 6px 14px; cursor: pointer; font-size: 13px; font-weight: bold;
    font-family: inherit;
  ` }, text) as HTMLButtonElement;
  btn.addEventListener('click', onClick);
  return btn;
}

function fileField(label: string, value: string, onChange: (v: string) => void, hasLoadBtn: boolean = false, accept: string = ''): HTMLElement {
  const row = el('div', { style: 'margin-bottom:10px;' });
  row.appendChild(el('label', { style: 'display:block;color:#aaa;font-size:11px;margin-bottom:3px;' }, label));

  const inputRow = el('div', { style: 'display:flex;gap:4px;' });
  const input = el('input', { style: `
    flex:1;background:#0a0a2e;border:1px solid #444;border-radius:4px;
    padding:6px 8px;color:#eee;font-size:12px;font-family:inherit;
  ` }) as HTMLInputElement;
  input.value = value;
  input.addEventListener('change', () => onChange(input.value));
  input.addEventListener('input', () => onChange(input.value));
  inputRow.appendChild(input);

  if (hasLoadBtn) {
    const fileInput = el('input', { style: 'display:none;' }) as HTMLInputElement;
    fileInput.type = 'file';
    fileInput.accept = accept;
    fileInput.addEventListener('change', () => {
      if (fileInput.files && fileInput.files[0]) {
        const file = fileInput.files[0];
        const url = URL.createObjectURL(file);
        input.value = url;
        onChange(url);
      }
    });

    const loadBtn = mkBtn('📂', '#555', () => fileInput.click());
    loadBtn.style.padding = '6px 10px';
    loadBtn.title = 'Carregar arquivo local';
    inputRow.appendChild(loadBtn);
    inputRow.appendChild(fileInput);
  }

  row.appendChild(inputRow);
  return row;
}

function numberField(label: string, value: number, onChange: (v: number) => void): HTMLElement {
  const row = el('div', { style: 'margin-bottom:10px;' });
  row.appendChild(el('label', { style: 'display:block;color:#aaa;font-size:11px;margin-bottom:3px;' }, label));
  const input = el('input', { style: `
    width:100%;background:#0a0a2e;border:1px solid #444;border-radius:4px;
    padding:6px 8px;color:#eee;font-size:12px;font-family:inherit;
  ` }) as HTMLInputElement;
  input.type = 'number';
  input.value = String(value);
  input.addEventListener('change', () => onChange(Number(input.value)));
  row.appendChild(input);
  return row;
}
