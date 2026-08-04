/**
 * Testes locais (sem browser) das regras de isolamento/salvamento do orçamento.
 * Rode: node scripts/test-orcamento-isolation.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const appJs = fs.readFileSync(path.join(root, "src", "app.js"), "utf8");
const styles = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");

let passed = 0;
let failed = 0;
const failures = [];

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log("  PASS  " + name);
  } else {
    failed++;
    failures.push(name + (detail ? " — " + detail : ""));
    console.log("  FAIL  " + name + (detail ? " — " + detail : ""));
  }
}

function has(src, needle, name) {
  ok(name || needle.slice(0, 60), src.includes(needle), "trecho não encontrado");
}

console.log("\n=== 1) Código: salvamento + confirmação ===");
has(appJs, "ORÇAMENTO SALVO", "mensagem ORÇAMENTO SALVO no salvarAgora");
has(appJs, "orcSaveToast", "toast flutuante orcSaveToast");
has(appJs, 'btn.innerHTML = "✅ ORÇAMENTO SALVO"', "botão muda para ORÇAMENTO SALVO");
has(appJs, 'flushPush("orcamento"', "flush imediato orcamento na nuvem");
has(appJs, 'flushPush("leiloesParticipo"', "flush imediato leiloesParticipo na nuvem");
has(appJs, "bindActive: true", "salvarAgora vincula ao edital ativo");
has(appJs, "saveActiveWorkspace({ immediate: true })", "workspace salvo com immediate");
has(indexHtml, 'id="btnSalvarOrc"', "botão Salvar orçamento no HTML");
has(indexHtml, 'id="orcAlert"', "alert orcAlert no HTML");
has(styles, "#orcSaveToast", "CSS do toast");
has(styles, "#orcAlert.show", "CSS sticky do alerta");

console.log("\n=== 2) Código: isolamento por edital ===");
has(appJs, "orcBoundLeilaoId", "estado orcBoundLeilaoId existe");
has(appJs, "var keepPrevOrc = !boundMatches;", "não sobrescreve orçamento se bound não bate");
has(appJs, "Sem vínculo explícito, não grava no edital ativo", "syncActiveOrcamento exige vínculo");
has(appJs, "if(!targetId) return;", "syncActiveOrcamento aborta sem target");
has(appJs, "leilaoId: dataForCloud.leilaoId", "pushKey preserva leilaoId na nuvem");
has(appJs, "raw.leilaoId != null", "load restaura leilaoId do localStorage");
has(appJs, "LICSYSTEM.state._orcRendered === false) return;", "syncFromDom ignora DOM stale");
has(appJs, "Carrega a planilha do edital ativo", "boot carrega workspace do edital ativo");

console.log("\n=== 3) Código: cores Compensa ===");
has(styles, ".orc-compensa-badge.is-ok", "CSS Compensa verde");
has(styles, ".orc-compensa-badge.is-bad", "CSS Não compensa vermelho");
has(appJs, 'background:#1e9e5a', "inline style Compensa verde");
has(appJs, 'background:#d23b3b', "inline style Não compensa vermelho");

console.log("\n=== 4) Simulação lógica: isolamento ===");

// Simula a regra keepPrevOrc / boundMatches usada em saveActiveWorkspace
function shouldOverwriteOrc(boundLeilaoId, activeId) {
  const boundMatches = !!(boundLeilaoId && String(boundLeilaoId) === String(activeId));
  return boundMatches; // só sobrescreve se bound === active
}

function syncTarget(payloadLeilaoId, bound, active) {
  // espelha syncActiveOrcamento: NÃO cai no active se bound/payload vazios
  const targetId = payloadLeilaoId || bound || null;
  if (!targetId) return null;
  if (bound && String(bound) !== String(targetId)) return null;
  if (payloadLeilaoId && String(payloadLeilaoId) !== String(targetId)) return null;
  return String(targetId);
}

ok(
  "Edital A bound → grava só em A",
  shouldOverwriteOrc("edital_A", "edital_A") === true
);
ok(
  "Bound A + active B → NÃO sobrescreve B",
  shouldOverwriteOrc("edital_A", "edital_B") === false
);
ok(
  "Bound null + active B → NÃO sobrescreve B (bug antigo)",
  shouldOverwriteOrc(null, "edital_B") === false
);
ok(
  "syncTarget com bound A grava em A",
  syncTarget("edital_A", "edital_A", "edital_B") === "edital_A"
);
ok(
  "syncTarget sem bound/payload NÃO grava no active",
  syncTarget(null, null, "edital_B") === null
);
ok(
  "syncTarget payload A + bound B aborta",
  syncTarget("edital_A", "edital_B", "edital_B") === null
);

// Simula dois editais e garante que preços de A não vão para B
const store = {
  edital_A: { meus: [{ vunit: 10, valorVenda: 20 }] },
  edital_B: { meus: [{ vunit: 0, valorVenda: 0 }] }
};
let memory = store.edital_A.meus.map((x) => ({ ...x }));
let bound = "edital_A";
let active = "edital_A";

function saveWorkspace() {
  if (!(bound && String(bound) === String(active))) return; // keep prev
  store[active].meus = memory.map((x) => ({ ...x }));
}
function switchEdital(id) {
  saveWorkspace();
  active = id;
  bound = id;
  memory = store[id].meus.map((x) => ({ ...x }));
}

// usuário edita A
memory[0].vunit = 99;
memory[0].valorVenda = 150;
saveWorkspace();
// troca para B
switchEdital("edital_B");
ok("Após trocar p/ B, memória de B continua zerada", memory[0].vunit === 0 && memory[0].valorVenda === 0);
ok("Edital A manteve preços próprios", store.edital_A.meus[0].vunit === 99 && store.edital_A.meus[0].valorVenda === 150);
ok("Edital B não recebeu preços de A", store.edital_B.meus[0].vunit === 0);

// cenário do bug antigo: bound null ao salvar no active B
memory = [{ vunit: 99, valorVenda: 150 }];
bound = null;
active = "edital_B";
const wouldOverwriteBug = shouldOverwriteOrc(bound, active);
ok("Com bound null, regra nova impede overwrite em B", wouldOverwriteBug === false);
if (!wouldOverwriteBug) {
  // B permanece
} else {
  store.edital_B.meus = memory;
}
ok("B permanece limpo após tentativa de overwrite sem bound", store.edital_B.meus[0].vunit === 0);

console.log("\n=== 5) Build artifacts (se existirem) ===");
const distCss = path.join(root, "dist", "assets");
let distHasBadge = false;
let distHasToast = false;
if (fs.existsSync(distCss)) {
  for (const f of fs.readdirSync(distCss)) {
    if (!f.endsWith(".css") && !f.endsWith(".js")) continue;
    const txt = fs.readFileSync(path.join(distCss, f), "utf8");
    if (txt.includes("orc-compensa-badge") || txt.includes("compensa-badge")) distHasBadge = true;
    if (txt.includes("orcSaveToast") || txt.includes("ORÇAMENTO SALVO")) distHasToast = true;
  }
  ok("dist contém estilos/refs de compensa badge ou toast", distHasBadge || distHasToast, "rode npm run build se acabou de alterar");
} else {
  console.log("  SKIP  pasta dist/ ainda não gerada");
}

console.log("\n========================================");
console.log(`Resultado: ${passed} passou, ${failed} falhou`);
if (failures.length) {
  console.log("Falhas:");
  failures.forEach((f) => console.log(" - " + f));
  process.exit(1);
}
console.log("Todos os testes locais passaram. Pode subir pro GitHub/Vercel.");
process.exit(0);
