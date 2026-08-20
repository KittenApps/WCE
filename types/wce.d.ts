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

  /**
   * WCE's public JS API, exposed as `window.WCE`, so other addons/userscripts can integrate with
   * it without hooking its internals directly. Sub-namespaces are added by the feature that owns
   * them (e.g. `WCE.Messenger`), so this type grows as more features expose an API.
   */
  var WCE: WCEPublicAPI;
  type WCEPublicAPI = {
    /** WCE-drawn screen buttons that other addons can reposition or temporarily hide. */
    Button?: {
      /**
       * The instant messenger toggle button. Default position/size (in game canvas coordinates)
       * is `[x, y, w, h] = [70, 905, 60, 60]`.
       */
      Messenger?: WCEPositionableButtonAPI & {
        /** Whether WCE's instant messenger feature is enabled in the user's settings. */
        isEnabled: () => boolean;
        /** Returns the CSS z-index of the instant messenger window. */
        getZIndex: () => number;
        /** Changes the CSS z-index of the instant messenger window. */
        setZIndex: (zIndex: number) => void;
        /** Restores the instant messenger window's default z-index (`100`). */
        resetZIndex: () => void;
      };
      /**
       * The "Toggle Editing Mode" (rich BIO) button on the online profile screen. Default
       * position/size (in game canvas coordinates) is `[x, y, w, h] = [90, 60, 90, 90]`.
       */
      EditProfile?: WCEPositionableButtonAPI;
      /**
       * The "[WCE] Notes" toggle button on the online profile screen. Default position/size (in
       * game canvas coordinates) is `[x, y, w, h] = [1520, 60, 90, 90]`.
       */
      pastProfiles?: WCEPositionableButtonAPI;
    };
    /** Reads and writes the per-member personal notes saved by the past-profiles feature. */
    pastProfiles?: {
      /** Returns the saved note for a member number, or `undefined` if none exists. */
      get: (memberNumber: number) => Promise<FBCNote | undefined>;
      /** Saves (overwriting) the note for a member number. */
      set: (memberNumber: number, note: string) => Promise<void>;
    };
  };
  /** Generic API for a WCE-drawn screen button that other addons can move or hide. */
  type WCEPositionableButtonAPI = {
    /** Returns the current `[x, y, w, h]` of the button in game canvas coordinates. */
    getPosition: () => [number, number, number, number];
    /** Moves the button to a new `x, y, w, h` position in game canvas coordinates. */
    setPosition: (x: number, y: number, w: number, h: number) => void;
    /** Restores the button to its default position. */
    resetPosition: () => void;
    /** Hides the button (and disables its click area) until `show()` is called. */
    hide: () => void;
    /** Reveals the button again after a previous `hide()` call. */
    show: () => void;
    /** Whether the button is currently hidden via this API. */
    isHidden: () => boolean;
    /** Hides only the button drawing while preserving its click area. */
    hideVisual: () => void;
    /** Draws the button again after `hideVisual()` was called. */
    showVisual: () => void;
    /** Whether only the button drawing is currently hidden. */
    isVisualHidden: () => boolean;
  };
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
