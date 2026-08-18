(async function () {
  var q = "abracadeira borboleta";
  var ua = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html",
  };

  var ddg = await fetch(
    "https://html.duckduckgo.com/html/?q=" +
      encodeURIComponent("site:mercadolivre.com.br " + q),
    { headers: ua }
  );
  var ht = await ddg.text();
  var uddg = [];
  var re = /uddg=([^&"']+)/g;
  var m;
  while ((m = re.exec(ht))) {
    try {
      uddg.push(decodeURIComponent(m[1]));
    } catch (e) {}
  }
  var ml = uddg.filter(function (u) {
    return /mercadolivre\.com\.br/i.test(u);
  });
  console.log("DDG status", ddg.status, "uddg", uddg.length, "ml", ml.length);
  console.log(ml.slice(0, 6));

  var jurl =
    "https://r.jina.ai/http://lista.mercadolivre.com.br/abracadeira-borboleta";
  var jr = await fetch(jurl, {
    headers: { Accept: "text/plain", "User-Agent": ua["User-Agent"] },
  });
  var jt = await jr.text();
  console.log("JINA lista", jr.status, jt.length);
  console.log(jt.slice(0, 500));
  var jlinks = jt.match(/https:\/\/www\.mercadolivre\.com\.br\/[^\s)\]>"]+/g) || [];
  console.log("jina links", jlinks.slice(0, 8));

  var prices = jt.match(/R\$\s*[\d\.]+,?[\d]*/g) || [];
  console.log("prices sample", prices.slice(0, 10));

  var jp = await fetch(
    "https://r.jina.ai/http://www.mercadolivre.com.br/abracadeira-borboleta-12mm-a-20mm-com-10-pecas-vonder/p/MLB27621585",
    { headers: { Accept: "text/plain" } }
  );
  var jpt = await jp.text();
  console.log("JINA product", jp.status, jpt.length);
  console.log(jpt.slice(0, 900));
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
