import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor, isNonNullObject, parseJSON, objEntries, isString, drawTooltip } from "../util/utils";
import { displayText } from "../util/localization";
import { debug, logWarn, logError } from "../util/logger";

export default async function crafting() {
  await waitFor(() => Array.isArray(Commands) && Commands.length > 0);

  const importPosition = /** @type {const} */ ([1485, 15, 90, 90]);
  const exportPosition = /** @type {const} */ ([1585, 15, 90, 90]);

  function importCraft() {
    FUSAM.modals.open({
      prompt: displayText("Paste the craft here"),
      callback: (action, str) => {
        if (action !== "submit" || !str) {
          return;
        }
        try {
          const craft = /** @type {CraftingItem} */ (parseJSON(LZString.decompressFromBase64(str)));
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
      input: {
        initial: "",
        readonly: false,
        type: "textarea",
      },
    });
  }

  SDK.hookFunction(
    "CraftingClick",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof CraftingClick>} args
     */
    (args, next) => {
      switch (CraftingMode) {
        case "Name":
          if (MouseIn(...exportPosition)) {
            FUSAM.modals.open({
              prompt: displayText("Copy the craft here"),
              input: {
                initial: LZString.compressToBase64(JSON.stringify(CraftingConvertSelectedToItem())),
                readonly: true,
                type: "textarea",
              },
              callback: () => {
                debug("exported craft");
              },
            });
          } else if (MouseIn(...importPosition)) {
            importCraft();
          }
          break;
        default:
          break;
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "CraftingRun",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof CraftingRun>} args
     */
    (args, next) => {
      const ret = next(args);
      if (CraftingMode === "Name") {
        DrawButton(...importPosition, displayText("Import"), "white");
        DrawButton(...exportPosition, displayText("Export"), "white");
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "DrawItemPreview",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof DrawItemPreview>} args
     */
    (args, next) => {
      const ret = next(args);
      const [item, , x, y] = args;
      if (item) {
        const { Craft } = item;
        if (MouseIn(x, y, DialogInventoryGrid.itemWidth, DialogInventoryGrid.itemHeight) && Craft) {
          drawTooltip(x, y, DialogInventoryGrid.itemWidth, displayText(Craft.Property), "center");
          drawTooltip(
            1000,
            y - 70,
            975,
            `${displayText("Description:")} ${Craft.Description || "<no description>"}`,
            "left"
          );
        }
      }
      return ret;
    }
  );
}
