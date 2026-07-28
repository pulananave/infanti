# Plano de Reescrita — Infanti (Godot 4.7.1)

## Contexto

**Projeto atual:** Godot 3.x (config_version=4), GLES2, mobile touch
**Alvo:** Godot 4.7.1 estável, Web (HTML5/WebGL2) + Mobile (Android/iOS)
**Abordagem:** Reescrever do zero, aproveitando lógica, assets e arquitetura existentes
**Equipe:** 1 pessoa

---

## Inventário do Projeto Atual

### Personagens (9)
- Boogar, Ceval, Dan, Esper, Gobu, Grompy, Ohle, Rafog, Teewong, Zoem
- Cada um com sprites de animação (TexturePacker) por instrumento

### Packs de Música (5)
| Pack | BPM | Bars | Pasta Sons |
|------|-----|------|------------|
| Dona Aranha | 114 | 16 | `DonaAranha/` (30 sons) |
| O Sapo Não Lava Pé | ? | ? | `OSapo/` |
| Pintinho Amarelinho | ? | ? | `PintinhoAmarelinho/` |
| A Canoa Virou | ? | ? | `ACanoaVirou/` |
| Coelho da Páscoa | ? | ? | `CoelhoDaPascoa/` |

### Instrumentos (ícones SVG já existentes)
Guitarra Base, Guitarra Rock, Guitarra Frase, Baixo Acústico, Baixo Rock, Baixo Elétrico, Violão, Violino, Bateria, Bateria Eletrônica 2/3, Bateria Latin, Bateria Pop, Bongo, Conga, Bombo, Caixa, Pratos, Shaker, Pandeiro, Marimba, Marimba 2, Sanfona, Synth, Synth Bass, Rhodes, Órgão, Picolo, Picolo 2, Tuba, Trompete, Trombone, Agogô, Relógio, Microfone, Recorêco

### Sistema de Drag & Drop (DSController)
- Multi-touch drag & drop de instrumentos
- Container priority system para aceitar/rejeitar drops
- Mudança de parent preservando posição global

### Engine Musical (MusicController)
- BPM-driven loop com sinais de bar/sync
- Play/pause/stop/seek
- Bar duration = 240/bpm

### Sistema de Gravação (Record + Recorder)
- Snapshots de estado por tempo (binary search)
- Salva posição normalizada, mute, on_stage por instrumento
- Reproduz com interpolação de estados
- Salva como .tres em `user://recordings`

### Efeitos de Posição (PositionEffects)
- Volume varia com posição Y (topo = mais alto)
- Escala varia com posição Y (fundo = maior) e X (laterais = menor)

---

## Arquitetura Proposta (Godot 4.7.1)

### Mudanças Estruturais vs. Godot 3

| Godot 3 | Godot 4.7.1 |
|---------|-------------|
| `export var` | `@export var` |
| `onready var` | `@onready var` |
| `yield(get_tree(), "idle_frame")` | `await get_tree().process_frame` |
| `instance()` | `instantiate()` |
| `Directory.new()` | `DirAccess.open()` |
| `ResourceSaver.save()` | `ResourceSaver.save()` (mesmo, mas path muda) |
| `connect("sig", self, "method")` | `signal.connect(method)` |
| `emit_signal("name", args)` | `signal.emit(args)` |
| `range_lerp()` | `remap()` |
| `Tween` (nó) | `create_tween()` (method) |
| `Texture` | `Texture2D` |
| `Sprite` | `Sprite2D` |
| `AnimatedSprite` | `AnimatedSprite2D` |
| `Area2D.input_event` | `_input_event()` (override) |
| `GLES2` | `GL Compatibility` (WebGL2) |
| `format=2` (.tscn) | `format=3` (.tscn) |

### Módulos do Novo Projeto

