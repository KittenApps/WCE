import { patchFunction, SDK, HOOK_PRIORITIES, BCE_MAX_AROUSAL, HIDDEN, BCE_MSG, MESSAGE_TYPES } from "..";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { waitFor, isCharacter } from "../util/utils";
import { logWarn } from "../util/logger";
import { fbcSettings } from "../util/settings";

export async function alternateArousal() {
  await waitFor(() => !!ServerSocket && ServerIsConnected);

  Player.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, Player.ArousalSettings?.Progress ?? 0);
  Player.BCEEnjoyment = 1;
  const enjoymentMultiplier = 0.2;

  registerSocketListener(
    "ChatRoomSyncArousal",
    (
      /** @type {{ MemberNumber: number; Progress: number; }} */
      data
    ) => {
      if (data.MemberNumber === Player.MemberNumber) {
        // Skip player's own sync messages since we're tracking locally
        return;
      }

      const target = ChatRoomCharacter.find((c) => c.MemberNumber === data.MemberNumber);

      if (!target) {
        return;
      }

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

      "if (Progress < -25) Progress = -25;": `
      if (!C.BCEArousal) {
        if (Progress < -25) Progress = -25;
      } else {
        if (Progress < -20) Progress = -20;
      }
      `,

      "if (Progress > 25) Progress = 25;": `
      if (!C.BCEArousal) {
        if (Progress > 25) Progress = 25;
      } else {
        if (Progress > 20) Progress = 20;
      }
      `,
    },
    "Alternate arousal algorithm will be incorrect."
  );

  SDK.hookFunction(
    "ActivityChatRoomArousalSync",
    HOOK_PRIORITIES.Observe,
    /**
     * @param {Parameters<typeof ActivityChatRoomArousalSync>} args
     */
    (args, next) => {
      const [C] = args;
      if (isCharacter(C) && C.IsPlayer() && CurrentScreen === "ChatRoom") {
        /** @type {ServerChatRoomMessage} */
        const message = {
          Type: HIDDEN,
          Content: BCE_MSG,
          Dictionary: [
            {
              // @ts-ignore - cannot extend valid dictionary entries to add our type to it, but this is possible within the game's wire format
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
    }
  );

  SDK.hookFunction(
    "ActivitySetArousal",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof ActivitySetArousal>} args
     */
    (args, next) => {
      const [C, Progress] = args;
      const ret = next(args);
      if (isCharacter(C) && typeof Progress === "number" && Math.abs(C.BCEArousalProgress - Progress) > 3) {
        C.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, Progress);
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "ActivitySetArousalTimer",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof ActivitySetArousalTimer>} args
     */
    (args, next) => {
      const [C, , , Factor] = args;
      if (isCharacter(C) && typeof Factor === "number") {
        C.BCEEnjoyment = 1 + (Factor > 1 ? Math.round(Math.log2(Factor)) : 0);
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "ActivityTimerProgress",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof ActivityTimerProgress>} args
     */
    (args, next) => {
      const [C, progress] = args;
      if (isCharacter(C) && typeof progress === "number") {
        if (!C.BCEArousalProgress) {
          C.BCEArousalProgress = 0;
        }
        if (!C.BCEEnjoyment) {
          C.BCEEnjoyment = 1;
        }
        C.BCEArousalProgress += progress * (progress > 0 ? C.BCEEnjoyment * enjoymentMultiplier : 1);
        C.BCEArousalProgress = Math.min(BCE_MAX_AROUSAL, C.BCEArousalProgress);
        if (C.BCEArousal) {
          if (!C.ArousalSettings) {
            throw new Error(`No arousal settings found for ${C.Name}`);
          }
          C.ArousalSettings.Progress = Math.round(C.BCEArousalProgress);
          args[1] = 0;
          return next(args);
        }
      }
      return next(args);
    }
  );

  patchFunction(
    "TimerProcess",
    {
      "// If the character is egged, we find the highest intensity factor and affect the progress, low and medium vibrations have a cap\n\t\t\t\t\t\t\tlet Factor = -1;": `
      let Factor = -1;
      if (Character[C].BCEArousal) {
        let maxIntensity = 0;
        let vibes = 0;
        let noOrgasmVibes = 0;
        for (let A = 0; A < Character[C].Appearance.length; A++) {
          let Item = Character[C].Appearance[A];
          let ZoneFactor = PreferenceGetZoneFactor(Character[C], Item.Asset.ArousalZone) - 2;
          if (InventoryItemHasEffect(Item, "Egged", true) && typeof Item.Property?.Intensity === "number" && !isNaN(Item.Property.Intensity) && Item.Property.Intensity >= 0 && ZoneFactor >= 0) {
            if (Item.Property.Intensity >= 0) {
              vibes++;
              if (!PreferenceGetZoneOrgasm(Character[C], Item.Asset.ArousalZone)) {
                noOrgasmVibes++;
              }
              maxIntensity = Math.max(Item.Property.Intensity, maxIntensity);
              Factor += Item.Property.Intensity + ZoneFactor + 1;
            }
          }
        }
        // Adds the fetish value to the factor
        if (Factor >= 0) {
          var Fetish = ActivityFetishFactor(Character[C]);
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
        const topStepInterval = 2;
        let stepInterval = topStepInterval;
        if (Factor < 0) {
          ActivityVibratorLevel(Character[C], 0);
        } else {
          if (Factor < 1) {
            ActivityVibratorLevel(Character[C], 1);
            maxProgress = Math.min(maxProgress, 35);
            stepInterval = 5;
          } else if (Factor < 2) {
            ActivityVibratorLevel(Character[C], 1);
            maxProgress = Math.min(maxProgress, 65);
            stepInterval = 4;
          } else if (Factor < 3) {
            maxProgress = Math.min(maxProgress, 95);
            stepInterval = 3;
            ActivityVibratorLevel(Character[C], 2);
          } else {
            ActivityVibratorLevel(Character[C], Math.min(4, Math.floor(Factor)));
          }
          if (maxProgress === 100) {
            maxProgress = 105;
          }
          let maxIncrease = maxProgress - Character[C].ArousalSettings.Progress;
          if (TimerLastArousalProgressCount % stepInterval === 0 && maxIncrease > 0) {
            Character[C].BCEEnjoyment = 1 + (Factor > 1 ? Math.round(1.5*Math.log2(Factor)) : 0);
            ActivityTimerProgress(Character[C], 1);
          }
        }
      } else {
      `,

      "if ((Factor == -1)) {ActivityVibratorLevel(Character[C], 0);}\n\n\t\t\t\t\t\t}": `if (Factor == -1) {
          ActivityVibratorLevel(Character[C], 0);
        }
      }
    } else {
      ActivityVibratorLevel(Character[C], 0);
    }
    `,

      "// No decay if there's a vibrating item running": `// No decay if there's a vibrating item running
    Character[C].BCEEnjoyment = 1;`,
    },
    "Alternative arousal algorithm will be incorrect."
  );
}
