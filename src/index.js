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
  throw new Error("Bondage Club not detected. Skipping FBC initialization.");
}

window.FBC_VERSION = FBC_VERSION;
window.fbcDisplayText = fbcDisplayText;
window.fbcChatNotify = fbcChatNotify;
window.fbcSendAction = fbcSendAction;
window.fbcSettingValue = fbcSettingValue;
// Expressions init method for custom expressions (here to not break customizer script)
// eslint-disable-next-line camelcase
window.bce_initializeDefaultExpression = () => {};
window.fbcDebug = fbcDebug;

FUSAM.registerDebugMethod("FBC", fbcDebug);

await registerAllFunctions();

// Post ready when in a chat room
await fbcNotify(`For Better Club v${window.FBC_VERSION} Loaded`);

Player.FBC = FBC_VERSION;
