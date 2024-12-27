import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor, isNonNullObject, parseJSON, objEntries, isString } from "../util/utils";
import { displayText } from "../util/localization";
import { debug, logWarn, logError } from "../util/logger";

export default async function crafting(): Promise<void> {
  await waitFor(() => Array.isArray(Commands) && Commands.length > 0);

  const importPosition = [1485, 15, 90, 90] as const;
  const exportPosition = [1585, 15, 90, 90] as const;

  function importCraft(): void {
    FUSAM.modals.open({
      prompt: displayText("Paste the craft here"),
      input: { initial: "", readonly: false, type: "textarea" },
      callback: (action, str) => {
        if (action !== "submit" || !str) return;
        try {
          const craft: CraftingItem = parseJSON(LZString.decompressFromBase64(str));
          if (!isNonNullObject(craft)) {
            logError(craft);
            throw new Error(`invalid craft type ${typeof craft} ${str}`);
          }
          for (const [key, value] of objEntries(craft)) {
            if (
              !isString(value) &&
              !Number.isInteger(value) &&
              value !== false &&
              value !== true &&
              value !== null &&
              !isNonNullObject(value)
            ) {
              logWarn("potentially invalid craft bundle:", key, "was", value);
            }
          }
          CraftingSelectedItem = CraftingConvertItemToSelected(craft);
          CraftingModeSet("Name");
        } catch (e) {
          logError("importing craft", e);
        }
      },
    });
  }

  // ToDo: Fix this
  if (GameVersion === "R107") {
    SDK.hookFunction(
      "CraftingClick",
      HOOK_PRIORITIES.AddBehaviour,
      (args, next) => {
        if (CraftingMode === "Name") {
          if (MouseIn(...exportPosition)) {
            const exportString = LZString.compressToBase64(JSON.stringify(CraftingConvertSelectedToItem()));
            FUSAM.modals.open({
              prompt: displayText("Copy the craft here"),
              input: { initial: exportString, readonly: true, type: "textarea" },
              callback: () => {
                debug("exported craft");
              },
            });
            navigator.clipboard.writeText(exportString);
          } else if (MouseIn(...importPosition)) {
            importCraft();
          }
        }
        return next(args);
      }
    );

    SDK.hookFunction(
      "CraftingRun",
      HOOK_PRIORITIES.ModifyBehaviourMedium,
      (args, next) => {
        const ret = next(args);
        if (CraftingMode === "Name") {
          DrawButton(...importPosition, displayText("Import"), "white");
          DrawButton(...exportPosition, displayText("Export"), "white");
        }
        return ret;
      }
    );
  }
}