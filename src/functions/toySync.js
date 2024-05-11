import { toySyncState, createTimer } from '..';
import { fbcSettings } from '../util/settings';
import { debug, logInfo, logWarn, logError } from '../util/logger';
import { displayText } from '../util/localization';

export function toySync() {
  // Handles synchronizing in-game vibrators with real bluetooth devices via buttplut.io
  if (!fbcSettings.toySync) {
    return;
  }

  const frame = document.createElement("iframe");
  frame.src = "./changelog.html";
  frame.classList.add("bce-false-hidden");
  const script = document.createElement("script");
  const notifierScript = document.createElement("script");
  frame.onload = () => {
    if (!frame.contentDocument) {
      throw new Error("frame.contentDocument is null onload");
    }
    frame.contentDocument.head.appendChild(notifierScript);
    frame.contentDocument.head.appendChild(script);
  };
  logInfo("Loading buttplug.io");

  const onload = async () => {
    logInfo("Loaded Buttplug.io");
    /** @type {import('../../types/buttplug.io.1.0.17')} */
    // @ts-ignore
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const bp = frame.contentWindow.Buttplug;

    /** @type {import('../../types/buttplug.io.1.0.17').ButtplugClient} */
    const client = new bp.ButtplugClient("BceToySync");
    client.addListener(
      "deviceadded",
      (
        /** @type {import('../../types/buttplug.io.1.0.17').ButtplugClientDevice} */
        device
      ) => {
        debug("Device connected", device);
        fbcChatNotify(
          displayText(`Vibrator connected: $DeviceName`, {
            $DeviceName: device.Name,
          })
        );
        const deviceSettings = toySyncState.deviceSettings.get(device.Name);
        if (deviceSettings) {
          delete deviceSettings.LastIntensity;
        }
      }
    );
    client.addListener(
      "deviceremoved",
      (
        /** @type {import('../../types/buttplug.io.1.0.17').ButtplugClientDevice} */
        device
      ) => {
        debug("Device disconnected", device);
        fbcChatNotify(
          displayText(`Vibrator disconnected: $DeviceName`, {
            $DeviceName: device.Name,
          })
        );
      }
    );
    client.addListener("scanningfinished", (data) => {
      debug("Scanning finished", data);
    });

    const connector = new bp.ButtplugWebsocketConnectorOptions();
    connector.Address = "ws://127.0.0.1:12345";
    try {
      await client.connect(connector);
      logInfo("Connected buttplug.io");
    } catch (ex) {
      if (ex) {
        // eslint-disable-next-line no-alert
        alert(
          displayText(
            "buttplug.io is enabled, but server could not be contacted at ws://127.0.0.1:12345. Is Intiface Desktop running? Is another client connected to it?"
          )
        );
        logError("buttplug.io could not connect to server", ex);
        return;
      }
    }

    toySyncState.client = client;

    let lastSync = 0;
    // Sync vibrations from slots
    createTimer(() => {
      if (lastSync > Date.now() - 3000) {
        // Don't change vibes more than once per 3 seconds
        return;
      }

      // 0 is VibrateCmd
      for (const d of client.Devices.filter((dev) => dev.AllowedMessages.includes(0))) {
        const deviceSettings = toySyncState.deviceSettings?.get(d.Name);
        if (!deviceSettings) {
          continue;
        }

        const slot = deviceSettings.SlotName;
        const intensity = Player.Appearance.find((a) => a.Asset.Group.Name === slot)?.Property?.Intensity;

        if (deviceSettings.LastIntensity === intensity) {
          continue;
        }
        deviceSettings.LastIntensity = intensity;

        lastSync = Date.now();
        if (typeof intensity !== "number" || intensity < 0) {
          d.vibrate(0);
        } else {
          switch (intensity) {
            case 0:
              d.vibrate(0.1);
              debug(d.Name, slot, "intensity 0.1");
              break;
            case 1:
              d.vibrate(0.4);
              debug(d.Name, slot, "intensity 0.4");
              break;
            case 2:
              d.vibrate(0.75);
              debug(d.Name, slot, "intensity 0.75");
              break;
            case 3:
              d.vibrate(1.0);
              debug(d.Name, slot, "intensity 1");
              break;
            default:
              logWarn("Invalid intensity in ", slot, ":", intensity);
              break;
          }
        }
      }
    }, 0);

    Commands.push({
      Tag: "toybatteries",
      Description: displayText("Shows the battery status of all connected buttplug.io toys"),
      Action: () => {
        (async () => {
          if (!client.Connected) {
            fbcChatNotify("buttplug.io is not connected");
            return;
          }

          const batteryDevices = client.Devices.filter((dev) => dev.AllowedMessages.includes(8));
          if (batteryDevices.length === 0) {
            fbcChatNotify("No battery devices connected");
            return;
          }

          const batteryStatus = await Promise.all(batteryDevices.map((dev) => dev.batteryLevel()));
          for (let i = 0; i < batteryDevices.length; i++) {
            const battery = batteryStatus[i] * 100;
            fbcChatNotify(`${batteryDevices[i].Name}: ${battery}%`);
          }
        })();
      },
    });

    Commands.push({
      Tag: "toyscan",
      Description: displayText("Scans for connected buttplug.io toys"),
      Action: () => {
        if (!client.Connected) {
          fbcChatNotify(displayText("buttplug.io is not connected"));
          return;
        }

        if (client.isScanning) {
          client.stopScanning();
          fbcChatNotify(displayText("Scanning stopped"));
          return;
        }

        client.startScanning();
        fbcChatNotify(displayText("Scanning for toys"));
      },
    });

    await client.startScanning();
  };

  window.onmessage = (
    /** @type {MessageEvent<unknown>} */
    e
  ) => {
    if (e.data === "buttplug-loaded") {
      onload();
    }
  };

  notifierScript.textContent = `
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  (async function () {
    while (typeof Buttplug !== "object" || Buttplug === null) {
      await sleep(10);
    }

    await Buttplug.buttplugInit();

    window.top.postMessage("buttplug-loaded", "${window.location.origin}");
  })();
  `;

  script.src = "https://cdn.jsdelivr.net/npm/buttplug@1.0.17/dist/web/buttplug.min.js";
  document.body.appendChild(frame);
}