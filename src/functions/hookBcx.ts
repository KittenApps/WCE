import { waitFor } from "../util/utils";
import type { BCX_ModAPI, BCX_Rule, BCX_RuleStateAPI } from "../../types/bcxExternalInterface";

let BCX: BCX_ModAPI = null;

export default async function hookBCXAPI(): Promise<void> {
  await waitFor(() => !!window.bcx);
  BCX = window.bcx?.getModApi("WCE") ?? null;
}

export function BCXgetRuleState<ID extends BCX_Rule>(rule: ID): BCX_RuleStateAPI<ID> | null {
  return BCX?.getRuleState(rule) ?? null;
}
