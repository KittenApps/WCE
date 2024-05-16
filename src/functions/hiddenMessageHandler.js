import { sendHello } from "./shareAddons";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { waitFor } from "../util/utils";
import { debug, logWarn } from "../util/logger";
import { HIDDEN, MESSAGE_TYPES } from "../util/constants";
import { bceStartClubSlave } from "./forcedClubSlave";

export async function hiddenMessageHandler() {
  await waitFor(() => ServerSocket && ServerIsConnected);

  /**
   * @param {ServerChatRoomMessage} data
   */
  function parseBCEMessage(data) {
    /** @type {Partial<BCEMessage>} */
    let message = {};
    if (Array.isArray(data.Dictionary)) {
      const dict = /** @type {FBCDictionaryEntry[]} */ (/** @type {unknown} */ (data.Dictionary));
      message = dict?.find((t) => t.message)?.message || message;
    } else {
      const dict = /** @type {FBCDictionaryEntry} */ (/** @type {unknown} */ (data.Dictionary));
      message = dict?.message || message;
    }
    return message;
  }

  /**
   * @param {Character} sender
   * @param {Partial<BCEMessage>} message
   * @param {boolean} [deferred]
   */
  function processBCEMessage(sender, message, deferred = false) {
    debug("Processing BCE message", sender, message, deferred ? "(deferred)" : "");
    if (!sender?.ArousalSettings && !deferred) {
      /**
       * FBC's socket listener may in some cases run before the game's socket listener initializes the character
       * This is an attempt to fix the issue by ensuring the message gets processed at the end of the current
       * event loop.
       */
      logWarn("No arousal settings found for", sender, "; deferring execution to microtask.");
      queueMicrotask(() => {
        processBCEMessage(sender, message, true);
      });
      return;
    }

    if (!sender?.ArousalSettings) {
      logWarn("No arousal settings found for", sender);
    }

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
        if (
          sender.MemberNumber === Player.Ownership?.MemberNumber &&
          !Player.Appearance.some((a) => a.Asset.Name === "ClubSlaveCollar")
        ) {
          bceStartClubSlave();
        }
        break;
      default:
        break;
    }
  }

  /**
   * @param {Character} sender
   * @param {Partial<BCEMessage>} message
   */
  function processHello(sender, message) {
    sender.FBC = message.version ?? "0.0";
    sender.BCEArousal = message.alternateArousal || false;
    sender.BCEArousalProgress = message.progress || sender.ArousalSettings?.Progress || 0;
    sender.BCEEnjoyment = message.enjoyment || 1;
    sender.BCECapabilities = message.capabilities ?? [];
    if (message.replyRequested) {
      sendHello(sender.MemberNumber);
    }
    sender.FBCOtherAddons = message.otherAddons;
  }

  registerSocketListener(
    "ChatRoomMessage",
    // eslint-disable-next-line complexity
    (data) => {
      if (data.Type !== HIDDEN) {
        return;
      }
      if (data.Content === "BCEMsg") {
        const sender = Character.find((a) => a.MemberNumber === data.Sender);
        if (!sender) {
          return;
        }
        const message = parseBCEMessage(data);
        processBCEMessage(sender, message);
      }
    }
  );

  registerSocketListener("ChatRoomSyncMemberJoin", (data) => {
    if (data.SourceMemberNumber !== Player.MemberNumber) {
      sendHello(data.SourceMemberNumber);
    }
  });

  registerSocketListener("ChatRoomSync", () => {
    sendHello();
  });
}
