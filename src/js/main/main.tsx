import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { csi, evalTS, subscribeBackgroundColor } from "../lib/utils/bolt";
import { handleRefresh, handleForceRefresh } from "../lib/utils/init-cep";
import { keyRegisterOverride } from "../lib/utils/cep";
import {
  processConversion,
  TargetEncoding,
  unicodeToFml,
} from "../converters";
import {
  getCandidates,
  fetchGoogleInputToolsCandidates,
  getActiveWordAtCursor,
  ActiveWordToken,
  COMMIT_PUNCTUATION_CHARS,
  isCommitPunctuation,
} from "../converters/manglishIme";
import { getCaretCoordinates } from "../converters/caretPosition";
import { ImePopover } from "./ImePopover";
import logoImg from "../assets/logo.png";
import amarDpImg from "../assets/amar-dp.jpg";
import "./main.scss";
import { FML_FONTS, type FontItem } from "./fmlFontManifest";

interface ActionResult {
  success: boolean;
  message: string;
}

const CURRENT_VERSION = "1.0.1";
const GITHUB_REPO_URL = "https://github.com/amarshafan-m/FML-Buddy";
const GITHUB_FONTS_BASE_URL = "https://raw.githubusercontent.com/amarshafan-m/FML-Buddy/main/Assets/FML_Fonts";

/** Build a PowerShell command that does not depend on shell quoting or stdin encoding. */
function encodePowerShellCommand(command: string, NodeBuffer: any): string {
  return NodeBuffer.from(command, "utf16le").toString("base64");
}

function refreshWindowsFontCache(execFileSync: any, NodeBuffer: any, fontPaths: string[] = []): void {
  const encodedPaths = NodeBuffer.from(JSON.stringify(fontPaths), "utf8").toString("base64");
  const command = [
    "$sig='using System; using System.Runtime.InteropServices; public static class FmlFontRefresh { [DllImport(\"user32.dll\", SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, IntPtr lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult); [DllImport(\"gdi32.dll\", CharSet=CharSet.Unicode)] public static extern int AddFontResourceEx(string name, uint fl, IntPtr pdv); }';",
    "Add-Type -TypeDefinition $sig;",
    `$fonts=ConvertFrom-Json ([Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedPaths}'))); foreach($font in $fonts){ [FmlFontRefresh]::AddFontResourceEx([string]$font, 0, [IntPtr]::Zero) | Out-Null; }`,
    "$result=[UIntPtr]::Zero; [FmlFontRefresh]::SendMessageTimeout([IntPtr]0xffff,0x001d,[UIntPtr]::Zero,[IntPtr]::Zero,2,5000,[ref]$result) | Out-Null;",
  ].join(" ");
  const encodedCommand = encodePowerShellCommand(command, NodeBuffer);
  execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-WindowStyle", "Hidden", "-EncodedCommand", encodedCommand], { stdio: "ignore", windowsHide: true });
}

/** Node 8 (CEP 9 / Premiere and AE 2020) lacks mkdirSync's recursive option. */
function ensureDirectoryExists(fs: any, path: any, directory: string): void {
  if (fs.existsSync(directory)) return;
  const parent = path.dirname(directory);
  if (parent !== directory && !fs.existsSync(parent)) ensureDirectoryExists(fs, path, parent);
  try {
    fs.mkdirSync(directory);
  } catch (error) {
    if (!fs.existsSync(directory)) throw error;
  }
}

const checkIsMac = (): boolean => {
  if (typeof window !== "undefined") {
    const cepPlat = (window as any).cep_node?.process?.platform;
    if (cepPlat === "darwin") return true;
    if (cepPlat === "win32") return false;

    if (typeof navigator !== "undefined") {
      const p = navigator.platform || "";
      const ua = navigator.userAgent || "";
      if (/Mac|iPod|iPhone|iPad|Macintosh/i.test(p) || /Macintosh/i.test(ua)) return true;
      if (/Win|Windows/i.test(p) || /Windows/i.test(ua)) return false;
    }
  }
  if (typeof process !== "undefined" && process?.platform) {
    return process.platform === "darwin";
  }
  return true;
};

const isMac = checkIsMac();

/**
 * Returns font-family fallback chain so embedded fonts render authentic FML glyphs
 */
function getFontPreviewFamily(fontName: string): string {
  const embedded = [
    "FML-Revathi",
    "FML-Indulekha",
    "FML-Karthika",
    "FML-Sruthy",
    "FML-Mohini",
    "FML-Nanditha",
    "FML-Padmanabha",
    "FML-Akhila",
  ];
  for (const base of embedded) {
    if (fontName.startsWith(base)) {
      return `'${fontName}', '${base}', sans-serif`;
    }
  }
  return `'${fontName}', 'FML-Revathi', sans-serif`;
}

/**
 * Compares two semantic version strings
 */
function isNewerVersion(current: string, remote: string): boolean {
  const c = current.split(".").map((n) => parseInt(n, 10) || 0);
  const r = remote.split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(c.length, r.length); i++) {
    const ci = c[i] || 0;
    const ri = r[i] || 0;
    if (ri > ci) return true;
    if (ri < ci) return false;
  }
  return false;
}

const getNodeProcess = () => {
  if (typeof window !== "undefined" && (window as any).cep_node?.process) {
    return (window as any).cep_node.process;
  }
  if (typeof process !== "undefined") {
    return process;
  }
  return null;
};

const getChildProcess = () => {
  if (typeof window !== "undefined" && (window as any).cep_node?.require) {
    try {
      return (window as any).cep_node.require("child_process");
    } catch (e) {}
  }
  if (typeof require !== "undefined") {
    try {
      return require("child_process");
    } catch (e) {}
  }
  return null;
};

const getPlatform = () => {
  const np = getNodeProcess();
  if (np && np.platform) return np.platform;
  if (typeof navigator !== "undefined" && navigator.platform) {
    return /Mac/i.test(navigator.platform) ? "darwin" : "win32";
  }
  return "darwin";
};

/**
 * Safely opens any external URL in the system's default browser across CEP and browsers
 */
const openExternalUrl = (url: string) => {
  try {
    if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
      window.cep.util.openURLInDefaultBrowser(url);
      return;
    }
  } catch (e) {}
  try {
    if (csi && csi.openURLInDefaultBrowser) {
      csi.openURLInDefaultBrowser(url);
      return;
    }
  } catch (e) {}
  const cp = getChildProcess();
  if (cp && cp.exec) {
    try {
      const platform = getPlatform();
      const cmd = platform === "darwin" ? `open "${url}"` : `start "" "${url}"`;
      cp.exec(cmd);
      return;
    } catch (e) {}
  }
  window.open(url, "_blank");
};

const loadedFontFaces = new Set<string>();
const loadingFontPromises = new Map<string, Promise<boolean>>();

async function loadFontFaceForPreview(
  font: FontItem,
  getBuffer: (f: FontItem) => Promise<Uint8Array>
): Promise<boolean> {
  if (loadedFontFaces.has(font.name)) return true;

  if (loadingFontPromises.has(font.name)) {
    return loadingFontPromises.get(font.name)!;
  }

  const loadPromise = (async () => {
    try {
      const buffer = await getBuffer(font);
      const face = new FontFace(font.name, buffer as any);
      await face.load();
      document.fonts.add(face);
      loadedFontFaces.add(font.name);
      return true;
    } catch (err) {
      console.warn(`[FML Buddy] Preview font load error (${font.name}):`, err);
      return false;
    } finally {
      loadingFontPromises.delete(font.name);
    }
  })();

  loadingFontPromises.set(font.name, loadPromise);
  return loadPromise;
}

interface FontCardItemProps {
  font: FontItem;
  convertedPreviewFml: string;
  isInstalled: boolean;
  isDownloading: boolean;
  isInstalling: boolean;
  onDownload: (font: FontItem) => void;
  onInstall: (font: FontItem) => void;
  onCopyName: (name: string) => void;
  getFontBuffer: (font: FontItem) => Promise<Uint8Array>;
}

const FontCardItem: React.FC<FontCardItemProps> = ({
  font,
  convertedPreviewFml,
  isInstalled,
  isDownloading,
  isInstalling,
  onDownload,
  onInstall,
  onCopyName,
  getFontBuffer,
}) => {
  const [fontLoaded, setFontLoaded] = useState(() => {
    return (
      loadedFontFaces.has(font.name) ||
      (typeof document !== "undefined" &&
        document.fonts &&
        document.fonts.check(`16px "${font.name}"`))
    );
  });

  useEffect(() => {
    let active = true;
    if (!fontLoaded) {
      loadFontFaceForPreview(font, getFontBuffer).then((ok) => {
        if (active && ok) setFontLoaded(true);
      });
    }
    return () => {
      active = false;
    };
  }, [font.name, fontLoaded, getFontBuffer]);

  return (
    <div className="font-card">
      <div className="font-card-top">
        <div className="font-meta">
          <span className="font-name">{font.name}</span>
          <span className="font-style-tag">{font.category}</span>
        </div>
        <div className="font-card-actions">
          <button
            type="button"
            className="btn-font-action btn-download"
            onClick={() => onDownload(font)}
            disabled={isDownloading}
            title={`Download ${font.name} to ~/Downloads`}
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>{isDownloading ? "Downloading..." : "Download"}</span>
          </button>

          <button
            type="button"
            className={`btn-font-action btn-install ${
              isInstalled ? "is-installed" : ""
            }`}
            onClick={() => onInstall(font)}
            disabled={isInstalling}
            title={
              isInstalled
                ? "Installed in OS Font Library"
                : `Install ${font.name} directly into OS Font Library`
            }
          >
            {isInstalled ? (
              <>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Installed</span>
              </>
            ) : (
              <>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2v13M5 11l7 7 7-7M2 19h20"></path>
                </svg>
                <span>{isInstalling ? "Installing..." : "Install"}</span>
              </>
            )}
          </button>

          <button
            type="button"
            className="btn-font-action btn-copy"
            onClick={() => onCopyName(font.name)}
            title="Copy font name for Premiere / AE"
          >
            <svg
              width="11"
              height="11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>Copy Name</span>
          </button>
        </div>
      </div>
      <div
        className="font-preview-render"
        style={{
          fontFamily: `"${font.name}", "FML-Revathi", sans-serif`,
          opacity: fontLoaded ? 1 : 0.85,
        }}
        title={`Preview rendered in authentic ${font.name}`}
      >
        {convertedPreviewFml}
      </div>
    </div>
  );
};

const DEFAULT_SAMPLE_TEXT = "കേരളത്തിലെ ഗ്രാമ പഞ്ചായത്ത് ഭരണത്തിൽ ഡിജിറ്റൽ ഉപകരണങ്ങളുടെ പ്രാധാന്യം വർധിക്കുന്നു.";

