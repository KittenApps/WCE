// Uncomment this if you are not using rest of BCX declaration files (declarations.d.ts, messages.d.ts)
type BCX_queries = Record<string, [any, any]>;

/* End of area to uncomment */

interface BCXVersion {
  major: number;
  minor: number;
  patch: number;
  extra?: string;
  dev?: boolean;
}

//#region Rules
interface BCX_RuleStateAPI_Generic {
  /** The name of the rule */
  readonly rule: string;
  /** Definition of the rule */
  readonly ruleDefinition: any;

  /** Current condition data of the rule */
  readonly condition: any;

  /** If the rule is in effect (active and all conditions valid) */
  readonly inEffect: boolean;
  /** If the rule is enforced (inEffect and enforce enabled) */
  readonly isEnforced: boolean;
  /** If the rule is logged (inEffect and logging enabled) */
  readonly isLogged: boolean;

  /** Rule setttings */
  readonly customData: any;
  /** Rule internal data */
  readonly internalData: any;

  /**
   * Triggers and logs that Player violated this rule
   * @param targetCharacter - If the rule is against specific target different than player (e.g. sending message/beep), this adds it to log
   * @param dictionary - Dictionary of rule-specific text replacements in logs and notifications; see implementation of individual rules
   */
  trigger(targetCharacter?: number | null, dictionary?: Record<string, string>): void;

  /**
   * Triggers and logs that Player attempted to violate this rule, but the attempt was blocked (for enforced rules)
   * @param targetCharacter - If the rule is against specific target different than player (e.g. sending message/beep), this adds it to log
   * @param dictionary - Dictionary of rule-specific text replacements in logs and notifications; see implementation of individual rules
   */
  triggerAttempt(targetCharacter?: number | null, dictionary?: Record<string, string>): void;
}

interface BCX_RuleStateAPI<ID extends BCX_Rule> extends BCX_RuleStateAPI_Generic {
  readonly rule: ID;
  readonly ruleDefinition: RuleDisplayDefinition<ID>;

  readonly condition: ConditionsConditionData<"rules"> | undefined;

  readonly customData: ID extends keyof RuleCustomData ? RuleCustomData[ID] | undefined : undefined;
  readonly internalData: ID extends keyof RuleInternalData ? RuleInternalData[ID] | undefined : undefined;
}

//#endregion

//#region Curses

interface BCX_CurseInfo {
  /** Whether the curse is active or disabled */
  readonly active: boolean;

  /** The group this info is for */
  readonly group: AssetGroupName;
  /** BC asset the curse keeps, or `null` if the group is cursed to be empty */
  readonly asset: Asset | null;

  /** What color the item is cursed with */
  readonly color?: ItemColor;
  /** Whether properties are cursed (if set, `Property` is enforced, otherwise only applied on item re-apply) */
  readonly curseProperty: boolean;
  /** The properties that are enforced */
  readonly property?: ItemProperties;
  /** Crafting data, always cursed */
  readonly craft?: CraftingItem;
}

//#endregion

interface BCX_Events {
  curseTrigger: {
    /** Which action the curses did to the item */
    action: "remove" | "add" | "swap" | "update" | "color" | "autoremove";
    /** Name of asset group that was changed */
    group: string;
  };
  /**
   * Triggers whenever a rule triggers (either by BCX or by external API)
   * @note If you need extra data about rule's configuration, use `BCX_ModAPI.getRuleState`
   */
  ruleTrigger: {
    /** The rule that was triggered */
    rule: BCX_Rule;
    /**
     * Type of trigger that happened:
     * - `trigger` - The action this rule dected did happen (e.g. because the rule was not enforced)
     * - `triggerAttempt` - The action was caught by the rule and did not happen
     */
    triggerType: "trigger" | "triggerAttempt";
    /**
     * Character that was being targetted (e.g. for whisper/beep rules, possibly few others).
     * Most rules do not use this.
     */
    targetCharacter: number | null;
  };
  /**
   * Triggers whenever player changes subscreen in BCX.
   * Note, that some changes might not be observable by outside mod (e.g. when user simply switches to different subscreen).
   * This can trigger even outside of `InformationSheet` screen.
   */
  bcxSubscreenChange: {
    /**
     * Whether BCX is currently showing one of custom screens, overriding the default BC screen.
     *
     * At the time of emitting, this value is the same as the one returned by `bcx.inBcxSubscreen()`.
     */
    inBcxSubscreen: boolean;
  };
  /**
   * Triggers whenever BCX sends a "local" message to the chat.
   */
  bcxLocalMessage: {
    /** The actual message that is to be displayed */
    message: string | Node;
    /** Timeout of the message - if set, the message auto-hides after {timeout} milliseconds */
    timeout?: number;
    /** Sender metadata (used for displaying a membernumber on some messages) */
    sender?: number;
  };
  /**
   * This is a generic event sent out by anyone in the room (including Player) when _something_ in BCX configuration changes,
   * which might warrant requesting updated data from the user, if you hold onto any such data in your logic.
   */
  somethingChanged: {
    /** MemberNumber of the sender. `Player.MemberNumber` will be used when triggered by this BCX instance. */
    sender: number;
  };
}

