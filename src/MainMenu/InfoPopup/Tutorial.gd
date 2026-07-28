extends Control

const SWIPE_DISTANCE: = 100

onready var tab_container: TabContainer = $TabContainer
onready var tab_indicator: HBoxContainer = $TabIndicator

var _touch_position: = Vector2.ZERO
var _swiped: = false

func _ready() -> void:
	tab_container.connect("gui_input", self, "_on_TabContainer_gui_input")
	pass


func _on_TabContainer_gui_input(event: InputEvent) -> void:
	if event is InputEventScreenDrag:
		if not _swiped:
			var distance = _touch_position.x - event.position.x

			if abs(distance) > SWIPE_DISTANCE:
				var direction = sign(distance)

				tab_container.current_tab += direction
				tab_indicator.refresh()
				_swiped = true

	elif event is InputEventScreenTouch:
		if event.pressed:
			_touch_position = event.position

		else:
			_swiped = false
