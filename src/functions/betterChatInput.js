import { patchFunction } from "../util/modding";

export function betterChatInput() {
  patchFunction(
    "ElementPositionFixed",
    {
      "const Font = MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 50 : MainCanvas.canvas.clientHeight / 25;": `let Font;
        if (fbcSettingValue("betterChatInput") && ElementID === "InputChat") {
          Font = MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 79 : MainCanvas.canvas.clientHeight / 38;
        } else {
          Font = MainCanvas.canvas.clientWidth <= MainCanvas.canvas.clientHeight * 2 ? MainCanvas.canvas.clientWidth / 50 : MainCanvas.canvas.clientHeight / 25;
        }`,
    },
    "better ChatInput won't have smaller fontsize"
  );
}