interface BCX_ModAPI extends BCXEventEmitter<BCX_Events> {
  /** Name of the mod this API was requested for */
  readonly modName: string;

  /** Returns state handler for a rule or `null` for unknown rule */
  getRuleState<ID extends BCX_Rule>(rule: ID): BCX_RuleStateAPI<ID> | null;

  /** Returns info about how a slot is cursed */
  getCurseInfo(group: AssetGroupName): BCX_CurseInfo | null;

  /**
   * Sends a BCX query to another character in the same room, or to Player.
   * This allows same level of access to BCX data as BCX itself has for others, which includes almost all actions possible through UI (but there are exceptions).
   * Requests done to "Player" will have the same limitations user has when interacting with the UI.
   *
   * This is a very low-level API and properly forming and interpretting the requests requires care.
   * Also note, that this method sends requests to other characters, which might respond in an arbitrary way or not at all.
   * Also consider that using this with different target than "Player" sends a message through BC's server and is subject to rate limiting.
   * @param type - The type of query to send
   * @param data - Data for the query
   * @param target - MemberNumber to target; "Player" is alias for `Player.MemberNumber`
   * @param timeout - Timeout after which the query fails, in milliseconds; defaults to 10 seconds
   * @returns Promise that resolves to the query answer or rejects if the request failed
   * @see BCX_queries in messages.d.ts for list of possible queries, their expected data and answers
   */
  sendQuery<T extends keyof BCX_queries>(type: T, data: BCX_queries[T][0], target: number | "Player", timeout?: number): Promise<BCX_queries[T][1]>;
}

export interface BCX_ConsoleInterface {
  /** Version of loaded BCX */
  readonly version: string;

  /** Version parsed to components */
  readonly versionParsed: Readonly<BCXVersion>;

  /**
   * Gets BCX version of another character in room
   * @param target - The membernumber of character to get; undefined = Player
   */
  getCharacterVersion(target?: number): string | null;

  /** Gets if BCX runs in development mode */
  readonly isDevel: boolean;

  /**
   * Get access to BCX Mod API.
   * @param mod - Same identifier of your mod as used for ModSDK
   */
  getModApi(mod: string): BCX_ModAPI;

  /** Whether BCX is currently showing one of custom screens, overriding the default BC screen. */
  inBcxSubscreen(): boolean;
}

interface Window {
  bcx?: BCX_ConsoleInterface;
}

type BCXEvent = Record<never, unknown>;
type BCXAnyEvent<T extends BCXEvent> = {
  [key in keyof T]: { event: key; data: T[key] };
}[keyof T];

interface BCXEventEmitter<T extends BCXEvent> {
  on<K extends keyof T>(s: K, listener: (v: T[K]) => void): () => void;
  onAny(listener: (value: BCXAnyEvent<T>) => void): () => void;
}

/** Package version, provided by rollup */
declare const BCX_VERSION: string;
declare const BCX_DEVEL: boolean;
declare const BCX_SAVE_AUTH: string;

interface Window {
  BCX_Loaded?: boolean;
}

type Satisfies<T extends U, U> = T;

type BCXSupporterType = undefined | "supporter" | "developer";

interface PlayerOnlineSettings {
  /** Saved BCX data */
  BCX?: string;
  /** The last time BCX data was cleared (debug helper) */
  BCXDataCleared?: number;
}

/** BCX added buttons to the character dialog */
type BCX_DialogMenuButton = string;

