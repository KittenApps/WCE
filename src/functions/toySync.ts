import type { ButtplugClient } from "@zendrex/buttplug.js";

import { createTimer } from "../util/hooks";
import { displayText } from "../util/localization";
import { debug, logInfo, logWarn, logError } from "../util/logger";
import { fbcSettings } from "../util/settings";
import { fbcChatNotify } from "../util/utils";

export interface FBCToySetting {
  Name: string;
  SlotName: string;
  LastIntensity?: number;
}
interface FBCToySyncState {
  client?: ButtplugClient;
  deviceSettings: Map<string, FBCToySetting>;
}

export const toySyncState: FBCToySyncState = { deviceSettings: new Map() };

export default async function toySync(): Promise<void> {
  // Handles synchronizing in-game vibrators with real bluetooth devices via buttplut.io
  if (!fbcSettings.toySync) {
    return;
  }

  const { ButtplugClient, consoleLogger, ConnectionError } = await import("@zendrex/buttplug.js");

  logInfo("Loaded Buttplug.io");

  const client = new ButtplugClient(fbcSettings.toySyncAddress || "ws://127.0.0.1:12345", { autoReconnect: true, logger: consoleLogger });

  client.on("device.added", ({ data: { device } }) => {
    debug("Device connected", device);
    fbcChatNotify(displayText("Vibrator connected: $DeviceName", { $DeviceName: device.displayName }));
    const deviceSettings = toySyncState.deviceSettings.get(device.name);
    if (deviceSettings) delete deviceSettings.LastIntensity;
  });
  client.on("device.removed", ({ data: { device } }) => {
    debug("Device disconnected", device);
    fbcChatNotify(displayText("Vibrator disconnected: $DeviceName", { $DeviceName: device.displayName }));
  });
  client.on("scan.finished", () => {
    debug("Scanning finished");
  });

  try {
    await client.connect();
    await client.startScanning();
    await client.requestDeviceList();
  } catch (err) {
    if (err instanceof ConnectionError) {
      FUSAM.modals.openAsync({
        prompt: displayText(
          "buttplug.io is enabled, but server could not be contacted at $toySyncAddress. Is Intiface Desktop running? Is another client connected to it?",
          { $toySyncAddress: fbcSettings.toySyncAddress }
        ),
        buttons: { submit: "OK" },
      });
      logError("buttplug.io could not connect to server", err);
    }
  }

  toySyncState.client = client;

  // Sync vibrations from slots
  const removeTimer = createTimer(() => {
    if (!client.connected) {
      removeTimer();
      return;
    }
    for (const d of client.devices.filter(dev => dev.canOutput("Vibrate"))) {
      const deviceSettings = toySyncState.deviceSettings?.get(d.name);
      if (!deviceSettings) continue;

      const slot = deviceSettings.SlotName;
      const intensity = Player.Appearance.find(a => a.Asset.Group.Name === slot)?.Property?.Intensity;

      if (deviceSettings.LastIntensity === intensity) continue;
      deviceSettings.LastIntensity = intensity;

      if (typeof intensity !== "number" || intensity < 0) {
        d.vibrate(0);
      } else {
        switch (intensity) {
          case 0:
            d.vibrate(0.1);
            debug(d.name, slot, "intensity 10");
            break;
          case 1:
            d.vibrate(0.4);
            debug(d.name, slot, "intensity 40");
            break;
          case 2:
            d.vibrate(0.75);
            debug(d.name, slot, "intensity 75");
            break;
          case 3:
            d.vibrate(1);
            debug(d.name, slot, "intensity 100");
            break;
          default:
            logWarn("Invalid intensity in ", slot, ":", intensity);
            break;
        }
      }
    }
  }, 3000);

  CommandCombine([
    {
      Tag: "toybatteries",
      Description: displayText("Shows the battery status of all connected buttplug.io toys"),
      Action: (): void => {
        if (!client.connected) {
          fbcChatNotify("buttplug.io is not connected");
          return;
        }
        const batteryDevices = client.devices.filter(dev => dev.canRead("Battery"));
        if (batteryDevices.length === 0) {
          fbcChatNotify("No battery devices connected");
          return;
        }
        Promise.all(batteryDevices.map(dev => dev.readSensor("Battery"))).then((batteryStatus: number[]) => {
          for (let i = 0; i < batteryDevices.length; i++) {
            const battery = batteryStatus[i] * 100;
            fbcChatNotify(`${batteryDevices[i].displayName}: ${battery}%`);
          }
        });
      },
    },
    {
      Tag: "toyscan",
      Description: displayText("Scans for connected buttplug.io toys"),
      Action: (): void => {
        if (!client.connected) {
          fbcChatNotify(displayText("buttplug.io is not connected"));
          return;
        }
        if (client.scanning) {
          client.stopScanning();
          fbcChatNotify(displayText("Scanning stopped"));
          return;
        }
        client.startScanning();
        fbcChatNotify(displayText("Scanning for toys"));
      },
    },
  ]);

  await client.startScanning();
}
