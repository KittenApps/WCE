import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor, isCharacter, deepCopy, fbcSendAction } from "../util/utils";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";

export default async function layeringMenu(): Promise<void> {
  await waitFor(() => !!Player?.AppearanceLayers);

  if (GameVersion === 'R104') {
    patchFunction( // ToDo: remove once r105 is out
      "DialogMenuButtonBuild",
      {
        "if (Item != null && !C.IsNpc() && Player.CanInteract()) {":
          "if (Item != null && !C.IsNpc() && (Player.CanInteract() || fbcSettingValue('allowLayeringWhileBound'))) {",
      },
      "Built-in layering menus options for allow on others and allow while bound"
    );
  } else {
    // DialogCanUnlock with Player.CanInteract() requirement removed
    function DialogCanUnlock2(C: Character, Item: Item) {
      if (Item?.Property?.LockedBy === "ExclusivePadlock") return (!C.IsPlayer());
      if (LogQuery("KeyDeposit", "Cell")) return false;
      if (Item?.Asset?.OwnerOnly) return Item.Asset.Enable && C.IsOwnedByPlayer();
      if (Item?.Asset?.LoverOnly) return Item.Asset.Enable && C.IsLoverOfPlayer();
      if (Item?.Asset?.FamilyOnly) return Item.Asset.Enable && C.IsFamilyOfPlayer();
      return DialogHasKey(C, Item);
    }
    SDK.hookFunction(
      "Layering.Init",
      HOOK_PRIORITIES.AddBehaviour,
      // @ts-ignore - ToDo remove once r105 types are out
      ([item, C, display, reload, readonly], next) => {
        // @ts-ignore - ToDo remove once r105 types are out
        const ret = next([item, C, display, reload, readonly]);
        if (fbcSettings.allowLayeringWhileBound && (!InventoryItemHasEffect(item, "Lock") || DialogCanUnlock2(C, item))) {
          // @ts-ignore - ToDo remove once r105 types are out
          Layering.Readonly = false;
        }
        return ret;
      }
    );
  }

  // Pseudo-items that we do not want to process for color copying
  const ignoredColorCopyableAssets = [
    "LeatherCrop",
    "LeatherWhip",
    "ShockCollarRemote",
    "SpankingToys",
    "VibratorRemote",
  ];
  const colorCopyableAssets = Asset.filter(ass =>
    AssetGroup.filter(a => a.Name.startsWith("Item") && !/\d$/u.test(a.Name) && a.Asset.find((b) => b.Name === ass.Name)).length > 1
  ).filter((v, i, a) => a.findIndex(as => as.Name === v.Name) === i).map(a => a.Name).filter(a => !ignoredColorCopyableAssets.includes(a));

  function assetWorn(C: Character, item?: Item): boolean {
    return !!item && !!C.Appearance.find(a => a === item);
  }

  SDK.hookFunction(
    "DialogMenuButtonBuild",
    HOOK_PRIORITIES.AddBehaviour,
    ([C], next) => {
      const ret = next([C]);
      if (
        isCharacter(C) &&
        fbcSettings.copyColor &&
        Player.CanInteract() &&
        C?.FocusGroup?.Name &&
        !InventoryGroupIsBlocked(C, C.FocusGroup.Name) &&
        DialogMenuMode === "items"
      ) {
        const focusItem = InventoryGet(C, C.FocusGroup.Name);
        if (assetWorn(C, focusItem) && colorCopyableAssets.includes(focusItem.Asset.Name)) {
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
    (args, next) => {
      if (args[0] === "DialogMenuPaint") return displayText("[WCE] Copy colors to other items of same type");
      return next(args);
    }
  );

  SDK.hookFunction(
    "DialogMenuButtonClick",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      const ret = next(args);
      if (!ret && !["colorExpression", "colorItem", "extended", "layering", "tighten"].includes(DialogMenuMode)) {
        const C = CharacterGetCurrent();
        const Item = C.FocusGroup ? InventoryGet(C, C.FocusGroup.Name) : null;
        for (let I = 0; I < DialogMenuButton.length; I++) {
          if (MouseIn(1885 - I * 110, 15, 90, 90)) {
            const button = DialogMenuButton[I];
            // @ts-ignore
            if (Item && button === "Paint") {
              copyColors(C, Item);
              return false;
            }
          }
        }
      }
      return ret;
    }
  );

  function copyColorTo(item: Item, focusItem: Item): void {
    if (item.Asset.Name === focusItem.Asset.Name) {
      if (Array.isArray(focusItem.Color)) {
        if (Array.isArray(item.Color)) {
          for (let i = item.Color.length - 1; i >= 0; i--) {
            item.Color[i] = focusItem.Color[i % focusItem.Color.length];
          }
        } else {
          item.Color = focusItem.Color[focusItem.Color.length - 1];
        }
      } else if (Array.isArray(item.Color)) {
        for (let i = 0; i < item.Color.length; i++) {
          item.Color[i] = focusItem.Color ?? "Default";
        }
      } else { // Both are array
        item.Color = deepCopy(focusItem.Color);
      }
    }
  }

  function copyColors(C: Character, focusItem: Item): void {
    if (
      !fbcSettings.copyColor ||
      !Player.CanInteract() ||
      InventoryGroupIsBlocked(C, C.FocusGroup.Name) ||
      !assetWorn(C, focusItem) ||
      !colorCopyableAssets.includes(focusItem.Asset.Name)
    ) return;
    console.log("copying color to all: ", focusItem);
    for (const item of C.Appearance) {
      copyColorTo(item, focusItem);
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
  }
}
