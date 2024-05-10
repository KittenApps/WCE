import { logError } from "./logger";

/**
 * @param {number} ms
 */
export function sleep(ms) {
  // eslint-disable-next-line no-promise-executor-return
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @type {(func: () => boolean, cancelFunc?: () => boolean) => Promise<boolean>}
 */
export async function waitFor(func, cancelFunc = () => false) {
  while (!func()) {
    if (cancelFunc()) {
      return false;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(10);
  }
  return true;
}

/** @type {(s: unknown) => s is string} */
export function isString(s) {
  return typeof s === "string";
}

/** @type {(o: unknown) => o is Record<string, any>} */
export function isNonNullObject(o) {
  return !!o && typeof o === "object" && !Array.isArray(o);
}

/** @type {(m: unknown) => m is ServerChatRoomMessage} */
export function isChatMessage(m) {
  return (
    isNonNullObject(m) &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof m.Type === "string" &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof m.Content === "string"
  );
}

/** @type {(c: unknown) => c is Character} */
export function isCharacter(c) {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return isNonNullObject(c) && typeof c.IsPlayer === "function";
}

/** @type {(c: unknown) => c is (string | string[])} */
export function isStringOrStringArray(c) {
  return isString(c) || (Array.isArray(c) && c.every(isString));
}

/** @type {(o: unknown) => o is ItemBundle[][]} */
export function isWardrobe(o) {
  return Array.isArray(o) && o.every((b) => isItemBundleArray(b) || b === null);
}

/** @type {(o: unknown) => o is ItemBundle[]} */
function isItemBundleArray(o) {
  return Array.isArray(o) && o.every(isItemBundle);
}

/** @type {(o: unknown) => o is ItemBundle} */
function isItemBundle(o) {
  return (
    isNonNullObject(o) &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof o.Name === "string" &&
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    typeof o.Group === "string"
  );
}

/**
 * @param {number} [id]
 * @param {number} [def]
 */
export function mustNum(id, def = -Number.MAX_SAFE_INTEGER) {
  return id ?? def;
}

/** @type {<T>(o: T) => T} */
export function deepCopy(o) {
  // eslint-disable-next-line
  return structuredClone(o);
}

/**
 * @template T
 * @param {T} obj
 */
export function objEntries(obj) {
  if (!isNonNullObject(obj)) {
    return [];
  }
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return /** @type {[keyof T, T[keyof T]][]} */ (Object.entries(obj));
}

/**
 * @template T
 * @param {string | null} jsonString
 * @throws {SyntaxError} If the string to parse is not valid JSON.
 */
export function parseJSON(jsonString) {
  if (jsonString === null) {
    return null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return /** @type {T} */ (/** @type {unknown} */ (JSON.parse(jsonString)));
  } catch (e) {
    logError("parsing JSON", e);
    return null;
  }
}