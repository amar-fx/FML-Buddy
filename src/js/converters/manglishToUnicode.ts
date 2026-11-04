/**
 * FML Buddy - Manglish to Malayalam Unicode Transliteration Engine
 * Deterministic phonetic tokenizer and parser for Malayalam.
 */

interface Rule {
  manglish: string;
  malayalam: string;
}

// Independent Vowels (at word start or after whitespace/punctuation)
const INDEPENDENT_VOWELS: Rule[] = [
  { manglish: "aum", malayalam: "ഔം" },
  { manglish: "oum", malayalam: "ഔം" },
  { manglish: "aam", malayalam: "ആം" },
  { manglish: "aah", malayalam: "ആഃ" },
  { manglish: "am", malayalam: "അം" },
  { manglish: "ah", malayalam: "അഃ" },
  { manglish: "aa", malayalam: "ആ" },
  { manglish: "AA", malayalam: "ആ" },
  { manglish: "A", malayalam: "ആ" },
  { manglish: "a", malayalam: "അ" },
  { manglish: "ee", malayalam: "ഈ" },
  { manglish: "EE", malayalam: "ഈ" },
  { manglish: "ii", malayalam: "ഈ" },
  { manglish: "i", malayalam: "ഇ" },
  { manglish: "I", malayalam: "ഈ" },
  { manglish: "oo", malayalam: "ഊ" },
  { manglish: "OO", malayalam: "ഊ" },
  { manglish: "uu", malayalam: "ഊ" },
  { manglish: "u", malayalam: "ഉ" },
  { manglish: "U", malayalam: "ഊ" },
  { manglish: "R", malayalam: "ഋ" },
  { manglish: "ru", malayalam: "ഋ" },
  { manglish: "ea", malayalam: "ഏ" },
  { manglish: "E", malayalam: "ഏ" },
  { manglish: "e", malayalam: "എ" },
  { manglish: "ai", malayalam: "ഐ" },
  { manglish: "ei", malayalam: "ഐ" },
  { manglish: "oa", malayalam: "ഓ" },
  { manglish: "O", malayalam: "ഓ" },
  { manglish: "o", malayalam: "ഒ" },
  { manglish: "au", malayalam: "ഔ" },
  { manglish: "ou", malayalam: "ഔ" },
];

// Dependent Vowel Signs (following consonants)
const DEPENDENT_VOWELS: Rule[] = [
  { manglish: "aum", malayalam: "ൌം" },
  { manglish: "oum", malayalam: "ൌം" },
  { manglish: "aam", malayalam: "ാം" },
  { manglish: "aah", malayalam: "ാഃ" },
  { manglish: "am", malayalam: "ം" },
  { manglish: "ah", malayalam: "ഃ" },
  { manglish: "aa", malayalam: "ാ" },
  { manglish: "AA", malayalam: "ാ" },
  { manglish: "A", malayalam: "ാ" },
  { manglish: "ee", malayalam: "ീ" },
  { manglish: "EE", malayalam: "ീ" },
  { manglish: "ii", malayalam: "ീ" },
  { manglish: "i", malayalam: "ി" },
  { manglish: "I", malayalam: "ീ" },
  { manglish: "oo", malayalam: "ൂ" },
  { manglish: "OO", malayalam: "ൂ" },
  { manglish: "uu", malayalam: "ൂ" },
  { manglish: "u", malayalam: "ു" },
  { manglish: "U", malayalam: "ൂ" },
  { manglish: "R", malayalam: "ൃ" },
  { manglish: "ea", malayalam: "േ" },
  { manglish: "E", malayalam: "േ" },
  { manglish: "e", malayalam: "െ" },
  { manglish: "ai", malayalam: "ൈ" },
  { manglish: "ei", malayalam: "ൈ" },
  { manglish: "oa", malayalam: "ോ" },
  { manglish: "O", malayalam: "ോ" },
  { manglish: "o", malayalam: "ൊ" },
  { manglish: "au", malayalam: "ൌ" },
  { manglish: "ou", malayalam: "ൌ" },
  { manglish: "a", malayalam: "" }, // Inherent vowel 'a'
];

