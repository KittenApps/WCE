import { SDK, HOOK_PRIORITIES } from "../util/modding";

interface SocketReservedEvents {
  connect: () => void;
  connect_error: (err: Error) => void;
  disconnect: (reason: "io server disconnect" | "io client disconnect" | "ping timeout" | "transport close" | "transport error") => void;
}
type EventNames<Map> = keyof Map & (string | symbol);
type ReservedOrUserEventNames<ReservedEventsMap, UserEvents> = EventNames<ReservedEventsMap> | EventNames<UserEvents>;

const listeners: [ReservedOrUserEventNames<SocketReservedEvents, ServerToClientEvents>, (...args: unknown[]) => unknown][] = [];

export function registerSocketListener(event: ReservedOrUserEventNames<SocketReservedEvents, ServerToClientEvents>, cb: (...args: unknown[]) => unknown) {
  if (!listeners.some((l) => l[1] === cb)) {
    listeners.push([event, cb]);
    return ServerSocket.on(event, cb);
  }
  return null;
}

export default function appendSocketListenersToInit() {
  // This will be called after reconnect, but not during initial load
  SDK.hookFunction(
    "ServerInit",
    HOOK_PRIORITIES.AddBehaviour,
    (args, next) => {
      const ret = next(args);
      for (const [event, cb] of listeners) {
        ServerSocket.on(event, cb);
      }
      return ret;
    }
  );
}
