import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { fbcSettings, settingsLoaded } from "../util/settings";
import { displayText } from "../util/localization";

export async function antiGarbling() {
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
            case "high":
              const int = Math.min(
                SpeechTransformGagGarbleIntensity(Player),
                { low: 1, medium: 3, high: 5 }[fbcSettings[`antiGarble${type}Level`]]
              );
              originalMsg = SpeechTransformGagGarble(msg, int);
              break;
          }
          const intensity = SpeechTransformStutterIntensity(Player);
          if (fbcSettings[`antiGarble${type}Stutter`] && intensity > 0) {
            originalMsg = SpeechTransformStutter(originalMsg, intensity);
          }
        }
      }

      /** @type {ChatMessageDictionary} */
      let Dictionary = [{ Effects: process.effects, Original: originalMsg }];

      return { Content: process.text, Type: type, Dictionary };
    }
  );

  const chatOptions = [
    { value: "none", label: "chat: none" },
    { value: "low", label: "chat: low" },
    { value: "medium", label: "chat: medium" },
    { value: "high", label: "chat: high" },
    { value: "full", label: "chat: full" },
  ];
  const whisperOptions = [
    { value: "off", label: "whis: off" },
    { value: "none", label: "whis: none" },
    { value: "low", label: "whis: low" },
    { value: "medium", label: "whis: medium" },
    { value: "high", label: "whis: high" },
    { value: "full", label: "whis: full" },
  ];

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
        const idx = options.findIndex((o) => o.value === fbcSettings[setting]);
        const len = options.length;
        DrawRect(1810, 878, 185, 120, "Black");
        DrawBackNextButton(
          1810,
          878,
          185,
          50,
          displayText(options[idx].label),
          "White",
          "",
          () => displayText(options[(idx - 1 + len) % len].label),
          () => displayText(options[(idx + 1 + len) % len].label),
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
        const idx = options.findIndex((o) => o.value === fbcSettings[setting]);
        const len = options.length;
        if (MouseIn(1810, 878, 92, 50)) {
          return fbcSettings[setting] = options[(idx - 1 + len) % len].value;
        }
        if (MouseIn(1810 + 92, 878, 93, 50)) {
          return fbcSettings[setting] = options[(idx + 1 + len) % len].value;
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
      if (data.Type == "Chat" && fbcSettings.antiDeaf && Player.GetDeafLevel() > 0) {
        metadata.OriginalMsg = msg;
      }
      return false;
    },
  });

  if (CurrentScreen === "ChatRoom") ChatRoomResize(false);
}
