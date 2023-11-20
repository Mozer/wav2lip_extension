import {
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons,
    callPopup,
    getRequestHeaders,
    event_types,
    eventSource,
    appendImageToMessage,
    generateQuietPrompt,
    this_chid,
    getCurrentChatId,
	scrollChatToBottom,
} from "../../../../script.js";
import { Wav2LipProvider } from './wav2lip.js'
import { getApiUrl, getContext, extension_settings, doExtrasFetch, modules, renderExtensionTemplate } from "../../../extensions.js";
import { selected_group } from "../../../group-chats.js";
import { stringFormat, initScrollHeight, resetScrollHeight, getCharaFilename, saveBase64AsFile } from "../../../utils.js";
import { getMessageTimeStamp, humanizedDateTime } from "../../../RossAscends-mods.js";
import { SECRET_KEYS, secret_state } from "../../../secrets.js";
export { MODULE_NAME };
export { wav2lipMain };
export { wav2lipIsGeneratingNow };
export function modify_wav2lipIsGeneratingNow( value ) { wav2lipIsGeneratingNow = value; }

console.log("in wav2lip/index.js")

// Wraps a string into monospace font-face span
const m = x => `<span class="monospace">${x}</span>`;
// Joins an array of strings with ' / '
const j = a => a.join(' / ');
// Wraps a string into paragraph block
const p = a => `<p>${a}</p>`

const MODULE_NAME = 'wav2lip';
const UPDATE_INTERVAL = 1000;

let wav2LipProvider = new Wav2LipProvider
let wav2lipIsGeneratingNow = false


const defaultSettings = {
    provider_endpoint: "http://localhost:8001/tts",
    enabled: 1,
    auto_generate: 1,
    hide_reply_for_a_while: 1,
}

async function loadSettings() {
	// mod in public scripts extensions.js line 161
    if (extension_settings.wav2lip === undefined)
        extension_settings.wav2lip = {};

    // Ensure good format
    if (Object.keys(extension_settings.wav2lip).length === 0) {
        Object.assign(extension_settings.wav2lip, defaultSettings)
    }


    $('#wav2lip_enabled').prop('checked', extension_settings.wav2lip.enabled);
    $('#wav2lip_auto_generate').prop('checked', extension_settings.wav2lip.auto_generate);
    $('#wav2lip_hide_reply_for_a_while').prop('checked', extension_settings.wav2lip.hide_reply_for_a_while);

    //await Promise.all([loadSamplers(), loadModels()]);
}

async function onEnabledInput() {
    extension_settings.wav2lip.enabled = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onAutoGenerateInput() {
    extension_settings.wav2lip.auto_generate = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onHideReplyInput() {
    extension_settings.wav2lip.hide_reply_for_a_while = !!$(this).prop('checked');
    saveSettingsDebounced();
}


function getRawLastMessage() {
    const getLastUsableMessage = () => {
        for (const message of context.chat.slice().reverse()) {
            if (message.is_system) {
                continue;
            }

            return message.mes;
        }

        toastr.warning('No usable messages found.', 'wav2lip');
        throw new Error('No usable messages found.');
    }

    const context = getContext();
    const lastMessage = getLastUsableMessage(),
        characterDescription = context.characters[context.characterId].description,
        situation = context.characters[context.characterId].scenario;
    return `((${processReply(lastMessage)})), (${processReply(situation)}:0.7), (${processReply(characterDescription)}:0.5)`
}

async function generateVideo(_, trigger, message, callback) {
    if (!trigger || trigger.trim().length === 0) {
        console.log('Trigger word empty, aborting');
        return;
    }

    if (!isValidState()) {
        toastr.warning("Extensions API is not connected or doesn't provide wav2lip module. Enable Stable Horde to generate images.");
        return;
    }

    //extension_settings.wav2lip.sampler = $('#wav2lip_sampler').find(':selected').val();
    //extension_settings.wav2lip.model = $('#wav2lip_model').find(':selected').val();

    trigger = trigger.trim();
    const generationType = getGenerationType(trigger);
    console.log('Generation mode', generationType, 'triggered with', trigger);
    const quiet_prompt = getQuietPrompt(generationType, trigger);
    const context = getContext();

    // if context.characterId is not null, then we get context.characters[context.characterId].avatar, else we get groupId and context.groups[groupId].id
    // sadly, groups is not an array, but is a dict with keys being index numbers, so we have to filter it
    const characterName = context.characterId ? context.characters[context.characterId].name : context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]]?.id?.toString();

    const prevwav2lipHeight = extension_settings.wav2lip.height;
    const prevwav2lipWidth = extension_settings.wav2lip.width;
    const aspectRatio = extension_settings.wav2lip.width / extension_settings.wav2lip.height;

    // Face images are always portrait (pun intended)
    if (generationType == generationMode.FACE && aspectRatio >= 1) {
        // Round to nearest multiple of 64
        extension_settings.wav2lip.height = Math.round(extension_settings.wav2lip.width * 1.5 / 64) * 64;
    }

    if (generationType == generationMode.BACKGROUND) {
        // Background images are always landscape
        if (aspectRatio <= 1) {
            // Round to nearest multiple of 64
            extension_settings.wav2lip.width = Math.round(extension_settings.wav2lip.height * 1.8 / 64) * 64;
        }
        const callbackOriginal = callback;
        callback = async function (prompt, base64Image) {
            const imagePath = base64Image;
            const imgUrl = `url("${encodeURI(base64Image)}")`;
            eventSource.emit(event_types.FORCE_SET_BACKGROUND, imgUrl);

            if (typeof callbackOriginal === 'function') {
                callbackOriginal(prompt, imagePath);
            } else {
                sendMessage(prompt, imagePath);
            }
        }
    }

    try {
        const prompt = await getPrompt(generationType, message, trigger, quiet_prompt);
        console.log('Processed wav2lip prompt:', prompt);

        context.deactivateSendButtons();
        hideSwipeButtons();

        await sendGenerationRequest(generationType, prompt, characterName, callback);
    } catch (err) {
        console.trace(err);
        throw new Error('wav2lip prompt text generation failed.')
    }
    finally {
        extension_settings.wav2lip.height = prevwav2lipHeight;
        extension_settings.wav2lip.width = prevwav2lipWidth;
        context.activateSendButtons();
        showSwipeButtons();
    }
}

