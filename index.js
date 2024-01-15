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
    provider_endpoint: "http://localhost:8001/wav2lip", //was tts
    enabled: 1,
    auto_generate: 1,
    hide_reply_for_a_while: 1,
    silero_language: "v3_en",
    silero_pitch: "medium",
    silero_speed: "medium",
    mode: "message", // message, live
    char_folder: "default", // inside input folder
    device: "cpu", // cpu,cuda
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
    $('#wav2lip_silero_language').prop('selected', extension_settings.wav2lip.silero_language);
    $('#wav2lip_silero_pitch').val(extension_settings.wav2lip.silero_pitch).change();
    $('#wav2lip_silero_speed').val(extension_settings.wav2lip.silero_speed).change();
	$('#wav2lip_mode').val(extension_settings.wav2lip.mode).change();
	$('#wav2lip_device').val(extension_settings.wav2lip.device).change();
	$('#wav2lip_char_folder').prop('selected', extension_settings.wav2lip.char_folder);
	extension_settings.wav2lip.provider_endpoint = $('#extensions_url').val()+"/api/wav2lip"
}

async function onEnabledInput() {
    extension_settings.wav2lip.enabled = !!$(this).prop('checked');
	if (extension_settings.wav2lip.enabled) 
	{
		eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived)
		eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered)
	}
    saveSettingsDebounced();
}

async function onAutoGenerateInput() {
    extension_settings.wav2lip.auto_generate = !!$(this).prop('checked');
	if (extension_settings.wav2lip.auto_generate) 
	{
		eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived)
		eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered)
	}
    saveSettingsDebounced();
}

async function onHideReplyInput() {
    extension_settings.wav2lip.hide_reply_for_a_while = !!$(this).prop('checked');
	if (extension_settings.wav2lip.hide_reply_for_a_while) 
	{
		eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived)
		eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered)
	}
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
	$(this).removeClass("fa-video").addClass("fa-spinner")
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

// video message
function add_video_html_to_message()
{
	let vid_html = '';
	vid_html += '<video width="500" height="500" class="mes_img mes_img_video" src="'+extension_settings.apiUrl+'/api/wav2lip/play/'+extension_settings.char_folder+'/wav2lip?r='+Date.now()+'" autoplay controls></video>'
	let c_mes_img_container = $(".mes_img_container").last()
	c_mes_img_container.css("display", "block")
	c_mes_img_container.find(".mes_img").remove()
	c_mes_img_container.find(".mes_img_controls").after(vid_html)
	scrollChatToBottom();
	$(document).find(".mes_wav2lip").removeClass("fa-spinner").addClass("fa-video")
}

// live stream create
async function live_video_create_html()
{
	if (!$("#wav2lip_live_wrap").length)
	{
		console.log("wav2lip live: created wrap")
		let vid_html = '';
		vid_html += '<div id="wav2lip_live_wrap"><video class="wav2lip_live_video" data-api_url="'+extension_settings.apiUrl+'" data-char_folder="'+extension_settings.wav2lip.char_folder+'" src="'+extension_settings.apiUrl+'/api/wav2lip/play/'+extension_settings.wav2lip.char_folder+'/silence" loop autoplay></video><div>';
		$("#chat").append(vid_html)
	}
}


// live stream play response
function live_video_play_response()
{
	$(".wav2lip_live_video").removeAttr("loop");
	$(".wav2lip_live_video").attr("src", extension_settings.apiUrl+'/api/wav2lip/play/'+extension_settings.char_folder+'/wav2lip?r='+Date.now());
	$(".wav2lip_live_video").attr("onended", "$(this).attr(\'onended\', \'\'); $(this).attr(\'loop\', \'\'); $(this).attr(\'src\', $(this).attr(\'data-api_url\')+\'/api/wav2lip/play/\'+$(this).attr(\'data-char_folder\')+\'/silence\')");
	$(document).find(".mes_wav2lip").removeClass("fa-spinner").addClass("fa-video")
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
		let mes_obj = $(".last_mes").find(".mes_text");
		if (mes_obj.attr('data-html') === undefined)
		{
			let mes_length = mes_obj.text().length;
			mes_obj.attr("data-html", mes_obj.html()).html("<span class='wav2lip_recording_label' title='"+mes_obj.text()+"'>[Recording video... "+mes_length+" symbols]</span>")
		}
		if (extension_settings.wav2lip.mode == 'live') live_video_create_html()
	}		
}

function onCharacterVideoRendered() {
	if (extension_settings.wav2lip.enabled && extension_settings.wav2lip.auto_generate && extension_settings.wav2lip.hide_reply_for_a_while)
	{
		//console.log("wav2lip onCharacterMessageRendered: showing reply")
		let mes_obj = $(".last_mes").find(".mes_text");
		mes_obj.html(mes_obj.attr("data-html")).removeAttr("data-html")
		//$( ".sd_message_gen" ).last().trigger( "click" ); // sd auto gen
	}		
}