// Consonants and Common Conjuncts (Ordered by length descending for greedy matching)
const CONSONANTS: Rule[] = [
  // Triple / Complex Conjuncts
  { manglish: "sh-k-r", malayalam: "ഷ്ക്ര" },
  { manglish: "s-t-r", malayalam: "സ്ത്ര" },
  { manglish: "str", malayalam: "സ്ത്ര" },
  { manglish: "s-th-r", malayalam: "സ്ത്ര" },
  { manglish: "n-t-r", malayalam: "ന്ത്ര" },
  { manglish: "ntr", malayalam: "ന്ത്ര" },
  { manglish: "m-p-r", malayalam: "മ്പ്ര" },
  { manglish: "mpr", malayalam: "മ്പ്ര" },

  // Double Consonants & Standard Conjuncts
  { manglish: "kkh", malayalam: "ക്ക്ഖ" },
  { manglish: "k-k", malayalam: "ക്ക" },
  { manglish: "kk", malayalam: "ക്ക" },
  { manglish: "ng-g", malayalam: "ങ്ങ" },
  { manglish: "ng-k", malayalam: "ങ്ക" },
  { manglish: "nk", malayalam: "ങ്ക" },
  { manglish: "ch-ch", malayalam: "ച്ച" },
  { manglish: "chch", malayalam: "ച്ച" },
  { manglish: "cch", malayalam: "ച്ച" },
  { manglish: "nj-ch", malayalam: "ഞ്ച" },
  { manglish: "nch", malayalam: "ഞ്ച" },
  { manglish: "nj-j", malayalam: "ഞ്ഞ" },
  { manglish: "njj", malayalam: "ഞ്ഞ" },
  { manglish: "nnj", malayalam: "ഞ്ഞ" },
  { manglish: "nj", malayalam: "ഞ" },
  { manglish: "ngg", malayalam: "ങ്ങ" },
  { manglish: "TT", malayalam: "ട്ട" },
  { manglish: "t-t", malayalam: "ട്ട" },
  { manglish: "N-T", malayalam: "ണ്ട" },
  { manglish: "n-d", malayalam: "ണ്ട" },
  { manglish: "ND", malayalam: "ണ്ട" },
  { manglish: "nd", malayalam: "ണ്ട" },
  { manglish: "N-N", malayalam: "ണ്ണ" },
  { manglish: "NN", malayalam: "ണ്ണ" },
  { manglish: "th-th", malayalam: "ത്ത" },
  { manglish: "thth", malayalam: "ത്ത" },
  { manglish: "tth", malayalam: "ത്ത" },
  { manglish: "th-b", malayalam: "ത്ഭ" },
  { manglish: "tbh", malayalam: "ത്ഭ" },
  { manglish: "d-d", malayalam: "ദ്ദ" },
  { manglish: "dd", malayalam: "ദ്ദ" },
  { manglish: "dh-dh", malayalam: "ദ്ധ" },
  { manglish: "dhdh", malayalam: "ദ്ധ" },
  { manglish: "n-th", malayalam: "ന്ത" },
  { manglish: "nth", malayalam: "ന്ത" },
  { manglish: "n-dh", malayalam: "ന്ധ" },
  { manglish: "ndh", malayalam: "ന്ധ" },
  { manglish: "n-n", malayalam: "ന്ന" },
  { manglish: "nn", malayalam: "ന്ന" },
  { manglish: "p-p", malayalam: "പ്പ" },
  { manglish: "pp", malayalam: "പ്പ" },
  { manglish: "b-b", malayalam: "ബ്ബ" },
  { manglish: "bb", malayalam: "ബ്ബ" },
  { manglish: "m-p", malayalam: "മ്പ" },
  { manglish: "mp", malayalam: "മ്പ" },
  { manglish: "m-b", malayalam: "മ്പ" },
  { manglish: "mb", malayalam: "മ്പ" },
  { manglish: "m-m", malayalam: "മ്മ" },
  { manglish: "mm", malayalam: "മ്മ" },
  { manglish: "y-y", malayalam: "യ്യ" },
  { manglish: "yy", malayalam: "യ്യ" },
  { manglish: "l-l", malayalam: "ല്ല" },
  { manglish: "ll", malayalam: "ല്ല" },
  { manglish: "v-v", malayalam: "വ്വ" },
  { manglish: "vv", malayalam: "വ്വ" },
  { manglish: "ww", malayalam: "വ്വ" },
  { manglish: "sh-sh", malayalam: "ശ്ശ" },
  { manglish: "shsh", malayalam: "ശ്ശ" },
  { manglish: "S-S", malayalam: "ഷ്ഷ" },
  { manglish: "s-s", malayalam: "സ്സ" },
  { manglish: "ss", malayalam: "സ്സ" },
  { manglish: "L-L", malayalam: "ള്ള" },
  { manglish: "LL", malayalam: "ള്ള" },
  { manglish: "R-R", malayalam: "റ്റ" },
  { manglish: "RR", malayalam: "റ്റ" },
  { manglish: "tt", malayalam: "റ്റ" },
  { manglish: "n-r", malayalam: "ന്റ" },
  { manglish: "n-t", malayalam: "ന്റ" },
  { manglish: "nt", malayalam: "ന്റ" },
  { manglish: "ksh", malayalam: "ക്ഷ" },
  { manglish: "jn", malayalam: "ജ്ഞ" },
  { manglish: "gy", malayalam: "ജ്ഞ" },
  { manglish: "dny", malayalam: "ജ്ഞ" },
  { manglish: "shr", malayalam: "ശ്ര" },
  { manglish: "shree", malayalam: "ശ്രീ" },

  // Base Consonants
  { manglish: "kh", malayalam: "ഖ" },
  { manglish: "gh", malayalam: "ഘ" },
  { manglish: "ng", malayalam: "ങ" },
  { manglish: "chh", malayalam: "ഛ" },
  { manglish: "ch", malayalam: "ച" },
  { manglish: "jh", malayalam: "ഝ" },
  { manglish: "ny", malayalam: "ഞ" },
  { manglish: "Th", malayalam: "ഠ" },
  { manglish: "Dh", malayalam: "ഢ" },
  { manglish: "thh", malayalam: "ഥ" },
  { manglish: "th", malayalam: "ത" },
  { manglish: "dh", malayalam: "ധ" },
  { manglish: "ph", malayalam: "ഫ" },
  { manglish: "bh", malayalam: "ഭ" },
  { manglish: "sh", malayalam: "ശ" },
  { manglish: "shh", malayalam: "ഷ" },
  { manglish: "zh", malayalam: "ഴ" },

  { manglish: "k", malayalam: "ക" },
  { manglish: "g", malayalam: "ഗ" },
  { manglish: "j", malayalam: "ജ" },
  { manglish: "T", malayalam: "ട" },
  { manglish: "D", malayalam: "ഡ" },
  { manglish: "N", malayalam: "ണ" },
  { manglish: "t", malayalam: "ത" },
  { manglish: "d", malayalam: "ദ" },
  { manglish: "n", malayalam: "ന" },
  { manglish: "p", malayalam: "പ" },
  { manglish: "f", malayalam: "ഫ" },
  { manglish: "b", malayalam: "ബ" },
  { manglish: "m", malayalam: "മ" },
  { manglish: "y", malayalam: "യ" },
  { manglish: "r", malayalam: "ര" },
  { manglish: "l", malayalam: "ല" },
  { manglish: "v", malayalam: "വ" },
  { manglish: "w", malayalam: "വ" },
  { manglish: "S", malayalam: "ഷ" },
  { manglish: "s", malayalam: "സ" },
  { manglish: "h", malayalam: "ഹ" },
  { manglish: "L", malayalam: "ള" },
  { manglish: "z", malayalam: "ഴ" },
  { manglish: "R", malayalam: "റ" },
];

