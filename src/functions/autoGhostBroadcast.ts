import { registerSocketListener } from "./appendSocketListenersToInit";
import { waitFor } from "../util/utils";
import { debug } from "../util/logger";
import { fbcSettings } from "../util/settings";

export default async function autoGhostBroadcast() {
  await waitFor(() => !!ServerSocket && ServerIsConnected);
  registerSocketListener("ChatRoomSyncMemberJoin", (data: ServerChatRoomSyncMemberJoinResponse) => {
    if (fbcSettings.ghostNewUsers && Date.now() - data.Character.Creation < 30000) {
      ChatRoomListManipulation(Player.BlackList, true, data.Character.MemberNumber.toString());
      if (!Player.GhostList) {
        Player.GhostList = [];
      }
      ChatRoomListManipulation(Player.GhostList, true, data.Character.MemberNumber.toString());
      debug(
        "Blacklisted",
        data.Character.Name,
        CharacterNickname(CharacterLoadOnline(data.Character, data.SourceMemberNumber)),
        data.Character.MemberNumber,
        "registered",
        (Date.now() - data.Character.Creation) / 1000,
        "seconds ago"
      );
    }
  });
}
