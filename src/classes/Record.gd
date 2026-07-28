class_name Record
extends Resource

# State list format:
#
# states = [
#   {
#      time: float,
#      instruments: {
#         name: {
#            is_on_stage: bool,
#            is_muted: bool,
#            normalized_position: Vector2,
#         },
#         ...
#      }
#   },
#	...
# ]


export var name: = "Nova Gravação"
export var duration: =  0.0
export var states: = []
export var used_instruments: = [] # Populated by the recorder, has instruments names

# Save the instrument state at exactly `time`. Creates a new state if needed.
func save_instrument_state(at: float, instrument: Instrument) -> void:
	var instrument_state: = _extract_instrument_state(instrument)
	var index: = states.bsearch_custom(at, self, "_comes_before", true)

	if index == states.size() or states[index].time != at:
		var new_state: = _construct_state(at, {instrument.name: instrument_state})
		states.insert(index, new_state)

	else:
		states[index].instruments[instrument.name] = instrument_state

	if not instrument.name in used_instruments:
		used_instruments.append(instrument.name)


# Return the state at the time passed or the an empty state if states is empty
func get_state(at: float) -> Dictionary:
	var index: = states.bsearch_custom(at, self, "_comes_before")

	if not states.empty():
		var state: Dictionary = states[index - 1] if index else states[index]

		return state

	return {}


func _extract_instrument_state(instrument: Instrument) -> Dictionary:
	return {
		is_on_stage = instrument.is_active(),
		is_muted = instrument.is_muted,
		normalized_position = instrument.get_normalized_position(),
	}


func _construct_state(time: = 0.0, instruments: = {}) -> Dictionary:
	return {
		time = time,
		instruments = instruments,
	}


func _comes_before(state: Dictionary, time: float) -> bool:
	return state.time < time
