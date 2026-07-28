tool
extends Area2D
class_name Instrument

const ANIMATION_NAME: = "default"
const MUTE_VOLUME_DB: = -80
const PLAY_COOLDOWN_MS: = 500
const MUTE_MODULATE: = Color(0.8, 0.8, 0.8)
const NORMAL_MODULATE: = Color(1.0, 1.0, 1.0)

export var stream: AudioStream setget set_stream
export var color: = Color("475af3")
export var min_volume_db: = -20.0
export var max_volume_db: = 0.0
export var bars: = 1

var owner_character
var is_muted: bool = false
var type: = "" # set at Character's add_instrument method before add_child
var bpm: = 96.0 setget set_bpm

var _active: bool = false setget ,is_active
var _loop_end: = 1.0
var _player_index: = 0
var _unmute_volume_db: = 0
var _last_play_ticks_ms: = 0

onready var animated_sprite: AnimatedSprite
onready var icons: = $Icons
onready var characters: = $Characters
onready var index: int = get_index()
onready var drag_offset: Vector2 = -$CharacterCollision.position - Vector2(0, 100)
onready var icon_collision: CollisionShape2D = $IconCollision
onready var character_collision: CollisionShape2D = $CharacterCollision
onready var animation_player: AnimationPlayer = $AnimationPlayer

onready var _primary_audio: AudioStreamPlayer = $PrimaryAudio
onready var _secondary_audio: AudioStreamPlayer = $SecondaryAudio
onready var _audio_players: = [_primary_audio, _secondary_audio]

func _ready() -> void:
	if Engine.editor_hint:
		set_process(false)

	else:
		Event.connect("character_selected", self, "_on_Event_character_selected")
		Event.connect("character_deselected", self, "_on_Event_character_deselected")


func _on_Event_character_selected(character) -> void:
	if Global.stage.is_on_stage(self):
		input_pickable = false
	pass


func _on_Event_character_deselected(character) -> void:
	if !input_pickable:
		input_pickable = true
	pass


func _on_MusicController_syncronize(time: float) -> void:
#	play(time)
	pass


func _on_MusicController_bar(number: int) -> void:
	if not number % bars:
		loop()


func _on_MusicController_playing_changed(to: bool) -> void:
	if GameState.current == GameState.RECORDING:
		return

	if to:
		if not is_playing():
			play(MusicController.time)
	else:
		stop()


func play(time: = 0.0) -> void:
	_last_play_ticks_ms = OS.get_ticks_msec()

	var local_time: float = time - floor(time / _loop_end) * _loop_end
	get_player().play(local_time)

	if not is_muted and not characters.animated_sprite.playing:
		characters.animated_sprite.play(ANIMATION_NAME)


func loop() -> void:
	_player_index = (_player_index + 1) % _audio_players.size()
	play()


func stop() -> void:
	for audio_player in _audio_players:
		audio_player.stop()

	characters.animated_sprite.stop()


func is_playing() -> bool:
	return get_player().playing


func get_character_collision_extents() -> Vector2:
	return character_collision.shape.extents


func get_normalized_position() -> Vector2:
	var normalized_position: = Vector2(
		range_lerp(
			global_position.x,
			Global.stage.min_instrument_position.x,
			Global.stage.max_instrument_position.x,
			0.0,
			1.0
		),
		range_lerp(
			global_position.y,
			Global.stage.min_instrument_position.y,
			Global.stage.max_instrument_position.y,
			0.0,
			1.0
		)
	)
	return normalized_position

func set_normalized_position(value: Vector2) -> void:
	global_position = Vector2(
		range_lerp(
			value.x,
			0,
			1,
			Global.stage.min_instrument_position.x,
			Global.stage.max_instrument_position.x
		),
		range_lerp(
			value.y,
			0,
			1,
			Global.stage.min_instrument_position.y,
			Global.stage.max_instrument_position.y
		)
	)


func get_time() -> float:
	return get_player().get_playback_position()


func get_player() -> AudioStreamPlayer:
	return _audio_players[_player_index]


func get_next_player() -> AudioStreamPlayer:
	return _audio_players[(_player_index + 1) % _audio_players.size()]


# warning-ignore:shadowed_variable
func get_frame_texture(index: int) -> Texture:
# warning-ignore:shadowed_variable
	var animated_sprite: AnimatedSprite = characters.get_node(type)
	return animated_sprite.frames.get_frame(ANIMATION_NAME, index)


func activate() -> void:
	if MusicController.is_playing():
		play(MusicController.time)

	icons.hide()
	characters.show()
	MusicController.connect("bar", self, "_on_MusicController_bar")
	MusicController.connect("syncronize", self, "_on_MusicController_syncronize")
	MusicController.connect("playing_changed", self, "_on_MusicController_playing_changed")
	icon_collision.disabled = true
	character_collision.disabled = false
	animation_player.play("playing")

	if is_muted:
		unmute()

	_active = true


func deactivate() -> void:
	if not _active:
		return

	stop()

	icons.show()
	characters.hide()
	MusicController.disconnect("bar", self, "_on_MusicController_bar")
	MusicController.disconnect("syncronize", self, "_on_MusicController_syncronize")
	MusicController.disconnect("playing_changed", self, "_on_MusicController_playing_changed")
	icon_collision.disabled = false
	character_collision.disabled = true
	animation_player.stop()

	_active = false


func mute() -> void:
	# warning-ignore:function_may_yield
	_unmute_volume_db = get_volume_db()
	for audio_stream_players in _audio_players:
		audio_stream_players.volume_db = MUTE_VOLUME_DB

	is_muted = true
	characters.modulate = MUTE_MODULATE
	characters.animated_sprite.stop()
	animation_player.stop(false)

	Event.emit_signal("instrument_mute_toggled", self)


func unmute() -> void:
	is_muted = false
	set_volume_db(_unmute_volume_db)

	characters.modulate = NORMAL_MODULATE
	characters.animated_sprite.play()
	animation_player.play("playing")

	Event.emit_signal("instrument_mute_toggled", self)


func return_to_character() -> void:
	owner_character.recall(self)


func set_stream(value: AudioStream) -> void:
	stream = value
	if stream:
		stream.loop = false

	if not _audio_players:
		yield(self, "ready")

	for audio_stream_players in _audio_players:
		audio_stream_players.stream = stream


func set_bpm(value: float) -> void:
	bpm = value

	if not characters:
		yield(self, "ready")

	_loop_end = 60.0 * float(bars) * 4.0 / bpm
	set_process(_loop_end and not Engine.editor_hint)



func set_volume_db(value: float) -> void:
	if is_muted:
		return

	if not _audio_players:
		yield(self, "ready")

	for audio_stream_players in _audio_players:
		audio_stream_players.volume_db = clamp(value, min_volume_db, max_volume_db)


func get_volume_db() -> float:
	if not _audio_players:
		yield(self, "ready")

	return get_player().volume_db


func is_active() -> bool:
	return _active

