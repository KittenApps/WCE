import { SDK, HOOK_PRIORITIES, patchFunction } from "../util/modding";
import { fbcSettings } from "../util/settings";
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

  patchFunction(
    "PreferenceSubscreenArousalRun",
    {
      'DrawCheckbox(1250, 276, 64, 64, TextGet("ArousalAffectExpression"), Player.ArousalSettings.AffectExpression);':
        'DrawCheckbox(1250, 276, 64, 64, TextGet("ArousalAffectExpression"), Player.ArousalSettings.AffectExpression, fbcSettingValue("animationEngine"));',
    },
    "disabling conflicting Player.ArousalSettings.AffectExpression when Animation Engine is active"
  );

  SDK.hookFunction(
    "PreferenceSubscreenArousalClick",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    (args, next) => {
      if (fbcSettings.animationEngine && PreferenceArousalIsActive() && MouseIn(1250, 276, 64, 64)) return null;
      return next(args);
    }
  );

  patchFunction(
    "PreferenceSubscreenImmersionRun",
    {
      'TextGet("ShowUngarbledMessages"), Player.ImmersionSettings.ShowUngarbledMessages, disableButtons);':
        'TextGet("ShowUngarbledMessages"), Player.ImmersionSettings.ShowUngarbledMessages, false);',
    },
    "Can't control show ungarbled messages while in Extreme mode."
  );

  SDK.hookFunction(
    "PreferenceSubscreenImmersionClick",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    (args, next) => {
      if (PreferencePageCurrent === 2 && MouseIn(500, 592, 64, 64) &&
        (Player.GetDifficulty() > 2 || (Player.GameplaySettings.ImmersionLockSetting && Player.IsRestrained()))) {
        Player.ImmersionSettings.ShowUngarbledMessages = !Player.ImmersionSettings.ShowUngarbledMessages;
        return null;
      }
      return next(args);
    }
  );

  PreferenceSubscreens.find(s => s.name === "Arousal").run = PreferenceSubscreenArousalRun;
  PreferenceSubscreens.find(s => s.name === "Arousal").click = PreferenceSubscreenArousalClick;
  PreferenceSubscreens.find(s => s.name === "Immersion").run = PreferenceSubscreenImmersionRun;
  PreferenceSubscreens.find(s => s.name === "Immersion").click = PreferenceSubscreenImmersionClick;

  // fix other addons adding multiple legacy settings screens
  SDK.hookFunction(
    "PreferenceLoad",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      PreferenceDidAddOldStyleScreens = false;
      const ret = next(args);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      PreferenceSubscreenList = [];
      return ret;
    }
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
