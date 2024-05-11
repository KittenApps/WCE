import { SDK, HOOK_PRIORITIES, WHISPER_CLASS, DARK_INPUT_CLASS } from "..";
import { waitFor, isString, isChatMessage } from "../util/utils";
import { fbcSettings, defaultSettings, bceSaveSettings } from "../util/settings";
import { displayText } from "../util/localization";

const GAGBYPASSINDICATOR = "\uf123";
const BCX_ORIGINAL_MESSAGE = "BCX_ORIGINAL_MESSAGE";

export async function antiGarbling() {
  await waitFor(() => !!SpeechGarbleByGagLevel);

  /**
   * @param {Character} c
   */
  function allowedToUngarble(c) {
    return c.IsNpc() || (c.BCECapabilities?.includes("antigarble") && c.BCEBlockAntiGarble === false);
  }

  ChatRoomRegisterMessageHandler({
    Priority: 1,
    Description: "Anti-garbling by FBC",
    Callback: (data, sender, msg) => {
      const clientGagged = msg.endsWith(GAGBYPASSINDICATOR);
      msg = msg.replace(/[\uf123-\uf124]/gu, "");
      let handled = clientGagged;
      if (fbcSettings.gagspeak && !clientGagged && allowedToUngarble(sender)) {
        switch (data.Type) {
          case "Whisper":
            {
              let original = msg;
              if (
                // @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
                data.Dictionary?.some((d) => d.Tag === BCX_ORIGINAL_MESSAGE)
              ) {
                const tag = data.Dictionary.find(
                  // @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
                  (d) => d.Tag === BCX_ORIGINAL_MESSAGE
                );
                // @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                const text = /** @type {string} */ (tag.Text);
                original = ChatRoomHTMLEntities(text);
              }
              if (original.toLowerCase().trim() !== msg.toLowerCase().trim()) {
                msg += ` (${original})`;
                handled = true;
              }
            }
            break;
          case "Chat":
            {
              const original = msg;
              msg = SpeechGarble(sender, msg);
              if (original.toLowerCase().trim() !== msg.toLowerCase().trim() && SpeechGetTotalGagLevel(sender) > 0) {
                msg += ` (${original})`;
                handled = true;
              }
            }
            break;
          default:
            break;
        }
      }

      const skip = (
        /** @type {ChatRoomMessageHandler} */
        handler
      ) => handler.Description === "Sensory-deprivation processing" && !!fbcSettings.gagspeak && handled;
      return { skip, msg };
    },
  });

  // ServerSend hook for client-side gagspeak, priority lower than BCX's whisper dictionary hook
  SDK.hookFunction(
    "ServerSend",
    HOOK_PRIORITIES.Observe,
    /**
     * @param {Parameters<typeof ServerSend>} args
     */ (args, next) => {
      if (args.length < 2) {
        return next(args);
      }
      const [message, /** @type {unknown} */ data] = args;
      if (!isString(message) || !isChatMessage(data)) {
        return next(args);
      }
      if (message === "ChatRoomChat") {
        switch (data.Type) {
          case "Whisper":
            {
              const idx =
                data.Dictionary?.findIndex(
                  // @ts-ignore - BCX's custom dictionary entry, dictionary entries cannot be extended in TS
                  (d) => d.Tag === BCX_ORIGINAL_MESSAGE
                ) ?? -1;
              if (
                idx >= 0 &&
                (fbcSettings.antiAntiGarble || fbcSettings.antiAntiGarbleStrong || fbcSettings.antiAntiGarbleExtra)
              ) {
                data.Dictionary?.splice(idx, 1);
              }
            }
            break;
          case "Chat":
            {
              const gagLevel = SpeechGetTotalGagLevel(Player);
              if (gagLevel > 0) {
                if (fbcSettings.antiAntiGarble) {
                  data.Content = SpeechGarbleByGagLevel(1, data.Content) + GAGBYPASSINDICATOR;
                } else if (fbcSettings.antiAntiGarbleExtra && gagLevel > 24) {
                  const icIndicator = "\uF124";
                  let inOOC = false;
                  data.Content = `${data.Content.split("")
                    .map((c) => {
                      switch (c) {
                        case "(":
                          inOOC = true;
                          return c;
                        case ")":
                          inOOC = false;
                          return c;
                        default:
                          return inOOC ? c : icIndicator;
                      }
                    })
                    .join("")
                    .replace(new RegExp(`${icIndicator}+`, "gu"), "m")}${GAGBYPASSINDICATOR}`;
                } else if (fbcSettings.antiAntiGarbleStrong || fbcSettings.antiAntiGarbleExtra) {
                  data.Content = SpeechGarbleByGagLevel(gagLevel, data.Content) + GAGBYPASSINDICATOR;
                }
              }
            }
            break;
          default:
            break;
        }
      }
      return next([message, data]);
    }
  );

  // X, Y, width, height. X and Y centered.
  const gagAntiCheatMenuPosition = /** @type {const} */ ([1700, 908, 200, 45]),
    /** @type {[number, number, number, number]} */
    gagCheatMenuPosition = [1700, 908 + 45, 200, 45],
    tooltipPosition = { X: 1000, Y: 910, Width: 200, Height: 90 };

  SDK.hookFunction(
    "ChatRoomRun",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    /**
     * @param {Parameters<typeof ChatRoomRun>} args
     */
    (args, nextFunc) => {
      const ret = nextFunc(args);

      if (window.InputChat) {
        /** @type {() => boolean} */
        const isWhispering = () =>
          window.InputChat?.value.startsWith("/w ") ||
          window.InputChat?.value.startsWith("/whisper ") ||
          !!window.ChatRoomTargetMemberNumber;
        if (window.InputChat?.classList.contains(WHISPER_CLASS) && !isWhispering()) {
          window.InputChat.classList.remove(WHISPER_CLASS);
        } else if (fbcSettings.whisperInput && isWhispering()) {
          window.InputChat?.classList.add(WHISPER_CLASS);
        }
        if (Player.ChatSettings?.ColorTheme?.startsWith("Dark")) {
          if (!window.InputChat.classList.contains(DARK_INPUT_CLASS)) {
            window.InputChat.classList.add(DARK_INPUT_CLASS);
          }
        } else if (window.InputChat.classList.contains(DARK_INPUT_CLASS)) {
          window.InputChat.classList.remove(DARK_INPUT_CLASS);
        }
      }

      if (!fbcSettings.showQuickAntiGarble || fbcSettings.discreetMode) {
        return ret;
      }
      const shorttip = displayText("Gagging"),
        tooltip = displayText("Antigarble anti-cheat strength");

      let color = "white",
        label = "None";

      const disableBoth = () => displayText("$tip: None", { $tip: tooltip }),
        enableLimited = () => displayText("$tip: Limited", { $tip: tooltip }),
        enableStrong = () => displayText("$tip: Full", { $tip: tooltip }),
        // eslint-disable-next-line sort-vars
        enableExtra = () => displayText("$tip: Extra", { $tip: tooltip });

      let next = enableLimited,
        previous = enableExtra;

      if (fbcSettings.antiAntiGarble) {
        color = "yellow";
        label = "Limited";
        next = enableStrong;
        previous = disableBoth;
      } else if (fbcSettings.antiAntiGarbleStrong) {
        color = "red";
        label = "Full";
        next = enableExtra;
        previous = enableLimited;
      } else if (fbcSettings.antiAntiGarbleExtra) {
        color = "purple";
        label = "Extra";
        next = disableBoth;
        previous = enableStrong;
      }
      DrawBackNextButton(
        ...gagAntiCheatMenuPosition,
        // Localization guide: ignore, covered by localizing the arrow functions above
        displayText(`$tip: ${label}`, { $tip: shorttip }),
        color,
        "",
        previous,
        next,
        // eslint-disable-next-line no-undefined
        undefined,
        // eslint-disable-next-line no-undefined
        undefined,
        // @ts-ignore - patched to accept extra params
        tooltipPosition
      );

      /** @type {[string, string, string, () => string, () => string, boolean?, number?, Position?]} */
      const gagCheatMenuParams = fbcSettings.gagspeak
        ? [
            displayText("Understand: Yes"),
            "green",
            "",
            () => displayText("Understand gagspeak: No"),
            () => displayText("Understand gagspeak: No"),
            // eslint-disable-next-line no-undefined
            undefined,
            // eslint-disable-next-line no-undefined
            undefined,
            tooltipPosition,
          ]
        : [
            "Understand: No",
            "white",
            "",
            () => displayText("Understand gagspeak: Yes"),
            () => displayText("Understand gagspeak: Yes"),
            // eslint-disable-next-line no-undefined
            undefined,
            // eslint-disable-next-line no-undefined
            undefined,
            tooltipPosition,
          ];
      // @ts-ignore - patched to accept extra params
      DrawBackNextButton(...gagCheatMenuPosition, ...gagCheatMenuParams);

      return ret;
    }
  );

  SDK.hookFunction(
    "ChatRoomClick",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    /**
     * @param {Parameters<typeof ChatRoomClick>} args
     */
    (args, nextFunc) => {
      if (fbcSettings.showQuickAntiGarble && !fbcSettings.discreetMode) {
        if (MouseIn(...gagAntiCheatMenuPosition)) {
          const disableAll = () => {
              fbcSettings.antiAntiGarble = false;
              fbcSettings.antiAntiGarbleStrong = false;
              fbcSettings.antiAntiGarbleExtra = false;
              defaultSettings.antiAntiGarble.sideEffects(false);
              defaultSettings.antiAntiGarbleStrong.sideEffects(false);
              defaultSettings.antiAntiGarbleExtra.sideEffects(false);
            },
            enableLimited = () => {
              fbcSettings.antiAntiGarble = true;
              defaultSettings.antiAntiGarble.sideEffects(true);
            },
            enableStrong = () => {
              fbcSettings.antiAntiGarbleStrong = true;
              defaultSettings.antiAntiGarbleStrong.sideEffects(true);
            },
            // eslint-disable-next-line sort-vars
            enableExtra = () => {
              fbcSettings.antiAntiGarbleExtra = true;
              defaultSettings.antiAntiGarbleExtra.sideEffects(true);
            };
          let next = enableLimited,
            previous = enableExtra;
          if (fbcSettings.antiAntiGarble) {
            next = enableStrong;
            previous = disableAll;
          } else if (fbcSettings.antiAntiGarbleStrong) {
            next = enableExtra;
            previous = enableLimited;
          } else if (fbcSettings.antiAntiGarbleExtra) {
            next = disableAll;
            previous = enableStrong;
          }
          if (MouseX < gagAntiCheatMenuPosition[0] + gagAntiCheatMenuPosition[2] / 2) {
            previous();
            bceSaveSettings();
          } else {
            next();
            bceSaveSettings();
          }
        } else if (MouseIn(...gagCheatMenuPosition)) {
          fbcSettings.gagspeak = !fbcSettings.gagspeak;
          defaultSettings.gagspeak.sideEffects(fbcSettings.gagspeak);
          bceSaveSettings();
        }
      }
      return nextFunc(args);
    }
  );

  if (CurrentScreen === "ChatRoom") {
    CurrentScreenFunctions.Run = ChatRoomRun;
    CurrentScreenFunctions.Click = ChatRoomClick;
    CurrentScreenFunctions.Resize = ChatRoomResize;
    ChatRoomResize(false);
  }
}