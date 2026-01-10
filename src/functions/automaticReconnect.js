import { openDB, deleteDB } from "idb";

import { displayText } from "../util/localization";
import { debug, logWarn } from "../util/logger";
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";
import { waitFor, sleep, parseJSON, isString } from "../util/utils";
import { registerSocketListener } from "./appendSocketListenersToInit";

export default async function automaticReconnect() {
  /** @type {import("idb").IDBPDatabase<{key: { key: number; value: { id: number; key: CryptoKey } }; accounts: { key: number; value: { id: number; data: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; auth: Uint8Array<ArrayBuffer>; } }}>}*/
  const db = await openDB("wce-saved-accounts", 20, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("key")) db.createObjectStore("key", { keyPath: "id" });
      if (!db.objectStoreNames.contains("accounts")) db.createObjectStore("accounts", { keyPath: "id" });
    },
  });

  let /** @type {CryptoKey} */ encKey, /** @type {{key: CryptoKey;}} */ key;
  try {
    key = await db.get("key", 1);
  } catch (e) {
    logWarn(e);
    localStorage.removeItem("bce.passwords");
    await deleteDB("wce-saved-accounts");
    window.location.reload();
  }
  if (!key) {
    encKey = await window.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    await db.put("key", { id: 1, key: encKey });
  } else {
    encKey = key.key;
  }

  /**
   * @returns {Promise<Passwords>}
   */
  async function loadAccounts() {
    const d = localStorage.getItem("bce.passwords");
    if (d) {
      /** @type {Passwords} */
      const accs = parseJSON(d) || {};
      if (window.crypto?.subtle) {
        setTimeout(() => {
          localStorage.removeItem("bce.passwords");
          storeAccounts(accs);
        }, 1);
      }
      return accs;
    }
    const res = await db.get("accounts", 1);
    if (!res) return {};
    const { auth, iv, data } = res;
    const decoder = new TextDecoder("utf8");
    try {
      const s = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: auth, tagLength: 128 }, encKey, data);
      return (await parseJSON(decoder.decode(new Uint8Array(s)))) || {};
    } catch (e) {
      logWarn(e);
      localStorage.removeItem("bce.passwords");
      db.clear("key");
      db.clear("accounts");
      return {};
    }
  }

  let accounts = await loadAccounts();

  /**
   * @returns {Passwords}
   */
  function loadPasswords() {
    return accounts || {};
  }

  /**
   * @param {Passwords} accs
   * @returns {void}
   */
  function storeAccounts(accs) {
    if (window.crypto?.subtle) {
      const iv = window.crypto.getRandomValues(new Uint8Array(16));
      const auth = window.crypto.getRandomValues(new Uint8Array(16));
      const encoder = new TextEncoder();
      accounts = accs;
      window.crypto.subtle
        .encrypt({ name: "AES-GCM", iv, additionalData: auth, tagLength: 128 }, encKey, encoder.encode(JSON.stringify(accs)))
        .then(s => db.put("accounts", { id: 1, iv, auth, data: new Uint8Array(s) }));
    } else {
      localStorage.removeItem("bce.passwords");
    }
  }

  /**
   * @returns {void}
   */
  function updatePasswordForReconnect() {
    let name = "";
    if (CurrentScreen === "Login") {
      name = ElementValue("InputName").toUpperCase();
    } else if (CurrentScreen === "Relog") {
      name = Player.AccountName;
    }

    const passwords = loadPasswords();
    passwords[name] = ElementValue("InputPassword");
    storeAccounts(passwords);
  }
  globalThis.bceUpdatePasswordForReconnect = updatePasswordForReconnect;

  /**
   * @param {string} accountname
   * @returns {void}
   */
  function clearPassword(accountname) {
    const passwords = loadPasswords();
    if (!Object.hasOwn(passwords, accountname)) {
      return;
    }
    delete passwords[accountname];
    storeAccounts(passwords);
  }
  globalThis.bceClearPassword = clearPassword;

  let lastClick = Date.now();

  async function loginCheck() {
    await waitFor(() => CurrentScreen === "Login");

    /** @type {{ passwords: Passwords, posMaps: Record<string, string> }} */
    const loginData = { passwords: loadPasswords(), posMaps: {} };

    SDK.hookFunction("LoginRun", HOOK_PRIORITIES.Top, (args, next) => {
      const ret = next(args);
      if (Object.keys(loginData.passwords).length > 0) {
        DrawText(displayText("Saved Logins (WCE)"), 170, 35, "White", "Black");
      }
      DrawButton(1251, 390, 180, 50, displayText("Save (WCE)"), "White");

      let y = 60;
      for (const user in loginData.passwords) {
        if (!Object.hasOwn(loginData.passwords, user)) {
          continue;
        }
        loginData.posMaps[y] = user;
        DrawButton(10, y, 350, 60, user, "White");
        DrawButton(355, y, 60, 60, "X", "White");
        y += 70;
      }
      return ret;
    });

    SDK.hookFunction("LoginClick", HOOK_PRIORITIES.Top, (args, next) => {
      const ret = next(args);
      if (MouseIn(1250, 385, 180, 60)) {
        updatePasswordForReconnect();
        loginData.posMaps = {};
        loginData.passwords = loadPasswords();
      }
      const now = Date.now();
      if (now - lastClick < 150) {
        return ret;
      }
      lastClick = now;
      for (const pos in loginData.posMaps) {
        if (!Object.hasOwn(loginData.posMaps, pos)) {
          continue;
        }
        const idx = parseInt(pos);
        if (MouseIn(10, idx, 350, 60)) {
          LoginDoLogin(loginData.posMaps[idx], loginData.passwords[loginData.posMaps[idx]]);
        } else if (MouseIn(355, idx, 60, 60)) {
          clearPassword(loginData.posMaps[idx]);
          loginData.posMaps = {};
          loginData.passwords = loadPasswords();
        }
      }
      return ret;
    });

    CurrentScreenFunctions.Run = LoginRun;
    CurrentScreenFunctions.Click = LoginClick;
  }
  loginCheck();

  let breakCircuit = false;
  let breakCircuitFull = false;
  let loginError = null;

  async function relog() {
    if (!Player?.AccountName || !ServerIsConnected || LoginSubmitted || !ServerSocket.connected || breakCircuit || breakCircuitFull || !fbcSettings.relogin) {
      return;
    }
    breakCircuit = true;
    const passwords = loadPasswords();
    debug("Attempting to log in again as", Player.AccountName);
    if (!passwords[Player.AccountName]) {
      logWarn("No saved credentials for account", Player.AccountName);
      return;
    }
    LoginDoLogin(Player.AccountName, passwords[Player.AccountName]);

    if (
      !(await waitFor(
        () => CurrentScreen !== "Relog",
        () => !breakCircuit
      ))
    ) {
      logWarn("Relogin failed, circuit was restored");
    }
    await sleep(500);
    SDK.callOriginal("ServerAccountBeep", [
      {
        MemberNumber: Player.MemberNumber || -1,
        BeepType: "",
        MemberName: "VOID",
        ChatRoomName: "VOID",
        Private: true,
        Message: displayText("Reconnected!"),
        ChatRoomSpace: "",
      },
    ]);
  }

  SDK.hookFunction("RelogRun", HOOK_PRIORITIES.Top, (args, next) => {
    if (loginError !== "ErrorDuplicatedLogin") {
      relog();
    } else if (!breakCircuit) {
      SDK.callOriginal("ServerAccountBeep", [
        {
          MemberNumber: Player.MemberNumber || -1,
          BeepType: "",
          MemberName: Player.Name,
          ChatRoomName: displayText("ERROR"),
          Private: true,
          Message: displayText("Signed in from a different location! Refresh the page to re-enable relogin in this tab."),
          ChatRoomSpace: "",
        },
      ]);
      breakCircuit = true;
      breakCircuitFull = true;
    }
    return next(args);
  });

  SDK.hookFunction("RelogExit", HOOK_PRIORITIES.Top, (args, next) => {
    breakCircuit = false;
    breakCircuitFull = false;
    loginError = null;
    return next(args);
  });

  registerSocketListener("connect", () => {
    breakCircuit = false;
    loginError = null;
  });

  SDK.hookFunction("ServerDisconnect", HOOK_PRIORITIES.ModifyBehaviourHigh, ([error, force], next) => {
    const ret = next([error, false]);
    if (force) {
      logWarn("Forcefully disconnected", error);
      ServerSocket.disconnect();
      if (isString(error) && ["ErrorRateLimited", "ErrorDuplicatedLogin"].includes(error)) {
        loginError = error;
        // Reconnect after 3-6 seconds if rate limited
        logWarn("Reconnecting...");
        setTimeout(
          () => {
            logWarn("Connecting...");
            ServerInit();
          },
          3000 + Math.round(Math.random() * 3000)
        );
      } else {
        logWarn("Disconnected.");
      }
    }
    return ret;
  });
}
