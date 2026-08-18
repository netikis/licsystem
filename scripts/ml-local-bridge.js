/**
 * Ponte local (IP residencial) para busca ML.
 * Uso: npm run ml-bridge
 * O frontend tenta http://127.0.0.1:3847/search automaticamente.
 */
var http = require("http");
var url = require("url");
var path = require("path");

// carrega .env se existir
try {
  var fs = require("fs");
  var envPath = path.join(__dirname, "..", ".env");
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, "utf8")
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
} catch (e) {}

var mlPublic = require("../api/_lib/ml-public-search");
var PORT = Number(process.env.ML_BRIDGE_PORT || 3847);

function send(res, status, body) {
  var raw = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Accept",
  });
  res.end(raw);
}

var server = http.createServer(async function (req, res) {
  var parsed = url.parse(req.url, true);
  if (req.method === "OPTIONS") {
    return send(res, 204, {});
  }
  if (parsed.pathname === "/health") {
    return send(res, 200, { ok: true, bridge: true });
  }
  if (parsed.pathname !== "/search" && parsed.pathname !== "/api/search-ml") {
    return send(res, 404, { ok: false, error: "use /search?q=" });
  }
  var q = String((parsed.query && parsed.query.q) || "").trim();
  var limit = Math.min(
    Math.max(parseInt((parsed.query && parsed.query.limit) || "10", 10) || 10, 1),
    20
  );
  if (!q) return send(res, 400, { ok: false, error: "missing q", results: [] });
  try {
    var pub = await mlPublic.searchPublicIndex(q, limit);
    if (pub.ok && pub.results && pub.results.length) {
      return send(res, 200, {
        ok: true,
        q: q,
        query_used: pub.query_used || q,
        source: "local_bridge",
        mode: pub.mode || "public",
        results: pub.results,
      });
    }
    return send(res, 200, {
      ok: false,
      q: q,
      results: [],
      error: "sem produtos na ponte local",
      tried: pub.tried,
    });
  } catch (e) {
    return send(res, 200, {
      ok: false,
      error: (e && e.message) || String(e),
      results: [],
    });
  }
});

server.listen(PORT, "127.0.0.1", function () {
  console.log("");
  console.log("ML local bridge ON  →  http://127.0.0.1:" + PORT + "/search?q=");
  console.log("Deixe esta janela aberta e use o Cruzamento no LICSYSTEM.");
  console.log("");
});
