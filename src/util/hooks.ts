import { SDK, HOOK_PRIORITIES } from "./modding";

const timers: { lastTime: number; cb: () => void; intval: number }[] = [];

export function createTimer(cb: () => void, intval: number): () => void {
  timers.push({ cb, intval, lastTime: performance.now() });
  return () => {
    timers.splice(
      timers.findIndex(t => t.cb === cb),
      1
    );
  };
}

SDK.hookFunction("GameRun", HOOK_PRIORITIES.Top, (args, next) => {
  const ts = performance.now();
  timers.forEach(t => {
    if (ts - t.lastTime > t.intval) {
      t.lastTime = ts;
      t.cb();
    }
  });
  return next(args);
});

export function fbcBeepNotify(title: string, text: string): void {
  SDK.callOriginal("ServerAccountBeep", [
    { MemberNumber: Player.MemberNumber || -1, BeepType: "", MemberName: "WCE", ChatRoomName: title, Private: true, Message: text, ChatRoomSpace: "" },
  ]);
}
