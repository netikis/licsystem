/**
 * Teste sintético da camada geométrica (sem PDF).
 *   node scripts/check-geo.mjs
 */
import fs from "fs";
import path from "path";
import vm from "vm";

const root = path.resolve(".");
const context = { console, window: {}, document: {}, navigator: {}, setTimeout, clearTimeout, Intl };
context.window.window = context.window;
vm.createContext(context);
for (const rel of [
  "src/js/shell.js",
  "src/js/utils.js",
  "src/js/utils-edital.js",
  "src/js/captacao-parsers-elotech.js",
  "src/js/captacao-parsers-maringa.js",
  "src/js/captacao-parsers-municipais.js",
  "src/js/captacao-parsers-classico.js",
  "src/js/captacao-parsers-geo.js",
  "src/js/captacao-modelos.js",
  "src/js/captacao-parsers.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
}

const bag = context.window.LICSYSTEM.captacaoParsers;
const splitEdital = context.window.LICSYSTEM.captacao.splitEdital;

function cell(x, text, w) {
  return { x, w: w || Math.max(12, String(text).length * 6), text };
}

const geom = {
  pages: [
    {
      rows: [
        { y: 700, cells: [cell(40, "ITEM"), cell(80, "DESCRIÇÃO"), cell(320, "UND"), cell(360, "QTD"), cell(420, "UNIT"), cell(500, "TOTAL")] },
        {
          y: 680,
          cells: [
            cell(40, "1"),
            cell(80, "Abraçadeira de nylon 380mm"),
            cell(320, "UN"),
            cell(360, "100,000"),
            cell(420, "5,06"),
            cell(500, "506,00")
          ]
        },
        {
          y: 660,
          cells: [
            cell(40, "2"),
            cell(80, "Fita isolante 19mm"),
            cell(320, "UN"),
            cell(360, "50"),
            cell(420, "2,50"),
            cell(500, "125,00")
          ]
        },
        {
          y: 640,
          cells: [
            cell(40, "3"),
            cell(80, "Parafuso sextavado 8x40"),
            cell(320, "UN"),
            cell(360, "200"),
            cell(420, "R$ 1,20"),
            cell(500, "R$ 240,00")
          ]
        }
      ]
    }
  ]
};

const text =
  "Prefeitura de Teste\nITEM DESCRIÇÃO UND QTD UNIT TOTAL\n1 Abraçadeira de nylon 380mm UN 100,000 5,06 506,00";
const itens = splitEdital(text, geom);
const modelo = context.window.LICSYSTEM.captacao.lastModelo;

if (itens.length < 3) {
  console.error("FAIL: esperava 3 itens, veio", itens.length, modelo);
  process.exit(1);
}
if (!itens[0].produto.toLowerCase().includes("abraçadeira") && !itens[0].produto.toLowerCase().includes("abracadeira")) {
  console.error("FAIL: descrição 1", itens[0].produto);
  process.exit(1);
}
if (Number(itens[2].editalVunit) < 1) {
  console.error("FAIL: vunit item 3", itens[2]);
  process.exit(1);
}
console.log("OK", itens.length, "itens via", modelo && modelo.id, "-", modelo && modelo.label);
itens.forEach((it) => {
  console.log(`  #${it.lote} qtd=${it.qtd} vu=${it.editalVunit} vt=${it.editalTotal} ${it.produto}`);
});
