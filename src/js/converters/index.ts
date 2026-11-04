/**
 * FML Buddy - Central Converter Pipeline
 */

import { manglishToUnicode } from "./manglishToUnicode";
import { unicodeToFml } from "./unicodeToFml";
import { unicodeToMl } from "./unicodeToMl";
import { unicodeToRoman } from "./unicodeToRoman";

export type InputMode = "unicode" | "manglish";
export type TargetEncoding = "fml" | "ml" | "roman";

export interface ConversionResult {
  unicodeText: string;
  outputText: string;
}

/**
 * Executes full pipeline from Input -> [Unicode] -> Target Encoding.
 */
export function processConversion(
  input: string,
  mode: InputMode,
  target: TargetEncoding
): ConversionResult {
  if (!input) {
    return { unicodeText: "", outputText: "" };
  }

  // Pasted Unicode Malayalam must not be sent through the Manglish parser,
  // even when the user's last selected mode was Manglish.
  const containsMalayalam = /[\u0D00-\u0D7F]/.test(input);

  // Step 1: Resolve Unicode
  const unicodeText = mode === "manglish" && !containsMalayalam
    ? manglishToUnicode(input)
    : input;

  // Step 2: Convert Unicode to Target Encoding
  let outputText = "";
  switch (target) {
    case "fml":
      outputText = unicodeToFml(unicodeText);
      break;
    case "ml":
      outputText = unicodeToMl(unicodeText);
      break;
    case "roman":
      outputText = unicodeToRoman(unicodeText);
      break;
    default:
      outputText = unicodeToFml(unicodeText);
      break;
  }

  return { unicodeText, outputText };
}

export { manglishToUnicode, unicodeToFml, unicodeToMl, unicodeToRoman };
