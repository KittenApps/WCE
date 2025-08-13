import { SDK, HOOK_PRIORITIES } from "./util/modding";
import { debug, logError } from "./util/logger";
import { fbcSettings, postSettings, bceLoadSettings } from "./util/settings";
// import functionIntegrityCheck from "./functions/functionIntegrityCheck";
import wceStyles from "./functions/wceStyles";
import commonPatches from "./functions/commonPatches";
import commands from "./functions/commands";
import settingsPage from "./functions/settingsPage";
import lockpickHelp from "./functions/lockpickHelp";
import automaticReconnect from "./functions/automaticReconnect";
import chatAugments from "./functions/chatAugments";
import layeringMenu from "./functions/layeringMenu";
import cacheClearer from "./functions/cacheClearer";
import chatRoomOverlay from "./functions/chatRoomOverlay";
import hiddenMessageHandler from "./functions/hiddenMessageHandler";
import privateWardrobe from "./functions/privateWardrobe";
import antiGarbling from "./functions/antiGarbling";
import automaticExpressions from "./functions/automaticExpressions";
import alternateArousal from "./functions/alternateArousal";
import autoGhostBroadcast from "./functions/autoGhostBroadcast";
import blindWithoutGlasses from "./functions/blindWithoutGlasses";
import friendPresenceNotifications from "./functions/friendPresenceNotifications";
import itemAntiCheat from "./functions/itemAntiCheat";
import forcedClubSlave from "./functions/forcedClubSlave";
import leashFix from "./functions/leashFix";
import instantMessenger from "./functions/instantMessenger";
import extendedWardrobe from "./functions/extendedWardrobe";
import customContentDomainCheck from "./functions/customContentDomainCheck";
import discreetMode from "./functions/discreetMode";
import autoStruggle from "./functions/autoStruggle";
import leashAlways from "./functions/leashAlways";
import pastProfiles from "./functions/pastProfiles";
import pendingMessages from "./functions/pendingMessages";
import hideHiddenItemsIcon from "./functions/hideHiddenItemsIcon";
import richOnlineProfile from "./functions/richOnlineProfile";
// import crafting from "./functions/crafting";
import numericArousalMeters from "./functions/numericArousalMeters";
import appendSocketListenersToInit from "./functions/appendSocketListenersToInit";
import nicknames from "./functions/nicknames";
import hookBCXAPI from "./functions/hookBCXAPI";
import shareAddons from "./functions/shareAddons";
import confirmLeave from "./functions/confirmLeave";
import toySync from "./functions/toySync";
import chatRoomWhisperFixes from "./functions/chatRoomWhisperFixes";
import allowCustomEffect from "./functions/allowCustomEffects";
import { fetchLocale } from "./util/localization";

export const incompleteFunctions: string[] = [];

async function registerFunction(func: () => (Promise<void> | void), label: string): Promise<void> {
  incompleteFunctions.push(label);
  try {
    const ret = func();
    if (ret instanceof Promise) {
      await ret;
    }
    incompleteFunctions.splice(incompleteFunctions.indexOf(label), 1);
  } catch(err) {
    const e = err as Error;
    logError(`Error in ${label}: ${e?.toString()}\n${e?.stack ?? ""}`);
  }
}

export async function registerAllFunctions(): Promise<void> {
  // Delay game processes until registration is complete
  let funcsRegistered: "init" | "enable" | "disable" = "init";

  SDK.hookFunction(
    "LoginResponse",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (funcsRegistered === "init") {
        funcsRegistered = "disable";
      }
      return next(args);
    }
  );
  SDK.hookFunction(
    "LoginStatusReset",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (funcsRegistered === "disable") {
        funcsRegistered = "init";
      }
      return next(args);
    }
  );
  SDK.hookFunction(
    "GameRun",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (funcsRegistered === "disable") {
        GameAnimationFrameId = requestAnimationFrame(GameRun);
        return null;
      }
      return next(args);
    }
  );
  SDK.hookFunction(
    "GameRunBackground",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof GameRunBackground>} args
     */ (args, next) => {
      if (funcsRegistered === "disable") return null;
      return next(args);
    }
  );

  // await Promise.all([registerFunction(functionIntegrityCheck, "functionIntegrityCheck"), fetchLocale(TranslationLanguage)]);
  await fetchLocale(TranslationLanguage);
  registerFunction(wceStyles, "wceStyles");
  registerFunction(commonPatches, "commonPatches");
  registerFunction(extendedWardrobe, "extendedWardrobe");
  registerFunction(allowCustomEffect, "allowCustomEffect");
  registerFunction(automaticReconnect, "automaticReconnect");
  registerFunction(hiddenMessageHandler, "hiddenMessageHandler");
  await registerFunction(bceLoadSettings, "bceLoadSettings");
  registerFunction(postSettings, "postSettings");
  registerFunction(appendSocketListenersToInit, "appendSocketListenersToInit");
  debug(fbcSettings);
  registerFunction(discreetMode, "discreetMode");
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
  registerFunction(instantMessenger, "instantMessenger");
  registerFunction(autoStruggle, "autoStruggle");
  registerFunction(nicknames, "nicknames");
  registerFunction(leashAlways, "leashAlways");
  registerFunction(toySync, "toySync");
  registerFunction(pastProfiles, "pastProfiles");
  registerFunction(pendingMessages, "pendingMessages");
  registerFunction(hideHiddenItemsIcon, "hideHiddenItemsIcon");
  // registerFunction(crafting, "crafting");
  registerFunction(itemAntiCheat, "itemAntiCheat");
  registerFunction(leashFix, "leashFix");
  registerFunction(hookBCXAPI, "hookBCXAPI");
  registerFunction(customContentDomainCheck, "customContentDomainCheck");
  registerFunction(numericArousalMeters, "numericArousalMeters");
  registerFunction(richOnlineProfile, "richOnlineProfile");
  registerFunction(shareAddons, "shareAddons");
  registerFunction(confirmLeave, "confirmLeave");
  registerFunction(chatRoomWhisperFixes, "chatRoomWhisperFixes");
  funcsRegistered = "enable";
}
