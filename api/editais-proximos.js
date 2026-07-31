/**
 * GET /api/editais-proximos
 * Editais/contratações com propostas em aberto no PNCP próximos a um município.
 * Fonte oficial: https://pncp.gov.br/api/consulta (sem API key).
 * Distância: Haversine com coordenadas IBGE (dataset api/data/municipios.json).
 *
 * Query:
 *   ibge       (obrigatório) código IBGE do município de origem
 *   raio       km (default 250, min 10, max 700)
 *   cobertura  opcional: "pr-sp" = Paraná inteiro + SP no raio (divisas)
 *   q          palavras-chave opcionais (vírgula)
 *   esferas    M,E (default) — F=federal opcional
 *
 * Limites serverless (documentados na resposta):
 *   - cobertura livre: até 2 páginas × UF × modalidade, máx. 4 UFs
 *   - cobertura pr-sp: PR até 3 páginas/mod.; SP até 2; demais UFs omitidas
 */
var fs = require("fs");
var path = require("path");

var PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";
var PAGE_SIZE = 50;
var MAX_PAGES_PER_UF_MOD = 2;
var MAX_PAGES_PR_PRESET = 3; // PR com prioridade na cobertura pr-sp
var MAX_PAGES_SP_PRESET = 2;
var DEFAULT_RAIO_KM = 250;
var MAX_RAIO_KM = 700;
var PRESET_PR_SP_RAIO_KM = 500;
var DEFAULT_MODALIDADES = [6]; // Pregão Eletrônico (rápido o bastante p/ serverless)
var EXTRA_MODALIDADES = [4, 7]; // Concorrência Eletrônica, Pregão Presencial
var MAX_UFS = 4;
var ESFERA_LABEL = { M: "Municipal", E: "Estadual", F: "Federal", D: "Distrital" };

var _municipios = null;
var _byIbge = null;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function json(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function loadMunicipios() {
  if (_municipios) return _municipios;
  try {
    _municipios = require("./data/municipios.json");
  } catch (e) {
    var file = path.join(__dirname, "data", "municipios.json");
    _municipios = JSON.parse(fs.readFileSync(file, "utf8"));
  }
  _byIbge = Object.create(null);
  for (var i = 0; i < _municipios.length; i++) {
    _byIbge[_municipios[i].i] = _municipios[i];
  }
  return _municipios;
}

function haversineKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLon = (lon2 - lon1) * toRad;
  var a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function ymd(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return "" + y + m + day;
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function pncpLink(item) {
  var cnpj =
    (item.orgaoEntidade && item.orgaoEntidade.cnpj) ||
    item.cnpjOrgao ||
    "";
  var ano = item.anoCompra || item.ano;
  var seq = item.sequencialCompra || item.sequencial;
  if (cnpj && ano && seq != null) {
    return (
      "https://pncp.gov.br/app/editais/" +
      encodeURIComponent(cnpj) +
      "/" +
      encodeURIComponent(ano) +
      "/" +
      encodeURIComponent(seq)
    );
  }
  return item.linkSistemaOrigem || item.linkProcessoEletronico || null;
}

async function fetchPncpJson(url) {
  var r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LICSYSTEM/1.0 (editais-proximos)",
    },
  });
  var text = await r.text();
  var body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (e) {
    body = null;
  }
  if (!r.ok) {
    var msg =
      (body && (body.message || body.error)) ||
      "HTTP " + r.status;
    var err = new Error(String(msg));
    err.status = r.status;
    throw err;
  }
  return body || {};
}

async function fetchPropostasUf(uf, dataFinal, modalidade, maxPages) {
  var pages = maxPages != null ? maxPages : MAX_PAGES_PER_UF_MOD;
  pages = Math.max(1, Math.min(5, Number(pages) || MAX_PAGES_PER_UF_MOD));
  var out = [];
  for (var pagina = 1; pagina <= pages; pagina++) {
    var url =
      PNCP_BASE +
      "/contratacoes/proposta?dataFinal=" +
      dataFinal +
      "&codigoModalidadeContratacao=" +
      modalidade +
      "&uf=" +
      encodeURIComponent(uf) +
      "&pagina=" +
      pagina +
      "&tamanhoPagina=" +
      PAGE_SIZE;
    var j = await fetchPncpJson(url);
    var arr = (j && j.data) || [];
    if (!Array.isArray(arr) || !arr.length) break;
    for (var i = 0; i < arr.length; i++) out.push(arr[i]);
    var totalPaginas = Number(j.totalPaginas || 1);
    if (pagina >= totalPaginas) break;
  }
  return out;
}

function pagesForUf(uf, coberturaPrSp) {
  if (!coberturaPrSp) return MAX_PAGES_PER_UF_MOD;
  if (uf === "PR") return MAX_PAGES_PR_PRESET;
  if (uf === "SP") return MAX_PAGES_SP_PRESET;
  return MAX_PAGES_PER_UF_MOD;
}