type BCX_BackgroundTag = string;

type BCX_Permissions =
  | "authority_edit_min"
  | "authority_grant_self"
  | "authority_revoke_self"
  | "authority_mistress_add"
  | "authority_mistress_remove"
  | "authority_owner_add"
  | "authority_owner_remove"
  | "authority_view_roles"
  | "log_view_normal"
  | "log_view_protected"
  | "log_configure"
  | "log_delete"
  | "log_praise"
  | "log_add_note"
  | "curses_normal"
  | "curses_limited"
  | "curses_global_configuration"
  | "curses_change_limits"
  | "curses_color"
  | "curses_view_originator"
  | "rules_normal"
  | "rules_limited"
  | "rules_global_configuration"
  | "rules_change_limits"
  | "rules_view_originator"
  | "commands_normal"
  | "commands_limited"
  | "commands_change_limits"
  | "exportimport_export"
  | "relationships_view_all"
  | "relationships_modify_self"
  | "relationships_modify_others"
  | "misc_cheat_allowactivities"
  | "misc_wardrobe_item_import";

type PermissionsBundle = Record<string, [boolean, number]>;

interface PermissionRoleBundle {
  mistresses: [number, string][];
  owners: [number, string][];
  allowAddMistress: boolean;
  allowRemoveMistress: boolean;
  allowAddOwner: boolean;
  allowRemoveOwner: boolean;
}

type BCX_LogCategory =
  | "permission_change"
  | "log_config_change"
  | "log_deleted"
  | "praise"
  | "user_note"
  | "curse_change"
  | "curse_trigger"
  | "rule_change"
  | "rule_trigger"
  | "command_change"
  | "had_orgasm"
  | "entered_public_room"
  | "entered_private_room"
  | "authority_roles_change"
  | "relationships_change";

interface CursedItemInfo {
  Name: string;
  curseProperty: boolean;
  Color?: string | string[];
  Difficulty?: number;
  Property?: any;
  Craft?: any;
  itemRemove?: true | undefined;
}

interface ConditionsCategoryKeys {
  curses: any;
  rules: BCX_Rule;
  commands: BCX_Command;
}

type ConditionsCategories = keyof ConditionsCategoryKeys;

interface ConditionsCategorySpecificData {
  curses: CursedItemInfo | null;
  rules: {
    enforce?: false;
    log?: false;
    /** `RuleCustomData` */
    customData?: Record<string, any>;
    /** `RuleInternalData` */
    internalData?: any;
  };
  commands: undefined;
}

interface ConditionsCategorySpecificGlobalData {
  curses: { itemRemove: boolean };
  rules: undefined;
  commands: undefined;
}

interface ConditionsCategorySpecificPublicData {
  curses: { Name: string; curseProperties: boolean; itemRemove: boolean } | null;
  rules: {
    enforce: boolean;
    log: boolean;
    /** `RuleCustomData` */
    customData?: Record<string, any>;
  };
  commands: undefined;
}

interface ConditionsConditionRequirements {
  /** If the conditions should be treated as "OR". Default is "AND" */
  orLogic?: true;
  room?: { type: "public" | "private"; inverted?: true };
  roomName?: { name: string; inverted?: true };
  role?: { role: any; inverted?: true };
  player?: { memberNumber: number; inverted?: true };
}

interface ConditionsConditionData<category extends ConditionsCategories = ConditionsCategories> {
  active: boolean;
  lastActive: boolean;
  data: ConditionsCategorySpecificData[category];
  timer?: number;
  timerRemove?: true | undefined;
  requirements?: ConditionsConditionRequirements;
  favorite?: true | undefined;
  addedBy?: number;
}

interface ConditionsConditionPublicDataBase {
  active: boolean;
  timer: number | null;
  timerRemove: boolean;
  requirements: ConditionsConditionRequirements | null;
  favorite: boolean;
}

interface ConditionsConditionPublicData<category extends ConditionsCategories = ConditionsCategories> extends ConditionsConditionPublicDataBase {
  data: ConditionsCategorySpecificPublicData[category];
  addedBy?: number;
}

type ConditionsCategoryRecord<category extends ConditionsCategories = ConditionsCategories> = Partial<
  Record<ConditionsCategoryKeys[category], ConditionsConditionData<category>>
