import type { InstrumentConfig } from '@/core/types';
import { SpriteAnimation } from '@/ui/sprite-animation';

/**
 * Visual editor for instrument preview, pivot positioning, and audio playback.
 */

export function openInstrumentEditor(
  inst: InstrumentConfig,
  charId: string,
  onUpdate: (updated: InstrumentConfig) => void
): void {
  // Work on a copy
  const data: InstrumentConfig = { ...inst };
  let currentAnim: SpriteAnimation | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let pivotX = data.pivotX ?? 50;
  let pivotY = data.pivotY ?? 100;

  const overlay = el('div', { style: `
    position: fixed; inset: 0; z-index: 100001;
    background: #0a0a1a; color: #eee;
    font-family: 'Nunito', sans-serif; font-size: 14px;
    display: flex; flex-direction: column;
    overflow: hidden;
  `});

  // ---- HEADER ----
  const header = el('div', { style: `
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 20px; background: #16213e; border-bottom: 2px solid #333;
    flex-shrink: 0;
  `});
  header.appendChild(el('h2', { style: 'margin:0;color:#f5e642;font-size:18px;' },
    `🎵 ${data.name || 'Novo Instrumento'} — ${charId}`));

  const headerBtns = el('div', { style: 'display:flex;gap:10px;' });
  headerBtns.appendChild(mkBtn('💾 Salvar', '#4caf50', () => {
    data.pivotX = pivotX;
    data.pivotY = pivotY;
    onUpdate(data);
    cleanup();
    overlay.remove();
  }));
  headerBtns.appendChild(mkBtn('✕ Fechar', '#666', () => { cleanup(); overlay.remove(); }));
  header.appendChild(headerBtns);
  overlay.appendChild(header);

  // ---- BODY: 3 columns ----
  const body = el('div', { style: `
    display: grid; grid-template-columns: 1fr 300px 300px;
    flex: 1; overflow: hidden;
  `});

  // ---- COL 1: PREVIEW ----
  const previewArea = el('div', { style: `
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    background: #111; position: relative; overflow: hidden;
  `});
  const stageBg = el('div', { style: `
    width: 100%; height: 100%;
    background: url('assets/images/stage-bg.jpg') center/cover no-repeat;
    display: flex; align-items: flex-end; justify-content: center;
    padding-bottom: 40px; position: relative;
  `});

  const spriteContainer = el('div', { style: 'position:relative;display:flex;align-items:flex-end;justify-content:center;' });
  const placeholder = el('div', { style: 'color:#666;font-size:48px;width:200px;height:300px;display:flex;align-items:center;justify-content:center;' }, '🎵');
  spriteContainer.appendChild(placeholder);
  stageBg.appendChild(spriteContainer);
  previewArea.appendChild(stageBg);
  body.appendChild(previewArea);

  // ---- COL 2: FIELDS ----
  const fieldsPanel = el('div', { style: `
    background: #16213e; padding: 16px; overflow-y: auto;
    border-left: 1px solid #333;
  `});
  fieldsPanel.appendChild(el('h3', { style: 'margin:0 0 12px;color:#f5e642;' }, 'Configurações'));

  // Helper to create field with live reload
  function addField(label: string, key: keyof InstrumentConfig, type: string = 'text', accept: string = ''): void {
    const row = el('div', { style: 'margin-bottom:10px;' });
    row.appendChild(el('label', { style: 'display:block;color:#aaa;font-size:11px;margin-bottom:3px;' }, label));

    const inputRow = el('div', { style: 'display:flex;gap:4px;' });
    const input = el('input', { style: `
      flex:1;background:#0a0a2e;border:1px solid #444;border-radius:4px;
      padding:6px 8px;color:#eee;font-size:12px;font-family:inherit;
    ` }) as HTMLInputElement;
    input.type = type;
    input.value = String(data[key] ?? '');
    input.addEventListener('input', () => {
      (data as any)[key] = type === 'number' ? Number(input.value) : input.value;
      reloadPreview();
    });
    inputRow.appendChild(input);

    if (accept) {
      const fileInput = el('input', { style: 'display:none;' }) as HTMLInputElement;
      fileInput.type = 'file';
      fileInput.accept = accept;
      fileInput.addEventListener('change', () => {
        if (fileInput.files && fileInput.files[0]) {
          const file = fileInput.files[0];
          const url = URL.createObjectURL(file);
          input.value = url;
          (data as any)[key] = url;
          // Store file reference for saving
          if (!(data as any)._files) (data as any)._files = {};
          (data as any)._files[key] = file;
          reloadPreview();
        }
      });
      const loadBtn = mkBtn('📂', '#555', () => fileInput.click());
      loadBtn.style.padding = '6px 10px';
      loadBtn.title = 'Carregar arquivo local';
      inputRow.appendChild(loadBtn);
      inputRow.appendChild(fileInput);
    }

    row.appendChild(inputRow);
    fieldsPanel.appendChild(row);
  }

  addField('Tipo', 'type');
  addField('Nome', 'name');
  addField('Ícone', 'icon', 'text', 'image/*');
  addField('Spritesheet (.tpsheet)', 'sprite' as any, 'text', '.tpsheet,.json');
  addField('Áudio', 'audio', 'text', 'audio/*');
  addField('Compassos', 'bars', 'number');
  addField('Volume Min (dB)', 'minVolumeDb', 'number');
  addField('Volume Max (dB)', 'maxVolumeDb', 'number');
  body.appendChild(fieldsPanel);

  // ---- COL 3: AUDIO + PIVOT + ANIMATION ----
  const rightPanel = el('div', { style: `
    background: #1a1a3e; padding: 16px; overflow-y: auto;
    border-left: 1px solid #333; display: flex; flex-direction: column; gap: 16px;
  `});

  // Audio preview
  const audioSection = section('🔊 Áudio');
  const playAudioBtn = mkBtn('▶️ Play', '#4caf50', () => {
    if (!data.audio) return;
    if (!audioEl) {
      audioEl = new Audio(data.audio);
      audioEl.addEventListener('ended', () => { playAudioBtn.textContent = '▶️ Play'; });
    }
    if (audioEl.paused) {
      audioEl.currentTime = 0;
      audioEl.play();
      playAudioBtn.textContent = '⏸ Pause';
    } else {
      audioEl.pause();
      playAudioBtn.textContent = '▶️ Play';
    }
  });
  playAudioBtn.style.width = '100%';
  playAudioBtn.style.padding = '10px';
  playAudioBtn.style.fontSize = '16px';
  audioSection.appendChild(playAudioBtn);

  const stopAudioBtn = mkBtn('⏹ Stop', '#e53935', () => {
    if (audioEl) { audioEl.pause(); audioEl.currentTime = 0; playAudioBtn.textContent = '▶️ Play'; }
  });
  stopAudioBtn.style.width = '100%';
  audioSection.appendChild(stopAudioBtn);
  rightPanel.appendChild(audioSection);

  // Pivot section
  const pivotSection = section('📌 Pivot Point');
  pivotSection.appendChild(el('p', { style: 'color:#aaa;font-size:11px;margin:0 0 8px;' },
    'Ancoragem da imagem. Centro-inferior = pés no palco.'));

  const pivotXInput = el('input', { style: `
    width:100%;background:#0a0a2e;border:1px solid #444;border-radius:4px;
    padding:6px 8px;color:#eee;font-size:12px;margin-bottom:6px;
  ` }) as HTMLInputElement;
  pivotXInput.type = 'range'; pivotXInput.min = '0'; pivotXInput.max = '100'; pivotXInput.value = String(pivotX);
  const pivotXLabel = el('div', { style: 'color:#aaa;font-size:11px;margin-bottom:4px;' }, `X: ${pivotX}%`);
  pivotXInput.addEventListener('input', () => {
    pivotX = Number(pivotXInput.value);
    pivotXLabel.textContent = `X: ${pivotX}%`;
    updatePivotVisual();
  });
  pivotSection.appendChild(pivotXLabel);
  pivotSection.appendChild(pivotXInput);

  const pivotYInput = el('input', { style: `
    width:100%;background:#0a0a2e;border:1px solid #444;border-radius:4px;
    padding:6px 8px;color:#eee;font-size:12px;margin-bottom:6px;
  ` }) as HTMLInputElement;
  pivotYInput.type = 'range'; pivotYInput.min = '0'; pivotYInput.max = '100'; pivotYInput.value = String(pivotY);
  const pivotYLabel = el('div', { style: 'color:#aaa;font-size:11px;margin-bottom:4px;' }, `Y: ${pivotY}%`);
  pivotYInput.addEventListener('input', () => {
    pivotY = Number(pivotYInput.value);
    pivotYLabel.textContent = `Y: ${pivotY}%`;
    updatePivotVisual();
  });
  pivotSection.appendChild(pivotYLabel);
  pivotSection.appendChild(pivotYInput);

  // Presets
  const presets = el('div', { style: 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;margin-top:8px;' });
  const presetData = [
    ['↖', 0, 0], ['↑', 50, 0], ['↗', 100, 0],
    ['←', 0, 50], ['⊙', 50, 50], ['→', 100, 50],
    ['↙', 0, 100], ['↓', 50, 100], ['↘', 100, 100],
  ];
  for (const [label, px, py] of presetData) {
    const b = mkBtn(label as string, '#333', () => {
      pivotX = px as number; pivotY = py as number;
      pivotXInput.value = String(pivotX);
      pivotYInput.value = String(pivotY);
      pivotXLabel.textContent = `X: ${pivotX}%`;
      pivotYLabel.textContent = `Y: ${pivotY}%`;
      updatePivotVisual();
    });
    b.style.fontSize = '14px'; b.style.padding = '6px';
    presets.appendChild(b);
  }
  pivotSection.appendChild(presets);
  rightPanel.appendChild(pivotSection);

  // Animation controls
  const animSection = section('🎬 Animação');
  let animPlaying = false;

  const playAnimBtn = mkBtn('▶️ Play Animação', '#2196f3', () => {
    if (currentAnim) {
      if (animPlaying) {
        currentAnim.pause();
        animPlaying = false;
        playAnimBtn.textContent = '▶️ Play Animação';
      } else {
        currentAnim.play();
        animPlaying = true;
        playAnimBtn.textContent = '⏸ Pausar Animação';
      }
    }
  });
  playAnimBtn.style.width = '100%';
  animSection.appendChild(playAnimBtn);

  const stopAnimBtn = mkBtn('⏹ Parar Animação', '#e53935', () => {
    if (currentAnim) {
      currentAnim.stop();
      animPlaying = false;
      playAnimBtn.textContent = '▶️ Play Animação';
    }
  });
  stopAnimBtn.style.width = '100%';
  animSection.appendChild(stopAnimBtn);

  const fpsInput = el('input', { style: `
    width:100%;background:#0a0a2e;border:1px solid #444;border-radius:4px;
    padding:6px 8px;color:#eee;font-size:12px;margin-top:8px;
  ` }) as HTMLInputElement;
  fpsInput.type = 'number'; fpsInput.value = '12';
  fpsInput.addEventListener('change', () => {
    if (currentAnim) currentAnim.setFps(Number(fpsInput.value));
  });
  animSection.appendChild(el('label', { style: 'display:block;color:#aaa;font-size:11px;margin-bottom:3px;margin-top:8px;' }, 'FPS'));
  animSection.appendChild(fpsInput);
  rightPanel.appendChild(animSection);

  body.appendChild(rightPanel);
  overlay.appendChild(body);
  document.body.appendChild(overlay);

  // ---- PIVOT VISUAL ----
  const crosshair = el('div', { style: `
    position: absolute; pointer-events: none; z-index: 10;
  `});
  crosshair.innerHTML = `<svg width="30" height="30" viewBox="0 0 30 30" style="transform:translate(-50%,-50%);">
    <line x1="0" y1="15" x2="30" y2="15" stroke="#ff0" stroke-width="2"/>
    <line x1="15" y1="0" x2="15" y2="30" stroke="#ff0" stroke-width="2"/>
    <circle cx="15" cy="15" r="8" fill="none" stroke="#ff0" stroke-width="2"/>
  </svg>`;

  function updatePivotVisual(): void {
    // Position crosshair relative to the sprite container
    const el = spriteContainer.firstElementChild as HTMLElement;
    if (!el) return;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    crosshair.style.left = `${(pivotX / 100) * w}px`;
    crosshair.style.top = `${(pivotY / 100) * h}px`;
    crosshair.style.display = 'block';
  }

  // ---- PREVIEW RELOAD ----
  function reloadPreview(): void {
    // Clean previous
    if (currentAnim) { currentAnim.stop(); currentAnim = null; animPlaying = false; }
    if (audioEl) { audioEl.pause(); audioEl = null; playAudioBtn.textContent = '▶️ Play'; }
    playAnimBtn.textContent = '▶️ Play Animação';

    // Remove old content
    while (spriteContainer.firstChild) spriteContainer.removeChild(spriteContainer.firstChild);

    if (data.sprite) {
      // Load sprite animation
      currentAnim = new SpriteAnimation();
      currentAnim.load(data.sprite).then(() => {
        currentAnim!.setFps(Number(fpsInput.value) || 12);
        spriteContainer.appendChild(currentAnim!.canvas);
        spriteContainer.appendChild(crosshair);
        updatePivotVisual();
        currentAnim!.play();
        animPlaying = true;
        playAnimBtn.textContent = '⏸ Pausar Animação';
      }).catch(() => {
        showFallback();
      });
    } else if (data.icon) {
      const img = el('img', { style: 'max-width:200px;max-height:300px;object-fit:contain;' }) as HTMLImageElement;
      img.src = data.icon;
      img.onload = () => {
        spriteContainer.appendChild(img);
        spriteContainer.appendChild(crosshair);
        updatePivotVisual();
      };
      img.onerror = () => showFallback();
    } else {
      showFallback();
    }
  }

  function showFallback(): void {
    while (spriteContainer.firstChild) spriteContainer.removeChild(spriteContainer.firstChild);
    spriteContainer.appendChild(el('div', { style: 'color:#666;font-size:48px;width:200px;height:300px;display:flex;align-items:center;justify-content:center;' }, '🎵'));
  }

  function cleanup(): void {
    if (currentAnim) { currentAnim.stop(); currentAnim = null; }
    if (audioEl) { audioEl.pause(); audioEl = null; }
  }

  // Initial load
  setTimeout(reloadPreview, 100);
}

// ============================================================
// HELPERS
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

function section(title: string): HTMLElement {
  const s = el('div', { style: `
    background: #0f3460; border-radius: 10px; padding: 14px;
  `});
  s.appendChild(el('h4', { style: 'margin:0 0 10px;color:#f5e642;' }, title));
  return s;
}

// Extend InstrumentConfig locally for pivot and files
declare module '@/core/types' {
  interface InstrumentConfig {
    _pivotX?: number;
    _pivotY?: number;
    _files?: Record<string, File>;
  }
}
