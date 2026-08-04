/**
 * GET /api/search-ml?q=PRODUTO&limit=10
 *
 * Produção (clientes / Vercel):
 * 1) Serper / Google CSE / listagem pública (ml-web-search)
 * 2) API oficial COM OAuth (ML_APP_ID + ML_CLIENT_SECRET) — costuma passar onde o anônimo toma 403
 * 3) API anônima /sites/MLB/search (quase sempre 403 no datacenter)
 *
 * Headers do cliente NUNCA são repassados ao ML.
 */
var safeJson = require("./_lib/safe-json");
var mlPublic = require("./_lib/ml-public-search");
var mlWeb = require("./_lib/ml-web-search");
var mlAuth = null;
try {
  mlAuth = require("./_lib/ml-auth");
} catch (e) {
  mlAuth = null;
}

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

function hasMlOauth() {
  if (!mlAuth || !mlAuth.getCredentials) return false;
  var c = mlAuth.getCredentials();
  return !!(c && c.appId && c.secret);
}

function hasAnySearchBackend() {
  return mlWeb.hasPaidOrFreeSearchKeys() || hasMlOauth();
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

async function searchPublicApi(q, limit, withOauth) {
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);

  var headers = isolatedMlHeaders();
  var authenticated = false;
  if (withOauth && mlAuth) {
    try {
      var token = await mlAuth.getAccessToken();
      headers = mlAuth.authHeaders(token);
      authenticated = true;
    } catch (e) {
      return {
        ok: false,
        status: (e && e.status) || 500,
        body: (e && e.body) || null,
        message: (e && e.message) || "oauth_token_failed",
        authenticated: false,
      };
    }
  }

  var r = await fetch(url, {
    method: "GET",
    headers: headers,
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

  /* Token expirado: limpa cache e tenta 1x */
  if (
    withOauth &&
    authenticated &&
    (r.status === 401 || r.status === 403) &&
    mlAuth.clearTokenCache
  ) {
    try {
      mlAuth.clearTokenCache();
      var token2 = await mlAuth.getAccessToken();
      r = await fetch(url, {
        method: "GET",
        headers: mlAuth.authHeaders(token2),
        redirect: "follow",
        cache: "no-store",
      });
      text = await r.text();
      try {
        j = text ? JSON.parse(text) : null;
      } catch (e2) {
        j = null;
      }
    } catch (e3) {
      /* mantém resposta anterior */
    }
  }

  if (r.ok && j && Array.isArray(j.results) && j.results.length) {
    return {
      ok: true,
      results: j.results.map(mapOfficialItem),
      status: r.status,
      authenticated: authenticated,
    };
  }
  return {
    ok: false,
    status: r.status,
    body: j,
    authenticated: authenticated,
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

  /* 1) Produção: público / Serper / Google CSE */
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

  var variants = mlPublic.buildQueryVariants(q);
  var lastApi = null;

  /* 2) API oficial autenticada (ML_APP_ID + ML_CLIENT_SECRET) */
  if (hasMlOauth()) {
    for (var oi = 0; oi < Math.min(variants.length, 3); oi++) {
      try {
        var oauth = await searchPublicApi(variants[oi], limit, true);
        if (oauth.ok && oauth.results.length) {
          return json(res, 200, {
            ok: true,
            q: q,
            query_used: variants[oi],
            source: "api_oauth",
            authenticated: true,
            client_headers_forwarded: false,
            results: oauth.results.slice(0, limit),
          });
        }
        lastApi = oauth;
      } catch (eO) {
        lastApi = { status: 0, message: (eO && eO.message) || String(eO) };
      }
    }
  }

  /* 3) Última tentativa: API anônima (geralmente 403 na Vercel) */
  for (var i = 0; i < Math.min(variants.length, 2); i++) {
    try {
      var api = await searchPublicApi(variants[i], limit, false);
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

  var hasKeys = hasAnySearchBackend();
  var hint;
  if (hasKeys) {
    hint =
      'Nenhum produto encontrado para "' +
      q +
      '" nas fontes disponíveis (público/Serper/Google/OAuth ML).';
  } else {
    hint =
      "Busca ML bloqueada no servidor (API 403). Configure no projeto Vercel: ML_APP_ID + ML_CLIENT_SECRET (app do Mercado Livre) e/ou SERPER_API_KEY (serper.dev) ou GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX — depois Redeploy.";
  }

  return json(res, 200, {
    ok: false,
    q: q,
    results: [],
    authenticated: !!(lastApi && lastApi.authenticated),
    client_headers_forwarded: false,
    error: hint,
    ml_debug: lastApi
      ? {
          endpoint: "/sites/MLB/search",
          status: lastApi.status,
          body: lastApi.body,
          message: lastApi.message,
          oauth_tried: hasMlOauth(),
        }
      : undefined,
    need_serper: !hasKeys,
    need_search_keys: !hasKeys,
    need_ml_oauth: !hasMlOauth(),
    tried: variants,
  });
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
