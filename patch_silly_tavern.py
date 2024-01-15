import os, time, shutil, codecs


def return_patch_files():
    file_paths_with_replacements = [
        ['../../tts/index.js', 
            {"import { OpenAITtsProvider } from './openai.js';": '''import { OpenAITtsProvider } from './openai.js';
import { wav2lipIsGeneratingNow, modify_wav2lipIsGeneratingNow, wav2lipMain} from "../third-party/wav2lip_extension/index.js"''',
        
            'playAudioData(currentAudioJob);': 'if (wav2lipIsGeneratingNow !== true) playAudioData(currentAudioJob);',
            
            '''console.info(`Current TTS job for ${currentTtsJob?.name} completed.`);\r\n    currentTtsJob = null;''': '''console.info(`Current TTS job for ${currentTtsJob?.name} completed.`);
    currentTtsJob = null;
    if (extension_settings.wav2lip !== undefined && extension_settings.wav2lip.enabled && wav2lipIsGeneratingNow) wav2lipMain("text", 0, extension_settings.wav2lip.char_folder, extension_settings.wav2lip.device);'''
            }
        ],
        
        ['../../tts/silerotts.js', 
            {"'speaker': voiceId,": ''''speaker': voiceId,
                    "voice_pitch": $("#wav2lip_silero_pitch").val(),
                    "voice_speed": $("#wav2lip_silero_speed").val(),'''
            }
        ],
    ]
    
    return file_paths_with_replacements
    

def patch_files(file_paths_with_replacements):
    for file_path_with_replacements in file_paths_with_replacements:
        file_path = file_path_with_replacements[0]
        if os.path.exists(file_path):
            replacements = file_path_with_replacements[1]
            
            # Check if file has already been patched
            backup_file_path = file_path + '.bkp'
            if os.path.exists(backup_file_path):
                print(file_path+" was already patched before (.bkp file exists. If you want to patch it again - first restore the original file), skipping.")
                continue
            
            # Create backup copy of original file
            shutil.copy(file_path, backup_file_path)
            
            # Make replacements in file
            with codecs.open(file_path, encoding='utf-8', mode='r+') as f:
                file_contents = f.read()
                
                for needle, replacement in replacements.items():
                    file_contents = file_contents.replace(needle, replacement)
                    
                f.seek(0)
                f.write(file_contents)
                f.close()
                print(file_path+" successfully patched.")
        else:
            print(file_path+" is not found, skipping.")

    
if __name__ == "__main__":
    
    
    patch_files(return_patch_files())
    print ("\n\nSuccess. closing this window in 60 seconds.")
    time.sleep(60)