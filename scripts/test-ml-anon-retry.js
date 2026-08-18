/* Testa Bearer vs anônimo em /sites/MLB/search */
var fs = require("fs");
var path = require("path");

function loadEnv(file) {
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === "#") return;
      var i = line.indexOf("=");
      if (i < 1) return;
      var k = line.slice(0, i).trim();
      var v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    });
}

loadEnv(path.join(__dirname, "..", ".env"));
var auth = require("../api/_lib/ml-auth");

(async function () {
  var q = "abracadeira borboleta";
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=2";
  var token = await auth.getAccessToken();
  var hBearer = { Accept: "application/json", Authorization: "Bearer " + token };
  var hAnon = { Accept: "application/json" };

  var r1 = await fetch(url, { headers: hBearer });
  var t1 = await r1.text();
  console.log("BEARER", r1.status, t1.slice(0, 180));

  var r2 = await fetch(url, { headers: hAnon });
  var t2 = await r2.text();
  console.log("ANON", r2.status, t2.slice(0, 180));
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
