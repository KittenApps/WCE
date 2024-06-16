import { skippedFunctionality, deviatingHashes } from "../util/modding";
import { BCX } from "./hookBCXAPI";
import { waitFor, parseJSON, fbcChatNotify, objEntries } from "../util/utils";
import { debug, logInfo, pastLogs } from "../util/logger";
import { fbcSettings } from "../util/settings";
import { displayText } from "../util/localization";
import { fbcChangelog, SUPPORTED_GAME_VERSIONS, FBC_VERSION } from "../util/constants";
import { toySyncState } from "./toySync";
import { incompleteFunctions } from "../registerFunctions";
import { bceGotoRoom } from "./forcedClubSlave";
import { augmentedChatNotify } from "./chatAugments";

export async function fbcDebug(copy: boolean): Promise<string> {
  const info = new Map<string, string>();
  info.set("Browser", navigator.userAgent);
  info.set("Game Version", `${GameVersion}${SUPPORTED_GAME_VERSIONS.includes(GameVersion) ? "" : " (unsupported)"}`);
  info.set("WebGL Version", GLVersion);
  info.set("WCE Version", FBC_VERSION);
  info.set("Loaded via FUSAM", typeof FUSAM === "object" && FUSAM?.addons?.FBC ? "Yes" : "No");
  info.set(
    "WCE Enabled Settings",
    `\n- ${objEntries(fbcSettings).filter(([k, v]) => v || k === "version").map(([k, v]) => `${k}: ${v.toString()}`).join("\n- ")}`
  );
  if (toySyncState.client?.connected) {
    info.set(
      "Buttplug.io Devices",
      toySyncState.client.devices.map(d => `${d.name} (${d.vibrateAttributes.join(",")})`).join(", ")
    );
  }
  info.set(
    "SDK Mods",
    `\n- ${bcModSdk.getModsInfo().map(m => `${m.name} @ ${m.version}`).join("\n- ")}`
  );
  info.set("Incomplete Functions", incompleteFunctions.join(", "));
  info.set("Modified Functions (non-SDK)", deviatingHashes.join(", "));
  info.set("Skipped Functionality for Compatibility", `\n- ${skippedFunctionality.join("\n- ")}`);
  info.set(
    "Log",
    pastLogs.filter(v => v).map(v => `[${v.level.toUpperCase()}] ${v.message}`).join("\n")
  );
  const print = Array.from(info).map(([k, v]) => `${k}: ${v}`).join("\n");
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

function findDrawnCharacters(target?: string, limitVisible = false): Character[] {
  let baseList = limitVisible ? ChatRoomCharacterDrawlist : ChatRoomCharacter;

  if (ChatRoomMapViewIsActive()) {
    baseList = baseList.filter(ChatRoomMapViewCharacterIsVisible);
  }

  if (target === null) {
    return baseList;
  }

  let targetMembers: Character[] = [];
  if (/^\d+$/u.test(target)) {
    targetMembers = [baseList.find(c => c.MemberNumber === parseInt(target))];
  } else {
    targetMembers = baseList.filter(c =>
      CharacterNickname(c).split(" ")[0]?.toLowerCase() === target?.toLowerCase() ||
      c.Name.split(" ")[0].toLowerCase() === target?.toLowerCase()
    );
  }
  return targetMembers.filter(Boolean);
}

export default async function commands(): Promise<void> {
  await waitFor(() => !!Commands);
  debug("registering additional commands");

  CommandCombine([
    {
      Tag: "fbcdebug",
      Description: displayText("Get debug information to share with developers."),
      Action: () => {
        fbcChatNotify("Warning: /fbcdebug is deprecated, use /wcedebug instead!");
        fbcDebug(true);
      },
    },
    {
      Tag: "fbcchangelog",
      Description: displayText("Show recent WCE changelog"),
      Action: () => {
        augmentedChatNotify(fbcChangelog);
        fbcChatNotify("Warning: /fbcchangelog is deprecated, use /wcechangelog instead!");
      },
    },
    {
      Tag: "wcedebug",
      Description: displayText("Get debug information to share with developers."),
      Action: () => {
        fbcDebug(true);
      },
    },
    {
      Tag: "wcechangelog",
      Description: displayText("Show recent WCE changelog"),
      Action: () => {
        augmentedChatNotify(fbcChangelog);
      },
    },
    {
      Tag: "wcegotoroom",
      Description: displayText("[room name or empty] switches to the room or leaves room if empty (ignoring all restrictions)"),
      Action: (_, command) => {
        bceGotoRoom(command.substring(13).trim());
      },
    },
    {
      Tag: "exportlooks",
      Description: displayText("[target member number]: Copy your or another player's appearance in a format that can be imported with WCE or BCX"),
      Action: (_, _command, [target]) => {
        let targetCharacter: Character | null = null;
        if (!target) {
          targetCharacter = Player;
        } else {
          targetCharacter = Character.find(c => c.MemberNumber === parseInt(target)) ?? null;
        }
        if (!targetCharacter) {
          logInfo("Could not find member", target);
          return;
        }
        let includeBase = false,
          includeBinds = false,
          includeLocks = false;
        FUSAM.modals.openAsync({
          prompt: displayText("Include binds?"),
          buttons: { cancel: "No", submit: "Yes" },
        }).then(([bindSubmit]) => {
          includeBinds = bindSubmit === "submit";
          if (includeBinds) {
            return FUSAM.modals.openAsync({
              prompt: displayText("Include locks?"),
              buttons: { cancel: "No", submit: "Yes" },
            }).then(([lockSubmit]) => { includeLocks = lockSubmit === "submit"; });
          }
          return null;
        }).then(() => FUSAM.modals.openAsync({
          prompt: displayText("Include height, body type, hair, etc?"),
          buttons: { cancel: "No", submit: "Yes" },
        })).then(([baseSubmit]) => {
          includeBase = baseSubmit === "submit";

          const base: Item[] = targetCharacter.Appearance.filter(a => a.Asset.Group.IsDefault && !a.Asset.Group.Clothing);
          const clothes: Item[] = targetCharacter.Appearance.filter(a => a.Asset.Group.Category === "Appearance" && a.Asset.Group.Clothing);
          const binds: Item[] = targetCharacter.Appearance.filter(a => a.Asset.Group.Category === "Item" && !a.Asset.Group.BodyCosplay);

          const appearance = [...clothes];
          if (includeBinds) appearance.push(...binds);
          if (includeBase) appearance.push(...base);

          const looks: ItemBundle[] = appearance.map((i) => {
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
            input: { initial: exportString, readonly: true, type: "textarea" },
            buttons: { submit: "Done" },
          });

          return navigator.clipboard.writeText(exportString).then(() => {
            fbcChatNotify(displayText("Exported looks for $TargetName copied to clipboard", { $TargetName: targetName }));
          });
        });
      },
    },
    {
      Tag: "importlooks",
      Description: displayText("Import looks from a string (BCX or WCE export)"),
      Action: () => {
        if (!Player.CanChangeOwnClothes() || !OnlineGameAllowChange()) {
          fbcChatNotify(displayText("You cannot change your appearance while bound or during online games, such as LARP."));
          return;
        }

        FUSAM.modals.open({
          prompt: displayText("Paste your looks here"),
          input: { initial: "", readonly: false, type: "textarea" },
          callback: (act, bundleString) => {
            if (act !== "submit") return;
            if (!bundleString) {
              fbcChatNotify(displayText("No looks string provided"));
              return;
            }
            try {
              const bundle: ItemBundle[] = bundleString.startsWith("[") ? parseJSON(bundleString) : parseJSON(LZString.decompressFromBase64(bundleString));
              if (!Array.isArray(bundle) || bundle.length === 0 || !bundle[0].Group) throw new Error("Invalid bundle");

              // Keep items you cannot unlock in your appearance
              for (const item of Player.Appearance) {
                if (item.Property?.LockedBy && !DialogCanUnlock(Player, item)) {
                  const itemBundle: ItemBundle = {
                    Group: item.Asset.Group.Name,
                    Name: item.Asset.Name,
                    Color: item.Color,
                    Difficulty: item.Difficulty,
                    Property: item.Property,
                  };
                  const idx = bundle.findIndex(v => v.Group === item.Asset.Group.Name);
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
      Action: (_, command, [target]) => {
        if (BCX?.getRuleState("speech_restrict_beep_send")?.isEnforced) {
          fbcChatNotify(displayText("Sending beeps is restricted by BCX rule."));
          return;
        }
        const [, , ...message] = command.split(" ");
        const msg = message?.join(" ");
        if (!target || !msg || !/^\d+$/u.test(target)) {
          fbcChatNotify(displayText("beep target or message not provided"));
          return;
        }

        const targetMemberNumber = parseInt(target);
        if (!Player.FriendList?.includes(targetMemberNumber)) {
          fbcChatNotify(displayText("$Target is not in your friend list", { $Target: target }));
          return;
        }

        const targetName = Player.FriendNames?.get(targetMemberNumber);
        ServerSend("AccountBeep", {
          BeepType: "",
          MemberNumber: targetMemberNumber,
          Message: msg,
          IsSecret: true,
        });
        FriendListBeepLog.push({
          MemberNumber: targetMemberNumber,
          MemberName: targetName ?? `unknown (${targetMemberNumber})`,
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
          $Name: targetName ?? "unknown",
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
          fbcChatNotify(displayText("Whisper target or message not provided"));
          return;
        }

        const [target] = args;
        const [, , ...message] = command.split(" ");
        const msg = message?.join(" ");
        const targetMembers = findDrawnCharacters(target);
        if (!target || !targetMembers || targetMembers.length === 0) {
          fbcChatNotify(`Whisper target not found: ${target}`);
        } else if (targetMembers.length > 1) {
          fbcChatNotify(displayText(
            "Multiple whisper targets found: $Targets. You can still whisper the player by clicking their name or by using their member number.",
            { $Targets: targetMembers.map(c => `${CharacterNickname(c)} (${c.MemberNumber ?? ""})`).join(", ") }
          ));
        } else if (targetMembers[0].IsPlayer()) {
          fbcChatNotify("You can't whisper yourself!");
        } else if (!msg) {
          fbcChatNotify(displayText("No message provided"));
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
        function getCharacterModInfo(character: Character): string {
          return `${CharacterNickname(character)} (${character.MemberNumber ?? ""}) club ${character.OnlineSharedSettings?.GameVersion ?? "R0"}${
            window.bcx?.getCharacterVersion(character.MemberNumber) ? ` BCX ${window.bcx.getCharacterVersion(character.MemberNumber) ?? "?"}` : ""
          }${character.FBC ? `\nWCE v${character.FBC} Alt Arousal: ${character.BCEArousal?.toString()}` : ""}${
            character.FBCOtherAddons?.some(mod => !["BCX", "FBC", "WCE"].includes(mod.name)) ?
              `\nOther Addons:\n- ${character.FBCOtherAddons.filter(mod => !["BCX", "FBC", "WCE"].includes(mod.name))
                .map(mod => `${mod.name} v${mod.version} ${mod.repository ?? ""}`)
                .join("\n- ")}` :
                ""
          }`;
        }

        const printList = findDrawnCharacters(args.length > 0 ? args[0] : null, true);
        const versionOutput = printList.map(getCharacterModInfo).filter(info => info).join("\n\n");
        fbcChatNotify(versionOutput);
        debug(versionOutput);
      },
    },
    {
      Tag: "ulistadd",
      Description: displayText("[membernumber]: adds a player to the list allowing to bypass Uwall."),
      Action: (_, _command, args) => {
        if (args.length < 1) {
          fbcChatNotify("The ulistadd command must be followed by the member number of the player that you allow to bypass Uwall.");
        } else {
          const member = parseInt(args[0]);
          const Ulist = Player.OnlineSharedSettings.Ulist ?? [];
          if (!isNaN(member) && member > 0 && member !== Player.MemberNumber && !Ulist.includes(member)) {
            Player.OnlineSharedSettings.Ulist = [...Ulist, member];
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
          }
          if (!fbcSettings.uwall) fbcChatNotify("Warning: Uwall is not activated in WCE's settings.");
        }
      },
    },
    {
      Tag: "ulistremove",
      Description: displayText("[membernumber]: removes a player from the list allowing to bypass Uwall."),
      Action: (_, _command, args) => {
        if (args.length < 1) {
          fbcChatNotify("The ulistremove command must be followed by the member number of the player who is no more allowed to bypass Uwall.");
        } else {
          const member = parseInt(args[0]);
          const { Ulist } = Player.OnlineSharedSettings;
          if (Array.isArray(Ulist) && !isNaN(member) && member > 0 && member !== Player.MemberNumber) {
            Player.OnlineSharedSettings.Ulist = Ulist.filter(m => m !== member);
            ServerAccountUpdate.QueueData({ OnlineSharedSettings: Player.OnlineSharedSettings });
          }
          if (!fbcSettings.uwall) fbcChatNotify("Warning: Uwall is not activated in WCE's settings.");
        }
      },
    },
    {
      Tag: "ulistshow",
      Description: displayText("displays the list of players allowed to bypass Uwall."),
      Action: () => {
        fbcChatNotify(`Ulist: ${JSON.stringify(Player.OnlineSharedSettings.Ulist ?? [])}`);
        if (!fbcSettings.uwall) fbcChatNotify("Warning: Uwall is not activated in WCE's settings.");
      },
    },
  ]);
}