async function sendGenerationRequest(generationType, prompt, characterName = null, callback) {
    const prefix = generationType !== generationMode.BACKGROUND
        ? combinePrefixes(extension_settings.wav2lip.prompt_prefix, getCharacterPrefix())
        : extension_settings.wav2lip.prompt_prefix;

    const prefixedPrompt = combinePrefixes(prefix, prompt);

    let result = { format: '', data: '' };
    const currentChatId = getCurrentChatId();

    if (currentChatId !== getCurrentChatId()) {
        console.warn('Chat changed, aborting wav2lip result saving');
        toastr.warning('Chat changed, generated image discarded.', 'wav2lip');
        return;
    }

    const filename = `${characterName}_${humanizedDateTime()}`;
    const base64Image = await saveBase64AsFile(result.data, characterName, filename, result.format);
    callback ? callback(prompt, base64Image) : sendMessage(prompt, base64Image);
}

/**
 * Generates an "extras" image using a provided prompt and other settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateExtrasImage(prompt) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image';
    const result = await doExtrasFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.wav2lip.sampler,
            steps: extension_settings.wav2lip.steps,
            scale: extension_settings.wav2lip.scale,
            width: extension_settings.wav2lip.width,
            height: extension_settings.wav2lip.height,
            negative_prompt: extension_settings.wav2lip.negative_prompt,
            restore_faces: !!extension_settings.wav2lip.restore_faces,
            enable_hr: !!extension_settings.wav2lip.enable_hr,
            karras: !!extension_settings.wav2lip.horde_karras,
            hr_upscaler: extension_settings.wav2lip.hr_upscaler,
            hr_scale: extension_settings.wav2lip.hr_scale,
            denoising_strength: extension_settings.wav2lip.denoising_strength,
            hr_second_pass_steps: extension_settings.wav2lip.hr_second_pass_steps,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'jpg', data: data.image };
    } else {
        throw new Error();
    }
}


async function sendMessage(prompt, image) {
    const context = getContext();
    const messageText = `[${context.name2} sends a picture that contains: ${prompt}]`;
    const message = {
        name: context.groupId ? systemUserName : context.name2,
        is_user: false,
        is_system: true,
        send_date: getMessageTimeStamp(),
        mes: context.groupId ? p(messageText) : messageText,
        extra: {
            image: image,
            title: prompt,
        },
    };
    context.chat.push(message);
    context.addOneMessage(message);
    context.saveChat();
}

function isValidState() {
    return modules.includes('wav2lip');
}

async function moduleWorker() {
    if (isValidState()) {
        $('#wav2lip_gen').show();
        $('.wav2lip_message_gen').show();
    }
    else {
        $('#wav2lip_gen').hide();
        $('.wav2lip_message_gen').hide();
    }
}

setInterval(moduleWorker, UPDATE_INTERVAL);

async function wav2lipMessageButton(e) {
    function setBusyIcon(isBusy) {
        $icon.toggleClass('fa-paintbrush', !isBusy);
        $icon.toggleClass(busyClass, isBusy);
    }

    const busyClass = 'fa-hourglass';
    const context = getContext();
    const $icon = $(e.currentTarget);
    const $mes = $icon.closest('.mes');
    const message_id = $mes.attr('mesid');
    const message = context.chat[message_id];
    const characterName = message?.name || context.name2;
    const characterFileName = context.characterId ? context.characters[context.characterId].name : context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]]?.id?.toString();
    const messageText = message?.mes;
    const hasSavedImage = message?.extra?.image && message?.extra?.title;

    if ($icon.hasClass(busyClass)) {
        console.log('Previous image is still being generated...');
        return;
    }

    try {
        setBusyIcon(true);
        if (hasSavedImage) {
            const prompt = await refinePrompt(message.extra.title);
            message.extra.title = prompt;

            console.log('Regenerating an image, using existing prompt:', prompt);
            await sendGenerationRequest(generationMode.FREE, prompt, characterFileName, saveGeneratedImage);
        }
        else {
            console.log("doing /wav2lip raw last");
            await generateVideo('wav2lip', 'raw_last', `${characterName} said: ${messageText}`, saveGeneratedImage);
        }
    }
    catch (error) {
        console.error('Could not generate inline image: ', error);
    }
    finally {
        setBusyIcon(false);
    }

    function saveGeneratedImage(prompt, image) {
        // Some message sources may not create the extra object
        if (typeof message.extra !== 'object') {
            message.extra = {};
        }

        // If already contains an image and it's not inline - leave it as is
        message.extra.inline_image = message.extra.image && !message.extra.inline_image ? false : true;
        message.extra.image = image;
        message.extra.title = prompt;
        appendImageToMessage(message, $mes);

        context.saveChat();
    }
};

async function onWav2lipOneMessage() {
    wav2lipIsGeneratingNow = true
	// click on next tts button
	$(this).parent().find(".mes_narrate").click();
	
	const context = getContext();
    const id = $(this).closest('.mes').attr('mesid');
    const message = context.chat[id];
    const char = 1;
    const voiceId = 'any';

    if (!message) {
        return;
    }
	console.log("onWav2lipOneMessage with: "+message.mes)
}

function add_video_html()
{
	let vid_html = '';
	vid_html += '<video width="500" height="500" class="mes_img mes_img_video" src="'+extension_settings.apiUrl+'/api/wav2lip/play/wav2lip?r='+Date.now()+'" autoplay controls></video>'
	let c_mes_img_container = $(".mes_img_container").last()
	c_mes_img_container.css("display", "block")
	c_mes_img_container.find(".mes_img").remove()
	c_mes_img_container.find(".mes_img_controls").after(vid_html)
	scrollChatToBottom();
}

async function onMessageReceived() {
	if (extension_settings.wav2lip.enabled && extension_settings.wav2lip.auto_generate)
	{
		wav2lipIsGeneratingNow = true	
	}		
}

async function onCharacterMessageRendered() {
	if (extension_settings.wav2lip.enabled && extension_settings.wav2lip.auto_generate && extension_settings.wav2lip.hide_reply_for_a_while)
	{
		console.log("wav2lip onCharacterMessageRendered: hiding reply")
		let mes_obj = $(".last_mes").find(".mes_text");
		mes_obj.attr("data-html", mes_obj.html()).html("<span class='wav2lip_recording_label' title='"+mes_obj.html()+"'>[Recording video...]</span>")
	}		
}

function onCharacterVideoRendered() {
	if (extension_settings.wav2lip.enabled && extension_settings.wav2lip.auto_generate && extension_settings.wav2lip.hide_reply_for_a_while)
	{
		console.log("wav2lip onCharacterMessageRendered: showing reply")
		let mes_obj = $(".last_mes").find(".mes_text");
		mes_obj.html(mes_obj.attr("data-html")).removeAttr("data-html")
	}		
}

async function wav2lipMain(text, voiceId, char) {
    let response = await wav2LipProvider.generateWav2lip(text, voiceId)
	console.log("got wav2lip responce")
	add_video_html()
	onCharacterVideoRendered()
	wav2lipIsGeneratingNow = false
}

jQuery(async () => {
    //getContext().registerSlashCommand('wav2lip', generateVideo, [], '', true, true);

    $('#extensions_settings').append(renderExtensionTemplate('third-party/wav2lip_extension', 'settings', defaultSettings));
    $('#wav2lip_enabled').on('input', onEnabledInput);
    $('#wav2lip_auto_generate').on('input', onAutoGenerateInput);
    $('#wav2lip_hide_reply_for_a_while').on('input', onHideReplyInput);

	$(document).on('click', '.mes_wav2lip', onWav2lipOneMessage);

    await loadSettings();
	await wav2LipProvider.loadSettings(extension_settings.wav2lip)
	
	eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived)
	eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered)
});
