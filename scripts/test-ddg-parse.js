(async function () {
  var q = "abracadeira borboleta 12mm 20mm";
  var ua = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html",
  };
  var url =
    "https://html.duckduckgo.com/html/?q=" +
    encodeURIComponent(q + " site:mercadolivre.com.br");
  var r = await fetch(url, { headers: ua, redirect: "follow" });
  var html = await r.text();
  require("fs").writeFileSync("scripts/_ddg-sample.html", html);

  // result blocks
  var results = [];
  var re =
    /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)>)?/gi;
  var m;
  while ((m = re.exec(html))) {
    var href = m[1];
    var title = m[2].replace(/<[^>]+>/g, "").trim();
    var snip = (m[3] || "").replace(/<[^>]+>/g, "").trim();
    var real = href;
    var um = href.match(/uddg=([^&]+)/);
    if (um) {
      try {
        real = decodeURIComponent(um[1]);
      } catch (e) {}
    }
    if (!/mercadolivre\.com\.br/i.test(real)) continue;
    if (/duckduckgo\.com\/y\.js/i.test(real)) continue;
    results.push({ title: title, url: real, snippet: snip.slice(0, 180) });
  }
  console.log("parsed", results.length);
  console.log(JSON.stringify(results.slice(0, 10), null, 2));

  // also raw MLB ids
  var ids = html.match(/MLB-?\d{6,14}|\/p\/MLB[U0-9A-Z]+/gi) || [];
  console.log("ids", ids.slice(0, 20));
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
