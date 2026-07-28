extends Control

const TIME_TEMPLATE: = "%.2f"

var _seeking: = false
var _was_playing: = false

onready var time_label: = $Time
onready var fill: Panel = $Fill
onready var stage: Node2D = owner

func _ready() -> void:
	connect("gui_input", self, "_on_gui_input")


func _on_gui_input(event: InputEvent) -> void:
	if GameState.current != GameState.FREE:
		return

	if event is InputEventScreenDrag:
		if _seeking:
			seek(clamp(event.position.x, 0.0, rect_size.x))

	elif event is InputEventScreenTouch:
		_seeking = event.pressed
		if event.pressed:
			if MusicController.is_playing():
				_was_playing = true
				MusicController.pause()

			seek(clamp(event.position.x, 0.0, rect_size.x))
		else:
			if _was_playing:
				MusicController.resume()
				_was_playing = false


func _process(delta: float) -> void:
	update_position()


func seek(position: float) -> void:
	MusicController.seek(range_lerp(
		position,
		0.0,
		rect_size.x,
		0.0,
		get_max_time()
	))
	update_position()


func update_position() -> void:

	fill.rect_size.x = range_lerp(
		get_current_time(),
		0.0,
		get_max_time(),
		fill.rect_min_size.x,
		rect_size.x
	)

	time_label.text = TIME_TEMPLATE % get_current_time()


func get_current_time() -> float:
	return MusicController.time if GameState.current == GameState.FREE \
			else stage.recorder.get_elapsed_time()


func get_max_time() -> float:
	return MusicController.duration if GameState.current == GameState.FREE \
			else stage.recorder.get_duration()
