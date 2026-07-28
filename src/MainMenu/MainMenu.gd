extends Control


export(String, FILE, "*.tscn") var stage_scene_path: String

var init_data: = {}

onready var packs: HBoxContainer = $Packs
onready var info: TextureButton = $Info
onready var info_popup: Popup = $InfoPopup


func _ready():
	for ticket in packs.get_children():
		ticket.connect("pressed", self, "_on_ticket_pressed", [ticket])

	info.connect("pressed", self, "_on_Info_pressed")


func _on_ticket_pressed(ticket: TextureButton) -> void:
	if not ticket.pack_path:
		return

	Event.emit_signal("scene_change_requested", stage_scene_path, {pack_path = ticket.pack_path})


func _on_Info_pressed() -> void:
	info_popup.popup()
