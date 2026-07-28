extends Control

onready var h_box_container: HBoxContainer = $HBoxContainer
onready var email: Button = $Email

func _ready():
	for child in h_box_container.get_children():
		child.connect("pressed", self, "_on_button_pressed", [child])

	email.connect("pressed", self, "_on_button_pressed", [email])


func _on_button_pressed(button) -> void:
	match button.name:
		"Instagram":
			OS.shell_open('https://www.instagram.com/muzer.me/')

		"Facebook":
			OS.shell_open('https://www.facebook.com/muzer.me/')

		"Twitter":
			OS.shell_open('https://twitter.com/MuzerMe')

		"YouTube":
			OS.shell_open('https://www.youtube.com/channel/UCDoh3ZL6iqc3CL_EMj8lHAA')

		"Email":
			OS.shell_open('mailto:info@muzer.me')
