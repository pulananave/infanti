extends Node
class_name Recorder

# Record and play recordings

const ScnSavedRecordButton: = preload("res://src/SavedRecordButton/SavedRecordButton.tscn")

const MIN_NORMALIZED_MOVEMENT: = 0.01

export var gui_recordings_path: NodePath

var recording_repeats: int # Set by Stage with the value of the current pack

var _record: Record = Record.new()
var _instruments: = {}
var _recordings_path: String = ProjectSettings.get("global/recordings_path")
var _times_looped: = 0

onready var stage: Node2D = get_parent()


func _ready() -> void:
	Event.connect("StartRecording_toggled", self, "_on_Event_StartRecording_toggled")
	Event.connect("Save_pressed", self, "_on_Event_Save_pressed")
	Event.connect("Cancel_pressed", self, "_on_Event_Cancel_pressed")
	Event.connect("play_record_requested", self, "_on_Event_play_record_requested")
	Event.connect("eject_record_requested", self, "_on_Event_eject_record_requested")
	Event.connect("clear_requested", self, "_on_Event_clear_requested")
	MusicController.connect("looped", self, "_on_MusicController_looped")


func _on_Event_StartRecording_toggled(pressed: bool) -> void:
	if pressed:
		start()
	else:
		if GameState.current == GameState.RECORDING:
			stop()


func _on_Event_Save_pressed(record_name: String) -> void:
	if not record_name:
		return

	var folder_path: = _recordings_path.plus_file(stage.pack.name)
	var directory: = Directory.new()
	if  not directory.dir_exists(folder_path):
		directory.make_dir_recursive(folder_path)

	var path: = folder_path.plus_file(record_name + ".tres")

	_record.name = record_name
	_record.duration = get_elapsed_time()

	ResourceSaver.save(path, _record)
	print_debug("Saved record at %s" % path)

	eject()


func _on_Event_Cancel_pressed() -> void:
	eject()


func _on_Event_play_record_requested(record: Record) -> void:
	_record = record
	GameState.change(GameState.PLAYING)
	stage.clear()
	MusicController.play()


func _on_Event_eject_record_requested() -> void:
	eject()


func _on_Event_clear_requested() -> void:
	match GameState.current:
		GameState.PLAYING:
			eject()


func _on_Event_instrument_added(instrument: Instrument) -> void:
	_record.save_instrument_state(get_elapsed_time(), instrument)


func _on_Event_instrument_moved(instrument: Instrument) -> void:
	var at: = get_elapsed_time()
	var current_state: = _record.get_state(at)
	var instrument_state: Dictionary = current_state.instruments.get(instrument.name, {})

	if not instrument_state.empty():
		var state_normalized_position: Vector2 = instrument_state.normalized_position
		var current_normalized_position: Vector2 = instrument.get_normalized_position()

		if state_normalized_position.distance_to(current_normalized_position) >= MIN_NORMALIZED_MOVEMENT:
			_record.save_instrument_state(at, instrument)

	else:
		_record.save_instrument_state(at, instrument)


func _on_Event_instrument_mute_toggled(instrument: Instrument) -> void:
	_record.save_instrument_state(get_elapsed_time(), instrument)


func _on_Event_scene_change_requested() -> void:
	match GameState.current:
		GameState.PLAYING, GameState.RECORDING:
			eject()


func _on_Event_instrument_removed(instrument: Instrument) -> void:
	_record.save_instrument_state(get_elapsed_time(), instrument)
	pass


func _on_MusicController_looped() -> void:
	match GameState.current:
		GameState.RECORDING:
			_times_looped += 1

			if _times_looped >= recording_repeats:
				stop()

		GameState.PLAYING:
			_times_looped += 1

			if _times_looped >= recording_repeats:
				eject()


func _process(delta: float) -> void:
	if not _record or GameState.current != GameState.PLAYING:
		return

	if get_elapsed_time() >= _record.duration:
		eject()
		return

	var state: = _record.get_state(get_elapsed_time())
	var instruments_states = state.get("instruments")

	if not instruments_states:
		stage.clear()
		return

	for instrument_name in instruments_states:
		var instrument: Instrument = stage.pack.instruments_by_name[instrument_name]
		sync_to_state(instrument, state.instruments[instrument_name])


func sync_to_state(instrument: Instrument, instrument_state: Dictionary) -> void:
	if stage.is_on_stage(instrument) != instrument_state.is_on_stage:
		if instrument_state.is_on_stage:
			stage.present(instrument)
			stage.position_effects.apply_effects(instrument)

		else:
			stage.withdraw(instrument)

	if instrument_state.is_on_stage:
		instrument.set_normalized_position(instrument_state.normalized_position)
		stage.position_effects.apply_effects(instrument)

	if instrument.is_muted != instrument_state.is_muted:
		if instrument_state.is_muted:
			instrument.mute()
		else:
			instrument.unmute()


func start() -> void:
	_record = Record.new()
	# There is a weird bug where the line above doesn't create a new object but
	# return the same
	_record.states = []
	_record.used_instruments = []

	Event.connect("instrument_added", self, "_on_Event_instrument_added")
	Event.connect("instrument_moved", self, "_on_Event_instrument_moved")
	Event.connect("instrument_removed", self, "_on_Event_instrument_removed")
	Event.connect("instrument_mute_toggled", self, "_on_Event_instrument_mute_toggled")
	Event.connect("scene_change_requested", self, "_on_Event_scene_change_requested")

	MusicController.stop()
	GameState.change(GameState.RECORDING)
	if stage.on_stage_count():
		MusicController.play()

	for instrument in stage.y_sort.get_children():
		_record.save_instrument_state(get_elapsed_time(), instrument)


func stop() -> void:
	Event.disconnect("instrument_added", self, "_on_Event_instrument_added")
	Event.disconnect("instrument_moved", self, "_on_Event_instrument_moved")
	Event.disconnect("instrument_removed", self, "_on_Event_instrument_removed")
	Event.disconnect("instrument_mute_toggled", self, "_on_Event_instrument_mute_toggled")

	GameState.change(GameState.FREE)

	var gui_recordings = get_node(gui_recordings_path)
	gui_recordings.refresh()
	save("%d" % (gui_recordings.get_newest_recording_number() + 1))

	Event.emit_signal("recording_stopped")

	eject()


func eject() -> void:
	GameState.change(GameState.FREE)
	stage.clear()

	_record = null
	_times_looped = 0
	MusicController.stop()

	Event.emit_signal("record_ejected")


func save(record_name: String) -> void:
	if _record.used_instruments.empty():
		return

	var folder_path: = _recordings_path.plus_file(stage.pack.name)
	var directory: = Directory.new()
	if not directory.dir_exists(folder_path):
		directory.make_dir_recursive(folder_path)

	var path: = folder_path.plus_file(record_name + ".tres")

	_record.name = record_name
	_record.duration = get_elapsed_time()

	ResourceSaver.save(path, _record)
	print_debug("Saved record at %s" % path)


func get_elapsed_time() -> float:
	return MusicController.duration * _times_looped + MusicController.time


func get_duration() -> float:
	return _record.duration if _record and _record.duration \
			else recording_repeats * MusicController.duration
