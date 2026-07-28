extends Node

# General
signal scene_change_requested(path, data)
signal scene_changed

# Stage
signal character_selected(character)
signal character_deselected(character)

signal instrument_added(instrument)
signal instrument_removed(instrument)
signal instrument_moved(instrument)
signal instrument_mute_toggled(intrument)

signal stage_first_instrument_added(instrument)
signal stage_empty
signal stage_full
signal stage_available
signal clear_requested
signal state_changed(new_state, old_state)

signal StartRecording_toggled(pressed)
signal Save_pressed(record_name)
signal Cancel_pressed()

signal recording_stopped()
signal record_ejected()
signal play_record_requested(record)
signal eject_record_requested()