```
res://
├── project.godot
├── addons/                    # Se necessário
├── assets/
│   ├── anim/                  # Sprite sheets (reaproveitar)
│   ├── characters/            # Sprites por personagem (reaproveitar)
│   ├── fonts/                 # Fontes (precisa converter DynamicFont → FontFile)
│   ├── icons/                 # Ícones SVG (reaproveitar)
│   ├── images/                # UI images (reaproveitar)
│   ├── sounds/                # Sons .ogg (reaproveitar)
│   └── styles/                # Temas
├── src/
│   ├── autoload/
│   │   ├── event_bus.gd       # Event bus global (sinais nomeados)
│   │   ├── game_state.gd      # Máquina de estados (FREE/RECORDING/PLAYING)
│   │   ├── music_engine.gd    # MusicController refactorado
│   │   ├── drag_system.gd     # DSController refactorado
│   │   └── settings.gd        # Configurações globais
│   ├── core/
│   │   ├── instrument.gd      # Instrument (Area2D → Area2D)
│   │   ├── character.gd       # Character com instrumentos
│   │   ├── pack.gd            # Pack: resource data-driven
│   │   ├── pack_data.gd       # Resource: definição de pack (BPM, bars, instrumentos)
│   │   ├── recording.gd       # Record refactorado (Resource)
│   │   └── recorder.gd        # Gravação/playback
│   ├── scenes/
│   │   ├── main.tscn          # Cena raiz
│   │   ├── main_menu/         # Menu principal + tickets
│   │   ├── stage/             # Palco principal
│   │   └── save_record/       # UI de salvar
│   ├── ui/
│   │   ├── timeline.gd        # Timeline com seek
│   │   ├── control_buttons.gd # Botões REC, Play, Reset, Home
│   │   ├── instrument_box.gd  # Balão de instrumentos
│   │   └── info_popup/        # Tutorial, contato, tabs
│   ├── effects/
│   │   └── position_effects.gd # Volume/escala por posição
│   └── export/
│       └── audio_exporter.gd  # NOVO: exportar gravação como áudio
└── packs/                     # NOVO: packs como Resources
    ├── dona_aranha.tres
    ├── sapo.tres
    ├── pintinho.tres
    ├── canoa.tres
    └── coelho.tres
```

---

## Sistema de Packs Simplificado (NOVO)

### Problema atual
Criar um pack exige: criar pasta de sons, criar .tscn de Pack, criar .tscn de Character por personagem, criar .tscn de Instrument por instrumento, configurar cada manualmente. Muito trabalho manual.

### Solução proposta: PackData Resource (.tres)

```gdscript
# pack_data.gd
class_name PackData
extends Resource

@export var pack_name: String = ""
@export var display_name: String = ""
@export var music_bpm: float = 120.0
@export var music_bars: int = 16
@export var music_loops: int = 2
@export var cover_texture: Texture2D
@export var characters: Array[CharacterData] = []

# character_data.gd
class_name CharacterData
extends Resource

@export var character_id: String = ""      # "Rafog", "Zoem", etc.
@export var box_direction: String = "RIGHT" # LEFT/MIDDLE/RIGHT
@export var instruments: Array[InstrumentData] = []

# instrument_data.gd
class_name InstrumentData
extends Resource

@export var instrument_type: String = ""   # "bateria", "violao", etc.
@export var display_name: String = ""
@export var icon_texture: Texture2D
@export var audio_stream: AudioStream
@export var bars: int = 1
@export var min_volume_db: float = -20.0
@export var max_volume_db: float = 0.0
@export var use_limit: int = 0             # 0 = unlimited
```

### Fluxo para criar um novo pack:
1. Criar pasta `assets/sounds/music_packs/NovoPack/` com os .ogg
2. No Godot Editor: criar novo `PackData` resource (.tres)
3. Preencher BPM, bars, nome
4. Para cada personagem: criar `CharacterData`, adicionar `InstrumentData` com o .ogg referenciado
5. A cena do Stage carrega qualquer PackData dinamicamente — zero código novo

### Lista de packs no menu:
```gdscript
# main_menu.gd
@export var available_packs: Array[PackData] = []
# O menu popula os botões automaticamente
```

---

## Exportação de Áudio (NOVO)

### Abordagem: Offline Audio Mixing

O Godot 4 tem `AudioStreamGenerator` e acesso a buffers de áudio. Para exportar:

1. **Playback silencioso** da gravação (sem output no speakers)
2. **Mix dos AudioStreams** de cada instrumento por timestamp
3. **Encode para OGG/WAV** e salvar

### Implementação:
```gdscript
# audio_exporter.gd
class_name AudioExporter

static func export_recording(
    recording: Recording,
    pack: PackData,
    output_path: String
) -> Error:
    # 1. Descobrir duração total
    # 2. Para cada estado na recording:
    #    - Identificar instrumentos ativos
    #    - Mixar samples no buffer correto
    # 3. Gerar WAV (mais simples) ou OGG
    # 4. Salvar em output_path
    pass
```

**Limitação do Web:** No target web, salvar arquivo requer `JavaScript.download()` ou oferecer o blob para download. O Godot 4.7 tem suporte a isso via `OS.shell_open()` ou API JS bridge.

**Opção mais simples:** Usar `AudioStreamWAV` do Godot para gerar o buffer e `FileAccess` para salvar .wav. Para .ogg, pode ser necessário um encoder addon.

---

## Plano de Execução (Fases)

