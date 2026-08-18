/**
 * Fatia orcamento.js, alertas.js e leiloes.js por responsabilidade (padrão Joninha).
 *   node scripts/split-orcamento-alertas-leiloes.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const jsDir = path.join(root, "src/js");

const COMMON = `/* LICSYSTEM — {{TITLE}} */
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

function backupOnce(srcRel, bakRel) {
  const src = path.join(root, srcRel);
  const bak = path.join(root, bakRel);
  if (!fs.existsSync(bak)) fs.copyFileSync(src, bak);
  return fs.readFileSync(bak, "utf8");
}

function endOfStatement(lines, start) {
  let brace = 0;
  let bracket = 0;
  let paren = 0;
  let inBlockComment = false;
  for (let j = start; j < lines.length; j++) {
    const s = lines[j];
    let inStr = false;
    let strCh = "";
    let esc = false;
    for (let k = 0; k < s.length; k++) {
      const ch = s[k];
      const next = s[k + 1];
      if (inBlockComment) {
        if (ch === "*" && next === "/") {
          inBlockComment = false;
          k++;
        }
        continue;
      }
      if (inStr) {
        if (esc) {
          esc = false;
          continue;
        }
        if (ch === "\\") {
          esc = true;
          continue;
        }
        if (ch === strCh) inStr = false;
        continue;
      }
      if (ch === "/" && next === "/") break;
      if (ch === "/" && next === "*") {
        inBlockComment = true;
        k++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        inStr = true;
        strCh = ch;
        continue;
      }
      if (ch === "{") brace++;
      else if (ch === "}") brace--;
      else if (ch === "[") bracket++;
      else if (ch === "]") bracket--;
      else if (ch === "(") paren++;
      else if (ch === ")") paren--;
    }
    if (!inBlockComment && brace === 0 && bracket === 0 && paren === 0) return j;
  }
  throw new Error("Bloco não fecha a partir da linha " + (start + 1));
}

function extractMembers(raw, assignRe) {
  const lines = raw.split(/\r?\n/);
  const start = lines.findIndex((l) => assignRe.test(l));
  if (start < 0) throw new Error("Não achei " + assignRe);
  const members = [];
  let i = start + 1;
  while (i < lines.length) {
    const line = lines[i];
    if (/^\s*\};\s*$/.test(line)) break;
    const m = line.match(/^\s{4}([A-Za-z_][\w]*)\s*:/);
    if (!m) {
      i++;
      continue;
    }
    const end = endOfStatement(lines, i);
    let chunk = lines.slice(i, end + 1).join("\n").replace(/,+\s*$/, "");
    members.push({ name: m[1], text: chunk });
    i = end + 1;
  }
  if (!members.length) throw new Error("Nenhum membro extraído para " + assignRe);
  return members;
}

function writeSplit({ ns, titlePrefix, extrasByFile, groups, members }) {
  const byName = new Map(members.map((m) => [m.name, m]));
  const used = new Set();
  const written = [];

  for (const g of groups) {
    for (const name of g.names) {
      if (!byName.has(name)) throw new Error(ns + ": membro ausente: " + name);
      if (used.has(name)) throw new Error(ns + ": membro duplicado no grupo: " + name);
      used.add(name);
    }
  }
  for (const m of members) {
    if (!used.has(m.name)) {
      throw new Error(ns + ": membro não agrupado: " + m.name);
    }
  }

  for (const g of groups) {
    const body = g.names.map((n) => byName.get(n).text).join(",\n");
    const extras = extrasByFile[g.file] || "";
    const content =
      COMMON.replace("{{TITLE}}", titlePrefix + " / " + g.title) +
      extras +
      `\n  LICSYSTEM.${ns} = Object.assign(LICSYSTEM.${ns} || {}, {\n` +
      body +
      "\n  });\n" +
      FOOTER;
    const dest = path.join(jsDir, g.file);
    fs.writeFileSync(dest, content, "utf8");
    written.push({
      file: g.file,
      kb: (Buffer.byteLength(content) / 1024).toFixed(1),
      names: g.names.length,
    });
  }
  return written;
}

