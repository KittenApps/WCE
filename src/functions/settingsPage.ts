import { toySyncState } from "./toySync";
import { waitFor, drawTooltip } from "../util/utils";
import { debug, logWarn, logError } from "../util/logger";
import { fbcSettings, defaultSettings, bceSaveSettings, isDefaultSettingKey, type SelectSetting, type SettingsCategory } from "../util/settings";
import { displayText } from "../util/localization";
import { BCE_LICENSE, /* DISCORD_INVITE_URL, */ WEBSITE_URL } from "../util/constants";

const SelectButtonOffset = 900;
const SelectButtonWidth = 200;

// Create settings page
export default async function settingsPage(): Promise<void> {
  await waitFor(() => !!PreferenceRegisterExtensionSetting);

  debug("initializing");

  const settingsPerPage = 8,
    settingsYIncrement = 70,
    settingsYStart = 225;

  function settingsPageCount(category: SettingsCategory): number {
    return Math.ceil(Object.values(defaultSettings).filter(v => v.category === category).length / settingsPerPage);
  }

  // const discordInvitePosition = [1500, 60, 250, 50] as const;
  const licensePosition = [1500, /* 120 */ 60, 250, 50] as const;
  const websitePosition = [1240, 60, 250, 50] as const;
  let currentPageNumber = 0;

  let currentCategory: SettingsCategory | null = null;
  let currentSetting = "";

  // Excludes hidden
  const settingsCategories: SettingsCategory[] = [
    "chat",
    "activities",
    "appearance",
    "immersion",
    "antigarble",
    "performance",
    "misc",
    "cheats",
    "buttplug",
  ];
  const settingCategoryLabels = {
    chat: "Chat & Social",
    activities: "Activities & Arousal",
    appearance: "Appearance & Wardrobe",
    immersion: "Immersion & Anti-Cheat",
    antigarble: "Gagspeak & Anti-Garble",
    performance: "Performance",
    misc: "Misc",
    cheats: "Cheats",
    buttplug: "Buttplug.io Toys",
    hidden: "",
  } as const;

  const vibratingSlots = [
    "None",
    ...new Set(Asset.filter(a => a.AllowEffect?.includes("Vibrating") || a.AllowEffect?.includes("Egged")).map(a => a.Group.Name)),
  ];

  const scanButtonPosition = [1650, 225, 150, 50] as const;

  function currentDefaultSettings(category: SettingsCategory) {
    return Object.entries(defaultSettings).filter(([k, v]) => v.category === category && k !== "buttplugDevices");
  }

  function PreferenceSubscreenBCESettingsLoad(): void {
    ElementCreateInput("WceIntifaceAddress", "text", fbcSettings.toySyncAddress);
    ElementPosition("WceIntifaceAddress", -999, -999, 550);
    currentPageNumber = 0;
  }
  function PreferenceSubscreenBCESettingsExit(): void {
    fbcSettings.toySyncAddress = ElementValue("WceIntifaceAddress");
    ElementRemove("WceIntifaceAddress");
    bceSaveSettings();
    PreferenceSubscreenExtensionsClear();
  }

  function PreferenceSubscreenBCESettingsRun(): void {
    const ctx = window.MainCanvas.getContext("2d");
    if (!ctx) {
      logError("Could not get canvas context");
      return;
    }
    ctx.textAlign = "left";
    DrawText(
      displayText(currentCategory ? `WCE Settings - ${settingCategoryLabels[currentCategory]}` : "Wholesome Club Extensions (WCE) Settings"),
      300,
      125,
      "Black",
      "Gray"
    );
    /* DrawButton(...discordInvitePosition, "", "White", "");
    DrawText(
      displayText("Join Discord"),
      discordInvitePosition[0] + 20,
      discordInvitePosition[1] + discordInvitePosition[3] / 2,
      "Black",
      ""
    ); */
    DrawButton(...licensePosition, "", "White", "");
    DrawText(displayText("License"), licensePosition[0] + 20, licensePosition[1] + licensePosition[3] / 2, "Black", "");
    DrawButton(...websitePosition, "", "White", "");
    DrawText(
      displayText("Information"),
      websitePosition[0] + 20,
      websitePosition[1] + websitePosition[3] / 2,
      "Black",
      ""
    );
    DrawButton(1815, 75, 90, 90, "", "White", "Icons/Exit.png");

    if (currentCategory) {
      let y = settingsYStart;
      for (const [settingName, defaultSetting] of currentDefaultSettings(currentCategory).slice(
        currentPageNumber * settingsPerPage,
        currentPageNumber * settingsPerPage + settingsPerPage
      )) {
        if (defaultSetting.type === "select" && Array.isArray((defaultSetting as SelectSetting).options)) {
          const defSetting = defaultSetting as SelectSetting;
          const idx = defSetting.options.indexOf(fbcSettings[settingName] as string);
          const len = defSetting.options.length;
          const disabled = defSetting.disabled?.() || false;
          DrawText(
            displayText(defaultSetting.label),
            400,
            y + 33,
            currentSetting === settingName ? "Red" : "Black",
            "Gray"
          );
          DrawBackNextButton(
            SelectButtonOffset,
            y,
            SelectButtonWidth,
            64,
            displayText(defSetting.options[idx]),
            disabled ? "#ebebe4" : "White",
            "",
            () => displayText(`${defaultSetting.label} ${defSetting.options[(idx - 1 + len) % len]}`),
            () => displayText(`${defaultSetting.label} ${defSetting.options[(idx + 1 + len) % len]}`),
            disabled
          );
        } else {
          DrawCheckbox(
            300,
            y,
            64,
            64,
            displayText(defaultSetting.label),
            !!fbcSettings[settingName],
            defaultSetting.disabled(),
            currentSetting === settingName ? "Red" : "Black"
          );
        }
        y += settingsYIncrement;
      }
      if (currentCategory === "buttplug") {
        DrawText(
          displayText("This page allows configuration of the synchronization of bluetooth connected toys."),
          300,
          350,
          "Black",
          "Gray"
        );
        ElementPosition("WceIntifaceAddress", 1300, settingsYStart + 32, 550);
        if (fbcSettings.toySync) {
          if (!toySyncState.client?.connected) {
            DrawText(displayText("Still connecting or connection failed..."), 300, 450, "Black", "Gray");
          } else {
            ctx.textAlign = "center";
            DrawButton(
              ...scanButtonPosition,
              displayText("Scan"),
              toySyncState.client.isScanning ? "Grey" : "White",
              "",
              // Bc types do not accept null
              // eslint-disable-next-line no-undefined
              toySyncState.client.isScanning ? "Already scanning" : undefined,
              toySyncState.client.isScanning
            );
            ctx.textAlign = "left";
            DrawText(displayText("Device Name"), 300, 420, "Black", "Gray");
            DrawText(displayText("Synchronized Slot"), 800, 420, "Black", "Gray");
            y = 500;
            for (const d of toySyncState.client.devices.filter(dev => dev.vibrateAttributes.length > 0)) {
              let deviceSettings = toySyncState.deviceSettings.get(d.name);
              if (!deviceSettings) {
                deviceSettings = {
                  Name: d.name,
                  SlotName: "None",
                };
                toySyncState.deviceSettings.set(d.name, deviceSettings);
              }
              const currentIdx = vibratingSlots.indexOf(deviceSettings.SlotName);
              let nextIdx = 0,
                previousIdx = 0;
              if (currentIdx <= 0) {
                previousIdx = vibratingSlots.length - 1;
              } else {
                previousIdx = currentIdx - 1;
              }
              if (currentIdx === vibratingSlots.length - 1) {
                nextIdx = 0;
              } else {
                nextIdx = currentIdx + 1;
              }
              DrawText(d.name, 300, y, "Black", "Gray");

              ctx.textAlign = "center";
              DrawBackNextButton(
                800,
                y - 32,
                450,
                64,
                displayText(deviceSettings.SlotName),
                "white",
                "",
                () => displayText(vibratingSlots[previousIdx]),
                () => displayText(vibratingSlots[nextIdx])
              );
              ctx.textAlign = "left";
              y += settingsYIncrement;
              if (y > 950) {
                break;
              }
            }
          }
        }
      } else {
        DrawText(displayText("Click on a setting to see its description"), 300, 160, "Gray", "Silver");

        if (isDefaultSettingKey(currentSetting)) {
          if (defaultSettings[currentSetting].type === "select" && Array.isArray((defaultSettings[currentSetting] as SelectSetting).tooltips)) {
            const defSetting = defaultSettings[currentSetting] as SelectSetting;
            const idx = defSetting.options.indexOf(fbcSettings[currentSetting] as string);
            drawTooltip(300, 800, 1600, displayText(defSetting.description), "left");
            drawTooltip(330, 870, 1570, displayText(defSetting.tooltips[idx]), "left");
          } else {
            drawTooltip(300, 830, 1600, displayText(defaultSettings[currentSetting].description), "left");
          }
        }
        if (settingsPageCount(currentCategory) > 1) {
          DrawText(`${currentPageNumber + 1} / ${settingsPageCount(currentCategory)}`, 1700, 230, "Black", "Gray");
          DrawButton(1815, 180, 90, 90, "", "White", "Icons/Next.png");
        }
      }
    } else {
      let y = settingsYStart;
      for (const category of settingsCategories) {
        DrawButton(300, y, 400, 64, "", "White");
        DrawTextFit(displayText(settingCategoryLabels[category]), 310, y + 32, 380, "Black");
        y += settingsYIncrement;
      }
    }
    ctx.textAlign = "center";
  }
  // eslint-disable-next-line complexity
  function PreferenceSubscreenBCESettingsClick() {
    let y = settingsYStart;
    if (MouseIn(1815, 75, 90, 90)) {
      if (currentCategory === null) {
        PreferenceSubscreenBCESettingsExit();
      } else {
        ElementPosition("WceIntifaceAddress", -999, -999, 550);
        currentCategory = null;
      }
    } else if (MouseIn(...licensePosition)) {
      open(BCE_LICENSE, "_blank");
    /* } else if (MouseIn(...discordInvitePosition)) {
      open(DISCORD_INVITE_URL, "_blank"); */
    } else if (MouseIn(...websitePosition)) {
      open(WEBSITE_URL, "_blank");
    } else if (currentCategory !== null) {
      if (MouseIn(1815, 180, 90, 90) && currentCategory !== "buttplug") {
        currentPageNumber += 1;
        currentPageNumber %= settingsPageCount(currentCategory);
      } else {
        for (const [settingName, defaultSetting] of currentDefaultSettings(currentCategory).slice(
          currentPageNumber * settingsPerPage,
          currentPageNumber * settingsPerPage + settingsPerPage
        )) {
          if (defaultSetting.type === "select" && Array.isArray((defaultSetting as SelectSetting).options)) {
            const defSetting = defaultSetting as SelectSetting;
            const segWidth = SelectButtonWidth / 2;
            const idx = defSetting.options.indexOf(fbcSettings[settingName] as string);
            const len = defSetting.options.length;
            if (MouseIn(SelectButtonOffset + segWidth, y, segWidth, 64) && (!defSetting.disabled?.())) {
              fbcSettings[settingName] = defSetting.options[(idx + 1 + len) % len];
            } else if (MouseIn(SelectButtonOffset, y, segWidth, 64) && (!defSetting.disabled?.())) {
              fbcSettings[settingName] = defSetting.options[(idx - 1 + len) % len];
            }
          } else if (MouseIn(300, y, 64, 64) && (!defaultSetting.disabled?.())) {
            fbcSettings[settingName] = !fbcSettings[settingName];
            defaultSetting.sideEffects(fbcSettings[settingName], false);
          }
          if (MouseIn(364, y, 1000, 64)) {
            currentSetting = settingName;
            debug("currentSetting", currentSetting);
          }
          y += settingsYIncrement;
        }
      }
      if (currentCategory === "buttplug" && toySyncState.client?.connected) {
        if (MouseIn(...scanButtonPosition)) {
          if (!toySyncState.client.isScanning) {
            toySyncState.client.startScanning();
          }
          return;
        }
        y = 500;
        for (const d of toySyncState.client.devices.filter(dev => dev.vibrateAttributes.length > 0)) {
          if (!MouseIn(800, y - 32, 450, 64)) {
            y += settingsYIncrement;
            continue;
          }
          const deviceSettings = toySyncState.deviceSettings.get(d.name);
          if (!deviceSettings) {
            logWarn("Could not find device settings for", d.name, toySyncState.deviceSettings);
            y += settingsYIncrement;
            continue;
          }
          const currentIdx = vibratingSlots.indexOf(deviceSettings.SlotName);
          let nextIdx = 0,
            previousIdx = 0;
          if (currentIdx <= 0) {
            previousIdx = vibratingSlots.length - 1;
          } else {
            previousIdx = currentIdx - 1;
          }
          if (currentIdx === vibratingSlots.length - 1) {
            nextIdx = 0;
          } else {
            nextIdx = currentIdx + 1;
          }

          if (MouseX < 800 + 450 / 2) {
            deviceSettings.SlotName = vibratingSlots[previousIdx];
          } else {
            deviceSettings.SlotName = vibratingSlots[nextIdx];
          }

          y += settingsYIncrement;
          if (y > 950) {
            break;
          }
        }
      }
    } else {
      for (const category of settingsCategories) {
        if (MouseIn(300, y, 400, 64)) {
          currentCategory = category;
          currentPageNumber = 0;
          break;
        }
        y += settingsYIncrement;
      }
    }
  }

  PreferenceRegisterExtensionSetting({
    Identifier: "WCE",
    ButtonText: displayText("WCE Settings"),
    Image: `${PUBLIC_URL}/icon.png`,
    click: PreferenceSubscreenBCESettingsClick,
    run: PreferenceSubscreenBCESettingsRun,
    exit: PreferenceSubscreenBCESettingsExit,
    load: PreferenceSubscreenBCESettingsLoad,
  });

  function keyHandler(e: KeyboardEvent): void {
    if (e.key === "Escape" && currentCategory !== null) {
      currentCategory = null;
      ElementPosition("WceIntifaceAddress", -999, -999, 550);
      e.stopPropagation();
      e.preventDefault();
    }
  }

  document.addEventListener("keydown", keyHandler, true);
  document.addEventListener("keypress", keyHandler, true);
}
