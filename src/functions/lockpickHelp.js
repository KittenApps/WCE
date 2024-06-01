import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor } from "../util/utils";
import { fbcSettings } from "../util/settings";
import { debug } from "../util/logger";

export default async function lockpickHelp() {
  await waitFor(() => !!StruggleMinigames);

  /** @type {(s: number) => () => number} */
  const newRand = (s) => () => {
    s = Math.sin(s) * 10000;
    return s - Math.floor(s);
  };

  const pinSpacing = 100,
    pinWidth = 200,
    x = 1575,
    y = 300;

  SDK.hookFunction(
    "StruggleLockPickDraw",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      if (fbcSettings.lockpick && StruggleLockPickOrder) {
        const seed = parseInt(StruggleLockPickOrder.join(""));
        const rand = newRand(seed);
        const threshold = SkillGetWithRatio(Player, "LockPicking") / 20;
        const hints = StruggleLockPickOrder.map((a) => {
          const r = rand();
          return r < threshold ? a : false;
        });
        for (let p = 0; p < hints.length; p++) {
          // Replicates pin rendering in the game Struggle.js
          const xx = x - pinWidth / 2 + (0.5 - hints.length / 2 + p) * pinSpacing;
          if (hints[p] !== false) {
            DrawText(`${StruggleLockPickOrder.indexOf(p) + 1}`, xx, y, "blue");
          }
        }
      }
      return next(args);
    }
  );
  debug("hooking struggle for lockpick cheat draw", StruggleMinigames);
  StruggleMinigames.LockPick.Draw = StruggleLockPickDraw;
}
