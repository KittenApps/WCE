/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { registerSocketListener } from "./appendSocketListenersToInit";
import { waitFor, sleep, parseJSON, isString } from "../util/utils";
import { debug, logWarn } from "../util/logger";
import { displayText } from "../util/localization";
import { fbcSettings } from "../util/settings";

export default async function automaticReconnect() {
  const scriptEl = document.createElement("script");
  scriptEl.src = "https://unpkg.com/dexie@3.2.7/dist/dexie.js";
  document.body.appendChild(scriptEl);

  await waitFor(() => typeof Dexie !== "undefined" && ServerSocket && ServerIsConnected);

  const db = new Dexie("wce-saved-accounts");
  db.version(1).stores({
    key: "++id, key",
  });
  const keyTable = db.table("key");

  /** @type {CryptoKey} */
  let encKey = await keyTable.get(1);
  if (!encKey) {
    // eslint-disable-next-line require-atomic-updates
    encKey = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await keyTable.put(encKey, [1]);
  }

  /** @type {() => Promise<Passwords>} */
  async function loadAccounts() {
    const a = localStorage.getItem("bce.passwords.authTag");
    if (!a) {
      /** @type {Passwords} */
      const accs = parseJSON(localStorage.getItem("bce.passwords")) || {};
      if (window.crypto?.subtle) storeAccounts(accs);
      return accs;
    }
    const decoder = new TextDecoder("utf8");
    const auth = new Uint8Array(a.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)));
    const iv = new Uint8Array(localStorage.getItem("bce.passwords.iv").match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)));
    const data = new Uint8Array(localStorage.getItem("bce.passwords").match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)));
    console.log(auth, iv, data);
    const s = await window.crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: auth, tagLength: 128 }, encKey, data);
    const str = decoder.decode(new Uint8Array(s));
    return parseJSON(str);
  }

  let accounts = await loadAccounts();

  /** @type {() => Passwords} */
  function loadPasswords() {
    return accounts || {};
  }

  /** @type {(accs: Passwords) => void} */
  function storeAccounts(accs) {
    if (window.crypto?.subtle) {
      const iv = window.crypto.getRandomValues(new Uint8Array(16));
      const auth = window.crypto.getRandomValues(new Uint8Array(16));
      const encoder = new TextEncoder();
      accounts = accs;
      window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: auth, tagLength: 128 },
        encKey,
        encoder.encode(JSON.stringify(accs))
      ).then((s) => {
        localStorage.setItem("bce.passwords", Array.from(new Uint8Array(s)).map((b) => b.toString(16).padStart(2, "0")).join(''));
        localStorage.setItem("bce.passwords.authTag", Array.from(auth).map((b) => b.toString(16).padStart(2, "0")).join(''));
        localStorage.setItem("bce.passwords.iv", Array.from(iv).map((b) => b.toString(16).padStart(2, "0")).join(''));
      });
    } else {
      // localStorage.setItem("bce.passwords", JSON.stringify(accs));
      localStorage.removeItem("bce.passwords");
    }
  }

  window.bceUpdatePasswordForReconnect = () => {
    let name = "";
    if (CurrentScreen === "Login") {
      name = ElementValue("InputName").toUpperCase();
    } else if (CurrentScreen === "Relog") {
      name = Player.AccountName;
    }

    const passwords = loadPasswords();
    passwords[name] = ElementValue("InputPassword");
    storeAccounts(passwords);
  };

  window.bceClearPassword = (accountname) => {
    const passwords = loadPasswords();
    if (!Object.prototype.hasOwnProperty.call(passwords, accountname)) {
      return;
    }
    delete passwords[accountname];
    storeAccounts(passwords);
  };

  let lastClick = Date.now();

  async function loginCheck() {
    await waitFor(() => CurrentScreen === "Login");

    /** @type {{ passwords: Passwords, posMaps: Record<string, string> }} */
    const loginData = {
      passwords: loadPasswords(),
      posMaps: {},
    };

    SDK.hookFunction(
      "LoginRun",
      HOOK_PRIORITIES.Top,
      /**
       * @param {Parameters<typeof LoginRun>} args
       */ (args, next) => {
        const ret = next(args);
        if (Object.keys(loginData.passwords).length > 0) {
          DrawText(displayText("Saved Logins (WCE)"), 170, 35, "White", "Black");
        }
        DrawButton(1250, 385, 180, 60, displayText("Save (WCE)"), "White");

        let y = 60;
        for (const user in loginData.passwords) {
          if (!Object.prototype.hasOwnProperty.call(loginData.passwords, user)) {
            continue;
          }
          loginData.posMaps[y] = user;
          DrawButton(10, y, 350, 60, user, "White");
          DrawButton(355, y, 60, 60, "X", "White");
          y += 70;
        }
        return ret;
      }
    );

    SDK.hookFunction(
      "LoginClick",
      HOOK_PRIORITIES.Top,
      /**
       * @param {Parameters<typeof LoginClick>} args
       */ (args, next) => {
        const ret = next(args);
        if (MouseIn(1250, 385, 180, 60)) {
          bceUpdatePasswordForReconnect();
          loginData.posMaps = {};
          loginData.passwords = loadPasswords();
        }
        const now = Date.now();
        if (now - lastClick < 150) {
          return ret;
        }
        lastClick = now;
        for (const pos in loginData.posMaps) {
          if (!Object.prototype.hasOwnProperty.call(loginData.posMaps, pos)) {
            continue;
          }
          const idx = parseInt(pos);
          if (MouseIn(10, idx, 350, 60)) {
            ElementValue("InputName", loginData.posMaps[idx]);
            ElementValue("InputPassword", loginData.passwords[loginData.posMaps[idx]]);
            LoginDoLogin();
          } else if (MouseIn(355, idx, 60, 60)) {
            bceClearPassword(loginData.posMaps[idx]);
            loginData.posMaps = {};
            loginData.passwords = loadPasswords();
          }
        }
        return ret;
      }
    );

    CurrentScreenFunctions.Run = LoginRun;
    CurrentScreenFunctions.Click = LoginClick;
  }
  loginCheck();

  let breakCircuit = false;
  let breakCircuitFull = false;

  async function relog() {
    if (
      !Player?.AccountName ||
      !ServerIsConnected ||
      LoginSubmitted ||
      !ServerSocket.connected ||
      breakCircuit ||
      breakCircuitFull ||
      !fbcSettings.relogin
    ) {
      return;
    }
    breakCircuit = true;
    const passwords = loadPasswords();
    debug("Attempting to log in again as", Player.AccountName);
    if (!passwords[Player.AccountName]) {
      logWarn("No saved credentials for account", Player.AccountName);
      return;
    }
    LoginSetSubmitted();
    ServerSend("AccountLogin", {
      AccountName: Player.AccountName,
      Password: passwords[Player.AccountName],
    });
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

  SDK.hookFunction(
    "RelogRun",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof RelogRun>} args
     */ (args, next) => {
      const forbiddenReasons = ["ErrorDuplicatedLogin"];
      if (!forbiddenReasons.includes(LoginErrorMessage)) {
        relog();
      } else if (!breakCircuit) {
        SDK.callOriginal("ServerAccountBeep", [
          {
            MemberNumber: Player.MemberNumber || -1,
            BeepType: "",
            MemberName: Player.Name,
            ChatRoomName: displayText("ERROR"),
            Private: true,
            Message: displayText(
              "Signed in from a different location! Refresh the page to re-enable relogin in this tab."
            ),
            ChatRoomSpace: "",
          },
        ]);
        breakCircuit = true;
        breakCircuitFull = true;
      }
      return next(args);
    }
  );

  SDK.hookFunction(
    "RelogExit",
    HOOK_PRIORITIES.Top,
    /**
     * @param {Parameters<typeof RelogExit>} args
     */ (args, next) => {
      breakCircuit = false;
      breakCircuitFull = false;
      return next(args);
    }
  );

  registerSocketListener("connect", () => {
    breakCircuit = false;
  });

  SDK.hookFunction(
    "ServerDisconnect",
    HOOK_PRIORITIES.ModifyBehaviourHigh,
    /**
     * @param {Parameters<typeof ServerDisconnect>} args
     */
    (args, next) => {
      const [, force] = args;
      args[1] = false;
      const ret = next(args);
      if (force) {
        logWarn("Forcefully disconnected", args);
        ServerSocket.disconnect();
        if (isString(args[0]) && ["ErrorRateLimited", "ErrorDuplicatedLogin"].includes(args[0])) {
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
    }
  );
}
