/**
 * Divide src/app.js (IIFE monolito) em src/js/*.js — padrão Joninha.
 * Backup: src/app.monolith.backup.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "src", "app.js");
const outDir = path.join(root, "src", "js");
const backupPath = path.join(root, "src", "app.monolith.backup.js");

const sourcePath = fs.existsSync(backupPath) ? backupPath : appPath;
if (!fs.existsSync(sourcePath)) {
  console.error("source not found:", sourcePath);
  process.exit(1);
}

const lines = fs.readFileSync(sourcePath, "utf8").split(/\r?\n/);

const SECTIONS = [
  { file: "01-utils.js", start: 6, end: 1086, title: "UTILS", publish: "utils" },
  { file: "02-state.js", start: 1087, end: 1149, title: "STATE / KEYS", publish: "state" },
  { file: "03-cloud-sync.js", start: 1150, end: 1900, title: "CLOUD SYNC", publish: "cloud" },
  { file: "04-dom.js", start: 1901, end: 1921, title: "DOM HELPERS + BELL", publish: "dom" },
  { file: "05-dashboard.js", start: 1922, end: 2006, title: "DASHBOARD" },
  { file: "06-captacao.js", start: 2007, end: 5919, title: "CAPTACAO", publish: "captacao" },
  { file: "07-orcamento.js", start: 5920, end: 6977, title: "ORCAMENTO" },
  { file: "08-cruzamento.js", start: 6978, end: 7455, title: "CRUZAMENTO" },
  { file: "09-cofre.js", start: 7456, end: 8310, title: "COFRE", publish: "cofre" },
  { file: "10-docs-checklist.js", start: 8311, end: 8930, title: "DOCS CHECKLIST" },
  { file: "11-leiloes.js", start: 8931, end: 9836, title: "LEILOES PARTICIPO" },
  { file: "12-concorrencia.js", start: 9837, end: 9929, title: "CONCORRENCIA + PDF HEADER", publish: "pdfheader" },
  { file: "13-ferramentas.js", start: 9930, end: 10116, title: "FERRAMENTAS", publish: "ferramentas" },
  { file: "14-alertas.js", start: 10117, end: 11203, title: "ALERTAS PNCP" },
  { file: "15-events-views.js", start: 11204, end: 11644, title: "EVENTS + VIEWS", publish: "events" },
  { file: "16-entregas.js", start: 11645, end: 11957, title: "ENTREGAS", publish: "entregas" },
  { file: "17-catalogo.js", start: 11958, end: 12193, title: "CATALOGO", publish: "catalogo" },
  { file: "18-arp.js", start: 12194, end: 12486, title: "ARP", publish: "arp" },
  { file: "19-disputa.js", start: 12487, end: 12833, title: "DISPUTA" },
  { file: "20-hist-entregas.js", start: 12834, end: 13128, title: "HIST ENTREGAS", publish: "hist" },
  { file: "21-analise-ia.js", start: 13129, end: 13811, title: "ANALISE IA" },
  { file: "22-auth.js", start: 13812, end: 14003, title: "AUTH" },
  { file: "23-boot.js", start: 14004, end: 14111, title: "BOOT" }
];

/** Funções que no monolito eram lexicais e agora precisam de bridge entre IIFEs */
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

function sliceLines(start, end) {
  return lines.slice(start - 1, end).join("\n").replace(/\r\n/g, "\n");
}

function collectDeclared(body) {
  const declared = new Set();
  const re = /\b(?:var|let|const|function)\s+([A-Za-z_$][\w$]*)/g;
  let m;
  while ((m = re.exec(body))) declared.add(m[1]);
  return declared;
}