>;
type ConditionsCategoryPublicRecord<category extends ConditionsCategories = ConditionsCategories> = Partial<
  Record<ConditionsCategoryKeys[category], ConditionsConditionPublicData<category>>
>;

interface ConditionsCategoryData<category extends ConditionsCategories = ConditionsCategories> {
  conditions: Partial<Record<ConditionsCategoryKeys[category], ConditionsConditionData<category>>>;
  /** List of limited/blocked conditions; defaults to normal */
  limits: { [P in ConditionsCategoryKeys[category]]?: any };
  requirements: ConditionsConditionRequirements;
  timer?: number;
  timerRemove?: true | undefined;
  data: ConditionsCategorySpecificGlobalData[category];
}

interface ConditionsCategoryConfigurableData<category extends ConditionsCategories = ConditionsCategories> {
  requirements: ConditionsConditionRequirements;
  timer: number | null;
  timerRemove: boolean;
  data: ConditionsCategorySpecificGlobalData[category];
}

interface ConditionsCategoryPublicData<category extends ConditionsCategories = ConditionsCategories> extends ConditionsCategoryConfigurableData<category> {
  access_normal: boolean;
  access_limited: boolean;
  access_configure: boolean;
  access_changeLimits: boolean;
  highestRoleInRoom: any | null;
  conditions: ConditionsCategoryPublicRecord<category>;
  /** List of limited/blocked conditions; defaults to normal */
  limits: { [P in ConditionsCategoryKeys[category]]?: any };
}

type ConditionsStorage = Partial<{
  [category in ConditionsCategories]: ConditionsCategoryData<category>;
}>;

type BCX_Rule =
  | "block_remoteuse_self"
  | "block_remoteuse_others"
  | "block_keyuse_self"
  | "block_keyuse_others"
  | "block_lockpicking_self"
  | "block_lockpicking_others"
  | "block_lockuse_self"
  | "block_lockuse_others"
  | "block_wardrobe_access_self"
  | "block_wardrobe_access_others"
  | "block_restrict_allowed_poses"
  | "block_creating_rooms"
  | "block_entering_rooms"
  | "block_leaving_room"
  | "block_freeing_self"
  | "block_tying_others"
  | "block_blacklisting"
  | "block_whitelisting"
  | "block_antiblind"
  | "block_difficulty_change"
  | "block_activities"
  | "block_mainhall_maidrescue"
  | "block_action"
  | "block_BCX_permissions"
  | "block_room_admin_UI"
  | "block_using_ggts"
  | "block_club_slave_work"
  | "block_using_unowned_items"
  | "block_changing_emoticon"
  | "block_ui_icons_names"
  | "alt_restrict_hearing"
  | "alt_restrict_sight"
  | "alt_eyes_fullblind"
  | "alt_field_of_vision"
  | "alt_blindfolds_fullblind"
  | "alt_always_slow"
  | "alt_set_leave_slowing"
  | "alt_control_orgasms"
  | "alt_secret_orgasms"
  | "alt_room_admin_transfer"
  | "alt_room_admin_limit"
  | "alt_set_profile_description"
  | "alt_set_nickname"
  | "alt_force_suitcase_game"
  | "alt_hearing_whitelist"
  | "alt_seeing_whitelist"
  | "alt_restrict_leashability"
  | "alt_hide_friends"
  | "alt_forced_summoning"
  | "alt_allow_changing_appearance"
  | "rc_club_owner"
  | "rc_lover_new"
  | "rc_lover_leave"
  | "rc_sub_new"
  | "rc_sub_leave"
  | "speech_specific_sound"
  | "speech_garble_whispers"
  | "speech_block_gagged_ooc"
  | "speech_block_ooc"
  | "speech_doll_talk"
  | "speech_ban_words"
  | "speech_ban_words_in_emotes"
  | "speech_forbid_open_talking"
  | "speech_limit_open_talking"
  | "speech_forbid_emotes"
  | "speech_limit_emotes"
  | "speech_restrict_whisper_send"
  | "speech_restrict_whisper_receive"
  | "speech_restrict_beep_send"
  | "speech_restrict_beep_receive"
  | "speech_greet_order"
  | "speech_block_antigarble"
  // | "speech_replace_spoken_words"
  // | "speech_using_honorifics"
  | "speech_force_retype"
  | "greet_room_order"
  | "greet_new_guests"
  | "farewell_on_slow_leave"
  // | "speech_restrained_speech"
  | "speech_alter_faltering"
  | "speech_mandatory_words"
  | "speech_mandatory_words_in_emotes"
  | "speech_partial_hearing"
  | "speech_garble_while_talking"
  | "other_forbid_afk"
  | "other_track_time"
  | "other_constant_reminder"
  | "other_log_money"
  // | "other_restrict_console_usage"
  | "other_track_BCX_activation"
  | "setting_item_permission"
  | "setting_forbid_lockpicking"
  | "setting_forbid_SP_rooms"
  | "setting_forbid_safeword"
  | "setting_arousal_meter"
  | "setting_block_vibe_modes"
  | "setting_arousal_stutter"
  | "setting_show_afk"
  | "setting_allow_body_mod"
  | "setting_forbid_cosplay_change"
  | "setting_sensdep"
  | "setting_hide_non_adjecent"
  | "setting_blind_room_garbling"
  | "setting_relog_keeps_restraints"
  | "setting_leashed_roomchange"
  | "setting_room_rejoin"
  | "setting_plug_vibe_events"
  | "setting_allow_tint_effects"
  | "setting_allow_blur_effects"
  | "setting_upsidedown_view"
  | "setting_random_npc_events";

