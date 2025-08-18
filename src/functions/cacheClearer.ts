import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { createTimer } from "../util/hooks";
import { fbcSettings } from "../util/settings";
import { waitFor } from "../util/utils";
import { debug } from "../util/logger";

type ChatRoomMenuButtonsWCE = (ChatRoomMenuButton | "clearCache")[];

export default function cacheClearer(): void {
  const cacheClearInterval = 1 * 60 * 60 * 1000;

  SDK.hookFunction(
    "ChatRoomMenuBuild",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      const ret = next(args);
      if (fbcSettings.manualCacheClear) (ChatRoomMenuButtons as ChatRoomMenuButtonsWCE).splice(ChatRoomMenuButtons.indexOf("Cut"), 0, "clearCache");
      return ret;
    }
  );

  SDK.hookFunction(
    "ChatRoomMenuClick",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      const ret = next(args);
      if (fbcSettings.manualCacheClear) {
        const Space = 992 / ChatRoomMenuButtons.length;
        for (let B = 0; B < ChatRoomMenuButtons.length; B++) {
          if (MouseXIn(1005 + Space * B, Space - 2) && (ChatRoomMenuButtons as ChatRoomMenuButtonsWCE)[B] === "clearCache") {
            doClearCaches();
          }
        }
      }
      return ret;
    }
  );

  patchFunction(
    "ChatRoomMenuDraw",
    {
      'let suffix = "";': `let suffix = "";
        if (name === "clearCache") {
          DrawButton(1005 + Space * Number(idx), 2, Space - 2, 60, "", color, null, "[WCE] clear and reload the drawing cache of all characters");
          DrawImage("Icons/Small/Reset.png", 976 + Space * Number(idx) + Space / 2, 4);
          continue;
        }`,
    },
    "manual clearing and reloading of drawing cache"
  );

  async function clearCaches(): Promise<void> {
    const start = Date.now();
    const canClear = await waitFor(
      // Only clear when in chat room and not inspecting a character and BC window in focus
      () => CurrentScreen === "ChatRoom" && !CurrentCharacter && document.hasFocus(),
      () => Date.now() - start > cacheClearInterval
    );
    if (canClear && fbcSettings.automateCacheClear) doClearCaches();
  }

  globalThis.bceClearCaches = clearCaches;

  function doClearCaches(): void {
    debug("Clearing caches");
    if (GLDrawCanvas) {
      if (GLDrawCanvas.GL?.textureCache) {
        GLDrawCanvas.GL.textureCache.clear();
      }
      GLDrawResetCanvas();
    }

    debug("Clearing old characters from cache");
    const oldOnlineCharacters = Character.filter(c => c.IsOnline?.() && !ChatRoomCharacter.some(cc => cc.MemberNumber === c.MemberNumber));
    oldOnlineCharacters.forEach(c => CharacterDelete(c));
    Character.filter(c => c.IsOnline?.()).forEach(c => CharacterRefresh(c, false, false));
  }

  createTimer(() => {
    if (fbcSettings.automateCacheClear) clearCaches();
  }, cacheClearInterval);
}
