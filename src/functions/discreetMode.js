import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { isString } from "../util/utils";
import { displayText } from "../util/localization";

export default function discreetMode() {
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
    "ChatRoomCharacterViewDraw",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof ChatRoomCharacterViewDraw>} args
     */
    (args, next) => {
      if (fbcSettings.discreetMode) {
        // Check if we should use a custom background
        let backgroundURL;
        const itemBackground = DrawGetCustomBackground(Player);
        if (itemBackground) {
          backgroundURL = `Backgrounds/${itemBackground}.jpg`;
        } else if (ChatRoomCustomized && ChatRoomCustomBackground) {
          return false;
        } else {
          backgroundURL = `Backgrounds/${ChatRoomData.Background}.jpg`;
        }

        const ignoredImages =
          /(^Backgrounds\/(?!Sheet(White)?|grey|White\.|BrickWall\.)|\b(Kneel|Arousal|Activity|Asylum|Cage|Cell|ChangeLayersMouth|Diaper|Kidnap|Logo|Player|Remote|Restriction|SpitOutPacifier|Struggle|Therapy|Orgasm\d|Poses|HouseVincula|Seducer\w+)\b|^data:|^Assets\/(?!Female3DCG\/Emoticon\/(Afk|Sleep|Read|Gaming|Hearing|Thumbs(Up|Down))\/))/u;
        if (ignoredImages.test(backgroundURL)) {
          const charCount = ChatRoomCharacterViewCharacterCount;
          const charsPerRow = ChatRoomCharacterViewCharactersPerRow;
          const viewWidth = ChatRoomCharacterViewWidth;
          const viewHeight = ChatRoomCharacterViewHeight;
          const opts = {
            inverted: Player.GraphicsSettings.InvertRoom && Player.IsInverted(),
            blur: Player.GetBlurLevel(),
            darken: DrawGetDarkFactor(),
            tints: Player.GetTints(),
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            sizeMode: ChatRoomCustomSizeMode,
          };

          // Loop over the room's characters to draw each of them
          ChatRoomCharacterViewLoopCharacters((charIdx, charX, charY, _space, roomZoom) => {
            // Draw the background every five characters, this fixes clipping errors
            if (charIdx % charsPerRow === 0) {
              const Y = charCount <= charsPerRow ? (viewHeight * (1 - roomZoom)) / 2 : 0;
              const bgRect = RectMakeRect(0, Y + charIdx * 100, viewWidth, viewHeight * roomZoom);
              DrawRoomBackground("Backgrounds/BrickWall.jpg", bgRect, opts);
            }

            // Draw the character, it's status bubble and it's overlay
            DrawCharacter(ChatRoomCharacterDrawlist[charIdx], charX, charY, roomZoom);
            DrawStatus(ChatRoomCharacterDrawlist[charIdx], charX, charY, roomZoom);
            // eslint-disable-next-line no-eq-null, eqeqeq
            if (ChatRoomCharacterDrawlist[charIdx].MemberNumber != null) {
              ChatRoomCharacterViewDrawOverlay(ChatRoomCharacterDrawlist[charIdx], charX, charY, roomZoom, charIdx);
            }
          });
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
