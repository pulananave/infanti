tool
extends CircleButton

func _ready():
	Event.connect("play_record_requested", self, "_on_Event_play_record_requested")
	Event.connect("eject_record_requested", self, "_on_Event_eject_record_requested")
	pass


func _on_Event_play_record_requested(path: String) -> void:
	hide()
	pass


func _on_Event_eject_record_requested() -> void:
	show()
	pass
