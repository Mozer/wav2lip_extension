Requirements: 
- nvidia GPU with 8+ GB VRAM

Notes:
- wav2lip is built using pytorch with cuda. AMD gpus or CPUs are not tested. You can try, they might work. Please report if they do.
- Min VRAM: 6 GB for 300x400 input video and short audio. Static input images may require less VRAM (how much?). Hi-res input videos/images and longer audios require more VRAM. Please report if you are able to run it with less VRAM
- If your LLM model is also in VRAM it can cause to OOM error or result in slower replies if you have shared VRAM. 
- I tested it with 3060 12GB and was able to have ruGPT3.5-13B-gptq fully loaded into VRAM using autoGPTQ. But sometimes with longer replies (4+ sentences) it went into using shared VRAM and causing drastic drop in video gen speed.

1. Default silero api server doesn't support other languages, just English
2. Default silero api server doesn't support prosody (voice speed and pitch)


TODO:
1. optional user setting to limit input audio length to prevent OOM


Inference time for 300x400 10s 25fps input video, no other stuff in vram
audio,s		gen,s	VRAM,Gb
1			4		7.8
8			15		6.8
13			18		8.4
22			24		11.1
31			32		11.1
44			103		13.2	used shared vram

Inference time for 200x268 10s 25fps input video, no other stuff in vram
audio,s		gen,s	VRAM,Gb
1			4		3.9
31			27		10.8	
44			81		12.8	used shared vram
	

Inference time for 300x400 3s 30fps input video, no other stuff in vram
audio,s		gen,s	VRAM,Gb
1			6		7.0
31			42		11.6
44			104		13.3	used shared vram



INSTALLATION

0. Make sure you have latest Silly Tavern 1.10.9+ installed  (https://github.com/SillyTavern/SillyTavern)
   Make sure you have latest Silly Tavern Extras (19.11.2023) installed (https://github.com/SillyTavern/SillyTavern-Extras)
1. Launch and Open Silly Tavern in browser -> Extensions (at top menu) -> Install extension, paste: 
https://github.com/Mozer/wav2lip_extension
click save and wait for a while

2. Now let's clone repo into \SillyTavern-extras\modules\
2.1 [optional] activate conda environment
2.2 Type in command line:
cd \SillyTavern-extras\modules\
git clone https://github.com/Mozer/wav2lip
cd wav2lip
pip install -r requirements.txt

3 manually download checkpoint wav2lip.pth (416 MB) to \SillyTavern-extras\modules\wav2lip\checkpoints\
https://iiitaphyd-my.sharepoint.com/:u:/g/personal/radrabha_m_research_iiit_ac_in/Eb3LEzbfuKlJiR600lQWRxgBIY27JZg80f7V9jtMfbNDaQ?e=TBFBVW
there are other checkpoints at https://github.com/Rudrabha/Wav2Lip#getting-the-weights but this one is the fastest.

4. make sure ffmpeg is installed and is put into your PATH environment: https://phoenixnap.com/kb/ffmpeg-windows



5 Manually patch some files to make it word:

5.1 in \SillyTavern-MainBranch\public\index.html 
after line 4378 with text <div title="Narrate" class="mes_narrate fa-solid fa-bullhorn" data-i18n="[title]Narrate"></div>
add line:
<div title="Generate Video" class="mes_wav2lip fa-solid fa-video" data-i18n="[title]Generate Video"></div>


5.2. in \SillyTavern-MainBranch\public\scripts\extesions\tts\script.js
after line 11 add line:
import { wav2lipIsGeneratingNow, modify_wav2lipIsGeneratingNow, wav2lipMain} from "../wav2lip/index.js"

line 383, in function processAudioJobQueue() modify from:
playAudioData(currentAudioJob)
modify to:
if (wav2lipIsGeneratingNow !== true) playAudioData(currentAudioJob)

line 402, in function completeTtsJob() after this line:
currentTtsJob = null
add line:
if (extension_settings.wav2lip !== undefined && extension_settings.wav2lip.enabled && wav2lipIsGeneratingNow) wav2lipMain("text", 0, "char")



6.1 [Optional] patch "Silero api server" tts.py to support prosody (voice speed and pitch) 
If you installed Extras using miniconda files is located somewhere here:
[extras dir]\env\Lib\site-packages\silero_api_server\tts.py or [extras dir]\conda\Lib\site-packages\silero_api_server\tts.py

If you installed Silly Extras without conda, file is here, (Python310 dir can be Python311):
or c:\Users\[USER_NAME]\AppData\Local\Programs\Python\Python310\Lib\site-packages\silero_api_server\tts.py

in \silero_api_server\tts.py 
	line 80, modify from this:
audio_path = Path(self.model.save_wav(text=text,speaker=speaker,sample_rate=self.sample_rate))
	into this (change 'text' to 'ssml_text', to support xml as input):
audio_path = Path(self.model.save_wav(ssml_text=text,speaker=speaker,sample_rate=self.sample_rate))


6.2 [Optional] patch "Silero api server" tts.py to support other languages (ru,ua,de,fr,es and several others, list: https://github.com/snakers4/silero-models/blob/master/models.yml )
modify lines 18, 19, from
    def __init__(self, sample_path, lang="v3_en.pt") -> None:
        self.sample_text = "The fallowed fallen swindle auspacious goats in portable power stations."
for Russian language modify to (other languages file names are in list above):		
    def __init__(self, sample_path, lang="v3_1_ru.pt") -> None:
        self.sample_text = "Привет, мир! The fallowed fallen swindle auspacious goats in portable power stations."
		
modify line 49 from
    def load_model(self, lang_model="v3_en.pt"):
to:
    def load_model(self, lang_model="v3_1_ru.pt"):
