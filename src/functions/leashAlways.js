import { enableLeashing, disableLeashing } from "..";
import { waitFor } from "../util/utils";
import { fbcSettings } from "../util/settings";

export async function leashAlways() {
  await waitFor(() => Player?.Appearance?.some((a) => a.Asset.Name === "Emoticon"));
  const emoticon = Player.Appearance.find((a) => a.Asset.Name === "Emoticon");

  if (!emoticon) {
    throw new Error("Could not find emoticon in Player appearance.");
  }

  if (Array.isArray(emoticon.Asset.AllowEffect)) {
    emoticon.Asset.AllowEffect.push("Leash");
  } else {
    // @ts-ignore - not readonly
    emoticon.Asset.AllowEffect = ["Leash"];
  }
  // @ts-ignore - not readonly
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  emoticon.Asset.AllowEffect.push("BlurLight");

  if (fbcSettings.leashAlways) {
    enableLeashing();
  } else {
    disableLeashing();
  }
}
