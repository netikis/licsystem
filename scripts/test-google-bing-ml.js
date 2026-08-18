(async function () {
  var q = "abracadeira borboleta 12mm site:mercadolivre.com.br";
  var ua = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    Accept: "text/html",
  };

  async function grab(name, url) {
    var r = await fetch(url, { headers: ua, redirect: "follow" });
    var t = await r.text();
    require("fs").writeFileSync("scripts/_"+name+".html", t);
    var links = [];
    var re = /href="(https?:\/\/www\.mercadolivre\.com\.br\/[^"]+)"/gi;
    var m;
    while ((m = re.exec(t))) links.push(m[1].replace(/&amp;/g, "&"));
    var ids = t.match(/MLB-?\d{8,14}|\/p\/MLB[U0-9A-Z]+/gi) || [];
    var prices = t.match(/R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}/g) || [];
    console.log(name, r.status, "len", t.length, "links", links.length, "ids", ids.length, "prices", prices.length);
    console.log(" links", links.slice(0, 6));
    console.log(" ids", ids.slice(0, 10));
    console.log(" prices", prices.slice(0, 8));
  }

  await grab(
    "google",
    "https://www.google.com/search?hl=pt-BR&num=10&q=" + encodeURIComponent(q)
  );
  await grab(
    "bing",
    "https://www.bing.com/search?count=10&q=" + encodeURIComponent(q)
  );
  // DuckDuckGo lite
  await grab(
    "ddglite",
    "https://lite.duckduckgo.com/lite/?q=" + encodeURIComponent(q)
  );
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
