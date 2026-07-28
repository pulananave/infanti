extends Control

signal finished

const ANIMATION_FPS: = 10

export var animations_paths: = ["res://assets/images/characters/Boogar/Bongo/BoogarBongo.tres"]

onready var animation_player: AnimationPlayer = $AnimationPlayer
onready var animated_sprite: AnimatedSprite = $Anchor/AnimatedSprite
onready var tween: Tween = $Tween
onready var bars: HBoxContainer = $Bars


func _ready():
	randomize()
	animation_player.connect("animation_started", self, "_on_AnimationPlayer_animation_started")
	animation_player.connect("animation_finished", self, "_on_AnimationPlayer_animation_finished")


func _on_AnimationPlayer_animation_started(anim_name: String) -> void:
	if anim_name == "fade_in":
		tween.interpolate_property(
			bars,
			"rect_position",
			Vector2(-rect_size.x, 0),
			Vector2(rect_size.x, 0),
			animation_player.current_animation_length,
			Tween.TRANS_LINEAR,
			Tween.EASE_OUT
		)
	elif anim_name == "fade_out":
		tween.interpolate_property(
			bars,
			"rect_position",
			Vector2(rect_size.x, 0),
			Vector2(-rect_size.x, 0),
			animation_player.current_animation_length,
			Tween.TRANS_LINEAR,
			Tween.EASE_OUT
		)
	tween.start()


func _on_AnimationPlayer_animation_finished(anim_name: String) -> void:
	emit_signal("finished")


func fade_in() -> void:
	animation_player.play("fade_in")
	animated_sprite.play()
	pass


func fade_out() -> void:
	animation_player.play("fade_out")
	animated_sprite.stop()

