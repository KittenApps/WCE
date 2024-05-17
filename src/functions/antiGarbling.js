import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { fbcSettings, defaultSettings } from "../util/settings";
import { displayText } from "../util/localization";

export default function antiGarbling() {
  SDK.hookFunction(
    "ChatRoomGenerateChatRoomChatMessage",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof ChatRoomGenerateChatRoomChatMessage>} args
     */
    (args, next) => {
      if (!fbcSettings.antiGarble) return next(args);
      const [type, msg] = args;
      let process = { effects: [], text: msg };

      if (type !== "Whisper" || fbcSettings.antiGarbleWhisperLevel !== "off") {
        process = SpeechTransformProcess(Player, msg, SpeechTransformSenderEffects);
      }

      let originalMsg;
      if (msg !== process.text) {
        if (Player.RestrictionSettings.NoSpeechGarble) {
          originalMsg = msg;
        // @ts-ignore
        } else if (!["off", "full"].includes(fbcSettings[`antiGarble${type}Level`])) {
          if (fbcSettings[`antiGarble${type}BabyTalk`] && SpeechTransformShouldBabyTalk(Player)) {
            originalMsg = SpeechTransformBabyTalk(originalMsg);
          }
          switch (fbcSettings[`antiGarble${type}Level`]) {
            case "none":
              originalMsg = msg;
              break;
            case "low":
            case "medium":
            case "high": {
              const int = Math.min(
                SpeechTransformGagGarbleIntensity(Player),
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                { low: 1, medium: 3, high: 5 }[fbcSettings[`antiGarble${type}Level`]]
              );
              originalMsg = SpeechTransformGagGarble(msg, int);
              break;
            }
          }
          const intensity = SpeechTransformStutterIntensity(Player);
          if (fbcSettings[`antiGarble${type}Stutter`] && intensity > 0) {
            originalMsg = SpeechTransformStutter(originalMsg, intensity);
          }
        }
      }

      const Dictionary = [{ Effects: process.effects, Original: originalMsg }];
      return { Content: process.text, Type: type, Dictionary };
    }
  );

  const chatOptions = defaultSettings.antiGarbleChatLevel.options;
  const whisperOptions = defaultSettings.antiGarbleWhisperLevel.options;

  SDK.hookFunction(
    "ChatRoomRun",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof ChatRoomRun>} args
     */
    (args, next) => {
      const ret = next(args);
      if (fbcSettings.antiGarbleChatOptions) {
        const isWhisper = ChatRoomTargetMemberNumber !== -1 ||
          window.InputChat?.value.startsWith("/w ") ||
          window.InputChat?.value.startsWith("/whisper ");
        const options = isWhisper ? whisperOptions : chatOptions;
        const setting = isWhisper ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
        // @ts-ignore
        const idx = options.indexOf(fbcSettings[setting]);
        const len = options.length;
        DrawRect(1810, 878, 185, 120, "Black");
        DrawBackNextButton(
          1810,
          878,
          185,
          50,
          displayText((isWhisper ? "whis: " : "chat: ") + options[idx]),
          "White",
          "",
          () => displayText((isWhisper ? "Whisper garble level: " : "Chat garble level: ") + options[(idx - 1 + len) % len]),
          () => displayText((isWhisper ? "Whisper garble level: " : "Chat garble level: ") + options[(idx + 1 + len) % len]),
          false,
          null,
          // @ts-ignore
          { X: 1000, Y: 910, Width: 200, Height: 90 }
        );
        DrawButton(1810, 928, 185, 70, "", "White");
        DrawImage("Icons/Small/Chat.png", 1875, 935);
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "ChatRoomClick",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    /**
     * @param {Parameters<typeof ChatRoomClick>} args
     */
    (args, next) => {
      if (fbcSettings.antiGarbleChatOptions && MouseIn(1810, 878, 185, 120)) {
        if (MouseIn(1810, 928, 185, 70)) return ChatRoomSendChat();
        const isWhisper = ChatRoomTargetMemberNumber !== -1 ||
          window.InputChat?.value.startsWith("/w ") ||
          window.InputChat?.value.startsWith("/whisper ");
        const options = isWhisper ? whisperOptions : chatOptions;
        const setting = isWhisper ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
        // @ts-ignore
        const idx = options.indexOf(fbcSettings[setting]);
        const len = options.length;
        if (MouseIn(1810, 878, 92, 50)) {
          fbcSettings[setting] = options[(idx - 1 + len) % len];
          return null;
        }
        if (MouseIn(1810 + 92, 878, 93, 50)) {
          fbcSettings[setting] = options[(idx + 1 + len) % len];
          return null;
        }
      }
      return next(args);
    }
  );

  patchFunction(
    "ElementPositionFixed",
    {
      "const Font = MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 50 : MainCanvas.canvas.clientHeight / 25;": `let Font;
        if (fbcSettingValue("antiGarbleChatOptions") && ElementID === "InputChat") {
          Font = MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 60 : MainCanvas.canvas.clientHeight / 30;
        } else {
          Font = MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 50 : MainCanvas.canvas.clientHeight / 25;
        }`,
    },
    "better ChatInput won't have smaller fontsize"
  );

  ChatRoomRegisterMessageHandler({
    Description: "show OriginalMsg while deafened",
    Priority: 90,
    Callback: (data, sender, msg, metadata) => {
      if (data.Type === "Chat" && fbcSettings.antiDeaf && Player.GetDeafLevel() > 0) {
        metadata.OriginalMsg = msg;
      }
      return false;
    },
  });

  if (CurrentScreen === "ChatRoom") ChatRoomResize(false);
}
