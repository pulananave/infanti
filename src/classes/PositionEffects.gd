extends Node
class_name PositionEffects

var _scale_max_decrease: = Vector2(0.2, 0.5)

onready var stage: Stage = get_parent()


func _ready() -> void:
	if not stage:
		push_error("PositionEffects has to be a child of Stage.")
		return

	Event.connect("instrument_added", self, "_on_Event_instrument_added")
	Event.connect("instrument_moved", self, "_on_Event_instrument_moved")
	Event.connect("instrument_removed", self, "_on_Event_instrument_removed")


func _on_Event_instrument_added(instrument: Instrument) -> void:
	apply_effects(instrument)


func _on_Event_instrument_moved(instrument: Instrument) -> void:
	apply_effects(instrument)


func _on_Event_instrument_removed(instrument: Instrument) -> void:
	remove_effects(instrument)


func apply_effects(instrument: Instrument) -> void:
	instrument.set_volume_db(
		calculate_volume_db(
			instrument,
			stage.min_instrument_position.y,
			stage.max_instrument_position.y
		)
	)

	instrument.scale.x = calculate_scale(
		instrument,
		stage.min_instrument_position.y,
		stage.max_instrument_position.y,
		stage.min_instrument_position.x,
		stage.max_instrument_position.x
	)
	instrument.scale.y = instrument.scale.x


func remove_effects(instrument: Instrument) -> void:
	instrument.scale = Vector2(1, 1)


func calculate_volume_db(
		instrument: Instrument,
		min_y_position: float,
		max_y_position: float
	) -> float:
	var volume_db: float = range_lerp(
		instrument.get_global_position().y,
		min_y_position,
		max_y_position,
		instrument.min_volume_db,
		instrument.max_volume_db
	)
	instrument.set_volume_db(volume_db)

	return volume_db


func calculate_scale(
	instrument: Instrument,
	min_y_position: float,
	max_y_position: float,
	min_x_position: float,
	max_x_position: float
) -> float:
	var scale_decrease: = Vector2(
		range_lerp(
			abs(instrument.get_position().x),
			min_x_position,
			max_x_position,
			0,
			_scale_max_decrease.x
		),
		range_lerp(
			instrument.get_global_position().y,
			min_y_position,
			max_y_position,
			_scale_max_decrease.y,
			0
		)
	)

	return 1.0 - clamp(
		scale_decrease.x + scale_decrease.y,
		0.0,
		_scale_max_decrease.x + _scale_max_decrease.y
	)
