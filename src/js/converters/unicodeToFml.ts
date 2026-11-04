/**
 * FML Buddy - Malayalam Unicode to FML Legacy Font Converter
 * Ratheesh Menon's Unicode-to-legacy conversion map and ordering rules
 * (https://ratheesh.in/Utf2Ttf/converter.js), kept local for offline use.
 * Supports FML-Revathi, FML-Panchami, FML-Indulekha, FML-Chaithanya, etc.
 */

// Master Character Mapping Table for FML & ML-TT (CDAC ISM standard)
export const RATHEESH_MAP: Record<string, string> = {
  // Signs & Independent Vowels
  "ം": "w",
  "ഃ": "x",
  "അ": "A",
  "ആ": "B",
  "ഇ": "C",
  "ഈ": "Cu",
  "ഉ": "D",
  "ഊ": "Du",
  "ഋ": "E",
  "ഌ": "p",
  "എ": "F",
  "ഏ": "G",
  "ഐ": "sF",
  "ഒ": "H",
  "ഓ": "Hm",
  "ഔ": "Hu",

  // Base Consonants
  "ക": "I",
  "ഖ": "J",
  "ഗ": "K",
  "ഘ": "L",
  "ങ": "M",
  "ച": "N",
  "ഛ": "O",
  "ജ": "P",
  "ഝ": "Q",
  "ഞ": "R",
  "ട": "S",
  "ഠ": "T",
  "ഡ": "U",
  "ഢ": "V",
  "ണ": "W",
  "ത": "X",
  "ഥ": "Y",
  "ദ": "Z",
  "ധ": "[",
  "ന": "\\",
  "പ": "]",
  "ഫ": "^",
  "ബ": "_",
  "ഭ": "`",
  "മ": "a",
  "യ": "b",
  "ര": "c",
  "റ": "d",
  "ല": "e",
  "ള": "f",
  "ഴ": "g",
  "വ": "h",
  "ശ": "i",
  "ഷ": "j",
  "സ": "k",
  "ഹ": "l",

  // Vowel Signs
  "ാ": "m",
  "ി": "n",
  "ീ": "o",
  "ു": "p",
  "ൂ": "q",
  "ൃ": "r",
  "െ": "s",
  "േ": "t",
  "ൈ": "ss",
  "ൊ": "sm",
  "ോ": "tm",
  "ൌ": "su",
  "്‌": "v",
  "്": "v",
  "ൗ": "u",
  "്യേ": "ty",
  "്യെ": "sy",

  // Conjuncts / Chillus / Ligatures
  "ക്ക": "¡",
  "ക്ല": "¢",
  "ക്ഷ": "£",
  "ഗ്ഗ": "¤",
  "ഗ്ല": "¥",
  "ങ്ക": "¦",
  "ങ്ങ": "§",
  "ച്ച": "¨",
  "ഞ്ച": "©",
  "ഞ്ഞ": "ª",
  "ട്ട": "«",
  "ണ്‍": "¬",
  "ൺ": "¬",
  "ണ്ട": "ï",
  "ണ്ണ": "®",
  "ത്ത": "¯",
  "ത്ഥ": "°",
  "ദ്ദ": "±",
  "ദ്ധ": "²",
  "ന്‍": "³",
  "ൻ": "³",
  "ന്ത": "´",
  "ന്ദ": "µ",
  "ന്ന": "¶",
  "ന്മ": "·",
  "പ്പ": "¸",
  "പ്ല": "¹",
  "ബ്ബ": "º",
  "ബ്ല": "»",
  "മ്പ": "¼",
  "മ്മ": "½",
  "മ്ല": "Ÿ",
  "യ്യ": "¿",
  "ർ‌": "À",
  "ർ‍": "À",
  "ർ": "À",
  "ര്‍": "À",
  "റ്റ": "ä",
  "ല്‍": "Â",
  "ൽ": "Â",
  "ല്ല": "Ã",
  "ള്‍": "Ä",
  "ൾ": "Ä",
  "ള്ള": "Å",
  "വ്വ": "Æ",
  "ശ്ല": "Ç",
  "ശ്ശ": "È",
  "സ്ല": "É",
  "സ്സ": "Ê",
  "ഹ്ല": "Ë",
  "സ്റ്റ": "Ì",
  "ഡ്ഡ": "Í",
  "ക്ട": "Î",
  "ബ്ധ": "Ï",
  "ബ്ദ": "Ð",
  "ച്ഛ": "Ñ",
  "ഹ്മ": "Ò",
  "ഹ്ന": "Ó",
  "ന്ധ": "Ô",
  "ത്സ": "Õ",
  "ജ്ജ": "Ö",
  "ണ്മ": "×",
  "സ്ഥ": "Ø",
  "ന്ഥ": "Ù",
  "ജ്ഞ": "Ú",
  "ത്ഭ": "Û",
  "ഗ്മ": "Ü",
  "ശ്ച": "Ý",
  "ണ്ഡ": "Þ",
  "ത്മ": "ß",
  "ക്ത": "à",
  "ഗ്ന": "á",
  "ന്റ": "â",
  "ൻ്റ": "â",
  "ഷ്ട": "ã",
  "ൿ": "Iv",
  "്യ": "y",
  "്വ": "z",
  "്ര": "{",
  "-": "þ",

  // Numerals
  "൦": "0",
  "൧": "1",
  "൨": "2",
  "൩": "3",
  "൪": "4",
  "൫": "5",
  "൬": "6",
  "൭": "7",
  "൮": "8",
  "൯": "9",
};

