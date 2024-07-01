import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings, defaultSettings } from "../util/settings";
import { stutterWord } from "./chatAugments";

export let createChatOptions: (div: HTMLDivElement) => void;

export default function antiGarbling(): void {
  SDK.hookFunction(
    "ChatRoomGenerateChatRoomChatMessage",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (!fbcSettings.antiGarble) return next(args);
      const [type, msg] = args;
      let process: { effects: SpeechTransformName[]; text: string } = { effects: [], text: msg };
      let originalMsg: string | undefined;

      if (type !== "Whisper" || fbcSettings.antiGarbleWhisperLevel !== "off") {
        process = SpeechTransformProcess(Player, msg, SpeechTransformSenderEffects);
        const shouldBabyTalk = SpeechTransformShouldBabyTalk(Player);
        const gagIntensity = SpeechTransformGagGarbleIntensity(Player);
        const stutterIntensity = SpeechTransformStutterIntensity(Player);
        if (gagIntensity > 0 ||
          (fbcSettings[`antiGarble${type}BabyTalk`] === "remove" && shouldBabyTalk) ||
          (fbcSettings[`antiGarble${type}Stutter`] === "remove" && stutterIntensity > 0)
        ) {
          if (Player.RestrictionSettings?.NoSpeechGarble) {
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

  const effectOptions = defaultSettings.antiGarbleChatBabyTalk.options;

  /** Click listener for managing the baby talk button. */
  function BabyTalkOnClick(this: HTMLButtonElement) {
    if (this.disabled || this.getAttribute("aria-disabled") === "true") return;
    const key = this.parentElement.classList.contains("wce-whisper") ? "antiGarbleWhisperBabyTalk" : "antiGarbleChatBabyTalk";
    const idx = effectOptions.indexOf(fbcSettings[key]);
    fbcSettings[key] = effectOptions[(idx + 1) % effectOptions.length];
    resetChatButtonStates(this.id);
  }

  /** Click listener for managing the stutter button. */
  function StutterOnClick(this: HTMLButtonElement) {
    if (this.disabled || this.getAttribute("aria-disabled") === "true") return;
    const key = this.parentElement.classList.contains("wce-whisper") ? "antiGarbleWhisperStutter" : "antiGarbleChatStutter";
    const idx = effectOptions.indexOf(fbcSettings[key]);
    fbcSettings[key] = effectOptions[(idx + 1) % effectOptions.length];
    resetChatButtonStates(this.id);
  }

  /** Change listener for managing the garble level select. */
  function GarbleOnChange(this: HTMLSelectElement) {
    const key = this.parentElement.parentElement.classList.contains("wce-whisper") ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
    fbcSettings[key] = this.value;
    resetChatButtonStates();
  }

  /**
   * Reset the WCE chat button state (and tooltips) to match the players `fbcSettings`
   * @param id - The ID of the to-be updated button; update all buttons if ommited
   */
  function resetChatButtonStates(id?: string) {
    type AntiGarbleKeys = "antiGarbleChatBabyTalk" | "antiGarbleWhisperBabyTalk" | "antiGarbleChatStutter" | "antiGarbleWhisperStutter";
    const buttons: Record<string, { state: AntiGarbleKeys; whisperState: AntiGarbleKeys }> = {
      "wce-chat-baby-talk": { state: "antiGarbleChatBabyTalk", whisperState: "antiGarbleWhisperBabyTalk" },
      "wce-chat-stutters": { state: "antiGarbleChatStutter", whisperState: "antiGarbleWhisperStutter" },
    };
    const div = document.getElementById("chat-room-buttons") as null | HTMLDivElement;
    const isWhisper = div.classList.contains("wce-whisper");
    const select = document.getElementById("wce-chat-garble") as null | HTMLSelectElement;

    if (!id) {
      const tooltip = document.getElementById(select?.getAttribute("aria-describedby")) as null | HTMLDivElement;
      if (select && tooltip) {
        const key = isWhisper ? "antiGarbleWhisperLevel" : "antiGarbleChatLevel";
        select.value = fbcSettings[key];
        select.dataset.state = fbcSettings[key];
        tooltip.innerText = `${isWhisper ? "Whisper" : "Chat"} garble level: ${fbcSettings[key]}`;
      }
    }

    const garbleIsFull = ["full", "off"].includes(select?.value);
    const entries = id ? [[id, buttons[id]] as const] : Object.entries(buttons);
    for (const [buttonId, { state, whisperState }] of entries) {
      const button = document.getElementById(buttonId) as null | HTMLButtonElement;
      const tooltip = document.getElementById(button?.getAttribute("aria-describedby")) as null | HTMLDivElement;
      if (button && tooltip) {
        const key = isWhisper ? whisperState : state;
        button.dataset.state = fbcSettings[key];
        tooltip.innerText = `${isWhisper ? "Whisper" : "Chat"} ${buttonId === "wce-chat-stutters" ? "stutters" : "baby talk"}: ${fbcSettings[key]}`;
        button.setAttribute("aria-disabled", garbleIsFull);
      }
    }
  }

  /** Set or remove the .wce-whisper css class on all WCE chat room buttoms and update their tooltip */
  function whisperUpdate(isWhisper: boolean) {
    const div = document.getElementById("chat-room-buttons") as null | HTMLDivElement;
    if (isWhisper && !div.classList.contains("wce-whisper")) {
      div.classList.add("wce-whisper");
      resetChatButtonStates();
    } else if (!isWhisper && div.classList.contains("wce-whisper")) {
      div.classList.remove("wce-whisper");
      resetChatButtonStates();
    }
  }

  createChatOptions = function(div: HTMLDivElement) {
    // Only add the WCE chat room buttons if they do not yet exist
    const parent = div ?? document; // Fix for broken BCX
    const buttonGrid: null | HTMLDivElement = parent.querySelector("#chat-room-buttons");
    if (buttonGrid && !buttonGrid.querySelector(".wce-chat-room-button")) {
      ElementMenu.PrependItem(buttonGrid, ElementCreate({
        tag: "div",
        style: { display: "none" },
        classList: ["wce-chat-room-select-div", "wce-chat-room-button"],
        children: [
          {
            tag: "label",
            attributes: { id: "wce-chat-garble-label", for: "wce-chat-garble" },
          },
          {
            tag: "select",
            attributes: { id: "wce-chat-garble", "aria-describedby": "wce-chat-garble-tooltip" },
            classList: ["wce-chat-room-select"],
            eventListeners: { change: GarbleOnChange },
            children: defaultSettings.antiGarbleWhisperLevel.options.map(option => ({
              tag: "option",
              attributes: { value: option },
              children: [option],
            })),
          },
          {
            tag: "div",
            attributes: { id: "wce-chat-garble-tooltip", role: "tooltip" },
            classList: ["button-tooltip", "button-tooltip-left"],
            children: [],
          },
        ],
      }));
      ElementMenu.AppendButton(buttonGrid, ElementButton.Create(
        "wce-chat-baby-talk",
        BabyTalkOnClick,
        {},
        { button: { classList: ["chat-room-button", "wce-chat-room-button"], style: { display: "none" } } }
      ));
      ElementMenu.AppendButton(buttonGrid, ElementButton.Create(
        "wce-chat-stutters",
        StutterOnClick,
        {},
        { button: { classList: ["chat-room-button", "wce-chat-room-button"], style: { display: "none" } } }
      ));
      resetChatButtonStates();
    }
  };

  let registeredChatInputListener = false;
  // Attach extra DOM buttons to the chat button grid for managing stuttering, garbling and babytalk
  SDK.hookFunction(
    "ChatRoomCreateElement",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    (args, next) => {
      if (!fbcSettings.antiGarbleChatOptions) return next(args);
      // Event listener for attaching the .wce-whisper css class to the chat buttons while whispering
      // Make sure this is only done the very first time the input chat is created
      if (!registeredChatInputListener) {
        const chatInput = document.getElementById("InputChat") as null | HTMLInputElement;
        const chatButtonArrow = document.getElementById("chat-room-buttons-collapse") as null | HTMLButtonElement;
        if (chatInput && chatButtonArrow) {
          chatInput.addEventListener("input", function WceInputChatListener() {
            const isWhisper = this.value.startsWith("/w ") || this.value.startsWith("/whisper ");
            whisperUpdate(isWhisper);
          });
          chatButtonArrow.addEventListener("click", (e) => {
            ChatRoomChatInputChangeHandler.call(chatInput, e);
          });
          registeredChatInputListener = true;
        }
      }
      const div = next(args);
      createChatOptions(div);
      return div;
    }
  );

  // Attach the .wce-whisper css class to the wce chat buttons while whispering
  SDK.hookFunction(
    "ChatRoomSetTarget",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    ([memberNumer, ...args], next) => {
      const isWhisper = Number.isInteger(memberNumer) && memberNumer !== -1;
      whisperUpdate(isWhisper);
      return next([memberNumer, ...args]);
    }
  );

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
