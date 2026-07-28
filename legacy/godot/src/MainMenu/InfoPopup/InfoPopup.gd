extends Popup

onready var close: TextureButton = $Background/Close


func _ready():
	close.connect("pressed", self, "_on_Close_pressed")
	pass


func _on_Close_pressed() -> void:
	hide()