type RuleCustomData = {
  block_restrict_allowed_poses: { poseButtons: any[] };
  block_entering_rooms: { roomList: string[] };
  block_leaving_room: { minimumRole: any };
  block_freeing_self: { allowEasyItemsToggle: boolean };
  block_tying_others: { onlyMoreDominantsToggle: boolean };
  block_keyuse_others: { allowOwnerLocks: boolean; allowLoverLocks: boolean };
  block_blacklisting: { minimumRole: any };
  block_ui_icons_names: { hidingStrength: string; alsoHideEmoticons: boolean };
  alt_restrict_hearing: { deafeningStrength: string };
  alt_restrict_sight: { blindnessStrength: string };
  alt_eyes_fullblind: { affectPlayer: boolean; hideNames: boolean };
  alt_set_leave_slowing: { leaveTime: number };
  alt_field_of_vision: { affectPlayer: boolean; hideNames: boolean };
  alt_control_orgasms: { orgasmHandling: string };
  alt_room_admin_transfer: { minimumRole: any; removeAdminToggle: boolean };
  alt_set_profile_description: { playersProfileDescription: string };
  alt_set_nickname: { nickname: string; restore: boolean };
  alt_hearing_whitelist: { whitelistedMembers: number[]; ignoreGaggedMembersToggle: boolean };
  alt_seeing_whitelist: { whitelistedMembers: number[] };
  alt_restrict_leashability: { minimumRole: any };
  alt_hide_friends: { allowedMembers: number[] };
  alt_forced_summoning: { allowedMembers: number[]; summoningText: string; summonTime: number };
  alt_allow_changing_appearance: { minimumRole: any };
  speech_specific_sound: { soundWhitelist: string[] };
  speech_doll_talk: { maxWordLength: number; maxNumberOfWords: number };
  speech_ban_words: { bannedWords: string[] };
  speech_ban_words_in_emotes: { bannedWords: string[] };
  speech_restrict_whisper_send: { minimumPermittedRole: any };
  speech_restrict_whisper_receive: { minimumPermittedRole: any; autoreplyText: string };
  speech_restrict_beep_send: { whitelistedMemberNumbers: number[]; onlyWhenBound: boolean };
  speech_restrict_beep_receive: { whitelistedMemberNumbers: number[]; autoreplyText: string; onlyWhenBound: boolean };
  speech_greet_order: { toGreetMemberNumbers: number[] };
  speech_limit_open_talking: { maxNumberOfMsg: number };
  speech_limit_emotes: { maxNumberOfEmotes: number };
  // speech_replace_spoken_words: {
  // 	stringWithReplacingSyntax: string;
  // },
  // speech_using_honorifics: {
  // 	stringWithRuleSyntax: string;
  // },
  greet_room_order: { greetingSentence: string; affectEmotes: boolean };
  greet_new_guests: { greetingSentence: string; minimumRole: Exclude<any, 0> };
  farewell_on_slow_leave: { greetingSentence: string };
  // speech_restrained_speech: {
  // 	listOfAllowedSentences: string[];
  // },
  speech_mandatory_words: { mandatoryWords: string[]; affectWhispers: boolean };
  speech_mandatory_words_in_emotes: { mandatoryWords: string[] };
  speech_partial_hearing: { alwaysUnderstandableWords: string[]; randomUnderstanding: boolean; affectGaggedMembersToggle: boolean };
  speech_garble_while_talking: { gagLevel: number };
  other_forbid_afk: { minutesBeforeAfk: number };
  other_constant_reminder: { reminderText: string[]; reminderFrequency: number };
  other_log_money: { logEarnings: boolean };
  other_track_time: { minimumPermittedRole: any };
  setting_item_permission: { value: string };
  setting_forbid_lockpicking: { value: boolean; restore: boolean };
  setting_forbid_SP_rooms: { value: boolean; restore: boolean };
  setting_forbid_safeword: { value: boolean; restore: boolean };
  setting_arousal_meter: { active: any; visible: any };
  setting_block_vibe_modes: { value: boolean; restore: boolean };
  setting_arousal_stutter: { value: any };
  setting_show_afk: { value: boolean; restore: boolean };
  setting_allow_body_mod: { value: boolean; restore: boolean };
  setting_forbid_cosplay_change: { value: boolean; restore: boolean };
  setting_sensdep: { value: any; disableExamine: boolean; hideMessages: boolean };
  setting_hide_non_adjecent: { value: boolean; restore: boolean };
  setting_blind_room_garbling: { value: boolean; restore: boolean };
  setting_relog_keeps_restraints: { value: boolean; restore: boolean };
  setting_leashed_roomchange: { value: boolean; restore: boolean };
  setting_room_rejoin: { value: boolean; remakeRooms: boolean };
  setting_plug_vibe_events: { value: boolean; restore: boolean };
  setting_allow_tint_effects: { value: boolean; restore: boolean };
  setting_allow_blur_effects: { value: boolean; restore: boolean };
  setting_upsidedown_view: { value: boolean; restore: boolean };
};

