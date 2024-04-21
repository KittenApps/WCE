import { Buttplug } from "./buttplug_ffi.js";
import {
  ButtplugEmbeddedConnectorOptions,
  ButtplugWebsocketConnectorOptions,
} from "./connectors.js";
import { ButtplugMessageSorter } from "./sorter.js";
export declare function buttplugInit(): Promise<void>;
export declare function connectEmbedded(
  sorter: ButtplugMessageSorter,
  clientPtr: number,
  options: ButtplugEmbeddedConnectorOptions,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function connectWebsocket(
  sorter: ButtplugMessageSorter,
  clientPtr: number,
  options: ButtplugWebsocketConnectorOptions,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function disconnect(
  sorter: ButtplugMessageSorter,
  clientPtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function startScanning(
  sorter: ButtplugMessageSorter,
  clientPtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function stopScanning(
  sorter: ButtplugMessageSorter,
  clientPtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function stopAllDevices(
  sorter: ButtplugMessageSorter,
  clientPtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function vibrate(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  speeds: Buttplug.DeviceMessage.VibrateComponent[],
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function rotate(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  rotations: Buttplug.DeviceMessage.RotateComponent[],
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function linear(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  vectors: Buttplug.DeviceMessage.LinearComponent[],
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function stopDevice(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function batteryLevel(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function rssiLevel(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function rawRead(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  endpoint: Buttplug.Endpoint,
  expectedLength: number,
  timeout: number,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function rawWrite(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  endpoint: Buttplug.Endpoint,
  data: Uint8Array,
  writeWithResponse: boolean,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function rawSubscribe(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  endpoint: Buttplug.Endpoint,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function rawUnsubscribe(
  sorter: ButtplugMessageSorter,
  devicePtr: number,
  endpoint: Buttplug.Endpoint,
  callback: Function
): Promise<Buttplug.ButtplugFFIServerMessage>;
export declare function createClientPtr(
  eventCallback: Function,
  clientName: string
): number;
export declare function createDevicePtr(
  clientPtr: number,
  deviceIndex: number
): number | null;
export declare function freeClientPtr(clientPtr: number): void;
export declare function freeDevicePtr(devicePtr: number): void;
export declare function activateConsoleLogger(
  logLevel: "error" | "warn" | "info" | "debug" | "trace"
): void;
