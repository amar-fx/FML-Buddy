import React, { useState, useMemo } from "react";
import {
  HistoryItem,
  formatRelativeTime,
  extractUniqueWords,
} from "./historyManager";

interface HistoryModalProps {
  visible: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onRestore: (item: HistoryItem) => void;
  onCopyText: (text: string, label?: string) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
  isMac?: boolean;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({
  visible,
  onClose,
  history,
  onRestore,
  onCopyText,
  onDelete,
  onClearAll,
}) => {
  const [modeFilter, setModeFilter] = useState<"all" | "manglish" | "unicode">("all");
  const [selectedWordFilter, setSelectedWordFilter] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Extract quick unique words from history
  const uniqueWords = useMemo(() => extractUniqueWords(history), [history]);

  // Filter items based on mode filter and optional selected word chip
  const filteredItems = useMemo(() => {
    let list = history;

    if (modeFilter !== "all") {
      list = list.filter((item) => item.mode === modeFilter);
    }

    if (selectedWordFilter) {
      const q = selectedWordFilter.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.inputText.toLowerCase().includes(q) ||
          item.unicodeText.toLowerCase().includes(q) ||
          item.outputText.toLowerCase().includes(q)
      );
    }

    return list;
  }, [history, modeFilter, selectedWordFilter]);

  if (!visible) return null;

