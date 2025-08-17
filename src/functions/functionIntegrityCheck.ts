import { SDK, deviatingHashes } from "../util/modding";
import { waitFor } from "../util/utils";
import { logInfo, logWarn } from "../util/logger";
import expectedHashes from "../util/functionHashes";

export default async function functionIntegrityCheck(): Promise<void> {
  await waitFor(() => GameVersion !== "R0" && typeof ServerIsConnected === "boolean" && ServerIsConnected);

  logInfo("Checking function integrity with GameVersion", GameVersion);

  function isObject(obj): obj is typeof Object {
    return !!obj && typeof obj === "object" && !Array.isArray(obj);
  }

  for (const [func, hash] of Object.entries(expectedHashes(GameVersion) || {})) {
    if (hash === "SKIP") continue;

    let context: unknown = window;
    const targetPath: string[] = func.split(".");
    for (let i = 0; i < targetPath.length - 1; i++) {
      context = context[targetPath[i]];
      if (!isObject(context)) {
        logWarn(`Expected Function ${func} not found; ${targetPath.slice(0, i + 1).join(".")} is not object`);
      }
    }
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
