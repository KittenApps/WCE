import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor } from "../util/utils";
import { isCharacter, deepCopy, fbcSendAction } from "../util/utils";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";

export async function layeringMenu() {
  await waitFor(() => !!Player?.AppearanceLayers);

  patchFunction(
    "DialogMenuButtonBuild",
    {
      "if (Item != null && C.IsPlayer() && Player.CanInteract()) {":
        "if (Item != null && (C.IsPlayer() || fbcSettingValue('allowLayeringOthers')) && (Player.CanInteract() || fbcSettingValue('allowLayeringWhileBound'))) {",
    },
    "Built-in layering menus options for allow on others and allow while bound"
  );

  // Pseudo-items that we do not want to process for color copying
  const ignoredColorCopiableAssets = [
    "LeatherCrop",
    "LeatherWhip",
    "ShockCollarRemote",
    "SpankingToys",
    "VibratorRemote",
  ];
  const colorCopiableAssets = Asset.filter(
    (ass) =>
      AssetGroup.filter(
        (a) => a.Name.startsWith("Item") && !/\d$/u.test(a.Name) && a.Asset.find((b) => b.Name === ass.Name)
      ).length > 1
  )
    .filter((v, i, a) => a.findIndex((as) => as.Name === v.Name) === i)
    .map((a) => a.Name)
    .filter((a) => !ignoredColorCopiableAssets.includes(a));

  /** @type {(C: Character, item?: Item | null) => boolean} */
  function assetWorn(C, item) {
    return !!item && !!C.Appearance.find((a) => a === item);
  }

  SDK.hookFunction(
    "DialogMenuButtonBuild",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof DialogMenuButtonBuild>} args
     */
    (args, next) => {
      const C = CharacterGetCurrent();
      // @ts-ignore
      const ret = next(args);
      if (
        isCharacter(C) &&
        fbcSettings.copyColor &&
        Player.CanInteract() &&
        C?.FocusGroup?.Name &&
        !InventoryGroupIsBlocked(C, C.FocusGroup.Name)
      ) {
        const focusItem = InventoryGet(C, C.FocusGroup.Name);
        if (assetWorn(C, focusItem) && colorCopiableAssets.includes(focusItem.Asset.Name)) {
          // @ts-ignore
          DialogMenuButton.push("Paint");
        }
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "InterfaceTextGet",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<InterfaceTextGet>} args
     */
    (args, next) => {
      if (args[0] === "DialogMenuPaint") return "Copy colors to other items of same type";
      return next(args);
    }
  );

  window.fbcCopyColors = copyColors;

  patchFunction(
    "DialogMenuButtonClick",
    {
      'else if (Item && button === "Layering") {': `else if (Item && button === "Paint") {
          fbcCopyColors(C, Item);
          return false;
        }

        else if (Item && button === "Layering") {`,
    },
    "Built-in layering menus options for allow on others and allow while bound"
  );

  /** @type {(C: Character, focusItem: Item) => void} */
  function copyColors(C, focusItem) {
    if (
      !fbcSettings.copyColor ||
      !Player.CanInteract() ||
      InventoryGroupIsBlocked(C, C.FocusGroup.Name) ||
      !assetWorn(C, focusItem) ||
      !colorCopiableAssets.includes(focusItem.Asset.Name)
    )
      return;
    console.log("copying color to all: ", focusItem);
    for (const item of C.Appearance) {
      copyColorTo(item);
    }
    if (CurrentScreen === "ChatRoom") {
      ChatRoomCharacterUpdate(C);
      fbcSendAction(
        displayText("$TargetName's $ItemName colors spread from their $ItemGroup", {
          $TargetName: CharacterNickname(C),
          $ItemName: focusItem.Asset.Description.toLowerCase(),
          $ItemGroup: focusItem.Asset.Group.Description.toLowerCase(),
        })
      );
    } else {
      CharacterRefresh(C);
    }

    /** @type {(item: Item) => void} */
    function copyColorTo(item) {
      if (item.Asset.Name === focusItem.Asset.Name) {
        if (Array.isArray(focusItem.Color)) {
          if (Array.isArray(item.Color)) {
            for (let i = 0; i < item.Color.length && i < focusItem.Color.length; i++) {
              item.Color[item.Color.length - (i + 1)] = focusItem.Color[focusItem.Color.length - (i + 1)];
            }
          } else {
            item.Color = focusItem.Color[focusItem.Color.length - 1];
          }
        } else if (Array.isArray(item.Color)) {
          for (let i = 0; i < item.Color.length; i++) {
            item.Color[i] = focusItem.Color ?? "Default";
          }
        } else {
          // Both are array
          item.Color = deepCopy(focusItem.Color);
        }
      }
    }
  }
}
