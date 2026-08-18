/**
 * Fatia captacao-parsers.js por família de layout (padrão Joninha).
 * Cada família registra splitters via install(deps); o core despacha.
 *
 *   node scripts/split-captacao-parsers.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const srcPath = path.join(root, "src/js/captacao-parsers.js");
const backupPath = path.join(root, "scripts/_captacao-parsers.before-split.js");

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const raw = fs.readFileSync(backupPath, "utf8");
const lines = raw.split(/\r?\n/);

/** Extrai linhas [start, end) 1-based inclusive start, exclusive end+1 style: startLine..endLine inclusive 1-based */
function sliceLines(from1, to1Inclusive) {
  return lines.slice(from1 - 1, to1Inclusive).join("\n");
}

/** Remove 2 espaços de indentação (sai do nest de splitEdital). */
function unindent2(block) {
  return block
    .split("\n")
    .map((ln) => (ln.startsWith("      ") ? ln.slice(2) : ln))
    .join("\n");
}

const HEADER = `/* LICSYSTEM — {{TITLE}} */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});
`;

const FOOTER = `
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;

/**
 * Ranges 1-based inclusive, from the nested-function list.
 * End = line before next sibling (or last line of function block).
 */
const R = {
  limparPagina: [16, 64],
  pushParsed: [66, 69],
  dedupeCaptacao: [71, 94],
  saoMateus: [103, 270],
  contenda: [280, 499],
  tresBarras: [509, 709],
  maringa: [718, 853],
  campo: [861, 1055],
  packMunicipio: [1057, 1104],
  godoy: [1110, 1154],
  repairIvai: [1156, 1164],
  ivai: [1170, 1232],
  municipalHelpers: [1234, 1385],
  cambe: [1391, 1449],
  itapejara: [1455, 1514],
  sjp: [1519, 1578],
  relacao: [1585, 1685],
  theo: [1694, 1716],
  cutAfter: [1722, 1739],
  normalizeCastro: [1749, 1836],
  castro: [1843, 1911],
  cortarPorIndices: [1913, 1927],
  chunk: [1930, 2013],
  dispatcher: [2015, 2306],
  packApi: [2309, 2360],
};

function chunk(key) {
  const [a, b] = R[key];
  return unindent2(sliceLines(a, b));
}

function joinChunks(keys) {
  return keys.map(chunk).join("\n\n");
}

// ---------- família: Elotech ----------
const elotech = `${HEADER.replace("{{TITLE}}", "parsers / Elotech (S. Mateus · Contenda · Três Barras)")}
  /**
   * Instala splitters Elotech no bag (fecha sobre limparPagina / utils / EDITAL_UNDS).
   */
  bag.installElotech = function (deps) {
    var limparPagina = deps.limparPagina;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;

${joinChunks(["saoMateus", "contenda", "tresBarras"])}

    deps.splitSaoMateusBlocks = splitSaoMateusBlocks;
    deps.splitContendaBlocks = splitContendaBlocks;
    deps.splitTresBarrasBlocks = splitTresBarrasBlocks;
  };
${FOOTER}`;

// ---------- família: Maringá / Campo ----------
const maringa = `${HEADER.replace("{{TITLE}}", "parsers / Maringá · Campo do Tenente")}
  bag.installMaringa = function (deps) {
    var limparPagina = deps.limparPagina;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;

${joinChunks(["maringa", "campo"])}

    deps.splitMaringaBlocks = splitMaringaBlocks;
    deps.splitCampoTenenteBlocks = splitCampoTenenteBlocks;
  };
${FOOTER}`;

// ---------- família: municipais (Godoy · Ivaí · Cambé · Itapejara · SJP) ----------
const municipais = `${HEADER.replace("{{TITLE}}", "parsers / municipais (Godoy · Ivaí · Cambé · Itapejara · SJP)")}
  bag.installMunicipais = function (deps) {
    var limparPagina = deps.limparPagina;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;

${joinChunks([
  "packMunicipio",
  "godoy",
  "repairIvai",
  "ivai",
  "municipalHelpers",
  "cambe",
  "itapejara",
  "sjp",
])}

    deps.packMunicipioRow = packMunicipioRow;
    deps.splitGodoyMoreiraBlocks = splitGodoyMoreiraBlocks;
    deps.splitSaoJoaoIvaiBlocks = splitSaoJoaoIvaiBlocks;
    deps.splitCambeBlocks = splitCambeBlocks;
    deps.splitItapejaraBlocks = splitItapejaraBlocks;
    deps.splitSaoJosePinhaisBlocks = splitSaoJosePinhaisBlocks;
  };
