extends HBoxContainer

export var bg_color: = Color(1, 1, 1)
export var fg_color: = Color(0.7, 0.7, 0.7)

onready var tab_container: TabContainer = $'../TabContainer'


func _ready() -> void:
	refresh()
	tab_container.connect('tab_chantged', self, "_on_TabContainer_tab_changed")
	for child in get_children():
		child.connect('gui_input', self, "_on_ball_gui_input", [child.name as int])
	pass


func _on_TabContainer_tab_changed(tab: int) -> void:
	refresh()


func _on_ball_gui_input(event: InputEvent, tab: int) -> void:
	if event is InputEventScreenTouch:
		if event.pressed:
			tab_container.current_tab = tab
			refresh()
			pass

func refresh() -> void:
	for child in get_children():
		child.modulate = fg_color if tab_container.current_tab as String != child.name else bg_color
