import { SDK, deviatingHashes } from "../util/modding";
import { waitFor, objEntries } from "../util/utils";
import { logInfo, logWarn } from "../util/logger";
import { expectedHashes } from "../util/functionHashes";

export default async function functionIntegrityCheck() {
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

function IsObject(obj) {
	return !!obj && typeof obj === 'object' && !Array.isArray(obj);
}

  for (const [func, hash] of objEntries(expectedHashes(GameVersion))) {
    if (!isActiveFunction(func, hash)) {
      continue;
    }

    /** @type {any} */
    let context = window;
    /** @type {string[]} */
		const targetPath = func.split('.');
		for (let i = 0; i < targetPath.length - 1; i++) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
			context = context[targetPath[i]];
			if (!IsObject(context)) {
				logWarn(`Expected Function ${func} not found; ${targetPath.slice(0, i + 1).join('.')} is not object`);
			}
		}
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    context = context[targetPath.pop()];
    if (typeof context !== "function") {
      logWarn(`Expected function ${func} is not a function.`);
      continue;
    }
    const actualHash = SDK.getOriginalHash(func);
    if (actualHash !== hash) {
      logWarn(`Function ${func} has been modified before WCE, potential incompatibility: ${actualHash}`);
      deviatingHashes.push(func);
    }
  }
}
