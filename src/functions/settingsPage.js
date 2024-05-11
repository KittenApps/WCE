import { toySyncState } from "./toySync";
import { ICONS } from "../util/constants";
import { waitFor, objEntries, drawTooltip } from "../util/utils";
import { debug, logWarn, logError } from "../util/logger";
import { fbcSettings, defaultSettings, bceSaveSettings, isDefaultSettingKey } from "../util/settings";
import { displayText } from "../util/localization";
import { BCE_LICENSE, DISCORD_INVITE_URL, WEBSITE_URL } from "../util/constants";

// Create settings page
export async function settingsPage() {
  await waitFor(() => !!PreferenceSubscreenList);

  debug("initializing");

  const settingsPerPage = 8,
    settingsYIncrement = 70,
    settingsYStart = 225;

  /**
   * @param {SettingsCategory} category
   */
  const settingsPageCount = (category) =>
    Math.ceil(Object.values(defaultSettings).filter((v) => v.category === category).length / settingsPerPage);

  const discordInvitePosition = /** @type {const} */ ([1500, 60, 250, 50]);
  const licensePosition = /** @type {const} */ ([1500, 120, 250, 50]);
  const websitePosition = /** @type {const} */ ([1240, 60, 250, 50]);
  let currentPageNumber = 0;

  /** @type {SettingsCategory | null} */
  let currentCategory = null;
  let currentSetting = "";
  /**
   * Excludes hidden
   * @type {SettingsCategory[]}
   */
  const settingsCategories = [
    "chat",
    "activities",
    "appearance",
    "immersion",
    "performance",
    "misc",
    "cheats",
    "buttplug",
  ];
  const settingCategoryLabels = /** @type {const} */ ({
    chat: "Chat & Social",
    activities: "Activities & Arousal",
    appearance: "Appearance & Wardrobe",
    immersion: "Immersion & Anti-Cheat",
    performance: "Performance",
    misc: "Misc",
    cheats: "Cheats",
    buttplug: "Buttplug.io Toys",
    hidden: "",
  });

  const vibratingSlots = [
    "None",
    ...new Set(
      Asset.filter((a) => a.AllowEffect?.includes("Vibrating") || a.AllowEffect?.includes("Egged")).map(
        (a) => a.Group.Name
      )
    ),
  ];

  const scanButtonPosition = /** @type {const} */ ([1650, 225, 150, 50]);

  /**
   * @param {SettingsCategory} category
   */
  const currentDefaultSettings = (category) =>
    objEntries(defaultSettings).filter(([, v]) => v.category === category && v.value === !!v.value);

  const PreferenceSubscreenBCESettingsLoad = function () {
    currentPageNumber = 0;
  };
  const PreferenceSubscreenBCESettingsExit = function () {
    bceSaveSettings();
    PreferenceSubscreenExtensionsClear();
  };
  const PreferenceSubscreenBCESettingsRun = function () {
    const ctx = window.MainCanvas.getContext("2d");
    if (!ctx) {
      logError("Could not get canvas context");
      return;
    }
    ctx.textAlign = "left";
    DrawText(displayText("For Better Club Settings (FBC)"), 300, 125, "Black", "Gray");
    DrawButton(...discordInvitePosition, "", "White", "");
    DrawText(
      displayText("Join Discord"),
      discordInvitePosition[0] + 20,
      discordInvitePosition[1] + discordInvitePosition[3] / 2,
      "Black",
      ""
    );
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
        DrawCheckbox(
          300,
          y,
          64,
          64,
          displayText(defaultSetting.label),
          !!fbcSettings[settingName],
          false,
          currentSetting === settingName ? "Red" : "Black"
        );
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
        if (fbcSettings.toySync) {
          if (!toySyncState.client?.Connected) {
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
            for (const d of toySyncState.client.Devices.filter((dev) => dev.AllowedMessages.includes(0))) {
              let deviceSettings = toySyncState.deviceSettings.get(d.Name);
              if (!deviceSettings) {
                deviceSettings = {
                  Name: d.Name,
                  SlotName: "None",
                };
                toySyncState.deviceSettings.set(d.Name, deviceSettings);
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
              DrawText(d.Name, 300, y, "Black", "Gray");

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
          drawTooltip(300, 830, 1400, displayText(defaultSettings[currentSetting].description), "left");
        }

        DrawText(`${currentPageNumber + 1} / ${settingsPageCount(currentCategory)}`, 1700, 230, "Black", "Gray");
        DrawButton(1815, 180, 90, 90, "", "White", "Icons/Next.png");
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
  };
  // eslint-disable-next-line complexity
  const PreferenceSubscreenBCESettingsClick = function () {
    let y = settingsYStart;
    if (MouseIn(1815, 75, 90, 90)) {
      if (currentCategory === null) {
        PreferenceSubscreenBCESettingsExit();
      } else {
        currentCategory = null;
      }
    } else if (MouseIn(...licensePosition)) {
      open(BCE_LICENSE, "_blank");
    } else if (MouseIn(...discordInvitePosition)) {
      open(DISCORD_INVITE_URL, "_blank");
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
          if (MouseIn(300, y, 64, 64)) {
            fbcSettings[settingName] = !fbcSettings[settingName];
            defaultSetting.sideEffects(fbcSettings[settingName]);
          } else if (MouseIn(364, y, 1000, 64)) {
            currentSetting = settingName;
            debug("currentSetting", currentSetting);
          }
          y += settingsYIncrement;
        }
      }
      if (currentCategory === "buttplug" && toySyncState.client?.Connected) {
        if (MouseIn(...scanButtonPosition)) {
          if (!toySyncState.client.isScanning) {
            toySyncState.client.startScanning();
          }
          return;
        }
        y = 500;
        for (const d of toySyncState.client.Devices.filter((dev) => dev.AllowedMessages.includes(0))) {
          if (!MouseIn(800, y - 32, 450, 64)) {
            y += settingsYIncrement;
            continue;
          }
          const deviceSettings = toySyncState.deviceSettings.get(d.Name);
          if (!deviceSettings) {
            logWarn("Could not find device settings for", d.Name, toySyncState.deviceSettings);
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
  };

  PreferenceRegisterExtensionSetting({
    Identifier: "FBC",
    ButtonText: displayText("FBC Settings"),
    Image: ICONS.LOGO,
    click: PreferenceSubscreenBCESettingsClick,
    run: PreferenceSubscreenBCESettingsRun,
    exit: PreferenceSubscreenBCESettingsExit,
    load: PreferenceSubscreenBCESettingsLoad,
    unload: () => {},
  });

  /** @type {(e: KeyboardEvent) => void} */
  function keyHandler(e) {
    if (e.key === "Escape" && currentCategory !== null) {
      currentCategory = null;
      e.stopPropagation();
      e.preventDefault();
    }
  }

  document.addEventListener("keydown", keyHandler, true);
  document.addEventListener("keypress", keyHandler, true);
}
