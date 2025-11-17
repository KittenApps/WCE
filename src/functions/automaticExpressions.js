import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { BCXgetRuleState } from "./hookBcx";
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
import { ActivityTriggers, ArousalExpressionStages, EventExpressions } from "../util/expressions";

export default async function automaticExpressions() {
  await waitFor(() => CurrentScreen === "ChatRoom" && !!Player.ArousalSettings);
  if (!Player.ArousalSettings) {
    throw new Error("Player.ArousalSettings is not defined");
  }

  patchFunction(
    "StruggleMinigameHandleExpression",
    { '");': '", 3);' },
    "Resetting blush, eyes, and eyebrows after struggling"
  );

  /**
   * @returns {boolean}
   */
  function animationEngineEnabled() {
    return fbcSettings.animationEngine ?? false;
  }
  globalThis.bceAnimationEngineEnabled = animationEngineEnabled;

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

  if (!globalThis.bce_ArousalExpressionStages) globalThis.bce_ArousalExpressionStages = ArousalExpressionStages;

  /** @type {{[key: string]: ExpressionName[]}} */
  const bceExpressionModifierMap = Object.freeze({ Blush: [null, "Low", "Medium", "High", "VeryHigh", "Extreme"] });

  const AUTOMATED_AROUSAL_EVENT_TYPE = "AutomatedByArousal",
    DEFAULT_EVENT_TYPE = "DEFAULT",
    GAME_TIMED_EVENT_TYPE = "GameTimer",
    MANUAL_OVERRIDE_EVENT_TYPE = "ManualOverride",
    POST_ORGASM_EVENT_TYPE = "PostOrgasm";

  /** @type {ExpressionEvent[]} */
  const bceExpressionsQueue = [];
  let lastUniqueId = 0;

  /**
   * @returns {number}
   */
  function newUniqueId() {
    lastUniqueId = (lastUniqueId + 1) % (Number.MAX_SAFE_INTEGER - 1);
    return lastUniqueId;
  }

  /** @type {Partial<Record<'Eyes' | 'Eyes2' | 'Eyebrows' | 'Mouth' | 'Fluids' | 'Emoticon' | 'Blush' | 'Pussy', string | null>>} */
  const manualComponents = {};

  /**
   * @param {ExpressionEvent} evt
   * @returns {void}
   */
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
  globalThis.fbcPushEvent = pushEvent;

  if (!globalThis.bce_EventExpressions) globalThis.bce_EventExpressions = EventExpressions;
  if (!globalThis.bce_ActivityTriggers) globalThis.bce_ActivityTriggers = ActivityTriggers;

  /**
   * @param {ChatMessageDictionary} [dict]
   * @returns {boolean}
   */
  function dictHasPlayerTarget(dict) {
    return dict?.some(t => t && "TargetCharacter" in t && t.TargetCharacter === Player.MemberNumber) || false;
  }

  registerSocketListener(
    "ChatRoomMessage",
    /**
     * @param {ServerChatRoomMessage} data
     * @returns {void}
     */
    (data) => {
      activityTriggers: for (const trigger of globalThis.bce_ActivityTriggers.filter(t => t.Type === data.Type)) {
        for (const matcher of trigger.Matchers) {
          if (matcher.Tester.test(data.Content)) {
            if (matcher.Criteria) {
              if (matcher.Criteria.SenderIsPlayer && data.Sender !== Player.MemberNumber) {
                continue;
              } else if (matcher.Criteria.TargetIsPlayer && !dictHasPlayerTarget(data.Dictionary)) {
                continue;
              } else if (
                matcher.Criteria.DictionaryMatchers &&
                !matcher.Criteria.DictionaryMatchers.some(m => data.Dictionary?.find(t => Object.keys(m).every(k => m[k] === t[k])))
              ) {
                continue;
              }
              // Criteria met
              pushEvent(globalThis.bce_EventExpressions[trigger.Event]);
            } else if (data.Sender === Player.MemberNumber || dictHasPlayerTarget(data.Dictionary)) {
              // Lacking criteria, check for presence of player as source or target
              pushEvent(globalThis.bce_EventExpressions[trigger.Event]);
              break activityTriggers;
            }
          }
        }
      }
    }
  );

  /**
   * @param {string} t faceComponent
   * @returns {[ExpressionName, boolean]}
   */
  function expression(t) {
    const properties = Player.Appearance.find(a => a.Asset.Group.Name === t)?.Property ?? null;
    return [properties?.Expression || null, !properties?.RemoveTimer];
  }

  /**
   * @param {string} t faceComponent
   * @param {ExpressionName} n newExpression
   * @param {string | string[]} [color]
   * @returns {void}
   */
  function setExpression(t, n, color) {
    if (!n) {
      n = null;
    }
    for (const appearance of Player.Appearance) {
      if (appearance.Asset.Group.Name === t) {
        if (!appearance.Property) {
          appearance.Property = {};
        }
        appearance.Property.Expression = n;
        if (color) {
          appearance.Color = color;
        }
        break;
      }
    }
  }

  const poseCategories = /** @type {const} */ ({
    BodyFull: { Conflicts: ["BodyUpper", "BodyLower", "BodyAddon"] },
    BodyUpper: { Conflicts: ["BodyFull"] },
    BodyLower: { Conflicts: ["BodyFull", "BodyAddon"] },
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
      .filter(v => v[1] !== null)
      .map(v => [v[0], [{ Expression: v[1] }]])
      .reduce((a, [k, v]) => {
        a[/** @type {string} */ (k)] = v;
        return a;
      }, {}),
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
      ...bceExpressionsQueue.splice(0).map((e) => {
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
        Expression: objEntries(manualComponents).reduce((a, [k, v]) => {
          a[k] = [{ Expression: v }];
          return a;
        }, {}),
      });
    } else {
      for (const [k] of objEntries(manualComponents)) {
        delete manualComponents[k];
      }
    }
  }

  CommandCombine([
    {
      Tag: "r",
      Description: displayText("[part of face or 'all']: resets expression overrides on part of or all of face"),
      Action: (args) => {
        if (args.length === 0 || args === "all") {
          resetExpressionQueue([MANUAL_OVERRIDE_EVENT_TYPE]);
          fbcChatNotify(displayText("Reset all expressions"));
        } else {
          const component = `${args[0].toUpperCase()}${args.substring(1).toLowerCase()}`;
          for (const e of bceExpressionsQueue.map(a => a.Expression).filter(Boolean)) {
            if (component === "Eyes" && "Eyes2" in e) {
              delete e.Eyes2;
            }
            if (component in e) {
              delete e[component];
            }
          }
          fbcChatNotify(displayText("Reset expression on $component", { $component: component }));
        }
      },
    },
    {
      Tag: "anim",
      Description: displayText("['list' or name of emote]: run an animation"),
      Action: (_1, _2, args) => {
        if (!fbcSettings.activityExpressions) {
          fbcChatNotify(displayText("Activity expressions are not enabled in WCE settings. Unable to run animations."));
          return;
        }
        if (args[0] === "list") {
          fbcChatNotify(displayText("Available animations: $anims", { $anims: Object.keys(globalThis.bce_EventExpressions).join(", ") }));
          return;
        }
        const animation = Object.keys(globalThis.bce_EventExpressions).find(a => a.toLowerCase() === args[0]?.toLowerCase());
        if (animation) {
          pushEvent(globalThis.bce_EventExpressions[animation]);
        }
      },
    },
  ]);

  /**
   * @param {AssetPoseName} pose
   * @returns {keyof AssetPoseMap}
   */
  function getPoseCategory(pose) {
    return PoseFemale3DCG.find(a => a.Name === pose)?.Category;
  }

  /**
   * @param {readonly string[]} poses
   */
  function setPoses(poses) {
    poses = poses.filter(p => p).map(p => p.toLowerCase());
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
          p.Pose = poseList.filter(pp => !!getPoseCategory(pp));
        });
      }
    });
    const poseNames = PoseFemale3DCG.filter(p => poses.includes(p.Name.toLowerCase())).map(p => p.Name);
    for (const poseName of poseNames) {
      PoseSetActive(Player, poseName, false);
    }
  }

  CommandCombine({
    Tag: "pose",
    Description: displayText("['list' or list of poses]: set your pose"),
    Action: (_1, _2, poses) => {
      if (poses[0] === "list") {
        const categories = [...new Set(PoseFemale3DCG.map(a => a.Category))];
        for (const category of categories) {
          const list = PoseFemale3DCG.filter(a => a.Category === category)?.map(a => a.Name);
          list.sort((a, b) => a.localeCompare(b));
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

      const duration = typeof Timer === "number" && Timer > 0 ? Timer * 1000 : -1;
      /** @type {Record<string, ExpressionStage[]>} */
      const e = {};
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

        /** @type {AssetPoseName[]} */
        const p = (!Pose || (Array.isArray(Pose) && Pose.every(pp => !pp))) ? ["BaseUpper", "BaseLower"] : [Pose];
        const evt = {
          Type: MANUAL_OVERRIDE_EVENT_TYPE,
          Duration: -1,
          Poses: [{ Pose: p, Duration: -1 }],
        };
        pushEvent(evt);
        return CustomArousalExpression();
      }
    );
  }

  registerSocketListener(
    "ChatRoomSyncPose",
    /**
     * @param {ServerCharacterPoseResponse} data
     * @returns {void}
     */
    (data) => {
      if (data === null || !isNonNullObject(data)) return;
      if (!Array.isArray(data.Pose)) {
        logWarn(`data.Pose in ChatRoomSyncPose for ${data.MemberNumber?.toString()} is not an array`);
        return;
      }
      if (!fbcSettings.animationEngine) return;
      if (data.MemberNumber === Player.MemberNumber) setPoses(data.Pose);
    }
  );

  registerSocketListener(
    "ChatRoomSyncSingle",
    /**
     * @param {ServerChatRoomSyncCharacterResponse} data
     * @returns {void}
     */
    (data) => {
      if (data === null || !isNonNullObject(data)) return;
      if (!fbcSettings.animationEngine) return;
      if (data.Character?.MemberNumber === Player.MemberNumber) setPoses(data.Character.ActivePose ?? []);
    }
  );

  resetExpressionQueue([MANUAL_OVERRIDE_EVENT_TYPE, GAME_TIMED_EVENT_TYPE]);

  // This is called once per interval to check for expression changes
  function CustomArousalExpression() {
    if (!fbcSettings.animationEngine || !Player?.AppearanceLayers) {
      return;
    }

    // Ensure none of the expressions have remove timers on them; we handle timers here
    Player.Appearance.filter(a => faceComponents.includes(a.Asset.Group.Name) && a.Property?.RemoveTimer).forEach((a) => {
      delete a.Property.RemoveTimer;
    });

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
        for (const queuedExpression of bceExpressionsQueue) {
          if (queuedExpression.Type === AUTOMATED_AROUSAL_EVENT_TYPE) {
            continue;
          }
          queuedExpression.Expression = {};
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

    function lastOrgasmAdjustment() {
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
    }

    // Handle events
    const OrgasmRecoveryStage = 2;
    if (
      PreviousArousal.OrgasmStage !== OrgasmRecoveryStage &&
      Player.ArousalSettings.OrgasmStage === OrgasmRecoveryStage &&
      bceExpressionsQueue.filter(a => a.Type === POST_ORGASM_EVENT_TYPE).length === 0
    ) {
      pushEvent(globalThis.bce_EventExpressions.PostOrgasm);
      lastOrgasm = Date.now();
    }

    // Keep track of desired changes
    /** @type {{ [key: string]: ExpressionStage }} */
    const desiredExpression = {};

    /** @type {Record<string, { Id: number; Pose: AssetPoseName; Category?: string; Duration: number; Priority: number; Type: string }>} */
    let desiredPose = {};

    /** @type {{ [key: string]: ExpressionStage }} */
    const nextExpression = {};

    /**
     * @param {ExpressionName} e expression
     * @param {ExpressionStage} exp stage
     * @param {ExpressionEvent} next
     * @param {string} t faceComponent
     * @returns {void}
     */
    function trySetNextExpression(e, exp, next, t) {
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
    }

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
          const desiredIsNewerAndInfinite = poseList.every((p) => {
            const category = getPoseCategory(p);
            return (
              !!category &&
              desiredPose[category]?.Duration < 0 &&
              desiredPose[category]?.Id > mustNum(pose.Id) &&
              (desiredPose[category]?.Type === MANUAL_OVERRIDE_EVENT_TYPE || bceExpressionsQueue[j].Type !== MANUAL_OVERRIDE_EVENT_TYPE)
            );
          });
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
        const p = PoseFemale3DCG.find(pp => pp.Name === pose);
        if (!p?.Category && Object.values(desiredPose).every(v => v.Pose !== pose)) {
          poseUpdate = [...Player.ActivePose];
          poseUpdate.splice(i, 1);
          i--;
          needsRefresh = true;
        }
      }
    }

    // Handle arousal-based expressions
    outer: for (const t of Object.keys(globalThis.bce_ArousalExpressionStages)) {
      const [exp] = expression(t);
      /** @type {ExpressionName} */
      let chosenExpression = null;
      let expressionChosen = false;
      for (const face of globalThis.bce_ArousalExpressionStages[t]) {
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
      let refreshExpressionScreen = false;
      for (const t of Object.keys(desiredExpression)) {
        if (BCXgetRuleState("block_changing_emoticon")?.isEnforced && t === "Emoticon") {
          continue;
        }
        setExpression(t, desiredExpression[t].Expression ?? null, desiredExpression[t].Color);
        ServerSend("ChatRoomCharacterExpressionUpdate", {
          Name: desiredExpression[t].Expression ?? null,
          Group: t,
          Appearance: ServerAppearanceBundle(Player.Appearance),
        });

        if (desiredExpression[t].Duration < 0 && desiredExpression[t].Expression !== "Closed") {
          refreshExpressionScreen = true;
          Player.ActiveExpression.setWithoutReload(/** @type {ExpressionGroupName} */(t), desiredExpression[t].Expression);
        }
      }

      if (refreshExpressionScreen && DialogSelfMenuSelected === "Expression" && DialogSelfMenuMapping.Expression.C.IsPlayer()) {
        DialogSelfMenuMapping.Expression.Reload();
      }
      needsRefresh = true;
    }

    // Figure out desiredPose conflicts
    function resolvePoseConflicts() {
      const maxPriority = Math.max(...Object.values(desiredPose).map(p => p.Priority));

      const maxPriorityPoses = objEntries(desiredPose).filter(p => p[1].Priority === maxPriority);

      let maxPriorityPose = "";

      if (maxPriorityPoses.length > 1) {
        const maxId = Math.max(...maxPriorityPoses.map(p => p[1].Id)),
          maxIdPoses = maxPriorityPoses.filter(p => p[1].Id === maxId);
        [[maxPriorityPose]] = maxIdPoses;
      } else if (maxPriorityPoses.length === 0) {
        return 0;
      } else {
        [[maxPriorityPose]] = maxPriorityPoses;
      }
      let deleted = 0;
      if (hasConflicts(maxPriorityPose)) {
        const conflicts = poseCategories[maxPriorityPose].Conflicts || [];
        for (const conflict of Array.from(conflicts).filter(c => c in desiredPose)) {
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
    const newPose = Object.values(desiredPose)
      .map(p => p.Pose);
    if (JSON.stringify(Player.ActivePose) !== JSON.stringify(newPose)) {
      poseUpdate = newPose;
      needsRefresh = true;
    }

    if (poseUpdate) {
      Player.ActivePose = poseUpdate;
      ServerSend("ChatRoomCharacterPoseUpdate", { Pose: poseUpdate });

      if (DialogSelfMenuSelected === "Pose" && DialogSelfMenuMapping.Pose.C.IsPlayer()) {
        DialogSelfMenuMapping.Pose.Reload();
      }
    }

    if (needsRefresh) {
      CharacterRefresh(Player, false, false);
    }

    PreviousArousal = { ...Player.ArousalSettings };
  }

  createTimer(CustomArousalExpression, 250);
}
