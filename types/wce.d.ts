import { ModSDKGlobalAPI } from "./bcModSdk";

export {};

declare global {
  interface Window {
    InputChat?: HTMLTextAreaElement;
    MainCanvas: HTMLCanvasElement;
  }
  var Dexie: import("dexie").DexieConstructor;
  var FBC_VERSION: string;
  var fbcSendAction: (text: string) => void;
  var fbcChatNotify: (node: HTMLElement | HTMLElement[] | string) => void;
  var fbcPushEvent: (evt: ExpressionEvent) => void;
  var fbcDebug: (copy?: boolean) => Promise<string>;
  var fbcSettingValue: (key: string) => boolean | number | string;
  var fbcCopyColors: (C: Character, focusItem: Item) => void;
  var bceAnimationEngineEnabled: () => boolean;
  var bce_initializeDefaultExpression: () => void;
  var bceUpdatePasswordForReconnect: () => void;
  var bceMessageReplacements: (msg: string) => string;
  var bceClearPassword: (name: string) => void;
  var bceClearCaches: () => Promise<void>;
  var bceStartClubSlave: () => Promise<void>;
  var bceSendToClubSlavery: () => void;
  var bceCanSendToClubSlavery: () => boolean;
  var ChatRoombceSendToClubSlavery: () => void;
  var ChatRoombceCanSendToClubSlavery: () => boolean;
  var bceGotoRoom: (room: string) => void;
  var bce_ArousalExpressionStages: ArousalExpressionStages;
  var bce_ActivityTriggers: ActivityTrigger[];
  var bce_EventExpressions: { [key: string]: Expression };
  var StartBcUtil: () => void;
  var bcx:
  | import("./bcxExternalInterface").BCX_ConsoleInterface
  | undefined;
  var fbcDisplayText: (
    original: string,
    replacements?: Record<string, string>
  ) => string;
  var bceStripBeepMetadata: (text: string) => string;
  var bcModSdk: ModSDKGlobalAPI | undefined;
  var FUSAM: FUSAMPublicAPI | undefined;
  var InterfaceTextGet: (msg: string) => string;

  type FUSAMPublicAPI = {
    present: true;
    addons: Record<string, FUSAMAddonState>;
    registerDebugMethod: (
      name: string,
      method: () => string | Promise<string>
    ) => void;
    modals: {
      open: (options: ModalOptions) => void
      openAsync: (
        options: Omit<ModalOptions, "callback">
      ) => Promise<[string, string | null]>
    }; 
  };
  type ModalOptions = {
    prompt: string | Node;
    input?: { initial: string; readonly: boolean; type: "input" | "textarea" };
    callback: (action: string, inputValue?: string) => void;
    buttons?: { submit: string } & Record<string, string>;
  };
  type FUSAMAddonState = {
    distribution: string;
    status: "loading" | "loaded" | "error";
  };

  // extends BC Character interface with additional FBC properties
  interface Character {
    FBC: string;
    FBCOtherAddons?: readonly import("./bcModSdk").ModSDKModInfo[];
    BCEArousal: boolean;
    BCEBlockAntiGarble: boolean;
    BCECapabilities: readonly string[];
    BCEArousalProgress: number;
    BCEEnjoyment: number;
    /** @deprecated */
    BCEWardrobe?: string;
    FBCNoteExists: boolean;
    BCESeen: number;
  }
  interface PlayerOnlineSettings {
    BCE: string;
    BCEWardrobe: string;
  }
  interface CharacterOnlineSharedSettings {
    Uwall: boolean;
  }

  type Relationship = {
    Name: string;
    MemberNumber: number;
    Start: number;
    Stage: number;
  };
  type Craft = {
    Color: string;
    Description: string;
    Item: string;
    Lock: string;
    Name: string;
    Property: string;
  };

  type FBCNote = {
    note: string;
    updatedAt?: number;
  };
  type Position = {
    X: number;
    Y: number;
    Width: number;
    Height: number;
  };
  type Friend = {
    MemberName: string;
    MemberNumber: number;
  };
  type BCEActivity = "ClubSlavery";
  type BCEMessage = {
    type: string;
    version: string;
    capabilities?: readonly string[];
    alternateArousal?: boolean;
    replyRequested?: boolean;
    progress?: number;
    enjoyment?: number;
    activity?: BCEActivity;
    blockAntiGarble: boolean;
    otherAddons?: readonly import("./bcModSdk").ModSDKModInfo[];
  };
  type SettingsCategory =
    | "performance"
    | "chat"
    | "activities"
    | "immersion"
    | "appearance"
    | "addons"
    | "misc"
    | "cheats"
    | "buttplug"
    | "hidden";
  type Passwords = Record<string, string>;
  type ArousalExpressionStage = {
    Expression: ExpressionName;
    Limit: number;
  };
  type ArousalExpressionStages = Record<string, ArousalExpressionStage[]>;
  type ClubPose = {
    Name: string;
    Category?: string;
    AllowMenu?: boolean;
  };
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
  type Expression = {
    Type: string;
    Duration: number;
    Priority?: number;
    Expression?: ExpressionStages;
    Poses?: FBCPose[];
  };
  type FBCPose = {
    Id?: number;
    Pose: AssetPoseName[];
    Duration: number;
    Priority?: number;
  };
  type PoseEx = {
    Pose: string;
    Category?: string;
  };
  type ExpressionStages = Record<string, ExpressionStage[]>;
  type EventParams = {
    At?: number;
    Until?: number;
    Id?: number;
  };
  type ExpressionEvent = Expression & EventParams;
  type Command = {
    Tag: string;
    Description?: string;
    Reference?: string;
    Action?: (args: string, msg: string, parsed: string[]) => unknown;
    Prerequisite?: () => boolean;
    AutoComplete?: (parsed: string[], low: string, msg: string) => void;
    Clear?: false;
  };
  type ActivityTriggerMatcher = {
    Tester: RegExp;
    Criteria?: {
      TargetIsPlayer?: boolean;
      SenderIsPlayer?: boolean;
      DictionaryMatchers?: Record<string, string>[];
    };
  };
  type ActivityTrigger = {
    Event: string;
    Type: string;
    Matchers: ActivityTriggerMatcher[];
  };
  type FBCSavedProfile = {
    memberNumber: number;
    name: string;
    lastNick?: string;
    seen: number;
    characterBundle: string;
  };
  type ServerBeep = {
    Timer: number;
    MemberNumber?: number;
    Message: string;
    ChatRoomName?: string;
    IsMail?: boolean;
    ClickAction?: "FriendList";
  };
  type FBCDictionaryEntry = {
    Tag?: string;
    message?: BCEMessage;
    MemberNumber?: number;
    Text?: string;
    TargetCharacter?: number;
    SourceCharacter?: number;
  };
  type FBCToySetting = {
    Name: string;
    SlotName: string;
    LastIntensity?: number;
  };
  type FBCToySyncState = {
    client?: import("./buttplug.io.1.0.17").ButtplugClient;
    deviceSettings: Map<string, FBCToySetting>;
  };
}
