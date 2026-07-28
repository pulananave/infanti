extends ColorRect

func _ready():
	hide()

#	Event.connect("instrument_removed", self, "_on_Event_instrument_removed")
#	DSController.connect("drag_ended", self, "_on_DSController_drag_ended")


func _on_Event_instrument_removed(instrument: Instrument) -> void:
	if GameState.current == GameState.FREE:
		show()


func _on_DSController_drag_ended(drag: Dictionary) -> void:
	hide()
