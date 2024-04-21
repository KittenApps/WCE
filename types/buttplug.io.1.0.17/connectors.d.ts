export declare class ButtplugEmbeddedConnectorOptions {
  ServerName: string;
  DeviceConfigJSON: string;
  UserDeviceConfigJSON: string;
  DeviceCommunicationManagerTypes: number;
  AllowRawMessages: boolean;
  MaxPingTime: number;
  constructor(
    ServerName?: string,
    DeviceConfigJSON?: string,
    UserDeviceConfigJSON?: string,
    DeviceCommunicationManagerTypes?: number,
    AllowRawMessages?: boolean,
    MaxPingTime?: number
  );
}
export declare class ButtplugWebsocketConnectorOptions {
  Address: string;
  constructor(Address?: string);
}
