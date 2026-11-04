import { os } from "../cep/node";
import { csi } from "./bolt";

/**
 * Register all possible keyboard shortcuts on Mac and Windows for you CEP Panel
 * Warning: Note that certain keys will not work per OS regardless of registration
 */

export interface KeyInterest {
  keyCode: number;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
}

export const keyRegisterOverride = () => {
  if (typeof window === "undefined") return;

  // Targeted list of key events for After Effects & Premiere Pro.
  // Registering 3500+ keys causes After Effects' native CSXS bridge to overflow/reject the buffer.
  // Instead, register the exact essential shortcuts + editing keys needed by the panel:
  const keyEvents: KeyInterest[] = [
    // 1. Copy (⌘+C / Ctrl+C)
    { keyCode: 67, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
    { keyCode: 67, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },

    // 2. Paste (⌘+V / Ctrl+V)
    { keyCode: 86, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
    { keyCode: 86, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },

    // 3. Copy to Clipboard / Output (⌘+Enter / Ctrl+Enter)
    { keyCode: 13, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
    { keyCode: 13, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    // Standard Enter (IME commit & newlines)
    { keyCode: 13, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },
    { keyCode: 13, ctrlKey: false, metaKey: false, altKey: false, shiftKey: true },

    // 4. Number choosing 1 to 6 (Standard top-row digits 1-6)
    { keyCode: 49 }, // 1
    { keyCode: 50 }, // 2
    { keyCode: 51 }, // 3
    { keyCode: 52 }, // 4
    { keyCode: 53 }, // 5
    { keyCode: 54 }, // 6

    // Number choosing 1 to 6 (Numpad digits 1-6)
    { keyCode: 97 },  // Num 1
    { keyCode: 98 },  // Num 2
    { keyCode: 99 },  // Num 3
    { keyCode: 100 }, // Num 4
    { keyCode: 101 }, // Num 5
    { keyCode: 102 }, // Num 6

    // 5. Space (32) - CRITICAL FOR AFTER EFFECTS:
    // Without registering space, AE steals it for RAM preview/timeline playback!
    { keyCode: 32 },

    // 6. Cut (⌘+X / Ctrl+X), Select All (⌘+A / Ctrl+A), Undo (⌘+Z / Ctrl+Z)
    { keyCode: 88, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
    { keyCode: 88, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    { keyCode: 65, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
    { keyCode: 65, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    { keyCode: 90, metaKey: true, ctrlKey: false, altKey: false, shiftKey: false },
    { keyCode: 90, ctrlKey: true, metaKey: false, altKey: false, shiftKey: false },
    { keyCode: 90, metaKey: true, ctrlKey: false, altKey: false, shiftKey: true },
    { keyCode: 90, ctrlKey: true, metaKey: false, altKey: false, shiftKey: true },

    // 7. Standard editing navigation (Backspace, Delete, Escape, Tab, Arrows)
    { keyCode: 8, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },  // Backspace
    { keyCode: 46, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, // Delete
    { keyCode: 27, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, // Escape
    { keyCode: 9, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false },  // Tab
    { keyCode: 37, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, // ArrowLeft
    { keyCode: 38, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, // ArrowUp
    { keyCode: 39, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, // ArrowRight
    { keyCode: 40, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false }, // ArrowDown
  ];

  const json = JSON.stringify(keyEvents);
  try {
    if (window.__adobe_cep__ && window.__adobe_cep__.registerKeyEventsInterest) {
      window.__adobe_cep__.registerKeyEventsInterest(json);
    } else if (csi && csi.registerKeyEventsInterest) {
      csi.registerKeyEventsInterest(json);
    }
    console.log("[FML Buddy] Targeted Key Events Registered for AE/Premiere");
  } catch (err) {
    console.warn("[FML Buddy] keyRegisterOverride failed:", err);
  }
};

export const textCepPatch = (e: KeyboardEvent) => {
  const isMac = os.platform() === "darwin";
  if (!isMac) return; // Only needed on MacOS, Windows handles this natively

  // console.log("keyup", e);

  const isShiftKey = e.shiftKey;
  const input = e.target as HTMLTextAreaElement | HTMLInputElement;
  const start = input.selectionStart;
  let end = input.selectionEnd;

  const selectionExists = start !== null && end !== null && start !== end;

  if (start === null || end === null) return;

  if (e.key === "ArrowLeft") {
    if (start === 0) return; // Prevents going to -1
    if (isShiftKey) {
      input.setSelectionRange(start - 1, end);
    } else {
      input.setSelectionRange(start - 1, start - 1);
    }
  } else if (e.key === "ArrowRight") {
    if (end === input.value.length) return; // Prevents going to start
    if (isShiftKey) {
      input.setSelectionRange(start, end + 1);
    } else {
      input.setSelectionRange(end + 1, end + 1);
    }
  }
};

/**
 * Prevents the user from dropping files or URLs onto the panel and navigating away
 */

export const dropDisable = () => {
  window.addEventListener("dragover", (e) => e.preventDefault(), false);
  window.addEventListener("drop", (e) => e.preventDefault(), false);
};
