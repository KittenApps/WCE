import { SDK, HOOK_PRIORITIES } from "..";
import { fbcSettings } from "../util/settings";
import { isString } from "../util/utils";
import { displayText } from "../util/localization";

export function discreetMode() {
  /**
   * @param {any} args
   * @param {(args: any) => void} next
   */
  const discreetModeHook = (args, next) => {
    if (fbcSettings.discreetMode) {
      return;
    }
    // eslint-disable-next-line consistent-return
    return next(args);
  };

  SDK.hookFunction("ChatRoomCharacterViewDrawBackground", HOOK_PRIORITIES.Top, discreetModeHook);

  SDK.hookFunction("DrawCharacter", HOOK_PRIORITIES.Top, discreetModeHook);
  SDK.hookFunction("NotificationDrawFavicon", HOOK_PRIORITIES.Top, discreetModeHook);

  SDK.hookFunction(
    "DrawImageEx",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof DrawImageEx>} args
     */
    (args, next) => {
      if (fbcSettings.discreetMode) {
        if (!args) {
          return false;
        }
        const isBackground = isString(args[0]) && args[0].startsWith("Backgrounds/");
        const ignoredImages =
          /(^Backgrounds\/(?!Sheet(White)?|grey|White\.|BrickWall\.)|\b(Kneel|Arousal|Activity|Asylum|Cage|Cell|ChangeLayersMouth|Diaper|Kidnap|Logo|Player|Remote|Restriction|SpitOutPacifier|Struggle|Therapy|Orgasm\d|Poses|HouseVincula|Seducer\w+)\b|^data:|^Assets\/(?!Female3DCG\/Emoticon\/(Afk|Sleep|Read|Gaming|Hearing|Thumbs(Up|Down))\/))/u;
        if (isString(args[0]) && ignoredImages.test(args[0])) {
          if (isBackground) {
            args[0] = "Backgrounds/BrickWall.jpg";
            return next(args);
          }
          return false;
        }
        // @ts-ignore
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (args[0]?.src && ignoredImages.test(args[0].src)) {
          return false;
        }
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "NotificationTitleUpdate",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof NotificationTitleUpdate>} args
     */
    (args, next) => {
      if (fbcSettings.discreetMode) {
        const notificationCount = NotificationGetTotalCount(1);
        document.title = `${notificationCount > 0 ? `(${notificationCount}) ` : ""}${displayText("OnlineChat")}`;
        return;
      }
      // eslint-disable-next-line consistent-return
      return next(args);
    }
  );
}