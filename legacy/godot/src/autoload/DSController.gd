extends CanvasLayer

# This class has to be loaded as a singleton and it controlls dragging CanvasItem
# nodes.
#
# Any node can call `DSContainer.start_dragging` to start dragging a Control or
# Node2D.
#
# Any node can be a valid container if added to `DSContainer` group. It has to
# implement the `ds_drag_released(drag)` method and, based on the drag information
# received, call `DSController.accept(container, priority)` to accept the drop.
#
# The drag data has the following format:
# _drags[touch_index] = {
#     global_position: Vector2,
#     from: Node, # in group DSContainer
#     node: Node,
#     data: Dictionary,
#     offset: Vector2
# }
#
# The choosen container (the container that accepted the release and has the
# higher priority), will receive a call to `ds_receive(drag)` method.

signal drag_moved(data)
signal drag_started(data)
signal drag_ended(data)

var _drags: = {}
var _acceptings: = {} setget set_acceptings


func _ready() -> void:
	layer = 2


func _input(event: InputEvent) -> void:
	if event is InputEventScreenDrag:
		var drag = _drags.get(event.index)
		if drag:
			drag.node.set_global_position(event.position + drag.offset)
			drag.global_position = event.position

			emit_signal("drag_moved", drag)

	elif event is InputEventScreenTouch:
		if not event.pressed:
			drop_dragging(event.index, event.position)


func start_dragging(
		from: Node,
		node: Node,
		touch_index: int,
		offset: = Vector2(),
		data: = {}
	) -> void:
	if not (node is Node2D or node is Control):
		push_error("Can't drag node %s. Only Control and Node2D types are " +
				" draggable." % node)
		return

	if _drags.has(touch_index):
		push_error("Touch index %s is dragging a node already. " % touch_index +
				"Maybe start_dragging is getting called twice?")
		return

	_drags[touch_index] = {
		from = from,
		node = node,
		data = data,
		offset = offset
	}

	emit_signal("drag_started", _drags[touch_index])


func drop_dragging(touch_index: int, global_position: Vector2) -> void:
	if _drags.has(touch_index):
		var choosen_container: Node
		var drag = _drags[touch_index]
		drag.global_position = global_position

		_drags.erase(touch_index)

		# This call populates the _acceptings dictionary to be used bellow
		get_tree().call_group_flags(SceneTree.GROUP_CALL_REALTIME, 'DSContainer', 'ds_drag_released', drag)

		for container in _acceptings:
			if choosen_container:
				# This condition compares the container's priority set when accept method was called.
				if _acceptings[container] > _acceptings[choosen_container]:
					choosen_container = container

			else:
				choosen_container = container

		_acceptings.clear()
		drag.node.set_block_signals(false)

		if choosen_container and choosen_container.has_method("ds_receive"):
			choosen_container.ds_receive(drag)

		else:
			push_error("Choosen container %s doesn't have the method " +
					"ds_receive. The node %s is possibly in an unstable state."
					% [choosen_container.name, drag.node.name])

		emit_signal("drag_ended", drag)


func drag_and_drop(node: CanvasItem, from: Node, global_position: Vector2, data: = {}) -> void:
	start_dragging(from, node, -1, Vector2(), data)
	drop_dragging(-1, global_position)


func has_drag(index: int) -> bool:
	return _drags.has(index)


func accept(container, priority: int = 0) -> void:
	_acceptings[container] = priority
	pass


func change_node_parent(node: Node, new_parent: Node) -> void:
	var node_global_position: Vector2

	if node.is_inside_tree():
		# Sometimes when a node changes its parent, it keeps its local position
		node_global_position = node.get_global_position()
		node.get_parent().remove_child(node)

	new_parent.add_child(node)

	if node_global_position:
		node.set_global_position(node_global_position)


func get_drags() -> Dictionary:
	return _drags


# Full protect _acceptings variable
func set_acceptings(value: Dictionary) -> void: pass
