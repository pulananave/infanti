extends Popup

const Stage: = preload("res://src/Stage/Stage.gd")
const ScnSavedRecordButton = preload("res://src/SavedRecordButton/SavedRecordButton.tscn")

export var fade_animation_player_path: NodePath

onready var stage: Stage = owner
onready var grid_container: GridContainer = $GridContainer
onready var close: TextureButton = $Close
onready var fade_animation_player: AnimationPlayer = get_node(fade_animation_player_path)


func _ready():
	close.connect("pressed", self, "_on_Close_pressed")
	connect("about_to_show", self, "_on_about_to_show")
	connect("popup_hide", self, "_on_popup_hide")
	Event.connect("play_record_requested", self, "_on_Event_play_record_requested")


func _on_Close_pressed() -> void:
	hide()


func _on_popup_hide() -> void:
	fade_animation_player.play('fade_out')


func get_recordings_count() -> int:
	refresh()
	return grid_container.get_child_count()


func get_oldest_recording_number() -> int:
	if not grid_container.get_child_count():
		return 0

	return grid_container.get_child(grid_container.get_child_count() - 1).name as int


func get_newest_recording_number() -> int:
	if not grid_container.get_child_count():
		return 0

	return grid_container.get_child(0).name as int


func refresh() -> void:
	var recordings: = Util.get_saved_recordings(stage.pack.name)
	recordings.sort_custom(self, '_is_smaller_than')

	# TODO(Luiz) Após a deleção de uma gravação os nomes não vão estar de acordo
	# com o número de gravações
	for record in recordings:
		var existing_record = grid_container.get_node_or_null(record.name)
		if existing_record:
			grid_container.move_child(existing_record, 0)
			continue

		var textures: = []
		var record_button: = ScnSavedRecordButton.instance()

		grid_container.add_child(record_button)
		grid_container.move_child(record_button, 0)

		for instrument_name in record.used_instruments:
			textures.append(Global.instruments[instrument_name].get_frame_texture(0))

		record_button.name = record.name
		record_button.use(textures)
		record_button.record = record

	for i in range(9, recordings.size()):
		var old_record = grid_container.get_child(i)
		Util.delete_recording(stage.pack.name, old_record.name)
		old_record.queue_free()


func _is_smaller_than(record_a, record_b) -> bool:
	return int(record_a.name) < int(record_b.name)


func _on_about_to_show() -> void:
	fade_animation_player.play('fade_in')
	refresh()


func _on_Event_play_record_requested(record: Record) -> void:
	hide()
