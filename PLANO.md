# Plano de Reescrita — Infanti (HTML5 + TypeScript)

## Contexto

**Projeto atual:** Godot 3.x (legado em `legacy/godot/`)
**Alvo:** Aplicação web HTML5 — roda em qualquer browser, instalável como PWA
**Deploy:** Web (desktop/mobile browser) + Mobile (PWA ou Capacitor)
**Equipe:** 1 pessoa

---

## Stack Tecnológica

| Camada | Tecnologia | Por quê |
|--------|-----------|---------|
| **Linguagem** | TypeScript | Type safety, melhor DX, menos bugs |
| **Build** | Vite | Fast HMR, bundling otimizado, TS nativo |
| **Rendering** | PixiJS 8 | Sprites, animações, drag & drop, multi-touch |
| **Áudio** | Web Audio API (nativa) | Sync BPM preciso, OfflineAudioContext para export |
| **Storage** | IndexedDB (via Dexie.js) | Gravações persistem offline |
| **Export áudio** | OfflineAudioContext | Mixa e renderiza áudio offline |
| **Mobile** | PWA (Service Worker + Manifest) | Instalável, offline, sem app store |
| **Deploy** | GitHub Pages / Vercel / Netlify | CI/CD, CDN, HTTPS grátis |

---

## Arquitetura

```
infanti/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── public/
│   ├── manifest.json          # PWA manifest
│   ├── sw.js                  # Service Worker
│   └── icons/                 # Ícones PWA
├── src/
│   ├── main.ts                # Entry point
│   ├── app.ts                 # App lifecycle (init, scenes)
│   │
│   ├── core/
│   │   ├── event-bus.ts       # Pub/sub global (substitui Event.gd)
│   │   ├── game-state.ts      # State machine (FREE/RECORDING/PLAYING)
│   │   └── settings.ts        # Configurações globais
│   │
│   ├── audio/
│   │   ├── audio-engine.ts    # AudioContext management
│   │   ├── music-engine.ts    # BPM scheduler, bar signals, loop
│   │   ├── audio-exporter.ts  # OfflineAudioContext → WAV
│   │   └── sample-player.ts   # Play/stop/mute individual samples
│   │
│   ├── stage/
│   │   ├── stage.ts           # Palco principal (PixiJS Container)
│   │   ├── instrument.ts      # Instrumento no palco (sprite + audio)
│   │   ├── position-effects.ts # Volume/escala por posição
│   │   ├── timeline.ts        # Seek bar com tempo
│   │   └── control-bar.ts     # Botões REC, Play, Reset, Home
│   │
│   ├── character/
│   │   ├── character.ts       # Personagem com instrumentos
│   │   ├── instrument-box.ts  # Balão de instrumentos (show/hide)
│   │   └── animations.ts      # Spritesheet animation manager
│   │
│   ├── drag/
│   │   ├── drag-system.ts     # Multi-touch drag & drop
│   │   ├── drag-container.ts  # Interface para containers
│   │   └── pointer-handler.ts # Pointer Events abstraction
│   │
│   ├── recording/
│   │   ├── recording.ts       # Data model (snapshots por tempo)
│   │   ├── recorder.ts        # Gravação (start/stop/save)
│   │   ├── playback.ts        # Reprodução de gravação
│   │   └── storage.ts         # IndexedDB (Dexie.js)
│   │
│   ├── packs/
│   │   ├── pack-loader.ts     # Carrega pack JSON + assets
│   │   ├── pack-data.ts       # Interface TypeScript do pack
│   │   └── packs/             # Definições de packs
│   │       ├── dona-aranha.json
│   │       ├── sapo.json
│   │       ├── pintinho.json
│   │       ├── canoa.json
│   │       └── coelho.json
│   │
│   ├── scenes/
│   │   ├── main-menu.ts       # Menu principal
│   │   ├── stage-scene.ts     # Cena do palco
│   │   ├── save-dialog.ts     # Dialog de salvar gravação
│   │   └── library.ts         # Biblioteca de gravações
│   │
│   ├── ui/
│   │   ├── components.ts      # Botões, labels, dialogs reutilizáveis
│   │   ├── info-popup.ts      # Tutorial + contato
│   │   └── tab-indicator.ts   # Tabs do popup
│   │
│   └── utils/
│       ├── math.ts            # remap, clamp, lerp
│       └── asset-loader.ts    # Carregamento de assets
│
├── assets/                    # Copiar de legacy/godot/assets/
│   ├── sounds/                # .ogg (Web Audio API toca nativo)
│   ├── images/                # SVGs + PNGs
│   ├── sprites/               # Spritesheets para PixiJS
│   ├── fonts/                 # Web fonts (.woff2)
│   └── anim/                  # Frame sequences
│
└── legacy/
    └── godot/                 # Código original (referência)
```

