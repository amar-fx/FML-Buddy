import fs from "fs";
import { defineConfig } from "vite";

import react from "@vitejs/plugin-react"; 

import { cep, CepOptions, runAction } from "vite-cep-plugin";
import cepConfig from "./cep.config";
import path from "path";
import { extendscriptConfig } from "./vite.es.config";

const extensions = [".js", ".ts", ".tsx"];

const devDist = "dist";
const cepDist = "cep";

const src = path.resolve(__dirname, "src");
const root = path.resolve(src, "js");
const outDir = path.resolve(__dirname, "dist", cepDist);

const debugReact = process.env.DEBUG_REACT === "true";
const isProduction = process.env.NODE_ENV === "production";
const isMetaPackage = process.env.ZIP_PACKAGE === "true";
const isPackage = process.env.ZXP_PACKAGE === "true" || isMetaPackage;
const isServe = process.env.SERVE_PANEL === "true";
const action = process.env.BOLT_ACTION;

let input: { [key: string]: string } = {};
cepConfig.panels.map((panel) => {
  input[panel.name] = path.resolve(root, panel.mainPath);
});

const config: CepOptions = {
  cepConfig,
  isProduction,
  isPackage,
  isMetaPackage,
  isServe,
  debugReact,
  dir: `${__dirname}/${devDist}`,
  cepDist: cepDist,
  zxpOutput: `${__dirname}/${devDist}/zxp/${cepConfig.displayName}`,
  zipOutput: `${__dirname}/${devDist}/zip/${cepConfig.displayName}_${cepConfig.version}`,
  packages: cepConfig.installModules || [],
};

if (action) runAction(config, action);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    cep(config),
    {
      name: "serve-fml-fonts",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const rawUrl = req.url || "";
          if (rawUrl.includes("FML_Fonts") || rawUrl.includes("/fonts/")) {
            try {
              const fontFileName = decodeURIComponent(
                path.basename(rawUrl.split("?")[0])
              );
              const fontFilePath = path.resolve(
                __dirname,
                "Assets",
                "FML_Fonts",
                fontFileName
              );
              if (fs.existsSync(fontFilePath) && fs.statSync(fontFilePath).isFile()) {
                const mime = fontFileName.toLowerCase().endsWith(".otf")
                  ? "font/otf"
                  : "font/ttf";
                res.setHeader("Content-Type", mime);
                res.setHeader("Access-Control-Allow-Origin", "*");
                res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
                return fs.createReadStream(fontFilePath).pipe(res);
              }
            } catch (e) {}
          }
          next();
        });
      },
    },
  ],
  resolve: {
    alias: [{ find: "@esTypes", replacement: path.resolve(__dirname, "src") }],
  },
  root,
  clearScreen: false,
  server: {
    port: cepConfig.port,
    fs: {
      strict: false,
      allow: [path.resolve(__dirname)],
    },
  },
  preview: {
    port: cepConfig.servePort,
  },

  build: {
    sourcemap: isPackage ? cepConfig.zxp.sourceMap : cepConfig.build?.sourceMap,
    watch: {
      include: "src/jsx/**",
    },
    // commonjsOptions: {
    //   transformMixedEsModules: true,
    // },
    rollupOptions: {
      input,
      output: {
        manualChunks: {},
        // esModule: false,
        preserveModules: false,
        format: "cjs",
        entryFileNames: "assets/[name]-[hash].cjs",
        chunkFileNames: "assets/[name]-[hash].cjs",
      },
    },
    // Premiere Pro 14 / After Effects 17 (2020) ship CEP 9 with Chromium 61.
    target: "chrome61",
    outDir,
  },
});

// rollup es3 build
const outPathExtendscript = path.join("dist", cepDist, "jsx", "index.js");
extendscriptConfig(
  `src/jsx/index.ts`,
  outPathExtendscript,
  cepConfig,
  extensions,
  isProduction,
  isPackage,
);
