const translations: Record<string, Record<string, string>> = {};
const locales = ["CN"];

export async function fetchLocale(locale: string): Promise<void> {
  if (locales.includes(locale) && !Object.hasOwn(translations, locale)) {
    translations[locale] = {};
    await fetch(`${PUBLIC_URL}/${locale}.json`).then(res => res.json()).then((json) => {
      translations[locale] = json as Record<string, string>;
    });
  }
}

export function displayText(original: string, replacements: Record<string, string> = {}): string {
  fetchLocale(TranslationLanguage);

  let text = translations[TranslationLanguage]?.[original] ?? original;
  for (const [key, val] of Object.entries(replacements)) {
    while (text.includes(key)) {
      text = text.replace(key, val);
    }
  }
  return text;
}
