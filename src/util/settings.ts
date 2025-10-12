// oxlint-disable explicit-module-boundary-types explicit-function-return-type
import { sendHello } from "../functions/hiddenMessageHandler";
import { toySyncState, type FBCToySetting } from "../functions/toySync";
import { fbcBeepNotify } from "./hooks";
import { debug, logInfo, logWarn, logError } from "./logger";
import {
  waitFor,
  sleep,
  isString,
  parseJSON,
  isNonNullObject,
  removeCustomEffect,
  enableLeashing,
  disableLeashing,
} from "./utils";
import { loadExtendedWardrobe, loadLocalWardrobe } from "../functions/extendedWardrobe";
import {
  settingsVersion,
  fbcChangelog,
  DEFAULT_WARDROBE_SIZE,
  EXPANDED_WARDROBE_SIZE,
  LOCAL_WARDROBE_SIZE,
  BCE_MAX_AROUSAL,
  BCE_COLOR_ADJUSTMENTS_CLASS_NAME,
  // DISCORD_INVITE_URL,
} from "./constants";
import { displayText } from "./localization";
import { augmentedChatNotify } from "../functions/chatAugments";
import { createChatOptions } from "../functions/antiGarbling";

declare global {
  interface PlayerOnlineSettings {
    /** @deprecated */ BCE: string;
    /** @deprecated */ BCEWardrobe: string;
  }
  interface CharacterOnlineSharedSettings {
    Uwall: boolean;
    Ulist: number[];
  }
}

export type SettingsCategory = "chat" | "activities" | "appearance" | "immersion" | "antigarble" | "performance" | "misc" | "cheats" | "buttplug";
type SideEffects<Type> = (newValue: Type, init: boolean) => void;
export interface CheckboxSetting {
  label: string;
  type: "checkbox";
  value: boolean;
  disabled: () => boolean | null;
  sideEffects: SideEffects<boolean>;
  category: SettingsCategory | "hidden";
  description: string;
}
export interface SelectSetting {
  label: string;
  type: "select";
  value: string;
  options: string[];
  tooltips: string[];
  disabled: () => boolean | null;
  sideEffects: SideEffects<string>;
  category: SettingsCategory | "hidden";
  description: string;
}
export interface InputSetting {
  label: string;
  type: "input";
  value: string;
  disabled: () => boolean | null;
  sideEffects: SideEffects<string>;
  category: SettingsCategory | "hidden";
  description: string;
}
declare global {
  interface ExtensionSettings {
    FBC: string;
    FBCWardrobe: string;
    WCEOverrides: string;
  }
}

// @ts-expect-error -- this is fully initialized in loadSettings
export let fbcSettings: { [Property in keyof (typeof defaultSettings)]: (typeof defaultSettings)[Property]["value"] } & { version: number } = {};
let postSettingsHasRun = false;

