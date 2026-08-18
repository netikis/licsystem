import { defineConfig } from "vite";
import JavaScriptObfuscator from "javascript-obfuscator";
import { minify as minifyHtml } from "html-minifier-terser";
import { htmlIncludesPlugin } from "./scripts/html-includes-plugin.mjs";

/**
 * Minifica o index.html no build.
 */
function minifyHtmlPlugin() {
  return {
    name: "licsystem-minify-html",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      async handler(html) {
        return minifyHtml(html, {
          collapseWhitespace: true,
          removeComments: true,
          removeRedundantAttributes: true,
          removeEmptyAttributes: false,
          minifyCSS: true,
          minifyJS: true,
          keepClosingSlash: true,
        });
      },
    },
  };
}

/**
 * Ofusca cada chunk JS gerado (depois do minify/terser).
 * renameGlobals: false — preserva window.LICSYSTEM / LICSYSTEMFirebase
 */
function obfuscatePlugin() {
  return {
    name: "licsystem-obfuscate",
    apply: "build",
    enforce: "post",
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith(".js")) return null;
      const result = JavaScriptObfuscator.obfuscate(code, {
        compact: true,
        controlFlowFlattening: true,
        controlFlowFlatteningThreshold: 0.5,
        deadCodeInjection: false,
        debugProtection: false,
        disableConsoleOutput: true,
        identifierNamesGenerator: "hexadecimal",
        renameGlobals: false,
        selfDefending: false,
        stringArray: true,
        stringArrayEncoding: ["base64"],
        stringArrayIndexShift: true,
        stringArrayRotate: true,
        stringArrayShuffle: true,
        stringArrayThreshold: 0.75,
        splitStrings: true,
        splitStringsChunkLength: 6,
        transformObjectKeys: false,
        unicodeEscapeSequence: false,
        // Evita quebrar imports/exports do Vite
        reservedNames: ["^LICSYSTEM", "^LICSYSTEMFirebase", "^firebase", "^__licsystem"],
      });
      return { code: result.getObfuscatedCode(), map: null };
    },
  };
}

export default defineConfig({
  root: ".",
  publicDir: "public",
  plugins: [htmlIncludesPlugin(), minifyHtmlPlugin(), obfuscatePlugin()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    minify: "terser",
    target: "es2018",
    cssMinify: true,
    assetsInlineLimit: 4096,
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        passes: 3,
        pure_getters: true,
      },
      mangle: {
        toplevel: true,
        safari10: true,
      },
      format: {
        comments: false,
      },
    },
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 4173,
  },
});
