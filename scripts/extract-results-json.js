(async function () {
  var r = await fetch("https://lista.mercadolivre.com.br/abracadeira-borboleta", {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      Accept: "text/html",
    },
  });
  var html = await r.text();
  var idx = html.indexOf('"results":[');
  console.log("idx", idx);
  // walk back to find object start
  var start = html.lastIndexOf("{", idx);
  // try to find script containing results
  var scriptRe = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  var found = 0;
  while ((m = scriptRe.exec(html))) {
    if (m[1].indexOf('"results":[') === -1) continue;
    found++;
    var body = m[1].trim();
    console.log("script", found, "len", body.length, "head", body.slice(0, 100));
    // try parse as JSON directly
    try {
      var j = JSON.parse(body);
      console.log("parsed keys", Object.keys(j).slice(0, 20));
    } catch (e) {
      // maybe assignment
      var jm = body.match(/=\s*(\{[\s\S]*\})\s*;?\s*$/);
      if (jm) {
        try {
          var j2 = JSON.parse(jm[1]);
          console.log("assign keys", Object.keys(j2).slice(0, 20));
        } catch (e2) {
          console.log("assign fail", e2.message);
        }
      } else {
        console.log("not direct json");
        // extract results array with regex loosely
        var rm = body.match(/"results"\s*:\s*(\[[\s\S]*?\])\s*,\s*"/);
        if (rm) console.log("results slice", rm[1].slice(0, 300));
      }
    }
  }
  console.log("scripts with results", found);

  // search for permalink + price nearby in raw
  var cardRe =
    /"permalink"\s*:\s*"(https:\\u002F\\u002Fwww\.mercadolivre\.com\.br[^"]+)"[\s\S]{0,400}?"price"\s*:\s*([0-9.]+)/g;
  var c;
  var n = 0;
  while ((c = cardRe.exec(html)) && n < 3) {
    n++;
    console.log(
      "card",
      n,
      c[2],
      c[1].replace(/\\u002F/g, "/").slice(0, 80)
    );
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
