/*!
 * Buttplug JS Source Code File - Visit https://buttplug.io for more info about
 * the project. Licensed under the BSD 3-Clause license. See LICENSE file in the
 * project root for full license information.
 *
 * @copyright Copyright (c) Nonpolynomial Labs LLC. All rights reserved.
 */
import { Buttplug } from "./buttplug_ffi.js";
export declare class ButtplugMessageSorter {
  protected _counter: number;
  protected _waitingMsgs: Map<
    number,
    [(val: Buttplug.ServerMessage) => void, (err: Error) => void]
  >;
  constructor();
  PrepareOutgoingMessage(
    aMsg: Buttplug.ClientMessage | Buttplug.DeviceMessage
  ): Promise<Buttplug.ButtplugFFIServerMessage>;
  ParseIncomingMessages(
    msg: Buttplug.ButtplugFFIServerMessage
  ): Buttplug.ServerMessage | null;
}
