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
        const text = ["1", "2", "3", "4", "5"].includes(C.FBC.split(".")[0]) ? "FBC" : "WCE";
        DrawTextFit(text, CharX + 290 * Zoom, CharY + 12 * Zoom, 50 * Zoom, C.FBCNoteExists ? "Cyan" : "White", "Black");
        DrawTextFit(
          /^\d+\.\d+(\.\d+)?$/u.test(C.FBC) ? C.FBC : "",
          CharX + 290 * Zoom,
          CharY + 32 * Zoom,
          35 * Zoom,
          C.FBCNoteExists ? "Cyan" : "White",
          "Black"
        );
      }
      return ret;
    }
  );
}
