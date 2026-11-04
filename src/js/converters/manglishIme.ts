/**
 * FML Buddy - Intelligent Malayalam Manglish IME Engine
 * Dual-Engine Architecture:
 * 1. Google Input Tools API integration (exact match for https://www.google.com/intl/ml/inputtools/try/)
 * 2. Ultra-fast local dictionary & morphological tokenizer (0ms offline fallback)
 */

import { transliterateWord } from "./manglishToUnicode";

// Cache for Google Input Tools API responses
const googleImeCache = new Map<string, string[]>();

/**
 * High-frequency Malayalam dictionary for instant 0ms lookup
 */
const MANGLISH_DICTIONARY: Record<string, string[]> = {
  // Pronouns & Demonstratives
  "njan": ["ഞാൻ", "ഞാനു്", "ഞ്ഞാൻ", "ഞാനും", "ഞാൺ"],
  "njaan": ["ഞാൻ", "ഞാനു്", "ഞ്ഞാൻ", "ഞാനും", "ഞാൺ"],
  "njanum": ["ഞാനും", "ഞാനുംകൂടി"],
  "njaanum": ["ഞാനും", "ഞാനുംകൂടി"],
  "ente": ["എന്റെ", "എൻ്റെ", "എന്റേത്"],
  "entethu": ["എന്റേത്", "എൻ്റേത്"],
  "enikku": ["എനിക്ക്", "എനിക്കു്"],
  "enikk": ["എനിക്ക്", "എനിക്കു്"],
  "enne": ["എന്നെ"],
  "ennodu": ["എന്നോട്", "എന്നോടു്"],
  "nee": ["നീ", "നീയും"],
  "ninakku": ["നിനക്ക്", "നിനക്കു്"],
  "ninakk": ["നിനക്ക്", "നിനക്കു്"],
  "ninte": ["നിന്റെ", "നിൻ്റെ"],
  "ninne": ["നിന്നെ"],
  "ninnodu": ["നിന്നോട്"],
  "ningal": ["നിങ്ങൾ", "നിങ്ങളു്"],
  "ningalkku": ["നിങ്ങൾക്ക്", "നിങ്ങൾക്കു്"],
  "ningalkk": ["നിങ്ങൾക്ക്", "നിങ്ങൾക്കു്"],
  "ningalude": ["നിങ്ങളുടെ"],
  "njangal": ["ഞങ്ങൾ", "ഞങ്ങളു്"],
  "njangalkku": ["ഞങ്ങൾക്ക്", "ഞങ്ങൾക്കു്"],
  "njangalude": ["ഞങ്ങളുടെ"],
  "avan": ["അവൻ", "അവനു്"],
  "avante": ["അവന്റെ", "അവൻ്റെ"],
  "avanu": ["അവന്", "അവനു്"],
  "avalkku": ["അവൾക്ക്", "അവൾക്കു്"],
  "aval": ["അവൾ"],
  "avalude": ["അവളുടെ"],
  "avar": ["അവർ"],
  "avarkku": ["അവർക്ക്", "അവർക്കു്"],
  "avarude": ["അവരുടെ"],
  "ithu": ["ഇത്", "ഇതു്", "ഇതാണ്"],
  "ith": ["ഇത്", "ഇതു്", "ഇതാണ്"],
  "athu": ["അത്", "അതു്", "അതാണ്"],
  "ath": ["അത്", "അതു്", "അതാണ്"],
  "ithanu": ["ഇതാണ്"],
  "athanu": ["അതാണ്"],

  // Question Words (Frequently ending with '?')
  "entha": ["എന്താ", "എന്താണ്", "എന്ത്"],
  "enth": ["എന്ത്", "എന്താ", "എന്താണ്"],
  "enthanu": ["എന്താണ്"],
  "enthonnu": ["എന്തൊന്ന്"],
  "enthokke": ["എന്തൊക്കെ", "എന്തൊക്കെയുണ്ട്"],
  "enthina": ["എന്തിനാ", "എന്തിനാണ്", "എന്തിന്"],
  "enthinanu": ["എന്തിനാണ്"],
  "enthinu": ["എന്തിന്", "എന്തിനാണ്"],
  "engane": ["എങ്ങനെ", "എങ്ങനെയുണ്ട്"],
  "enganeya": ["എങ്ങനെയാ", "എങ്ങനെയാണ്"],
  "anganey": ["അങ്ങനെ", "അങ്ങനെയാണോ"],
  "inganey": ["ഇങ്ങനെ"],
  "evide": ["എവിടെ", "എവിടെയാണ്"],
  "evideya": ["എവിടെയാ", "എവിടെയാണ്"],
  "ivide": ["ഇവിടെ", "ഇവിടെയുണ്ട്"],
  "avide": ["അവിടെ", "അവിടെയുണ്ട്"],
  "eppol": ["എപ്പോൾ", "എപ്പോഴാണ്"],
  "ippol": ["ഇപ്പോൾ"],
  "appol": ["അപ്പോൾ"],
  "eppo": ["എപ്പോ", "എപ്പോൾ"],
  "ippo": ["ഇപ്പോ", "ഇപ്പോൾ"],
  "appo": ["അപ്പോ", "അപ്പോൾ"],
  "eppozha": ["എപ്പോഴാ", "എപ്പോഴാണ്"],
  "ippozha": ["ഇപ്പോഴാ"],
  "appozha": ["അപ്പോഴാ"],
  "aaru": ["ആര്", "ആരാണ്"],
  "aar": ["ആര്", "ആരാണ്"],
  "aaranu": ["ആരാണ്"],
  "aara": ["ആരാ", "ആരാണ്"],
  "aarokke": ["ആരൊക്കെ"],
  "aarude": ["ആരുടെ"],
  "aarkku": ["ആർക്ക്", "ആർക്കു്"],
  "enthukondu": ["എന്തുകൊണ്ട്", "എന്തുകൊണ്ടാണു്"],
  "engotta": ["എങ്ങോട്ടാ", "എങ്ങോട്ടാണ്"],
  "engottanu": ["എങ്ങോട്ടാണ്"],
  "engottu": ["എങ്ങോട്ട്", "എങ്ങോട്ടാണ്"],
  "angottu": ["അങ്ങോട്ട്"],
  "ingottu": ["ഇങ്ങോട്ട്"],
  "ethu": ["ഏത്", "ഏതാണ്"],
  "ethanu": ["ഏതാണ്"],
  "etha": ["ഏതാ", "ഏതാണ്"],
  "ethra": ["എത്ര", "എത്രയാണ്"],
  "ethrayanu": ["എത്രയാണ്"],
  "aano": ["ആണോ"],
  "aanu": ["ആണ്", "ആണു്"],
  "undo": ["ഉണ്ടോ"],
  "undoo": ["ഉണ്ടോ"],
  "ille": ["ഇല്ലേ"],
  "alle": ["അല്ലേ"],
  "kando": ["കണ്ടോ", "കണ്ടിട്ടുണ്ടോ"],
  "kandille": ["കണ്ടില്ലേ"],
  "ketto": ["കേട്ടോ"],
  "poyo": ["പോയോ"],
  "vanno": ["വന്നോ"],
  "cheytho": ["ചെയ്തോ"],
  "ariyamo": ["അറിയാമോ", "അറിയോ"],
  "ariyumo": ["അറിയുമോ", "അറിയാമോ"],
  "ariyo": ["അറിയോ", "അറിയാമോ"],
  "varumo": ["വരുമോ"],
  "pokumo": ["പോകുമോ"],
  "tharuvo": ["തരുമോ"],
  "nokkamo": ["നോക്കാമോ"],
  "parayamo": ["പറയാമോ"],
  "kazhinjo": ["കഴിഞ്ഞോ", "കഴിഞ്ഞു"],
  "theernno": ["തീർന്നോ", "തീർന്നു"],
  "maranno": ["മറന്നോ"],
  "marannu": ["മറന്നു"],
  "ormmayundo": ["ഓർമ്മയുണ്ടോ"],
  "ormayundo": ["ഓർമ്മയുണ്ടോ"],
  "venda": ["വേണ്ട", "വേണ്ടേ"],
  "vende": ["വേണ്ടേ"],
  "sugam": ["സുഖം", "സുഖമാണോ"],
  "sugamano": ["സുഖമാണോ", "സുഖം"],
  "athe": ["അതെ", "അതേ"],
  "atheyo": ["അതേയോ", "അതെ"],
  "alla": ["അല്ല", "അല്ലേ"],
  "shari": ["ശരി", "ശരിയാണ്"],
  "shariyano": ["ശരിയാണോ", "ശരിയാണ്"],
  "shariyanu": ["ശരിയാണ്"],

  // Greetings & Feelings
  "namaskaram": ["നമസ്കാരം", "നമസ്ക്കാരം"],
  "nandi": ["നന്ദി"],
  "nanni": ["നന്ദി"],
  "swagatham": ["സ്വാഗതം"],
  "abhinandhanangal": ["അഭിനന്ദനങ്ങൾ"],
  "aashamsakal": ["ആശംസകൾ"],
  "sneham": ["സ്നേഹം", "സ്നേഹത്തോടെ"],
  "santhosham": ["സന്തോഷം"],
  "subhadinam": ["ശുഭദിനം"],
  "subharaathri": ["ശുഭരാത്രി"],
  "sukham": ["സുഖം", "സുഖമാണോ"],
  "sukhamano": ["സുഖമാണോ", "സുഖം"],
  "sugham": ["സുഖം"],
  "sughamano": ["സുഖമാണോ"],

  // Common Verbs & Actions
  "vannu": ["വന്നു", "വന്നിട്ടുണ്ട്"],
  "varoo": ["വരൂ", "വരൂൂ"],
  "varu": ["വരൂ", "വരു", "വരിക"],
  "varunnu": ["വരുന്നു", "വരുന്നുണ്ട്"],
  "varum": ["വരും"],
  "varaan": ["വരാൻ"],
  "varilla": ["വരില്ല"],
  "poyi": ["പോയി", "പോയിട്ടുണ്ട്"],
  "pokaam": ["പോകാം"],
  "pokuka": ["പോകുക"],
  "pokunnu": ["പോകുന്നു", "പോകുന്നുണ്ട്"],
  "povaan": ["പോവാൻ", "പോകാൻ"],
  "cheythu": ["ചെയ്തു", "ചെയ്തിട്ടുണ്ട്"],
  "cheyyam": ["ചെയ്യാം"],
  "cheyyuka": ["ചെയ്യുക"],
  "cheyyunnu": ["ചെയ്യുന്നു", "ചെയ്യുന്നുണ്ട്"],
  "cheyyaan": ["ചെയ്യാൻ"],
  "cheyyo": ["ചെയ്യോ", "ചെയ്യുമോ"],
  "nokku": ["നോക്കൂ", "നോക്കു", "നോക്കുക"],
  "nokkoo": ["നോക്കൂ"],
  "nokki": ["നോക്കി", "നോക്കിയിട്ടുണ്ട്"],
  "nokkunnu": ["നോക്കുന്നു"],
  "parayu": ["പറയൂ", "പറയു", "പറയുക"],
  "parayoo": ["പറയൂ"],
  "paranju": ["പറഞ്ഞു", "പറഞ്ഞിട്ടുണ്ട്"],
  "parayunnu": ["പറയുന്നു"],
  "kelkku": ["കേൾക്കൂ", "കേൾക്കു"],
  "kettu": ["കേട്ടു", "കേട്ടിട്ടുണ്ട്"],
  "kandu": ["കണ്ടു", "കണ്ടിട്ടുണ്ട്"],
  "kaanu": ["കാണൂ", "കാണു", "കാണുക"],
  "kanunnu": ["കാണുന്നു"],
  "und": ["ഉണ്ട്", "ഉണ്ടു്"],
  "undu": ["ഉണ്ട്", "ഉണ്ടു്"],
  "illa": ["ഇല്ല", "ഇല്ലേ"],
  "aayi": ["ആയി", "ആയിട്ടുണ്ട്"],
  "aavum": ["ആകും", "ആവും"],
  "ariyam": ["അറിയാം"],
  "ariyilla": ["അറിയില്ല"],
  "tharaam": ["തരാം"],
  "tharu": ["തരൂ", "തരു"],
  "thannu": ["തന്നു"],
  "chothichu": ["ചോദിച്ചു"],
  "chothikku": ["ചോദിക്കൂ", "ചോദിക്കു"],
  "kazhinju": ["കഴിഞ്ഞു"],
  "kazhiyum": ["കഴിയും"],
  "thudangi": ["തുടങ്ങി"],
  "theernnu": ["തീർന്നു"],

  // Places, People, Media & Titles
  "malayalam": ["മലയാളം"],
  "malayali": ["മലയാളി", "മലയാളികൾ"],
  "keralam": ["കേരളം", "കേരള"],
  "kerala": ["കേരള"],
  "keralathil": ["കേരളത്തിൽ", "കേരളത്തില്"],
  "kochi": ["കൊച്ചി"],
  "trivandrum": ["തിരുവനന്തപുരം"],
  "thiruvananthapuram": ["തിരുവനന്തപുരം"],
  "calicut": ["കോഴിക്കോട്"],
  "kozhikkode": ["കോഴിക്കോട്"],
  "thrissur": ["തൃശ്ശൂർ", "തൃശൂർ"],
  "kannur": ["കണ്ണൂർ"],
  "kollam": ["കൊല്ലം"],
  "alappuzha": ["ആലപ്പുഴ"],
  "kottayam": ["കോട്ടയം"],
  "palakkad": ["പാലക്കാട്"],
  "wayanad": ["വയനാട്"],
  "malappuram": ["മലപ്പുറം"],
  "kasaragod": ["കാസർഗോഡ്", "കാസർകോട്"],
  "pathanamthitta": ["പത്തനംതിട്ട"],
  "idukki": ["ഇടുക്കി"],
  "amma": ["അമ്മ", "അമ്മേ"],
  "achan": ["അച്ഛൻ", "അച്ചൻ"],
  "chetta": ["ചേട്ടാ", "ചേട്ടൻ"],
  "chechi": ["ചേച്ചി"],
  "aniyathi": ["അനിയത്തി"],
  "aniyan": ["അനിയൻ"],
  "makan": ["മകൻ"],
  "makal": ["മകൾ"],
  "suhruth": ["സുഹൃത്ത്"],
  "kootukaran": ["കൂട്ടുകാരൻ"],
  "kootukari": ["കൂട്ടുകാരി"],
  "manushyan": ["മനുഷ്യൻ"],
  "aal": ["ആൾ", "ആളുകൾ"],
  "aalkkar": ["ആളുകൾ", "ആൾക്കാർ"],
  "veed": ["വീട്", "വീടു്"],
  "veedu": ["വീട്", "വീടു്"],
  "veettil": ["വീട്ടിൽ"],
  "naad": ["നാട്", "നാടു്"],
  "naadu": ["നാട്", "നാടു്"],
  "nattil": ["നാട്ടിൽ"],
  "karyam": ["കാര്യം", "കാര്യങ്ങൾ"],
  "kaaryam": ["കാര്യം"],
  "bhasha": ["ഭാഷ"],
  "cinema": ["സിനിമ"],
  "padam": ["പടം", "പാടം"],
  "chithram": ["ചിത്രം"],
  "kadha": ["കഥ"],
  "pusthakam": ["പുസ്തകം"],
  "paattu": ["പാട്ട്"],
  "ganam": ["ഗാനം"],
  "premam": ["പ്രേമം"],
  "bheekaram": ["ഭീകരം"],
  "mazha": ["മഴ"],
  "puzha": ["പുഴ"],
  "vazhi": ["വഴി"],
  "vellam": ["വെള്ളം"],
  "thee": ["തീ"],
  "kaattu": ["കാറ്റ്"],
  "kaattil": ["കാട്ടിൽ"],
  "samayam": ["സമയം"],
  "divasam": ["ദിവസം", "ദിവസങ്ങൾ"],
  "maasam": ["മാസം"],
  "varsham": ["വർഷം"],
  "innu": ["ഇന്ന്", "ഇന്നു്"],
  "naale": ["നാളെ"],
  "innale": ["ഇന്നലെ"],
  "raavile": ["രാവിലെ"],
  "rathri": ["രാത്രി"],
  "nalla": ["നല്ല", "നല്ലത്"],
  "valiya": ["വലിയ"],
  "cheriya": ["ചെറിയ"],
  "puthiya": ["പുതിയ"],
  "pazhaya": ["പഴയ"],
  "kooduthal": ["കൂടുതൽ"],
  "kurav": ["കുറവ്", "കുറവു്"],
  "ellam": ["എല്ലാം"],
  "ellavarum": ["എല്ലാവരും"],
  "ini": ["ഇനി", "ഇനിയും"],
  "pinne": ["പിന്നെ", "പിന്നെയും"],
  "koode": ["കൂടെ"],
  "oppam": ["ഒപ്പം"],
  "mathram": ["മാത്രം"],
  "maathram": ["മാത്രം"],
  "allenkil": ["അല്ലെങ്കിൽ"],
  "athukondu": ["അതുകൊണ്ട്"],
  "engilum": ["എങ്കിലും"],
  "enkilum": ["എങ്കിലും"],
  "oru": ["ഒരു", "ഒരാൾ"],
  "onnu": ["ഒന്ന്", "ഒന്നു്"],
  "randu": ["രണ്ട്", "രണ്ടു്"],
  "moonnu": ["മൂന്ന്", "മൂന്നു്"],
  "naalu": ["നാല്", "നാലു്"],
  "anchu": ["അഞ്ച്", "അഞ്ചു്"],
  "pathu": ["പത്ത്"],
  "nooru": ["നൂറ്"],
};

