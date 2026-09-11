/**
 * GET /api/pncp-itens
 * Busca os itens oficiais de uma compra no PNCP (quando o PDF do edital
 * só remete ao anexo / termo de referência).
 *
 * Query: cnpj, numero (pregão), ano, processo?, uf?, dataInicial?, dataFinal?
 */
var safeJson = require("./_lib/safe-json");

var PNCP_API = "https://pncp.gov.br/api/pncp/v1";
var PNCP_CONSULTA = "https://pncp.gov.br/api/consulta/v1";
var FETCH_TIMEOUT_MS = 25000;

function digits(s) {
  return String(s || "").replace(/\D/g, "");
}

function fetchJson(url) {
  var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = setTimeout(function () {
    try {
      if (ctrl) ctrl.abort();
    } catch (e) {}
  }, FETCH_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "LICSYSTEM/1.0 (pncp-itens)"
    },
    signal: ctrl ? ctrl.signal : undefined
  })
    .then(function (res) {
      return res.text().then(function (raw) {
        var body = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch (e) {
          body = null;
        }
        if (!res.ok) {
          var err = new Error(
            (body && (body.message || body.error || body.detail)) ||
              "PNCP HTTP " + res.status
          );
          err.status = res.status;
          throw err;
        }
        return body;
      });
    })
    .finally(function () {
      clearTimeout(timer);
    });
}

function undPncp(u) {
  u = String(u || "UN").toUpperCase().replace(/\.$/, "");
  if (u === "UNIDADE" || u === "UNID" || u === "UND" || u === "UNI") return "UN";
  return u || "UN";
}

function mapItem(it) {
  if (!it) return null;
  var qtd = Number(it.quantidade) || 0;
  var vu = Number(it.valorUnitarioEstimado) || 0;
  var vt = Number(it.valorTotal) || 0;
  var produto = String(it.descricao || "").replace(/\s+/g, " ").trim();
  if (!(qtd > 0) || !produto) return null;
  return {
    lote: String(it.numeroItem || ""),
    qtd: qtd,
    und: undPncp(it.unidadeMedida),
    produto: produto,
    editalVunit: vu,
    editalTotal: vt || (vu && qtd ? vu * qtd : 0)
  };
}

async function listItens(cnpj, ano, seq) {
  var out = [];
  var pagina = 1;
  for (; pagina <= 20; pagina++) {
    var url =
      PNCP_API +
      "/orgaos/" +
      encodeURIComponent(cnpj) +
      "/compras/" +
      encodeURIComponent(ano) +
      "/" +
      encodeURIComponent(seq) +
      "/itens?pagina=" +
      pagina +
      "&tamanhoPagina=50";
    var body = await fetchJson(url);
    var rows = Array.isArray(body) ? body : (body && body.data) || [];
    if (!rows.length) break;
    for (var i = 0; i < rows.length; i++) {
      var mapped = mapItem(rows[i]);
      if (mapped) out.push(mapped);
    }
    if (rows.length < 50) break;
  }
  return out;
}

function sameNumero(a, b) {
  var na = String(Number(digits(a)) || "");
  var nb = String(Number(digits(b)) || "");
  return !!(na && nb && na === nb);
}

function sameProcesso(a, b) {
  var pa = digits(a);
  var pb = digits(b);
  if (!pa || !pb) return false;
  return pa === pb || Number(pa) === Number(pb);
}

function matchCompra(row, cnpj, numero, processo) {
  if (!row) return false;
  var rowCnpj =
    (row.orgaoEntidade && row.orgaoEntidade.cnpj) || row.cnpjOrgao || "";
  if (digits(rowCnpj) !== cnpj) return false;
  if (numero) return sameNumero(row.numeroCompra, numero);
  if (processo) return sameProcesso(row.processo, processo);
  return false;
}

async function searchPublicacao(q, modalidade) {
  var cnpj = q.cnpj;
  var numero = q.numero;
  var processo = q.processo;
  var di = digits(q.dataInicial).slice(0, 8);
  var df = digits(q.dataFinal).slice(0, 8);
  if (!/^\d{8}$/.test(di)) di = q.ano + "0101";
  if (!/^\d{8}$/.test(df)) df = q.ano + "1231";
  var pagina = 1;
  for (; pagina <= 8; pagina++) {
    var url =
      PNCP_CONSULTA +
      "/contratacoes/publicacao?dataInicial=" +
      encodeURIComponent(di) +
      "&dataFinal=" +
      encodeURIComponent(df) +
      "&pagina=" +
      pagina +
      "&tamanhoPagina=50" +
      "&codigoModalidadeContratacao=" +
      encodeURIComponent(modalidade) +
      "&cnpj=" +
      encodeURIComponent(cnpj);
    var body = await fetchJson(url);
    var rows = (body && body.data) || [];
    if (!rows.length) break;
    for (var i = 0; i < rows.length; i++) {
      if (matchCompra(rows[i], cnpj, numero, processo)) return rows[i];
    }
    if (body.paginasRestantes === 0 || body.empty) break;
  }
  return null;
}

async function findCompra(q) {
  /* 6=pregão eletrônico; demais só se o número não aparecer em PE. */
  var modalidades = [6, 7, 8, 4];
  for (var i = 0; i < modalidades.length; i++) {
    var found = await searchPublicacao(q, modalidades[i]);
    if (found) return found;
  }
  return null;
}

module.exports = safeJson.wrapHandler(async function handler(req, res) {
  if (req.method === "OPTIONS") {
    safeJson.applyCors(res, "GET,OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return safeJson.sendJson(res, 405, { ok: false, error: "Use GET" });
  }

  var q = req.query || {};
  var cnpj = digits(q.cnpj);
  var ano = digits(q.ano).slice(0, 4);
  var numero = digits(q.numero);
  var processo = String(q.processo || "").trim();
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !(numero || processo)) {
    return safeJson.sendJson(res, 400, {
      ok: false,
      error: "Informe cnpj (14 dígitos), ano e numero (ou processo) do pregão."
    });
  }

  var compra;
  try {
    compra = await findCompra({
      cnpj: cnpj,
      ano: ano,
      numero: numero,
      processo: processo,
      uf: q.uf,
      dataInicial: q.dataInicial,
      dataFinal: q.dataFinal
    });
  } catch (e) {
    return safeJson.sendJson(res, e.status && e.status < 500 ? e.status : 502, {
      ok: false,
      error: (e && e.message) || "Não foi possível localizar a compra no PNCP."
    });
  }

  if (!compra) {
    return safeJson.sendJson(res, 404, {
      ok: false,
      error: "Compra não encontrada no PNCP para este CNPJ/pregão."
    });
  }

  var seq = String(compra.sequencialCompra || "");
  var itens;
  try {
    itens = await listItens(cnpj, String(compra.anoCompra || ano), seq);
  } catch (e) {
    return safeJson.sendJson(res, 502, {
      ok: false,
      error: (e && e.message) || "Não foi possível ler os itens no PNCP.",
      sequencial: seq
    });
  }

  return safeJson.sendJson(res, 200, {
    ok: true,
    sequencial: seq,
    numeroCompra: compra.numeroCompra || numero,
    objeto: compra.objetoCompra || null,
    valorTotalEstimado: compra.valorTotalEstimado || null,
    link:
      "https://pncp.gov.br/app/editais/" +
      cnpj +
      "/" +
      (compra.anoCompra || ano) +
      "/" +
      seq,
    itens: itens
  });
}, "GET,OPTIONS");