// Chillu letters mapping for end-of-word or explicit chillu tokens
const CHILLU_MAP: Record<string, string> = {
  "r": "ർ",
  "l": "ൽ",
  "L": "ൾ",
  "n": "ൻ",
  "N": "ൺ",
  "k": "ൿ",
};

/**
 * Checks if a character is a Latin alphabet character.
 */
function isAlpha(ch: string): boolean {
  return /^[a-zA-Z]$/.test(ch);
}

/**
 * Checks if the given position in text is at a word boundary (end of word or next char non-alpha).
 */
function isAtWordEnd(text: string, pos: number): boolean {
  if (pos >= text.length) return true;
  return !isAlpha(text[pos]);
}

/**
 * Transliterates a single Manglish word into Malayalam Unicode.
 */
export function transliterateWord(word: string): string {
  if (!word) return "";
  let result = "";
  let i = 0;
  let isWordStart = true;

  while (i < word.length) {
    // 1. Explicit virama marker: '~' or '^'
    if (word[i] === "~" || word[i] === "^") {
      result += "്";
      i++;
      isWordStart = false;
      continue;
    }

    // 2. Check for Independent Vowels if at the start of a syllable or word
    if (isWordStart) {
      let matchedVowel = false;
      for (const rule of INDEPENDENT_VOWELS) {
        if (word.startsWith(rule.manglish, i)) {
          result += rule.malayalam;
          i += rule.manglish.length;
          matchedVowel = true;
          isWordStart = false;
          break;
        }
      }
      if (matchedVowel) continue;
    }

    // 3. Check for Chillu letters at word end (e.g. 'avar' -> അവർ, 'kollam' -> കൊല്ലം)
    if (isAtWordEnd(word, i + 1)) {
      const ch = word[i];
      if (ch === "m") {
        result += "ം";
        i++;
        isWordStart = false;
        continue;
      }
      if (CHILLU_MAP[ch]) {
        result += CHILLU_MAP[ch];
        i++;
        isWordStart = false;
        continue;
      }
    }

    // 4. Match Consonants
    let matchedConsonant: Rule | null = null;
    for (const rule of CONSONANTS) {
      if (word.startsWith(rule.manglish, i)) {
        matchedConsonant = rule;
        break;
      }
    }

    if (matchedConsonant) {
      i += matchedConsonant.manglish.length;
      const consonantMalayalam = matchedConsonant.malayalam;

      // Check what follows the consonant:
      // A) End of word -> Chandrakkala (്) or Chillu
      if (i >= word.length || !isAlpha(word[i])) {
        // If this consonant is in chillu map and at end of word, use chillu
        const singleChar = matchedConsonant.manglish;
        if (singleChar === "m") {
          result += "ം";
        } else if (CHILLU_MAP[singleChar]) {
          result += CHILLU_MAP[singleChar];
        } else {
          result += consonantMalayalam + "്";
        }
        isWordStart = true;
        continue;
      }

      // B) Dependent Vowel
      let matchedVowel = false;
      for (const vRule of DEPENDENT_VOWELS) {
        if (word.startsWith(vRule.manglish, i)) {
          result += consonantMalayalam + vRule.malayalam;
          i += vRule.manglish.length;
          matchedVowel = true;
          isWordStart = false;
          break;
        }
      }

      // C) Another consonant immediately follows -> append virama (്)
      if (!matchedVowel) {
        result += consonantMalayalam + "്";
        isWordStart = false;
      }
      continue;
    }

    // 5. If no consonant or vowel matched, preserve raw character
    result += word[i];
    isWordStart = !isAlpha(word[i]);
    i++;
  }

  return result;
}

/**
 * Transliterates an entire block of text (preserving whitespace, punctuation, newlines, etc.)
 */
export function manglishToUnicode(text: string): string {
  if (!text) return "";

  // Split into tokens of alpha words and non-alpha delimiters
  return text.replace(/[a-zA-Z~^]+/g, (match) => {
    return transliterateWord(match);
  });
}
