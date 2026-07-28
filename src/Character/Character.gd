extends Area2D
class_name Character

export(String, "LEFT", "MIDDLE", "RIGHT") var box_direction: = "RIGHT" setget set_box_direction
export var instrument_scene: PackedScene
export(int, 0, 15) var instrument_use_limit: = 0
export var inactive_modulate: = Color(0.6, 0.6, 0.6)

const MIN_DRAG_DISTANCE: = 25
const SHOW_DURATION: = 0.3
const HIDE_DURATION: = 0.3

const SHOW_Z_INDEX: = 3
const HIDE_Z_INDEX: = 0
const PRIORITY: = 0
const HIGH_PRIORITY: = 999

var _touch_position: = Vector2.ZERO
var _instruments_visible: = false
var _used_instruments: = 0 setget set_used_instruments
var _active: = true
var _min_angle: float = -PI
var _max_angle: float = 0.0
var _show_positions: = {}
var _spread_distance: = Vector2(220 * 0.7, 0)

onready var tween: Tween = $Tween
onready var instruments: Node2D = $Instruments
onready var instruments_box: NinePatchRect = $BoxZIndex/InstrumentsBox
onready var box_z_index: Node2D = $BoxZIndex
onready var icon: TextureButton = $Icon
onready var collision_shape2D: CollisionShape2D = $CollisionShape2D

onready var _spread_origin_left: Position2D = $BoxZIndex/InstrumentsBox/SpreadOriginLeft
onready var _spread_origin_middle: Position2D = $BoxZIndex/InstrumentsBox/SpreadOriginMiddle
onready var _spread_origin_right: Position2D = $BoxZIndex/InstrumentsBox/SpreadOriginRight


func _ready():
	Event.connect("stage_full", self, "_on_Event_stage_full")
	Event.connect("stage_available", self, "_on_Event_stage_available")
	DSController.connect("drag_moved", self, "_on_DSController_drag_moved")


func _on_Event_stage_full() -> void:
	deactivate()


func _on_Event_stage_available() -> void:
	if instrument_use_limit:
		if _used_instruments < instrument_use_limit:
			activate()
	else:
		activate()


func _on_DSController_drag_moved(drag: Dictionary) -> void:
	var instrument: Instrument = drag.node
	if instrument and instrument.owner_character == self \
			and _instruments_visible:
		hide_instruments()

var _pressed: = false
func _input_event(viewport: Object, event: InputEvent, shape_id: int) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			_pressed = true
		else:
			if _pressed:
				if _instruments_visible:
					hide_instruments()
				else:
					if _active and GameState.current != GameState.PLAYING:
						show_instruments()

				_pressed = false


func _on_instrument_input_event(viewport: Viewport, event: InputEvent, shape_id: int, instrument: Instrument) -> void:
	if event is InputEventScreenDrag:
		if _instruments_visible and _touch_position.distance_to(event.position) > MIN_DRAG_DISTANCE:
			tween.remove(instrument, "position")
			DSController.change_node_parent(instrument, DSController)
			DSController.start_dragging(
				self,
				instrument,
				event.index,
				instrument.drag_offset)

	elif event is InputEventScreenTouch:
		if event.pressed:
			_touch_position = event.position


func _on_instrument_tree_exiting(instrument: Instrument) -> void:
	if instrument.get_parent() == instruments:
		set_used_instruments(_used_instruments + 1)


func _on_instrument_tree_entered(instrument: Instrument) -> void:
	if instrument.get_parent() == instruments:
		set_used_instruments(_used_instruments - 1)


func _input(event: InputEvent) -> void:
	if not _instruments_visible: return

	if event is InputEventScreenTouch:
		if not event.pressed:
			if not has_point(event.position):
				hide_instruments()


func has_point(global_point: Vector2) -> bool:
	var shape: RectangleShape2D = collision_shape2D.shape

	if shape:
		var start: Vector2 = collision_shape2D.global_position - shape.extents
		var size: Vector2 = shape.extents * 2.0
		var global_rect: = Rect2(start, size)

		return global_rect.has_point(global_point)

	push_error("CollisionShape2D doesn't have a valid RectangleShape2D")
	return false


