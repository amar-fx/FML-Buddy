import React from "react";

interface ImePopoverProps {
  candidates: string[];
  selectedIndex: number;
  position: { left: number; top: number };
  visible: boolean;
  onSelect: (candidate: string) => void;
  onHoverIndex?: (index: number) => void;
}

export const ImePopover: React.FC<ImePopoverProps> = ({
  candidates,
  selectedIndex,
  position,
  visible,
  onSelect,
  onHoverIndex,
}) => {
  if (!visible || candidates.length === 0) return null;

  return (
    <div
      className="fml-ime-popover"
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onMouseDown={(e) => {
        // Prevent textarea from losing focus when clicking a suggestion
        e.preventDefault();
      }}
    >
      {/* Header Pill with number choosing shortcuts 1 - 6 */}
      <div className="ime-popover-header">
        <span className="ime-shortcut-pill">
          Select {candidates.length > 1 ? `1 - ${Math.min(candidates.length, 6)}` : "1"}
        </span>
      </div>

      <div className="ime-candidates-list">
        {candidates.map((cand, idx) => {
          const isSelected = idx === selectedIndex;
          const isLatin = /^[a-zA-Z~^]+$/.test(cand);
          return (
            <div
              key={`${cand}-${idx}`}
              className={`ime-candidate-item ${isSelected ? "selected" : ""} ${isLatin ? "latin-item" : ""}`}
              onClick={() => onSelect(cand)}
              onMouseEnter={() => onHoverIndex && onHoverIndex(idx)}
            >
              <span className="candidate-index">{idx + 1})</span>
              <span className="candidate-text">{cand}</span>
              {isLatin && <span className="latin-tag">abc</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ImePopover;