type RuleInternalData = {
  alt_set_nickname: string;
  setting_forbid_lockpicking: boolean;
  setting_forbid_SP_rooms: boolean;
  setting_forbid_safeword: boolean;
  setting_block_vibe_modes: boolean;
  setting_show_afk: boolean;
  setting_allow_body_mod: boolean;
  setting_forbid_cosplay_change: boolean;
  setting_hide_non_adjecent: boolean;
  setting_blind_room_garbling: boolean;
  setting_relog_keeps_restraints: boolean;
  setting_leashed_roomchange: boolean;
  setting_plug_vibe_events: boolean;
  setting_allow_tint_effects: boolean;
  setting_allow_blur_effects: boolean;
  setting_upsidedown_view: boolean;
  other_log_money: number;
  other_track_BCX_activation: number;
  other_track_time: number;
};

type RuleCustomDataTypesMap = {
  listSelect: string;
  memberNumberList: number[];
  number: number;
  poseSelect: string[];
  roleSelector: any;
  string: string;
  stringList: string[];
  textArea: string;
  toggle: boolean;
};
type RuleCustomDataTypes = keyof RuleCustomDataTypesMap;
type RuleCustomDataTypesOptions = {
  listSelect: [string, string][];
  memberNumberList?: { pageSize?: number };
  number?: { min?: number; max?: number };
  string?: RegExp;
  stringList?: { validate?: RegExp; pageSize?: number };
};

type RuleCustomDataFilter<U> = {
  [K in RuleCustomDataTypes]: U extends RuleCustomDataTypesMap[K] ? K : never;
}[RuleCustomDataTypes];

type RuleCustomDataEntryDefinition<T extends RuleCustomDataTypes = RuleCustomDataTypes> = {
  type: T;
  default: RuleCustomDataTypesMap[T] | (() => RuleCustomDataTypesMap[T]);
  options?: T extends keyof RuleCustomDataTypesOptions ? RuleCustomDataTypesOptions[T] : undefined;
  description: string;
  Y?: number;
};

type RuleCustomDataEntryDefinitionStrict<ID extends keyof RuleCustomData, P extends keyof RuleCustomData[ID]> = RuleCustomDataEntryDefinition<
  RuleCustomDataFilter<RuleCustomData[ID][P]>
