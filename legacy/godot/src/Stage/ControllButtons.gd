extends Control

export var gui_recordings_path: NodePath


func _ready():
	$Clear.connect("pressed", self, "_on_Clear_pressed")
	$StartRecording.connect("toggled", self, "_on_StartRecording_toggled")
	$Library.connect("pressed", self, "_on_Library_pressed")
	Event.connect("recording_stopped", self, "_on_Event_recording_stopped")
	GameState.connect("changed", self, "_on_GameState_changed")
	pass


func _on_Clear_pressed() -> void:
	Event.emit_signal("clear_requested")


func _on_StartRecording_toggled(pressed: bool) -> void:
	Event.emit_signal("StartRecording_toggled", pressed)


func _on_Library_pressed() -> void:
	if GameState.current == GameState.PLAYING:
		Event.emit_signal("eject_record_requested")

	else:
		var gui_recordings: Popup = get_node(gui_recordings_path)
		gui_recordings.popup()


func _on_Event_recording_stopped() -> void:
	$StartRecording.pressed = false


func _on_GameState_changed(to: int) -> void:
	$Library.disabled = to == GameState.RECORDING
	$StartRecording.disabled = to == GameState.PLAYING