export const defaultSettings = {
  animationEngine: {
    label: "Animation Engine",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      if (newValue && Player.ArousalSettings) {
        // Disable conflicting settings
        Player.ArousalSettings.AffectExpression = false;
      }
      if (!newValue) {
        fbcSettings.expressions = false;
        fbcSettings.activityExpressions = false;
      }
      debug("animationEngine", newValue);
    },
    category: "activities",
    description: "Enables the animation engine. This will replace the game's expression and pose system.",
  },
  expressions: {
    label: "Automatic Arousal Expressions (Replaces Vanilla)",
    type: "checkbox",
    value: false,
    disabled: () => !fbcSettings.animationEngine,
    sideEffects: (newValue) => {
      debug("expressions", newValue);
    },
    category: "activities",
    description: "Automatically express arousal when performing an activity (requires Animation Engine).",
  },
  activityExpressions: {
    label: "Activity Expressions",
    type: "checkbox",
    value: false,
    disabled: () => !fbcSettings.animationEngine,
    sideEffects: (newValue) => {
      debug("activityExpressions", newValue);
    },
    category: "activities",
    description: "Automatically express reactions to certain activities (requires Animation Engine).",
  },
  alternateArousal: {
    label: "Alternate Arousal (Replaces Vanilla, requires hybrid/locked arousal meter)",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      sendHello();
      Player.BCEArousal = !!newValue;
      Player.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, Player.ArousalSettings?.Progress ?? 0);
      debug("alternateArousal", newValue);
    },
    category: "activities",
    description: "More intense activities will affect arousal faster.",
  },
  stutters: {
    label: "Alternative speech stutter",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("stutters", newValue);
    },
    category: "activities",
    description: "More stuttering at high arousal, moans between words with vibrators.",
  },
  numericArousalMeter: {
    label: "Show numeric arousal meter",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("numericArousalMeter", newValue);
    },
    category: "activities",
    description: "Shows the numeric value of arousal meters when expanded.",
  },
  layeringHide: {
    label: "[Beta] Allow configuring layer hiding in layering menu",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("layeringHide", newValue);
    },
    category: "appearance",
    description: "Allows you to configure which lower layers an item should hide or not (changes only visible to other WCE players).",
  },
  copyColor: {
    label: "Enable option to copy color to all item's of the same type",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("copyColor", newValue);
    },
    category: "appearance",
    description: "Enable option to copy color to all item's of the same type.",
  },
  extendedWardrobe: {
    label: "Extended wardrobe slots (96)",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue, init: boolean) => {
      debug("extendedWardrobe", newValue);
      if (newValue) {
        if (Player.Wardrobe) {
          WardrobeSize = EXPANDED_WARDROBE_SIZE;
          // Call compress wardrobe to save existing outfits, if another addon has extended the wardrobe
          loadExtendedWardrobe(Player.Wardrobe, init).then(w => CharacterCompressWardrobe(w));
        } else {
          logWarn("Player.Wardrobe not found, skipping wardrobe extension");
        }
      } else {
        // Restore original size
        fbcSettings.localWardrobe = false;
        WardrobeSize = DEFAULT_WARDROBE_SIZE;
        WardrobeFixLength();
        CharacterAppearanceWardrobeOffset = 0;
      }
    },
    category: "appearance",
    description: "Increase the amount of wardrobe slots to save more outfits.",
  },
  localWardrobe: {
    label: "Local Wardrobe (+288)",
    type: "checkbox",
    value: false,
    disabled: () => !fbcSettings.extendedWardrobe,
    sideEffects: (newValue) => {
      debug("localWardrobe", newValue);
      if (newValue) {
        if (Player.Wardrobe) {
          WardrobeSize = LOCAL_WARDROBE_SIZE;
          loadLocalWardrobe(Player.Wardrobe);
          // Call compress wardrobe to save existing outfits, if another addon has extended the wardrobe
          CharacterCompressWardrobe(Player.Wardrobe);
        } else {
          logWarn("Player.Wardrobe not found, skipping wardrobe extension");
        }
      } else if (fbcSettings.extendedWardrobe) {
        // Restore original size
        WardrobeSize = EXPANDED_WARDROBE_SIZE;
        WardrobeFixLength();
        CharacterAppearanceWardrobeOffset = 0;
      }
    },
    category: "appearance",
    description: "Enables the Local Wardrobe - save 288 additional outfits on your device (not synced between devices, but shared between alts on the same device).",
  },
  privateWardrobe: {
    label: "Replace wardrobe list with character previews",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("privateWardrobe", newValue);
    },
    category: "appearance",
    description: "Allows you to preview all saved outfits at a glance, no more having to remember names.",
  },
  confirmWardrobeSave: {
    label: "Confirm overriding wardrobe outfits",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("confirmWardrobeSave", newValue);
    },
    category: "appearance",
    description: "When saving over an already existing wardrobe outfit you'll ask for confirmation, preventing accidentally overwriting outfits.",
  },
  automateCacheClear: {
    label: "Clear Drawing Cache Hourly",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("automateCacheClear", newValue);
    },
    category: "performance",
    description:
      "Automatically clears the drawing cache every hour, preventing memory usage from growing out of control during long play sessions.",
  },
  manualCacheClear: {
    label: "Adds a clear / reload drawing cache button",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("manualCacheClear", newValue);
    },
    category: "performance",
    description:
      "Adds a button to the chat room menu to clear and reload the drawing cache of all characters, helping to fix buged / non-loaded assets.",
  },
  instantMessenger: {
    label: "Instant messenger",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("instantMessenger", newValue);
    },
    category: "chat",
    description:
      "Allows you to send messages to other players without having to open the friends list, with enhancements.",
  },
  augmentChat: {
    label: "Chat Links and Embeds",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("augmentChat", newValue);
    },
    category: "chat",
    description: "Adds clickable links and image embeds from trusted domains only (e.g. imgur) to chat messages.",
  },
  ctrlEnterOoc: {
    label: "Use Ctrl+Enter to OOC",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("ctrlEnterOoc", newValue);
    },
    category: "chat",
    description: "Allows you to use Ctrl+Enter to send OOC messages.",
  },
  whisperInput: {
    label: "Use italics for input when whispering",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("whisperInput", newValue);
    },
    category: "chat",
    description: "Changes the input field to italics when you're in whisper mode to make it more obvious.",
  },
  chatColors: {
    label: "Improve colors for readability",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue: boolean) => {
      document.body.classList.toggle(BCE_COLOR_ADJUSTMENTS_CLASS_NAME, newValue);
      debug("chatColors", newValue);
    },
    category: "chat",
    description:
      "Improves contrast between the colors used for chat messages to comply with web accessibility standards.",
  },
  friendPresenceNotifications: {
    label: "Show friend presence notifications",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("friendPresenceNotifications", newValue);
      if (!newValue) {
        fbcSettings.friendOfflineNotifications = false;
        fbcSettings.friendNotificationsInChat = false;
      }
    },
    category: "chat",
    description: "Enables friend presence tracking and shows a notification when a friend logs in.",
  },
  friendOfflineNotifications: {
    label: "Show friends going offline too",
    type: "checkbox",
    value: false,
    disabled: () => !fbcSettings.friendPresenceNotifications,
    sideEffects: (newValue) => {
      debug("friendOfflineNotifications", newValue);
    },
    category: "chat",
    description: "Shows a notification when a friend logs out. (Requires friend presence)",
  },
  friendNotificationsInChat: {
    label: "Show friend presence notifications in chat, when possible",
    type: "checkbox",
    value: false,
    disabled: () => !fbcSettings.friendPresenceNotifications,
    sideEffects: (newValue) => {
      debug("friendNotificationsInChat", newValue);
    },
    category: "chat",
    description: "Shows friend presence notifications in chat, when possible. (Requires friend presence)",
  },
  pastProfiles: {
    label: "Save & browse seen profiles (requires refresh)",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("pastProfiles", newValue);
    },
    category: "chat",
    description:
      "Saves the profiles for everyone you've seen and allows you to browse them using /profiles in chatrooms.",
  },
  pendingMessages: {
    label: "Show sent messages while waiting for server",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("showSentMessages", newValue);
    },
    category: "chat",
    description:
      "Shows messages you've sent while waiting for the server to respond, confirming you have sent the message and the server is just being slow.",
  },
  richOnlineProfile: {
    label: "Rich online profile",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("richOnlineProfile", newValue);
    },
    category: "chat",
    description: "Changes the online profile to support clickable links and embedded images.",
  },
  whisperTargetFixes: {
    label: "Improved whisper target handling",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("whisperTargetFixes", newValue);
    },
    category: "chat",
    description: "Automatically reset whisper target if they leave the room for more than one minute and after the first invalid whisper target warning message.",
  },
  antiGarble: {
    label: "Anti Garble",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue, init: boolean) => {
      if (!newValue) {
        fbcSettings.antiGarbleChatOptions = false;
        defaultSettings.antiGarbleChatOptions.sideEffects(false, init);
        fbcSettings.antiGarbleChatLevel = "full";
        fbcSettings.antiGarbleChatBabyTalk = "preserve";
        fbcSettings.antiGarbleChatStutter = "preserve";
        fbcSettings.antiGarbleWhisperLevel = "full";
        fbcSettings.antiGarbleWhisperBabyTalk = "preserve";
        fbcSettings.antiGarbleWhisperStutter = "preserve";
      } else if (!init) {
        fbcSettings.antiGarbleChatOptions = true;
        defaultSettings.antiGarbleChatOptions.sideEffects(true, init);
        fbcSettings.antiGarbleChatLevel = "none";
        fbcSettings.antiGarbleChatBabyTalk = "remove";
        fbcSettings.antiGarbleChatStutter = "ignore";
        fbcSettings.antiGarbleWhisperLevel = "none";
        fbcSettings.antiGarbleWhisperBabyTalk = "remove";
        fbcSettings.antiGarbleWhisperStutter = "ignore";
      }
      debug("antiGarble", newValue);
    },
    category: "antigarble",
    description:
      "Enables the anti-garble system. Allowing you to send less garbled version of your messages together with the garbled one to others, who could read it in brackets.",
  },
  antiGarbleChatOptions: {
    label: "Anti Garble chat options",
    type: "checkbox",
    value: false,
    disabled: () => !fbcSettings.antiGarble,
    sideEffects: (newValue, init: boolean) => {
      debug("antiGarbleChatoptions", newValue);
      if (!init && newValue) {
        createChatOptions(document.getElementById("chat-room-div") as HTMLDivElement);
      } else if (!init) {
        document.querySelectorAll(".wce-chat-room-button").forEach(e => e.remove());
      }
    },
    category: "antigarble",
    description: "Adds quick options for your anti-garble settings to the chat input menu.",
  },
  antiGarbleChatLevel: {
    label: "Chat garble level:",
    type: "select",
    value: "none",
    options: ["none", "low", "medium", "high", "full"],
    tooltips: [
      "Chat garble level: none (send a fully ungarbled message to the recipient, shown in brackets)",
      "Chat garble level: low (send a partly ungarbled message, which is only garbled up to the low garbel level 1)",
      "Chat garble level: medium (send a partly ungarbled message, which is only garbled up to the medium garbel level 3)",
      "Chat garble level: high (send a partly ungarbled message, which is only garbled up to the high garbel level 5)",
      "Chat garble level: full (always only sends the full garbled message, no ungarbled message in brackets)",
    ],
    disabled: () => !fbcSettings.antiGarble,
    sideEffects: (newValue) => {
      debug("antiGarbleChatLevel", newValue);
    },
    category: "antigarble",
    description:
      "Sends an ungarbled (or lower garbled up to the selected value) chat message together with the garbled messages, which is shown on the recipient side in brackets (defaults to full = no ungarbling).",
  },
  antiGarbleChatStutter: {
    label: "Chat stutters:",
    type: "select",
    value: "preserve",
    options: ["remove", "ignore", "preserve"],
    tooltips: [
      "Chat stutters: remove (always remove chat stutters, even if it is the only effect)",
      "Chat stutters: ignore (remove chat stutters if ungarbling gag speech, but ignore it if it's the only effect)",
      "Chat stutters: preserve (always preserve chat stutters in the ungarbled text in brackets)",
    ],
    disabled: () => !fbcSettings.antiGarble || fbcSettings.antiGarbleChatLevel === "full",
    sideEffects: (newValue) => {
      debug("antiGarbleChatoptions", newValue);
    },
    category: "antigarble",
    description: "Controls if stutters in chat messages are always removed, ignored (only removed if other ungarbling applied) or preserved.",
  },
  antiGarbleChatBabyTalk: {
    label: "Chat baby talk:",
    type: "select",
    value: "preserve",
    options: ["remove", "ignore", "preserve"],
    tooltips: [
      "Chat baby talk: remove (always remove chat baby talk, even if it is the only effect)",
      "Chat baby talk: ignore (remove chat baby talk if ungarbling gag speech, but ignore it if it's the only effect)",
      "Chat baby talk: preserve (always preserve chat baby talk in the ungarbled text in brackets)",
    ],
    disabled: () => !fbcSettings.antiGarble || fbcSettings.antiGarbleChatLevel === "full",
    sideEffects: (newValue) => {
      debug("antiGarbleChatBabyTalk", newValue);
    },
    category: "antigarble",
    description: "Controls if baby talk in chat messages is always removed, ignored (only removed if other ungarbling applied) or preserved.",
  },
  antiGarbleWhisperLevel: {
    label: "Whisper garble level:",
    type: "select",
    value: "none",
    options: ["none", "low", "medium", "high", "full", "off"],
    tooltips: [
      "Whisper garble level: none (send a fully ungarbled whisper to the recipient, shown in brackets)",
      "Whisper garble level: low (send a partly ungarbled whisper, which is only garbled up to the low garbel level 1)",
      "Whisper garble level: medium (send a partly ungarbled whisper, which is only garbled up to the medium garbel level 3)",
      "Whisper garble level: high (send a partly ungarbled whisper, which is only garbled up to the high garbel level 5)",
      "Whisper garble level: full (always only sends the full garbled whisper, no ungarbled message in brackets)",
      "Whisper garble level: off (don't garble whisper messages at all, normal message is ungarbled, no message in brackets)",
    ],
    disabled: () => !fbcSettings.antiGarble,
    sideEffects: (newValue) => {
      debug("antiGarbleWhisperLevel", newValue);
    },
    category: "antigarble",
    description:
      "Sends an ungarbled (or lower garbled) whisper message together with the garbled messages, which is shown on the recipient side in brackets. (off = only sending the ungarbled messages as the original).",
  },
  antiGarbleWhisperStutter: {
    label: "Whispers stutters:",
    type: "select",
    value: "preserve",
    options: ["remove", "ignore", "preserve"],
    tooltips: [
      "Whispers stutters: remove (always remove whispers stutters, even if it is the only effect)",
      "Whispers stutters: ignore (remove whispers stutters if ungarbling gag speech, but ignore it if it's the only effect)",
      "Whispers stutters: preserve (always preserve whispers stutters in the ungarbled text in brackets)",
    ],
    disabled: () => !fbcSettings.antiGarble || ["off", "full"].includes(fbcSettings.antiGarbleWhisperLevel),
    sideEffects: (newValue) => {
      debug("antiGarbleWhisperStutter", newValue);
    },
    category: "antigarble",
    description: "Controls if stutters in whispers are always removed, ignored (only removed if other ungarbling applied) or preserved.",
  },
  antiGarbleWhisperBabyTalk: {
    label: "Whispers baby talk:",
    type: "select",
    value: "preserve",
    options: ["remove", "ignore", "preserve"],
    tooltips: [
      "Whispers baby talk: remove (always remove whispers baby talk, even if it is the only effect)",
      "Whispers baby talk: ignore (remove whispers baby talk if ungarbling gag speech, but ignore it if it's the only effect)",
      "Whispers baby talk: preserve (always preserve whispers baby talk in the ungarbled text in brackets)",
    ],
    disabled: () => !fbcSettings.antiGarble || ["off", "full"].includes(fbcSettings.antiGarbleWhisperLevel),
    sideEffects: (newValue) => {
      debug("antiGarbleWhisperBabyTalk", newValue);
    },
    category: "antigarble",
    description: "Controls if baby talk in whispers is always removed, ignored (only removed if other ungarbling applied) or preserved.",
  },
  lockpick: {
    label: "Reveal Lockpicking Order Based on Skill",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("lockpick", newValue);
    },
    category: "cheats",
    description:
      "Randomly reveals the order of some of the pins with higher lockpicking skill revealing more pins on average. Picking can still be impossible like other forms of struggling.",
  },
  allowLayeringWhileBound: {
    label: "Allow layering menus while bound",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("allowLayeringWhileBound", newValue);
    },
    category: "cheats",
    description: "Allows you to open menus while bound, even if they're disabled in the settings.",
  },
  autoStruggle: {
    label: "Make automatic progress while struggling",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("autoStruggle", newValue);
    },
    category: "cheats",
    description:
      "All three forms of struggling will be completed automatically in a realistic amount of time, if the restraint is possible to struggle out of.",
  },
  allowIMBypassBCX: {
    label: "Allow IMs to bypass BCX beep restrictions",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("allowIMBypassBCX", newValue);
    },
    category: "cheats",
    description: "This setting is temporary until BCX supports a focus mode rule.",
  },
  antiDeaf: {
    label: "Anti Deafen",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("antiDeaf", newValue);
    },
    category: "cheats",
    description: "Show original messages in brackets while deafened.",
  },
  toySync: {
    label: "Enable buttplug.io (requires refresh)",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("toySync", newValue);
    },
    category: "buttplug",
    description:
      "Allows the game to control your real vibrators. For a list of supported vibrators see https://buttplug.io",
  },
  blindWithoutGlasses: {
    label: "Require glasses to see",
    type: "checkbox",
    value: false,
    disabled: () => false,
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
    label: "Allow leashing without wearing a leashable item (requires leasher to have WCE too)",
    type: "checkbox",
    value: false,
    disabled: () => false,
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
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("hideHiddenItemsIcon", newValue);
    },
    category: "immersion",
    description:
      "You can choose to hide items (not on extreme difficulty). The game shows an icon on players that have hidden items. This option hides that icon.",
  },
  itemAntiCheat: {
    label: "Enable anti-cheat",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("itemAntiCheat", newValue);
    },
    category: "immersion",
    description:
      "Prevents certain console cheats from impacting your character. Whitelisted actors are exempt from this.",
  },
  antiCheatBlackList: {
    label: "Blacklist detected cheaters automatically",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("antiCheatBlackList", newValue);
    },
    category: "immersion",
    description: "Automatically blacklist detected cheaters. Whitelisted actors are exempt from this.",
  },
  uwall: {
    label: "Enable uwall anti-cheat",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("uwall", newValue);
      if (Player?.OnlineSharedSettings && typeof newValue === "boolean") {
        Player.OnlineSharedSettings.Uwall = newValue;
        ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
      } else {
        logWarn("Player.OnlineSharedSettings not found, skipping uwall");
      }
    },
    category: "immersion",
    description: "Prevents certain other addon cheats from impacting your character.",
  },
  preventLayeringByOthers: {
    label: "Prevents other players from using layering on you",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue, init: boolean) => {
      debug("preventLayeringByOthers", newValue);
      if (!init) sendHello();
    },
    category: "immersion",
    description: "Prevents other WCE players to make Layering based changes to your character.",
  },
  relogin: {
    label: "Automatic Relogin on Disconnect",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("relogin", newValue);
    },
    category: "misc",
    description:
      "Automatically re-enter your password after you disconnect from the game. For convenience or AFK. Requires the password for the current account to have been saved in the login screen. Passwords are saved in your browser's local storage in plain text.",
  },
  ghostNewUsers: {
    label: "Automatically ghost+blocklist unnaturally new users",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("ghostNewUsers", newValue);
    },
    category: "misc",
    description:
      "Automatically ghost+blocklist unnaturally new users. This is useful for preventing malicious bots, but is not recommended to be enabled normally.",
  },
  confirmLeave: {
    label: "Confirm leaving the game",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("confirmLeave", newValue);
    },
    category: "misc",
    description:
      "When you leave the game, you will be prompted to confirm your decision. This is useful for preventing accidentally closing the tab, but will cause you to reconnect.",
  },
  discreetMode: {
    label: "Discreet mode (disable drawing)",
    type: "checkbox",
    value: false,
    disabled: () => false,
    sideEffects: (newValue, init: boolean) => {
      debug("discreetMode", newValue);
      if (newValue) {
        (document.getElementById("favicon") as HTMLLinkElement).href = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
        NotificationTitleUpdate();
      } else if (!init) {
        NotificationTitleUpdate();
        (document.getElementById("favicon") as HTMLLinkElement).href = "Icons/Logo.png";
      }
    },
    category: "misc",
    description: "Disables drawing on the screen. This is useful for preventing accidental drawing.",
  },
  customContentDomainCheck: {
    label: "Prompt before loading content from a 3rd party domain",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("customContentDomainCheck", newValue);
    },
    category: "misc",
    description: "Show a confirmation prompt before allowing content from a 3rd party domain to be loaded.",
  },
  shareAddons: {
    label: "Share Addons",
    type: "checkbox",
    value: true,
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("shareAddons", newValue);
    },
    category: "misc",
    description:
      "Share a list of your installed addons with other WCE users in the room, visible via /versions chat command.",
  },
  buttplugDevices: {
    label: "Buttplug Devices",
    type: "input",
    value: "",
    disabled: () => false,
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
        const devices: FBCToySetting[] = parseJSON(newValue);
        if (!Array.isArray(devices)) {
          throw new Error("expected array for devices");
        }
        for (const device of devices) {
          toySyncState.deviceSettings.set(device.Name, device);
        }
      } catch(ex) {
        logError(ex);
      }
    },
    category: "hidden",
    description: "",
  },
  toySyncAddress: {
    label: "Intiface Address",
    type: "input",
    value: "ws://127.0.0.1:12345",
    disabled: () => false,
    sideEffects: (newValue) => {
      debug("toySyncAddress", newValue);
    },
    category: "hidden",
    description: "",
  },
};

