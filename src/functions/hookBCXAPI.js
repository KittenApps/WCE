import { waitFor } from "../util/utils";

/** @type {import('../../types/bcxExternalInterface').BCX_ModAPI | null} */
export let BCX = null;

export async function hookBCXAPI() {
  await waitFor(() => !!window.bcx);
  BCX = window.bcx?.getModApi("WCE") ?? null;
}