---

## Sistema de Packs (JSON)

### Estrutura de um pack:

```json
{
  "id": "dona-aranha",
  "name": "Dona Aranha",
  "bpm": 114,
  "bars": 16,
  "loops": 2,
  "cover": "assets/images/menu/main_menu/BOTAO_DONA_ARANHA.svg",
  "characters": [
    {
      "id": "rafog",
      "boxDirection": "right",
      "instruments": [
        {
          "type": "bombo",
          "name": "Bombo",
          "icon": "assets/images/instrument_icons/BOMBO.svg",
          "audio": "assets/sounds/music_packs/DonaAranha/aranha-marcial-bombo.ogg",
          "bars": 1,
          "minVolumeDb": -20,
          "maxVolumeDb": 0
        },
        {
          "type": "violao",
          "name": "Violão",
          "icon": "assets/images/instrument_icons/VIOLAO.svg",
          "audio": "assets/sounds/music_packs/DonaAranha/aranha-melo-viola.ogg",
          "bars": 1,
          "minVolumeDb": -20,
          "maxVolumeDb": 0
        }
      ]
    }
  ]
}
```

### Para criar um novo pack:
1. Criar pasta de sons `.ogg`
2. Criar arquivo `.json` com BPM, bars, personagens e referências
3. O app detecta automaticamente — zero código

---

## Audio Engine (Web Audio API)

### MusicEngine (substitui MusicController)

```typescript
class MusicEngine {
  private ctx: AudioContext;
  private bpm: number;
  private barDuration: number;  // 240 / bpm
  private startTime: number;
  private isPlaying: boolean;

  // Scheduling preciso via AudioContext.currentTime
  play(fromTime?: number): void;
  pause(): void;
  stop(): void;
  seek(time: number): void;

  // Sinais (EventEmitter pattern)
  on('bar', (barNumber: number) => void): void;
  on('looped', () => void): void;
  on('tick', (time: number) => void): void;
}
```

### Audio Export (OfflineAudioContext)

```typescript
class AudioExporter {
  // Renderiza toda a gravação em buffer offline
  static async exportWav(
    recording: Recording,
    pack: PackData
  ): Promise<Blob> {
    // 1. Criar OfflineAudioContext com duração total
    // 2. Para cada estado: agendar AudioBufferSourceNode no tempo correto
    // 3. startRendering() → AudioBuffer
    // 4. Encode para WAV (header + PCM)
    // 5. Retornar Blob para download
  }
}
```

---

## Drag & Drop (Pointer Events)

```typescript
class DragSystem {
  private activeDrags: Map<number, DragState>; // pointerId → state

  // Suporta multi-touch nativo
  onPointerDown(e: PointerEvent, node: DisplayObject): void;
  onPointerMove(e: PointerEvent): void;
  onPointerUp(e: PointerEvent): void;

  // Containers podem aceitar/rejeitar drops
  registerContainer(container: DragContainer): void;
}
```

---

## Recording System

```typescript
interface InstrumentState {
  isOnStage: boolean;
  isMuted: boolean;
  normalizedPosition: { x: number; y: number };
}

interface StateSnapshot {
  time: number;
  instruments: Record<string, InstrumentState>;
}

class Recording {
  name: string;
  duration: number;
  states: StateSnapshot[];
  usedInstruments: string[];
}

// IndexedDB via Dexie.js
class RecordingStorage {
  async save(packId: string, recording: Recording): Promise<void>;
  async loadAll(packId: string): Promise<Recording[]>;
  async delete(packId: string, name: string): Promise<void>;
}
```

---

## PWA (Mobile)

