# Wav2lip Silly Tavern extension

Based on [Rudrabha/Wav2Lip](https://github.com/Rudrabha/Wav2Lip) and wrapped in js for Silly Tavern by [Mozer](https://github.com/Mozer)

An extension that makes video messages with lipsync to audio from TTS.

https://github.com/Mozer/wav2lip_extension/assets/1599013/1dcab8d0-a7a2-45da-8bbf-416c2a5271bc

Video of [real time usage in Silly Tavern](https://t.me/tensorbanana/745). Warning: harsh language in Russian (Осторожно, есть немного мата):


Works with input videos and images. Please notice that for static images only the lips will be animated. Real videos as input are more realistic. Anime pics/vids are NOT TESTED.

Low res real vids are the best in terms of realism and performance, i suggest using 300x400 10-30 second long 25fps input video. 

Don't put FullHD+ res vids as input they will cause OOM errors. Automatic resizing is not done yet (TODO). Resize and cut vids manually.

Original Rudrabha/Wav2Lip model was built for low res vids and is fast. There are other lipsync models like Wav2LipHD or Wav2Lip GAN or SadTalkerVideo but they are times slower.


## News
- 2023.11.22 - CPU inference is also very fast with caching! (1 second for a short answer, 15 seconds for 11 second long input audio)
- 2023.11.21 - Caching for face detection. Generation speed for cached vids is now almost 2x faster (2 seconds for a short answer, 10 seconds for 11 second long input audio)


## Requirements: 
- CPU with 10+ RAM or nvidia GPU with 8+ GB VRAM
- if you have less VRAM or Radeon GPU please use CPU, it is also fast (and turned on by default)
- latest Silly Tavern 1.10.9+ installed  (https://github.com/SillyTavern/SillyTavern)
- latest Silly Tavern Extras (19.11.2023) installed (https://github.com/SillyTavern/SillyTavern-Extras)


## Notes:
- original wav2lip is built using pytorch. Works nicely on CPUs and nvidia GPUs. AMD GPUs are not tested. You can try (ROCm for linux?), they might work. Please report if they do.
- If you don't have much VRAM please use CPU (turned on as default). Min VRAM: 6 GB for 300x400 input video and short audio. Static input images may require less VRAM (how much?). Hi-res input videos/images and longer audios require more VRAM. Please report if you are able to run it with less VRAM
- If your LLM model is also in VRAM it can cause to OOM error or result in slower replies if you have shared VRAM. 
- I tested it running on GPU with 3060 12GB and was able to have ruGPT3.5-13B-gptq fully loaded into VRAM using autoGPTQ. But sometimes with longer replies (4+ sentences) it went into using shared VRAM and caused drastic drop in video gen speed.
- Default silero api server doesn't support other languages, just English
- Default silero api server doesn't support prosody (voice speed and pitch)
- Video generation takes some time (about 10s). If your LLM is also in VRAM don't ask it anything during video generation or you can get OOM error. (TODO: disable sending)


## Performance

Two steps here = face detection + lips movement. face detection results are always the same for the same input video, so we can cache them.
Face detection runs rather slow on CPU (10s video = 60s of face detection) rather then GPU (7s), but when all vids have cached face detection - you can use CPU only almost as fast as a GPU! (1 second for a short answer). 
Cache is made automatically when input video is used for the first time. Cached times are ~2x faster. CPU here is Ryzen 7 7730U, GPU is nvidia rtx 3600 12 GB. 

```
	Inference time for 300x400 10s 25fps input video, no other stuff in vram. 
device	audio,s	gen,s	face_det	VRAM,Gb		
CPU	1	55	not cached
CPU	1	1	cached
CPU	11	15	cached
GPU	1	8	not cached
GPU	1	2	cached
GPU	11	15	cached
GPU	31	32	not cached	11.1
GPU	44	103	not cached	13.2	used shared vram


	Just face detection 
device	input_video,s face_det,s
CPU	10	55
CPU	30	435	(448x300 25 fps)
GPU	30	13
```


## Installation



1. Launch and Open Silly Tavern in browser -> Extensions (at top menu) -> Install extension, paste and save:
```
https://github.com/Mozer/wav2lip_extension
```

2.0 Now let's clone wav2lip repo into \SillyTavern-extras\modules\

2.1 [optional] activate conda environment

2.2 Type in command line:
```
cd \SillyTavern-extras\modules\
git clone https://github.com/Mozer/wav2lip
cd wav2lip
pip install -r requirements.txt
```
Wait while all the dependencies  are installed. If there are errors - fix them manully or open an issue.

3.0 manually download this checkpoint https://iiitaphyd-my.sharepoint.com/:u:/g/personal/radrabha_m_research_iiit_ac_in/Eb3LEzbfuKlJiR600lQWRxgBIY27JZg80f7V9jtMfbNDaQ?e=TBFBVW

put wav2lip.pth (416 MB) to '\SillyTavern-extras\modules\wav2lip\checkpoints\'

there are other checkpoints at https://github.com/Rudrabha/Wav2Lip#getting-the-weights but this one is the fastest.

4.0 make sure ffmpeg is installed and is put into your PATH environment: https://phoenixnap.com/kb/ffmpeg-windows

5.0 By default CPU is used for inference. You can manually turn on cuda inference here: `\SillyTavern-Extras\modules\wav2lip\wav2lip_module.py`, line 214. Change 'cpu' to 'cuda'^:
`device = 'cuda' # cpu, cuda`


## Manually edit 3 files (other repos) to make it work:

5.1 in \SillyTavern-MainBranch\public\index.html

after line 4099 with text: `<div title="Narrate" class="mes_narrate fa-solid fa-bullhorn" data-i18n="[title]Narrate"></div>`

add line:
```
<div title="Generate Video" class="mes_wav2lip fa-solid fa-video" data-i18n="[title]Generate Video"></div>
```

5.2. in \SillyTavern-MainBranch\public\scripts\extesions\tts\index.js
after line 12 add line:
```
import { wav2lipIsGeneratingNow, modify_wav2lipIsGeneratingNow, wav2lipMain} from "../third-party/wav2lip_extension/index.js"
```
line 440, in `function processAudioJobQueue()` modify from: `playAudioData(currentAudioJob)`
modify to:
```
if (wav2lipIsGeneratingNow !== true) playAudioData(currentAudioJob)
```

line 458, in function `completeTtsJob()` after this line: `currentTtsJob = null`

add line:
```
if (extension_settings.wav2lip !== undefined && extension_settings.wav2lip.enabled && wav2lipIsGeneratingNow) wav2lipMain("text", 0, "char")
```

5.3. in `\SillyTavern-Extras\server.py` AFTER line 320 which has: `app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024`

add lines:
```
if "wav2lip" in modules:
    sys.path.append("modules/wav2lip/")
    from server_wav2lip import *
        
    @app.route("/api/wav2lip/generate", methods=["GET","POST"]) 
    @app.route("/api/wav2lip/generate/<fname>", methods=["GET","POST"]) 
    def wav2lip_generate(fname="wav2lip"):
        return wav2lip_server_generate(fname="wav2lip")
    
    @app.route("/api/wav2lip/play/<fname>", methods=["GET","POST"]) 
    @cross_origin(headers=['Content-Type']) # Send Access-Control-Allow-Headers def cross_origin_json_post():
    def wav2lip_play(fname: str):
        return wav2lip_server_play(fname)
```

## Optional: other languages and voice pitch
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


6.1 [Optional] edit "silero_api_server\tts.py" to support prosody (voice speed and pitch) 

If you installed Extras using miniconda files is located somewhere here:

'[extras dir]\env\Lib\site-packages\silero_api_server\tts.py' or '[extras dir]\conda\Lib\site-packages\silero_api_server\tts.py'

If you installed Silly Extras without conda, file is here, (Python310 dir can be Python311):

or 'c:\Users\[USER_NAME]\AppData\Local\Programs\Python\Python310\Lib\site-packages\silero_api_server\tts.py'

in '\silero_api_server\tts.py'

line 80, modify from this: 'audio_path = Path(self.model.save_wav(text=text,speaker=speaker,sample_rate=self.sample_rate))'

into this:
```
audio_path = Path(self.model.save_wav(ssml_text=text,speaker=speaker,sample_rate=self.sample_rate))
```

6.2 [Optional] edit "silero_api_server\tts.py" to support other languages (ru,ua,de,fr,es and several others, list: https://github.com/snakers4/silero-models/blob/master/models.yml )

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

## Running

7.0 Enable wav2lip and silero-tts modules for silly extras and start it using command line or conda. silero-tts module is optional, you can try other tts engines in Silly
`python server.py --enable-modules silero-tts,wav2lip`

7.1 start or restart silero extras server to get changes in python code working (close console window and start again using command line or bat file)

8.1 Enable wav2lip in web interface: Extensions -> Wav2lip -> Enabled.

8.2 Make sure Silly Tavern is "Connected to API" of extras server. Make sure TTS is enabled in extensions and settings. 

8.3 Make sure voice is selected for current character or default character. Turn on TTS auto generation if you also want video auto generation.

8.4 Make sure language of the characted in dialogue is the same as language in "silero_api_server\tts.py" and "SillyTavern-Extras\server.py". e.g. Russian TTS won't play English words and vice versa.

8.5 You can make video messages auto generated or you can click a video icon at each message to generate them manually.

9.0 Put your short (~10-30s) and low-res (~300x400) input vids/pics into `\SillyTavern-Extras\modules\wav2lip\input\default\` They will be played in random order. Face should be present in all frames or it will cause error (e.g. covered with hand). 


## TODO
1. User setting to limit input audio length to prevent OOM (optional input)
2. Resize input vids/pics automatically (optional checkbox)
3. Disable sending a message to LLM while video is generating (optional checkbox in settings)
4. Character folder selection in UI (select)

## Discussion
If you have bugs or proposals please open a bug report or a pull request

discord: https://discord.gg/DZnCnGsJ