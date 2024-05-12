import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";

// make anti garble bypass (in restrictions preferences) available on all difficulty levels
export function antiGarbleCheat() {
  patchFunction(
    "PreferenceInitPlayer",
    { "C.RestrictionSettings.NoSpeechGarble = false;\n\t}": "}" },
    "make anti garble bypass (in restrictions preferences) available on all difficulty level"
  );

  patchFunction(
    "PreferenceSubscreenRestrictionRun",
    {
      'DrawCheckbox(500, 625, 64, 64, TextGet("RestrictionNoSpeechGarble"), Player.RestrictionSettings.NoSpeechGarble && !disableButtons, disableButtons);':
        'DrawCheckbox(500, 625, 64, 64, TextGet("RestrictionNoSpeechGarble"), Player.RestrictionSettings.NoSpeechGarble);',
    },
    "make anti garble bypass (in restrictions preferences) available on all difficulty level"
  );

  SDK.hookFunction(
    "PreferenceSubscreenRestrictionClick",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof PreferenceSubscreenRestrictionClick>} args
     */ (args, next) => {
      if (MouseIn(500, 625, 64, 64)) {
        Player.RestrictionSettings.NoSpeechGarble = !Player.RestrictionSettings.NoSpeechGarble;
        return;
      }
      return next(args);
    }
  );
}
