import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";

export default function hideHiddenItemsIcon() {
  SDK.hookFunction(
    "DrawCharacter",
    HOOK_PRIORITIES.ModifyBehaviourLow,
    /**
     * @param {Parameters<typeof DrawCharacter>} args
     */
    (args, next) => {
      const [c] = args;
      if (!c || !fbcSettings.hideHiddenItemsIcon) {
        return next(args);
      }
      const backup = c.HasHiddenItems;
      c.HasHiddenItems = false;
      const ret = next(args);
      c.HasHiddenItems = backup;
      return ret;
    }
  );
}
