/**
 * Accurate Caret / Word Position Calculator for Textareas
 * Calculates pixel (left, top) coordinates of a character position inside a textarea.
 */

const properties: (keyof CSSStyleDeclaration)[] = [
  "direction",
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderStyle",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "MozTabSize" as any,
];

let mirrorDiv: HTMLDivElement | null = null;

export function getCaretCoordinates(
  element: HTMLTextAreaElement,
  position: number
): { top: number; left: number; height: number } {
  if (typeof document === "undefined") {
    return { top: 0, left: 0, height: 20 };
  }

  if (!mirrorDiv) {
    mirrorDiv = document.createElement("div");
    mirrorDiv.id = "fml-caret-position-mirror";
    document.body.appendChild(mirrorDiv);
  }

  const style = mirrorDiv.style;
  const computed = window.getComputedStyle(element);

  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";
  style.position = "absolute";
  style.visibility = "hidden";
  style.top = "0px";
  style.left = "-9999px";
  style.pointerEvents = "none";

  // Transfer relevant textarea styles
  properties.forEach((prop) => {
    // @ts-ignore
    style[prop] = computed[prop];
  });

  mirrorDiv.textContent = element.value.substring(0, position);

  const span = document.createElement("span");
  span.textContent = element.value.substring(position) || ".";
  mirrorDiv.appendChild(span);

  const lineHeight = parseInt(computed.lineHeight) || parseInt(computed.fontSize) * 1.4 || 20;

  const rect = element.getBoundingClientRect();
  const spanOffsetLeft = span.offsetLeft;
  const spanOffsetTop = span.offsetTop;

  const left = rect.left + spanOffsetLeft - element.scrollLeft;
  const top = rect.top + spanOffsetTop - element.scrollTop;

  return {
    top,
    left,
    height: lineHeight,
  };
}