async function wav2lipMain(text, voiceId, char, device) {
	let audio_file = "test" // silero
	if ($( "#tts_provider" ).val() == "XTTSv2") audio_file = "out" // xttsv2
	
    let response = await wav2LipProvider.generateWav2lip(text, voiceId, device, char, audio_file)
	console.log("got wav2lip responce")
	if (extension_settings.wav2lip.mode == 'live') 
	{
		console.log("adding live video")
		live_video_create_html()
		live_video_play_response()
	}
	else add_video_html_to_message()
	onCharacterVideoRendered()
	wav2lipIsGeneratingNow = false
}

/*
old  list
 ['https://models.silero.ai/models/tts/de/v3_de.pt',
 'https://models.silero.ai/models/tts/en/v3_en.pt',
 'https://models.silero.ai/models/tts/en/v3_en_indic.pt',
 'https://models.silero.ai/models/tts/es/v3_es.pt',
 'https://models.silero.ai/models/tts/fr/v3_fr.pt',
 'https://models.silero.ai/models/tts/indic/v3_indic.pt',
 'https://models.silero.ai/models/tts/ru/v3_1_ru.pt',
 'https://models.silero.ai/models/tts/tt/v3_tt.pt',
 'https://models.silero.ai/models/tts/ua/v3_ua.pt',
 'https://models.silero.ai/models/tts/uz/v3_uz.pt',
 'https://models.silero.ai/models/tts/xal/v3_xal.pt']
*/
function fill_wav2lip_silero_language()
{
	// https://models.silero.ai/models/tts/
	let langs_arr = {
		'en':['v3_en', 'v2_lj', 'v3_en_indic'],
		'ba':['v2_aigul'],
		'cyr':['v4_cyrillic'],
		'de':['v3_de', 'v2_thorsten'],
		'es':['v3_es', 'v2_tux'],
		'fr':['v3_fr', 'v2_gilles'],
		'indic':['v3_indic', 'v4_indic'],
		'multi':['v2_multi'],
		'ru':['v3_1_ru', 'v4_ru', 'ru_v3', 'v2_aidar', 'v2_baya', 'v2_irina', 'v2_kseniya', 'v2_natasha', 'v2_ruslan'],
		'tt':['v2_dilyara', 'v3_tt'],
		'ua':['v21_mykyta_48k', 'v22_mykyta_48k', 'v3_ua', 'v4_ua'],
		'uz':['v3_uz', 'v4_uz', 'v2_dilnavoz'],
		'xal':['v3_xal', 'v2_erdni'],
	};
	let langs_html = '';
	let selected_attr = '';

	for (var lang in langs_arr)
	{
		for (var lang_file in langs_arr[lang])
		{
			if (extension_settings.wav2lip.silero_language == langs_arr[lang][lang_file]) selected_attr = ' selected'
			else selected_attr = ' '
			langs_html += '<option value="'+langs_arr[lang][lang_file]+'" '+selected_attr+'>'+lang+' ('+langs_arr[lang][lang_file]+")</option>\r\n"
		}
	}
	$("#wav2lip_silero_language").html(langs_html)
}

// folders inside extras/modules/wav2lip/input/
async function fill_wav2lip_char_folders()
{
	let chars_html = '';
	let selected_attr = '';

	//let chars_arr = ['default', 'test'];
	const chars_resp = await wav2LipProvider.fetchWav2LipCharFolders()
	let chars_arr = await chars_resp.json()
	console.log(chars_arr)
	for (var char_folder in chars_arr)
	{
		
			if (extension_settings.wav2lip.char_folder == chars_arr[char_folder]) selected_attr = ' selected'
			else selected_attr = ' '
			chars_html += '<option value="'+chars_arr[char_folder]+'" '+selected_attr+'>'+chars_arr[char_folder]+"</option>\r\n"
		
	}
	$("#wav2lip_char_folder").html(chars_html)
}


async function onSileroLanguageChange()
{
	extension_settings.wav2lip.silero_language = $(document).find("#wav2lip_silero_language").val();
    saveSettingsDebounced();
	console.log("new lang file is "+$(document).find("#wav2lip_silero_language").val() );
	// call api to load model file
	let response = await wav2LipProvider.fetchWav2LipSileroSetLang(extension_settings.wav2lip.silero_language)
	$("#tts_provider").trigger("change");
	setTimeout(function() {
		$("#tts_voicemap_char_DefaultVoice_voice option:eq(1)").attr("selected", "selected");
		$("#tts_voicemap_char_DefaultVoice_voice").trigger("change");
	}, 1000);
}

