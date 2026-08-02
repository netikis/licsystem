/**
 * Fallback de busca ML quando /sites/MLB/search retorna UNAUTHORIZED/403.
 * Usa listagem pública (JSON-LD / cards HTML).
 */

var ML_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
var BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

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

function catalogIdFromUrl(url) {
  var m = String(url || "").match(/\/(?:p|up)\/(MLB[U0-9A-Z]+)/i);
  return m ? m[1].toUpperCase() : "";
}

function itemIdFromUrl(url) {
  var m = String(url || "").match(/MLB-?(\d{8,14})/i);
  if (m) return "MLB" + m[1];
  return catalogIdFromUrl(url) || null;
}

function looksFreeShipping(chunk) {
  return /frete\s*gr[aá]tis|free[\s_-]*shipping|env[ií]o\s*gr[aá]tis/i.test(
    chunk || ""
  );
}

function normalizePublicItem(it) {
  var free = !!it.free_shipping;
  var thumb = String(it.thumbnail || "");
  if (thumb.indexOf("http://") === 0) {
    thumb = "https://" + thumb.slice(7);
  }
  return {
    title: String(it.title || ""),
    price: Number(it.price) || 0,
    permalink: String(it.permalink || ""),
    thumbnail: thumb,
    seller: String(it.seller || "—"),
    free_shipping: free,
    freteLabel: free ? "FRETE GRÁTIS" : "",
    id: it.id || null,
    currency_id: it.currency_id || "BRL",
    available_quantity:
      typeof it.available_quantity === "number" ? it.available_quantity : 1,
  };
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
      var around = html.slice(
        Math.max(0, m.index - 200),
        Math.min(html.length, m.index + (m[0] ? m[0].length : 0) + 400)
      );
      out.push(
        normalizePublicItem({
          id: itemIdFromUrl(url) || catalogIdFromUrl(url),
          title: String(n.name),
          price: isFinite(price) ? price : 0,
          permalink: url,
          thumbnail: Array.isArray(n.image) ? n.image[0] : n.image || "",
          available_quantity: inStock ? 1 : 0,
          free_shipping: looksFreeShipping(around),
          seller: "—",
        })
      );
    });
  }
  return out;
}

function parseHtmlCards(html) {
  var out = [];
  var re =
    /href="(https:\/\/www\.mercadolivre\.com\.br\/[^"]*(?:MLB-?\d{8,14}|\/(?:p|up)\/MLB[U0-9A-Z]+)[^"]*)"/gi;
  var m;
  var seen = Object.create(null);
  while ((m = re.exec(html)) !== null) {
    var url = m[1].replace(/&amp;/g, "&");
    if (seen[url]) continue;
    seen[url] = 1;
    var windowHtml = html.slice(
      Math.max(0, m.index - 500),
      Math.min(html.length, m.index + 1200)
    );
    var priceM = windowHtml.match(
      /andes-money-amount__fraction[^>]*>([0-9.]+)/i
    );
    var price = 0;
    if (priceM) {
      price = Number(String(priceM[1]).replace(/\./g, "")) || Number(priceM[1]) || 0;
      if (String(priceM[1]).indexOf(".") !== -1 && String(priceM[1]).length <= 6) {
        price = Number(priceM[1]) || price;
      }
    }
    var titleM =
      windowHtml.match(/aria-label="([^"]{8,180})"/i) ||
      windowHtml.match(/poly-component__title[^>]*>([^<]{8,180})/i);
    var title = titleM ? titleM[1] : itemIdFromUrl(url) || "Produto ML";
    var imgM = windowHtml.match(/src="(https:\/\/http2\.mlstatic\.com\/[^"]+)"/i);
    out.push(
      normalizePublicItem({
        id: itemIdFromUrl(url),
        title: decodeHtmlEntities(title),
        price: price,
        permalink: url,
        thumbnail: imgM ? imgM[1] : "",
        available_quantity: 1,
        free_shipping: looksFreeShipping(windowHtml),
        seller: "—",
      })
    );
    if (out.length >= 24) break;
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
        last = {
          ok: false,
          status: 0,
          text: String(e && e.message),
          captcha: false,
        };
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
  limit = Math.min(Math.max(Number(limit) || 10, 1), 20);
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

module.exports = {
  buildQueryVariants: buildQueryVariants,
  searchPublicIndex: searchPublicIndex,
  normalizePublicItem: normalizePublicItem,
};
