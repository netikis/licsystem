(async function () {
  var q = encodeURIComponent("abracadeira borboleta");
  var ua = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9",
    Referer: "https://www.mercadolivre.com.br/",
    Origin: "https://www.mercadolivre.com.br",
  };
  var urls = [
    "https://lista.mercadolivre.com.br/abracadeira-borboleta",
    "https://www.mercadolivre.com.br/api/search?q=" + q,
    "https://www.mercadolivre.com.br/jms/mlb/search?q=" + q,
    "https://frontend.mercadolibre.com/sites/MLB/search?q=" + q + "&limit=5",
    "https://api.mercadolibre.com/sites/MLB/domain_discovery/search?limit=5&q=" + q,
    "https://api.mercadolibre.com/sites/MLB/domain_discovery/search?q=" + q,
    "https://api.mercadolibre.com/sites/MLB/autosuggest?q=" + q + "&limit=5",
    "https://http2.mlstatic.com/resources/sites/MLB/search?q=" + q,
  ];
  for (var i = 0; i < urls.length; i++) {
    try {
      var r = await fetch(urls[i], { headers: ua, redirect: "follow" });
      var t = await r.text();
      var hasResults =
        /"results"\s*:|"price"\s*:|andes-money-amount|application\/ld\+json/i.test(
          t
        );
      console.log(
        r.status,
        hasResults ? "HIT" : "miss",
        t.length,
        urls[i].slice(0, 90)
      );
      if (hasResults) console.log("  ", t.slice(0, 160).replace(/\s+/g, " "));
    } catch (e) {
      console.log("ERR", urls[i].slice(0, 70), e.message);
    }
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
