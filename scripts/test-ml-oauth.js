/* Teste local: OAuth client_credentials + busca MLB (não imprime o token). */
var fs = require("fs");
var path = require("path");

function loadEnv(file) {
  var text = fs.readFileSync(file, "utf8");
  text.split(/\r?\n/).forEach(function (line) {
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
  try {
    var t = await auth.getAccessToken();
    console.log("TOKEN_OK len=" + t.length + " prefix=" + t.slice(0, 8) + "...");
    var url =
      "https://api.mercadolibre.com/sites/MLB/search?q=" +
      encodeURIComponent("abracadeira borboleta") +
      "&limit=3";
    var r = await fetch(url, { headers: auth.authHeaders(t) });
    var text = await r.text();
    console.log("SEARCH_STATUS", r.status);
    console.log("SEARCH_BODY", text.slice(0, 400));
  } catch (e) {
    console.log("ERR", e.message, e.status || "", e.code || "");
    process.exitCode = 1;
  }
})();
