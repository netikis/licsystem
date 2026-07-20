/**
 * Proxy Mercado Livre (Vercel serverless)
 * 1) API oficial (com ML_ACCESS_TOKEN se houver)
 * 2) Fallback: lista.mercadolivre.com.br (JSON-LD com preco)
 * 3) Frete: shipping_options com ID real do anuncio
 */
const ML_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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
    .replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
      return String.fromCharCode(parseInt(h, 16));
    })
    .replace(/\\\//g, "/");
}

async function fetchText(url, opts) {
  opts = opts || {};
  var headers = Object.assign(
    {
      "User-Agent": opts.ua || ML_UA,
      Accept: opts.accept || "text/html,application/xhtml+xml,application/json",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
    opts.headers || {}
  );
  var r = await fetch(url, { headers: headers, redirect: "follow" });
  var text = await r.text();
  return { ok: r.ok, status: r.status, text: text };
}

/** Limpa termo de edital para busca ML (ex.: "12A 20mm x 9mm" -> variantes uteis). */
function buildQueryVariants(raw) {
  var base = String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/(\d)A(\d)/gi, "$1 a $2")
    .replace(/(\d)A\b/gi, "$1 a")
    .replace(/\bx\b/gi, " ")
    .replace(/[^a-zA-Z0-9.\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  var stop = {
    und: 1,
    un: 1,
    unidade: 1,
    peca: 1,
    pecas: 1,
    kit: 1,
    com: 1,
    para: 1,
    de: 1,
    da: 1,
    do: 1,
    em: 1,
    mm: 1,
    cm: 1,
  };
  var words = base.split(" ").filter(function (w) {
    return w && w.length > 1 && !stop[w];
  });

  var variants = [];
  function add(s) {
    s = String(s || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!s || variants.indexOf(s) !== -1) return;
    variants.push(s);
  }

  add(base);
  add(words.slice(0, 6).join(" "));
  add(words.slice(0, 4).join(" "));
  add(words.slice(0, 3).join(" "));
  // Prefer product nouns first
  if (words.length >= 2) add(words[0] + " " + words[1]);
  return variants.length ? variants : [String(raw || "").trim()];
}

function slugQuery(q) {
  return String(q || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
}

/** Anuncio real: 9+ digitos. Catalogo /p/MLB27621585 (8 digitos) nao calcula frete. */
function isRealItemId(id) {
  return /^MLB\d{9,14}$/i.test(String(id || ""));
}

function catalogIdFromUrl(url) {
  var m = String(url || "").match(/\/(?:p|up)\/(MLB[U0-9A-Z]+)/i);
  return m ? m[1].toUpperCase() : "";
}

function parseLdProducts(html) {
  var out = [];
  var re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var raw = decodeHtmlEntities(m[1].trim());
    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      continue;
    }
    var nodes = [];
    if (Array.isArray(data)) nodes = nodes.concat(data);
    else if (data && Array.isArray(data["@graph"]))
      nodes = nodes.concat(data["@graph"]);
    else if (data) nodes.push(data);

    nodes.forEach(function (n) {
      if (!n || n["@type"] !== "Product") return;
      var offers = n.offers;
      var offer = Array.isArray(offers) ? offers[0] : offers;
      var price = offer ? Number(offer.price) : NaN;
      var url = (offer && offer.url) || n.url || "";
      var avail = String((offer && offer.availability) || "");
      var inStock = !/OutOfStock/i.test(avail);
      if (!n.name || !url) return;
      var catalog = catalogIdFromUrl(url);
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

/** Extrai produtos de HTML mesmo sem JSON-LD (cards). */
function parseHtmlCards(html) {
  var out = [];
  var re =
    /href="(https:\/\/www\.mercadolivre\.com\.br\/[^"]+\/(?:p|up)\/MLB[U0-9A-Z]+)"[\s\S]{0,800}?andes-money-amount__fraction[^>]*>([0-9.]+)/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var url = m[1].replace(/&amp;/g, "&");
    var price = Number(String(m[2]).replace(/\./g, "")) || Number(m[2]) || 0;
    // fraction often without cents separator — keep as-is if has dot decimal
    if (String(m[2]).indexOf(".") !== -1) price = Number(m[2]);
    var titleM = html
      .slice(Math.max(0, m.index - 400), m.index + 200)
      .match(/aria-label="([^"]{8,160})"/);
    var title = titleM ? titleM[1] : catalogIdFromUrl(url);
    out.push({
      id: catalogIdFromUrl(url) || "MLB" + String(out.length).padStart(2, "0"),
      title: title,
      price: price,
      currency_id: "BRL",
      permalink: url,
      thumbnail: "",
      available_quantity: 1,
    });
  }
  return out;
}

function dedupeResults(results) {
  var seen = {};
  return (results || []).filter(function (it) {
    var k = String(it.permalink || it.title || "")
      .toLowerCase()
      .trim();
    if (!k || seen[k]) return false;
    seen[k] = 1;
    return true;
  });
}

async function searchOfficial(q, limit) {
  var url =
    "https://api.mercadolibre.com/sites/MLB/search?q=" +
    encodeURIComponent(q) +
    "&limit=" +
    encodeURIComponent(limit);
  var headers = {};
  if (process.env.ML_ACCESS_TOKEN) {
    headers.Authorization = "Bearer " + process.env.ML_ACCESS_TOKEN;
  }
  var r = await fetchText(url, { accept: "application/json", headers: headers });
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      error: r.status === 403 ? "forbidden" : r.text.slice(0, 200),
    };
  }
  var j;
  try {
    j = JSON.parse(r.text);
  } catch (e) {
    return { ok: false, status: 502, error: "invalid json" };
  }
  var results = (j.results || []).map(function (it) {
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
  return { ok: true, results: results, source: "api" };
}

async function fetchLista(query) {
  var slug = slugQuery(query) || "produto";
  var urls = [
    "https://lista.mercadolivre.com.br/" + slug,
    "https://lista.mercadolivre.com.br/" + encodeURIComponent(slug),
    "https://www.mercadolivre.com.br/mais-relevantes?q=" +
      encodeURIComponent(query),
  ];
  var last = { ok: false, status: 0, text: "", captcha: false };

  for (var i = 0; i < urls.length; i++) {
    for (var u = 0; u < 2; u++) {
      var ua = u === 0 ? ML_UA : BROWSER_UA;
      try {
        var r = await fetchText(urls[i], { ua: ua });
        last = r;
        var captcha = /suspicious-traffic/i.test(r.text || "");
        if (captcha) {
          last.captcha = true;
          continue;
        }
        var products = parseLdProducts(r.text);
        if (!products.length) products = parseHtmlCards(r.text);
        if (products.length) {
          return {
            ok: true,
            results: products,
            status: r.status,
            url: urls[i],
          };
        }
      } catch (e) {
        last = { ok: false, status: 0, text: String(e && e.message), captcha: false };
      }
    }
  }
  return {
    ok: false,
    results: [],
    status: last.status || 0,
    captcha: !!last.captcha,
    error: last.captcha ? "captcha" : "no_products",
  };
}

async function searchPublicIndex(q, limit) {
  var variants = buildQueryVariants(q);
  var tried = [];
  for (var i = 0; i < variants.length; i++) {
    tried.push(variants[i]);
    var hit = await fetchLista(variants[i]);
    if (hit.ok && hit.results && hit.results.length) {
      return {
        ok: true,
        results: dedupeResults(hit.results).slice(0, limit),
        source: "public_index",
        query_used: variants[i],
        tried: tried,
      };
    }
  }
  return {
    ok: false,
    results: [],
    source: "public_index",
    tried: tried,
    error: "no_products_in_variants",
  };
}

async function resolveItemId(permalink, fallbackId) {
  if (isRealItemId(fallbackId)) return String(fallbackId).toUpperCase();
  if (!permalink) return "";
  try {
    var r = await fetchText(permalink);
    if (!r.ok) return "";
    var m =
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
  var out = results.slice();
  for (var i = 0; i < max; i++) {
    var it = out[i];
    if (!it) continue;
    if (it.price > 0 && isRealItemId(it.id)) continue;
    if (!it.permalink) continue;
    try {
      var r = await fetchText(it.permalink);
      if (!r.ok || /suspicious-traffic/i.test(r.text)) continue;
      if (!(it.price > 0)) {
        var pm = r.text.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/);
        if (pm) it.price = Number(pm[1]) || 0;
      }
      var idm =
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
  var url =
    "https://api.mercadolibre.com/items/" +
    encodeURIComponent(itemId) +
    "/shipping_options?zip_code=" +
    encodeURIComponent(cep);
  var headers = {};
  if (process.env.ML_ACCESS_TOKEN) {
    headers.Authorization = "Bearer " + process.env.ML_ACCESS_TOKEN;
  }
  var r = await fetchText(url, { accept: "application/json", headers: headers });
  if (!r.ok) {
    return {
      ok: false,
      status: r.status,
      note: "Frete indisponivel via API (HTTP " + r.status + ")",
    };
  }
  var j;
  try {
    j = JSON.parse(r.text);
  } catch (e) {
    return { ok: false, status: 502, note: "Resposta de frete invalida" };
  }
  var opts = j.options || [];
  var cost = null;
  opts.forEach(function (o) {
    if (typeof o.cost === "number") {
      if (cost === null || o.cost < cost) cost = o.cost;
    }
  });
  return {
    ok: true,
    options: opts,
    cost: cost === null ? 0 : cost,
    note: cost === 0 ? "Frete gratis / R$ 0,00" : "",
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

  var q = req.query || {};
  var action = String(q.action || "").toLowerCase();

  try {
    if (action === "search") {
      var term = String(q.q || "").trim();
      var limit = Math.min(Math.max(parseInt(q.limit, 10) || 5, 1), 20);
      if (!term) return json(res, 400, { error: "missing_q", results: [] });

      var variants = buildQueryVariants(term);
      var official = null;
      for (var oi = 0; oi < Math.min(variants.length, 3); oi++) {
        official = await searchOfficial(variants[oi], limit);
        if (official.ok && official.results.length) {
          return json(res, 200, {
            source: "api",
            results: official.results,
            query_used: variants[oi],
          });
        }
      }

      var pub = await searchPublicIndex(term, limit);
      if (!pub.ok || !pub.results.length) {
        return json(res, 200, {
          source: "public_index",
          results: [],
          warning:
            "API ML bloqueada (403). Fallback da listagem nao encontrou produtos para: " +
            (variants[0] || term) +
            ". Tente termo mais curto ou configure ML_ACCESS_TOKEN na Vercel.",
          upstream_status: (official && official.status) || 403,
          upstream_error: (official && official.error) || "forbidden",
          tried: pub.tried || variants,
        });
      }

      var results = await enrichPricesFromPages(
        pub.results,
        Math.min(limit, 5)
      );

      return json(res, 200, {
        source: "public_index",
        results: results,
        query_used: pub.query_used || variants[0],
        warning:
          "API oficial ML bloqueada (403). Usando listagem publica com preco.",
        upstream_status: (official && official.status) || 403,
      });
    }

    if (action === "shipping") {
      var cep = String(q.cep || "").replace(/\D/g, "");
      var itemId = String(q.itemId || q.item_id || "").trim();
      var permalink = String(q.permalink || q.url || "").trim();

      if (!cep || cep.length < 8) {
        return json(res, 400, {
          source: "fallback",
          options: [],
          cost: 0,
          note: "CEP invalido ou nao informado",
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
            "Nao foi possivel obter o ID real do anuncio para calcular frete. Abra o link do produto.",
          resolved_id: itemId || null,
        });
      }

      var ship = await shippingOfficial(itemId, cep);
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
