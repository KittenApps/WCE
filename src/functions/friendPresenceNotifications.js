import { createTimer } from "../util/hooks";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { fbcSettings } from "../util/settings";
import { waitFor, fbcChatNotify, fbcNotify } from "../util/utils";
import { displayText } from "../util/localization";

const BEEP_CLICK_ACTIONS = Object.freeze({
  /** @type {"FriendList"} */
  FriendList: "FriendList",
});

export default async function friendPresenceNotifications() {
  await waitFor(() => !!Player && ServerSocket && ServerIsConnected);

  function checkFriends() {
    if (!fbcSettings.friendPresenceNotifications && !fbcSettings.instantMessenger) {
      return;
    }
    if (CurrentScreen === "FriendList" || CurrentScreen === "Relog" || CurrentScreen === "Login") {
      return;
    }
    ServerSend("AccountQuery", { Query: "OnlineFriends" });
  }
  createTimer(checkFriends, 20000);

  /** @type {Friend[]} */
  let lastFriends = [];
  registerSocketListener("AccountQueryResult", (/** @type {ServerAccountQueryResponse} */ data) => {
    if (CurrentScreen === "FriendList" || CurrentScreen === "Relog" || CurrentScreen === "Login") {
      return;
    }
    if (!fbcSettings.friendPresenceNotifications) {
      return;
    }
    if (data.Query !== "OnlineFriends") {
      return;
    }
    const friendMemberNumbers = data.Result.map(f => f.MemberNumber),
      offlineFriends = lastFriends.map(f => f.MemberNumber).filter(f => !friendMemberNumbers.includes(f)),
      onlineFriends = friendMemberNumbers.filter(f => !lastFriends.some(ff => ff.MemberNumber === f));
    if (onlineFriends.length) {
      const list = onlineFriends
        .map((f) => {
          const { MemberNumber, MemberName } = data.Result.find(d => d.MemberNumber === f) ?? {
            MemberName: "",
            MemberNumber: -1,
          };
          return `${MemberName} (${MemberNumber})`;
        })
        .join(", ");
      if (fbcSettings.friendNotificationsInChat && CurrentScreen === "ChatRoom") {
        fbcChatNotify(displayText("Now online: $list", { $list: list }));
      } else {
        fbcNotify(displayText("Now online: $list", { $list: list }), 5000, { ClickAction: BEEP_CLICK_ACTIONS.FriendList });
      }
    }
    if (fbcSettings.friendOfflineNotifications && offlineFriends.length) {
      const list = offlineFriends
        .map((f) => {
          const { MemberNumber, MemberName } = lastFriends.find(d => d.MemberNumber === f) ?? {
            MemberName: "",
            MemberNumber: -1,
          };
          return `${MemberName} (${MemberNumber})`;
        })
        .join(", ");
      if (fbcSettings.friendNotificationsInChat && CurrentScreen === "ChatRoom") {
        fbcChatNotify(displayText("Now offline: $list", { $list: list }));
      } else {
        fbcNotify(displayText("Now offline: $list", { $list: list }), 5000, { ClickAction: BEEP_CLICK_ACTIONS.FriendList });
      }
    }
    lastFriends = data.Result;
  });
}
