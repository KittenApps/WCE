import { patchFunction, SDK, HOOK_PRIORITIES } from "../util/modding";
import { waitFor, isCharacter, deepCopy, fbcSendAction, parseJSON } from "../util/utils";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";

declare global {
  interface ItemProperties {
    wceOverrideHide?: AssetGroupName[];
  }
}
interface WCEOverrideSetting {
  Hide: Record<string, AssetGroupName[]>;
}

export default async function layeringMenu(): Promise<void> {
  await waitFor(() => !!Player?.AppearanceLayers);

  // ToDo: remove once r105 is out
  if (GameVersion === "R104") {
    patchFunction(
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
      "Layering.Load",
      HOOK_PRIORITIES.AddBehaviour,
      (args, next) => {
        if (fbcSettings.allowLayeringWhileBound && (!InventoryItemHasEffect(Layering.Item, "Lock") || DialogCanUnlock2(Layering.Character, Layering.Item))) {
          Layering.Readonly = false;
        }
        if (!fbcSettings.layeringHide || CurrentScreen === "Crafting" || !Layering.Character.BCECapabilities?.includes("layeringHide")) return next(args);
        const ret = next(args);
        const defaultItemHide = Layering.Asset.Hide || [];
        if (defaultItemHide.length === 0) return ret;
        const overrideItemHide = Layering.Item.Property.wceOverrideHide || defaultItemHide;
        ElementCreate({
          tag: "h1",
          attributes: { id: "layering-hide-header" },
          parent: document.getElementById("layering"),
          children: [displayText("[WCE] Configure layer hiding")],
        });
        ElementCreate({
          tag: "form",
          attributes: { id: "layering-hide-div" },
          classList: ["layering-layer-inner-grid"],
          parent: document.getElementById("layering"),
          children: defaultItemHide.map(h => ({
            tag: "div",
            classList: ["layering-pair"],
            children: [
              {
                tag: "input",
                // eslint-disable-next-line no-undefined
                attributes: { type: "checkbox", name: "checkbox-hide", value: h, disabled: Layering.Readonly ? true : undefined, checked: overrideItemHide.includes(h) ? true : undefined },
                classList: [],
                eventListeners: {
                  click: () => {
                    const hideForm: HTMLFormElement = document.getElementById("layering-hide-div") as HTMLFormElement;
                    Layering.Item.Property.wceOverrideHide = new FormData(hideForm).getAll("checkbox-hide") as AssetGroupName[];
                    if (defaultItemHide.length === Layering.Item.Property.wceOverrideHide.length) delete Layering.Item.Property.wceOverrideHide;
                    // eslint-disable-next-line no-underscore-dangle
                    Layering._CharacterRefresh(Layering.Character, false, false);
                  },
                },
              },
              {
                tag: "span",
                classList: ["layering-pair-text"],
                children: [h],
              },
            ],

          })),
        });
        return ret;
      }
    );

    SDK.hookFunction(
      "Layering._ResetClickListener",
      HOOK_PRIORITIES.AddBehaviour,
      (args, next) => {
        if (!fbcSettings.layeringHide || CurrentScreen === "Crafting") return next(args);
        delete Layering.Item.Property.wceOverrideHide;
        document.querySelectorAll("input[name=checkbox-hide]").forEach((e: HTMLInputElement) => {
          e.checked = true;
        });
        return next(args);
      }
    );
  }

  patchFunction(
    "CharacterAppearanceVisible",
    {
      "if ((item.Asset.Hide != null) && (item.Asset.Hide.indexOf(GroupName) >= 0) && !Excluded) HidingItem = true;": `
        const hide = item.Property?.wceOverrideHide != null ? item.Property.wceOverrideHide : item.Asset.Hide;
        if ((hide != null) && (hide.indexOf(GroupName) >= 0) && !Excluded) HidingItem = true;`,
    },
    "Override C.Appeareance.Asset.Hide won't work"
  );

  function serverAppearance(appearance: AppearanceBundle): AppearanceBundle {
    const WCEOverrides: WCEOverrideSetting = { Hide: {} };
    for (const a of appearance) {
      if (Array.isArray(a.Property?.wceOverrideHide)) {
        const { wceOverrideHide, ...property } = a.Property;
        WCEOverrides.Hide[a.Group] = wceOverrideHide;
        a.Property = property;
      }
    }
    Player.ExtensionSettings.WCEOverrides = LZString.compressToUTF16(JSON.stringify(WCEOverrides));
    ServerPlayerExtensionSettingsSync("WCEOverrides");
    return appearance;
  }

  globalThis.wceServerAppearance = serverAppearance;

  patchFunction(
    "ServerPlayerAppearanceSync",
    {
      "D.Appearance = ServerAppearanceBundle(Player.Appearance);":
        "D.Appearance = wceServerAppearance(ServerAppearanceBundle(Player.Appearance));",
    },
    "wceOverrideHide would be stored in the BC database"
  );

  SDK.hookFunction(
    "ServerAppearanceLoadFromBundle",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    (args, next) => {
      const ret = next(args);
      const [C] = args;
      if (C.IsPlayer() && Array.isArray(C.Appearance)) {
        let updated = false;
        const WCEOverrides: WCEOverrideSetting = parseJSON(LZString.decompressFromUTF16(Player.ExtensionSettings.WCEOverrides));
        for (const [Group, Hide] of Object.entries(WCEOverrides?.Hide || {})) {
          const item = InventoryGet(C, Group as AssetGroupName);
          if (item && !Array.isArray(item.Property?.wceOverrideHide)) {
            item.Property ??= {};
            item.Property.wceOverrideHide = Hide;
            updated = true;
          }
        }
        if (updated) ChatRoomCharacterUpdate(C);
      }
      return ret;
    }
  );

  SDK.hookFunction(
    "ChatRoomSyncMemberJoin",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      const ret = next(args);
      if (Player.Appearance.some(a => Array.isArray(a.Property?.wceOverrideHide))) ChatRoomCharacterUpdate(Player);
      return ret;
    }
  );

  // Pseudo-items that we do not want to process for color copying
  const ignoredColorCopyableAssets = [
    "LeatherCrop",
    "LeatherWhip",
    "ShockCollarRemote",
    "SpankingToys",
    "VibratorRemote",
  ];
  const colorCopyableAssets = Asset.filter(ass =>
    AssetGroup.filter(a => a.Name.startsWith("Item") && !/\d$/u.test(a.Name) && a.Asset.find(b => b.Name === ass.Name)).length > 1
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
