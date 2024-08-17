import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { displayText } from "../util/localization";
import { isNonNullObject } from "../util/utils";

const FBC_DEVS = [23476, 27006, 24890];
const WCE_DEVS = [129178];

export default function commonPatches(): void {
  // DrawBackNextButton patch to allow overriding hover text position
  patchFunction(
    "DrawBackNextButton",
    {
      "Disabled, ArrowWidth": "Disabled, ArrowWidth, tooltipPosition",
      "DrawButtonHover(Left, Top, Width, Height,":
        "DrawButtonHover(tooltipPosition?.X || Left, tooltipPosition?.Y || Top, tooltipPosition?.Width || Width, tooltipPosition?.Height || Height,",
    },
    "DrawBackNextButton tooltip positions may be incorrect."
  );

  // DrawButton patch to allow overriding hover text position
  patchFunction(
    "DrawButton",
    {
      "HoveringText, Disabled": "HoveringText, Disabled, tooltipPosition",
      "DrawButtonHover(Left, Top, Width, Height,":
        "DrawButtonHover(tooltipPosition?.X || Left, tooltipPosition?.Y || Top, tooltipPosition?.Width || Width, tooltipPosition?.Height || Height,",
    },
    "DrawButton tooltip positions may be incorrect."
  );

  // CommandExecute patch to fix /whitelistadd and /whitelistremove
  patchFunction(
    "CommandExecute",
    { "key.indexOf(CommandsKey + cmd.Tag) == 0)": "key.substring(1) === cmd.Tag)" },
    "Whitelist commands will not work."
  );

  SDK.hookFunction(
    "InformationSheetRun",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      if (!InformationSheetSelection?.MemberNumber) {
        return next(args);
      }

      const ret = next(args);
      const isFbcDev = FBC_DEVS.includes(InformationSheetSelection.MemberNumber);
      const isWceDev = WCE_DEVS.includes(InformationSheetSelection.MemberNumber);

      if (isFbcDev || isWceDev) {
        const ctx = window.MainCanvas.getContext("2d");
        if (!ctx) {
          throw new Error("could not get canvas 2d context");
        }
        ctx.textAlign = "left";
        DrawText(
          isWceDev ? displayText("WCE Developer") : displayText("FBC Developer"),
          550,
          75,
          isWceDev ? "fuchsia" : "hotpink",
          "black"
        );
        ctx.textAlign = "center";
      }

      return ret;
    }
  );

  // Looking for settings erasure by client
  SDK.hookFunction(
    "ServerSend",
    HOOK_PRIORITIES.Top,
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

  // Prevent processing of sent messages when disconnected
  SDK.hookFunction(
    "ServerSendQueueProcess",
    HOOK_PRIORITIES.OverrideBehaviour,
    (args, next) => {
      if (!ServerIsConnected) {
        return null;
      }
      return next(args);
    }
  );
}
