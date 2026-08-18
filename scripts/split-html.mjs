/**
 * Fatia index.html em partials (src/html/) e deixa o shell com @include.
 *   node scripts/split-html.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const indexPath = path.join(root, "index.html");
const backupPath = path.join(root, "scripts/_index.before-html-split.html");
const htmlDir = path.join(root, "src/html");
const viewsDir = path.join(htmlDir, "views");

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(indexPath, backupPath);
}
const raw = fs.readFileSync(backupPath, "utf8");
const lines = raw.split(/\r?\n/);

function slice(from1, to1) {
  return lines.slice(from1 - 1, to1).join("\n");
}

function write(rel, content) {
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const body = content.replace(/\s+$/, "") + "\n";
  fs.writeFileSync(dest, body, "utf8");
  console.log(`  ${rel.padEnd(42)} ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`);
}

fs.mkdirSync(viewsDir, { recursive: true });

// Ranges 1-based inclusive (from map)
write("src/html/auth-gate.html", slice(15, 49));
write("src/html/sidebar.html", slice(52, 111));
write("src/html/topbar.html", slice(115, 180));

const views = [
  ["dashboard.html", 182, 206],
  ["pesquisas.html", 207, 440],
  ["analise-ia.html", 441, 496],
  ["leiloes-participo.html", 497, 516],
  ["leilao-workspace.html", 517, 558],
  ["importar-edital.html", 559, 606],
  ["orcamento.html", 607, 691],
  ["cruzamento.html", 692, 740],
  ["cofre.html", 741, 767],
  ["docs-checklist.html", 768, 791],
  ["entregas.html", 792, 806],
  ["hist-entregas.html", 807, 879],
  ["concorrencia.html", 880, 895],
  ["catalogo.html", 896, 957],
  ["arp.html", 958, 1048],
  ["disputa.html", 1049, 1157],
  ["ferramentas.html", 1158, 1223],
];

for (const [name, a, b] of views) {
  write(`src/html/views/${name}`, slice(a, b));
}

write("src/html/modals.html", slice(1228, 1504));

const shell = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>LICSYSTEM — Sistema Licitação</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
<script src="https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<!-- CSS: src/styles.css (minificado no build) -->
</head>
<body class="auth-checking">
<!-- @include src/html/auth-gate.html -->

<div id="app">
  <!-- @include src/html/sidebar.html -->

  <!-- Nav: carregado via Vite (src/nav.js → index.js) -->

  <!-- ============ MAIN ============ -->
  <div id="main">
    <!-- @include src/html/topbar.html -->

    <div class="content">
      <!-- @include src/html/views/dashboard.html -->
      <!-- @include src/html/views/pesquisas.html -->
      <!-- @include src/html/views/analise-ia.html -->
      <!-- @include src/html/views/leiloes-participo.html -->
      <!-- @include src/html/views/leilao-workspace.html -->
      <!-- @include src/html/views/importar-edital.html -->
      <!-- @include src/html/views/orcamento.html -->
      <!-- @include src/html/views/cruzamento.html -->
      <!-- @include src/html/views/cofre.html -->
      <!-- @include src/html/views/docs-checklist.html -->
      <!-- @include src/html/views/entregas.html -->
      <!-- @include src/html/views/hist-entregas.html -->
      <!-- @include src/html/views/concorrencia.html -->
      <!-- @include src/html/views/catalogo.html -->
      <!-- @include src/html/views/arp.html -->
      <!-- @include src/html/views/disputa.html -->
      <!-- @include src/html/views/ferramentas.html -->
    </div>
  </div>
</div>

<!-- @include src/html/modals.html -->

<!-- =================================================================== -->
<!-- ============================ APP SCRIPT (Vite) ===================== -->
<script type="module" src="/index.js"></script>
</body>
</html>
`;

fs.writeFileSync(indexPath, shell, "utf8");
console.log(`\n  index.html (shell)                     ${(Buffer.byteLength(shell) / 1024).toFixed(1)} KB`);
console.log("OK — HTML fatiado.");
