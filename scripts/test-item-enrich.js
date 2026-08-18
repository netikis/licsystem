(async function () {
  var ids = ["MLB5260356436", "MLB27621585", "MLB24041366"];
  var uas = [
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Twitterbot/1.0",
  ];
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var num = id.replace(/\D/g, "");
    var urls = [
      "https://produto.mercadolivre.com.br/MLB-" + num,
      "https://www.mercadolivre.com.br/p/" + id,
      "https://api.mercadolibre.com/items/" + id,
    ];
    for (var u = 0; u < urls.length; u++) {
      for (var a = 0; a < uas.length; a++) {
        try {
          var r = await fetch(urls[u], {
            headers: { "User-Agent": uas[a], Accept: "text/html,application/json" },
            redirect: "follow",
          });
          var t = await r.text();
          var price =
            (t.match(/itemprop="price"\s+content="([^"]+)"/i) || [])[1] ||
            (t.match(/"price"\s*:\s*([0-9.]+)/) || [])[1] ||
            (t.match(/andes-money-amount__fraction[^>]*>([0-9.]+)/i) || [])[1];
          var title =
            (t.match(/property="og:title"\s+content="([^"]+)"/i) || [])[1] ||
            (t.match(/<title>([^<]+)/i) || [])[1];
          if (price || /InStock|ld\+json/i.test(t)) {
            console.log(
              "HIT",
              r.status,
              "price",
              price,
              "title",
              (title || "").slice(0, 60),
              "ua",
              uas[a].slice(0, 20),
              urls[u].slice(0, 55)
            );
          }
        } catch (e) {}
      }
    }
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
