import { registerSocketListener } from "./appendSocketListenersToInit";
import { waitFor } from "../util/utils";
import { debug, logWarn, logError } from "../util/logger";
import { fbcSettings, settingsLoaded } from "../util/settings";
import { HIDDEN, BCE_MSG, MESSAGE_TYPES, FBC_VERSION } from "../util/constants";
import { bceStartClubSlave } from "./forcedClubSlave";

type BCECapabilities = "clubslave" | "layeringHide" | "preventLayeringByOthers";
declare global {
  interface Character {
    FBC: string;
    FBCOtherAddons?: readonly import("bondage-club-mod-sdk").ModSDKModInfo[];
    BCEArousal: boolean;
    BCECapabilities: readonly BCECapabilities[];
    BCEArousalProgress: number;
    BCEEnjoyment: number;
    FBCNoteExists: boolean;
    BCESeen: number;
  }
}
interface FBCDictionaryEntry {
  Tag?: string;
  message?: BCEMessage;
  MemberNumber?: number;
  Text?: string;
  TargetCharacter?: number;
  SourceCharacter?: number;
}
interface BCEMessage {
  type: string;
  version: string;
  capabilities?: readonly BCECapabilities[];
  alternateArousal?: boolean;
  replyRequested?: boolean;
  progress?: number;
  enjoyment?: number;
  activity?: "ClubSlavery";
  otherAddons?: readonly import("bondage-club-mod-sdk").ModSDKModInfo[];
}

export function sendHello(target: number | null = null, requestReply = false): void {
  if (!settingsLoaded()) return; // Don't send hello until settings are loaded
  if (!ServerIsConnected || !ServerPlayerIsInChatRoom()) return; // Don't send hello if not in chat room

  const capabilities: BCECapabilities[] = ["clubslave", "layeringHide"];
  if (fbcSettings.preventLayeringByOthers) capabilities.push("preventLayeringByOthers");
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
      alternateArousal: fbcSettings.alternateArousal ?? false,
      replyRequested: requestReply,
      capabilities,
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

  // @ts-expect-error - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
  message.Dictionary.push(fbcMessage);
  ServerSend("ChatRoomChat", message);
}

export default async function hiddenMessageHandler(): Promise<void> {
  await waitFor(() => ServerSocket && ServerIsConnected);

  function parseBCEMessage(data: ServerChatRoomMessage): Partial<BCEMessage> {
    let message: Partial<BCEMessage> = {};
    if (Array.isArray(data.Dictionary)) {
      const dicts: FBCDictionaryEntry[] = data.Dictionary as FBCDictionaryEntry[];
      message = dicts?.find(t => t.message)?.message || message;
    } else {
      const dict: FBCDictionaryEntry = data.Dictionary;
      message = dict?.message || message;
    }
    return message;
  }

  function processBCEMessage(sender: Character, message: Partial<BCEMessage>, deferred = false): void {
    debug("Processing BCE message", sender, message, deferred ? "(deferred)" : "");
    /**
     * FBC's socket listener may in some cases run before the game's socket listener initializes the character
     * This is an attempt to fix the issue by ensuring the message gets processed at the end of the current event loop.
     */
    if (!sender?.ArousalSettings && !deferred) {
      logWarn("No arousal settings found for", sender, "; deferring execution to microtask.");
      queueMicrotask(() => processBCEMessage(sender, message, true));
      return;
    }
    if (!sender?.ArousalSettings) logWarn("No arousal settings found for", sender);

    switch (message.type) {
      case MESSAGE_TYPES.Hello:
        processHello(sender, message);
        break;
      case MESSAGE_TYPES.ArousalSync:
        sender.BCEArousal = message.alternateArousal || false;
        sender.BCEArousalProgress = message.progress || 0;
        sender.BCEEnjoyment = message.enjoyment || 1;
        break;
      case MESSAGE_TYPES.Activity:
        // Sender is owner and player is not already wearing a club slave collar
        if (sender.MemberNumber === Player.Ownership?.MemberNumber && !Player.Appearance.some(a => a.Asset.Name === "ClubSlaveCollar")) {
          bceStartClubSlave();
        }
        break;
      default:
        logError("Invalid BCE message type detected: ", message.type);
    }
  }

  function processHello(sender: Character, message: Partial<BCEMessage>) {
    sender.FBC = message.version ?? "0.0";
    sender.BCEArousal = message.alternateArousal || false;
    sender.BCEArousalProgress = message.progress || sender.ArousalSettings?.Progress || 0;
    sender.BCEEnjoyment = message.enjoyment || 1;
    sender.BCECapabilities = message.capabilities ?? [];
    if (message.replyRequested) sendHello(sender.MemberNumber);
    sender.FBCOtherAddons = message.otherAddons;
  }

  registerSocketListener("ChatRoomMessage", (data: ServerChatRoomMessage) => {
    if (data.Type !== HIDDEN) return;
    if (data.Content === "BCEMsg") {
      const sender = Character.find(a => a.MemberNumber === data.Sender);
      if (!sender) return;
      const message = parseBCEMessage(data);
      processBCEMessage(sender, message);
    }
  });

  registerSocketListener("ChatRoomSyncMemberJoin", (data: ServerChatRoomSyncMemberJoinResponse) => {
    if (data.SourceMemberNumber !== Player.MemberNumber) sendHello(data.SourceMemberNumber);
  });

  registerSocketListener("ChatRoomSync", () => {
    sendHello();
  });
}
