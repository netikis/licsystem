/**
 * Fatia src/i18n.js em dicionários por idioma + motor.
 *   node scripts/split-i18n.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const srcPath = path.join(root, "src/i18n.js");
const backupPath = path.join(root, "scripts/_i18n.before-split.js");
const dir = path.join(root, "src/i18n");

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = fs.readFileSync(backupPath, "utf8").split(/\r?\n/);

function slice(from1, to1) {
  return lines.slice(from1 - 1, to1).join("\n");
}

function wrapDict(lang, from1, to1) {
  const inner = slice(from1, to1);
  return `/* LICSYSTEM — i18n dicionário ${lang} */
(function (LICSYSTEM) {
  "use strict";
  var bag = LICSYSTEM._i18n || (LICSYSTEM._i18n = { dict: {}, phrases: {} });
  bag.dict[${JSON.stringify(lang)}] = {
${inner}
  };
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;
}

function wrapPhrases(lang, from1, to1) {
  const inner = slice(from1, to1);
  return `/* LICSYSTEM — i18n frases estáticas ${lang} */
(function (LICSYSTEM) {
  "use strict";
  var bag = LICSYSTEM._i18n || (LICSYSTEM._i18n = { dict: {}, phrases: {} });
  bag.phrases[${JSON.stringify(lang)}] = {
${inner}
  };
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;
}

fs.mkdirSync(dir, { recursive: true });

const files = [
  ["src/i18n/dict-pt-BR.js", wrapDict("pt-BR", 13, 107)],
  ["src/i18n/dict-en.js", wrapDict("en", 110, 204)],
  ["src/i18n/dict-es.js", wrapDict("es", 207, 301)],
  ["src/i18n/phrases-en.js", wrapPhrases("en", 307, 684)],
  ["src/i18n/phrases-es.js", wrapPhrases("es", 687, 1064)],
];

for (const [rel, body] of files) {
  fs.writeFileSync(path.join(root, rel), body.replace(/\s+$/, "") + "\n", "utf8");
  console.log(
    `  ${rel.padEnd(32)} ${(Buffer.byteLength(body) / 1024).toFixed(1)} KB`
  );
}

const engineHead = `/**
 * LICSYSTEM — internacionalização (motor)
 * Dicionários em src/i18n/dict-*.js e src/i18n/phrases-*.js
 * Idiomas: pt-BR (padrão), en, es
 * - data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-aria
 * - Tradução automática de frases estáticas (PHRASES) sem data-i18n
 */
(function () {
  var LANG_KEY = "licsystem_lang_v1";
  var SUPPORTED = ["pt-BR", "en", "es"];
  window.LICSYSTEM = window.LICSYSTEM || {};
  var bag = LICSYSTEM._i18n || (LICSYSTEM._i18n = { dict: {}, phrases: {} });
  var DICT = bag.dict;
  var PHRASES = bag.phrases;

`;

const engineTail = slice(1068, lines.length);
const engine = engineHead + engineTail;
fs.writeFileSync(srcPath, engine.replace(/\s+$/, "") + "\n", "utf8");
console.log(`  src/i18n.js (motor)               ${(Buffer.byteLength(engine) / 1024).toFixed(1)} KB`);
console.log("OK — i18n fatiado.");
