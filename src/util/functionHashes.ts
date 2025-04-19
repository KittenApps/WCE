export function expectedHashes(gameVersion: string): Readonly<Record<string, string>> {
  switch (gameVersion.toLowerCase()) {
    default:
      return {
        ActivityChatRoomArousalSync: "BFF3DED7",
        ActivitySetArousal: "3AE28123",
        ActivitySetArousalTimer: "1342AFE2",
        ActivityTimerProgress: "6CD388A7",
        AppearanceClick: "22CDB584", // Screens/Character/Appearance/Appearance.js (21.5.2024)
        AppearanceLoad: "98060059",
        AppearanceRun: "08D2AED9", // Screens/Character/Appearance/Appearance.js (13.5.2024)
        CharacterAppearanceBuildCanvas: "C05FE035", // Screens/Character/Appearance/Appearance.js
        CharacterAppearanceMustHide: "9C34DF21",
        CharacterAppearanceVisible: "0740043C",
        CharacterAppearanceWardrobeLoad: "CDB469AC",
        CharacterBuildDialog: "9196D21D",
        CharacterCompressWardrobe: "2A05ECD1",
        CharacterDelete: "57AA5D48",
        CharacterGetCurrent: "69F45A41",
        CharacterLoadCanvas: "EAB81BC4",
        CharacterLoadOnline: "407FEDDE", // Scripts/Character.js
        CharacterNickname: "A794EFF5",
        CharacterRefresh: "F50CDE75",
        CharacterSetCurrent: "9B71AC3E",
        CharacterSetFacialExpression: "FAF129E1", // Scripts/Character.js (6.5.2024)
        CharacterSetActivePose: "566A14D7",
        ChatAdminRoomCustomizationClick: "857766E7",
        ChatAdminRoomCustomizationProcess: "AF01C65A",
        ChatRoomAppendChat: "12890378", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomCharacterUpdate: "DE2DC592",
        ChatRoomCharacterViewDraw: "732C91C9", // Screens/Online/ChatRoom/ChatRoomCharacterView.js (19.4.2024 )
        ChatRoomCharacterViewIsActive: "CD8066FA",
        ChatRoomCurrentTime: "A462DD3A",
        ChatRoomDrawCharacterStatusIcons: "3D957FC2", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomGenerateChatRoomChatMessage: "3BDE0884", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomHideElements: "D58ECB5C", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomHTMLEntities: "0A7ADB1D",
        ChatRoomKeyDown: "A4974D73", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomLeave: "BD1A285F",
        ChatRoomListManipulation: "75D28A8B",
        ChatRoomMapViewCharacterIsVisible: "286C447D",
        ChatRoomMapViewCharacterOnWhisperRange: "B0D08E96",
        ChatRoomMapViewIsActive: "D181020D",
        ChatRoomMenuBuild: "BE8ACFBE",
        ChatRoomMenuClick: "8EF164D0", // Screens/Online/ChatRoom/ChatRoom.js (6.5.2024)
        ChatRoomMenuDraw: "6DBEC23B", // Screens/Online/ChatRoom/ChatRoom.js (6.5.2024)
        ChatRoomMessage: "E75ED29B", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomRegisterMessageHandler: "C432923A",
        ChatRoomSendChat: "34F4B35A", // Screens/Online/ChatRoom/ChatRoom.js
        ChatRoomStart: "BB69E93E",
        ChatRoomSyncMemberJoin: "2A9CB40B", // Screens/Online/ChatRoom/ChatRoom.js
        CommandCombine: "80F9D4AF", // Screens/Online/ChatRoom/Commands.js
        CommandExecute: "D1DEB2AD", // Screens/Online/ChatRoom/Commands.js
        CommonClick: "918C74F3",
        CommonColorIsValid: "390A2CE4",
        CommonSetScreen: "13DC19A7", // Scripts/Common.js
        CraftingClick: "5E7225EA", // Screens/Room/Crafting/Crafting.js
        CraftingConvertSelectedToItem: "F5211D40",
        CraftingRun: "4CD7AB08", // Screens/Room/Crafting/Crafting.js
        DialogCanUnlock: "A86B2558",
        DialogLeave: "9313B3E5",
        DialogMenuButtonBuild: "88CE1D73", // Scripts/Dialog.js (13.5.2024)
        DialogMenuButtonClick: "2CA1256C", // Scripts/Dialog.js (2.5.2024)
        DrawArousalMeter: "BB0755AF",
        DrawArousalThermometer: "7ED6D822",
        DrawBackNextButton: "7263249E", // Scripts/Drawing.js
        DrawButton: "B747DF6E",
        DrawCharacter: "C03C602B",
        DrawCheckbox: "00FD87EB",
        DrawImageEx: "E01BE7E7",
        DrawImageResize: "D205975A",
        DrawItemPreview: "6A7A1E2A",
        DrawProcess: "7DA972D9",
        DrawText: "C1BF0F50",
        DrawTextFit: "F9A1B11E",
        ElementCreate: "3C087F6E",
        ElementCreateInput: "7F1709DA",
        ElementCreateTextArea: "4E040819", // Scripts/Element.js
        ElementIsScrolledToEnd: "1CC4FE11",
        ElementPosition: "CDC30A13", // Scripts/Element.js
        ElementScrollToEnd: "1AC45575",
        ElementValue: "4F26C62F",
        FriendListShowBeep: "5B91D5DA", // Screens/Character/FriendList/FriendList.js
        GameRun: "337CB358", // Scripts/Game.js
        GLDrawResetCanvas: "81214642",
        InformationSheetRun: "5B5C7751", // Screens/Character/InformationSheet/InformationSheet.js
        InterfaceTextGet: "66603471", // Scripts/Text.js (2.5.2024)
        InventoryGet: "E666F671",
        "Layering.Load": "0A971DA6", // Scripts/Layering.js
        "Layering._ResetClickListener": "5EDCC26F", // Scripts/Layering.js
        LoginClick: "5B9765F8", // Screens/Character/Login/Login.js
        LoginDoLogin: "E9145D39", // Screens/Character/Login/Login.js
        LoginRun: "ACA81C3B", // Screens/Character/Login/Login.js
        LoginStatusReset: "43C3FCD2",
        MouseIn: "CA8B839E",
        NotificationDrawFavicon: "AB88656B",
        NotificationRaise: "E8F29646",
        NotificationTitleUpdate: "0E92F3ED",
        OnlineGameAllowChange: "3779F42C",
        OnlineProfileClick: "521146DF",
        OnlineProfileUnload: "A8651F30",
        OnlineProfileLoad: "BE8B009B",
        OnlineProfileRun: "7F57EF9A",
        PoseSetActive: "22C02050",
        PreferenceExit: "27E40748",
        PreferenceInitPlayer: "0D2BAC05", // Screens/Character/Preference/Preference.js (6.5.2024)
        PreferenceSubscreenArousalClick: "84F49886",
        PreferenceSubscreenArousalRun: "96A6157B",
        PreferenceSubscreenImmersionClick: "0EF82344",
        PreferenceSubscreenImmersionRun: "276FA30B",
        RelogRun: "843E8F94",
        RelogExit: "2DFB2DAD",
        ServerAccountBeep: "8782A099", // Scripts/Server.js
        ServerAppearanceBundle: "4D069622",
        ServerAppearanceLoadFromBundle: "946537FD",
        ServerConnect: "845E50A6",
        ServerDisconnect: "146CB302",
        ServerInit: "B6CEF7F1",
        ServerOpenFriendList: "FA8D3CDE",
        ServerPlayerAppearanceSync: "A014E0B7",
        ServerPlayerExtensionSettingsSync: "1776666B",
        ServerSend: "98EAB9FB",
        ServerSendQueueProcess: "BD4277AC",
        SkillGetWithRatio: "3EB4BC45",
        SpeechTransformBabyTalk: "C812EE0E", // Scripts/Speech.js
        SpeechTransformGagGarble: "691A05BF", // Scripts/Speech.js
        SpeechTransformGagGarbleIntensity: "F61ECBDA", // Scripts/Speech.js
        SpeechTransformProcess: "666DDA2F", // Scripts/Speech.js
        SpeechTransformShouldBabyTalk: "634BCD64", // Scripts/Speech.js
        SpeechTransformStutter: "A930F55E", // Scripts/Speech.js
        SpeechTransformStutterIntensity: "4754768A", // Scripts/Speech.js
        StruggleDexterityProcess: "D185D348", // Scripts/Struggle.js
        StruggleFlexibilityCheck: "727CE05B",
        StruggleFlexibilityProcess: "1A0B96EF", // Scripts/Struggle.js
        StruggleLockPickDraw: "6FE841B9", // Scripts/Struggle.js
        StruggleMinigameHandleExpression: "1B3ABF55",
        StruggleMinigameStop: "FB05E8A9",
        StruggleStrengthProcess: "B1A1457D", // StruggleStrengthProcess
        TextGet: "4DDE5794",
        TextLoad: "0D535190",
        TimerInventoryRemove: "2588CA11",
        TimerProcess: "BFB7FFE2",
        TitleExit: "F13F533C",
        ValidationSanitizeProperties: "843D3952",
        WardrobeClick: "33405B1D",
        WardrobeExit: "12D14AE4",
        WardrobeFastLoad: "C964B347",
        WardrobeFastSave: "D1E906FD",
        WardrobeFixLength: "CA3334C6",
        WardrobeLoad: "C343A4C7",
        WardrobeLoadCharacterNames: "F39DF5E3",
        WardrobeRun: "633B3570",
      } as const;
  }
}
