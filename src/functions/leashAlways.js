import { waitFor, enableLeashing, disableLeashing } from "../util/utils";
import { fbcSettings } from "../util/settings";

export async function leashAlways() {
  await waitFor(() => AssetFemale3DCG?.some((a) => a.Group === "Pronouns"));
  // @ts-ignore
  AssetFemale3DCG.find((a) => a.Group === "Pronouns").Asset.forEach((p) => (p.AllowEffect = [E.Leash, E.BlurLight]));

  await waitFor(() => Player?.Appearance?.some((a) => a.Asset.Group.Name === "Pronouns"));
  // @ts-ignore
  Player.Appearance.find((a) => a.Asset.Group.Name === "Pronouns").Asset.AllowEffect = [E.Leash, E.BlurLight];

  if (fbcSettings.leashAlways) {
    enableLeashing();
  } else {
    disableLeashing();
  }
}
