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

import { debug, logWarn, pastLogs } from "./util/logger";
import { waitFor, sleep, objEntries, bceParseUrl, fbcChatNotify } from "./util/utils";
import { fbcSettings, settingsLoaded, fbcSettingValue } from "./util/settings";
import { displayText, fbcDisplayText } from "./util/localization";
import { registerAllFunctions, incompleteFunctions } from "./registerFunctions";
import { deviatingHashes } from "./functions/functionIntegrityCheck";
import { FBC_VERSION, fbcChangelog, SUPPORTED_GAME_VERSIONS, HIDDEN, BCE_MSG, MESSAGE_TYPES } from "./util/constants";

await waitFor(() => typeof FUSAM === "object" && FUSAM?.present && typeof bcModSdk === "object" && !!bcModSdk);

const CAPABILITIES = /** @type {const} */ (["clubslave", "antigarble"]);

if (window.FBC_VERSION) {
  throw new Error("FBC already loaded. Skipping load.");
}

if (typeof ChatRoomCharacter === "undefined") {
  throw new Error("Bondage Club not detected. Skipping FBC initialization.");
}

export const SDK = bcModSdk.registerMod(
  {
    name: "FBC",
    version: FBC_VERSION,
    fullName: "For Better Club",
    repository: "https://github.com/KittenApps/fbc-fork.git",
  },
  {
    allowReplace: false,
  }
);

window.FBC_VERSION = FBC_VERSION;

const EMBED_TYPE = /** @type {const} */ ({
  Image: "img",
  None: "",
  Untrusted: "none-img",
});

/** @type {Map<string, "allowed" | "denied">} */
export const sessionCustomOrigins = new Map();

/** @type {FBCToySyncState} */
export const toySyncState = {
  deviceSettings: new Map(),
};

export const HOOK_PRIORITIES = /** @type {const} */ ({
  Top: 11,
  OverrideBehaviour: 10,
  ModifyBehaviourHigh: 6,
  ModifyBehaviourMedium: 5,
  ModifyBehaviourLow: 4,
  AddBehaviour: 3,
  Observe: 0,
});

function blockAntiGarble() {
  return !!(fbcSettings.antiAntiGarble || fbcSettings.antiAntiGarbleStrong || fbcSettings.antiAntiGarbleExtra);
}

window.fbcDisplayText = fbcDisplayText;

/** @type {string[]} */
const skippedFunctionality = [];

/** @type {(functionName: string, patches: Record<string,string>, affectedFunctionality: string) => void} */
export const patchFunction = (functionName, patches, affectedFunctionality) => {
  // Guard against patching a function that has been modified by another addon not using the shared SDK on supported versions.
  if (deviatingHashes.includes(functionName) && SUPPORTED_GAME_VERSIONS.includes(GameVersion)) {
    logWarn(
      `Attempted patching of ${functionName} despite detected deviation. Impact may be: ${affectedFunctionality}\n\nSee /fbcdebug in a chatroom for more information or copy(await fbcDebug()) in console.`
    );
    skippedFunctionality.push(affectedFunctionality);
  }
  SDK.patchFunction(functionName, patches);
};

window.fbcChatNotify = fbcChatNotify;

/**
 * @type {(title: string, text: string) => void}
 */
export function fbcBeepNotify(title, text) {
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
export const fbcNotify = async (text, duration = 5000, properties = {}) => {
  await waitFor(() => !!Player && new Date(ServerBeep?.Timer || 0) < new Date());

  ServerBeep = {
    Timer: Date.now() + duration,
    Message: text,
    ...properties,
  };
};

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

/** @type {(target?: number | null, requestReply?: boolean) => void} */
export function sendHello(target = null, requestReply = false) {
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
    fbcMessage.message.progress = Player.BCEArousalProgress || Player.ArousalSettings?.Progress || 0;
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

export async function beepChangelog() {
  await waitFor(() => !!Player?.AccountName);
  await sleep(5000);
  fbcBeepNotify(
    displayText("FBC Changelog"),
    displayText(`FBC has received significant updates since you last used it. See /fbcchangelog in a chatroom.`)
  );
  await waitFor(() => !!document.getElementById("TextAreaChatLog"));
  fbcChatNotify(`For Better Club (FBC) changelog:\n${fbcChangelog}`);
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
    ].includes(url.host) || sessionCustomOrigins.get(url.origin) === "allowed";

  if (/\/[^/]+\.(png|jpe?g|gif)$/u.test(url.pathname)) {
    return isTrustedOrigin ? EMBED_TYPE.Image : EMBED_TYPE.Untrusted;
  }
  return EMBED_TYPE.None;
}

/** @type {(chatMessageElement: Element, scrollToEnd: () => void) => void} */
export function processChatAugmentsForLine(chatMessageElement, scrollToEnd) {
  const newChildren = [];
  let originalText = "";
  for (const node of chatMessageElement.childNodes) {
    if (node.nodeType !== Node.TEXT_NODE) {
      newChildren.push(node);
      /** @type {HTMLElement} */
      // @ts-ignore
      const el = node;
      if (el.classList.contains("ChatMessageName") || el.classList.contains("bce-message-Message")) {
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
                  prompt: displayText("Do you want to add $origin to trusted origins?", {
                    $origin: url.origin,
                  }),
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
                        throw new Error("clicked promptTrust has no original text");
                      }
                      parent.appendChild(document.createTextNode(ogText));
                      processChatAugmentsForLine(chatMessageElement, scrollToEnd);
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

/** @type {(cb: () => void, intval: number) => void} */
export function createTimer(cb, intval) {
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
