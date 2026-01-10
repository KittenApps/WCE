import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";

export default function hideHiddenItemsIcon(): void {
  SDK.hookFunction("DrawCharacter", HOOK_PRIORITIES.ModifyBehaviourLow, (args, next) => {
    const [C] = args;
    if (!C || !fbcSettings.hideHiddenItemsIcon) {
      return next(args);
    }
    const backup = C.HasHiddenItems;
    C.HasHiddenItems = false;
    const ret = next(args);
    C.HasHiddenItems = backup;
    return ret;
  });
}
