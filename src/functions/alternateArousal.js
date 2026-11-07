import { BCE_MAX_AROUSAL, HIDDEN, BCE_MSG, MESSAGE_TYPES, FBC_VERSION } from "../util/constants";
import { logWarn } from "../util/logger";
import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { waitFor, isCharacter } from "../util/utils";
import { registerSocketListener } from "./appendSocketListenersToInit";

export default async function alternateArousal() {
  await waitFor(() => !!ServerSocket && ServerIsConnected);

  Player.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, Player.ArousalSettings?.Progress ?? 0);
  Player.BCEEnjoyment = 1;
  const enjoymentMultiplier = 0.2;

  registerSocketListener(
    "ChatRoomSyncArousal",
    /**
     * @param {ServerCharacterArousalResponse} data
     * @returns {void}
     */
    data => {
      // Skip player's own sync messages since we're tracking locally
      if (data.MemberNumber === Player.MemberNumber) return;

      const target = ChatRoomCharacter.find(c => c.MemberNumber === data.MemberNumber);
      if (!target) return;

      queueMicrotask(() => {
        target.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, data.Progress || 0);

        if (!target?.ArousalSettings) {
          logWarn("No arousal settings found for", target);
          return;
        }

        target.ArousalSettings.Progress = Math.round(target.BCEArousalProgress);
      });
    }
  );

  patchFunction(
    "ActivitySetArousalTimer",
    {
      "if (Progress > 0 && (C.ArousalSettings.Progress + Progress) > Max)\n\t\tProgress = (Max - C.ArousalSettings.Progress >= 0) ? Max - C.ArousalSettings.Progress : 0;": `
      if (!C.BCEArousal) {
        if ((Progress > 0) && (C.ArousalSettings.Progress + Progress > Max)) Progress = (Max - C.ArousalSettings.Progress >= 0) ? Max - C.ArousalSettings.Progress : 0;
      } else {
        if (Max === 100) Max = 105;
        const fromMax = Max - (C.BCEArousal ? C.BCEArousalProgress : C.ArousalSettings.Progress);
        if (Progress > 0 && fromMax < Progress) {
          if (fromMax <= 0) {
            Progress = 0;
          } else if (C.BCEArousal) {
            Progress = Math.floor(fromMax / ${enjoymentMultiplier} / (C.BCEEnjoyment || 1));
          } else {
            Progress = fromMax;
          }
        }
      }
    `,

      "Progress = CommonClamp(Progress, -25, 25);": `
      if (!C.BCEArousal) {
        Progress = CommonClamp(Progress, -25, 25);
      } else {
        Progress = CommonClamp(Progress, -20, 20);
      }
      `,
    },
    "Alternate arousal algorithm will be incorrect."
  );

  SDK.hookFunction("ActivityChatRoomArousalSync", HOOK_PRIORITIES.Observe, (args, next) => {
    const [C] = args;
    if (isCharacter(C) && C.IsPlayer() && CurrentScreen === "ChatRoom") {
      /** @type {ServerChatRoomMessage} */
      const message = {
        Type: HIDDEN,
        Content: BCE_MSG,
        Dictionary: [
          {
            // @ts-expect-error - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
            message: {
              type: MESSAGE_TYPES.ArousalSync,
              version: FBC_VERSION,
              alternateArousal: fbcSettings.alternateArousal,
              progress: C.BCEArousalProgress,
              enjoyment: C.BCEEnjoyment,
            },
          },
        ],
      };
      ServerSend("ChatRoomChat", message);
    }
    return next(args);
  });

  SDK.hookFunction("ActivitySetArousal", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    const [C, Progress] = args;
    const ret = next(args);
    if (isCharacter(C) && typeof Progress === "number" && Math.abs(C.BCEArousalProgress - Progress) > 3) {
      C.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, Progress);
    }
    return ret;
  });

  SDK.hookFunction("ActivitySetArousalTimer", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    const [C, , , Factor] = args;
    if (isCharacter(C) && typeof Factor === "number") {
      C.BCEEnjoyment = 1 + (Factor > 1 ? Math.round(Math.log2(Factor)) : 0);
    }
    return next(args);
  });

  SDK.hookFunction("ActivityTimerProgress", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    const [C, progress] = args;
    if (isCharacter(C) && typeof progress === "number") {
      if (typeof C.BCEArousalProgress !== "number") {
        C.BCEArousalProgress = 0;
      }
      if (!C.BCEEnjoyment) {
        C.BCEEnjoyment = 1;
      }
      // Resync upward when BCE has drifted below the vanilla meter (e.g. BCEArousalProgress was
      // initialized before Player.ArousalSettings was fully populated, or an external write
      // bumped ArousalSettings.Progress without going through ActivitySetArousal). Without this,
      // a single decay tick would slam the live meter to 0 because the hook unconditionally
      // writes Math.round(BCEArousalProgress) back into C.ArousalSettings.Progress below.
      if (C.BCEArousal && C.ArousalSettings && typeof C.ArousalSettings.Progress === "number" && C.ArousalSettings.Progress - C.BCEArousalProgress > 3) {
        C.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, C.ArousalSettings.Progress);
      }
      C.BCEArousalProgress += progress * (progress > 0 ? C.BCEEnjoyment * enjoymentMultiplier : 1);
      C.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, C.BCEArousalProgress);
      if (C.BCEArousal) {
        if (!C.ArousalSettings) {
          throw new Error(`No arousal settings found for ${C.Name}`);
        }
        C.ArousalSettings.Progress = Math.max(0, C.BCEArousalProgress);
        C.ArousalSettings.Progress = Math.round(C.BCEArousalProgress);
        args[1] = 0;
        return next(args);
      }
    }
    return next(args);
  });

  patchFunction(
    "ActivityProgressCharacter",
    {
      "if (!C.IsEgged()) return;\n\n\tlet Factor = ActivityEggFactor(C);": `
      if (!C.IsEgged()) return;

      if (C.BCEArousal) {
        let maxIntensity = 0;
        let vibes = 0;
        let noOrgasmVibes = 0;
        let Factor = -1;
        for (let A = 0; A < C.Appearance.length; A++) {
          let Item = C.Appearance[A];
          let ZoneFactor = PreferenceGetZoneFactor(C, Item.Asset.ArousalZone) - 2;
          if (InventoryItemHasEffect(Item, "Egged", true) && typeof Item.Property?.Intensity === "number" && !isNaN(Item.Property.Intensity) && Item.Property.Intensity >= 0 && ZoneFactor >= 0) {
            vibes++;
            if (!PreferenceGetZoneOrgasm(C, Item.Asset.ArousalZone)) {
              noOrgasmVibes++;
            }
            maxIntensity = Math.max(Item.Property.Intensity, maxIntensity);
            Factor += Item.Property.Intensity + ZoneFactor + 1;
          }
        }
        // Adds the fetish value to the factor
        if (Factor >= 0) {
          const Fetish = ActivityFetishFactor(C);
          if (Fetish > 0) Factor = Factor + Math.ceil(Fetish / 3);
          if (Fetish < 0) Factor = Factor + Math.floor(Fetish / 3);
        }

        let maxProgress = 100;
        switch (maxIntensity) {
          case 0:
            maxProgress = 40 + vibes * 5;
            break;
          case 1:
            maxProgress = 70 + vibes * 5;
            break;
          default:
            maxProgress = vibes === 0 || vibes > noOrgasmVibes ? 100 : 95;
            break;
        }
        let stepInterval = 2;
        if (Factor < 0) {
          ActivityVibratorLevel(C, 0);
          return;
        }
        if (Factor < 1) {
          ActivityVibratorLevel(C, 1);
          maxProgress = Math.min(maxProgress, 35);
          stepInterval = 5;
        } else if (Factor < 2) {
          ActivityVibratorLevel(C, 1);
          maxProgress = Math.min(maxProgress, 65);
          stepInterval = 4;
        } else if (Factor < 3) {
          maxProgress = Math.min(maxProgress, 95);
          stepInterval = 3;
          ActivityVibratorLevel(C, 2);
        } else {
          ActivityVibratorLevel(C, Math.min(4, Math.floor(Factor)));
        }
        if (maxProgress === 100) {
          maxProgress = 105;
        }
        const maxIncrease = maxProgress - C.ArousalSettings.Progress;
        if (TimerLastArousalProgressCount % stepInterval === 0 && maxIncrease > 0) {
          C.BCEEnjoyment = 1 + (Factor > 1 ? Math.round(1.5 * Math.log2(Factor)) : 0);
          ActivityTimerProgress(C, 1);
        }
        return;
      }

      let Factor = ActivityEggFactor(C);`,
    },
    "Alternative arousal algorithm will be incorrect."
  );

  patchFunction(
    "ActivityDecayCharacter",
    {
      "// A vibrating item holds arousal, so decay only when none qualifies": `// A vibrating item holds arousal, so decay only when none qualifies
	C.BCEEnjoyment = 1;`,
    },
    "Alternative arousal algorithm's enjoyment will not reset."
  );
}
