(async function () {
  var q = encodeURIComponent("abracadeira borboleta site:mercadolivre.com.br");
  var instances = [
    "https://searx.be/search?q=" + q + "&format=json",
    "https://search.sapti.me/search?q=" + q + "&format=json",
    "https://searx.tiekoetter.com/search?q=" + q + "&format=json",
  ];
  var ua = {
    "User-Agent":
      "Mozilla/5.0 (compatible; LICSYSTEM/1.0; +https://licsystem.vercel.app)",
    Accept: "application/json",
  };
  for (var i = 0; i < instances.length; i++) {
    try {
      var r = await fetch(instances[i], { headers: ua });
      var t = await r.text();
      console.log("\n", instances[i].slice(0, 50), r.status, t.length);
      try {
        var j = JSON.parse(t);
        var results = (j.results || []).slice(0, 5).map(function (x) {
          return { title: x.title, url: x.url, content: (x.content || "").slice(0, 120) };
        });
        console.log(JSON.stringify(results, null, 2));
      } catch (e) {
        console.log(t.slice(0, 200));
      }
    } catch (e) {
      console.log("ERR", e.message);
    }
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
