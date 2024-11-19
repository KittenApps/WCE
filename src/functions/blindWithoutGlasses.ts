import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor, fbcChatNotify, addCustomEffect, removeCustomEffect } from "../util/utils";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";

export default async function blindWithoutGlasses(): Promise<void> {
  await waitFor(() => !!Player && !!Player.Appearance);

  function checkBlindness(): void {
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
        // "EyePatch1",
        "CatGlasses",
        "Goggles",
        "VGlasses",
        "GradientSunglasses",
        "JokeGlasses",
        "StreetEyewear",
        "Pincenez",
        "FuturisticVisor",
        "InteractiveVisor",
        "InteractiveVRHeadset",
        "FuturisticMask",
      ],
      hasGlasses = !!Player.Appearance.find(a => glasses.includes(a.Asset.Name));

    if (hasGlasses) {
      if (removeCustomEffect("BlurLight")) {
        fbcChatNotify(displayText("Having recovered your glasses you can see again!"));
      }
    } else if (addCustomEffect("BlurLight")) {
      fbcChatNotify(displayText("Having lost your glasses your eyesight is impaired!"));
    }
  }

  SDK.hookFunction(
    "CharacterAppearanceBuildCanvas",
    HOOK_PRIORITIES.Observe,
    (args, next) => {
      if (fbcSettings.blindWithoutGlasses && args[0].IsPlayer()) checkBlindness();
      return next(args);
    }
  );
}
