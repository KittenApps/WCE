import { openDB, type IDBPDatabase } from "idb";

import { DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE } from "../util/constants";
import { fbcBeepNotify } from "../util/hooks";
import { logInfo, logError } from "../util/logger";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { waitFor, isWardrobe, parseJSON } from "../util/utils";

let localWardrobeDB: IDBPDatabase<{ wardrobe: { key: number; value: { id: number; appearance: ServerItemBundle[] } } }>;
let extendedWardrobeLoaded = false;

export async function loadLocalWardrobe(wardrobe: ItemBundle[][]): Promise<void> {
  localWardrobeDB = await openDB("wce-local-wardrobe", 10, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("wardrobe")) db.createObjectStore("wardrobe", { keyPath: "id" });
    },
  });
  const localWardrobe = (await localWardrobeDB.getAll("wardrobe")) || [];
  await waitFor(() => wardrobe.length === EXPANDED_WARDROBE_SIZE);
  wardrobe.push(...localWardrobe.map(w => sanitizeBundles(w.appearance)));
}

async function saveLocalWardrobe(wardrobe: ServerItemBundle[][]): Promise<void> {
  const store = localWardrobeDB.transaction("wardrobe", "readwrite").objectStore("wardrobe");
  await Promise.all(wardrobe.map((appearance, id) => store.put({ id, appearance })));
}

/** Convert old {@link ItemProperties.Type} remnants into {@link ItemProperties.TypeRecord} in the passed item bundles.
 * @param {ItemBundle[]} bundleList
 * @returns {ItemBundle[]}
 */
function sanitizeBundles(bundleList: ItemBundle[]): ItemBundle[] {
  if (!Array.isArray(bundleList)) return bundleList;
  return bundleList.map(bundle => {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    if (typeof bundle.Property?.Type === "string" && !CommonIsObject(bundle.Property?.TypeRecord)) {
      const asset = AssetGet("Female3DCG", bundle.Group, bundle.Name);
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      if (asset) bundle.Property.TypeRecord = ExtendedItemTypeToRecord(asset, bundle.Property.Type);
    }
    return bundle;
  });
}

export async function loadExtendedWardrobe(wardrobe: ItemBundle[][], init: boolean): Promise<ItemBundle[][]> {
  if (!fbcSettings.extendedWardrobe) return wardrobe;

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  if (Player.OnlineSettings?.BCEWardrobe) {
    let prompt = "Old OnlineSettings extended wardrobe data detected. Do you want to migrate them?";
    const buttons = { submit: "Yes", ignore: "Ignore (keep old, ask later)", delete: "No (delete old)" };
    if (Player.ExtensionSettings.FBCWardrobe) {
      prompt += " WARNING: This will override your already existing wardrobe data (in the new format) and may lead to data loss!";
      buttons.submit = "Yes (override)";
    }
    const [answ] = await FUSAM.modals.openAsync({ prompt, buttons });
    if (answ === "submit") {
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      Player.ExtensionSettings.FBCWardrobe = Player.OnlineSettings.BCEWardrobe;
      ServerPlayerExtensionSettingsSync("FBCWardrobe");
      logInfo("Migrated wardrobe from OnlineSettings to ExtensionSettings");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      delete Player.OnlineSettings.BCEWardrobe;
    } else if (answ === "delete") {
      logInfo("deleted old wardrobe in OnlineSettings");
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      delete Player.OnlineSettings.BCEWardrobe;
    }
  }

  const wData = Player.ExtensionSettings.FBCWardrobe;
  WardrobeSize = EXPANDED_WARDROBE_SIZE;
  WardrobeFixLength();

  if (!wData) {
    const warnNew =
      "Looks like you are enabling the extended wardrobe for the first time on this character. " +
      "Proceeding will create a new empty extended wardrobe for the current character. " +
      "If you expect an already existing extended wardrobe for this character to be imported from a different device: choose Cancel instead.";
    const warnOld =
      "No extended wardrobe data found. Do you want to create a new empty extended wardrobe? WARNING: " +
      "This will lead to permanent data loss of your extended wardrobe. In case of a temporary server issue you should choose Cancel here " +
      "(extended wardrobe slots will not be persistent until after a reload extended wardrobe is available again or an empty one is created).";
    const [answ] = await FUSAM.modals.openAsync({ prompt: init ? warnOld : warnNew, buttons: { cancel: "Cancel", submit: "OK" } });
    if (answ === "submit") extendedWardrobeLoaded = true;
    return wardrobe;
  }

  try {
    const additionalItemBundle: ItemBundle[][] = parseJSON(LZString.decompressFromUTF16(wData));
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
    fbcBeepNotify("Wardrobe error", `Failed to load extended wardrobe.\n\nBackup: ${wData}`);
    logInfo("Backup wardrobe", wData);
  }
  return wardrobe;
}

export default async function extendedWardrobe(): Promise<void> {
  await waitFor(() => !!ServerSocket);

  SDK.hookFunction("CharacterCompressWardrobe", HOOK_PRIORITIES.Top, ([wardrobe], next) => {
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
  });

  SDK.hookFunction("WardrobeLoadCharacterNames", HOOK_PRIORITIES.ModifyBehaviourMedium, (args, next) => {
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
  });
}
