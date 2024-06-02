export default function nicknames(): void {
  // Patch bc nickname regex (only allow arabic numbers and remove length limit of 20)
  ServerCharacterNicknameRegex = /^[\p{L}0-9\p{Z}'-]+$/u;;
}