function publishFooter(kind) {
  if (kind === "utils") {
    return `
  ctx.PACK_JUNK = PACK_JUNK;
  ctx.BLACKLIST = BLACKLIST;
  ctx.RE_INICIO_SPEC_EDITAL = RE_INICIO_SPEC_EDITAL;
  ctx.EDITAL_UNDS = EDITAL_UNDS;
  ctx.EDITAL_COTAS_TXT = EDITAL_COTAS_TXT;
  ctx.RE_EDITAL_HEAD = RE_EDITAL_HEAD;
  ctx.RE_EDITAL_THEO_HEAD = RE_EDITAL_THEO_HEAD;
`;
  }
  if (kind === "state") {
    return `
  ctx.ORC_KEY = ORC_KEY;
  ctx.ORC_KEY_LEGACY = ORC_KEY_LEGACY;
  ctx.COFRE_KEY = COFRE_KEY;
  ctx.DOCS_CHECKLIST_KEY = DOCS_CHECKLIST_KEY;
  ctx.DOCS_ACCORDION_KEY = DOCS_ACCORDION_KEY;
  ctx.LEILOES_PARTICIPO_KEY = LEILOES_PARTICIPO_KEY;
  ctx.ACTIVE_LEILAO_KEY = ACTIVE_LEILAO_KEY;
  ctx.PNCP_WATCHES_KEY = PNCP_WATCHES_KEY;
  ctx.PNCP_ALERTS_KEY = PNCP_ALERTS_KEY;
  ctx.PNCP_INTERESSADOS_KEY = PNCP_INTERESSADOS_KEY;
  ctx.CLOUD_META_KEY = CLOUD_META_KEY;
  ctx.LAST_VIEW_KEY = LAST_VIEW_KEY;
  ctx.LEILAO_SCOPED_VIEWS = LEILAO_SCOPED_VIEWS;
  ctx.CLOUD_LAST_UID_KEY = CLOUD_LAST_UID_KEY;
`;
  }
  if (kind === "cloud") {
    return `
  if (typeof PALAVRAS_RISCO !== "undefined") ctx.PALAVRAS_RISCO = PALAVRAS_RISCO;
`;
  }
  if (kind === "dom") {
    return `
  ctx.el = el;
  ctx.showAlert = showAlert;
  ctx.hideAlert = hideAlert;
`;
  }
  if (kind === "captacao") {
    return `
  ctx.UF_LIST = UF_LIST;
`;
  }
  if (kind === "pdfheader") {
    return `
  ctx.licsystemPdfHeader = licsystemPdfHeader;
  LICSYSTEM.licsystemPdfHeader = licsystemPdfHeader;
  window.licsystemPdfHeader = licsystemPdfHeader;
`;
  }
  if (kind === "ferramentas") {
    // Remove atribuição quebrada do monolito (licsystemPdfHeader vive no módulo anterior)
    return `
  if (ctx.licsystemPdfHeader) {
    LICSYSTEM.licsystemPdfHeader = ctx.licsystemPdfHeader;
    window.licsystemPdfHeader = ctx.licsystemPdfHeader;
  }
`;
  }
  if (kind === "events") {
    return `
  ctx.wire = wire;
  ctx.wireOrcFileInput = wireOrcFileInput;
  window.wireOrcFileInput = wireOrcFileInput;
  LICSYSTEM.wire = wire;
`;
  }
  if (kind === "cofre") {
    return `
  ctx.COFRE_DOCS = COFRE_DOCS;
  ctx.COFRE_MAX_FILE = COFRE_MAX_FILE;
`;
  }
  if (kind === "entregas") {
    return `
  ctx.ENTREGAS_KEY = ENTREGAS_KEY;
`;
  }
  if (kind === "catalogo") {
    return `
  ctx.CATALOGO_KEY = CATALOGO_KEY;
  ctx.salvarProduto = salvarProduto;
  ctx.listarProdutos = listarProdutos;
  ctx.filtrarCatalogo = filtrarCatalogo;
`;
  }
  if (kind === "arp") {
    return `
  ctx.ARP_KEY = ARP_KEY;
`;
  }
  if (kind === "hist") {
    return `
  ctx.HIST_ENTREGAS_KEY = HIST_ENTREGAS_KEY;
  ctx.calcularFaltaEntregar = calcularFaltaEntregar;
  ctx.calcularResumoFinanceiro = calcularResumoFinanceiro;
`;
  }
  return "";
}

