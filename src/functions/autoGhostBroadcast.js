import { registerSocketListener } from "./appendSocketListenersToInit";
import { waitFor } from "../util/utils";
import { debug } from "../util/logger";
import { fbcSettings } from "../util/settings";

export async function autoGhostBroadcast() {
  await waitFor(() => !!ServerSocket && ServerIsConnected);
  registerSocketListener("ChatRoomSyncMemberJoin", (data) => {
    if (fbcSettings.ghostNewUsers && Date.now() - data.Character.Creation < 30000) {
      ChatRoomListManipulation(Player.BlackList, true, data.Character.MemberNumber.toString());
      if (!Player.GhostList) {
        Player.GhostList = [];
      }
      ChatRoomListManipulation(Player.GhostList, true, data.Character.MemberNumber.toString());
      debug(
        "Blacklisted",
        data.Character.Name,
        // @ts-ignore - CharacterNickname works with this too
        CharacterNickname(data.Character),
        data.Character.MemberNumber,
        "registered",
        (Date.now() - data.Character.Creation) / 1000,
        "seconds ago"
      );
    }
  });
}
