extends Node2D

var type: String

onready var icon: Sprite

func _ready():
	for child in get_children():
		child.hide()

	type = get_parent().type

	icon = get_node_or_null(type)

	if not icon:
		icon = get_child(0)

		if not icon:
			return

	icon.show()
