extends Node

const DEBUG_CONTROLS_PATH: = '/root/Main/Overlay/DebugControls'
const InGameTerminal: = preload("res://src/InGameTerminal/InGameTerminal.gd")

var active: = false setget set_active

onready var debug_controls: Control = get_node(DEBUG_CONTROLS_PATH)
var terminal: InGameTerminal


func _ready() -> void:
	if debug_controls:
		debug_controls.get_node("InGameTerminal")

	set_active(active)
	if debug_controls:
		debug_controls.set_visible(active)


func toggle() -> void:
	set_active(not active)


func set_active(value: bool) -> void:
	active = value
	set_process_input(active)
	set_process_unhandled_input(active)
	set_process_unhandled_key_input(active)
	set_process(active)
	set_process_internal(active)
	set_physics_process(active)
	set_physics_process_internal(active)

	if debug_controls:
		debug_controls.set_visible(active)
