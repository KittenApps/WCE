/* eslint-disable camelcase */
import { waitFor } from "../util/utils";
import type { BCX_ModAPI } from "../../types/bcxExternalInterface";

export let BCX: BCX_ModAPI = null;

export default async function hookBCXAPI(): Promise<void> {
  await waitFor(() => !!window.bcx);
  BCX = window.bcx?.getModApi("WCE") ?? null;
}