>;

interface RuleDisplayDefinition<ID extends BCX_Rule = BCX_Rule> {
  name: string;
  type: any;
  shortDescription?: string;
  longDescription: string;
  keywords?: string[];
  /** Texts to use for when rule is broken, set to empty string to disable */
  triggerTexts?: {
    /** When rule is broken */
    infoBeep?: string;
    /** When attempt to break rule is made; defaults to `infoBeep` */
    attempt_infoBeep?: string;
    /** When rule is broken */
    log?: string;
    /** When attempt to break rule is made */
    attempt_log?: string;
    /** When rule is broken; defaults to `log` */
    announce?: string;
    /** When attempt to break rule is made; defaults to `attempt_log` */
    attempt_announce?: string;
  };
  defaultLimit: any;
  /** If rule can be enforced, defaults to `true` */
  enforceable?: false;
  /** If rule can be logged, defaults to `true` */
  loggable?: false;
  dataDefinition?: ID extends keyof RuleCustomData
    ? {
        [P in keyof RuleCustomData[ID]]: RuleCustomDataEntryDefinitionStrict<ID, P>;
      }
    : never;
}

interface RuleDefinition<ID extends BCX_Rule = BCX_Rule> extends RuleDisplayDefinition<ID> {
  init?: (state: any) => void;
  load?: (state: any) => void;
  unload?: () => void;
  stateChange?: (state: any, newState: boolean) => void;
  tick?: (state: any) => boolean;
  internalDataValidate?: ID extends keyof RuleInternalData ? (data: unknown) => boolean : never;
  internalDataDefault?: ID extends keyof RuleInternalData ? () => RuleInternalData[ID] : never;
}

type BCX_Command =
  | "eyes"
  | "mouth"
  | "arms"
  | "legs"
  | "allfours"
  | "goandwait"
  | "say"
  | "forcesay"
  | "typetask"
  | "forcetypetask"
  | "cell"
  | "asylum"
  | "keydeposit"
  | "timeleft"
  | "servedrinks"
  | "orgasm"
  | "emoticon";

interface CommandDefinition<ID extends BCX_Command = BCX_Command> extends CommandDisplayDefinition {
  init?: (state: any) => void;
  load?: (state: any) => void;
  unload?: () => void;
  tick?: (state: any) => boolean;
  trigger: (argv: string[], sender: any, respond: (msg: string) => void, state: any) => boolean;
  autoCompleter?: (argv: string[], sender: any) => string[];
}

interface CommandDisplayDefinition {
  name: string;
  shortDescription?: string;
  /**
   * Text shown in GUI when Player checks details of the command
   *
   * Following text replacements are made:
   * - `PLAYER_NAME` by name of viewed character
   * - `HELP_DESCRIPTION` by value of `helpDescription`
   */
  longDescription: string;
  helpDescription: string;
  playerUsable?: boolean;
  defaultLimit: any;
}

interface RoomTemplate extends Omit<ServerChatRoomData, "Ban" | "MapData" | "Space" | "Character"> {
  Locked?: boolean;
  Private?: boolean;
  Ban?: never;
  MapData?: never;
  Space?: never;
  Character?: never;
  AutoApply: true | undefined;
}

interface ModStorage {
  version: string;
  preset: any;
  menuShouldDisplayTutorialHelp?: true;
  chatShouldDisplayFirstTimeHelp?: true;
  /** Toggle, if player chose to hide BCX icon in chatroom */
  chatroomIconHidden?: true;
  /** Toggle, if player chose to hide the supporter status */
  supporterHidden?: true;
  cheats: any[];
  disabledModules: any[];
  permissions: PermissionsBundle;
  owners: number[];
  mistresses: number[];
  log: any[];
  logConfig: any[];
  typingIndicatorEnable: boolean;
  typingIndicatorHideBC: boolean;
  screenIndicatorEnable: boolean;
  conditions: ConditionsStorage;
  roomTemplates: (RoomTemplate | null)[];
  roomSearchAutoFill: string;
  relationships: any[];
  wardrobeDefaultExtended: boolean;
  compatibilityCheckerWarningIgnore?: string;
}

interface ExtensionSettings {
  BCX?: string | null;
}
