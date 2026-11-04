/**
 * FML Buddy - Malayalam Unicode to Roman / Phonetic Transliteration Fallback
 */

const ROMAN_VOWELS: Record<string, string> = {
  "അ": "a",
  "ആ": "aa",
  "ഇ": "i",
  "ഈ": "ee",
  "ഉ": "u",
  "ഊ": "oo",
  "ഋ": "ru",
  "എ": "e",
  "ഏ": "ea",
  "ഐ": "ai",
  "ഒ": "o",
  "ഓ": "oa",
  "ഔ": "au",
};

const ROMAN_SIGNS: Record<string, string> = {
  "ാ": "aa",
  "ി": "i",
  "ീ": "ee",
  "ു": "u",
  "ൂ": "oo",
  "ൃ": "ru",
  "െ": "e",
  "േ": "ea",
  "ൈ": "ai",
  "ൊ": "o",
  "ോ": "oa",
  "ൌ": "au",
  "ൗ": "au",
  "ം": "m",
  "ഃ": "h",
};

const ROMAN_CONSONANTS: Record<string, string> = {
  "ക": "k",
  "ഖ": "kh",
  "ഗ": "g",
  "ഘ": "gh",
  "ങ": "ng",
  "ച": "ch",
  "ഛ": "chh",
  "ജ": "j",
  "ഝ": "jh",
  "ഞ": "nj",
  "ട": "t",
  "ഠ": "th",
  "ഡ": "d",
  "ഢ": "dh",
  "ണ": "n",
  "ത": "th",
  "ഥ": "th",
  "ദ": "d",
  "ധ": "dh",
  "ന": "n",
  "പ": "p",
  "ഫ": "ph",
  "ബ": "b",
  "ഭ": "bh",
  "മ": "m",
  "യ": "y",
  "ര": "r",
  "ല": "l",
  "വ": "v",
  "ശ": "sh",
  "ഷ": "sh",
  "സ": "s",
  "ഹ": "h",
  "ള": "l",
  "ഴ": "zh",
  "റ": "r",
};

const ROMAN_CHILLU: Record<string, string> = {
  "ർ": "r",
  "ൻ": "n",
  "ൽ": "l",
  "ൺ": "n",
  "ൾ": "l",
  "ൿ": "k",
};

export function unicodeToRoman(text: string): string {
  if (!text) return "";
  let result = "";
  let i = 0;
  const len = text.length;

  while (i < len) {
    const ch = text[i];

    // Chillu
    if (ROMAN_CHILLU[ch]) {
      result += ROMAN_CHILLU[ch];
      i++;
      continue;
    }

    // Independent Vowels
    if (ROMAN_VOWELS[ch]) {
      result += ROMAN_VOWELS[ch];
      i++;
      continue;
    }

    // Consonants
    if (ROMAN_CONSONANTS[ch]) {
      const base = ROMAN_CONSONANTS[ch];
      i++;

      // Check next char for virama or vowel signs
      if (i < len) {
        const next = text[i];
        if (next === "്") {
          // Virama: pure consonant
          result += base;
          i++;
        } else if (ROMAN_SIGNS[next]) {
          result += base + ROMAN_SIGNS[next];
          i++;
        } else {
          // Inherent 'a'
          result += base + "a";
        }
      } else {
        result += base + "a";
      }
      continue;
    }

    // Signs alone
    if (ROMAN_SIGNS[ch]) {
      result += ROMAN_SIGNS[ch];
      i++;
      continue;
    }

    result += ch;
    i++;
  }

  return result;
}
