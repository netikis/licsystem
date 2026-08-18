(async function () {
  var target = "https://lista.mercadolivre.com.br/abracadeira-borboleta";
  var proxies = [
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(target),
    "https://corsproxy.io/?" + encodeURIComponent(target),
    "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(target),
  ];
  for (var i = 0; i < proxies.length; i++) {
    try {
      var r = await fetch(proxies[i], {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
      });
      var t = await r.text();
      var ids = t.match(/MLB-?\d{8,14}/gi) || [];
      var money = t.match(/andes-money-amount__fraction/gi) || [];
      var captcha = /suspicious-traffic|Just a moment|challenge-form/i.test(t);
      console.log(
        proxies[i].slice(0, 40),
        "status",
        r.status,
        "len",
        t.length,
        "ids",
        ids.length,
        "money",
        money.length,
        "captcha",
        captcha
      );
      if (ids.length) console.log(" sample ids", ids.slice(0, 5));
    } catch (e) {
      console.log("ERR", proxies[i].slice(0, 40), e.message);
    }
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
