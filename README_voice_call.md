# Hands free voice call to your LLM in SillyTavern

vid:
https://youtu.be/Opbx7Y2MuCU

## faster-whisper STT (speech recognition)

1. Install official extension 'Extension-Speech-Recognition': Silly Tavern -> Extensions -> Download Extensions and Assets -> connect button -> yes -> Speech Recognition -> download button
	
	It has built in streaming support for openai/whisper, but it is not working nicely, skips words in the beginning, not working with Rusian language and runs on a GPU. You can try it first, it is working. If you are pleased with it you can skip steps 2-10 and go directly to Routing virtual cables. 

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
10. Download and put 2 files patch_streaming_stt.py and restore_streaming.py to: `\SillyTavern\public\scripts\extensions\third-party\Extension-Speech-Recognition` to patch 2 original files. Double click patch_streaming_stt.py
11. Silly Tavern GUI ->  Extensions -> Speech Recognition -> Select Speech-to-text Provider as "streaming", set your language, set desired "Message mode" (I prefer "Auto send"). You are good to go.
12. If SillyTavern lost connection with STT server, you can switch Provider to "none" and back to "streaming", it will reconect the wss connection (or just hit F5).

## Routing virtual cables
I guess there are easier ways to route speech and audio from SillyTavern to phone, but used this: 

- 2 telegram accounts (one for your phone and one for your PC, please use a Windows app, not a web version). You can try with 2 Whatsapp accounts if you don't like telegram.
- VB-Audio Additional Virtual Cables. It's a paid app, but there are always options, https://vb-audio.com/Cable/
- OBS studio
- official XTTSv2 extension for silly tavern
- modified streaming speech recognition extension for silly tavern with faster-whisper.

![photo_2023-12-29_21-34-13](https://github.com/Mozer/wav2lip_extension/assets/1599013/d925f1d2-817a-4c0d-a669-8efe23271f69)

![photo_2023-12-29_21-34-13 (2)](https://github.com/Mozer/wav2lip_extension/assets/1599013/67f27ab7-aca5-4adb-a9a0-1bdb1abc32d9)

Now call from your phone telegram account to your PC telegram account. At home it works flawlessly with TWS headphones, but at the street all the ambient noises reduce speech recognition quality. Short questions work fine, but longer things can turn your call into a disaster (bad TWS microphone, poor Bluetooth, bad 4G signal, other people voices, street sounds). Anyway it's winter and having the ability to chat with your LLM outside without use of hands is great.