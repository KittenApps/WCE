import { fbcSettings, settingsLoaded } from "../util/settings";
import { waitFor } from "../util/utils";
import { createTimer } from "../util/hooks";
import { HIDDEN, BCE_MSG, MESSAGE_TYPES } from "../util/constants";

const CAPABILITIES = /** @type {const} */ (["clubslave", "antigarble"]);

function blockAntiGarble() {
  return !!(fbcSettings.antiAntiGarble || fbcSettings.antiAntiGarbleStrong || fbcSettings.antiAntiGarbleExtra);
}

/** @type {(target?: number | null, requestReply?: boolean) => void} */
export function sendHello(target = null, requestReply = false) {
  if (!settingsLoaded()) {
    // Don't send hello until settings are loaded
    return;
  }
  if (!ServerIsConnected || !ServerPlayerIsInChatRoom()) {
    // Don't send hello if not in chat room
    return;
  }
  /** @type {ServerChatRoomMessage} */
  const message = {
    Type: HIDDEN,
    Content: BCE_MSG,
    Sender: Player.MemberNumber,
    Dictionary: [],
  };
  /** @type {FBCDictionaryEntry} */
  const fbcMessage = {
    message: {
      type: MESSAGE_TYPES.Hello,
      version: FBC_VERSION,
      alternateArousal: !!fbcSettings.alternateArousal,
      replyRequested: requestReply,
      capabilities: CAPABILITIES,
      blockAntiGarble: blockAntiGarble(),
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

export function shareAddons() {
  waitFor(() => ServerIsConnected && ServerPlayerIsInChatRoom())
  
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