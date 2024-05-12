import { SDK, HOOK_PRIORITIES, skippedFunctionality } from "../util/modding";
import { ICONS } from "../util/constants";
import { BCX } from "./hookBCXAPI";
import { waitFor, parseJSON, fbcChatNotify, objEntries } from "../util/utils";
import { debug, logInfo, pastLogs } from "../util/logger";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";
import { fbcChangelog, SUPPORTED_GAME_VERSIONS, FBC_VERSION } from "../util/constants";
import { toySyncState } from "./toySync";
import { incompleteFunctions } from "../registerFunctions";
import { deviatingHashes } from "./functionIntegrityCheck";

/**
 * @param {boolean} [copy] - Whether to copy the report to the clipboard
 */
export async function fbcDebug(copy) {
  /** @type {Map<string, string>} */
  const info = new Map();
  info.set("Browser", navigator.userAgent);
  info.set("Game Version", `${GameVersion}${SUPPORTED_GAME_VERSIONS.includes(GameVersion) ? "" : " (unsupported)"}`);
  info.set("WebGL Version", GLVersion);
  info.set("WCE Version", FBC_VERSION);
  info.set("Loaded via FUSAM", typeof FUSAM === "object" && FUSAM?.addons?.FBC ? "Yes" : "No");
  info.set(
    "WCE Enabled Settings",
    `\n- ${objEntries(fbcSettings)
      .filter(([k, v]) => v || k === "version")
      .map(([k, v]) => `${k}: ${v.toString()}`)
      .join("\n- ")}`
  );
  if (toySyncState.client?.Connected) {
    info.set(
      "Buttplug.io Devices",
      toySyncState.client.Devices.map((d) => `${d.Name} (${d.AllowedMessages.join(",")})`).join(", ")
    );
  }
  info.set(
    "SDK Mods",
    `\n- ${bcModSdk
      .getModsInfo()
      .map((m) => `${m.name} @ ${m.version}`)
      .join("\n- ")}`
  );
  info.set("Incomplete Functions", incompleteFunctions.join(", "));
  info.set("Modified Functions (non-SDK)", deviatingHashes.join(", "));
  info.set("Skipped Functionality for Compatibility", `\n- ${skippedFunctionality.join("\n- ")}`);
  info.set(
    "Log",
    pastLogs
      .filter((v) => v)
      .map((v) => `[${v.level.toUpperCase()}] ${v.message}`)
      .join("\n")
  );
  const print = Array.from(info)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  if (copy) {
    fbcChatNotify(`${print}\n\n**The report has been copied to your clipboard.**`);
    // Not using FBC's debug() to avoid the report ending up on future reports
    console.debug(`${print}\n\n**The report has been copied to your clipboard.**`);
    await navigator.clipboard.writeText(print);
  }
  if (skippedFunctionality.length > 0) {
    fbcChatNotify(
      "If you are running another addon that modifies the game, but is not listed above, please tell its developer to use https://github.com/Jomshir98/bondage-club-mod-sdk to hook into the game instead. This is a very cheap and easy way for addon developers to almost guarantee compatibility with other addons."
    );
  }
  return print;
}

/**
 * @param {string | null} target
 * @param {boolean} [limitVisible]
 */
function findDrawnCharacters(target, limitVisible = false) {
  let baseList = limitVisible ? ChatRoomCharacterDrawlist : ChatRoomCharacter;

  if (ChatRoomMapViewIsActive()) {
    baseList = baseList.filter(ChatRoomMapViewCharacterIsVisible);
  }

  if (target === null) {
    return baseList;
  }

  let targetMembers = [];
  if (/^\d+$/u.test(target)) {
    targetMembers = [baseList.find((c) => c.MemberNumber === parseInt(target))];
  } else {
    targetMembers = baseList.filter(
      (c) =>
        CharacterNickname(c).split(" ")[0]?.toLowerCase() === target?.toLowerCase() ||
        c.Name.split(" ")[0].toLowerCase() === target?.toLowerCase()
    );
  }
  return targetMembers.filter(Boolean);
}

