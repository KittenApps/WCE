import { createTimer } from "../util/hooks";
import { debug } from "../util/logger";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { waitFor } from "../util/utils";

type ChatRoomMenuButtonWCE = ChatRoomMenuButton | "clearCache";

export default function cacheClearer(): void {
  const cacheClearInterval = 1 * 60 * 60 * 1000;

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

  SDK.hookFunction("ChatRoomMenuBuild", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    const ret = next(args);
    if (fbcSettings.manualCacheClear) (ChatRoomMenuButtons as ChatRoomMenuButtonWCE[]).splice(ChatRoomMenuButtons.indexOf("Cut"), 0, "clearCache");
    return ret;
  });

  SDK.hookFunction("ChatRoomMenuButtonVisualState", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    if ((args[0] as ChatRoomMenuButtonWCE) !== "clearCache") return next(args);
    const state = "Default" as const;
    return { image: "Icons/Small/Reset.png", state, hoverText: "[WCE] clear and reload the drawing cache of all characters" };
  });

  SDK.hookFunction("ChatRoomMenuPerformAction", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    if ((args[0] as ChatRoomMenuButtonWCE) !== "clearCache") return next(args);
    return doClearCaches();
  });

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

  createTimer(() => {
    if (fbcSettings.automateCacheClear) clearCaches();
  }, cacheClearInterval);
}
