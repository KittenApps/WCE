import { fbcSettings } from "../util/settings";
import { enableLeashing, disableLeashing } from "../util/utils";

export default function leashAlways(): void {
  if (fbcSettings.leashAlways) {
    enableLeashing();
  } else {
    disableLeashing();
  }
}
