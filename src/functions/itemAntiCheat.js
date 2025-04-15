import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { debug } from "../util/logger";
import { fbcSettings } from "../util/settings";
import { deepCopy, mustNum, fbcChatNotify, fbcSendAction } from "../util/utils";
import { displayText } from "../util/localization";

export default function itemAntiCheat() {
  /** @type {Map<number, number>} */
  const noticesSent = new Map();

  /** @type {(sourceCharacter: Character, newItem: ItemBundle) => boolean} */
  function validateNewLockMemberNumber(sourceCharacter, newItem) {
    if (!newItem.Name || !newItem.Property?.LockedBy) {
      return true;
    }
    if (newItem.Property?.LockMemberNumber !== sourceCharacter.MemberNumber) {
      debug("Bad lock member number", newItem.Property?.LockMemberNumber, "from", sourceCharacter.MemberNumber);
      return false;
    }
    return true;
  }

  /** @type {(sourceCharacter: Character, oldItem: ItemBundle | null, newItem: ItemBundle | null, ignoreLocks: boolean, ignoreColors: boolean) => { changed: number; prohibited: boolean }} */
  function validateSingleItemChange(sourceCharacter, oldItem, newItem, ignoreLocks, ignoreColors) {
    const changes = {
      changed: 0,
      prohibited: false,
    };

    if (sourceCharacter.IsPlayer()) {
      return changes;
    }

    const sourceName = `${CharacterNickname(sourceCharacter)} (${sourceCharacter.MemberNumber ?? "-1"})`;

    /** @type {(item: ItemBundle | null) => ItemBundle | null} */
    function deleteUnneededMetaData(item) {
      if (!item) {
        return item;
      }
      const clone = deepCopy(item);
      if (!clone) {
        return clone;
      }
      if (clone.Property) {
        if (ignoreLocks) {
          delete clone.Property.LockMemberNumber;
          delete clone.Property.LockedBy;
          delete clone.Property.RemoveTimer;
          delete clone.Property.Effect;
        }
        delete clone.Property.BlinkState;
      }
      if (ignoreColors) {
        delete clone.Color;
      }
      return clone;
    }

    // eslint-disable-next-line complexity
    function validateMistressLocks() {
      const sourceCanBeMistress =
        (sourceCharacter?.Reputation?.find(a => a.Type === "Dominant")?.Value ?? 0) >= 50 ||
        sourceCharacter.Title === "Mistress";

      if (
        sourceCanBeMistress ||
        sourceCharacter.MemberNumber === Player.Ownership?.MemberNumber ||
        Player.Lovership?.some(a => a.MemberNumber === sourceCharacter.MemberNumber)
      ) {
        return;
      }

      // Removal
      if (
        (oldItem?.Property?.LockedBy === "MistressPadlock" && newItem?.Property?.LockedBy !== "MistressPadlock") ||
        (oldItem?.Property?.LockedBy === "MistressTimerPadlock" && newItem?.Property?.LockedBy !== "MistressTimerPadlock")
      ) {
        debug("Not a mistress attempting to remove mistress lock", sourceName);
        changes.prohibited = true;
      }

      // Addition
      if (
        (oldItem?.Property?.LockedBy !== "MistressPadlock" && newItem?.Property?.LockedBy === "MistressPadlock") ||
        (oldItem?.Property?.LockedBy !== "MistressTimerPadlock" && newItem?.Property?.LockedBy === "MistressTimerPadlock")
      ) {
        debug("Not a mistress attempting to add mistress lock", sourceName);
        changes.prohibited = true;
      }

      // Timer change
      if (
        oldItem?.Property?.LockedBy === "MistressTimerPadlock" &&
        Math.abs(mustNum(oldItem.Property?.RemoveTimer, Number.MAX_SAFE_INTEGER) - mustNum(newItem?.Property?.RemoveTimer)) > 31 * 60 * 1000
      ) {
        changes.prohibited = true;
        debug("Not a mistress attempting to change mistress lock timer more than allowed by public entry", sourceName);
      }
    }

    // Validate lock changes
    if (newItem && newItem.Property?.LockMemberNumber !== oldItem?.Property?.LockMemberNumber) {
      if (!validateNewLockMemberNumber(sourceCharacter, newItem)) {
        changes.prohibited = true;
      }
    }
    validateMistressLocks();

    newItem = deleteUnneededMetaData(newItem);
    oldItem = deleteUnneededMetaData(oldItem);

    if (JSON.stringify(newItem) !== JSON.stringify(oldItem)) {
      debug(sourceName, "changed", JSON.stringify(oldItem), "to", JSON.stringify(newItem), "changes:", changes);
      changes.changed++;
    }
    return changes;
  }

  /** @type {(sourceCharacter: Character) => void} */
  function revertChanges(sourceCharacter) {
    if (typeof sourceCharacter.MemberNumber !== "number") {
      throw new Error("change from invalid source character with no member number");
    }

    const sourceName = `${CharacterNickname(sourceCharacter)} (${sourceCharacter.MemberNumber ?? "-1"})`;
    debug("Rejected changes from", sourceName);
    fbcChatNotify(
      displayText(
        '[Anti-Cheat] $sourceName tried to make suspicious changes! Appearance changes rejected. Consider telling the user to stop, whitelisting the user (if trusted friend), or blacklisting the user (if the behaviour continues, chat command: "/blacklistadd $sourceNumber").',
        { $sourceName: sourceName, $sourceNumber: `${sourceCharacter.MemberNumber}` }
      )
    );

    const noticeSent = noticesSent.get(sourceCharacter.MemberNumber) || 0;
    if (Date.now() - noticeSent > 1000 * 60 * 10) {
      noticesSent.set(sourceCharacter.MemberNumber, Date.now());
      fbcSendAction(
        displayText(
          "A magical shield on $playerName repelled the suspiciously magical changes attempted by $sourceName! [WCE Anti-Cheat]",
          { $playerName: CharacterNickname(Player), $sourceName: sourceName })
      );
    }
    if (
      fbcSettings.antiCheatBlackList &&
      !Player.WhiteList.includes(sourceCharacter.MemberNumber) &&
      !Player.BlackList.includes(sourceCharacter.MemberNumber)
    ) {
      ChatRoomListManipulation(Player.BlackList, true, sourceCharacter.MemberNumber.toString());
      fbcChatNotify(displayText("[AntiCheat] $sourceName blacklisted.", { $sourceName: sourceName }));
    }
    ChatRoomCharacterUpdate(Player);
  }

  SDK.hookFunction(
    "ChatRoomSyncItem",
    HOOK_PRIORITIES.OverrideBehaviour,
    (args, next) => {
      const [data] = args;
      if (!fbcSettings.itemAntiCheat) {
        return next(args);
      }
      const item = /** @type {{ Target: number; } & ItemBundle} */ (data?.Item);
      if (item?.Target !== Player.MemberNumber) {
        return next(args);
      }
      if (Player.WhiteList.includes(data.Source)) {
        return next(args);
      }
      const sourceCharacter =
        ChatRoomCharacter.find(a => a.MemberNumber === data.Source) ||
        (data.Source === Player.MemberNumber ? Player : null);

      if (!sourceCharacter) {
        throw new Error("change from invalid source character not in the current room");
      }

      const ignoreLocks = Player.Appearance.some(a => a.Asset.Name === "FuturisticCollar");
      const ignoreColors = Player.Appearance.some(a => a.Asset.Name === "FuturisticHarness") || ignoreLocks;
      const oldItem = Player.Appearance.find(i => i.Asset.Group.Name === item.Group);
      const oldItemBundle = oldItem ? ServerAppearanceBundle([oldItem])[0] : null;
      const result = validateSingleItemChange(sourceCharacter, oldItemBundle, item, ignoreLocks, ignoreColors);
      if (result.prohibited) {
        revertChanges(sourceCharacter);
        return null;
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "ChatRoomSyncSingle",
    HOOK_PRIORITIES.OverrideBehaviour,
    (args, next) => {
      const [data] = args;
      if (!fbcSettings.itemAntiCheat) {
        return next(args);
      }
      if (!data?.Character) {
        return next(args);
      }
      if (data.Character.MemberNumber !== Player.MemberNumber) {
        return next(args);
      }
      if (Player.WhiteList.includes(data.SourceMemberNumber)) {
        return next(args);
      }

      const sourceCharacter =
        ChatRoomCharacter.find(a => a.MemberNumber === data.SourceMemberNumber) ||
        (data.SourceMemberNumber === Player.MemberNumber ? Player : null);

      if (!sourceCharacter) {
        throw new Error("change from invalid source character not in the current room");
      }

      if (sourceCharacter.IsPlayer()) {
        return next(args);
      }

      // Gets the item bundles to be used for diff comparison, also making necessary changes for the purpose
      /** @type {(bundle: ItemBundle[]) => Map<string, ItemBundle>} */
      function processItemBundleToMap(bundle) {
        /** @type {(Map<string, ItemBundle>)} */
        const initial = new Map();
        return bundle.reduce((prev, cur) => {
          // Ignoring color changes
          cur = deepCopy(cur);
          delete cur.Color;
          prev.set(`${cur.Group}/${cur.Name}`, cur);
          return prev;
        }, initial);
      }

      // Number of items changed in appearance
      const oldItems = processItemBundleToMap(
        ServerAppearanceBundle(Player.Appearance.filter(a => a.Asset.Group.Category === "Item"))
      );

      if (!data.Character.Appearance) {
        throw new Error("no appearance data in sync single");
      }

      const newItems = processItemBundleToMap(
        data.Character.Appearance.filter(a => ServerBundledItemToAppearanceItem("Female3DCG", a)?.Asset.Group.Category === "Item")
      );

      // Locks can be modified enmass with futuristic collar
      const ignoreLocks = Array.from(oldItems.values()).some(i => i.Name === "FuturisticCollar") &&
        Array.from(newItems.values()).some(i => i.Name === "FuturisticCollar");
      const ignoreColors = (Array.from(oldItems.values()).some(i => i.Name === "FuturisticHarness") &&
        Array.from(newItems.values()).some(i => i.Name === "FuturisticHarness")) ||
        ignoreLocks;

      debug("Anti-Cheat validating bulk change from", sourceCharacter.MemberNumber);

      // Count number of new items
      const newAndChanges = Array.from(newItems.keys()).reduce(
        (changes, cur) => {
          const newItem = newItems.get(cur);
          if (!newItem) {
            throw new Error("this should never happen: newItem is null inside map loop");
          }
          if (!oldItems.has(cur)) {
            // Item is new, validate it and mark as new
            if (!validateNewLockMemberNumber(sourceCharacter, newItem)) {
              changes.prohibited = true;
            }
            changes.new++;
            return changes;
          }
          const oldItem = oldItems.get(cur) ?? null;
          const result = validateSingleItemChange(sourceCharacter, oldItem, newItem, ignoreLocks, ignoreColors);
          changes.prohibited = changes.prohibited || result.prohibited;
          changes.changed += result.changed;
          return changes;
        },
        { new: 0, changed: 0, prohibited: false }
      );

      // Count number of removed items
      const removed = Array.from(oldItems.keys()).reduce((prev, cur) => {
        if (!newItems.has(cur)) {
          return prev + 1;
        }
        return prev;
      }, 0);
      if (newAndChanges.new + newAndChanges.changed + removed > 2 || newAndChanges.prohibited) {
        debug("Anti-Cheat tripped on bulk change from", sourceCharacter.MemberNumber, newAndChanges, removed);
        revertChanges(sourceCharacter);
        return null;
      }
      return next(args);
    }
  );
}
