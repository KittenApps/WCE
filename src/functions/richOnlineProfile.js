import { processChatAugmentsForLine } from "./chatAugments";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";

export default function richOnlineProfile() {
  const descTextArea = "DescriptionInput";
  const descRich = "bceRichOnlineProfile";
  let originalShown = true;

  function hideOriginalTextArea() {
    const ta = document.getElementById(descTextArea);
    if (!ta) {
      return;
    }
    originalShown = false;
    ta.style.display = "none";
  }

  function showOriginalTextArea() {
    const ta = document.getElementById(descTextArea);
    if (!ta) {
      return;
    }
    originalShown = true;
    ta.style.display = "";
  }

  function enableRichTextArea() {
    hideOriginalTextArea();

    const div = document.createElement("div");
    div.id = descRich;
    div.style.overflowY = "scroll";
    div.style.overflowX = "hidden";
    div.style.overflowWrap = "break-word";
    div.style.whiteSpace = "pre-wrap";
    div.style.background = "rgb(244, 236, 216)";
    div.style.color = "rgb(45, 35, 27)";
    div.style.border = "2px solid black";
    div.style.padding = "2px";
    div.classList.add("bce-rich-textarea");
    div.textContent = InformationSheetSelection?.Description || "";
    processChatAugmentsForLine(div, () => false);

    document.body.append(div);
    resizeRichTextArea();
  }

  function resizeRichTextArea() {
    ElementPositionFix(descRich, 36, 100, 160, 1790, 750);
  }

  function disableRichTextArea() {
    const div = document.getElementById(descRich);
    if (div) {
      div.remove();
    }

    showOriginalTextArea();
  }

  SDK.hookFunction(
    "OnlineProfileLoad",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof OnlineProfileLoad>} args
     */
    (args, next) => {
      originalShown = true;
      const ret = next(args);
      const ta = document.getElementById(descTextArea);
      if (!fbcSettings.richOnlineProfile || !ta) {
        return ret;
      }

      enableRichTextArea();

      return ret;
    }
  );

  SDK.hookFunction(
    "ChatRoomHideElements",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof ChatRoomHideElements>} args
     */
    (args, next) => {
      disableRichTextArea();
      return next(args);
    }
  );

  const toggleEditButtonPos = /** @type {const} */ ([90, 60, 90, 90]);
  SDK.hookFunction(
    "OnlineProfileRun",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof OnlineProfileRun>} args
     */
    (args, next) => {
      if (!fbcSettings.richOnlineProfile) {
        return next(args);
      }
      DrawButton(...toggleEditButtonPos, "", "White", "Icons/Crafting.png", displayText("Toggle Editing Mode"));

      const ret = next(args);
      if (!originalShown) {
        hideOriginalTextArea();
        resizeRichTextArea();
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "OnlineProfileClick",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof OnlineProfileClick>} args
     */
    (args, next) => {
      if (!fbcSettings.richOnlineProfile) {
        return next(args);
      }
      if (MouseIn(...toggleEditButtonPos)) {
        if (originalShown) {
          enableRichTextArea();
        } else {
          disableRichTextArea();
        }
        return true;
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "OnlineProfileExit",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof OnlineProfileExit>} args
     */
    (args, next) => {
      if (!originalShown) {
        disableRichTextArea();
      }
      return next(args);
    }
  );
}
