tool
extends Node2D

var type: String

onready var animated_sprite: AnimatedSprite

func _ready():
	if Engine.editor_hint:
		for child in get_children():
			child.set_scene_instance_load_placeholder(true)
		return

	hide()
	type = owner.type

	var placeholder: InstancePlaceholder = get_node_or_null(type)

	if not placeholder:
		push_error("Couldn't find a character names %s for %s" % [type, owner.name])
		return

	placeholder.replace_by_instance()

	var maybe_animated_sprite = get_node_or_null(type)

	# Wait to make sure the replacement happened
	while not maybe_animated_sprite is AnimatedSprite:
		maybe_animated_sprite  = get_node_or_null(type)

	animated_sprite = maybe_animated_sprite

	if not animated_sprite:
		animated_sprite = get_child(0)

		if not animated_sprite:
			return

	if animated_sprite:
		var fps: float = ((owner.bpm * animated_sprite.frames.get_frame_count('default')) \
				/ (animated_sprite.animation_beats * 120))

		animated_sprite.frames.set_animation_speed('default', fps)
		animated_sprite.show()

		# (bpm* total_frames) / (batidas *120)