export function settingsLoaded(): boolean {
  return postSettingsHasRun;
}

function bceSettingKey(): string {
  return `bce.settings.${Player?.AccountName}`;
}

export async function bceLoadSettings(): Promise<void> {
  await waitFor(() => !!Player?.AccountName);
  const key = bceSettingKey();
  debug("loading settings");
  if (Object.keys(fbcSettings).length === 0) {
    let settings: typeof fbcSettings | null = parseJSON(localStorage.getItem(key));
    const onlineSettings: typeof fbcSettings | null = parseJSON(LZString.decompressFromBase64(
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      Player.ExtensionSettings.FBC || (Player.OnlineSettings?.BCE ?? "")
    ) || null);
    if (!onlineSettings) {
      logWarn("No online settings found");
      debug("onlineSettings", Player.OnlineSettings);
      debug("extensionSettings", Player.ExtensionSettings);
    }
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (Player.OnlineSettings?.BCE) {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      Player.ExtensionSettings.FBC = Player.OnlineSettings.BCE;
      ServerPlayerExtensionSettingsSync("FBC");
      logInfo("Migrated online settings to extension settings");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
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
        "Welcome to WCE",
        `Welcome to Wholesome Club Extensions v${globalThis.FBC_VERSION}! As this is your first time using WCE on this account, you may want to check out the settings page for some options to customize your experience. You can find it in the game preferences. Enjoy!` // In case of problems, you can contact us via Discord at ${DISCORD_INVITE_URL}`
      );
      // @ts-expect-error -- this is fully populated in the loop below
      settings = {};
    }

    if (!isNonNullObject(settings)) {
      throw new Error("failed to initialize settings");
    }

    for (const [setting] of Object.entries(defaultSettings)) {
      if (!(setting in settings)) {
        if (setting === "activityExpressions" && "expressions" in settings) {
          settings[setting] = settings.expressions;
          continue;
        }
        settings[setting] = (defaultSettings[setting] as CheckboxSetting).value;
      }
    }
    if (typeof settings.version === "undefined" || settings.version < settingsVersion) {
      beepChangelog();
    }
    settings.version = settingsVersion;
    fbcSettings = settings;
  }
}

