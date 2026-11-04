/**
 * Unicode Malayalam to the Ratheesh ML-TT/Karthika legacy encoding.
 * Shares the website's local mapping and vowel/repham ordering engine.
 */
import { unicodeToRatheeshLegacy } from "./unicodeToFml";

export function unicodeToMl(strText: string): string {
  return unicodeToRatheeshLegacy(strText);
}
