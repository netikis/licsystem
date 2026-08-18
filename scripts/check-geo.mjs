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

const wrapGeom = {
  pages: [
    {
      rows: [
        { y: 700, cells: [cell(40, "Item"), cell(80, "Especificação"), cell(320, "Und."), cell(360, "Qtd."), cell(420, "PUMáx"), cell(500, "PTMáx")] },
        { y: 680, cells: [cell(40, "Lote 1: MATERIAIS"), cell(320, "PTL:"), cell(420, "R$ 80.507,57")] },
        {
          y: 660,
          cells: [cell(40, "1"), cell(80, "Caixa de passagem em concreto"), cell(320, "un"), cell(360, "7"), cell(420, "60,83"), cell(500, "425,81")]
        },
        {
          y: 640,
          cells: [cell(40, "2"), cell(80, "Quadro trifásico para 28 disjuntores"), cell(320, "un"), cell(360, "7")]
        },
        { y: 620, cells: [cell(420, "399,67"), cell(500, "2.797,69")] },
        { y: 600, cells: [cell(80, "(sobrepor/externo)")] },
        {
          y: 580,
          cells: [cell(40, "3"), cell(80, "Disjuntor bipolar 25 A"), cell(320, "un"), cell(360, "41")]
        },
        {
          y: 560,
          cells: [cell(80, "capacidade de interrupção mínima 6 kA"), cell(420, "45,78"), cell(500, "1.876,98")]
        }
      ]
    }
  ]
};
const wrapItens = splitEdital("Item Especificação Und. Qtd.", wrapGeom);
if (wrapItens.length !== 3) {
  console.error("FAIL wrap: esperava 3 itens, veio", wrapItens.length, wrapItens);
  process.exit(1);
}
if (String(wrapItens[0].lote) !== "1" || String(wrapItens[1].lote) !== "2" || String(wrapItens[2].lote) !== "3") {
  console.error("FAIL wrap lotes", wrapItens.map((it) => it.lote));
  process.exit(1);
}
if (Number(wrapItens[1].qtd) !== 7 || Number(wrapItens[1].editalVunit) < 399) {
  console.error("FAIL wrap item 2", wrapItens[1]);
  process.exit(1);
}
if (!/sobrepor/i.test(wrapItens[1].produto)) {
  console.error("FAIL wrap desc item 2", wrapItens[1].produto);
  process.exit(1);
}
if (Number(wrapItens[2].qtd) !== 41 || Number(wrapItens[2].editalVunit) < 45) {
  console.error("FAIL wrap item 3", wrapItens[2]);
  process.exit(1);
}
console.log("OK wrap ITEM→lote", wrapItens.map((it) => it.lote).join(","));
