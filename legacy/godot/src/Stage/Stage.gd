extends Node2D
class_name Stage

# Represent the stage, it's pack and the presence or not of instruments on it

const PRIORITY: = 1
const Pack: = preload("../Pack/Pack.gd")
const MAIN_MENU_PATH: = "res://src/MainMenu/MainMenu.tscn"
const TAP_TIME: = 0.2
const INSTRUMENT_MUTE_DEADZONE: = 30
const PACK_POSITION_MARGIN: = 80

var max_instrument_position: = Vector2()
var min_instrument_position: = Vector2()
var init_data: = {pack_path = "res://src/Pack/CoelhoDaPascoa/CoelhoDaPascoa.tscn"}

var pack: Pack

var _moving: = {}
var _instrument_touch_origin: Vector2

onready var window_position: = get_position() / Vector2(1920, 1080)
onready var y_sort: YSort = $YSort
onready var recorder: Recorder = $Recorder
onready var pack_position: Position2D = $GUI/Control/ReferenceRect/Control/PackPosition
onready var back: TextureButton = $GUI/Control/ControllButtons/Back
onready var reference_rect: ReferenceRect = $GUI/Control/ReferenceRect
onready var position_effects: Node = $PositionEffects


func _ready():
	Global.stage = self
	add_child(pack, true)

	# Avoid a bug that would offset the pack position for some reason
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")

	refresh_positions()
	calculate_position_limits()
	recorder.recording_repeats = pack.recording_repeats

	Event.connect("clear_requested", self, "_on_Event_clear_requested")
	Event.connect("instrument_added", self, "_on_Event_instrument_added")
	Event.connect("stage_first_instrument_added", self, "_on_Event_stage_first_instrument_added")
	Event.connect("instrument_removed", self, "_on_Event_instrument_removed")
	MusicController.connect("playing_changed", self, "_on_MusicController_playing_changed")
	back.connect("pressed", self, "_on_Back_pressed")

	get_tree().connect("screen_resized", self, "_on_SceneTree_screen_resized")
	DSController.connect("drag_started", self, "_on_DSController_drag_started")
#	DSController.connect("drag_moved", self, "_on_DSController_drag_moved")


func _on_Event_clear_requested() -> void:
	if GameState.current == GameState.FREE:
		clear()
		MusicController.stop()

	elif GameState.current == GameState.RECORDING:
		clear()


func _on_Event_instrument_added(instrument: Instrument) -> void:
	if y_sort.get_child_count() == 1:
		Event.emit_signal("stage_first_instrument_added", instrument)

	instrument.activate()

	instrument.connect("input_event", self, "_on_instrument_input_event", [instrument])

	if y_sort.get_child_count() == pack.max_instruments_on_stage:
		Event.emit_signal("stage_full")


func _on_Event_stage_first_instrument_added(instrument: Instrument) -> void:
	if not MusicController.is_playing() and GameState.current != GameState.PLAYING:
		MusicController.play(MusicController.time)


func _on_Event_instrument_removed(instrument: Instrument) -> void:
	instrument.deactivate()
	instrument.disconnect("input_event", self, "_on_instrument_input_event")

	if y_sort.get_child_count() == 1:
		Event.emit_signal("stage_empty")

	elif y_sort.get_child_count() == pack.max_instruments_on_stage:
		Event.emit_signal("stage_available")


func _on_MusicController_playing_changed(is_playing: bool) -> void:
	OS.keep_screen_on = is_playing


func _on_Back_pressed() -> void:
	MusicController.stop()
	Event.emit_signal("scene_change_requested", MAIN_MENU_PATH)
	pass


func _on_SceneTree_screen_resized() -> void:
	refresh_positions()
	pass


func _on_DSController_drag_started(data: Dictionary) -> void:
	_moving.clear()
	pass


func _on_DSController_drag_moved(drag: Dictionary) -> void:
	# Disconnected signal because I think it is not needed
	# Keeping it just for sure for now
	var instrument: Instrument = drag.node
	if instrument:
		if instrument.global_position.y < min_instrument_position.y:
			instrument.global_position.y = min_instrument_position.y


