import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const srcAssets = path.join(projectRoot, "Assets");
const destAssets = path.join(projectRoot, "dist", "cep", "Assets");

try {
  if (fs.existsSync(srcAssets)) {
    fs.mkdirSync(path.dirname(destAssets), { recursive: true });
    fs.cpSync(srcAssets, destAssets, { recursive: true });
    console.log("[FML Buddy] Copied Assets to dist/cep/Assets successfully.");
  }
} catch (err) {
  console.warn("[FML Buddy] Failed copying Assets to dist/cep/Assets:", err.message);
}

// Copy adm-zip to dist/cep/node_modules/adm-zip so CEP runtime can require it
const srcAdmZip = path.join(projectRoot, "node_modules", "adm-zip");
const destAdmZip = path.join(projectRoot, "dist", "cep", "node_modules", "adm-zip");
try {
  if (fs.existsSync(srcAdmZip)) {
    fs.mkdirSync(destAdmZip, { recursive: true });
    fs.cpSync(srcAdmZip, destAdmZip, { recursive: true });
    console.log("[FML Buddy] Copied adm-zip to dist/cep/node_modules/adm-zip successfully.");
  }
} catch (err) {
  console.warn("[FML Buddy] Failed copying adm-zip to dist/cep/node_modules:", err.message);
}

