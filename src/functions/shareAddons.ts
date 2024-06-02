import { fbcSettings, settingsLoaded } from "../util/settings";
import { waitFor } from "../util/utils";
import { createTimer } from "../util/hooks";
import { HIDDEN, BCE_MSG, MESSAGE_TYPES, FBC_VERSION } from "../util/constants";

export function sendHello(target: number | null = null, requestReply: boolean = false): void {
  if (!settingsLoaded()) return; // Don't send hello until settings are loaded
  if (!ServerIsConnected || !ServerPlayerIsInChatRoom()) return; // Don't send hello if not in chat room

  const message: ServerChatRoomMessage = {
    Type: HIDDEN,
    Content: BCE_MSG,
    Sender: Player.MemberNumber,
    Dictionary: [],
  };
  const fbcMessage: FBCDictionaryEntry = {
    message: {
      type: MESSAGE_TYPES.Hello,
      version: FBC_VERSION,
      alternateArousal: !!fbcSettings.alternateArousal,
      replyRequested: requestReply,
      capabilities: ["clubslave"],
    },
  };
  if (target) {
    message.Target = target;
  }
  if (fbcSettings.alternateArousal) {
    fbcMessage.message.progress = Player.BCEArousalProgress || Player.ArousalSettings?.Progress || 0;
    fbcMessage.message.enjoyment = Player.BCEEnjoyment || 1;
  }
  if (fbcSettings.shareAddons) {
    fbcMessage.message.otherAddons = bcModSdk.getModsInfo();
  }

  // @ts-ignore - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
  message.Dictionary.push(fbcMessage);
  ServerSend("ChatRoomChat", message);
}

export default function shareAddons(): void {
  waitFor(() => ServerIsConnected && ServerPlayerIsInChatRoom());

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
