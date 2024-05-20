import { waitFor, fbcChatNotify, fbcNotify, fbcSendAction } from "./util/utils";
import { fbcSettingValue } from "./util/settings";
import { fbcDisplayText } from "./util/localization";
import { registerAllFunctions } from "./registerFunctions";
import { FBC_VERSION } from "./util/constants";
import { fbcDebug } from "./functions/commands";

await waitFor(() => typeof FUSAM === "object" && FUSAM?.present && typeof bcModSdk === "object" && !!bcModSdk);

if (window.FBC_VERSION) {
  throw new Error("FBC already loaded. Skipping load.");
}

if (typeof ChatRoomCharacter === "undefined") {
  throw new Error("Bondage Club not detected. Skipping WCE initialization.");
}

window.FBC_VERSION = FBC_VERSION;
window.fbcDisplayText = fbcDisplayText;
window.fbcChatNotify = fbcChatNotify;
window.fbcSendAction = fbcSendAction;
window.fbcSettingValue = fbcSettingValue;
// Expressions init method for custom expressions (here to not break customizer script)
// eslint-disable-next-line camelcase, no-empty-function, @typescript-eslint/no-empty-function
window.bce_initializeDefaultExpression = () => {};
window.fbcDebug = fbcDebug;

FUSAM.registerDebugMethod("WCE", fbcDebug);

await registerAllFunctions();

// Post ready when in a chat room
await fbcNotify(`Wholesome Club Extensions v${window.FBC_VERSION} loaded!`);

Player.FBC = FBC_VERSION;
