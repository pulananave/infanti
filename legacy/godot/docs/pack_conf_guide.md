

# Configurando um pack

Todo pack possui um arquivo `pack.conf` dentro. Ele possui as seguintes opções.

-   `music_bars`: A quantidade total de compassos que a música possui
-   `music_bpm`: O numéro de batidas por minuto em que a música está.
-   `recording_repeats` (opcional, padrão 3): O número de repetições que serão
    usadas como a máxima duração de uma gravação.
-   `max_instruments_on_stage` (opcional, padrão 8): O limite de instruments que
    podem ser colocados no palco ao mesmo tempo.
-   `characters`: Cada personagem que será usado no pack será um novo dicionário
    com suas próprias opções de configuração.
    -   `instrument_use_limit` (opcional, padrão sem limite): O número máximo de
        instrumentos queu podem ser usados para esse personagem.
    -   `instruments`: Uma lista de instrumentos que o *character* possui. Será um
        Array de dicionários com suas próprias opções de configuração
        -   `audio`: O nome do arquivo de audio para esse instrumento.
        -   `bars`: A quantidade de compassos que esse audio dura na música.
        -   `type`: O tipo do instrument (Agogo, Guitar, Piano, etc). Esse nome será
            usado para procurar pelo ícone do instrumento e também pela animação dele
            nas pastas do projeto. Por padrão ele é idêntico ao nome dos pngs dos
            instrumentos.
-   `min_volume_db` (opcional, padrão -20.0): O volume mínimo em decibeis que o
    instrumento pode estar.
-   `max_volume_db` (opcional, padrão 0.0): o volume mácimo em decibeis que o
    instrumento pode estar.


# Exemplo

    ; Comentários começam com ';'
    
    music_bpm=60.0
    max_instruments_on_stage=8
    characters={
        "Boogar":{
            "instruments":[
    			{
                    "audio": "canoa-edm-bass-synth.ogg",
                    "bars": 20,
                    "type": "Pratos",
                    "instrument_use_limit": 5,
                    "min_volume_db": -20.0,
                    "max_volume_db": 0.0,
                },
                ...
            ]
        },
        ...
    }

