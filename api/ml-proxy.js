/**
 * Proxy Mercado Livre (Vercel serverless).
 * - Busca oficial: api.mercadolibre.com
 * - Fallback: lista.mercadolivre.com.br (JSON-LD com preùo)
 * - Frete: shipping_options com ID real do anùncio (resolvido via pùgina do produto)
 */
const ML_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function json(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body));
}

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) =>
      String.fromCharCode(parseInt(h, 16))
    )
    .replace(/\\\//g, "/");
}

async function fetchText(url, opts) {
  opts = opts || {};
  const headers = Object.assign(
    {
      "User-Agent": ML_UA,
      Accept: opts.accept || "text/html,application/xhtml+xml,application/json",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
    },
    opts.headers || {}
  );
  const r = await fetch(url, { headers, redirect: "follow" });
  const text = await r.text();
  return { ok: r.ok, status: r.status, text };
}

function slugQuery(q) {
  return String(q || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Anùncio real MLB costuma ter 9ù14 dùgitos; catùlogo /p/MLB27621585 tem 8 e nùo calcula frete. */
function isRealItemId(id) {
  return /^MLB\d{9,14}$/i.test(String(id || ""));
}

function catalogIdFromUrl(url) {
  const m = String(url || "").match(/\/(?:p|up)\/(MLB[U0-9A-Z]+)/i);
  return m ? m[1].toUpperCase() : "";
}

function parseLdProducts(html) {
  const out = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    let raw = decodeHtmlEntities(m[1].trim());
    let data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      continue;
    }
    const nodes = [];
    if (Array.isArray(data)) nodes.push.apply(nodes, data);
    else if (data && Array.isArray(data["@graph"]))
      nodes.push.apply(nodes, data["@graph"]);
    else if (data) nodes.push(data);

    nodes.forEach(function (n) {
      if (!n || n["@type"] !== "Product") return;
      const offers = n.offers;
      const offer = Array.isArray(offers) ? offers[0] : offers;
      const price = offer ? Number(offer.price) : NaN;
      const url = (offer && offer.url) || n.url || "";
      const avail = String((offer && offer.availability) || "");
      const inStock = !/OutOfStock/i.test(avail);
      if (!n.name || !url) return;
      const catalog = catalogIdFromUrl(url);
      out.push({
        id: catalog || "MLB" + String(out.length).padStart(2, "0"),
        title: String(n.name),
        price: isFinite(price) ? price : 0,
        currency_id: (offer && offer.priceCurrency) || "BRL",
        permalink: url,
        thumbnail: Array.isArray(n.image) ? n.image[0] : n.image || "",
        available_quantity: inStock ? 1 : 0,
        catalog_id: catalog,
      });
    });
  }
  return out;
}

async function searchOfficial(q, limit) {
  const url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);
  const r = await fetchText(url, { accept: "application/json" });
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.status === 403 ? "forbidden" : r.text.slice(0, 200),
    };
  }
  let j;
  try {
    j = JSON.parse(r.text);
  } catch (e) {
    return { ok: false, status: 502, error: "invalid json" };
  }
  const results = (j.results || []).map(function (it) {
    return {
      id: it.id,
      title: it.title,
      price: Number(it.price) || 0,
      currency_id: it.currency_id || "BRL",
      permalink: it.permalink || "",
      thumbnail: it.thumbnail || "",
      available_quantity:
        typeof it.available_quantity === "number" ? it.available_quantity : 1,
    };
  });
  return { ok: true, results, source: "api" };
}

async function searchPublicIndex(q, limit) {
  const slug = slugQuery(q) || "produto";
  const url = "https://lista.mercadolivre.com.br/" + encodeURIComponent(slug);
  const r = await fetchText(url);
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: "lista http " + r.status,
      results: [],
    };
  }
  let results = parseLdProducts(r.text);
  // Dedup by permalink
  const seen = {};
  results = results.filter(function (it) {
    const k = (it.permalink || it.title).toLowerCase();
    if (seen[k]) return false;
    seen[k] = 1;
    return true;
  });
  return {
    ok: true,
    results: results.slice(0, limit),
    source: "public_index",
  };
}

async function resolveItemId(permalink, fallbackId) {
  if (isRealItemId(fallbackId)) return String(fallbackId).toUpperCase();
  if (!permalink) return "";
  try {
    const r = await fetchText(permalink);
    if (!r.ok) return "";
      const m =
      r.text.match(/"item_id"\s*:\s*"(MLB\d{9,14})"/i) ||
      r.text.match(/"id"\s*:\s*"(MLB\d{9,14})"/i) ||
      r.text.match(/\b(MLB\d{9,14})\b/i);
    return m ? String(m[1]).toUpperCase() : "";
  } catch (e) {
    return "";
  }
}

