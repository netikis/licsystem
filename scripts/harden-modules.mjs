/**
 * Fase 2 das separações (veredito):
 * 1) Remove cola IIFE não usada (aliases/stubs) de cada módulo
 * 2) Publica LICSYSTEM.el / keys
 * 3) Extrai parsers da Captação para captacao-parsers.js
 * 4) Renomeia src/js/NN-foo.js → foo.js (padrão Joninha)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const jsDir = path.join(root, "src", "js");

const SHARED_FNS = [
  "licsystemPdfHeader",
  "wire",
  "wireOrcFileInput",
  "salvarProduto",
  "listarProdutos",
  "filtrarCatalogo",
  "calcularFaltaEntregar",
  "calcularResumoFinanceiro",
  "coletarDadosEntrega",
  "calcularSaldoAta"
];

const CTX_ALIASES = [
  "ORC_KEY",
  "ORC_KEY_LEGACY",
  "COFRE_KEY",
  "DOCS_CHECKLIST_KEY",
  "DOCS_ACCORDION_KEY",
  "LEILOES_PARTICIPO_KEY",
  "ACTIVE_LEILAO_KEY",
  "PNCP_WATCHES_KEY",
  "PNCP_ALERTS_KEY",
  "PNCP_INTERESSADOS_KEY",
  "CLOUD_META_KEY",
  "LAST_VIEW_KEY",
  "LEILAO_SCOPED_VIEWS",
  "CLOUD_LAST_UID_KEY",
  "ENTREGAS_KEY",
  "CATALOGO_KEY",
  "ARP_KEY",
  "HIST_ENTREGAS_KEY",
  "UF_LIST",
  "EDITAL_UNDS",
  "EDITAL_COTAS_TXT",
  "RE_EDITAL_HEAD",
  "RE_EDITAL_THEO_HEAD",
  "BLACKLIST",
  "PACK_JUNK",
  "PALAVRAS_RISCO",
  "COFRE_DOCS",
  "COFRE_MAX_FILE",
  "RE_INICIO_SPEC_EDITAL"
];

const RENAME = {
  "00-shell.js": "shell.js",
  "01-utils.js": "utils.js",
  "02-state.js": "state.js",
  "03-cloud-sync.js": "cloud-sync.js",
  "04-dom.js": "ui.js",
  "05-dashboard.js": "dashboard.js",
  "06-captacao.js": "captacao.js",
  "07-orcamento.js": "orcamento.js",
  "08-cruzamento.js": "cruzamento.js",
  "09-cofre.js": "cofre.js",
  "10-docs-checklist.js": "docs-checklist.js",
  "11-leiloes.js": "leiloes.js",
  "12-concorrencia.js": "concorrencia.js",
  "13-ferramentas.js": "ferramentas.js",
  "14-alertas.js": "alertas.js",
  "15-events-views.js": "events-views.js",
  "16-entregas.js": "entregas.js",
  "17-catalogo.js": "catalogo.js",
  "18-arp.js": "arp.js",
  "19-disputa.js": "disputa.js",
  "20-hist-entregas.js": "hist-entregas.js",
  "21-analise-ia.js": "analise-ia.js",
  "22-auth.js": "auth.js",
  "23-boot.js": "boot.js"
};

function usedIn(body, name) {
  const re = new RegExp("\\b" + name.replace(/\$/g, "\\$") + "\\b");
  return re.test(body);
}

function collectDeclared(body) {
  const declared = new Set();
  const re = /\b(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(body))) declared.add(m[1]);
  return declared;
}

function stripGlue(src, filename) {
  const start = src.indexOf('(function (LICSYSTEM) {');
  if (start < 0) return src;
  const strict = src.indexOf('"use strict";', start);
  const marker = src.indexOf("  /* =====", strict);
  const end = src.lastIndexOf("})(window.LICSYSTEM");
  if (strict < 0 || marker < 0 || end < 0) return src;

  const header = src.slice(0, strict + '"use strict";'.length);
  const bodyAndFooter = src.slice(marker);
  const body = src.slice(marker, end);
  const declared = collectDeclared(body);
  const isUtils = filename.includes("utils") || filename.includes("01-utils");

  let pre = "\n  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});\n";
  if (!isUtils && (usedIn(body, "utils") || usedIn(body, "LICSYSTEM.utils"))) {
    pre += "  var utils = LICSYSTEM.utils;\n";
  }
  if (!declared.has("el") && usedIn(body, "el")) {
    pre += "  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }\n";
  }
  if (!declared.has("showAlert") && usedIn(body, "showAlert")) {
    pre += "  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }\n";
  }
  if (!declared.has("hideAlert") && usedIn(body, "hideAlert")) {
    pre += "  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }\n";
  }
  for (const name of CTX_ALIASES) {
    if (!declared.has(name) && usedIn(body, name)) {
      pre += `  var ${name} = ctx.${name};\n`;
    }
  }
  for (const name of SHARED_FNS) {
    if (!declared.has(name) && usedIn(body, name)) {
      pre +=
        `  function ${name}(){\n` +
        `    var fn = ctx.${name} || window.${name} || LICSYSTEM.${name};\n` +
        `    if (typeof fn !== "function") throw new Error("${name} ainda não disponível");\n` +
        `    return fn.apply(this, arguments);\n` +
        `  }\n`;
    }
  }
  return header + "\n" + pre + "\n" + bodyAndFooter;
}

function patchElCall() {
  // el(id) helper: ctx.el(id) is cleaner than .call
}

function extractCaptacaoParsers(captacaoSrc) {
  const splitStart = captacaoSrc.indexOf("    splitEdital: function (text) {");
  const pickStart = captacaoSrc.indexOf("    pickOcrPages: function (pageTexts) {");
  const packStart = captacaoSrc.indexOf("    packApiItens: function (list) {");
  const extractStart = captacaoSrc.indexOf("    extractItensViaIa: function (images, textHint, filename) {");
  if (splitStart < 0 || pickStart < 0 || packStart < 0 || extractStart < 0) {
    throw new Error("Não achei os métodos da Captação para extrair parsers");
  }

  let splitFn = captacaoSrc.slice(splitStart, pickStart).replace(/,\s*$/, "").trimEnd();
  let packFn = captacaoSrc.slice(packStart, extractStart).replace(/,\s*$/, "").trimEnd();

  splitFn = splitFn.replace(/^    splitEdital: function/, "  LICSYSTEM.captacao.splitEdital = function");
  packFn = packFn.replace(/^    packApiItens: function/, "  LICSYSTEM.captacao.packApiItens = function");

  const without = captacaoSrc.slice(0, splitStart) + captacaoSrc.slice(pickStart, packStart) + captacaoSrc.slice(extractStart);
  return { without, splitFn, packFn };
}

// --- run ---
const files = fs.readdirSync(jsDir).filter((f) => f.endsWith(".js"));

for (const f of files) {
  if (f === "00-shell.js" || f === "shell.js") continue;
  const p = path.join(jsDir, f);
  let src = fs.readFileSync(p, "utf8");
  src = stripGlue(src, f);
  if (f === "04-dom.js" || f === "ui.js") {
    if (!src.includes("LICSYSTEM.el = el")) {
      src = src.replace(
        "  ctx.el = el;\n  ctx.showAlert = showAlert;\n  ctx.hideAlert = hideAlert;",
        "  ctx.el = el;\n  ctx.showAlert = showAlert;\n  ctx.hideAlert = hideAlert;\n  LICSYSTEM.el = el;\n  LICSYSTEM.showAlert = showAlert;\n  LICSYSTEM.hideAlert = hideAlert;"
      );
    }
  }
  if (f === "02-state.js" || f === "state.js") {
    if (!src.includes("LICSYSTEM.keys")) {
      src = src.replace(
        "  ctx.CLOUD_LAST_UID_KEY = CLOUD_LAST_UID_KEY;",
        `  ctx.CLOUD_LAST_UID_KEY = CLOUD_LAST_UID_KEY;
  LICSYSTEM.keys = {
    ORC_KEY: ORC_KEY,
    ORC_KEY_LEGACY: ORC_KEY_LEGACY,
    COFRE_KEY: COFRE_KEY,
    DOCS_CHECKLIST_KEY: DOCS_CHECKLIST_KEY,
    DOCS_ACCORDION_KEY: DOCS_ACCORDION_KEY,
    LEILOES_PARTICIPO_KEY: LEILOES_PARTICIPO_KEY,
    ACTIVE_LEILAO_KEY: ACTIVE_LEILAO_KEY,
    PNCP_WATCHES_KEY: PNCP_WATCHES_KEY,
    PNCP_ALERTS_KEY: PNCP_ALERTS_KEY,
    PNCP_INTERESSADOS_KEY: PNCP_INTERESSADOS_KEY,
    CLOUD_META_KEY: CLOUD_META_KEY,
    LAST_VIEW_KEY: LAST_VIEW_KEY,
    LEILAO_SCOPED_VIEWS: LEILAO_SCOPED_VIEWS,
    CLOUD_LAST_UID_KEY: CLOUD_LAST_UID_KEY
  };`
      );
    }
  }
  fs.writeFileSync(p, src, "utf8");
  console.log("stripped", f);
}

const capName = fs.existsSync(path.join(jsDir, "06-captacao.js")) ? "06-captacao.js" : "captacao.js";
const capPath = path.join(jsDir, capName);
const capSrc = fs.readFileSync(capPath, "utf8");
const extracted = extractCaptacaoParsers(capSrc);

const parsersBody = `/* LICSYSTEM — parsers de edital (Captação) */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var BLACKLIST = ctx.BLACKLIST;
  var EDITAL_UNDS = ctx.EDITAL_UNDS;
  var EDITAL_COTAS_TXT = ctx.EDITAL_COTAS_TXT;
  var RE_EDITAL_HEAD = ctx.RE_EDITAL_HEAD;
  var RE_EDITAL_THEO_HEAD = ctx.RE_EDITAL_THEO_HEAD;
  var RE_INICIO_SPEC_EDITAL = ctx.RE_INICIO_SPEC_EDITAL;

  LICSYSTEM.captacao = LICSYSTEM.captacao || {};

