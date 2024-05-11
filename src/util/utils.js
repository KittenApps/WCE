import { logWarn, logError } from "./logger";

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

/** @type {(word: string) => URL | false} */
export function bceParseUrl(word) {
  try {
    const url = new URL(word);
    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }
    return url;
  } catch {
    return false;
  }
}

/** @type {(text: string, x: number, y: number, width: number, color: string, backColor?: string) => void} */
// eslint-disable-next-line no-undefined
export function drawTextFitLeft(text, x, y, width, color, backColor = undefined) {
  const ctx = window.MainCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("could not get canvas 2d context");
  }
  const bk = ctx.textAlign;
  ctx.textAlign = "left";
  DrawTextFit(text, x, y, width, color, backColor);
  ctx.textAlign = bk;
}

/** @type {(x: number, y: number, width: number, text: string, align: "left" | "center") => void} */
export function drawTooltip(x, y, width, text, align) {
  const canvas = window.MainCanvas.getContext("2d");
  if (!canvas) {
    throw new Error("could not get canvas 2d context");
  }
  const bak = canvas.textAlign;
  canvas.textAlign = align;
  DrawRect(x, y, width, 65, "#FFFF88");
  DrawEmptyRect(x, y, width, 65, "black", 2);
  DrawTextFit(text, align === "left" ? x + 3 : x + width / 2, y + 33, width - 6, "black");
  canvas.textAlign = bak;
}

/**
 * @type {(node: HTMLElement | HTMLElement[] | string) => void}
 */
export const fbcChatNotify = (node) => {
  const div = document.createElement("div");
  div.setAttribute("class", "ChatMessage bce-notification");
  div.setAttribute("data-time", ChatRoomCurrentTime());
  div.setAttribute("data-sender", Player.MemberNumber?.toString());
  if (typeof node === "string") {
    div.appendChild(document.createTextNode(node));
  } else if (Array.isArray(node)) {
    div.append(...node);
  } else {
    div.appendChild(node);
  }

  ChatRoomAppendChat(div);
};

/**
 * @type {(text: string, duration?: number, properties?: Partial<ServerBeep>) => Promise<void>}
 */
export const fbcNotify = async (text, duration = 5000, properties = {}) => {
  await waitFor(() => !!Player && new Date(ServerBeep?.Timer || 0) < new Date());

  ServerBeep = {
    Timer: Date.now() + duration,
    Message: text,
    ...properties,
  };
};

/** @type {(effect: EffectName) => boolean} */
export function addCustomEffect(effect) {
  let updated = false;
  const emoticon = Player.Appearance.find((a) => a.Asset.Name === "Emoticon");
  if (!emoticon) {
    logWarn("Could not find emoticon asset.");
    return updated;
  }
  if (!emoticon.Property) {
    emoticon.Property = { Effect: [effect] };
    updated = true;
  } else if (!emoticon.Property.Effect) {
    emoticon.Property.Effect = [effect];
    updated = true;
  } else if (!emoticon.Property.Effect.includes(effect)) {
    emoticon.Property.Effect.push(effect);
    updated = true;
  }
  if (updated && ServerPlayerIsInChatRoom()) {
    ChatRoomCharacterUpdate(Player);
  }
  return updated;
}

/** @type {(effect: EffectName) => boolean} */
export function removeCustomEffect(effect) {
  const emoticon = Player.Appearance.find((a) => a.Asset.Name === "Emoticon");
  let updated = false;
  if (emoticon?.Property?.Effect?.includes(effect)) {
    emoticon.Property.Effect = emoticon.Property.Effect.filter((e) => e !== effect);
    updated = true;
  }
  if (updated && ServerPlayerIsInChatRoom()) {
    ChatRoomCharacterUpdate(Player);
  }
  return updated;
}

export function enableLeashing() {
  addCustomEffect("Leash");
}

export function disableLeashing() {
  removeCustomEffect("Leash");
}