/**
 * Converts Unicode Malayalam to the Ratheesh ML-TT/Karthika legacy encoding.
 * The site's converter applies the same pre-base vowel and repham ordering.
 */
export function unicodeToRatheeshLegacy(strText: string): string {
  if (!strText) return "";

  // Normalize pasted text to the same canonical Malayalam forms expected by
  // legacy font maps, including older ZWJ chillus and alternate au spelling.
  const text = strText
    .normalize("NFC")
    .replace(/ണ്\u200D/g, "ൺ")
    .replace(/ന്\u200D/g, "ൻ")
    .replace(/ര്\u200D/g, "ർ")
    .replace(/ല്\u200D/g, "ൽ")
    .replace(/ള്\u200D/g, "ൾ")
    .replace(/ക്\u200D/g, "ൿ")
    .replace(/ൻ്റ/g, "ന്റ")
    .replace(/ൻറ്/g, "ന്റ്")
    .replace(/ൌ/g, "ൌ");

  let ascii_text = "";
  let bRepham = 0;

  for (let index = 0; index < text.length; ) {
    let matched = false;

    // Ratheesh's map uses keys up to three UTF-16 code units long.
    for (let lenChar = 3; lenChar > 0; lenChar--) {
      const chUnicode = text.substring(index, index + lenChar);
      if (RATHEESH_MAP[chUnicode] !== undefined) {
        const chAscii = RATHEESH_MAP[chUnicode];

        if (chUnicode === "ൈ") {
          // Diphthong ൈ shifts before the base consonant (and before repham if present)
          if (bRepham === 1 && ascii_text.length >= 2) {
            bRepham = 0;
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 2) +
              chAscii +
              ascii_text[ascii_text.length - 2] +
              ascii_text[ascii_text.length - 1];
          } else if (ascii_text.length >= 1) {
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 1) +
              chAscii +
              ascii_text[ascii_text.length - 1];
          } else {
            ascii_text += chAscii;
          }
        } else if (chUnicode === "ോ" || chUnicode === "ൊ" || chUnicode === "ൌ") {
          // Two-part vowels: part 1 moves before the consonant, part 2 remains after
          if (bRepham === 1 && ascii_text.length >= 2) {
            bRepham = 0;
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 2) +
              chAscii[0] +
              ascii_text[ascii_text.length - 2] +
              ascii_text[ascii_text.length - 1] +
              chAscii[1];
          } else if (ascii_text.length >= 1) {
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 1) +
              chAscii[0] +
              ascii_text[ascii_text.length - 1] +
              chAscii[1];
          } else {
            ascii_text += chAscii;
          }
        } else if (chUnicode === "്യേ" || chUnicode === "്യെ") {
          bRepham = 0;
          if (ascii_text.length >= 1) {
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 1) +
              chAscii[0] +
              ascii_text[ascii_text.length - 1] +
              chAscii[1];
          } else {
            ascii_text += chAscii;
          }
        } else if (chUnicode === "െ" || chUnicode === "േ" || chUnicode === "്ര") {
          // Pre-base vowels െ, േ and Repham ്ര move before the consonant
          if (bRepham === 1 && ascii_text.length >= 2) {
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 2) +
              chAscii[0] +
              ascii_text[ascii_text.length - 2] +
              ascii_text[ascii_text.length - 1];
            bRepham = 0;
          } else if (ascii_text.length >= 1) {
            ascii_text =
              ascii_text.substring(0, ascii_text.length - 1) +
              chAscii[0] +
              ascii_text[ascii_text.length - 1];
          } else {
            ascii_text += chAscii[0];
          }

          if (chUnicode === "്ര") {
            bRepham = 1;
          }
        } else {
          bRepham = 0;
          ascii_text += chAscii;
        }

        index += lenChar;
        matched = true;
        break;
      }
    }

    if (!matched) {
      ascii_text += text[index];
      index++;
      bRepham = 0;
    }
  }

  return ascii_text;
}

/** FML and ML-TT targets currently share the Ratheesh legacy map. */
export function unicodeToFml(strText: string): string {
  return unicodeToRatheeshLegacy(strText);
}
