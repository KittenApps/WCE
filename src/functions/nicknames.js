export function nicknames() {
  // Patch bc nickname regex
  ServerCharacterNicknameRegex = /^[\p{L}0-9\p{Z}'-]+$/u;
}
