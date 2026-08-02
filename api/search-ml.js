/**
 * GET /api/search-ml?q=PRODUTO&limit=10
 *
 * 1) POST /oauth/token → access_token
 * 2) GET /sites/MLB/search com Authorization: Bearer <token>
 * 3) Se 401/403 → retry imediato SEM Authorization (endpoint público)
 * 4) Se ainda falhar → listagem pública (HTML/JSON-LD)
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

function isAuthBlocked(status) {
  return status === 401 || status === 403;
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
    mode: (err && err.mode) || undefined,
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

function parseSearchResponse(r, text) {
  var j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch (e) {
    j = null;
  }
  return j;
}

function throwSearchError(status, j, text, mode) {
  var msg =
    (j && (j.message || j.error_description || j.error)) ||
    String(text || "").slice(0, 200) ||
    "Mercado Livre HTTP " + status;
  var err = new Error(String(msg));
  mlAuth.attachMlError(err, {
    endpoint: "/sites/MLB/search",
    status: status,
    body: j != null ? j : { raw: String(text || "").slice(0, 2000) },
    rawBody: String(text || "").slice(0, 4000),
    code: "ml_search_failed",
  });
  err.mode = mode;
  err.unauthorized = isAuthBlocked(status);
  throw err;
}

/**
 * GET /sites/MLB/search
 * mode "bearer" → Authorization: Bearer ${access_token}
 * mode "anonymous" → sem Authorization
 */
async function fetchMlbSearch(q, limit, mode, access_token) {
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);

  var headers = { Accept: "application/json" };
  if (mode === "bearer") {
    var token = String(access_token || "").trim();
    headers.Authorization = "Bearer " + token;
  }

  var r = await fetch(url, { method: "GET", headers: headers });
  var text = await r.text();
  var j = parseSearchResponse(r, text);

  if (r.ok && j && Array.isArray(j.results)) {
    return {
      ok: true,
      results: j.results.map(mapOfficialItem),
      source: mode === "bearer" ? "api_oficial" : "api_anonima",
      mode: mode,
      status: r.status,
    };
  }

  return {
    ok: false,
    status: r.status,
    body: j,
    rawBody: text,
    mode: mode,
  };
}

/**
 * Plano A: Bearer. Plano B (401/403): mesma URL sem Authorization.
 */
async function searchWithFallback(q, limit, access_token) {
  var withAuth = await fetchMlbSearch(q, limit, "bearer", access_token);
  if (withAuth.ok) return withAuth;

  if (isAuthBlocked(withAuth.status)) {
    var anon = await fetchMlbSearch(q, limit, "anonymous", "");
    if (anon.ok) {
      anon.retried_without_auth = true;
      anon.prior_status = withAuth.status;
      anon.prior_body = withAuth.body;
      return anon;
    }
    throwSearchError(anon.status, anon.body, anon.rawBody, "anonymous");
  }

  throwSearchError(withAuth.status, withAuth.body, withAuth.rawBody, "bearer");
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

  var access_token = "";
  try {
    access_token = await mlAuth.getAccessToken();
  } catch (tokenErr) {
    return json(res, 200, errorPayload(q, tokenErr, { code: "ml_token_failed" }));
  }

  if (!access_token) {
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

  for (var vi = 0; vi < Math.min(variants.length, 3); vi++) {
    try {
      var hit = await searchWithFallback(variants[vi], limit, access_token);
      if (hit.ok && hit.results.length) {
        return json(res, 200, {
          ok: true,
          q: q,
          query_used: variants[vi],
          source: hit.source,
          mode: hit.mode,
          authenticated: hit.mode === "bearer",
          authorization_header:
            hit.mode === "bearer"
              ? "Bearer <access_token>"
              : null,
          retried_without_auth: !!hit.retried_without_auth,
          results: hit.results.slice(0, limit),
          warning: hit.retried_without_auth
            ? "Bearer retornou " +
              (hit.prior_status || "401/403") +
              "; busca anônima (sem Authorization) funcionou."
            : undefined,
          ml_debug: hit.retried_without_auth
            ? {
                endpoint: "/sites/MLB/search",
                status: hit.prior_status,
                body: hit.prior_body || null,
                message:
                  "Primeira tentativa com Bearer bloqueada; retry sem Authorization ok.",
                mode: "bearer→anonymous",
              }
            : undefined,
        });
      }
      if (hit.ok && !hit.results.length) {
        lastErr = mlAuth.attachMlError(
          new Error("API sem resultados para: " + variants[vi]),
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
      if (!(e && e.unauthorized)) break;
    }
  }

  /* Plano C: listagem pública HTML se API search (bearer + anônima) falhar */
  var pubInfo = null;
  try {
    var pub = await mlPublic.searchPublicIndex(q, limit);
    pubInfo = {
      ok: !!(pub && pub.ok),
      count: pub && pub.results ? pub.results.length : 0,
      error: (pub && pub.error) || null,
      tried: (pub && pub.tried) || [],
    };
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
          "Bearer e busca anônima em /sites/MLB/search falharam (401/403). Usei listagem pública.",
        ml_debug: lastErr
          ? mlDebugFromErr(lastErr, "/sites/MLB/search")
          : undefined,
        upstream_status: lastErr ? lastErr.status : undefined,
        upstream_body: lastErr ? lastErr.body : undefined,
        upstream_endpoint: "/sites/MLB/search",
      });
    }
  } catch (pubErr) {
    pubInfo = {
      ok: false,
      count: 0,
      error: (pubErr && pubErr.message) || String(pubErr),
    };
  }

  var payload = errorPayload(q, lastErr || new Error("Sem resultados"), {
    code:
      lastErr && lastErr.unauthorized
        ? "ml_search_unauthorized"
        : "ml_search_empty",
    authenticated: true,
    tried_modes: ["bearer", "anonymous", "public_index"],
    tried: variants,
    public_index: pubInfo,
  });
  return json(res, 200, payload);
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
