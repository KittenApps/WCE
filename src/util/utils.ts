import { logWarn, logError } from "./logger";

export function sleep(ms: number): Promise<number> {
  // oxlint-disable-next-line avoid-new
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export async function waitFor(func: () => boolean, cancelFunc: () => boolean = () => false): Promise<boolean> {
  while (!func()) {
    if (cancelFunc()) {
      return false;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(10);
  }
  return true;
}

export function isString(s: unknown): s is string {
  return typeof s === "string";
}

export function isNonNullObject(o: unknown): o is Record<string, unknown> {
  return !!o && typeof o === "object" && !Array.isArray(o);
}

export function isChatMessage(m: unknown): m is ServerChatRoomMessage {
  return (
    isNonNullObject(m) &&
    typeof m.Type === "string" &&
    typeof m.Content === "string"
  );
}

export function isCharacter(c: unknown): c is Character {
  return isNonNullObject(c) && typeof c.IsPlayer === "function";
}

export function isStringOrStringArray(c: unknown): c is (string | string[]) {
  return isString(c) || (Array.isArray(c) && c.every(isString));
}

export function isWardrobe(o: unknown): o is ItemBundle[][] {
  return Array.isArray(o) && o.every(b => isItemBundleArray(b) || b === null);
}

function isItemBundle(o: unknown): o is ItemBundle {
  return (
    isNonNullObject(o) &&
    typeof o.Name === "string" &&
    typeof o.Group === "string"
  );
}

function isItemBundleArray(o: unknown): o is ItemBundle[] {
  return Array.isArray(o) && o.every(isItemBundle);
}

export function mustNum(id: number, def: number = -Number.MAX_SAFE_INTEGER): number {
  return id ?? def;
}

export function deepCopy<T>(o: T): T {
  return structuredClone(o);
}

export function objEntries<T>(obj: T): [keyof T, T[keyof T]][] {
  if (!isNonNullObject(obj)) {
    return [];
  }
  return Object.entries(obj) as [keyof T, T[keyof T]][];
}

export function parseJSON<T>(jsonString: string | null): T {
  if (jsonString === null) {
    return null;
  }
  try {
    return JSON.parse(jsonString) as T;
  } catch(e) {
    logError("parsing JSON", e);
    return null;
  }
}

export function drawTextFitLeft(text: string, x: number, y: number, width: number, color: string, backColor?: string): void {
  const ctx = window.MainCanvas.getContext("2d");
  if (!ctx) {
    throw new Error("could not get canvas 2d context");
  }
  const bk = ctx.textAlign;
  ctx.textAlign = "left";
  DrawTextFit(text, x, y, width, color, backColor);
  ctx.textAlign = bk;
}

export function drawTooltip(x: number, y: number, width: number, text: string, align: CanvasTextAlign): void {
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

export function fbcChatNotify(node: HTMLElement | HTMLElement[] | string): void {
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
}

export async function fbcNotify(text: string, options?: { duration?: number; openFriendlist?: boolean; silent?: boolean }): Promise<void> {
  await waitFor(() => !!Player);
  ServerShowBeep(text, options?.duration ?? 5000, {
    silent: options?.silent ?? true,
    ...(options?.openFriendlist && { onClick: (): void => { FriendListShow(); } }),
  });
}

export function fbcSendAction(text: string): void {
  ServerSend("ChatRoomChat", {
    Content: "Beep",
    Type: "Action",
    Dictionary: [
      // EN
      { Tag: "Beep", Text: "msg" },
      // CN
      { Tag: "发送私聊", Text: "msg" },
      // DE
      { Tag: "Biep", Text: "msg" },
      // FR
      { Tag: "Sonner", Text: "msg" },
      // Message itself
      { Tag: "msg", Text: text },
    ],
  });
}

export function addCustomEffect(effect: EffectName): boolean {
  let updated = false;
  const pronouns = Player.Appearance.find(a => a.Asset.Group.Name === "Pronouns");
  if (!pronouns) {
    logWarn("Could not find pronouns asset.");
    return updated;
  }
  if (!pronouns.Property) {
    pronouns.Property = { Effect: [effect] };
    updated = true;
  } else if (!pronouns.Property.Effect) {
    pronouns.Property.Effect = [effect];
    updated = true;
  } else if (!pronouns.Property.Effect.includes(effect)) {
    pronouns.Property.Effect.push(effect);
    updated = true;
  }
  if (updated && ServerPlayerIsInChatRoom()) {
    ChatRoomCharacterUpdate(Player);
  }
  return updated;
}

export function removeCustomEffect(effect: EffectName): boolean {
  const pronouns = Player.Appearance.find(a => a.Asset.Group.Name === "Pronouns");
  let updated = false;
  if (pronouns?.Property?.Effect?.includes(effect)) {
    pronouns.Property.Effect = pronouns.Property.Effect.filter(e => e !== effect);
    updated = true;
  }
  if (updated && ServerPlayerIsInChatRoom()) {
    ChatRoomCharacterUpdate(Player);
  }
  return updated;
}

export function enableLeashing(): void {
  addCustomEffect("Leash");
}

export function disableLeashing(): void {
  removeCustomEffect("Leash");
}
