/**
 * LICSYSTEM — Proxy Mercado Livre (Vercel Serverless)
 *
 * Fluxo de busca:
 *  1) API oficial /sites/MLB/search
 *  2) Se 403 → DuckDuckGo (site:mercadolivre.com.br) + enrich catalog/item
 *  3) Sempre responde JSON (não derruba o frontend com 502 vazio)
 *
 * Uso:
 *   GET /api/ml-proxy?action=search&q=furadeira&limit=5
 *   GET /api/ml-proxy?action=shipping&itemId=MLB123&cep=84900000
 */

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

async function fetchText(url, extraHeaders) {
  const r = await fetch(url, {
    headers: { ...BROWSER_HEADERS, ...(extraHeaders || {}) },
    redirect: "follow",
  });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

async function fetchJson(url) {
  const r = await fetchText(url, { Accept: "application/json,*/*;q=0.8" });
  let json = null;
  try {
    json = r.text ? JSON.parse(r.text) : null;
  } catch (_) {
    json = null;
  }
  return { ok: r.ok, status: r.status, json, text: r.text };
}

function decodeDuck(url) {
  try {
    const u = new URL(url, "https://duckduckgo.com");
    const uddg = u.searchParams.get("uddg");
    if (uddg) return decodeURIComponent(uddg);
  } catch (_) {}
  return url;
}

function extractPriceBRL(text) {
  if (!text) return 0;
  // R$ 185 / R$1.299,90 / 185 realesR$185
  const m =
    String(text).match(/R\$\s*([\d.]+(?:,\d{2})?)/i) ||
    String(text).match(/([\d.]+(?:,\d{2})?)\s*reales?/i);
  if (!m) return 0;
  const n = parseFloat(m[1].replace(/\./g, "").replace(",", "."));
  return isFinite(n) ? n : 0;
}

function extractMlbId(url) {
  if (!url) return "";
  const s = String(url);
  let m = s.match(/\/p\/(MLB\d+)/i);
  if (m) return m[1].toUpperCase();
  m = s.match(/MLB-?(\d+)/i);
  if (m) return "MLB" + m[1];
  return "";
}

function mapApiResults(json, limit) {
  const results = Array.isArray(json && json.results) ? json.results : [];
  return {
    source: "api",
    results: results.slice(0, limit).map((it) => ({
      id: it.id,
      title: it.title,
      price: it.price,
      currency_id: it.currency_id || "BRL",
      permalink: it.permalink,
      thumbnail: it.thumbnail || "",
      available_quantity: it.available_quantity,
      shipping: it.shipping || null,
    })),
  };
}

/** Enrich via catalog product or item endpoints (quando ainda abertos) */
async function enrichProduct(id, fallback) {
  const out = Object.assign({}, fallback);
  if (!id) return out;

  // Catalog: /products/MLBxxxx
  const prod = await fetchJson("https://api.mercadolibre.com/products/" + encodeURIComponent(id));
  if (prod.ok && prod.json) {
    const p = prod.json;
    out.id = p.id || id;
    out.title = p.name || p.title || out.title;
    const buy = Array.isArray(p.buy_box_winner) ? p.buy_box_winner[0] : p.buy_box_winner;
    if (buy && typeof buy.price === "number") out.price = buy.price;
    else if (typeof p.buy_box_winner_price === "number") out.price = p.buy_box_winner_price;
    else if (p.price && typeof p.price === "number") out.price = p.price;
    out.permalink =
      p.permalink ||
      out.permalink ||
      "https://www.mercadolivre.com.br/p/" + id;
    out.thumbnail =
      (Array.isArray(p.pictures) && p.pictures[0] && (p.pictures[0].url || p.pictures[0].secure_url)) ||
      out.thumbnail ||
      "";
    out.available_quantity = 1;
    out.enriched = "catalog";
    return out;
  }

  // Item clássico
  const item = await fetchJson("https://api.mercadolibre.com/items/" + encodeURIComponent(id));
  if (item.ok && item.json) {
    const it = item.json;
    out.id = it.id || id;
    out.title = it.title || out.title;
    out.price = typeof it.price === "number" ? it.price : out.price;
    out.permalink = it.permalink || out.permalink;
    out.thumbnail = it.thumbnail || out.thumbnail || "";
    out.available_quantity = it.available_quantity;
    out.enriched = "item";
  }
  return out;
}

/** Fallback: DuckDuckGo HTML (IP de datacenter não passa no lista.mercadolivre) */
async function searchViaDuckDuckGo(q, limit) {
  const query = String(q || "").trim() + " site:mercadolivre.com.br";
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const page = await fetchText(url, {
    Accept: "text/html,application/xhtml+xml",
    Referer: "https://duckduckgo.com/",
  });

  if (!page.ok) {
    return {
      source: "duckduckgo",
      error: "ddg_fetch_failed",
      status: page.status,
      results: [],
    };
  }

  const html = page.text || "";
  const results = [];
  const seen = {};

  // Blocos result__a + snippet
  const blockRe =
    /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>([\s\S]*?)(?=<a[^>]+class="[^"]*result__a|<\/body>|$)/gi;
  let m;
  while ((m = blockRe.exec(html)) !== null && results.length < limit * 3) {
    const href = decodeDuck(m[1]);
    if (!/mercadolivre\.com\.br/i.test(href)) continue;
    if (/lista\.mercadolivre\.com\.br/i.test(href)) continue; // só listagens

    const title = String(m[2] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\s*-\s*Mercado\s*Livre.*/i, "")
      .trim();
    const snippet = String(m[3] || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const id = extractMlbId(href);
    const key = id || href;
    if (seen[key]) continue;
    seen[key] = 1;

    results.push({
      id: id || "MLB0" + results.length,
      title: title || "Produto Mercado Livre",
      price: extractPriceBRL(snippet) || extractPriceBRL(title),
      currency_id: "BRL",
      permalink: href,
      thumbnail: "",
      available_quantity: 1,
    });
  }

  // Enrich preços/títulos quando possível (catalog/item)
  const enriched = [];
  for (let i = 0; i < results.length && enriched.length < limit; i++) {
    const base = results[i];
    try {
      const full = await enrichProduct(base.id && String(base.id).startsWith("MLB") ? base.id : "", base);
      if (!full.price && base.price) full.price = base.price;
      enriched.push(full);
    } catch (_) {
      enriched.push(base);
    }
  }

  return {
    source: "duckduckgo",
    results: enriched.slice(0, limit),
    warning: enriched.length
      ? "API ML bloqueada (403). Resultados via busca pública + enrich."
      : "API ML 403 e busca alternativa sem resultados.",
  };
}

async function handleSearch(q, limit) {
  const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);
  const query = String(q || "").trim();
  if (!query) {
    return { status: 400, body: { error: "missing_q", message: "Parâmetro q obrigatório.", results: [] } };
  }

  const apiUrl =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(query) +
    "&limit=" +
    lim;

  const api = await fetchJson(apiUrl);
  if (api.ok && api.json && Array.isArray(api.json.results) && api.json.results.length) {
    return { status: 200, body: mapApiResults(api.json, lim) };
  }

  // 403/401/429/vazio → DuckDuckGo
  const fallback = await searchViaDuckDuckGo(query, lim);
  // Sempre 200 se houver results; 200 com lista vazia + warning (frontend trata)
  return {
    status: 200,
    body: {
      ...fallback,
      upstream_status: api.status,
      upstream_error: (api.json && (api.json.message || api.json.error)) || (api.ok ? "empty" : "forbidden"),
      results: fallback.results || [],
    },
  };
}

async function handleShipping(itemId, cep) {
  const id = String(itemId || "").trim();
  const zip = String(cep || "").replace(/\D/g, "");
  if (!id) {
    return { status: 400, body: { error: "missing_itemId", options: [], cost: 0 } };
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
    res.status(405).json({ error: "method_not_allowed", results: [] });
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
        body: { error: "invalid_action", message: "Use action=search|shipping", results: [] },
      };
    }

    res.status(out.status).json(out.body);
  } catch (err) {
    // Nunca 502 opaco — devolve JSON utilizável pelo frontend
    res.status(200).json({
      error: "proxy_internal_error",
      message: err && err.message ? err.message : String(err),
      results: [],
      warning: "Falha interna no proxy. Tente novamente.",
    });
  }
};
