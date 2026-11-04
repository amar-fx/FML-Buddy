// @include './lib/json2.js'

import { ns } from "../shared/shared";

import * as aeft from "./aeft/aeft"; 
import * as ppro from "./ppro/ppro"; 

//@ts-ignore
const host = typeof $ !== "undefined" ? $ : window;

// A safe way to get the app name since some versions of Adobe Apps broken BridgeTalk in various places (e.g. After Effects 24-25)
// in that case we have to do various checks per app to deterimine the app name

const getAppNameSafely = (): ApplicationName | "unknown" => {
  const compare = (a: string, b: string) => {
    return a.toLowerCase().indexOf(b.toLowerCase()) > -1;
  };
  const exists = (a: any) => typeof a !== "undefined";
  const isBridgeTalkWorking =
    typeof BridgeTalk !== "undefined" &&
    typeof BridgeTalk.appName !== "undefined";

  if (isBridgeTalkWorking) {
    const bt = BridgeTalk.appName.toLowerCase();
    if (bt.indexOf("aftereffects") > -1) return "aftereffects";
    if (bt.indexOf("premiere") > -1) return "premierepro";
    return BridgeTalk.appName as any;
  } else if (app) {
    //@ts-ignore
    if (exists(app.name)) {
      //@ts-ignore
      const name: string = app.name;
      if (compare(name, "after effects") || compare(name, "aftereffects")) return "aftereffects";
      if (compare(name, "premiere")) return "premierepro";
      if (compare(name, "photoshop")) return "photoshop";
      if (compare(name, "illustrator")) return "illustrator";
      if (compare(name, "audition")) return "audition";
      if (compare(name, "bridge")) return "bridge";
      if (compare(name, "indesign")) return "indesign";
    }
    //@ts-ignore
    if (exists(app.appName)) {
      //@ts-ignore
      const appName: string = app.appName;
      if (compare(appName, "after effects")) return "aftereffects";
      if (compare(appName, "animate")) return "animate";
    }
    //@ts-ignore
    if (exists(app.path)) {
      //@ts-ignore
      const path = app.path;
      if (compare(path, "after") || compare(path, "effects")) return "aftereffects";
      if (compare(path, "premiere")) return "premierepro";
    }
    //@ts-ignore
    if (exists(app.getEncoderHost) && exists(AMEFrontendEvent)) {
      return "ame";
    }
  }
  return "unknown";
};

// Check if running in After Effects or Premiere Pro
const detectedApp = getAppNameSafely().toLowerCase();
if (detectedApp.indexOf("aftereffects") > -1 || typeof CompItem !== "undefined") {
  host[ns] = aeft;
} else if (detectedApp.indexOf("premiere") > -1 || typeof (app as any).enableQE !== "undefined") {
  host[ns] = ppro;
} else {
  // Fallback check
  host[ns] = typeof CompItem !== "undefined" ? aeft : ppro;
}

const empty = {};
// prettier-ignore
export type Scripts = typeof empty
  & typeof aeft 
  & typeof ppro 
  ;

// https://extendscript.docsforadobe.dev/interapplication-communication/bridgetalk-class.html?highlight=bridgetalk#appname
type ApplicationName =
  | "aftereffects"
  | "aftereffectsbeta"
  | "ame"
  | "amebeta"
  | "audition"
  | "auditionbeta"
  | "animate"
  | "animatebeta"
  | "bridge"
  | "bridgebeta"
  // | "flash"
  | "illustrator"
  | "illustratorbeta"
  | "indesign"
  | "indesignbeta"
  // | "indesignserver"
  | "photoshop"
  | "photoshopbeta"
  | "premierepro"
  | "premiereprobeta";
