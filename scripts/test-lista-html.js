var fs = require("fs");
var pub = require("../api/_lib/ml-public-search");

(async function () {
  var url = "https://lista.mercadolivre.com.br/abracadeira-borboleta";
  var r = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
      Referer: "https://www.mercadolivre.com.br/",
    },
    redirect: "follow",
  });
  var html = await r.text();
  fs.writeFileSync("scripts/_lista-sample.html", html);
  console.log("status", r.status, "len", html.length);
  console.log("captcha", /suspicious-traffic|challenge-form|Just a moment/i.test(html));
  console.log("ld+json", (html.match(/application\/ld\+json/gi) || []).length);
  console.log("poly-card", (html.match(/poly-card|ui-search-layout|andes-card/gi) || []).length);
  console.log("MLB ids", (html.match(/MLB-?\d{8,14}/gi) || []).slice(0, 15));
  console.log("prices", (html.match(/andes-money-amount__fraction[^>]*>[\d.]+/gi) || []).slice(0, 8));

  // __PRELOADED_STATE__ or similar
  var pre = html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
  console.log("preloaded", !!pre, pre ? pre[1].length : 0);

  var state = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  console.log("next_data", !!state);

  // search for JSON blobs with price
  var priceJson = html.match(/"price"\s*:\s*\d+/g) || [];
  console.log("price json count", priceJson.length, priceJson.slice(0, 5));

  var hit = await pub.searchPublicIndex("abracadeira borboleta", 5);
  console.log("public module", hit.ok, (hit.results || []).length, hit.query_used);
  if (hit.results && hit.results[0]) console.log(hit.results[0]);
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
