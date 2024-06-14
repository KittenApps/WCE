import { waitFor } from "../util/utils";

export default async function allowCustomEffect() {
  await waitFor(() => AssetFemale3DCG?.some(a => a.Group === "Pronouns"));
  // @ts-ignore
  AssetFemale3DCG.find(a => a.Group === "Pronouns").Asset.forEach(p => (p.AllowEffect = [E.Leash, E.BlurLight]));
  await waitFor(() => Player?.Appearance?.some(a => a.Asset.Group.Name === "Pronouns"));
  // @ts-ignore
  Player.Appearance.find(a => a.Asset.Group.Name === "Pronouns").Asset.AllowEffect = [E.Leash, E.BlurLight];
}
