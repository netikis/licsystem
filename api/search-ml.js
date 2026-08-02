/**
 * GET /api/search-ml?q=PRODUTO&limit=10
 *
 * Produção (clientes / Vercel) — SEM ponte local:
 * 1) Serper (Google) se SERPER_API_KEY estiver na Vercel
 * 2) Listagem pública ML
 * 3) API /sites/MLB/search (quase sempre 403 no datacenter) — última tentativa
 *
 * Headers do cliente NUNCA são repassados ao ML.
 */
var safeJson = require("./_lib/safe-json");
var mlPublic = require("./_lib/ml-public-search");
var mlWeb = require("./_lib/ml-web-search");

var ML_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json",
  "Accept-Language": "pt-BR,pt;q=0.9",
};

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

function isolatedMlHeaders() {
  return {
    "User-Agent": ML_FETCH_HEADERS["User-Agent"],
    Accept: ML_FETCH_HEADERS.Accept,
    "Accept-Language": ML_FETCH_HEADERS["Accept-Language"],
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
    headers: isolatedMlHeaders(),
    redirect: "follow",
    cache: "no-store",
  });
  var text = await r.text();
  var j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch (e) {
    j = null;
  }

  if (r.ok && j && Array.isArray(j.results) && j.results.length) {
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
    message:
      (j && (j.message || j.error)) ||
      text.slice(0, 160) ||
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

  /* 1–2) Produção: Serper + listagem pública (não depende do IP do cliente) */
  try {
    var prod = await mlWeb.searchProduction(q, limit);
    if (prod.ok && prod.results && prod.results.length) {
      return json(res, 200, {
        ok: true,
        q: q,
        query_used: prod.query_used || q,
        source: prod.source,
        mode: prod.mode || prod.source,
        authenticated: false,
        client_headers_forwarded: false,
        results: prod.results.slice(0, limit),
      });
    }
  } catch (e) {
    /* segue */
  }

  /* 3) Última tentativa: API oficial (geralmente 403 na Vercel) */
  var variants = mlPublic.buildQueryVariants(q);
  var lastApi = null;
  for (var i = 0; i < Math.min(variants.length, 2); i++) {
    try {
      var api = await searchPublicApi(variants[i], limit);
      if (api.ok && api.results.length) {
        return json(res, 200, {
          ok: true,
          q: q,
          query_used: variants[i],
          source: "api_publica",
          authenticated: false,
          client_headers_forwarded: false,
          results: api.results.slice(0, limit),
        });
      }
      lastApi = api;
      if (api.status === 403 || api.status === 401) break;
    } catch (e2) {
      lastApi = { status: 0, message: (e2 && e2.message) || String(e2) };
      break;
    }
  }

  var hasKeys = mlWeb.hasPaidOrFreeSearchKeys();
  return json(res, 200, {
    ok: false,
    q: q,
    results: [],
    authenticated: false,
    client_headers_forwarded: false,
    error: hasKeys
      ? 'Nenhum produto encontrado para "' + q + '" nas fontes disponíveis.'
      : "Busca ML bloqueada no servidor (API 403). No projeto Vercel deste cliente, configure as chaves DELE: SERPER_API_KEY (grátis em serper.dev) ou GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX, depois Redeploy. Cada cliente usa as próprias chaves — custo zero para o vendedor.",
    ml_debug: lastApi
      ? {
          endpoint: "/sites/MLB/search",
          status: lastApi.status,
          body: lastApi.body,
          message: lastApi.message,
        }
      : undefined,
    need_serper: !hasKeys,
    need_search_keys: !hasKeys,
    tried: variants,
  });
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
