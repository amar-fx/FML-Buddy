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
