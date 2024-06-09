import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { fbcSettings, defaultSettings } from "../util/settings";
import { displayText } from "../util/localization";
import { stutterWord } from "./chatAugments";

export default function antiGarbling(): void {
  SDK.hookFunction(
    "ChatRoomGenerateChatRoomChatMessage",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (!fbcSettings.antiGarble) return next(args);
      const [type, msg] = args;
      let process: {effects: SpeechTransformName[]; text: string;} = { effects: [], text: msg };
      let originalMsg: string;

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
          } else if (fbcSettings[`antiGarble${type}Level`] !== "full") {
            originalMsg = msg;
            if (fbcSettings[`antiGarble${type}BabyTalk`] === "preserve" && shouldBabyTalk) {
              originalMsg = SpeechTransformBabyTalk(originalMsg);
            }
            if (["low", "medium", "high"].includes(fbcSettings[`antiGarble${type}Level`])) {
              const int = Math.min(gagIntensity, { low: 1, medium: 3, high: 5 }[fbcSettings[`antiGarble${type}Level`]]);
              originalMsg = SpeechTransformGagGarble(originalMsg, int);
            }
            if (fbcSettings[`antiGarble${type}Stutter`] === "preserve" && stutterIntensity > 0) {
              originalMsg = fbcSettings.stutters ? stutterWord(originalMsg, true).results.join("") : SpeechTransformStutter(originalMsg, stutterIntensity);
            }
          }
        }
        // eslint-disable-next-line no-undefined
        if (process.text === originalMsg) originalMsg = undefined;
      }

      const Dictionary: ChatMessageDictionary = [{ Effects: process.effects, Original: originalMsg }];
      return { Content: process.text, Type: type, Dictionary };
    }
  );

  const chatOptions = defaultSettings.antiGarbleChatLevel.options;
  const whisperOptions = defaultSettings.antiGarbleWhisperLevel.options;
  const effectOptions = defaultSettings.antiGarbleChatBabyTalk.options;

  // ToDo: remove once r105 is out
  if (GameVersion === 'R104') {
    SDK.hookFunction(
      "ChatRoomRun",
      HOOK_PRIORITIES.ModifyBehaviourMedium,
      (args, next) => {
        const ret = next(args);
        if (fbcSettings.antiGarbleChatOptions) {
          const isWhisper = ChatRoomTargetMemberNumber !== -1 ||
            window.InputChat?.value.startsWith("/w ") ||
            window.InputChat?.value.startsWith("/whisper ");
          const options = isWhisper ? whisperOptions : chatOptions;
          const setting = isWhisper ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
          const idx = options.indexOf(fbcSettings[setting]);
          const len = options.length;
          DrawRect(1810, 878, 185, 120, "Black");
          DrawBackNextButton(
            1810,
            878,
            185,
            50,
            displayText((isWhisper ? "whis: " : "chat: ") + options[idx]),
            idx === 5 ? "Lightgreen" : `#${(15 - idx * 2).toString(16).repeat(6)}`,
            "",
            () => displayText((isWhisper ? "Whisper garble level: " : "Chat garble level: ") + options[(idx - 1 + len) % len]),
            () => displayText((isWhisper ? "Whisper garble level: " : "Chat garble level: ") + options[(idx + 1 + len) % len]),
            false,
            null,
            // @ts-ignore
            { X: 1000, Y: 910, Width: 200, Height: 90 }
          );
          const stidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter"]);
          const btidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk"]);
          DrawButton(
            1810,
            928,
            35,
            35,
            "",
            idx > 3 ? "#555555" : `#${(15 - stidx * 3).toString(16).repeat(6)}`,
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
            idx > 3 ? "#555555" : `#${(15 - btidx * 3).toString(16).repeat(6)}`,
            `${PUBLIC_URL}/baby.png`,
            `${isWhisper ? "Whisper" : "Chat"} baby talk: ${fbcSettings[isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk"]}`,
            idx > 3,
            // @ts-ignore
            { X: 1000, Y: 910, Width: 200, Height: 90 }
          );
          DrawButton(1845, 928, 150, 70, "", "White");
          DrawImage("Icons/Small/Chat.png", 1895, 935);
        }
        return ret;
      }
    );

    SDK.hookFunction(
      "ChatRoomClick",
      HOOK_PRIORITIES.ModifyBehaviourHigh,
      (args, next) => {
        if (fbcSettings.antiGarbleChatOptions && MouseIn(1810, 878, 185, 120)) {
          if (MouseIn(1845, 928, 150, 70)) return ChatRoomSendChat();
          const isWhisper = ChatRoomTargetMemberNumber !== -1 ||
            window.InputChat?.value.startsWith("/w ") ||
            window.InputChat?.value.startsWith("/whisper ");
          const options = isWhisper ? whisperOptions : chatOptions;
          const setting = isWhisper ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
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
            const stidx = effectOptions.indexOf(fbcSettings[isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter"]);
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
  } else {
    // R105

    /** Click listener for managing the baby talk button. */
    function babyTalkOnClick(this: HTMLButtonElement) {
      if (this.disabled || this.getAttribute("aria-disabled") === "true") {
        return;
      }

      const isWhisper = this.classList.contains("wce-whisper");
      const key = isWhisper ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk";
      const idx = effectOptions.indexOf(fbcSettings[key]);
      const state = effectOptions[(idx + 1) % effectOptions.length];
      fbcSettings[key] = state;
      resetChatButtonStates(this.id);
    }

    /** Click listener for managing the stutter button. */
    function stutterOnClick(this: HTMLButtonElement) {
      if (this.disabled || this.getAttribute("aria-disabled") === "true") {
        return;
      }

      const isWhisper = this.classList.contains("wce-whisper");
      const key = isWhisper ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter";
      const idx = effectOptions.indexOf(fbcSettings[key]);
      const state = effectOptions[(idx + 1) % effectOptions.length];
      fbcSettings[key] = state;
      resetChatButtonStates(this.id);
    }

    /** Click listener for managing the garble level button. */
    function garbleOnClick(this: HTMLButtonElement) {
      if (this.disabled || this.getAttribute("aria-disabled") === "true") {
        return;
      }

      // Update the garble settings
      const isWhisper = this.classList.contains("wce-whisper");
      const options = isWhisper ? whisperOptions : chatOptions;
      const key = isWhisper ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
      const idx = options.indexOf(fbcSettings[key]);
      const state = options[(idx + 1) % options.length];
      fbcSettings[key] = state;
      resetChatButtonStates();
    }

    type AntiGarbleKeys = (
      "antiGarbleChatBabyTalk"
      | "antiGarbleWhisperBabyTalk"
      | "antiGarbleChatStutter"
      | "antiGarbleWhisperStutter"
      | "antiGarbleChatLevel"
      | "antiGarbleWhisperLevel"
    );

    /**
     * Reset the WCE chat button state (and tooltips) to match the players `fbcSettings`
     * @param id - The ID of the to-be updated button; update all buttons if ommited
     */
    function resetChatButtonStates(id?: string) {
      const buttons: Record<string, { state: AntiGarbleKeys, whisperState: AntiGarbleKeys }> = {
        "wce-chat-garble": { state: "antiGarbleChatLevel", whisperState: "antiGarbleWhisperLevel" },
        "wce-chat-baby-talk": { state: "antiGarbleChatBabyTalk", whisperState: "antiGarbleWhisperBabyTalk" },
        "wce-chat-stutters": { state: "antiGarbleChatStutter", whisperState: "antiGarbleWhisperStutter" },
      };

      let garbleIsFull: null | boolean = null;
      const entries = id ? [[id, buttons[id]] as const] : Object.entries(buttons);
      for (const [buttonId, { state, whisperState }] of entries) {
        const button = document.getElementById(buttonId) as null | HTMLButtonElement;
        const tooltip = document.getElementById(button?.getAttribute("aria-describedby")) as null | HTMLDivElement;
        if (button && tooltip) {
          button.dataset.state = fbcSettings[state];
          button.dataset.whisperState = fbcSettings[whisperState];

          const isWhisper = button.classList.contains("wce-whisper");
          const key = isWhisper ? whisperState : state;
          const idx = defaultSettings[key].options.indexOf(fbcSettings[key]);
          tooltip.innerText = defaultSettings[key].tooltips[idx].split("(")[0].trim();

          if (buttonId === "wce-chat-garble") {
            garbleIsFull = fbcSettings[state] === "full";
          } else if (garbleIsFull !== null) {
            // Ensure that all non-`#wce-chat-garble` buttons are disabled when garbling is set to `full`
            button.setAttribute("aria-disabled", garbleIsFull);
          }
        }
      }
    }

    /** Set or remove the .wce-whisper css class on all WCE chat room buttoms and update their tooltip */
    function whisperUpdate(isWhisper: boolean) {
      let needsUpdate = false;
      const buttons = document.querySelectorAll("#chat-room-buttons > button.wce-chat-room-button");
      buttons.forEach(b => {
        needsUpdate ||= (isWhisper && !b.classList.contains("wce-whisper")) || (!isWhisper && b.classList.contains("wce-whisper"));
        if (isWhisper) {
          b.classList.add("wce-whisper");
        } else {
          b.classList.remove("wce-whisper");
        }
      });
      if (needsUpdate) {
        resetChatButtonStates();
      }
    }

    // Attach extra DOM buttons to the chat button grid for managing stuttering, garbling and babytalk
    SDK.hookFunction(
      "ChatRoomCreateElement",
      HOOK_PRIORITIES.ModifyBehaviourHigh,
      (args, next) => {
        // Event listener for attaching the .wce-whisper css class to the chat buttons while whispering
        // Make sure this is only done the very first time the input chat is created
        if (!document.getElementById("chat-room-div")) {
          const chatInput = document.getElementById("#InputChat") as null | HTMLInputElement;
          if (chatInput) {
            chatInput.addEventListener("input", function wceInputChatListener() {
              const isWhisper = this.value.startsWith("/w ") || this.value.startsWith("/whisper ");
              whisperUpdate(isWhisper);
            });
          }
        }

        const div = next(args);
        if (!fbcSettings.antiGarbleChatOptions) {
          return div;
        }

        // Only add the WCE chat room buttons if they do not yet exist
        const buttonGrid: null | HTMLDivElement = div.querySelector("#chat-room-buttons");
        if (buttonGrid && !buttonGrid.querySelector(".wce-chat-room-button")) {
          ElementMenu.AppendButton(buttonGrid, ElementButton.Create(
            "wce-chat-garble", garbleOnClick, {},
            { button: { classList: ["chat-room-button", "wce-chat-room-button"], style: { display: "none" } } },
          ));
          ElementMenu.AppendButton(buttonGrid, ElementButton.Create(
            "wce-chat-baby-talk", babyTalkOnClick, {},
            { button: { classList: ["chat-room-button", "wce-chat-room-button"], style: { display: "none" } } },
          ));
          ElementMenu.AppendButton(buttonGrid, ElementButton.Create(
            "wce-chat-stutters", stutterOnClick, {},
            { button: { classList: ["chat-room-button", "wce-chat-room-button"], style: { display: "none" } } },
          ));
          resetChatButtonStates();
        }

        return div;
      },
    );

    // Attach the .wce-whisper css class to the wce chat buttons while whispering
    SDK.hookFunction(
      "ChatRoomSetTarget",
      HOOK_PRIORITIES.ModifyBehaviourHigh,
      ([memberNumer, ...args], next) => {
        const isWhisper = Number.isInteger(memberNumer) && memberNumer !== -1;
        whisperUpdate(isWhisper);
        return next([memberNumer, ...args]);
      },
    );

    // Better ChatInput won't have smaller fontsize
    SDK.hookFunction(
      "ChatRoomResize",
      HOOK_PRIORITIES.ModifyBehaviourHigh,
      (args, next) => {
        next(args);
        const elem = document.getElementById("InputChat");
        if (fbcSettings.antiGarbleChatOptions && elem) {
          elem.style.fontSize = `${MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 60 : MainCanvas.canvas.clientHeight / 30}px`;
        }
      },
    );
  }

  ChatRoomRegisterMessageHandler({
    Description: "show OriginalMsg while deafened",
    Priority: 90,
    Callback: (data, _, msg, metadata) => {
      if (data.Type === "Chat" && fbcSettings.antiDeaf && Player.GetDeafLevel() > 0) {
        metadata.OriginalMsg = msg;
      }
      return false;
    },
  });

  if (CurrentScreen === "ChatRoom") ChatRoomResize(false);
}
