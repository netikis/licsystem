(async function () {
  var urls = [
    "https://lista.mercadolivre.com.br/abracadeira-borboleta",
    "https://www.mercadolivre.com.br/abracadeira-borboleta-12mm-a-20mm-com-10-pecas-vonder/p/MLB27621585",
  ];
  for (var i = 0; i < urls.length; i++) {
    var api =
      "https://api.microlink.io/?url=" +
      encodeURIComponent(urls[i]) +
      "&meta=true&data.price.selector=meta[itemprop=price]&data.price.attr=content";
    var r = await fetch(api);
    var j = await r.json();
    console.log("\n", urls[i].slice(0, 70));
    console.log("status", r.status, j.status);
    console.log(JSON.stringify(j, null, 2).slice(0, 1200));
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
