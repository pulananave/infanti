extends Node2D

const CONFIG_FILE_NAME: = "pack.conf"

export(String, DIR) var pack_sounds_folder
export(String, DIR) var pack_icons_folder
export var music_bars: = 20
export var music_bpm: = 96.0
export var max_instruments_on_stage: = 9
export var recording_repeats: = 3

var instruments_by_name: = {}

onready var music_duration: = 240.0 * float(music_bars) / music_bpm


func _ready() -> void:
	Global.instruments.clear()
	MusicController.duration = music_duration
	MusicController.bars = music_bars
	MusicController.bpm = music_bpm

	var config_file: = ConfigFile.new()
	var error: = config_file.load(pack_sounds_folder.plus_file(CONFIG_FILE_NAME))
	assert(error == OK, "Failed to load pack.conf file at %s. Error number %s" % [pack_sounds_folder, error])

	music_bars = config_file.get_value("", "music_bars", music_bars)
	music_bpm = config_file.get_value("", "music_bpm", music_bpm)
	max_instruments_on_stage = config_file.get_value("", "max_instruments_on_stage", max_instruments_on_stage)
	recording_repeats = config_file.get_value("", "recording_repeats", recording_repeats)

	var characters_info: Dictionary = config_file.get_value("", "characters")

	for character_name in characters_info:
		var character: Character = get_node(character_name)
		var info: Dictionary = characters_info[character_name]

		character.instrument_use_limit = info.get("instrument_use_limit", 0)

		for instrument_info in info.instruments:
			var instrument: Instrument = character.add_instrument(
				load(pack_sounds_folder.plus_file(instrument_info.audio)),
				instrument_info.type,
				instrument_info.bars,
				music_bpm,
				instrument_info.get("min_volume_db", -20.0),
				instrument_info.get("max_volume_db", 0.0)
			)
			instruments_by_name[instrument.name] = instrument

		character.calculate_show_positions()