```json
// public/manifest.json
{
  "name": "Infanti",
  "short_name": "Infanti",
  "start_url": "/",
  "display": "fullscreen",
  "orientation": "landscape",
  "background_color": "#e6e6e6",
  "theme_color": "#475af3",
  "icons": [
    { "src": "/icons/192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- Service Worker cacheia assets para funcionar offline
- Instalável no home screen (Android + iOS 16.4+)
- Orientação landscape forçada

---

## Plano de Execução

### Fase 1 — Setup do Projeto (~1 dia)
- [ ] `npm create vite@latest infanti -- --template vanilla-ts`
- [ ] Configurar Vite, TS, PixiJS
- [ ] Copiar assets de `legacy/godot/assets/`
- [ ] Configurar PWA manifest + service worker
- [ ] Tela básica rodando no browser

### Fase 2 — Audio Engine (~2 dias)
- [ ] AudioContext wrapper (init no primeiro toque do user)
- [ ] MusicEngine: BPM, bars, play/pause/stop/seek
- [ ] SamplePlayer: play/stop individual samples
- [ ] Testar: um sample tocando em loop sincronizado

### Fase 3 — Character + Instrument Rendering (~2 dias)
- [ ] Carregar spritesheets com PixiJS
- [ ] Character: mostrar/esconder instrumentos
- [ ] InstrumentBox: balão visual com 3 modos (left/middle/right)
- [ ] Animações de personagem sincronizadas com áudio
- [ ] Testar: personagem aparece com instrumentos

### Fase 4 — Drag & Drop (~2 dias)
- [ ] PointerHandler: multi-touch via Pointer Events
- [ ] DragSystem: drag instrument do character → stage
- [ ] Containers: character aceita recall, stage aceita drop
- [ ] Testar: arrastar instrumento no mobile e desktop

### Fase 5 — Stage + Efeitos (~2 dias)
- [ ] Stage container: recebe instrumentos, Y-sort
- [ ] PositionEffects: volume por Y, escala por X+Y
- [ ] Timeline: seek bar com tempo
- [ ] ControlBar: botões REC, Play, Reset, Home
- [ ] Testar: instrumento no stage com efeitos corretos

### Fase 6 — Recording System (~2 dias)
- [ ] Recording data model
- [ ] Recorder: start/stop, salva snapshots por tempo
- [ ] Playback: reproduz estados sincronizados
- [ ] IndexedDB storage (Dexie.js)
- [ ] Library UI: lista gravações, play, delete
- [ ] Testar: gravar, salvar, reproduzir

### Fase 7 — Pack System (~1 dia)
- [ ] PackLoader: carrega JSON + assets
- [ ] Criar JSONs dos 5 packs existentes
- [ ] MainMenu: carrega packs dinamicamente
- [ ] InfoPopup: tutorial + tabs
- [ ] Testar: todos os 5 packs funcionando

### Fase 8 — Audio Export (~2 dias)
- [ ] OfflineAudioContext: render mix
- [ ] WAV encoder (PCM header + samples)
- [ ] Botão "Exportar" na UI
- [ ] Download via `<a>` element (web) / File System API
- [ ] Testar: exportar gravação como .wav

### Fase 9 — Polish + Deploy (~2 dias)
- [ ] Service Worker: cache offline
- [ ] Testes em mobile (Android Chrome, iOS Safari)
- [ ] Loading screen + splash
- [ ] Otimizar bundle (lazy load packs)
- [ ] Deploy em GitHub Pages ou Vercel

**Total estimado: ~16 dias**

---

## Riscos

| Risco | Mitigação |
|-------|-----------|
| AudioContext exige user gesture | Mostrar tela de "Toque para iniciar" |
| iOS Safari: limitações de áudio | Testar cedo, usar unlock pattern |
| Spritesheet format do TexturePacker | Exportar como JSON array, PixiJS importa nativo |
| OGG no Safari (não suportava antigamente) | Safari 17+ suporta OGG; fallback para AAC se necessário |
| Multi-touch no desktop | Pointer Events funciona em ambos, sem polyfill |

---

*Documento gerado em 28/07/2026*
*Referência: legacy/PLANO_REESCRITA.md (plano anterior Godot)*
