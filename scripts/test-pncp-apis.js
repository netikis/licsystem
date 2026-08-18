/**
 * Smoke test local dos handlers (sem Vercel).
 * Uso: node scripts/test-pncp-apis.js
 */
var path = require("path");

function mockRes() {
  var out = {
    statusCode: 200,
    headers: {},
    body: "",
    headersSent: false,
  };
  return {
    _out: out,
    setHeader: function (k, v) {
      out.headers[k] = v;
    },
    end: function (b) {
      out.headersSent = true;
      out.body = b == null ? "" : String(b);
    },
    get statusCode() {
      return out.statusCode;
    },
    set statusCode(v) {
      out.statusCode = v;
    },
    get headersSent() {
      return out.headersSent;
    },
  };
}

async function invoke(handler, req) {
  var res = mockRes();
  await handler(req, res);
  var text = res._out.body;
  var j = null;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw new Error(
      "Não-JSON status=" +
        res._out.statusCode +
        " body=" +
        text.slice(0, 200)
    );
  }
  return { status: res._out.statusCode, json: j };
}

async function main() {
  var root = path.join(__dirname, "..");
  process.chdir(root);

  console.log("Loading handlers…");
  var proximos = require("../api/editais-proximos");
  var radar = require("../api/radar-pncp");
  var chat = require("../api/editais-chat");

  /* Ibaiti-PR IBGE */
  var ibgeIbaiti = 4109708;
  try {
    var mun = require("../api/_lib/municipios-data");
    var hit = mun.find(function (m) {
      return /ibaiti/i.test(m.n) && m.u === "PR";
    });
    if (hit) ibgeIbaiti = hit.i;
    console.log("Ibaiti IBGE =", ibgeIbaiti, hit && hit.n);
  } catch (e) {
    console.warn("municipios-data:", e.message);
  }

  console.log("\n=== GET /api/editais-proximos (Ibaiti, raio 80, janela 45) ===");
  var t0 = Date.now();
  var prox = await invoke(proximos, {
    method: "GET",
    query: {
      ibge: String(ibgeIbaiti),
      raio: "80",
      janela: "ano",
      leiloes: "0",
    },
  });
  console.log(
    "status",
    prox.status,
    "ok",
    prox.json.ok,
    "total",
    prox.json.total,
    "ms",
    Date.now() - t0,
    "estrategia",
    prox.json.estrategia,
    "error",
    prox.json.error || "-"
  );
  if (typeof prox.json.ok !== "boolean") {
    throw new Error("editais-proximos: resposta sem ok boolean");
  }

  console.log("\n=== GET /api/radar-pncp (SUCATA, PR, leiloes) ===");
  t0 = Date.now();
  var rad = await invoke(radar, {
    method: "GET",
    query: {
      q: "SUCATA",
      uf: "PR",
      incluirLeiloes: "1",
      paginas: "2",
      janela: "ano",
    },
  });
  console.log(
    "status",
    rad.status,
    "ok",
    rad.json.ok,
    "total",
    rad.json.total,
    "bruto",
    rad.json.totalBrutoPncp,
    "ms",
    Date.now() - t0,
    "mods",
    (rad.json.modalidades || []).join(","),
    "error",
    rad.json.error || "-"
  );
  if (typeof rad.json.ok !== "boolean") {
    throw new Error("radar-pncp: resposta sem ok boolean");
  }

  console.log("\n=== POST /api/editais-chat (Ibaiti, janela 45) ===");
  t0 = Date.now();
  var chatRes = await invoke(chat, {
    method: "POST",
    query: {},
    body: { municipio: "Ibaiti", janela: "45", leiloes: "0" },
  });
  console.log(
    "status",
    chatRes.status,
    "ok",
    chatRes.json.ok,
    "total",
    chatRes.json.total,
    "ms",
    Date.now() - t0,
    "error",
    chatRes.json.error || "-"
  );
  if (typeof chatRes.json.ok !== "boolean") {
    throw new Error("editais-chat: resposta sem ok boolean");
  }

  console.log("\nOK — todas as APIs devolveram JSON.");
}

main().catch(function (e) {
  console.error("FAIL:", e.message || e);
  process.exit(1);
});
