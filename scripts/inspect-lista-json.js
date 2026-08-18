(async function () {
  var r = await fetch("https://lista.mercadolivre.com.br/abracadeira-borboleta", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html",
    },
  });
  var html = await r.text();
  // find large JSON assignments
  var patterns = [
    /window\.__PRELOADED_STATE__\s*=\s*/,
    /"results"\s*:\s*\[/,
    /"polycard"/i,
    /"pagination"/,
    /application\/ld\+json/,
  ];
  patterns.forEach(function (p) {
    console.log(String(p), p.test(html));
  });

  // extract first ld+json
  var m = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (m) console.log("LD", m[1].slice(0, 500));

  // look for state in script type application/json
  var re = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var n = 0;
  var sm;
  while ((sm = re.exec(html)) && n < 5) {
    n++;
    var body = sm[1].trim();
    if (body.length < 40) continue;
    console.log("json script", n, body.slice(0, 120), "len", body.length);
  }

  // raw "price":number near title
  var priceBlocks = html.match(/"price"\s*:\s*\{[^}]{0,200}\}/g) || [];
  console.log("price objects", priceBlocks.length, priceBlocks[0]);
  var amount = html.match(/"amount"\s*:\s*\d+/g) || [];
  console.log("amount fields", amount.length, amount.slice(0, 5));
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
