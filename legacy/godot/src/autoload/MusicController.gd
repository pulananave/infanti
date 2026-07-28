extends Node

enum State {PLAYING, STOPPED}

signal playing_changed(is_playing)
signal syncronize(time)
signal bar(number)
signal looped

var time: = 0.0 setget set_time
var duration: = 0.0
var bpm: = 96.0 setget set_bpm
var bars: = 20

var last_bar: = 0
var _state: int = State.STOPPED setget set_state
var _bar_duration: = 2.5


func _ready():
	set_state(_state)

	Event.connect("stage_empty", self, "_on_Event_stage_empty")


func _on_Event_stage_empty() -> void:
	if GameState.current != GameState.FREE:
		return

	stop()


func _process(delta: float) -> void:
	time += delta
	var current_bar: = floor(time / _bar_duration)

	if time >= duration:
		self.time -= duration
		emit_signal("looped")

	if current_bar != last_bar and current_bar < bars:
		emit_signal("bar", current_bar)
		last_bar = floor(current_bar) as int


func play(from_time: = 0.0) -> void:
	set_state(State.PLAYING)
	self.time = from_time


func stop() -> void:
	last_bar = -1
	set_state(State.STOPPED)
	self.time = 0.0


func pause() -> void:
	set_state(State.STOPPED)


func resume() -> void:
	set_state(State.PLAYING)


func seek(to_time: float) -> void:
	self.time = to_time if to_time <= duration else 0.0


func set_time(value: float) -> void:
	time = value
	if is_playing():
		emit_signal("syncronize", time)


func set_bpm(value: float) -> void:
	bpm = value

	_bar_duration = 240 / bpm


func is_playing() -> bool:
	return _state == State.PLAYING


func set_state(value: int) -> void:
	if value != _state:
		emit_signal("playing_changed", value == State.PLAYING)

	_state = value
	set_process(_state == State.PLAYING)
