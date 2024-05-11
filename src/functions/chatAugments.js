import { patchFunction, createTimer, processChatAugmentsForLine } from "..";
import { displayText } from "../util/localization";
import { fbcSettings } from "../util/settings";
import { bceParseUrl } from "../util/utils";

const CLOSINGBRACKETINDICATOR = "\\uf130\\u005d";

export function chatAugments() {
  // CTRL+Enter OOC implementation
  patchFunction(
    "ChatRoomKeyDown",
    {
      "ChatRoomSendChat()": `if (fbcSettingValue("ctrlEnterOoc") && event.ctrlKey && ElementValue("InputChat")?.trim()) {
          let text = ElementValue("InputChat");
          let prefix = "";
          if (!text) {
            fbcChatNotify("Nothing to send!");
            return;
          }
          // Whisper command
          if (text.startsWith("/w ")) {
            const textParts = text.split(' ');
            text = textParts.slice(2).join(' ');
            prefix = textParts.slice(0, 2).join(' ') + ' ';
          } else if (text.startsWith("/") && !text.startsWith("//")) {
            fbcChatNotify("Tried to OOC send a command. Use double // to confirm sending to chat.");
            return;
          }

          ElementValue("InputChat", prefix + "(" + text.replace(/\\)/g, "${CLOSINGBRACKETINDICATOR}"));
        }
        ChatRoomSendChat()`,
    },
    "No OOC on CTRL+Enter."
  );
  patchFunction(
    "ChatRoomMessageDisplay",
    {
      "var div": `msg = msg.replace(/${CLOSINGBRACKETINDICATOR}/g, ")");
      var div`,
    },
    "OOC closing brackets may look wonky."
  );

  patchFunction(
    "CommandParse",
    {
      "// Regular chat can be prevented with an owner presence rule":
        "// Regular chat can be prevented with an owner presence rule\nmsg = bceMessageReplacements(msg);\n// ",
      "// The whispers get sent to the server and shown on the client directly":
        "// The whispers get sent to the server and shown on the client directly\nmsg = bceMessageReplacements(msg);",
    },
    "No link or OOC parsing for sent whispers."
  );

  const startSounds = ["..", "--"];
  const endSounds = ["...", "~", "~..", "~~", "..~"];
  const eggedSounds = ["ah", "aah", "mnn", "nn", "mnh", "mngh", "haa", "nng", "mnng"];
  /**
   * StutterWord will add s-stutters to the beginning of words and return 1-2 words, the original word with its stutters and a sound, based on arousal
   * @type {(word: string, forceStutter?: boolean) => string[]}
   */
  function stutterWord(word, forceStutter) {
    if (!word?.length) {
      return [word];
    }

    /** @type {(wrd: string) => string} */
    const addStutter = (wrd) =>
      /^\p{L}/u.test(wrd) ? `${wrd.substring(0, /\uD800-\uDFFF/u.test(wrd[0]) ? 2 : 1)}-${wrd}` : wrd;

    const maxIntensity = Math.max(
      0,
      ...Player.Appearance.filter((a) => (a.Property?.Intensity ?? -1) > -1).map((a) => a.Property?.Intensity ?? 0)
    );

    const playerArousal = Player.ArousalSettings?.Progress ?? 0;
    const eggedBonus = maxIntensity * 5;
    const chanceToStutter = (Math.max(0, playerArousal - 10 + eggedBonus) * 0.5) / 100;

    const chanceToMakeSound = (Math.max(0, playerArousal / 2 - 20 + eggedBonus * 2) * 0.5) / 100;

    const r = Math.random();
    for (let i = Math.min(4, Math.max(1, maxIntensity)); i >= 1; i--) {
      if (r < chanceToStutter / i || (i === 1 && forceStutter && chanceToStutter > 0)) {
        word = addStutter(word);
      }
    }
    const results = [word];
    if (maxIntensity > 0 && Math.random() < chanceToMakeSound) {
      const startSound = startSounds[Math.floor(Math.random() * startSounds.length)];
      const sound = eggedSounds[Math.floor(Math.random() * eggedSounds.length)];
      const endSound = endSounds[Math.floor(Math.random() * endSounds.length)];
      results.push(" ", `${startSound}${displayText(sound)}${endSound}`);
    }
    return results;
  }

  window.bceMessageReplacements = (msg) => {
    const words = [msg];
    let firstStutter = true,
      inOOC = false;
    const newWords = [];
    for (let i = 0; i < words.length; i++) {
      // Handle other whitespace
      const whitespaceIdx = words[i].search(/[\s\r\n]/u);
      if (whitespaceIdx >= 1) {
        // Insert remainder into list of words
        words.splice(i + 1, 0, words[i].substring(whitespaceIdx));
        // Truncate current word to whitespace
        words[i] = words[i].substring(0, whitespaceIdx);
      } else if (whitespaceIdx === 0) {
        // Insert remainder into list of words
        words.splice(i + 1, 0, words[i].substring(1));
        // Keep space in the message
        [words[i]] = words[i];
        newWords.push(words[i]);
        continue;
      }
      // Handle OOC
      const oocIdx = words[i].search(/[()]/u);
      if (oocIdx > 0) {
        // Insert remainder into list of words
        words.splice(i + 1, 0, words[i].substring(oocIdx + 1));
        // Insert OOC marker into list of words, before remainder
        words.splice(i + 1, 0, words[i].substring(oocIdx, oocIdx + 1));
        // Truncate current word to OOC
        words[i] = words[i].substring(0, oocIdx);
      } else if (oocIdx === 0 && words[i].length > 1) {
        // Insert remainder into list of words
        words.splice(i + 1, 0, words[i].substring(1));
        // Keep OOC marker in the message
        [words[i]] = words[i];
      }

      if (words[i] === "(") {
        inOOC = true;
      }

      if (bceParseUrl(words[i]) && !inOOC) {
        newWords.push("( ");
        newWords.push(words[i]);
        newWords.push(" )");
      } else if (fbcSettings.stutters && !inOOC) {
        newWords.push(...stutterWord(words[i], firstStutter));
        firstStutter = false;
      } else {
        newWords.push(words[i]);
      }

      if (words[i] === ")") {
        inOOC = false;
      }
    }
    return newWords.join("");
  };

  function bceChatAugments() {
    if (CurrentScreen !== "ChatRoom" || !fbcSettings.augmentChat) {
      return;
    }
    const chatLogContainerId = "TextAreaChatLog",
      // Handle chat events
      handledAttributeName = "data-bce-handled",
      unhandledChat = document.querySelectorAll(`.ChatMessage:not([${handledAttributeName}=true])`);
    for (const chatMessageElement of unhandledChat) {
      chatMessageElement.setAttribute(handledAttributeName, "true");
      if (
        (chatMessageElement.classList.contains("ChatMessageChat") ||
          chatMessageElement.classList.contains("ChatMessageWhisper")) &&
        !chatMessageElement.classList.contains("bce-pending")
      ) {
        const scrolledToEnd = ElementIsScrolledToEnd(chatLogContainerId);
        // eslint-disable-next-line no-loop-func
        const scrollToEnd = () => {
          if (scrolledToEnd) {
            ElementScrollToEnd(chatLogContainerId);
          }
        };
        processChatAugmentsForLine(chatMessageElement, scrollToEnd);
        if (scrolledToEnd) {
          ElementScrollToEnd(chatLogContainerId);
        }
      }
    }
  }

  createTimer(bceChatAugments, 500);
}