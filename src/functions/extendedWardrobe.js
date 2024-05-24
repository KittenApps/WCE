import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcBeepNotify } from "../util/hooks";
import { waitFor, isWardrobe, parseJSON } from "../util/utils";
import { logInfo, logError } from "../util/logger";
import { fbcSettings } from "../util/settings";
import { DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE } from "../util/constants";

/** @type {import("dexie").Table<any, import("dexie").IndexableType, any>} */
let localWardrobeTable;

/** @type {(wardrobe: ItemBundle[][]) => Promise<void>} */
export async function loadLocalWardrobe(wardrobe) {
  const { Dexie } = await import("dexie");
  const db = new Dexie("wce-local-wardrobe");
  db.version(1).stores({
    wardrobe: "id, appearance",
  });
  localWardrobeTable = db.table("wardrobe");
  /** @type {{id: number, appearance: ServerItemBundle[]}[]} */
  const localWardrobe = (await localWardrobeTable.toArray()) || [];
  wardrobe.push(...localWardrobe.map((w) => sanitizeBundles(w.appearance)));
}

/** @type {(wardrobe: ServerItemBundle[][]) => Promise<void>} */
async function saveLocalWardrobe(wardrobe) {
  await localWardrobeTable.bulkPut(wardrobe.map((appearance, id) => ({ id, appearance })));
}

/**
 * Convert old {@link ItemProperties.Type} remnants into {@link ItemProperties.TypeRecord} in the passed item bundles.
 * @param {ItemBundle[]} bundleList
 */
function sanitizeBundles(bundleList) {
  if (!Array.isArray(bundleList)) {
    return bundleList;
  }
  return bundleList.map((bundle) => {
    if (
      // eslint-disable-next-line deprecation/deprecation
      typeof bundle.Property?.Type === "string" &&
      !CommonIsObject(bundle.Property?.TypeRecord)
    ) {
      const asset = AssetGet("Female3DCG", bundle.Group, bundle.Name);
      if (asset) {
        bundle.Property.TypeRecord = ExtendedItemTypeToRecord(
          asset,
          // eslint-disable-next-line deprecation/deprecation
          bundle.Property.Type
        );
      }
    }
    return bundle;
  });
}

/** @type {(wardrobe: ItemBundle[][]) => ItemBundle[][]} */
export function loadExtendedWardrobe(wardrobe) {
  if (fbcSettings.extendedWardrobe) {
    WardrobeSize = EXPANDED_WARDROBE_SIZE;
    WardrobeFixLength();
  }

  /** @type {string} */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, deprecation/deprecation
  const wardrobeData =
    Player.ExtensionSettings.FBCWardrobe ||
    Player.OnlineSettings?.BCEWardrobe;
  if (wardrobeData) {
    // eslint-disable-next-line deprecation/deprecation
    if (Player.OnlineSettings?.BCEWardrobe) {
      Player.ExtensionSettings.FBCWardrobe = wardrobeData;
      ServerPlayerExtensionSettingsSync("FBCWardrobe");
      logInfo("Migrated wardrobe from OnlineSettings to ExtensionSettings");
      // eslint-disable-next-line deprecation/deprecation
      delete Player.OnlineSettings.BCEWardrobe;
    }
    try {
      const additionalItemBundle = /** @type {ItemBundle[][]} */ (
        parseJSON(LZString.decompressFromUTF16(wardrobeData))
      );
      if (isWardrobe(additionalItemBundle)) {
        for (let i = DEFAULT_WARDROBE_SIZE; i < EXPANDED_WARDROBE_SIZE; i++) {
          const additionalIdx = i - DEFAULT_WARDROBE_SIZE;
          if (additionalIdx >= additionalItemBundle.length) {
            break;
          }
          wardrobe[i] = sanitizeBundles(additionalItemBundle[additionalIdx]);
        }
      }
    } catch (e) {
      logError("Failed to load extended wardrobe", e);
      fbcBeepNotify("Wardrobe error", `Failed to load extended wardrobe.\n\nBackup: ${wardrobeData}`);
      logInfo("Backup wardrobe", wardrobeData);
    }
  }
  return wardrobe;
}

export default async function extendedWardrobe() {
  await waitFor(() => !!ServerSocket);

  SDK.hookFunction(
    "CharacterCompressWardrobe",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof CharacterCompressWardrobe>} args
     */
    (args, next) => {
      const [wardrobe] = args;
      if (isWardrobe(wardrobe)) {
        const additionalWardrobe = wardrobe.slice(DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE);
        if (additionalWardrobe.length > 0) {
          Player.ExtensionSettings.FBCWardrobe = LZString.compressToUTF16(JSON.stringify(additionalWardrobe));
          args[0] = wardrobe.slice(0, DEFAULT_WARDROBE_SIZE);
          ServerPlayerExtensionSettingsSync("FBCWardrobe");
          const additionalLocalWardrobe = wardrobe.slice(EXPANDED_WARDROBE_SIZE);
          if (additionalLocalWardrobe.length > 0) saveLocalWardrobe(additionalLocalWardrobe);
        }
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "WardrobeLoadCharacterNames",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof WardrobeLoadCharacterNames>} args
     */
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