export async function commands() {
  await waitFor(() => !!Commands);
  debug("registering additional commands");

  SDK.hookFunction(
    "ChatRoomAppendChat",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof ChatRoomAppendChat>} args
     */
    (args, next) => {
      if (!fbcSettings.whisperButton) {
        return next(args);
      }

      const [div] = args;
      const replyButton = div.querySelector(".ReplyButton");
      replyButton?.remove();

      const sender = div.getAttribute("data-sender");
      const matchingCharacters = sender ? findDrawnCharacters(sender) : [];
      if (
        sender &&
        sender !== Player.MemberNumber?.toString() &&
        matchingCharacters.length > 0 &&
        (ChatRoomCharacterViewIsActive() || matchingCharacters.some(ChatRoomMapViewCharacterOnWhisperRange))
      ) {
        const repl = document.createElement("a");
        repl.href = "#";
        repl.onclick = (e) => {
          e.preventDefault();
          ElementValue(
            "InputChat",
            `/w ${sender} ${ElementValue("InputChat").replace(/^\/(beep|w(hisper)?) \S+ ?/u, "")}`
          );
          window.InputChat?.focus();
        };
        repl.title = "Whisper";
        repl.classList.add("bce-line-icon-wrapper");
        const img = document.createElement("img");
        img.src = ICONS.WHISPER;
        img.alt = "Whisper";
        img.classList.add("bce-line-icon");
        repl.appendChild(img);
        div.prepend(repl);
      }
      return next(args);
    }
  );

  /** @type {Command[]} */
  const cmds = [
    {
      Tag: "fbcdebug",
      Description: displayText("Get debug information to share with developers."),
      Action: () => fbcDebug(true),
    },
    {
      Tag: "fbcchangelog",
      Description: displayText("Show recent WCE changelog"),
      Action: () => {
        fbcChatNotify(fbcChangelog);
      },
    },
    {
      Tag: "wcedebug",
      Description: displayText("Get debug information to share with developers."),
      Action: () => fbcDebug(true),
    },
    {
      Tag: "wcechangelog",
      Description: displayText("Show recent WCE changelog"),
      Action: () => {
        fbcChatNotify(fbcChangelog);
      },
    },
    {
      Tag: "exportlooks",
      Description: displayText(
        "[target member number]: Copy your or another player's appearance in a format that can be imported with WCE or BCX"
      ),
      Action: async (_, _command, args) => {
        const [target] = args;
        /** @type {Character | null} */
        let targetCharacter = null;
        if (!target) {
          targetCharacter = Player;
        } else {
          targetCharacter = Character.find((c) => c.MemberNumber === parseInt(target)) ?? null;
        }
        if (!targetCharacter) {
          logInfo("Could not find member", target);
          return;
        }
        const [bindSubmit] = await FUSAM.modals.openAsync({
          prompt: displayText("Include binds?"),
          buttons: {
            cancel: "No",
            submit: "Yes",
          },
        });
        const includeBinds = bindSubmit === "submit";
        let includeLocks = false;
        if (includeBinds) {
          const [lockSubmit] = await FUSAM.modals.openAsync({
            prompt: displayText("Include locks?"),
            buttons: {
              cancel: "No",
              submit: "Yes",
            },
          });
          includeLocks = lockSubmit === "submit";
        }
        const [baseSubmit] = await FUSAM.modals.openAsync({
          prompt: displayText("Include height, body type, hair, etc?"),
          buttons: {
            cancel: "No",
            submit: "Yes",
          },
        });
        const includeBase = baseSubmit === "submit";

        const base = targetCharacter.Appearance.filter((a) => a.Asset.Group.IsDefault && !a.Asset.Group.Clothing);
        const clothes = targetCharacter.Appearance.filter(
          (a) => a.Asset.Group.Category === "Appearance" && a.Asset.Group.Clothing
        );
        const binds = targetCharacter.Appearance.filter(
          (a) => a.Asset.Group.Category === "Item" && !a.Asset.Group.BodyCosplay
        );

        const appearance = [...clothes];
        if (includeBinds) {
          appearance.push(...binds);
        }
        if (includeBase) {
          appearance.push(...base);
        }

        /** @type {ItemBundle[]} */
        const looks = appearance.map((i) => {
          const property = i.Property ? { ...i.Property } : {};
          if (!includeLocks && property.LockedBy) {
            delete property.LockedBy;
            delete property.LockMemberNumber;
          }
          if (property?.LockMemberNumber) {
            property.LockMemberNumber = Player.MemberNumber;
          }
          return {
            Group: i.Asset.Group.Name,
            Name: i.Asset.Name,
            Color: i.Color,
            Difficulty: i.Difficulty,
            Property: property,
            Craft: i.Craft,
          };
        });

        const targetName = targetCharacter.IsPlayer() ? "yourself" : CharacterNickname(targetCharacter);

        const exportString = LZString.compressToBase64(JSON.stringify(looks));

        FUSAM.modals.openAsync({
          prompt: displayText(displayText("Copy the looks string below")),
          input: {
            initial: exportString,
            readonly: true,
            type: "textarea",
          },
          buttons: {
            submit: "Done",
          },
        });

        await navigator.clipboard.writeText(exportString);
        fbcChatNotify(
          displayText(`Exported looks for $TargetName copied to clipboard`, {
            $TargetName: targetName,
          })
        );
      },
    },
    {
      Tag: "importlooks",
      Description: displayText("Import looks from a string (BCX or WCE export)"),
      Action: () => {
        if (!Player.CanChangeOwnClothes() || !OnlineGameAllowChange()) {
          fbcChatNotify(
            displayText("You cannot change your appearance while bound or during online games, such as LARP.")
          );
          return;
        }

        FUSAM.modals.open({
          prompt: displayText("Paste your looks here"),
          input: {
            initial: "",
            readonly: false,
            type: "textarea",
          },
          callback: (act, bundleString) => {
            if (act !== "submit") {
              return;
            }
            if (!bundleString) {
              fbcChatNotify(displayText("No looks string provided"));
              return;
            }
            try {
              const bundle = /** @type {ItemBundle[]} */ (
                bundleString.startsWith("[")
                  ? parseJSON(bundleString)
                  : parseJSON(LZString.decompressFromBase64(bundleString))
              );

              if (!Array.isArray(bundle) || bundle.length === 0 || !bundle[0].Group) {
                throw new Error("Invalid bundle");
              }

              // Keep items you cannot unlock in your appearance
              for (const item of Player.Appearance) {
                if (item.Property?.LockedBy && !DialogCanUnlock(Player, item)) {
                  /** @type {ItemBundle} */
                  const itemBundle = {
                    Group: item.Asset.Group.Name,
                    Name: item.Asset.Name,
                    Color: item.Color,
                    Difficulty: item.Difficulty,
                    Property: item.Property,
                  };
                  const idx = bundle.findIndex((v) => v.Group === item.Asset.Group.Name);
                  if (idx < 0) {
                    bundle.push(itemBundle);
                  } else {
                    bundle[idx] = itemBundle;
                  }
                }
              }
              ServerAppearanceLoadFromBundle(Player, "Female3DCG", bundle, Player.MemberNumber);
              ChatRoomCharacterUpdate(Player);
              fbcChatNotify(displayText("Applied looks"));
            } catch (e) {
              console.error(e);
              fbcChatNotify(displayText("Could not parse looks"));
            }
          },
        });
      },
    },
    {
      Tag: "beep",
      Description: displayText("[membernumber] [message]: beep someone"),
      Action: (_, command, args) => {
        if (BCX?.getRuleState("speech_restrict_beep_send")?.isEnforced) {
          fbcChatNotify(displayText("Sending beeps is restricted by BCX rule."));
        }
        const [target] = args,
          [, , ...message] = command.split(" "),
          msg = message?.join(" ");
        if (!target || !msg || !/^\d+$/u.test(target)) {
          fbcChatNotify(displayText(`beep target or message not provided`));
          return;
        }

        const targetMemberNumber = parseInt(target);
        if (!Player.FriendList?.includes(targetMemberNumber)) {
          fbcChatNotify(
            displayText(`$Target is not in your friend list`, {
              $Target: target,
            })
          );
          return;
        }

        const targetName = Player.FriendNames?.get(targetMemberNumber) ?? `unknown (${targetMemberNumber})`;
        ServerSend("AccountBeep", {
          BeepType: "",
          MemberNumber: targetMemberNumber,
          Message: msg,
          IsSecret: true,
        });
        FriendListBeepLog.push({
          MemberNumber: targetMemberNumber,
          MemberName: targetName,
          Sent: true,
          Private: false,
          Time: new Date(),
          Message: msg,
        });

        const beepId = FriendListBeepLog.length - 1;
        const link = document.createElement("a");
        link.href = `#beep-${beepId}`;
        link.onclick = (e) => {
          e.preventDefault();
          ServerOpenFriendList();
          FriendListModeIndex = 1;
          FriendListShowBeep(beepId);
        };
        link.textContent = displayText("(Beep to $Name ($Number): $Message)", {
          $Name: targetName,
          $Number: targetMemberNumber.toString(),
          $Message: msg.length > 150 ? `${msg.substring(0, 150)}...` : msg,
        });
        link.classList.add("bce-beep-link");
        fbcChatNotify(link);
      },
    },
    {
      Tag: "w",
      Description: displayText(
        "[target name] [message]: whisper the target player. Use first name only. Finds the first person in the room with a matching name, left-to-right, top-to-bottom."
      ),
      Action: (_, command, args) => {
        if (args.length < 2) {
          fbcChatNotify(displayText(`Whisper target or message not provided`));
        }

        const [target] = args;
        const [, , ...message] = command.split(" ");
        const msg = message?.join(" ");
        const targetMembers = findDrawnCharacters(target);
        if (!target || !targetMembers || targetMembers.length === 0) {
          fbcChatNotify(`Whisper target not found: ${target}`);
        } else if (targetMembers.length > 1) {
          fbcChatNotify(
            displayText(
              "Multiple whisper targets found: $Targets. You can still whisper the player by clicking their name or by using their member number.",
              {
                $Targets: targetMembers.map((c) => `${CharacterNickname(c)} (${c.MemberNumber ?? ""})`).join(", "),
              }
            )
          );
        } else if (!msg) {
          fbcChatNotify(displayText(`No message provided`));
        } else {
          const targetMemberNumber = targetMembers[0].MemberNumber;
          const originalTarget = ChatRoomTargetMemberNumber;
          ChatRoomTargetMemberNumber = targetMemberNumber ?? null;
          ElementValue("InputChat", `${msg.length > 0 && [".", "/"].includes(msg[0]) ? "\u200b" : ""}${msg}`);
          ChatRoomSendChat();

          // Erase duplicate from history to prevent things like automatic shock collars listening to the history from triggering
          ChatRoomLastMessage.pop();

          ChatRoomTargetMemberNumber = originalTarget;
        }
      },
    },
    {
      Tag: "versions",
      Description: displayText("show versions of the club, WCE, BCX and other mods in use by players"),
      Action: (_, _command, args) => {
        /** @type {(character: Character) => string} */
        const getCharacterModInfo = (character) =>
          `${CharacterNickname(character)} (${
            character.MemberNumber ?? ""
          }) club ${character.OnlineSharedSettings?.GameVersion ?? "R0"}${
            window.bcx?.getCharacterVersion(character.MemberNumber)
              ? ` BCX ${window.bcx.getCharacterVersion(character.MemberNumber) ?? "?"}`
              : ""
          }${character.FBC ? `\nWCE v${character.FBC} Alt Arousal: ${character.BCEArousal?.toString()}` : ""}${
            character.FBCOtherAddons && character.FBCOtherAddons.some((mod) => !["BCX", "FBC", "WCE"].includes(mod.name))
              ? `\nOther Addons:\n- ${character.FBCOtherAddons.filter((mod) => !["BCX", "FBC", "WCE"].includes(mod.name))
                  .map((mod) => `${mod.name} v${mod.version} ${mod.repository ?? ""}`)
                  .join("\n- ")}`
              : ""
          }`;

        const printList = findDrawnCharacters(args.length > 0 ? args[0] : null, true);

        const versionOutput = printList
          .map(getCharacterModInfo)
          .filter((info) => info)
          .join("\n\n");

        fbcChatNotify(versionOutput);
        debug(versionOutput);
      },
    },
  ];

  for (const c of cmds) {
    if (Commands.some((a) => a.Tag === c.Tag)) {
      debug("already registered", c);
      continue;
    }
    Commands.push(c);
  }
}
