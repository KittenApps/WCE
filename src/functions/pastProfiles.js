import { openDB } from "idb";

import { displayText } from "../util/localization";
import { debug, logInfo, logWarn, logError } from "../util/logger";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { deepCopy, parseJSON, isCharacter, isNonNullObject, drawTextFitLeft, fbcChatNotify } from "../util/utils";

const PROFILE_SHARE_PREFIX = "[PROFILESHARE]";
const PROFILE_SHARE_OPEN = "PROFILESHARE_OPEN";
const PROFILE_SHARE_CHUNK_SIZE = 800;
const PROFILE_SHARE_MAX_CHUNKS = 512;
const PROFILE_SHARE_MAX_BYTES = PROFILE_SHARE_CHUNK_SIZE * PROFILE_SHARE_MAX_CHUNKS;
const PROFILE_SHARE_MAX_INCOMING = 24;
const PROFILE_SHARE_MAX_PER_SENDER = 4;
const PROFILE_SHARE_TTL = 2 * 60 * 1000;

export default async function pastProfiles() {
  if (!fbcSettings.pastProfiles) {
    return;
  }

  /** @type {import("idb").IDBPDatabase<{profiles: { key: number; value: FBCSavedProfile }; notes: { key: number; value: FBCNote }}>}*/
  const db = await openDB("bce-past-profiles", 31, {
    upgrade(odb, ov, nv, tx) {
      if (!odb.objectStoreNames.contains("profiles")) odb.createObjectStore("profiles", { keyPath: "memberNumber" });
      for (const idx of tx.objectStore("profiles").indexNames) tx.objectStore("profiles").deleteIndex(idx);
      if (!odb.objectStoreNames.contains("notes")) odb.createObjectStore("notes", { keyPath: "memberNumber" });
      for (const idx of tx.objectStore("notes").indexNames) tx.objectStore("notes").deleteIndex(idx);
    },
  });

  /** @type {Map<string, {total: number; sender: number; chunks: (string | undefined)[]; count: number; bytes: number; updatedAt: number}>} */
  const incomingShares = new Map();
  /** @type {Map<string, {payload: WCEProfileSharePayload; receivedAt: number}>} */
  const sharedProfiles = new Map();

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

  function pruneProfileShares() {
    const now = Date.now();
    for (const [key, entry] of incomingShares) {
      if (now - entry.updatedAt > PROFILE_SHARE_TTL) incomingShares.delete(key);
    }
    for (const [key, entry] of sharedProfiles) {
      if (now - entry.receivedAt > PROFILE_SHARE_TTL * 15) sharedProfiles.delete(key);
    }
  }

  /** @param {FBCSavedProfile} profile */
  async function saveSharedProfile(profile) {
    const local = await db.get("profiles", profile.memberNumber);
    if (!local || profile.seen > local.seen) await db.put("profiles", profile);
  }

  async function shareProfile(memberNumber) {
    if (CurrentScreen !== "ChatRoom" || typeof ServerSend !== "function") return false;
    const profile = await db.get("profiles", memberNumber);
    if (!profile?.characterBundle) return false;
    const payload = {
      sharedAt: Date.now(),
      from: {
        memberNumber: Player?.MemberNumber,
        name: Player?.Nickname || Player?.Name || String(Player?.MemberNumber),
      },
      profile: {
        memberNumber: profile.memberNumber,
        name: profile.name,
        lastNick: profile.lastNick,
        seen: profile.seen,
        characterBundle: profile.characterBundle,
      },
    };
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
    const total = Math.ceil(encoded.length / PROFILE_SHARE_CHUNK_SIZE);
    if (!total || total > PROFILE_SHARE_MAX_CHUNKS || encoded.length > PROFILE_SHARE_MAX_BYTES) return false;
    const shareId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    for (let i = 0; i < total; i++) {
      ServerSend("ChatRoomChat", {
        Type: "Hidden",
        Content: `${PROFILE_SHARE_PREFIX} ${shareId} ${i + 1}/${total} ${encoded.slice(i * PROFILE_SHARE_CHUNK_SIZE, (i + 1) * PROFILE_SHARE_CHUNK_SIZE)}`,
      });
    }
    const name = profile.lastNick || profile.name || String(memberNumber);
    fbcChatNotify(displayText("Shared profile: $name ($memberNumber)", {
      $name: name,
      $memberNumber: String(memberNumber),
    }));
    return true;
  }

  /**
   * @param {unknown} payload
   * @returns {payload is WCEProfileSharePayload}
   */
  function validSharedPayload(payload) {
    if (!isNonNullObject(payload) || !isNonNullObject(payload.profile)) return false;
    const profile = payload?.profile;
    return Number.isSafeInteger(Number(payload?.sharedAt))
      && Number.isSafeInteger(Number(profile?.memberNumber))
      && Number(profile.memberNumber) > 0
      && typeof profile.name === "string"
      && Number.isFinite(Number(profile.seen))
      && typeof profile.characterBundle === "string"
      && profile.characterBundle.length <= PROFILE_SHARE_MAX_BYTES;
  }

  /** @param {WCEProfileSharePayload} payload */
  function showSharedProfile(payload) {
    const profile = payload.profile;
    if (payload.from.memberNumber === Player?.MemberNumber) return;
    const key = `${payload.sharedAt}:${profile.memberNumber}`;
    sharedProfiles.set(key, { payload, receivedAt: Date.now() });
    const from = payload.from?.name || payload.from?.memberNumber || "Someone";
    const name = profile.lastNick || profile.name || profile.memberNumber;
    const date = new Date(profile.seen).toLocaleDateString();
    fbcChatNotify(displayText("$from shared a profile: $profile - Saved: $date", {
      $from: String(from),
      $profile: `[${PROFILE_SHARE_OPEN} ${payload.sharedAt} ${profile.memberNumber}] ${name} (${profile.memberNumber})`,
      $date: date,
    }));
  }

  /**
   * @param {ServerChatRoomMessage | undefined} data
   * @returns {boolean}
   */
  function handleProfileShare(data) {
    if (data?.Type !== "Hidden" || !data.Content?.startsWith(PROFILE_SHARE_PREFIX)) return false;
    try {
      pruneProfileShares();
      const parts = data.Content.split(" ");
      const shareId = parts[1];
      const [index, total] = (parts[2] || "").split("/").map(Number);
      const chunk = parts.slice(3).join(" ");
      const sender = data.Sender || 0;
      if (!/^[a-z0-9-]{6,64}$/iu.test(shareId || "") || !Number.isSafeInteger(index)
        || !Number.isSafeInteger(total) || total < 1 || total > PROFILE_SHARE_MAX_CHUNKS
        || index < 1 || index > total || !chunk || chunk.length > PROFILE_SHARE_CHUNK_SIZE
        || !/^[A-Za-z0-9+/=]+$/u.test(chunk)) return true;
      if (!incomingShares.has(shareId)) {
        const senderEntries = [...incomingShares.values()].filter(entry => entry.sender === sender).length;
        if (incomingShares.size >= PROFILE_SHARE_MAX_INCOMING || senderEntries >= PROFILE_SHARE_MAX_PER_SENDER) return true;
        incomingShares.set(shareId, { total, sender, chunks: Array.from({ length: total }), count: 0, bytes: 0, updatedAt: Date.now() });
      }
      const entry = incomingShares.get(shareId);
      if (entry.total !== total || entry.sender !== sender) { incomingShares.delete(shareId); return true; }
      if (entry.chunks[index - 1] && entry.chunks[index - 1] !== chunk) { incomingShares.delete(shareId); return true; }
      if (!entry.chunks[index - 1]) { entry.count++; entry.bytes += chunk.length; }
      if (entry.bytes > PROFILE_SHARE_MAX_BYTES) { incomingShares.delete(shareId); return true; }
      entry.chunks[index - 1] = chunk;
      entry.updatedAt = Date.now();
      if (entry.count === entry.total) {
        incomingShares.delete(shareId);
        const payload = JSON.parse(decodeURIComponent(escape(atob(entry.chunks.join("")))));
        if (validSharedPayload(payload)) showSharedProfile(payload);
      }
    } catch (e) {
      logWarn("Unable to parse shared profile", e);
    }
    return true;
  }

  /** @param {HTMLElement} element */
  function processSharedProfileLink(element) {
    if (element.dataset.wceProfileShareProcessed === "1" || !element.innerHTML.includes(PROFILE_SHARE_OPEN)) return;
    const replaced = element.innerHTML.replace(/\[PROFILESHARE_OPEN\s+(\d+)\s+(\d+)\]/gu, (match, sharedAt, memberNumber) => {
      const key = `${sharedAt}:${memberNumber}`;
      return sharedProfiles.has(key) ? `<a href="#" class="profiles_share_open" data-key="${key}">${displayText("Open")}</a>` : match;
    });
    if (replaced === element.innerHTML) return;
    element.innerHTML = replaced;
    element.dataset.wceProfileShareProcessed = "1";
    element.querySelectorAll(".profiles_share_open").forEach(link => link.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (!(link instanceof HTMLElement)) return;
      const entry = sharedProfiles.get(link.dataset.key);
      if (!entry) return;
      const profile = entry.payload.profile;
      const character = CharacterLoadOnline(parseJSON(profile.characterBundle), profile.memberNumber);
      character.BCESeen = profile.seen;
      InformationSheetLoadCharacter(character);
      saveSharedProfile(profile).catch(error => logError("saving shared profile", error));
    }));
  }

  SDK.hookFunction("ChatRoomMessage", HOOK_PRIORITIES.Observe, (args, next) => {
    const [data] = args;
    if (handleProfileShare(data)) return;
    return next(args);
  });

  const profileShareObserver = new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      const element = node instanceof HTMLElement ? node : node.parentElement;
      if (!(element instanceof HTMLElement)) continue;
      if (element.matches(".ChatMessageLocalMessage,.bce-notification")) processSharedProfileLink(element);
      element.querySelectorAll?.(".ChatMessageLocalMessage,.bce-notification").forEach(processSharedProfileLink);
    }
  });
  profileShareObserver.observe(document.body, { childList: true, subtree: true });

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
          const share = document.createElement("a");
          share.textContent = displayText("Share");
          share.title = displayText("Share this saved profile with everyone in the current room");
          share.href = "#";
          share.classList.add("profiles_share");
          share.addEventListener("click", e => {
            e.preventDefault();
            e.stopPropagation();
            shareProfile(p.memberNumber).catch(error => logError("sharing profile", error));
          });
          div.prepend(share);
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