func _on_instrument_input_event(
		viewport: Viewport,
		event: InputEvent,
		shape_id: int,
		instrument: Instrument
	) -> void:
	if GameState.current == GameState.PLAYING:
		return

	if event is InputEventScreenTouch:
		if event.pressed:
			if (_moving.has(event.index) and
					_moving[event.index].initial_position.y > instrument.position.y):
				return

			if DSController.has_drag(0):
				return

			var tap_timer: = Timer.new()
			add_child(tap_timer)
			tap_timer.connect("timeout", self, "_on_tap_timer_timeout", [tap_timer, instrument, event.index])
			tap_timer.wait_time = TAP_TIME
			tap_timer.one_shot = true
			tap_timer.start()

			_moving[event.index] = {
				initial_position = instrument.position,
				instrument = instrument,
				tap_timer = tap_timer
			}

			_instrument_touch_origin = event.position


func _on_tap_timer_timeout(tap_timer: Timer, instrument: Instrument, touch_index: int) -> void:
	if _moving.has(touch_index) and _moving[touch_index].instrument != instrument:
		return

	tap_timer.stop()
	tap_timer.queue_free()

	if _moving.size() >= touch_index + 1:
		_moving[touch_index].erase("tap_timer")


func _input(event: InputEvent) -> void:
	# This has to be done here because if a drag leaves the collision shape of
	# the instrument it will not receive the drag events anymore
	if event is InputEventScreenDrag:
		if _moving.has(event.index):
			var instrument: Instrument = _moving[event.index].instrument
			var new_position: Vector2 = event.position + instrument.drag_offset
			var character_extents: = instrument.get_character_collision_extents()

#			new_position.y = clamp(new_position.y,
#				min_instrument_position.y,
#				max_instrument_position.y
#			)
			new_position.x = clamp(new_position.x,
				min_instrument_position.x + character_extents.x * instrument.scale.x,
				max_instrument_position.x - character_extents.x * instrument.scale.x
			)

			instrument.global_position = new_position

			Event.emit_signal("instrument_moved", instrument)

	elif event is InputEventScreenTouch:
		if not event.pressed:
			if _moving.has(event.index):
				var move_data: Dictionary = _moving[event.index]
				var instrument: Instrument = move_data.instrument
				var tap_timer: Timer = move_data.get("tap_timer")

				# Tap: toggle mute instrument
				if tap_timer and _instrument_touch_origin.distance_to(event.position) < INSTRUMENT_MUTE_DEADZONE:
					if not instrument.is_muted:
						instrument.mute()
					else:
						instrument.unmute()

					tap_timer.stop()
					tap_timer.queue_free()
					move_data.erase("tap_timer")

				_moving.erase(event.index)

				if instrument.global_position.y < min_instrument_position.y \
						or instrument.global_position.y > max_instrument_position.y:
#						or instrument.global_position.x < min_instrument_position.x \
#						or instrument.global_position.x > max_instrument_position.x:
					withdraw(instrument)


func on_stage_count() -> int:
	return y_sort.get_child_count()


func ds_drag_released(drag: Dictionary) -> void:
	if y_sort.get_child_count() >= pack.max_instruments_on_stage:
		return

	if (drag.global_position.y < max_instrument_position.y and
			drag.global_position.y > min_instrument_position.y and
			drag.global_position.x < max_instrument_position.x and
			drag.global_position.x > min_instrument_position.x):
		DSController.accept(self, PRIORITY)


func ds_receive(drag: Dictionary) -> void:
	var instrument: Instrument = drag.node
	if not instrument:
		push_error("Invalid instrument received %s" % drag.node)
		return

	DSController.change_node_parent(instrument, y_sort)
	Event.emit_signal("instrument_added", instrument)


func present(instrument: Instrument, in_position: = Vector2()) -> void:
	DSController.change_node_parent(instrument, y_sort)
	instrument.owner_character.send(instrument, in_position)
	Event.emit_signal("instrument_added", instrument)


func withdraw(instrument: Instrument) -> void:
	Event.emit_signal("instrument_removed", instrument)
	instrument.return_to_character()


func is_on_stage(instrument: Instrument) -> bool:
	return y_sort.is_a_parent_of(instrument)


func clear() -> void:
	for instrument in y_sort.get_children():
		withdraw(instrument)


func refresh_positions() -> void:
	set_position(window_position * get_viewport().get_visible_rect().end)
	pack.global_position = pack_position.global_position
	min_instrument_position = reference_rect.rect_position
	max_instrument_position = reference_rect.rect_position + reference_rect.rect_size


func calculate_position_limits() -> void:
	min_instrument_position = reference_rect.rect_global_position
	max_instrument_position = reference_rect.get_global_rect().end


func load_dependencies() -> void:
	assert(init_data.has("pack_path"), "The scene Stage needs pack_path defined in it's init_data")

	pack = load(init_data.pack_path).instance()
