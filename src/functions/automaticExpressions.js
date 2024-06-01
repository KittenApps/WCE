import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { BCX } from "./hookBCXAPI";
import { createTimer } from "../util/hooks";
import { fbcSettings } from "../util/settings";
import {
  waitFor,
  fbcChatNotify,
  deepCopy,
  isString,
  objEntries,
  isCharacter,
  isNonNullObject,
  isStringOrStringArray,
  mustNum,
} from "../util/utils";
import { displayText } from "../util/localization";
import { logWarn } from "../util/logger";

export default async function automaticExpressions() {
  await waitFor(() => CurrentScreen === "ChatRoom" && !!Player.ArousalSettings);
  if (!Player.ArousalSettings) {
    throw new Error("Player.ArousalSettings is not defined");
  }

  patchFunction(
    "PreferenceSubscreenArousalRun",
    {
      'DrawCheckbox(1250, 276, 64, 64, TextGet("ArousalAffectExpression"), Player.ArousalSettings.AffectExpression);':
        'DrawCheckbox(1250, 276, 64, 64, TextGet("ArousalAffectExpression"), Player.ArousalSettings.AffectExpression, fbcSettingValue("animationEngine"));',
    },
    "disabling conflicting Player.ArousalSettings.AffectExpression when Animation Engine is active"
  );

  SDK.hookFunction(
    "PreferenceSubscreenArousalClick",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    (args, next) => {
      if (fbcSettings.animationEngine && PreferenceArousalIsActive() && MouseIn(1250, 276, 64, 64)) return null;
      return next(args);
    }
  );

  patchFunction(
    "StruggleMinigameHandleExpression",
    {
      '");': '", 3);',
    },
    "Resetting blush, eyes, and eyebrows after struggling"
  );

  window.bceAnimationEngineEnabled = () => !!fbcSettings.animationEngine;

  SDK.hookFunction(
    "StruggleMinigameStop",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    (args, next) => {
      if (fbcSettings.animationEngine) {
        // eslint-disable-next-line no-undefined
        StruggleExpressionStore = undefined;
        resetExpressionQueue([GAME_TIMED_EVENT_TYPE], [MANUAL_OVERRIDE_EVENT_TYPE]);
      }
      return next(args);
    }
  );

  if (!window.bce_ArousalExpressionStages) {
    // eslint-disable-next-line camelcase
    window.bce_ArousalExpressionStages = {
      Blush: [
        { Expression: "High", Limit: 100 },
        { Expression: "Medium", Limit: 60 },
        { Expression: "Low", Limit: 10 },
        { Expression: null, Limit: 0 },
      ],
      Eyebrows: [
        { Expression: "Soft", Limit: 80 },
        { Expression: "Lowered", Limit: 50 },
        { Expression: "Raised", Limit: 20 },
        { Expression: null, Limit: 0 },
      ],
      Fluids: [
        { Expression: "DroolMedium", Limit: 100 },
        { Expression: "DroolLow", Limit: 40 },
        { Expression: null, Limit: 0 },
      ],
      Eyes: [
        { Expression: "Closed", Limit: 100 },
        { Expression: "Surprised", Limit: 90 },
        { Expression: "Horny", Limit: 70 },
        { Expression: "Dazed", Limit: 20 },
        { Expression: null, Limit: 0 },
      ],
      Eyes2: [
        { Expression: "Closed", Limit: 100 },
        { Expression: "Surprised", Limit: 90 },
        { Expression: "Horny", Limit: 70 },
        { Expression: "Dazed", Limit: 20 },
        { Expression: null, Limit: 0 },
      ],
      // Pussy group includes Penis, which is the only type of "pussy" with expressions and controls erections.
      Pussy: [
        { Expression: "Hard", Limit: 50 },
        { Expression: null, Limit: 0 },
      ],
    };
  }

  /** @type {{[key: string]: ExpressionName[]}} */
  const bceExpressionModifierMap = Object.freeze({
    Blush: [null, "Low", "Medium", "High", "VeryHigh", "Extreme"],
  });

  const AUTOMATED_AROUSAL_EVENT_TYPE = "AutomatedByArousal",
    DEFAULT_EVENT_TYPE = "DEFAULT",
    GAME_TIMED_EVENT_TYPE = "GameTimer",
    MANUAL_OVERRIDE_EVENT_TYPE = "ManualOverride",
    POST_ORGASM_EVENT_TYPE = "PostOrgasm";

  /** @type {ExpressionEvent[]} */
  const bceExpressionsQueue = [];
  let lastUniqueId = 0;

  /** @type {() => number} */
  function newUniqueId() {
    lastUniqueId = (lastUniqueId + 1) % (Number.MAX_SAFE_INTEGER - 1);
    return lastUniqueId;
  }

  /** @type {Partial<Record<'Eyes' | 'Eyes2' | 'Eyebrows' | 'Mouth' | 'Fluids' | 'Emoticon' | 'Blush' | 'Pussy', string | null>>} */
  const manualComponents = {};

  /** @type {(evt: ExpressionEvent) => void} */
  function pushEvent(evt) {
    if (!evt) {
      return;
    }
    switch (evt.Type) {
      case AUTOMATED_AROUSAL_EVENT_TYPE:
      case POST_ORGASM_EVENT_TYPE:
        if (!fbcSettings.expressions) {
          return;
        }
        break;
      case MANUAL_OVERRIDE_EVENT_TYPE:
        break;
      default:
        if (!fbcSettings.activityExpressions) {
          return;
        }
    }
    const time = Date.now();
    // Deep copy
    /** @type {ExpressionEvent} */
    const event = deepCopy(evt);
    event.At = time;
    event.Until = time + event.Duration;
    event.Id = newUniqueId();
    if (typeof event.Priority !== "number") {
      event.Priority = 1;
    }
    if (event.Expression) {
      for (const t of Object.values(event.Expression)) {
        for (const exp of t) {
          exp.Id = newUniqueId();
          if (typeof exp.Priority !== "number") {
            exp.Priority = 1;
          }
          if (typeof exp.Duration !== "number") {
            exp.Duration = event.Duration;
          }
        }
      }
    }
    if (event.Poses) {
      for (const p of event.Poses) {
        p.Id = newUniqueId();
        if (typeof p.Priority !== "number") {
          p.Priority = 1;
        }
      }
    }
    bceExpressionsQueue.push(event);
  }
  window.fbcPushEvent = pushEvent;

  if (!window.bce_EventExpressions) {
    // eslint-disable-next-line camelcase
    window.bce_EventExpressions = {
      PostOrgasm: {
        Type: POST_ORGASM_EVENT_TYPE,
        Duration: 20000,
        Priority: 10000,
        Expression: {
          Blush: [
            { Expression: "Extreme", Duration: 5000 },
            { ExpressionModifier: -1, Duration: 5000 },
            { ExpressionModifier: -1, Duration: 5000, Priority: 1000 },
            { ExpressionModifier: -1, Duration: 5000, Priority: 200 },
          ],
          Eyes: [
            { Expression: "Closed", Duration: 8500 },
            { Expression: "Heart", Duration: 7500 },
            { Expression: "Sad", Duration: 4000, Priority: 200 },
          ],
          Eyes2: [
            { Expression: "Closed", Duration: 8000 },
            { Expression: "Heart", Duration: 8000 },
            { Expression: "Sad", Duration: 4000, Priority: 200 },
          ],
          Mouth: [
            { Expression: "Ahegao", Duration: 5000 },
            { Expression: "Moan", Duration: 5000 },
            { Expression: "HalfOpen", Duration: 10000, Priority: 200 },
          ],
          Fluids: [
            { Expression: "DroolMessy", Duration: 5000 },
            { Expression: "DroolSides", Duration: 9000, Priority: 400 },
            { Expression: "DroolLow", Duration: 6000, Priority: 200 },
          ],
          Eyebrows: [
            { Expression: "Soft", Duration: 10000 },
            { Expression: "Lowered", Duration: 5000, Priority: 200 },
            { Expression: null, Duration: 5000, Priority: 1 },
          ],
        },
      },
      Pout: {
        Type: "Pout",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Pout", Duration: -1 }],
          Eyes: [{ Expression: "Dazed", Duration: -1 }],
          Eyes2: [{ Expression: "Dazed", Duration: -1 }],
          Eyebrows: [{ Expression: "Harsh", Duration: -1 }],
        },
      },
      ResetBrows: {
        Type: "ResetBrows",
        Duration: -1,
        Expression: {
          Eyebrows: [{ Expression: null, Duration: -1 }],
        },
      },
      RaiseBrows: {
        Type: "RaiseBrows",
        Duration: -1,
        Expression: {
          Eyebrows: [{ Expression: "Raised", Duration: -1 }],
        },
      },
      Confused: {
        Type: "Confused",
        Duration: -1,
        Expression: {
          Eyebrows: [{ Expression: "OneRaised", Duration: -1 }],
        },
      },
      Smirk: {
        Type: "Smirk",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Smirk", Duration: -1 }],
        },
      },
      Wink: {
        Type: "Wink",
        Duration: 1500,
        Expression: {
          Eyes: [{ Expression: "Closed", Duration: 1500 }],
        },
      },
      Laugh: {
        Type: "Laugh",
        Duration: 8000,
        Expression: {
          Mouth: [
            { Expression: "Laughing", Duration: 1000 },
            { Expression: "Grin", Duration: 200 },
            { Expression: "Laughing", Duration: 1000 },
            { Expression: "Happy", Duration: 200 },
            { Expression: "Laughing", Duration: 800 },
            { Expression: "Grin", Duration: 400 },
            { Expression: "Laughing", Duration: 800 },
            { Expression: "Happy", Duration: 400 },
            { Expression: "Laughing", Duration: 600 },
            { Expression: "Grin", Duration: 600 },
            { Expression: "Laughing", Duration: 600 },
            { Expression: "Happy", Duration: 600 },
            { Expression: "Laughing", Duration: 200 },
            { Expression: "Grin", Duration: 200 },
            { Expression: "Laughing", Duration: 200 },
            { Expression: "Happy", Duration: 200 },
          ],
        },
      },
      Giggle: {
        Type: "Giggle",
        Duration: 4000,
        Expression: {
          Mouth: [
            { Expression: "Laughing", Duration: 800 },
            { Expression: "Grin", Duration: 200 },
            { Expression: "Laughing", Duration: 700 },
            { Expression: "Happy", Duration: 200 },
            { Expression: "Laughing", Duration: 600 },
            { Expression: "Grin", Duration: 200 },
            { Expression: "Laughing", Duration: 500 },
            { Expression: "Grin", Duration: 200 },
            { Expression: "Laughing", Duration: 400 },
            { Expression: "Happy", Duration: 200 },
          ],
        },
      },
      Chuckle: {
        Type: "Chuckle",
        Duration: 4000,
        Expression: {
          Mouth: [{ Expression: "Grin", Duration: 4000 }],
        },
      },
      Smile: {
        Type: "Smile",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Grin", Duration: -1 }],
        },
      },
      Blink: {
        Type: "Blink",
        Duration: 200,
        Expression: {
          Eyes: [{ Expression: "Closed", Duration: 200 }],
          Eyes2: [{ Expression: "Closed", Duration: 200 }],
        },
      },
      Grin: {
        Type: "Grin",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: "Horny", Duration: -1 }],
          Eyes2: [{ Expression: "Horny", Duration: -1 }],
          Mouth: [{ Expression: "Grin", Duration: -1 }],
        },
      },
      Cuddle: {
        Type: "Cuddle",
        Duration: 10000,
        Priority: 150,
        Expression: {
          Mouth: [{ Expression: "Happy", Duration: 10000 }],
          Eyes: [{ Expression: "ShylyHappy", Duration: 10000 }],
          Eyes2: [{ Expression: "ShylyHappy", Duration: 10000 }],
          Eyebrows: [{ Expression: "Raised", Duration: 10000 }],
        },
      },
      Blush: {
        Type: "Blush",
        Duration: 10000,
        Expression: {
          Blush: [{ ExpressionModifier: 1, Duration: 10000 }],
        },
      },
      Choke: {
        Type: "Choke",
        Duration: 4000,
        Priority: 150,
        Expression: {
          Blush: [{ ExpressionModifier: 3, Duration: 4000 }],
          Eyes: [
            { Expression: "VeryLewd", Duration: 3000 },
            { Expression: "Sad", Duration: 1000 },
          ],
          Eyes2: [
            { Expression: "VeryLewd", Duration: 3000 },
            { Expression: "Sad", Duration: 1000 },
          ],
          Eyebrows: [{ Expression: "Harsh", Duration: 4000 }],
        },
      },
      Stimulated: {
        Type: "Stimulated",
        Duration: 5000,
        Priority: 400,
        Expression: {
          Blush: [{ ExpressionModifier: 2, Duration: 5000 }],
          Eyes: [
            { Expression: "VeryLewd", Duration: 4000 },
            { Expression: "Sad", Duration: 1000 },
          ],
          Eyes2: [
            { Expression: "VeryLewd", Duration: 4000 },
            { Expression: "Sad", Duration: 1000 },
          ],
          Eyebrows: [{ Expression: "Soft", Duration: 5000 }],
        },
      },
      StimulatedLong: {
        Type: "StimulatedLong",
        Duration: 20000,
        Priority: 400,
        Expression: {
          Blush: [{ ExpressionModifier: 1, Duration: 20000 }],
        },
      },
      Shock: {
        Type: "Shock",
        Duration: 15000,
        Priority: 1000,
        Expression: {
          Blush: [
            { ExpressionModifier: 5, Duration: 10000 },
            { ExpressionModifier: -1, Duration: 2000 },
            { ExpressionModifier: -1, Duration: 2000 },
            { ExpressionModifier: -1, Duration: 1000 },
          ],
          Eyes: [
            { Expression: "Dizzy", Duration: 1000 },
            { Expression: "Scared", Duration: 8000 },
            { Expression: "Surprised", Duration: 7000 },
          ],
          Eyes2: [
            { Expression: "Dizzy", Duration: 1000 },
            { Expression: "Scared", Duration: 8000 },
            { Expression: "Surprised", Duration: 7000 },
          ],
          Eyebrows: [{ Expression: "Soft", Duration: 15000 }],
          Mouth: [
            { Expression: "Pained", Duration: 10000 },
            { Expression: "Angry", Duration: 5000 },
          ],
        },
      },
      ShockLight: {
        Type: "ShockLight",
        Duration: 5000,
        Priority: 900,
        Expression: {
          Blush: [{ ExpressionModifier: 2, Duration: 5000 }],
          Eyes: [
            { Expression: "Dizzy", Duration: 2000 },
            { Expression: "Surprised", Duration: 3000 },
          ],
          Eyes2: [
            { Expression: "Dizzy", Duration: 2000 },
            { Expression: "Surprised", Duration: 3000 },
          ],
          Eyebrows: [{ Expression: "Soft", Duration: 5000 }],
          Mouth: [{ Expression: "Angry", Duration: 5000 }],
        },
      },
      Hit: {
        Type: "Hit",
        Duration: 7000,
        Priority: 500,
        Expression: {
          Blush: [{ Expression: "VeryHigh", Duration: 7000 }],
          Eyes: [
            { Expression: "Daydream", Duration: 1000 },
            { Expression: "Closed", Duration: 3000 },
            { Expression: "Daydream", Duration: 3000 },
          ],
          Eyes2: [
            { Expression: "Daydream", Duration: 1000 },
            { Expression: "Closed", Duration: 3000 },
            { Expression: "Daydream", Duration: 3000 },
          ],
          Eyebrows: [{ Expression: "Soft", Duration: 7000 }],
        },
      },
      Spank: {
        Type: "Spank",
        Duration: 3000,
        Priority: 300,
        Expression: {
          Eyes: [{ Expression: "Lewd", Duration: 3000 }],
          Eyes2: [{ Expression: "Lewd", Duration: 3000 }],
          Eyebrows: [{ Expression: "Soft", Duration: 3000 }],
        },
      },
      Kiss: {
        Type: "Kiss",
        Duration: 2000,
        Priority: 200,
        Expression: {
          Mouth: [{ Expression: "HalfOpen", Duration: 2000 }],
        },
      },
      KissOnLips: {
        Type: "KissOnLips",
        Duration: 2000,
        Priority: 200,
        Expression: {
          Eyes: [{ Expression: "Closed", Duration: 2000 }],
          Eyes2: [{ Expression: "Closed", Duration: 2000 }],
          Mouth: [{ Expression: "HalfOpen", Duration: 2000 }],
          Blush: [
            { Skip: true, Duration: 1000 },
            { ExpressionModifier: 1, Duration: 1000 },
          ],
        },
      },
      LongKiss: {
        Type: "LongKiss",
        Duration: 4000,
        Priority: 200,
        Expression: {
          Eyes: [{ Expression: "Closed", Duration: 4000 }],
          Eyes2: [{ Expression: "Closed", Duration: 4000 }],
          Mouth: [{ Expression: "Open", Duration: 4000 }],
          Blush: [
            { Skip: true, Duration: 1000 },
            { ExpressionModifier: 1, Duration: 1000 },
            { ExpressionModifier: 1, Duration: 2000 },
          ],
        },
      },
      Disoriented: {
        Type: "Disoriented",
        Duration: 8000,
        Priority: 250,
        Expression: {
          Eyes: [{ Expression: "Dizzy", Duration: 8000 }],
          Eyes2: [{ Expression: "Dizzy", Duration: 8000 }],
          Eyebrows: [{ Expression: "Raised", Duration: 8000 }],
          Blush: [{ ExpressionModifier: 2, Duration: 8000 }],
        },
      },
      Angry: {
        Type: "Angry",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Angry", Duration: -1 }],
          Eyes: [{ Expression: "Angry", Duration: -1 }],
          Eyes2: [{ Expression: "Angry", Duration: -1 }],
          Eyebrows: [{ Expression: "Angry", Duration: -1 }],
        },
      },
      Sad: {
        Type: "Sad",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Frown", Duration: -1 }],
          Eyes: [{ Expression: "Shy", Duration: -1 }],
          Eyes2: [{ Expression: "Shy", Duration: -1 }],
          Eyebrows: [{ Expression: "Soft", Duration: -1 }],
        },
      },
      Worried: {
        Type: "Worried",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: "Surprised", Duration: -1 }],
          Eyes2: [{ Expression: "Surprised", Duration: -1 }],
          Eyebrows: [{ Expression: "Soft", Duration: -1 }],
        },
      },
      Distressed: {
        Type: "Distressed",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: "Scared", Duration: -1 }],
          Eyes2: [{ Expression: "Scared", Duration: -1 }],
          Eyebrows: [{ Expression: "Soft", Duration: -1 }],
          Mouth: [{ Expression: "Angry", Duration: -1 }],
        },
      },
      Reset: {
        Type: "Reset",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: null, Duration: -1 }],
          Eyes: [{ Expression: null, Duration: -1 }],
          Eyes2: [{ Expression: null, Duration: -1 }],
          Eyebrows: [{ Expression: null, Duration: -1 }],
          Blush: [{ Expression: null, Duration: -1 }],
          Fluids: [{ Expression: null, Duration: -1 }],
        },
      },
      Cry: {
        Type: "Cry",
        Duration: -1,
        Expression: {
          Fluids: [{ Expression: "TearsMedium", Duration: -1 }],
        },
      },
      DroolReset: {
        Type: "DroolReset",
        Duration: -1,
        Expression: {
          Fluids: [{ Expression: null, Duration: -1 }],
        },
      },
      DroolSides: {
        Type: "DroolSides",
        Duration: -1,
        Expression: {
          Fluids: [{ Expression: "DroolSides", Duration: -1 }],
        },
      },
      BareTeeth: {
        Type: "BareTeeth",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Angry", Duration: -1 }],
        },
      },
      Happy: {
        Type: "Happy",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Happy", Duration: -1 }],
        },
      },
      Frown: {
        Type: "Frown",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Frown", Duration: -1 }],
        },
      },
      Glare: {
        Type: "Glare",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: "Angry", Duration: -1 }],
          Eyes2: [{ Expression: "Angry", Duration: -1 }],
          Eyebrows: [{ Expression: "Harsh", Duration: -1 }],
        },
      },
      NarrowEyes: {
        Type: "NarrowEyes",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: "Horny", Duration: -1 }],
          Eyes2: [{ Expression: "Horny", Duration: -1 }],
        },
      },
      OpenEyes: {
        Type: "OpenEyes",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: null, Duration: -1 }],
          Eyes2: [{ Expression: null, Duration: -1 }],
        },
      },
      CloseEyes: {
        Type: "CloseEyes",
        Duration: -1,
        Expression: {
          Eyes: [{ Expression: "Closed", Duration: -1 }],
          Eyes2: [{ Expression: "Closed", Duration: -1 }],
        },
      },
      CloseMouth: {
        Type: "CloseMouth",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: null, Duration: -1 }],
        },
      },
      OpenMouth: {
        Type: "OpenMouth",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "Moan", Duration: -1 }],
        },
      },
      LipBite: {
        Type: "LipBite",
        Duration: -1,
        Expression: {
          Mouth: [{ Expression: "LipBite", Duration: -1 }],
        },
      },
      Lick: {
        Type: "Lick",
        Duration: 4000,
        Priority: 200,
        Expression: {
          Mouth: [{ Expression: "Ahegao", Duration: 4000 }],
          Blush: [{ ExpressionModifier: 1, Duration: 4000 }],
        },
      },
      GagInflate: {
        Type: "GagInflate",
        Duration: 4000,
        Priority: 400,
        Expression: {
          Eyes: [{ Expression: "Lewd", Duration: 4000 }],
          Eyes2: [{ Expression: "Lewd", Duration: 4000 }],
          Blush: [
            { ExpressionModifier: 2, Duration: 2000 },
            { ExpressionModifier: -1, Duration: 2000 },
          ],
        },
      },
      Iced: {
        Type: "Iced",
        Duration: 4000,
        Priority: 500,
        Expression: {
          Eyes: [
            { Expression: "Surprised", Duration: 3000 },
            { Expression: null, Duration: 1000 },
          ],
          Eyes2: [
            { Expression: "Surprised", Duration: 3000 },
            { Expression: null, Duration: 1000 },
          ],
          Mouth: [{ Expression: "Angry", Duration: 4000 }],
        },
      },
      AllFours: {
        Type: "AllFours",
        Duration: -1,
        Poses: [{ Pose: ["AllFours"], Duration: -1 }],
      },
      SpreadKnees: {
        Type: "SpreadKnees",
        Duration: -1,
        Poses: [{ Pose: ["KneelingSpread"], Duration: -1 }],
      },
      Hogtied: {
        Type: "Hogtied",
        Duration: -1,
        Poses: [{ Pose: ["Hogtied"], Duration: -1 }],
      },
      Handstand: {
        Type: "Handstand",
        Duration: -1,
        Poses: [{ Pose: ["Suspension", "OverTheHead"], Duration: -1 }],
      },
      Stretch: {
        Type: "Stretch",
        Priority: 100,
        Duration: 6000,
        Poses: [
          { Pose: ["OverTheHead"], Duration: 1000 },
          { Pose: ["Yoked"], Duration: 1000 },
          { Pose: ["BaseUpper"], Duration: 1000 },
          { Pose: ["Spread"], Duration: 1000 },
          { Pose: ["LegsClosed"], Duration: 1000 },
          { Pose: ["BaseLower"], Duration: 1000 },
        ],
      },
      SpreadLegs: {
        Type: "SpreadLegs",
        Duration: -1,
        Poses: [{ Pose: ["Spread"], Duration: -1 }],
      },
      JumpingJacks: {
        Type: "JumpingJacks",
        Priority: 100,
        Duration: 8000,
        Poses: [
          { Pose: ["OverTheHead", "Spread"], Duration: 1000 },
          { Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
          { Pose: ["OverTheHead", "Spread"], Duration: 1000 },
          { Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
          { Pose: ["OverTheHead", "Spread"], Duration: 1000 },
          { Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
          { Pose: ["OverTheHead", "Spread"], Duration: 1000 },
          { Pose: ["BaseUpper", "LegsClosed"], Duration: 1000 },
        ],
      },
    };
  }

  if (!window.bce_ActivityTriggers) {
    // eslint-disable-next-line camelcase
    window.bce_ActivityTriggers = [
      {
        Event: "Blush",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-ItemMouth-PoliteKiss$/u,
          },
        ],
      },
      {
        Event: "Stretch",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^stretches (her|his|their) whole body/u,
          },
        ],
      },
      {
        Event: "JumpingJacks",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^does jumping[ -]?jacks/u,
          },
        ],
      },
      {
        Event: "AllFours",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(gets on all fours|starts crawling)/u,
          },
        ],
      },
      {
        Event: "SpreadKnees",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^spreads(( (her|his|their) legs)? on)? (her|his|their) knees/u,
          },
        ],
      },
      {
        Event: "SpreadLegs",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^spreads (her|his|their) legs apart/u,
          },
        ],
      },
      {
        Event: "Handstand",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(does a handstand|stands on (her|his|their) hands)/u,
          },
        ],
      },
      {
        Event: "Hogtied",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^lies( down)? on (the floor|(her|his|their) (tummy|stomach))/u,
          },
        ],
      },
      {
        Event: "Blush",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^blushes/u,
          },
        ],
      },
      {
        Event: "Chuckle",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^chuckles/u,
          },
        ],
      },
      {
        Event: "Laugh",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^laughs/u,
          },
        ],
      },
      {
        Event: "Giggle",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^giggles/u,
          },
        ],
      },
      {
        Event: "Smirk",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(smirk(s|ing)|.*with a smirk)/u,
          },
        ],
      },
      {
        Event: "Wink",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^winks/u,
          },
        ],
      },
      {
        Event: "Pout",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^pouts/u,
          },
        ],
      },
      {
        Event: "Blink",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^blinks/u,
          },
        ],
      },
      {
        Event: "Frown",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^frowns/u,
          },
        ],
      },
      {
        Event: "Grin",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(grins|is grinning)/u,
          },
        ],
      },
      {
        Event: "Confused",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^((seems|looks) (confused|curious|suspicious)|raises an eyebrow)/u,
          },
        ],
      },
      {
        Event: "CloseMouth",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^closes (her|his|their) mouth/u,
          },
        ],
      },
      {
        Event: "OpenMouth",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^opens (her|his|their) mouth/u,
          },
        ],
      },
      {
        Event: "Happy",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(looks|seems|is|gets|smiles) happ(il)?y/u,
          },
        ],
      },
      {
        Event: "Smile",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^smiles/u,
          },
        ],
      },
      {
        Event: "Distressed",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(looks|seems|is|gets) distressed/u,
          },
        ],
      },
      {
        Event: "Sad",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(looks|seems|is|gets) sad/u,
          },
        ],
      },
      {
        Event: "Worried",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(looks|seems|is|gets) (worried|surprised)/u,
          },
        ],
      },
      {
        Event: "BareTeeth",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(bares (her|his|their) teeth|snarls)/u,
          },
        ],
      },
      {
        Event: "Angry",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(looks angr(il)?y|(gets|is|seems) angry)/u,
          },
        ],
      },
      {
        Event: "Glare",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(glares|looks harshly|gives a (glare|harsh look))/u,
          },
        ],
      },
      {
        Event: "OpenEyes",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^opens (her|his|their) eyes/u,
          },
        ],
      },
      {
        Event: "NarrowEyes",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^((squints|narrows) (her|his|their) eyes|narrowly opens (her|his|their) eyes)/u,
          },
        ],
      },
      {
        Event: "CloseEyes",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^closes (her|his|their) eyes/u,
          },
        ],
      },
      {
        Event: "ResetBrows",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^lowers (her|his|their) eyebrows/u,
          },
        ],
      },
      {
        Event: "RaiseBrows",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^raises (her|his|their) eyebrows/u,
          },
        ],
      },
      {
        Event: "DroolSides",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^drools/u,
          },
        ],
      },
      {
        Event: "Cry",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^(starts to cry|sheds .* tears?|eyes( start( to)?)? leak)/u,
          },
        ],
      },
      {
        Event: "Reset",
        Type: "Emote",
        Matchers: [
          {
            Tester: /^'s (expression|face) returns to normal/u,
          },
        ],
      },
      {
        Event: "Shock",
        Type: "Action",
        Matchers: [
          {
            Tester:
              /^(ActionActivityShockItem|FuturisticVibratorShockTrigger|FuturisticChastityBeltShock\w+|(TriggerShock|(ShockCollar|Collar(Auto)?ShockUnit|(LoveChastityBelt|SciFiPleasurePanties)Shock)Trigger)(1|2))$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
        ],
      },
      {
        Event: "ShockLight",
        Type: "Action",
        Matchers: [
          {
            Tester:
              /^(TriggerShock|(ShockCollar|Collar(Auto)?ShockUnit|(LoveChastityBelt|SciFiPleasurePanties)Shock)Trigger)0$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
        ],
      },
      {
        Event: "Hit",
        Type: "Action",
        Matchers: [
          {
            Tester: /^ActionActivitySpankItem$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
        ],
      },
      {
        Event: "Spank",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-ItemButt-Spank$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
          {
            Tester: /^ChatSelf-ItemButt-Spank$/u,
          },
        ],
      },
      {
        Event: "Cuddle",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-.*-Cuddle$/u,
          },
          {
            Tester: /^ChatSelf-.*-Cuddle$/u,
          },
        ],
      },
      {
        Event: "Stimulated",
        Type: "Action",
        Matchers: [
          {
            Tester: /^ActionActivityMasturbateItem$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
        ],
      },
      {
        Event: "StimulatedLong",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-.*-(Masturbate|Penetrate).*$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
          {
            Tester: /^ChatSelf-.*-(Masturbate|Penetrate).*$/u,
          },
        ],
      },
      {
        Event: "KissOnLips",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-ItemMouth-Kiss$/u,
          },
        ],
      },
      {
        Event: "Kiss",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-.*-Kiss$/u,
            Criteria: {
              SenderIsPlayer: true,
            },
          },
        ],
      },
      {
        Event: "Disoriented",
        Type: "Action",
        Matchers: [
          {
            Tester: /^(KneelDown|StandUp)Fail$/u,
          },
        ],
      },
      {
        Event: "LipBite",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatSelf-ItemMouth-Bite$/u,
          },
        ],
      },
      {
        Event: "Lick",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-.*-(Lick|MasturbateTongue)$/u,
            Criteria: {
              SenderIsPlayer: true,
            },
          },
        ],
      },
      {
        Event: "DroolReset",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-ItemMouth-Caress$/u,
            Criteria: {
              TargetIsPlayer: true,
            },
          },
          {
            Tester: /^ChatSelf-ItemMouth-Caress$/u,
          },
        ],
      },
      {
        Event: "LongKiss",
        Type: "Activity",
        Matchers: [
          {
            Tester: /^ChatOther-ItemMouth-FrenchKiss$/u,
          },
        ],
      },
    ];
  }

  /** @type {(dict?: ChatMessageDictionary) => boolean} */
  function dictHasPlayerTarget(dict) {
    return dict?.some((t) => t && "TargetCharacter" in t && t.TargetCharacter === Player.MemberNumber) || false;
  }

  registerSocketListener("ChatRoomMessage", (data) => {
    activityTriggers: for (const trigger of window.bce_ActivityTriggers.filter((t) => t.Type === data.Type)) {
      for (const matcher of trigger.Matchers) {
        if (matcher.Tester.test(data.Content)) {
          if (matcher.Criteria) {
            if (matcher.Criteria.SenderIsPlayer && data.Sender !== Player.MemberNumber) {
              continue;
            } else if (matcher.Criteria.TargetIsPlayer && !dictHasPlayerTarget(data.Dictionary)) {
              continue;
            } else if (
              matcher.Criteria.DictionaryMatchers &&
              !matcher.Criteria.DictionaryMatchers.some((m) =>
                data.Dictionary?.find((t) =>
                  // @ts-ignore - intentional dynamic indexing on statically defined types
                  Object.keys(m).every((k) => m[k] === t[k])
                )
              )
            ) {
              continue;
            }
            // Criteria met
            pushEvent(window.bce_EventExpressions[trigger.Event]);
          } else if (data.Sender === Player.MemberNumber || dictHasPlayerTarget(data.Dictionary)) {
            // Lacking criteria, check for presence of player as source or target
            pushEvent(window.bce_EventExpressions[trigger.Event]);
            break activityTriggers;
          }
        }
      }
    }
  });

  /** @type {(faceComponent: string) => [ExpressionName, boolean]} */
  function expression(t) {
    const properties = Player.Appearance.filter((a) => a.Asset.Group.Name === t)[0]?.Property ?? null;
    return [properties?.Expression || null, !properties?.RemoveTimer];
  }

  /** @type {(faceComponent: string, newExpression: ExpressionName, color?: string | string[]) => void} */
  function setExpression(t, n, color) {
    if (!n) {
      n = null;
    }
    for (let i = 0; i < Player.Appearance.length; i++) {
      const appearance = Player.Appearance[i];
      if (appearance.Asset.Group.Name === t) {
        if (!appearance.Property) {
          appearance.Property = {};
        }
        appearance.Property.Expression = n;
        if (color) {
          Player.Appearance[i].Color = color;
        }
        break;
      }
    }
  }

  const poseCategories = /** @type {const} */ ({
    BodyFull: {
      Conflicts: ["BodyUpper", "BodyLower"],
    },
    BodyUpper: {
      Conflicts: ["BodyFull"],
    },
    BodyLower: {
      Conflicts: ["BodyFull"],
    },
  });

  /**
   * @param {unknown} pose
   * @returns {pose is keyof typeof poseCategories}
   */
  function hasConflicts(pose) {
    return isString(pose) && pose in poseCategories;
  }

  const faceComponents = ["Eyes", "Eyes2", "Eyebrows", "Mouth", "Fluids", "Emoticon", "Blush", "Pussy"];

  // When first initializing, set the current face as manual override
  pushEvent({
    Type: MANUAL_OVERRIDE_EVENT_TYPE,
    Duration: -1,
    Expression: faceComponents
      .map((t) => {
        const [expr] = expression(t);
        return [t, expr];
      })
      .filter((v) => v[1] !== null)
      .map((v) => [v[0], [{ Expression: v[1] }]])
      .reduce((a, v) => ({ ...a, [/** @type {string} */ (v[0])]: v[1] }), {}),
  });

  let lastOrgasm = 0,
    orgasmCount = 0,
    wasDefault = false;

  let PreviousArousal = Player.ArousalSettings;

  const ArousalMeterDirection = {
    None: 0,
    Down: 1,
    Up: 2,
  };
  let PreviousDirection = ArousalMeterDirection.Up;

  /**
   * @param {string[]} types Types to reset
   * @param {string[]} skippedTypes Types to skip resetting in addition to automated arousal events
   */
  function resetExpressionQueue(types, skippedTypes = []) {
    delete Player.ExpressionQueue;
    bceExpressionsQueue.push(
      ...bceExpressionsQueue.splice(0, bceExpressionsQueue.length).map((e) => {
        if (
          types.includes(e.Type) ||
          (e.Duration <= 0 && e.Type !== AUTOMATED_AROUSAL_EVENT_TYPE && !skippedTypes.includes(e.Type))
        ) {
          delete e.Expression;
        }
        return e;
      })
    );
    // Restore manual overrides, if manual not in types
    if (!types.includes(MANUAL_OVERRIDE_EVENT_TYPE)) {
      pushEvent({
        Type: MANUAL_OVERRIDE_EVENT_TYPE,
        Duration: -1,
        Expression: objEntries(manualComponents).reduce((a, [k, v]) => ({ ...a, [k]: [{ Expression: v }] }), {}),
      });
    } else {
      for (const [k] of objEntries(manualComponents)) {
        delete manualComponents[k];
      }
    }
  }

  Commands.push({
    Tag: "r",
    Description: displayText("[part of face or 'all']: resets expression overrides on part of or all of face"),
    Action: (args) => {
      if (args.length === 0 || args === "all") {
        resetExpressionQueue([MANUAL_OVERRIDE_EVENT_TYPE]);
        fbcChatNotify(displayText("Reset all expressions"));
      } else {
        const component = `${args[0].toUpperCase()}${args.substring(1).toLowerCase()}`;
        for (const e of bceExpressionsQueue.map((a) => a.Expression).filter(Boolean)) {
          if (component === "Eyes" && "Eyes2" in e) {
            delete e.Eyes2;
          }
          if (component in e) {
            delete e[component];
          }
        }
        fbcChatNotify(
          displayText(`Reset expression on $component`, {
            $component: component,
          })
        );
      }
    },
  });

  Commands.push({
    Tag: "anim",
    Description: displayText("['list' or name of emote]: run an animation"),
    Action: (_1, _2, args) => {
      if (!fbcSettings.activityExpressions) {
        fbcChatNotify(displayText("Activity expressions are not enabled in WCE settings. Unable to run animations."));
        return;
      }
      if (args[0] === "list") {
        fbcChatNotify(
          displayText(`Available animations: $anims`, {
            $anims: Object.keys(window.bce_EventExpressions).join(", "),
          })
        );
      }
      const animation = Object.keys(window.bce_EventExpressions).find(
        (a) => a.toLowerCase() === args[0]?.toLowerCase()
      );
      if (animation) {
        pushEvent(window.bce_EventExpressions[animation]);
      }
    },
  });

  /**
   * @param {AssetPoseName} pose
   */
  function getPoseCategory(pose) {
    return PoseFemale3DCG.find((a) => a.Name === pose)?.Category;
  }

  /**
   * @param {readonly string[]} poses
   */
  function setPoses(poses) {
    poses = poses.filter((p) => p).map((p) => p.toLowerCase());
    bceExpressionsQueue.forEach((e) => {
      if (e.Type === MANUAL_OVERRIDE_EVENT_TYPE) {
        e.Poses = [];
      } else if (e.Poses && e.Poses.length > 0) {
        e.Poses.forEach((p) => {
          if (p.Pose.length === 0) {
            return;
          }
          if (typeof p.Pose[0] === "string") {
            return;
          }
          const poseList = p.Pose;
          p.Pose = poseList.filter((pp) => !!getPoseCategory(pp));
        });
      }
    });
    const poseNames = PoseFemale3DCG.filter((p) => poses.includes(p.Name.toLowerCase())).map((p) => p.Name);
    for (const poseName of poseNames) {
      PoseSetActive(Player, poseName, false);
    }
  }

  Commands.push({
    Tag: "pose",
    Description: displayText("['list' or list of poses]: set your pose"),
    Action: (_1, _2, poses) => {
      if (poses[0] === "list") {
        const categories = [...new Set(PoseFemale3DCG.map((a) => a.Category))];
        for (const category of categories) {
          const list = PoseFemale3DCG.filter((a) => a.Category === category)?.map((a) => a.Name);
          list.sort();
          fbcChatNotify(`=> ${category}:\n${list.join("\n")}\n\n`);
        }
        return;
      }
      if (!fbcSettings.animationEngine) {
        fbcChatNotify(
          displayText(
            "Warning: animation engine in WCE is disabled. Pose may not be synchronized or set. Enable animation engine in WCE settings."
          )
        );
      }
      setPoses(poses);
    },
  });

  patchFunction(
    "TimerInventoryRemove",
    {
      "CharacterSetFacialExpression(C, C.ExpressionQueue[0].Group, C.ExpressionQueue[0].Expression, undefined, undefined, true);": `if (bceAnimationEngineEnabled()) {
        fbcPushEvent({
          Type: "${GAME_TIMED_EVENT_TYPE}",
          Duration: -1,
          Expression: {
            [C.ExpressionQueue[0].Group]: [{ Expression: C.ExpressionQueue[0].Expression, Duration: -1 }]
          }
        })
      } else {
        CharacterSetFacialExpression(C, C.ExpressionQueue[0].Group, C.ExpressionQueue[0].Expression, undefined, undefined, true);
      }`,
    },
    "Game's timed expressions are not hooked to WCE's animation engine"
  );

  patchFunction(
    "ValidationSanitizeProperties",
    {
      "delete property.Expression;": `delete property.Expression;
      if (bceAnimationEngineEnabled()) {
        if (item?.Asset?.Group?.Name) {
          CharacterSetFacialExpression(C, item.Asset.Group.Name, null);
          console.warn("(WCE) Animation engine acknowledged validation-based expression removal for face component", item)
        } else {
          console.warn("Unable to determine asset group name for item", item);
        }
      }`,
    },
    "Prevent animation engine from getting into an endless loop when another addon includes an invalid expression"
  );

  SDK.hookFunction(
    "CharacterSetFacialExpression",
    HOOK_PRIORITIES.OverrideBehaviour,
    (args, next) => {
      // eslint-disable-next-line prefer-const
      let [C, AssetGroup, Expression, Timer, Color] = args;
      if (
        !isCharacter(C) ||
        !isString(AssetGroup) ||
        (!isString(Expression) && Expression !== null) ||
        !C.IsPlayer() ||
        !fbcSettings.animationEngine
      ) {
        return next(args);
      }

      const duration = typeof Timer === "number" && Timer > 0 ? Timer * 1000 : -1,
        /** @type {Record<string, ExpressionStage[]>} */
        e = {};
      /** @type {(keyof typeof manualComponents)[]} */
      let types = [];

      if (AssetGroup === "Eyes") {
        types = ["Eyes", "Eyes2"];
      } else if (AssetGroup === "Eyes1") {
        types = ["Eyes"];
      } else {
        types = [AssetGroup];
      }

      if (!Color || !isStringOrStringArray(Color) || !CommonColorIsValid(Color)) {
        // eslint-disable-next-line no-undefined
        Color = undefined;
      }

      for (const t of types) {
        e[t] = [{ Expression, Duration: duration, Color }];
        if (duration < 0) {
          manualComponents[t] = Expression;
        }
      }

      const evt = {
        Type: MANUAL_OVERRIDE_EVENT_TYPE,
        Duration: duration,
        Expression: e,
      };
      pushEvent(evt);
      return CustomArousalExpression();
    }
  );

  const poseFuncs = /** @type {const} */ (["CharacterSetActivePose", "PoseSetActive"]);
  for (const poseFunc of poseFuncs) {
    SDK.hookFunction(
      poseFunc,
      HOOK_PRIORITIES.OverrideBehaviour,
      (args, next) => {
        const [C, Pose] = args;
        if (
          !isCharacter(C) ||
          (!isStringOrStringArray(Pose) && Pose !== null) ||
          !C.IsPlayer() ||
          !fbcSettings.animationEngine
        ) {
          return next(args);
        }

        const p = {};
        if (!Pose || (Array.isArray(Pose) && Pose.every((pp) => !pp))) {
          p.Pose = /** @type {AssetPoseName[]} */ (["BaseUpper", "BaseLower"]);
        } else {
          p.Pose = [Pose];
        }
        p.Duration = -1;
        const evt = {
          Type: MANUAL_OVERRIDE_EVENT_TYPE,
          Duration: -1,
          Poses: [p],
        };
        pushEvent(evt);
        return CustomArousalExpression();
      }
    );
  }

  registerSocketListener("ChatRoomSyncPose", (data) => {
    if (data === null || !isNonNullObject(data)) {
      return;
    }
    if (!Array.isArray(data.Pose)) {
      logWarn(`data.Pose in ChatRoomSyncPose for ${data.MemberNumber?.toString()} is not an array`);
      return;
    }
    if (!fbcSettings.animationEngine) {
      return;
    }
    if (data.MemberNumber === Player.MemberNumber) {
      setPoses(data.Pose);
    }
  });

  registerSocketListener("ChatRoomSyncSingle", (data) => {
    if (data === null || !isNonNullObject(data)) {
      return;
    }
    if (!fbcSettings.animationEngine) {
      return;
    }
    if (data.Character?.MemberNumber === Player.MemberNumber) {
      setPoses(data.Character.ActivePose ?? []);
    }
  });

  resetExpressionQueue([MANUAL_OVERRIDE_EVENT_TYPE, GAME_TIMED_EVENT_TYPE]);

  // This is called once per interval to check for expression changes
  // eslint-disable-next-line complexity
  function CustomArousalExpression() {
    if (!fbcSettings.animationEngine || !Player?.AppearanceLayers) {
      return;
    }

    // Ensure none of the expressions have remove timers on them; we handle timers here
    Player.Appearance.filter((a) => faceComponents.includes(a.Asset.Group.Name) && a.Property?.RemoveTimer).forEach(
      (a) => {
        // @ts-ignore - a.Property cannot be undefined due to filter above
        delete a.Property.RemoveTimer;
      }
    );

    if (!Player.ArousalSettings) {
      logWarn("Player.ArousalSettings is not defined");
      return;
    }

    Player.ArousalSettings.AffectExpression = false;

    const oCount = Player.ArousalSettings.OrgasmCount ?? 0;
    if (orgasmCount < oCount) {
      orgasmCount = oCount;
    } else if (orgasmCount > oCount) {
      Player.ArousalSettings.OrgasmCount = orgasmCount;
      ActivityChatRoomArousalSync(Player);
    }

    // Reset everything when face is fully default
    let isDefault = true;
    for (const t of faceComponents) {
      if (expression(t)[0]) {
        isDefault = false;
      }
    }
    if (isDefault) {
      PreviousArousal.Progress = 0;
      PreviousDirection = ArousalMeterDirection.Up;
      if (!wasDefault) {
        for (let i = 0; i < bceExpressionsQueue.length; i++) {
          if (bceExpressionsQueue[i].Type === AUTOMATED_AROUSAL_EVENT_TYPE) {
            continue;
          }
          bceExpressionsQueue[i].Expression = {};
        }
      }
      wasDefault = true;
    } else {
      wasDefault = false;
    }

    // Detect arousal movement
    const arousal = Player.ArousalSettings.Progress;
    let direction = PreviousDirection;
    if (arousal < PreviousArousal.Progress) {
      direction = ArousalMeterDirection.Down;
    } else if (arousal > PreviousArousal.Progress) {
      direction = ArousalMeterDirection.Up;
    }
    PreviousDirection = direction;

    const lastOrgasmAdjustment = () => {
      // Only boost up to the expression at arousal 90
      const lastOrgasmMaxArousal = 90,
        lastOrgasmMaxBoost = 30,
        orgasms = Player.ArousalSettings?.OrgasmCount || 0;
      const lastOrgasmBoostDuration = Math.min(300, 60 + orgasms * 5),
        secondsSinceOrgasm = ((Date.now() - lastOrgasm) / 10000) | 0;
      if (secondsSinceOrgasm > lastOrgasmBoostDuration) {
        return 0;
      }
      return Math.min(
        Math.max(0, lastOrgasmMaxArousal - arousal),
        (lastOrgasmMaxBoost * (lastOrgasmBoostDuration - secondsSinceOrgasm)) / lastOrgasmBoostDuration
      );
    };

    // Handle events
    const OrgasmRecoveryStage = 2;
    if (
      PreviousArousal.OrgasmStage !== OrgasmRecoveryStage &&
      Player.ArousalSettings.OrgasmStage === OrgasmRecoveryStage &&
      bceExpressionsQueue.filter((a) => a.Type === POST_ORGASM_EVENT_TYPE).length === 0
    ) {
      pushEvent(window.bce_EventExpressions.PostOrgasm);
      lastOrgasm = Date.now();
    }

    // Keep track of desired changes
    /** @type {{ [key: string]: ExpressionStage }} */
    const desiredExpression = {};

    /** @type {Record<string, { Id: number; Pose: AssetPoseName; Category?: string; Duration: number; Priority: number; Type: string }>} */
    let desiredPose = {};

    /** @type {{ [key: string]: ExpressionStage }} */
    const nextExpression = {};

    /** @type {(expression: ExpressionName, stage: ExpressionStage, next: ExpressionEvent, faceComponent: string) => void} */
    const trySetNextExpression = (e, exp, next, t) => {
      const priority = exp.Priority || next.Priority || 0;
      if (!nextExpression[t] || (nextExpression[t].Priority ?? 0) <= priority) {
        nextExpression[t] = {
          Id: exp.Id,
          Expression: e,
          Duration: exp.Duration,
          Priority: priority,
          Color: exp.Color,
        };
      }
    };

    // Calculate next expression
    for (let j = 0; j < bceExpressionsQueue.length; j++) {
      const next = bceExpressionsQueue[j];
      const nextUntil = next.Until ?? 0;
      const nextAt = next.At ?? 0;
      let active = false;
      if (nextUntil > Date.now() || nextUntil - nextAt < 0) {
        const nextExpr = next.Expression ?? {};
        if (Object.keys(nextExpr).length > 0) {
          for (const t of Object.keys(nextExpr)) {
            let durationNow = Date.now() - nextAt;
            for (let i = 0; i < nextExpr[t].length; i++) {
              /** @type {ExpressionStage} */
              const exp = nextExpr[t][i];
              durationNow -= exp.Duration;
              if (durationNow < 0 || exp.Duration < 0) {
                active = true;
                if (!exp.Skip) {
                  if (exp.ExpressionModifier && t in bceExpressionModifierMap) {
                    const [current] = expression(t);
                    if (!exp.Applied) {
                      /** @type {number} */
                      let idx = bceExpressionModifierMap[t].indexOf(current) + exp.ExpressionModifier;
                      if (idx >= bceExpressionModifierMap[t].length) {
                        idx = bceExpressionModifierMap[t].length - 1;
                      } else if (idx < 0) {
                        idx = 0;
                      }
                      trySetNextExpression(bceExpressionModifierMap[t][idx], exp, next, t);
                      // @ts-ignore - not undefined, ts is a derp
                      bceExpressionsQueue[j].Expression[t][i].Applied = true;
                    } else {
                      // Prevent being overridden by other expressions while also not applying a change
                      trySetNextExpression(current, exp, next, t);
                    }
                  } else {
                    trySetNextExpression(exp.Expression ?? null, exp, next, t);
                  }
                }
                break;
              }
            }
          }
        }
        if (next.Poses?.length) {
          let durationNow = Date.now() - nextAt;
          for (const pose of next.Poses) {
            durationNow -= pose.Duration;
            if (durationNow < 0 || pose.Duration < 0) {
              active = true;
              for (const p of pose.Pose) {
                const priority = pose.Priority || next.Priority || 0;
                const category = getPoseCategory(p);
                if (!category) {
                  logWarn(`Pose ${p} has no category`);
                  continue;
                }

                if (!pose.Id) {
                  logWarn(`Pose ${p} has no ID`);
                  pose.Id = newUniqueId();
                }

                if (!desiredPose[category] || desiredPose[category].Priority <= priority) {
                  desiredPose[category] = {
                    Id: pose.Id,
                    Pose: p,
                    Category: category,
                    Duration: pose.Duration,
                    Priority: priority,
                    Type: next.Type,
                  };
                }
              }
              break;
            }
          }
        }
      }
      if (!active) {
        const last = bceExpressionsQueue.splice(j, 1);
        j--;
        if (!fbcSettings.expressions && last.length > 0 && last[0].Expression) {
          for (const t of Object.keys(last[0].Expression)) {
            trySetNextExpression(
              null,
              { Duration: -1 },
              {
                Priority: 0,
                Type: DEFAULT_EVENT_TYPE,
                Duration: 500,
              },
              t
            );
          }
        }
      }
    }

    // Garbage collect unused expressions - this should occur before manual expressions are detected
    for (let j = 0; j < bceExpressionsQueue.length; j++) {
      const qExpr = bceExpressionsQueue[j].Expression;
      const qPoses = bceExpressionsQueue[j].Poses;
      if (qExpr) {
        for (const t of Object.keys(qExpr)) {
          if (!nextExpression[t] || nextExpression[t].Duration > 0) {
            continue;
          }
          const nextId = mustNum(nextExpression[t].Id),
            nextPriority = mustNum(nextExpression[t].Priority, 0);

          for (let i = 0; i < qExpr[t].length; i++) {
            const exp = qExpr[t][i];
            if (exp.Duration < 0 && (mustNum(exp.Id) < nextId || mustNum(exp.Priority, 0) < nextPriority)) {
              qExpr[t].splice(i, 1);
              i--;
            }
          }
          if (qExpr[t].length === 0) {
            delete qExpr[t];
          }
        }
      }
      if (qPoses) {
        for (let k = 0; k < qPoses.length; k++) {
          const pose = qPoses[k];
          const poseList = pose.Pose;
          const desiredIsNewerAndInfinite = poseList.every(
            // eslint-disable-next-line no-loop-func
            (p) => {
              const category = getPoseCategory(p);
              return (
                !!category &&
                desiredPose[category]?.Duration < 0 &&
                desiredPose[category]?.Id > mustNum(pose.Id) &&
                (desiredPose[category]?.Type === MANUAL_OVERRIDE_EVENT_TYPE ||
                  bceExpressionsQueue[j].Type !== MANUAL_OVERRIDE_EVENT_TYPE)
              );
            }
          );
          if (pose.Duration < 0 && desiredIsNewerAndInfinite) {
            qPoses.splice(k, 1);
            k--;
          }
        }
      }
      if (
        Object.keys(bceExpressionsQueue[j].Expression || {}).length === 0 &&
        bceExpressionsQueue[j].Poses?.length === 0
      ) {
        bceExpressionsQueue.splice(j, 1);
        j--;
      }
    }

    // Clean up unused poses
    let needsRefresh = false;
    /** @type {false | AssetPoseName[]} */
    let poseUpdate = false;
    if (Player.ActivePose) {
      for (let i = 0; i < Player.ActivePose.length; i++) {
        const pose = Player.ActivePose[i];
        const p = PoseFemale3DCG.find((pp) => pp.Name === pose);
        if (!p?.Category && Object.values(desiredPose).every((v) => v.Pose !== pose)) {
          poseUpdate = [...Player.ActivePose];
          poseUpdate.splice(i, 1);
          i--;
          needsRefresh = true;
        }
      }
    }

    // Handle arousal-based expressions
    outer: for (const t of Object.keys(window.bce_ArousalExpressionStages)) {
      const [exp] = expression(t);
      /** @type {ExpressionName} */
      let chosenExpression = null;
      let expressionChosen = false;
      for (const face of window.bce_ArousalExpressionStages[t]) {
        const limit = face.Limit - (direction === ArousalMeterDirection.Up ? 0 : 1);
        if (arousal + lastOrgasmAdjustment() >= limit) {
          if (face.Expression !== exp) {
            chosenExpression = face.Expression;
            expressionChosen = true;
            break;
          } else {
            continue outer;
          }
        }
      }
      if (expressionChosen) {
        /** @type {ExpressionStages} */
        const e = {};
        e[t] = [{ Expression: chosenExpression, Duration: -1, Priority: 0 }];
        pushEvent({
          Type: AUTOMATED_AROUSAL_EVENT_TYPE,
          Duration: -1,
          Priority: 0,
          // @ts-ignore
          Expression: e,
        });
      }
    }

    for (const t of faceComponents) {
      const [exp] = expression(t),
        nextExp = nextExpression[t] || {
          Duration: -1,
          Expression: null,
        };
      if (nextExp.Expression !== exp && typeof nextExp.Expression !== "undefined") {
        desiredExpression[t] = { ...nextExp };
      }
    }

    if (Object.keys(desiredExpression).length > 0) {
      for (const t of Object.keys(desiredExpression)) {
        if (BCX?.getRuleState("block_changing_emoticon")?.isEnforced && t === "Emoticon") {
          continue;
        }
        setExpression(t, desiredExpression[t].Expression ?? null, desiredExpression[t].Color);
        ServerSend("ChatRoomCharacterExpressionUpdate", {
          // @ts-ignore - null is a valid name, mistake in BC-stubs
          Name: desiredExpression[t].Expression ?? null,
          Group: t,
          Appearance: ServerAppearanceBundle(Player.Appearance),
        });
      }

      needsRefresh = true;
    }

    // Figure out desiredPose conflicts
    function resolvePoseConflicts() {
      const maxPriority = Math.max(...Object.values(desiredPose).map((p) => p.Priority));

      const maxPriorityPoses = objEntries(desiredPose).filter((p) => p[1].Priority === maxPriority);

      let maxPriorityPose = "";

      if (maxPriorityPoses.length > 1) {
        const maxId = Math.max(...maxPriorityPoses.map((p) => p[1].Id)),
          maxIdPoses = maxPriorityPoses.filter((p) => p[1].Id === maxId);
        [[maxPriorityPose]] = maxIdPoses;
      } else if (maxPriorityPoses.length === 0) {
        return 0;
      } else {
        [[maxPriorityPose]] = maxPriorityPoses;
      }
      let deleted = 0;
      if (hasConflicts(maxPriorityPose)) {
        const conflicts = poseCategories[maxPriorityPose].Conflicts || [];
        for (const conflict of Array.from(conflicts).filter((c) => c in desiredPose)) {
          delete desiredPose[conflict];
          deleted++;
        }
      }
      return deleted;
    }
    while (resolvePoseConflicts() > 0) {
      // Intentionally empty
    }

    if (Object.keys(desiredPose).length === 0) {
      desiredPose = {
        BodyUpper: {
          Pose: "BaseUpper",
          Duration: -1,
          Id: newUniqueId(),
          Priority: 0,
          Type: DEFAULT_EVENT_TYPE,
        },
        BodyLower: {
          Pose: "BaseLower",
          Duration: -1,
          Id: newUniqueId(),
          Priority: 0,
          Type: DEFAULT_EVENT_TYPE,
        },
      };
    }
    const basePoseMatcher = /^Base(Lower|Upper)$/u;
    const newPose = Object.values(desiredPose)
      .map((p) => p.Pose)
      .filter((p) => !basePoseMatcher.test(p));
    if (JSON.stringify(Player.ActivePose) !== JSON.stringify(newPose)) {
      poseUpdate = newPose;
      needsRefresh = true;
    }

    if (poseUpdate) {
      Player.ActivePose = poseUpdate;
      ServerSend("ChatRoomCharacterPoseUpdate", {
        Pose: poseUpdate,
      });
    }

    if (needsRefresh) {
      CharacterRefresh(Player, false, false);
    }

    PreviousArousal = { ...Player.ArousalSettings };
  }

  createTimer(CustomArousalExpression, 250);
}
