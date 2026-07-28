tool
extends CircleButton

func _ready():
	connect("pressed", self, "_on_pressed")
	Event.connect("play_record_requested", self, "_on_Event_play_record_requested")
	Event.connect("eject_record_requested", self, "_on_Event_eject_record_requested")
	pass


func _on_pressed() -> void:
	Event.emit_signal("eject_record_requested")


func _on_Event_play_record_requested(path: String) -> void:
	show()
	pass


func _on_Event_eject_record_requested() -> void:
	hide()
	pass