  const handleClearClick = () => {
    if (confirmClear) {
      onClearAll();
      setConfirmClear(false);
      setSelectedWordFilter(null);
    } else {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 4000);
    }
  };

  return (
    <div className="fml-modal-backdrop" onClick={onClose}>
      <div
        className="fml-modal-window history-modal-window"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Typed Words and History"
      >
        {/* ================= MODAL HEADER ================= */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge history-icon-badge">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
              </svg>
            </div>
            <div>
              <h3>Typed History & Words</h3>
              <p>
                Recall, restore, or copy previously typed words and phrases ({history.length} saved)
              </p>
            </div>
          </div>

          <button
            type="button"
            className="btn-close-modal"
            onClick={onClose}
            title="Close history (Esc)"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* ================= MODAL BODY ================= */}
        <div className="modal-body history-modal-body">
          {/* Filter Pills (All / Manglish / Unicode) & Clear All Button */}
          <div className="history-filter-pills-row">
            <div className="history-pills-group">
              <button
                type="button"
                className={`history-pill-btn ${modeFilter === "all" ? "active" : ""}`}
                onClick={() => setModeFilter("all")}
              >
                All ({history.length})
              </button>
              <button
                type="button"
                className={`history-pill-btn ${modeFilter === "manglish" ? "active" : ""}`}
                onClick={() => setModeFilter("manglish")}
              >
                Manglish ({history.filter((i) => i.mode === "manglish").length})
              </button>
              <button
                type="button"
                className={`history-pill-btn ${modeFilter === "unicode" ? "active" : ""}`}
                onClick={() => setModeFilter("unicode")}
              >
                Unicode ({history.filter((i) => i.mode === "unicode").length})
              </button>
            </div>

            {/* Clear All Action */}
            {history.length > 0 && (
              <button
                type="button"
                className={`btn-clear-history ${confirmClear ? "btn-clear-confirm" : ""}`}
                onClick={handleClearClick}
                title={confirmClear ? "Click again to confirm clearing all history" : "Clear all history"}
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
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                <span>{confirmClear ? "Confirm Clear?" : "Clear All"}</span>
              </button>
            )}
          </div>

          {/* Quick Words Shelf */}
          {uniqueWords.length > 0 && (
            <div className="history-words-shelf">
              <div className="shelf-label">
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
                  <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
                  <line x1="7" y1="7" x2="7.01" y2="7"></line>
                </svg>
                <span>Recent Words:</span>
              </div>
              <div className="shelf-chips-list">
                {uniqueWords.map(({ word, count }) => {
                  const isSelected = selectedWordFilter?.toLowerCase() === word.toLowerCase();
                  return (
                    <button
                      key={word}
                      type="button"
                      className={`word-chip ${isSelected ? "active" : ""}`}
                      onClick={() => {
                        setSelectedWordFilter(isSelected ? null : word);
                      }}
                      title={isSelected ? `Filtering by "${word}" (click to reset)` : `Click to filter by "${word}" (${count}x)`}
                    >
                      <span className="chip-word">{word}</span>
                      {count > 1 && <span className="chip-count">{count}</span>}
                      {isSelected && <span className="chip-remove">✕</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* History Items List */}
          <div className="history-cards-scroll">
            {filteredItems.length === 0 ? (
              <div className="history-empty-state">
                <div className="empty-icon-wrap">
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                  </svg>
                </div>
                <h4>{selectedWordFilter ? `No entries matching "${selectedWordFilter}"` : "No typed history yet"}</h4>
                <p>
                  {selectedWordFilter
                    ? `No entries match "${selectedWordFilter}". Click below to show all.`
                    : "Words and sentences you type, convert, or copy in FML Buddy will automatically appear here for quick 1-click re-use."}
                </p>
                {selectedWordFilter && (
                  <button
                    type="button"
                    className="btn-clear-search-pill"
                    onClick={() => setSelectedWordFilter(null)}
                  >
                    Show All
                  </button>
                )}
              </div>
            ) : (
              filteredItems.map((item) => (
                <div key={item.id} className="history-card-item">
                  {/* Card Header Row: Mode, Encoding, Time, Delete */}
                  <div className="history-card-header">
                    <div className="card-tags-left">
                      <span className={`history-mode-tag tag-${item.mode}`}>
                        {item.mode === "manglish" ? "Manglish IME" : "Malayalam Unicode"}
                      </span>
                      <span className="history-encoding-tag">
                        {item.targetEncoding === "roman"
                          ? "Roman"
                          : item.targetEncoding === "ml"
                          ? "ML-TT"
                          : "FML"}
                      </span>
                      <span className="history-time-tag">
                        {formatRelativeTime(item.timestamp)}
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn-delete-history-item"
                      onClick={() => onDelete(item.id)}
                      title="Remove this item from history"
                      aria-label="Delete entry"
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
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  </div>

                  {/* Malayalam Unicode Content */}
                  <div className="history-card-content">
                    <div className="malayalam-primary-text">{item.unicodeText}</div>

                    {/* Show original typed Manglish if different */}
                    {item.mode === "manglish" && item.inputText !== item.unicodeText && (
                      <div className="typed-secondary-text">
                        <span className="typed-label">Typed:</span>
                        <span className="typed-val">{item.inputText}</span>
                      </div>
                    )}

                    {/* Converted Output Preview */}
                    {item.outputText && (
                      <div className="output-preview-text" title="Converted output text">
                        <span className="output-label">Output:</span>
                        <span className="output-val">{item.outputText}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="history-card-actions">
                    <button
                      type="button"
                      className="btn-history-restore"
                      onClick={() => onRestore(item)}
                      title="Restore this text into the editor"
                    >
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
                        <polyline points="9 14 4 9 9 4"></polyline>
                        <path d="M20 20v-7a4 4 0 0 0-4-4H4"></path>
                      </svg>
                      <span>Use in Editor</span>
                    </button>

                    <div className="copy-btn-group">
                      <button
                        type="button"
                        className="btn-history-copy"
                        onClick={() => onCopyText(item.unicodeText, "Malayalam text")}
                        title="Copy Malayalam Unicode text to clipboard"
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
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        <span>Malayalam</span>
                      </button>

                      {item.outputText && (
                        <button
                          type="button"
                          className="btn-history-copy btn-history-copy-fml"
                          onClick={() => onCopyText(item.outputText, "Output text")}
                          title={`Copy ${item.targetEncoding === "roman" ? "Roman" : "FML"} output to clipboard`}
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
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                          </svg>
                          <span>{item.targetEncoding === "roman" ? "Roman" : "FML"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HistoryModal;
