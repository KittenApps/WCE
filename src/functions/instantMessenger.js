import { processChatAugmentsForLine } from "./chatAugments";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { BCX } from "./hookBCXAPI";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { displayText } from "../util/localization";
import { parseJSON, objEntries, isNonNullObject, isString, fbcNotify } from "../util/utils";
import { debug } from "../util/logger";
import { fbcSettings } from "../util/settings";

// BcUtil-compatible instant messaging with friends
export default function instantMessenger() {
  window.bceStripBeepMetadata = (msg) => msg.split("\uf124")[0].trimEnd();

  // Build the DOM
  const container = document.createElement("div");
  container.classList.add("bce-hidden");
  container.id = "bce-instant-messenger";
  const leftContainer = document.createElement("div");
  leftContainer.id = "bce-message-left-container";
  const friendList = document.createElement("div");
  friendList.id = "bce-friend-list";
  const rightContainer = document.createElement("div");
  rightContainer.id = "bce-message-right-container";
  const messageContainer = document.createElement("div");
  messageContainer.id = "bce-message-container";
  const messageInput = document.createElement("textarea");
  messageInput.id = "bce-message-input";
  messageInput.setAttribute("maxlength", "2000");
  messageInput.addEventListener("keydown", (e) => {
    // MBCHC compatibility: prevent chatroom keydown events from triggering at document level
    e.stopPropagation();
  });

  const friendSearch = document.createElement("input");
  friendSearch.id = "bce-friend-search";
  friendSearch.setAttribute("placeholder", displayText("Search for a friend"));
  friendSearch.autocomplete = "off";
  friendSearch.addEventListener("keydown", (e) => {
    // MBCHC compatibility: prevent chatroom keydown events from triggering at document level
    e.stopPropagation();
  });

  const onlineClass = "bce-friend-list-handshake-completed";
  const offlineClass = "bce-friend-list-handshake-false";

  container.appendChild(leftContainer);
  container.appendChild(rightContainer);
  leftContainer.appendChild(friendSearch);
  leftContainer.appendChild(friendList);
  rightContainer.appendChild(messageContainer);
  rightContainer.appendChild(messageInput);
  document.body.appendChild(container);

  const storageKey = () => `bce-instant-messenger-state-${Player.AccountName.toLowerCase()}`;

  /** @type {number} */
  let activeChat = -1;

  let unreadSinceOpened = 0;

  /** @typedef {{ author: string, authorId: number, type: "Emote" | "Action" | "Message", message: string, color: string, createdAt: number }} RawHistory */
  /** @typedef {{ unread: number, statusText: HTMLElement, listElement: HTMLElement, historyRaw: RawHistory[], history: HTMLElement, online: boolean }} IMFriendHistory */
  /** @type {Map<number, IMFriendHistory>} */
  const friendMessages = new Map();

  const scrollToBottom = () => {
    const friend = friendMessages.get(activeChat);
    if (friend) {
      friend.history.scrollTop = friend.history.scrollHeight;
    }
  };

  const saveHistory = () => {
    /** @type {Record<number, { historyRaw: RawHistory[] }>} */
    const history = {};
    friendMessages.forEach((friend, id) => {
      if (friend.historyRaw.length === 0) {
        return;
      }
      const historyLength = Math.min(friend.historyRaw.length, 100);
      history[id] = {
        historyRaw: friend.historyRaw.slice(-historyLength),
      };
    });
    localStorage.setItem(storageKey(), JSON.stringify(history));
  };

  /** @type {(friendId: number) => void} */
  const changeActiveChat = (friendId) => {
    const friend = friendMessages.get(friendId);
    messageInput.disabled = !friend?.online;
    messageContainer.innerHTML = "";
    for (const f of friendMessages.values()) {
      f.listElement.classList.remove("bce-friend-list-selected");
    }
    if (friend) {
      friend.listElement.classList.add("bce-friend-list-selected");
      friend.listElement.classList.remove("bce-friend-list-unread");
      messageContainer.appendChild(friend.history);
      friend.unread = 0;
    }

    const previousFriend = friendMessages.get(activeChat);
    if (previousFriend) {
      const divider = previousFriend.history.querySelector(".bce-message-divider");
      if (divider) {
        previousFriend.history.removeChild(divider);
      }
    }

    sortIM();

    activeChat = friendId;
    scrollToBottom();
  };

  /** @type {(friendId: number, sent: boolean, beep: Partial<ServerAccountBeepResponse>, skipHistory: boolean, createdAt: Date) => void} */
  // eslint-disable-next-line complexity
  const addMessage = (friendId, sent, beep, skipHistory, createdAt) => {
    const friend = friendMessages.get(friendId);
    if (!friend || beep.BeepType) {
      return;
    }

    /** @type {{ messageType: "Message" | "Emote" | "Action"; messageColor?: string; }?} */
    const details = parseJSON(
      beep.Message?.split("\n")
        .find((line) => line.startsWith("\uf124"))
        ?.substring(1) ?? "{}"
    ) ?? { messageType: "Message" };

    if (!details.messageType) {
      details.messageType = "Message";
    }

    /** @type {"Message" | "Emote" | "Action"} */
    const messageType = ["Message", "Emote", "Action"].includes(details.messageType)
      ? details.messageType
      : "Message";
    const messageColor = details?.messageColor ?? "#ffffff";
    const messageText = beep.Message?.split("\n")
      .filter((line) => !line.startsWith("\uf124"))
      .join("\n")
      .trimEnd();

    if (!messageText) {
      debug("skipped empty beep", friendId, beep, sent, skipHistory);
      return;
    }

    const scrolledToEnd = friend.history.scrollHeight - friend.history.scrollTop - friend.history.clientHeight < 1;
    const message = document.createElement("div");
    message.classList.add("bce-message");
    message.classList.add(sent ? "bce-message-sent" : "bce-message-received");
    message.classList.add(`bce-message-${messageType}`);
    message.setAttribute("data-time", createdAt.toLocaleString());

    const author = sent ? CharacterNickname(Player) : beep.MemberName ?? "<Unknown>";

    switch (messageType) {
      case "Emote":
        message.textContent = `*${author}${messageText}*`;
        break;
      case "Action":
        message.textContent = `*${messageText}*`;
        break;
      case "Message":
        {
          const sender = document.createElement("span");
          sender.classList.add("bce-message-sender");
          if (messageColor) {
            sender.style.color = messageColor;
          }
          sender.textContent = `${author}: `;
          message.appendChild(sender);
          message.appendChild(document.createTextNode(messageText));
        }
        break;
      default:
        message.textContent = messageText;
        break;
    }

    if (!Player.MemberNumber) {
      throw new Error("Player.MemberNumber is invalid");
    }

    let authorId = Player.MemberNumber;
    if (!sent) {
      if (!beep.MemberNumber) {
        throw new Error("beep.MemberNumber is invalid");
      }
      authorId = beep.MemberNumber;
    }

    if (!skipHistory) {
      friend.historyRaw.push({
        author,
        authorId,
        message: messageText,
        type: messageType,
        color: messageColor,
        createdAt: Date.now(),
      });

      friend.listElement.setAttribute("data-last-updated", Date.now().toString());

      if (friendId !== activeChat) {
        friend.listElement.classList.add("bce-friend-list-unread");
        friend.unread++;
      }
      if (friend.unread === 1 && (container.classList.contains("bce-hidden") || friendId !== activeChat)) {
        const divider = document.createElement("div");
        divider.classList.add("bce-message-divider");
        friend.history.appendChild(divider);
      }

      if (container.classList.contains("bce-hidden")) {
        unreadSinceOpened++;
      }
    }
    /**
     * @returns {null}
     */
    const noop = () => null;
    processChatAugmentsForLine(message, scrolledToEnd ? scrollToBottom : noop);

    friend.history.appendChild(message);
    if (scrolledToEnd) {
      scrollToBottom();
    }

    saveHistory();
  };

  /** @type {(friendId: number) => IMFriendHistory} */
  const handleUnseenFriend = (friendId) => {
    let msgs = friendMessages.get(friendId);
    if (!msgs) {
      /** @type {IMFriendHistory} */
      const friendData = {
        statusText: document.createElement("span"),
        listElement: document.createElement("div"),
        historyRaw: [],
        history: document.createElement("div"),
        unread: 0,
        online: false,
      };
      friendData.listElement.id = `bce-friend-list-entry-${friendId}`;
      friendData.listElement.classList.add("bce-friend-list-entry");
      friendData.listElement.onclick = () => {
        changeActiveChat(friendId);
      };

      friendData.history.classList.add("bce-friend-history");

      const name = document.createElement("div");
      name.classList.add("bce-friend-list-entry-name");
      name.textContent = Player.FriendNames?.get(friendId) || "";
      friendData.listElement.appendChild(name);

      const memberNumber = document.createElement("div");
      memberNumber.classList.add("bce-friend-list-entry-member-number");
      memberNumber.textContent = friendId.toString();
      friendData.listElement.appendChild(memberNumber);

      friendData.listElement.appendChild(friendData.statusText);

      friendList.appendChild(friendData.listElement);

      friendMessages.set(friendId, friendData);
      msgs = friendData;
    }
    return msgs;
  };

  const history = /** @type {Record<string, {historyRaw: RawHistory[]}>} */ (
    parseJSON(localStorage.getItem(storageKey()) || "{}")
  );
  for (const [friendIdStr, friendHistory] of objEntries(history)) {
    const friendId = parseInt(friendIdStr);
    const friend = handleUnseenFriend(friendId);
    friend.historyRaw = friendHistory.historyRaw;
    for (const hist of friendHistory.historyRaw) {
      addMessage(
        friendId,
        hist.authorId === Player.MemberNumber,
        {
          Message: `${hist.message}\n\n\uf124${JSON.stringify({
            messageType: hist.type,
            messageColor: hist.color,
          })}`,
          MemberNumber: hist.authorId,
          MemberName: hist.author,
        },
        true,
        hist.createdAt ? new Date(hist.createdAt) : new Date(0)
      );
      if (hist.createdAt) {
        friend.listElement.setAttribute("data-last-updated", hist.createdAt.toString());
      }
    }
  }

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (BCX?.getRuleState("speech_restrict_beep_send")?.isEnforced && !fbcSettings.allowIMBypassBCX) {
        fbcNotify(displayText("Sending beeps is currently restricted by BCX rules"));
        return;
      }
      let messageText = messageInput.value;
      if (messageText.trim() === "") {
        return;
      }
      messageInput.value = "";

      /** @type {"Message" | "Emote" | "Action"} */
      let messageType = "Message";
      if (messageText.startsWith("/me ")) {
        messageText = messageText.substring(4);
        if (!/^[', ]/u.test(messageText)) {
          messageText = ` ${messageText}`;
        }
        messageType = "Emote";
      } else if (messageText.startsWith("/action ")) {
        messageText = messageText.substring(8);
        messageType = "Action";
      } else if (/^\*[^*]/u.test(messageText)) {
        messageText = messageText.substring(1);
        if (!/^[', ]/u.test(messageText)) {
          messageText = ` ${messageText}`;
        }
        messageType = "Emote";
      } else if (/^\*\*/u.test(messageText)) {
        messageText = messageText.substring(2);
        messageType = "Action";
      }

      /** @type {ServerAccountBeepRequest} */
      const message = {
        BeepType: "",
        MemberNumber: activeChat,
        IsSecret: true,
        Message: `${messageText}\n\n\uf124${JSON.stringify({
          messageType,
          messageColor: Player.LabelColor,
        })}`,
      };
      addMessage(activeChat, true, message, false, new Date());
      FriendListBeepLog.push({
        ...message,
        MemberName: Player.FriendNames?.get(activeChat) || "aname",
        Sent: true,
        Private: false,
        Time: new Date(),
      });
      ServerSend("AccountBeep", message);
    }
  });

  friendSearch.onkeyup = () => {
    const search = friendSearch.value.toLowerCase();
    for (const friendId of friendMessages.keys()) {
      const friend = friendMessages.get(friendId);
      if (!friend) {
        throw new Error("this should never happen, friend is null in map loop");
      }
      const friendName = Player.FriendNames?.get(friendId)?.toLowerCase();
      if (search === "") {
        friend.listElement.classList.remove("bce-hidden");
      } else if (!friendId.toString().includes(search) && !friendName?.includes(search)) {
        friend.listElement.classList.add("bce-hidden");
      } else {
        friend.listElement.classList.remove("bce-hidden");
      }
    }
    sortIM();
  };

  registerSocketListener("AccountQueryResult", (data) => {
    if (data.Query !== "OnlineFriends") {
      return;
    }
    if (data.Result && fbcSettings.instantMessenger) {
      for (const friend of data.Result) {
        const f = handleUnseenFriend(friend.MemberNumber);
        f.online = true;
        f.statusText.textContent = displayText("Online");
        f.listElement.classList.remove(offlineClass);
        f.listElement.classList.add(onlineClass);
      }
      for (const friendId of Array.from(friendMessages.keys()).filter(
        (f) => !data.Result.some((f2) => f2.MemberNumber === f)
      )) {
        const f = friendMessages.get(friendId);
        if (!f) {
          throw new Error("this should never happen, f is null in map loop");
        }
        f.online = false;
        f.statusText.textContent = displayText("Offline");
        f.listElement.classList.remove(onlineClass);
        f.listElement.classList.add(offlineClass);
      }
      if (!data.Result.some((f) => f.MemberNumber === activeChat)) {
        // Disable input, current user is offline
        messageInput.disabled = true;
      } else {
        // Enable input, current user is online
        messageInput.disabled = false;
      }
    }
  });

  function sortIM() {
    [...friendList.children]
      .sort((a, b) => {
        const notA = !a.classList.contains(onlineClass);
        const notB = !b.classList.contains(onlineClass);
        if ((notA && notB) || (!notA && !notB)) {
          const aUpdatedAt = a.getAttribute("data-last-updated") ?? "";
          const bUpdatedAt = b.getAttribute("data-last-updated") ?? "";
          const au = /^\d+$/u.test(aUpdatedAt) ? parseInt(aUpdatedAt) : 0;
          const bu = /^\d+$/u.test(bUpdatedAt) ? parseInt(bUpdatedAt) : 0;
          return bu - au;
        }
        if (notA) {
          return 1;
        }
        return -1;
      })
      .forEach((node) => {
        friendList.removeChild(node);
        friendList.appendChild(node);
      });
  }

  SDK.hookFunction(
    "ServerAccountBeep",
    HOOK_PRIORITIES.OverrideBehaviour,
    (args, next) => {
      const [beep] = args;
      if (beep && isNonNullObject(beep) && !beep.BeepType && fbcSettings.instantMessenger) {
        addMessage(beep.MemberNumber, false, beep, false, new Date());
      }
      next(args);
    }
  );

  SDK.hookFunction(
    "ServerSend",
    HOOK_PRIORITIES.Observe,
    (args, next) => {
      const [command, b] = args;
      if (command !== "AccountBeep") {
        return next(args);
      }
      const beep = /** @type {ServerAccountBeepRequest} */ (b);
      if (!beep?.BeepType && isString(beep?.Message) && !beep.Message.includes("\uf124")) {
        addMessage(beep.MemberNumber, true, beep, false, new Date());
      }
      return next(args);
    }
  );

  /**
   * Get the position of the IM button dynamically based on current screen properties
   * @type {() => [number, number, number, number]}
   */
  function buttonPosition() {
    if (CurrentScreen === "ChatRoom" && document.getElementById("TextAreaChatLog")?.offsetParent !== null) {
      return [5, 865, 60, 60];
    }
    return [70, 905, 60, 60];
  }

  SDK.hookFunction(
    "DrawProcess",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      next(args);
      if (fbcSettings.instantMessenger) {
        if (
          !fbcSettings.allowIMBypassBCX &&
          (BCX?.getRuleState("speech_restrict_beep_receive")?.isEnforced ||
            (BCX?.getRuleState("alt_hide_friends")?.isEnforced && Player.GetBlindLevel() >= 3))
        ) {
          if (!container.classList.contains("bce-hidden")) {
            hideIM();
          }
          DrawButton(
            ...buttonPosition(),
            "",
            "Gray",
            "Icons/Small/Chat.png",
            displayText("Instant Messenger (Disabled by BCX)"),
            false
          );
        } else {
          DrawButton(
            ...buttonPosition(),
            "",
            unreadSinceOpened ? "Red" : "White",
            "Icons/Small/Chat.png",
            displayText("Instant Messenger"),
            false
          );
        }
      }
    }
  );

  SDK.hookFunction(
    "CommonClick",
    HOOK_PRIORITIES.OverrideBehaviour,
    (args, next) => {
      if (fbcSettings.instantMessenger && MouseIn(...buttonPosition())) {
        if (!container.classList.contains("bce-hidden")) {
          hideIM();
          return;
        }
        sortIM();
        container.classList.toggle("bce-hidden");
        ServerSend("AccountQuery", { Query: "OnlineFriends" });
        unreadSinceOpened = 0;
        scrollToBottom();
        NotificationReset("Beep");
        return;
      }
      next(args);
    }
  );

  SDK.hookFunction(
    "NotificationRaise",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    (args, next) => {
      if (args[0] === "Beep" && args[1]?.body) {
        args[1].body = bceStripBeepMetadata(args[1].body);
      }
      return next(args);
    }
  );

  /** @type {(e: KeyboardEvent) => void} */
  function keyHandler(e) {
    if (!fbcSettings.instantMessenger) {
      return;
    }
    if (e.key === "Escape" && !container.classList.contains("bce-hidden")) {
      hideIM();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  function hideIM() {
    container.classList.add("bce-hidden");
    messageInput.blur();
    friendSearch.blur();
  }

  document.addEventListener("keydown", keyHandler, true);
  document.addEventListener("keypress", keyHandler, true);
}
