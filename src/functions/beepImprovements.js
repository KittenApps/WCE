import { patchFunction } from "../util/modding";
import { fbcBeepNotify } from "../util/hooks";
import { displayText } from "../util/localization";

export default function beepImprovements() {
  if (typeof window.StartBcUtil === "function") {
    fbcBeepNotify(
      displayText("Incompatibility"),
      displayText(
        "WCE is incompatible with BCUtil. Some functionality from WCE may not work. BCUtil's wardrobe, appearance, and instant messaging functionality are all available within WCE. Go to WCE settings and enable the relevant options, then disable BCUtil to migrate fully to WCE. This beep will appear every time WCE detects BCUtil as having loaded before WCE."
      )
    );
    return;
  }
  // ServerAccountBeep patch for beep notification improvements in chat
  patchFunction(
    "ServerAccountBeep",
    {
      // eslint-disable-next-line no-template-curly-in-string
      'ChatRoomSendLocal(`<a onclick="ServerOpenFriendList()">(${ServerBeep.Message})</a>`);': `{
        const beepId = FriendListBeepLog.length - 1;
        ChatRoomSendLocal(\`<a id="bce-beep-reply-\${beepId}">\u21a9\ufe0f</a><a class="bce-beep-link" id="bce-beep-\${beepId}">(\${ServerBeep.Message}\${ChatRoomHTMLEntities(data.Message ? \`: \${bceStripBeepMetadata(data.Message.length > 150 ? data.Message.substring(0, 150) + "..." : data.Message)}\` : "")})</a>\`);
        if (document.getElementById("bce-beep-reply-" + beepId)) {
          document.getElementById(\`bce-beep-reply-\${beepId}\`).onclick = (e) => {
            e.preventDefault();
            ElementValue("InputChat", \`/beep \${data.MemberNumber} \${ElementValue("InputChat").replace(/^\\/(beep|w) \\S+ ?/u, '')}\`);
            document.getElementById('InputChat').focus();
          };
        }
        if (document.getElementById("bce-beep-" + beepId)) {
          document.getElementById(\`bce-beep-\${beepId}\`).onclick = (e) => {
            e.preventDefault();
            ServerOpenFriendList();
            FriendListModeIndex = 1;
            FriendListShowBeep(\`\${beepId}\`);
          };
        }
      }`,
    },
    "Beeps are not enhanced by WCE."
  );
}
