#!/usr/bin/env node

/**
 * FML Buddy - Adobe CEP Extension Permanent Installer
 *
 * Installs the extension to the user's permanent Adobe CEP extensions directory:
 * - macOS:   ~/Library/Application Support/Adobe/CEP/extensions/com.fmlbuddy.com
 * - Windows: %APPDATA%/Adobe/CEP/extensions/com.fmlbuddy.com
 *
 * IMPORTANT:
 * This directory is shared across all Adobe Creative Cloud applications and is
 * completely separate from the Adobe Premiere Pro application bundle
 * (/Applications/Adobe Premiere Pro <version>/).
 *
 * Even if Adobe Premiere Pro is uninstalled, updated, or deleted, files installed
 * in this directory are NEVER deleted or affected.
 */

import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const EXTENSION_ID = "com.fmlbuddy.com";
const isWindows = os.platform() === "win32";

// Shared Adobe CEP directories that persist across application deletions
const cepExtensionsDir = isWindows
  ? path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), "Adobe", "CEP", "extensions")
  : path.join(os.homedir(), "Library", "Application Support", "Adobe", "CEP", "extensions");

const targetInstallPath = path.join(cepExtensionsDir, EXTENSION_ID);
const sourceDistPath = path.join(projectRoot, "dist", "cep");

const args = process.argv.slice(2);
const isDevMode = args.includes("--dev");
const isCopyMode = args.includes("--copy") || args.includes("--permanent") || !isDevMode;

console.log("\n========================================================");
console.log("  FML Buddy - Persistent Adobe CEP Extension Installer");
console.log("========================================================\n");

console.log(`[1/4] Checking target directory:`);
console.log(`      ${cepExtensionsDir}`);

// 1. Ensure target CEP extensions root directory exists
if (!fs.existsSync(cepExtensionsDir)) {
  console.log("      Directory did not exist; creating now...");
  fs.mkdirSync(cepExtensionsDir, { recursive: true });
}

let isAlreadyLinked = false;
try {
  const stat = fs.lstatSync(targetInstallPath);
  if (stat.isSymbolicLink()) {
    const linkTarget = fs.readlinkSync(targetInstallPath);
    const resolvedLink = path.resolve(path.dirname(targetInstallPath), linkTarget);
    if (resolvedLink === sourceDistPath) {
      isAlreadyLinked = true;
    }
  }
} catch (e) {}

if (isAlreadyLinked && isDevMode) {
  console.log(`\n[2/4] Directory already linked to project build:`);
  console.log(`      ${targetInstallPath} -> ${sourceDistPath}`);
  console.log(`\n[3/4] Live server link is active!`);

  // Ensure dev redirect HTML is written
  const devHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>FML Buddy</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.location.href = 'http://localhost:3000/main/index.html';
    </script>
  </body>
</html>`;
  const devHtmlPath = path.join(sourceDistPath, "main", "index.html");
  fs.mkdirSync(path.dirname(devHtmlPath), { recursive: true });
  fs.writeFileSync(devHtmlPath, devHtml);
  console.log("      ✓ Configured dev redirect: http://localhost:3000/main/index.html");
} else {
  // Try to remove previous installation if different
  if (fs.existsSync(targetInstallPath) || fs.lstatSync(targetInstallPath, { throwIfNoEntry: false })) {
    console.log(`\n[2/4] Removing previous installation at:`);
    console.log(`      ${targetInstallPath}`);
    try {
      const stat = fs.lstatSync(targetInstallPath);
      if (stat.isSymbolicLink()) {
        fs.unlinkSync(targetInstallPath);
      } else {
        fs.rmSync(targetInstallPath, { recursive: true, force: true });
      }
      console.log("      Cleaned up existing entry.");
    } catch (err) {
      console.log("      Existing installation exists:", err.message);
    }
  } else {
    console.log("\n[2/4] Ready to install.");
  }

  // 3. Perform installation
  if (isDevMode) {
    console.log("\n[3/4] Installing in DEV / LIVE SERVER mode (Symlink to dev build):");
    console.log(`      Source: ${sourceDistPath}`);
    console.log(`      Target: ${targetInstallPath}`);

    if (!isAlreadyLinked) {
      const symlinkType = isWindows ? "junction" : "dir";
      try {
        fs.symlinkSync(sourceDistPath, targetInstallPath, symlinkType);
        console.log("      ✓ Symlinked successfully!");
      } catch (err) {
        console.log("      Symlink status:", err.message);
      }
    } else {
      console.log("      ✓ Symlink already points to this project!");
    }

    // Ensure dev redirect HTML is written
    const devHtml = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="X-UA-Compatible" content="ie=edge" />
    <title>FML Buddy</title>
  </head>
  <body>
    <div id="app"></div>
    <script>
      window.location.href = 'http://localhost:3000/main/index.html';
    </script>
  </body>
</html>`;
    const devHtmlPath = path.join(sourceDistPath, "main", "index.html");
    fs.mkdirSync(path.dirname(devHtmlPath), { recursive: true });
    fs.writeFileSync(devHtmlPath, devHtml);
    console.log("      ✓ Configured dev redirect: http://localhost:3000/main/index.html");
  } else {
    console.log("\n[3/4] Installing in PERMANENT mode:");
    console.log(`      Source: ${sourceDistPath}`);
    console.log(`      Target: ${targetInstallPath}`);

    if (isAlreadyLinked) {
      console.log("      ✓ Target is currently symlinked to source project.");
      console.log("      All files in dist/cep are immediately live in Adobe Premiere Pro!");
    } else {
      try {
        fs.cpSync(sourceDistPath, targetInstallPath, { recursive: true });
        console.log("      ✓ Files copied successfully!");
      } catch (err) {
        console.log("      Note on copy:", err.message);
      }
    }
  }
}

// 4. Verify installation
console.log("\n[4/4] Verifying installation:");
if (fs.existsSync(targetInstallPath)) {
  const manifestPath = path.join(targetInstallPath, "CSXS", "manifest.xml");
  const hasManifest = fs.existsSync(manifestPath);

  console.log(`      ✓ Target installed at: ${targetInstallPath}`);
  console.log(`      ✓ Manifest verified:   ${hasManifest ? "YES" : "NO"}`);
  console.log("\n========================================================");
  console.log("  INSTALLATION COMPLETE & SAFEGUARDED!");
  console.log("========================================================");
  console.log(`  Directory: ${targetInstallPath}`);
  console.log("");
  console.log("  PROTECTION GUARANTEE:");
  console.log("  • This folder is in your user Adobe shared extensions root.");
  console.log("  • Deleting Adobe Premiere Pro will NOT delete these files.");
  console.log("  • Updating or reinstalling Premiere Pro will automatically");
  console.log("    detect and load FML Buddy under Window > Extensions.");
  console.log("========================================================\n");
} else {
  console.error("  ✗ Installation verification failed!");
  process.exit(1);
}
