/**
 * GET /api/search-ml?q=TERMO&limit=10
 * 1) Tenta API oficial MLB (OAuth)
 * 2) Se UNAUTHORIZED/403 → fallback listagem pública
 */
var safeJson = require("./_lib/safe-json");
var mlAuth = require("./_lib/ml-auth");
var mlPublic = require("./_lib/ml-public-search");

function cors(res) {
  safeJson.applyCors(res, "GET,OPTIONS");
}

function json(res, status, body) {
  safeJson.sendJson(res, status, body, "GET,OPTIONS");
}

function cleanQuery(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function mapOfficialItem(it) {
  var sellerNick =
    (it.seller && it.seller.nickname) ||
    (it.seller && it.seller.eshop && it.seller.eshop.nick_name) ||
    "";
  var seller =
    sellerNick ||
    (it.seller && it.seller.id ? "Vendedor #" + it.seller.id : "—");
  var thumb = it.thumbnail || "";
  if (thumb.indexOf("http://") === 0) {
    thumb = "https://" + thumb.slice(7);
  }
  var freeShipping = !!(it.shipping && it.shipping.free_shipping);
  if (!freeShipping && Array.isArray(it.tags)) {
    freeShipping = it.tags.indexOf("free_shipping") !== -1;
  }
  return {
    title: String(it.title || ""),
    price: Number(it.price) || 0,
    permalink: String(it.permalink || ""),
    thumbnail: thumb,
    seller: String(seller),
    free_shipping: freeShipping,
    freteLabel: freeShipping ? "FRETE GRÁTIS" : "",
    id: it.id || null,
    currency_id: it.currency_id || "BRL",
    available_quantity:
      typeof it.available_quantity === "number" ? it.available_quantity : 1,
  };
}

function isUnauthorized(err, bodyText) {
  var msg = String(
    (err && err.message) || bodyText || ""
  ).toLowerCase();
  return (
    (err && (err.status === 403 || err.status === 401)) ||
    msg.indexOf("unauthorized") !== -1 ||
    msg.indexOf("forbidden") !== -1 ||
    msg.indexOf("access_denied") !== -1 ||
    msg.indexOf("policy") !== -1
  );
}

async function searchOfficial(q, limit, token) {
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);
  var attempts = [];
  /* Com token e sem token — alguns apps quebram com Bearer na search pública */
  var headersList = [mlAuth.authHeaders(token)];
  if (token) headersList.push({ Accept: "application/json" });

  for (var i = 0; i < headersList.length; i++) {
    var r = await fetch(url, { method: "GET", headers: headersList[i] });
    var text = await r.text();
    var j = null;
    try {
      j = text ? JSON.parse(text) : null;
    } catch (e) {
      j = null;
    }
    if (r.ok && j && Array.isArray(j.results)) {
      return {
        ok: true,
        results: j.results.map(mapOfficialItem),
        source: "api_oficial",
      };
    }
    attempts.push({
      status: r.status,
      message: (j && (j.message || j.error)) || text.slice(0, 160),
    });
    if (!isUnauthorized({ status: r.status, message: text }, text)) {
      var err = new Error(
        (j && (j.message || j.error)) || "Mercado Livre HTTP " + r.status
      );
      err.status = r.status;
      err.body = j;
      throw err;
    }
  }
  var last = attempts[attempts.length - 1] || {};
  var denied = new Error(
    last.message || "At least one policy returned UNAUTHORIZED."
  );
  denied.status = last.status || 403;
  throw denied;
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, 405, { ok: false, error: "Use GET", results: [] });
  }

  try {
    var q = cleanQuery((req.query && req.query.q) || "");
    var limit = Math.min(
      Math.max(parseInt((req.query && req.query.limit) || "10", 10) || 10, 1),
      20
    );

    if (!q) {
      return json(res, 400, {
        ok: false,
        error: "Informe o parâmetro q (nome do produto).",
        results: [],
      });
    }

    var token = "";
    try {
      token = await mlAuth.getAccessToken();
    } catch (authErr) {
      /* segue para fallback público */
      token = "";
    }

    var variants = mlPublic.buildQueryVariants(q);
    var officialErr = null;

    for (var vi = 0; vi < Math.min(variants.length, 3); vi++) {
      try {
        var official = await searchOfficial(variants[vi], limit, token);
        if (official.ok && official.results.length) {
          return json(res, 200, {
            ok: true,
            q: q,
            query_used: variants[vi],
            source: "api_oficial",
            authenticated: !!token,
            results: official.results.slice(0, limit),
          });
        }
      } catch (e) {
        officialErr = e;
        if (!isUnauthorized(e)) break;
      }
    }

    /* Fallback: listagem pública (API search bloqueada pelo ML) */
    var pub = await mlPublic.searchPublicIndex(q, limit);
    if (pub.ok && pub.results && pub.results.length) {
      return json(res, 200, {
        ok: true,
        q: q,
        query_used: pub.query_used || q,
        source: "public_index",
        authenticated: !!token,
        results: pub.results,
        warning:
          "A busca geral da API ML está restrita (UNAUTHORIZED). Usei a listagem pública do Mercado Livre.",
      });
    }

    var detail =
      (officialErr && officialErr.message) ||
      (pub && pub.error) ||
      "sem resultados";
    if (isUnauthorized(officialErr)) {
      detail =
        "O Mercado Livre bloqueou a busca geral da API (UNAUTHORIZED). Tente um termo mais curto ou tente novamente em instantes.";
    }

    return json(res, 200, {
      ok: false,
      q: q,
      results: [],
      error: 'Nenhum produto encontrado para "' + q + '". ' + detail,
      tried: (pub && pub.tried) || variants,
    });
  } catch (err) {
    var msg = (err && err.message) || "Falha ao consultar o Mercado Livre.";
    if (isUnauthorized(err)) {
      msg =
        "Mercado Livre recusou a busca (UNAUTHORIZED). O sistema tentará listagem pública no próximo request — se persistir, use termo mais curto.";
    }
    return json(res, 200, {
      ok: false,
      error: msg,
      results: [],
    });
  }
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
