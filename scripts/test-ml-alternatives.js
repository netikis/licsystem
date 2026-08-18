/* Descobre qual caminho ainda devolve produtos (token + fallbacks). */
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

async function probe(name, url, headers) {
  try {
    var r = await fetch(url, { headers: headers || { Accept: "application/json" } });
    var t = await r.text();
    console.log("\n== " + name + " ==");
    console.log("status", r.status, "len", t.length);
    console.log(t.slice(0, 220).replace(/\s+/g, " "));
    return { status: r.status, text: t };
  } catch (e) {
    console.log("\n== " + name + " ==");
    console.log("ERR", e.message);
    return null;
  }
}

(async function () {
  var token = await auth.getAccessToken();
  var bearer = {
    Accept: "application/json",
    Authorization: "Bearer " + token,
  };
  var q = "abracadeira borboleta";

  await probe(
    "search bearer",
    "https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(q) + "&limit=2",
    bearer
  );
  await probe(
    "search anon",
    "https://api.mercadolibre.com/sites/MLB/search?q=" + encodeURIComponent(q) + "&limit=2",
    { Accept: "application/json" }
  );
  await probe(
    "products catalog sample",
    "https://api.mercadolibre.com/products/MLB27621585",
    bearer
  );
  await probe(
    "products catalog anon",
    "https://api.mercadolibre.com/products/MLB27621585",
    { Accept: "application/json" }
  );
  await probe(
    "items sample bearer",
    "https://api.mercadolibre.com/items/MLB27621585",
    bearer
  );

  var ddg =
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent("site:mercadolivre.com.br " + q);
  var ddgRes = await probe("duckduckgo html", ddg, {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html",
  });
  if (ddgRes && ddgRes.text) {
    var links = ddgRes.text.match(
      /https?:\/\/[^\s"'<>]*mercadolivre\.com\.br\/[^\s"'<>]*/gi
    );
    console.log("ddg ml links", (links || []).slice(0, 8));
  }

  var brave =
    "https://search.brave.com/search?q=" +
    encodeURIComponent("site:mercadolivre.com.br " + q) +
    "&source=web";
  await probe("brave html", brave, {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html",
  });

  var bing =
    "https://www.bing.com/search?q=" +
    encodeURIComponent("site:mercadolivre.com.br " + q);
  var bingRes = await probe("bing html", bing, {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html",
  });
  if (bingRes && bingRes.text) {
    var blinks = bingRes.text.match(
      /https?:\/\/[^\s"'<>]*mercadolivre\.com\.br\/[^\s"'<>]*/gi
    );
    console.log("bing ml links", (blinks || []).slice(0, 8));
  }

  // Frontend-like search endpoint sometimes used by ML SPA
  await probe(
    "ml frontend search api?",
    "https://www.mercadolivre.com.br/menu/departments",
    {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    }
  );
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
