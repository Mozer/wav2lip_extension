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
        provider_endpoint: "http://localhost:8001/tts",
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

    async generateWav2lip(text, voiceId){
        const response = await this.fetchWav2LipGeneration(text, voiceId)
        return response
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchWav2LipGeneration(inputText, voiceId) {
        console.info(`Generating new wav2lip for voice_id ${voiceId}`)
        const response = await doExtrasFetch(
            `${this.settings.provider_endpoint}/generate`,
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
}
