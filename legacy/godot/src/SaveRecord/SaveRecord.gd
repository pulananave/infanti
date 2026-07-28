extends PopupPanel


onready var save: Button = $VBoxContainer/HBoxContainer/Save
onready var cancel: Button = $VBoxContainer/HBoxContainer/Cancel
onready var line_edit: LineEdit = $VBoxContainer/HBoxContainer/LineEdit


func _ready():
	save.connect("pressed", self, "_on_Save_pressed")
	cancel.connect("pressed", self, "_on_Cancel_pressed")
	Event.connect("StartRecording_toggled", self, "_on_Event_StartRecording_toggled")


func _on_Save_pressed() -> void:
	hide()
	Event.emit_signal("Save_pressed", line_edit.text)


func _on_Cancel_pressed() -> void:
	hide()
	Event.emit_signal("Cancel_pressed")


func _on_Event_StartRecording_toggled(pressed: bool) -> void:
	if not pressed:
		popup_centered()
