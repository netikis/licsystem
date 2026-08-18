/**
 * Fatia src/js/utils.js em core / edital / firebase / ML.
 *   node scripts/split-utils.mjs
 */
import fs from "fs";
import path from "path";

const root = path.resolve(".");
const srcPath = path.join(root, "src/js/utils.js");
const backupPath = path.join(root, "scripts/_utils.before-split.js");

if (!fs.existsSync(backupPath)) {
  fs.copyFileSync(srcPath, backupPath);
}
const lines = fs.readFileSync(backupPath, "utf8").split(/\r?\n/);

function slice(from1, to1) {
  return lines.slice(from1 - 1, to1).join("\n");
}

function wrap(title, body) {
  return `/* LICSYSTEM — ${title} */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils || (LICSYSTEM.utils = {});

${body.replace(/\s+$/, "")}

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;
}

const core = `/* LICSYSTEM — UTILS (núcleo) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});

${slice(7, 99)}

${slice(673, 771)}

${slice(1083, 1086)}

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
`;

const edital = wrap(
  "UTILS / edital (parse, blacklist, unidades)",
  slice(101, 671) +
    "\n\n  ctx.PACK_JUNK = PACK_JUNK;\n  ctx.BLACKLIST = BLACKLIST;\n  ctx.RE_INICIO_SPEC_EDITAL = RE_INICIO_SPEC_EDITAL;\n  ctx.EDITAL_UNDS = EDITAL_UNDS;\n  ctx.EDITAL_COTAS_TXT = EDITAL_COTAS_TXT;\n  ctx.RE_EDITAL_HEAD = RE_EDITAL_HEAD;\n  ctx.RE_EDITAL_THEO_HEAD = RE_EDITAL_THEO_HEAD;"
);

const firebase = wrap(
  "UTILS / Firebase",
  slice(773, 827) + "\n\n" + slice(1073, 1081)
);

const ml = wrap("UTILS / Mercado Livre", slice(829, 1071));

const files = [
  ["src/js/utils.js", core],
  ["src/js/utils-edital.js", edital],
  ["src/js/utils-firebase.js", firebase],
  ["src/js/utils-ml.js", ml],
];

for (const [rel, body] of files) {
  const out = body.replace(/\s+$/, "") + "\n";
  fs.writeFileSync(path.join(root, rel), out, "utf8");
  console.log(`  ${rel.padEnd(28)} ${(Buffer.byteLength(out) / 1024).toFixed(1)} KB`);
}
console.log("OK — utils fatiado.");