export function bceSaveSettings(): void {
  debug("saving settings");
  if (toySyncState.deviceSettings.size > 0) {
    fbcSettings.buttplugDevices = JSON.stringify(Array.from(toySyncState.deviceSettings.values()));
  }
  localStorage.setItem(bceSettingKey(), JSON.stringify(fbcSettings));
  Player.ExtensionSettings.FBC = LZString.compressToBase64(JSON.stringify(fbcSettings));
  ServerPlayerExtensionSettingsSync("FBC");
  debug("saved settings", fbcSettings);
}

export function isDefaultSettingKey(key: string): key is keyof typeof defaultSettings {
  return key in defaultSettings;
}

export function postSettings(): void {
  debug("handling settings side effects");
  for (const [k, v] of Object.entries(fbcSettings)) {
    if (k === "version") {
      continue;
    }
    if (!isDefaultSettingKey(k)) {
      logWarn("Deleting unknown setting", k);
      delete fbcSettings[k];
      continue;
    }
    defaultSettings[k].sideEffects(v, true);
  }
  bceSaveSettings();

  postSettingsHasRun = true;
}

async function beepChangelog(): Promise<void> {
  await waitFor(() => !!Player?.AccountName);
  await sleep(5000);
  fbcBeepNotify(
    displayText("WCE Changelog"),
    displayText("WCE has received significant updates since you last used it. See /wcechangelog in a chatroom.")
  );
  await waitFor(() => !!document.getElementById("TextAreaChatLog"));
  augmentedChatNotify(`Wholesome Club Extensions (WCE) changelog:\n${fbcChangelog}`);
}

export function fbcSettingValue(key: string): boolean | string {
  if (isDefaultSettingKey(key)) {
    return fbcSettings[key];
  }
  return false;
}
