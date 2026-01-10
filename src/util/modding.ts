import type { ModSDKModAPI } from "bondage-club-mod-sdk";

import { SUPPORTED_GAME_VERSIONS, FBC_VERSION } from "./constants";
import { logWarn } from "./logger";

export const deviatingHashes: string[] = [];
export const skippedFunctionality: string[] = [];
export const HOOK_PRIORITIES = {
  Top: 11,
  OverrideBehaviour: 10,
  ModifyBehaviourHigh: 6,
  ModifyBehaviourMedium: 5,
  ModifyBehaviourLow: 4,
  AddBehaviour: 3,
  Observe: 0,
} as const;

export const SDK: ModSDKModAPI = bcModSdk.registerMod(
  { name: "WCE", version: FBC_VERSION, fullName: "Wholesome Club Extensions", repository: "https://github.com/KittenApps/WCE.git" },
  { allowReplace: false }
);

export function patchFunction(functionName: string, patches: Record<string, string>, affectedFunctionality: string): void {
  // Guard against patching a function that has been modified by another addon not using the shared SDK on supported versions.
  if (deviatingHashes.includes(functionName) && SUPPORTED_GAME_VERSIONS.includes(GameVersion)) {
    logWarn(
      `Attempted patching of ${functionName} despite detected deviation. Impact may be: ${affectedFunctionality}\n\nSee /wcedebug in a chatroom for more information or copy(await fbcDebug()) in console.`
    );
    skippedFunctionality.push(affectedFunctionality);
  }
  SDK.patchFunction(functionName, patches);
}
