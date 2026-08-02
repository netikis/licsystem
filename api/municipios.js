/**
 * GET /api/municipios
 * Autocomplete de municípios (dataset IBGE lat/lng embutido).
 *
 * Query:
 *   q   texto (mín. 2 chars) — nome do município
 *   uf  opcional (sigla)
 *   ibge opcional — retorna um município exato
 */
var _municipios = null;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function json(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  res.end(JSON.stringify(body));
}

function load() {
  if (_municipios) return _municipios;
  /* Módulo com require estático — NFT inclui o JSON; sem fs. */
  _municipios = require("./_lib/municipios-data");
  return _municipios;
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Use GET" });
  }

  try {
    var list = load();
    var q = req.query || {};
    var ibge = Number(q.ibge || 0);
    if (ibge) {
      var found = null;
      for (var i = 0; i < list.length; i++) {
        if (list[i].i === ibge) {
          found = list[i];
          break;
        }
      }
      if (!found) {
        return json(res, 404, { ok: false, error: "Município não encontrado" });
      }
      return json(res, 200, {
        ok: true,
        municipio: {
          ibge: found.i,
          nome: found.n,
          uf: found.u,
          lat: found.a,
          lng: found.o,
        },
      });
    }

    var term = fold(q.q || q.nome || "").trim();
    var uf = String(q.uf || "")
      .trim()
      .toUpperCase();
    if (term.length < 2 && !uf) {
      return json(res, 400, {
        ok: false,
        error: "Informe q com ao menos 2 caracteres (ou uf / ibge).",
      });
    }

    var out = [];
    for (var j = 0; j < list.length; j++) {
      var m = list[j];
      if (uf && m.u !== uf) continue;
      if (term && fold(m.n).indexOf(term) === -1) continue;
      out.push({ ibge: m.i, nome: m.n, uf: m.u, lat: m.a, lng: m.o });
      if (out.length >= 30) break;
    }

    out.sort(function (a, b) {
      var an = fold(a.nome);
      var bn = fold(b.nome);
      var ap = term && an.indexOf(term) === 0 ? 0 : 1;
      var bp = term && bn.indexOf(term) === 0 ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return an.localeCompare(bn, "pt-BR");
    });

    return json(res, 200, { ok: true, total: out.length, municipios: out });
  } catch (err) {
    return json(res, 500, { ok: false, error: err.message || String(err) });
  }
};
