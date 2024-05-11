import { isString } from "./utils";

/** @type {{ level: "error" | "warn" | "info" | "debug", message: string }[]} */
export const pastLogs = new Array(100);

/** @type {(level: "error" | "warn" | "info" | "debug", ...args: unknown[]) => void} */
const pushLog = (level, ...args) => {
  pastLogs.shift();
  pastLogs.push({
    level,
    message: args
      .map((v) => {
        if (isString(v)) {
          return v;
        }
        try {
          return JSON.stringify(v);
        } catch (e) {
          return v?.toString();
        }
      })
      .join(", "),
  });
};

/**
 * @type {(...args: unknown[]) => void}
 */
export const debug = (...args) => {
  console.debug("FBC", `${window.FBC_VERSION}:`, ...args);
  pushLog("debug", ...args);
};

/**
 * @type {(...args: unknown[]) => void}
 */
export const logInfo = (...args) => {
  console.info("FBC", `${window.FBC_VERSION}:`, ...args);
  pushLog("info", ...args);
};

/**
 * @type {(...args: unknown[]) => void}
 */
export const logWarn = (...args) => {
  console.warn("FBC", `${window.FBC_VERSION}:`, ...args);
  pushLog("warn", ...args);
};

/**
 * @type {(...args: unknown[]) => void}
 */
export const logError = (...args) => {
  console.error("FBC", `${window.FBC_VERSION}:`, ...args);
  pushLog("error", ...args);
};
