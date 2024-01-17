# Wav2lip Silly Tavern extension

Based on [Rudrabha/Wav2Lip](https://github.com/Rudrabha/Wav2Lip) and wrapped in js for Silly Tavern by [Mozer](https://github.com/Mozer)

An extension that makes video messages with lipsync to audio from TTS. Silero TTS and Coqui XTTSv2 are supported.

https://github.com/Mozer/wav2lip_extension/assets/1599013/1dcab8d0-a7a2-45da-8bbf-416c2a5271bc

New video of [real time usage in Silly Tavern with STT and XTTSv2 in English](https://www.youtube.com/watch?v=meUj1v55tO0).

И еще одно видео: [на русском языке, есть немного мата](https://t.me/tensorbanana/832).

Video guide [how to set up everything](https://www.youtube.com/watch?v=JyfYl16FhKM) in English by MustacheAI.


Works with input videos and images. Please notice that for static images only the lips will be animated. Real videos as input are more realistic. Anime pics/vids are not so good looking and sometimes face is not detected.

Low res real vids are the best in terms of realism and performance, i suggest using 300x400 10-60 seconds long 25fps input videos. 

Don't put 1080p vids in input as they can cause OOM errors. Automatic resizing is not done yet (TODO). Resize and cut vids manually.

Original Rudrabha/Wav2Lip model was built for low res vids and is fast. There are other lipsync models like Wav2Lip GAN or Wav2LipHD or SadTalkerVideo but they are slower.


## News
- 2024.01.17 - Keeping model in memory between generations is now saving 0.60s of loading time. No changes in VRAM usage are visible, Windows resource monitor still shows same amounts. Updated file in Extras: wav2lip_module.py
- 2024.01.14 - Memory optimisation: now it requires just ~1 GB of VRAM or RAM to run it. I changed wav2lip_batch_size from 1024 to 16, and face_det_batch_size from 16 to 4. Almost no trade offs in speed. Updated file in Extras: server_wav2lip.py
- 2024.01.13 - fixed VRAM memory leak: CUDA buffers were not emptied after each generation, eating vram and slowing down each generation. Updated file in Extras: wav2lip_module.py
- 2024.01.11 - fixed crashing when face is not found. Updated file in Extras: https://github.com/Mozer/wav2lip/blob/master/wav2lip_module.py
- 2024.01.01 - bug fixes, paths for linux
- 2023.12.24 - faster-whisper STT (speech recognition) is now supported (CPU and GPU are both fast)
- 2023.12.23 - XTTSv2 is now supported, it has amazing TTS quality
- 2023.12.23 - Settings are now in GUI, added experimental live mode to mimic live video streams
- 2023.11.22 - CPU inference is also very fast with caching! (1 second for a short answer, 15 seconds for 11 second long input audio)
- 2023.11.21 - Caching for face detection. Generation speed for cached vids is now almost 2x faster (2 seconds for a short answer, 10 seconds for 11 second long input audio)


## Requirements: 
- CPU with 2+ Gb RAM or nvidia GPU with 2+ GB VRAM. If you have Radeon GPU please use CPU, it is also fast and is turned on by default.
- latest Silly Tavern main branch 1.11.2 (https://github.com/SillyTavern/SillyTavern). Older versions may not work.
- latest Silly Tavern Extras (https://github.com/SillyTavern/SillyTavern-Extras)
- ffmpeg should be installed and put into your PATH environment (https://phoenixnap.com/kb/ffmpeg-windows)


## Notes:
- Works nicely on CPUs and nvidia GPUs. AMD GPUs are not tested. You can try (ROCm for linux?), they might work. Please report if they do.
- If you don't have much VRAM please use CPU (turned on by default). Min VRAM: 1 GB for 300x400 input video and short audio. Static input images may require less VRAM (how much?). Hi-res input videos/images and longer audios require more VRAM. Please report if you are able to run it with less VRAM
- If your LLM model is also in VRAM it can cause to OOM error or result in slower replies if you have shared VRAM. 
- I tested wav2lip running on GPU with 3060 12GB and was able to have ruGPT3.5-13B-gptq fully loaded into VRAM using autoGPTQ.
- Default silero ui in ST doesn't support other languages, just English and doesn't support prosody (voice speed and pitch). Now it can be fixed with my patch.
- By default CPU is used for inference. You can change it in extension settings.
- Video generation takes some time (about 5-10s). If you use GPU and your LLM is also in VRAM don't ask it anything during video generation or you can get OOM error.


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
GPU	2	13	not cached	1
GPU	39	13	not cached	2	
GPU	2	3	cached		1
GPU	50	9	cached		1



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

3. Double click `\SillyTavern\public\scripts\extensions\third-party\wav2lip_extension\patch_silly_tavern.py` to patch some original Silly Tavern files. Backups are saved as .bkp files. If you want to restore them run restore_silly_tavern.py
4. Double click `\SillyTavern-Extras\modules\wav2lip\patch_silly_tavern_extras.py` to patch some original Silly Tavern Extras files. If you want to restore them run restore_silly_tavern_extras.py
5. Restart Silly tavern Extras if it was running. And you are good to go with Silero TTS, it is fast. But i recommend using Cocqui XTTSv2 multilingual it is just a bit slower, but way more realistic.


## Optional: Cocqui XTTSv2 multilingual

1. Official guide how to install and run XTTSv2 in Silly Tavern staging with conda, use it: https://docs.sillytavern.app/extras/extensions/xtts/
2. Note: it can also be installed without conda, and without downgrading python and pytorch, simply install the full version of Visual C++ Build Tools. I'm running everything in Python 3.11.5, pytorch 2.1.2+cu121
3. To run xtts server you should use this command if you have nvidia card (2 seconds for an average voice message): 
```
python -m xtts_api_server -d=cuda --deepspeed --lowvram --output c:\\SillyTavern-Extras\\
```
4. To run on CPU (20 seconds for a short voice message) please use command: 
```
python -m xtts_api_server -d=cpu --output c:\\SillyTavern-Extras\\
```
Note: wav2lip doesn't work with xtts --streaming-mode-improve param as it doesn't save audio to file (though it is fast).
5. Replace `c:\\SillyTavern-Extras\\` with full path to your SillyTavern-Extras folder, it is needed to pass xtts audio file to Wav2lip. Full command can be put into a .bat file, so you won't need to type it every time.


## Optional: faster-whisper STT (speech recognition)

1. Install official extension 'Extension-Speech-Recognition': Silly Tavern -> Extensions -> Download Extensions and Assets -> connect button -> yes -> Speech Recognition -> download button
	
	It has built in streaming support for openai/whisper, but it is not working nicely, skips a lot of words, not working with Rusian language and runs on a GPU.

	SYSTRAN/faster-whisper is much faster and can be run on a CPU. I am using GUI for faster-whisper from https://github.com/reriiasu/speech-to-text
2. open a cmd in directory, where you want it to be installed and run
```
git clone https://github.com/reriiasu/speech-to-text
pip install -r requirements.txt
```
3. By default it launches a web gui on port 8000, the same used by SillyTavern, need to change it in `\speech-to-text\speech_to_text\__main__.py` from `eel.start("index.html", size=(1024, 1024), close_callback=on_close)` to `eel.start("index.html", size=(1024, 1024), close_callback=on_close, port=8080)`
4. Now run it with next command. For convenience create a .bat file with contents:
```
python -m speech_to_text
```
5. It will open a web GUI. Change following settings: App settings - check "Use Websocket server", uncheck "Create Audio File", set "Silence limit" to 20
6. Model settings - select Model size "small", set Device to "cpu", set "Compute type" to float32, set Number of workers from 4 to 8 (how many cpu cores you want to use, i prefer 8)
7. Transcribe settings - select language, e.g. "russian", task - "transcribe"
8. Now you can run stt server with wss support, click Start Transcription. If you want to work it faster, try with a cuda gpu. But CPU is also fast (it takes ~2 seconds to transcribe)
9. To speed up VAD a little: in `\speech-to-text\speech_to_text\utils\audio_utils.py` change `CHUNK = 512` to `CHUNK = 256`
10. Double click `\SillyTavern\public\scripts\extensions\third-party\wav2lip_extension\patch_streaming_stt.py` to patch 2 files (index.js and streaming.js) in \Extension-Speech-Recognition\
11. Silly Tavern GUI ->  Extensions -> Speech Recognition -> Select Speech-to-text Provider as "streaming", set your language, set desired "Message mode" (I prefer "Auto send"). You are good to go.
12. If SillyTavern lost connection with STT server, you can switch Provider to "none" and back to "streaming", it will reconect the wss connection (or just hit F5).



## Running

1. Enable wav2lip and silero-tts modules for silly extras and start it using command line or conda. (silero-tts module is optional, you can try xttsv2 in Silly, streaming-stt is also optional)

`python server.py --enable-modules silero-tts,wav2lip,streaming-stt`

2. Enable wav2lip in web interface: Extensions -> Wav2lip -> Enabled.
3. Make sure Silly Tavern is "Connected to API" of extras server. Make sure TTS is enabled in extensions and settings. 
4. Make sure voice is selected for current character or default character. Turn on TTS auto generation if you also want video auto generation.
5. Make sure language of the characted in dialogue is the same as language in "silero_api_server\tts.py" and "SillyTavern-Extras\server.py". e.g. Russian TTS won't play English words and vice versa.
6. Put your short (~10-30s) and low-res (~300x400) input vids/pics into `\SillyTavern-Extras\modules\wav2lip\input\default\` They will be played in random order.
7. DONE. Now in chat you can click a video camera icon near any message to generate a video responce, or turn on automatic video generation in Extension settings.


## Settings
`Mode`:
There are two modes for this extension: 'video message' and 'live stream' (you can switch them in extension settings). 
- video message - character will send you a video message in chat
- live stream - mimicks a live video stream like twitch. First a regular video message is played. And then a silence video will be played right after the character finished talking. You should make such video manually, just find/create a video where your chracter is not speaking anything, longer videos are better looking. Put silence.mp4 to `\SillyTavern-Extras\modules\wav2lip\input\default\`. Change `default` to your char name if needed.

`Char folder`: You can organize your char vids into folders in `\SillyTavern-Extras\modules\wav2lip\input\` and them switch them in SillyTavern Extension Settings.


## TODO
1. User setting to limit input audio length to prevent OOM (optional input)
2. Resize input vids/pics automatically (optional checkbox)
3. Disable sending a message to LLM while video is generating (optional checkbox in settings)


## Discussion
If you have bugs or proposals please open a bug report or a pull request

discord: https://discord.gg/DZnCnGsJ