import { SDK, HOOK_PRIORITIES } from "../util/modding";

/** @type {{ lastTime: number; cb: () => void; intval: number; }[]} */
const timers = [];

/** @type {(cb: () => void, intval: number) => void} */
export function createTimer(cb, intval) {
  timers.push({ cb, intval, lastTime: performance.now() });
}

SDK.hookFunction(
  "GameRun",
  HOOK_PRIORITIES.Top,
  /**
   * @param {Parameters<typeof GameRun>} args
   */
  (args, next) => {
    const ts = performance.now();
    timers.forEach((t) => {
      if (ts - t.lastTime > t.intval) {
        t.lastTime = ts;
        t.cb();
      }
    });
    return next(args);
  }
);

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
