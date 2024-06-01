import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";

export default function numericArousalMeters() {
  let isExpanded = false;
  let increasing = false;
  SDK.hookFunction(
    "DrawArousalMeter",
    HOOK_PRIORITIES.Observe,
    (args, next) => {
      const [C] = args;
      isExpanded = !!C.ArousalZoom;
      const progressTimer = C.ArousalSettings?.ProgressTimer ?? 0;
      const activityGoing = progressTimer > 0;
      const vibratorLevel = C.ArousalSettings?.VibratorLevel ?? 0;
      const vibed = vibratorLevel > 0;
      const progress = C.ArousalSettings?.Progress ?? 0;
      const vibedOnEdge = (C.IsEdged() || C.HasEffect("DenialMode")) && progress >= 95;
      increasing = activityGoing || (vibed && !vibedOnEdge);
      const ret = next(args);
      isExpanded = false;
      return ret;
    }
  );

  SDK.hookFunction(
    "DrawArousalThermometer",
    HOOK_PRIORITIES.Observe,
    (args, next) => {
      const ret = next(args);
      if (fbcSettings.numericArousalMeter && isExpanded) {
        const [x, y, zoom, progress] = args;
        let color = "white";
        if (progress >= 95) {
          if (increasing) {
            color = "red";
          } else {
            color = "hotpink";
          }
        } else if (progress >= 70) {
          color = "pink";
        }
        DrawTextFit(
          progress.toLocaleString() + (increasing ? "↑" : " "),
          x + 50 * zoom,
          y - 30 * zoom,
          100 * zoom,
          color,
          "black"
        );
      }

      return ret;
    }
  );
}
