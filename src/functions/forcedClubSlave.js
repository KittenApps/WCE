import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { BCX } from "./hookBCXAPI";
import { waitFor, isCharacter, fbcSendAction } from "../util/utils";
import { displayText } from "../util/localization";
import { logError } from "../util/logger";
import { HIDDEN, BCE_MSG, MESSAGE_TYPES, FBC_VERSION } from "../util/constants";

export async function forcedClubSlave() {
  const patch = (async function patchDialog() {
    await waitFor(
      () =>
        !!CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"] &&
        CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].length > 150
    );

    const clubSlaveDialog = [
      [
        "160",
        "100",
        displayText("([FBC] Force them to become a Club Slave.)"),
        displayText("(She will become a Club Slave for the next hour.)"),
        "bceSendToClubSlavery()",
        "bceCanSendToClubSlavery()",
      ],
      [
        "160",
        "",
        displayText("([FBC] Force them to become a Club Slave.)"),
        displayText("(Requires both to use compatible versions of FBC and the target to not already be a club slave.)"),
        "",
        "!bceCanSendToClubSlavery()",
      ],
    ];

    const idx = CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].findIndex((v) => v[0] === "160") + 1;
    CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].splice(idx, 0, ...clubSlaveDialog);

    /** @type {(c: Character) => void} */
    const appendDialog = (c) => {
      // @ts-ignore - FBC is not a valid property in the game, but we use it here to mark that we've already added the dialog
      if (!c.Dialog || c.Dialog.some((v) => v.FBC)) {
        return;
      }
      c.Dialog.splice(
        idx,
        0,
        // @ts-ignore - FBC is not a valid property in the game, but we use it here to mark that we've already added the dialog
        ...clubSlaveDialog.map((v) => ({
          Stage: v[0],
          NextStage: v[1],
          Option: v[2]
            .replace("DialogCharacterName", CharacterNickname(c))
            .replace("DialogPlayerName", CharacterNickname(Player)),
          Result: v[3]
            .replace("DialogCharacterName", CharacterNickname(c))
            .replace("DialogPlayerName", CharacterNickname(Player)),
          Function: (v[4].trim().substring(0, 6) === "Dialog" ? "" : "ChatRoom") + v[4],
          Prerequisite: v[5],
          FBC: true,
        }))
      );
    };

    for (const c of ChatRoomCharacter.filter((cc) => !cc.IsPlayer() && cc.IsOnline())) {
      appendDialog(c);
    }

    SDK.hookFunction(
      "CharacterBuildDialog",
      HOOK_PRIORITIES.AddBehaviour,
      /**
       * @param {Parameters<typeof CharacterBuildDialog>} args
       */
      (args, next) => {
        const ret = next(args);
        const [C] = args;
        if (isCharacter(C) && C.IsOnline()) {
          appendDialog(C);
        }
        return ret;
      }
    );
  })();

  window.bceSendToClubSlavery = function () {
    /** @type {ServerChatRoomMessage} */
    const message = {
      Type: HIDDEN,
      Content: BCE_MSG,
      Sender: Player.MemberNumber,
      Dictionary: [
        {
          // @ts-ignore - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
          message: {
            type: MESSAGE_TYPES.Activity,
            version: FBC_VERSION,
            activity: "ClubSlavery",
          },
        },
      ],
    };
    ServerSend("ChatRoomChat", message);
    DialogLeave();
  };

  window.bceCanSendToClubSlavery = function () {
    const C = CurrentCharacter;
    if (!C) {
      return false;
    }
    return C.BCECapabilities?.includes("clubslave") && !C.Appearance.some((a) => a.Asset.Name === "ClubSlaveCollar");
  };

  window.bceGotoRoom = (roomName) => {
    ChatRoomJoinLeash = roomName;
    DialogLeave();
    ChatRoomClearAllElements();
    if (CurrentScreen === "ChatRoom") {
      ServerSend("ChatRoomLeave", "");
      CommonSetScreen("Online", "ChatSearch");
    } else {
      ChatRoomStart("", "", null, null, "Introduction", BackgroundsTagList);
    }
  };

  window.bceStartClubSlave = async () => {
    const managementScreen = "Management";

    if (BCX?.getRuleState("block_club_slave_work")?.isEnforced) {
      fbcSendAction(
        displayText(`BCX rules forbid $PlayerName from becoming a Club Slave.`, {
          $PlayerName: CharacterNickname(Player),
        })
      );
      return;
    }

    fbcSendAction(
      displayText(`$PlayerName gets grabbed by two maids and escorted to management to serve as a Club Slave.`, {
        $PlayerName: CharacterNickname(Player),
      })
    );

    if (!ChatRoomData) {
      logError("ChatRoomData is null in bceStartClubSlave. Was it called outside a chat room?");
      return;
    }

    const room = ChatRoomData.Name;
    ChatRoomClearAllElements();
    ServerSend("ChatRoomLeave", "");
    ChatRoomLeashPlayer = null;
    CommonSetScreen("Room", managementScreen);

    await waitFor(() => !!ManagementMistress);
    if (!ManagementMistress) {
      throw new Error("ManagementMistress is missing");
    }

    PoseSetActive(Player, "Kneel", false);

    // eslint-disable-next-line require-atomic-updates
    ManagementMistress.Stage = "320";
    ManagementMistress.CurrentDialog = displayText(
      "(You get grabbed by a pair of maids and brought to management.) Your owner wants you to be a Club Slave. Now strip."
    );
    CharacterSetCurrent(ManagementMistress);

    await waitFor(() => CurrentScreen !== managementScreen || !CurrentCharacter);

    window.bceGotoRoom(room);
  };

  window.ChatRoombceSendToClubSlavery = window.bceSendToClubSlavery;
  window.ChatRoombceCanSendToClubSlavery = window.bceCanSendToClubSlavery;

  await patch;
}
