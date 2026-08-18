/**
 * Fatia src/js/captacao.js em módulos por domínio (padrão Joninha).
 * Usa marcas estáveis (sem acento) — não tenta parsear chaves.
 *
 *   node scripts/split-captacao.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const srcPath = path.join(root, "src/js/captacao.js");
const backupPath = path.join(root, "scripts/_captacao.before-split.js");

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const raw = fs.readFileSync(backupPath, "utf8");
const lines = raw.split(/\r?\n/);

function findLine(re, from = 0) {
  for (let i = from; i < lines.length; i++) {
    if (re.test(lines[i])) return i;
  }
  throw new Error("Linha não encontrada: " + re + " (from " + from + ")");
}

const HEADER = `/* LICSYSTEM — {{TITLE}} */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
`;

const FOOTER = `
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;

const assignOpen = `  LICSYSTEM.captacao = Object.assign(LICSYSTEM.captacao || {}, {
`;
const assignClose = `  });
`;

// Limites das seções (linha 0-based, inclusivo no start / exclusivo no end)
const iBlacklist = findLine(/BLACKLIST:\s*BLACKLIST/);
const iOrigem = findLine(/ORIGEM_KEY:\s*"licsystem_origem_municipio_v1"/);
const iChat = findLine(/initChatEditais:\s*function/);
const iCollapse = findLine(/COLLAPSE_KEY:\s*"licsystem_captacao_collapse_v1"/);
const iPncp = findLine(/_pncpDataFinalProposta:\s*function/);
const iUfList = findLine(/ctx\.UF_LIST\s*=\s*UF_LIST/);
// Object.assign fecha na linha imediatamente anterior ao ctx.UF_LIST (geralmente `  });`)
let iAssignClose = iUfList - 1;
while (iAssignClose > iPncp && !/^\s*\}\);\s*$/.test(lines[iAssignClose])) {
  iAssignClose--;
}
if (iAssignClose <= iPncp) {
  throw new Error("Não achei o fechamento do Object.assign antes de ctx.UF_LIST");
}

const SECTIONS = [
  {
    file: "captacao.js",
    title: "CAPTACAO / IMPORTAR PDF",
    start: iBlacklist,
    end: iOrigem,
    extraTop: `  var BLACKLIST = ctx.BLACKLIST;
  function licsystemPdfHeader(){
    var fn = ctx.licsystemPdfHeader || window.licsystemPdfHeader || LICSYSTEM.licsystemPdfHeader;
    if (typeof fn !== "function") throw new Error("licsystemPdfHeader ainda não disponível");
    return fn.apply(this, arguments);
  }

  var UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

`,
    extraBottom: `
  ctx.UF_LIST = UF_LIST;
`,
  },
  {
    file: "captacao-proximos.js",
    title: "CAPTACAO / EDITAIS PROXIMOS",
    start: iOrigem,
    end: iChat,
  },
  {
    file: "captacao-chat.js",
    title: "CAPTACAO / CHAT EDITAIS",
    start: iChat,
    end: iCollapse,
  },
  {
    file: "captacao-pesquisas-ui.js",
    title: "CAPTACAO / COLLAPSE CARDS PESQUISAS",
    start: iCollapse,
    end: iPncp,
  },
  {
    file: "captacao-pncp.js",
    title: "CAPTACAO / RADAR PNCP",
    start: iPncp,
    end: iAssignClose,
  },
];

const outDir = path.join(root, "src/js");
const written = [];

for (const sec of SECTIONS) {
  let chunk = lines.slice(sec.start, sec.end).join("\n").trim();
  chunk = chunk.replace(/,+\s*$/, "");

  const header = HEADER.replace("{{TITLE}}", sec.title) + (sec.extraTop || "");
  const content =
    header +
    assignOpen +
    chunk +
    "\n" +
    assignClose +
    (sec.extraBottom || "") +
    FOOTER;

  const dest = path.join(outDir, sec.file);
  fs.writeFileSync(dest, content, "utf8");
  written.push({
    file: sec.file,
    bytes: Buffer.byteLength(content),
    lines: content.split("\n").length,
    from: sec.start + 1,
    to: sec.end,
  });
}

console.log("Captação fatiada:");
for (const w of written) {
  console.log(
    `  ${w.file.padEnd(28)} ${(w.bytes / 1024).toFixed(1)} KB  linhas ${w.from}-${w.to}  (${w.lines} linhas no arquivo)`
  );
}
