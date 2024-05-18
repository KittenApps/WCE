import { waitFor, enableLeashing, disableLeashing } from "../util/utils";
import { fbcSettings } from "../util/settings";

export default async function leashAlways() {
  if (fbcSettings.leashAlways) {
    enableLeashing();
  } else {
    disableLeashing();
  }
}
