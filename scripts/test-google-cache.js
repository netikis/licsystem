(async function () {
  var targets = [
    "https://webcache.googleusercontent.com/search?q=cache:lista.mercadolivre.com.br/abracadeira-borboleta&hl=pt-BR",
    "https://webcache.googleusercontent.com/search?q=cache:www.mercadolivre.com.br/abracadeira-borboleta&hl=pt-BR",
    "http://webcache.googleusercontent.com/search?q=cache:lista.mercadolivre.com.br/abracadeira-borboleta",
  ];
  var ua = {
    "User-Agent":
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    Accept: "text/html",
  };
  for (var i = 0; i < targets.length; i++) {
    try {
      var r = await fetch(targets[i], { headers: ua, redirect: "follow" });
      var t = await r.text();
      var ids = t.match(/MLB-?\d{8,14}/gi) || [];
      console.log(r.status, t.length, "ids", ids.length, targets[i].slice(0, 80));
    } catch (e) {
      console.log("ERR", e.message);
    }
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
