/**
 * GET /api/search-ml?q=PRODUTO&limit=10
 *
 * Fluxo OAuth2 Client Credentials:
 * 1) POST /oauth/token
 * 2) access_token
 * 3) GET /sites/MLB/search com Authorization: Bearer
 *
 * Em erro ML: devolve ml_debug { endpoint, status, body, rawBody }.
 * Se search oficial falhar por política, tenta listagem pública.
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

function mlDebugFromErr(err, fallbackEndpoint) {
  var body = err && err.body;
  var raw =
    err && err.rawBody != null
      ? String(err.rawBody)
      : body != null
        ? typeof body === "string"
          ? body
          : JSON.stringify(body)
        : "";
  return {
    endpoint: (err && err.endpoint) || fallbackEndpoint || "",
    status: err && err.status != null ? err.status : null,
    body: body != null ? body : raw ? { raw: raw.slice(0, 2000) } : null,
    rawBody: raw.slice(0, 4000),
    message: err ? String(err.message || err) : "",
    code: (err && err.code) || undefined,
  };
}

function errorPayload(q, err, extra) {
  var dbg = mlDebugFromErr(err, (extra && extra.endpoint) || "");
  var where =
    dbg.endpoint.indexOf("oauth") !== -1
      ? "Falha em /oauth/token (credenciais ou geração do token)."
      : dbg.endpoint.indexOf("search") !== -1
        ? "Falha em /sites/MLB/search (política ou token no header)."
        : "Falha na API do Mercado Livre.";
  return Object.assign(
    {
      ok: false,
      q: q || "",
      results: [],
      error: where + " " + (dbg.message || "erro desconhecido"),
      ml_debug: dbg,
      upstream_status: dbg.status,
      upstream_body: dbg.body,
      upstream_endpoint: dbg.endpoint,
    },
    extra || {}
  );
}

/**
 * Busca autorizada — Bearer obrigatório.
 */
async function searchAuthorized(q, limit, token) {
  var endpoint = "/sites/MLB/search";
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
  mlAuth.attachMlError(err, {
    endpoint: endpoint,
    status: r.status,
    body: j != null ? j : { raw: String(text || "").slice(0, 2000) },
    rawBody: String(text || "").slice(0, 4000),
    code: "ml_search_failed",
  });
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

  var accessToken = "";
  try {
    accessToken = await mlAuth.getAccessToken();
  } catch (tokenErr) {
    return json(res, 200, errorPayload(q, tokenErr, { code: "ml_token_failed" }));
  }

  if (!accessToken) {
    return json(
      res,
      200,
      errorPayload(
        q,
        mlAuth.attachMlError(new Error("access_token vazio após OAuth2."), {
          endpoint: "/oauth/token",
          status: 500,
          body: { error: "ml_token_empty" },
          rawBody: "",
          code: "ml_token_empty",
        }),
        { code: "ml_token_empty" }
      )
    );
  }

  var variants = mlPublic.buildQueryVariants(q);
  var lastErr = null;
  var authHeaderSent = true;

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
          authorization_header: "Bearer <access_token>",
          results: official.results.slice(0, limit),
        });
      }
      if (official.ok && !official.results.length) {
        lastErr = mlAuth.attachMlError(
          new Error("API oficial sem resultados para: " + variants[vi]),
          {
            endpoint: "/sites/MLB/search",
            status: 200,
            body: { results: [], query: variants[vi] },
            rawBody: '{"results":[]}',
            code: "ml_search_empty",
          }
        );
        continue;
      }
    } catch (e) {
      lastErr = e;
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
              authorization_header: "Bearer <access_token>",
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

  try {
    var pub = await mlPublic.searchPublicIndex(q, limit);
    if (pub.ok && pub.results && pub.results.length) {
      return json(res, 200, {
        ok: true,
        q: q,
        query_used: pub.query_used || q,
        source: "public_index",
        authenticated: true,
        authorization_header: "Bearer <access_token>",
        results: pub.results,
        warning:
          "Token OAuth2 ok e Authorization: Bearer foi enviado, mas /sites/MLB/search retornou erro de política. Usei listagem pública.",
        ml_debug: lastErr
          ? mlDebugFromErr(lastErr, "/sites/MLB/search")
          : undefined,
        upstream_status: lastErr ? lastErr.status : undefined,
        upstream_body: lastErr ? lastErr.body : undefined,
        upstream_endpoint: lastErr
          ? lastErr.endpoint || "/sites/MLB/search"
          : undefined,
      });
    }
  } catch (pubErr) {
    /* continua para erro detalhado */
  }

  var payload = errorPayload(q, lastErr || new Error("Sem resultados"), {
    code:
      lastErr && lastErr.unauthorized
        ? "ml_search_unauthorized"
        : "ml_search_empty",
    authenticated: true,
    authorization_header: authHeaderSent ? "Bearer <access_token>" : null,
    tried: variants,
  });
  return json(res, 200, payload);
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
