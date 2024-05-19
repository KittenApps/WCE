import { toySyncState } from "./toySync";
import { fbcSettings } from "../util/settings";

export default function confirmLeave() {
  // Confirm leaving the page to prevent accidental back button, refresh, or other navigation-related disruptions
  window.addEventListener(
    "beforeunload",
    (e) => {
      if (toySyncState.client?.connected) {
        // Stop vibrating toys
        for (const device of toySyncState.client.devices.filter((d) => d.vibrateAttributes.length > 0)) {
          device.vibrate(0);
        }
      }
      if (fbcSettings.confirmLeave) {
        e.preventDefault();
        // @ts-ignore - TS thinks it's private, pffft we don't respect that
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        ServerSocket.io.disconnect();
        CommonSetScreen("Character", "Relog");
        ServerSocket.io.connect();
        // eslint-disable-next-line deprecation/deprecation
        return (e.returnValue = "Are you sure you want to leave the club?");
      }
      return null;
    },
    {
      capture: true,
    }
  );
}