async function onSileroPitchChange()
{
	extension_settings.wav2lip.silero_pitch = $(document).find("#wav2lip_silero_pitch").val();
    saveSettingsDebounced();
	console.log("new pitch is "+$(document).find("#wav2lip_silero_pitch").val() );
}

async function onSileroSpeedChange()
{
	extension_settings.wav2lip.silero_speed = $(document).find("#wav2lip_silero_speed").val();
    saveSettingsDebounced();
	console.log("new speed is "+$(document).find("#wav2lip_silero_speed").val() );
}

async function onSileroReloadSpeakers()
{
	$("#tts_provider").trigger("change");
	setTimeout(function() {
		$("#tts_voicemap_char_DefaultVoice_voice option:eq(1)").attr("selected", "selected");
		$("#tts_voicemap_char_DefaultVoice_voice").trigger("change");
	}, 1000);
}

async function onModeChange()
{
	extension_settings.wav2lip.mode = $(document).find("#wav2lip_mode").val();
    saveSettingsDebounced();
	console.log("new mode is "+$(document).find("#wav2lip_mode").val() );
	//if (extension_settings.wav2lip.mode == 'live') live_video_create_html()
	if (extension_settings.wav2lip.mode == 'message') live_video_remove_html()
}

async function onDeviceChange()
{
	extension_settings.wav2lip.device = $(document).find("#wav2lip_device").val();
    saveSettingsDebounced();
	console.log("new device is "+$(document).find("#wav2lip_device").val() );
}

async function onCharFolderChange()
{
	extension_settings.wav2lip.char_folder = $(document).find("#wav2lip_char_folder").val();
    saveSettingsDebounced();
	console.log("new char folder is "+$(document).find("#wav2lip_char_folder").val() );
}


function onExtensionsUrlChange()
{
	extension_settings.wav2lip.provider_endpoint = $('#extensions_url').val()+"/api/wav2lip"
}


function onMessageTextClick()
{
	if ($(this)[0].hasAttribute("data-html"))
	{
		let mes_obj = $(this);
		mes_obj.html(mes_obj.attr("data-html")).removeAttr("data-html")
	}
}

function live_video_remove_html()
{
	$("#wav2lip_live_wrap").remove();
}

function open_tts_voice_list()
{
	console.log("in open_tts_voice_list");
	$("#tts_settings .inline-drawer-toggle").trigger("click");
	
	setTimeout(function(){
		$("#tts_voicemap_char_DefaultVoice_voice").css('background-color', "red");
		setTimeout(function(){
			$("#tts_voicemap_char_DefaultVoice_voice").css('background-color', "unset");
		}, 500);
	}, 500);
}




jQuery(async () => {
    //getContext().registerSlashCommand('wav2lip', generateVideo, [], '', true, true);

    $('#message_template .mes_narrate').after('<div title="Generate Video" class="mes_wav2lip fa-solid fa-video" data-i18n="[title]Generate Video"></div>')
    $('#extensions_settings').append(renderExtensionTemplate('third-party/wav2lip_extension', 'settings', defaultSettings));
    $('#wav2lip_enabled').on('input', onEnabledInput);
    $('#wav2lip_auto_generate').on('input', onAutoGenerateInput);
    $('#wav2lip_hide_reply_for_a_while').on('input', onHideReplyInput);
    $('#wav2lip_silero_language').on('change', onSileroLanguageChange)
    $('#wav2lip_silero_pitch').on('change', onSileroPitchChange)
    $('#wav2lip_silero_speed').on('change', onSileroSpeedChange)
    $('#wav2lip_mode').on('change', onModeChange)
    $('#wav2lip_device').on('change', onDeviceChange)
    $('#wav2lip_char_folder').on('change', onCharFolderChange)
	$('#extensions_url').on('change', onExtensionsUrlChange)
	
	
	$(document).on('click', '.mes_wav2lip', onWav2lipOneMessage);
	$(document).on('click', '#silero_reload_speakers', onSileroReloadSpeakers);
	$(document).on('click', '.mes_text', onMessageTextClick);
	$(document).on('click', '#wav2lip_live_wrap', live_video_remove_html);
	$(document).on('click', '#wav2lip_open_tts_voice_list', open_tts_voice_list);
	
    await loadSettings()
	await wav2LipProvider.loadSettings(extension_settings.wav2lip)
	await fill_wav2lip_silero_language()
	await fill_wav2lip_char_folders()
	
	eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived)
	eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onCharacterMessageRendered)
	
	//$( document ).on( "ended", ".wav2lip_live_video", function() {
	//  alert( "Goodbye!" );  // jQuery 1.7+
	//});

});
