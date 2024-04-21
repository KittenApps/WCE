/*!
 * Buttplug JS Source Code File - Visit https://buttplug.io for more info about
 * the project. Licensed under the BSD 3-Clause license. See LICENSE file in the
 * project root for full license information.
 *
 * @copyright Copyright (c) Nonpolynomial Labs LLC. All rights reserved.
 */
import { EventEmitter } from "events";
import {
  ButtplugEmbeddedConnectorOptions,
  ButtplugWebsocketConnectorOptions,
} from "./connectors.js";
import { ButtplugClientDevice } from "./device.js";
export declare class ButtplugClient extends EventEmitter {
  protected _devices: Map<number, ButtplugClientDevice>;
  protected _clientName: string;
  private _clientPtr?;
  protected _isScanning: boolean;
  private _connected;
  private _sorter;
  constructor(clientName?: string);
  get Connected(): boolean;
  get Devices(): ButtplugClientDevice[];
  get isScanning(): boolean;
  connect: (
    options:
      | ButtplugEmbeddedConnectorOptions
      | ButtplugWebsocketConnectorOptions
  ) => Promise<void>;
  disconnect: () => Promise<void>;
  startScanning: () => Promise<void>;
  stopScanning: () => Promise<void>;
  stopAllDevices: () => Promise<void>;
  protected CheckConnector(): void;
  private sorterCallback;
}
