/**
 * GET /api/search-ml?q=PRODUTO&limit=10
 *
 * Fluxo OAuth2 Client Credentials (por requisição / cache curto):
 * 1) POST /oauth/token (grant_type=client_credentials)
 * 2) Extrai access_token
 * 3) GET /sites/MLB/search?q=... com Authorization: Bearer <token>
 *
 * Se a API oficial ainda retornar policy UNAUTHORIZED, usa listagem pública.
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

function isUnauthorized(status, message) {
  var msg = String(message || "").toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    msg.indexOf("unauthorized") !== -1 ||
    msg.indexOf("forbidden") !== -1 ||
    msg.indexOf("access_denied") !== -1 ||
    msg.indexOf("policy") !== -1
  );
}

/**
 * Busca autorizada — Bearer obrigatório.
 */
async function searchAuthorized(q, limit, token) {
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);

  var r = await fetch(url, {
    method: "GET",
    headers: mlAuth.authHeaders(token),
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
      source: "api_oficial",
    };
  }

  var msg =
    (j && (j.message || j.error_description || j.error)) ||
    text.slice(0, 200) ||
    "Mercado Livre HTTP " + r.status;
  var err = new Error(String(msg));
  err.status = r.status;
  err.body = j;
  err.unauthorized = isUnauthorized(r.status, msg);
  throw err;
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

  /* 1–2) Client Credentials → access_token */
  var accessToken = "";
  try {
    accessToken = await mlAuth.getAccessToken();
  } catch (tokenErr) {
    return json(res, 200, {
      ok: false,
      error:
        "Falha ao gerar access_token OAuth2 (client_credentials): " +
        ((tokenErr && tokenErr.message) || String(tokenErr)),
      code: (tokenErr && tokenErr.code) || "ml_token_failed",
      results: [],
    });
  }

  if (!accessToken) {
    return json(res, 200, {
      ok: false,
      error: "access_token vazio após OAuth2 client_credentials.",
      code: "ml_token_empty",
      results: [],
    });
  }

  var variants = mlPublic.buildQueryVariants(q);
  var lastErr = null;

  /* 3) Busca com Authorization: Bearer */
  for (var vi = 0; vi < Math.min(variants.length, 3); vi++) {
    try {
      var official = await searchAuthorized(variants[vi], limit, accessToken);
      if (official.ok && official.results.length) {
        return json(res, 200, {
          ok: true,
          q: q,
          query_used: variants[vi],
          source: "api_oficial",
          authenticated: true,
          results: official.results.slice(0, limit),
        });
      }
      if (official.ok && !official.results.length) {
        lastErr = new Error("API oficial sem resultados para: " + variants[vi]);
        continue;
      }
    } catch (e) {
      lastErr = e;
      /* Token expirado/inválido → regenera uma vez e tenta de novo */
      if (e && e.status === 401) {
        try {
          mlAuth.clearTokenCache();
          accessToken = await mlAuth.getAccessToken();
          var retry = await searchAuthorized(variants[vi], limit, accessToken);
          if (retry.ok && retry.results.length) {
            return json(res, 200, {
              ok: true,
              q: q,
              query_used: variants[vi],
              source: "api_oficial",
              authenticated: true,
              results: retry.results.slice(0, limit),
            });
          }
        } catch (e2) {
          lastErr = e2;
        }
      }
      if (!(e && e.unauthorized)) break;
    }
  }

  /* Fallback público se a política da API bloquear /sites/MLB/search */
  try {
    var pub = await mlPublic.searchPublicIndex(q, limit);
    if (pub.ok && pub.results && pub.results.length) {
      return json(res, 200, {
        ok: true,
        q: q,
        query_used: pub.query_used || q,
        source: "public_index",
        authenticated: true,
        results: pub.results,
        warning:
          "Token OAuth2 ok, mas /sites/MLB/search retornou UNAUTHORIZED (política ML). Usei listagem pública.",
        upstream_error: lastErr ? String(lastErr.message || lastErr) : undefined,
      });
    }
  } catch (pubErr) {
    /* ignora — devolve erro da API oficial abaixo */
  }

  return json(res, 200, {
    ok: false,
    q: q,
    authenticated: true,
    results: [],
    error:
      "Nenhum produto encontrado para \"" +
      q +
      "\". " +
      (lastErr
        ? String(lastErr.message || lastErr)
        : "Sem resultados na API oficial nem na listagem pública."),
    code:
      lastErr && lastErr.unauthorized
        ? "ml_search_unauthorized"
        : "ml_search_empty",
  });
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
