/**
 * Fatia src/styles.css em partials (src/css/) e deixa o entry com @import.
 * Vite já resolve @import e gera um único CSS no build.
 *
 *   node scripts/split-styles.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const srcPath = path.join(root, "src/styles.css");
const backupPath = path.join(root, "scripts/_styles.before-split.css");
const cssDir = path.join(root, "src/css");

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = fs.readFileSync(backupPath, "utf8").split(/\r?\n/);

function slice(from1, to1) {
  return lines.slice(from1 - 1, to1).join("\n").replace(/\s+$/, "") + "\n";
}

function write(name, from1, to1, title) {
  const body =
    `/* LICSYSTEM — ${title} */\n` + slice(from1, to1);
  const dest = path.join(cssDir, name);
  fs.mkdirSync(cssDir, { recursive: true });
  fs.writeFileSync(dest, body, "utf8");
  console.log(
    `  css/${name.padEnd(28)} ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB  (L${from1}-${to1})`
  );
}

/**
 * Cortes pelos comentários de seção já existentes no arquivo.
 * Ranges 1-based inclusive.
 */
write("base.css", 1, 129, "tokens + layout (sidebar / app shell)");
write("auth.css", 130, 377, "auth gate + shell visual até cards");
write("components.css", 378, 484, "cards · forms · tables");
write("entregas.css", 485, 698, "entregas · config · histórico");
write("analise-ia.css", 699, 1019, "análise IA · markdown · chat launcher");
write("ui.css", 1020, 1061, "badges · alerts · dropzone");
write(
  "orcamento.css",
  1062,
  1512,
  "orçamento · licitações · workspace · docs · modais"
);
write("pesquisas.css", 1513, 1635, "cruzamento · proximos · perguntar editais");
write("cofre.css", 1636, 1729, "cofre de documentos + visualizador");
write("responsive.css", 1730, lines.length, "breakpoints 980 / 768 / 480");

const entry = `/**
 * LICSYSTEM — estilos (entry)
 * Partials em src/css/ — Vite junta tudo no build.
 */
@import "./css/base.css";
@import "./css/auth.css";
@import "./css/components.css";
@import "./css/entregas.css";
@import "./css/analise-ia.css";
@import "./css/ui.css";
@import "./css/orcamento.css";
@import "./css/pesquisas.css";
@import "./css/cofre.css";
@import "./css/responsive.css";
`;

fs.writeFileSync(srcPath, entry, "utf8");
console.log(`\n  styles.css (entry)               ${(Buffer.byteLength(entry) / 1024).toFixed(1)} KB`);
console.log("OK — CSS fatiado.");
