import { SDK, HOOK_PRIORITIES } from "..";

/** @type {(cb: () => void, intval: number) => void} */
export function createTimer(cb, intval) {
  let lastTime = Date.now();
  SDK.hookFunction(
    "GameRun",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof GameRun>} args
     */ (args, next) => {
      const ts = Date.now();
      if (ts - lastTime > intval) {
        lastTime = ts;
        cb();
      }
      return next(args);
    }
  );
}

/**
 * @type {(title: string, text: string) => void}
 */
export function fbcBeepNotify(title, text) {
  SDK.callOriginal("ServerAccountBeep", [
    {
      MemberNumber: Player.MemberNumber || -1,
      BeepType: "",
      MemberName: "FBC",
      ChatRoomName: title,
      Private: true,
      Message: text,
      ChatRoomSpace: "",
    },
  ]);
}