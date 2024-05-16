import { SDK, HOOK_PRIORITIES } from "../util/modding";
import { fbcSettings } from "../util/settings";

export async function antiGarbling() {
    SDK.hookFunction(
      "ChatRoomGenerateChatRoomChatMessage",
      HOOK_PRIORITIES.Top,
      /**
       * @param {Parameters<typeof ChatRoomGenerateChatRoomChatMessage>} args
       */ 
       (args, next) => {
        const [type, msg] = args;
        let process = { effects: [], text: msg };

        if (type !== 'Whisper' || (fbcSettings.antiGarbleWhisperLevel !== 'off')) {
          process = SpeechTransformProcess(Player, msg, SpeechTransformSenderEffects);
        }

        let originalMsg;
        if (msg !== process.text){
          if (Player.RestrictionSettings.NoSpeechGarble){
            originalMsg = msg;
          } else if (type === 'Chat') {
            switch (fbcSettings.antiGarbleChatLevel) {
              case 'none':
                originalMsg = msg;
                break;
              case 'low':
              case 'medium':
              case 'high':
                const int = Math.min(
                  SpeechTransformGagGarbleIntensity(Player),
                  { 'low': 1, 'medium': 3, 'high': 5 }[fbcSettings.antiGarbleChatLevel]
                );
                originalMsg = SpeechTransformGagGarble(msg, int);
                break;
            }            
          } else if (type === 'Whisper') {
            switch (fbcSettings.antiGarbleWhisperLevel) {
              case 'none':
                originalMsg = msg;
                break;
              case 'low':
              case 'medium':
              case 'high':
                const int = Math.min(
                  SpeechTransformGagGarbleIntensity(Player),
                  { 'low': 1, 'medium': 3, 'high': 5 }[fbcSettings.antiGarbleWhisperLevel]
                );
                originalMsg = SpeechTransformGagGarble(msg, int);
                break;
            }  
          }
        }

        /** @type {ChatMessageDictionary} */
        let Dictionary = [
          { Effects: process.effects, Original: originalMsg },
        ];

        return { Content: process.text, Type: type, Dictionary };
      }
    );
}