${extracted.splitFn};

${extracted.packFn};

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;

fs.writeFileSync(path.join(jsDir, "captacao-parsers.js"), parsersBody, "utf8");
fs.writeFileSync(capPath, extracted.without, "utf8");
console.log("wrote captacao-parsers.js and trimmed", capName);

// rename numbered files
for (const [from, to] of Object.entries(RENAME)) {
  const a = path.join(jsDir, from);
  const b = path.join(jsDir, to);
  if (fs.existsSync(a) && a !== b) {
    if (fs.existsSync(b)) fs.unlinkSync(b);
    fs.renameSync(a, b);
    console.log("rename", from, "→", to);
  }
}

const importOrder = [
  "shell.js",
  "utils.js",
  "state.js",
  "cloud-sync.js",
  "ui.js",
  "dashboard.js",
  "captacao-parsers.js",
  "captacao.js",
  "orcamento.js",
  "cruzamento.js",
  "cofre.js",
  "docs-checklist.js",
  "leiloes.js",
  "concorrencia.js",
  "ferramentas.js",
  "alertas.js",
  "events-views.js",
  "entregas.js",
  "catalogo.js",
  "arp.js",
  "disputa.js",
  "hist-entregas.js",
  "analise-ia.js",
  "auth.js",
  "boot.js"
];

fs.writeFileSync(
  path.join(root, "src", "app.js"),
  `/**
 * LICSYSTEM — app entry (módulos em src/js/, padrão Joninha)
 */\n` +
    importOrder.map((f) => `import "./js/${f}";`).join("\n") +
    "\n",
  "utf8"
);

fs.writeFileSync(
  path.join(jsDir, "shell.js"),
  `/* LICSYSTEM — shell (núcleo compartilhado, padrão Joninha ui/config) */
window.LICSYSTEM = window.LICSYSTEM || {};
window.LICSYSTEM._ctx = window.LICSYSTEM._ctx || {};
window.LICSYSTEM.keys = window.LICSYSTEM.keys || {};
`,
  "utf8"
);

console.log("OK — módulos endurecidos. Rode: npm run build");
