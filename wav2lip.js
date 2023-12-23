import { doExtrasFetch, getApiUrl, modules } from "../../../extensions.js"

export { Wav2LipProvider }

console.log("in wav2lip/wav2lip.js");

class Wav2LipProvider {
    //########//
    // Config //
    //########//

    settings
    ready = false
    voices = []
    separator = ' .. '

    defaultSettings = {
        provider_endpoint: "http://localhost:8001/wav2lip",
        voiceMap: {}
    }

    async loadSettings(settings) {
		console.debug("Wav2lip: in loadSettings()")
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default wav2lip Provider settings")
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings){
            if (key in this.settings){
                this.settings[key] = settings[key]
            } else {
                //console.log( `Invalid setting passed to wav2lip Provider: ${key}`)
            }
        }

        const apiCheckInterval = setInterval(() => {
            // Use Extras API if wav2lip support is enabled
            if (modules.includes('wav2lip')) {
                const baseUrl = new URL(getApiUrl());
                baseUrl.pathname = '/api/wav2lip';
                this.settings.provider_endpoint = baseUrl.toString();
                $('#wav2lip_endpoint').val(this.settings.provider_endpoint);
                clearInterval(apiCheckInterval);
            }
        }, 2000);

        $('#wav2lip_endpoint').val(this.settings.provider_endpoint)
        $('#wav2lip_endpoint').on("input", () => {this.onSettingsChange()})

        await this.checkReady()

        console.debug("Wav2lip: Settings loaded")
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady(){
        //await this.fetchTtsVoiceObjects()
    }

    async onRefreshClick() {
        return
    }

    //#################//
    //  wav2lip Interfaces //
    //#################//

    async generateWav2lip(text, voiceId, device, char_folder, audio){
        const response = await this.fetchWav2LipGeneration(text, voiceId, device, char_folder, audio)
        return response
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchWav2LipGeneration(inputText, voiceId, device, char_floder, audio) {
        console.info(`Generating new wav2lip for voice_id ${voiceId}`)
        const response = await doExtrasFetch(
            `${this.settings.provider_endpoint}/generate/${char_floder}/${device}/${audio}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
					'Cache-Control': 'no-cache'  // Added this line to disable caching of file so new files are always played - Rolyat 7/7/23
                },
                body: JSON.stringify({
                    "text": inputText,
                    "speaker": voiceId
                })
            }
        )
        if (!response.ok) {
            toastr.error(response.statusText, 'Wav2Lip Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response
    }
	
	async fetchWav2LipSileroSetLang(silero_language) {
        console.info(`Setting fetchWav2LipSileroSetLang ${silero_language}`)
		const response = await doExtrasFetch(
			`${this.settings.provider_endpoint}/silero_set_lang/`+silero_language,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache'  // Added this line to disable caching of file so new files are always played - Rolyat 7/7/23
				}
			}
		)
		if (!response.ok) {
			toastr.error(response.statusText, 'Wav2Lip set language '+silero_language+' Failed');
			throw new Error(`HTTP ${response.status}: ${await response.text()}`);
		}
		return response
	}
	
	async fetchWav2LipCharFolders() {
        console.info(`Getting fetchWav2LipCharFolders`)
		const response = await doExtrasFetch(
			`${this.settings.provider_endpoint}/get_chars`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Cache-Control': 'no-cache'  // Added this line to disable caching of file so new files are always played - Rolyat 7/7/23
				}
			}
		)
		if (!response.ok) {
			toastr.error(response.statusText, 'Wav2Lip get chars Failed');
			throw new Error(`HTTP ${response.status}: ${await response.text()}`);
		}
		return response
	}
	
}
