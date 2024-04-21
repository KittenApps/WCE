/*!
 * Buttplug JS Source Code File - Visit https://buttplug.io for more info about
 * the project. Licensed under the BSD 3-Clause license. See LICENSE file in the
 * project root for full license information.
 *
 * @copyright Copyright (c) Nonpolynomial Labs LLC. All rights reserved.
 */
import { EventEmitter } from "events";
import { Buttplug } from "./buttplug_ffi.js";
import { ButtplugMessageSorter } from "./sorter.js";
export import ButtplugDeviceMessageType = Buttplug.ServerMessage.MessageAttributeType;
export declare class MessageAttributes {
  /** MessageAttributes featureCount */
  featureCount?: number | null;
  /** MessageAttributes stepCount */
  stepCount?: number[] | null;
  /** MessageAttributes endpoints */
  endpoints?: Buttplug.Endpoint[] | null;
  /** MessageAttributes maxDuration */
  maxDuration?: number[] | null;
  constructor(attributes: Buttplug.ServerMessage.IMessageAttributes);
}
export declare class VibrationCmd {
  readonly Index: number;
  readonly Speed: number;
  constructor(index: number, speed: number);
}
export declare class RotationCmd {
  readonly Index: number;
  readonly Speed: number;
  readonly Clockwise: boolean;
  constructor(index: number, speed: number, clockwise: boolean);
}
export declare class VectorCmd {
  readonly Index: number;
  readonly Duration: number;
  readonly Position: number;
  constructor(index: number, duration: number, position: number);
}
/**
 * Represents an abstract device, capable of taking certain kinds of messages.
 */
export declare class ButtplugClientDevice extends EventEmitter {
  private _name;
  private _index;
  private _devicePtr;
  private _messageAttributes;
  private _sorter;
  private _sorterCallback;
  /**
   * Return the name of the device.
   */
  get Name(): string;
  /**
   * Return the index of the device.
   */
  get Index(): number;
  /**
   * Return a list of message types the device accepts.
   */
  get AllowedMessages(): ButtplugDeviceMessageType[];
  /**
   * @param _index Index of the device, as created by the device manager.
   * @param _name Name of the device.
   * @param allowedMsgs Buttplug messages the device can receive.
   */
  constructor(
    devicePtr: number,
    sorter: ButtplugMessageSorter,
    sorter_callback: Function,
    index: number,
    name: string,
    allowedMsgsObj: Buttplug.ServerMessage.IMessageAttributes[]
  );
  /**
   * Return the message attributes related to the given message
   */
  messageAttributes(
    messageName: ButtplugDeviceMessageType
  ): MessageAttributes | undefined;
  protected checkAllowedMessageType(
    messageType: ButtplugDeviceMessageType
  ): void;
  vibrate(speeds: number | Array<VibrationCmd | number>): Promise<void>;
  rotate(
    speeds: number | RotationCmd[],
    clockwise: boolean | undefined
  ): Promise<void>;
  linear(
    position: number | VectorCmd[],
    duration: number | undefined
  ): Promise<void>;
  batteryLevel(): Promise<number>;
  rssiLevel(): Promise<number>;
  rawRead(
    endpoint: Buttplug.Endpoint,
    expectedLength: number,
    timeout: number
  ): Promise<Uint8Array>;
  rawWrite(
    endpoint: Buttplug.Endpoint,
    data: Uint8Array,
    writeWithResponse: boolean
  ): Promise<void>;
  rawSubscribe(endpoint: Buttplug.Endpoint): Promise<void>;
  rawUnsubscribe(endpoint: Buttplug.Endpoint): Promise<void>;
  stop(): Promise<void>;
  emitDisconnected(): void;
}
