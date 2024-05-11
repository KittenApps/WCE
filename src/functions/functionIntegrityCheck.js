import { SDK } from "..";
import { waitFor, objEntries } from "../util/utils";
import { logInfo, logWarn } from "../util/logger";
import { expectedHashes } from "../util/functionHashes";

/** @type {unknown[]} */
export const deviatingHashes = [];

export async function functionIntegrityCheck() {
  await waitFor(() => GameVersion !== "R0" && typeof ServerIsConnected === "boolean" && ServerIsConnected);

  logInfo("Checking function integrity with GameVersion", GameVersion);

  /**
   * @param {keyof ReturnType<typeof expectedHashes>} func
   * @param {string} hash
   * @returns {func is keyof typeof window}
   */
  function isActiveFunction(func, hash) {
    return hash !== "SKIP";
  }

  for (const [func, hash] of objEntries(expectedHashes(GameVersion))) {
    if (!isActiveFunction(func, hash)) {
      continue;
    }
    if (!window[func]) {
      logWarn(`Expected function ${func} not found.`);
      continue;
    }
    if (typeof window[func] !== "function") {
      logWarn(`Expected function ${func} is not a function.`);
      continue;
    }
    const actualHash = SDK.getOriginalHash(func);
    if (actualHash !== hash) {
      logWarn(`Function ${func} has been modified before FBC, potential incompatibility: ${actualHash}`);
      deviatingHashes.push(func);
    }
  }
}
