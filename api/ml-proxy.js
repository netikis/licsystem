/**
 * LICSYSTEM — Proxy Mercado Livre (Vercel Serverless)
 * Evita 403/CORS do browser mascarando a origem no backend.
 *
 * Uso:
 *   GET /api/ml-proxy?action=search&q=furadeira&limit=5
 *   GET /api/ml-proxy?action=shipping&itemId=MLB123&cep=84900000
 */

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  Origin: "https://www.mercadolivre.com.br",
  Referer: "https://www.mercadolivre.com.br/",
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

async function fetchJson(url) {
  const r = await fetch(url, { headers: BROWSER_HEADERS, redirect: "follow" });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {
    json = null;
  }
  return { ok: r.ok, status: r.status, json, text };
}

function mapApiResults(json, limit) {
  const results = Array.isArray(json && json.results) ? json.results : [];
  return {
    source: "api",
    results: results.slice(0, limit).map((it) => ({
      id: it.id,
      title: it.title,
      price: it.price,
      currency_id: it.currency_id,
      permalink: it.permalink,
      thumbnail: it.thumbnail,
      available_quantity: it.available_quantity,
      shipping: it.shipping || null,
    })),
  };
}

/** Fallback: página pública lista.mercadolivre.com.br */
async function searchViaListaHtml(q, limit) {
  const url =
    "https://lista.mercadolivre.com.br/" +
    encodeURIComponent(String(q || "").trim()).replace(/%20/g, "-");
  const r = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  if (!r.ok) {
    return {
      source: "html_fallback",
      error: "html_fetch_failed",
      status: r.status,
      results: [],
    };
  }
  const html = await r.text();
  const results = [];

  // 1) __PRELOADED_STATE__ / similar
  const stateMatch =
    html.match(/<script[^>]*id="__PRELOADED_STATE__"[^>]*>([\s\S]*?)<\/script>/i) ||
    html.match(/window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\});/);
  if (stateMatch && stateMatch[1]) {
    try {
      const state = JSON.parse(stateMatch[1].trim());
      const candidates =
        (state && state.pageState && state.pageState.initialState && state.pageState.initialState.results) ||
        (state && state.initialState && state.initialState.results) ||
        (state && state.results) ||
        [];
      if (Array.isArray(candidates)) {
        candidates.forEach((it) => {
          const id = it.id || it.itemId || (it.poly && it.poly.id);
          const title = it.title || (it.poly && it.poly.title) || "";
          const price =
            (it.price && (it.price.amount || it.price)) ||
            (it.poly && it.poly.price && it.poly.price.amount) ||
            null;
          const permalink =
            it.permalink ||
            it.url ||
            (id ? "https://produto.mercadolivre.com.br/" + id : "");
          if (id && title) {
            results.push({
              id: String(id),
              title: String(title),
              price: Number(price) || 0,
              currency_id: "BRL",
              permalink: String(permalink),
              thumbnail: (it.thumbnail || it.picture || "") + "",
              available_quantity: typeof it.available_quantity === "number" ? it.available_quantity : 1,
            });
          }
        });
      }
    } catch (_) {
      /* segue para regex */
    }
  }

  // 2) Regex em blocos JSON embutidos (polycard / items)
  if (!results.length) {
    const itemRe =
      /"id"\s*:\s*"(MLB\d+)"[\s\S]{0,400}?"title"\s*:\s*"([^"\\]*(?:\\.[^"\\]*)*)"[\s\S]{0,400}?"price"\s*:\s*\{[\s\S]{0,120}?"amount"\s*:\s*([0-9]+(?:\.[0-9]+)?)/gi;
    let m;
    const seen = {};
    while ((m = itemRe.exec(html)) !== null && results.length < limit) {
      const id = m[1];
      if (seen[id]) continue;
      seen[id] = 1;
      let title = m[2].replace(/\\"/g, '"').replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
        String.fromCharCode(parseInt(h, 16))
      );
      results.push({
        id,
        title,
        price: Number(m[3]) || 0,
        currency_id: "BRL",
        permalink: "https://produto.mercadolivre.com.br/" + id,
        thumbnail: "",
        available_quantity: 1,
      });
    }
  }

  return {
    source: "html_fallback",
    results: results.slice(0, limit),
    warning: results.length
      ? "API oficial retornou 403; usando fallback da listagem pública."
      : "API 403 e fallback HTML sem resultados.",
  };
}

async function handleSearch(q, limit) {
  const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const query = String(q || "").trim();
  if (!query) {
    return { status: 400, body: { error: "missing_q", message: "Parâmetro q obrigatório." } };
  }

  const apiUrl =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(query) +
    "&limit=" +
    lim;

  const api = await fetchJson(apiUrl);
  if (api.ok && api.json) {
    return { status: 200, body: mapApiResults(api.json, lim) };
  }

  // 403/401/etc → fallback HTML (servidor, sem CORS)
  if (api.status === 403 || api.status === 401 || api.status === 429 || !api.ok) {
    const fallback = await searchViaListaHtml(query, lim);
    return {
      status: fallback.results.length ? 200 : 502,
      body: {
        ...fallback,
        upstream_status: api.status,
        upstream_error: (api.json && (api.json.message || api.json.error)) || "forbidden",
      },
    };
  }

  return {
    status: api.status || 502,
    body: {
      error: "ml_search_failed",
      upstream_status: api.status,
      upstream: api.json,
      results: [],
    },
  };
}

async function handleShipping(itemId, cep) {
  const id = String(itemId || "").trim();
  const zip = String(cep || "").replace(/\D/g, "");
  if (!id) {
    return { status: 400, body: { error: "missing_itemId", options: [] } };
  }
  if (!zip) {
    return { status: 200, body: { options: [], note: "CEP não informado", cost: 0 } };
  }

  const url =
    "https://api.mercadolibre.com/items/" +
    encodeURIComponent(id) +
    "/shipping_options?zip_code=" +
    encodeURIComponent(zip);

  const api = await fetchJson(url);
  if (api.ok && api.json) {
    const opts = Array.isArray(api.json.options) ? api.json.options : [];
    let cost = 0;
    let found = false;
    opts.forEach((o) => {
      if (typeof o.cost === "number") {
        if (!found || o.cost < cost) {
          cost = o.cost;
          found = true;
        }
      }
    });
    return {
      status: 200,
      body: {
        source: "api",
        options: opts,
        cost: found ? cost : 0,
        note: found ? "" : "Frete não retornado",
      },
    };
  }

  // Frete indisponível (403 comum) — não derruba o cruzamento
  return {
    status: 200,
    body: {
      source: "fallback",
      options: [],
      cost: 0,
      note: "Frete indisponível via API (HTTP " + api.status + ")",
      upstream_status: api.status,
    },
  };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const action = String((req.query && req.query.action) || "search").toLowerCase();
    let out;

    if (action === "search") {
      out = await handleSearch(req.query.q, req.query.limit);
    } else if (action === "shipping" || action === "frete") {
      out = await handleShipping(req.query.itemId || req.query.id, req.query.cep || req.query.zip_code);
    } else {
      out = {
        status: 400,
        body: { error: "invalid_action", message: "Use action=search|shipping" },
      };
    }

    res.status(out.status).json(out.body);
  } catch (err) {
    res.status(500).json({
      error: "proxy_internal_error",
      message: err && err.message ? err.message : String(err),
      results: [],
    });
  }
};
