import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { fbcSettings, defaultSettings } from "../util/settings";
import { displayText } from "../util/localization";
import { stutterWord } from "./chatAugments";

export default function antiGarbling() {
  SDK.hookFunction(
    "ChatRoomGenerateChatRoomChatMessage",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof ChatRoomGenerateChatRoomChatMessage>} args
     */
    // eslint-disable-next-line complexity
    (args, next) => {
      if (!fbcSettings.antiGarble) return next(args);
      const [type, msg] = args;
      let process = { effects: [], text: msg };
      let originalMsg;

      if (type !== "Whisper" || fbcSettings.antiGarbleWhisperLevel !== "off") {
        process = SpeechTransformProcess(Player, msg, SpeechTransformSenderEffects);
        const shouldBabyTalk = SpeechTransformShouldBabyTalk(Player);
        const gagIntensity = SpeechTransformGagGarbleIntensity(Player);
        const stutterIntensity = SpeechTransformStutterIntensity(Player);
        if (gagIntensity > 0 ||
          (fbcSettings[`antiGarble${type}BabyTalk`] === "remove" && shouldBabyTalk) ||
          (fbcSettings[`antiGarble${type}Stutter`] === "remove" && stutterIntensity > 0)
        ) {
          if (Player.RestrictionSettings.NoSpeechGarble) {
            originalMsg = msg;
          // @ts-ignore
          } else if (fbcSettings[`antiGarble${type}Level`] !== "full") {
            if (fbcSettings[`antiGarble${type}BabyTalk`] === "preserve" && shouldBabyTalk) {
              originalMsg = SpeechTransformBabyTalk(originalMsg);
            }
            switch (fbcSettings[`antiGarble${type}Level`]) {
              case "none":
                originalMsg = msg;
                break;
              case "low":
              case "medium":
              case "high": {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                const int = Math.min(gagIntensity, { low: 1, medium: 3, high: 5 }[fbcSettings[`antiGarble${type}Level`]]);
                originalMsg = SpeechTransformGagGarble(msg, int);
                break;
              }
            }
            if (fbcSettings[`antiGarble${type}Stutter`] === "preserve" && stutterIntensity > 0) {
              originalMsg = fbcSettings.stutters ? stutterWord(originalMsg, true).results.join("") : SpeechTransformStutter(originalMsg, stutterIntensity);
            }
          }
        }
        // eslint-disable-next-line no-undefined
        if (process.text === originalMsg) originalMsg = undefined;
      }

      const Dictionary = [{ Effects: process.effects, Original: originalMsg }];
      return { Content: process.text, Type: type, Dictionary };
    }
  );

  const chatOptions = defaultSettings.antiGarbleChatLevel.options;
  const whisperOptions = defaultSettings.antiGarbleWhisperLevel.options;
  const effectOptions = defaultSettings.antiGarbleChatBabyTalk.options;

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
          idx === 5 ? "Lightgreen" : `#${`${(15 - idx * 2).toString(16)}`.repeat(6)}`,
          "",
          () => displayText((isWhisper ? "Whisper garble level: " : "Chat garble level: ") + options[(idx - 1 + len) % len]),
          () => displayText((isWhisper ? "Whisper garble level: " : "Chat garble level: ") + options[(idx + 1 + len) % len]),
          false,
          null,
          // @ts-ignore
          { X: 1000, Y: 910, Width: 200, Height: 90 }
        );
        // @ts-ignore
        const stidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter"]);
        // @ts-ignore
        const btidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk"]);
        DrawButton(
          1810,
          928,
          35,
          35,
          "",
          idx > 3 ? "#555555" : `#${`${(15 - stidx * 3).toString(16)}`.repeat(6)}`,
          `${PUBLIC_URL}/stutter.png`,
          `${isWhisper ? "Whisper" : "Chat"} stutters: ${fbcSettings[isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter"]}`,
          idx > 3,
          // @ts-ignore
          { X: 1000, Y: 910, Width: 200, Height: 90 }
        );
        DrawButton(
          1810,
          963,
          35,
          35,
          "",
          idx > 3 ? "#555555" : `#${`${(15 - btidx * 3).toString(16)}`.repeat(6)}`,
          `${PUBLIC_URL}/baby.png`,
          `${isWhisper ? "Whisper" : "Chat"} baby talk: ${fbcSettings[isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk"]}`,
          idx > 3,
          // @ts-ignore
          { X: 1000, Y: 910, Width: 200, Height: 90 }
        );
        DrawButton(1845, 928, 150, 70, "", "White");
        DrawImage("Icons/Small/Chat.png", 1898, 935);
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
        if (MouseIn(1845, 928, 150, 70)) return ChatRoomSendChat();
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
          fbcSettings[setting] = options[(idx + 1) % len];
          return null;
        }
        if (idx <= 3) {
          // @ts-ignore
          const stidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter"]);
          // @ts-ignore
          const btidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk"]);
          if (MouseIn(1810, 928, 35, 35)) {
            fbcSettings[isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter"] = effectOptions[(stidx + 1) % 3];
            return null;
          }
          if (MouseIn(1810, 963, 35, 35)) {
            fbcSettings[isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk"] = effectOptions[(btidx + 1) % 3];
            return null;
          }
        }
      }
      return next(args);
    }
  );

  patchFunction(
    "ElementPosition",
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
