tool
extends Node

export var spread: = false setget set_spread
export var x_center: = -60.0
export var separation: = 130.0


func _ready():
	refresh()
	pass


func set_spread(value: bool) -> void:
	refresh()


func refresh() -> void:
	var pack: Node2D = get_parent()
	var amount: = pack.get_child_count() - 1
	var start: = x_center - amount * separation / 2.0

	for i in range(1, amount + 1):
		pack.get_child(i).position.x = start + i * separation
	pass
