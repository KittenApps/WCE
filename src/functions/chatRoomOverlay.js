import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { ICONS } from "../util/constants";
import { isCharacter } from "../util/utils";

export function chatRoomOverlay() {
  SDK.hookFunction(
    "ChatRoomDrawCharacterStatusIcons",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof ChatRoomDrawCharacterStatusIcons>} args
     */
    (args, next) => {
      const ret = next(args);
      const [C, CharX, CharY, Zoom] = args;
      if (
        isCharacter(C) &&
        typeof CharX === "number" &&
        typeof CharY === "number" &&
        typeof Zoom === "number" &&
        C.FBC &&
        ChatRoomHideIconState === 0
      ) {
        const icon = ["1", "2", "3"].includes(C.FBC.split(".")[0]) ? ICONS.BCE_USER : ICONS.USER;
        DrawImageResize(icon, CharX + 270 * Zoom, CharY, 40 * Zoom, 40 * Zoom);
        DrawTextFit(
          /^\d+\.\d+(\.\d+)?$/u.test(C.FBC) ? C.FBC : "",
          CharX + 290 * Zoom,
          CharY + 30 * Zoom,
          40 * Zoom,
          C.FBCNoteExists ? "Cyan" : "White",
          "Black"
        );
      }
      return ret;
    }
  );
}
