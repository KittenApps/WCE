import { SDK, HOOK_PRIORITIES } from "..";
import { createTimer } from "../util/hooks";
import { fbcSettings } from "../util/settings";

export function autoStruggle() {
  SDK.hookFunction(
    "StruggleFlexibilityCheck",
    HOOK_PRIORITIES.OverrideBehaviour,
    /**
     * @param {Parameters<typeof StruggleFlexibilityCheck>} args
     */
    (args, next) => {
      if (fbcSettings.autoStruggle) {
        if (StruggleProgressFlexCircles && StruggleProgressFlexCircles.length > 0) {
          StruggleProgressFlexCircles.splice(0, 1);
          return true;
        }
      }
      return next(args);
    }
  );

  createTimer(() => {
    if (!fbcSettings.autoStruggle) {
      return;
    }

    if (typeof StruggleProgress !== "number" || StruggleProgress < 0) {
      return;
    }

    if (StruggleProgressCurrentMinigame === "Strength") {
      StruggleStrengthProcess(false);
    } else if (StruggleProgressCurrentMinigame === "Flexibility") {
      if (StruggleProgressFlexCircles && StruggleProgressFlexCircles.length > 0) {
        StruggleFlexibilityProcess(false);
      }
    }
  }, 60);

  createTimer(() => {
    if (!fbcSettings.autoStruggle) {
      return;
    }

    if (typeof StruggleProgress !== "number" || StruggleProgress < 0) {
      return;
    }
    if (StruggleProgressCurrentMinigame === "Dexterity") {
      // Duplicated logic from StruggleDexterity
      const distMult = Math.max(
        -0.5,
        Math.min(1, (85 - Math.abs(StruggleProgressDexTarget - StruggleProgressDexCurrent)) / 75)
      );
      if (distMult > 0.5) {
        StruggleDexterityProcess();
      }
    }
  }, 0);
}
