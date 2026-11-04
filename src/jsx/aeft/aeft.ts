import {
  helloVoid,
  helloError,
  helloStr,
  helloNum,
  helloArrayStr,
  helloObj,
} from "../utils/samples";
export { helloError, helloStr, helloNum, helloArrayStr, helloObj, helloVoid };

export interface ActionResult {
  success: boolean;
  message: string;
}

/**
 * Inserts converted ASCII text into After Effects:
 * - If a Text Layer is currently selected, updates its Source Text.
 * - If no layer is selected, creates a new Text Layer in the active Composition.
 */
export const insertTextLayer = (text: string): ActionResult => {
  try {
    if (!app.project) {
      return { success: false, message: "No active After Effects project found." };
    }

    const activeItem = app.project.activeItem;
    if (!activeItem || !(activeItem instanceof CompItem)) {
      return {
        success: false,
        message: "Please open and select a Composition first in After Effects.",
      };
    }

    app.beginUndoGroup("FML Buddy: Insert Malayalam Text");

    // Check for selected Text Layer
    let textLayer: TextLayer | null = null;
    const selectedLayers = activeItem.selectedLayers;
    if (selectedLayers && selectedLayers.length > 0) {
      for (let i = 0; i < selectedLayers.length; i++) {
        if (selectedLayers[i] instanceof TextLayer) {
          textLayer = selectedLayers[i] as TextLayer;
          break;
        }
      }
    }

    if (textLayer) {
      // Update existing Text Layer
      const sourceTextProp = textLayer.property("Source Text") as Property;
      if (sourceTextProp) {
        const textDocument = sourceTextProp.value as TextDocument;
        textDocument.text = text;
        sourceTextProp.setValue(textDocument);
        app.endUndoGroup();
        return {
          success: true,
          message: "Successfully updated selected Text Layer!",
        };
      }
    }

    // Create a new Text Layer in the Composition
    const newLayer = activeItem.layers.addText(text);
    try {
      // Center the new layer
      const compW = activeItem.width;
      const compH = activeItem.height;
      const posProp = newLayer.property("Position") as Property;
      if (posProp) {
        posProp.setValue([compW / 2, compH / 2]);
      }
    } catch (e) {
      // Ignore positioning errors
    }

    app.endUndoGroup();
    return {
      success: true,
      message: "Created new Text Layer with converted font encoding!",
    };
  } catch (err: any) {
    try {
      app.endUndoGroup();
    } catch (e) {}
    return {
      success: false,
      message: "Error inserting text: " + (err.message || String(err)),
    };
  }
};
