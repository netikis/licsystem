/**
 * POST /api/monitor-pncp
 * Verifica watches de editais no PNCP e devolve matches.
 *
 * Body JSON:
 *   watches: [{ id, tipo, q, uf, municipio, ibge, regiao, categoria, leiloes, ... }]
 *   knownIds?: string[]  — ids já conhecidos (não voltam como "novos")
 *
 * Resposta: { ok, results:[{ watchId, editais:[], total }], novos:[{...edital, watchId}] }
 *
 * Header opcional: Authorization: Bearer <MONITOR_CRON_SECRET>
 * (se MONITOR_CRON_SECRET estiver definido no ambiente, a rota exige o segredo)
 */
var queryLib = require("./_lib/editais-query");
var safeJson = require("./_lib/safe-json");

var HANDLER_BUDGET_MS = 52000;
var MAX_WATCHES = 4;

function cors(res) {
  safeJson.applyCors(res, "POST,OPTIONS");
}

function json(res, status, body) {
  safeJson.sendJson(res, status, body, "POST,OPTIONS");
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string" && req.body) {
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        return reject(new Error("Invalid JSON"));
      }
    }
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      var raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function authOk(req) {
  var secret = String(process.env.MONITOR_CRON_SECRET || "").trim();
  if (!secret) return true;
  var h = String(req.headers.authorization || "");
  if (h === "Bearer " + secret) return true;
  var q = (req.query && req.query.secret) || "";
  return String(q) === secret;
}

function editalKey(o) {
  if (!o) return "";
  if (o.numeroControlePNCP) return String(o.numeroControlePNCP);
  return [o.orgao || "", o.objeto || "", o.dataAbertura || "", o.uf || ""].join("|");
}

function truthy(v) {
  return v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
}

async function runMunicipioWatch(watch, deadline) {
  if (Date.now() >= deadline) return [];
  var result = await queryLib.queryEditais({
    municipio: watch.municipio || watch.cidade || "",
    ibge: watch.ibge || 0,
    regiao: watch.regiao || "",
    mensagem: watch.mensagem || "",
    categoria: watch.categoria || "",
    q: watch.q || watch.keywords || "",
    leiloes: truthy(watch.leiloes) ? "1" : undefined,
    ampliar: truthy(watch.ampliar) ? "1" : undefined,
    janela: watch.janela || "45",
    uf: watch.uf || "",
    esferas: watch.esferas || "M,E",
    limite: watch.limite || 40,
    paginas: 2,
  });
  return (result && result.editais) || [];
}

