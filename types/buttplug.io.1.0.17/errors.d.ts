import { Buttplug } from "./buttplug_ffi.js";
export declare class ButtplugError extends Error {
  innerError: Error | undefined;
  messageId: number | undefined;
  protected constructor(aMessage: string, aId?: number, aInner?: Error);
}
export declare class ButtplugHandshakeError extends ButtplugError {
  constructor(aMessage: string, aId?: number);
}
export declare class ButtplugDeviceError extends ButtplugError {
  constructor(aMessage: string, aId?: number);
}
export declare class ButtplugMessageError extends ButtplugError {
  constructor(aMessage: string, aId?: number);
}
export declare class ButtplugPingError extends ButtplugError {
  constructor(aMessage: string, aId?: number);
}
export declare class ButtplugUnknownError extends ButtplugError {
  constructor(aMessage: string, aId?: number);
}
export declare class ButtplugClientConnectorError extends ButtplugError {
  constructor(aMessage: string, aId?: number);
}
export declare function convertPBufError(
  err: Buttplug.ServerMessage.IError,
  id: number
): ButtplugError;