function wrapModule(sec, body) {
  // Monolito atribuía licsystemPdfHeader aqui, mas a função ficou no módulo anterior
  if (sec.publish === "ferramentas") {
    body = body.replace(
      /^\s*LICSYSTEM\.licsystemPdfHeader\s*=\s*licsystemPdfHeader\s*;\s*$/m,
      "  // licsystemPdfHeader publicado em 12-concorrencia.js"
    );
  }

  const declared = collectDeclared(body);
  let pre =
    `  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});\n` +
    (declared.has("utils") || sec.publish === "utils"
      ? ""
      : `  var utils = LICSYSTEM.utils;\n`);

  if (!declared.has("el")) {
    pre +=
      `  function el(id){ return ctx.el ? ctx.el(id) : document.getElementById(id); }\n`;
  }
  if (!declared.has("showAlert")) {
    pre +=
      `  function showAlert(id, type, msg){ if (ctx.showAlert) return ctx.showAlert(id, type, msg); }\n`;
  }
  if (!declared.has("hideAlert")) {
    pre +=
      `  function hideAlert(id){ if (ctx.hideAlert) return ctx.hideAlert(id); }\n`;
  }

  for (const name of CTX_ALIASES) {
    if (!declared.has(name)) {
      pre += `  var ${name} = ctx.${name};\n`;
    }
  }

  // Bridges: resolve em tempo de chamada (após todos os módulos carregarem)
  for (const name of SHARED_FNS) {
    if (!declared.has(name)) {
      pre +=
        `  function ${name}(){\n` +
        `    var fn = ctx.${name} || window.${name} || LICSYSTEM.${name};\n` +
        `    if (typeof fn !== "function") throw new Error("${name} ainda não disponível");\n` +
        `    return fn.apply(this, arguments);\n` +
        `  }\n`;
    }
  }

  return (
    `/* LICSYSTEM — ${sec.title} (${sec.file}) */\n` +
    `(function (LICSYSTEM) {\n` +
    `  "use strict";\n` +
    pre +
    `\n` +
    body +
    `\n` +
    publishFooter(sec.publish) +
    `\n})(window.LICSYSTEM || (window.LICSYSTEM = {}));\n`
  );
}

if (!fs.existsSync(backupPath)) {
  if (appPath !== sourcePath || !fs.readFileSync(appPath, "utf8").includes("(function(){")) {
    // already split without backup — abort
    if (!fs.readFileSync(sourcePath, "utf8").includes("/* ============================ UTILS")) {
      console.error("Cannot find monolith source. Restore app.js first.");
      process.exit(1);
    }
  }
  fs.writeFileSync(backupPath, lines.join("\n"), "utf8");
  console.log("backup → src/app.monolith.backup.js");
} else {
  console.log("using existing backup as source");
}

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, "00-shell.js"),
  `/* LICSYSTEM — shell */\nwindow.LICSYSTEM = window.LICSYSTEM || {};\nwindow.LICSYSTEM._ctx = window.LICSYSTEM._ctx || {};\n`,
  "utf8"
);

for (const sec of SECTIONS) {
  const body = sliceLines(sec.start, sec.end);
  fs.writeFileSync(path.join(outDir, sec.file), wrapModule(sec, body), "utf8");
  console.log("wrote", sec.file, `(${sec.end - sec.start + 1} lines)`);
}

const imports = ["import \"./js/00-shell.js\";"]
  .concat(SECTIONS.map((s) => `import "./js/${s.file}";`))
  .join("\n");

fs.writeFileSync(
  path.join(root, "src", "app.js"),
  `/**
 * LICSYSTEM — app entry (módulos em src/js/, padrão Joninha)
 */\n${imports}\n`,
  "utf8"
);

console.log("OK — src/app.js agora só importa os módulos.");
console.log("Rode: npm run build");
