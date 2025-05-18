import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { isChatMessage } from "../util/utils";
import { HIDDEN } from "../util/constants";

export default function pendingMessages() {
  /** @type {(dictionary: Record<string, unknown>[], key: string, value: unknown) => Record<string, unknown>[]} */
  function addToDictionary(dictionary, key, value) {
    if (!Array.isArray(dictionary)) {
      dictionary = [];
    }
    dictionary.push({ Tag: key, Text: value });
    return dictionary;
  }

  let nonce = 0;

  SDK.hookFunction(
    "ChatRoomMessage",
    HOOK_PRIORITIES.Observe,
    (args, next) => {
      const ret = next(args);
      if (fbcSettings.pendingMessages && args?.length && isChatMessage(args[0]) && Array.isArray(args[0].Dictionary)) {
        const [message] = args;
        // @ts-ignore - custom dictionary Tag
        const tag = message.Dictionary?.find?.(d => d.Tag === "fbc_nonce");
        if (tag) {
          // @ts-ignore - custom dictionary Tag
          document.querySelector(`[data-nonce='${tag.Text}']`)?.remove();
        }
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "ServerSend",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      if (
        fbcSettings.pendingMessages &&
        args?.length >= 2 &&
        args[0] === "ChatRoomChat" &&
        isChatMessage(args[1]) &&
        args[1].Type !== HIDDEN &&
        !args[1].Target
      ) {
        nonce++;
        if (nonce >= Number.MAX_SAFE_INTEGER) nonce = 0;
        // @ts-ignore - custom dictionary Tag
        args[1].Dictionary = addToDictionary(args[1].Dictionary, "fbc_nonce", nonce);
        const div = document.createElement("div");
        div.classList.add("ChatMessage", "bce-pending");
        div.setAttribute("data-time", ChatRoomCurrentTime());
        div.setAttribute("data-sender", Player.MemberNumber?.toString());
        div.setAttribute("data-nonce", nonce.toString());
        switch (args[1].Type) {
          case "Chat":
            {
              div.classList.add("ChatMessageChat");
              const name = document.createElement("span");
              name.classList.add("ChatMessageName");
              name.style.color = Player.LabelColor || "";
              name.textContent = CharacterNickname(Player);
              // ToDo: add ungarbled message here
              div.appendChild(name);
              div.appendChild(document.createTextNode(`: ${args[1].Content}`));
            }
            break;
          case "Emote":
          case "Action":
            div.classList.add("ChatMessageEmote");
            div.appendChild(
              document.createTextNode(
                `*${args[1].Type === "Emote" ? `${CharacterNickname(Player)}: ` : ""}${args[1].Content}*`
              )
            );
            break;
          default:
            return next(args);
        }
        const loader = document.createElement("div");
        loader.classList.add("lds-ellipsis");
        for (let i = 0; i < 4; i++) {
          const dot = document.createElement("div");
          loader.appendChild(dot);
        }
        div.appendChild(loader);
        ChatRoomAppendChat(div);
      }
      return next(args);
    }
  );
}
