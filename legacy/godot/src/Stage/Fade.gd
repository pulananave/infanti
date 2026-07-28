extends Node


func _ready():
	Event.connect("character_selected", self, "_on_Event_character_selected")
	Event.connect("character_deselected", self, "_on_Event_character_deselected")


func _on_Event_character_selected(character: Character) -> void:
	$Overlay/AnimationPlayer.play('fade_in')
	pass


func _on_Event_character_deselected(character: Character) -> void:
	if $Overlay.visible:
		$Overlay/AnimationPlayer.play('fade_out')
