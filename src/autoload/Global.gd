extends Node

const Stage = preload("res://src/Stage/Stage.gd")

# Populated in the Character.gd's add_instrument method.
# Reset at Main.tsc everytime a scene changes.
var instruments: = {}

# Set at the Stage.gd's _ready method.
var stage: Stage
