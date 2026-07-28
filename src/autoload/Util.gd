extends Node

# Utility functions to be loaded as a singleton

# Returns an array with the recordings for a pack
func get_saved_recordings(pack_name: String) -> Array:
	var recordings: = []
	var recordings_path: String = ProjectSettings.get("global/recordings_path")

	var directory: = Directory.new()
	var folder_path: = recordings_path.plus_file(pack_name)

	if  not directory.dir_exists(folder_path):
		directory.make_dir_recursive(folder_path)

	var error: = directory.open(folder_path)
	if error != OK:
		push_error("Couldn't open recordings path error number %s" % error)
		return []

	directory.list_dir_begin(true, true)

	var file_name: = directory.get_next()
	while file_name:
		var record: Record = load(folder_path.plus_file(file_name))
		recordings.append(record)

		file_name = directory.get_next()

	return recordings


func delete_recording(pack_name: String, recording_name: String) -> void:
	var recordings_path: String = ProjectSettings.get("global/recordings_path")
	var directory: = Directory.new()
	var folder_path: = recordings_path.plus_file(pack_name)

	var file_path: = folder_path.plus_file("%s.tres" % recording_name)

	if not file_path:
		return

	directory.remove(file_path)
