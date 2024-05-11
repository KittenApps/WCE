import { SDK, HOOK_PRIORITIES, DEFAULT_WARDROBE_SIZE, EXPANDED_WARDROBE_SIZE, fbcBeepNotify } from "..";
import { waitFor, isWardrobe, parseJSON } from "../util/utils";
import { logInfo, logError } from "../util/logger";
import { fbcSettings } from "../util/settings";

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

  const wardrobeData =
    Player.ExtensionSettings.FBCWardrobe ||
    // eslint-disable-next-line deprecation/deprecation
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

export async function extendedWardrobe() {
  await waitFor(() => !!ServerSocket);

  SDK.hookFunction(
    "CharacterDecompressWardrobe",
    HOOK_PRIORITIES.ModifyBehaviourMedium,
    /**
     * @param {Parameters<typeof CharacterDecompressWardrobe>} args
     */
    (args, next) => {
      let wardrobe = next(args);
      if (isWardrobe(wardrobe) && fbcSettings.extendedWardrobe && wardrobe.length < EXPANDED_WARDROBE_SIZE) {
        wardrobe = loadExtendedWardrobe(wardrobe);
      }
      return wardrobe;
    }
  );

  SDK.hookFunction(
    "CharacterCompressWardrobe",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof CharacterCompressWardrobe>} args
     */
    (args, next) => {
      const [wardrobe] = args;
      if (isWardrobe(wardrobe)) {
        const additionalWardrobe = wardrobe.slice(DEFAULT_WARDROBE_SIZE);
        if (additionalWardrobe.length > 0) {
          Player.ExtensionSettings.FBCWardrobe = LZString.compressToUTF16(JSON.stringify(additionalWardrobe));
          args[0] = wardrobe.slice(0, DEFAULT_WARDROBE_SIZE);
          ServerPlayerExtensionSettingsSync("FBCWardrobe");
        }
      }
      return next(args);
    }
  );
}
