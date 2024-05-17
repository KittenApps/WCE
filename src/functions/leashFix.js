import { patchFunction } from "../util/modding";

export default function leashFix() {
  patchFunction(
    "ChatSearchQuery",
    {
      "// Prevent spam searching the same thing.":
        'if (ChatRoomJoinLeash) { SearchData.Language = ""; }\n\t// Prevent spam searching the same thing.',
    },
    "Leashing between language filters"
  );
}