func add_instrument(
		stream: AudioStream,
		type: String,
		bars: int,
		bpm: float,
		min_volume_db: = -20.0,
		max_volume_db: = 0.0
	) -> Instrument:
	var instrument: Instrument = instrument_scene.instance()
	instrument.type = type
	instrument.name = "%s%s" % [name, type]
	instrument.bpm = bpm
	instrument.modulate = Color(1.0, 1.0, 1.0, .0)
	instrument.owner_character = self
	instrument.stream = stream
	instrument.bars = bars
	instrument.min_volume_db = min_volume_db
	instrument.max_volume_db = max_volume_db
	instruments.add_child(instrument, true)
	instrument.connect("input_event", self, "_on_instrument_input_event", [instrument])
	instrument.connect("tree_exiting", self, "_on_instrument_tree_exiting", [instrument])
	instrument.connect("tree_entered", self, "_on_instrument_tree_entered", [instrument])

	Global.instruments[instrument.name] = instrument

	return instrument


func activate() -> void:
	modulate = Color(1, 1, 1)
	_active = true


func deactivate() -> void:
	modulate = inactive_modulate
	_active = false


func calculate_show_positions() -> void:
	instruments_box.instruments_number = instruments.get_child_count()
	var spread_origin: Position2D

	match instruments_box.mode:
		'LEFT':
			spread_origin = _spread_origin_left
		'MIDDLE':
			spread_origin = _spread_origin_middle
		'RIGHT':
			spread_origin = _spread_origin_right

		_:
			spread_origin = _spread_origin_right
			push_warning("InstrumentsBox mode set to wrong value. Using spread origin right.")

	# Give time to the rect transformations on set_instruments_number to occurr
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")
	yield(get_tree(), "idle_frame")



	var i = 0
	for instrument in instruments.get_children():
		_show_positions[instrument] = (to_local(spread_origin.global_position) + _spread_distance * i)
		i += 1


func show_instruments() -> void:
	for instrument in instruments.get_children():
		# Avoids weird bug
		if not _show_positions.has(instrument):
			return

		var delay: = rand_range(0.0, 0.2)

		send(
			instrument,
			_show_positions[instrument],
			1.0,
			delay
		)

	icon.pressed = true
	z_index = SHOW_Z_INDEX
	_instruments_visible = true
	box_z_index.show()
	Event.emit_signal("character_selected", self)


func hide_instruments() -> void:
	for instrument in instruments.get_children():
		send(
			instrument,
			Vector2.ZERO,
			0.0
		)

	icon.pressed = false
	z_index = HIDE_Z_INDEX
	_instruments_visible = false
	box_z_index.hide()
	Event.emit_signal("character_deselected", self)


func ds_drag_released(drag: Dictionary) -> void:
	var instrument: Instrument = drag.node
	if instrument and instrument.owner_character == self:
		DSController.accept(self, PRIORITY)


func ds_receive(drag) -> void:
	recall(drag.node)


func send(instrument: Instrument, to: Vector2, alpha: = 1.0, delay: = 0.0) -> void:
	tween.remove(instrument)
	tween.interpolate_property(
		instrument,
		"position",
		instrument.position,
		to,
		HIDE_DURATION,
		Tween.TRANS_CUBIC,
		Tween.EASE_OUT,
		delay
	)
	tween.interpolate_property(
		instrument,
		"modulate",
		instrument.modulate,
		Color(1, 1, 1, alpha),
		HIDE_DURATION,
		Tween.TRANS_CUBIC,
		Tween.EASE_OUT,
		delay
	)

	tween.start()


func recall(instrument: Instrument) -> void:
	DSController.change_node_parent(instrument, instruments)
	instruments.move_child(instrument, instrument.index)
	instrument.deactivate()
	hide_instruments()


func set_box_direction(value: String) -> void:
	box_direction = value

	if not instruments_box:
		yield(self, "ready")

	instruments_box.mode = box_direction


func set_used_instruments(value: int) -> void:
	_used_instruments = value

	if instrument_use_limit:
		if _used_instruments >= instrument_use_limit:
			deactivate()
		else:
			activate()
