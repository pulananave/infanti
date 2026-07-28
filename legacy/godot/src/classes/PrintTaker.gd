extends Node

export(String, "LANDSCAPE", "PORTRAIT") var orientation: = "LANDSCAPE"
export(String, DIR) var output_dir: = ""
export var prefix: = ""

var print_configs: = [
	{resolution = Vector2(1920, 1080), inches = "original"},
	{resolution = Vector2(2688, 1242), inches = "65"},
	{resolution = Vector2(2436, 1125), inches = "58"},
	{resolution = Vector2(2208, 1242), inches = "55"},
	{resolution = Vector2(1334, 750), inches = "47"},
	{resolution = Vector2(1096, 640), inches = "40"},
	{resolution = Vector2(920, 640), inches = "35"},
	{resolution = Vector2(2732, 2048), inches = "129"},
	{resolution = Vector2(2388, 1668), inches = "110"},
	{resolution = Vector2(2224, 1668), inches = "150"},
	{resolution = Vector2(2008, 1536), inches = "97"},
	{resolution = Vector2(1004, 768), inches = "97"},
]


func _input(event: InputEvent):
	if event is InputEventKey:
		if event.scancode == KEY_P and event.pressed:
			for config in print_configs:
				print_debug("Printing (resolution: %s inches: %s)" % [config.resolution,
						config.inches])
				OS.set_window_size(config.resolution)
				yield(get_tree(), "idle_frame")
				yield(get_tree(), "idle_frame")
				yield(get_tree(), "idle_frame")
				yield(get_tree(), "idle_frame")
				yield(get_tree(), "idle_frame")
				yield(get_tree(), "idle_frame")
				var image = get_viewport().get_texture().get_data()
				image.flip_y()
				var width: int = config.resolution.x if orientation == "LANDSCAPE" else config.resolution.y
				var height: int = config.resolution.y if orientation == "LANDSCAPE" else config.resolution.x
				image.save_png(output_dir.plus_file("%s%s_%dx%d.png" % [prefix, config.inches, width, height]))

			print_debug("Done, saved at %s" % output_dir)
