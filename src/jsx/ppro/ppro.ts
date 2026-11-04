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
 * Premiere's supported ExtendScript API does not expose a reliable way to
 * create or update a Text Graphics clip. Never create an empty QE text clip
 * and report it as a successful insertion; let the panel guide the user to
 * paste the converted text into a text graphic they create in Premiere.
 */
export const insertTextLayer = (text: string): ActionResult => {
  try {
    if (!text) {
      return { success: false, message: "There is no converted text to insert." };
    }

    if (!app.project) {
      return { success: false, message: "No active Premiere Pro project found." };
    }

    const seq = app.project.activeSequence;
    if (!seq) {
      return {
        success: false,
        message: "Please open an active Sequence in Premiere Pro first.",
      };
    }

    return {
      success: false,
      message: "Premiere Pro cannot reliably create a text graphic through its scripting API. Create a Text graphic in the active sequence, then paste the converted text into its text field.",
    };
  } catch (err: any) {
    return {
      success: false,
      message: "Premiere Pro error: " + (err.message || String(err)),
    };
  }
};
