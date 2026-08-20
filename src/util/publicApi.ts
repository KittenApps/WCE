// Shared infrastructure for WCE's public JS API (`window.WCE.*`), used by other addons/userscripts
// to integrate with WCE without needing to hook its internals directly.

if (!globalThis.WCE) {
  globalThis.WCE = {};
}

/** The single shared `WCE` namespace object. Feature modules attach their own sub-namespace to this. */
export const WCE_NAMESPACE: WCEPublicAPI = globalThis.WCE;

/**
 * Creates a small stateful API that lets other addons reposition or temporarily hide a
 * WCE-drawn screen button (e.g. because it overlaps with their own UI), without needing to know
 * about the feature's internals. Returns the public API object plus internal accessors for the
 * owning feature to use when drawing / hit-testing the button.
 */
export function createPositionableButton(defaultPosition: [number, number, number, number]): {
  api: WCEPositionableButtonAPI;
  getPosition: () => [number, number, number, number];
  isHidden: () => boolean;
} {
  let position: [number, number, number, number] = [...defaultPosition];
  let hidden = false;

  function setPosition(x: number, y: number, w: number, h: number): void {
    for (const n of [x, y, w, h]) {
      if (typeof n !== "number" || !Number.isFinite(n)) {
        throw new TypeError("setPosition: x, y, w, h must all be finite numbers");
      }
    }
    position = [x, y, w, h];
  }

  const api: WCEPositionableButtonAPI = {
    getPosition: () => [...position],
    setPosition,
    resetPosition: () => {
      position = [...defaultPosition];
    },
    hide: () => {
      hidden = true;
    },
    show: () => {
      hidden = false;
    },
    isHidden: () => hidden,
  };

  return { api, getPosition: () => position, isHidden: () => hidden };
}
