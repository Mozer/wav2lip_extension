# Optional readme
## Optional steps to make work other languages and voice pitch

6.0. [Optional] edit "\SillyTavern-Extras\server.py" to make other languages working (English is working by default):

lines 818-841, replace whole old tts_generate() function with new one. OLD:
```
# Added fix for Silero not working as new files were unable to be created if one already existed. - Rolyat 7/7/23
@app.route("/api/tts/generate", methods=["POST"])
@require_module("silero-tts")
def tts_generate():
    voice = request.get_json()
    if "text" not in voice or not isinstance(voice["text"], str):
        abort(400, '"text" is required')
    if "speaker" not in voice or not isinstance(voice["speaker"], str):
        abort(400, '"speaker" is required')
    # Remove asterisks
    voice["text"] = voice["text"].replace("*", "")
    try:
        # Remove the destination file if it already exists
        if os.path.exists('test.wav'):
            os.remove('test.wav')

        audio = tts_service.generate(voice["speaker"], voice["text"])
        audio_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.path.basename(audio))

        os.rename(audio, audio_file_path)
        return send_file(audio_file_path, mimetype="audio/x-wav")
    except Exception as e:
        print(e)
        abort(500, voice["speaker"])
```
replace with this NEW one: And change language and model_id for your desired language. Set your desired voice pitch and speed. Note: you need to restart extras server to make changes in code work
```
# Added fix for Silero not working as new files were unable to be created if one already existed. - Rolyat 7/7/23
# Added hardcoded language, voice pitch and speed. TODO: in UI
# NOTE: silero_api_server\tts.py should also be modified to support prosody and other languages
@app.route("/api/tts/generate", methods=["POST"])
@require_module("silero-tts")
def tts_generate():
    params = {
        'activate': True,
        'language': 'en',    # en,ru,ua,de,fr,es and several others. there is no language selection in ST UI as of 20.11.2023
        'model_id': 'v3_en', # v3_en,v4_ru; supported languages and models: https://github.com/snakers4/silero-models/blob/master/models.yml
        'sample_rate': 48000,
        'device': 'cpu',
        'show_text': False,
        'autoplay': True,
        'voice_pitch': 'high',  #x-low, low, medium, high, x-high
        'voice_speed': 'medium',  #x-slow, slow, medium, fast, x-fast
        'local_cache_path': ''
    }
    voice = request.get_json()
    if "text" not in voice or not isinstance(voice["text"], str):
        abort(400, '"text" is required')
    if "speaker" not in voice or not isinstance(voice["speaker"], str):
        abort(400, '"speaker" is required')
    # Remove asterisks
    voice["text"] = voice["text"].replace("*", "")
    try:
        # Remove the destination file if it already exists
        if os.path.exists('test.wav'):
            os.remove('test.wav')
        prosody = '<prosody rate="{}" pitch="{}">'.format(params['voice_speed'], params['voice_pitch'])
        silero_input = f'<speak>{prosody}{xmlesc(voice["text"])}</prosody></speak>'
        audio = tts_service.generate(voice["speaker"], silero_input)
        audio_file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), os.path.basename(audio))
        os.rename(audio, audio_file_path)
        return send_file(audio_file_path, mimetype="audio/x-wav")
    except Exception as e:
        print(e)
        abort(500, voice["speaker"])
```



6.1 [Optional] edit "silero_api_server\tts.py" to support other languages (ru,ua,de,fr,es and several others, list: https://github.com/snakers4/silero-models/blob/master/models.yml )

If you installed Extras using miniconda files is located somewhere here:

'[extras dir]\env\Lib\site-packages\silero_api_server\tts.py' or '[extras dir]\conda\Lib\site-packages\silero_api_server\tts.py'

If you installed Silly Extras without conda, file is here, (Python310 dir can be Python311):

or 'c:\Users\[USER_NAME]\AppData\Local\Programs\Python\Python310\Lib\site-packages\silero_api_server\tts.py'

modify lines 18, 19, from this:
```
    def __init__(self, sample_path, lang="v3_en.pt") -> None:
        self.sample_text = "The fallowed fallen swindle auspacious goats in portable power stations."
```
Into this. (Other languages file names are in list above) For Russian language modify to:	
```
    def __init__(self, sample_path, lang="v3_1_ru.pt") -> None:
        self.sample_text = "Привет, мир! The fallowed fallen swindle auspacious goats in portable power stations."
```		
modify line 49 from `def load_model(self, lang_model="v3_en.pt"):`
	
into:
```
def load_model(self, lang_model="v3_1_ru.pt"):
```