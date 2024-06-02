import { waitFor, fbcChatNotify, fbcNotify, fbcSendAction } from "./util/utils";
import { fbcSettingValue } from "./util/settings";
import { displayText } from "./util/localization";
import { registerAllFunctions } from "./registerFunctions";
import { FBC_VERSION } from "./util/constants";
import { fbcDebug } from "./functions/commands";

await waitFor(() => typeof FUSAM === "object" && FUSAM?.present && typeof bcModSdk === "object" && !!bcModSdk);

if (globalThis.FBC_VERSION) {
  throw new Error("FBC already loaded. Skipping load.");
}

if (typeof ChatRoomCharacter === "undefined") {
  throw new Error("Bondage Club not detected. Skipping WCE initialization.");
}

GameVersion = new URLSearchParams(location.hash.slice(1)).get('version') ?? GameVersion;
globalThis.FBC_VERSION = FBC_VERSION;
globalThis.fbcDisplayText = displayText;
globalThis.fbcChatNotify = fbcChatNotify;
globalThis.fbcSendAction = fbcSendAction;
globalThis.fbcSettingValue = fbcSettingValue;
// Expressions init method for custom expressions (here to not break customizer script)
// eslint-disable-next-line camelcase, no-empty-function
globalThis.bce_initializeDefaultExpression = () => {};
globalThis.fbcDebug = fbcDebug;

FUSAM.registerDebugMethod("WCE", () => fbcDebug(false));

await registerAllFunctions();

// Post ready when in a chat room
await fbcNotify(`Wholesome Club Extensions v${globalThis.FBC_VERSION} loaded!`);

Player.FBC = FBC_VERSION;
