import { openDB } from "idb";

import { displayText } from "../util/localization";
import { debug, logInfo, logWarn, logError } from "../util/logger";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { deepCopy, parseJSON, isCharacter, isNonNullObject, drawTextFitLeft, fbcChatNotify } from "../util/utils";

export default async function pastProfiles() {
  if (!fbcSettings.pastProfiles) {
    return;
  }

  /** @type {import("idb").IDBPDatabase<{profiles: { key: number; value: FBCSavedProfile }; notes: { key: number; value: FBCNote }}>}*/
  const db = await openDB("bce-past-profiles", 30, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("profiles")) db.createObjectStore("profiles", { keyPath: "memberNumber" });
      if (!db.objectStoreNames.contains("notes")) db.createObjectStore("notes", { keyPath: "memberNumber" });
    },
  });

  ElementCreateTextArea("bceNoteInput");
  /** @type {HTMLTextAreaElement} */
  // @ts-expect-error
  const noteInput = document.getElementById("bceNoteInput");
  noteInput.maxLength = 10000;
  noteInput.classList.add("bce-hidden");

  async function readQuota() {
    try {
      const { quota, usage } = await navigator.storage.estimate();
      debug(`current quota usage ${usage?.toLocaleString() ?? "?"} out of maximum ${quota?.toLocaleString() ?? "?"}`);
      return { quota: quota ?? -1, usage: usage ?? 0 };
    } catch (e) {
      logError("reading storage quota information", e);
      return { quota: -1, usage: -1 };
    }
  }

  /**
   * @param {number} num
   * @returns {Promise<void>}
   */
  async function trimProfiles(num) {
    /** @type {FBCSavedProfile[]} */
    let list = await db.getAll("profiles");
    // Oldest first
    list.sort((a, b) => a.seen - b.seen);
    list = list.slice(0, num);
    debug("deleting", list);
    const store = db.transaction("profiles", "readwrite").objectStore("profiles");
    await Promise.all(list.map(p => store.delete(p.memberNumber)));
  }

  async function quotaSafetyCheck() {
    const { quota, usage } = await readQuota();
    if (usage / quota > 0.9) {
      logInfo(`storage quota above 90% utilization (${usage}/${quota}), cleaning some of the least recently seen profiles before saving new one`);
      await trimProfiles(10);
    }
  }

  /**
   * @param {ServerAccountDataSynced} characterBundle
   * @returns {Promise<void>}
   */
  async function saveProfile(characterBundle) {
    await quotaSafetyCheck();

    const name = characterBundle.Name;
    const nick = characterBundle.Nickname;

    // Delete unnecessary data
    /** @type {(keyof ServerAccountDataSynced)[]} */
    const unnecessaryFields = [
      "ActivePose",
      "Inventory",
      "BlockItems",
      "LimitedItems",
      "FavoriteItems",
      "ArousalSettings",
      "OnlineSharedSettings",
      "WhiteList",
      "BlackList",
      "Crafting",
    ];
    for (const field of unnecessaryFields) {
      delete characterBundle[field];
    }

    debug(`saving profile of ${nick ?? name} (${name})`);
    try {
      await db.put("profiles", {
        memberNumber: characterBundle.MemberNumber,
        name,
        lastNick: nick,
        seen: Date.now(),
        characterBundle: JSON.stringify(characterBundle),
      });
    } catch (e) {
      const { quota, usage } = await readQuota();
      logError(`unable to save profile (${usage}/${quota}):`, e);
    }
  }

  SDK.hookFunction("ChatRoomSync", HOOK_PRIORITIES.Top, (args, next) => {
    const [data] = args;
    if (data?.Character?.length) {
      for (const char of data.Character) {
        saveProfile(deepCopy(char));
      }
    }
    return next(args);
  });

  SDK.hookFunction("ChatRoomSyncSingle", HOOK_PRIORITIES.Top, (args, next) => {
    const [data] = args;
    if (data?.Character?.MemberNumber) {
      saveProfile(deepCopy(data.Character));
    }
    return next(args);
  });

  SDK.hookFunction("InformationSheetRun", HOOK_PRIORITIES.AddBehaviour, (args, next) => {
    if (!InformationSheetSelection) {
      throw new Error("InformationSheetSelection is null in InformationSheetRun");
    }
    if (InformationSheetSelection.BCESeen) {
      const ctx = window.MainCanvas.getContext("2d");
      if (!ctx) {
        throw new Error("could not get canvas 2d context");
      }
      ctx.textAlign = "left";
      DrawText(displayText("Last seen: ") + new Date(InformationSheetSelection.BCESeen).toLocaleString(), 1200, 75, "grey", "black");
      ctx.textAlign = "center";
    }
    return next(args);
  });

  /**
   * @param {number} memberNumber
   * @returns {Promise<void>}
   */
  async function openCharacter(memberNumber) {
    try {
      const profile = await db.get("profiles", memberNumber);
      const C = CharacterLoadOnline(/** @type {ServerAccountDataSynced} */ (parseJSON(profile.characterBundle)), memberNumber);
      C.BCESeen = profile.seen;
      if (CurrentScreen === "ChatRoom") {
        ChatRoomHideElements();
        if (ChatRoomData) {
          ChatRoomBackground = ChatRoomData.Background;
        }
      }
      InformationSheetLoadCharacter(C);
    } catch (e) {
      fbcChatNotify(displayText("No profile found"));
      logError("reading profile", e);
    }
  }

  CommandCombine({
    Tag: "profiles",
    Description: displayText("<filter> - List seen profiles, optionally searching by member number or name"),
    Action: argums => {
      (async args => {
        /** @type {FBCSavedProfile[]} */
        let list = await db.getAll("profiles");
        list = list.filter(
          p => !args || p.name.toLowerCase().includes(args) || p.memberNumber.toString().includes(args) || p.lastNick?.toLowerCase().includes(args)
        );
        list.sort((a, b) => b.seen - a.seen);
        const matches = list.length;
        list = list.slice(0, 100);
        list.sort((a, b) => -(b.lastNick ?? b.name).localeCompare(a.lastNick ?? a.name));
        const lines = list.map(p => {
          const div = document.createElement("div");
          div.textContent = displayText("$nickAndName ($memberNumber) - Seen: $seen", {
            $nickAndName: p.lastNick ? `${p.lastNick} / ${p.name}` : p.name,
            $memberNumber: p.memberNumber.toString(),
            $seen: new Date(p.seen).toLocaleDateString(),
          });
          const link = document.createElement("a");
          link.textContent = displayText("Open");
          link.href = "#";
          link.classList.add("bce-profile-open");
          link.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            openCharacter(p.memberNumber);
          });
          div.prepend(link);
          return div;
        });
        const header = document.createElement("h3");
        header.textContent = displayText("Saved Profiles");
        header.style.marginTop = "0";
        const footer = document.createElement("div");
        footer.textContent = displayText("showing $num most recent of $total total profiles matching search", {
          $num: list.length.toLocaleString(),
          $total: matches.toLocaleString(),
        });
        fbcChatNotify([header, ...lines, footer]);
      })(argums.toLowerCase());
    },
  });

  // Notes view
  let inNotes = false;
  let noteUpdatedAt = 0;

  /**
   * @param {unknown} n
   * @returns {n is FBCNote}
   */
  function isNote(n) {
    return isNonNullObject(n) && typeof n.note === "string";
  }

  function showNoteInput() {
    if (!InformationSheetSelection?.MemberNumber) {
      throw new Error("invalid InformationSheetSelection in notes");
    }

    inNotes = true;
    noteInput.classList.remove("bce-hidden");
    noteInput.value = "Loading...";
    db.get("notes", InformationSheetSelection.MemberNumber)
      .then(note => {
        if (isNote(note)) {
          noteInput.value = note?.note || "";
          noteUpdatedAt = note?.updatedAt || 0;
        } else {
          throw new Error("invalid note");
        }
      })
      .catch((/** @type {unknown} */ reason) => {
        noteInput.value = "";
        logError("getting note", reason);
      });
  }

  SDK.hookFunction("CharacterLoadOnline", HOOK_PRIORITIES.Top, (args, next) => {
    const C = next(args);
    if (isCharacter(C) && C.MemberNumber) {
      db.get("notes", C.MemberNumber).then(note => {
        C.FBCNoteExists = Boolean(isNote(note) && note.note);
      });
    }
    return C;
  });

  function hideNoteInput() {
    noteInput.classList.add("bce-hidden");
    inNotes = false;
  }

  /**
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  function keyHandler(e) {
    if (e.key === "Escape" && inNotes) {
      hideNoteInput();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  document.addEventListener("keydown", keyHandler, true);
  document.addEventListener("keypress", keyHandler, true);

  SDK.hookFunction("OnlineProfileRun", HOOK_PRIORITIES.OverrideBehaviour, (args, next) => {
    if (inNotes) {
      DrawText(displayText("Personal notes (only you can read these):"), 910, 105, "Black", "Gray");
      if (noteUpdatedAt) {
        drawTextFitLeft(displayText("Last saved: $date", { $date: new Date(noteUpdatedAt).toLocaleString() }), 60, 105, 400, "Black", "Gray");
      }
      ElementPositionFix("bceNoteInput", 36, 100, 160, 1790, 750);
      // Always draw the accept button; normal method shows it when is player
      DrawButton(1720, 60, 90, 90, "", "White", "Icons/Accept.png", TextGet("LeaveSave"));
      DrawButton(1820, 60, 90, 90, "", "White", "Icons/Cancel.png", TextGet("LeaveNoSave"));
      return null;
    }
    DrawButton(1520, 60, 90, 90, "", "White", "Icons/Notifications.png", displayText("[WCE] Notes"));
    return next(args);
  });

  SDK.hookFunction("OnlineProfileClick", HOOK_PRIORITIES.OverrideBehaviour, (args, next) => {
    if (inNotes) {
      if (MouseIn(1720, 60, 90, 90)) {
        quotaSafetyCheck().then(() => {
          if (!InformationSheetSelection?.MemberNumber) {
            throw new Error("invalid InformationSheetSelection in notes");
          }
          return db.put("notes", { memberNumber: InformationSheetSelection.MemberNumber, note: noteInput.value, updatedAt: Date.now() });
        });
        hideNoteInput();
      } else if (MouseIn(1820, 60, 90, 90)) {
        hideNoteInput();
      }
      return null;
    } else if (!inNotes && MouseIn(1520, 60, 90, 90)) showNoteInput();
    return next(args);
  });

  if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
    if (!(await navigator.storage.persist())) {
      logWarn("Profile storage may not be persistent.");
    }
  }
}
