export function nicknames() {
  // patch bc nickname regex
  ServerCharacterNicknameRegex = /^[\p{L}0-9\p{Z}'-]+$/u;
}
