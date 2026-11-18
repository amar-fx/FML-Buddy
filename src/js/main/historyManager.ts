/**
 * FML Buddy - Typed Words & Conversion History Manager
 * Automatically persists typed words, sentences, and conversions in localStorage.
 */

import { TargetEncoding } from "../converters";

export interface HistoryItem {
  id: string;
  inputText: string;
  unicodeText: string;
  outputText: string;
  mode: "manglish" | "unicode";
  targetEncoding: TargetEncoding;
  timestamp: number;
}

const STORAGE_KEY = "fml_buddy_typed_history_v1";
const MAX_HISTORY_ITEMS = 80;

/**
 * Loads all history items from localStorage safely.
 */
export function loadHistory(): HistoryItem[] {
  try {
    if (typeof localStorage === "undefined") return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (item): item is HistoryItem =>
        Boolean(
          item &&
            typeof item.id === "string" &&
            typeof item.inputText === "string" &&
            typeof item.timestamp === "number"
        )
    );
  } catch (err) {
    console.warn("[FML Buddy] Failed loading history from localStorage:", err);
    return [];
  }
}

/**
 * Saves the given history list to localStorage.
 */
export function persistHistory(items: HistoryItem[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch (err) {
    console.warn("[FML Buddy] Failed saving history to localStorage:", err);
  }
}

/**
 * Records a new typed word or conversion into history.
 * - Trims input
 * - Dedupes if identical to the most recent entry
 * - Updates timestamp & moves to top if repeated
 * - Limits to MAX_HISTORY_ITEMS
 */
export function recordHistoryEntry(entry: {
  inputText: string;
  unicodeText: string;
  outputText: string;
  mode: "manglish" | "unicode";
  targetEncoding: TargetEncoding;
}): HistoryItem[] {
  const cleanInput = entry.inputText ? entry.inputText.trim() : "";
  if (!cleanInput) {
    return loadHistory();
  }

  const current = loadHistory();
  const now = Date.now();

  // Check if identical to the most recent item
  if (current.length > 0 && current[0].inputText.trim() === cleanInput) {
    // Update top item's timestamp and converted outputs
    const updatedTop: HistoryItem = {
      ...current[0],
      unicodeText: entry.unicodeText,
      outputText: entry.outputText,
      mode: entry.mode,
      targetEncoding: entry.targetEncoding,
      timestamp: now,
    };
    const nextList = [updatedTop, ...current.slice(1)];
    persistHistory(nextList);
    return nextList;
  }

  // Remove any older duplicate entry of the same text so it re-surfaces at the top
  const filtered = current.filter((item) => item.inputText.trim() !== cleanInput);

  const newItem: HistoryItem = {
    id: `hist_${now}_${Math.random().toString(36).substring(2, 7)}`,
    inputText: cleanInput,
    unicodeText: entry.unicodeText || cleanInput,
    outputText: entry.outputText || "",
    mode: entry.mode,
    targetEncoding: entry.targetEncoding,
    timestamp: now,
  };

  const nextList = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
  persistHistory(nextList);
  return nextList;
}

/**
 * Removes a single history item by id.
 */
export function removeHistoryEntry(id: string): HistoryItem[] {
  const current = loadHistory();
  const nextList = current.filter((item) => item.id !== id);
  persistHistory(nextList);
  return nextList;
}

/**
 * Clears all history items.
 */
export function clearAllHistory(): HistoryItem[] {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {}
  return [];
}

/**
 * Extracts distinct typed words across history items.
 * Useful for showing quick word chips in the history panel.
 */
export function extractUniqueWords(items: HistoryItem[]): { word: string; count: number }[] {
  const wordCounts = new Map<string, number>();

  for (const item of items) {
    // Collect words from Malayalam unicodeText and Manglish inputText
    const words = `${item.unicodeText} ${item.inputText}`
      .split(/[\s,.;:!?()"'[\]{}।\\/—–-]+/)
      .map((w) => w.trim())
      .filter((w) => w.length >= 2);

    for (const w of words) {
      // Ignore sample template words
      if (w === "അമർഷഫാൻ" || w === "Amarshafan") continue;
      const count = wordCounts.get(w) || 0;
      wordCounts.set(w, count + 1);
    }
  }

  const sorted = Array.from(wordCounts.entries())
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);

  return sorted.slice(0, 24);
}

/**
 * Formats a timestamp into a clean, human-friendly relative time string.
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));

  if (diffSec < 15) return "Just now";
  if (diffSec < 60) return `${diffSec}s ago`;

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  try {
    const d = new Date(timestamp);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (e) {
    return `${diffDays}d ago`;
  }
}
