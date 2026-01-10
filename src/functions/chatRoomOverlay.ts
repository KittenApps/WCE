import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { isCharacter } from "../util/utils";

export default function chatRoomOverlay(): void {
  SDK.hookFunction("ChatRoomDrawCharacterStatusIcons", HOOK_PRIORITIES.AddBehaviour, ([C, CharX, CharY, Zoom], next) => {
    const ret = next([C, CharX, CharY, Zoom]);
    if (isCharacter(C) && typeof CharX === "number" && typeof CharY === "number" && typeof Zoom === "number" && C.FBC && ChatRoomHideIconState === 0) {
      const text = ["1", "2", "3", "4", "5"].includes(C.FBC.split(".")[0]) ? "FBC" : "WCE";
      DrawTextFit(text, CharX + 290 * Zoom, CharY + 14 * Zoom, 60 * Zoom, C.FBCNoteExists ? "Cyan" : "White", "Black");
      DrawTextFit(
        /^\d+\.\d+(\.\d+)?b?$/u.test(C.FBC) ? C.FBC.replace("b", "") : "",
        CharX + 290 * Zoom,
        CharY + 36 * Zoom,
        C.FBC.split(".").length === 3 ? 60 * Zoom : 40 * Zoom,
        C.FBC.endsWith("b") ? "Lightpink" : "White",
        "Black"
      );
    }
    return ret;
  });
}
