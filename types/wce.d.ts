export {};

declare global {
  interface Window {
    InputChat?: HTMLTextAreaElement;
    MainCanvas: HTMLCanvasElement;
  }

  var bce_ArousalExpressionStages: ArousalExpressionStages;
  var bce_ActivityTriggers: ActivityTrigger[];
  var bce_EventExpressions: { [key: string]: Expression };

  var PUBLIC_URL: string;
  var StartBcUtil: () => void;
  var bcx: import("./bcxExternalInterface").BCX_ConsoleInterface | undefined;
  var bcModSdk: import("bondage-club-mod-sdk").ModSDKGlobalAPI | undefined;
  var FUSAM: FUSAMPublicAPI | undefined;
  type FUSAMPublicAPI = {
    present: true;
    addons: Record<string, FUSAMAddonState>;
    registerDebugMethod: (name: string, method: () => string | Promise<string>) => void;
    modals: { open: (options: ModalOptions) => void; openAsync: (options: Omit<ModalOptions, "callback">) => Promise<[string, string | null]> };
  };
  type ModalOptions = {
    prompt: string | Node;
    input?: { initial: string; readonly: boolean; type: "input" | "textarea" };
    callback: (action: string, inputValue?: string) => void;
    buttons?: { submit: string } & Record<string, string>;
  };
  type FUSAMAddonState = { distribution: string; status: "loading" | "loaded" | "error" };

  type FBCNote = { note: string; updatedAt?: number; memberNumber?: number };
  type Friend = { MemberName: string; MemberNumber: number };
  type Passwords = Record<string, string>;
  type ArousalExpressionStage = { Expression: ExpressionName; Limit: number };
  type ArousalExpressionStages = Record<string, ArousalExpressionStage[]>;
  type ExpressionStage = {
    Id?: number;
    Expression?: ExpressionName | null;
    ExpressionModifier?: number;
    Duration: number;
    Priority?: number;
    Skip?: boolean;
    Color?: ItemColor;
    Applied?: boolean;
  };
  type Expression = { Type: string; Duration: number; Priority?: number; Expression?: ExpressionStages; Poses?: FBCPose[] };
  type FBCPose = { Id?: number; Pose: AssetPoseName[]; Duration: number; Priority?: number };
  type PoseEx = { Pose: string; Category?: string };
  type ExpressionStages = Record<string, ExpressionStage[]>;
  type EventParams = { At?: number; Until?: number; Id?: number };
  type ExpressionEvent = Expression & EventParams;
  type ActivityTriggerMatcher = {
    Tester: RegExp;
    Criteria?: { TargetIsPlayer?: boolean; SenderIsPlayer?: boolean; DictionaryMatchers?: Record<string, string>[] };
  };
  type ActivityTrigger = { Event: string; Type: string; Matchers: ActivityTriggerMatcher[] };
  type FBCSavedProfile = { memberNumber: number; name: string; lastNick?: string; seen: number; characterBundle: string };
  type WCEKey = { id: number; key: CryptoKey };
  type WCEAcc = { id: number; data: Uint8Array<ArrayBuffer>; iv: Uint8Array<ArrayBuffer>; auth: Uint8Array<ArrayBuffer> };
}
