import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { displayText } from "../util/localization";
import { fbcSettings } from "../util/settings";

/** @type {Map<string, "allowed" | "denied">} */
export const sessionCustomOrigins = new Map();

export function customContentDomainCheck() {
  const trustedOrigins = ["https://fs.kinkop.eu", "https://i.imgur.com"];

  let open = false;
  /**
   * @param {string} origin
   * @param {"image" | "music" | null} type
   */
  function showCustomContentDomainCheckWarning(origin, type = null) {
    if (open) {
      return;
    }
    open = true;
    FUSAM.modals.open({
      prompt: displayText(`Do you want to allow 3rd party ${type ?? "content"} to be loaded from $origin? $trusted`, {
        $origin: origin,
        $trusted: trustedOrigins.includes(origin) ? displayText("(This origin is trusted by authors of WCE)") : "",
      }),
      callback: (act) => {
        open = false;
        if (act === "submit") {
          sessionCustomOrigins.set(origin, "allowed");
        } else if (act === "cancel") {
          sessionCustomOrigins.set(origin, "denied");
        }
      },
      buttons: {
        cancel: displayText("Deny for session"),
        submit: displayText("Allow for session"),
      },
    });
  }

  SDK.hookFunction(
    "ChatAdminRoomCustomizationProcess",
    HOOK_PRIORITIES.OverrideBehaviour,
    /**
     * @param {Parameters<typeof ChatAdminRoomCustomizationProcess>} args
     */
    (args, next) => {
      if (!fbcSettings.customContentDomainCheck) {
        return next(args);
      }

      try {
        // @ts-ignore - the function's types are garbage
        const [{ ImageURL, MusicURL }] = args;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
        const imageOrigin = ImageURL && new URL(ImageURL).origin;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument
        const musicOrigin = MusicURL && new URL(MusicURL).origin;

        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        if (imageOrigin && !sessionCustomOrigins.has(imageOrigin)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          showCustomContentDomainCheckWarning(imageOrigin, "image");
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        } else if (musicOrigin && !sessionCustomOrigins.has(musicOrigin)) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          showCustomContentDomainCheckWarning(musicOrigin, "music");
        }

        if (
          (!ImageURL ||
            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            sessionCustomOrigins.get(imageOrigin) === "allowed") &&
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          (!MusicURL || sessionCustomOrigins.get(musicOrigin) === "allowed")
        ) {
          return next(args);
        }
      } catch (_) {
        // Don't care
      }

      return null;
    }
  );

  SDK.hookFunction(
    "ChatAdminRoomCustomizationClick",
    HOOK_PRIORITIES.Observe,
    /**
     * @param {Parameters<typeof ChatAdminRoomCustomizationClick>} args
     */
    (args, next) => {
      for (const s of [ElementValue("InputImageURL").trim(), ElementValue("InputMusicURL").trim()]) {
        try {
          const url = new URL(s);
          sessionCustomOrigins.set(url.origin, "allowed");
        } catch (_) {
          // Don't care
        }
      }
      return next(args);
    }
  );
}