export const App: React.FC = () => {
  // Main editor state
  const [inputText, setInputText] = useState(DEFAULT_SAMPLE_TEXT);
  const [inputMode, setInputMode] = useState<"unicode" | "manglish">("unicode");
  const [targetEncoding, setTargetEncoding] = useState<TargetEncoding>("fml");
  const [isEncodingDropdownOpen, setIsEncodingDropdownOpen] = useState(false);
  const encodingDropdownRef = useRef<HTMLDivElement>(null);
  const [showFontLibrary, setShowFontLibrary] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [fontSearch, setFontSearch] = useState("");
  const [previewText, setPreviewText] = useState("അമർഷഫാൻ എം");
  const [copiedRecently, setCopiedRecently] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastType, setToastType] = useState<"success" | "info" | "error">("success");
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [contextTarget, setContextTarget] = useState<"input" | "output" | "general">("general");
  const [isMac, setIsMac] = useState<boolean>(() => checkIsMac());
  const [shortcutPlatformTab, setShortcutPlatformTab] = useState<"mac" | "windows">(() =>
    checkIsMac() ? "mac" : "windows"
  );

  useEffect(() => {
    const mac = checkIsMac();
    setIsMac(mac);
    setShortcutPlatformTab(mac ? "mac" : "windows");
  }, []);

  // Font Library state
  const [downloadingFont, setDownloadingFont] = useState<string | null>(null);
  const [installingFont, setInstallingFont] = useState<string | null>(null);
  const [installedFonts, setInstalledFonts] = useState<Set<string>>(new Set());
  const [bulkProgress, setBulkProgress] = useState<{
    active: boolean;
    type: "install" | "download";
    current: number;
    total: number;
    currentFontName: string;
    isComplete: boolean;
    error?: string | null;
  } | null>(null);
  const bulkCancelRef = useRef(false);

  // GitHub Version Control & Update state
  const [updateStatus, setUpdateStatus] = useState<"idle" | "checking" | "latest" | "available" | "error">("idle");
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [updateDownloadUrl, setUpdateDownloadUrl] = useState<string | null>(null);
  const [isDownloadingUpdate, setIsDownloadingUpdate] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);

  // Manglish IME State
  const [imeWordToken, setImeWordToken] = useState<ActiveWordToken | null>(null);
  const [imeCandidates, setImeCandidates] = useState<string[]>([]);
  const [imeSelectedIndex, setImeSelectedIndex] = useState(0);
  const [imePosition, setImePosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const [imeVisible, setImeVisible] = useState(false);

  // DOM Refs
  const inputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const outputTextareaRef = useRef<HTMLTextAreaElement>(null);
  const toastTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const imeReqIdRef = useRef<number>(0);

  // Output text conversion
  const outputText = processConversion(inputText, inputMode, targetEncoding).outputText;

  // Filtered fonts for Font Library
  const filteredFonts = useMemo(() => {
    const q = fontSearch.trim().toLowerCase();
    if (!q) return FML_FONTS;
    return FML_FONTS.filter(
      (f) => f.name.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
  }, [fontSearch]);

  // Converted preview text for Font Library cards (defaults to "അമർഷഫാൻ എം")
  const convertedPreviewFml = useMemo(() => {
    const text = previewText.trim() || "അമർഷഫാൻ എം";
    return unicodeToFml(text);
  }, [previewText]);

  // Bulk fonts stats
  const installedFontsCount = useMemo(() => {
    return FML_FONTS.filter((f) => installedFonts.has(f.fileName.toLowerCase())).length;
  }, [installedFonts]);

  const allFontsInstalled = useMemo(() => {
    return FML_FONTS.length > 0 && installedFontsCount >= FML_FONTS.length;
  }, [installedFontsCount]);

  // Load saved preferences & detect installed fonts
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("fml_buddy_mode");
      if (savedMode === "unicode" || savedMode === "manglish") setInputMode(savedMode);

      const savedEncoding = localStorage.getItem("fml_buddy_encoding");
      if (savedEncoding === "fml" || savedEncoding === "roman") {
        setTargetEncoding(savedEncoding);
      }
    } catch (e) {}

    // Check system fonts on panel launch (macOS & Windows)
    if (window.cep_node && window.cep_node.require) {
      try {
        const fs = window.cep_node.require("fs");
        const path = window.cep_node.require("path");
        const os = window.cep_node.require("os");
        const detected = new Set<string>();

        const platform = getPlatform();
        const nodeProcess = getNodeProcess();

        if (platform === "darwin") {
          const userDir = path.join(os.homedir(), "Library", "Fonts");
          if (fs.existsSync(userDir)) {
            fs.readdirSync(userDir).forEach((file: string) => detected.add(file.toLowerCase()));
          }
          if (fs.existsSync("/Library/Fonts")) {
            fs.readdirSync("/Library/Fonts").forEach((file: string) => detected.add(file.toLowerCase()));
          }
        } else if (platform === "win32") {
          const localAppData = nodeProcess?.env?.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
          const userDir = path.join(localAppData, "Microsoft", "Windows", "Fonts");
          if (fs.existsSync(userDir)) {
            fs.readdirSync(userDir).forEach((file: string) => detected.add(file.toLowerCase()));
          }
          const winDir = nodeProcess?.env?.WINDIR || "C:\\Windows";
          const sysDir = path.join(winDir, "Fonts");
          if (fs.existsSync(sysDir)) {
            fs.readdirSync(sysDir).forEach((file: string) => detected.add(file.toLowerCase()));
          }
        }
        setInstalledFonts(detected);
      } catch (e) {}
    }
  }, []);

  // Toast feedback
  const showToast = useCallback((msg: string, type: "success" | "info" | "error" = "success") => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToastMessage(msg);
    setToastType(type);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
    }, type === "error" ? 3800 : 2400);
  }, []);

  // Clipboard copy (Supports macOS pbcopy, Windows PowerShell/clip, and navigator.clipboard)
  const copyToClipboard = useCallback(
    async (text: string, isSilent: boolean = false) => {
      if (!text) return;
      let success = false;

      // 1. Try Node child_process (synchronous & reliable in Adobe CEP)
      const cp = getChildProcess();
      const nodeProcess = getNodeProcess();
      const platform = getPlatform();

      if (cp && cp.execSync) {
        if (platform === "darwin") {
          try {
            cp.execSync("pbcopy", {
              input: text,
              env: { ...(nodeProcess?.env || {}), LANG: "en_US.UTF-8", LC_CTYPE: "en_US.UTF-8" },
            });
            success = true;
          } catch (e) {}
        } else if (platform === "win32") {
          try {
            const NodeBuffer = window.cep_node.require("buffer").Buffer;
            const encodedText = NodeBuffer.from(text, "utf8").toString("base64");
            const command = `$value=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedText}')); Set-Clipboard -Value $value`;
            const encodedCommand = encodePowerShellCommand(command, NodeBuffer);
            cp.execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-STA", "-WindowStyle", "Hidden", "-EncodedCommand", encodedCommand], { stdio: "ignore", windowsHide: true });
            success = true;
          } catch (e) {
            try {
              cp.execFileSync("clip.exe", [], { input: text, windowsHide: true });
              success = true;
            } catch (e2) {}
          }
        }
      }

      // 2. Try navigator.clipboard.writeText fallback
      if (!success && navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(text);
          success = true;
        } catch (e) {}
      }

      // 3. Fallback to invisible textarea select + execCommand("copy")
      if (!success) {
        try {
          const tempTextArea = document.createElement("textarea");
          tempTextArea.value = text;
          tempTextArea.style.position = "fixed";
          tempTextArea.style.left = "-9999px";
          tempTextArea.style.top = "-9999px";
          document.body.appendChild(tempTextArea);
          tempTextArea.focus();
          tempTextArea.select();
          success = document.execCommand("copy");
          document.body.removeChild(tempTextArea);
        } catch (e) {}
      }

      if (success) {
        if (!isSilent) {
          setCopiedRecently(true);
          setTimeout(() => setCopiedRecently(false), 1400);
          showToast("Copied to Clipboard!", "success");
        }
      } else {
        if (!isSilent) showToast("Failed to copy", "error");
      }
    },
    [showToast]
  );

  // Clipboard paste (Supports Node child_process, macOS pbpaste, Windows PowerShell Get-Clipboard, and navigator.clipboard)
  const pasteFromClipboard = useCallback(async () => {
    let pastedText = "";
    const cp = getChildProcess();
    const nodeProcess = getNodeProcess();
    const platform = getPlatform();

    // 1. Try Node child_process (100% reliable in CEP without browser permission dialogs)
    if (cp && cp.execSync) {
      if (platform === "darwin") {
        try {
          pastedText = cp.execSync("pbpaste", {
            encoding: "utf8",
            env: { ...(nodeProcess?.env || {}), LANG: "en_US.UTF-8", LC_CTYPE: "en_US.UTF-8" },
          });
        } catch (e) {}
      } else if (platform === "win32") {
        try {
          pastedText = cp.execSync(
            'powershell -NoProfile -Command "[Console]::Out.Write((Get-Clipboard -Raw))"',
            { encoding: "utf8" }
          );
        } catch (e) {
          try {
            pastedText = cp.execSync('powershell -NoProfile -Command "Get-Clipboard"', {
              encoding: "utf8",
            });
          } catch (e2) {}
        }
      }
    }

    // 2. Try navigator.clipboard.readText() fallback
    if (!pastedText && navigator.clipboard && navigator.clipboard.readText) {
      try {
        pastedText = await navigator.clipboard.readText();
      } catch (e) {}
    }

    // 3. Document execCommand fallback if focused in textarea
    if (!pastedText && inputTextareaRef.current) {
      inputTextareaRef.current.focus();
      try {
        const success = document.execCommand("paste");
        if (success) {
          showToast("Pasted from Clipboard!", "success");
          return;
        }
      } catch (e) {}
    }

    if (pastedText) {
      pastedText = pastedText.replace(/\r\n/g, "\n");
      const active = document.activeElement;

      // If user is focused in a secondary text input (e.g. font search)
      if (active instanceof HTMLInputElement) {
        const start = active.selectionStart ?? active.value.length;
        const end = active.selectionEnd ?? active.value.length;
        const before = active.value.substring(0, start);
        const after = active.value.substring(end);
        const nextVal = before + pastedText + after;
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value"
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(active, nextVal);
        } else {
          active.value = nextVal;
        }
        active.dispatchEvent(new Event("input", { bubbles: true }));
        const newPos = start + pastedText.length;
        active.setSelectionRange(newPos, newPos);
        showToast("Pasted from Clipboard!", "success");
        return;
      }

      // Default: paste into main inputTextarea
      const textarea = inputTextareaRef.current;
      if (textarea) {
        textarea.focus();
        const start = textarea.selectionStart ?? inputText.length;
        const end = textarea.selectionEnd ?? inputText.length;
        const before = inputText.substring(0, start);
        const after = inputText.substring(end);
        const nextVal = before + pastedText + after;
        setInputText(nextVal);

        setTimeout(() => {
          if (inputTextareaRef.current) {
            const newCursor = start + pastedText.length;
            inputTextareaRef.current.setSelectionRange(newCursor, newCursor);
          }
        }, 0);
        showToast("Pasted from Clipboard!", "success");
      } else {
        setInputText(pastedText);
        showToast("Pasted from Clipboard!", "success");
      }
    } else {
      showToast("Clipboard is empty", "info");
    }
  }, [inputText, inputMode, showToast]);

  // Context Menu Copy: copies selected text from active field, or fallback to outputText/inputText
  const handleContextCopy = useCallback(() => {
    let selectedText = "";

    const activeEl = document.activeElement;
    if (activeEl === inputTextareaRef.current && inputTextareaRef.current) {
      const s = inputTextareaRef.current.selectionStart;
      const e = inputTextareaRef.current.selectionEnd;
      if (s !== null && e !== null && s !== e) {
        selectedText = inputTextareaRef.current.value.substring(s, e);
      }
    } else if (activeEl === outputTextareaRef.current && outputTextareaRef.current) {
      const s = outputTextareaRef.current.selectionStart;
      const e = outputTextareaRef.current.selectionEnd;
      if (s !== null && e !== null && s !== e) {
        selectedText = outputTextareaRef.current.value.substring(s, e);
      }
    }

    if (!selectedText) {
      selectedText = window.getSelection()?.toString() || "";
    }

    if (!selectedText) {
      if (contextTarget === "input" && inputText) {
        selectedText = inputText;
      } else if (outputText) {
        selectedText = outputText;
      } else if (inputText) {
        selectedText = inputText;
      }
    }

    if (selectedText) {
      copyToClipboard(selectedText);
    } else {
      showToast("Nothing to copy", "info");
    }
  }, [inputText, outputText, contextTarget, copyToClipboard, showToast]);

  // Subscribe to Adobe Background Theme
  useEffect(() => {
    if (window.cep) {
      subscribeBackgroundColor((color: string) => {
        document.documentElement.style.setProperty("--adobe-bg-color", color);
      });
    }
  }, []);

  // Close modals & custom dropdown on outside click or Escape
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      setContextMenu(null);
      if (
        encodingDropdownRef.current &&
        !encodingDropdownRef.current.contains(e.target as Node)
      ) {
        setIsEncodingDropdownOpen(false);
      }
    };
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
        setImeVisible(false);
        setShowFontLibrary(false);
        setShowDevModal(false);
        setIsEncodingDropdownOpen(false);
      }
    };
    window.addEventListener("click", handleGlobalClick);
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("click", handleGlobalClick);
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, []);

  // Reset editor text
  const handleReset = useCallback(() => {
    setInputText("");
    setImeVisible(false);
    setImeWordToken(null);
    setImeCandidates([]);
    if (inputTextareaRef.current) {
      inputTextareaRef.current.focus();
    }
    showToast("Editor Reset", "info");
  }, [showToast]);

  // Ensure host application (Premiere Pro / After Effects) intercepts all keys for the panel
  useEffect(() => {
    const registerKeys = () => {
      try {
        keyRegisterOverride();
      } catch (e) {}
    };
    registerKeys();
    window.addEventListener("focus", registerKeys);
    window.addEventListener("mousedown", registerKeys);
    return () => {
      window.removeEventListener("focus", registerKeys);
      window.removeEventListener("mousedown", registerKeys);
    };
  }, []);

  // Check GitHub for updates silently in the background on startup
  useEffect(() => {
    const timer = setTimeout(() => {
      checkForUpdates(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, []);

  // Global Keyboard Shortcuts: Copy (⌘C / Ctrl+C), Paste (⌘V / Ctrl+V), Copy to Clipboard (⌘↵ / Ctrl+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const keyLower = e.key?.toLowerCase();

      // ⌘+Enter / Ctrl+Enter: Copy to Clipboard (Converted Output)
      if (
        isCmdOrCtrl &&
        (e.key === "Enter" || e.code === "Enter" || e.code === "NumpadEnter" || e.keyCode === 13)
      ) {
        e.preventDefault();
        if (outputText && outputText.trim()) {
          copyToClipboard(outputText);
        } else {
          showToast("Nothing to copy yet", "info");
        }
      }
      // ⌘+C / Ctrl+C: Copy Shortcut
      else if (
        isCmdOrCtrl &&
        !e.shiftKey &&
        !e.altKey &&
        (keyLower === "c" || e.code === "KeyC" || e.keyCode === 67)
      ) {
        const active = document.activeElement;
        if (active === inputTextareaRef.current && inputTextareaRef.current) {
          const s = inputTextareaRef.current.selectionStart;
          const end = inputTextareaRef.current.selectionEnd;
          if (s !== null && end !== null && s !== end) {
            e.preventDefault();
            const selected = inputTextareaRef.current.value.substring(s, end);
            copyToClipboard(selected, false);
          } else if (inputText) {
            e.preventDefault();
            copyToClipboard(inputText, false);
          }
        } else if (active === outputTextareaRef.current && outputTextareaRef.current) {
          const s = outputTextareaRef.current.selectionStart;
          const end = outputTextareaRef.current.selectionEnd;
          if (s !== null && end !== null && s !== end) {
            e.preventDefault();
            const selected = outputTextareaRef.current.value.substring(s, end);
            copyToClipboard(selected, false);
          } else if (outputText) {
            e.preventDefault();
            copyToClipboard(outputText, false);
          }
        } else if (active instanceof HTMLInputElement) {
          const s = active.selectionStart;
          const end = active.selectionEnd;
          if (s !== null && end !== null && s !== end) {
            e.preventDefault();
            const selected = active.value.substring(s, end);
            copyToClipboard(selected, false);
          } else if (active.value) {
            e.preventDefault();
            copyToClipboard(active.value, false);
          }
        } else {
          const sel = window.getSelection()?.toString();
          if (sel) {
            e.preventDefault();
            copyToClipboard(sel, false);
          } else if (outputText) {
            e.preventDefault();
            copyToClipboard(outputText, false);
          } else if (inputText) {
            e.preventDefault();
            copyToClipboard(inputText, false);
          }
        }
      }
      // ⌘+V / Ctrl+V: Paste Shortcut
      else if (
        isCmdOrCtrl &&
        !e.shiftKey &&
        !e.altKey &&
        (keyLower === "v" || e.code === "KeyV" || e.keyCode === 86)
      ) {
        e.preventDefault();
        pasteFromClipboard();
      }
      // ⌘+X / Ctrl+X: Cut Shortcut
      else if (
        isCmdOrCtrl &&
        !e.shiftKey &&
        !e.altKey &&
        (keyLower === "x" || e.code === "KeyX" || e.keyCode === 88)
      ) {
        const active = document.activeElement;
        if (active === inputTextareaRef.current && inputTextareaRef.current) {
          const s = inputTextareaRef.current.selectionStart;
          const end = inputTextareaRef.current.selectionEnd;
          if (s !== null && end !== null && s !== end) {
            e.preventDefault();
            const selected = inputText.substring(s, end);
            copyToClipboard(selected, true);
            const before = inputText.substring(0, s);
            const after = inputText.substring(end);
            setInputText(before + after);
            showToast("Cut to Clipboard", "success");
            setTimeout(() => {
              if (inputTextareaRef.current) {
                inputTextareaRef.current.focus();
                inputTextareaRef.current.setSelectionRange(s, s);
              }
            }, 0);
          }
        } else if (active instanceof HTMLInputElement) {
          const s = active.selectionStart;
          const end = active.selectionEnd;
          if (s !== null && end !== null && s !== end) {
            e.preventDefault();
            const selected = active.value.substring(s, end);
            copyToClipboard(selected, true);
            const before = active.value.substring(0, s);
            const after = active.value.substring(end);
            const nextVal = before + after;
            const nativeSetter = Object.getOwnPropertyDescriptor(
              window.HTMLInputElement.prototype,
              "value"
            )?.set;
            if (nativeSetter) {
              nativeSetter.call(active, nextVal);
            } else {
              active.value = nextVal;
            }
            active.dispatchEvent(new Event("input", { bubbles: true }));
            active.setSelectionRange(s, s);
            showToast("Cut to Clipboard", "success");
          }
        }
      }
      // ⌘+A / Ctrl+A: Select All Shortcut
      else if (
        isCmdOrCtrl &&
        !e.shiftKey &&
        !e.altKey &&
        (keyLower === "a" || e.code === "KeyA" || e.keyCode === 65)
      ) {
        const active = document.activeElement;
        if (active === inputTextareaRef.current && inputTextareaRef.current) {
          e.preventDefault();
          inputTextareaRef.current.select();
        } else if (active === outputTextareaRef.current && outputTextareaRef.current) {
          e.preventDefault();
          outputTextareaRef.current.select();
        } else if (
          active instanceof HTMLInputElement ||
          active instanceof HTMLTextAreaElement
        ) {
          e.preventDefault();
          active.select();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [outputText, inputText, copyToClipboard, pasteFromClipboard, showToast]);

  // =========================================================================
  // FONT DOWNLOAD & INSTALL ENGINE
  // Retrieves font from local bundle or downloads from GitHub remote server
  // =========================================================================
  const getFontBuffer = useCallback(async (font: FontItem): Promise<Uint8Array> => {
    // 1. Check local extension folder and OS font paths if running inside Adobe CEP
    if (window.cep_node && window.cep_node.require) {
      try {
        const fs = window.cep_node.require("fs");
        const path = window.cep_node.require("path");
        const os = window.cep_node.require("os");
        const extDir = csi && csi.getSystemPath ? csi.getSystemPath("extension") : "";
        const platform = getPlatform();
        const nodeProcess = getNodeProcess();

        const candidatePaths = [
          path.join(extDir, "Assets", "FML_Fonts", font.fileName),
          path.join(extDir, "..", "Assets", "FML_Fonts", font.fileName),
          path.join(extDir, "assets", "FML_Fonts", font.fileName),
          path.join(extDir, "assets", font.fileName),
          platform === "darwin"
            ? path.join(os.homedir(), "Library", "Fonts", font.fileName)
            : path.join(
                nodeProcess?.env?.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
                "Microsoft",
                "Windows",
                "Fonts",
                font.fileName
              ),
          platform === "darwin"
            ? path.join("/Library/Fonts", font.fileName)
            : path.join(nodeProcess?.env?.WINDIR || "C:\\Windows", "Fonts", font.fileName),
        ];

        for (const p of candidatePaths) {
          if (p && fs.existsSync(p)) {
            const buf = fs.readFileSync(p);
            return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
          }
        }
      } catch (e) {}
    }

    // 2. Fetch from local Vite dev server / extension host
    try {
      const localRes = await fetch(`/fonts/${encodeURIComponent(font.fileName)}`);
      if (localRes.ok) {
        const buf = await localRes.arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch (e) {}

    // 3. Fetch from primary GitHub CDN
    try {
      const remoteUrl = `${GITHUB_FONTS_BASE_URL}/${encodeURIComponent(font.fileName)}`;
      const res = await fetch(remoteUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch (e) {}

    // 4. Fetch from secondary GitHub fallback CDN
    try {
      const fallbackUrl = `https://raw.githubusercontent.com/amarshafan/fml-fonts/main/${encodeURIComponent(font.fileName)}`;
      const res2 = await fetch(fallbackUrl);
      if (res2.ok) {
        const buf = await res2.arrayBuffer();
        return new Uint8Array(buf);
      }
    } catch (e) {}

    throw new Error(`Font file not found on system or server (${font.fileName})`);
  }, []);

  const handleDownloadFont = async (font: FontItem) => {
    try {
      setDownloadingFont(font.name);
      showToast(`Downloading ${font.name}...`, "info");
      const buffer = await getFontBuffer(font);

      if (window.cep_node && window.cep_node.require) {
        const fs = window.cep_node.require("fs");
        const path = window.cep_node.require("path");
        const os = window.cep_node.require("os");
        const dlFolder =
          process.platform === "win32"
            ? (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Downloads") : path.join(os.homedir(), "Downloads"))
            : path.join(os.homedir(), "Downloads");
        ensureDirectoryExists(fs, path, dlFolder);
        const dest = path.join(dlFolder, font.fileName);
        fs.writeFileSync(dest, Buffer.from(buffer));
        showToast(`✓ Saved ${font.fileName} to Downloads folder`, "success");
        return;
      }

      // Pure browser fallback
      const blob = new Blob([buffer as any], { type: "font/otf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = font.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`✓ Downloaded ${font.fileName}`, "success");
    } catch (err: any) {
      showToast(`Download failed: ${err.message || String(err)}`, "error");
    } finally {
      setDownloadingFont(null);
    }
  };

  const handleInstallFont = async (font: FontItem) => {
    try {
      setInstallingFont(font.name);
      showToast(`Installing ${font.name}...`, "info");
      const buffer = await getFontBuffer(font);

      if (window.cep_node && window.cep_node.require) {
        const fs = window.cep_node.require("fs");
        const path = window.cep_node.require("path");
        const os = window.cep_node.require("os");

        if (process.platform === "darwin") {
          const fontDir = path.join(os.homedir(), "Library", "Fonts");
          ensureDirectoryExists(fs, path, fontDir);
          const dest = path.join(fontDir, font.fileName);
          fs.writeFileSync(dest, Buffer.from(buffer));
          try {
            const { execSync } = window.cep_node.require("child_process");
            execSync(`touch "${fontDir}"`);
          } catch (e) {}
          setInstalledFonts((prev) => new Set(prev).add(font.fileName.toLowerCase()));
          showToast(`✓ ${font.name} installed in macOS Fonts!`, "success");
          return;
        } else if (process.platform === "win32") {
          const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
          const fontDir = path.join(localAppData, "Microsoft", "Windows", "Fonts");
          ensureDirectoryExists(fs, path, fontDir);
          const dest = path.join(fontDir, font.fileName);
          fs.writeFileSync(dest, Buffer.from(buffer));
          const { execFileSync } = window.cep_node.require("child_process");
          const NodeBuffer = window.cep_node.require("buffer").Buffer;
          const fontTypeTag = font.fileName.toLowerCase().endsWith(".otf") ? "OpenType" : "TrueType";
          execFileSync("reg.exe", [
            "add", "HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts",
            "/v", `${font.name} (${fontTypeTag})`, "/t", "REG_SZ", "/d", dest, "/f",
          ], { stdio: "ignore", windowsHide: true });
          try {
            refreshWindowsFontCache(execFileSync, NodeBuffer, [dest]);
          } catch (refreshError) {
            console.warn("[FML Buddy] Windows registered the font, but could not notify running apps:", refreshError);
          }

          setInstalledFonts((prev) => new Set(prev).add(font.fileName.toLowerCase()));
          showToast(`✓ ${font.name} installed for your Windows account. Restart Adobe apps if it is not listed.`, "success");
          return;
        }
      }

      await handleDownloadFont(font);
      showToast(`Font downloaded. Double click to install on your computer.`, "info");
    } catch (err: any) {
      showToast(`Install failed: ${err.message || String(err)}`, "error");
    } finally {
      setInstallingFont(null);
    }
  };

  // =========================================================================
  // BULK FONT DOWNLOAD & INSTALL ENGINE (WITH PRELOADER PROGRESS)
  // =========================================================================
  const handleInstallAllFonts = async () => {
    if (bulkProgress?.active) return;
    bulkCancelRef.current = false;
    const total = FML_FONTS.length;

    setBulkProgress({
      active: true,
      type: "install",
      current: 0,
      total,
      currentFontName: "Initializing font installer...",
      isComplete: false,
      error: null,
    });

    const newlyInstalled = new Set(installedFonts);
    const pendingWindowsFonts = new Set<string>();
    let failedInstallCount = 0;

    try {
      if (window.cep_node && window.cep_node.require) {
        const fs = window.cep_node.require("fs");
        const path = window.cep_node.require("path");
        const os = window.cep_node.require("os");

        if (process.platform === "darwin") {
          const fontDir = path.join(os.homedir(), "Library", "Fonts");
          ensureDirectoryExists(fs, path, fontDir);

          for (let i = 0; i < total; i++) {
            if (bulkCancelRef.current) break;
            const font = FML_FONTS[i];

            setBulkProgress({
              active: true,
              type: "install",
              current: i + 1,
              total,
              currentFontName: font.name,
              isComplete: false,
            });

            try {
              const buffer = await getFontBuffer(font);
              const dest = path.join(fontDir, font.fileName);
              fs.writeFileSync(dest, Buffer.from(buffer));
              newlyInstalled.add(font.fileName.toLowerCase());
            } catch (err) {
              failedInstallCount++;
              console.warn(`[FML Buddy] Bulk install failed for ${font.fileName}:`, err);
            }

            await new Promise((r) => setTimeout(r, 6));
          }

          try {
            const { execSync } = window.cep_node.require("child_process");
            execSync(`touch "${fontDir}"`);
          } catch (e) {}

        } else if (process.platform === "win32") {
          const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
          const fontDir = path.join(localAppData, "Microsoft", "Windows", "Fonts");
          ensureDirectoryExists(fs, path, fontDir);

          const regLines = [
            "Windows Registry Editor Version 5.00",
            "",
            "[HKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\Fonts]",
          ];

          for (let i = 0; i < total; i++) {
            if (bulkCancelRef.current) break;
            const font = FML_FONTS[i];

            setBulkProgress({
              active: true,
              type: "install",
              current: i + 1,
              total,
              currentFontName: font.name,
              isComplete: false,
            });

            try {
              const buffer = await getFontBuffer(font);
              const dest = path.join(fontDir, font.fileName);
              fs.writeFileSync(dest, Buffer.from(buffer));
              pendingWindowsFonts.add(font.fileName.toLowerCase());

              const fontTypeTag = font.fileName.toLowerCase().endsWith(".otf") ? "OpenType" : "TrueType";
              const escapedPath = dest.replace(/\\/g, "\\\\");
              regLines.push(`"${font.name} (${fontTypeTag})"="${escapedPath}"`);
            } catch (err) {
              failedInstallCount++;
              console.warn(`[FML Buddy] Bulk install failed for ${font.fileName}:`, err);
            }

            await new Promise((r) => setTimeout(r, 6));
          }

          try {
            const tempRegPath = path.join(os.tmpdir(), "fml_fonts_install.reg");
            // Windows .reg files must be UTF-16LE for reliable import across locales.
            fs.writeFileSync(tempRegPath, Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(regLines.join("\r\n"), "utf16le")]));
            const { execFileSync } = window.cep_node.require("child_process");
            execFileSync("reg.exe", ["import", tempRegPath], { stdio: "ignore", windowsHide: true });
            pendingWindowsFonts.forEach((fileName) => newlyInstalled.add(fileName));
            try { fs.unlinkSync(tempRegPath); } catch (e) {}

            const NodeBuffer = window.cep_node.require("buffer").Buffer;
            try {
              const installedPaths = Array.from(pendingWindowsFonts, (fileName) => path.join(fontDir, FML_FONTS.find((font) => font.fileName.toLowerCase() === fileName)?.fileName || fileName));
              refreshWindowsFontCache(execFileSync, NodeBuffer, installedPaths);
            } catch (refreshError) {
              console.warn("[FML Buddy] Could not notify running apps about newly installed fonts:", refreshError);
            }
          } catch (e) {
            failedInstallCount += pendingWindowsFonts.size;
            pendingWindowsFonts.clear();
            console.warn("[FML Buddy] Windows registry batch error:", e);
          }
        }

        setInstalledFonts(newlyInstalled);

        if (bulkCancelRef.current) {
          showToast("Installation cancelled", "info");
          setBulkProgress(null);
        } else {
          setBulkProgress({
            active: true,
            type: "install",
            current: total,
            total,
            currentFontName: "All fonts installed",
            isComplete: true,
          });
          if (failedInstallCount > 0) {
            const installedCount = newlyInstalled.size;
            setBulkProgress((prev) => prev ? { ...prev, currentFontName: `${installedCount} installed · ${failedInstallCount} failed` } : null);
            showToast(`${installedCount} fonts installed; ${failedInstallCount} failed.`, "error");
          } else {
          showToast(`✓ All ${total} fonts installed successfully! Restart Premiere or After Effects if a font does not appear.`, "success");
          }
        }
      } else {
        throw new Error("Bulk installation requires Adobe Creative Cloud environment.");
      }
    } catch (err: any) {
      setBulkProgress((prev) => prev ? { ...prev, error: err.message || String(err) } : null);
      showToast(`Install failed: ${err.message || String(err)}`, "error");
    }
  };

  const handleDownloadAllFonts = async () => {
    if (bulkProgress?.active) return;
    bulkCancelRef.current = false;
    const total = FML_FONTS.length;

    setBulkProgress({
      active: true,
      type: "download",
      current: 0,
      total,
      currentFontName: "Preparing download directory...",
      isComplete: false,
      error: null,
    });

    try {
      if (window.cep_node && window.cep_node.require) {
        const fs = window.cep_node.require("fs");
        const path = window.cep_node.require("path");
        const os = window.cep_node.require("os");

        const baseDl =
          process.platform === "win32"
            ? (process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Downloads") : path.join(os.homedir(), "Downloads"))
            : path.join(os.homedir(), "Downloads");
        const dlFolder = path.join(baseDl, "FML_Fonts");
        ensureDirectoryExists(fs, path, dlFolder);

        for (let i = 0; i < total; i++) {
          if (bulkCancelRef.current) break;
          const font = FML_FONTS[i];

          setBulkProgress({
            active: true,
            type: "download",
            current: i + 1,
            total,
            currentFontName: font.name,
            isComplete: false,
          });

          try {
            const buffer = await getFontBuffer(font);
            const dest = path.join(dlFolder, font.fileName);
            fs.writeFileSync(dest, Buffer.from(buffer));
          } catch (err) {
            console.warn(`[FML Buddy] Download error for ${font.fileName}:`, err);
          }

          await new Promise((r) => setTimeout(r, 6));
        }

        if (bulkCancelRef.current) {
          showToast("Download cancelled", "info");
          setBulkProgress(null);
        } else {
          setBulkProgress({
            active: true,
            type: "download",
            current: total,
            total,
            currentFontName: "Download complete",
            isComplete: true,
          });
          showToast(`✓ All ${total} fonts saved to Downloads/FML_Fonts`, "success");
          try {
            const { exec } = window.cep_node.require("child_process");
            const cmd = process.platform === "darwin" ? `open "${dlFolder}"` : `explorer.exe "${dlFolder}"`;
            exec(cmd);
          } catch (e) {}
        }
      } else {
        throw new Error("Bulk download requires Adobe Creative Cloud environment.");
      }
    } catch (err: any) {
      setBulkProgress((prev) => prev ? { ...prev, error: err.message || String(err) } : null);
      showToast(`Download failed: ${err.message || String(err)}`, "error");
    }
  };

  // =========================================================================
  // GITHUB VERSION CONTROL & AUTO-UPDATE ENGINE
  // =========================================================================
  const checkForUpdates = async (isManual = false) => {
    setUpdateStatus("checking");
    setUpdateError(null);
    if (isManual) showToast("Checking GitHub for updates...", "info");

    try {
      const res = await fetch("https://api.github.com/repos/amarshafan-m/FML-Buddy/releases/latest", {
        headers: { Accept: "application/vnd.github.v3+json" },
      });

      if (res.ok) {
        const data = await res.json();
        const latestTag = (data.tag_name || data.name || "").replace(/^v/, "").trim();
        let downloadUrl = data.html_url;
        if (Array.isArray(data.assets) && data.assets.length > 0) {
          const zxpAsset = data.assets.find((a: any) => a.name.endsWith(".zxp") || a.name.endsWith(".zip"));
          if (zxpAsset) downloadUrl = zxpAsset.browser_download_url;
        }

        setLatestVersion(latestTag);
        setUpdateDownloadUrl(downloadUrl);
        setUpdateError(null);

        if (latestTag && isNewerVersion(CURRENT_VERSION, latestTag)) {
          setUpdateStatus("available");
          showToast(`Update available: v${latestTag}!`, "info");
        } else {
          setUpdateStatus("latest");
          if (isManual) showToast(`FML Buddy is up to date (v${CURRENT_VERSION})`, "success");
        }
      } else {
        // Detailed HTTP error status
        let httpErrorMsg = `GitHub API HTTP ${res.status}`;
        if (res.status === 403) {
          httpErrorMsg = "GitHub API rate limit exceeded. Please try again shortly.";
        } else if (res.status === 404) {
          httpErrorMsg = "No GitHub releases found for FML-Buddy.";
        } else if (res.status >= 500) {
          httpErrorMsg = `GitHub server error (${res.status}).`;
        }

        // Try raw package.json as fallback
        let fallbackSucceeded = false;
        try {
          const rawPkg = await fetch("https://raw.githubusercontent.com/amarshafan-m/FML-Buddy/main/package.json");
          if (rawPkg.ok) {
            const pkg = await rawPkg.json();
            const ver = pkg.version;
            setLatestVersion(ver);
            setUpdateDownloadUrl("https://github.com/amarshafan-m/FML-Buddy/releases");
            setUpdateError(null);
            fallbackSucceeded = true;
            if (ver && isNewerVersion(CURRENT_VERSION, ver)) {
              setUpdateStatus("available");
              showToast(`Update available: v${ver}!`, "info");
            } else {
              setUpdateStatus("latest");
              if (isManual) showToast(`FML Buddy is up to date (v${CURRENT_VERSION})`, "success");
            }
          }
        } catch {
          // Fallback also failed
        }

        if (!fallbackSucceeded) {
          setUpdateStatus("error");
          setUpdateError(httpErrorMsg);
          if (isManual) showToast(`Update check error: ${httpErrorMsg}`, "error");
        }
      }
    } catch (err: any) {
      const errMsg = (typeof navigator !== "undefined" && !navigator.onLine)
        ? "Network offline: No internet connection detected"
        : (err?.message || "Failed to connect to GitHub");
      setUpdateStatus("error");
      setUpdateError(errMsg);
      if (isManual) showToast(`Update check error: ${errMsg}`, "error");
    }
  };

  const downloadUpdate = async () => {
    if (!updateDownloadUrl) {
      const err = "No download URL available";
      setUpdateStatus("error");
      setUpdateError(err);
      showToast(`Update failed: ${err}`, "error");
      openExternalUrl("https://github.com/amarshafan-m/FML-Buddy/releases");
      return;
    }

    // In-app direct download to Downloads folder if running in Adobe CEP (macOS & Windows)
    const isCep = Boolean(window.cep_node || (window as any).require);
    if (isCep) {
      setIsDownloadingUpdate(true);
      setDownloadProgress(0);
      showToast("Downloading FML Buddy update...", "info");

      try {
        const fs = window.cep_node?.require?.("fs") || (window as any).require?.("fs");
        const path = window.cep_node?.require?.("path") || (window as any).require?.("path");
        const os = window.cep_node?.require?.("os") || (window as any).require?.("os");
        const cp = window.cep_node?.require?.("child_process") || (window as any).require?.("child_process");
        const NodeBuffer = window.cep_node?.Buffer || (window as any).Buffer;

        if (!fs || !path || !os) throw new Error("CEP Node environment unavailable");

        const platform = getPlatform();
        const homeDir = os.homedir ? os.homedir() : "";
        const downloadsDir = homeDir ? path.join(homeDir, "Downloads") : "";
        const targetDir = (downloadsDir && fs.existsSync(downloadsDir)) ? downloadsDir : (os.tmpdir ? os.tmpdir() : "");

        const fileName = "FML Buddy.zxp";
        const destPath = path.join(targetDir, fileName);

        const https = window.cep_node?.require?.("https") || (window as any).require?.("https");
        const http = window.cep_node?.require?.("http") || (window as any).require?.("http");

        if (https && fs) {
          // Node.js HTTPS stream download: follows 302 redirects without CORS restrictions
          await new Promise<void>((resolve, reject) => {
            const fetchStream = (targetUrl: string, redirects = 0) => {
              if (redirects > 6) return reject(new Error("Too many redirects"));
              const mod = targetUrl.startsWith("http:") ? http : https;
              const req = mod.get(targetUrl, { headers: { "User-Agent": "FML-Buddy-Client" } }, (res: any) => {
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                  return fetchStream(res.headers.location, redirects + 1);
                }
                if (res.statusCode !== 200) {
                  return reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage || "Download failed"}`));
                }
                const total = parseInt(res.headers["content-length"] || "0", 10);
                let received = 0;
                const stream = fs.createWriteStream(destPath);
                res.on("data", (chunk: any) => {
                  received += chunk.length;
                  if (total > 0) {
                    setDownloadProgress(Math.min(100, Math.round((received / total) * 100)));
                  }
                });
                res.pipe(stream);
                stream.on("finish", () => {
                  stream.close();
                  resolve();
                });
                stream.on("error", (err: any) => {
                  try { fs.unlinkSync(destPath); } catch {}
                  reject(err);
                });
              });
              req.on("error", reject);
            };
            fetchStream(updateDownloadUrl);
          });
        } else {
          // Browser fetch fallback
          const response = await fetch(updateDownloadUrl);
          if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText || ""}`.trim());
          const arrayBuffer = await response.arrayBuffer();
          fs.writeFileSync(destPath, NodeBuffer.from(arrayBuffer));
        }

        setDownloadProgress(100);
        showToast(`✓ Downloaded ${fileName} to Downloads folder!`, "success");

        // Cross-platform open / reveal in Finder or Explorer
        if (cp && cp.exec) {
          setTimeout(() => {
            if (platform === "darwin") {
              // macOS: Highlight in Finder and open installer
              cp.exec(`open -R "${destPath}"`);
              cp.exec(`open "${destPath}"`);
            } else if (platform === "win32") {
              // Windows: Highlight in Explorer and launch installer
              cp.exec(`explorer.exe /select,"${destPath}"`);
              cp.exec(`cmd.exe /c start "" "${destPath}"`);
            }
          }, 400);
        }

        setIsDownloadingUpdate(false);
        return;
      } catch (err: any) {
        console.warn("[FML Buddy] Direct download failed, opening browser fallback:", err);
        const errMsg = err?.message || "Direct download failed";
        setUpdateError(errMsg);
        showToast(`Download issue (${errMsg}). Opening browser fallback...`, "error");
      } finally {
        setIsDownloadingUpdate(false);
        setDownloadProgress(null);
      }
    }

    // Universal browser fallback (works across macOS, Windows, web)
    try {
      showToast("Opening GitHub release download in browser...", "info");
      openExternalUrl(updateDownloadUrl);
    } catch (err: any) {
      const errMsg = err?.message || "Failed to open release URL";
      setUpdateStatus("error");
      setUpdateError(errMsg);
      showToast(`Update error: ${errMsg}`, "error");
    }
  };

  /**
   * Manglish IME Engine: Updates active word and positions candidate popover
   */
  const updateImeSuggestions = (text: string, cursorPos: number) => {
    if (inputMode !== "manglish") {
      setImeVisible(false);
      return;
    }

    const textarea = inputTextareaRef.current;
    if (!textarea) return;

    const token = getActiveWordAtCursor(text, cursorPos);

    if (!token || !token.word || !/[a-zA-Z]/.test(token.word)) {
      setImeVisible(false);
      setImeWordToken(null);
      return;
    }

    const localCandidates = getCandidates(token.word);
    if (localCandidates.length === 0) {
      setImeVisible(false);
      return;
    }

    setImeWordToken(token);
    setImeCandidates(localCandidates);
    setImeSelectedIndex(0);

    const coords = getCaretCoordinates(textarea, token.start);
    const left = Math.max(10, Math.min(coords.left, window.innerWidth - 180));

    let top = coords.top + coords.height + 4;
    if (top + 180 > window.innerHeight && coords.top > 190) {
      top = coords.top - 184;
    }

    setImePosition({ left, top });
    setImeVisible(true);

    const targetWord = token.word;
    imeReqIdRef.current += 1;
    const thisReqId = imeReqIdRef.current;

    fetchGoogleInputToolsCandidates(targetWord).then((googleList) => {
      if (thisReqId === imeReqIdRef.current && googleList && googleList.length > 0) {
        setImeCandidates(() => {
          const merged = [...googleList.slice(0, 5)];
          if (!merged.includes(targetWord)) {
            merged.push(targetWord);
          }
          return merged;
        });
      }
    });
  };

  const commitCandidate = (
    candidate: string,
    trailingPunctuation: string = "",
    tokenToUse?: ActiveWordToken
  ) => {
    const textarea = inputTextareaRef.current;
    const token = tokenToUse || imeWordToken;
    if (!token || !textarea) {
      setImeVisible(false);
      return;
    }

    const currentText = textarea.value;
    const before = currentText.substring(0, token.start);
    const after = currentText.substring(token.end);
    const replacement = candidate + trailingPunctuation;
    const newText = before + replacement + after;
    const newCursorPos = token.start + replacement.length;

    setInputText(newText);
    setImeVisible(false);
    setImeWordToken(null);

    setTimeout(() => {
      if (inputTextareaRef.current) {
        inputTextareaRef.current.focus();
        inputTextareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
      }
    }, 0);
  };

  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Let global Cmd / Ctrl shortcuts bubble to application (⌘1, ⌘2, ⌘Enter, ⇧⌘C, ⌘K, ⌘E, ⌘C, ⌘V, ⌘A, ⌘Z)
    if (e.metaKey || e.ctrlKey) return;

    if (inputMode !== "manglish") return;

    const textarea = inputTextareaRef.current;
    if (!textarea) return;

    let token = imeWordToken;
    let candidates = imeCandidates;
    let selectedIdx = imeSelectedIndex;

    if (!token) {
      const active = getActiveWordAtCursor(textarea.value, textarea.selectionStart);
      if (active && active.word && /[a-zA-Z]/.test(active.word)) {
        token = active;
        candidates = getCandidates(active.word);
        selectedIdx = 0;
      }
    }

    if (!token || candidates.length === 0) {
      return;
    }

    if (e.key === " ") {
      e.preventDefault();
      const chosen = candidates[selectedIdx] || candidates[0];
      commitCandidate(chosen, " ", token);
      return;
    }

    if (isCommitPunctuation(e.key)) {
      e.preventDefault();
      const punct = COMMIT_PUNCTUATION_CHARS[e.key] || e.key;
      const chosen = candidates[selectedIdx] || candidates[0];
      commitCandidate(chosen, punct, token);
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const chosen = candidates[selectedIdx] || candidates[0];
      commitCandidate(chosen, "", token);
      return;
    }

    let digit: number | null = null;
    if (!e.metaKey && !e.ctrlKey && !e.altKey) {
      if (e.key >= "1" && e.key <= "6") {
        digit = parseInt(e.key, 10);
      } else if (e.code && /^(?:Digit|Numpad)([1-6])$/.test(e.code)) {
        const match = e.code.match(/^(?:Digit|Numpad)([1-6])$/);
        if (match) digit = parseInt(match[1], 10);
      } else if (e.keyCode >= 49 && e.keyCode <= 54) {
        digit = e.keyCode - 48;
      } else if (e.keyCode >= 97 && e.keyCode <= 102) {
        digit = e.keyCode - 96;
      }
    }

    if (digit !== null && imeVisible) {
      const idx = digit - 1;
      if (idx >= 0 && idx < candidates.length) {
        e.preventDefault();
        commitCandidate(candidates[idx], " ", token);
        return;
      }
    }

    if (e.key === "ArrowDown" && imeVisible) {
      e.preventDefault();
      setImeSelectedIndex((prev) => (prev + 1) % candidates.length);
      return;
    }

    if (e.key === "ArrowUp" && imeVisible) {
      e.preventDefault();
      setImeSelectedIndex((prev) => (prev - 1 + candidates.length) % candidates.length);
      return;
    }

    if (e.key === "Escape" && imeVisible) {
      e.preventDefault();
      setImeVisible(false);
      return;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursorPos = e.target.selectionStart;
    setInputText(val);

    if (inputMode === "manglish") {
      updateImeSuggestions(val, cursorPos);
    }
  };

  const handleInputFocusOrClick = () => {
    if (inputText === DEFAULT_SAMPLE_TEXT) {
      setInputText("");
      setImeVisible(false);
      setImeWordToken(null);
      setImeCandidates([]);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const target = e.target as HTMLElement;
    if (inputTextareaRef.current && (inputTextareaRef.current === target || inputTextareaRef.current.contains(target))) {
      setContextTarget("input");
    } else if (outputTextareaRef.current && (outputTextareaRef.current === target || outputTextareaRef.current.contains(target))) {
      setContextTarget("output");
    } else {
      setContextTarget("general");
    }

    const menuWidth = 195;
    const menuHeight = 275;
    const padding = 12;
    let x = e.clientX;
    let y = e.clientY;

    if (y + menuHeight > window.innerHeight - padding) {
      y = Math.max(padding, window.innerHeight - menuHeight - padding);
    }
    if (x + menuWidth > window.innerWidth - padding) {
      x = Math.max(padding, window.innerWidth - menuWidth - padding);
    }
    setContextMenu({ x, y });
  };

  return (
    <div
      className="fml-app-window"
      onContextMenu={handleContextMenu}
    >
      {/* FLOATING STATUS TOAST */}
      {toastMessage && (
        <div className={`fml-toast-pill toast-${toastType}`}>
          <div className="toast-icon-wrap">
            {toastType === "success" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            )}
            {toastType === "info" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="16" x2="12" y2="12"></line>
                <line x1="12" y1="8" x2="12.01" y2="8"></line>
              </svg>
            )}
            {toastType === "error" && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
              </svg>
            )}
          </div>
          <span className="toast-text">{toastMessage}</span>
        </div>
      )}

      {/* ================= 1. HEADER BRANDING SECTION ================= */}
      <header className="fml-header-section">
        <div className="header-brand">
          <div className="brand-logo-squircle">
            <img src={logoImg} alt="FML Buddy Logo" className="logo-img" />
          </div>
          <div className="brand-text">
            <h1>FML Buddy</h1>
            <p>Malayalam Unicode ↔ FML / ML-TT Converter · v{CURRENT_VERSION} by Amarshafan M</p>
          </div>
        </div>

        <div className="header-status-area">
          {/* Font Library Button in Header */}
          <button
            type="button"
            className="btn-font-library"
            onClick={() => setShowFontLibrary(true)}
            title="View FML Font Library & Live Preview"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <polyline points="4 7 4 4 20 4 20 7"></polyline>
              <line x1="9" y1="20" x2="15" y2="20"></line>
              <line x1="12" y1="4" x2="12" y2="20"></line>
            </svg>
            <span>Font Library</span>
          </button>

          {/* Compact Developer Avatar Button (Visible on narrow / docked panels when bottom button is hidden) */}
          <button
            type="button"
            className="btn-dev-header"
            onClick={() => setShowDevModal(true)}
            title="Developer Details & Socials (Amarshafan M)"
            aria-label="Developer Details"
          >
            <img src={amarDpImg} alt="Amarshafan M" className="dev-header-avatar" />
          </button>
        </div>
      </header>

      {/* ================= 2. TWO-COLUMN WORKSPACE ================= */}
      <main className="fml-workspace-grid">
        {/* ================= LEFT COLUMN: INPUT ================= */}
        <section className="fml-card">
          <div className="card-header-row">
            <h2 className="card-title">Input</h2>
            <button
              type="button"
              className="btn-card-action"
              onClick={pasteFromClipboard}
              title={`Paste from Clipboard (${isMac ? "⌘V" : "Ctrl+V"})`}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              <span>Paste</span>
              <span className="action-kbd-group">
                {isMac ? (
                  <>
                    <kbd className="keycap keycap-xs">⌘</kbd>
                    <kbd className="keycap keycap-xs">V</kbd>
                  </>
                ) : (
                  <>
                    <kbd className="keycap keycap-xs">Ctrl</kbd>
                    <kbd className="keycap keycap-xs">V</kbd>
                  </>
                )}
              </span>
            </button>
          </div>

          {/* Segmented Pill: Manglish (Phonetic) | Malayalam (Unicode) */}
          <div className="fml-segmented-pill">
            <button
              type="button"
              className={`pill-btn ${inputMode === "manglish" ? "active" : ""}`}
              onClick={() => {
                setInputMode("manglish");
                localStorage.setItem("fml_buddy_mode", "manglish");
                showToast("Mode: Manglish (Phonetic)", "info");
                if (inputText === DEFAULT_SAMPLE_TEXT) {
                  setInputText("");
                }
                if (inputTextareaRef.current) {
                  inputTextareaRef.current.focus();
                }
              }}
              title="Manglish Phonetic"
            >
              <span>Manglish (Phonetic)</span>
            </button>
            <button
              type="button"
              className={`pill-btn ${inputMode === "unicode" ? "active" : ""}`}
              onClick={() => {
                setInputMode("unicode");
                setImeVisible(false);
                localStorage.setItem("fml_buddy_mode", "unicode");
                showToast("Mode: Malayalam (Unicode)", "info");
                if (inputTextareaRef.current) {
                  inputTextareaRef.current.focus();
                }
              }}
              title="Malayalam Unicode"
            >
              <span>Malayalam (Unicode)</span>
            </button>
          </div>

          {/* Inset Textarea Well */}
          <div className="fml-textarea-well">
            <textarea
              ref={inputTextareaRef}
              className="input-area"
              value={inputText}
              onChange={handleInputChange}
              onKeyDown={handleTextareaKeyDown}
              onClick={handleInputFocusOrClick}
              onFocus={handleInputFocusOrClick}
              placeholder={
                inputMode === "manglish"
                  ? "Type in Manglish (e.g. 'keralam', 'namaskaram', 'sukhamano?')..."
                  : DEFAULT_SAMPLE_TEXT
              }
              spellCheck={false}
            />

            <div className="well-footer-row">
              <span className="footer-tag">
                {inputMode === "manglish" ? "Manglish IME" : "Unicode"}
              </span>
              <span className="footer-counter">{inputText.length} / 2000</span>
            </div>
          </div>
        </section>

        {/* ================= RIGHT COLUMN: OUTPUT ================= */}
        <section className="fml-card">
          <div className="card-header-row">
            <h2 className="card-title">Output</h2>

            {/* Custom Modern Dark-Theme Encoding Dropdown */}
            <div className="target-encoding-custom" ref={encodingDropdownRef}>
              <button
                type="button"
                className={`encoding-trigger-btn ${isEncodingDropdownOpen ? "open" : ""}`}
                onClick={() => setIsEncodingDropdownOpen((prev) => !prev)}
                aria-haspopup="listbox"
                aria-expanded={isEncodingDropdownOpen}
              >
                <span className="selected-encoding-label">
                  {targetEncoding === "roman"
                    ? "Roman (English Translit)"
                    : "FML / ML-TT (Legacy)"}
                </span>
                <svg
                  className={`chevron-icon ${isEncodingDropdownOpen ? "rotated" : ""}`}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </button>

              {isEncodingDropdownOpen && (
                <div className="encoding-dropdown-menu" role="listbox">
                  <div
                    className={`encoding-option ${targetEncoding === "fml" ? "active" : ""}`}
                    role="option"
                    aria-selected={targetEncoding === "fml"}
                    onClick={() => {
                      setTargetEncoding("fml");
                      localStorage.setItem("fml_buddy_encoding", "fml");
                      setIsEncodingDropdownOpen(false);
                      showToast("Target: FML / ML-TT (Legacy)", "info");
                    }}
                  >
                    <div className="option-label-wrap">
                      <span className="option-title">FML / ML-TT (Legacy)</span>
                      <span className="option-desc">Authentic Malayalam fonts</span>
                    </div>
                    {targetEncoding === "fml" && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--accent-purple-light)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>

                  <div
                    className={`encoding-option ${targetEncoding === "roman" ? "active" : ""}`}
                    role="option"
                    aria-selected={targetEncoding === "roman"}
                    onClick={() => {
                      setTargetEncoding("roman");
                      localStorage.setItem("fml_buddy_encoding", "roman");
                      setIsEncodingDropdownOpen(false);
                      showToast("Target: Roman (English Translit)", "info");
                    }}
                  >
                    <div className="option-label-wrap">
                      <span className="option-title">Roman (English Translit)</span>
                      <span className="option-desc">Phonetic English script</span>
                    </div>
                    {targetEncoding === "roman" && (
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--accent-purple-light)"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Inset Textarea Well */}
          <div className="fml-textarea-well">
            <textarea
              ref={outputTextareaRef}
              className="output-area"
              value={outputText}
              readOnly
              placeholder="Converted FML / ML-TT characters will appear here..."
              spellCheck={false}
            />

            <div className="well-footer-row">
              <span className="footer-tag">
                {targetEncoding === "roman" ? "Roman Translit" : "FML / ML-TT"}
              </span>
              <span className="footer-counter">{outputText.length} chars</span>
            </div>
          </div>
        </section>
      </main>

      {/* ================= 3. BOTTOM ACTION BAR ================= */}
      <footer className="fml-bottom-action-bar">
        {/* Left Side: Developer Details Trigger Button */}
        <div className="action-info-left">
          <button
            type="button"
            className="btn-developer-trigger"
            onClick={() => setShowDevModal(true)}
            title="Developer Details & Socials (Instagram, LinkedIn, Website, GitHub)"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
              <circle cx="12" cy="7" r="4"></circle>
            </svg>
            <span>Developer Details</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="icon-arrow-out"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        </div>

        {/* Right Side: Reset & Copy */}
        <div className="action-buttons-right">
          <button
            type="button"
            className="btn-reset"
            onClick={handleReset}
            disabled={!inputText && !outputText}
            title="Reset editor text"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
            <span>Reset</span>
          </button>

          <button
            type="button"
            className="btn-copy-clipboard"
            onClick={() => copyToClipboard(outputText)}
            disabled={!outputText}
            title={`Copy converted output (${isMac ? "⌘↵" : "Ctrl+Enter"})`}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
            <span>{copiedRecently ? "✓ Copied!" : "Copy to Clipboard"}</span>
            <span className="btn-kbd-group">
              {isMac ? (
                <>
                  <kbd className="keycap keycap-purple">⌘</kbd>
                  <kbd className="keycap keycap-purple">↵</kbd>
                </>
              ) : (
                <>
                  <kbd className="keycap keycap-purple">Ctrl</kbd>
                  <kbd className="keycap keycap-purple">↵</kbd>
                </>
              )}
            </span>
          </button>
        </div>
      </footer>

      {/* ================= 4. FLOATING MANGLISH IME POPOVER ================= */}
      <ImePopover
        visible={imeVisible}
        candidates={imeCandidates}
        selectedIndex={imeSelectedIndex}
        position={imePosition}
        onSelect={(candidate) => commitCandidate(candidate, " ")}
        onHoverIndex={(idx) => setImeSelectedIndex(idx)}
      />

      {/* ================= 5. FONT LIBRARY MODAL ================= */}
      {showFontLibrary && (
        <div
          className="fml-modal-backdrop"
          onClick={() => setShowFontLibrary(false)}
        >
          <div
            className="fml-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <polyline points="4 7 4 4 20 4 20 7"></polyline>
                    <line x1="9" y1="20" x2="15" y2="20"></line>
                    <line x1="12" y1="4" x2="12" y2="20"></line>
                  </svg>
                </div>
                <div>
                  <h3>FML / ML-TT Font Library</h3>
                  <p>Live preview in authentic Malayalam legacy fonts · Download and install directly into your system</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowFontLibrary(false)}
                title="Close modal (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {/* macOS Dark Mode Search Bar */}
              <div className="font-library-search-wrap">
                <span className="search-icon-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </span>
                <input
                  className="font-library-search-input"
                  type="text"
                  value={fontSearch}
                  onChange={(e) => setFontSearch(e.target.value)}
                  placeholder={`Search ${FML_FONTS.length} fonts by name...`}
                  aria-label="Search fonts"
                  spellCheck={false}
                />
                <span className="search-count-badge">
                  {fontSearch.trim() ? `${filteredFonts.length} of ${FML_FONTS.length}` : `${FML_FONTS.length} fonts`}
                </span>
                {fontSearch && (
                  <button
                    type="button"
                    className="btn-clear-search"
                    onClick={() => setFontSearch("")}
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Custom Sample Text Preview Bar */}
              <div className="font-library-sample-bar">
                <div className="sample-label-wrap">
                  <span className="sample-tag">Preview:</span>
                </div>
                <input
                  type="text"
                  className="sample-text-input"
                  value={previewText}
                  onChange={(e) => setPreviewText(e.target.value)}
                  placeholder="അമർഷഫാൻ എം"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="btn-sample-reset"
                  onClick={() => setPreviewText("അമർഷഫാൻ എം")}
                  title="Reset preview text to അമർഷഫാൻ എം"
                >
                  Reset
                </button>
              </div>

              {/* Bulk Download & Bulk Install Toolbar */}
              <div className="font-library-bulk-toolbar">
                <div className="bulk-stats-badge">
                  <span className="stats-dot" />
                  <span className="stats-label">
                    Installed: <strong>{installedFontsCount}</strong> of {FML_FONTS.length} Fonts
                  </span>
                </div>

                <div className="bulk-actions-group">
                  <button
                    type="button"
                    className="btn-bulk-toolbar btn-bulk-download"
                    onClick={handleDownloadAllFonts}
                    disabled={bulkProgress?.active}
                    title="Download all 225 Malayalam fonts to Downloads/FML_Fonts folder"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Download All (225)</span>
                  </button>

                  <button
                    type="button"
                    className={`btn-bulk-toolbar btn-bulk-install ${allFontsInstalled ? "is-all-installed" : ""}`}
                    onClick={handleInstallAllFonts}
                    disabled={bulkProgress?.active}
                    title={
                      allFontsInstalled
                        ? "All 225 fonts already installed in system font library"
                        : "Install all 225 Malayalam fonts directly into your OS font library"
                    }
                  >
                    {allFontsInstalled ? (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        <span>✓ All Fonts Installed</span>
                      </>
                    ) : (
                      <>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2v13M5 11l7 7 7-7M2 19h20"></path>
                        </svg>
                        <span>Install All Fonts</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="font-cards-grid">
                {filteredFonts.map((f) => (
                  <FontCardItem
                    key={f.name}
                    font={f}
                    convertedPreviewFml={convertedPreviewFml}
                    isInstalled={installedFonts.has(f.fileName.toLowerCase())}
                    isDownloading={downloadingFont === f.name}
                    isInstalling={installingFont === f.name}
                    onDownload={handleDownloadFont}
                    onInstall={handleInstallFont}
                    onCopyName={(name) => {
                      copyToClipboard(name);
                      showToast(`Copied font name: ${name}`, "success");
                    }}
                    getFontBuffer={getFontBuffer}
                  />
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-done"
                onClick={() => setShowFontLibrary(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. BULK FONTS PRELOADER MODAL ================= */}
      {bulkProgress && bulkProgress.active && (
        <div className="fml-preloader-backdrop">
          <div className="fml-preloader-window">
            <div className="preloader-header">
              <div className={`preloader-icon-badge ${bulkProgress.isComplete ? "is-complete" : ""}`}>
                {bulkProgress.isComplete ? (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                ) : (
                  <div className="preloader-spinner-circle" />
                )}
              </div>
              <div className="preloader-title-wrap">
                <h3>
                  {bulkProgress.isComplete
                    ? bulkProgress.type === "install"
                      ? "All Fonts Installed!"
                      : "All Fonts Downloaded!"
                    : bulkProgress.type === "install"
                    ? "Installing All Fonts..."
                    : "Downloading All Fonts..."}
                </h3>
                <p>
                  {bulkProgress.isComplete
                    ? bulkProgress.type === "install"
                      ? `Successfully installed all ${bulkProgress.total} fonts into your system. Ready to use in Premiere Pro & After Effects!`
                      : `All ${bulkProgress.total} Malayalam font files saved to Downloads/FML_Fonts.`
                    : bulkProgress.type === "install"
                    ? `Installing 225 Malayalam FML & ML-TT fonts into your OS font library...`
                    : `Saving 225 Malayalam FML & ML-TT fonts to Downloads/FML_Fonts...`}
                </p>
              </div>
            </div>

            <div className="preloader-body">
              <div className="preloader-stats-row">
                <span className="stats-count">
                  {bulkProgress.current} / {bulkProgress.total} Fonts
                </span>
                <span className="stats-percent">
                  {Math.round((bulkProgress.current / bulkProgress.total) * 100)}%
                </span>
              </div>

              <div className="preloader-progress-track">
                <div
                  className={`preloader-progress-bar ${bulkProgress.isComplete ? "is-complete" : ""}`}
                  style={{
                    width: `${Math.min(100, Math.round((bulkProgress.current / bulkProgress.total) * 100))}%`,
                  }}
                />
              </div>

              <div className="preloader-status-detail">
                <span className={`detail-dot ${bulkProgress.isComplete ? "is-complete" : "is-active"}`} />
                <span className="detail-text">
                  {bulkProgress.isComplete
                    ? "✓ Complete · All fonts ready to use"
                    : `Current: ${bulkProgress.currentFontName}`}
                </span>
              </div>
            </div>

            <div className="preloader-footer">
              {bulkProgress.isComplete ? (
                <button
                  type="button"
                  className="btn-preloader-action btn-done"
                  onClick={() => setBulkProgress(null)}
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  className="btn-preloader-action btn-cancel"
                  onClick={() => {
                    bulkCancelRef.current = true;
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= 6. DEVELOPER DETAILS & GITHUB UPDATES MODAL ================= */}
      {showDevModal && (
        <div
          className="fml-modal-backdrop"
          onClick={() => setShowDevModal(false)}
        >
          <div
            className="fml-modal-window dev-modal-window"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div className="modal-title-wrap">
                <div className="modal-icon-badge dev-badge">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
                <div>
                  <h3>Developer Details & Updates</h3>
                  <p>Amarshafan M · Creator of FML Buddy for Adobe Creative Cloud</p>
                </div>
              </div>
              <button
                type="button"
                className="btn-close-modal"
                onClick={() => setShowDevModal(false)}
                title="Close modal (Esc)"
              >
                ✕
              </button>
            </div>

            <div className="modal-body dev-modal-body">
              {/* Profile Card */}
              <div className="dev-profile-card">
                <div className="dev-avatar">
                  <img
                    src={amarDpImg}
                    alt="Amarshafan M"
                    className="dev-avatar-img"
                  />
                </div>
                <div className="dev-info">
                  <h4>Amarshafan M</h4>
                  <p className="dev-tagline">AI Vibe Coder &amp; Multimedia Technologist</p>
                  <p className="dev-description">
                    Operating at the intersection of cinematic art and AI vibe coding. Amarshafan M delivers pro-level commercial video editing and creative tools.
                  </p>
                </div>
              </div>

              {/* Social and Portfolio Links Grid */}
              <div className="dev-links-grid">
                <div
                  className="dev-link-card instagram"
                  onClick={() => openExternalUrl("https://www.instagram.com/amarshafan.ai/")}
                >
                  <div className="link-left">
                    <div className="link-icon-wrap ig">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect>
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path>
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line>
                      </svg>
                    </div>
                    <div className="link-meta">
                      <span className="link-title">Instagram</span>
                      <span className="link-handle">@amarshafan.ai</span>
                    </div>
                  </div>
                  <div className="link-action">
                    <span>Follow</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </div>
                </div>

                <div
                  className="dev-link-card linkedin"
                  onClick={() => openExternalUrl("https://www.linkedin.com/in/amarshafan-m/")}
                >
                  <div className="link-left">
                    <div className="link-icon-wrap in">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path>
                        <rect x="2" y="9" width="4" height="12"></rect>
                        <circle cx="4" cy="4" r="2"></circle>
                      </svg>
                    </div>
                    <div className="link-meta">
                      <span className="link-title">LinkedIn</span>
                      <span className="link-handle">in/amarshafan-m</span>
                    </div>
                  </div>
                  <div className="link-action">
                    <span>Connect</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </div>
                </div>

                <div
                  className="dev-link-card website"
                  onClick={() => openExternalUrl("https://amarshafan.vercel.app/")}
                >
                  <div className="link-left">
                    <div className="link-icon-wrap web">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                    </div>
                    <div className="link-meta">
                      <span className="link-title">Portfolio Website</span>
                      <span className="link-handle">amarshafan.vercel.app</span>
                    </div>
                  </div>
                  <div className="link-action">
                    <span>Visit</span>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Keyboard Shortcuts Reference Card (Dedicated macOS & Windows Views) */}
              <div className="dev-shortcuts-card">
                <div className="shortcuts-card-top">
                  <div className="shortcuts-title-wrap">
                    <div className="shortcuts-icon-badge">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                        <line x1="6" y1="8" x2="6" y2="8"></line>
                        <line x1="10" y1="8" x2="10" y2="8"></line>
                        <line x1="14" y1="8" x2="14" y2="8"></line>
                        <line x1="18" y1="8" x2="18" y2="8"></line>
                        <line x1="6" y1="12" x2="6" y2="12"></line>
                        <line x1="18" y1="12" x2="18" y2="12"></line>
                        <line x1="7" y1="16" x2="17" y2="16"></line>
                      </svg>
                    </div>
                    <span className="shortcuts-name">Keyboard Shortcuts</span>
                  </div>

                  <div className="shortcuts-os-toggle">
                    <button
                      type="button"
                      className={`os-tab-btn ${shortcutPlatformTab === "mac" ? "active" : ""}`}
                      onClick={() => setShortcutPlatformTab("mac")}
                      title="View macOS keyboard shortcuts"
                    >
                      macOS (⌘)
                    </button>
                    <button
                      type="button"
                      className={`os-tab-btn ${shortcutPlatformTab === "windows" ? "active" : ""}`}
                      onClick={() => setShortcutPlatformTab("windows")}
                      title="View Windows keyboard shortcuts"
                    >
                      Windows (Ctrl)
                    </button>
                  </div>
                </div>

                <div className="shortcuts-grid">
                  <div className="shortcut-item">
                    <span className="sc-label">Copy to Clipboard</span>
                    <span className="sc-kbd-group">
                      {shortcutPlatformTab === "mac" ? (
                        <>
                          <kbd className="keycap">⌘</kbd>
                          <kbd className="keycap">↵</kbd>
                        </>
                      ) : (
                        <>
                          <kbd className="keycap">Ctrl</kbd>
                          <span className="sc-plus">+</span>
                          <kbd className="keycap">↵</kbd>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="shortcut-item">
                    <span className="sc-label">Copy Selection / All</span>
                    <span className="sc-kbd-group">
                      {shortcutPlatformTab === "mac" ? (
                        <>
                          <kbd className="keycap">⌘</kbd>
                          <kbd className="keycap">C</kbd>
                        </>
                      ) : (
                        <>
                          <kbd className="keycap">Ctrl</kbd>
                          <span className="sc-plus">+</span>
                          <kbd className="keycap">C</kbd>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="shortcut-item">
                    <span className="sc-label">Paste from Clipboard</span>
                    <span className="sc-kbd-group">
                      {shortcutPlatformTab === "mac" ? (
                        <>
                          <kbd className="keycap">⌘</kbd>
                          <kbd className="keycap">V</kbd>
                        </>
                      ) : (
                        <>
                          <kbd className="keycap">Ctrl</kbd>
                          <span className="sc-plus">+</span>
                          <kbd className="keycap">V</kbd>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="shortcut-item">
                    <span className="sc-label">Choose Candidate (1 - 6)</span>
                    <span className="sc-kbd-group">
                      <kbd className="keycap">1</kbd>
                      <span className="sc-divider">-</span>
                      <kbd className="keycap">6</kbd>
                    </span>
                  </div>
                </div>
              </div>

              {/* Software Updates Card */}
              <div className="dev-github-card">
                <div className="github-card-top">
                  <div className="github-title-wrap">
                    <div className="github-icon-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
                      </svg>
                    </div>
                    <span className="github-name">Software Updates</span>
                    <span className="version-badge">v{CURRENT_VERSION}</span>
                  </div>

                  <button
                    type="button"
                    className="btn-check-update"
                    onClick={() => checkForUpdates(true)}
                    disabled={updateStatus === "checking"}
                    title="Check GitHub for newer releases"
                  >
                    <span>{updateStatus === "checking" ? "Checking..." : "Check Updates"}</span>
                  </button>
                </div>

                <div className="github-update-status">
                  <div className={`status-left ${updateStatus === "available" ? "has-update" : ""} ${updateStatus === "error" ? "has-error" : ""}`}>
                    <span className="status-dot-mini"></span>
                    <span className="status-text" title={updateError || undefined}>
                      {updateStatus === "checking" && "Querying GitHub API..."}
                      {updateStatus === "available" && `New version available: v${latestVersion}!`}
                      {updateStatus === "latest" && `FML Buddy is up to date (v${CURRENT_VERSION}).`}
                      {updateStatus === "idle" && "Latest release tracked via GitHub repository."}
                      {updateStatus === "error" && (updateError ? `Error: ${updateError}` : "Update check failed")}
                    </span>
                  </div>

                  {updateStatus === "available" && (
                    <button
                      type="button"
                      className="btn-download-update"
                      onClick={downloadUpdate}
                      disabled={isDownloadingUpdate}
                      title="Download latest release update from GitHub"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                      </svg>
                      <span>
                        {isDownloadingUpdate
                          ? (downloadProgress !== null ? `Downloading ${downloadProgress}%...` : "Downloading...")
                          : "Download Update"}
                      </span>
                    </button>
                  )}

                  {updateStatus === "error" && (
                    <button
                      type="button"
                      className="btn-retry-update"
                      onClick={() => checkForUpdates(true)}
                      title="Retry checking for updates"
                    >
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"></polyline>
                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                      </svg>
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-done"
                onClick={() => setShowDevModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= 7. RIGHT CLICK CONTEXT MENU ================= */}
      {contextMenu && (
        <div
          className="fml-context-menu"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="context-menu-info" style={{ padding: "4px 8px 6px", display: "flex", flexDirection: "column", gap: "2px" }}>
            <span style={{ fontSize: "11px", fontWeight: "600", color: "#ffffff" }}>FML Buddy v{CURRENT_VERSION}</span>
            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>by Amarshafan M</span>
          </div>
          <div className="context-sep"></div>

          {/* Quick Text Actions: Copy & Paste */}
          <button
            type="button"
            className="context-item"
            disabled={!inputText && !outputText && !window.getSelection()?.toString()}
            onClick={() => {
              setContextMenu(null);
              handleContextCopy();
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              <span className="item-label">Copy</span>
            </span>
            <span className="context-kbd-group">
              {isMac ? (
                <>
                  <kbd className="keycap keycap-xs">⌘</kbd>
                  <kbd className="keycap keycap-xs">C</kbd>
                </>
              ) : (
                <>
                  <kbd className="keycap keycap-xs">Ctrl</kbd>
                  <kbd className="keycap keycap-xs">C</kbd>
                </>
              )}
            </span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => {
              setContextMenu(null);
              pasteFromClipboard();
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
              </svg>
              <span className="item-label">Paste</span>
            </span>
            <span className="context-kbd-group">
              {isMac ? (
                <>
                  <kbd className="keycap keycap-xs">⌘</kbd>
                  <kbd className="keycap keycap-xs">V</kbd>
                </>
              ) : (
                <>
                  <kbd className="keycap keycap-xs">Ctrl</kbd>
                  <kbd className="keycap keycap-xs">V</kbd>
                </>
              )}
            </span>
          </button>

          <div className="context-sep"></div>

          <button
            type="button"
            className="context-item"
            onClick={() => {
              setContextMenu(null);
              setShowFontLibrary(true);
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 7 4 4 20 4 20 7" />
                <line x1="9" y1="20" x2="15" y2="20"></line>
                <line x1="12" y1="4" x2="12" y2="20"></line>
              </svg>
              <span className="item-label">Font Library</span>
            </span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => {
              setContextMenu(null);
              setShowDevModal(true);
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <span className="item-label">Developer Details</span>
            </span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => {
              setContextMenu(null);
              checkForUpdates(true);
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="7 10 12 15 17 10"></polyline>
                <line x1="12" y1="15" x2="12" y2="3"></line>
              </svg>
              <span className="item-label">Check for Updates</span>
            </span>
          </button>

          <div className="context-sep"></div>

          <button
            type="button"
            className="context-item"
            onClick={() => {
              setContextMenu(null);
              handleRefresh();
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
              <span className="item-label">Refresh</span>
            </span>
          </button>

          <button
            type="button"
            className="context-item"
            onClick={() => {
              setContextMenu(null);
              handleForceRefresh();
            }}
          >
            <span className="item-main">
              <svg className="item-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              <span className="item-label">Force Refresh</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

export default App;
