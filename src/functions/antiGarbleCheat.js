import { patchFunction } from '../index';

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
  patchFunction(
    "PreferenceSubscreenRestrictionClick",
    {
      "if (MouseIn(500, 625, 64, 64) && (Player.GetDifficulty() == 0)) Player.RestrictionSettings.NoSpeechGarble = !Player.RestrictionSettings.NoSpeechGarble;":
        "if (MouseIn(500, 625, 64, 64)) Player.RestrictionSettings.NoSpeechGarble = !Player.RestrictionSettings.NoSpeechGarble;",
    },
    "make anti garble bypass (in restrictions preferences) available on all difficulty level"
  );
}