${FOOTER}`;

// ---------- família: clássico / THEO / Castro / planilha ----------
const classico = `${HEADER.replace("{{TITLE}}", "parsers / clássico · THEO · Castro · planilha")}
  bag.installClassico = function (deps) {
    var limparPagina = deps.limparPagina;
    var pushParsed = deps.pushParsed;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;
    var EDITAL_COTAS_TXT = deps.EDITAL_COTAS_TXT;
    var RE_EDITAL_HEAD = deps.RE_EDITAL_HEAD;
    var RE_EDITAL_THEO_HEAD = deps.RE_EDITAL_THEO_HEAD;
    var RE_INICIO_SPEC_EDITAL = deps.RE_INICIO_SPEC_EDITAL;

${joinChunks([
  "relacao",
  "theo",
  "cutAfter",
  "normalizeCastro",
  "castro",
  "cortarPorIndices",
  "chunk",
])}

    deps.splitRelacaoItensBlocks = splitRelacaoItensBlocks;
    deps.splitTheoBlocks = splitTheoBlocks;
    deps.splitCastroBlocks = splitCastroBlocks;
    deps.splitChunkPlanilha = splitChunkPlanilha;
  };
${FOOTER}`;

// ---------- core: helpers + dispatcher ----------
const core = `/* LICSYSTEM — parsers de edital (core / despachante) */
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
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

${chunk("limparPagina")}

${chunk("pushParsed")}

${chunk("dedupeCaptacao")}

  function ensureSplitters() {
    if (bag._installed) return bag;
    var deps = {
      limparPagina: limparPagina,
      pushParsed: pushParsed,
      dedupeCaptacao: dedupeCaptacao,
      utils: utils,
      EDITAL_UNDS: EDITAL_UNDS,
      EDITAL_COTAS_TXT: EDITAL_COTAS_TXT,
      RE_EDITAL_HEAD: RE_EDITAL_HEAD,
      RE_EDITAL_THEO_HEAD: RE_EDITAL_THEO_HEAD,
      RE_INICIO_SPEC_EDITAL: RE_INICIO_SPEC_EDITAL
    };
    if (typeof bag.installElotech === "function") bag.installElotech(deps);
    if (typeof bag.installMaringa === "function") bag.installMaringa(deps);
    if (typeof bag.installMunicipais === "function") bag.installMunicipais(deps);
    if (typeof bag.installClassico === "function") bag.installClassico(deps);
    Object.keys(deps).forEach(function (k) {
      bag[k] = deps[k];
    });
    bag._installed = true;
    return bag;
  }

  LICSYSTEM.captacao.splitEdital = function (text) {
      var P = ensureSplitters();
      var limparPagina = P.limparPagina;
      var pushParsed = P.pushParsed;
      var dedupeCaptacao = P.dedupeCaptacao;
      var splitSaoMateusBlocks = P.splitSaoMateusBlocks;
      var splitContendaBlocks = P.splitContendaBlocks;
      var splitTresBarrasBlocks = P.splitTresBarrasBlocks;
      var splitMaringaBlocks = P.splitMaringaBlocks;
      var splitCampoTenenteBlocks = P.splitCampoTenenteBlocks;
      var splitGodoyMoreiraBlocks = P.splitGodoyMoreiraBlocks;
      var splitSaoJoaoIvaiBlocks = P.splitSaoJoaoIvaiBlocks;
      var splitCambeBlocks = P.splitCambeBlocks;
      var splitItapejaraBlocks = P.splitItapejaraBlocks;
      var splitSaoJosePinhaisBlocks = P.splitSaoJosePinhaisBlocks;
      var splitRelacaoItensBlocks = P.splitRelacaoItensBlocks;
      var splitTheoBlocks = P.splitTheoBlocks;
      var splitCastroBlocks = P.splitCastroBlocks;
      var splitChunkPlanilha = P.splitChunkPlanilha;

${chunk("dispatcher")}
  };

${unindent2(sliceLines(R.packApi[0], R.packApi[1]))}

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;

const out = path.join(root, "src/js");
const files = [
  ["captacao-parsers.js", core],
  ["captacao-parsers-elotech.js", elotech],
  ["captacao-parsers-maringa.js", maringa],
  ["captacao-parsers-municipais.js", municipais],
  ["captacao-parsers-classico.js", classico],
];

for (const [name, content] of files) {
  fs.writeFileSync(path.join(out, name), content, "utf8");
  const bytes = Buffer.byteLength(content);
  console.log(
    `  ${name.padEnd(36)} ${(bytes / 1024).toFixed(1)} KB  (${content.split("\n").length} linhas)`
  );
}
console.log("OK — parsers fatiados.");
