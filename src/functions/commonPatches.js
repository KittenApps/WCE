import { SDK, HOOK_PRIORITIES, patchFunction } from '../index';
import { displayText } from '../util/localization';
import { isNonNullObject } from '../util/util';

const DEVS = [23476, 27006, 24890];

export function commonPatches() {
  // DrawBackNextButton patch to allow overriding hover text position
  patchFunction(
    "DrawBackNextButton",
    {
      "Disabled, ArrowWidth": "Disabled, ArrowWidth, tooltipPosition",
      "DrawButtonHover(Left, Top, Width, Height,":
        "DrawButtonHover(tooltipPosition?.X || Left, tooltipPosition?.Y || Top, tooltipPosition?.Width || Width, tooltipPosition?.Height || Height,",
    },
    "Tooltip positions may be incorrect."
  );

  // CommandExecute patch to fix /whitelistadd and /whitelistremove
  patchFunction(
    "CommandExecute",
    {
      "key.indexOf(CommandsKey + cmd.Tag) == 0)": `key.substring(1) === cmd.Tag)`,
    },
    "Whitelist commands will not work."
  );

  SDK.hookFunction(
    "InformationSheetRun",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof InformationSheetRun>} args
     */
    (args, next) => {
      if (!InformationSheetSelection || !InformationSheetSelection.MemberNumber) {
        return next(args);
      }

      const ret = next(args);

      if (DEVS.includes(InformationSheetSelection.MemberNumber)) {
        const ctx = window.MainCanvas.getContext("2d");
        if (!ctx) {
          throw new Error("could not get canvas 2d context");
        }
        ctx.textAlign = "left";
        DrawText(displayText("FBC Developer"), 550, 75, "hotpink", "black");
        ctx.textAlign = "center";
      }

      return ret;
    }
  );

  // Looking for settings erasure by client
  SDK.hookFunction(
    "ServerSend",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof ServerSend>} args
     */
    (args, next) => {
      const [msgType, data] = args;
      if (msgType !== "AccountUpdate") {
        return next(args);
      }
      if (!isNonNullObject(data)) {
        return next(args);
      }
      if ("ExtensionSettings" in data) {
        throw new Error("misuse of ExtensionSettings detected; write prevented");
      }
      return next(args);
    }
  );

  // Prevent friendlist results from attempting to load into the HTML outside of the appropriate view
  SDK.hookFunction(
    "FriendListLoadFriendList",
    HOOK_PRIORITIES.OverrideBehaviour,
    /**
     * @param {Parameters<typeof FriendListLoadFriendList>} args
     */
    (args, next) => {
      if (!document.getElementById("FriendList")) {
        return;
      }
      // eslint-disable-next-line consistent-return
      return next(args);
    }
  );

  // Prevent processing of sent messages when disconnected
  SDK.hookFunction(
    "ServerSendQueueProcess",
    HOOK_PRIORITIES.OverrideBehaviour,
    /**
     * @param {Parameters<typeof ServerSendQueueProcess>} args
     */
    (args, next) => {
      if (!ServerIsConnected) {
        return null;
      }
      return next(args);
    }
  );
}