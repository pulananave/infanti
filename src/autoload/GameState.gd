extends Node

signal changed(to)

enum {
	FREE,
	RECORDING,
	PLAYING,
}

const DEFAULT_STATE: int = FREE

var current: int = DEFAULT_STATE


func _ready() -> void:
	Event.connect("scene_changed", self, "_on_Event_scene_changed")


func change(state: int) -> void:
	current = state
	emit_signal("changed", current)


func _on_Event_scene_changed() -> void:
	change(DEFAULT_STATE)