async function enrichPricesFromPages(results, max) {
  max = Math.min(max || 5, results.length);
  const out = results.slice();
  for (let i = 0; i < max; i++) {
    const it = out[i];
    if (!it) continue;
    if (it.price > 0 && isRealItemId(it.id)) continue;
    if (!it.permalink) continue;
    try {
      const r = await fetchText(it.permalink);
      if (!r.ok) continue;
      if (!(it.price > 0)) {
        const pm = r.text.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
        if (pm) it.price = Number(pm[1]) || 0;
      }
      const idm =
        r.text.match(/"item_id"\s*:\s*"(MLB\d{9,14})"/i) ||
        r.text.match(/"id"\s*:\s*"(MLB\d{9,14})"/i);
      if (idm) {
        it.id = String(idm[1]).toUpperCase();
        it.item_id = it.id;
      }
    } catch (e) {
      /* ignore */
    }
  }
  return out;
}

async function shippingOfficial(itemId, cep) {
  const url =
    "https://api.mercadolibre.com/items/" +
    encodeURIComponent(itemId) +
    "/shipping_options?zip_code=" +
    encodeURIComponent(cep);
  const r = await fetchText(url, { accept: "application/json" });
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      note: "Frete indisponùvel via API (HTTP " + r.status + ")",
    };
  }
  let j;
  try {
    j = JSON.parse(r.text);
  } catch (e) {
    return { ok: false, status: 502, note: "Resposta de frete invùlida" };
  }
  const opts = j.options || [];
  let cost = null;
  opts.forEach(function (o) {
    if (typeof o.cost === "number") {
      if (cost === null || o.cost < cost) cost = o.cost;
    }
  });
  return {
    ok: true,
    options: opts,
    cost: cost === null ? 0 : cost,
    note: cost === 0 ? "Frete grùtis / R$ 0,00" : "",
    source: "api",
  };
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, 405, { error: "method_not_allowed" });
  }

  const q = req.query || {};
  const action = String(q.action || "").toLowerCase();

  try {
    if (action === "search") {
      const term = String(q.q || "").trim();
      const limit = Math.min(Math.max(parseInt(q.limit, 10) || 5, 1), 20);
      if (!term) return json(res, 400, { error: "missing_q", results: [] });

      const official = await searchOfficial(term, limit);
      if (official.ok && official.results.length) {
        return json(res, 200, {
          source: "api",
          results: official.results,
        });
      }

      const pub = await searchPublicIndex(term, limit);
      if (!pub.ok) {
        return json(res, 200, {
          source: "public_index",
          results: [],
          warning: "Falha no fallback de listagem ML",
          upstream_status: official.status || pub.status,
          upstream_error: official.error || pub.error,
        });
      }

      let results = pub.results;
      // Enrich: garantir preùo + id real do anùncio (para frete)
      results = await enrichPricesFromPages(results, Math.min(limit, 5));

      return json(res, 200, {
        source: "public_index",
        results: results,
        warning:
          "API ML bloqueada (" +
          (official.status || 403) +
          "). Resultados via ùndice pùblico + enrich.",
        upstream_status: official.status || 403,
        upstream_error: official.error || "forbidden",
      });
    }

    if (action === "shipping") {
      const cep = String(q.cep || "").replace(/\D/g, "");
      let itemId = String(q.itemId || q.item_id || "").trim();
      const permalink = String(q.permalink || q.url || "").trim();

      if (!cep || cep.length < 8) {
        return json(res, 400, {
          source: "fallback",
          options: [],
          cost: 0,
          note: "CEP invùlido ou nùo informado",
        });
      }

      if (!isRealItemId(itemId)) {
        itemId = await resolveItemId(permalink, itemId);
      }

      if (!isRealItemId(itemId)) {
        return json(res, 200, {
          source: "fallback",
          options: [],
          cost: 0,
          note:
            "Nùo foi possùvel obter o ID real do anùncio para calcular frete. Abra o link do produto.",
          resolved_id: itemId || null,
        });
      }

      const ship = await shippingOfficial(itemId, cep);
      if (!ship.ok) {
        return json(res, 200, {
          source: "fallback",
          options: [],
          cost: 0,
          note: ship.note,
          upstream_status: ship.status,
          itemId: itemId,
        });
      }
      return json(res, 200, {
        source: ship.source,
        options: ship.options,
        cost: ship.cost,
        note: ship.note || "",
        itemId: itemId,
      });
    }

    return json(res, 400, {
      error: "invalid_action",
      hint: "Use action=search|shipping",
    });
  } catch (err) {
    return json(res, 500, {
      error: "proxy_error",
      message: (err && err.message) || String(err),
      results: [],
      options: [],
      cost: 0,
    });
  }
};