/**
 * Fetches candidates from Google Input Tools API (matching https://www.google.com/intl/ml/inputtools/try/)
 */
export async function fetchGoogleInputToolsCandidates(word: string): Promise<string[]> {
  const cleanWord = word.trim().toLowerCase();
  if (!cleanWord || !/^[a-zA-Z~^]+$/.test(cleanWord)) return [];

  // Check in-memory cache
  if (googleImeCache.has(cleanWord)) {
    return googleImeCache.get(cleanWord)!;
  }

  try {
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(
      cleanWord
    )}&itc=ml-t-i0-und&num=5&cp=0&cs=1&ie=utf-8&oe=utf-8&app=demopage`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = await res.json();
      if (
        Array.isArray(data) &&
        data[0] === "SUCCESS" &&
        Array.isArray(data[1]) &&
        data[1][0] &&
        Array.isArray(data[1][0][1])
      ) {
        const results = data[1][0][1] as string[];
        if (results.length > 0) {
          googleImeCache.set(cleanWord, results);
          return results;
        }
      }
    }
  } catch (err) {
    // Graceful offline fallback
  }

  return [];
}

/**
 * Returns prioritized transliteration candidate suggestions for a given Manglish word.
 * Synchronous method with 0ms latency.
 */
export function getCandidates(rawWord: string): string[] {
  if (!rawWord || !rawWord.trim()) return [];

  const word = rawWord.trim().toLowerCase();
  const candidates: string[] = [];
  const seen = new Set<string>();

  const addCandidate = (val: string) => {
    if (val && !seen.has(val)) {
      seen.add(val);
      candidates.push(val);
    }
  };

  // 1. Check Google Input Tools Cache first
  if (googleImeCache.has(word)) {
    for (const c of googleImeCache.get(word)!) {
      addCandidate(c);
    }
  }

  // 2. Direct high-frequency dictionary match
  if (MANGLISH_DICTIONARY[word]) {
    for (const c of MANGLISH_DICTIONARY[word]) {
      addCandidate(c);
    }
  }

  // 3. Rule-based phonetic transliteration engine
  const primaryRule = transliterateWord(rawWord);
  addCandidate(primaryRule);

  // 4. Phonetic permutations to generate meaningful alternatives:
  // - Chillu vs Samvruthokaram: if ends with '്', also suggest ending with 'ു' and 'ു്'
  if (primaryRule.endsWith("്")) {
    const stem = primaryRule.slice(0, -1);
    addCandidate(stem + "ു");
    addCandidate(stem + "ു്");
    addCandidate(stem);
  }

  // - If ends with 'ൻ', also suggest 'ൺ' or 'നു്'
  if (primaryRule.endsWith("ൻ")) {
    const stem = primaryRule.slice(0, -1);
    addCandidate(stem + "ൺ");
    addCandidate(stem + "നു്");
  }

  // - If ends with 'ൽ', also suggest 'ൾ'
  if (primaryRule.endsWith("ൽ")) {
    const stem = primaryRule.slice(0, -1);
    addCandidate(stem + "ൾ");
  }

  // - Word final 'o' elongation for verbs/questions (e.g. kando -> കണ്ടോ, poyo -> പോയോ)
  if (word.endsWith("o")) {
    if (primaryRule.endsWith("ൊ")) {
      const stem = primaryRule.slice(0, -1);
      addCandidate(stem + "ോ");
    } else if (!primaryRule.endsWith("ോ")) {
      addCandidate(primaryRule + "ോ");
    }
  }

  // - Word final 'e' elongation (e.g. ille -> ഇല്ലേ, alle -> അല്ലേ)
  if (word.endsWith("e")) {
    if (primaryRule.endsWith("െ")) {
      const stem = primaryRule.slice(0, -1);
      addCandidate(stem + "േ");
    } else if (!primaryRule.endsWith("േ")) {
      addCandidate(primaryRule + "േ");
    }
  }

  // - Word final 'a' elongation (e.g. entha -> എന്താ, evideya -> എവിടെയാ)
  if (word.endsWith("a")) {
    if (primaryRule.endsWith("്")) {
      const stem = primaryRule.slice(0, -1);
      addCandidate(stem + "ാ");
    } else if (!primaryRule.endsWith("ാ")) {
      addCandidate(primaryRule + "ാ");
    }
  }

  // Limit candidates to top 5 Malayalam transliterations
  const topCandidates = candidates.slice(0, 5);

  // Always append raw English word as option #6 (as in Google Input Tools & Manglish.app)
  topCandidates.push(rawWord);

  return topCandidates;
}

export interface ActiveWordToken {
  word: string;
  start: number;
  end: number;
}

/**
 * Identifies the current active alphanumeric word token at the cursor position.
 */
export function getActiveWordAtCursor(
  text: string,
  cursorPos: number
): ActiveWordToken | null {
  if (!text || cursorPos < 0 || cursorPos > text.length) return null;

  // Scan backward to find word start
  let start = cursorPos;
  while (start > 0 && /[a-zA-Z~^]/.test(text[start - 1])) {
    start--;
  }

  // Scan forward to find word end
  let end = cursorPos;
  while (end < text.length && /[a-zA-Z~^]/.test(text[end])) {
    end++;
  }

  const word = text.slice(start, end);
  if (!word || word.length === 0) return null;

  return { word, start, end };
}

/**
 * Punctuation characters that trigger word commit
 */
export const COMMIT_PUNCTUATION_CHARS: Record<string, string> = {
  " ": " ",
  "?": "?",
  "!": "!",
  ".": ".",
  ",": ", ",
  ";": "; ",
  ":": ": ",
};

export function isCommitPunctuation(key: string): boolean {
  return Boolean(COMMIT_PUNCTUATION_CHARS[key]);
}
