var pub = require("../api/_lib/ml-public-search");

(async function () {
  var urls = [
    "https://lista.mercadolivre.com.br/abracadeira-borboleta",
    "https://www.mercadolivre.com.br/abracadeira-borboleta",
    "https://mobile.mercadolivre.com.br/abracadeira-borboleta",
    "https://produto.mercadolivre.com.br/MLB-27621585",
  ];
  var uas = [
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Googlebot/2.1 (+http://www.google.com/bot.html)",
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Twitterbot/1.0",
    "bingbot/2.0 (+http://www.bing.com/bingbot.htm)",
  ];

  for (var u = 0; u < uas.length; u++) {
    for (var i = 0; i < urls.length; i++) {
      try {
        var r = await fetch(urls[i], {
          headers: {
            "User-Agent": uas[u],
            Accept: "text/html,application/xhtml+xml,application/json",
            "Accept-Language": "pt-BR,pt;q=0.9",
          },
          redirect: "follow",
        });
        var t = await r.text();
        var ids = t.match(/MLB-?\d{8,14}|\/p\/MLB[U0-9A-Z]+/gi) || [];
        var money = (t.match(/andes-money-amount__fraction/gi) || []).length;
        var ld = (t.match(/application\/ld\+json/gi) || []).length;
        var captcha = /suspicious-traffic|account-verification|Just a moment|challenge-form/i.test(
          t
        );
        if (ids.length || money || ld) {
          console.log(
            "HIT",
            r.status,
            "ids",
            ids.length,
            "money",
            money,
            "ld",
            ld,
            "ua",
            uas[u].slice(0, 40),
            "url",
            urls[i].slice(0, 60)
          );
        }
      } catch (e) {
        console.log("ERR", e.message);
      }
    }
  }

  var hit = await pub.searchPublicIndex("abracadeira borboleta", 3);
  console.log("module", hit.ok, hit.results && hit.results.length);
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
