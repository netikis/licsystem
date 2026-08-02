/**
 * GET /api/search-ml?q=TERMO&limit=10
 * Busca oficial Mercado Livre (MLB) com OAuth de aplicativo.
 * Resposta limpa: title, price, permalink, thumbnail, seller (+ campos compat. cruzamento).
 */
var safeJson = require("./_lib/safe-json");
var mlAuth = require("./_lib/ml-auth");

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

function mapItem(it) {
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
  var ship = it.shipping || {};
  var freeShipping = !!ship.free_shipping;
  if (!freeShipping && Array.isArray(it.tags)) {
    freeShipping = it.tags.indexOf("free_shipping") !== -1;
  }
  return {
    /* Contrato limpo pedido */
    title: String(it.title || ""),
    price: Number(it.price) || 0,
    permalink: String(it.permalink || ""),
    thumbnail: thumb,
    seller: String(seller),
    free_shipping: freeShipping,
    freteLabel: freeShipping ? "FRETE GRÁTIS" : "",
    /* Compatível com Cruzamento ML existente */
    id: it.id || null,
    currency_id: it.currency_id || "BRL",
    available_quantity:
      typeof it.available_quantity === "number" ? it.available_quantity : 1,
  };
}

async function searchMlb(q, limit, token) {
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
  if (!r.ok) {
    var err = new Error(
      (j && (j.message || j.error)) ||
        "Mercado Livre retornou HTTP " + r.status
    );
    err.status = r.status;
    err.body = j;
    throw err;
  }
  var results = Array.isArray(j && j.results) ? j.results : [];
  return results.map(mapItem);
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, 405, {
      ok: false,
      error: "Use GET",
      results: [],
    });
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

    var cred = mlAuth.getCredentials();
    if (!cred.appId || !cred.secret) {
      if (!cred.accessToken) {
        return json(res, 500, {
          ok: false,
          error:
            "Credenciais ML ausentes. Configure ML_APP_ID e ML_CLIENT_SECRET na Vercel / .env (sem prefixo VITE_).",
          results: [],
        });
      }
    }

    var token = "";
    try {
      token = await mlAuth.getAccessToken();
    } catch (authErr) {
      return json(res, 502, {
        ok: false,
        error:
          "Não foi possível autenticar no Mercado Livre: " +
          ((authErr && authErr.message) || String(authErr)),
        results: [],
      });
    }

    var results = await searchMlb(q, limit, token);
    if (!results.length) {
      return json(res, 200, {
        ok: true,
        q: q,
        results: [],
        warning: 'Nenhum produto encontrado para "' + q + '".',
      });
    }

    return json(res, 200, {
      ok: true,
      q: q,
      source: "api_oficial",
      authenticated: !!token,
      results: results.slice(0, limit),
    });
  } catch (err) {
    var status = err.status && err.status >= 400 ? err.status : 500;
    if (status === 403) status = 502;
    return json(res, status, {
      ok: false,
      error:
        (err && err.message) ||
        "Falha ao consultar a API oficial do Mercado Livre.",
      results: [],
    });
  }
}

module.exports = safeJson.wrapHandler(handler, "GET,OPTIONS");