function distFromOrigin(origin, codigo) {
  if (!codigo || !_byIbge[codigo]) return null;
  var m = _byIbge[codigo];
  return haversineKm(origin.a, origin.o, m.a, m.o);
}

function parseEsferas(raw) {
  var def = { M: true, E: true };
  if (!raw || !String(raw).trim()) return def;
  var set = Object.create(null);
  String(raw)
    .split(",")
    .map(function (s) {
      return s.trim().toUpperCase();
    })
    .filter(Boolean)
    .forEach(function (c) {
      set[c] = true;
    });
  return set;
}

function mapItem(o, distKm) {
  var uo = o.unidadeOrgao || {};
  var oe = o.orgaoEntidade || {};
  var esfera = oe.esferaId || "";
  return {
    orgao: oe.razaoSocial || o.nomeOrgao || "Órgão público",
    municipio: uo.municipioNome || "",
    uf: uo.ufSigla || "",
    ibge: uo.codigoIbge ? Number(uo.codigoIbge) : null,
    esfera: esfera,
    esferaNome: ESFERA_LABEL[esfera] || esfera || "—",
    modalidade: o.modalidadeNome || "",
    objeto: o.objetoCompra || o.objeto || "",
    dataAbertura: o.dataAberturaProposta || null,
    dataEncerramento: o.dataEncerramentoProposta || null,
    valorEstimado:
      o.valorTotalEstimado != null ? Number(o.valorTotalEstimado) : null,
    numeroControlePNCP: o.numeroControlePNCP || null,
    distanciaKm: distKm != null ? Math.round(distKm * 10) / 10 : null,
    link: pncpLink(o),
  };
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
    loadMunicipios();
    var q = req.query || {};
    var ibge = Number(q.ibge || q.codigoIbge || 0);
    var coberturaRaw = String(q.cobertura || q.preset || "")
      .trim()
      .toLowerCase();
    var coberturaPrSp =
      coberturaRaw === "pr-sp" ||
      coberturaRaw === "pr_sp" ||
      coberturaRaw === "parana-sp";
    var raio = Number(q.raio != null ? q.raio : DEFAULT_RAIO_KM);
    if (!Number.isFinite(raio)) raio = DEFAULT_RAIO_KM;
    if (coberturaPrSp && (q.raio == null || q.raio === "")) {
      raio = PRESET_PR_SP_RAIO_KM;
    }
    raio = Math.max(10, Math.min(MAX_RAIO_KM, raio));

    if (!ibge || !_byIbge[ibge]) {
      return json(res, 400, {
        ok: false,
        error:
          "Informe um código IBGE válido do município de origem (parâmetro ibge).",
      });
    }

    var origin = _byIbge[ibge];
    var nearbyMap = Object.create(null);
    var ufs = Object.create(null);
    var munList = loadMunicipios();
    for (var i = 0; i < munList.length; i++) {
      var m = munList[i];
      var d = haversineKm(origin.a, origin.o, m.a, m.o);
      if (d <= raio) {
        nearbyMap[m.i] = d;
        if (m.u) ufs[m.u] = true;
      }
    }
    // Sempre inclui UF de origem (órgãos estaduais na capital podem estar no raio)
    if (origin.u) ufs[origin.u] = true;

    // Prioriza UFs com mais municípios no raio (limite p/ timeout Vercel)
    var ufCounts = Object.create(null);
    Object.keys(nearbyMap).forEach(function (code) {
      var mm = _byIbge[Number(code)];
      if (!mm || !mm.u) return;
      ufCounts[mm.u] = (ufCounts[mm.u] || 0) + 1;
    });
    if (origin.u && !ufCounts[origin.u]) ufCounts[origin.u] = 1;
    var ufList = Object.keys(ufCounts).sort(function (a, b) {
      if (origin.u && a === origin.u) return -1;
      if (origin.u && b === origin.u) return 1;
      return (ufCounts[b] || 0) - (ufCounts[a] || 0);
    });

    if (coberturaPrSp) {
      // Cobertura Paraná + divisas SP: consulta só PR (prioritário) e SP
      ufList = ["PR", "SP"];
      ufs = { PR: true, SP: true };
    } else if (ufList.length > MAX_UFS) {
      // Mantém UF de origem + demais até o limite
      var rest = ufList.filter(function (u) {
        return u !== origin.u;
      });
      ufList = (origin.u ? [origin.u] : []).concat(rest).slice(0, MAX_UFS);
    }

    var esferas = parseEsferas(q.esferas);
    var keywords = String(q.q || q.keywords || "")
      .split(",")
      .map(function (s) {
        return fold(s).trim();
      })
      .filter(Boolean);

    var modalidades = DEFAULT_MODALIDADES.slice();
    if (String(q.extra || "") === "1" || String(q.ampliar || "") === "1") {
      modalidades = DEFAULT_MODALIDADES.concat(EXTRA_MODALIDADES);
    }

    var dataFinal = ymd(new Date());
    var raw = [];
    var errors = [];
    var seen = Object.create(null);

    var jobs = [];
    for (var ui = 0; ui < ufList.length; ui++) {
      for (var mi = 0; mi < modalidades.length; mi++) {
        jobs.push({ uf: ufList[ui], modalidade: modalidades[mi] });
      }
    }

    var settled = await Promise.all(
      jobs.map(function (job) {
        return fetchPropostasUf(
          job.uf,
          dataFinal,
          job.modalidade,
          pagesForUf(job.uf, coberturaPrSp)
        )
          .then(function (chunk) {
            return { ok: true, job: job, chunk: chunk };
          })
          .catch(function (e) {
            return {
              ok: false,
              job: job,
              error: e.message || String(e),
            };
          });
      })
    );

    for (var si = 0; si < settled.length; si++) {
      var s = settled[si];
      if (!s.ok) {
        errors.push({
          uf: s.job.uf,
          modalidade: s.job.modalidade,
          error: s.error,
        });
        continue;
      }
      var chunk = s.chunk || [];
      for (var ci = 0; ci < chunk.length; ci++) {
        var item = chunk[ci];
        var key =
          item.numeroControlePNCP ||
          [
            (item.orgaoEntidade && item.orgaoEntidade.cnpj) || "",
            item.anoCompra,
            item.sequencialCompra,
          ].join("-");
        if (seen[key]) continue;
        seen[key] = true;
        raw.push(item);
      }
    }

    var results = [];
    for (var ri = 0; ri < raw.length; ri++) {
      var o = raw[ri];
      var uo = o.unidadeOrgao || {};
      var oe = o.orgaoEntidade || {};
      var esfera = String(oe.esferaId || "").toUpperCase();
      if (!esferas[esfera]) continue;

      var codigo = uo.codigoIbge ? Number(uo.codigoIbge) : 0;
      var itemUf = String(uo.ufSigla || "").toUpperCase();
      var dist =
        codigo && nearbyMap[codigo] != null ? nearbyMap[codigo] : null;

      if (coberturaPrSp) {
        // PR: todos os resultados do estado; SP: só no raio da origem
        if (itemUf === "PR") {
          if (dist == null) dist = distFromOrigin(origin, codigo);
        } else if (itemUf === "SP") {
          if (dist == null) dist = distFromOrigin(origin, codigo);
          if (dist == null || dist > raio) continue;
        } else {
          if (dist == null || dist > raio) continue;
        }
      } else if (dist == null) {
        continue;
      }

      var objeto = fold(o.objetoCompra || o.objeto || "");
      if (keywords.length) {
        var hit = keywords.some(function (k) {
          return objeto.indexOf(k) !== -1;
        });
        if (!hit) continue;
      }

      results.push(mapItem(o, dist));
    }

    results.sort(function (a, b) {
      var da = a.distanciaKm != null ? a.distanciaKm : 1e9;
      var db = b.distanciaKm != null ? b.distanciaKm : 1e9;
      return da - db;
    });

    var avisos = [
      "Fonte: PNCP (propostas em aberto). Cobertura depende do cadastro dos órgãos no portal.",
      "Por padrão consulta Pregão Eletrônico (mod. 6); use ampliar=1 para incluir concorrência/pregão presencial.",
      "Distância pelo município da unidade do órgão (IBGE). Editais só em portais locais (fora do PNCP) não aparecem.",
      "Raio máximo: " + MAX_RAIO_KM + " km (padrão " + DEFAULT_RAIO_KM + " km).",
    ];
    if (coberturaPrSp) {
      avisos.push(
        "Cobertura «Paraná + divisas SP»: inclui todos os editais de PR retornados pelo PNCP e editais de SP dentro do raio."
      );
      avisos.push(
        "Limite serverless: PR até " +
          MAX_PAGES_PR_PRESET +
          " página(s)/modalidade (" +
          PAGE_SIZE +
          " itens/página); SP até " +
          MAX_PAGES_SP_PRESET +
          " página(s). Consulta só UFs PR e SP."
      );
    } else {
      avisos.push(
        "Até " +
          MAX_PAGES_PER_UF_MOD +
          " página(s) e " +
          MAX_UFS +
          " UF(s) por consulta (limite serverless)."
      );
    }

    return json(res, 200, {
      ok: true,
      origem: {
        ibge: origin.i,
        nome: origin.n,
        uf: origin.u,
        lat: origin.a,
        lng: origin.o,
      },
      raioKm: raio,
      cobertura: coberturaPrSp ? "pr-sp" : null,
      municipiosNoRaio: Object.keys(nearbyMap).length,
      ufsConsultadas: ufList,
      modalidades: modalidades,
      totalBrutoPncp: raw.length,
      total: results.length,
      editais: results,
      avisos: avisos,
      errosParciais: errors.length ? errors : undefined,
    });
  } catch (err) {
    return json(res, 500, {
      ok: false,
      error: err.message || String(err),
    });
  }
};
