/**
 * GET /api/search-ml?q=PRODUTO&limit=10
 *
 * Busca pública MLB — sem OAuth / sem Authorization.
 * Headers de navegador para reduzir bloqueio WAF na Vercel.
 * Se a API ainda retornar 403, usa listagem pública (HTML).
 */
var safeJson = require("./_lib/safe-json");
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

/** Headers exatamente como solicitado (sem Authorization). */
function browserHeaders() {
  return {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "application/json",
    "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  };
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

async function searchPublicApi(q, limit) {
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);

  var r = await fetch(url, {
    method: "GET",
    headers: browserHeaders(),
  });

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
      status: r.status,
    };
  }

  return {
    ok: false,
    status: r.status,
    body: j,
    rawBody: text,
    message:
      (j && (j.message || j.error)) ||
      text.slice(0, 200) ||
      "HTTP " + r.status,
  };
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

  var variants = mlPublic.buildQueryVariants(q);
  var lastApi = null;

  /* 1) GET público sem Authorization + headers de browser */
  for (var i = 0; i < Math.min(variants.length, 3); i++) {
    try {
      var api = await searchPublicApi(variants[i], limit);
      if (api.ok && api.results.length) {
        return json(res, 200, {
          ok: true,
          q: q,
          query_used: variants[i],
          source: "api_publica",
          authenticated: false,
          results: api.results.slice(0, limit),
        });
      }
      lastApi = api;
      if (api.ok && !api.results.length) continue;
      /* 401/403 → tenta próxima variante / fallback */
      if (api.status !== 401 && api.status !== 403) break;
    } catch (e) {
      lastApi = {
        ok: false,
        status: 0,
        message: (e && e.message) || String(e),
        body: null,
        rawBody: "",
      };
      break;
    }
  }

  /* 2) Fallback listagem pública HTML (quando WAF/API ainda bloqueia) */
  try {
    var pub = await mlPublic.searchPublicIndex(q, limit);
    if (pub.ok && pub.results && pub.results.length) {
      return json(res, 200, {
        ok: true,
        q: q,
        query_used: pub.query_used || q,
        source: "public_index",
        authenticated: false,
        results: pub.results,
        warning:
          "API /sites/MLB/search retornou " +
          ((lastApi && lastApi.status) || "erro") +
          "; usei listagem pública.",
        ml_debug: lastApi
          ? {
              endpoint: "/sites/MLB/search",
              status: lastApi.status,
              body: lastApi.body,
              rawBody: String(lastApi.rawBody || "").slice(0, 2000),
              message: lastApi.message,
            }
          : undefined,
      });
    }
  } catch (pubErr) {
    /* segue */
  }

  return json(res, 200, {
    ok: false,
    q: q,
    results: [],
    authenticated: false,
    error:
      "Falha em /sites/MLB/search (sem Authorization). " +
      ((lastApi && lastApi.message) || "sem resultados"),
    ml_debug: lastApi
      ? {
          endpoint: "/sites/MLB/search",
          status: lastApi.status,
          body: lastApi.body,
          rawBody: String(lastApi.rawBody || "").slice(0, 2000),
          message: lastApi.message,
        }
      : undefined,
    upstream_status: lastApi && lastApi.status,
    upstream_body: lastApi && lastApi.body,
    upstream_endpoint: "/sites/MLB/search",
    hint_local_bridge:
      "Se persistir 403 na Vercel, rode npm run ml-bridge no PC (IP residencial).",
    tried: variants,
  });
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
