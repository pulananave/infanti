extends Control


func _ready():
	GameState.connect("changed", self, "_on_GameState_changed")
	pass


func _on_GameState_changed(to: int) -> void:
	if to == GameState.RECORDING:
		show()
	else:
		hide()
