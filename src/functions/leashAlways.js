import { enableLeashing, disableLeashing } from "../util/utils";
import { fbcSettings } from "../util/settings";

export default function leashAlways() {
  if (fbcSettings.leashAlways) {
    enableLeashing();
  } else {
    disableLeashing();
  }
}
