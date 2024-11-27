import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcBeepNotify } from "../util/hooks";
import { waitFor, isWardrobe, parseJSON } from "../util/utils";
import { logInfo, logError } from "../util/logger";
import { fbcSettings } from "../util/settings";
import { DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE } from "../util/constants";
import type { Table, IndexableType } from "dexie";

let localWardrobeTable: Table<{ id: number; appearance: ServerItemBundle[] }, IndexableType, unknown>;
let extendedWardrobeLoaded = false;

export async function loadLocalWardrobe(wardrobe: ItemBundle[][]): Promise<void> {
  const { Dexie } = await import("dexie");
  const db = new Dexie("wce-local-wardrobe");
  db.version(1).stores({ wardrobe: "id, appearance" });
  localWardrobeTable = db.table("wardrobe");
  const localWardrobe: { id: number; appearance: ServerItemBundle[] }[] = (await localWardrobeTable.toArray()) || [];
  await waitFor(() => wardrobe.length === EXPANDED_WARDROBE_SIZE);
  wardrobe.push(...localWardrobe.map(w => sanitizeBundles(w.appearance)));
}

async function saveLocalWardrobe(wardrobe: ServerItemBundle[][]): Promise<void> {
  await localWardrobeTable.bulkPut(wardrobe.map((appearance, id) => ({ id, appearance })));
}

/** Convert old {@link ItemProperties.Type} remnants into {@link ItemProperties.TypeRecord} in the passed item bundles. */
function sanitizeBundles(bundleList: ItemBundle[]): ItemBundle[] {
  if (!Array.isArray(bundleList)) return bundleList;
  return bundleList.map((bundle) => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (typeof bundle.Property?.Type === "string" && !CommonIsObject(bundle.Property?.TypeRecord)) {
      const asset = AssetGet("Female3DCG", bundle.Group, bundle.Name);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (asset) bundle.Property.TypeRecord = ExtendedItemTypeToRecord(asset, bundle.Property.Type);
    }
    return bundle;
  });
}

export function loadExtendedWardrobe(wardrobe: ItemBundle[][], init: boolean): ItemBundle[][] {
  if (fbcSettings.extendedWardrobe) {
    WardrobeSize = EXPANDED_WARDROBE_SIZE;
    WardrobeFixLength();
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const wardrobeData: string = Player.ExtensionSettings.FBCWardrobe || Player.OnlineSettings?.BCEWardrobe;
  if (wardrobeData || !init) {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (Player.OnlineSettings?.BCEWardrobe) {
      Player.ExtensionSettings.FBCWardrobe = wardrobeData;
      ServerPlayerExtensionSettingsSync("FBCWardrobe");
      logInfo("Migrated wardrobe from OnlineSettings to ExtensionSettings");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      delete Player.OnlineSettings.BCEWardrobe;
    }
    try {
      const additionalItemBundle: ItemBundle[][] = wardrobeData ? parseJSON(LZString.decompressFromUTF16(wardrobeData)) : [];
      if (isWardrobe(additionalItemBundle)) {
        for (let i = DEFAULT_WARDROBE_SIZE; i < EXPANDED_WARDROBE_SIZE; i++) {
          const additionalIdx = i - DEFAULT_WARDROBE_SIZE;
          if (additionalIdx >= additionalItemBundle.length) {
            break;
          }
          wardrobe[i] = sanitizeBundles(additionalItemBundle[additionalIdx]);
        }
        extendedWardrobeLoaded = true;
      }
    } catch (e) {
      logError("Failed to load extended wardrobe", e);
      fbcBeepNotify("Wardrobe error", `Failed to load extended wardrobe.\n\nBackup: ${wardrobeData}`);
      logInfo("Backup wardrobe", wardrobeData);
    }
  }
  return wardrobe;
}

export default async function extendedWardrobe(): Promise<void> {
  await waitFor(() => !!ServerSocket);

  SDK.hookFunction(
    "CharacterCompressWardrobe",
    HOOK_PRIORITIES.Top,
    ([wardrobe], next) => {
      if (isWardrobe(wardrobe)) {
        const additionalWardrobe = wardrobe.slice(DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE);
        if (additionalWardrobe.length > 0 && extendedWardrobeLoaded) {
          Player.ExtensionSettings.FBCWardrobe = LZString.compressToUTF16(JSON.stringify(additionalWardrobe));
          const additionalLocalWardrobe = wardrobe.slice(EXPANDED_WARDROBE_SIZE);
          if (additionalLocalWardrobe.length > 0) saveLocalWardrobe(additionalLocalWardrobe);
          wardrobe = wardrobe.slice(0, DEFAULT_WARDROBE_SIZE);
          ServerPlayerExtensionSettingsSync("FBCWardrobe");
        }
      }
      return next([wardrobe]);
    }
  );

  SDK.hookFunction(
    "WardrobeLoadCharacterNames",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    (args, next) => {
      if (!fbcSettings.localWardrobe) return next(args);
      if (!Player.WardrobeCharacterNames) Player.WardrobeCharacterNames = [];
      let Push = false;
      while (Player.WardrobeCharacterNames.length <= WardrobeSize) {
        if (Player.WardrobeCharacterNames.length < EXPANDED_WARDROBE_SIZE) {
          Player.WardrobeCharacterNames.push(Player.Name);
          Push = true;
        } else {
          Player.WardrobeCharacterNames.push("Local");
        }
      }
      if (Push) ServerAccountUpdate.QueueData({ WardrobeCharacterNames: Player.WardrobeCharacterNames.slice(0, EXPANDED_WARDROBE_SIZE) });
      return null;
    }
  );
}
