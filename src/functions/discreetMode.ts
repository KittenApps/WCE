import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { isString } from "../util/utils";
import { displayText } from "../util/localization";

const ignoredImages = /(^Backgrounds\/(?!Sheet(White)?|grey|White\.|BrickWall\.)|\b(Kneel|Arousal|Activity|Asylum|Cage|Cell|ChangeLayersMouth|Diaper|Kidnap|Logo|Player|Remote|Restriction|SpitOutPacifier|Struggle|Therapy|Orgasm\d|Poses|HouseVincula|Seducer\w+)\b|^data:|^Assets\/(?!Female3DCG\/Emoticon\/(Afk|Sleep|Read|Gaming|Hearing|Thumbs(Up|Down))\/))/u;

export default function discreetMode(): void {
  SDK.hookFunction(
    "CharacterSetActivePose",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (fbcSettings.discreetMode) return null;
      return next(args);
    }
  );

  SDK.hookFunction(
    "PoseSetActive",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (fbcSettings.discreetMode) return null;
      return next(args);
    }
  );

  SDK.hookFunction(
    "DrawImageEx",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (fbcSettings.discreetMode) {
        if (!args) return false;
        if (isString(args[0]) && ignoredImages.test(args[0])) {
          if (args[0].startsWith("Backgrounds/")) {
            args[0] = "Backgrounds/BrickWall.jpg";
            return next(args);
          }
          return false;
        }
        if (args[0] instanceof HTMLCanvasElement) return false;
        if (args[0] instanceof HTMLImageElement && ignoredImages.test(args[0].src)) return false;
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "ChatRoomCharacterViewDraw",
    HOOK_PRIORITIES.Top,
    (args, next) => {
      if (fbcSettings.discreetMode) {
        // Check if we should use a custom background
        let backgroundURL: string;
        const itemBackground = DrawGetCustomBackground(Player);
        if (itemBackground) {
          backgroundURL = `Backgrounds/${itemBackground}.jpg`;
        } else if (ChatRoomCustomized && ChatRoomCustomBackground) {
          return false;
        } else {
          backgroundURL = `Backgrounds/${ChatRoomData.Background}.jpg`;
        }
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
            sizeMode: ChatRoomData.Custom?.SizeMode,
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
            if (ChatRoomCharacterDrawlist[charIdx].MemberNumber) {
              ChatRoomCharacterViewDrawOverlay(ChatRoomCharacterDrawlist[charIdx], charX, charY, roomZoom);
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
    (args, next) => {
      if (fbcSettings.discreetMode) {
        const notificationCount = NotificationGetTotalCount(NotificationAlertType.TITLEPREFIX);
        document.title = `${notificationCount > 0 ? `(${notificationCount}) ` : ""}${displayText("OnlineChat")}`;
        return null;
      }
      return next(args);
    }
  );
}
