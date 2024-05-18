import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { deepCopy, parseJSON, isCharacter, isNonNullObject, drawTextFitLeft, fbcChatNotify } from "../util/utils";
import { debug, logInfo, logWarn, logError } from "../util/logger";
import { displayText } from "../util/localization";

function hideChatRoomElements() {
  const chatRoomElements = ["InputChat", "TextAreaChatLog"];
  for (const id of chatRoomElements) {
    const el = document.getElementById(id);
    if (el) {
      el.style.display = "none";
    }
  }
  ChatRoomChatHidden = true;
}

export default async function pastProfiles() {
  if (!fbcSettings.pastProfiles) {
    return;
  }

  const d = await import('dexie');
  const db = new d.Dexie("bce-past-profiles");
  db.version(3).stores({
    profiles: "memberNumber, name, lastNick, seen, characterBundle",
    notes: "memberNumber, note, updatedAt",
  });

  ElementCreateTextArea("bceNoteInput");
  /** @type {HTMLTextAreaElement} */
  // @ts-ignore
  const noteInput = document.getElementById("bceNoteInput");
  noteInput.maxLength = 10000;
  noteInput.classList.add("bce-hidden");

  const profiles = db.table("profiles");
  const notes = db.table("notes");

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

  /** @type {(num: number) => Promise<void>} */
  async function trimProfiles(num) {
    /** @type {FBCSavedProfile[]} */
    let list = await profiles.toArray();
    // Oldest first
    list.sort((a, b) => a.seen - b.seen);
    list = list.slice(0, num);
    debug("deleting", list);
    await profiles.bulkDelete(list.map((p) => p.memberNumber));
  }

  async function quotaSafetyCheck() {
    const { quota, usage } = await readQuota();
    if (usage / quota > 0.9) {
      logInfo(
        `storage quota above 90% utilization (${usage}/${quota}), cleaning some of the least recently seen profiles before saving new one`
      );
      await trimProfiles(10);
    }
  }

  /** @type {(characterBundle: ServerAccountDataSynced) => Promise<void>} */
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
      await profiles.put({
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

  SDK.hookFunction(
    "ChatRoomSync",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof ChatRoomSync>} args
     */
    (args, next) => {
      const [data] = args;
      if (data?.Character?.length) {
        for (const char of data.Character) {
          saveProfile(deepCopy(char));
        }
      }
      next(args);
    }
  );

  SDK.hookFunction(
    "ChatRoomSyncSingle",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof ChatRoomSyncSingle>} args
     */
    (args, next) => {
      const [data] = args;
      if (data?.Character?.MemberNumber) {
        saveProfile(deepCopy(data.Character));
      }
      next(args);
    }
  );

  SDK.hookFunction(
    "InformationSheetRun",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof InformationSheetRun>} args
     */
    (args, next) => {
      if (!InformationSheetSelection) {
        throw new Error("InformationSheetSelection is null in InformationSheetRun");
      }
      if (InformationSheetSelection.BCESeen) {
        const ctx = window.MainCanvas.getContext("2d");
        if (!ctx) {
          throw new Error("could not get canvas 2d context");
        }
        ctx.textAlign = "left";
        DrawText(
          displayText("Last seen: ") + new Date(InformationSheetSelection.BCESeen).toLocaleString(),
          1200,
          75,
          "grey",
          "black"
        );
        ctx.textAlign = "center";
      }
      return next(args);
    }
  );

  /** @type {(memberNumber: number) => Promise<void>} */
  async function openCharacter(memberNumber) {
    try {
      /** @type {FBCSavedProfile} */
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const profile = await profiles.get(memberNumber);
      const C = CharacterLoadOnline(
        /** @type {ServerAccountDataSynced} */ (parseJSON(profile.characterBundle)),
        memberNumber
      );
      C.BCESeen = profile.seen;
      if (CurrentScreen === "ChatRoom") {
        hideChatRoomElements();
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

  Commands.push({
    Tag: "profiles",
    Description: displayText("<filter> - List seen profiles, optionally searching by member number or name"),
    Action: (argums) => {
      (async (args) => {
        /** @type {FBCSavedProfile[]} */
        let list = await profiles.toArray();
        list = list.filter(
          (p) =>
            !args ||
            p.name.toLowerCase().includes(args) ||
            p.memberNumber.toString().includes(args) ||
            p.lastNick?.toLowerCase().includes(args)
        );
        list.sort((a, b) => b.seen - a.seen);
        const matches = list.length;
        list = list.slice(0, 100);
        list.sort((a, b) => -(b.lastNick ?? b.name).localeCompare(a.lastNick ?? a.name));
        const lines = list.map((p) => {
          const div = document.createElement("div");
          div.textContent = displayText(`$nickAndName ($memberNumber) - Seen: $seen`, {
            $nickAndName: p.lastNick ? `${p.lastNick} / ${p.name}` : p.name,
            $memberNumber: p.memberNumber.toString(),
            $seen: new Date(p.seen).toLocaleDateString(),
          });
          const link = document.createElement("a");
          link.textContent = displayText("Open");
          link.href = `#`;
          link.classList.add("bce-profile-open");
          link.addEventListener("click", (e) => {
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
      })(argums);
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
    if (!InformationSheetSelection || !InformationSheetSelection.MemberNumber) {
      throw new Error("invalid InformationSheetSelection in notes");
    }

    inNotes = true;
    noteInput.classList.remove("bce-hidden");
    noteInput.value = "Loading...";
    notes
      .get(InformationSheetSelection.MemberNumber)
      .then((note) => {
        if (isNote(note)) {
          noteInput.value = note?.note || "";
          noteUpdatedAt = note?.updatedAt || 0;
        } else {
          throw new Error("invalid note");
        }
      })
      .catch((reason) => {
        noteInput.value = "";
        logError("getting note", reason);
      });
  }

  SDK.hookFunction(
    "CharacterLoadOnline",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof CharacterLoadOnline>} args
     */
    (args, next) => {
      const C = next(args);
      if (isCharacter(C) && C.MemberNumber) {
        notes.get(C.MemberNumber).then((note) => {
          C.FBCNoteExists = Boolean(isNote(note) && note.note);
        });
      }
      return C;
    }
  );

  function hideNoteInput() {
    noteInput.classList.add("bce-hidden");
    inNotes = false;
  }

  /** @type {(e: KeyboardEvent) => void} */
  function keyHandler(e) {
    if (e.key === "Escape" && inNotes) {
      hideNoteInput();
      e.stopPropagation();
      e.preventDefault();
    }
  }

  document.addEventListener("keydown", keyHandler, true);
  document.addEventListener("keypress", keyHandler, true);

  SDK.hookFunction(
    "OnlineProfileRun",
    HOOK_PRIORITIES.OverrideBehaviour,
    /**
     * @param {Parameters<typeof OnlineProfileRun>} args
     */
    (args, next) => {
      if (inNotes) {
        DrawText(displayText("Personal notes (only you can read these):"), 910, 105, "Black", "Gray");
        if (noteUpdatedAt) {
          drawTextFitLeft(
            displayText("Last saved: $date", {
              $date: new Date(noteUpdatedAt).toLocaleString(),
            }),
            60,
            105,
            400,
            "Black",
            "Gray"
          );
        }
        ElementPositionFix("bceNoteInput", 36, 100, 160, 1790, 750);
        // Always draw the accept button; normal method shows it when is player
        DrawButton(1720, 60, 90, 90, "", "White", "Icons/Accept.png", TextGet("LeaveSave"));
        DrawButton(1820, 60, 90, 90, "", "White", "Icons/Cancel.png", TextGet("LeaveNoSave"));
        return null;
      }
      DrawButton(1620, 60, 90, 90, "", "White", "Icons/Notifications.png", displayText("[WCE] Notes"));
      return next(args);
    }
  );

  SDK.hookFunction(
    "OnlineProfileClick",
    HOOK_PRIORITIES.OverrideBehaviour,
    /**
     * @param {Parameters<typeof OnlineProfileClick>} args
     */
    (args, next) => {
      if (inNotes) {
        if (MouseIn(1720, 60, 90, 90)) {
          (async function () {
            await quotaSafetyCheck();

            if (!InformationSheetSelection || !InformationSheetSelection.MemberNumber) {
              throw new Error("invalid InformationSheetSelection in notes");
            }

            // Save note
            await notes.put({
              memberNumber: InformationSheetSelection.MemberNumber,
              note: noteInput.value,
              updatedAt: Date.now(),
            });
          })();
          hideNoteInput();
        } else if (MouseIn(1820, 60, 90, 90)) {
          hideNoteInput();
        }
        return;
      } else if (!inNotes && MouseIn(1620, 60, 90, 90)) {
        showNoteInput();
      }
      next(args);
    }
  );

  if (navigator.storage?.persisted && !(await navigator.storage.persisted())) {
    if (!(await navigator.storage.persist())) {
      logWarn("Profile storage may not be persistent.");
    }
  }
}