/* -------------------- ORÇAMENTO -------------------- */
const orcRaw = backupOnce("src/js/orcamento.js", "scripts/_orcamento.before-split.js");
const orcMembers = extractMembers(orcRaw, /LICSYSTEM\.orcamento\s*=\s*\{/);
const orcExtras = {
  "orcamento.js": `  var ORC_KEY = ctx.ORC_KEY;
  var ORC_KEY_LEGACY = ctx.ORC_KEY_LEGACY;
`,
  "orcamento-import.js": `  function wireOrcFileInput(){
    var fn = ctx.wireOrcFileInput || window.wireOrcFileInput || LICSYSTEM.wireOrcFileInput;
    if (typeof fn !== "function") throw new Error("wireOrcFileInput ainda não disponível");
    return fn.apply(this, arguments);
  }
`,
  "orcamento-io.js": `  function licsystemPdfHeader(){
    var fn = ctx.licsystemPdfHeader || window.licsystemPdfHeader || LICSYSTEM.licsystemPdfHeader;
    if (typeof fn !== "function") throw new Error("licsystemPdfHeader ainda não disponível");
    return fn.apply(this, arguments);
  }
  function listarProdutos(){
    var fn = ctx.listarProdutos || window.listarProdutos || LICSYSTEM.listarProdutos;
    if (typeof fn !== "function") throw new Error("listarProdutos ainda não disponível");
    return fn.apply(this, arguments);
  }
`,
};
const orcWritten = writeSplit({
  ns: "orcamento",
  titlePrefix: "ORCAMENTO",
  extrasByFile: orcExtras,
  members: orcMembers,
  groups: [
    {
      file: "orcamento.js",
      title: "PLANILHA",
      names: [
        "emptyItem",
        "normalizeItem",
        "calcPctFromVenda",
        "calcVendaFromPct",
        "syncPricing",
        "evalCompensa",
        "calcEditalTotal",
        "calcVendaUnit",
        "calcTotal",
        "isEmptyRow",
        "load",
        "save",
        "salvarAgora",
        "scheduleSave",
        "flushSave",
        "syncFromDom",
        "pageCount",
        "clampPage",
        "updatePager",
        "goPage",
        "render",
        "addLinha",
        "addFromLines",
        "limpar",
        "updateMeta",
        "onEdit",
      ],
    },
    {
      file: "orcamento-import.js",
      title: "IMPORTAR PLANILHA",
      names: ["handleFile", "_restoreDrop", "_mapRows"],
    },
    {
      file: "orcamento-io.js",
      title: "EXPORT / CATALOGO / PROPOSTA",
      names: [
        "exportarExcel",
        "exportarPdf",
        "abrirModalSalvarCatalogo",
        "fecharModalSalvarCatalogo",
        "confirmarSalvarCatalogo",
        "abrirDoCatalogo",
        "propostaRows",
        "gerarProposta",
        "gerarPropostaExcel",
      ],
    },
  ],
});

/* -------------------- ALERTAS -------------------- */
const alRaw = backupOnce("src/js/alertas.js", "scripts/_alertas.before-split.js");
const alMembers = extractMembers(alRaw, /LICSYSTEM\.alertas\s*=\s*\{/);
const alExtras = {
  "alertas.js": `  var PNCP_WATCHES_KEY = ctx.PNCP_WATCHES_KEY;
  var PNCP_ALERTS_KEY = ctx.PNCP_ALERTS_KEY;
  var PNCP_INTERESSADOS_KEY = ctx.PNCP_INTERESSADOS_KEY;
`,
};
const alWritten = writeSplit({
  ns: "alertas",
  titlePrefix: "ALERTAS PNCP",
  extrasByFile: alExtras,
  members: alMembers,
  groups: [
    {
      file: "alertas.js",
      title: "DADOS",
      names: [
        "CHECK_MS",
        "MAX_WATCHES",
        "MAX_ALERTS",
        "MAX_SEEN",
        "MAX_INTERESSADOS",
        "watches",
        "alerts",
        "interessados",
        "_timer",
        "_busy",
        "_wired",
        "_panelOpen",
        "load",
        "normalizeWatch",
        "normalizeAlert",
        "pickDataPrazo",
        "pickDataAbertura",
        "enrichAlertsFromRows",
        "alertsMissingPrazo",
        "applyWatches",
        "applyAlerts",
        "persistWatches",
        "persistAlerts",
        "persistInteressados",
        "editalKey",
        "unreadCount",
      ],
    },
    {
      file: "alertas-ui.js",
      title: "UI",
      names: [
        "updateBell",
        "setPanelOpen",
        "togglePanel",
        "renderPanelList",
        "prazoTs",
        "formatPrazo",
        "sortByPrazo",
        "isPrazoUrgente",
        "balloonHtml",
        "renderEditaisBalloons",
        "updateCollapseSummary",
        "renderInteressadosIa",
        "renderWatches",
      ],
    },
    {
      file: "alertas-check.js",
      title: "MONITORAMENTO",
      names: [
        "findWatch",
        "upsertWatch",
        "removeWatch",
        "toggleWatch",
        "markRead",
        "markAllRead",
        "findAlert",
        "removeAlert",
        "dismissAlert",
        "markInteresse",
        "removeInteressado",
        "trimSeen",
        "addNovos",
        "checkWatch",
        "checkAll",
        "createFromRadar",
        "createFromChat",
        "createFromProximos",
        "startPolling",
        "stopPolling",
        "onLogin",
        "onLogout",
        "wire",
      ],
    },
  ],
});

/* -------------------- LEILÕES -------------------- */
const lpRaw = backupOnce("src/js/leiloes.js", "scripts/_leiloes.before-split.js");
const lpMembers = extractMembers(lpRaw, /LICSYSTEM\.leiloesParticipo\s*=\s*\{/);
const lpExtras = {
  "leiloes.js": `  var LEILOES_PARTICIPO_KEY = ctx.LEILOES_PARTICIPO_KEY;
  var ACTIVE_LEILAO_KEY = ctx.ACTIVE_LEILAO_KEY;
`,
  "leiloes-workspace.js": `  var LEILAO_SCOPED_VIEWS = ctx.LEILAO_SCOPED_VIEWS;
`,
};
const lpWritten = writeSplit({
  ns: "leiloesParticipo",
  titlePrefix: "LICITACOES QUE PARTICIPO",
  extrasByFile: lpExtras,
  members: lpMembers,
  groups: [
    {
      file: "leiloes.js",
      title: "LISTA",
      names: [
        "items",
        "load",
        "applyData",
        "normalizeWorkspace",
        "emptyWorkspace",
        "normalizeItem",
        "findById",
        "getActiveItem",
        "setActiveId",
        "limparAvisosDoEdital",
        "restoreActiveId",
        "persist",
        "archive",
        "remove",
        "render",
        "encaminharParaEntrega",
      ],
    },
    {
      file: "leiloes-workspace.js",
      title: "WORKSPACE",
      names: [
        "syncActiveOrcamento",
        "saveActiveWorkspace",
        "loadActiveWorkspace",
        "updateContextBar",
        "renderHub",
        "openWorkspace",
        "openTool",
        "closeWorkspace",
        "wireWorkspaceUi",
        "openDocs",
      ],
    },
    {
      file: "leiloes-participar.js",
      title: "ANALISE / PARTICIPAR",
      names: [
        "extractMetaFromReport",
        "buildFromAnalysis",
        "findDuplicate",
        "addFromAnalysis",
        "anexarPdfDaAnalise",
        "showParticiparModal",
        "renderParticipantesLoading",
        "formatCnpj",
        "renderParticipantesResult",
        "loadParticipantesAnalysis",
        "closeParticiparModal",
        "confirmSim",
        "confirmNao",
      ],
    },
  ],
});

console.log("Orçamento:");
for (const w of orcWritten) console.log(`  ${w.file.padEnd(24)} ${w.kb} KB  (${w.names} membros)`);
console.log("Alertas:");
for (const w of alWritten) console.log(`  ${w.file.padEnd(24)} ${w.kb} KB  (${w.names} membros)`);
console.log("Licitações que participo:");
for (const w of lpWritten) console.log(`  ${w.file.padEnd(24)} ${w.kb} KB  (${w.names} membros)`);
