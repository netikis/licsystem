var fs = require("fs");
var path = require("path");

function loadEnv(file) {
  fs.readFileSync(file, "utf8")
    .split(/\r?\n/)
    .forEach(function (line) {
      line = line.trim();
      if (!line || line.charAt(0) === "#") return;
      var i = line.indexOf("=");
      if (i < 1) return;
      var k = line.slice(0, i).trim();
      var v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[k]) process.env[k] = v;
    });
}

loadEnv(path.join(__dirname, "..", ".env"));

(async function () {
  var key = process.env.GEMINI_API_KEY;
  var model = process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";
  var q = "Abraçadeira Borboleta 12mm a 20mm";
  var prompt =
    'Busque no Mercado Livre Brasil anuncios reais para: "' +
    q +
    '". Retorne APENAS JSON valido (sem markdown) no formato: ' +
    '{"results":[{"title":"...","price":0,"permalink":"https://www.mercadolivre.com.br/...","free_shipping":false}]} ' +
    "Com ate 5 resultados. price em numero BRL. permalink deve ser URL real do Mercado Livre.";

  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(key);

  var body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    tools: [{ google_search: {} }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  };

  var r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  var j = await r.json();
  console.log("HTTP", r.status);
  if (j.error) {
    console.log("ERR", JSON.stringify(j.error).slice(0, 500));
    // retry without grounding
    delete body.tools;
    body.contents[0].parts[0].text =
      prompt +
      " Use seu conhecimento de produtos tipicos do Mercado Livre Brasil se nao puder buscar web.";
    var r2 = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    var j2 = await r2.json();
    console.log("NO_GROUND HTTP", r2.status);
    var text2 =
      ((((j2.candidates || [])[0] || {}).content || {}).parts || [])
        .map(function (p) {
          return p.text || "";
        })
        .join("") || "";
    console.log(text2.slice(0, 1500));
    return;
  }
  var text =
    ((((j.candidates || [])[0] || {}).content || {}).parts || [])
      .map(function (p) {
        return p.text || "";
      })
      .join("") || "";
  console.log("TEXT", text.slice(0, 2000));
  var gm = (((j.candidates || [])[0] || {}).groundingMetadata) || null;
  if (gm) {
    console.log(
      "grounding queries",
      (gm.webSearchQueries || []).slice(0, 5)
    );
    console.log(
      "chunks",
      ((gm.groundingChunks || []).slice(0, 5) || []).map(function (c) {
        return (c.web && c.web.uri) || "";
      })
    );
  }
})().catch(function (e) {
  console.error(e);
  process.exitCode = 1;
});
