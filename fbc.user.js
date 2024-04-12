/* eslint-disable no-inline-comments */
// @ts-check

/**
 *     BCE/FBC
 *  Copyright (C) 2024  Sid
 *
 *  This program is free software: you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

async function ForBetterClub() {
	"use strict";

	const FBC_VERSION = "5.8";
	const settingsVersion = 58;

	const fbcChangelog = `${FBC_VERSION}
- Changed discreet mode to allow friend list and main hall backgrounds
- Changed /beep to respect BCX beep restrictions

5.7
- Added support for R102
- Changed characters with notes to have cyan FBC version number

5.6
- Changed modals to use FUSAM's modal system

5.5
- Fixed a bug where local settings would get priority over online settings, which could cause issues when using multiple devices
`;

	const SUPPORTED_GAME_VERSIONS = ["R102"];
	const CAPABILITIES = /** @type {const} */ (["clubslave", "antigarble"]);

	const w = window;

	if (w.FBC_VERSION) {
		console.warn("FBC already loaded. Skipping load.");
		return;
	}

	if (typeof bcModSdk !== "object" || !bcModSdk) {
		console.warn("bcModSdk not found. Skipping load.");
		alert(
			"bcModSdk not found. FBC will not load. Loading FBC is only supported via FUSAM."
		);
		return;
	}

	if (typeof FUSAM !== "object" || !FUSAM?.present) {
		console.warn("FUSAM not found. Skipping load.");
		return;
	}

	const SDK = bcModSdk.registerMod(
		{
			name: "FBC",
			version: FBC_VERSION,
			fullName: "For Better Club",
			repository: "https://gitlab.com/Sidiousious/bce.git",
		},
		{
			allowReplace: false,
		}
	);
	/** @type {import('./types/bcxExternalInterface').BCX_ModAPI | null} */
	let BCX = null;

	w.FBC_VERSION = FBC_VERSION;

	const DISCORD_INVITE_URL = "https://discord.gg/SHJMjEh9VH";
	const WEBSITE_URL = "https://sidiousious.gitlab.io/bce/";

	const BCE_COLOR_ADJUSTMENTS_CLASS_NAME = "bce-colors",
		BCE_LICENSE = "https://gitlab.com/Sidiousious/bce/-/blob/main/LICENSE",
		BCE_MAX_AROUSAL = 99.6,
		BCE_MSG = "BCEMsg",
		BCX_ORIGINAL_MESSAGE = "BCX_ORIGINAL_MESSAGE",
		BEEP_CLICK_ACTIONS = Object.freeze({
			/** @type {"FriendList"} */
			FriendList: "FriendList",
		}),
		CLOSINGBRACKETINDICATOR = "\\uf130\\u005d",
		DARK_INPUT_CLASS = "bce-dark-input",
		DEFAULT_WARDROBE_SIZE = 24,
		EXPANDED_WARDROBE_SIZE = 96,
		GAGBYPASSINDICATOR = "\uf123",
		HIDDEN = "Hidden",
		INPUT_WARN_CLASS = "bce-input-warn",
		MESSAGE_TYPES = Object.freeze({
			Activity: "Activity",
			ArousalSync: "ArousalSync",
			Hello: "Hello",
		}),
		WHISPER_CLASS = "bce-whisper-input";

	const EMBED_TYPE = /** @type {const} */ ({
		Image: "img",
		None: "",
		Untrusted: "none-img",
	});

	if (typeof ChatRoomCharacter === "undefined") {
		console.warn("Bondage Club not detected. Skipping FBC initialization.");
		return;
	}

	/** @type {{ level: "error" | "warn" | "info" | "debug", message: string }[]} */
	const pastLogs = new Array(100);

	/** @type {Map<string, "allowed" | "denied">} */
	const sessionCustomOrigins = new Map();

	/** @type {FBCToySyncState} */
	const toySyncState = {
		deviceSettings: new Map(),
	};

	const HOOK_PRIORITIES = /** @type {const} */ ({
		Top: 11,
		OverrideBehaviour: 10,
		ModifyBehaviourHigh: 6,
		ModifyBehaviourMedium: 5,
		ModifyBehaviourLow: 4,
		AddBehaviour: 3,
		Observe: 0,
	});

	/**
	 * @type {Record<keyof defaultSettings, string | boolean> & {version: number}}
	 */
	// @ts-ignore -- this is fully initialized in loadSettings
	let fbcSettings = {};
	let postSettingsHasRun = false;

	const defaultSettings = /** @type {const} */ ({
		animationEngine: {
			label: "Animation Engine",
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue && Player.ArousalSettings) {
					// Disable conflicting settings
					Player.ArousalSettings.AffectExpression = false;
				}
			},
			value: false,
			category: "activities",
			description:
				"Enables the animation engine. This will replace the game's expression and pose system.",
		},
		expressions: {
			label: "Automatic Arousal Expressions (Replaces Vanilla)",
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					fbcSettings.animationEngine = true;
					defaultSettings.animationEngine.sideEffects(true);
				}
				debug("expressions", newValue);
			},
			value: false,
			category: "activities",
			description: "Automatically express arousal when performing an activity.",
		},
		activityExpressions: {
			label: "Activity Expressions",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					fbcSettings.animationEngine = true;
					defaultSettings.animationEngine.sideEffects(true);
				}
				debug("activityExpressions", newValue);
			},
			category: "activities",
			description: "Automatically express reactions to certain activities.",
		},
		alternateArousal: {
			label:
				"Alternate Arousal (Replaces Vanilla, requires hybrid/locked arousal meter)",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				sendHello();
				Player.BCEArousal = !!newValue;
				Player.BCEArousalProgress = Math.min(
					BCE_MAX_AROUSAL,
					Player.ArousalSettings?.Progress ?? 0
				);
				debug("alternateArousal", newValue);
			},
			category: "activities",
			description: "More intense activities will affect arousal faster.",
		},
		stutters: {
			label: "Alternative speech stutter",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("stutters", newValue);
			},
			category: "activities",
			description:
				"More stuttering at high arousal, moans between words with vibrators.",
		},
		numericArousalMeter: {
			label: "Show numeric arousal meter",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("numericArousalMeter", newValue);
			},
			category: "activities",
			description: "Shows the numeric value of arousal meters when expanded.",
		},
		layeringMenu: {
			label: "Enable layering menus",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("layeringMenu", newValue);
			},
			category: "appearance",
			description:
				"Adds additional options when looking at equipped items or pieces of clothing.",
		},
		extendedWardrobe: {
			label: "Extended wardrobe slots (96)",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("extendedWardrobe", newValue);
				if (newValue) {
					if (Player.Wardrobe) {
						WardrobeSize = EXPANDED_WARDROBE_SIZE;
						loadExtendedWardrobe(Player.Wardrobe);
						// Call compress wardrobe to save existing outfits, if another addon has extended the wardrobe
						CharacterCompressWardrobe(Player.Wardrobe);
					} else {
						logWarn("Player.Wardrobe not found, skipping wardrobe extension");
					}
				} else {
					// Restore original size
					WardrobeSize = DEFAULT_WARDROBE_SIZE;
					WardrobeFixLength();
					CharacterAppearanceWardrobeOffset = 0;
				}
			},
			category: "appearance",
			description:
				"Increase the amount of wardrobe slots to save more outfits.",
		},
		privateWardrobe: {
			label: "Replace wardrobe list with character previews",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("privateWardrobe", newValue);
			},
			category: "appearance",
			description:
				"Allows you to preview all saved outfits at a glance, no more having to remember names.",
		},
		automateCacheClear: {
			label: "Clear Drawing Cache Hourly",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("automateCacheClear", newValue);
			},
			category: "performance",
			description:
				"Automatically clears the drawing cache every hour, preventing memory usage from growing out of control during long play sessions.",
		},
		instantMessenger: {
			label: "Instant messenger",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("instantMessenger", newValue);
			},
			category: "chat",
			description:
				"Allows you to send messages to other players without having to open the friends list, with enhancements.",
		},
		augmentChat: {
			label: "Chat Links and Embeds",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("augmentChat", newValue);
			},
			category: "chat",
			description:
				"Adds clickable links and image embeds from trusted domains only (e.g. imgur) to chat messages.",
		},
		ctrlEnterOoc: {
			label: "Use Ctrl+Enter to OOC",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("ctrlEnterOoc", newValue);
			},
			category: "chat",
			description: "Allows you to use Ctrl+Enter to send OOC messages.",
		},
		whisperInput: {
			label: "Use italics for input when whispering",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("whisperInput", newValue);
			},
			category: "chat",
			description:
				"Changes the input field to italics when you're in whisper mode to make it more obvious.",
		},
		chatColors: {
			label: "Improve colors for readability",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					document.body.classList.add(BCE_COLOR_ADJUSTMENTS_CLASS_NAME);
				} else {
					document.body.classList.remove(BCE_COLOR_ADJUSTMENTS_CLASS_NAME);
				}
				debug("chatColors", newValue);
			},
			category: "chat",
			description:
				"Improves contrast between the colors used for chat messages to comply with web accessibility standards.",
		},
		friendPresenceNotifications: {
			label: "Show friend presence notifications",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("friendPresenceNotifications", newValue);
			},
			category: "chat",
			description:
				"Enables friend presence tracking and shows a notification when a friend logs in.",
		},
		friendOfflineNotifications: {
			label: "Show friends going offline too",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("friendOfflineNotifications", newValue);
			},
			category: "chat",
			description:
				"Shows a notification when a friend logs out. (Requires friend presence)",
		},
		friendNotificationsInChat: {
			label: "Show friend presence notifications in chat, when possible",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("friendNotificationsInChat", newValue);
			},
			category: "chat",
			description:
				"Shows friend presence notifications in chat, when possible. (Requires friend presence)",
		},
		pastProfiles: {
			label: "Save & browse seen profiles (requires refresh)",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("pastProfiles", newValue);
			},
			category: "chat",
			description:
				"Saves the profiles for everyone you've seen and allows you to browse them using /profiles in chatrooms.",
		},
		pendingMessages: {
			label: "Show sent messages while waiting for server",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("showSentMessages", newValue);
			},
			category: "chat",
			description:
				"Shows messages you've sent while waiting for the server to respond, confirming you have sent the message and the server is just being slow.",
		},
		whisperButton: {
			label: "Show whisper button on chat messages",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("whisperButton", newValue);
			},
			category: "chat",
			description:
				"Adds a whisper button to chat messages, allowing you to whisper to the sender more conveniently.",
		},
		richOnlineProfile: {
			label: "Rich online profile",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("richOnlineProfile", newValue);
			},
			category: "chat",
			description:
				"Changes the online profile to support clickable links and embedded images.",
		},
		gagspeak: {
			label: "Understand All Gagged and when Deafened",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("gagspeak", newValue);
			},
			category: "cheats",
			description:
				"Bypasses gagged effect on others and deafen effect on yourself. You'll still be unable to understand others if they use FBC's gag anti-cheat.",
		},
		lockpick: {
			label: "Reveal Lockpicking Order Based on Skill",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("lockpick", newValue);
			},
			category: "cheats",
			description:
				"Randomly reveals the order of some of the pins with higher lockpicking skill revealing more pins on average. Picking can still be impossible like other forms of struggling.",
		},
		allowLayeringWhileBound: {
			label: "Allow layering menus while bound",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("allowLayeringWhileBound", newValue);
				if (newValue && !fbcSettings.layeringMenu) {
					fbcSettings.layeringMenu = true;
					defaultSettings.layeringMenu.sideEffects(true);
				}
			},
			category: "cheats",
			description:
				"Allows you to open menus while bound, even if they're disabled in the settings.",
		},
		autoStruggle: {
			label: "Make automatic progress while struggling",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("autoStruggle", newValue);
			},
			category: "cheats",
			description:
				"All three forms of struggling will be completed automatically in a realistic amount of time, if the restraint is possible to struggle out of.",
		},
		allowIMBypassBCX: {
			label: "Allow IMs to bypass BCX beep restrictions",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("allowIMBypassBCX", newValue);
			},
			category: "cheats",
			description:
				"This setting is temporary until BCX supports a focus mode rule.",
		},
		toySync: {
			label: "Enable buttplug.io (requires refresh)",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("toySync", newValue);
			},
			category: "buttplug",
			description:
				"Allows the game to control your real vibrators. For a list of supported vibrators see https://buttplug.io",
		},
		antiAntiGarble: {
			label: "Limited gag anti-cheat: cloth-gag equivalent garbling",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					fbcSettings.antiAntiGarbleStrong = false;
					fbcSettings.antiAntiGarbleExtra = false;
				}
				debug("antiAntiGarble", newValue);
				sendHello();
			},
			category: "immersion",
			description:
				"Slur your speech a little bit while gagged forcing others, even those cheating, to have some trouble understanding you.",
		},
		antiAntiGarbleStrong: {
			label: "Full gag anti-cheat: use equipped gags to determine garbling",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					fbcSettings.antiAntiGarble = false;
					fbcSettings.antiAntiGarbleExtra = false;
				}
				debug("antiAntiGarbleStrong", newValue);
				sendHello();
			},
			category: "immersion",
			description:
				"Use equipped gags' full effect to prevent others from understanding you fully, even those that are cheating.",
		},
		antiAntiGarbleExtra: {
			label:
				"Extra gag anti-cheat: even more garbling for the most extreme gags",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					fbcSettings.antiAntiGarble = false;
					fbcSettings.antiAntiGarbleStrong = false;
				}
				debug("antiAntiGarbleExtra", newValue);
				sendHello();
			},
			category: "immersion",
			description:
				"Use equipped gags' full effect to prevent others from understanding you fully, even those that are cheating. This option adds another level of gagging for the most extreme predicaments, preventing you from making much sound at all.",
		},
		blindWithoutGlasses: {
			label: "Require glasses to see",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (!newValue) {
					removeCustomEffect("BlurLight");
				}
				debug("blindWithoutGlasses", newValue);
			},
			category: "immersion",
			description: "You will be partially blinded while not wearing glasses.",
		},
		leashAlways: {
			label:
				"Allow leashing without wearing a leashable item (requires leasher to have FBC too)",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("leashAlways", newValue);
				if (newValue) {
					enableLeashing();
				} else {
					disableLeashing();
				}
			},
			category: "immersion",
			description:
				"Allows you to be leashed between rooms even when you are not wearing an item that counts as a leash to allow roleplaying being carried in arms.",
		},
		hideHiddenItemsIcon: {
			label: "Hide the hidden items icon",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("hideHiddenItemsIcon", newValue);
			},
			category: "immersion",
			description:
				"You can choose to hide items (not on extreme difficulty). The game shows an icon on players that have hidden items. This option hides that icon.",
		},
		itemAntiCheat: {
			label: "Enable anti-cheat",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("itemAntiCheat", newValue);
			},
			category: "immersion",
			description:
				"Prevents certain console cheats from impacting your character. Whitelisted actors are exempt from this.",
		},
		antiCheatBlackList: {
			label: "Blacklist detected cheaters automatically",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("antiCheatBlackList", newValue);
			},
			category: "immersion",
			description:
				"Automatically blacklist detected cheaters. Whitelisted actors are exempt from this.",
		},
		uwall: {
			label: "Enable uwall anti-cheat",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("uwall", newValue);
				if (Player?.OnlineSharedSettings && typeof newValue === "boolean") {
					Player.OnlineSharedSettings.Uwall = newValue;
					ServerAccountUpdate.QueueData({
						OnlineSharedSettings: Player.OnlineSharedSettings,
					});
				} else {
					logWarn("Player.OnlineSharedSettings not found, skipping uwall");
				}
			},
			category: "immersion",
			description:
				"Prevents certain other addon cheats from impacting your character.",
		},
		relogin: {
			label: "Automatic Relogin on Disconnect",
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("relogin", newValue);
			},
			value: true,
			category: "misc",
			description:
				"Automatically re-enter your password after you disconnect from the game. For convenience or AFK. Requires the password for the current account to have been saved in the login screen. Passwords are saved in your browser's local storage in plain text.",
		},
		showQuickAntiGarble: {
			label: "Show gag cheat and anti-cheat options in chat",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				if (newValue) {
					ChatRoomChatInputRect = [1356, 950, 700, 82];
				} else {
					// Default from club
					ChatRoomChatInputRect = [1456, 950, 900, 82];
				}
				debug("showQuickAntiGarble", newValue);
			},
			category: "misc",
			description:
				"Adds a quick switch for the two options next to the chat input area.",
		},
		ghostNewUsers: {
			label: "Automatically ghost+blocklist unnaturally new users",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("ghostNewUsers", newValue);
			},
			category: "misc",
			description:
				"Automatically ghost+blocklist unnaturally new users. This is useful for preventing malicious bots, but is not recommended to be enabled normally.",
		},
		confirmLeave: {
			label: "Confirm leaving the game",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("confirmLeave", newValue);
			},
			category: "misc",
			description:
				"When you leave the game, you will be prompted to confirm your decision. This is useful for preventing accidentally closing the tab, but will cause you to reconnect.",
		},
		discreetMode: {
			label: "Discreet mode (disable drawing)",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("discreetMode", newValue);
				if (newValue) {
					/** @type {HTMLLinkElement} */
					(document.getElementById("favicon")).href =
						"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAZiS0dEAP8A/wD/oL2nkwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAd0SU1FB9oFFAADATTAuQQAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAAEklEQVQ4y2NgGAWjYBSMAggAAAQQAAGFP6pyAAAAAElFTkSuQmCC";
					document.title = "OnlineChat";
				}
			},
			category: "misc",
			description:
				"Disables drawing on the screen. This is useful for preventing accidental drawing.",
		},
		customContentDomainCheck: {
			label: "Prompt before loading content from a 3rd party domain",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("customContentDomainCheck", newValue);
			},
			category: "misc",
			description:
				"Show a confirmation prompt before allowing content from a 3rd party domain to be loaded.",
		},
		shareAddons: {
			label: "Share Addons",
			value: true,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("shareAddons", newValue);
			},
			category: "misc",
			description:
				"Share a list of your installed addons with other FBC users in the room, visible via /versions chat command.",
		},
		fpsCounter: {
			label: "Show FPS counter",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("fpsCounter", newValue);
			},
			category: "performance",
			description:
				"Shows the current FPS in the top-left corner of the screen.",
		},
		limitFPSInBackground: {
			label: "Limit FPS in background",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("limitFPSInBackground", newValue);
			},
			category: "performance",
			description:
				"Limits the FPS to 10 in the background. This is useful for saving resources when you are not interacting with the game.",
		},
		limitFPSTo15: {
			label: "Limit FPS to ~15",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("limitFPSTo15", newValue);
				if (newValue) {
					fbcSettings.limitFPSTo30 = false;
					fbcSettings.limitFPSTo60 = false;
				}
			},
			category: "performance",
			description: "Limits the FPS to 15. This is useful for saving resources.",
		},
		limitFPSTo30: {
			label: "Limit FPS to ~30",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("limitFPSTo30", newValue);
				if (newValue) {
					fbcSettings.limitFPSTo15 = false;
					fbcSettings.limitFPSTo60 = false;
				}
			},
			category: "performance",
			description: "Limits the FPS to 30. This is useful for saving resources.",
		},
		limitFPSTo60: {
			label: "Limit FPS to ~60",
			value: false,
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("limitFPSTo60", newValue);
				if (newValue) {
					fbcSettings.limitFPSTo30 = false;
					fbcSettings.limitFPSTo15 = false;
				}
			},
			category: "performance",
			description: "Limits the FPS to 60. This is useful for saving resources.",
		},
		buttplugDevices: {
			label: "Buttplug Devices",
			value: "",
			/**
			 * @param {unknown} newValue
			 */
			sideEffects: (newValue) => {
				debug("buttplugDevices", newValue);
				// Don't handle empty string
				if (newValue === "") {
					return;
				}
				try {
					if (!isString(newValue)) {
						throw new Error("expected string for buttplugDevices");
					}
					const devices = /** @type {FBCToySetting[]} */ (parseJSON(newValue));
					if (!Array.isArray(devices)) {
						throw new Error("expected array for devices");
					}
					for (const device of devices) {
						toySyncState.deviceSettings.set(device.Name, device);
					}
				} catch (ex) {
					logError(ex);
				}
			},
			category: "hidden",
			description: "",
		},
	});

	/** @type {[any, any][]} */
	const listeners = [];
	/** @type {typeof ServerSocket.on} */
	function registerSocketListener(event, cb) {
		if (!listeners.some((l) => l[1] === cb)) {
			listeners.push([event, cb]);
			// @ts-ignore - too lazy to fix
			return ServerSocket.on(event, cb);
		}
		// @ts-ignore - too lazy to fix
		return null;
	}

	function appendSocketListenersToInit() {
		SDK.hookFunction(
			"ServerInit",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ServerInit>} args
			 */
			(args, next) => {
				const ret = next(args);
				for (const [event, cb] of listeners) {
					ServerSocket.on(event, cb);
				}
				return ret;
			}
		);
	}

	function settingsLoaded() {
		return postSettingsHasRun;
	}

	const bceSettingKey = () => `bce.settings.${Player?.AccountName}`;

	/**
	 * @type {() => Promise<typeof fbcSettings>}
	 */
	const bceLoadSettings = async () => {
		await waitFor(() => !!Player?.AccountName);
		const key = bceSettingKey();
		debug("loading settings");
		if (Object.keys(fbcSettings).length === 0) {
			let settings = /** @type {typeof fbcSettings | null} */ (
				parseJSON(localStorage.getItem(key))
			);
			const onlineSettings = /** @type {typeof fbcSettings | null} */ (
				parseJSON(
					LZString.decompressFromBase64(
						// eslint-disable-next-line deprecation/deprecation
						Player.ExtensionSettings.FBC || (Player.OnlineSettings?.BCE ?? "")
					) || null
				)
			);
			if (!onlineSettings) {
				logWarn("No online settings found");
				debug("onlineSettings", Player.OnlineSettings);
				debug("extensionSettings", Player.ExtensionSettings);
			}
			// eslint-disable-next-line deprecation/deprecation
			if (Player.OnlineSettings?.BCE) {
				// eslint-disable-next-line deprecation/deprecation
				Player.ExtensionSettings.FBC = Player.OnlineSettings.BCE;
				ServerPlayerExtensionSettingsSync("FBC");
				logInfo("Migrated online settings to extension settings");
				// eslint-disable-next-line deprecation/deprecation
				delete Player.OnlineSettings.BCE;
			}
			const localVersion = settings?.version || 0;
			if (onlineSettings && onlineSettings.version >= localVersion) {
				logInfo("using online settings");
				settings = onlineSettings;
			}
			if (!isNonNullObject(settings)) {
				debug("no settings", key);
				fbcBeepNotify(
					"Welcome to FBC",
					`Welcome to For Better Club v${w.FBC_VERSION}! As this is your first time using FBC on this account, you may want to check out the settings page for some options to customize your experience. You can find it in the game preferences. Enjoy! In case of problems, you can contact us via Discord at ${DISCORD_INVITE_URL}`
				);
				// @ts-expect-error -- this is fully populated in the loop below
				settings = {};
			}

			if (!isNonNullObject(settings)) {
				throw new Error("failed to initialize settings");
			}

			for (const [setting] of objEntries(defaultSettings)) {
				if (!(setting in settings)) {
					if (setting === "activityExpressions" && "expressions" in settings) {
						settings[setting] = settings.expressions;
						continue;
					}
					settings[setting] = defaultSettings[setting].value;
				}
			}
			if (
				typeof settings.version === "undefined" ||
				settings.version < settingsVersion
			) {
				beepChangelog();
			}
			settings.version = settingsVersion;
			fbcSettings = settings;
			return settings;
		}
		return fbcSettings;
	};

	const bceSaveSettings = () => {
		debug("saving settings");
		if (toySyncState.deviceSettings.size > 0) {
			fbcSettings.buttplugDevices = JSON.stringify(
				Array.from(toySyncState.deviceSettings.values())
			);
		}
		localStorage.setItem(bceSettingKey(), JSON.stringify(fbcSettings));
		Player.ExtensionSettings.FBC = LZString.compressToBase64(
			JSON.stringify(fbcSettings)
		);
		ServerPlayerExtensionSettingsSync("FBC");
		debug("saved settings", fbcSettings);
	};

	/**
	 * @param {string} key
	 * @returns {key is keyof typeof defaultSettings}
	 */
	function isDefaultSettingKey(key) {
		return key in defaultSettings;
	}

	function postSettings() {
		debug("handling settings side effects");
		for (const [k, v] of objEntries(fbcSettings)) {
			if (k === "version") {
				continue;
			}
			if (!isDefaultSettingKey(k)) {
				logWarn("Deleting unknown setting", k);
				delete fbcSettings[k];
				continue;
			}
			defaultSettings[k].sideEffects(v);
		}
		bceSaveSettings();

		postSettingsHasRun = true;
	}

	function blockAntiGarble() {
		return !!(
			fbcSettings.antiAntiGarble ||
			fbcSettings.antiAntiGarbleStrong ||
			fbcSettings.antiAntiGarbleExtra
		);
	}

	// ICONS
	const ICONS = Object.freeze({
		BCE_USER:
			"data:image/png;base64,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",
		LAYERS:
			"data:image/png;base64,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",
		LOGO: "data:image/png;base64,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d3cudzMub3JnLzE5OTkvMDIvMjItcmRmLXN5bnRheC1ucyMiPgogIDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiCiAgICB4bWxuczppcHRjRXh0PSJodHRwOi8vaXB0Yy5vcmcvc3RkL0lwdGM0eG1wRXh0LzIwMDgtMDItMjkvIgogICAgeG1sbnM6eG1wTU09Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9tbS8iCiAgICB4bWxuczpzdEV2dD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL3NUeXBlL1Jlc291cmNlRXZlbnQjIgogICAgeG1sbnM6cGx1cz0iaHR0cDovL25zLnVzZXBsdXMub3JnL2xkZi94bXAvMS4wLyIKICAgIHhtbG5zOkdJTVA9Imh0dHA6Ly93d3cuZ2ltcC5vcmcveG1wLyIKICAgIHhtbG5zOmRjPSJodHRwOi8vcHVybC5vcmcvZGMvZWxlbWVudHMvMS4xLyIKICAgIHhtbG5zOnRpZmY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vdGlmZi8xLjAvIgogICAgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIgogICB4bXBNTTpEb2N1bWVudElEPSJnaW1wOmRvY2lkOmdpbXA6ZjI0Zjk4NjItYjMyMC00ZWZiLWIwOTEtZjIzYTQwYTYwNjAxIgogICB4bXBNTTpJbnN0YW5jZUlEPSJ4bXAuaWlkOjhhMGY1NmRjLTljYmUtNDMzYS1iMzQ5LWEwOTJmNzczMjFmYiIKICAgeG1wTU06T3JpZ2luYWxEb2N1bWVudElEPSJ4bXAuZGlkOjQzZjM5ZWU5LWQxODEtNGE4NS04ZDg3LWFiNTcyYjYxNGMzNCIKICAgR0lNUDpBUEk9IjIuMCIKICAgR0lNUDpQbGF0Zm9ybT0iV2luZG93cyIKICAgR0lNUDpUaW1lU3RhbXA9IjE2NDIxMjc4ODYyNDUzMTQiCiAgIEdJTVA6VmVyc2lvbj0iMi4xMC4yMiIKICAgZGM6Rm9ybWF0PSJpbWFnZS9wbmciCiAgIHRpZmY6T3JpZW50YXRpb249IjEiCiAgIHhtcDpDcmVhdG9yVG9vbD0iR0lNUCAyLjEwIj4KICAgPGlwdGNFeHQ6TG9jYXRpb25DcmVhdGVkPgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6TG9jYXRpb25DcmVhdGVkPgogICA8aXB0Y0V4dDpMb2NhdGlvblNob3duPgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6TG9jYXRpb25TaG93bj4KICAgPGlwdGNFeHQ6QXJ0d29ya09yT2JqZWN0PgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6QXJ0d29ya09yT2JqZWN0PgogICA8aXB0Y0V4dDpSZWdpc3RyeUlkPgogICAgPHJkZjpCYWcvPgogICA8L2lwdGNFeHQ6UmVnaXN0cnlJZD4KICAgPHhtcE1NOkhpc3Rvcnk+CiAgICA8cmRmOlNlcT4KICAgICA8cmRmOmxpCiAgICAgIHN0RXZ0OmFjdGlvbj0ic2F2ZWQiCiAgICAgIHN0RXZ0OmNoYW5nZWQ9Ii8iCiAgICAgIHN0RXZ0Omluc3RhbmNlSUQ9InhtcC5paWQ6Y2I4MGJiZmUtMDUzYi00OTU2LTk1ZjQtNzQxZjExNDY4OTJhIgogICAgICBzdEV2dDpzb2Z0d2FyZUFnZW50PSJHaW1wIDIuMTAgKFdpbmRvd3MpIgogICAgICBzdEV2dDp3aGVuPSIyMDIyLTAxLTEzVDIxOjM4OjA2Ii8+CiAgICA8L3JkZjpTZXE+CiAgIDwveG1wTU06SGlzdG9yeT4KICAgPHBsdXM6SW1hZ2VTdXBwbGllcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkltYWdlU3VwcGxpZXI+CiAgIDxwbHVzOkltYWdlQ3JlYXRvcj4KICAgIDxyZGY6U2VxLz4KICAgPC9wbHVzOkltYWdlQ3JlYXRvcj4KICAgPHBsdXM6Q29weXJpZ2h0T3duZXI+CiAgICA8cmRmOlNlcS8+CiAgIDwvcGx1czpDb3B5cmlnaHRPd25lcj4KICAgPHBsdXM6TGljZW5zb3I+CiAgICA8cmRmOlNlcS8+CiAgIDwvcGx1czpMaWNlbnNvcj4KICA8L3JkZjpEZXNjcmlwdGlvbj4KIDwvcmRmOlJERj4KPC94OnhtcG1ldGE+CiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgCiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAKICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIAogICAgICAgICAgICAgICAgICAgICAgICAgICAKPD94cGFja2V0IGVuZD0idyI/Pmcw/BEAAAACYktHRAD/h4/MvwAAAAlwSFlzAAAuIwAALiMBeKU/dgAAAAd0SU1FB+YBDgImBvhP/sMAAAAZdEVYdENvbW1lbnQAQ3JlYXRlZCB3aXRoIEdJTVBXgQ4XAAAV50lEQVRo3qXbeYxleXUf8M+977611u7qfZuZnl5mZxiWGQ/YDJjNHmJjTJxEcSQUOf8QW9ixUKLEUXAiWQrGiSI7kWJLJo4dgrETO8IQSARhWMaAGWDGs/dMd0/vXdW119vvkj/er16/qq7qGfAtlfSq7nbuued8z/d8f+dFRVEgR6GrL1UY07ZsUt2ylmkrZpRBgcirb7lUW1suVhbryURiZRV09RQiiUhJoSdRGp5bNWVFW0VFIlFSEomQFAqFTI5VbR2FvjUXHFa4YMGMVWPScKniNRkLibJrFvRFxuy0bEUuUlLVUFjTVUhM6MmNhbMiZVRdVBhXV1NVliCSDLzQk0osWtFVSHVcMqPunBWzalKZH3wr2WPSFa94Ra7qgKpZq8NrlZApNBQmNEAsFjkh8oqdJowbMyZSQpJLdbV0jFt02qRYrK8p13ZF2RX3yV+TccXI5yiETNkhey067aonZUpqGsq6WloolB2w4qJdquEKZUuOeNFlPV19hUJNSZLralq1pqJpFo0QDJGLFt3qkkMbzHg1M0f/s27wHrt0zLlsRduSjn54JFLfN6aNnRKFyJJlk3Z7XjJ8p2WxJNW2YtWqGbEVZWUtTSVdL4pdNmbyhzB28/5I3RGHZPrWLGrqSqUKibIdlj2LGdCxZK+7PG9RhFjJmJIk1bKkrSk1KbVoRk8TL7viiOe9dSRTfzhT1xGkEIuVNew2SOzBvkikL/es2DRSV+23yx2+rSaSqOqpDjy7qq+rY1pVS65nVddV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",
		MUTE: "data:image/png;base64,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",
		PAINTBRUSH:
			"data:image/png;base64,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",
		TIGHTEN:
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwEAYAAAAHkiXEAAACfklEQVR4Xu2bsU4CQRCGT7ERjbFQMTH4AhpjYeEbGC1MbKww4Q2sodAGW2PjA9jb2RkKjMHeBhsrIxRQKQnGgGDi3MRIwNvBndtdd2gW7ib/zHz/7t5xgSCQlxD4JnBwC+8nV4VKLARSKUhzeQljrwdjPh9Len+T7O9D7/X6T/BowMsLHJ+b85cRS+fLyyCLgBH4sPHsjKUMf0WvrgbP+GEGvL9D/NKjv8y0dH54SAOPhjxsaUnvr8j0NPTebNIMKO/5y0xr59SZL+C14g+CiwvazNec3gG5cd4a19d59UV9CIFEAk50OrICfp8kTCtgZQXSohFRM7XRiIr4r+eZDPj4oAGbmqLFS7QigddXN7YgfCal2JY7YeWy3QakF39eq66v4XM2C+PMjDusB1Z6fk4zYOIknoaT4RYZ9Szq7Q3qWXiOpy7tWTIZmgEIZGxHeylfgolNWj3VKk8dsatWKrTG0QhthRK3Qsx/dKStArNC29ujGaDLiKitpv98qWSWF1v209O/GUEFSY1vt6G+tTU2BHYI39/baUQuZwcf9irSaUhRLNphxPExe8t2J8CZh1sAdeugxt/dAY+NDbu5xF4d7r2lWc0rI7ytLRRib8nNhPhoAGd29+lvhrRatnJgehinvd3w7km7rnFBVwwwDoqrAFcMmOQCYFpXDDDsgCsGGMbEl94VA2QL4psDSspigBImviAxgI+t38pyDTDsvxggBhgmYDi9rAAxQIlAUinKwSBXVoCDaNVKdsUA+R6g5idblBjAhlZNWAxQ4yRRVAJyDaAS0xw/oVmPSW7sJhSeD8du34h/COk/vstUkC+ytRp02g3Bjjrij4Pt4/YJN03BbYn5mYwAAAAASUVORK5CYII=",
		USER: "data:image/png;base64,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",
		WHISPER:
			"data:image/png;base64,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",
	});

	const DEVS = [23476, 27006, 24890];

	/**
	 * @param {string} original - The English message
	 * @param {Record<string, string>} [replacements] - The replacements
	 * @returns {string} - The translated message
	 */
	function displayText(original, replacements = {}) {
		/** @type {Readonly<Record<string, Record<string, string>>>} */
		const translations = Object.freeze({
			CN: {
				"Automatic Arousal Expressions (Replaces Vanilla)":
					"自动欲望表情 (替换原版)",
				"Activity Expressions": "活动表示",
				"Alternate Arousal (Replaces Vanilla, requires hybrid/locked arousal meter)":
					"另一种欲望 (替换原版, 需要混合或锁定欲望条)",
				"Alternative speech stutter": "另一种言语不清",
				"Enable layering menus": "开启服装分层选项",
				"Extended wardrobe slots (96)": "扩展衣柜保存槽 (96个)",
				"Replace wardrobe list with character previews":
					"使用角色预览替换衣柜保存列表",
				"Clear Drawing Cache Hourly": "每小时清除绘图缓存",
				"Instant messenger": "即时通讯",
				"Chat Links and Embeds": "聊天链接和嵌入",
				"Use Ctrl+Enter to OOC": "使用Ctrl+Enter进行OOC发言",
				"Use italics for input when whispering": "悄悄话使用斜体字",
				"Improve colors for readability": "改善颜色以提高可读性",
				"Show friend presence notifications": "显示好友在线通知",
				"Show friends going offline too (requires friend presence)":
					"显示朋友离线通知 (需要启用好友在线通知)",
				"Understand All Gagged and when Deafened":
					"在被堵住嘴和被堵住耳朵时可以听懂所有发言",
				"Reveal Lockpicking Order Based on Skill": "根据技能显示撬锁/开锁顺序",
				"Allow layering menus while bound": "允许在捆绑时用分层菜单",
				"Load BCX by Jomshir98 (requires refresh - no auto-update)":
					"加载 BCX by Jomshir98 (需要刷新 - 无自动更新)",
				"Load BCX beta (requires refresh - auto-updates, compatibility not guaranteed)":
					"加载 BCX beta 测试版 (需要刷新 - 自动升级, 不保证兼容性)",
				"Limited gag anti-cheat: cloth-gag equivalent garbling":
					"有限的堵嘴反作弊: 和布堵嘴相同的乱码",
				"Full gag anti-cheat: use equipped gags to determine garbling":
					"完整的堵嘴反作弊: 使用当前装备的堵嘴来确定乱码",
				"Extra gag anti-cheat: even more garbling for the most extreme gags":
					"扩展的堵嘴反作弊: 对于使用最极端的堵嘴更加混乱",
				"Require glasses to see": "需要眼镜才能看清",
				"Check for updates": "检查更新",
				"Automatic Relogin on Disconnect": "断线后自动重连",
				"Show gag cheat and anti-cheat options in chat":
					"在聊天室里显示堵嘴作弊和反作弊选项",
				"Automatically ghost+blocklist unnaturally new users":
					"自动对不自然的用户无视并添加黑名单",
				"Confirm leaving the game": "离开游戏前需要确认",
				"Discreet mode (disable drawing)": "谨慎模式 (禁用绘图)",
				"Keep tab active (requires refresh)":
					"保持标签页处于活动状态 (需要刷新)",
				"Show FPS counter": "显示 FPS 计数器",
				"Limit FPS in background": "在后台时限制FPS",
				"Limit FPS to ~15": "限制 FPS 最高为 ~15",
				"Limit FPS to ~30": "限制 FPS 最高为 ~30",
				"Limit FPS to ~60": "限制 FPS 最高为 ~60",
				"Make automatic progress while struggling": "在挣扎时自动增加进度",
				"Allow leashing without wearing a leashable item (requires leasher to have FBC too)":
					"允许在不佩戴牵引绳的情况下也可以进行牵引（需要牵引者也安装有FBC）",
				"Enable buttplug.io (requires refresh)":
					"启用buttplug.io（需要刷新网页)",
				"This page allows configuration of the synchronization of bluetooth connected toys.":
					"此页面允许配置将BC震动器状态同步到蓝牙连接的玩具",
				"Save & browse seen profiles (requires refresh)":
					"保存并浏览已知的个人资料 (需要刷新)",
				"Chat & Social": "聊天 & 社交",
				"Activities & Arousal": "活动 & 欲望",
				"Appearance & Wardrobe": "外观 & 衣柜",
				"Immersion & Anti-Cheat": "沉浸体验 & 反作弊",
				Performance: "表现",
				Misc: "杂项",
				Cheats: "作弊",
				"Other Addons": "其他插件",
				"Show nicknames": "修改你的昵称",
				"Change your nickname": "修改你的昵称",
				ah: "啊",
				aah: "啊❤",
				mnm: "唔姆",
				nn: "嗯啊",
				mnh: "嗯哈",
				mngh: "唔啊",
				haa: "哈啊",
				nng: "嗯嗯❤",
				mnng: "唔啊❤",
				"FBC Developer": "FBC 开发者",
				Incompatibility: "不兼容",
				"Show recent FBC changelog": "显示最近的FBC更新日志",
				"Include binds?": "包括束缚？",
				"Include locks?": "包括锁？",
				"Include height, body type, hair, etc?": "包括身高，体型，头发等？",
				"Copy the looks string below": "复制下面的外观字符串",
				"Paste your looks here": "在这里粘贴你的外观",
				"No looks string provided": "没有提供外观字符串",
				"Applied looks": "应用外观",
				"Could not parse looks": "无法解析外观",
				"[membernumber] [message]: beep someone": "[用户编号] [消息]: 发送beep",
				"For Better Club Settings (FBC)": "For Better Club (FBC)设置",
				"Join Discord": "加入Discord",
				License: "授权",
				Information: "信息",
				"Still connecting or connection failed...": "正在连接或连接失败...",
				Scan: "搜索",
				"Device Name": "设备名称",
				"Synchronized Slot": "同步栏位",
				"Click on a setting to see its description": "点击设置以查看其描述",
				"FBC Settings": "FBC设置",
				"Saved Logins (FBC)": "已保存的登录 (FBC)",
				"Save (FBC)": "保存 (FBC)",
				"Reconnected!": "重新连接！",
				ERROR: "错误",
				"Reset all expressions": "重置所有表情",
				"['list' or name of emote]: run an animation":
					"['list' 或 表情名称]: 运行一个动画",
				"['list' or list of poses]: set your pose":
					"['list' 或 姿势列表]: 设置你的姿势",
				"Modify layering priority": "修改分层优先级",
				"Adjust individual layers": "调整单个层",
				"Load without body parts": "加载时不包括身体部位",
				"Exclude body parts": "排除身体部位",
				Gagging: "堵嘴",
				"Antigarble anti-cheat strength": "反堵嘴反作弊强度",
				"Understand: Yes": "理解: 是",
				"Understand gagspeak: No": "理解堵嘴说话: 否",
				"Understand gagspeak: Yes": "理解堵嘴说话: 是",
				"Having recovered your glasses you can see again!":
					"找回了你的眼镜，你可以看见了！",
				"Having lost your glasses your eyesight is impaired!":
					"失去了你的眼镜，你的视力受损了！",
				"([FBC] Force them to become a Club Slave.)":
					"([FBC] 强制他们成为俱乐部奴隶。)",
				"(She will become a Club Slave for the next hour.)":
					"(她将成为俱乐部奴隶，持续一个小时。)",
				"Search for a friend": "搜索好友",
				"Sending beeps is currently restricted by BCX rules":
					"发送beep目前受到BCX规则的限制",
				Online: "在线",
				Offline: "离线",
				"Instant Messenger (Disabled by BCX)": "即时通讯器 (被BCX禁用)",
				"Instant Messenger": "即时通讯器",
				"FBC Changelog": "FBC更新日志",
				"Trust this session": "信任此会话",
				"(embed)": "(嵌入)",
				"(This origin is trusted by authors of FBC)": "(此来源已被FBC作者信任)",
				"Deny for session": "拒绝此会话",
				"Allow for session": "允许此会话",
				OnlineChat: "在线聊天",
				"Scans for connected buttplug.io toys": "扫描已连接的buttplug.io玩具",
				"buttplug.io is not connected": "buttplug.io未连接",
				"Scanning stopped": "扫描停止",
				"Scanning for toys": "扫描玩具",
				"Last seen: ": "最后在线: ",
				"No profile found": "未找到个人资料",
				Open: "打开",
				"Saved Profiles": "已保存的个人资料",
				"Personal notes (only you can read these):":
					"个人笔记 (只有你可以读到):",
				"[FBC] Notes": "[FBC] 笔记",
				"Toggle Editing Mode": "切换编辑模式",
				"Paste the craft here": "在这里粘贴制作物品",
				"Copy the craft here": "在这里复制制作物品",
				Import: "导入",
				Export: "导出",
				"Description:": "描述:",
				Submit: "提交",
				Cancel: "取消",
				"Click to close the modal": "点击关闭情态",
				"Animation Engine": "动画引擎",
				"Show numeric arousal meter": "显示欲望条数值",
				"Show friends going offline too": "显示朋友离线通知",
				"Show friend presence notifications in chat, when possible":
					"在聊天室里显示好友在线通知",
				"Show sent messages while waiting for server":
					"在等待服务器时显示已发送的消息",
				"Show whisper button on chat messages": "在聊天消息上显示悄悄话按钮",
				"Rich online profile": "丰富的在线个人资料",
				"Allow IMs to bypass BCX beep restrictions":
					"允许即时通讯绕过BCX beep限制",
				"Hide the hidden items icon": "不显示隐藏的物品图标",
				"Enable anti-cheat": "启用反作弊",
				"Blacklist detected cheaters automatically":
					"自动将检测到的作弊者加入黑名单",
				"Enable uwall anti-cheat": "启用uwall反作弊",
				"Prompt before loading content from a 3rd party domain":
					"在加载第三方域名的内容前提示",
				"Share Addons": "分享插件设置",
				"Buttplug Devices": "Buttplug设备",
			},
		});

		let text =
			TranslationLanguage in translations &&
			original in translations[TranslationLanguage]
				? translations[TranslationLanguage][original]
				: original;
		for (const [key, val] of objEntries(replacements)) {
			while (text.includes(key)) {
				text = text.replace(key, val);
			}
		}
		return text;
	}

	window.fbcDisplayText = (original, replacements = {}) =>
		displayText(original, replacements);

	/**
	 * @param {string} gameVersion
	 */
	const expectedHashes = (gameVersion) => {
		switch (gameVersion.toLowerCase()) {
			default:
				return /** @type {const} */ ({
					ActivityChatRoomArousalSync: "BFF3DED7",
					ActivitySetArousal: "3AE28123",
					ActivitySetArousalTimer: "1342AFE2",
					ActivityTimerProgress: "6CD388A7",
					AppearanceClick: "4C04C15E",
					AppearanceExit: "AA300341",
					AppearanceLoad: "4360C485",
					AppearanceRun: "6EC75705",
					CharacterAppearanceWardrobeLoad: "A5B63A03",
					CharacterBuildDialog: "85F79C6E",
					CharacterCompressWardrobe: "2A05ECD1",
					CharacterDecompressWardrobe: "327FADA4",
					CharacterDelete: "BD2D4761",
					CharacterGetCurrent: "69F45A41",
					CharacterLoadCanvas: "EAB81BC4",
					CharacterLoadOnline: "B1BCD3B1",
					CharacterNickname: "A794EFF5",
					CharacterRefresh: "3A32BC2A",
					CharacterReleaseTotal: "BB9C6989",
					CharacterSetCurrent: "F46573D8",
					CharacterSetFacialExpression: "F83CE881",
					CharacterSetActivePose: "566A14D7",
					ChatAdminRoomCustomizationClick: "E194A605",
					ChatAdminRoomCustomizationProcess: "B33D6388",
					ChatRoomAppendChat: "998F2F98",
					ChatRoomCharacterItemUpdate: "263DB2F0",
					ChatRoomCharacterUpdate: "DE2DC592",
					ChatRoomCharacterViewDrawBackground: "39EFE213",
					ChatRoomCharacterViewIsActive: "CD8066FA",
					ChatRoomClearAllElements: "14DAAB05",
					ChatRoomClick: "F57069BB",
					ChatRoomCreateElement: "78F86423",
					ChatRoomCurrentTime: "A462DD3A",
					ChatRoomDrawCharacterStatusIcons: "198C8657",
					ChatRoomHTMLEntities: "0A7ADB1D",
					ChatRoomKeyDown: "CBE6830E",
					ChatRoomListManipulation: "75D28A8B",
					ChatRoomMapViewCharacterIsVisible: "286C447D",
					ChatRoomMapViewCharacterOnWhisperRange: "B0D08E96",
					ChatRoomMapViewIsActive: "D181020D",
					ChatRoomMessage: "BBD61334",
					ChatRoomMessageDisplay: "37B5D4F2",
					ChatRoomRegisterMessageHandler: "C432923A",
					ChatRoomResize: "653445D7",
					ChatRoomRun: "9E0D7899",
					ChatRoomSendChat: "76A693E3",
					ChatRoomStart: "9B822A9A",
					CommandExecute: "803D6C70",
					CommandParse: "299D1046",
					CommonClick: "1F6DF7CB",
					CommonColorIsValid: "390A2CE4",
					CommonSetScreen: "E0CA772F",
					CraftingClick: "FF1A7B21",
					CraftingConvertSelectedToItem: "48270B42",
					CraftingRun: "5BE6E125",
					DialogClick: "A1B56CDF",
					DialogDraw: "733FE9E1",
					DialogDrawItemMenu: "FCE556C2",
					DialogLeave: "C37553DC",
					DrawArousalMeter: "BB0755AF",
					DrawArousalThermometer: "7ED6D822",
					DrawBackNextButton: "9AF4BA37",
					DrawButton: "A7023A82",
					DrawCharacter: "B175AF5E",
					DrawCheckbox: "00FD87EB",
					DrawImageEx: "E01BE7E7",
					DrawImageResize: "D205975A",
					DrawItemPreview: "6A7A1E2A",
					DrawProcess: "1E1BBA16",
					DrawText: "C1BF0F50",
					DrawTextFit: "F9A1B11E",
					ElementCreateInput: "EB2A3EC8",
					ElementCreateTextArea: "AA4AEDE7",
					ElementIsScrolledToEnd: "1CC4FE11",
					ElementPosition: "CC4E3C82",
					ElementRemove: "60809E60",
					ElementScrollToEnd: "1AC45575",
					ElementValue: "4F26C62F",
					FriendListShowBeep: "6C0449BB",
					GameRun: "4FDC9390",
					GLDrawResetCanvas: "81214642",
					InformationSheetRun: "91B4FF1F",
					InventoryGet: "E666F671",
					LoginClick: "EE94BEC7",
					LoginRun: "C3926C4F",
					LoginSetSubmitted: "C88F4A8E",
					LoginStatusReset: "18619F02",
					MouseIn: "CA8B839E",
					NotificationDrawFavicon: "AB88656B",
					NotificationRaise: "E8F29646",
					NotificationTitleUpdate: "0E92F3ED",
					OnlineGameAllowChange: "3779F42C",
					OnlineProfileClick: "521146DF",
					OnlineProfileExit: "1C673DC8",
					OnlineProfileLoad: "BE8B009B",
					OnlineProfileRun: "7F57EF9A",
					PoseSetActive: "22C02050",
					RelogRun: "10AF5A60",
					RelogExit: "2DFB2DAD",
					ServerAccountBeep: "F16771D4",
					ServerAppearanceBundle: "4D069622",
					ServerAppearanceLoadFromBundle: "946537FD",
					ServerClickBeep: "3E6277BE",
					ServerConnect: "845E50A6",
					ServerDisconnect: "06C1A6B0",
					ServerInit: "B6CEF7F1",
					ServerOpenFriendList: "FA8D3CDE",
					ServerPlayerExtensionSettingsSync: "1776666B",
					ServerSend: "ABE74E75",
					ServerSendQueueProcess: "BD4277AC",
					SkillGetWithRatio: "3EB4BC45",
					SpeechGarble: "9D669F73",
					SpeechGarbleByGagLevel: "3D604B82",
					SpeechGetTotalGagLevel: "5F4F6D45",
					StruggleDexterityProcess: "7E19ADA9",
					StruggleFlexibilityCheck: "727CE05B",
					StruggleFlexibilityProcess: "278D7285",
					StruggleLockPickDraw: "2F1F603B",
					StruggleMinigameHandleExpression: "1B3ABF55",
					StruggleMinigameStop: "FB05E8A9",
					StruggleStrengthProcess: "D20CF698",
					TextGet: "4DDE5794",
					TextLoad: "0D535190",
					TimerInventoryRemove: "1FA771FB",
					TimerProcess: "52458C63",
					TitleExit: "F13F533C",
					ValidationSanitizeProperties: "659F5965",
					WardrobeClick: "33405B1D",
					WardrobeExit: "12D14AE4",
					WardrobeFastLoad: "AAB9F25B",
					WardrobeFastSave: "D1E906FD",
					WardrobeFixLength: "CA3334C6",
					WardrobeLoad: "C343A4C7",
					WardrobeRun: "633B3570",
				});
		}
	};

	/** @type {(level: "error" | "warn" | "info" | "debug", ...args: unknown[]) => void} */
	const pushLog = (level, ...args) => {
		pastLogs.shift();
		pastLogs.push({
			level,
			message: args
				.map((v) => {
					if (isString(v)) {
						return v;
					}
					try {
						return JSON.stringify(v);
					} catch (e) {
						return v?.toString();
					}
				})
				.join(", "),
		});
	};

	/**
	 * @type {(...args: unknown[]) => void}
	 */
	const debug = (...args) => {
		console.debug("FBC", `${w.FBC_VERSION}:`, ...args);
		pushLog("debug", ...args);
	};

	/**
	 * @type {(...args: unknown[]) => void}
	 */
	const logInfo = (...args) => {
		console.info("FBC", `${w.FBC_VERSION}:`, ...args);
		pushLog("info", ...args);
	};

	/**
	 * @type {(...args: unknown[]) => void}
	 */
	const logWarn = (...args) => {
		console.warn("FBC", `${w.FBC_VERSION}:`, ...args);
		pushLog("warn", ...args);
	};

	/**
	 * @type {(...args: unknown[]) => void}
	 */
	const logError = (...args) => {
		console.error("FBC", `${w.FBC_VERSION}:`, ...args);
		pushLog("error", ...args);
	};

	/** @type {unknown[]} */
	const deviatingHashes = [];
	/** @type {string[]} */
	const skippedFunctionality = [];

	/** @type {(functionName: string, patches: Record<string,string>, affectedFunctionality: string) => void} */
	const patchFunction = (functionName, patches, affectedFunctionality) => {
		// Guard against patching a function that has been modified by another addon not using the shared SDK on supported versions.
		if (
			deviatingHashes.includes(functionName) &&
			SUPPORTED_GAME_VERSIONS.includes(GameVersion)
		) {
			logWarn(
				`Attempted patching of ${functionName} despite detected deviation. Impact may be: ${affectedFunctionality}\n\nSee /fbcdebug in a chatroom for more information or copy(await fbcDebug()) in console.`
			);
			skippedFunctionality.push(affectedFunctionality);
		}
		SDK.patchFunction(functionName, patches);
	};

	/**
	 * @type {(node: HTMLElement | HTMLElement[] | string) => void}
	 */
	const fbcChatNotify = (node) => {
		const div = document.createElement("div");
		div.setAttribute("class", "ChatMessage bce-notification");
		div.setAttribute("data-time", ChatRoomCurrentTime());
		div.setAttribute("data-sender", Player.MemberNumber?.toString());
		if (typeof node === "string") {
			div.appendChild(document.createTextNode(node));
		} else if (Array.isArray(node)) {
			div.append(...node);
		} else {
			div.appendChild(node);
		}

		ChatRoomAppendChat(div);
	};
	w.fbcChatNotify = fbcChatNotify;

	/**
	 * @type {(title: string, text: string) => void}
	 */
	function fbcBeepNotify(title, text) {
		SDK.callOriginal("ServerAccountBeep", [
			{
				MemberNumber: Player.MemberNumber || -1,
				BeepType: "",
				MemberName: "FBC",
				ChatRoomName: title,
				Private: true,
				Message: text,
				ChatRoomSpace: "",
			},
		]);
	}

	/**
	 * @type {(text: string, duration?: number, properties?: Partial<ServerBeep>) => Promise<void>}
	 */
	const fbcNotify = async (text, duration = 5000, properties = {}) => {
		await waitFor(
			() => !!Player && new Date(ServerBeep?.Timer || 0) < new Date()
		);

		ServerBeep = {
			Timer: Date.now() + duration,
			Message: text,
			...properties,
		};
	};

	w.fbcSendAction = (text) => {
		ServerSend("ChatRoomChat", {
			Content: "Beep",
			Type: "Action",
			Dictionary: [
				// EN
				{ Tag: "Beep", Text: "msg" },
				// CN
				{ Tag: "发送私聊", Text: "msg" },
				// DE
				{ Tag: "Biep", Text: "msg" },
				// FR
				{ Tag: "Sonner", Text: "msg" },
				// Message itself
				{ Tag: "msg", Text: text },
			],
		});
	};

	w.fbcSettingValue = (key) => {
		if (isDefaultSettingKey(key)) {
			return fbcSettings[key];
		}
		return false;
	};

	w.bceAnimationEngineEnabled = () => !!fbcSettings.animationEngine;

	// Expressions init method for custom expressions
	// eslint-disable-next-line camelcase
	w.bce_initializeDefaultExpression = () => {
		// Here to not break customizer script
	};

	/** @type {string[]} */
	const incompleteFunctions = [];
	/**
	 * @param {boolean} [copy] - Whether to copy the report to the clipboard
	 */
	async function fbcDebug(copy) {
		/** @type {Map<string, string>} */
		const info = new Map();
		info.set("Browser", navigator.userAgent);
		info.set(
			"Game Version",
			`${GameVersion}${
				SUPPORTED_GAME_VERSIONS.includes(GameVersion) ? "" : " (unsupported)"
			}`
		);
		info.set("WebGL Version", GLVersion);
		info.set("FBC Version", FBC_VERSION);
		info.set(
			"Loaded via FUSAM",
			typeof FUSAM === "object" && FUSAM?.addons?.FBC ? "Yes" : "No"
		);
		info.set(
			"FBC Enabled Settings",
			`\n- ${objEntries(fbcSettings)
				.filter(([k, v]) => v || k === "version")
				.map(([k, v]) => `${k}: ${v.toString()}`)
				.join("\n- ")}`
		);
		if (toySyncState.client?.Connected) {
			info.set(
				"Buttplug.io Devices",
				toySyncState.client.Devices.map(
					(d) => `${d.Name} (${d.AllowedMessages.join(",")})`
				).join(", ")
			);
		}
		info.set(
			"SDK Mods",
			`\n- ${bcModSdk
				.getModsInfo()
				.map((m) => `${m.name} @ ${m.version}`)
				.join("\n- ")}`
		);
		info.set("Incomplete Functions", incompleteFunctions.join(", "));
		info.set("Modified Functions (non-SDK)", deviatingHashes.join(", "));
		info.set(
			"Skipped Functionality for Compatibility",
			`\n- ${skippedFunctionality.join("\n- ")}`
		);
		info.set(
			"Log",
			pastLogs
				.filter((v) => v)
				.map((v) => `[${v.level.toUpperCase()}] ${v.message}`)
				.join("\n")
		);
		const print = Array.from(info)
			.map(([k, v]) => `${k}: ${v}`)
			.join("\n");
		if (copy) {
			fbcChatNotify(
				`${print}\n\n**The report has been copied to your clipboard.**`
			);
			// Not using FBC's debug() to avoid the report ending up on future reports
			console.debug(
				`${print}\n\n**The report has been copied to your clipboard.**`
			);
			await navigator.clipboard.writeText(print);
		}
		if (skippedFunctionality.length > 0) {
			fbcChatNotify(
				"If you are running another addon that modifies the game, but is not listed above, please tell its developer to use https://github.com/Jomshir98/bondage-club-mod-sdk to hook into the game instead. This is a very cheap and easy way for addon developers to almost guarantee compatibility with other addons."
			);
		}
		return print;
	}
	w.fbcDebug = fbcDebug;
	FUSAM.registerDebugMethod("FBC", fbcDebug);

	/** @type {(func: () => (Promise<unknown> | unknown), label: string) => Promise<void>} */
	const registerFunction = async (func, label) => {
		incompleteFunctions.push(label);
		try {
			const ret = func();
			if (ret instanceof Promise) {
				await ret;
			}
			incompleteFunctions.splice(incompleteFunctions.indexOf(label), 1);
		} catch (err) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const e = /** @type {Error} */ (err);
			logError(`Error in ${label}: ${e?.toString()}\n${e?.stack ?? ""}`);
		}
	};

	// Delay game processes until registration is complete
	/** @type {"init" | "enable" | "disable"} */
	let funcsRegistered = "init";
	SDK.hookFunction(
		"LoginResponse",
		HOOK_PRIORITIES.Top,
		/**
		 * @param {Parameters<typeof LoginResponse>} args
		 */ (args, next) => {
			if (funcsRegistered === "init") {
				funcsRegistered = "disable";
			}
			return next(args);
		}
	);
	SDK.hookFunction(
		"LoginStatusReset",
		HOOK_PRIORITIES.Top,
		/**
		 * @param {Parameters<typeof LoginStatusReset>} args
		 */ (args, next) => {
			if (funcsRegistered === "disable") {
				funcsRegistered = "init";
			}
			return next(args);
		}
	);
	SDK.hookFunction(
		"GameRun",
		HOOK_PRIORITIES.Top,
		/**
		 * @param {Parameters<typeof GameRun>} args
		 */ (args, next) => {
			if (funcsRegistered === "disable") {
				requestAnimationFrame(GameRun);
				return null;
			}
			return next(args);
		}
	);

	await registerFunction(functionIntegrityCheck, "functionIntegrityCheck");
	registerFunction(bceStyles, "bceStyles");
	registerFunction(commonPatches, "commonPatches");
	registerFunction(extendedWardrobe, "extendedWardrobe");
	registerFunction(automaticReconnect, "automaticReconnect");
	registerFunction(hiddenMessageHandler, "hiddenMessageHandler");
	await registerFunction(bceLoadSettings, "bceLoadSettings");
	registerFunction(postSettings, "postSettings");
	registerFunction(appendSocketListenersToInit, "appendSocketListenersToInit");
	debug(fbcSettings);
	registerFunction(discreetMode, "discreetMode");
	registerFunction(beepImprovements, "beepImprovements");
	registerFunction(settingsPage, "settingsPage");
	registerFunction(alternateArousal, "alternateArousal");
	registerFunction(chatAugments, "chatAugments");
	registerFunction(automaticExpressions, "automaticExpressions");
	registerFunction(layeringMenu, "layeringMenu");
	registerFunction(cacheClearer, "cacheClearer");
	registerFunction(lockpickHelp, "lockpickHelp");
	registerFunction(commands, "commands");
	registerFunction(chatRoomOverlay, "chatRoomOverlay");
	registerFunction(privateWardrobe, "privateWardrobe");
	registerFunction(antiGarbling, "antiGarbling");
	registerFunction(autoGhostBroadcast, "autoGhostBroadcast");
	registerFunction(blindWithoutGlasses, "blindWithoutGlasses");
	registerFunction(friendPresenceNotifications, "friendPresenceNotifications");
	registerFunction(forcedClubSlave, "forcedClubSlave");
	registerFunction(fpsCounter, "fpsCounter");
	registerFunction(instantMessenger, "instantMessenger");
	registerFunction(autoStruggle, "autoStruggle");
	registerFunction(nicknames, "nicknames");
	registerFunction(leashAlways, "leashAlways");
	registerFunction(toySync, "toySync");
	registerFunction(pastProfiles, "pastProfiles");
	registerFunction(pendingMessages, "pendingMessages");
	registerFunction(hideHiddenItemsIcon, "hideHiddenItemsIcon");
	registerFunction(crafting, "crafting");
	registerFunction(itemAntiCheat, "itemAntiCheat");
	registerFunction(leashFix, "leashFix");
	registerFunction(hookBCXAPI, "hookBCXAPI");
	registerFunction(customContentDomainCheck, "customContentDomainCheck");
	registerFunction(numericArousalMeters, "numericArousalMeters");
	registerFunction(richOnlineProfile, "richOnlineProfile");
	funcsRegistered = "enable";

	// Post ready when in a chat room
	await fbcNotify(`For Better Club v${w.FBC_VERSION} Loaded`);

	Player.FBC = FBC_VERSION;

	async function functionIntegrityCheck() {
		await waitFor(
			() =>
				GameVersion !== "R0" &&
				typeof ServerIsConnected === "boolean" &&
				ServerIsConnected
		);

		logInfo("Checking function integrity with GameVersion", GameVersion);

		/**
		 * @param {keyof ReturnType<typeof expectedHashes>} func
		 * @param {string} hash
		 * @returns {func is keyof typeof w}
		 */
		function isActiveFunction(func, hash) {
			return hash !== "SKIP";
		}

		for (const [func, hash] of objEntries(expectedHashes(GameVersion))) {
			if (!isActiveFunction(func, hash)) {
				continue;
			}
			if (!w[func]) {
				logWarn(`Expected function ${func} not found.`);
				continue;
			}
			if (typeof w[func] !== "function") {
				logWarn(`Expected function ${func} is not a function.`);
				continue;
			}
			const actualHash = SDK.getOriginalHash(func);
			if (actualHash !== hash) {
				logWarn(
					`Function ${func} has been modified before FBC, potential incompatibility: ${actualHash}`
				);
				deviatingHashes.push(func);
			}
		}
	}

	/**
	 * @type {(func: () => boolean, cancelFunc?: () => boolean) => Promise<boolean>}
	 */
	async function waitFor(func, cancelFunc = () => false) {
		while (!func()) {
			if (cancelFunc()) {
				return false;
			}
			// eslint-disable-next-line no-await-in-loop
			await sleep(10);
		}
		return true;
	}

	function commonPatches() {
		// DrawBackNextButton patch to allow overriding hover text position
		patchFunction(
			"DrawBackNextButton",
			{
				"Disabled, ArrowWidth": "Disabled, ArrowWidth, tooltipPosition",
				"DrawButtonHover(Left, Top, Width, Height,":
					"DrawButtonHover(tooltipPosition?.X || Left, tooltipPosition?.Y || Top, tooltipPosition?.Width || Width, tooltipPosition?.Height || Height,",
			},
			"Tooltip positions may be incorrect."
		);

		// CommandExecute patch to fix /whitelistadd and /whitelistremove
		patchFunction(
			"CommandExecute",
			{
				"key.indexOf(CommandsKey + cmd.Tag) == 0)": `key.substring(1) === cmd.Tag)`,
			},
			"Whitelist commands will not work."
		);

		SDK.hookFunction(
			"InformationSheetRun",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof InformationSheetRun>} args
			 */
			(args, next) => {
				if (
					!InformationSheetSelection ||
					!InformationSheetSelection.MemberNumber
				) {
					return next(args);
				}

				const ret = next(args);

				if (DEVS.includes(InformationSheetSelection.MemberNumber)) {
					const ctx = w.MainCanvas.getContext("2d");
					if (!ctx) {
						throw new Error("could not get canvas 2d context");
					}
					ctx.textAlign = "left";
					DrawText(displayText("FBC Developer"), 550, 75, "hotpink", "black");
					ctx.textAlign = "center";
				}

				return ret;
			}
		);

		// Looking for settings erasure by client
		SDK.hookFunction(
			"ServerSend",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof ServerSend>} args
			 */
			(args, next) => {
				const [msgType, data] = args;
				if (msgType !== "AccountUpdate") {
					return next(args);
				}
				if (!isNonNullObject(data)) {
					return next(args);
				}
				if ("ExtensionSettings" in data) {
					throw new Error(
						"misuse of ExtensionSettings detected; write prevented"
					);
				}
				return next(args);
			}
		);

		// GameVersion R102 - no longer required on R103
		if (typeof RelogChatLog !== "undefined") {
			/*
			 * Chat scroll after relog
			 * delay is the number of frames to delay the scroll
			 */
			let delay = 0;
			SDK.hookFunction(
				"ChatRoomCreateElement",
				HOOK_PRIORITIES.AddBehaviour,
				/**
				 * @param {Parameters<typeof ChatRoomCreateElement>} args
				 */
				(args, next) => {
					const isRelog = !!RelogChatLog;
					const ret = next(args);
					if (isRelog) {
						delay = 3;
					}
					if (delay > 0) {
						delay--;
						if (delay === 0) {
							ElementScrollToEnd("TextAreaChatLog");
						}
					}
					return ret;
				}
			);
		}

		// Prevent friendlist results from attempting to load into the HTML outside of the appropriate view
		SDK.hookFunction(
			"FriendListLoadFriendList",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof FriendListLoadFriendList>} args
			 */
			(args, next) => {
				if (!document.getElementById("FriendList")) {
					return;
				}
				// eslint-disable-next-line consistent-return
				return next(args);
			}
		);

		// Prevent processing of sent messages when disconnected
		SDK.hookFunction(
			"ServerSendQueueProcess",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof ServerSendQueueProcess>} args
			 */
			(args, next) => {
				if (!ServerIsConnected) {
					return null;
				}
				return next(args);
			}
		);
	}

	function fpsCounter() {
		let lastFrame = -1;

		/** @type {(ms: number) => number} */
		const expectedFrameTime = (ms) => (1000 / ms) | 0;

		SDK.hookFunction(
			"GameRun",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof GameRun>} args
			 */
			(args, next) => {
				const [time] = args;
				if (lastFrame >= 0 && time > 0) {
					let ftl = 0;
					if (fbcSettings.limitFPSInBackground && !document.hasFocus()) {
						ftl = 10;
					} else if (fbcSettings.limitFPSTo15) {
						ftl = 15;
					} else if (fbcSettings.limitFPSTo30) {
						ftl = 30;
					} else if (fbcSettings.limitFPSTo60) {
						ftl = 60;
					}
					if (lastFrame + expectedFrameTime(ftl) > time) {
						requestAnimationFrame(GameRun);
						return;
					}
				}
				let frameTime = 10000;
				if (time > 0) {
					frameTime = time - lastFrame;
					lastFrame = time;
				}
				next(args);
				if (time > 0 && fbcSettings.fpsCounter) {
					DrawTextFit(
						(Math.round(10000 / frameTime) / 10).toString(),
						15,
						12,
						30,
						"white",
						"black"
					);
				}
			}
		);
	}

	function beepImprovements() {
		if (typeof StartBcUtil === "function") {
			fbcBeepNotify(
				displayText("Incompatibility"),
				displayText(
					"FBC is incompatible with BCUtil. Some functionality from FBC may not work. BCUtil's wardrobe, appearance, and instant messaging functionality are all available within FBC. Go to FBC settings and enable the relevant options, then disable BCUtil to migrate fully to FBC. This beep will appear every time FBC detects BCUtil as having loaded before FBC."
				)
			);
			return;
		}
		// ServerAccountBeep patch for beep notification improvements in chat
		patchFunction(
			"ServerAccountBeep",
			{
				// eslint-disable-next-line no-template-curly-in-string
				'ChatRoomSendLocal(`<a onclick="ServerOpenFriendList()">(${ServerBeep.Message})</a>`);': `{
					const beepId = FriendListBeepLog.length - 1;
					ChatRoomSendLocal(\`<a id="bce-beep-reply-\${beepId}">\u21a9\ufe0f</a><a class="bce-beep-link" id="bce-beep-\${beepId}">(\${ServerBeep.Message}\${ChatRoomHTMLEntities(data.Message ? \`: \${bceStripBeepMetadata(data.Message.length > 150 ? data.Message.substring(0, 150) + "..." : data.Message)}\` : "")})</a>\`);
					if (document.getElementById("bce-beep-reply-" + beepId)) {
						document.getElementById(\`bce-beep-reply-\${beepId}\`).onclick = (e) => {
							e.preventDefault();
							ElementValue("InputChat", \`/beep \${data.MemberNumber} \${ElementValue("InputChat").replace(/^\\/(beep|w) \\S+ ?/u, '')}\`);
							document.getElementById('InputChat').focus();
						};
					}
					if (document.getElementById("bce-beep-" + beepId)) {
						document.getElementById(\`bce-beep-\${beepId}\`).onclick = (e) => {
							e.preventDefault();
							ServerOpenFriendList();
							FriendListModeIndex = 1;
							FriendListShowBeep(\`\${beepId}\`);
						};
					}
				}`,
			},
			"Beeps are not enhanced by FBC."
		);
	}

	async function hookBCXAPI() {
		await waitFor(() => !!w.bcx);
		BCX = w.bcx?.getModApi("FBC") ?? null;
	}

	async function commands() {
		await waitFor(() => !!Commands);
		debug("registering additional commands");

		SDK.hookFunction(
			"ChatRoomAppendChat",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ChatRoomAppendChat>} args
			 */
			(args, next) => {
				if (!fbcSettings.whisperButton) {
					return next(args);
				}

				const [div] = args;
				const replyButton = div.querySelector(".ReplyButton");
				replyButton?.remove();

				const sender = div.getAttribute("data-sender");
				const matchingCharacters = sender ? findDrawnCharacters(sender) : [];
				if (
					sender &&
					sender !== Player.MemberNumber?.toString() &&
					matchingCharacters.length > 0 &&
					(ChatRoomCharacterViewIsActive() ||
						matchingCharacters.some(ChatRoomMapViewCharacterOnWhisperRange))
				) {
					const repl = document.createElement("a");
					repl.href = "#";
					repl.onclick = (e) => {
						e.preventDefault();
						ElementValue(
							"InputChat",
							`/w ${sender} ${ElementValue("InputChat").replace(
								/^\/(beep|w(hisper)?) \S+ ?/u,
								""
							)}`
						);
						window.InputChat?.focus();
					};
					repl.title = "Whisper";
					repl.classList.add("bce-line-icon-wrapper");
					const img = document.createElement("img");
					img.src = ICONS.WHISPER;
					img.alt = "Whisper";
					img.classList.add("bce-line-icon");
					repl.appendChild(img);
					div.prepend(repl);
				}
				return next(args);
			}
		);

		/** @type {Command[]} */
		const cmds = [
			{
				Tag: "fbcdebug",
				Description: displayText(
					"Get debug information to share with developers."
				),
				Action: () => fbcDebug(true),
			},
			{
				Tag: "fbcchangelog",
				Description: displayText("Show recent FBC changelog"),
				Action: () => {
					fbcChatNotify(fbcChangelog);
				},
			},
			{
				Tag: "exportlooks",
				Description: displayText(
					"[target member number]: Copy your or another player's appearance in a format that can be imported with FBC or BCX"
				),
				Action: async (_, _command, args) => {
					const [target] = args;
					/** @type {Character | null} */
					let targetCharacter = null;
					if (!target) {
						targetCharacter = Player;
					} else {
						targetCharacter =
							Character.find((c) => c.MemberNumber === parseInt(target)) ??
							null;
					}
					if (!targetCharacter) {
						logInfo("Could not find member", target);
						return;
					}
					const [bindSubmit] = await FUSAM.modals.openAsync({
						prompt: displayText("Include binds?"),
						buttons: {
							cancel: "No",
							submit: "Yes",
						},
					});
					const includeBinds = bindSubmit === "submit";
					let includeLocks = false;
					if (includeBinds) {
						const [lockSubmit] = await FUSAM.modals.openAsync({
							prompt: displayText("Include locks?"),
							buttons: {
								cancel: "No",
								submit: "Yes",
							},
						});
						includeLocks = lockSubmit === "submit";
					}
					const [baseSubmit] = await FUSAM.modals.openAsync({
						prompt: displayText("Include height, body type, hair, etc?"),
						buttons: {
							cancel: "No",
							submit: "Yes",
						},
					});
					const includeBase = baseSubmit === "submit";

					const base = targetCharacter.Appearance.filter(
						(a) => a.Asset.Group.IsDefault && !a.Asset.Group.Clothing
					);
					const clothes = targetCharacter.Appearance.filter(
						(a) =>
							a.Asset.Group.Category === "Appearance" && a.Asset.Group.Clothing
					);
					const binds = targetCharacter.Appearance.filter(
						(a) =>
							a.Asset.Group.Category === "Item" && !a.Asset.Group.BodyCosplay
					);

					const appearance = [...clothes];
					if (includeBinds) {
						appearance.push(...binds);
					}
					if (includeBase) {
						appearance.push(...base);
					}

					/** @type {ItemBundle[]} */
					const looks = appearance.map((i) => {
						const property = i.Property ? { ...i.Property } : {};
						if (!includeLocks && property.LockedBy) {
							delete property.LockedBy;
							delete property.LockMemberNumber;
						}
						if (property?.LockMemberNumber) {
							property.LockMemberNumber = Player.MemberNumber;
						}
						return {
							Group: i.Asset.Group.Name,
							Name: i.Asset.Name,
							Color: i.Color,
							Difficulty: i.Difficulty,
							Property: property,
							Craft: i.Craft,
						};
					});

					const targetName = targetCharacter.IsPlayer()
						? "yourself"
						: CharacterNickname(targetCharacter);

					const exportString = LZString.compressToBase64(JSON.stringify(looks));

					FUSAM.modals.openAsync({
						prompt: displayText(displayText("Copy the looks string below")),
						input: {
							initial: exportString,
							readonly: true,
							type: "textarea",
						},
						buttons: {
							submit: "Done",
						},
					});

					await navigator.clipboard.writeText(exportString);
					fbcChatNotify(
						displayText(`Exported looks for $TargetName copied to clipboard`, {
							$TargetName: targetName,
						})
					);
				},
			},
			{
				Tag: "importlooks",
				Description: displayText(
					"Import looks from a string (BCX or FBC export)"
				),
				Action: () => {
					if (!Player.CanChangeOwnClothes() || !OnlineGameAllowChange()) {
						fbcChatNotify(
							displayText(
								"You cannot change your appearance while bound or during online games, such as LARP."
							)
						);
						return;
					}

					FUSAM.modals.open({
						prompt: displayText("Paste your looks here"),
						input: {
							initial: "",
							readonly: false,
							type: "textarea",
						},
						callback: (act, bundleString) => {
							if (act !== "submit") {
								return;
							}
							if (!bundleString) {
								fbcChatNotify(displayText("No looks string provided"));
								return;
							}
							try {
								const bundle = /** @type {ItemBundle[]} */ (
									bundleString.startsWith("[")
										? parseJSON(bundleString)
										: parseJSON(LZString.decompressFromBase64(bundleString))
								);

								if (
									!Array.isArray(bundle) ||
									bundle.length === 0 ||
									!bundle[0].Group
								) {
									throw new Error("Invalid bundle");
								}

								// Keep items you cannot unlock in your appearance
								for (const item of Player.Appearance) {
									if (
										item.Property?.LockedBy &&
										!DialogCanUnlock(Player, item)
									) {
										/** @type {ItemBundle} */
										const itemBundle = {
											Group: item.Asset.Group.Name,
											Name: item.Asset.Name,
											Color: item.Color,
											Difficulty: item.Difficulty,
											Property: item.Property,
										};
										const idx = bundle.findIndex(
											(v) => v.Group === item.Asset.Group.Name
										);
										if (idx < 0) {
											bundle.push(itemBundle);
										} else {
											bundle[idx] = itemBundle;
										}
									}
								}
								ServerAppearanceLoadFromBundle(
									Player,
									"Female3DCG",
									bundle,
									Player.MemberNumber
								);
								ChatRoomCharacterUpdate(Player);
								fbcChatNotify(displayText("Applied looks"));
							} catch (e) {
								console.error(e);
								fbcChatNotify(displayText("Could not parse looks"));
							}
						},
					});
				},
			},
			{
				Tag: "beep",
				Description: displayText("[membernumber] [message]: beep someone"),
				Action: (_, command, args) => {
					if (BCX?.getRuleState("speech_restrict_beep_send")?.isEnforced) {
						fbcChatNotify(
							displayText("Sending beeps is restricted by BCX rule.")
						);
					}
					const [target] = args,
						[, , ...message] = command.split(" "),
						msg = message?.join(" ");
					if (!target || !msg || !/^\d+$/u.test(target)) {
						fbcChatNotify(displayText(`beep target or message not provided`));
						return;
					}

					const targetMemberNumber = parseInt(target);
					if (!Player.FriendList?.includes(targetMemberNumber)) {
						fbcChatNotify(
							displayText(`$Target is not in your friend list`, {
								$Target: target,
							})
						);
						return;
					}

					const targetName =
						Player.FriendNames?.get(targetMemberNumber) ??
						`unknown (${targetMemberNumber})`;
					ServerSend("AccountBeep", {
						BeepType: "",
						MemberNumber: targetMemberNumber,
						Message: msg,
						IsSecret: true,
					});
					FriendListBeepLog.push({
						MemberNumber: targetMemberNumber,
						MemberName: targetName,
						Sent: true,
						Private: false,
						Time: new Date(),
						Message: msg,
					});

					const beepId = FriendListBeepLog.length - 1;
					const link = document.createElement("a");
					link.href = `#beep-${beepId}`;
					link.onclick = (e) => {
						e.preventDefault();
						ServerOpenFriendList();
						FriendListModeIndex = 1;
						FriendListShowBeep(beepId);
					};
					link.textContent = displayText(
						"(Beep to $Name ($Number): $Message)",
						{
							$Name: targetName,
							$Number: targetMemberNumber.toString(),
							$Message: msg.length > 150 ? `${msg.substring(0, 150)}...` : msg,
						}
					);
					link.classList.add("bce-beep-link");
					fbcChatNotify(link);
				},
			},
			{
				Tag: "w",
				Description: displayText(
					"[target name] [message]: whisper the target player. Use first name only. Finds the first person in the room with a matching name, left-to-right, top-to-bottom."
				),
				Action: (_, command, args) => {
					if (args.length < 2) {
						fbcChatNotify(
							displayText(`Whisper target or message not provided`)
						);
					}

					const [target] = args;
					const [, , ...message] = command.split(" ");
					const msg = message?.join(" ");
					const targetMembers = findDrawnCharacters(target);
					if (!target || !targetMembers || targetMembers.length === 0) {
						fbcChatNotify(`Whisper target not found: ${target}`);
					} else if (targetMembers.length > 1) {
						fbcChatNotify(
							displayText(
								"Multiple whisper targets found: $Targets. You can still whisper the player by clicking their name or by using their member number.",
								{
									$Targets: targetMembers
										.map(
											(c) => `${CharacterNickname(c)} (${c.MemberNumber ?? ""})`
										)
										.join(", "),
								}
							)
						);
					} else if (!msg) {
						fbcChatNotify(displayText(`No message provided`));
					} else {
						const targetMemberNumber = targetMembers[0].MemberNumber;
						const originalTarget = ChatRoomTargetMemberNumber;
						ChatRoomTargetMemberNumber = targetMemberNumber ?? null;
						ElementValue(
							"InputChat",
							`${
								msg.length > 0 && [".", "/"].includes(msg[0]) ? "\u200b" : ""
							}${msg}`
						);
						ChatRoomSendChat();

						// Erase duplicate from history to prevent things like automatic shock collars listening to the history from triggering
						ChatRoomLastMessage.pop();

						ChatRoomTargetMemberNumber = originalTarget;
					}
				},
			},
			{
				Tag: "versions",
				Description: displayText(
					"show versions of the club, FBC, BCX and other mods in use by players"
				),
				Action: (_, _command, args) => {
					/** @type {(character: Character) => string} */
					const getCharacterModInfo = (character) =>
						`${CharacterNickname(character)} (${
							character.MemberNumber ?? ""
						}) club ${character.OnlineSharedSettings?.GameVersion ?? "R0"}${
							w.bcx?.getCharacterVersion(character.MemberNumber)
								? ` BCX ${
										w.bcx.getCharacterVersion(character.MemberNumber) ?? "?"
								  }`
								: ""
						}${
							character.FBC
								? `\nFBC v${
										character.FBC
								  } Alt Arousal: ${character.BCEArousal?.toString()}`
								: ""
						}${
							character.FBCOtherAddons &&
							character.FBCOtherAddons.some(
								(mod) => !["BCX", "FBC"].includes(mod.name)
							)
								? `\nOther Addons:\n- ${character.FBCOtherAddons.filter(
										(mod) => !["BCX", "FBC"].includes(mod.name)
								  )
										.map(
											(mod) =>
												`${mod.name} v${mod.version} ${mod.repository ?? ""}`
										)
										.join("\n- ")}`
								: ""
						}`;

					const printList = findDrawnCharacters(
						args.length > 0 ? args[0] : null,
						true
					);

					const versionOutput = printList
						.map(getCharacterModInfo)
						.filter((info) => info)
						.join("\n\n");

					fbcChatNotify(versionOutput);
					debug(versionOutput);
				},
			},
		];

		for (const c of cmds) {
			if (Commands.some((a) => a.Tag === c.Tag)) {
				debug("already registered", c);
				continue;
			}
			Commands.push(c);
		}
	}

	// Create settings page
	async function settingsPage() {
		await waitFor(() => !!PreferenceSubscreenList);

		debug("initializing");

		const settingsPerPage = 8,
			settingsYIncrement = 70,
			settingsYStart = 225;

		/**
		 * @param {SettingsCategory} category
		 */
		const settingsPageCount = (category) =>
			Math.ceil(
				Object.values(defaultSettings).filter((v) => v.category === category)
					.length / settingsPerPage
			);

		const discordInvitePosition = /** @type {const} */ ([1500, 60, 250, 50]);
		const licensePosition = /** @type {const} */ ([1500, 120, 250, 50]);
		const websitePosition = /** @type {const} */ ([1240, 60, 250, 50]);
		let currentPageNumber = 0;

		/** @type {SettingsCategory | null} */
		let currentCategory = null;
		let currentSetting = "";
		/**
		 * Excludes hidden
		 * @type {SettingsCategory[]}
		 */
		const settingsCategories = [
			"chat",
			"activities",
			"appearance",
			"immersion",
			"performance",
			"misc",
			"cheats",
			"buttplug",
		];
		const settingCategoryLabels = /** @type {const} */ ({
			chat: "Chat & Social",
			activities: "Activities & Arousal",
			appearance: "Appearance & Wardrobe",
			immersion: "Immersion & Anti-Cheat",
			performance: "Performance",
			misc: "Misc",
			cheats: "Cheats",
			addons: "Other Addons",
			buttplug: "Buttplug.io Toys",
			hidden: "",
		});

		const vibratingSlots = [
			"None",
			...new Set(
				Asset.filter(
					(a) =>
						a.AllowEffect?.includes("Vibrating") ||
						a.AllowEffect?.includes("Egged")
				).map((a) => a.Group.Name)
			),
		];

		const scanButtonPosition = /** @type {const} */ ([1650, 225, 150, 50]);

		/**
		 * @param {SettingsCategory} category
		 */
		const currentDefaultSettings = (category) =>
			objEntries(defaultSettings).filter(
				([, v]) => v.category === category && v.value === !!v.value
			);

		w.PreferenceSubscreenBCESettingsLoad = function () {
			currentPageNumber = 0;
		};
		w.PreferenceSubscreenBCESettingsExit = function () {
			bceSaveSettings();
			PreferenceSubscreen = "";
			PreferenceMessage = "";
		};
		w.PreferenceSubscreenBCESettingsRun = function () {
			const ctx = w.MainCanvas.getContext("2d");
			if (!ctx) {
				logError("Could not get canvas context");
				return;
			}
			ctx.textAlign = "left";
			DrawText(
				displayText("For Better Club Settings (FBC)"),
				300,
				125,
				"Black",
				"Gray"
			);
			DrawButton(...discordInvitePosition, "", "White", "");
			DrawText(
				displayText("Join Discord"),
				discordInvitePosition[0] + 20,
				discordInvitePosition[1] + discordInvitePosition[3] / 2,
				"Black",
				""
			);
			DrawButton(...licensePosition, "", "White", "");
			DrawText(
				displayText("License"),
				licensePosition[0] + 20,
				licensePosition[1] + licensePosition[3] / 2,
				"Black",
				""
			);
			DrawButton(...websitePosition, "", "White", "");
			DrawText(
				displayText("Information"),
				websitePosition[0] + 20,
				websitePosition[1] + websitePosition[3] / 2,
				"Black",
				""
			);
			DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png");

			if (currentCategory) {
				let y = settingsYStart;
				for (const [settingName, defaultSetting] of currentDefaultSettings(
					currentCategory
				).slice(
					currentPageNumber * settingsPerPage,
					currentPageNumber * settingsPerPage + settingsPerPage
				)) {
					DrawCheckbox(
						300,
						y,
						64,
						64,
						displayText(defaultSetting.label),
						!!fbcSettings[settingName],
						false,
						currentSetting === settingName ? "Red" : "Black"
					);
					y += settingsYIncrement;
				}
				if (currentCategory === "buttplug") {
					DrawText(
						displayText(
							"This page allows configuration of the synchronization of bluetooth connected toys."
						),
						300,
						350,
						"Black",
						"Gray"
					);
					if (fbcSettings.toySync) {
						if (!toySyncState.client?.Connected) {
							DrawText(
								displayText("Still connecting or connection failed..."),
								300,
								450,
								"Black",
								"Gray"
							);
						} else {
							ctx.textAlign = "center";
							DrawButton(
								...scanButtonPosition,
								displayText("Scan"),
								toySyncState.client.isScanning ? "Grey" : "White",
								"",
								// Bc types do not accept null
								// eslint-disable-next-line no-undefined
								toySyncState.client.isScanning ? "Already scanning" : undefined,
								toySyncState.client.isScanning
							);
							ctx.textAlign = "left";
							DrawText(displayText("Device Name"), 300, 420, "Black", "Gray");
							DrawText(
								displayText("Synchronized Slot"),
								800,
								420,
								"Black",
								"Gray"
							);
							y = 500;
							for (const d of toySyncState.client.Devices.filter((dev) =>
								dev.AllowedMessages.includes(0)
							)) {
								let deviceSettings = toySyncState.deviceSettings.get(d.Name);
								if (!deviceSettings) {
									deviceSettings = {
										Name: d.Name,
										SlotName: "None",
									};
									toySyncState.deviceSettings.set(d.Name, deviceSettings);
								}
								const currentIdx = vibratingSlots.indexOf(
									deviceSettings.SlotName
								);
								let nextIdx = 0,
									previousIdx = 0;
								if (currentIdx <= 0) {
									previousIdx = vibratingSlots.length - 1;
								} else {
									previousIdx = currentIdx - 1;
								}
								if (currentIdx === vibratingSlots.length - 1) {
									nextIdx = 0;
								} else {
									nextIdx = currentIdx + 1;
								}
								DrawText(d.Name, 300, y, "Black", "Gray");

								ctx.textAlign = "center";
								DrawBackNextButton(
									800,
									y - 32,
									450,
									64,
									displayText(deviceSettings.SlotName),
									"white",
									"",
									() => displayText(vibratingSlots[previousIdx]),
									() => displayText(vibratingSlots[nextIdx])
								);
								ctx.textAlign = "left";
								y += settingsYIncrement;
								if (y > 950) {
									break;
								}
							}
						}
					}
				} else {
					DrawText(
						displayText("Click on a setting to see its description"),
						300,
						160,
						"Gray",
						"Silver"
					);

					if (isDefaultSettingKey(currentSetting)) {
						drawTooltip(
							300,
							830,
							1400,
							displayText(defaultSettings[currentSetting].description),
							"left"
						);
					}

					DrawText(
						`${currentPageNumber + 1} / ${settingsPageCount(currentCategory)}`,
						1700,
						230,
						"Black",
						"Gray"
					);
					DrawButton(1815, 180, 90, 90, "", "White", "Icons/Next.png");
				}
			} else {
				let y = settingsYStart;
				for (const category of settingsCategories) {
					DrawButton(300, y, 400, 64, "", "White");
					DrawTextFit(
						displayText(settingCategoryLabels[category]),
						310,
						y + 32,
						380,
						"Black"
					);
					y += settingsYIncrement;
				}
			}
			ctx.textAlign = "center";
		};
		// eslint-disable-next-line complexity
		w.PreferenceSubscreenBCESettingsClick = function () {
			let y = settingsYStart;
			if (MouseIn(1815, 75, 90, 90)) {
				if (currentCategory === null) {
					PreferenceSubscreenBCESettingsExit();
				} else {
					currentCategory = null;
				}
			} else if (MouseIn(...licensePosition)) {
				open(BCE_LICENSE, "_blank");
			} else if (MouseIn(...discordInvitePosition)) {
				open(DISCORD_INVITE_URL, "_blank");
			} else if (MouseIn(...websitePosition)) {
				open(WEBSITE_URL, "_blank");
			} else if (currentCategory !== null) {
				if (MouseIn(1815, 180, 90, 90) && currentCategory !== "buttplug") {
					currentPageNumber += 1;
					currentPageNumber %= settingsPageCount(currentCategory);
				} else {
					for (const [settingName, defaultSetting] of currentDefaultSettings(
						currentCategory
					).slice(
						currentPageNumber * settingsPerPage,
						currentPageNumber * settingsPerPage + settingsPerPage
					)) {
						if (MouseIn(300, y, 64, 64)) {
							fbcSettings[settingName] = !fbcSettings[settingName];
							defaultSetting.sideEffects(fbcSettings[settingName]);
						} else if (MouseIn(364, y, 1000, 64)) {
							currentSetting = settingName;
							debug("currentSetting", currentSetting);
						}
						y += settingsYIncrement;
					}
				}
				if (currentCategory === "buttplug" && toySyncState.client?.Connected) {
					if (MouseIn(...scanButtonPosition)) {
						if (!toySyncState.client.isScanning) {
							toySyncState.client.startScanning();
						}
						return;
					}
					y = 500;
					for (const d of toySyncState.client.Devices.filter((dev) =>
						dev.AllowedMessages.includes(0)
					)) {
						if (!MouseIn(800, y - 32, 450, 64)) {
							y += settingsYIncrement;
							continue;
						}
						const deviceSettings = toySyncState.deviceSettings.get(d.Name);
						if (!deviceSettings) {
							logWarn(
								"Could not find device settings for",
								d.Name,
								toySyncState.deviceSettings
							);
							y += settingsYIncrement;
							continue;
						}
						const currentIdx = vibratingSlots.indexOf(deviceSettings.SlotName);
						let nextIdx = 0,
							previousIdx = 0;
						if (currentIdx <= 0) {
							previousIdx = vibratingSlots.length - 1;
						} else {
							previousIdx = currentIdx - 1;
						}
						if (currentIdx === vibratingSlots.length - 1) {
							nextIdx = 0;
						} else {
							nextIdx = currentIdx + 1;
						}

						if (MouseX < 800 + 450 / 2) {
							deviceSettings.SlotName = vibratingSlots[previousIdx];
						} else {
							deviceSettings.SlotName = vibratingSlots[nextIdx];
						}

						y += settingsYIncrement;
						if (y > 950) {
							break;
						}
					}
				}
			} else {
				for (const category of settingsCategories) {
					if (MouseIn(300, y, 400, 64)) {
						currentCategory = category;
						currentPageNumber = 0;
						break;
					}
					y += settingsYIncrement;
				}
			}
		};

		SDK.hookFunction(
			"DrawButton",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof DrawButton>} args
			 */
			(args, next) => {
				// 7th argument is image URL
				switch (args[6]) {
					case "Icons/BCESettings.png":
						args[6] = ICONS.LOGO;
						break;
					default:
						break;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"TextGet",
			HOOK_PRIORITIES.ModifyBehaviourHigh,
			/**
			 * @param {Parameters<typeof TextGet>} args
			 */
			(args, next) => {
				switch (args[0]) {
					case "HomepageBCESettings":
						return displayText("FBC Settings");
					default:
						return next(args);
				}
			}
		);

		// @ts-ignore - BCESettings is a valid subscreen due to our additions
		PreferenceSubscreenList.push("BCESettings");

		/** @type {(e: KeyboardEvent) => void} */
		function keyHandler(e) {
			if (e.key === "Escape" && currentCategory !== null) {
				currentCategory = null;
				e.stopPropagation();
				e.preventDefault();
			}
		}

		document.addEventListener("keydown", keyHandler, true);
		document.addEventListener("keypress", keyHandler, true);
	}

	async function lockpickHelp() {
		await waitFor(() => !!StruggleMinigames);

		/** @type {(s: number) => () => number} */
		const newRand = (s) =>
			function () {
				s = Math.sin(s) * 10000;
				return s - Math.floor(s);
			};

		const pinSpacing = 100,
			pinWidth = 200,
			x = 1575,
			y = 300;

		SDK.hookFunction(
			"StruggleLockPickDraw",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof StruggleLockPickDraw>} args
			 */
			(args, next) => {
				if (fbcSettings.lockpick && StruggleLockPickOrder) {
					const seed = parseInt(StruggleLockPickOrder.join(""));
					const rand = newRand(seed);
					const threshold = SkillGetWithRatio(Player, "LockPicking") / 20;
					const hints = StruggleLockPickOrder.map((a) => {
						const r = rand();
						return r < threshold ? a : false;
					});
					for (let p = 0; p < hints.length; p++) {
						// Replicates pin rendering in the game Struggle.js
						const xx =
							x - pinWidth / 2 + (0.5 - hints.length / 2 + p) * pinSpacing;
						if (hints[p] !== false) {
							DrawText(
								`${StruggleLockPickOrder.indexOf(p) + 1}`,
								xx,
								y,
								"blue"
							);
						}
					}
				}
				return next(args);
			}
		);
		debug("hooking struggle for lockpick cheat draw", StruggleMinigames);
		StruggleMinigames.LockPick.Draw = StruggleLockPickDraw;
	}

	function automaticReconnect() {
		const localStoragePasswordsKey = "bce.passwords";
		w.bceUpdatePasswordForReconnect = () => {
			let name = "";
			if (CurrentScreen === "Login") {
				name = ElementValue("InputName").toUpperCase();
			} else if (CurrentScreen === "Relog") {
				name = Player.AccountName;
			}

			let passwords = /** @type {Passwords} */ (
				parseJSON(localStorage.getItem(localStoragePasswordsKey))
			);
			if (!passwords) {
				passwords = {};
			}
			passwords[name] = ElementValue("InputPassword");
			localStorage.setItem(localStoragePasswordsKey, JSON.stringify(passwords));
		};

		w.bceClearPassword = (accountname) => {
			const passwords = /** @type {Passwords} */ (
				parseJSON(localStorage.getItem(localStoragePasswordsKey))
			);
			if (
				!passwords ||
				!Object.prototype.hasOwnProperty.call(passwords, accountname)
			) {
				return;
			}
			delete passwords[accountname];
			localStorage.setItem(localStoragePasswordsKey, JSON.stringify(passwords));
		};

		let lastClick = Date.now();

		async function loginCheck() {
			await waitFor(() => CurrentScreen === "Login");

			const loadPasswords = () =>
				/** @type {Passwords} */ (
					parseJSON(localStorage.getItem(localStoragePasswordsKey))
				);

			/** @type {{ passwords: Passwords, posMaps: Record<string, string> }} */
			const loginData = {
				passwords: loadPasswords() || {},
				posMaps: {},
			};

			SDK.hookFunction(
				"LoginRun",
				HOOK_PRIORITIES.Top,
				/**
				 * @param {Parameters<typeof LoginRun>} args
				 */ (args, next) => {
					const ret = next(args);
					if (Object.keys(loginData.passwords).length > 0) {
						DrawText(
							displayText("Saved Logins (FBC)"),
							170,
							35,
							"White",
							"Black"
						);
					}
					DrawButton(1250, 385, 180, 60, displayText("Save (FBC)"), "White");

					let y = 60;
					for (const user in loginData.passwords) {
						if (
							!Object.prototype.hasOwnProperty.call(loginData.passwords, user)
						) {
							continue;
						}
						loginData.posMaps[y] = user;
						DrawButton(10, y, 350, 60, user, "White");
						DrawButton(355, y, 60, 60, "X", "White");
						y += 70;
					}
					return ret;
				}
			);

			SDK.hookFunction(
				"LoginClick",
				HOOK_PRIORITIES.Top,
				/**
				 * @param {Parameters<typeof LoginClick>} args
				 */ (args, next) => {
					const ret = next(args);
					if (MouseIn(1250, 385, 180, 60)) {
						bceUpdatePasswordForReconnect();
						loginData.posMaps = {};
						loginData.passwords = loadPasswords() || {};
					}
					const now = Date.now();
					if (now - lastClick < 150) {
						return ret;
					}
					lastClick = now;
					for (const pos in loginData.posMaps) {
						if (!Object.prototype.hasOwnProperty.call(loginData.posMaps, pos)) {
							continue;
						}
						const idx = parseInt(pos);
						if (MouseIn(10, idx, 350, 60)) {
							ElementValue("InputName", loginData.posMaps[idx]);
							ElementValue(
								"InputPassword",
								loginData.passwords[loginData.posMaps[idx]]
							);
						} else if (MouseIn(355, idx, 60, 60)) {
							bceClearPassword(loginData.posMaps[idx]);
							loginData.posMaps = {};
							loginData.passwords = loadPasswords() || {};
						}
					}
					return ret;
				}
			);

			CurrentScreenFunctions.Run = LoginRun;
			CurrentScreenFunctions.Click = LoginClick;
		}
		loginCheck();

		let breakCircuit = false;
		let breakCircuitFull = false;

		async function relog() {
			if (
				!Player?.AccountName ||
				!ServerIsConnected ||
				LoginSubmitted ||
				!ServerSocket.connected ||
				breakCircuit ||
				breakCircuitFull ||
				!fbcSettings.relogin
			) {
				return;
			}
			breakCircuit = true;
			let passwords = /** @type {Passwords} */ (
				parseJSON(localStorage.getItem(localStoragePasswordsKey))
			);
			debug("Attempting to log in again as", Player.AccountName);
			if (!passwords) {
				passwords = {};
			}
			if (!passwords[Player.AccountName]) {
				logWarn("No saved credentials for account", Player.AccountName);
				return;
			}
			LoginSetSubmitted();
			ServerSend("AccountLogin", {
				AccountName: Player.AccountName,
				Password: passwords[Player.AccountName],
			});
			if (
				!(await waitFor(
					() => CurrentScreen !== "Relog",
					() => !breakCircuit
				))
			) {
				logWarn("Relogin failed, circuit was restored");
			}
			await sleep(500);
			SDK.callOriginal("ServerAccountBeep", [
				{
					MemberNumber: Player.MemberNumber || -1,
					BeepType: "",
					MemberName: "VOID",
					ChatRoomName: "VOID",
					Private: true,
					Message: displayText("Reconnected!"),
					ChatRoomSpace: "",
				},
			]);
		}

		SDK.hookFunction(
			"RelogRun",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof RelogRun>} args
			 */ (args, next) => {
				const forbiddenReasons = ["ErrorDuplicatedLogin"];
				if (!forbiddenReasons.includes(LoginErrorMessage)) {
					relog();
				} else if (!breakCircuit) {
					SDK.callOriginal("ServerAccountBeep", [
						{
							MemberNumber: Player.MemberNumber || -1,
							BeepType: "",
							MemberName: Player.Name,
							ChatRoomName: displayText("ERROR"),
							Private: true,
							Message: displayText(
								"Signed in from a different location! Refresh the page to re-enable relogin in this tab."
							),
							ChatRoomSpace: "",
						},
					]);
					breakCircuit = true;
					breakCircuitFull = true;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"RelogExit",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof RelogExit>} args
			 */ (args, next) => {
				breakCircuit = false;
				breakCircuitFull = false;
				return next(args);
			}
		);

		registerSocketListener("connect", () => {
			breakCircuit = false;
		});

		SDK.hookFunction(
			"ServerDisconnect",
			HOOK_PRIORITIES.ModifyBehaviourHigh,
			/**
			 * @param {Parameters<typeof ServerDisconnect>} args
			 */
			(args, next) => {
				const [, force] = args;
				args[1] = false;
				const ret = next(args);
				if (force) {
					logWarn("Forcefully disconnected", args);
					ServerSocket.disconnect();
					if (
						isString(args[0]) &&
						["ErrorRateLimited", "ErrorDuplicatedLogin"].includes(args[0])
					) {
						// Reconnect after 3-6 seconds if rate limited
						logWarn("Reconnecting...");
						setTimeout(() => {
							logWarn("Connecting...");
							ServerInit();
						}, 3000 + Math.round(Math.random() * 3000));
					} else {
						logWarn("Disconnected.");
					}
				}
				return ret;
			}
		);
	}

	function bceStyles() {
		const css = /* CSS */ `
		.bce-beep-link {
			text-decoration: none;
		}
		#TextAreaChatLog .bce-notification,
		#TextAreaChatLog .bce-notification {
			background-color: #D696FF;
			color: black;
		}
		#TextAreaChatLog[data-colortheme="dark"] .bce-notification,
		#TextAreaChatLog[data-colortheme="dark2"] .bce-notification {
			background-color: #481D64;
			color: white;
		}
		.bce-img-link {
			vertical-align: top;
		}
		.bce-img {
			max-height: 25rem;
			max-width: 90%;
			display: inline;
			border:1px solid red;
			padding: 0.1rem;
		}
		.bce-color {
			width: 0.8em;
			height: 0.8em;
			display: inline-block;
			vertical-align: middle;
			border: 0.1em solid black;
			margin-right: 0.1em;
		}
		.${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} .${DARK_INPUT_CLASS}.${INPUT_WARN_CLASS} {
			background-color: #400000 !important;
		}
		.${INPUT_WARN_CLASS} {
			background-color: yellow !important;
		}
		#TextAreaChatLog a,
		.bce-message a {
			color: #003f91;
			cursor: pointer;
		}
		#TextAreaChatLog a:visited,
		.bce-message a {
			color: #380091;
		}
		.${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} div.ChatMessageWhisper,
		.${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} div.ChatMessageWhisper {
			color: #646464;
		}
		.${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} #TextAreaChatLog[data-colortheme="dark"] div.ChatMessageWhisper,
		.${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} #TextAreaChatLog[data-colortheme="dark2"] div.ChatMessageWhisper {
			color: #828282;
		}
		#TextAreaChatLog[data-colortheme="dark"] a,
		#TextAreaChatLog[data-colortheme="dark2"] a,
		.bce-message a {
			color: #a9ceff;
		}
		#TextAreaChatLog[data-colortheme="dark"] a:visited,
		#TextAreaChatLog[data-colortheme="dark2"] a:visited,
		.bce-message a {
			color: #3d91ff;
		}
		.${WHISPER_CLASS} {
			font-style: italic;
		}
		.${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} .${DARK_INPUT_CLASS} {
			background-color: #111;
			color: #eee;
			border-color: #333;
		}
		a.bce-button {
			text-decoration: none;
		}
		.bce-hidden {
			display: none !important;
		}
		.bce-false-hidden {
			position: absolute;
			border: 0;
			margin: 0;
			padding: 0;
			top: 0;
			left: 0;
			width: 0.1px;
			height: 0.1px;
			opacity: 0.01;
		}
		.bce-line-icon-wrapper {
			display: none;
			position: absolute;
			right: 1em;
		}
		.ChatMessage:hover .bce-line-icon-wrapper,
		.ChatMessage:focus .bce-line-icon-wrapper,
		.ChatMessage:focus-within .bce-line-icon-wrapper {
			display: inline;
		}
		.bce-line-icon {
			height: 1em;
			vertical-align: middle;
		}
		#bce-instant-messenger {
			display: flex;
			z-index: 100;
			position: fixed;
			width: 80%;
			height: 70%;
			top: 5%;
			left: 10%;
			padding: 0;
			margin: 0;
			flex-direction: row;
			background-color: #111;
			color: #eee;
			border: 0.2em solid white;
			resize: both;
			overflow: auto;
			max-width: 80%;
			max-height: 75%;
			min-width: 38%;
			min-height: 30%;
			overflow-wrap: break-word;
		}
		#bce-friend-list {
			width: 100%;
			overflow-x: hidden;
			overflow-y: scroll;
		}
		.bce-friend-list-entry {
			padding: 1em;
		}
		.bce-friend-list-entry-name {
			font-weight: bold;
			display: flex;
			flex-direction: column;
		}
		.bce-friend-list-selected {
			font-style: italic;
			border-top: 0.1em solid white;
			border-bottom: 0.1em solid white;
			background-color: #222;
		}
		#bce-message-container {
			width: 100%;
			height: 90%;
			font-size: 1.5rem;
			font-family: Arial, sans-serif;
		}
		#bce-message-right-container {
			width: 80%;
			display: flex;
			flex-direction: column;
			border-left: 0.1em solid white;
		}
		#bce-message-input {
			width: 100%;
			height: 10%;
			border: 0;
			padding: 0;
			margin: 0;
			background-color: #222;
			color: #eee;
			font-size: 1.5rem;
		}
		.bce-friend-list-unread {
			background-color: #a22;
		}
		.bce-message-divider {
			margin: 0.5em 2em;
			border-bottom: 0.2em solid white;
		}
		.bce-message {
			padding: 0.2em 0.4em;
			position: relative;
			white-space: pre-wrap;
		}
		.bce-message::before {
			content: attr(data-time);
			float: right;
			color: gray;
			font-size: 0.5em;
			margin-right: 0.2em;
			font-style: italic;
		}
		.bce-message-sender {
			text-shadow: 0.05em 0.05em #eee;
			font-weight: bold;
		}
		.bce-message-Emote, .bce-message-Action {
			font-style: italic;
			color: gray;
		}
		.bce-message-Message .bce-message-sender {
			text-shadow: 0.05em 0.05em #eee;
		}
		.bce-friend-history {
			overflow-y: scroll;
			overflow-x: hidden;
			height: 100%;
		}
		.bce-friend-list-handshake-false,
		.bce-friend-list-handshake-pending {
			text-decoration: line-through;
			color: gray;
		}
		#bce-message-left-container {
			display: flex;
			flex-direction: column;
			width: 20%;
			height: 100%;
		}
		#bce-friend-search {
			border: 0;
			border-bottom: 0.1em solid white;
			padding: 0.5em;
			height: 1em;
			background-color: #222;
			color: #eee;
		}
		.bce-profile-open {
			margin-right: 0.5em;
		}
		.bce-pending {
			opacity: 0.4;
		}

		.lds-ellipsis {
			display: inline-block;
			position: relative;
			width: 80px;
			height: 1em;
		}
		.lds-ellipsis div {
			position: absolute;
			top: 44%;
			width: 13px;
			height: 13px;
			border-radius: 50%;
			background: #fff;
			animation-timing-function: cubic-bezier(0, 1, 1, 0);
		}
		.lds-ellipsis div:nth-child(1) {
			left: 8px;
			animation: lds-ellipsis1 0.6s infinite;
		}
		.lds-ellipsis div:nth-child(2) {
			left: 8px;
			animation: lds-ellipsis2 0.6s infinite;
		}
		.lds-ellipsis div:nth-child(3) {
			left: 32px;
			animation: lds-ellipsis2 0.6s infinite;
		}
		.lds-ellipsis div:nth-child(4) {
			left: 56px;
			animation: lds-ellipsis3 0.6s infinite;
		}
		@keyframes lds-ellipsis1 {
			0% {
				transform: scale(0);
			}
			100% {
				transform: scale(1);
			}
		}
		@keyframes lds-ellipsis3 {
			0% {
				transform: scale(1);
			}
			100% {
				transform: scale(0);
			}
		}
		@keyframes lds-ellipsis2 {
			0% {
				transform: translate(0, 0);
			}
			100% {
				transform: translate(24px, 0);
			}
		}

		#bceNoteInput {
			z-index: 100 !important;
		}

		`;
		const head = document.head || document.getElementsByTagName("head")[0];
		const style = document.createElement("style");
		style.appendChild(document.createTextNode(css));
		head.appendChild(style);
	}

	function chatAugments() {
		// CTRL+Enter OOC implementation
		patchFunction(
			"ChatRoomKeyDown",
			{
				"ChatRoomSendChat()": `if (fbcSettingValue("ctrlEnterOoc") && event.ctrlKey && ElementValue("InputChat")?.trim()) {
						let text = ElementValue("InputChat");
						let prefix = "";
						if (!text) {
							fbcChatNotify("Nothing to send!");
							return;
						}
						// Whisper command
						if (text.startsWith("/w ")) {
							const textParts = text.split(' ');
							text = textParts.slice(2).join(' ');
							prefix = textParts.slice(0, 2).join(' ') + ' ';
						} else if (text.startsWith("/") && !text.startsWith("//")) {
							fbcChatNotify("Tried to OOC send a command. Use double // to confirm sending to chat.");
							return;
						}

						ElementValue("InputChat", prefix + "(" + text.replace(/\\)/g, "${CLOSINGBRACKETINDICATOR}"));
					}
					ChatRoomSendChat()`,
			},
			"No OOC on CTRL+Enter."
		);
		patchFunction(
			"ChatRoomMessageDisplay",
			{
				"var div": `msg = msg.replace(/${CLOSINGBRACKETINDICATOR}/g, ")");
				var div`,
			},
			"OOC closing brackets may look wonky."
		);

		patchFunction(
			"CommandParse",
			{
				"// Regular chat can be prevented with an owner presence rule":
					"// Regular chat can be prevented with an owner presence rule\nmsg = bceMessageReplacements(msg);\n// ",
				"// The whispers get sent to the server and shown on the client directly":
					"// The whispers get sent to the server and shown on the client directly\nmsg = bceMessageReplacements(msg);",
			},
			"No link or OOC parsing for sent whispers."
		);

		const startSounds = ["..", "--"];
		const endSounds = ["...", "~", "~..", "~~", "..~"];
		const eggedSounds = [
			"ah",
			"aah",
			"mnn",
			"nn",
			"mnh",
			"mngh",
			"haa",
			"nng",
			"mnng",
		];
		/**
		 * StutterWord will add s-stutters to the beginning of words and return 1-2 words, the original word with its stutters and a sound, based on arousal
		 * @type {(word: string, forceStutter?: boolean) => string[]}
		 */
		function stutterWord(word, forceStutter) {
			if (!word?.length) {
				return [word];
			}

			/** @type {(wrd: string) => string} */
			const addStutter = (wrd) =>
				/^\p{L}/u.test(wrd)
					? `${wrd.substring(0, /\uD800-\uDFFF/u.test(wrd[0]) ? 2 : 1)}-${wrd}`
					: wrd;

			const maxIntensity = Math.max(
				0,
				...Player.Appearance.filter(
					(a) => (a.Property?.Intensity ?? -1) > -1
				).map((a) => a.Property?.Intensity ?? 0)
			);

			const playerArousal = Player.ArousalSettings?.Progress ?? 0;
			const eggedBonus = maxIntensity * 5;
			const chanceToStutter =
				(Math.max(0, playerArousal - 10 + eggedBonus) * 0.5) / 100;

			const chanceToMakeSound =
				(Math.max(0, playerArousal / 2 - 20 + eggedBonus * 2) * 0.5) / 100;

			const r = Math.random();
			for (let i = Math.min(4, Math.max(1, maxIntensity)); i >= 1; i--) {
				if (
					r < chanceToStutter / i ||
					(i === 1 && forceStutter && chanceToStutter > 0)
				) {
					word = addStutter(word);
				}
			}
			const results = [word];
			if (maxIntensity > 0 && Math.random() < chanceToMakeSound) {
				const startSound =
					startSounds[Math.floor(Math.random() * startSounds.length)];
				const sound =
					eggedSounds[Math.floor(Math.random() * eggedSounds.length)];
				const endSound =
					endSounds[Math.floor(Math.random() * endSounds.length)];
				results.push(" ", `${startSound}${displayText(sound)}${endSound}`);
			}
			return results;
		}

		w.bceMessageReplacements = (msg) => {
			const words = [msg];
			let firstStutter = true,
				inOOC = false;
			const newWords = [];
			for (let i = 0; i < words.length; i++) {
				// Handle other whitespace
				const whitespaceIdx = words[i].search(/[\s\r\n]/u);
				if (whitespaceIdx >= 1) {
					// Insert remainder into list of words
					words.splice(i + 1, 0, words[i].substring(whitespaceIdx));
					// Truncate current word to whitespace
					words[i] = words[i].substring(0, whitespaceIdx);
				} else if (whitespaceIdx === 0) {
					// Insert remainder into list of words
					words.splice(i + 1, 0, words[i].substring(1));
					// Keep space in the message
					[words[i]] = words[i];
					newWords.push(words[i]);
					continue;
				}
				// Handle OOC
				const oocIdx = words[i].search(/[()]/u);
				if (oocIdx > 0) {
					// Insert remainder into list of words
					words.splice(i + 1, 0, words[i].substring(oocIdx + 1));
					// Insert OOC marker into list of words, before remainder
					words.splice(i + 1, 0, words[i].substring(oocIdx, oocIdx + 1));
					// Truncate current word to OOC
					words[i] = words[i].substring(0, oocIdx);
				} else if (oocIdx === 0 && words[i].length > 1) {
					// Insert remainder into list of words
					words.splice(i + 1, 0, words[i].substring(1));
					// Keep OOC marker in the message
					[words[i]] = words[i];
				}

				if (words[i] === "(") {
					inOOC = true;
				}

				if (bceParseUrl(words[i]) && !inOOC) {
					newWords.push("( ");
					newWords.push(words[i]);
					newWords.push(" )");
				} else if (fbcSettings.stutters && !inOOC) {
					newWords.push(...stutterWord(words[i], firstStutter));
					firstStutter = false;
				} else {
					newWords.push(words[i]);
				}

				if (words[i] === ")") {
					inOOC = false;
				}
			}
			return newWords.join("");
		};

		function bceChatAugments() {
			if (CurrentScreen !== "ChatRoom" || !fbcSettings.augmentChat) {
				return;
			}
			const chatLogContainerId = "TextAreaChatLog",
				// Handle chat events
				handledAttributeName = "data-bce-handled",
				unhandledChat = document.querySelectorAll(
					`.ChatMessage:not([${handledAttributeName}=true])`
				);
			for (const chatMessageElement of unhandledChat) {
				chatMessageElement.setAttribute(handledAttributeName, "true");
				if (
					(chatMessageElement.classList.contains("ChatMessageChat") ||
						chatMessageElement.classList.contains("ChatMessageWhisper")) &&
					!chatMessageElement.classList.contains("bce-pending")
				) {
					const scrolledToEnd = ElementIsScrolledToEnd(chatLogContainerId);
					// eslint-disable-next-line no-loop-func
					const scrollToEnd = () => {
						if (scrolledToEnd) {
							ElementScrollToEnd(chatLogContainerId);
						}
					};
					processChatAugmentsForLine(chatMessageElement, scrollToEnd);
					if (scrolledToEnd) {
						ElementScrollToEnd(chatLogContainerId);
					}
				}
			}
		}

		createTimer(bceChatAugments, 500);
	}

	async function automaticExpressions() {
		await waitFor(
			() => CurrentScreen === "ChatRoom" && !!Player.ArousalSettings
		);
		if (!Player.ArousalSettings) {
			throw new Error("Player.ArousalSettings is not defined");
		}

		patchFunction(
			"StruggleMinigameHandleExpression",
			{
				'");': '", 3);',
			},
			"Resetting blush, eyes, and eyebrows after struggling"
		);

		SDK.hookFunction(
			"StruggleMinigameStop",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof StruggleMinigameStop>} args
			 */
			(args, next) => {
				if (bceAnimationEngineEnabled()) {
					// eslint-disable-next-line no-undefined
					StruggleExpressionStore = undefined;
					resetExpressionQueue(
						[GAME_TIMED_EVENT_TYPE],
						[MANUAL_OVERRIDE_EVENT_TYPE]
					);
				}
				return next(args);
			}
		);

		if (!w.bce_ArousalExpressionStages) {
			// eslint-disable-next-line camelcase
			w.bce_ArousalExpressionStages = {
				Blush: [
					{ Expression: "High", Limit: 100 },
					{ Expression: "Medium", Limit: 60 },
					{ Expression: "Low", Limit: 10 },
					{ Expression: null, Limit: 0 },
				],
				Eyebrows: [
					{ Expression: "Soft", Limit: 80 },
					{ Expression: "Lowered", Limit: 50 },
					{ Expression: "Raised", Limit: 20 },
					{ Expression: null, Limit: 0 },
				],
				Fluids: [
					{ Expression: "DroolMedium", Limit: 100 },
					{ Expression: "DroolLow", Limit: 40 },
					{ Expression: null, Limit: 0 },
				],
				Eyes: [
					{ Expression: "Closed", Limit: 100 },
					{ Expression: "Surprised", Limit: 90 },
					{ Expression: "Horny", Limit: 70 },
					{ Expression: "Dazed", Limit: 20 },
					{ Expression: null, Limit: 0 },
				],
				Eyes2: [
					{ Expression: "Closed", Limit: 100 },
					{ Expression: "Surprised", Limit: 90 },
					{ Expression: "Horny", Limit: 70 },
					{ Expression: "Dazed", Limit: 20 },
					{ Expression: null, Limit: 0 },
				],
				// Pussy group includes Penis, which is the only type of "pussy" with expressions and controls erections.
				Pussy: [
					{ Expression: "Hard", Limit: 50 },
					{ Expression: null, Limit: 0 },
				],
			};
		}

		/** @type {{[key: string]: ExpressionName[]}} */
		const bceExpressionModifierMap = Object.freeze({
			Blush: [null, "Low", "Medium", "High", "VeryHigh", "Extreme"],
		});

		const AUTOMATED_AROUSAL_EVENT_TYPE = "AutomatedByArousal",
			DEFAULT_EVENT_TYPE = "DEFAULT",
			GAME_TIMED_EVENT_TYPE = "GameTimer",
			MANUAL_OVERRIDE_EVENT_TYPE = "ManualOverride",
			POST_ORGASM_EVENT_TYPE = "PostOrgasm";

		/** @type {ExpressionEvent[]} */
		const bceExpressionsQueue = [];
		let lastUniqueId = 0;

		/** @type {() => number} */
		function newUniqueId() {
			lastUniqueId = (lastUniqueId + 1) % (Number.MAX_SAFE_INTEGER - 1);
			return lastUniqueId;
		}

		/** @type {Partial<Record<'Eyes' | 'Eyes2' | 'Eyebrows' | 'Mouth' | 'Fluids' | 'Emoticon' | 'Blush' | 'Pussy', string | null>>} */
		const manualComponents = {};

		/** @type {(evt: ExpressionEvent) => void} */
		function pushEvent(evt) {
			if (!evt) {
				return;
			}
			switch (evt.Type) {
				case AUTOMATED_AROUSAL_EVENT_TYPE:
				case POST_ORGASM_EVENT_TYPE:
					if (!fbcSettings.expressions) {
						return;
					}
					break;
				case MANUAL_OVERRIDE_EVENT_TYPE:
					break;
				default:
					if (!fbcSettings.activityExpressions) {
						return;
					}
			}
			const time = Date.now();
			// Deep copy
			/** @type {ExpressionEvent} */
			const event = deepCopy(evt);
			event.At = time;
			event.Until = time + event.Duration;
			event.Id = newUniqueId();
			if (typeof event.Priority !== "number") {
				event.Priority = 1;
			}
			if (event.Expression) {
				for (const t of Object.values(event.Expression)) {
					for (const exp of t) {
						exp.Id = newUniqueId();
						if (typeof exp.Priority !== "number") {
							exp.Priority = 1;
						}
						if (typeof exp.Duration !== "number") {
							exp.Duration = event.Duration;
						}
					}
				}
			}
			if (event.Poses) {
				for (const p of event.Poses) {
					p.Id = newUniqueId();
					if (typeof p.Priority !== "number") {
						p.Priority = 1;
					}
				}
			}
			bceExpressionsQueue.push(event);
		}
		w.fbcPushEvent = pushEvent;

		if (!w.bce_EventExpressions) {
			// eslint-disable-next-line camelcase
			w.bce_EventExpressions = {
				PostOrgasm: {
					Type: POST_ORGASM_EVENT_TYPE,
					Duration: 20000,
					Priority: 10000,
					Expression: {
						Blush: [
							{ Expression: "Extreme", Duration: 5000 },
							{ ExpressionModifier: -1, Duration: 5000 },
							{ ExpressionModifier: -1, Duration: 5000, Priority: 1000 },
							{ ExpressionModifier: -1, Duration: 5000, Priority: 200 },
						],
						Eyes: [
							{ Expression: "Closed", Duration: 8500 },
							{ Expression: "Heart", Duration: 7500 },
							{ Expression: "Sad", Duration: 4000, Priority: 200 },
						],
						Eyes2: [
							{ Expression: "Closed", Duration: 8000 },
							{ Expression: "Heart", Duration: 8000 },
							{ Expression: "Sad", Duration: 4000, Priority: 200 },
						],
						Mouth: [
							{ Expression: "Ahegao", Duration: 5000 },
							{ Expression: "Moan", Duration: 5000 },
							{ Expression: "HalfOpen", Duration: 10000, Priority: 200 },
						],
						Fluids: [
							{ Expression: "DroolMessy", Duration: 5000 },
							{ Expression: "DroolSides", Duration: 9000, Priority: 400 },
							{ Expression: "DroolLow", Duration: 6000, Priority: 200 },
						],
						Eyebrows: [
							{ Expression: "Soft", Duration: 10000 },
							{ Expression: "Lowered", Duration: 5000, Priority: 200 },
							{ Expression: null, Duration: 5000, Priority: 1 },
						],
					},
				},
				Pout: {
					Type: "Pout",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Pout", Duration: -1 }],
						Eyes: [{ Expression: "Dazed", Duration: -1 }],
						Eyes2: [{ Expression: "Dazed", Duration: -1 }],
						Eyebrows: [{ Expression: "Harsh", Duration: -1 }],
					},
				},
				ResetBrows: {
					Type: "ResetBrows",
					Duration: -1,
					Expression: {
						Eyebrows: [{ Expression: null, Duration: -1 }],
					},
				},
				RaiseBrows: {
					Type: "RaiseBrows",
					Duration: -1,
					Expression: {
						Eyebrows: [{ Expression: "Raised", Duration: -1 }],
					},
				},
				Confused: {
					Type: "Confused",
					Duration: -1,
					Expression: {
						Eyebrows: [{ Expression: "OneRaised", Duration: -1 }],
					},
				},
				Smirk: {
					Type: "Smirk",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Smirk", Duration: -1 }],
					},
				},
				Wink: {
					Type: "Wink",
					Duration: 1500,
					Expression: {
						Eyes: [{ Expression: "Closed", Duration: 1500 }],
					},
				},
				Laugh: {
					Type: "Laugh",
					Duration: 8000,
					Expression: {
						Mouth: [
							{ Expression: "Laughing", Duration: 1000 },
							{ Expression: "Grin", Duration: 200 },
							{ Expression: "Laughing", Duration: 1000 },
							{ Expression: "Happy", Duration: 200 },
							{ Expression: "Laughing", Duration: 800 },
							{ Expression: "Grin", Duration: 400 },
							{ Expression: "Laughing", Duration: 800 },
							{ Expression: "Happy", Duration: 400 },
							{ Expression: "Laughing", Duration: 600 },
							{ Expression: "Grin", Duration: 600 },
							{ Expression: "Laughing", Duration: 600 },
							{ Expression: "Happy", Duration: 600 },
							{ Expression: "Laughing", Duration: 200 },
							{ Expression: "Grin", Duration: 200 },
							{ Expression: "Laughing", Duration: 200 },
							{ Expression: "Happy", Duration: 200 },
						],
					},
				},
				Giggle: {
					Type: "Giggle",
					Duration: 4000,
					Expression: {
						Mouth: [
							{ Expression: "Laughing", Duration: 800 },
							{ Expression: "Grin", Duration: 200 },
							{ Expression: "Laughing", Duration: 700 },
							{ Expression: "Happy", Duration: 200 },
							{ Expression: "Laughing", Duration: 600 },
							{ Expression: "Grin", Duration: 200 },
							{ Expression: "Laughing", Duration: 500 },
							{ Expression: "Grin", Duration: 200 },
							{ Expression: "Laughing", Duration: 400 },
							{ Expression: "Happy", Duration: 200 },
						],
					},
				},
				Chuckle: {
					Type: "Chuckle",
					Duration: 4000,
					Expression: {
						Mouth: [{ Expression: "Grin", Duration: 4000 }],
					},
				},
				Smile: {
					Type: "Smile",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Grin", Duration: -1 }],
					},
				},
				Blink: {
					Type: "Blink",
					Duration: 200,
					Expression: {
						Eyes: [{ Expression: "Closed", Duration: 200 }],
						Eyes2: [{ Expression: "Closed", Duration: 200 }],
					},
				},
				Grin: {
					Type: "Grin",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: "Horny", Duration: -1 }],
						Eyes2: [{ Expression: "Horny", Duration: -1 }],
						Mouth: [{ Expression: "Grin", Duration: -1 }],
					},
				},
				Cuddle: {
					Type: "Cuddle",
					Duration: 10000,
					Priority: 150,
					Expression: {
						Mouth: [{ Expression: "Happy", Duration: 10000 }],
						Eyes: [{ Expression: "ShylyHappy", Duration: 10000 }],
						Eyes2: [{ Expression: "ShylyHappy", Duration: 10000 }],
						Eyebrows: [{ Expression: "Raised", Duration: 10000 }],
					},
				},
				Blush: {
					Type: "Blush",
					Duration: 10000,
					Expression: {
						Blush: [{ ExpressionModifier: 1, Duration: 10000 }],
					},
				},
				Choke: {
					Type: "Choke",
					Duration: 4000,
					Priority: 150,
					Expression: {
						Blush: [{ ExpressionModifier: 3, Duration: 4000 }],
						Eyes: [
							{ Expression: "VeryLewd", Duration: 3000 },
							{ Expression: "Sad", Duration: 1000 },
						],
						Eyes2: [
							{ Expression: "VeryLewd", Duration: 3000 },
							{ Expression: "Sad", Duration: 1000 },
						],
						Eyebrows: [{ Expression: "Harsh", Duration: 4000 }],
					},
				},
				Stimulated: {
					Type: "Stimulated",
					Duration: 5000,
					Priority: 400,
					Expression: {
						Blush: [{ ExpressionModifier: 2, Duration: 5000 }],
						Eyes: [
							{ Expression: "VeryLewd", Duration: 4000 },
							{ Expression: "Sad", Duration: 1000 },
						],
						Eyes2: [
							{ Expression: "VeryLewd", Duration: 4000 },
							{ Expression: "Sad", Duration: 1000 },
						],
						Eyebrows: [{ Expression: "Soft", Duration: 5000 }],
					},
				},
				StimulatedLong: {
					Type: "StimulatedLong",
					Duration: 20000,
					Priority: 400,
					Expression: {
						Blush: [{ ExpressionModifier: 1, Duration: 20000 }],
					},
				},
				Shock: {
					Type: "Shock",
					Duration: 15000,
					Priority: 1000,
					Expression: {
						Blush: [
							{ ExpressionModifier: 5, Duration: 10000 },
							{ ExpressionModifier: -1, Duration: 2000 },
							{ ExpressionModifier: -1, Duration: 2000 },
							{ ExpressionModifier: -1, Duration: 1000 },
						],
						Eyes: [
							{ Expression: "Dizzy", Duration: 1000 },
							{ Expression: "Scared", Duration: 8000 },
							{ Expression: "Surprised", Duration: 7000 },
						],
						Eyes2: [
							{ Expression: "Dizzy", Duration: 1000 },
							{ Expression: "Scared", Duration: 8000 },
							{ Expression: "Surprised", Duration: 7000 },
						],
						Eyebrows: [{ Expression: "Soft", Duration: 15000 }],
						Mouth: [
							{ Expression: "Pained", Duration: 10000 },
							{ Expression: "Angry", Duration: 5000 },
						],
					},
				},
				ShockLight: {
					Type: "ShockLight",
					Duration: 5000,
					Priority: 900,
					Expression: {
						Blush: [{ ExpressionModifier: 2, Duration: 5000 }],
						Eyes: [
							{ Expression: "Dizzy", Duration: 2000 },
							{ Expression: "Surprised", Duration: 3000 },
						],
						Eyes2: [
							{ Expression: "Dizzy", Duration: 2000 },
							{ Expression: "Surprised", Duration: 3000 },
						],
						Eyebrows: [{ Expression: "Soft", Duration: 5000 }],
						Mouth: [{ Expression: "Angry", Duration: 5000 }],
					},
				},
				Hit: {
					Type: "Hit",
					Duration: 7000,
					Priority: 500,
					Expression: {
						Blush: [{ Expression: "VeryHigh", Duration: 7000 }],
						Eyes: [
							{ Expression: "Daydream", Duration: 1000 },
							{ Expression: "Closed", Duration: 3000 },
							{ Expression: "Daydream", Duration: 3000 },
						],
						Eyes2: [
							{ Expression: "Daydream", Duration: 1000 },
							{ Expression: "Closed", Duration: 3000 },
							{ Expression: "Daydream", Duration: 3000 },
						],
						Eyebrows: [{ Expression: "Soft", Duration: 7000 }],
					},
				},
				Spank: {
					Type: "Spank",
					Duration: 3000,
					Priority: 300,
					Expression: {
						Eyes: [{ Expression: "Lewd", Duration: 3000 }],
						Eyes2: [{ Expression: "Lewd", Duration: 3000 }],
						Eyebrows: [{ Expression: "Soft", Duration: 3000 }],
					},
				},
				Kiss: {
					Type: "Kiss",
					Duration: 2000,
					Priority: 200,
					Expression: {
						Mouth: [{ Expression: "HalfOpen", Duration: 2000 }],
					},
				},
				KissOnLips: {
					Type: "KissOnLips",
					Duration: 2000,
					Priority: 200,
					Expression: {
						Eyes: [{ Expression: "Closed", Duration: 2000 }],
						Eyes2: [{ Expression: "Closed", Duration: 2000 }],
						Mouth: [{ Expression: "HalfOpen", Duration: 2000 }],
						Blush: [
							{ Skip: true, Duration: 1000 },
							{ ExpressionModifier: 1, Duration: 1000 },
						],
					},
				},
				LongKiss: {
					Type: "LongKiss",
					Duration: 4000,
					Priority: 200,
					Expression: {
						Eyes: [{ Expression: "Closed", Duration: 4000 }],
						Eyes2: [{ Expression: "Closed", Duration: 4000 }],
						Mouth: [{ Expression: "Open", Duration: 4000 }],
						Blush: [
							{ Skip: true, Duration: 1000 },
							{ ExpressionModifier: 1, Duration: 1000 },
							{ ExpressionModifier: 1, Duration: 2000 },
						],
					},
				},
				Disoriented: {
					Type: "Disoriented",
					Duration: 8000,
					Priority: 250,
					Expression: {
						Eyes: [{ Expression: "Dizzy", Duration: 8000 }],
						Eyes2: [{ Expression: "Dizzy", Duration: 8000 }],
						Eyebrows: [{ Expression: "Raised", Duration: 8000 }],
						Blush: [{ ExpressionModifier: 2, Duration: 8000 }],
					},
				},
				Angry: {
					Type: "Angry",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Angry", Duration: -1 }],
						Eyes: [{ Expression: "Angry", Duration: -1 }],
						Eyes2: [{ Expression: "Angry", Duration: -1 }],
						Eyebrows: [{ Expression: "Angry", Duration: -1 }],
					},
				},
				Sad: {
					Type: "Sad",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Frown", Duration: -1 }],
						Eyes: [{ Expression: "Shy", Duration: -1 }],
						Eyes2: [{ Expression: "Shy", Duration: -1 }],
						Eyebrows: [{ Expression: "Soft", Duration: -1 }],
					},
				},
				Worried: {
					Type: "Worried",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: "Surprised", Duration: -1 }],
						Eyes2: [{ Expression: "Surprised", Duration: -1 }],
						Eyebrows: [{ Expression: "Soft", Duration: -1 }],
					},
				},
				Distressed: {
					Type: "Distressed",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: "Scared", Duration: -1 }],
						Eyes2: [{ Expression: "Scared", Duration: -1 }],
						Eyebrows: [{ Expression: "Soft", Duration: -1 }],
						Mouth: [{ Expression: "Angry", Duration: -1 }],
					},
				},
				Reset: {
					Type: "Reset",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: null, Duration: -1 }],
						Eyes: [{ Expression: null, Duration: -1 }],
						Eyes2: [{ Expression: null, Duration: -1 }],
						Eyebrows: [{ Expression: null, Duration: -1 }],
						Blush: [{ Expression: null, Duration: -1 }],
						Fluids: [{ Expression: null, Duration: -1 }],
					},
				},
				Cry: {
					Type: "Cry",
					Duration: -1,
					Expression: {
						Fluids: [{ Expression: "TearsMedium", Duration: -1 }],
					},
				},
				DroolReset: {
					Type: "DroolReset",
					Duration: -1,
					Expression: {
						Fluids: [{ Expression: null, Duration: -1 }],
					},
				},
				DroolSides: {
					Type: "DroolSides",
					Duration: -1,
					Expression: {
						Fluids: [{ Expression: "DroolSides", Duration: -1 }],
					},
				},
				BareTeeth: {
					Type: "BareTeeth",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Angry", Duration: -1 }],
					},
				},
				Happy: {
					Type: "Happy",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Happy", Duration: -1 }],
					},
				},
				Frown: {
					Type: "Frown",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Frown", Duration: -1 }],
					},
				},
				Glare: {
					Type: "Glare",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: "Angry", Duration: -1 }],
						Eyes2: [{ Expression: "Angry", Duration: -1 }],
						Eyebrows: [{ Expression: "Harsh", Duration: -1 }],
					},
				},
				NarrowEyes: {
					Type: "NarrowEyes",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: "Horny", Duration: -1 }],
						Eyes2: [{ Expression: "Horny", Duration: -1 }],
					},
				},
				OpenEyes: {
					Type: "OpenEyes",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: null, Duration: -1 }],
						Eyes2: [{ Expression: null, Duration: -1 }],
					},
				},
				CloseEyes: {
					Type: "CloseEyes",
					Duration: -1,
					Expression: {
						Eyes: [{ Expression: "Closed", Duration: -1 }],
						Eyes2: [{ Expression: "Closed", Duration: -1 }],
					},
				},
				CloseMouth: {
					Type: "CloseMouth",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: null, Duration: -1 }],
					},
				},
				OpenMouth: {
					Type: "OpenMouth",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "Moan", Duration: -1 }],
					},
				},
				LipBite: {
					Type: "LipBite",
					Duration: -1,
					Expression: {
						Mouth: [{ Expression: "LipBite", Duration: -1 }],
					},
				},
				Lick: {
					Type: "Lick",
					Duration: 4000,
					Priority: 200,
					Expression: {
						Mouth: [{ Expression: "Ahegao", Duration: 4000 }],
						Blush: [{ ExpressionModifier: 1, Duration: 4000 }],
					},
				},
				GagInflate: {
					Type: "GagInflate",
					Duration: 4000,
					Priority: 400,
					Expression: {
						Eyes: [{ Expression: "Lewd", Duration: 4000 }],
						Eyes2: [{ Expression: "Lewd", Duration: 4000 }],
						Blush: [
							{ ExpressionModifier: 2, Duration: 2000 },
							{ ExpressionModifier: -1, Duration: 2000 },
						],
					},
				},
				Iced: {
					Type: "Iced",
					Duration: 4000,
					Priority: 500,
					Expression: {
						Eyes: [
							{ Expression: "Surprised", Duration: 3000 },
							{ Expression: null, Duration: 1000 },
						],
						Eyes2: [
							{ Expression: "Surprised", Duration: 3000 },
							{ Expression: null, Duration: 1000 },
						],
						Mouth: [{ Expression: "Angry", Duration: 4000 }],
					},
				},
				AllFours: {
					Type: "AllFours",
					Duration: -1,
					Poses: [{ Pose: ["AllFours"], Duration: -1 }],
				},
				SpreadKnees: {
					Type: "SpreadKnees",
					Duration: -1,
					Poses: [{ Pose: ["KneelingSpread"], Duration: -1 }],
				},
				Hogtied: {
					Type: "Hogtied",
					Duration: -1,
					Poses: [{ Pose: ["Hogtied"], Duration: -1 }],
				},
				Handstand: {
					Type: "Handstand",
					Duration: -1,
					Poses: [{ Pose: ["Suspension", "OverTheHead"], Duration: -1 }],
				},
				Stretch: {
					Type: "Stretch",
					Priority: 100,
					Duration: 6000,
					Poses: [
						{ Pose: ["OverTheHead"], Duration: 1000 },
						{ Pose: ["Yoked"], Duration: 1000 },
						{ Pose: ["BaseUpper"], Duration: 1000 },
						{ Pose: ["Spread"], Duration: 1000 },
						{ Pose: ["LegsClosed"], Duration: 1000 },
						{ Pose: ["BaseLower"], Duration: 1000 },
					],
				},
				SpreadLegs: {
					Type: "SpreadLegs",
					Duration: -1,
					Poses: [{ Pose: ["Spread"], Duration: -1 }],
				},
				JumpingJacks: {
					Type: "JumpingJacks",
					Priority: 100,
					Duration: 8000,
					Poses: [
						{ Pose: ["OverTheHead", "Spread"], Duration: 1000 },
						{ Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
						{ Pose: ["OverTheHead", "Spread"], Duration: 1000 },
						{ Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
						{ Pose: ["OverTheHead", "Spread"], Duration: 1000 },
						{ Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
						{ Pose: ["OverTheHead", "Spread"], Duration: 1000 },
						{ Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
					],
				},
			};
		}

		if (!w.bce_ActivityTriggers) {
			// eslint-disable-next-line camelcase
			w.bce_ActivityTriggers = [
				{
					Event: "Blush",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-ItemMouth-PoliteKiss$/u,
						},
					],
				},
				{
					Event: "Stretch",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^stretches (her|his|their) whole body/u,
						},
					],
				},
				{
					Event: "JumpingJacks",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^does jumping[ -]?jacks/u,
						},
					],
				},
				{
					Event: "AllFours",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(gets on all fours|starts crawling)/u,
						},
					],
				},
				{
					Event: "SpreadKnees",
					Type: "Emote",
					Matchers: [
						{
							Tester:
								/^spreads(( (her|his|their) legs)? on)? (her|his|their) knees/u,
						},
					],
				},
				{
					Event: "SpreadLegs",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^spreads (her|his|their) legs apart/u,
						},
					],
				},
				{
					Event: "Handstand",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(does a handstand|stands on (her|his|their) hands)/u,
						},
					],
				},
				{
					Event: "Hogtied",
					Type: "Emote",
					Matchers: [
						{
							Tester:
								/^lies( down)? on (the floor|(her|his|their) (tummy|stomach))/u,
						},
					],
				},
				{
					Event: "Blush",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^blushes/u,
						},
					],
				},
				{
					Event: "Chuckle",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^chuckles/u,
						},
					],
				},
				{
					Event: "Laugh",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^laughs/u,
						},
					],
				},
				{
					Event: "Giggle",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^giggles/u,
						},
					],
				},
				{
					Event: "Smirk",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(smirk(s|ing)|.*with a smirk)/u,
						},
					],
				},
				{
					Event: "Wink",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^winks/u,
						},
					],
				},
				{
					Event: "Pout",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^pouts/u,
						},
					],
				},
				{
					Event: "Blink",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^blinks/u,
						},
					],
				},
				{
					Event: "Frown",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^frowns/u,
						},
					],
				},
				{
					Event: "Grin",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(grins|is grinning)/u,
						},
					],
				},
				{
					Event: "Confused",
					Type: "Emote",
					Matchers: [
						{
							Tester:
								/^((seems|looks) (confused|curious|suspicious)|raises an eyebrow)/u,
						},
					],
				},
				{
					Event: "CloseMouth",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^closes (her|his|their) mouth/u,
						},
					],
				},
				{
					Event: "OpenMouth",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^opens (her|his|their) mouth/u,
						},
					],
				},
				{
					Event: "Happy",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(looks|seems|is|gets|smiles) happ(il)?y/u,
						},
					],
				},
				{
					Event: "Smile",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^smiles/u,
						},
					],
				},
				{
					Event: "Distressed",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(looks|seems|is|gets) distressed/u,
						},
					],
				},
				{
					Event: "Sad",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(looks|seems|is|gets) sad/u,
						},
					],
				},
				{
					Event: "Worried",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(looks|seems|is|gets) (worried|surprised)/u,
						},
					],
				},
				{
					Event: "BareTeeth",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(bares (her|his|their) teeth|snarls)/u,
						},
					],
				},
				{
					Event: "Angry",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(looks angr(il)?y|(gets|is|seems) angry)/u,
						},
					],
				},
				{
					Event: "Glare",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^(glares|looks harshly|gives a (glare|harsh look))/u,
						},
					],
				},
				{
					Event: "OpenEyes",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^opens (her|his|their) eyes/u,
						},
					],
				},
				{
					Event: "NarrowEyes",
					Type: "Emote",
					Matchers: [
						{
							Tester:
								/^((squints|narrows) (her|his|their) eyes|narrowly opens (her|his|their) eyes)/u,
						},
					],
				},
				{
					Event: "CloseEyes",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^closes (her|his|their) eyes/u,
						},
					],
				},
				{
					Event: "ResetBrows",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^lowers (her|his|their) eyebrows/u,
						},
					],
				},
				{
					Event: "RaiseBrows",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^raises (her|his|their) eyebrows/u,
						},
					],
				},
				{
					Event: "DroolSides",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^drools/u,
						},
					],
				},
				{
					Event: "Cry",
					Type: "Emote",
					Matchers: [
						{
							Tester:
								/^(starts to cry|sheds .* tears?|eyes( start( to)?)? leak)/u,
						},
					],
				},
				{
					Event: "Reset",
					Type: "Emote",
					Matchers: [
						{
							Tester: /^'s (expression|face) returns to normal/u,
						},
					],
				},
				{
					Event: "Shock",
					Type: "Action",
					Matchers: [
						{
							Tester:
								/^(ActionActivityShockItem|FuturisticVibratorShockTrigger|FuturisticChastityBeltShock\w+|(TriggerShock|(ShockCollar|Collar(Auto)?ShockUnit|(LoveChastityBelt|SciFiPleasurePanties)Shock)Trigger)(1|2))$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
					],
				},
				{
					Event: "ShockLight",
					Type: "Action",
					Matchers: [
						{
							Tester:
								/^(TriggerShock|(ShockCollar|Collar(Auto)?ShockUnit|(LoveChastityBelt|SciFiPleasurePanties)Shock)Trigger)0$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
					],
				},
				{
					Event: "Hit",
					Type: "Action",
					Matchers: [
						{
							Tester: /^ActionActivitySpankItem$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
					],
				},
				{
					Event: "Spank",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-ItemButt-Spank$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
						{
							Tester: /^ChatSelf-ItemButt-Spank$/u,
						},
					],
				},
				{
					Event: "Cuddle",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-.*-Cuddle$/u,
						},
						{
							Tester: /^ChatSelf-.*-Cuddle$/u,
						},
					],
				},
				{
					Event: "Stimulated",
					Type: "Action",
					Matchers: [
						{
							Tester: /^ActionActivityMasturbateItem$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
					],
				},
				{
					Event: "StimulatedLong",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-.*-(Masturbate|Penetrate).*$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
						{
							Tester: /^ChatSelf-.*-(Masturbate|Penetrate).*$/u,
						},
					],
				},
				{
					Event: "KissOnLips",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-ItemMouth-Kiss$/u,
						},
					],
				},
				{
					Event: "Kiss",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-.*-Kiss$/u,
							Criteria: {
								SenderIsPlayer: true,
							},
						},
					],
				},
				{
					Event: "Disoriented",
					Type: "Action",
					Matchers: [
						{
							Tester: /^(KneelDown|StandUp)Fail$/u,
						},
					],
				},
				{
					Event: "LipBite",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatSelf-ItemMouth-Bite$/u,
						},
					],
				},
				{
					Event: "Lick",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-.*-(Lick|MasturbateTongue)$/u,
							Criteria: {
								SenderIsPlayer: true,
							},
						},
					],
				},
				{
					Event: "DroolReset",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-ItemMouth-Caress$/u,
							Criteria: {
								TargetIsPlayer: true,
							},
						},
						{
							Tester: /^ChatSelf-ItemMouth-Caress$/u,
						},
					],
				},
				{
					Event: "LongKiss",
					Type: "Activity",
					Matchers: [
						{
							Tester: /^ChatOther-ItemMouth-FrenchKiss$/u,
						},
					],
				},
			];
		}

		/** @type {(dict?: ChatMessageDictionary) => boolean} */
		function dictHasPlayerTarget(dict) {
			return (
				dict?.some(
					(t) =>
						t &&
						"TargetCharacter" in t &&
						t.TargetCharacter === Player.MemberNumber
				) || false
			);
		}

		registerSocketListener("ChatRoomMessage", (data) => {
			activityTriggers: for (const trigger of w.bce_ActivityTriggers.filter(
				(t) => t.Type === data.Type
			)) {
				for (const matcher of trigger.Matchers) {
					if (matcher.Tester.test(data.Content)) {
						if (matcher.Criteria) {
							if (
								matcher.Criteria.SenderIsPlayer &&
								data.Sender !== Player.MemberNumber
							) {
								continue;
							} else if (
								matcher.Criteria.TargetIsPlayer &&
								!dictHasPlayerTarget(data.Dictionary)
							) {
								continue;
							} else if (
								matcher.Criteria.DictionaryMatchers &&
								!matcher.Criteria.DictionaryMatchers.some((m) =>
									data.Dictionary?.find((t) =>
										// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
										// @ts-ignore - intentional dynamic indexing on statically defined types
										Object.keys(m).every((k) => m[k] === t[k])
									)
								)
							) {
								continue;
							}
							// Criteria met
							pushEvent(w.bce_EventExpressions[trigger.Event]);
						} else if (
							data.Sender === Player.MemberNumber ||
							dictHasPlayerTarget(data.Dictionary)
						) {
							// Lacking criteria, check for presence of player as source or target
							pushEvent(w.bce_EventExpressions[trigger.Event]);
							break activityTriggers;
						}
					}
				}
			}
		});

		/** @type {(faceComponent: string) => [ExpressionName, boolean]} */
		function expression(t) {
			const properties =
				Player.Appearance.filter((a) => a.Asset.Group.Name === t)[0]
					?.Property ?? null;
			return [properties?.Expression || null, !properties?.RemoveTimer];
		}

		/** @type {(faceComponent: string, newExpression: ExpressionName, color?: string | string[]) => void} */
		function setExpression(t, n, color) {
			if (!n) {
				n = null;
			}
			for (let i = 0; i < Player.Appearance.length; i++) {
				const appearance = Player.Appearance[i];
				if (appearance.Asset.Group.Name === t) {
					if (!appearance.Property) {
						appearance.Property = {};
					}
					appearance.Property.Expression = n;
					if (color) {
						Player.Appearance[i].Color = color;
					}
					break;
				}
			}
		}

		const poseCategories = /** @type {const} */ ({
			BodyFull: {
				Conflicts: ["BodyUpper", "BodyLower"],
			},
			BodyUpper: {
				Conflicts: ["BodyFull"],
			},
			BodyLower: {
				Conflicts: ["BodyFull"],
			},
		});

		/**
		 * @param {unknown} pose
		 * @returns {pose is keyof typeof poseCategories}
		 */
		function hasConflicts(pose) {
			return isString(pose) && pose in poseCategories;
		}

		const faceComponents = [
			"Eyes",
			"Eyes2",
			"Eyebrows",
			"Mouth",
			"Fluids",
			"Emoticon",
			"Blush",
			"Pussy",
		];

		// When first initializing, set the current face as manual override
		pushEvent({
			Type: MANUAL_OVERRIDE_EVENT_TYPE,
			Duration: -1,
			Expression: faceComponents
				.map((t) => {
					const [expr] = expression(t);
					return [t, expr];
				})
				.filter((v) => v[1] !== null)
				.map((v) => [v[0], [{ Expression: v[1] }]])
				// eslint-disable-next-line no-inline-comments
				.reduce((a, v) => ({ ...a, [/** @type {string} */ (v[0])]: v[1] }), {}),
		});

		let lastOrgasm = 0,
			orgasmCount = 0,
			wasDefault = false;

		let PreviousArousal = Player.ArousalSettings;

		const ArousalMeterDirection = {
			None: 0,
			Down: 1,
			Up: 2,
		};
		let PreviousDirection = ArousalMeterDirection.Up;

		/**
		 * @param {string[]} types Types to reset
		 * @param {string[]} skippedTypes Types to skip resetting in addition to automated arousal events
		 */
		function resetExpressionQueue(types, skippedTypes = []) {
			delete Player.ExpressionQueue;
			bceExpressionsQueue.push(
				...bceExpressionsQueue
					.splice(0, bceExpressionsQueue.length)
					.map((e) => {
						if (
							types.includes(e.Type) ||
							(e.Duration <= 0 &&
								e.Type !== AUTOMATED_AROUSAL_EVENT_TYPE &&
								!skippedTypes.includes(e.Type))
						) {
							delete e.Expression;
						}
						return e;
					})
			);
			// Restore manual overrides, if manual not in types
			if (!types.includes(MANUAL_OVERRIDE_EVENT_TYPE)) {
				pushEvent({
					Type: MANUAL_OVERRIDE_EVENT_TYPE,
					Duration: -1,
					Expression: objEntries(manualComponents).reduce(
						(a, [k, v]) => ({ ...a, [k]: [{ Expression: v }] }),
						{}
					),
				});
			} else {
				for (const [k] of objEntries(manualComponents)) {
					delete manualComponents[k];
				}
			}
		}

		Commands.push({
			Tag: "r",
			Description: displayText(
				"[part of face or 'all']: resets expression overrides on part of or all of face"
			),
			Action: (args) => {
				if (args.length === 0 || args === "all") {
					resetExpressionQueue([MANUAL_OVERRIDE_EVENT_TYPE]);
					fbcChatNotify(displayText("Reset all expressions"));
				} else {
					const component = `${args[0].toUpperCase()}${args
						.substring(1)
						.toLowerCase()}`;
					for (const e of bceExpressionsQueue
						.map((a) => a.Expression)
						.filter(Boolean)) {
						if (component === "Eyes" && "Eyes2" in e) {
							delete e.Eyes2;
						}
						if (component in e) {
							delete e[component];
						}
					}
					fbcChatNotify(
						displayText(`Reset expression on $component`, {
							$component: component,
						})
					);
				}
			},
		});

		Commands.push({
			Tag: "anim",
			Description: displayText("['list' or name of emote]: run an animation"),
			Action: (_1, _2, args) => {
				if (!fbcSettings.activityExpressions) {
					fbcChatNotify(
						displayText(
							"Activity expressions are not enabled in FBC settings. Unable to run animations."
						)
					);
					return;
				}
				if (args[0] === "list") {
					fbcChatNotify(
						displayText(`Available animations: $anims`, {
							$anims: Object.keys(w.bce_EventExpressions).join(", "),
						})
					);
				}
				const animation = Object.keys(w.bce_EventExpressions).find(
					(a) => a.toLowerCase() === args[0]?.toLowerCase()
				);
				if (animation) {
					pushEvent(w.bce_EventExpressions[animation]);
				}
			},
		});

		/**
		 * @param {AssetPoseName} pose
		 */
		function getPoseCategory(pose) {
			return PoseFemale3DCG.find((a) => a.Name === pose)?.Category;
		}

		/**
		 * @param {readonly string[]} poses
		 */
		function setPoses(poses) {
			poses = poses.filter((p) => p).map((p) => p.toLowerCase());
			bceExpressionsQueue.forEach((e) => {
				if (e.Type === MANUAL_OVERRIDE_EVENT_TYPE) {
					e.Poses = [];
				} else if (e.Poses && e.Poses.length > 0) {
					e.Poses.forEach((p) => {
						if (p.Pose.length === 0) {
							return;
						}
						if (typeof p.Pose[0] === "string") {
							return;
						}
						const poseList = p.Pose;
						p.Pose = poseList.filter((pp) => !!getPoseCategory(pp));
					});
				}
			});
			const poseNames = PoseFemale3DCG.filter((p) =>
				poses.includes(p.Name.toLowerCase())
			).map((p) => p.Name);
			for (const poseName of poseNames) {
				PoseSetActive(Player, poseName, false);
			}
		}

		Commands.push({
			Tag: "pose",
			Description: displayText("['list' or list of poses]: set your pose"),
			Action: (_1, _2, poses) => {
				if (poses[0] === "list") {
					const categories = [
						...new Set(PoseFemale3DCG.map((a) => a.Category)),
					];
					for (const category of categories) {
						const list = PoseFemale3DCG.filter(
							(a) => a.Category === category
						)?.map((a) => a.Name);
						list.sort();
						fbcChatNotify(`=> ${category}:\n${list.join("\n")}\n\n`);
					}
					return;
				}
				if (!bceAnimationEngineEnabled()) {
					fbcChatNotify(
						displayText(
							"Warning: animation engine in FBC is disabled. Pose may not be synchronized or set. Enable animation engine in FBC settings."
						)
					);
				}
				setPoses(poses);
			},
		});

		patchFunction(
			"TimerInventoryRemove",
			{
				"CharacterSetFacialExpression(C, C.ExpressionQueue[0].Group, C.ExpressionQueue[0].Expression, undefined, undefined, true);": `if (bceAnimationEngineEnabled()) {
					fbcPushEvent({
						Type: "${GAME_TIMED_EVENT_TYPE}",
						Duration: -1,
						Expression: {
							[C.ExpressionQueue[0].Group]: [{ Expression: C.ExpressionQueue[0].Expression, Duration: -1 }]
						}
					})
				} else {
					CharacterSetFacialExpression(C, C.ExpressionQueue[0].Group, C.ExpressionQueue[0].Expression, undefined, undefined, true);
				}`,
			},
			"Game's timed expressions are not hooked to FBC's animation engine"
		);

		patchFunction(
			"ValidationSanitizeProperties",
			{
				"delete property.Expression;": `delete property.Expression;
				if (bceAnimationEngineEnabled()) {
					if (item?.Asset?.Group?.Name) {
						CharacterSetFacialExpression(C, item.Asset.Group.Name, null);
						console.warn("(FBC) Animation engine acknowledged validation-based expression removal for face component", item)
					} else {
						console.warn("Unable to determine asset group name for item", item);
					}
				}`,
			},
			"Prevent animation engine from getting into an endless loop when another addon includes an invalid expression"
		);

		SDK.hookFunction(
			"CharacterSetFacialExpression",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof CharacterSetFacialExpression>} args
			 */
			(args, next) => {
				// eslint-disable-next-line prefer-const
				let [C, AssetGroup, Expression, Timer, Color] = args;
				if (
					!isCharacter(C) ||
					!isString(AssetGroup) ||
					(!isString(Expression) && Expression !== null) ||
					!C.IsPlayer() ||
					!bceAnimationEngineEnabled()
				) {
					return next(args);
				}

				const duration =
						typeof Timer === "number" && Timer > 0 ? Timer * 1000 : -1,
					/** @type {Record<string, ExpressionStage[]>} */
					e = {};
				/** @type {(keyof typeof manualComponents)[]} */
				let types = [];

				if (AssetGroup === "Eyes") {
					types = ["Eyes", "Eyes2"];
				} else if (AssetGroup === "Eyes1") {
					types = ["Eyes"];
				} else {
					types = [AssetGroup];
				}

				if (
					!Color ||
					!isStringOrStringArray(Color) ||
					!CommonColorIsValid(Color)
				) {
					// eslint-disable-next-line no-undefined
					Color = undefined;
				}

				for (const t of types) {
					e[t] = [{ Expression, Duration: duration, Color }];
					if (duration < 0) {
						manualComponents[t] = Expression;
					}
				}

				const evt = {
					Type: MANUAL_OVERRIDE_EVENT_TYPE,
					Duration: duration,
					Expression: e,
				};
				pushEvent(evt);
				return CustomArousalExpression();
			}
		);

		const poseFuncs = /** @type {const} */ ([
			"CharacterSetActivePose",
			"PoseSetActive",
		]);
		for (const poseFunc of poseFuncs) {
			SDK.hookFunction(
				poseFunc,
				HOOK_PRIORITIES.OverrideBehaviour,
				/**
				 * @param {Parameters<typeof PoseSetActive>} args
				 */
				// eslint-disable-next-line no-loop-func
				(args, next) => {
					const [C, Pose] = args;
					if (
						!isCharacter(C) ||
						(!isStringOrStringArray(Pose) && Pose !== null) ||
						!C.IsPlayer() ||
						!bceAnimationEngineEnabled()
					) {
						return next(args);
					}

					const p = {};
					if (!Pose || (Array.isArray(Pose) && Pose.every((pp) => !pp))) {
						p.Pose = /** @type {AssetPoseName[]} */ ([
							"BaseUpper",
							"BaseLower",
						]);
					} else {
						p.Pose = [Pose];
					}
					p.Duration = -1;
					const evt = {
						Type: MANUAL_OVERRIDE_EVENT_TYPE,
						Duration: -1,
						Poses: [p],
					};
					pushEvent(evt);
					return CustomArousalExpression();
				}
			);
		}

		registerSocketListener("ChatRoomSyncPose", (data) => {
			if (data === null || !isNonNullObject(data)) {
				return;
			}
			if (!Array.isArray(data.Pose)) {
				logWarn(
					`data.Pose in ChatRoomSyncPose for ${data.MemberNumber?.toString()} is not an array`
				);
				return;
			}
			if (!bceAnimationEngineEnabled()) {
				return;
			}
			if (data.MemberNumber === Player.MemberNumber) {
				setPoses(data.Pose);
			}
		});

		registerSocketListener("ChatRoomSyncSingle", (data) => {
			if (data === null || !isNonNullObject(data)) {
				return;
			}
			if (!bceAnimationEngineEnabled()) {
				return;
			}
			if (data.Character?.MemberNumber === Player.MemberNumber) {
				setPoses(data.Character.ActivePose ?? []);
			}
		});

		resetExpressionQueue([MANUAL_OVERRIDE_EVENT_TYPE, GAME_TIMED_EVENT_TYPE]);

		// This is called once per interval to check for expression changes
		// eslint-disable-next-line complexity
		function CustomArousalExpression() {
			if (!bceAnimationEngineEnabled() || !Player?.AppearanceLayers) {
				return;
			}

			// Ensure none of the expressions have remove timers on them; we handle timers here
			Player.Appearance.filter(
				(a) =>
					faceComponents.includes(a.Asset.Group.Name) && a.Property?.RemoveTimer
			).forEach((a) => {
				// @ts-ignore - a.Property cannot be undefined due to filter above
				delete a.Property.RemoveTimer;
			});

			if (!Player.ArousalSettings) {
				logWarn("Player.ArousalSettings is not defined");
				return;
			}

			Player.ArousalSettings.AffectExpression = false;

			const oCount = Player.ArousalSettings.OrgasmCount ?? 0;
			if (orgasmCount < oCount) {
				orgasmCount = oCount;
			} else if (orgasmCount > oCount) {
				Player.ArousalSettings.OrgasmCount = orgasmCount;
				ActivityChatRoomArousalSync(Player);
			}

			// Reset everything when face is fully default
			let isDefault = true;
			for (const t of faceComponents) {
				if (expression(t)[0]) {
					isDefault = false;
				}
			}
			if (isDefault) {
				PreviousArousal.Progress = 0;
				PreviousDirection = ArousalMeterDirection.Up;
				if (!wasDefault) {
					for (let i = 0; i < bceExpressionsQueue.length; i++) {
						if (bceExpressionsQueue[i].Type === AUTOMATED_AROUSAL_EVENT_TYPE) {
							continue;
						}
						bceExpressionsQueue[i].Expression = {};
					}
				}
				wasDefault = true;
			} else {
				wasDefault = false;
			}

			// Detect arousal movement
			const arousal = Player.ArousalSettings.Progress;
			let direction = PreviousDirection;
			if (arousal < PreviousArousal.Progress) {
				direction = ArousalMeterDirection.Down;
			} else if (arousal > PreviousArousal.Progress) {
				direction = ArousalMeterDirection.Up;
			}
			PreviousDirection = direction;

			const lastOrgasmAdjustment = () => {
				// Only boost up to the expression at arousal 90
				const lastOrgasmMaxArousal = 90,
					lastOrgasmMaxBoost = 30,
					orgasms = Player.ArousalSettings?.OrgasmCount || 0;
				const lastOrgasmBoostDuration = Math.min(300, 60 + orgasms * 5),
					secondsSinceOrgasm = ((Date.now() - lastOrgasm) / 10000) | 0;
				if (secondsSinceOrgasm > lastOrgasmBoostDuration) {
					return 0;
				}
				return Math.min(
					Math.max(0, lastOrgasmMaxArousal - arousal),
					(lastOrgasmMaxBoost *
						(lastOrgasmBoostDuration - secondsSinceOrgasm)) /
						lastOrgasmBoostDuration
				);
			};

			// Handle events
			const OrgasmRecoveryStage = 2;
			if (
				PreviousArousal.OrgasmStage !== OrgasmRecoveryStage &&
				Player.ArousalSettings.OrgasmStage === OrgasmRecoveryStage &&
				bceExpressionsQueue.filter((a) => a.Type === POST_ORGASM_EVENT_TYPE)
					.length === 0
			) {
				pushEvent(w.bce_EventExpressions.PostOrgasm);
				lastOrgasm = Date.now();
			}

			// Keep track of desired changes
			/** @type {{ [key: string]: ExpressionStage }} */
			const desiredExpression = {};

			/** @type {Record<string, { Id: number; Pose: AssetPoseName; Category?: string; Duration: number; Priority: number; Type: string }>} */
			let desiredPose = {};

			/** @type {{ [key: string]: ExpressionStage }} */
			const nextExpression = {};

			/** @type {(expression: ExpressionName, stage: ExpressionStage, next: ExpressionEvent, faceComponent: string) => void} */
			const trySetNextExpression = (e, exp, next, t) => {
				const priority = exp.Priority || next.Priority || 0;
				if (
					!nextExpression[t] ||
					(nextExpression[t].Priority ?? 0) <= priority
				) {
					nextExpression[t] = {
						Id: exp.Id,
						Expression: e,
						Duration: exp.Duration,
						Priority: priority,
						Color: exp.Color,
					};
				}
			};

			// Calculate next expression
			for (let j = 0; j < bceExpressionsQueue.length; j++) {
				const next = bceExpressionsQueue[j];
				const nextUntil = next.Until ?? 0;
				const nextAt = next.At ?? 0;
				let active = false;
				if (nextUntil > Date.now() || nextUntil - nextAt < 0) {
					const nextExpr = next.Expression ?? {};
					if (Object.keys(nextExpr).length > 0) {
						for (const t of Object.keys(nextExpr)) {
							let durationNow = Date.now() - nextAt;
							for (let i = 0; i < nextExpr[t].length; i++) {
								/** @type {ExpressionStage} */
								const exp = nextExpr[t][i];
								durationNow -= exp.Duration;
								if (durationNow < 0 || exp.Duration < 0) {
									active = true;
									if (!exp.Skip) {
										if (
											exp.ExpressionModifier &&
											t in bceExpressionModifierMap
										) {
											const [current] = expression(t);
											if (!exp.Applied) {
												/** @type {number} */
												let idx =
													bceExpressionModifierMap[t].indexOf(current) +
													exp.ExpressionModifier;
												if (idx >= bceExpressionModifierMap[t].length) {
													idx = bceExpressionModifierMap[t].length - 1;
												} else if (idx < 0) {
													idx = 0;
												}
												trySetNextExpression(
													bceExpressionModifierMap[t][idx],
													exp,
													next,
													t
												);
												// @ts-ignore - not undefined, ts is a derp
												bceExpressionsQueue[j].Expression[t][i].Applied = true;
											} else {
												// Prevent being overridden by other expressions while also not applying a change
												trySetNextExpression(current, exp, next, t);
											}
										} else {
											trySetNextExpression(
												exp.Expression ?? null,
												exp,
												next,
												t
											);
										}
									}
									break;
								}
							}
						}
					}
					if (next.Poses?.length) {
						let durationNow = Date.now() - nextAt;
						for (const pose of next.Poses) {
							durationNow -= pose.Duration;
							if (durationNow < 0 || pose.Duration < 0) {
								active = true;
								for (const p of pose.Pose) {
									const priority = pose.Priority || next.Priority || 0;
									const category = getPoseCategory(p);
									if (!category) {
										logWarn(`Pose ${p} has no category`);
										continue;
									}

									if (!pose.Id) {
										logWarn(`Pose ${p} has no ID`);
										pose.Id = newUniqueId();
									}

									if (
										!desiredPose[category] ||
										desiredPose[category].Priority <= priority
									) {
										desiredPose[category] = {
											Id: pose.Id,
											Pose: p,
											Category: category,
											Duration: pose.Duration,
											Priority: priority,
											Type: next.Type,
										};
									}
								}
								break;
							}
						}
					}
				}
				if (!active) {
					const last = bceExpressionsQueue.splice(j, 1);
					j--;
					if (
						!fbcSettings.expressions &&
						last.length > 0 &&
						last[0].Expression
					) {
						for (const t of Object.keys(last[0].Expression)) {
							trySetNextExpression(
								null,
								{ Duration: -1 },
								{
									Priority: 0,
									Type: DEFAULT_EVENT_TYPE,
									Duration: 500,
								},
								t
							);
						}
					}
				}
			}

			// Garbage collect unused expressions - this should occur before manual expressions are detected
			for (let j = 0; j < bceExpressionsQueue.length; j++) {
				const qExpr = bceExpressionsQueue[j].Expression;
				const qPoses = bceExpressionsQueue[j].Poses;
				if (qExpr) {
					for (const t of Object.keys(qExpr)) {
						if (!nextExpression[t] || nextExpression[t].Duration > 0) {
							continue;
						}
						const nextId = mustNum(nextExpression[t].Id),
							nextPriority = mustNum(nextExpression[t].Priority, 0);

						for (let i = 0; i < qExpr[t].length; i++) {
							const exp = qExpr[t][i];
							if (
								exp.Duration < 0 &&
								(mustNum(exp.Id) < nextId ||
									mustNum(exp.Priority, 0) < nextPriority)
							) {
								qExpr[t].splice(i, 1);
								i--;
							}
						}
						if (qExpr[t].length === 0) {
							delete qExpr[t];
						}
					}
				}
				if (qPoses) {
					for (let k = 0; k < qPoses.length; k++) {
						const pose = qPoses[k];
						const poseList = pose.Pose;
						const desiredIsNewerAndInfinite = poseList.every(
							// eslint-disable-next-line no-loop-func
							(p) => {
								const category = getPoseCategory(p);
								return (
									!!category &&
									desiredPose[category]?.Duration < 0 &&
									desiredPose[category]?.Id > mustNum(pose.Id) &&
									(desiredPose[category]?.Type === MANUAL_OVERRIDE_EVENT_TYPE ||
										bceExpressionsQueue[j].Type !== MANUAL_OVERRIDE_EVENT_TYPE)
								);
							}
						);
						if (pose.Duration < 0 && desiredIsNewerAndInfinite) {
							qPoses.splice(k, 1);
							k--;
						}
					}
				}
				if (
					Object.keys(bceExpressionsQueue[j].Expression || {}).length === 0 &&
					bceExpressionsQueue[j].Poses?.length === 0
				) {
					bceExpressionsQueue.splice(j, 1);
					j--;
				}
			}

			// Clean up unused poses
			let needsRefresh = false;
			/** @type {false | AssetPoseName[]} */
			let poseUpdate = false;
			if (Player.ActivePose) {
				for (let i = 0; i < Player.ActivePose.length; i++) {
					const pose = Player.ActivePose[i];
					const p = PoseFemale3DCG.find((pp) => pp.Name === pose);
					if (
						!p?.Category &&
						Object.values(desiredPose).every((v) => v.Pose !== pose)
					) {
						poseUpdate = [...Player.ActivePose];
						poseUpdate.splice(i, 1);
						i--;
						needsRefresh = true;
					}
				}
			}

			// Handle arousal-based expressions
			outer: for (const t of Object.keys(w.bce_ArousalExpressionStages)) {
				const [exp] = expression(t);
				/** @type {ExpressionName} */
				let chosenExpression = null;
				let expressionChosen = false;
				for (const face of w.bce_ArousalExpressionStages[t]) {
					const limit =
						face.Limit - (direction === ArousalMeterDirection.Up ? 0 : 1);
					if (arousal + lastOrgasmAdjustment() >= limit) {
						if (face.Expression !== exp) {
							chosenExpression = face.Expression;
							expressionChosen = true;
							break;
						} else {
							continue outer;
						}
					}
				}
				if (expressionChosen) {
					/** @type {ExpressionStages} */
					const e = {};
					e[t] = [{ Expression: chosenExpression, Duration: -1, Priority: 0 }];
					pushEvent({
						Type: AUTOMATED_AROUSAL_EVENT_TYPE,
						Duration: -1,
						Priority: 0,
						// @ts-ignore
						Expression: e,
					});
				}
			}

			for (const t of faceComponents) {
				const [exp] = expression(t),
					nextExp = nextExpression[t] || {
						Duration: -1,
						Expression: null,
					};
				if (
					nextExp.Expression !== exp &&
					typeof nextExp.Expression !== "undefined"
				) {
					desiredExpression[t] = { ...nextExp };
				}
			}

			if (Object.keys(desiredExpression).length > 0) {
				for (const t of Object.keys(desiredExpression)) {
					if (
						BCX?.getRuleState("block_changing_emoticon")?.isEnforced &&
						t === "Emoticon"
					) {
						continue;
					}
					setExpression(
						t,
						desiredExpression[t].Expression ?? null,
						desiredExpression[t].Color
					);
					ServerSend("ChatRoomCharacterExpressionUpdate", {
						// @ts-ignore - null is a valid name, mistake in BC-stubs
						Name: desiredExpression[t].Expression ?? null,
						Group: t,
						Appearance: ServerAppearanceBundle(Player.Appearance),
					});
				}

				needsRefresh = true;
			}

			// Figure out desiredPose conflicts
			function resolvePoseConflicts() {
				const maxPriority = Math.max(
					...Object.values(desiredPose).map((p) => p.Priority)
				);

				const maxPriorityPoses = objEntries(desiredPose).filter(
					(p) => p[1].Priority === maxPriority
				);

				let maxPriorityPose = "";

				if (maxPriorityPoses.length > 1) {
					const maxId = Math.max(...maxPriorityPoses.map((p) => p[1].Id)),
						maxIdPoses = maxPriorityPoses.filter((p) => p[1].Id === maxId);
					[[maxPriorityPose]] = maxIdPoses;
				} else if (maxPriorityPoses.length === 0) {
					return 0;
				} else {
					[[maxPriorityPose]] = maxPriorityPoses;
				}
				let deleted = 0;
				if (hasConflicts(maxPriorityPose)) {
					const conflicts = poseCategories[maxPriorityPose].Conflicts || [];
					for (const conflict of Array.from(conflicts).filter(
						(c) => c in desiredPose
					)) {
						delete desiredPose[conflict];
						deleted++;
					}
				}
				return deleted;
			}
			while (resolvePoseConflicts() > 0) {
				// Intentionally empty
			}

			if (Object.keys(desiredPose).length === 0) {
				desiredPose = {
					BodyUpper: {
						Pose: "BaseUpper",
						Duration: -1,
						Id: newUniqueId(),
						Priority: 0,
						Type: DEFAULT_EVENT_TYPE,
					},
					BodyLower: {
						Pose: "BaseLower",
						Duration: -1,
						Id: newUniqueId(),
						Priority: 0,
						Type: DEFAULT_EVENT_TYPE,
					},
				};
			}
			const basePoseMatcher = /^Base(Lower|Upper)$/u;
			const newPose = Object.values(desiredPose)
				.map((p) => p.Pose)
				.filter((p) => !basePoseMatcher.test(p));
			if (JSON.stringify(Player.ActivePose) !== JSON.stringify(newPose)) {
				poseUpdate = newPose;
				needsRefresh = true;
			}

			if (poseUpdate) {
				Player.ActivePose = poseUpdate;
				ServerSend("ChatRoomCharacterPoseUpdate", {
					Pose: poseUpdate,
				});
			}

			if (needsRefresh) {
				CharacterRefresh(Player, false, false);
			}

			PreviousArousal = { ...Player.ArousalSettings };
		}

		createTimer(CustomArousalExpression, 250);
	}

	async function layeringMenu() {
		await waitFor(() => !!Player?.AppearanceLayers);

		const canAccessLayeringMenus = () => {
			const c = CharacterGetCurrent();
			return (
				fbcSettings.layeringMenu &&
				(fbcSettings.allowLayeringWhileBound ||
					(Player.CanInteract() &&
						c?.FocusGroup?.Name &&
						!InventoryGroupIsBlocked(c, c.FocusGroup.Name)))
			);
		};

		// Pseudo-items that we do not want to process for color copying
		const ignoredColorCopiableAssets = [
			"LeatherCrop",
			"LeatherWhip",
			"ShockCollarRemote",
			"SpankingToys",
			"VibratorRemote",
		];
		const colorCopiableAssets = Asset.filter(
			(ass) =>
				AssetGroup.filter(
					(a) =>
						a.Name.startsWith("Item") &&
						!/\d$/u.test(a.Name) &&
						a.Asset.find((b) => b.Name === ass.Name)
				).length > 1
		)
			.filter((v, i, a) => a.findIndex((as) => as.Name === v.Name) === i)
			.map((a) => a.Name)
			.filter((a) => !ignoredColorCopiableAssets.includes(a));

		const layerPriority = "bce_LayerPriority";

		/** @type {(C: Character, item?: Item | null) => boolean} */
		function assetVisible(C, item) {
			return (
				!!item && !!C.AppearanceLayers?.find((a) => a.Asset === item.Asset)
			);
		}

		/** @type {(C: Character, item?: Item | null) => boolean} */
		function assetWorn(C, item) {
			return !!item && !!C.Appearance.find((a) => a === item);
		}

		/** @type {Record<string, number>} */
		let layerPriorities = {};
		let advancedPriorities = false;

		/** @type {(item: Item) => void} */
		function updateItemPriorityFromLayerPriorityInput(item) {
			if (item) {
				if (advancedPriorities) {
					const priorities = objEntries(layerPriorities);
					if (!item.Property) {
						item.Property = { OverridePriority: {} };
					} else {
						item.Property.OverridePriority = {};
					}
					for (const [layer, priority] of priorities) {
						// @ts-ignore - typescript isn't smart enough to understand that OverridePriority is an object, where any string key is valid
						item.Property.OverridePriority[layer] = priority;
					}
				} else {
					const priority = parseInt(ElementValue(layerPriority));
					if (!item.Property) {
						item.Property = { OverridePriority: priority };
					} else {
						item.Property.OverridePriority = priority;
					}
				}
				CharacterRefresh(preview, false, false);
			}
		}

		let prioritySubscreen = false;
		let layerPage = 0;

		const preview = CharacterLoadSimple(
			`LayeringPreview-${Player.MemberNumber ?? ""}`
		);

		/**
		 * @param {string} layerName
		 */
		function layerElement(layerName) {
			return `${layerPriority}___${layerName}`;
		}

		patchFunction(
			"DrawCharacter",
			{
				"const OverrideDark = ":
					"const OverrideDark = C.AccountName.startsWith('LayeringPreview') || ",
			},
			"Layering preview affected by blindness"
		);

		/** @type {(C: Character, FocusItem: Item) => void} */
		function prioritySubscreenEnter(C, FocusItem) {
			function getFocusItem() {
				if (!DialogFocusItem) {
					throw new Error(
						"expected DialogFocusItem when entering layering menu"
					);
				}

				const item = InventoryGet(preview, DialogFocusItem.Asset.Group.Name);
				if (!item) {
					throw new Error("expected focus item when entering layering menu");
				}
				return item;
			}

			DialogFocusItem = FocusItem;
			prioritySubscreen = true;
			advancedPriorities = false;
			if (!C.AppearanceLayers) {
				logWarn("C.AppearanceLayers is not defined");
			}
			const initialValue =
				C.AppearanceLayers?.find((a) => a.Asset === FocusItem.Asset)
					?.Priority ?? 0;
			layerPriorities = {};
			for (const layer of FocusItem.Asset.Layer) {
				const layerName = layer.Name;
				if (!layerName) {
					continue;
				}
				const drawnLayer = C.AppearanceLayers?.find(
					(a) => a.Asset === FocusItem.Asset && a.Name === layerName
				);
				let priority = layer.Priority ?? -1;
				if (
					isNonNullObject(FocusItem?.Property?.OverridePriority) &&
					layerName in FocusItem.Property.OverridePriority
				) {
					priority = FocusItem?.Property?.OverridePriority[layerName];
				}
				if (drawnLayer) {
					priority = drawnLayer.Priority ?? priority;
				}
				layerPriorities[layerName] = priority;
				const el = ElementCreateInput(
					layerElement(layerName),
					"number",
					"",
					"20"
				);
				ElementValue(layerElement(layerName), priority.toString());
				el.setAttribute("data-layer", layerName);
				el.className = layerPriority;
				// eslint-disable-next-line no-loop-func -- layerPriorities scope is outside the function, ElementValue and InventoryGet are global functions
				el.addEventListener("change", () => {
					layerPriorities[layerName] = parseInt(
						ElementValue(layerElement(layerName))
					);
					updateItemPriorityFromLayerPriorityInput(getFocusItem());
				});
			}
			hideAllLayerElements();
			if (isNonNullObject(FocusItem?.Property?.OverridePriority)) {
				advancedPriorities = true;
			}
			ElementCreateInput(layerPriority, "number", "", "20");
			ElementValue(layerPriority, initialValue.toString());
			layerPage = 0;
			preview.Appearance = C.Appearance.slice();
			CharacterRefresh(preview, false, false);

			const priorityInput = document.getElementById(layerPriority);
			if (!priorityInput) {
				logWarn("Priority input is not defined");
				return;
			}
			priorityInput.addEventListener("change", () => {
				updateItemPriorityFromLayerPriorityInput(getFocusItem());
			});
		}
		function prioritySubscreenExit() {
			prioritySubscreen = false;
			ElementRemove(layerPriority);
			document.querySelectorAll(`.${layerPriority}`).forEach((e) => {
				ElementRemove(e.id);
			});
			DialogFocusItem = null;
		}

		const dialogLeaveFuncs = /** @type {const} */ ([
			"DialogLeave",
			"DialogLeaveItemMenu",
		]);
		for (const func of dialogLeaveFuncs) {
			SDK.hookFunction(
				func,
				HOOK_PRIORITIES.OverrideBehaviour,
				/**
				 * @param {Parameters<typeof DialogLeave> | Parameters<typeof DialogLeaveItemMenu>} args
				 */
				// eslint-disable-next-line no-loop-func
				(args, next) => {
					if (prioritySubscreen) {
						prioritySubscreenExit();
						return;
					}
					next(args);
				}
			);
		}

		SDK.hookFunction(
			"AppearanceExit",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof AppearanceExit>} args
			 */
			(args, next) => {
				if (CharacterAppearanceMode === "") {
					ElementRemove(layerPriority);
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"AppearanceLoad",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof AppearanceLoad>} args
			 */
			(args, next) => {
				const ret = next(args);
				ElementCreateInput(layerPriority, "number", "", "20");
				ElementPosition(layerPriority, -1000, -1000, 0);
				return ret;
			}
		);

		SDK.hookFunction(
			"AppearanceRun",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof AppearanceRun>} args
			 */
			(args, next) => {
				if (prioritySubscreen) {
					prioritySubscreenDraw();
					return null;
				}
				const ret = next(args);
				if (fbcSettings.layeringMenu) {
					const C = CharacterAppearanceSelection;
					if (!C) {
						throw new Error(
							"CharacterAppearanceSelection is not defined in appearance menu"
						);
					}
					const item = C.Appearance.find((a) => a.Asset.Group === C.FocusGroup);
					if (CharacterAppearanceMode === "Cloth" && assetVisible(C, item)) {
						DrawButton(
							110,
							70,
							52,
							52,
							"",
							"White",
							ICONS.LAYERS,
							displayText("Modify layering priority")
						);
					}
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"AppearanceClick",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof AppearanceClick>} args
			 */
			(args, next) => {
				if (fbcSettings.layeringMenu) {
					const C = CharacterAppearanceSelection;
					if (!C) {
						throw new Error(
							"CharacterAppearanceSelection is not defined in appearance menu"
						);
					}
					const item = C.Appearance.find(
						(a) => a.Asset.Group?.Name === C.FocusGroup?.Name
					);
					if (prioritySubscreen) {
						if (!item) {
							throw new Error("focus item is not defined in layering menu");
						}
						prioritySubscreenClick(C, item);
						return null;
					} else if (
						MouseIn(110, 70, 52, 52) &&
						CharacterAppearanceMode === "Cloth" &&
						assetVisible(C, item)
					) {
						if (!item) {
							throw new Error("focus item is not defined in layering menu");
						}
						prioritySubscreenEnter(C, item);
					}
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"DialogDraw",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof DialogDraw>} args
			 */
			(args, next) => {
				const C = CharacterGetCurrent();
				const ret = next(args);
				if (
					DialogMenuMode === "items" &&
					isCharacter(C) &&
					canAccessLayeringMenus()
				) {
					if (!C.FocusGroup) {
						throw new Error("layering button not guarded behind C.FocusGroup");
					}
					const focusItem = InventoryGet(C, C.FocusGroup.Name);
					if (assetWorn(C, focusItem)) {
						if (!focusItem) {
							throw new Error(
								"layering button not guarded behind focus being on a worn item"
							);
						}
						if (
							colorCopiableAssets.includes(focusItem.Asset.Name) &&
							Player.CanInteract()
						) {
							DrawButton(
								10,
								832,
								52,
								52,
								"",
								"White",
								ICONS.PAINTBRUSH,
								displayText(`Copy colors to other $Item`, {
									$Item: focusItem.Asset.Description.toLowerCase(),
								})
							);
						}
					}
					if (assetVisible(C, focusItem)) {
						DrawButton(
							10,
							948,
							52,
							52,
							"",
							"White",
							ICONS.LAYERS,
							displayText("Modify layering priority")
						);
					}
				}
				return ret;
			}
		);

		/**
		 * @returns {[number, number, number, number]}
		 */
		function priorityAcceptButtonPosition() {
			return advancedPriorities ? [1715, 75, 90, 90] : [900, 280, 90, 90];
		}

		function hideAllLayerElements() {
			const layerNames = Object.keys(layerPriorities);
			for (let i = 0; i < layerNames.length; i++) {
				ElementPosition(layerElement(layerNames[i]), -1000, -1000, 0, 0);
			}
		}

		const layersPerColumn = 10;
		const layersPerPage = layersPerColumn * 2;
		function prioritySubscreenDraw() {
			DrawCharacter(preview, 1300, 100, 0.9, false);

			const layerNames = Object.keys(layerPriorities);
			if (layerNames.length > 0) {
				DrawCheckbox(100, 50, 64, 64, "", advancedPriorities, false, "White");
				drawTextFitLeft(
					displayText("Adjust individual layers"),
					174,
					82,
					400,
					"White",
					"Black"
				);
			}
			if (advancedPriorities) {
				DrawButton(1815, 180, 90, 90, "", "White", "Icons/Next.png");
				drawTextFitLeft(
					`${layerPage + 1} / ${Math.ceil(layerNames.length / layersPerPage)}`,
					1715,
					235,
					90,
					"White",
					"Black"
				);
				ElementPosition(layerPriority, -1000, -1000, 0, 0);
				for (let i = 0; i < layersPerPage && i < layerNames.length; i++) {
					const layerName = layerNames[i + layerPage * layersPerPage];
					const x = 200 + Math.floor(i / layersPerColumn) * 500,
						y = 160 + (i % layersPerColumn) * 70;
					ElementPosition(layerElement(layerName), x, y, 100);
					drawTextFitLeft(layerName, x + 50, y, 400, "White", "Black");
				}
			} else {
				// Localization guide: valid options for priorityField can be seen in the "const FIELDS" object above
				DrawText(displayText(`Set item priority`), 950, 150, "White", "Black");
				ElementPosition(layerPriority, 950, 230, 100);
				hideAllLayerElements();
			}
			DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png");
			DrawButton(
				...priorityAcceptButtonPosition(),
				"",
				"White",
				"Icons/Accept.png",
				// Localization guide: valid options for priorityField can be seen in the "const FIELDS" object above
				displayText(`Set priority`)
			);
		}

		/**
		 * @param {Character} C
		 * @param {Item} focusItem
		 */
		function prioritySubscreenClick(C, focusItem) {
			if (MouseIn(100, 50, 64, 64)) {
				advancedPriorities = !advancedPriorities;
			} else if (MouseIn(1815, 75, 90, 90)) {
				prioritySubscreenExit();
			} else if (MouseIn(...priorityAcceptButtonPosition())) {
				savePrioritySubscreenChanges(C, focusItem);
			} else if (advancedPriorities && MouseIn(1815, 180, 90, 90)) {
				layerPage++;
				if (layerPage * layersPerPage >= Object.keys(layerPriorities).length) {
					layerPage = 0;
				}
				hideAllLayerElements();
			}
		}

		SDK.hookFunction(
			"DialogDraw",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof DialogDraw>} args
			 */
			(args, next) => {
				const C = CharacterGetCurrent();
				if (!C) {
					throw new Error("CharacterGetCurrent is not defined in DialogDraw");
				}
				const focusItem = C.FocusGroup
					? InventoryGet(C, C.FocusGroup.Name)
					: null;
				if (prioritySubscreen) {
					if (canAccessLayeringMenus()) {
						if (focusItem) {
							prioritySubscreenDraw();
							return null;
						}
						prioritySubscreenExit();
					} else {
						prioritySubscreenExit();
					}
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"DialogClick",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof DialogClick>} args
			 */
			(args, next) => {
				if (!canAccessLayeringMenus()) {
					return next(args);
				}
				const C = CharacterGetCurrent();
				if (!C) {
					throw new Error("CharacterGetCurrent is not defined in DialogClick");
				}
				const focusItem = C.FocusGroup
					? InventoryGet(C, C.FocusGroup.Name)
					: null;
				if (focusItem) {
					if (prioritySubscreen) {
						prioritySubscreenClick(C, focusItem);
						return null;
					}
					if (assetVisible(C, focusItem) && MouseIn(10, 948, 52, 52)) {
						prioritySubscreenEnter(C, focusItem);
						return null;
					} else if (
						assetWorn(C, focusItem) &&
						MouseIn(10, 832, 52, 52) &&
						colorCopiableAssets.includes(focusItem.Asset.Name) &&
						Player.CanInteract()
					) {
						copyColors(C, focusItem);
						return null;
					}
				}
				return next(args);
			}
		);

		/** @type {(C: Character, focusItem: Item) => void} */
		function copyColors(C, focusItem) {
			for (const item of C.Appearance) {
				copyColorTo(item);
			}
			if (CurrentScreen === "ChatRoom") {
				ChatRoomCharacterUpdate(C);
				fbcSendAction(
					displayText(
						"$TargetName's $ItemName colors spread from their $ItemGroup",
						{
							$TargetName: CharacterNickname(C),
							$ItemName: focusItem.Asset.Description.toLowerCase(),
							$ItemGroup: focusItem.Asset.Group.Description.toLowerCase(),
						}
					)
				);
			} else {
				CharacterRefresh(C);
			}

			/** @type {(item: Item) => void} */
			function copyColorTo(item) {
				if (item.Asset.Name === focusItem.Asset.Name) {
					if (Array.isArray(focusItem.Color)) {
						if (Array.isArray(item.Color)) {
							for (
								let i = 0;
								i < item.Color.length && i < focusItem.Color.length;
								i++
							) {
								item.Color[item.Color.length - (i + 1)] =
									focusItem.Color[focusItem.Color.length - (i + 1)];
							}
						} else {
							item.Color = focusItem.Color[focusItem.Color.length - 1];
						}
					} else if (Array.isArray(item.Color)) {
						for (let i = 0; i < item.Color.length; i++) {
							item.Color[i] = focusItem.Color ?? "Default";
						}
					} else {
						// Both are array
						item.Color = deepCopy(focusItem.Color);
					}
				}
			}
		}

		/** @type {(C: Character, focusItem: Item) => void} */
		function savePrioritySubscreenChanges(C, focusItem) {
			updateItemPriorityFromLayerPriorityInput(focusItem);
			debug("updated item", focusItem);
			CharacterRefresh(C, false, false);
			ChatRoomCharacterItemUpdate(C, C.FocusGroup?.Name);
			prioritySubscreenExit();
		}
	}

	function cacheClearer() {
		const cacheClearInterval = 1 * 60 * 60 * 1000;

		w.bceClearCaches = async function () {
			const start = Date.now();
			if (
				!(await waitFor(
					// Only clear when in chat room and not inspecting a character
					() => CurrentScreen === "ChatRoom" && !CurrentCharacter,
					() => Date.now() - start > cacheClearInterval
				))
			) {
				return;
			}
			if (!fbcSettings.automateCacheClear) {
				return;
			}

			debug("Clearing caches");
			if (GLDrawCanvas.GL?.textureCache) {
				GLDrawCanvas.GL.textureCache.clear();
			}
			GLDrawResetCanvas();

			debug("Clearing old characters from cache");
			const oldOnlineCharacters = Character.filter(
				(c) =>
					c.IsOnline?.() &&
					!ChatRoomCharacter.some((cc) => cc.MemberNumber === c.MemberNumber)
			);
			oldOnlineCharacters.forEach((c) => CharacterDelete(c));
			Character.filter((c) => c.IsOnline?.()).forEach((c) =>
				CharacterRefresh(c, false, false)
			);
		};

		const clearCaches = () => {
			if (fbcSettings.automateCacheClear) {
				w.bceClearCaches();
			}
		};

		createTimer(clearCaches, cacheClearInterval);
	}

	function chatRoomOverlay() {
		SDK.hookFunction(
			"ChatRoomDrawCharacterStatusIcons",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ChatRoomDrawCharacterStatusIcons>} args
			 */
			(args, next) => {
				const ret = next(args);
				const [C, CharX, CharY, Zoom] = args;
				if (
					isCharacter(C) &&
					typeof CharX === "number" &&
					typeof CharY === "number" &&
					typeof Zoom === "number" &&
					C.FBC &&
					ChatRoomHideIconState === 0
				) {
					const icon = ["1", "2", "3"].includes(C.FBC.split(".")[0])
						? ICONS.BCE_USER
						: ICONS.USER;
					DrawImageResize(
						icon,
						CharX + 270 * Zoom,
						CharY,
						40 * Zoom,
						40 * Zoom
					);
					DrawTextFit(
						/^\d+\.\d+(\.\d+)?$/u.test(C.FBC) ? C.FBC : "",
						CharX + 290 * Zoom,
						CharY + 30 * Zoom,
						40 * Zoom,
						C.FBCNoteExists ? "Cyan" : "White",
						"Black"
					);
				}
				return ret;
			}
		);
	}

	/** @type {(target?: number | null, requestReply?: boolean) => void} */
	function sendHello(target = null, requestReply = false) {
		if (!settingsLoaded()) {
			// Don't send hello until settings are loaded
			return;
		}
		if (!ServerIsConnected || !ServerPlayerIsInChatRoom()) {
			// Don't send hello if not in chat room
			return;
		}
		/** @type {ServerChatRoomMessage} */
		const message = {
			Type: HIDDEN,
			Content: BCE_MSG,
			Sender: Player.MemberNumber,
			Dictionary: [],
		};
		/** @type {FBCDictionaryEntry} */
		const fbcMessage = {
			message: {
				type: MESSAGE_TYPES.Hello,
				version: FBC_VERSION,
				alternateArousal: !!fbcSettings.alternateArousal,
				replyRequested: requestReply,
				capabilities: CAPABILITIES,
				blockAntiGarble: blockAntiGarble(),
			},
		};
		if (target) {
			message.Target = target;
		}
		if (fbcSettings.alternateArousal) {
			fbcMessage.message.progress =
				Player.BCEArousalProgress || Player.ArousalSettings?.Progress || 0;
			fbcMessage.message.enjoyment = Player.BCEEnjoyment || 1;
		}
		if (fbcSettings.shareAddons) {
			fbcMessage.message.otherAddons = bcModSdk.getModsInfo();
		}

		// @ts-ignore - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
		message.Dictionary.push(fbcMessage);

		ServerSend("ChatRoomChat", message);
	}
	if (ServerIsConnected && ServerPlayerIsInChatRoom()) {
		sendHello(null, true);
	}
	createTimer(() => {
		const loadedAddons = bcModSdk.getModsInfo();
		if (
			fbcSettings.shareAddons &&
			JSON.stringify(loadedAddons) !== JSON.stringify(Player.FBCOtherAddons) &&
			ServerIsConnected &&
			ServerPlayerIsInChatRoom()
		) {
			Player.FBCOtherAddons = loadedAddons;
			sendHello(null, true);
		}
	}, 5000);

	async function hiddenMessageHandler() {
		await waitFor(() => ServerSocket && ServerIsConnected);

		/**
		 * @param {ServerChatRoomMessage} data
		 */
		function parseBCEMessage(data) {
			/** @type {Partial<BCEMessage>} */
			let message = {};
			if (Array.isArray(data.Dictionary)) {
				const dict = /** @type {FBCDictionaryEntry[]} */ (
					/** @type {unknown} */ (data.Dictionary)
				);
				message = dict?.find((t) => t.message)?.message || message;
			} else {
				const dict = /** @type {FBCDictionaryEntry} */ (
					/** @type {unknown} */ (data.Dictionary)
				);
				message = dict?.message || message;
			}
			return message;
		}

		/**
		 * @param {Character} sender
		 * @param {Partial<BCEMessage>} message
		 * @param {boolean} [deferred]
		 */
		function processBCEMessage(sender, message, deferred = false) {
			debug(
				"Processing BCE message",
				sender,
				message,
				deferred ? "(deferred)" : ""
			);
			if (!sender?.ArousalSettings && !deferred) {
				/**
				 * FBC's socket listener may in some cases run before the game's socket listener initializes the character
				 * This is an attempt to fix the issue by ensuring the message gets processed at the end of the current
				 * event loop.
				 */
				logWarn(
					"No arousal settings found for",
					sender,
					"; deferring execution to microtask."
				);
				queueMicrotask(() => {
					processBCEMessage(sender, message, true);
				});
				return;
			}

			if (!sender?.ArousalSettings) {
				logWarn("No arousal settings found for", sender);
			}

			switch (message.type) {
				case MESSAGE_TYPES.Hello:
					processHello(sender, message);
					break;
				case MESSAGE_TYPES.ArousalSync:
					sender.BCEArousal = message.alternateArousal || false;
					sender.BCEArousalProgress = message.progress || 0;
					sender.BCEEnjoyment = message.enjoyment || 1;
					break;
				case MESSAGE_TYPES.Activity:
					// Sender is owner and player is not already wearing a club slave collar
					if (
						sender.MemberNumber === Player.Ownership?.MemberNumber &&
						!Player.Appearance.some((a) => a.Asset.Name === "ClubSlaveCollar")
					) {
						bceStartClubSlave();
					}
					break;
				default:
					break;
			}
		}

		/**
		 * @param {Character} sender
		 * @param {Partial<BCEMessage>} message
		 */
		function processHello(sender, message) {
			sender.FBC = message.version ?? "0.0";
			sender.BCEArousal = message.alternateArousal || false;
			sender.BCEArousalProgress =
				message.progress || sender.ArousalSettings?.Progress || 0;
			sender.BCEEnjoyment = message.enjoyment || 1;
			sender.BCECapabilities = message.capabilities ?? [];
			sender.BCEBlockAntiGarble = message.blockAntiGarble ?? false;
			if (message.replyRequested) {
				sendHello(sender.MemberNumber);
			}
			sender.FBCOtherAddons = message.otherAddons;
		}

		registerSocketListener(
			"ChatRoomMessage",
			// eslint-disable-next-line complexity
			(data) => {
				if (data.Type !== HIDDEN) {
					return;
				}
				if (data.Content === "BCEMsg") {
					const sender = Character.find((a) => a.MemberNumber === data.Sender);
					if (!sender) {
						return;
					}
					const message = parseBCEMessage(data);
					processBCEMessage(sender, message);
				}
			}
		);

		registerSocketListener("ChatRoomSyncMemberJoin", (data) => {
			if (data.SourceMemberNumber !== Player.MemberNumber) {
				sendHello(data.SourceMemberNumber);
			}
		});

		registerSocketListener("ChatRoomSync", () => {
			sendHello();
		});
	}

	async function privateWardrobe() {
		await waitFor(() => !!Player);

		let inCustomWardrobe = false,
			/** @type {Character | null} */
			targetCharacter = null;

		/** @type {string | null} */
		let appearanceBackup = null;

		let excludeBodyparts = false;

		function currentWardrobeTargetIsPlayer() {
			return (
				(inCustomWardrobe && targetCharacter?.IsPlayer()) ||
				CharacterAppearanceSelection?.IsPlayer()
			);
		}

		patchFunction(
			"DrawProcess",
			{
				'CurrentScreen !== "Crafting"':
					'CurrentScreen !== "Crafting" && CurrentScreen !== "Wardrobe"',
			},
			"Full wardrobe may display blur and blindness effects of the target character"
		);

		SDK.hookFunction(
			"CharacterAppearanceWardrobeLoad",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof CharacterAppearanceWardrobeLoad>} args
			 */
			(args, next) => {
				const [C] = args;
				if (fbcSettings.privateWardrobe && CurrentScreen === "Appearance") {
					inCustomWardrobe = true;
					targetCharacter = isCharacter(C) ? C : CharacterGetCurrent();
					CommonSetScreen("Character", "Wardrobe");
					return null;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"AppearanceLoad",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof AppearanceLoad>} args
			 */
			(args, next) => {
				const ret = next(args);
				if (inCustomWardrobe) {
					CharacterAppearanceBackup = appearanceBackup;
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"AppearanceRun",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof AppearanceRun>} args
			 */
			(args, next) => {
				if (
					CharacterAppearanceMode === "Wardrobe" &&
					currentWardrobeTargetIsPlayer()
				) {
					DrawCheckbox(1300, 350, 64, 64, "", excludeBodyparts, false, "white");
					drawTextFitLeft(
						displayText("Load without body parts"),
						1374,
						380,
						630,
						"white"
					);
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"AppearanceClick",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof AppearanceClick>} args
			 */
			(args, next) => {
				if (
					CharacterAppearanceMode === "Wardrobe" &&
					MouseIn(1300, 350, 64, 64) &&
					currentWardrobeTargetIsPlayer()
				) {
					excludeBodyparts = !excludeBodyparts;
					return null;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"WardrobeLoad",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof WardrobeLoad>} args
			 */
			(args, next) => {
				appearanceBackup = CharacterAppearanceBackup;
				return next(args);
			}
		);

		SDK.hookFunction(
			"WardrobeRun",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof WardrobeRun>} args
			 */
			(args, next) => {
				const playerBackup = Player;
				// Replace Player with target character in rendering
				if (inCustomWardrobe) {
					// @ts-ignore - explicitly overriding with another Character temporarily
					Player = targetCharacter;
				}
				const ret = next(args);
				if (inCustomWardrobe) {
					Player = playerBackup;
				}
				DrawText(
					`Page: ${((WardrobeOffset / 12) | 0) + 1}/${WardrobeSize / 12}`,
					300,
					35,
					"White"
				);
				DrawCheckbox(10, 74, 64, 64, "", excludeBodyparts, false, "white");
				drawTextFitLeft(
					displayText("Exclude body parts"),
					84,
					106,
					300,
					"white"
				);
				return ret;
			}
		);

		SDK.hookFunction(
			"WardrobeClick",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof WardrobeClick>} args
			 */
			(args, next) => {
				if (MouseIn(10, 74, 64, 64)) {
					excludeBodyparts = !excludeBodyparts;
					return null;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"WardrobeExit",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof WardrobeExit>} args
			 */
			(args, next) => {
				if (!inCustomWardrobe) {
					return next(args);
				}
				CommonSetScreen("Character", "Appearance");
				inCustomWardrobe = false;
				return null;
			}
		);

		SDK.hookFunction(
			"WardrobeFastLoad",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof WardrobeFastLoad>} args
			 */
			(args, next) => {
				let [C] = args;
				const base = C.Appearance.filter(
					(a) => a.Asset.Group.IsDefault && !a.Asset.Group.Clothing
				);
				if (inCustomWardrobe && isCharacter(C) && C.IsPlayer()) {
					if (!targetCharacter) {
						throw new Error(
							"targetCharacter is not defined in WardrobeFastLoad"
						);
					}
					args[0] = targetCharacter;
					C = targetCharacter;
					args[2] = false;
				}
				const ret = next(args);
				if (excludeBodyparts) {
					C.Appearance = [
						...base,
						...C.Appearance.filter(
							(a) => !a.Asset.Group.IsDefault || a.Asset.Group.Clothing
						),
					];
					CharacterLoadCanvas(C);
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"WardrobeFastSave",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof WardrobeFastSave>} args
			 */
			(args, next) => {
				const [C] = args;
				if (inCustomWardrobe && isCharacter(C) && C.IsPlayer()) {
					if (!targetCharacter) {
						throw new Error(
							"targetCharacter is not defined in WardrobeFastSave"
						);
					}
					args[0] = targetCharacter;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"ServerPlayerIsInChatRoom",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ServerPlayerIsInChatRoom>} args
			 */
			(args, next) =>
				(inCustomWardrobe && CharacterAppearanceReturnRoom === "ChatRoom") ||
				next(args)
		);

		/** @type {(e: KeyboardEvent) => void} */
		function keyHandler(e) {
			if (!fbcSettings.privateWardrobe) {
				return;
			}
			if (e.key === "Escape" && inCustomWardrobe) {
				WardrobeExit();
				e.stopPropagation();
				e.preventDefault();
			}
		}

		document.addEventListener("keydown", keyHandler, true);
		document.addEventListener("keypress", keyHandler, true);
	}

	async function antiGarbling() {
		await waitFor(() => !!SpeechGarbleByGagLevel);

		/**
		 * @param {Character} c
		 */
		function allowedToUngarble(c) {
			return (
				c.IsNpc() ||
				(c.BCECapabilities?.includes("antigarble") &&
					c.BCEBlockAntiGarble === false)
			);
		}

		ChatRoomRegisterMessageHandler({
			Priority: 1,
			Description: "Anti-garbling by FBC",
			Callback: (data, sender, msg) => {
				const clientGagged = msg.endsWith(GAGBYPASSINDICATOR);
				msg = msg.replace(/[\uf123-\uf124]/gu, "");
				let handled = clientGagged;
				if (
					fbcSettings.gagspeak &&
					!clientGagged &&
					allowedToUngarble(sender)
				) {
					switch (data.Type) {
						case "Whisper":
							{
								let original = msg;
								if (
									// @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
									data.Dictionary?.some((d) => d.Tag === BCX_ORIGINAL_MESSAGE)
								) {
									const tag = data.Dictionary.find(
										// @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
										(d) => d.Tag === BCX_ORIGINAL_MESSAGE
									);
									// @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
									// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
									const text = /** @type {string} */ (tag.Text);
									original = ChatRoomHTMLEntities(text);
								}
								if (
									original.toLowerCase().trim() !== msg.toLowerCase().trim()
								) {
									msg += ` (${original})`;
									handled = true;
								}
							}
							break;
						case "Chat":
							{
								const original = msg;
								msg = SpeechGarble(sender, msg);
								if (
									original.toLowerCase().trim() !== msg.toLowerCase().trim() &&
									SpeechGetTotalGagLevel(sender) > 0
								) {
									msg += ` (${original})`;
									handled = true;
								}
							}
							break;
						default:
							break;
					}
				}

				const skip = (
					/** @type {ChatRoomMessageHandler} */
					handler
				) =>
					handler.Description === "Sensory-deprivation processing" &&
					!!fbcSettings.gagspeak &&
					handled;
				return { skip, msg };
			},
		});

		// ServerSend hook for client-side gagspeak, priority lower than BCX's whisper dictionary hook
		SDK.hookFunction(
			"ServerSend",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof ServerSend>} args
			 */ (args, next) => {
				if (args.length < 2) {
					return next(args);
				}
				const [message, /** @type {unknown} */ data] = args;
				if (!isString(message) || !isChatMessage(data)) {
					return next(args);
				}
				if (message === "ChatRoomChat") {
					switch (data.Type) {
						case "Whisper":
							{
								const idx =
									data.Dictionary?.findIndex(
										// @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
										(d) => d.Tag === BCX_ORIGINAL_MESSAGE
									) ?? -1;
								if (
									idx >= 0 &&
									(fbcSettings.antiAntiGarble ||
										fbcSettings.antiAntiGarbleStrong ||
										fbcSettings.antiAntiGarbleExtra)
								) {
									data.Dictionary?.splice(idx, 1);
								}
							}
							break;
						case "Chat":
							{
								const gagLevel = SpeechGetTotalGagLevel(Player);
								if (gagLevel > 0) {
									if (fbcSettings.antiAntiGarble) {
										data.Content =
											SpeechGarbleByGagLevel(1, data.Content) +
											GAGBYPASSINDICATOR;
									} else if (fbcSettings.antiAntiGarbleExtra && gagLevel > 24) {
										const icIndicator = "\uF124";
										let inOOC = false;
										data.Content = `${data.Content.split("")
											.map((c) => {
												switch (c) {
													case "(":
														inOOC = true;
														return c;
													case ")":
														inOOC = false;
														return c;
													default:
														return inOOC ? c : icIndicator;
												}
											})
											.join("")
											.replace(
												new RegExp(`${icIndicator}+`, "gu"),
												"m"
											)}${GAGBYPASSINDICATOR}`;
									} else if (
										fbcSettings.antiAntiGarbleStrong ||
										fbcSettings.antiAntiGarbleExtra
									) {
										data.Content =
											SpeechGarbleByGagLevel(gagLevel, data.Content) +
											GAGBYPASSINDICATOR;
									}
								}
							}
							break;
						default:
							break;
					}
				}
				return next([message, data]);
			}
		);

		// X, Y, width, height. X and Y centered.
		const gagAntiCheatMenuPosition = /** @type {const} */ ([
				1700, 908, 200, 45,
			]),
			/** @type {[number, number, number, number]} */
			gagCheatMenuPosition = [1700, 908 + 45, 200, 45],
			tooltipPosition = { X: 1000, Y: 910, Width: 200, Height: 90 };

		SDK.hookFunction(
			"ChatRoomRun",
			HOOK_PRIORITIES.ModifyBehaviourHigh,
			/**
			 * @param {Parameters<typeof ChatRoomRun>} args
			 */
			(args, nextFunc) => {
				const ret = nextFunc(args);

				if (w.InputChat) {
					/** @type {() => boolean} */
					const isWhispering = () =>
						w.InputChat?.value.startsWith("/w ") ||
						w.InputChat?.value.startsWith("/whisper ") ||
						!!w.ChatRoomTargetMemberNumber;
					if (
						w.InputChat?.classList.contains(WHISPER_CLASS) &&
						!isWhispering()
					) {
						w.InputChat.classList.remove(WHISPER_CLASS);
					} else if (fbcSettings.whisperInput && isWhispering()) {
						w.InputChat?.classList.add(WHISPER_CLASS);
					}
					if (Player.ChatSettings?.ColorTheme?.startsWith("Dark")) {
						if (!w.InputChat.classList.contains(DARK_INPUT_CLASS)) {
							w.InputChat.classList.add(DARK_INPUT_CLASS);
						}
					} else if (w.InputChat.classList.contains(DARK_INPUT_CLASS)) {
						w.InputChat.classList.remove(DARK_INPUT_CLASS);
					}
				}

				if (!fbcSettings.showQuickAntiGarble || fbcSettings.discreetMode) {
					return ret;
				}
				const shorttip = displayText("Gagging"),
					tooltip = displayText("Antigarble anti-cheat strength");

				let color = "white",
					label = "None";

				const disableBoth = () => displayText("$tip: None", { $tip: tooltip }),
					enableLimited = () => displayText("$tip: Limited", { $tip: tooltip }),
					enableStrong = () => displayText("$tip: Full", { $tip: tooltip }),
					// eslint-disable-next-line sort-vars
					enableExtra = () => displayText("$tip: Extra", { $tip: tooltip });

				let next = enableLimited,
					previous = enableExtra;

				if (fbcSettings.antiAntiGarble) {
					color = "yellow";
					label = "Limited";
					next = enableStrong;
					previous = disableBoth;
				} else if (fbcSettings.antiAntiGarbleStrong) {
					color = "red";
					label = "Full";
					next = enableExtra;
					previous = enableLimited;
				} else if (fbcSettings.antiAntiGarbleExtra) {
					color = "purple";
					label = "Extra";
					next = disableBoth;
					previous = enableStrong;
				}
				DrawBackNextButton(
					...gagAntiCheatMenuPosition,
					// Localization guide: ignore, covered by localizing the arrow functions above
					displayText(`$tip: ${label}`, { $tip: shorttip }),
					color,
					"",
					previous,
					next,
					// eslint-disable-next-line no-undefined
					undefined,
					// eslint-disable-next-line no-undefined
					undefined,
					// @ts-ignore - patched to accept extra params
					tooltipPosition
				);

				/** @type {[string, string, string, () => string, () => string, boolean?, number?, Position?]} */
				const gagCheatMenuParams = fbcSettings.gagspeak
					? [
							displayText("Understand: Yes"),
							"green",
							"",
							() => displayText("Understand gagspeak: No"),
							() => displayText("Understand gagspeak: No"),
							// eslint-disable-next-line no-undefined
							undefined,
							// eslint-disable-next-line no-undefined
							undefined,
							tooltipPosition,
					  ]
					: [
							"Understand: No",
							"white",
							"",
							() => displayText("Understand gagspeak: Yes"),
							() => displayText("Understand gagspeak: Yes"),
							// eslint-disable-next-line no-undefined
							undefined,
							// eslint-disable-next-line no-undefined
							undefined,
							tooltipPosition,
					  ];
				// @ts-ignore - patched to accept extra params
				DrawBackNextButton(...gagCheatMenuPosition, ...gagCheatMenuParams);

				return ret;
			}
		);

		SDK.hookFunction(
			"ChatRoomClick",
			HOOK_PRIORITIES.ModifyBehaviourHigh,
			/**
			 * @param {Parameters<typeof ChatRoomClick>} args
			 */
			(args, nextFunc) => {
				if (fbcSettings.showQuickAntiGarble && !fbcSettings.discreetMode) {
					if (MouseIn(...gagAntiCheatMenuPosition)) {
						const disableAll = () => {
								fbcSettings.antiAntiGarble = false;
								fbcSettings.antiAntiGarbleStrong = false;
								fbcSettings.antiAntiGarbleExtra = false;
								defaultSettings.antiAntiGarble.sideEffects(false);
								defaultSettings.antiAntiGarbleStrong.sideEffects(false);
								defaultSettings.antiAntiGarbleExtra.sideEffects(false);
							},
							enableLimited = () => {
								fbcSettings.antiAntiGarble = true;
								defaultSettings.antiAntiGarble.sideEffects(true);
							},
							enableStrong = () => {
								fbcSettings.antiAntiGarbleStrong = true;
								defaultSettings.antiAntiGarbleStrong.sideEffects(true);
							},
							// eslint-disable-next-line sort-vars
							enableExtra = () => {
								fbcSettings.antiAntiGarbleExtra = true;
								defaultSettings.antiAntiGarbleExtra.sideEffects(true);
							};
						let next = enableLimited,
							previous = enableExtra;
						if (fbcSettings.antiAntiGarble) {
							next = enableStrong;
							previous = disableAll;
						} else if (fbcSettings.antiAntiGarbleStrong) {
							next = enableExtra;
							previous = enableLimited;
						} else if (fbcSettings.antiAntiGarbleExtra) {
							next = disableAll;
							previous = enableStrong;
						}
						if (
							MouseX <
							gagAntiCheatMenuPosition[0] + gagAntiCheatMenuPosition[2] / 2
						) {
							previous();
							bceSaveSettings();
						} else {
							next();
							bceSaveSettings();
						}
					} else if (MouseIn(...gagCheatMenuPosition)) {
						fbcSettings.gagspeak = !fbcSettings.gagspeak;
						defaultSettings.gagspeak.sideEffects(fbcSettings.gagspeak);
						bceSaveSettings();
					}
				}
				return nextFunc(args);
			}
		);

		if (CurrentScreen === "ChatRoom") {
			CurrentScreenFunctions.Run = ChatRoomRun;
			CurrentScreenFunctions.Click = ChatRoomClick;
			CurrentScreenFunctions.Resize = ChatRoomResize;
			ChatRoomResize(false);
		}
	}

	async function alternateArousal() {
		await waitFor(() => !!ServerSocket && ServerIsConnected);

		Player.BCEArousalProgress = Math.min(
			BCE_MAX_AROUSAL,
			Player.ArousalSettings?.Progress ?? 0
		);
		Player.BCEEnjoyment = 1;
		const enjoymentMultiplier = 0.2;

		registerSocketListener(
			"ChatRoomSyncArousal",
			(
				/** @type {{ MemberNumber: number; Progress: number; }} */
				data
			) => {
				if (data.MemberNumber === Player.MemberNumber) {
					// Skip player's own sync messages since we're tracking locally
					return;
				}

				const target = ChatRoomCharacter.find(
					(c) => c.MemberNumber === data.MemberNumber
				);

				if (!target) {
					return;
				}

				queueMicrotask(() => {
					target.BCEArousalProgress = Math.min(
						BCE_MAX_AROUSAL,
						data.Progress || 0
					);

					if (!target?.ArousalSettings) {
						logWarn("No arousal settings found for", target);
						return;
					}

					target.ArousalSettings.Progress = Math.round(
						target.BCEArousalProgress
					);
				});
			}
		);

		patchFunction(
			"ActivitySetArousalTimer",
			{
				"if (Progress > 0 && (C.ArousalSettings.Progress + Progress) > Max)\n\t\tProgress = (Max - C.ArousalSettings.Progress >= 0) ? Max - C.ArousalSettings.Progress : 0;": `
				if (!C.BCEArousal) {
					if ((Progress > 0) && (C.ArousalSettings.Progress + Progress > Max)) Progress = (Max - C.ArousalSettings.Progress >= 0) ? Max - C.ArousalSettings.Progress : 0;
				} else {
					if (Max === 100) Max = 105;
					const fromMax = Max - (C.BCEArousal ? C.BCEArousalProgress : C.ArousalSettings.Progress);
					if (Progress > 0 && fromMax < Progress) {
						if (fromMax <= 0) {
							Progress = 0;
						} else if (C.BCEArousal) {
							Progress = Math.floor(fromMax / ${enjoymentMultiplier} / (C.BCEEnjoyment || 1));
						} else {
							Progress = fromMax;
						}
					}
				}
			`,

				"if (Progress < -25) Progress = -25;": `
				if (!C.BCEArousal) {
					if (Progress < -25) Progress = -25;
				} else {
					if (Progress < -20) Progress = -20;
				}
				`,

				"if (Progress > 25) Progress = 25;": `
				if (!C.BCEArousal) {
					if (Progress > 25) Progress = 25;
				} else {
					if (Progress > 20) Progress = 20;
				}
				`,
			},
			"Alternate arousal algorithm will be incorrect."
		);

		SDK.hookFunction(
			"ActivityChatRoomArousalSync",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof ActivityChatRoomArousalSync>} args
			 */
			(args, next) => {
				const [C] = args;
				if (isCharacter(C) && C.IsPlayer() && CurrentScreen === "ChatRoom") {
					/** @type {ServerChatRoomMessage} */
					const message = {
						Type: HIDDEN,
						Content: BCE_MSG,
						Dictionary: [
							{
								// @ts-ignore - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
								message: {
									type: MESSAGE_TYPES.ArousalSync,
									version: FBC_VERSION,
									alternateArousal: fbcSettings.alternateArousal,
									progress: C.BCEArousalProgress,
									enjoyment: C.BCEEnjoyment,
								},
							},
						],
					};
					ServerSend("ChatRoomChat", message);
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"ActivitySetArousal",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ActivitySetArousal>} args
			 */
			(args, next) => {
				const [C, Progress] = args;
				const ret = next(args);
				if (
					isCharacter(C) &&
					typeof Progress === "number" &&
					Math.abs(C.BCEArousalProgress - Progress) > 3
				) {
					C.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, Progress);
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"ActivitySetArousalTimer",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ActivitySetArousalTimer>} args
			 */
			(args, next) => {
				const [C, , , Factor] = args;
				if (isCharacter(C) && typeof Factor === "number") {
					C.BCEEnjoyment = 1 + (Factor > 1 ? Math.round(Math.log2(Factor)) : 0);
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"ActivityTimerProgress",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ActivityTimerProgress>} args
			 */
			(args, next) => {
				const [C, progress] = args;
				if (isCharacter(C) && typeof progress === "number") {
					if (!C.BCEArousalProgress) {
						C.BCEArousalProgress = 0;
					}
					if (!C.BCEEnjoyment) {
						C.BCEEnjoyment = 1;
					}
					C.BCEArousalProgress +=
						progress *
						(progress > 0 ? C.BCEEnjoyment * enjoymentMultiplier : 1);
					C.BCEArousalProgress = Math.min(
						BCE_MAX_AROUSAL,
						C.BCEArousalProgress
					);
					if (C.BCEArousal) {
						if (!C.ArousalSettings) {
							throw new Error(`No arousal settings found for ${C.Name}`);
						}
						C.ArousalSettings.Progress = Math.round(C.BCEArousalProgress);
						args[1] = 0;
						return next(args);
					}
				}
				return next(args);
			}
		);

		patchFunction(
			"TimerProcess",
			{
				"// If the character is egged, we find the highest intensity factor and affect the progress, low and medium vibrations have a cap\n\t\t\t\t\t\t\tlet Factor = -1;": `
				let Factor = -1;
				if (Character[C].BCEArousal) {
					let maxIntensity = 0;
					let vibes = 0;
					let noOrgasmVibes = 0;
					for (let A = 0; A < Character[C].Appearance.length; A++) {
						let Item = Character[C].Appearance[A];
						let ZoneFactor = PreferenceGetZoneFactor(Character[C], Item.Asset.ArousalZone) - 2;
						if (InventoryItemHasEffect(Item, "Egged", true) && typeof Item.Property?.Intensity === "number" && !isNaN(Item.Property.Intensity) && Item.Property.Intensity >= 0 && ZoneFactor >= 0) {
							if (Item.Property.Intensity >= 0) {
								vibes++;
								if (!PreferenceGetZoneOrgasm(Character[C], Item.Asset.ArousalZone)) {
									noOrgasmVibes++;
								}
								maxIntensity = Math.max(Item.Property.Intensity, maxIntensity);
								Factor += Item.Property.Intensity + ZoneFactor + 1;
							}
						}
					}
					// Adds the fetish value to the factor
					if (Factor >= 0) {
						var Fetish = ActivityFetishFactor(Character[C]);
						if (Fetish > 0) Factor = Factor + Math.ceil(Fetish / 3);
						if (Fetish < 0) Factor = Factor + Math.floor(Fetish / 3);
					}

					let maxProgress = 100;
					switch (maxIntensity) {
						case 0:
							maxProgress = 40 + vibes * 5;
							break;
						case 1:
							maxProgress = 70 + vibes * 5;
							break;
						default:
							maxProgress = vibes === 0 || vibes > noOrgasmVibes ? 100 : 95;
							break;
					}
					const topStepInterval = 2;
					let stepInterval = topStepInterval;
					if (Factor < 0) {
						ActivityVibratorLevel(Character[C], 0);
					} else {
						if (Factor < 1) {
							ActivityVibratorLevel(Character[C], 1);
							maxProgress = Math.min(maxProgress, 35);
							stepInterval = 5;
						} else if (Factor < 2) {
							ActivityVibratorLevel(Character[C], 1);
							maxProgress = Math.min(maxProgress, 65);
							stepInterval = 4;
						} else if (Factor < 3) {
							maxProgress = Math.min(maxProgress, 95);
							stepInterval = 3;
							ActivityVibratorLevel(Character[C], 2);
						} else {
							ActivityVibratorLevel(Character[C], Math.min(4, Math.floor(Factor)));
						}
						if (maxProgress === 100) {
							maxProgress = 105;
						}
						let maxIncrease = maxProgress - Character[C].ArousalSettings.Progress;
						if (TimerLastArousalProgressCount % stepInterval === 0 && maxIncrease > 0) {
							Character[C].BCEEnjoyment = 1 + (Factor > 1 ? Math.round(1.5*Math.log2(Factor)) : 0);
							ActivityTimerProgress(Character[C], 1);
						}
					}
				} else {
				`,

				"if ((Factor == -1)) {ActivityVibratorLevel(Character[C], 0);}\n\n\t\t\t\t\t\t}": `if (Factor == -1) {
						ActivityVibratorLevel(Character[C], 0);
					}
				}
			} else {
				ActivityVibratorLevel(Character[C], 0);
			}
			`,

				"// No decay if there's a vibrating item running": `// No decay if there's a vibrating item running
			Character[C].BCEEnjoyment = 1;`,
			},
			"Alternative arousal algorithm will be incorrect."
		);
	}

	async function autoGhostBroadcast() {
		await waitFor(() => !!ServerSocket && ServerIsConnected);
		registerSocketListener("ChatRoomSyncMemberJoin", (data) => {
			if (
				fbcSettings.ghostNewUsers &&
				Date.now() - data.Character.Creation < 30000
			) {
				ChatRoomListManipulation(
					Player.BlackList,
					true,
					data.Character.MemberNumber.toString()
				);
				if (!Player.GhostList) {
					Player.GhostList = [];
				}
				ChatRoomListManipulation(
					Player.GhostList,
					true,
					data.Character.MemberNumber.toString()
				);
				debug(
					"Blacklisted",
					data.Character.Name,
					// @ts-ignore - CharacterNickname works with this too
					CharacterNickname(data.Character),
					data.Character.MemberNumber,
					"registered",
					(Date.now() - data.Character.Creation) / 1000,
					"seconds ago"
				);
			}
		});
	}

	async function blindWithoutGlasses() {
		await waitFor(() => !!Player && !!Player.Appearance);

		function checkBlindness() {
			if (!fbcSettings.blindWithoutGlasses) {
				return;
			}

			const glasses = [
					"Glasses1",
					"Glasses2",
					"Glasses3",
					"Glasses4",
					"Glasses5",
					"Glasses6",
					"SunGlasses1",
					"SunGlasses2",
					"SunGlassesClear",
					"CatGlasses",
					"VGlasses",
					"GradientSunglasses",
					"FuturisticVisor",
					"InteractiveVisor",
					"InteractiveVRHeadset",
					"FuturisticMask",
					"Goggles",
				],
				hasGlasses = !!Player.Appearance.find((a) =>
					glasses.includes(a.Asset.Name)
				);

			if (hasGlasses) {
				if (removeCustomEffect("BlurLight")) {
					fbcChatNotify(
						displayText("Having recovered your glasses you can see again!")
					);
				}
			} else if (addCustomEffect("BlurLight")) {
				fbcChatNotify(
					displayText("Having lost your glasses your eyesight is impaired!")
				);
			}
		}

		SDK.hookFunction(
			"GameRun",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof GameRun>} args
			 */ (args, next) => {
				checkBlindness();
				return next(args);
			}
		);
	}

	async function friendPresenceNotifications() {
		await waitFor(() => !!Player && ServerSocket && ServerIsConnected);

		function checkFriends() {
			if (
				!fbcSettings.friendPresenceNotifications &&
				!fbcSettings.instantMessenger
			) {
				return;
			}
			if (
				CurrentScreen === "FriendList" ||
				CurrentScreen === "Relog" ||
				CurrentScreen === "Login"
			) {
				return;
			}
			ServerSend("AccountQuery", { Query: "OnlineFriends" });
		}
		createTimer(checkFriends, 20000);

		/** @type {Friend[]} */
		let lastFriends = [];
		registerSocketListener("AccountQueryResult", (data) => {
			if (
				CurrentScreen === "FriendList" ||
				CurrentScreen === "Relog" ||
				CurrentScreen === "Login"
			) {
				return;
			}
			if (!fbcSettings.friendPresenceNotifications) {
				return;
			}
			if (data.Query !== "OnlineFriends") {
				return;
			}
			const friendMemberNumbers = data.Result.map((f) => f.MemberNumber),
				offlineFriends = lastFriends
					.map((f) => f.MemberNumber)
					.filter((f) => !friendMemberNumbers.includes(f)),
				onlineFriends = friendMemberNumbers.filter(
					(f) => !lastFriends.some((ff) => ff.MemberNumber === f)
				);
			if (onlineFriends.length) {
				const list = onlineFriends
					.map((f) => {
						const { MemberNumber, MemberName } = data.Result.find(
							(d) => d.MemberNumber === f
						) ?? { MemberName: "", MemberNumber: -1 };
						return `${MemberName} (${MemberNumber})`;
					})
					.join(", ");
				if (
					fbcSettings.friendNotificationsInChat &&
					CurrentScreen === "ChatRoom"
				) {
					fbcChatNotify(displayText(`Now online: $list`, { $list: list }));
				} else {
					fbcNotify(displayText(`Now online: $list`, { $list: list }), 5000, {
						ClickAction: BEEP_CLICK_ACTIONS.FriendList,
					});
				}
			}
			if (fbcSettings.friendOfflineNotifications && offlineFriends.length) {
				const list = offlineFriends
					.map((f) => {
						const { MemberNumber, MemberName } = lastFriends.find(
							(d) => d.MemberNumber === f
						) ?? { MemberName: "", MemberNumber: -1 };
						return `${MemberName} (${MemberNumber})`;
					})
					.join(", ");
				if (
					fbcSettings.friendNotificationsInChat &&
					CurrentScreen === "ChatRoom"
				) {
					fbcChatNotify(displayText(`Now offline: $list`, { $list: list }));
				} else {
					fbcNotify(displayText(`Now offline: $list`, { $list: list }), 5000, {
						ClickAction: BEEP_CLICK_ACTIONS.FriendList,
					});
				}
			}
			lastFriends = data.Result;
		});

		SDK.hookFunction(
			"ServerClickBeep",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof ServerClickBeep>} args
			 */
			(args, next) => {
				if (
					ServerBeep.Timer > Date.now() &&
					MouseIn(CurrentScreen === "ChatRoom" ? 0 : 500, 0, 1000, 50) &&
					CurrentScreen !== "FriendList"
				) {
					// @ts-ignore - ClickAction is not in the original game, but we specify it above for ServerBeeps
					switch (ServerBeep.ClickAction) {
						case BEEP_CLICK_ACTIONS.FriendList:
							ServerOpenFriendList();
							return null;
						default:
							break;
					}
				}
				return next(args);
			}
		);
	}

	function itemAntiCheat() {
		/** @type {Map<number, number>} */
		const noticesSent = new Map();

		/** @type {(sourceCharacter: Character, newItem: ItemBundle) => boolean} */
		function validateNewLockMemberNumber(sourceCharacter, newItem) {
			if (!newItem.Name || !newItem.Property?.LockedBy) {
				return true;
			}
			if (newItem.Property?.LockMemberNumber !== sourceCharacter.MemberNumber) {
				debug(
					"Bad lock member number",
					newItem.Property?.LockMemberNumber,
					"from",
					sourceCharacter.MemberNumber
				);
				return false;
			}
			return true;
		}

		/** @type {(sourceCharacter: Character, oldItem: ItemBundle | null, newItem: ItemBundle | null, ignoreLocks: boolean, ignoreColors: boolean) => { changed: number; prohibited: boolean }} */
		function validateSingleItemChange(
			sourceCharacter,
			oldItem,
			newItem,
			ignoreLocks,
			ignoreColors
		) {
			const changes = {
				changed: 0,
				prohibited: false,
			};

			if (sourceCharacter.IsPlayer()) {
				return changes;
			}

			const sourceName = `${CharacterNickname(sourceCharacter)} (${
				sourceCharacter.MemberNumber ?? "-1"
			})`;

			/** @type {(item: ItemBundle | null) => ItemBundle | null} */
			function deleteUnneededMetaData(item) {
				if (!item) {
					return item;
				}
				const clone = deepCopy(item);
				if (!clone) {
					return clone;
				}
				if (clone.Property) {
					if (ignoreLocks) {
						delete clone.Property.LockMemberNumber;
						delete clone.Property.LockedBy;
						delete clone.Property.RemoveTimer;
						delete clone.Property.Effect;
					}
					delete clone.Property.BlinkState;
				}
				if (ignoreColors) {
					delete clone.Color;
				}
				return clone;
			}

			function validateMistressLocks() {
				const sourceCanBeMistress =
					(sourceCharacter?.Reputation?.find((a) => a.Type === "Dominant")
						?.Value ?? 0) >= 50 || sourceCharacter.Title === "Mistress";

				if (
					sourceCanBeMistress ||
					sourceCharacter.MemberNumber === Player.Ownership?.MemberNumber ||
					Player.Lovership?.some(
						(a) => a.MemberNumber === sourceCharacter.MemberNumber
					)
				) {
					return;
				}

				// Removal
				if (
					(oldItem?.Property?.LockedBy === "MistressPadlock" &&
						newItem?.Property?.LockedBy !== "MistressPadlock") ||
					(oldItem?.Property?.LockedBy === "MistressTimerPadlock" &&
						newItem?.Property?.LockedBy !== "MistressTimerPadlock")
				) {
					debug(
						"Not a mistress attempting to remove mistress lock",
						sourceName
					);
					changes.prohibited = true;
				}

				// Addition
				if (
					(oldItem?.Property?.LockedBy !== "MistressPadlock" &&
						newItem?.Property?.LockedBy === "MistressPadlock") ||
					(oldItem?.Property?.LockedBy !== "MistressTimerPadlock" &&
						newItem?.Property?.LockedBy === "MistressTimerPadlock")
				) {
					debug("Not a mistress attempting to add mistress lock", sourceName);
					changes.prohibited = true;
				}

				// Timer change
				if (
					oldItem?.Property?.LockedBy === "MistressTimerPadlock" &&
					Math.abs(
						mustNum(oldItem.Property?.RemoveTimer, Number.MAX_SAFE_INTEGER) -
							mustNum(newItem?.Property?.RemoveTimer)
					) >
						31 * 60 * 1000
				) {
					changes.prohibited = true;
					debug(
						"Not a mistress attempting to change mistress lock timer more than allowed by public entry",
						sourceName
					);
				}
			}

			// Validate lock changes
			if (
				newItem &&
				newItem.Property?.LockMemberNumber !==
					oldItem?.Property?.LockMemberNumber
			) {
				if (!validateNewLockMemberNumber(sourceCharacter, newItem)) {
					changes.prohibited = true;
				}
			}
			validateMistressLocks();

			newItem = deleteUnneededMetaData(newItem);
			oldItem = deleteUnneededMetaData(oldItem);

			if (JSON.stringify(newItem) !== JSON.stringify(oldItem)) {
				debug(
					sourceName,
					"changed",
					JSON.stringify(oldItem),
					"to",
					JSON.stringify(newItem),
					"changes:",
					changes
				);
				changes.changed++;
			}
			return changes;
		}

		/** @type {(sourceCharacter: Character) => void} */
		function revertChanges(sourceCharacter) {
			if (typeof sourceCharacter.MemberNumber !== "number") {
				throw new Error(
					"change from invalid source character with no member number"
				);
			}

			const sourceName = `${CharacterNickname(sourceCharacter)} (${
				sourceCharacter.MemberNumber ?? "-1"
			})`;
			debug("Rejected changes from", sourceName);
			fbcChatNotify(
				displayText(
					`[Anti-Cheat] ${sourceName} tried to make suspicious changes! Appearance changes rejected. Consider telling the user to stop, whitelisting the user (if trusted friend), or blacklisting the user (if the behaviour continues, chat command: "/blacklistadd ${sourceCharacter.MemberNumber}").`
				)
			);

			const noticeSent = noticesSent.get(sourceCharacter.MemberNumber) || 0;
			if (Date.now() - noticeSent > 1000 * 60 * 10) {
				noticesSent.set(sourceCharacter.MemberNumber, Date.now());
				fbcSendAction(
					displayText(
						`A magical shield on ${CharacterNickname(
							Player
						)} repelled the suspiciously magical changes attempted by ${sourceName}! [FBC Anti-Cheat]`
					)
				);
			}
			if (
				fbcSettings.antiCheatBlackList &&
				!Player.WhiteList.includes(sourceCharacter.MemberNumber) &&
				!Player.BlackList.includes(sourceCharacter.MemberNumber)
			) {
				ChatRoomListManipulation(
					Player.BlackList,
					true,
					sourceCharacter.MemberNumber.toString()
				);
				fbcChatNotify(displayText(`[AntiCheat] ${sourceName} blacklisted.`));
			}
			ChatRoomCharacterUpdate(Player);
		}

		SDK.hookFunction(
			"ChatRoomSyncItem",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof ChatRoomSyncItem>} args
			 */
			(args, next) => {
				const [data] = args;
				if (!fbcSettings.itemAntiCheat) {
					return next(args);
				}
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const item = /** @type {{ Target: number; } & ItemBundle} */ (
					data?.Item
				);
				if (item?.Target !== Player.MemberNumber) {
					return next(args);
				}
				if (Player.WhiteList.includes(data.Source)) {
					return next(args);
				}
				const sourceCharacter =
					ChatRoomCharacter.find((a) => a.MemberNumber === data.Source) ||
					(data.Source === Player.MemberNumber ? Player : null);

				if (!sourceCharacter) {
					throw new Error(
						"change from invalid source character not in the current room"
					);
				}

				const ignoreLocks = Player.Appearance.some(
					(a) => a.Asset.Name === "FuturisticCollar"
				);
				const ignoreColors =
					Player.Appearance.some((a) => a.Asset.Name === "FuturisticHarness") ||
					ignoreLocks;
				const oldItem = Player.Appearance.find(
					(i) => i.Asset.Group.Name === item.Group
				);
				const oldItemBundle = oldItem
					? ServerAppearanceBundle([oldItem])[0]
					: null;
				const result = validateSingleItemChange(
					sourceCharacter,
					oldItemBundle,
					item,
					ignoreLocks,
					ignoreColors
				);
				if (result.prohibited) {
					revertChanges(sourceCharacter);
					return null;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"ChatRoomSyncSingle",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof ChatRoomSyncSingle>} args
			 */
			(args, next) => {
				const [data] = args;
				if (!fbcSettings.itemAntiCheat) {
					return next(args);
				}
				if (!data?.Character) {
					return next(args);
				}
				if (data.Character.MemberNumber !== Player.MemberNumber) {
					return next(args);
				}
				if (Player.WhiteList.includes(data.SourceMemberNumber)) {
					return next(args);
				}

				const sourceCharacter =
					ChatRoomCharacter.find(
						(a) => a.MemberNumber === data.SourceMemberNumber
					) ||
					(data.SourceMemberNumber === Player.MemberNumber ? Player : null);

				if (!sourceCharacter) {
					throw new Error(
						"change from invalid source character not in the current room"
					);
				}

				if (sourceCharacter.IsPlayer()) {
					return next(args);
				}

				// Gets the item bundles to be used for diff comparison, also making necessary changes for the purpose
				/** @type {(bundle: ItemBundle[]) => Map<string, ItemBundle>} */
				function processItemBundleToMap(bundle) {
					/** @type {(Map<string, ItemBundle>)} */
					const initial = new Map();
					return bundle.reduce((prev, cur) => {
						// Ignoring color changes
						cur = deepCopy(cur);
						delete cur.Color;
						prev.set(`${cur.Group}/${cur.Name}`, cur);
						return prev;
					}, initial);
				}

				// Number of items changed in appearance
				const oldItems = processItemBundleToMap(
					ServerAppearanceBundle(
						Player.Appearance.filter((a) => a.Asset.Group.Category === "Item")
					)
				);

				if (!data.Character.Appearance) {
					throw new Error("no appearance data in sync single");
				}

				const newItems = processItemBundleToMap(
					data.Character.Appearance.filter(
						(a) =>
							ServerBundledItemToAppearanceItem("Female3DCG", a)?.Asset.Group
								.Category === "Item"
					)
				);

				// Locks can be modified enmass with futuristic collar
				const ignoreLocks =
					Array.from(oldItems.values()).some(
						(i) => i.Name === "FuturisticCollar"
					) &&
					Array.from(newItems.values()).some(
						(i) => i.Name === "FuturisticCollar"
					);
				const ignoreColors =
					(Array.from(oldItems.values()).some(
						(i) => i.Name === "FuturisticHarness"
					) &&
						Array.from(newItems.values()).some(
							(i) => i.Name === "FuturisticHarness"
						)) ||
					ignoreLocks;

				debug(
					"Anti-Cheat validating bulk change from",
					sourceCharacter.MemberNumber
				);

				// Count number of new items
				const newAndChanges = Array.from(newItems.keys()).reduce(
					(changes, cur) => {
						const newItem = newItems.get(cur);
						if (!newItem) {
							throw new Error(
								"this should never happen: newItem is null inside map loop"
							);
						}
						if (!oldItems.has(cur)) {
							// Item is new, validate it and mark as new
							if (!validateNewLockMemberNumber(sourceCharacter, newItem)) {
								changes.prohibited = true;
							}
							changes.new++;
							return changes;
						}
						const oldItem = oldItems.get(cur) ?? null;
						const result = validateSingleItemChange(
							sourceCharacter,
							oldItem,
							newItem,
							ignoreLocks,
							ignoreColors
						);
						changes.prohibited = changes.prohibited || result.prohibited;
						changes.changed += result.changed;
						return changes;
					},
					{ new: 0, changed: 0, prohibited: false }
				);

				// Count number of removed items
				const removed = Array.from(oldItems.keys()).reduce((prev, cur) => {
					if (!newItems.has(cur)) {
						return prev + 1;
					}
					return prev;
				}, 0);
				if (
					newAndChanges.new + newAndChanges.changed + removed > 2 ||
					newAndChanges.prohibited
				) {
					debug(
						"Anti-Cheat tripped on bulk change from",
						sourceCharacter.MemberNumber,
						newAndChanges,
						removed
					);
					revertChanges(sourceCharacter);
					return null;
				}
				return next(args);
			}
		);
	}

	async function forcedClubSlave() {
		const patch = (async function patchDialog() {
			await waitFor(
				() =>
					!!CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"] &&
					CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].length >
						150
			);

			const clubSlaveDialog = [
				[
					"160",
					"100",
					displayText("([FBC] Force them to become a Club Slave.)"),
					displayText("(She will become a Club Slave for the next hour.)"),
					"bceSendToClubSlavery()",
					"bceCanSendToClubSlavery()",
				],
				[
					"160",
					"",
					displayText("([FBC] Force them to become a Club Slave.)"),
					displayText(
						"(Requires both to use compatible versions of FBC and the target to not already be a club slave.)"
					),
					"",
					"!bceCanSendToClubSlavery()",
				],
			];

			const idx =
				CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].findIndex(
					(v) => v[0] === "160"
				) + 1;
			CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].splice(
				idx,
				0,
				...clubSlaveDialog
			);

			/** @type {(c: Character) => void} */
			const appendDialog = (c) => {
				// @ts-ignore - FBC is not a valid property in the game, but we use it here to mark that we've already added the dialog
				if (!c.Dialog || c.Dialog.some((v) => v.FBC)) {
					return;
				}
				c.Dialog.splice(
					idx,
					0,
					// @ts-ignore - FBC is not a valid property in the game, but we use it here to mark that we've already added the dialog
					...clubSlaveDialog.map((v) => ({
						Stage: v[0],
						NextStage: v[1],
						Option: v[2]
							.replace("DialogCharacterName", CharacterNickname(c))
							.replace("DialogPlayerName", CharacterNickname(Player)),
						Result: v[3]
							.replace("DialogCharacterName", CharacterNickname(c))
							.replace("DialogPlayerName", CharacterNickname(Player)),
						Function:
							(v[4].trim().substring(0, 6) === "Dialog" ? "" : "ChatRoom") +
							v[4],
						Prerequisite: v[5],
						FBC: true,
					}))
				);
			};

			for (const c of ChatRoomCharacter.filter(
				(cc) => !cc.IsPlayer() && cc.IsOnline()
			)) {
				appendDialog(c);
			}

			SDK.hookFunction(
				"CharacterBuildDialog",
				HOOK_PRIORITIES.AddBehaviour,
				/**
				 * @param {Parameters<typeof CharacterBuildDialog>} args
				 */
				(args, next) => {
					const ret = next(args);
					const [C] = args;
					if (isCharacter(C) && C.IsOnline()) {
						appendDialog(C);
					}
					return ret;
				}
			);
		})();

		w.bceSendToClubSlavery = function () {
			/** @type {ServerChatRoomMessage} */
			const message = {
				Type: HIDDEN,
				Content: BCE_MSG,
				Sender: Player.MemberNumber,
				Dictionary: [
					{
						// @ts-ignore - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
						message: {
							type: MESSAGE_TYPES.Activity,
							version: FBC_VERSION,
							activity: "ClubSlavery",
						},
					},
				],
			};
			ServerSend("ChatRoomChat", message);
			DialogLeave();
		};

		w.bceCanSendToClubSlavery = function () {
			const C = CurrentCharacter;
			if (!C) {
				return false;
			}
			return (
				C.BCECapabilities?.includes("clubslave") &&
				!C.Appearance.some((a) => a.Asset.Name === "ClubSlaveCollar")
			);
		};

		w.bceGotoRoom = (roomName) => {
			ChatRoomJoinLeash = roomName;
			DialogLeave();
			ChatRoomClearAllElements();
			if (CurrentScreen === "ChatRoom") {
				ServerSend("ChatRoomLeave", "");
				CommonSetScreen("Online", "ChatSearch");
			} else {
				ChatRoomStart("", "", null, null, "Introduction", BackgroundsTagList);
			}
		};

		w.bceStartClubSlave = async () => {
			const managementScreen = "Management";

			if (BCX?.getRuleState("block_club_slave_work")?.isEnforced) {
				fbcSendAction(
					displayText(
						`BCX rules forbid $PlayerName from becoming a Club Slave.`,
						{ $PlayerName: CharacterNickname(Player) }
					)
				);
				return;
			}

			fbcSendAction(
				displayText(
					`$PlayerName gets grabbed by two maids and escorted to management to serve as a Club Slave.`,
					{ $PlayerName: CharacterNickname(Player) }
				)
			);

			if (!ChatRoomData) {
				logError(
					"ChatRoomData is null in bceStartClubSlave. Was it called outside a chat room?"
				);
				return;
			}

			const room = ChatRoomData.Name;
			ChatRoomClearAllElements();
			ServerSend("ChatRoomLeave", "");
			ChatRoomLeashPlayer = null;
			CommonSetScreen("Room", managementScreen);

			await waitFor(() => !!ManagementMistress);
			if (!ManagementMistress) {
				throw new Error("ManagementMistress is missing");
			}

			PoseSetActive(Player, "Kneel", false);

			// eslint-disable-next-line require-atomic-updates
			ManagementMistress.Stage = "320";
			ManagementMistress.CurrentDialog = displayText(
				"(You get grabbed by a pair of maids and brought to management.) Your owner wants you to be a Club Slave. Now strip."
			);
			CharacterSetCurrent(ManagementMistress);

			await waitFor(
				() => CurrentScreen !== managementScreen || !CurrentCharacter
			);

			w.bceGotoRoom(room);
		};

		w.ChatRoombceSendToClubSlavery = w.bceSendToClubSlavery;
		w.ChatRoombceCanSendToClubSlavery = w.bceCanSendToClubSlavery;

		await patch;
	}

	function leashFix() {
		patchFunction(
			"ChatSearchQuery",
			{
				"// Prevent spam searching the same thing.":
					'if (ChatRoomJoinLeash) { SearchData.Language = ""; }\n\t// Prevent spam searching the same thing.',
			},
			"Leashing between language filters"
		);
	}

	// BcUtil-compatible instant messaging with friends
	function instantMessenger() {
		w.bceStripBeepMetadata = (msg) => msg.split("\uf124")[0].trimEnd();

		// Build the DOM
		const container = document.createElement("div");
		container.classList.add("bce-hidden");
		container.id = "bce-instant-messenger";
		const leftContainer = document.createElement("div");
		leftContainer.id = "bce-message-left-container";
		const friendList = document.createElement("div");
		friendList.id = "bce-friend-list";
		const rightContainer = document.createElement("div");
		rightContainer.id = "bce-message-right-container";
		const messageContainer = document.createElement("div");
		messageContainer.id = "bce-message-container";
		const messageInput = document.createElement("textarea");
		messageInput.id = "bce-message-input";
		messageInput.setAttribute("maxlength", "2000");
		messageInput.addEventListener("keydown", (e) => {
			// MBCHC compatibility: prevent chatroom keydown events from triggering at document level
			e.stopPropagation();
		});

		const friendSearch = document.createElement("input");
		friendSearch.id = "bce-friend-search";
		friendSearch.setAttribute(
			"placeholder",
			displayText("Search for a friend")
		);
		friendSearch.autocomplete = "off";
		friendSearch.addEventListener("keydown", (e) => {
			// MBCHC compatibility: prevent chatroom keydown events from triggering at document level
			e.stopPropagation();
		});

		const onlineClass = "bce-friend-list-handshake-completed";
		const offlineClass = "bce-friend-list-handshake-false";

		container.appendChild(leftContainer);
		container.appendChild(rightContainer);
		leftContainer.appendChild(friendSearch);
		leftContainer.appendChild(friendList);
		rightContainer.appendChild(messageContainer);
		rightContainer.appendChild(messageInput);
		document.body.appendChild(container);

		const storageKey = () =>
			`bce-instant-messenger-state-${Player.AccountName.toLowerCase()}`;

		/** @type {number} */
		let activeChat = -1;

		let unreadSinceOpened = 0;

		/** @typedef {{ author: string, authorId: number, type: "Emote" | "Action" | "Message", message: string, color: string, createdAt: number }} RawHistory */
		/** @typedef {{ unread: number, statusText: HTMLElement, listElement: HTMLElement, historyRaw: RawHistory[], history: HTMLElement, online: boolean }} IMFriendHistory */
		/** @type {Map<number, IMFriendHistory>} */
		const friendMessages = new Map();

		const scrollToBottom = () => {
			const friend = friendMessages.get(activeChat);
			if (friend) {
				friend.history.scrollTop = friend.history.scrollHeight;
			}
		};

		const saveHistory = () => {
			/** @type {Record<number, { historyRaw: RawHistory[] }>} */
			const history = {};
			friendMessages.forEach((friend, id) => {
				if (friend.historyRaw.length === 0) {
					return;
				}
				const historyLength = Math.min(friend.historyRaw.length, 100);
				history[id] = {
					historyRaw: friend.historyRaw.slice(-historyLength),
				};
			});
			localStorage.setItem(storageKey(), JSON.stringify(history));
		};

		/** @type {(friendId: number) => void} */
		const changeActiveChat = (friendId) => {
			const friend = friendMessages.get(friendId);
			messageInput.disabled = !friend?.online;
			messageContainer.innerHTML = "";
			for (const f of friendMessages.values()) {
				f.listElement.classList.remove("bce-friend-list-selected");
			}
			if (friend) {
				friend.listElement.classList.add("bce-friend-list-selected");
				friend.listElement.classList.remove("bce-friend-list-unread");
				messageContainer.appendChild(friend.history);
				friend.unread = 0;
			}

			const previousFriend = friendMessages.get(activeChat);
			if (previousFriend) {
				const divider = previousFriend.history.querySelector(
					".bce-message-divider"
				);
				if (divider) {
					previousFriend.history.removeChild(divider);
				}
			}

			sortIM();

			activeChat = friendId;
			scrollToBottom();
		};

		/** @type {(friendId: number, sent: boolean, beep: Partial<ServerAccountBeepResponse>, skipHistory: boolean, createdAt: Date) => void} */
		// eslint-disable-next-line complexity
		const addMessage = (friendId, sent, beep, skipHistory, createdAt) => {
			const friend = friendMessages.get(friendId);
			if (!friend || beep.BeepType) {
				return;
			}

			/** @type {{ messageType: "Message" | "Emote" | "Action"; messageColor?: string; }?} */
			const details = parseJSON(
				beep.Message?.split("\n")
					.find((line) => line.startsWith("\uf124"))
					?.substring(1) ?? "{}"
			) ?? { messageType: "Message" };

			if (!details.messageType) {
				details.messageType = "Message";
			}

			/** @type {"Message" | "Emote" | "Action"} */
			const messageType = ["Message", "Emote", "Action"].includes(
				details.messageType
			)
				? `${details.messageType}`
				: "Message";
			const messageColor = details?.messageColor ?? "#ffffff";
			const messageText = beep.Message?.split("\n")
				.filter((line) => !line.startsWith("\uf124"))
				.join("\n")
				.trimEnd();

			if (!messageText) {
				debug("skipped empty beep", friendId, beep, sent, skipHistory);
				return;
			}

			const scrolledToEnd =
				friend.history.scrollHeight -
					friend.history.scrollTop -
					friend.history.clientHeight <
				1;
			const message = document.createElement("div");
			message.classList.add("bce-message");
			message.classList.add(sent ? "bce-message-sent" : "bce-message-received");
			message.classList.add(`bce-message-${messageType}`);
			message.setAttribute("data-time", createdAt.toLocaleString());

			const author = sent
				? CharacterNickname(Player)
				: beep.MemberName ?? "<Unknown>";

			switch (messageType) {
				case "Emote":
					message.textContent = `*${author}${messageText}*`;
					break;
				case "Action":
					message.textContent = `*${messageText}*`;
					break;
				case "Message":
					{
						const sender = document.createElement("span");
						sender.classList.add("bce-message-sender");
						if (messageColor) {
							sender.style.color = messageColor;
						}
						sender.textContent = `${author}: `;
						message.appendChild(sender);
						message.appendChild(document.createTextNode(messageText));
					}
					break;
				default:
					message.textContent = messageText;
					break;
			}

			if (!Player.MemberNumber) {
				throw new Error("Player.MemberNumber is invalid");
			}

			let authorId = Player.MemberNumber;
			if (!sent) {
				if (!beep.MemberNumber) {
					throw new Error("beep.MemberNumber is invalid");
				}
				authorId = beep.MemberNumber;
			}

			if (!skipHistory) {
				friend.historyRaw.push({
					author,
					authorId,
					message: messageText,
					type: messageType,
					color: messageColor,
					createdAt: Date.now(),
				});

				friend.listElement.setAttribute(
					"data-last-updated",
					Date.now().toString()
				);

				if (friendId !== activeChat) {
					friend.listElement.classList.add("bce-friend-list-unread");
					friend.unread++;
				}
				if (
					friend.unread === 1 &&
					(container.classList.contains("bce-hidden") ||
						friendId !== activeChat)
				) {
					const divider = document.createElement("div");
					divider.classList.add("bce-message-divider");
					friend.history.appendChild(divider);
				}

				if (container.classList.contains("bce-hidden")) {
					unreadSinceOpened++;
				}
			}
			/**
			 * @returns {null}
			 */
			const noop = () => null;
			processChatAugmentsForLine(
				message,
				scrolledToEnd ? scrollToBottom : noop
			);

			friend.history.appendChild(message);
			if (scrolledToEnd) {
				scrollToBottom();
			}

			saveHistory();
		};

		/** @type {(friendId: number) => IMFriendHistory} */
		const handleUnseenFriend = (friendId) => {
			let msgs = friendMessages.get(friendId);
			if (!msgs) {
				/** @type {IMFriendHistory} */
				const friendData = {
					statusText: document.createElement("span"),
					listElement: document.createElement("div"),
					historyRaw: [],
					history: document.createElement("div"),
					unread: 0,
					online: false,
				};
				friendData.listElement.id = `bce-friend-list-entry-${friendId}`;
				friendData.listElement.classList.add("bce-friend-list-entry");
				friendData.listElement.onclick = () => {
					changeActiveChat(friendId);
				};

				friendData.history.classList.add("bce-friend-history");

				const name = document.createElement("div");
				name.classList.add("bce-friend-list-entry-name");
				name.textContent = Player.FriendNames?.get(friendId) || "";
				friendData.listElement.appendChild(name);

				const memberNumber = document.createElement("div");
				memberNumber.classList.add("bce-friend-list-entry-member-number");
				memberNumber.textContent = friendId.toString();
				friendData.listElement.appendChild(memberNumber);

				friendData.listElement.appendChild(friendData.statusText);

				friendList.appendChild(friendData.listElement);

				friendMessages.set(friendId, friendData);
				msgs = friendData;
			}
			return msgs;
		};

		const history = /** @type {Record<string, {historyRaw: RawHistory[]}>} */ (
			parseJSON(localStorage.getItem(storageKey()) || "{}")
		);
		for (const [friendIdStr, friendHistory] of objEntries(history)) {
			const friendId = parseInt(friendIdStr);
			const friend = handleUnseenFriend(friendId);
			friend.historyRaw = friendHistory.historyRaw;
			for (const hist of friendHistory.historyRaw) {
				addMessage(
					friendId,
					hist.authorId === Player.MemberNumber,
					{
						Message: `${hist.message}\n\n\uf124${JSON.stringify({
							messageType: hist.type,
							messageColor: hist.color,
						})}`,
						MemberNumber: hist.authorId,
						MemberName: hist.author,
					},
					true,
					hist.createdAt ? new Date(hist.createdAt) : new Date(0)
				);
				if (hist.createdAt) {
					friend.listElement.setAttribute(
						"data-last-updated",
						hist.createdAt.toString()
					);
				}
			}
		}

		messageInput.addEventListener("keydown", (e) => {
			if (e.key === "Enter" && !e.shiftKey) {
				e.preventDefault();
				if (
					BCX?.getRuleState("speech_restrict_beep_send")?.isEnforced &&
					!fbcSettings.allowIMBypassBCX
				) {
					fbcNotify(
						displayText("Sending beeps is currently restricted by BCX rules")
					);
					return;
				}
				let messageText = messageInput.value;
				if (messageText.trim() === "") {
					return;
				}
				messageInput.value = "";

				/** @type {"Message" | "Emote" | "Action"} */
				let messageType = "Message";
				if (messageText.startsWith("/me ")) {
					messageText = messageText.substring(4);
					if (!/^[', ]/u.test(messageText)) {
						messageText = ` ${messageText}`;
					}
					messageType = "Emote";
				} else if (messageText.startsWith("/action ")) {
					messageText = messageText.substring(8);
					messageType = "Action";
				} else if (/^\*[^*]/u.test(messageText)) {
					messageText = messageText.substring(1);
					if (!/^[', ]/u.test(messageText)) {
						messageText = ` ${messageText}`;
					}
					messageType = "Emote";
				} else if (/^\*\*/u.test(messageText)) {
					messageText = messageText.substring(2);
					messageType = "Action";
				}

				/** @type {ServerAccountBeepRequest} */
				const message = {
					BeepType: "",
					MemberNumber: activeChat,
					IsSecret: true,
					Message: `${messageText}\n\n\uf124${JSON.stringify({
						messageType,
						messageColor: Player.LabelColor,
					})}`,
				};
				addMessage(activeChat, true, message, false, new Date());
				FriendListBeepLog.push({
					...message,
					MemberName: Player.FriendNames?.get(activeChat) || "aname",
					Sent: true,
					Private: false,
					Time: new Date(),
				});
				ServerSend("AccountBeep", message);
			}
		});

		friendSearch.onkeyup = () => {
			const search = friendSearch.value.toLowerCase();
			for (const friendId of friendMessages.keys()) {
				const friend = friendMessages.get(friendId);
				if (!friend) {
					throw new Error(
						"this should never happen, friend is null in map loop"
					);
				}
				const friendName = Player.FriendNames?.get(friendId)?.toLowerCase();
				if (search === "") {
					friend.listElement.classList.remove("bce-hidden");
				} else if (
					!friendId.toString().includes(search) &&
					!friendName?.includes(search)
				) {
					friend.listElement.classList.add("bce-hidden");
				} else {
					friend.listElement.classList.remove("bce-hidden");
				}
			}
			sortIM();
		};

		registerSocketListener("AccountQueryResult", (data) => {
			if (data.Query !== "OnlineFriends") {
				return;
			}
			if (data.Result && fbcSettings.instantMessenger) {
				for (const friend of data.Result) {
					const f = handleUnseenFriend(friend.MemberNumber);
					f.online = true;
					f.statusText.textContent = displayText("Online");
					f.listElement.classList.remove(offlineClass);
					f.listElement.classList.add(onlineClass);
				}
				for (const friendId of Array.from(friendMessages.keys()).filter(
					(f) => !data.Result.some((f2) => f2.MemberNumber === f)
				)) {
					const f = friendMessages.get(friendId);
					if (!f) {
						throw new Error("this should never happen, f is null in map loop");
					}
					f.online = false;
					f.statusText.textContent = displayText("Offline");
					f.listElement.classList.remove(onlineClass);
					f.listElement.classList.add(offlineClass);
				}
				if (!data.Result.some((f) => f.MemberNumber === activeChat)) {
					// Disable input, current user is offline
					messageInput.disabled = true;
				} else {
					// Enable input, current user is online
					messageInput.disabled = false;
				}
			}
		});

		function sortIM() {
			[...friendList.children]
				.sort((a, b) => {
					const notA = !a.classList.contains(onlineClass);
					const notB = !b.classList.contains(onlineClass);
					if ((notA && notB) || (!notA && !notB)) {
						const aUpdatedAt = a.getAttribute("data-last-updated") ?? "";
						const bUpdatedAt = b.getAttribute("data-last-updated") ?? "";
						const au = /^\d+$/u.test(aUpdatedAt) ? parseInt(aUpdatedAt) : 0;
						const bu = /^\d+$/u.test(bUpdatedAt) ? parseInt(bUpdatedAt) : 0;
						return bu - au;
					}
					if (notA) {
						return 1;
					}
					return -1;
				})
				.forEach((node) => {
					friendList.removeChild(node);
					friendList.appendChild(node);
				});
		}

		SDK.hookFunction(
			"ServerAccountBeep",
			HOOK_PRIORITIES.OverrideBehaviour,
			/** @type {(args: [ServerAccountBeepResponse], next: (args: [ServerAccountBeepResponse]) => void) => void} */
			(args, next) => {
				const [beep] = args;
				if (
					beep &&
					isNonNullObject(beep) &&
					!beep.BeepType &&
					fbcSettings.instantMessenger
				) {
					addMessage(beep.MemberNumber, false, beep, false, new Date());
				}
				next(args);
			}
		);

		SDK.hookFunction(
			"ServerSend",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof ServerSend>} args
			 */
			(args, next) => {
				const [command, b] = args;
				if (command !== "AccountBeep") {
					return next(args);
				}
				const beep = /** @type {ServerAccountBeepRequest} */ (b);
				if (
					!beep?.BeepType &&
					isString(beep?.Message) &&
					!beep.Message.includes("\uf124")
				) {
					addMessage(beep.MemberNumber, true, beep, false, new Date());
				}
				return next(args);
			}
		);

		/**
		 * Get the position of the IM button dynamically based on current screen properties
		 * @type {() => [number, number, number, number]}
		 */
		function buttonPosition() {
			if (
				CurrentScreen === "ChatRoom" &&
				document.getElementById("TextAreaChatLog")?.offsetParent !== null
			) {
				return [5, 865, 60, 60];
			}
			return [70, 905, 60, 60];
		}

		SDK.hookFunction(
			"DrawProcess",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof DrawProcess>} args
			 */
			(args, next) => {
				next(args);
				if (fbcSettings.instantMessenger) {
					if (
						!fbcSettings.allowIMBypassBCX &&
						(BCX?.getRuleState("speech_restrict_beep_receive")?.isEnforced ||
							(BCX?.getRuleState("alt_hide_friends")?.isEnforced &&
								Player.GetBlindLevel() >= 3))
					) {
						if (!container.classList.contains("bce-hidden")) {
							hideIM();
						}
						DrawButton(
							...buttonPosition(),
							"",
							"Gray",
							"Icons/Small/Chat.png",
							displayText("Instant Messenger (Disabled by BCX)"),
							false
						);
					} else {
						DrawButton(
							...buttonPosition(),
							"",
							unreadSinceOpened ? "Red" : "White",
							"Icons/Small/Chat.png",
							displayText("Instant Messenger"),
							false
						);
					}
				}
			}
		);

		SDK.hookFunction(
			"CommonClick",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof CommonClick>} args
			 */
			(args, next) => {
				if (fbcSettings.instantMessenger && MouseIn(...buttonPosition())) {
					if (!container.classList.contains("bce-hidden")) {
						hideIM();
						return;
					}
					sortIM();
					container.classList.toggle("bce-hidden");
					ServerSend("AccountQuery", { Query: "OnlineFriends" });
					unreadSinceOpened = 0;
					scrollToBottom();
					NotificationReset("Beep");
					return;
				}
				next(args);
			}
		);

		SDK.hookFunction(
			"NotificationRaise",
			HOOK_PRIORITIES.ModifyBehaviourHigh,
			/**
			 * @param {Parameters<typeof NotificationRaise>} args
			 */
			(args, next) => {
				if (args[0] === "Beep" && args[1]?.body) {
					args[1].body = bceStripBeepMetadata(args[1].body);
				}
				return next(args);
			}
		);

		/** @type {(e: KeyboardEvent) => void} */
		function keyHandler(e) {
			if (!fbcSettings.instantMessenger) {
				return;
			}
			if (e.key === "Escape" && !container.classList.contains("bce-hidden")) {
				hideIM();
				e.stopPropagation();
				e.preventDefault();
			}
		}

		function hideIM() {
			container.classList.add("bce-hidden");
			messageInput.blur();
			friendSearch.blur();
		}

		document.addEventListener("keydown", keyHandler, true);
		document.addEventListener("keypress", keyHandler, true);
	}

	async function extendedWardrobe() {
		await waitFor(() => !!ServerSocket);

		SDK.hookFunction(
			"CharacterDecompressWardrobe",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof CharacterDecompressWardrobe>} args
			 */
			(args, next) => {
				let wardrobe = next(args);
				if (
					isWardrobe(wardrobe) &&
					fbcSettings.extendedWardrobe &&
					wardrobe.length < EXPANDED_WARDROBE_SIZE
				) {
					wardrobe = loadExtendedWardrobe(wardrobe);
				}
				return wardrobe;
			}
		);

		SDK.hookFunction(
			"CharacterCompressWardrobe",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof CharacterCompressWardrobe>} args
			 */
			(args, next) => {
				const [wardrobe] = args;
				if (isWardrobe(wardrobe)) {
					const additionalWardrobe = wardrobe.slice(DEFAULT_WARDROBE_SIZE);
					if (additionalWardrobe.length > 0) {
						Player.ExtensionSettings.FBCWardrobe = LZString.compressToUTF16(
							JSON.stringify(additionalWardrobe)
						);
						args[0] = wardrobe.slice(0, DEFAULT_WARDROBE_SIZE);
						ServerPlayerExtensionSettingsSync("FBCWardrobe");
					}
				}
				return next(args);
			}
		);
	}

	/**
	 * Convert old {@link ItemProperties.Type} remnants into {@link ItemProperties.TypeRecord} in the passed item bundles.
	 * @param {ItemBundle[]} bundleList
	 */
	function sanitizeBundles(bundleList) {
		if (!Array.isArray(bundleList)) {
			return bundleList;
		}
		return bundleList.map((bundle) => {
			if (
				// eslint-disable-next-line deprecation/deprecation
				typeof bundle.Property?.Type === "string" &&
				!CommonIsObject(bundle.Property?.TypeRecord)
			) {
				const asset = AssetGet("Female3DCG", bundle.Group, bundle.Name);
				if (asset) {
					bundle.Property.TypeRecord = ExtendedItemTypeToRecord(
						asset,
						// eslint-disable-next-line deprecation/deprecation
						bundle.Property.Type
					);
				}
			}
			return bundle;
		});
	}

	/** @type {(wardrobe: ItemBundle[][]) => ItemBundle[][]} */
	function loadExtendedWardrobe(wardrobe) {
		if (fbcSettings.extendedWardrobe) {
			WardrobeSize = EXPANDED_WARDROBE_SIZE;
			WardrobeFixLength();
		}

		const wardrobeData =
			Player.ExtensionSettings.FBCWardrobe ||
			// eslint-disable-next-line deprecation/deprecation
			Player.OnlineSettings?.BCEWardrobe;
		if (wardrobeData) {
			// eslint-disable-next-line deprecation/deprecation
			if (Player.OnlineSettings?.BCEWardrobe) {
				Player.ExtensionSettings.FBCWardrobe = wardrobeData;
				ServerPlayerExtensionSettingsSync("FBCWardrobe");
				logInfo("Migrated wardrobe from OnlineSettings to ExtensionSettings");
				// eslint-disable-next-line deprecation/deprecation
				delete Player.OnlineSettings.BCEWardrobe;
			}
			try {
				const additionalItemBundle = /** @type {ItemBundle[][]} */ (
					parseJSON(LZString.decompressFromUTF16(wardrobeData))
				);
				if (isWardrobe(additionalItemBundle)) {
					for (let i = DEFAULT_WARDROBE_SIZE; i < EXPANDED_WARDROBE_SIZE; i++) {
						const additionalIdx = i - DEFAULT_WARDROBE_SIZE;
						if (additionalIdx >= additionalItemBundle.length) {
							break;
						}
						wardrobe[i] = sanitizeBundles(additionalItemBundle[additionalIdx]);
					}
				}
			} catch (e) {
				logError("Failed to load extended wardrobe", e);
				fbcBeepNotify(
					"Wardrobe error",
					`Failed to load extended wardrobe.\n\nBackup: ${wardrobeData}`
				);
				logInfo("Backup wardrobe", wardrobeData);
			}
		}
		return wardrobe;
	}

	async function beepChangelog() {
		await waitFor(() => !!Player?.AccountName);
		await sleep(5000);
		fbcBeepNotify(
			displayText("FBC Changelog"),
			displayText(
				`FBC has received significant updates since you last used it. See /fbcchangelog in a chatroom.`
			)
		);
		await waitFor(() => !!document.getElementById("TextAreaChatLog"));
		fbcChatNotify(`For Better Club (FBC) changelog:\n${fbcChangelog}`);
	}

	/** @type {(word: string) => URL | false} */
	function bceParseUrl(word) {
		try {
			const url = new URL(word);
			if (!["http:", "https:"].includes(url.protocol)) {
				return false;
			}
			return url;
		} catch {
			return false;
		}
	}

	/** @type {(url: URL) => "img" | "" | "none-img"} */
	function bceAllowedToEmbed(url) {
		const isTrustedOrigin =
			[
				"cdn.discordapp.com",
				"media.discordapp.com",
				"i.imgur.com",
				"tenor.com",
				"c.tenor.com",
				"media.tenor.com",
				"i.redd.it",
				"puu.sh",
				"fs.kinkop.eu",
			].includes(url.host) ||
			sessionCustomOrigins.get(url.origin) === "allowed";

		if (/\/[^/]+\.(png|jpe?g|gif)$/u.test(url.pathname)) {
			return isTrustedOrigin ? EMBED_TYPE.Image : EMBED_TYPE.Untrusted;
		}
		return EMBED_TYPE.None;
	}

	/** @type {(chatMessageElement: Element, scrollToEnd: () => void) => void} */
	function processChatAugmentsForLine(chatMessageElement, scrollToEnd) {
		const newChildren = [];
		let originalText = "";
		for (const node of chatMessageElement.childNodes) {
			if (node.nodeType !== Node.TEXT_NODE) {
				newChildren.push(node);
				/** @type {HTMLElement} */
				// @ts-ignore
				const el = node;
				if (
					el.classList.contains("ChatMessageName") ||
					el.classList.contains("bce-message-Message")
				) {
					newChildren.push(document.createTextNode(" "));
				}
				continue;
			}
			const contents = node.textContent?.trim() ?? "",
				words = [contents];

			originalText += node.textContent;

			for (let i = 0; i < words.length; i++) {
				// Handle other whitespace
				const whitespaceIdx = words[i].search(/[\s\r\n]/u);
				if (whitespaceIdx >= 1) {
					words.splice(i + 1, 0, words[i].substring(whitespaceIdx));
					words[i] = words[i].substring(0, whitespaceIdx);
				} else if (whitespaceIdx === 0) {
					words.splice(i + 1, 0, words[i].substring(1));
					[words[i]] = words[i];
					newChildren.push(document.createTextNode(words[i]));
					continue;
				}

				// Handle url linking
				const url = bceParseUrl(words[i].replace(/(^\(+|\)+$)/gu, ""));
				if (url) {
					// Embed or link
					/** @type {HTMLElement | Text | null} */
					let domNode = null;
					const linkNode = document.createElement("a");
					newChildren.push(linkNode);
					const embedType = bceAllowedToEmbed(url);
					switch (embedType) {
						case EMBED_TYPE.Image:
							{
								const imgNode = document.createElement("img");
								imgNode.src = url.href;
								imgNode.alt = url.href;
								imgNode.onload = scrollToEnd;
								imgNode.classList.add("bce-img");
								linkNode.classList.add("bce-img-link");
								domNode = imgNode;
							}
							break;
						default:
							domNode = document.createTextNode(url.href);
							if (embedType !== EMBED_TYPE.None) {
								const promptTrust = document.createElement("a");
								// eslint-disable-next-line no-loop-func
								promptTrust.onclick = (e) => {
									e.preventDefault();
									e.stopPropagation();
									// eslint-disable-next-line prefer-destructuring
									const target = /** @type {HTMLAnchorElement} */ (e.target);
									FUSAM.modals.open({
										prompt: displayText(
											"Do you want to add $origin to trusted origins?",
											{
												$origin: url.origin,
											}
										),
										callback: (act) => {
											if (act === "submit") {
												sessionCustomOrigins.set(url.origin, "allowed");

												const parent = target.parentElement;
												if (!parent) {
													throw new Error("clicked promptTrust has no parent");
												}
												parent.removeChild(target);

												const name = parent.querySelector(".ChatMessageName");
												parent.innerHTML = "";
												if (name) {
													parent.appendChild(name);
													parent.appendChild(document.createTextNode(" "));
												}

												const ogText = parent.getAttribute("bce-original-text");
												if (!ogText) {
													throw new Error(
														"clicked promptTrust has no original text"
													);
												}
												parent.appendChild(document.createTextNode(ogText));
												processChatAugmentsForLine(
													chatMessageElement,
													scrollToEnd
												);
												debug("updated trusted origins", sessionCustomOrigins);
											}
										},
										buttons: {
											submit: displayText("Trust this session"),
										},
									});
								};
								promptTrust.href = "#";
								promptTrust.title = displayText("Trust this session");
								promptTrust.textContent = displayText("(embed)");
								newChildren.push(document.createTextNode(" "));
								newChildren.push(promptTrust);
							}
							break;
					}
					linkNode.href = url.href;
					linkNode.title = url.href;
					linkNode.target = "_blank";
					linkNode.appendChild(domNode);
				} else if (/^#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/u.test(words[i])) {
					const color = document.createElement("span");
					color.classList.add("bce-color");
					color.style.background = words[i];
					newChildren.push(color);
					newChildren.push(document.createTextNode(words[i]));
				} else {
					newChildren.push(document.createTextNode(words[i]));
				}
			}
		}
		while (chatMessageElement.firstChild) {
			chatMessageElement.removeChild(chatMessageElement.firstChild);
		}
		for (const child of newChildren) {
			chatMessageElement.appendChild(child);
		}
		chatMessageElement.setAttribute("bce-original-text", originalText);
	}

	function customContentDomainCheck() {
		const trustedOrigins = ["https://fs.kinkop.eu", "https://i.imgur.com"];

		let open = false;
		/**
		 * @param {string} origin
		 * @param {"image" | "music" | null} type
		 */
		function showCustomContentDomainCheckWarning(origin, type = null) {
			if (open) {
				return;
			}
			open = true;
			FUSAM.modals.open({
				prompt: displayText(
					`Do you want to allow 3rd party ${
						type ?? "content"
					} to be loaded from $origin? $trusted`,
					{
						$origin: origin,
						$trusted: trustedOrigins.includes(origin)
							? displayText("(This origin is trusted by authors of FBC)")
							: "",
					}
				),
				callback: (act) => {
					open = false;
					if (act === "submit") {
						sessionCustomOrigins.set(origin, "allowed");
					} else if (act === "cancel") {
						sessionCustomOrigins.set(origin, "denied");
					}
				},
				buttons: {
					cancel: displayText("Deny for session"),
					submit: displayText("Allow for session"),
				},
			});
		}

		SDK.hookFunction(
			"ChatAdminRoomCustomizationProcess",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof ChatAdminRoomCustomizationProcess>} args
			 */
			(args, next) => {
				if (!fbcSettings.customContentDomainCheck) {
					return next(args);
				}

				try {
					// @ts-ignore - the function's types are garbage
					const [{ ImageURL, MusicURL }] = args;

					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
					const imageOrigin = ImageURL && new URL(ImageURL).origin;
					// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
					const musicOrigin = MusicURL && new URL(MusicURL).origin;

					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					if (imageOrigin && !sessionCustomOrigins.has(imageOrigin)) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						showCustomContentDomainCheckWarning(imageOrigin, "image");
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					} else if (musicOrigin && !sessionCustomOrigins.has(musicOrigin)) {
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						showCustomContentDomainCheckWarning(musicOrigin, "music");
					}

					if (
						(!ImageURL ||
							// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
							sessionCustomOrigins.get(imageOrigin) === "allowed") &&
						// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
						(!MusicURL || sessionCustomOrigins.get(musicOrigin) === "allowed")
					) {
						return next(args);
					}
				} catch (_) {
					// Don't care
				}

				return null;
			}
		);

		SDK.hookFunction(
			"ChatAdminRoomCustomizationClick",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof ChatAdminRoomCustomizationClick>} args
			 */
			(args, next) => {
				for (const s of [
					ElementValue("InputImageURL").trim(),
					ElementValue("InputMusicURL").trim(),
				]) {
					try {
						const url = new URL(s);
						sessionCustomOrigins.set(url.origin, "allowed");
					} catch (_) {
						// Don't care
					}
				}
				return next(args);
			}
		);
	}

	function discreetMode() {
		/**
		 * @param {any} args
		 * @param {(args: any) => void} next
		 */
		const discreetModeHook = (args, next) => {
			if (fbcSettings.discreetMode) {
				return;
			}
			// eslint-disable-next-line consistent-return
			return next(args);
		};

		SDK.hookFunction(
			"ChatRoomCharacterViewDrawBackground",
			HOOK_PRIORITIES.Top,
			discreetModeHook
		);

		SDK.hookFunction("DrawCharacter", HOOK_PRIORITIES.Top, discreetModeHook);
		SDK.hookFunction(
			"NotificationDrawFavicon",
			HOOK_PRIORITIES.Top,
			discreetModeHook
		);

		SDK.hookFunction(
			"DrawImageEx",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof DrawImageEx>} args
			 */
			(args, next) => {
				if (fbcSettings.discreetMode) {
					if (!args) {
						return false;
					}
					const isBackground =
						isString(args[0]) && args[0].startsWith("Backgrounds/");
					const ignoredImages =
						/(^Backgrounds\/(?!Sheet(White)?|grey|White\.|BrickWall\.)|\b(Kneel|Arousal|Activity|Asylum|Cage|Cell|ChangeLayersMouth|Diaper|Kidnap|Logo|Player|Remote|Restriction|SpitOutPacifier|Struggle|Therapy|Orgasm\d|Poses|HouseVincula|Seducer\w+)\b|^data:|^Assets\/(?!Female3DCG\/Emoticon\/(Afk|Sleep|Read|Gaming|Hearing|Thumbs(Up|Down))\/))/u;
					if (isString(args[0]) && ignoredImages.test(args[0])) {
						if (isBackground) {
							args[0] = "Backgrounds/BrickWall.jpg";
							return next(args);
						}
						return false;
					}
					// @ts-ignore
					// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
					if (args[0]?.src && ignoredImages.test(args[0].src)) {
						return false;
					}
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"NotificationTitleUpdate",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof NotificationTitleUpdate>} args
			 */
			(args, next) => {
				if (fbcSettings.discreetMode) {
					const notificationCount = NotificationGetTotalCount(1);
					document.title = `${
						notificationCount > 0 ? `(${notificationCount}) ` : ""
					}${displayText("OnlineChat")}`;
					return;
				}
				// eslint-disable-next-line consistent-return
				return next(args);
			}
		);
	}

	function autoStruggle() {
		SDK.hookFunction(
			"StruggleFlexibilityCheck",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof StruggleFlexibilityCheck>} args
			 */
			(args, next) => {
				if (fbcSettings.autoStruggle) {
					if (
						StruggleProgressFlexCircles &&
						StruggleProgressFlexCircles.length > 0
					) {
						StruggleProgressFlexCircles.splice(0, 1);
						return true;
					}
				}
				return next(args);
			}
		);

		createTimer(() => {
			if (!fbcSettings.autoStruggle) {
				return;
			}

			if (typeof StruggleProgress !== "number" || StruggleProgress < 0) {
				return;
			}

			if (StruggleProgressCurrentMinigame === "Strength") {
				StruggleStrengthProcess(false);
			} else if (StruggleProgressCurrentMinigame === "Flexibility") {
				if (
					StruggleProgressFlexCircles &&
					StruggleProgressFlexCircles.length > 0
				) {
					StruggleFlexibilityProcess(false);
				}
			}
		}, 60);

		createTimer(() => {
			if (!fbcSettings.autoStruggle) {
				return;
			}

			if (typeof StruggleProgress !== "number" || StruggleProgress < 0) {
				return;
			}
			if (StruggleProgressCurrentMinigame === "Dexterity") {
				// Duplicated logic from StruggleDexterity
				const distMult = Math.max(
					-0.5,
					Math.min(
						1,
						(85 -
							Math.abs(
								StruggleProgressDexTarget - StruggleProgressDexCurrent
							)) /
							75
					)
				);
				if (distMult > 0.5) {
					StruggleDexterityProcess();
				}
			}
		}, 0);
	}

	function nicknames() {
		ServerCharacterNicknameRegex = /^[\p{L}0-9\p{Z}'-]+$/u;
	}

	/** @type {(effect: EffectName) => boolean} */
	function addCustomEffect(effect) {
		let updated = false;
		const emoticon = Player.Appearance.find((a) => a.Asset.Name === "Emoticon");
		if (!emoticon) {
			logWarn("Could not find emoticon asset.");
			return updated;
		}
		if (!emoticon.Property) {
			emoticon.Property = { Effect: [effect] };
			updated = true;
		} else if (!emoticon.Property.Effect) {
			emoticon.Property.Effect = [effect];
			updated = true;
		} else if (!emoticon.Property.Effect.includes(effect)) {
			emoticon.Property.Effect.push(effect);
			updated = true;
		}
		if (updated && ServerPlayerIsInChatRoom()) {
			ChatRoomCharacterUpdate(Player);
		}
		return updated;
	}

	/** @type {(effect: EffectName) => boolean} */
	function removeCustomEffect(effect) {
		const emoticon = Player.Appearance.find((a) => a.Asset.Name === "Emoticon");
		let updated = false;
		if (emoticon?.Property?.Effect?.includes(effect)) {
			emoticon.Property.Effect = emoticon.Property.Effect.filter(
				(e) => e !== effect
			);
			updated = true;
		}
		if (updated && ServerPlayerIsInChatRoom()) {
			ChatRoomCharacterUpdate(Player);
		}
		return updated;
	}

	function enableLeashing() {
		addCustomEffect("Leash");
	}

	function disableLeashing() {
		removeCustomEffect("Leash");
	}

	async function leashAlways() {
		await waitFor(() =>
			Player?.Appearance?.some((a) => a.Asset.Name === "Emoticon")
		);
		const emoticon = Player.Appearance.find((a) => a.Asset.Name === "Emoticon");

		if (!emoticon) {
			throw new Error("Could not find emoticon in Player appearance.");
		}

		if (Array.isArray(emoticon.Asset.AllowEffect)) {
			emoticon.Asset.AllowEffect.push("Leash");
		} else {
			// @ts-ignore - not readonly
			emoticon.Asset.AllowEffect = ["Leash"];
		}
		// @ts-ignore - not readonly
		// eslint-disable-next-line @typescript-eslint/no-unsafe-call
		emoticon.Asset.AllowEffect.push("BlurLight");

		if (fbcSettings.leashAlways) {
			enableLeashing();
		} else {
			disableLeashing();
		}
	}

	function toySync() {
		// Handles synchronizing in-game vibrators with real bluetooth devices via buttplut.io
		if (!fbcSettings.toySync) {
			return;
		}

		const frame = document.createElement("iframe");
		frame.src = "./changelog.html";
		frame.classList.add("bce-false-hidden");
		const script = document.createElement("script");
		const notifierScript = document.createElement("script");
		frame.onload = () => {
			if (!frame.contentDocument) {
				throw new Error("frame.contentDocument is null onload");
			}
			frame.contentDocument.head.appendChild(notifierScript);
			frame.contentDocument.head.appendChild(script);
		};
		logInfo("Loading buttplug.io");

		const onload = async () => {
			logInfo("Loaded Buttplug.io");
			/** @type {import('./types/buttplug.io.1.0.17')} */
			// @ts-ignore
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			const bp = frame.contentWindow.Buttplug;

			/** @type {import('./types/buttplug.io.1.0.17').ButtplugClient} */
			const client = new bp.ButtplugClient("BceToySync");
			client.addListener(
				"deviceadded",
				(
					/** @type {import('./types/buttplug.io.1.0.17').ButtplugClientDevice} */
					device
				) => {
					debug("Device connected", device);
					fbcChatNotify(
						displayText(`Vibrator connected: $DeviceName`, {
							$DeviceName: device.Name,
						})
					);
					const deviceSettings = toySyncState.deviceSettings.get(device.Name);
					if (deviceSettings) {
						delete deviceSettings.LastIntensity;
					}
				}
			);
			client.addListener(
				"deviceremoved",
				(
					/** @type {import('./types/buttplug.io.1.0.17').ButtplugClientDevice} */
					device
				) => {
					debug("Device disconnected", device);
					fbcChatNotify(
						displayText(`Vibrator disconnected: $DeviceName`, {
							$DeviceName: device.Name,
						})
					);
				}
			);
			client.addListener("scanningfinished", (data) => {
				debug("Scanning finished", data);
			});

			const connector = new bp.ButtplugWebsocketConnectorOptions();
			connector.Address = "ws://127.0.0.1:12345";
			try {
				await client.connect(connector);
				logInfo("Connected buttplug.io");
			} catch (ex) {
				if (ex) {
					// eslint-disable-next-line no-alert
					alert(
						displayText(
							"buttplug.io is enabled, but server could not be contacted at ws://127.0.0.1:12345. Is Intiface Desktop running? Is another client connected to it?"
						)
					);
					logError("buttplug.io could not connect to server", ex);
					return;
				}
			}

			toySyncState.client = client;

			let lastSync = 0;
			// Sync vibrations from slots
			createTimer(() => {
				if (lastSync > Date.now() - 3000) {
					// Don't change vibes more than once per 3 seconds
					return;
				}

				// 0 is VibrateCmd
				for (const d of client.Devices.filter((dev) =>
					dev.AllowedMessages.includes(0)
				)) {
					const deviceSettings = toySyncState.deviceSettings?.get(d.Name);
					if (!deviceSettings) {
						continue;
					}

					const slot = deviceSettings.SlotName;
					const intensity = Player.Appearance.find(
						(a) => a.Asset.Group.Name === slot
					)?.Property?.Intensity;

					if (deviceSettings.LastIntensity === intensity) {
						continue;
					}
					deviceSettings.LastIntensity = intensity;

					lastSync = Date.now();
					if (typeof intensity !== "number" || intensity < 0) {
						d.vibrate(0);
					} else {
						switch (intensity) {
							case 0:
								d.vibrate(0.1);
								debug(d.Name, slot, "intensity 0.1");
								break;
							case 1:
								d.vibrate(0.4);
								debug(d.Name, slot, "intensity 0.4");
								break;
							case 2:
								d.vibrate(0.75);
								debug(d.Name, slot, "intensity 0.75");
								break;
							case 3:
								d.vibrate(1.0);
								debug(d.Name, slot, "intensity 1");
								break;
							default:
								logWarn("Invalid intensity in ", slot, ":", intensity);
								break;
						}
					}
				}
			}, 0);

			Commands.push({
				Tag: "toybatteries",
				Description: displayText(
					"Shows the battery status of all connected buttplug.io toys"
				),
				Action: () => {
					(async () => {
						if (!client.Connected) {
							fbcChatNotify("buttplug.io is not connected");
							return;
						}

						const batteryDevices = client.Devices.filter((dev) =>
							dev.AllowedMessages.includes(8)
						);
						if (batteryDevices.length === 0) {
							fbcChatNotify("No battery devices connected");
							return;
						}

						const batteryStatus = await Promise.all(
							batteryDevices.map((dev) => dev.batteryLevel())
						);
						for (let i = 0; i < batteryDevices.length; i++) {
							const battery = batteryStatus[i] * 100;
							fbcChatNotify(`${batteryDevices[i].Name}: ${battery}%`);
						}
					})();
				},
			});

			Commands.push({
				Tag: "toyscan",
				Description: displayText("Scans for connected buttplug.io toys"),
				Action: () => {
					if (!client.Connected) {
						fbcChatNotify(displayText("buttplug.io is not connected"));
						return;
					}

					if (client.isScanning) {
						client.stopScanning();
						fbcChatNotify(displayText("Scanning stopped"));
						return;
					}

					client.startScanning();
					fbcChatNotify(displayText("Scanning for toys"));
				},
			});

			await client.startScanning();
		};

		window.onmessage = (
			/** @type {MessageEvent<unknown>} */
			e
		) => {
			if (e.data === "buttplug-loaded") {
				onload();
			}
		};

		notifierScript.textContent = `
		function sleep(ms) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		(async function () {
			while (typeof Buttplug !== "object" || Buttplug === null) {
				await sleep(10);
			}

			await Buttplug.buttplugInit();

			window.top.postMessage("buttplug-loaded", "${window.location.origin}");
		})();
		`;

		script.src =
			"https://cdn.jsdelivr.net/npm/buttplug@1.0.17/dist/web/buttplug.min.js";
		document.body.appendChild(frame);
	}

	async function pastProfiles() {
		if (!fbcSettings.pastProfiles) {
			return;
		}

		const scriptEl = document.createElement("script");
		scriptEl.src = "https://unpkg.com/dexie@3.2.1/dist/dexie.js";
		document.body.appendChild(scriptEl);

		await waitFor(
			() => typeof Dexie !== "undefined" && ServerSocket && ServerIsConnected
		);

		const db = new Dexie("bce-past-profiles");
		db.version(3).stores({
			profiles: "memberNumber, name, lastNick, seen, characterBundle",
			notes: "memberNumber, note, updatedAt",
		});

		ElementCreateTextArea("bceNoteInput");
		/** @type {HTMLTextAreaElement} */
		// @ts-ignore
		const noteInput = document.getElementById("bceNoteInput");
		noteInput.maxLength = 10000;
		noteInput.classList.add("bce-hidden");

		const profiles = db.table("profiles");
		const notes = db.table("notes");

		async function readQuota() {
			try {
				const { quota, usage } = await navigator.storage.estimate();
				debug(
					`current quota usage ${
						usage?.toLocaleString() ?? "?"
					} out of maximum ${quota?.toLocaleString() ?? "?"}`
				);
				return { quota: quota ?? -1, usage: usage ?? 0 };
			} catch (e) {
				logError("reading storage quota information", e);
				return { quota: -1, usage: -1 };
			}
		}

		/** @type {(num: number) => Promise<void>} */
		async function trimProfiles(num) {
			/** @type {FBCSavedProfile[]} */
			let list = await profiles.toArray();
			// Oldest first
			list.sort((a, b) => a.seen - b.seen);
			list = list.slice(0, num);
			debug("deleting", list);
			await profiles.bulkDelete(list.map((p) => p.memberNumber));
		}

		async function quotaSafetyCheck() {
			const { quota, usage } = await readQuota();
			if (usage / quota > 0.9) {
				logInfo(
					`storage quota above 90% utilization (${usage}/${quota}), cleaning some of the least recently seen profiles before saving new one`
				);
				await trimProfiles(10);
			}
		}

		/** @type {(characterBundle: ServerAccountDataSynced) => Promise<void>} */
		async function saveProfile(characterBundle) {
			await quotaSafetyCheck();

			const name = characterBundle.Name;
			const nick = characterBundle.Nickname;

			// Delete unnecessary data
			/** @type {(keyof ServerAccountDataSynced)[]} */
			const unnecessaryFields = [
				"ActivePose",
				"Inventory",
				"BlockItems",
				"LimitedItems",
				"FavoriteItems",
				"ArousalSettings",
				"OnlineSharedSettings",
				"WhiteList",
				"BlackList",
				"Crafting",
			];
			for (const field of unnecessaryFields) {
				delete characterBundle[field];
			}

			debug(`saving profile of ${nick ?? name} (${name})`);
			try {
				await profiles.put({
					memberNumber: characterBundle.MemberNumber,
					name,
					lastNick: nick,
					seen: Date.now(),
					characterBundle: JSON.stringify(characterBundle),
				});
			} catch (e) {
				const { quota, usage } = await readQuota();
				logError(`unable to save profile (${usage}/${quota}):`, e);
			}
		}

		SDK.hookFunction(
			"ChatRoomSync",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof ChatRoomSync>} args
			 */
			(args, next) => {
				const [data] = args;
				if (data?.Character?.length) {
					for (const char of data.Character) {
						saveProfile(deepCopy(char));
					}
				}
				next(args);
			}
		);

		SDK.hookFunction(
			"ChatRoomSyncSingle",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof ChatRoomSyncSingle>} args
			 */
			(args, next) => {
				const [data] = args;
				if (data?.Character?.MemberNumber) {
					saveProfile(deepCopy(data.Character));
				}
				next(args);
			}
		);

		SDK.hookFunction(
			"InformationSheetRun",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof InformationSheetRun>} args
			 */
			(args, next) => {
				if (!InformationSheetSelection) {
					throw new Error(
						"InformationSheetSelection is null in InformationSheetRun"
					);
				}
				if (InformationSheetSelection.BCESeen) {
					const ctx = w.MainCanvas.getContext("2d");
					if (!ctx) {
						throw new Error("could not get canvas 2d context");
					}
					ctx.textAlign = "left";
					DrawText(
						displayText("Last seen: ") +
							new Date(InformationSheetSelection.BCESeen).toLocaleString(),
						1200,
						75,
						"grey",
						"black"
					);
					ctx.textAlign = "center";
				}
				return next(args);
			}
		);

		/** @type {(memberNumber: number) => Promise<void>} */
		async function openCharacter(memberNumber) {
			try {
				/** @type {FBCSavedProfile} */
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
				const profile = await profiles.get(memberNumber);
				const C = CharacterLoadOnline(
					/** @type {ServerAccountDataSynced} */ (
						parseJSON(profile.characterBundle)
					),
					memberNumber
				);
				C.BCESeen = profile.seen;
				if (CurrentScreen === "ChatRoom") {
					hideChatRoomElements();
					if (ChatRoomData) {
						ChatRoomBackground = ChatRoomData.Background;
					}
				}
				InformationSheetLoadCharacter(C);
			} catch (e) {
				fbcChatNotify(displayText("No profile found"));
				logError("reading profile", e);
			}
		}

		Commands.push({
			Tag: "profiles",
			Description: displayText(
				"<filter> - List seen profiles, optionally searching by member number or name"
			),
			Action: (argums) => {
				(async (args) => {
					/** @type {FBCSavedProfile[]} */
					let list = await profiles.toArray();
					list = list.filter(
						(p) =>
							!args ||
							p.name.toLowerCase().includes(args) ||
							p.memberNumber.toString().includes(args) ||
							p.lastNick?.toLowerCase().includes(args)
					);
					list.sort((a, b) => b.seen - a.seen);
					const matches = list.length;
					list = list.slice(0, 100);
					list.sort(
						(a, b) =>
							-(b.lastNick ?? b.name).localeCompare(a.lastNick ?? a.name)
					);
					const lines = list.map((p) => {
						const div = document.createElement("div");
						div.textContent = displayText(
							`$nickAndName ($memberNumber) - Seen: $seen`,
							{
								$nickAndName: p.lastNick ? `${p.lastNick} / ${p.name}` : p.name,
								$memberNumber: p.memberNumber.toString(),
								$seen: new Date(p.seen).toLocaleDateString(),
							}
						);
						const link = document.createElement("a");
						link.textContent = displayText("Open");
						link.href = `#`;
						link.classList.add("bce-profile-open");
						link.addEventListener("click", (e) => {
							e.preventDefault();
							e.stopPropagation();
							openCharacter(p.memberNumber);
						});
						div.prepend(link);
						return div;
					});
					const header = document.createElement("h3");
					header.textContent = displayText("Saved Profiles");
					header.style.marginTop = "0";
					const footer = document.createElement("div");
					footer.textContent = displayText(
						"showing $num most recent of $total total profiles matching search",
						{
							$num: list.length.toLocaleString(),
							$total: matches.toLocaleString(),
						}
					);
					fbcChatNotify([header, ...lines, footer]);
				})(argums);
			},
		});

		// Notes view
		let inNotes = false;
		let noteUpdatedAt = 0;

		/**
		 * @param {unknown} n
		 * @returns {n is FBCNote}
		 */
		function isNote(n) {
			return isNonNullObject(n) && typeof n.note === "string";
		}

		function showNoteInput() {
			if (
				!InformationSheetSelection ||
				!InformationSheetSelection.MemberNumber
			) {
				throw new Error("invalid InformationSheetSelection in notes");
			}

			inNotes = true;
			noteInput.classList.remove("bce-hidden");
			noteInput.value = "Loading...";
			notes
				.get(InformationSheetSelection.MemberNumber)
				.then((note) => {
					if (isNote(note)) {
						noteInput.value = note?.note || "";
						noteUpdatedAt = note?.updatedAt || 0;
					} else {
						throw new Error("invalid note");
					}
				})
				.catch((reason) => {
					noteInput.value = "";
					logError("getting note", reason);
				});
		}

		SDK.hookFunction(
			"CharacterLoadOnline",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof CharacterLoadOnline>} args
			 */
			(args, next) => {
				const C = next(args);
				if (isCharacter(C) && C.MemberNumber) {
					notes.get(C.MemberNumber).then((note) => {
						C.FBCNoteExists = Boolean(isNote(note) && note.note);
					});
				}
				return C;
			}
		);

		function hideNoteInput() {
			noteInput.classList.add("bce-hidden");
			inNotes = false;
		}

		/** @type {(e: KeyboardEvent) => void} */
		function keyHandler(e) {
			if (e.key === "Escape" && inNotes) {
				hideNoteInput();
				e.stopPropagation();
				e.preventDefault();
			}
		}

		document.addEventListener("keydown", keyHandler, true);
		document.addEventListener("keypress", keyHandler, true);

		SDK.hookFunction(
			"OnlineProfileRun",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof OnlineProfileRun>} args
			 */
			(args, next) => {
				if (inNotes) {
					DrawText(
						displayText("Personal notes (only you can read these):"),
						910,
						105,
						"Black",
						"Gray"
					);
					if (noteUpdatedAt) {
						drawTextFitLeft(
							displayText("Last saved: $date", {
								$date: new Date(noteUpdatedAt).toLocaleString(),
							}),
							60,
							105,
							400,
							"Black",
							"Gray"
						);
					}
					ElementPositionFix("bceNoteInput", 36, 100, 160, 1790, 750);
					// Always draw the accept button; normal method shows it when is player
					DrawButton(
						1720,
						60,
						90,
						90,
						"",
						"White",
						"Icons/Accept.png",
						TextGet("LeaveSave")
					);
					DrawButton(
						1820,
						60,
						90,
						90,
						"",
						"White",
						"Icons/Cancel.png",
						TextGet("LeaveNoSave")
					);
					return null;
				}
				DrawButton(
					1620,
					60,
					90,
					90,
					"",
					"White",
					"Icons/Notifications.png",
					displayText("[FBC] Notes")
				);
				return next(args);
			}
		);

		SDK.hookFunction(
			"OnlineProfileClick",
			HOOK_PRIORITIES.OverrideBehaviour,
			/**
			 * @param {Parameters<typeof OnlineProfileClick>} args
			 */
			(args, next) => {
				if (inNotes) {
					if (MouseIn(1720, 60, 90, 90)) {
						(async function () {
							await quotaSafetyCheck();

							if (
								!InformationSheetSelection ||
								!InformationSheetSelection.MemberNumber
							) {
								throw new Error("invalid InformationSheetSelection in notes");
							}

							// Save note
							await notes.put({
								memberNumber: InformationSheetSelection.MemberNumber,
								note: noteInput.value,
								updatedAt: Date.now(),
							});
						})();
						hideNoteInput();
					} else if (MouseIn(1820, 60, 90, 90)) {
						hideNoteInput();
					}
					return;
				} else if (!inNotes && MouseIn(1620, 60, 90, 90)) {
					showNoteInput();
				}
				next(args);
			}
		);

		if (
			navigator.storage?.persisted &&
			!(await navigator.storage.persisted())
		) {
			if (!(await navigator.storage.persist())) {
				logWarn("Profile storage may not be persistent.");
			}
		}
	}

	function pendingMessages() {
		/** @type {(dictionary: Record<string, unknown>[], key: string, value: unknown) => Record<string, unknown>[]} */
		function addToDictionary(dictionary, key, value) {
			if (!Array.isArray(dictionary)) {
				dictionary = [];
			}
			dictionary.push({ Tag: key, Text: value });
			return dictionary;
		}

		let nonce = 0;

		SDK.hookFunction(
			"ChatRoomMessage",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof ChatRoomMessage>} args
			 */
			(args, next) => {
				const ret = next(args);
				if (
					fbcSettings.pendingMessages &&
					args?.length &&
					isChatMessage(args[0]) &&
					Array.isArray(args[0].Dictionary)
				) {
					const [message] = args;
					// @ts-ignore - custom dictionary Tag
					const tag = message.Dictionary?.find?.((d) => d.Tag === "fbc_nonce");
					if (tag) {
						// @ts-ignore - custom dictionary Tag
						// eslint-disable-next-line @typescript-eslint/restrict-template-expressions
						const el = document.querySelector(`[data-nonce='${tag.Text}']`);
						if (el) {
							el.remove();
						}
					}
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"ServerSend",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof ServerSend>} args
			 */
			(args, next) => {
				if (
					fbcSettings.pendingMessages &&
					args?.length >= 2 &&
					args[0] === "ChatRoomChat" &&
					isChatMessage(args[1]) &&
					args[1].Type !== HIDDEN &&
					!args[1].Target
				) {
					nonce++;
					if (nonce >= Number.MAX_SAFE_INTEGER) {
						nonce = 0;
					}
					// @ts-ignore - custom dictionary Tag
					args[1].Dictionary = addToDictionary(
						// @ts-ignore - custom dictionary Tag
						args[1].Dictionary,
						"fbc_nonce",
						nonce
					);
					const div = document.createElement("div");
					div.classList.add("ChatMessage", "bce-pending");
					div.setAttribute("data-time", ChatRoomCurrentTime());
					div.setAttribute("data-sender", Player.MemberNumber?.toString());
					div.setAttribute("data-nonce", nonce.toString());
					switch (args[1].Type) {
						case "Chat":
							{
								div.classList.add("ChatMessageChat");
								const name = document.createElement("span");
								name.classList.add("ChatMessageName");
								name.style.color = Player.LabelColor || "";
								name.textContent = CharacterNickname(Player);
								div.appendChild(name);
								div.appendChild(
									document.createTextNode(`: ${args[1].Content}`)
								);
							}
							break;
						case "Emote":
						case "Action":
							div.classList.add("ChatMessageEmote");
							div.appendChild(
								document.createTextNode(
									`*${
										args[1].Type === "Emote"
											? `${CharacterNickname(Player)}: `
											: ""
									}${args[1].Content}*`
								)
							);
							break;
						default:
							return next(args);
					}
					const loader = document.createElement("div");
					loader.classList.add("lds-ellipsis");
					for (let i = 0; i < 4; i++) {
						const dot = document.createElement("div");
						loader.appendChild(dot);
					}
					div.appendChild(loader);
					const scroll = ElementIsScrolledToEnd("TextAreaChatLog");
					const textarea = document.getElementById("TextAreaChatLog");
					if (textarea) {
						textarea.appendChild(div);
						if (scroll) {
							ElementScrollToEnd("TextAreaChatLog");
						}
					}
				}
				return next(args);
			}
		);
	}

	function hideHiddenItemsIcon() {
		SDK.hookFunction(
			"DrawCharacter",
			HOOK_PRIORITIES.ModifyBehaviourLow,
			/**
			 * @param {Parameters<typeof DrawCharacter>} args
			 */
			(args, next) => {
				const [c] = args;
				if (!c || !fbcSettings.hideHiddenItemsIcon) {
					return next(args);
				}
				const backup = c.HasHiddenItems;
				c.HasHiddenItems = false;
				const ret = next(args);
				c.HasHiddenItems = backup;
				return ret;
			}
		);
	}

	function richOnlineProfile() {
		const descTextArea = "DescriptionInput";
		const descRich = "bceRichOnlineProfile";
		let originalShown = true;

		function hideOriginalTextArea() {
			const ta = document.getElementById(descTextArea);
			if (!ta) {
				return;
			}
			originalShown = false;
			ta.style.display = "none";
		}

		function showOriginalTextArea() {
			const ta = document.getElementById(descTextArea);
			if (!ta) {
				return;
			}
			originalShown = true;
			ta.style.display = "";
		}

		function enableRichTextArea() {
			hideOriginalTextArea();

			const div = document.createElement("div");
			div.id = descRich;
			div.style.overflowY = "scroll";
			div.style.overflowX = "hidden";
			div.style.overflowWrap = "break-word";
			div.style.whiteSpace = "pre-wrap";
			div.style.background = "rgb(244, 236, 216)";
			div.style.color = "rgb(45, 35, 27)";
			div.style.border = "2px solid black";
			div.style.padding = "2px";
			div.classList.add("bce-rich-textarea");
			div.textContent = InformationSheetSelection?.Description || "";
			processChatAugmentsForLine(div, () => false);

			document.body.append(div);
			resizeRichTextArea();
		}

		function resizeRichTextArea() {
			ElementPositionFix(descRich, 36, 100, 160, 1790, 750);
		}

		function disableRichTextArea() {
			const div = document.getElementById(descRich);
			if (div) {
				div.remove();
			}

			showOriginalTextArea();
		}

		SDK.hookFunction(
			"OnlineProfileLoad",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof OnlineProfileLoad>} args
			 */
			(args, next) => {
				originalShown = true;
				const ret = next(args);
				const ta = document.getElementById(descTextArea);
				if (!fbcSettings.richOnlineProfile || !ta) {
					return ret;
				}

				enableRichTextArea();

				return ret;
			}
		);

		const toggleEditButtonPos = /** @type {const} */ ([90, 60, 90, 90]);
		SDK.hookFunction(
			"OnlineProfileRun",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof OnlineProfileRun>} args
			 */
			(args, next) => {
				if (!fbcSettings.richOnlineProfile) {
					return next(args);
				}
				DrawButton(
					...toggleEditButtonPos,
					"",
					"White",
					"Icons/Crafting.png",
					displayText("Toggle Editing Mode")
				);

				const ret = next(args);
				if (!originalShown) {
					hideOriginalTextArea();
					resizeRichTextArea();
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"OnlineProfileClick",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof OnlineProfileClick>} args
			 */
			(args, next) => {
				if (!fbcSettings.richOnlineProfile) {
					return next(args);
				}
				if (MouseIn(...toggleEditButtonPos)) {
					if (originalShown) {
						enableRichTextArea();
					} else {
						disableRichTextArea();
					}
					return true;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"OnlineProfileExit",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof OnlineProfileExit>} args
			 */
			(args, next) => {
				if (!originalShown) {
					disableRichTextArea();
				}
				return next(args);
			}
		);
	}

	async function crafting() {
		await waitFor(() => Array.isArray(Commands) && Commands.length > 0);

		const importPosition = /** @type {const} */ ([1485, 15, 90, 90]);
		const exportPosition = /** @type {const} */ ([1585, 15, 90, 90]);

		function importCraft() {
			FUSAM.modals.open({
				prompt: displayText("Paste the craft here"),
				callback: (action, str) => {
					if (action !== "submit" || !str) {
						return;
					}
					try {
						const craft = /** @type {CraftingItem} */ (
							parseJSON(LZString.decompressFromBase64(str))
						);
						if (!isNonNullObject(craft)) {
							logError(craft);
							throw new Error(`invalid craft type ${typeof craft} ${str}`);
						}
						for (const [key, value] of objEntries(craft)) {
							if (
								!isString(value) &&
								!Number.isInteger(value) &&
								value !== false &&
								value !== true &&
								value !== null &&
								!isNonNullObject(value)
							) {
								logWarn("potentially invalid craft bundle:", key, "was", value);
							}
						}
						CraftingSelectedItem = CraftingConvertItemToSelected(craft);
						CraftingModeSet("Name");
					} catch (e) {
						logError("importing craft", e);
					}
				},
				input: {
					initial: "",
					readonly: false,
					type: "textarea",
				},
			});
		}

		SDK.hookFunction(
			"CraftingClick",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof CraftingClick>} args
			 */
			(args, next) => {
				switch (CraftingMode) {
					case "Name":
						if (MouseIn(...exportPosition)) {
							FUSAM.modals.open({
								prompt: displayText("Copy the craft here"),
								input: {
									initial: LZString.compressToBase64(
										JSON.stringify(CraftingConvertSelectedToItem())
									),
									readonly: true,
									type: "textarea",
								},
								callback: () => {
									debug("exported craft");
								},
							});
						} else if (MouseIn(...importPosition)) {
							importCraft();
						}
						break;
					default:
						break;
				}
				return next(args);
			}
		);

		SDK.hookFunction(
			"CraftingRun",
			HOOK_PRIORITIES.ModifyBehaviourMedium,
			/**
			 * @param {Parameters<typeof CraftingRun>} args
			 */
			(args, next) => {
				const ret = next(args);
				if (CraftingMode === "Name") {
					DrawButton(...importPosition, displayText("Import"), "white");
					DrawButton(...exportPosition, displayText("Export"), "white");
				}
				return ret;
			}
		);

		SDK.hookFunction(
			"DrawItemPreview",
			HOOK_PRIORITIES.AddBehaviour,
			/**
			 * @param {Parameters<typeof DrawItemPreview>} args
			 */
			(args, next) => {
				const ret = next(args);
				const [item, , x, y] = args;
				if (item) {
					const { Craft } = item;
					if (
						MouseIn(
							x,
							y,
							DialogInventoryGrid.itemWidth,
							DialogInventoryGrid.itemHeight
						) &&
						Craft
					) {
						drawTooltip(
							x,
							y,
							DialogInventoryGrid.itemWidth,
							displayText(Craft.Property),
							"center"
						);
						drawTooltip(
							1000,
							y - 70,
							975,
							`${displayText("Description:")} ${
								Craft.Description || "<no description>"
							}`,
							"left"
						);
					}
				}
				return ret;
			}
		);
	}

	function numericArousalMeters() {
		let isExpanded = false;
		let increasing = false;
		SDK.hookFunction(
			"DrawArousalMeter",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof DrawArousalMeter>} args
			 */
			(args, next) => {
				const [C] = args;
				isExpanded = !!C.ArousalZoom;
				const progressTimer = C.ArousalSettings?.ProgressTimer ?? 0;
				const activityGoing = progressTimer > 0;
				const vibratorLevel = C.ArousalSettings?.VibratorLevel ?? 0;
				const vibed = vibratorLevel > 0;
				const progress = C.ArousalSettings?.Progress ?? 0;
				const vibedOnEdge =
					(C.IsEdged() || C.HasEffect("DenialMode")) && progress >= 95;
				increasing = activityGoing || (vibed && !vibedOnEdge);
				const ret = next(args);
				isExpanded = false;
				return ret;
			}
		);

		SDK.hookFunction(
			"DrawArousalThermometer",
			HOOK_PRIORITIES.Observe,
			/**
			 * @param {Parameters<typeof DrawArousalThermometer>} args
			 */ (args, next) => {
				const ret = next(args);
				if (fbcSettings.numericArousalMeter && isExpanded) {
					const [x, y, zoom, progress] = args;
					let color = "white";
					if (progress >= 95) {
						if (increasing) {
							color = "red";
						} else {
							color = "hotpink";
						}
					} else if (progress >= 70) {
						color = "pink";
					}
					DrawTextFit(
						progress.toLocaleString() + (increasing ? "↑" : " "),
						x + 50 * zoom,
						y - 30 * zoom,
						100 * zoom,
						color,
						"black"
					);
				}

				return ret;
			}
		);
	}

	function hideChatRoomElements() {
		const chatRoomElements = ["InputChat", "TextAreaChatLog"];
		for (const id of chatRoomElements) {
			const el = document.getElementById(id);
			if (el) {
				el.style.display = "none";
			}
		}
		ChatRoomChatHidden = true;
	}

	(function () {
		const sendHeartbeat = () => {
			/**
			 * @type {{
			 * Version: string;
			 * GameVersion: string;
			 * InRoom: boolean;
			 * InPrivate: boolean;
			 * InTampermonkey: boolean;
			 * FUSAM: boolean;
			 * FBCviaFUSAM: boolean;}}
			 */
			const payload = {
				Version: FBC_VERSION,
				GameVersion,
				// !! to avoid passing room name to statbot, only presence inside a room or not
				InRoom: !!Player.LastChatRoom,
				InPrivate: !!Player.LastChatRoom?.Private,
				// eslint-disable-next-line camelcase
				InTampermonkey: typeof GM_info !== "undefined",
				FUSAM: !!FUSAM.present,
				FBCviaFUSAM: FUSAM.addons?.FBC?.status === "loaded",
			};
			SDK.callOriginal("ServerSend", [
				"AccountBeep",
				{
					BeepType: "Leash",
					// FBC statbot, which only collects anonymous aggregate version and usage data to justify supporting or dropping support for features
					MemberNumber: 61197,
					Message: JSON.stringify(payload),
					// IsSecret: true to avoid passing room name to statbot
					IsSecret: true,
				},
			]);
		};
		setTimeout(sendHeartbeat, 15000);
		// 5 minutes
		createTimer(sendHeartbeat, 1000 * 60 * 5);
	})();

	/**
	 * @param {string | null} target
	 * @param {boolean} [limitVisible]
	 */
	function findDrawnCharacters(target, limitVisible = false) {
		let baseList = limitVisible ? ChatRoomCharacterDrawlist : ChatRoomCharacter;

		if (ChatRoomMapViewIsActive()) {
			baseList = baseList.filter(ChatRoomMapViewCharacterIsVisible);
		}

		if (target === null) {
			return baseList;
		}

		let targetMembers = [];
		if (/^\d+$/u.test(target)) {
			targetMembers = [
				baseList.find((c) => c.MemberNumber === parseInt(target)),
			];
		} else {
			targetMembers = baseList.filter(
				(c) =>
					CharacterNickname(c).split(" ")[0]?.toLowerCase() ===
						target?.toLowerCase() ||
					c.Name.split(" ")[0].toLowerCase() === target?.toLowerCase()
			);
		}
		return targetMembers.filter(Boolean);
	}

	/** @type {(x: number, y: number, width: number, text: string, align: "left" | "center") => void} */
	function drawTooltip(x, y, width, text, align) {
		const canvas = w.MainCanvas.getContext("2d");
		if (!canvas) {
			throw new Error("could not get canvas 2d context");
		}
		const bak = canvas.textAlign;
		canvas.textAlign = align;
		DrawRect(x, y, width, 65, "#FFFF88");
		DrawEmptyRect(x, y, width, 65, "black", 2);
		DrawTextFit(
			text,
			align === "left" ? x + 3 : x + width / 2,
			y + 33,
			width - 6,
			"black"
		);
		canvas.textAlign = bak;
	}

	/** @type {(text: string, x: number, y: number, width: number, color: string, backColor?: string) => void} */
	// eslint-disable-next-line no-undefined
	function drawTextFitLeft(text, x, y, width, color, backColor = undefined) {
		const ctx = w.MainCanvas.getContext("2d");
		if (!ctx) {
			throw new Error("could not get canvas 2d context");
		}
		const bk = ctx.textAlign;
		ctx.textAlign = "left";
		DrawTextFit(text, x, y, width, color, backColor);
		ctx.textAlign = bk;
	}

	/** @type {(cb: () => void, intval: number) => void} */
	function createTimer(cb, intval) {
		let lastTime = Date.now();
		SDK.hookFunction(
			"GameRun",
			HOOK_PRIORITIES.Top,
			/**
			 * @param {Parameters<typeof GameRun>} args
			 */ (args, next) => {
				const ts = Date.now();
				if (ts - lastTime > intval) {
					lastTime = ts;
					cb();
				}
				return next(args);
			}
		);
	}

	/**
	 * @param {number} ms
	 */
	function sleep(ms) {
		// eslint-disable-next-line no-promise-executor-return
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/** @type {(s: unknown) => s is string} */
	function isString(s) {
		return typeof s === "string";
	}

	/** @type {(o: unknown) => o is Record<string, any>} */
	function isNonNullObject(o) {
		return !!o && typeof o === "object" && !Array.isArray(o);
	}

	/** @type {(m: unknown) => m is ServerChatRoomMessage} */
	function isChatMessage(m) {
		return (
			isNonNullObject(m) &&
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			typeof m.Type === "string" &&
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			typeof m.Content === "string"
		);
	}

	/** @type {(c: unknown) => c is Character} */
	function isCharacter(c) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		return isNonNullObject(c) && typeof c.IsPlayer === "function";
	}

	/** @type {(c: unknown) => c is (string | string[])} */
	function isStringOrStringArray(c) {
		return isString(c) || (Array.isArray(c) && c.every(isString));
	}

	/** @type {(o: unknown) => o is ItemBundle[][]} */
	function isWardrobe(o) {
		return (
			Array.isArray(o) && o.every((b) => isItemBundleArray(b) || b === null)
		);
	}

	/** @type {(o: unknown) => o is ItemBundle[]} */
	function isItemBundleArray(o) {
		return Array.isArray(o) && o.every(isItemBundle);
	}

	/** @type {(o: unknown) => o is ItemBundle} */
	function isItemBundle(o) {
		return (
			isNonNullObject(o) &&
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			typeof o.Name === "string" &&
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			typeof o.Group === "string"
		);
	}

	/**
	 * @param {number} [id]
	 * @param {number} [def]
	 */
	function mustNum(id, def = -Number.MAX_SAFE_INTEGER) {
		return id ?? def;
	}

	/** @type {<T>(o: T) => T} */
	function deepCopy(o) {
		// eslint-disable-next-line
		return structuredClone(o);
	}

	/**
	 * @template T
	 * @param {T} obj
	 */
	function objEntries(obj) {
		if (!isNonNullObject(obj)) {
			return [];
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-return
		return /** @type {[keyof T, T[keyof T]][]} */ (Object.entries(obj));
	}

	/**
	 * @template T
	 * @param {string | null} jsonString
	 * @throws {SyntaxError} If the string to parse is not valid JSON.
	 */
	function parseJSON(jsonString) {
		if (jsonString === null) {
			return null;
		}
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return
			return /** @type {T} */ (/** @type {unknown} */ (JSON.parse(jsonString)));
		} catch (e) {
			logError("parsing JSON", e);
			return null;
		}
	}

	// Confirm leaving the page to prevent accidental back button, refresh, or other navigation-related disruptions
	w.addEventListener(
		"beforeunload",
		(e) => {
			if (toySyncState.client?.Connected) {
				// Stop vibrating toys
				for (const device of toySyncState.client.Devices.filter((d) =>
					d.AllowedMessages.includes(0)
				)) {
					device.vibrate(0);
				}
			}
			if (fbcSettings.confirmLeave) {
				e.preventDefault();
				// @ts-ignore - TS thinks it's private, pffft we don't respect that
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call
				ServerSocket.io.disconnect();
				CommonSetScreen("Character", "Relog");
				ServerSocket.io.connect();
				return (e.returnValue = "Are you sure you want to leave the club?");
			}
			return null;
		},
		{
			capture: true,
		}
	);
}

ForBetterClub();
