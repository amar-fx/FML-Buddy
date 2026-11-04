import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const ZXP_FILENAME = "FML Buddy.zxp";
const cepDir = path.join(projectRoot, "dist", "cep");
const zxpOutputDir = path.join(projectRoot, "dist", "zxp");
const targetZxpPath = path.join(zxpOutputDir, ZXP_FILENAME);
const distZxpPath = path.join(projectRoot, "dist", ZXP_FILENAME);
const rootZxpPath = path.join(projectRoot, ZXP_FILENAME);

const certPath = path.join(projectRoot, "dist", "fmlbuddy-cert.p12");
const certPassword = "password";

console.log("\n=======================================================");
console.log("       🚀 FML BUDDY - ZXP PACKAGE COMPILER             ");
console.log("=======================================================\n");

// 1. Verify dist/cep exists and contains manifest.xml
const manifestPath = path.join(cepDir, "CSXS", "manifest.xml");
if (!fs.existsSync(manifestPath)) {
  console.log("📦 Compiling project production build first...");
  execSync("npm run build", { cwd: projectRoot, stdio: "inherit" });
}

// 2. Ensure Assets/ are present in dist/cep/Assets
const srcAssets = path.join(projectRoot, "Assets");
const destAssets = path.join(cepDir, "Assets");
if (fs.existsSync(srcAssets) && !fs.existsSync(destAssets)) {
  console.log("📁 Copying Assets/ into dist/cep/Assets...");
  fs.mkdirSync(path.dirname(destAssets), { recursive: true });
  fs.cpSync(srcAssets, destAssets, { recursive: true });
}

// 3. Locate ZXPSignCmd binary
const isWin = process.platform === "win32";
const zxpBinDir = path.join(projectRoot, "node_modules", "vite-cep-plugin", "lib", "bin");
const zxpCmd = path.join(zxpBinDir, isWin ? "ZXPSignCmd.exe" : "ZXPSignCmd");

if (!fs.existsSync(zxpCmd)) {
  console.error("❌ ZXPSignCmd binary not found at:", zxpCmd);
  process.exit(1);
}

if (!isWin) {
  try {
    fs.chmodSync(zxpCmd, 0o755);
  } catch (e) {}
}

// 4. Create directories
fs.mkdirSync(zxpOutputDir, { recursive: true });

// 5. Generate self-signed certificate if not present
if (!fs.existsSync(certPath)) {
  console.log("🔑 Generating self-signed Adobe ZXP certificate...");
  const certCmd = `"${zxpCmd}" -selfSignedCert US CA Amarshafan_M com.fmlbuddy.com "${certPassword}" "${certPath}"`;
  execSync(certCmd, { cwd: zxpBinDir, stdio: "inherit" });
}

// 6. Clean existing ZXP files
[targetZxpPath, distZxpPath, rootZxpPath].forEach((p) => {
  if (fs.existsSync(p)) {
    try {
      fs.unlinkSync(p);
    } catch (e) {}
  }
});

// 7. Sign the package
console.log(`\n📦 Signing "${ZXP_FILENAME}"...`);

const tsaServers = [
  "http://timestamp.apple.com/ts01",
  "http://timestamp.digicert.com/",
];

let signed = false;

for (const tsa of tsaServers) {
  try {
    console.log(`⏱️  Attempting timestamp with TSA: ${tsa}`);
    const signCmd = `"${zxpCmd}" -sign "${cepDir}" "${targetZxpPath}" "${certPath}" "${certPassword}" -tsa ${tsa}`;
    execSync(signCmd, { cwd: zxpBinDir, stdio: "pipe" });
    signed = true;
    console.log("✅ Successfully signed with TSA timestamp!");
    break;
  } catch (err) {
    console.warn(`⚠️  TSA ${tsa} timed out or was unreachable. Trying next...`);
  }
}

if (!signed) {
  console.log("⚡ Signing without TSA timestamp (offline mode)...");
  const signOfflineCmd = `"${zxpCmd}" -sign "${cepDir}" "${targetZxpPath}" "${certPath}" "${certPassword}"`;
  execSync(signOfflineCmd, { cwd: zxpBinDir, stdio: "inherit" });
  console.log("✅ Signed successfully!");
}

// 8. Copy to dist/ and root for universal accessibility
fs.copyFileSync(targetZxpPath, distZxpPath);
fs.copyFileSync(targetZxpPath, rootZxpPath);

// 9. Clean up temporary cert
try {
  if (fs.existsSync(certPath)) {
    fs.unlinkSync(certPath);
  }
} catch (e) {}

// 10. Verify the generated ZXP
console.log("\n🔍 Verifying generated ZXP package...");
try {
  const verifyOut = execSync(`"${zxpCmd}" -verify "${targetZxpPath}"`, {
    cwd: zxpBinDir,
    encoding: "utf-8",
  });
  console.log(verifyOut.trim());
} catch (err) {
  console.warn("Verify check notice:", err.message);
}

const stats = fs.statSync(targetZxpPath);
const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);

console.log("\n=======================================================");
console.log(`🎉 SUCCESS: "${ZXP_FILENAME}" compiled successfully!`);
console.log(`📊 Size: ${sizeMb} MB (${stats.size.toLocaleString()} bytes)`);
console.log("📍 File Locations:");
console.log(`   1. Root:     ${rootZxpPath}`);
console.log(`   2. Dist:     ${distZxpPath}`);
console.log(`   3. Dist ZXP: ${targetZxpPath}`);
console.log("=======================================================\n");