async function runRadarWatch(watch, deadline) {
  if (Date.now() >= deadline) return [];
  var uf = String(watch.uf || "")
    .trim()
    .toUpperCase();
  if (!uf) {
    var err = new Error("Alerta tipo radar precisa de UF");
    err.status = 400;
    throw err;
  }
  var rawKw = String(watch.q || watch.keywords || "").trim();
  var keywords = rawKw
    .split(/[,;]/)
    .map(function (s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    })
    .filter(Boolean);
  if (queryLib.expandLeilaoKeywords) {
    keywords = queryLib.expandLeilaoKeywords(keywords);
  }
  if (!keywords.length) {
    var err2 = new Error("Alerta tipo radar precisa de palavras-chave");
    err2.status = 400;
    throw err2;
  }

  var janela = queryLib.resolveJanela
    ? queryLib.resolveJanela({ janela: watch.janela || "45" })
    : { dataFinal: null };
  var dataFinal =
    (janela && janela.dataFinal) ||
    (queryLib.dataFinalProposta && queryLib.dataFinalProposta(45));

  /* Pregão sempre; leilões somam (não substituem). */
  var modalidades = [6];
  if (truthy(watch.leiloes) || (queryLib.looksLikeLeilaoText && queryLib.looksLikeLeilaoText(rawKw))) {
    modalidades = [6, 13];
  }

  var raw = [];
  for (var m = 0; m < modalidades.length; m++) {
    if (Date.now() >= deadline) break;
    try {
      var part = await queryLib.fetchPropostasUfRobusto(uf, dataFinal, modalidades[m], 2);
      if (part && part.length) raw = raw.concat(part);
    } catch (e) {
      /* modalidade pode falhar no PNCP — segue */
    }
  }

  var out = [];
  var seen = Object.create(null);
  for (var i = 0; i < raw.length; i++) {
    var item = raw[i];
    var mapped = {
      orgao:
        (item.orgaoEntidade && item.orgaoEntidade.razaoSocial) ||
        item.nomeOrgao ||
        "Órgão público",
      municipio: (item.unidadeOrgao && item.unidadeOrgao.municipioNome) || "",
      uf: (item.unidadeOrgao && item.unidadeOrgao.ufSigla) || uf,
      modalidade: item.modalidadeNome || "",
      objeto: item.objetoCompra || item.objeto || "",
      valorEstimado:
        item.valorTotalEstimado != null ? Number(item.valorTotalEstimado) : null,
      dataAbertura: item.dataAberturaProposta || null,
      dataEncerramento: item.dataEncerramentoProposta || null,
      numeroControlePNCP: item.numeroControlePNCP || null,
      link: null,
    };
    var cnpj =
      (item.orgaoEntidade && item.orgaoEntidade.cnpj) || item.cnpjOrgao || "";
    if (cnpj && item.anoCompra && item.sequencialCompra != null) {
      mapped.link =
        "https://pncp.gov.br/app/editais/" +
        encodeURIComponent(cnpj) +
        "/" +
        encodeURIComponent(item.anoCompra) +
        "/" +
        encodeURIComponent(item.sequencialCompra);
    }
    var hay = String(mapped.objeto || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    var ok = false;
    for (var k = 0; k < keywords.length; k++) {
      if (keywords[k] && hay.indexOf(keywords[k]) !== -1) {
        ok = true;
        break;
      }
    }
    if (!ok) continue;
    var key = editalKey(mapped);
    if (!key || seen[key]) continue;
    seen[key] = true;
    out.push(mapped);
  }
  return out;
}

/**
 * Alerta de Editais próximos: reutiliza /api/editais-proximos (raio + vizinhos).
 */
async function runProximosWatch(watch, deadline) {
  if (Date.now() >= deadline) return [];
  var ibge = Number(watch.ibge || 0) || 0;
  if (!ibge) {
    var err = new Error("Alerta de Editais próximos precisa do município (IBGE)");
    err.status = 400;
    throw err;
  }
  var raio = Number(watch.raio || 250) || 250;
  if (raio < 10) raio = 10;
  if (raio > 700) raio = 700;

  var qs =
    "ibge=" +
    encodeURIComponent(ibge) +
    "&raio=" +
    encodeURIComponent(raio) +
    "&janela=" +
    encodeURIComponent(watch.janela === "ano" ? "ano" : "45") +
    "&q=" +
    encodeURIComponent(watch.q || watch.keywords || "") +
    "&ampliar=" +
    (truthy(watch.ampliar) ? "1" : "0") +
    "&leiloes=" +
    (truthy(watch.leiloes) ? "1" : "0") +
    "&esferas=" +
    encodeURIComponent(
      truthy(watch.federal) ? "M,E,F" : watch.esferas || "M,E"
    );
  if (watch.cobertura) {
    qs += "&cobertura=" + encodeURIComponent(watch.cobertura);
  }

  var handler = require("./editais-proximos");
  var result = await new Promise(function (resolve, reject) {
    var statusCode = 200;
    var res = {
      headersSent: false,
      statusCode: 200,
      setHeader: function () {},
      end: function (body) {
        try {
          var parsed = body ? JSON.parse(String(body)) : {};
          resolve({ status: statusCode, body: parsed });
        } catch (e) {
          reject(e);
        }
      },
    };
    Object.defineProperty(res, "statusCode", {
      get: function () {
        return statusCode;
      },
      set: function (v) {
        statusCode = v;
      },
      configurable: true,
    });
    var req = {
      method: "GET",
      query: Object.create(null),
      headers: {},
    };
    qs.split("&").forEach(function (pair) {
      var i = pair.indexOf("=");
      if (i < 0) return;
      var k = decodeURIComponent(pair.slice(0, i));
      var v = decodeURIComponent(pair.slice(i + 1));
      req.query[k] = v;
    });
    Promise.resolve(handler(req, res)).catch(reject);
  });

  if (!result || !result.body) return [];
  if (result.body.ok === false) {
    var e2 = new Error(result.body.error || "Falha em editais-proximos");
    e2.status = result.status || 500;
    throw e2;
  }
  return result.body.editais || result.body.data || [];
}

async function runWatch(watch, deadline) {
  var tipo = String(watch.tipo || "").toLowerCase();
  if (tipo === "radar") return runRadarWatch(watch, deadline);
  if (tipo === "proximos" || tipo === "raio" || tipo === "vizinhos") {
    return runProximosWatch(watch, deadline);
  }
  return runMunicipioWatch(watch, deadline);
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Use POST" });
  }
  if (!authOk(req)) {
    return json(res, 401, { ok: false, error: "Não autorizado" });
  }

  var deadline = Date.now() + HANDLER_BUDGET_MS;
  try {
    var body = await readBody(req);
    var watches = Array.isArray(body.watches) ? body.watches : [];
    watches = watches
      .filter(function (w) {
        return w && w.enabled !== false;
      })
      .slice(0, MAX_WATCHES);

    if (!watches.length) {
      return json(res, 400, {
        ok: false,
        error: "Envie watches[] (máx. " + MAX_WATCHES + " por chamada)",
      });
    }

    var known = Object.create(null);
    var knownArr = Array.isArray(body.knownIds) ? body.knownIds : [];
    for (var i = 0; i < knownArr.length; i++) {
      if (knownArr[i]) known[String(knownArr[i])] = true;
    }

    var results = [];
    var novos = [];

    for (var w = 0; w < watches.length; w++) {
      if (Date.now() >= deadline) break;
      var watch = watches[w];
      var watchId = String(watch.id || "w" + w);
      try {
        var editais = await runWatch(watch, deadline);
        var pack = [];
        for (var e = 0; e < editais.length; e++) {
          var ed = editais[e] || {};
          var key = editalKey(ed);
          var row = Object.assign({}, ed, {
            watchId: watchId,
            watchLabel: watch.label || watch.municipio || watch.q || watchId,
            key: key,
          });
          pack.push(row);
          if (key && !known[key]) {
            novos.push(row);
            known[key] = true;
          }
        }
        results.push({
          watchId: watchId,
          ok: true,
          total: pack.length,
          editais: pack,
        });
      } catch (err) {
        results.push({
          watchId: watchId,
          ok: false,
          error: (err && err.message) || String(err),
          total: 0,
          editais: [],
        });
      }
    }

    return json(res, 200, {
      ok: true,
      checked: results.length,
      novos: novos,
      results: results,
      truncated: watches.length >= MAX_WATCHES || Date.now() >= deadline,
    });
  } catch (err) {
    var status = err.status || 500;
    return json(res, status, {
      ok: false,
      error: err.message || String(err),
    });
  }
}

module.exports = safeJson.wrapHandler(handler, "POST,OPTIONS");