### Fase 1 — Fundação (core setup)
- [ ] Criar projeto Godot 4.7.1 novo (GL Compatibility renderer para Web)
- [ ] Configurar project.godot (resolução, autoloads, input mapping)
- [ ] Copiar todos os assets (images, sounds, fonts, anims)
- [ ] Converter fontes DynamicFont → FontFile resources
- [ ] Criar os Resources: PackData, CharacterData, InstrumentData
- [ ] Configurar export presets (Web, Android)

### Fase 2 — Engine Musical
- [ ] Rewritar MusicEngine (BPM, bars, play/pause/stop/seek, sinais)
- [ ] Rewritar EventBus (sinais globais)
- [ ] Rewritar GameState (enum + change)
- [ ] Testar: um AudioStreamPlayer tocando em loop com BPM

### Fase 3 — Instrument + Character
- [ ] Rewritar Instrument (Area2D, audio, mute/unmute, animated sprite)
- [ ] Rewritar Character (show/hide instruments, drag initiation)
- [ ] Rewritar InstrumentBox (balão visual com 3 modos)
- [ ] Adaptar AnimatedSprite2D com TexturePacker sprites
- [ ] Testar: personagem mostra instrumentos ao tocar

### Fase 4 — Drag & Drop
- [ ] Rewritar DragSystem (multi-touch, containers, priority)
- [ ] Adaptar para input de touch (mobile) e mouse (web/desktop)
- [ ] Integrar com Character (drag instrument → stage)
- [ ] Testar: arrastar instrumento do personagem para o palco

### Fase 5 — Stage + Efeitos
- [ ] Rewritar Stage (recebe instrumentos, Y-sort, position effects)
- [ ] Rewritar PositionEffects (volume/escala por posição)
- [ ] Rewritar Timeline (seek bar, tempo)
- [ ] Rewritar ControlButtons (REC, Play, Reset, Home, Biblioteca)
- [ ] Testar: instrumento no stage toca com volume/escala corretos

### Fase 6 — Sistema de Gravação
- [ ] Rewritar Record (Resource com states por tempo)
- [ ] Rewritar Recorder (start/stop/save/load/playback)
- [ ] Rewritar SavedRecordButton + Drawer (biblioteca de gravações)
- [ ] Adaptar para Godot 4: DirAccess, ResourceSaver
- [ ] Testar: gravar composição, salvar, reproduzir

### Fase 7 — Pack System
- [ ] Criar PackData .tres para os 5 packs existentes
- [ ] Rewritar MainMenu (carrega packs dinamicamente)
- [ ] Rewritar Ticket (botão de pack no menu)
- [ ] Rewritar InfoPopup (tutorial, tabs)
- [ ] Rewritar Main/Transition (troca de cena)
- [ ] Testar: todos os 5 packs funcionando

### Fase 8 — Audio Export
- [ ] Implementar AudioExporter
- [ ] Adicionar botão "Exportar" na UI
- [ ] Testar no mobile (salvar arquivo)
- [ ] Testar no web (download via browser)

### Fase 9 — Polish & Deploy
- [ ] Testar todos os fluxos em Web (browser)
- [ ] Testar todos os fluxos em Android
- [ ] Otimizar carregamento de assets (lazy loading de packs)
- [ ] Splash screen, ícones de app
- [ ] Build de release para ambas plataformas

---

## Riscos e Mitigações

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| Web: AudioContext exige user gesture | Alto | Garantir primeiro toque ativa áudio |
| Web: performance de OGG decoding | Médio | Pre-load de sons, audio bus pooling |
| TexturePacker sprites → Godot 4 | Médio | Godot 4 importa .sprites do TP, testar |
| Export WAV no web sem filesystem | Alto | Usar JavaScript bridge para download |
| Multi-touch no web (canvas) | Baixo | Godot 4 tem bom suporte, testar cedo |

---

## Estimativa (1 pessoa)

| Fase | Esforço estimado |
|------|-----------------|
| 1 - Fundação | 1-2 dias |
| 2 - Engine Musical | 1-2 dias |
| 3 - Instrument + Character | 2-3 dias |
| 4 - Drag & Drop | 2-3 dias |
| 5 - Stage + Efeitos | 1-2 dias |
| 6 - Sistema de Gravação | 2-3 dias |
| 7 - Pack System | 1-2 dias |
| 8 - Audio Export | 2-3 dias |
| 9 - Polish & Deploy | 2-3 dias |
| **Total** | **~14-23 dias** |

---

## Próximos Passos

1. Confirmar este plano
2. Começar Fase 1: criar projeto Godot 4.7.1 e migrar assets
3. Seguir fases sequencialmente, testando cada uma

*Documento gerado em 28/07/2026*
