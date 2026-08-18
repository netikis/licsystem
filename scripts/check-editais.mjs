/**
 * Roda todos os PDFs de EDITAIS/ pelo mesmo splitEdital usado no navegador
 * e mostra quantidade de itens, total e a primeira/última descrição.
 *   node scripts/check-editais.mjs [filtro]
 */
import fs from "fs";
import path from "path";
import vm from "vm";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
const root = path.resolve(".");

async function extractAppText(filePath) {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjs.getDocument({ data, disableWorker: true }).promise;
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const tc = await page.getTextContent();
    const items = (tc.items || []).slice();
    items.sort((a, b) => {
      const ya = a.transform ? a.transform[5] : 0;
      const yb = b.transform ? b.transform[5] : 0;
      if (Math.abs(ya - yb) > 3) return yb - ya;
      return (a.transform ? a.transform[4] : 0) - (b.transform ? b.transform[4] : 0);
    });
    const lines = [];
    let buf = [];
    let lastY = null;
    for (const it of items) {
      const str = it.str || "";
      if (!str.trim()) continue;
      const y = it.transform ? it.transform[5] : 0;
      if (lastY !== null && Math.abs(y - lastY) > 3) {
        if (buf.length) lines.push(buf.join(" ").replace(/\s+/g, " ").trim());
        buf = [];
      }
      buf.push(str);
      lastY = y;
    }
    if (buf.length) lines.push(buf.join(" ").replace(/\s+/g, " ").trim());
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

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
  "src/js/captacao-modelos.js",
  "src/js/captacao-parsers.js",
]) {
  vm.runInContext(fs.readFileSync(path.join(root, rel), "utf8"), context, { filename: rel });
}
const splitEdital = context.window.LICSYSTEM.captacao.splitEdital;
const lastModelo = () =>
  (context.window.LICSYSTEM.captacao.modelos &&
    context.window.LICSYSTEM.captacao.modelos.last &&
    context.window.LICSYSTEM.captacao.modelos.last()) ||
  context.window.LICSYSTEM.captacao.lastModelo ||
  null;

const filtro = (process.argv[2] || "").toUpperCase();
const detalhar = Number(process.argv[3]) || 0;
const dir = path.join(root, "EDITAIS");
const nomes = fs
  .readdirSync(dir)
  .filter((n) => n.toLowerCase().endsWith(".pdf"))
  .filter((n) => !filtro || n.toUpperCase().includes(filtro));

const brl = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

for (const nome of nomes) {
  let itens = [];
  try {
    itens = splitEdital(await extractAppText(path.join(dir, nome)));
  } catch (e) {
    console.log(`\n${nome}\n   ERRO: ${e.message}`);
    continue;
  }
  const total = itens.reduce((s, i) => s + (Number(i.editalTotal) || 0), 0);
  const modelo = lastModelo();
  console.log(`\n${nome}`);
  console.log(`   ${itens.length} itens | total ${brl(total)}`);
  if (modelo) {
    console.log(`   modelo: ${modelo.id} — ${modelo.label}${modelo.via ? " [" + modelo.via + "]" : ""}`);
  }
  if (detalhar) {
    for (const it of itens.slice(0, detalhar)) {
      console.log(`\n   #${it.lote} | qtd=${it.qtd} ${it.und} | vu=${it.editalVunit} vt=${it.editalTotal}`);
      console.log(`   ${it.produto}`);
    }
  } else if (itens.length) {
    console.log(`   1º:  ${String(itens[0].produto).slice(0, 150)}`);
    console.log(`   últ: ${String(itens[itens.length - 1].produto).slice(0, 150)}`);
  }
}
