import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { BCX } from "./hookBCXAPI";
import { waitFor, isCharacter, fbcSendAction } from "../util/utils";
import { displayText } from "../util/localization";
import { logError } from "../util/logger";
import { HIDDEN, BCE_MSG, MESSAGE_TYPES, FBC_VERSION } from "../util/constants";

declare global {
  interface DialogLine {
    FBC: boolean;
  }
}

export async function bceStartClubSlave(): Promise<void> {
  if (BCX?.getRuleState("block_club_slave_work")?.isEnforced) {
    fbcSendAction(displayText("BCX rules forbid $PlayerName from becoming a Club Slave.", { $PlayerName: CharacterNickname(Player) }));
    return;
  }

  fbcSendAction(
    displayText("$PlayerName gets grabbed by two maids and escorted to management to serve as a Club Slave.", { $PlayerName: CharacterNickname(Player) })
  );

  if (!ChatRoomData) {
    logError("ChatRoomData is null in bceStartClubSlave. Was it called outside a chat room?");
    return;
  }

  const room = ChatRoomData.Name;
  ChatRoomLeave(false);
  ChatRoomLeashPlayer = null;
  CommonSetScreen("Room", "Management");

  await waitFor(() => !!ManagementMistress);
  if (!ManagementMistress) {
    throw new Error("ManagementMistress is missing");
  }

  PoseSetActive(Player, "Kneel", false);

  ManagementMistress.Stage = "320";
  ManagementMistress.CurrentDialog = displayText(
    "(You get grabbed by a pair of maids and brought to management.) Your owner wants you to be a Club Slave. Now strip."
  );
  CharacterSetCurrent(ManagementMistress);

  await waitFor(() => CurrentScreen !== "Management" || !CurrentCharacter);

  bceGotoRoom(room);
}

export function bceGotoRoom(roomName: string): void {
  ChatRoomJoinLeash = roomName;
  DialogLeave();
  if (CurrentScreen === "ChatRoom") ChatRoomLeave(false);
  if (roomName) {
    ChatRoomStart("X", "", null, null, "Introduction", BackgroundsTagList);
  } else {
    ChatRoomSetLastChatRoom(null);
    CommonSetScreen("Room", "MainHall");
  }
}

export default async function forcedClubSlave(): Promise<void> {
  async function patchDialog(): Promise<void> {
    await waitFor(() =>
      !!CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"] &&
      CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].length > 150
    );

    const clubSlaveDialog = [
      [
        "160",
        "100",
        displayText("([WCE] Force them to become a Club Slave.)"),
        displayText("(She will become a Club Slave for the next hour.)"),
        "bceSendToClubSlavery()",
        "bceCanSendToClubSlavery()",
      ],
      [
        "160",
        "160",
        displayText("([WCE] Force them to become a Club Slave.)"),
        displayText("(Requires both to use compatible versions of WCE and the target to not already be a club slave.)"),
        "",
        "!bceCanSendToClubSlavery()",
      ],
    ];

    const idx = CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].findIndex(v => v[0] === "160") + 1;
    CommonCSVCache["Screens/Online/ChatRoom/Dialog_Online.csv"].splice(idx, 0, ...clubSlaveDialog);

    function appendDialog(C: Character): void {
      if (!C.Dialog || C.Dialog.some(v => v.FBC)) {
        return;
      }
      C.Dialog.splice(
        idx,
        0,
        ...clubSlaveDialog.map(v => ({
          Stage: v[0],
          NextStage: v[1],
          Option: v[2],
          Result: v[3],
          Function: v[4] === "" ? null : `ChatRoom${v[4]}`,
          Prerequisite: v[5],
          Group: null,
          Trait: null,
          FBC: true,
        }))
      );
    }

    for (const c of ChatRoomCharacter.filter(cc => !cc.IsPlayer() && cc.IsOnline())) {
      appendDialog(c);
    }

    // Delay any reloads until all other hooks have finished running
    SDK.hookFunction(
      "CharacterBuildDialog",
      HOOK_PRIORITIES.AddBehaviour,
      ([C, CSV, functionPrefix, reload], next) => {
        const ret = next([C, CSV, functionPrefix, false]);
        if (isCharacter(C) && C.IsOnline()) appendDialog(C);
        if (reload && DialogMenuMode === "dialog") DialogMenuMapping.dialog.Reload(null, { reset: true });
        return ret;
      }
    );
  }

  const patch = patchDialog();

  function bceSendToClubSlavery(): void {
    const message: ServerChatRoomMessage = {
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
  }

  function bceCanSendToClubSlavery(): boolean {
    const C = CurrentCharacter;
    if (!C) {
      return false;
    }
    return C.BCECapabilities?.includes("clubslave") && !C.Appearance.some(a => a.Asset.Name === "ClubSlaveCollar");
  }

  globalThis.bceGotoRoom = bceGotoRoom;
  globalThis.ChatRoombceSendToClubSlavery = bceSendToClubSlavery;
  globalThis.ChatRoombceCanSendToClubSlavery = bceCanSendToClubSlavery;

  await patch;
}
