import { fbcSettings } from "../util/settings";
import { toySyncState } from "./toySync";

export default function confirmLeave() {
  // Confirm leaving the page to prevent accidental back button, refresh, or other navigation-related disruptions
  window.addEventListener(
    "beforeunload",
    e => {
      if (toySyncState.client?.connected) {
        // Stop vibrating toys
        toySyncState.client.stopAllDevices();
      }
      if (fbcSettings.confirmLeave) {
        e.preventDefault();
        // eslint-disable-next-line @typescript-eslint/no-deprecated
        return (e.returnValue = "Are you sure you want to leave the club?");
      }
      return null;
    },
    { capture: true }
  );
}
