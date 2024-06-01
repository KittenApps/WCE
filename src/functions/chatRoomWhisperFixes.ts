import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { fbcSettings } from "../util/settings";

export default function chatRoomWhisperFixes(): void {
  const leaveResetTargetTimers: {[key: number]: number} = {};

  SDK.hookFunction(
    "ChatRoomMessageDisplay",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      if (fbcSettings.whisperTargetFixes && args[0].Type === "Action" && args[0].Sender === ChatRoomTargetMemberNumber) {
        if (["ServerLeave", "ServerBan", "ServerKick", "ServerDisconnect"].some((m) => args[0].Content.startsWith(m))) {
          leaveResetTargetTimers[args[0].Sender] = window.setTimeout(() => {
            ChatRoomSetTarget(-1);
            ChatRoomSendLocal('<span style="color: red">[WCE] Your whisper target was cleared, because they left the room for more than a minute!</span>');
          }, 60 * 1000);
        } else if (args[0].Content.startsWith("ServerEnter")) {
          if (leaveResetTargetTimers[args[0].Sender]) {
            window.clearTimeout(leaveResetTargetTimers[args[0].Sender]);
            delete leaveResetTargetTimers[args[0].Sender];
          }
        }
      }
      return next(args);
    }
  );

  patchFunction(
    "ChatRoomSendChat",
    {
      // eslint-disable-next-line no-template-curly-in-string
      'ChatRoomSendLocal(`<span style="color: red">${TextGet("WhisperTargetGone")}</span>`);':
        `ChatRoomSendLocal('<span style="color: red">' + TextGet("WhisperTargetGone") + " Resetting to talk to everyone now!</span>");
        if(fbcSettingValue("whisperTargetFixes")) ChatRoomSetTarget(-1);
        `,
    },
    "Resetting blush, eyes, and eyebrows after struggling"
  );
}
