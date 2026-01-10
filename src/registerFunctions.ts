import allowCustomEffect from "./functions/allowCustomEffects";
import alternateArousal from "./functions/alternateArousal";
import antiGarbling from "./functions/antiGarbling";
import appendSocketListenersToInit from "./functions/appendSocketListenersToInit";
import autoGhostBroadcast from "./functions/autoGhostBroadcast";
import automaticExpressions from "./functions/automaticExpressions";
import automaticReconnect from "./functions/automaticReconnect";
import autoStruggle from "./functions/autoStruggle";
import blindWithoutGlasses from "./functions/blindWithoutGlasses";
import cacheClearer from "./functions/cacheClearer";
import chatAugments from "./functions/chatAugments";
import chatRoomOverlay from "./functions/chatRoomOverlay";
import chatRoomWhisperFixes from "./functions/chatRoomWhisperFixes";
import commands from "./functions/commands";
import commonPatches from "./functions/commonPatches";
import confirmLeave from "./functions/confirmLeave";
import customContentDomainCheck from "./functions/customContentDomainCheck";
import discreetMode from "./functions/discreetMode";
import extendedWardrobe from "./functions/extendedWardrobe";
import forcedClubSlave from "./functions/forcedClubSlave";
import friendPresenceNotifications from "./functions/friendPresenceNotifications";
import hiddenMessageHandler from "./functions/hiddenMessageHandler";
import hideHiddenItemsIcon from "./functions/hideHiddenItemsIcon";
import hookBCXAPI from "./functions/hookBcx";
import instantMessenger from "./functions/instantMessenger";
import itemAntiCheat from "./functions/itemAntiCheat";
import layeringMenu from "./functions/layeringMenu";
import leashAlways from "./functions/leashAlways";
import lockpickHelp from "./functions/lockpickHelp";
import nicknames from "./functions/nicknames";
// import crafting from "./functions/crafting";
import numericArousalMeters from "./functions/numericArousalMeters";
import pastProfiles from "./functions/pastProfiles";
import pendingMessages from "./functions/pendingMessages";
import privateWardrobe from "./functions/privateWardrobe";
import richOnlineProfile from "./functions/richOnlineProfile";
import settingsPage from "./functions/settingsPage";
import shareAddons from "./functions/shareAddons";
import toySync from "./functions/toySync";
// import functionIntegrityCheck from "./functions/functionIntegrityCheck";
import wceStyles from "./functions/wceStyles";
import { fetchLocale } from "./util/localization";
import { debug, logError } from "./util/logger";
import { SDK, HOOK_PRIORITIES } from "./util/modding";
import { fbcSettings, postSettings, bceLoadSettings } from "./util/settings";

export const incompleteFunctions: string[] = [];

async function registerFunction(func: () => Promise<void> | void, label: string): Promise<void> {
  incompleteFunctions.push(label);
  try {
    const ret = func();
    if (ret instanceof Promise) {
      await ret;
    }
    incompleteFunctions.splice(incompleteFunctions.indexOf(label), 1);
  } catch (err) {
    const e = err as Error;
    logError(`Error in ${label}: ${e?.toString()}\n${e?.stack ?? ""}`);
  }
}

export async function registerAllFunctions(): Promise<void> {
  // Delay game processes until registration is complete
  let funcsRegistered: "init" | "enable" | "disable" = "init";

  SDK.hookFunction("LoginResponse", HOOK_PRIORITIES.Top, (args, next) => {
    if (funcsRegistered === "init") {
      funcsRegistered = "disable";
    }
    return next(args);
  });
  SDK.hookFunction("LoginStatusReset", HOOK_PRIORITIES.Top, (args, next) => {
    if (funcsRegistered === "disable") {
      funcsRegistered = "init";
    }
    return next(args);
  });
  SDK.hookFunction("GameRun", HOOK_PRIORITIES.Top, (args, next) => {
    if (funcsRegistered === "disable") {
      GameAnimationFrameId = requestAnimationFrame(GameRun);
      return null;
    }
    return next(args);
  });
  SDK.hookFunction("GameRunBackground", HOOK_PRIORITIES.Top, (args, next) => {
    if (funcsRegistered === "disable") return null;
    return next(args);
  });

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
  registerFunction(hookBCXAPI, "hookBCXAPI");
  registerFunction(customContentDomainCheck, "customContentDomainCheck");
  registerFunction(numericArousalMeters, "numericArousalMeters");
  registerFunction(richOnlineProfile, "richOnlineProfile");
  registerFunction(shareAddons, "shareAddons");
  registerFunction(confirmLeave, "confirmLeave");
  registerFunction(chatRoomWhisperFixes, "chatRoomWhisperFixes");
  funcsRegistered = "enable";
}
