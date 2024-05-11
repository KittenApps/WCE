import { deviatingHashes } from "../functions/functionIntegrityCheck";
import { logWarn } from "./logger";
import { SUPPORTED_GAME_VERSIONS } from "./constants";

export const HOOK_PRIORITIES = /** @type {const} */ ({
  Top: 11,
  OverrideBehaviour: 10,
  ModifyBehaviourHigh: 6,
  ModifyBehaviourMedium: 5,
  ModifyBehaviourLow: 4,
  AddBehaviour: 3,
  Observe: 0,
});

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

/** @type {string[]} */
export const skippedFunctionality = [];

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