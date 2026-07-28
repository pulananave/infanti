extends Button


var record: Record

onready var y_sort: YSort = $YSort


func _ready() -> void:
	connect("pressed", self, "_on_pressed")


func use(textures: Array) -> void:
	for i in textures.size():
		if i >= y_sort.get_child_count():
			break

		var sprite: Sprite = y_sort.get_child(i).get_node("Sprite")
		sprite.texture = textures[i]


func _on_pressed() -> void:
	Event.emit_signal("play_record_requested", record)
