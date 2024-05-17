import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor, fbcChatNotify, addCustomEffect, removeCustomEffect } from "../util/utils";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";

export default async function blindWithoutGlasses() {
  await waitFor(() => !!Player && !!Player.Appearance);

  function checkBlindness() {
    if (!fbcSettings.blindWithoutGlasses) {
      return;
    }

    const glasses = [
        "Glasses1",
        "Glasses2",
        "Glasses3",
        "Glasses4",
        "Glasses5",
        "Glasses6",
        "SunGlasses1",
        "SunGlasses2",
        "SunGlassesClear",
        "CatGlasses",
        "VGlasses",
        "GradientSunglasses",
        "FuturisticVisor",
        "InteractiveVisor",
        "InteractiveVRHeadset",
        "FuturisticMask",
        "Goggles",
      ],
      hasGlasses = !!Player.Appearance.find((a) => glasses.includes(a.Asset.Name));

    if (hasGlasses) {
      if (removeCustomEffect("BlurLight")) {
        fbcChatNotify(displayText("Having recovered your glasses you can see again!"));
      }
    } else if (addCustomEffect("BlurLight")) {
      fbcChatNotify(displayText("Having lost your glasses your eyesight is impaired!"));
    }
  }

  // ToDo: Find another Hook for that (onItemChange)
  SDK.hookFunction(
    "GameRun",
    HOOK_PRIORITIES.Observe,
    /**
     * @param {Parameters<typeof GameRun>} args
     */ (args, next) => {
      checkBlindness();
      return next(args);
    }
  );
}
