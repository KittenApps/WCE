import { SDK, HOOK_PRIORITIES } from "../util/modding";

/** @type {[any, any][]} */
const listeners = [];
/** @type {typeof ServerSocket.on} */

export function registerSocketListener(event, cb) {
  if (!listeners.some((l) => l[1] === cb)) {
    listeners.push([event, cb]);
    // @ts-ignore - too lazy to fix
    return ServerSocket.on(event, cb);
  }
  // @ts-ignore - too lazy to fix
  return null;
}

export function appendSocketListenersToInit() {
  SDK.hookFunction(
    "ServerInit",
    HOOK_PRIORITIES.AddBehaviour,
    /**
     * @param {Parameters<typeof ServerInit>} args
     */
    (args, next) => {
      const ret = next(args);
      for (const [event, cb] of listeners) {
        ServerSocket.on(event, cb);
      }
      return ret;
    }
  );
}
