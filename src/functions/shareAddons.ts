import { fbcSettings } from "../util/settings";
import { waitFor } from "../util/utils";
import { createTimer } from "../util/hooks";
import { sendHello } from "./hiddenMessageHandler";

export default async function shareAddons(): Promise<void> {
  await waitFor(() => ServerIsConnected && ServerPlayerIsInChatRoom());

  sendHello(null, true);

  createTimer(() => {
    const loadedAddons = bcModSdk.getModsInfo();
    if (
      fbcSettings.shareAddons &&
      JSON.stringify(loadedAddons) !== JSON.stringify(Player.FBCOtherAddons) &&
      ServerIsConnected &&
      ServerPlayerIsInChatRoom()
    ) {
      Player.FBCOtherAddons = loadedAddons;
      sendHello(null, true);
    }
  }, 5000);
}
