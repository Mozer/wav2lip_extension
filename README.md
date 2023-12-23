# Wav2lip Silly Tavern extension

Based on [Rudrabha/Wav2Lip](https://github.com/Rudrabha/Wav2Lip) and wrapped in js for Silly Tavern by [Mozer](https://github.com/Mozer)

An extension that makes video messages with lipsync to audio from TTS. Silero TTS and Coqui XTTSv2 are supported.

https://github.com/Mozer/wav2lip_extension/assets/1599013/1dcab8d0-a7a2-45da-8bbf-416c2a5271bc

Video of [real time usage in Silly Tavern](https://t.me/tensorbanana/745). Warning: harsh language in Russian (есть немного мата).


Works with input videos and images. Please notice that for static images only the lips will be animated. Real videos as input are more realistic. Anime pics/vids are not so good looking and sometimes face is not detected.

Low res real vids are the best in terms of realism and performance, i suggest using 300x400 10-60 seconds long 25fps input videos. 

Don't put 1080p vids in input as they can cause OOM errors. Automatic resizing is not done yet (TODO). Resize and cut vids manually.

Original Rudrabha/Wav2Lip model was built for low res vids and is fast. There are other lipsync models like Wav2Lip GAN or Wav2LipHD or SadTalkerVideo but they are slower.


## News
- 2023.12.23 - XTTSv2 is now supported, it has amazing TTS quality
- 2023.11.22 - CPU inference is also very fast with caching! (1 second for a short answer, 15 seconds for 11 second long input audio)
- 2023.11.21 - Caching for face detection. Generation speed for cached vids is now almost 2x faster (2 seconds for a short answer, 10 seconds for 11 second long input audio)


## Requirements: 
- CPU with 10+ Gb RAM or nvidia GPU with 8+ GB VRAM. If you have Radeon GPU please use CPU, it is also fast and is turned on by default.
- latest Silly Tavern staging branch (https://github.com/SillyTavern/SillyTavern/tree/staging)
- latest Silly Tavern Extras (https://github.com/SillyTavern/SillyTavern-Extras)
- ffmpeg is installed and is put into your PATH environment (https://phoenixnap.com/kb/ffmpeg-windows)


## Notes:
- original wav2lip is built using pytorch. Works nicely on CPUs and nvidia GPUs. AMD GPUs are not tested. You can try (ROCm for linux?), they might work. Please report if they do.
- If you don't have much VRAM please use CPU (turned on as default). Min VRAM: 6 GB for 300x400 input video and short audio. Static input images may require less VRAM (how much?). Hi-res input videos/images and longer audios require more VRAM. Please report if you are able to run it with less VRAM
- If your LLM model is also in VRAM it can cause to OOM error or result in slower replies if you have shared VRAM. 
- I tested it running on GPU with 3060 12GB and was able to have ruGPT3.5-13B-gptq fully loaded into VRAM using autoGPTQ. But sometimes with longer replies (4+ sentences) it went into using shared VRAM and caused drastic drop in video gen speed.
- Default silero ui in ST doesn't support other languages, just English
- Default silero api server doesn't support prosody (voice speed and pitch)
- By default CPU is used for inference. You can manually turn on cuda inference here: `\SillyTavern-Extras\modules\wav2lip\wav2lip_module.py`, line 214. Change 'cpu' to 'cuda': `device = 'cuda' # cpu, cuda`
- Video generation takes some time (about 5-10s). If you use GPU and your LLM is also in VRAM don't ask it anything during video generation or you can get OOM error.
- If you make changes in .py files please restart silero extras server to get changes working 


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
CPU	120	140	cached
GPU	1	8	not cached	6
GPU	1	2	cached		6
GPU	11	15	cached		8
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

2. Activate conda environment if you are using it. Type in command line:
```
cd SillyTavern-extras\modules\
git clone https://github.com/Mozer/wav2lip
cd wav2lip
pip install -r requirements.txt
```
Wait while all the dependencies  are installed. If there are errors - fix them manully or open an issue.



## Manually edit 2 files (other repos) to make it work:

3. in \SillyTavern-MainBranch\public\scripts\extesions\tts\index.js
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
if (extension_settings.wav2lip !== undefined && extension_settings.wav2lip.enabled && wav2lipIsGeneratingNow) wav2lipMain("text", 0, extension_settings.wav2lip.char_folder, extension_settings.wav2lip.device)
```

4. in `\SillyTavern-Extras\server.py` AFTER line 320 which has: `app.config["MAX_CONTENT_LENGTH"] = 500 * 1024 * 1024`

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

And you are good to go with Silero TTS with English! 


## Optional: Cocqui XTTSv2 multilingual

Oficial guide how to install and run XTTSv2 in Silly Tavern with conda: https://docs.sillytavern.app/extras/extensions/xtts/
Note: it can also be installed without conda, and without downgrading python and pytorch, simply install the full version of Visual C++ Build Tools. I'm running everything in Python 3.11.5, pytorch 2.1.2+cu121
To run xtts server you should use this command if you have nvidia card (2 seconds for an average voice message): 
`python -m xtts_api_server -d=cuda --deepspeed --lowvram --output c:\\SillyTavern-Extras\\`
To run on CPU (20 seconds for an short voice message) please use command: 
`python -m xtts_api_server -d=cpu --output c:\\SillyTavern-Extras\\`
Replace `c:\\SillyTavern-Extras\\` with full path to your SillyTavern-Extras folder, it is needed to pass xtts audio file to Wav2lip.
Full command can be put into a .bat file, so you won't need to type it every time.


## Optional: Silero TTS with other languages and voice pitch

If you need Russian or other language please follow [optional steps](https://github.com/Mozer/wav2lip_extension/blob/main/README_optional.md) and modify 2 files.


## Running

1. Enable wav2lip and silero-tts modules for silly extras and start it using command line or conda. (silero-tts module is optional, you can try other tts engines in Silly)

`python server.py --enable-modules silero-tts,wav2lip`

2. Enable wav2lip in web interface: Extensions -> Wav2lip -> Enabled.
3. Make sure Silly Tavern is "Connected to API" of extras server. Make sure TTS is enabled in extensions and settings. 
4. Make sure voice is selected for current character or default character. Turn on TTS auto generation if you also want video auto generation.
5. Make sure language of the characted in dialogue is the same as language in "silero_api_server\tts.py" and "SillyTavern-Extras\server.py". e.g. Russian TTS won't play English words and vice versa.
6. Put your short (~10-30s) and low-res (~300x400) input vids/pics into `\SillyTavern-Extras\modules\wav2lip\input\default\` They will be played in random order. Face should be present in all frames or it will cause error (e.g. covered with hand). 


## TODO
0. import extension settings api url for live stream
1. User setting to limit input audio length to prevent OOM (optional input)
2. Resize input vids/pics automatically (optional checkbox)
3. Disable sending a message to LLM while video is generating (optional checkbox in settings)
4. Character folder selection in UI (select)

## Discussion
If you have bugs or proposals please open a bug report or a pull request

discord: https://discord.gg/DZnCnGsJ