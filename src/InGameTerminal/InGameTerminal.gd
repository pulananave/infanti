extends Control

onready var console: RichTextLabel = $RichTextLabel
onready var input: LineEdit = $LineEdit


func write(line: String) -> void:
	console.text += "%s\n" % (line if line else "")
