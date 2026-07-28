extends Control


func _ready():
	GameState.connect("changed", self, "_on_GameState_changed")
	$AnimationPlayer.playback_speed = MusicController.bpm / 60.0
	pass


func _on_GameState_changed(to: int) -> void:
	if to == GameState.PLAYING:
		show()
		$AnimationPlayer.play()
	else:
		hide()
