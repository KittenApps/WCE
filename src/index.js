"use strict";

/**
 * @license GPL-3.0-or-later
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

/* eslint-disable no-inline-comments */
// @ts-check

import { pastLogs } from "./util/logger";
import { waitFor, objEntries, fbcChatNotify, fbcNotify } from "./util/utils";
import { fbcSettings, fbcSettingValue } from "./util/settings";
import { fbcDisplayText } from "./util/localization";
import { registerAllFunctions, incompleteFunctions } from "./registerFunctions";
import { deviatingHashes } from "./functions/functionIntegrityCheck";
import { toySyncState } from "./functions/toySync";
import { skippedFunctionality } from "./util/modding";
import { FBC_VERSION, SUPPORTED_GAME_VERSIONS } from "./util/constants";

await waitFor(() => typeof FUSAM === "object" && FUSAM?.present && typeof bcModSdk === "object" && !!bcModSdk);

if (window.FBC_VERSION) {
  throw new Error("FBC already loaded. Skipping load.");
}

if (typeof ChatRoomCharacter === "undefined") {
  throw new Error("Bondage Club not detected. Skipping FBC initialization.");
}

window.FBC_VERSION = FBC_VERSION;

window.fbcDisplayText = fbcDisplayText;

window.fbcChatNotify = fbcChatNotify;

window.fbcSendAction = (text) => {
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

window.fbcSettingValue = fbcSettingValue;
window.bceAnimationEngineEnabled = () => !!fbcSettings.animationEngine;

// Expressions init method for custom expressions
// eslint-disable-next-line camelcase
window.bce_initializeDefaultExpression = () => {
  // Here to not break customizer script
};

/**
 * @param {boolean} [copy] - Whether to copy the report to the clipboard
 */
async function fbcDebug(copy) {
  /** @type {Map<string, string>} */
  const info = new Map();
  info.set("Browser", navigator.userAgent);
  info.set("Game Version", `${GameVersion}${SUPPORTED_GAME_VERSIONS.includes(GameVersion) ? "" : " (unsupported)"}`);
  info.set("WebGL Version", GLVersion);
  info.set("FBC Version", FBC_VERSION);
  info.set("Loaded via FUSAM", typeof FUSAM === "object" && FUSAM?.addons?.FBC ? "Yes" : "No");
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
      toySyncState.client.Devices.map((d) => `${d.Name} (${d.AllowedMessages.join(",")})`).join(", ")
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
  info.set("Skipped Functionality for Compatibility", `\n- ${skippedFunctionality.join("\n- ")}`);
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
    fbcChatNotify(`${print}\n\n**The report has been copied to your clipboard.**`);
    // Not using FBC's debug() to avoid the report ending up on future reports
    console.debug(`${print}\n\n**The report has been copied to your clipboard.**`);
    await navigator.clipboard.writeText(print);
  }
  if (skippedFunctionality.length > 0) {
    fbcChatNotify(
      "If you are running another addon that modifies the game, but is not listed above, please tell its developer to use https://github.com/Jomshir98/bondage-club-mod-sdk to hook into the game instead. This is a very cheap and easy way for addon developers to almost guarantee compatibility with other addons."
    );
  }
  return print;
}
window.fbcDebug = fbcDebug;
FUSAM.registerDebugMethod("FBC", fbcDebug);

await registerAllFunctions();

// Post ready when in a chat room
await fbcNotify(`For Better Club v${window.FBC_VERSION} Loaded`);

Player.FBC = FBC_VERSION;

// Confirm leaving the page to prevent accidental back button, refresh, or other navigation-related disruptions
window.addEventListener(
  "beforeunload",
  (e) => {
    if (toySyncState.client?.Connected) {
      // Stop vibrating toys
      for (const device of toySyncState.client.Devices.filter((d) => d.AllowedMessages.includes(0))) {
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
