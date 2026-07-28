extends Node

export(String, FILE, "*.tscn") var first_scene_path: String
export var first_scene_data: = {}

var _recordings_path: String = ProjectSettings.get("global/recordings_path")
var _current_scene_root: Node
var _scene_change_thread: = Thread.new()
var _changing_scene: = false

onready var transition: Control = $Overlay/Transition


func _ready():
	# User Folder Structure
	print_debug("User data dir: ", OS.get_user_data_dir())
	var directory: = Directory.new()
	if not directory.dir_exists(_recordings_path):
		directory.make_dir(_recordings_path)

#	transition.fade_in()
	_current_scene_root = load(first_scene_path).instance()
	_current_scene_root.init_data = first_scene_data
	add_child(_current_scene_root)

	Event.connect("scene_change_requested", self, "_on_Event_scene_change_requested")


func _on_Event_scene_change_requested(scene_path: String, data: = {}) -> void:
	if _changing_scene:
		return

	_changing_scene = true

	transition.fade_in()
	yield(transition, "finished")
	_scene_change_thread.start(self, "thread_change_scene", {scene_path = scene_path, data = data})
	yield(Event, "scene_changed")
	_scene_change_thread.wait_to_finish()
	transition.fade_out()

	_changing_scene = false

	if _current_scene_root.name != "Stage":
		return


func change_scene(scene_path: String, data: = {}) -> void:
	print_debug("Freeing current scene")
	_current_scene_root.queue_free()
	print_debug("Loading new scene")
	var packed_scene = load(scene_path)
	print_debug("Instancing new scene")
	_current_scene_root = packed_scene.instance()
	print_debug("Setting new scene init_data")
	_current_scene_root.init_data = data
	if _current_scene_root.has_method("load_dependencies"):
		print_debug("Calling new scene load_dependencies")
		_current_scene_root.load_dependencies()
	print_debug("Adding new scene as a child")
#	add_child(_current_scene_root, true)
	call_deferred('add_child', _current_scene_root, true)

	Event.emit_signal("scene_changed")

func thread_change_scene(user_data: = {}) -> void:
	change_scene(user_data.scene_path, user_data.data)


func reload_current_scene() -> void:
	var init_data: Dictionary = _current_scene_root.init_data
	var current_scene_filename = _current_scene_root.filename

	_current_scene_root.queue_free()
	_current_scene_root = load(current_scene_filename).instance()
	_current_scene_root.init_data = init_data

	add_child(_current_scene_root)


func _input(event: InputEvent) -> void:
	if event is InputEventKey:
		if event.shift:
			if event.scancode == KEY_F1 and event.pressed:
				Debug.toggle()
