extends NinePatchRect
tool

const MIDDLE_ARROW_FORCE_POSITION: = Vector2(-48, -165)

export(String, "LEFT", "MIDDLE", "RIGHT") var mode: = "RIGHT" setget set_mode
export var instrument_extent: = 164.0
export var instruments_number: = 2 setget set_instruments_number
export var horizontal_border: = 103.0

var _left_texture: Texture = preload("res://assets/images/characters/BALAO_ESQUERDA.svg")
var _middle_texture: Texture = preload("res://assets/images/characters/BALAO_CENTRO.svg")
var _right_texture: Texture = preload("res://assets/images/characters/BALAO_DIREITA.svg")

onready var _middle_arrow: TextureRect = $'../MiddleArrow'
onready var _box_z_index: Node2D = get_parent()

func refresh() -> void:
	var begin_y: = get_begin().y
	var end_y: = get_end().y

	_middle_arrow.rect_position = MIDDLE_ARROW_FORCE_POSITION
	match mode:
		"LEFT":
			_middle_arrow.hide()
			texture = _left_texture
			patch_margin_left = 84
			patch_margin_right = 233
			set_end(Vector2(horizontal_border, end_y))
			set_begin(Vector2(-instrument_extent * instruments_number, begin_y))
		"MIDDLE":
			_middle_arrow.show()
			texture = _middle_texture
			patch_margin_left = 50
			patch_margin_right = 50
			set_begin(Vector2(-instrument_extent * instruments_number / 2.0, begin_y))
			set_end(Vector2(instrument_extent * instruments_number / 2.0, end_y))
		"RIGHT":
			_middle_arrow.hide()
			patch_margin_left = 235
			patch_margin_right = 85
			texture = _right_texture
			set_begin(Vector2(-horizontal_border, begin_y))
			set_end(Vector2(instrument_extent * instruments_number, end_y))


func set_mode(value: String) -> void:
	mode = value

	if not _middle_arrow:
		yield(self, "ready")

	_middle_arrow.set_visible(mode == "MIDDLE")

	refresh()


func set_instruments_number(value: int) -> void:
	instruments_number = value

	if not _middle_arrow:
		yield(self, "ready")

	refresh()
