/* Testa caminhos que podem funcionar na Vercel (sem API MLB search). */
var fs = require("fs");
var path = require("path");

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
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

async function trySerper(q) {
  var key = process.env.SERPER_API_KEY || process.env.SERPER_KEY || "";
  if (!key) {
    console.log("SERPER: sem chave");
    return null;
  }
  var r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      q: q + " site:mercadolivre.com.br",
      gl: "br",
      hl: "pt-br",
      num: 8,
    }),
  });
  var j = await r.json();
  console.log("SERPER", r.status, (j.organic || []).length);
  console.log(
    (j.organic || []).slice(0, 4).map(function (o) {
      return { title: o.title, link: o.link, price: o.price };
    })
  );
  return j;
}

async function tryProduto(url) {
  var r = await fetch(url, {
    headers: {
      "User-Agent":
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      Accept: "text/html",
    },
  });
  var t = await r.text();
  var price =
    (t.match(/itemprop=["']price["'][^>]*content=["']([^"']+)/i) || [])[1] ||
    (t.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i) || [])[1];
  var title =
    (t.match(/property=["']og:title["'][^>]*content=["']([^"']+)/i) || [])[1];
  console.log("PRODUTO", r.status, price, (title || "").slice(0, 60));
}

(async function () {
  var q = "Fubá de milho amarelo";
  await trySerper(q);
  await tryProduto(
    "https://produto.mercadolivre.com.br/MLB-5260356436"
  );
  // Bing RSS-ish
  try {
    var br = await fetch(
      "https://www.bing.com/search?q=" +
        encodeURIComponent(q + " site:mercadolivre.com.br") +
        "&format=rss",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/rss+xml, application/xml, text/xml, */*",
        },
      }
    );
    var bt = await br.text();
    var links = bt.match(/https:\/\/www\.mercadolivre\.com\.br\/[^<\s"]+/gi) || [];
    console.log("BING RSS", br.status, links.length, links.slice(0, 5));
  } catch (e) {
    console.log("BING ERR", e.message);
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
