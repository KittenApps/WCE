import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { isCharacter } from "../util/utils";

export default function chatRoomOverlay() {
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
        DrawTextFit(
          text,
          CharX + 290 * Zoom,
          CharY + 12 * Zoom,
          50 * Zoom,
          C.FBCNoteExists ? "Cyan" : "White",
          "Black"
        );
        DrawTextFit(
          /^\d+\.\d+(\.\d+)?b?$/u.test(C.FBC) ? C.FBC.replace("b", "") : "",
          CharX + 290 * Zoom,
          CharY + 32 * Zoom,
          50 * Zoom,
          C.FBC.endsWith("b") ? "Lightpink" : "White",
          "Black"
        );
      }
      return ret;
    }
  );
}
