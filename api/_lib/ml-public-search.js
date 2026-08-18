/**
 * Busca ML via listagem pública + enriquecimento de página de produto.
 * Usado quando /sites/MLB/search está bloqueado (403 PolicyAgent).
 */

var BOT_UAS = [
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Googlebot/2.1 (+http://www.google.com/bot.html)",
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
  "Twitterbot/1.0",
  "bingbot/2.0 (+http://www.bing.com/bingbot.htm)",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

function decodeHtmlEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u002F/gi, "/")
    .replace(/\\u([0-9a-fA-F]{4})/g, function (_, h) {
      return String.fromCharCode(parseInt(h, 16));
    })
    .replace(/\\\//g, "/");
}

async function fetchText(url, ua) {
  var r = await fetch(url, {
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/json,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
      Referer: "https://www.mercadolivre.com.br/",
    },
    redirect: "follow",
  });
  var text = await r.text();
  return { ok: r.ok, status: r.status, text: text, finalUrl: r.url || url };
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

function isCaptcha(html) {
  return /suspicious-traffic|account-verification|challenge-form|Just a moment/i.test(
    html || ""
  );
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

/** Extrai IDs MLB mesmo quando o HTML veio "quebrado"/parcial. */
function extractItemIds(html) {
  var ids = [];
  var seen = Object.create(null);
  function add(id) {
    id = String(id || "").toUpperCase().replace(/-/g, "");
    if (!/^MLB\d{8,14}$/.test(id) && !/^MLBU?\d+$/.test(id)) {
      var m = String(id).match(/MLB-?(\d{8,14})/i);
      if (!m) return;
      id = "MLB" + m[1];
    }
    if (seen[id]) return;
    seen[id] = 1;
    ids.push(id);
  }

  var reId = /MLB-?(\d{8,14})/gi;
  var m;
  while ((m = reId.exec(html || ""))) {
    add("MLB" + m[1]);
    if (ids.length >= 40) break;
  }

  var reCat = /\/(?:p|up)\/(MLB[U0-9A-Z]+)/gi;
  while ((m = reCat.exec(html || ""))) {
    add(m[1]);
    if (ids.length >= 40) break;
  }

  return ids;
}

function dedupeResults(results) {
  var seen = {};
  return (results || []).filter(function (it) {
    var k = String(it.id || it.permalink || it.title || "")
      .toLowerCase()
      .trim();
    if (!k || seen[k]) return false;
    seen[k] = 1;
    return true;
  });
}

function parseProductPage(html, id) {
  if (!html || isCaptcha(html)) return null;
  var price =
    (html.match(/itemprop=["']price["'][^>]*content=["']([^"']+)["']/i) ||
      [])[1] ||
    (html.match(/content=["']([^"']+)["'][^>]*itemprop=["']price["']/i) ||
      [])[1] ||
    (html.match(/property=["']product:price:amount["'][^>]*content=["']([^"']+)["']/i) ||
      [])[1] ||
    (html.match(/"price"\s*:\s*([0-9]+(?:\.[0-9]+)?)/) || [])[1];
  var title =
    (html.match(/property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      [])[1] ||
    (html.match(/content=["']([^"']+)["'][^>]*property=["']og:title["']/i) ||
      [])[1] ||
    (html.match(/<title>([^<]+)<\/title>/i) || [])[1] ||
    "";
  title = decodeHtmlEntities(title)
    .replace(/\s*[-|]\s*Mercado\s*Livre.*$/i, "")
    .replace(/\s*-\s*R\$.*$/i, "")
    .trim();
  var image =
    (html.match(/property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
      [])[1] || "";
  var permalink =
    (html.match(/rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) || [])[1] ||
    (html.match(/property=["']og:url["'][^>]*content=["']([^"']+)["']/i) ||
      [])[1] ||
    "";
  var num = String(id || "").replace(/\D/g, "");
  if (!permalink && num) {
    permalink = "https://produto.mercadolivre.com.br/MLB-" + num;
  }
  var priceNum = Number(price);
  if (!title || !isFinite(priceNum) || priceNum <= 0) {
    var ld = parseLdProducts(html);
    if (ld[0] && ld[0].price > 0) return ld[0];
    return null;
  }
  return normalizePublicItem({
    id: id,
    title: title,
    price: priceNum,
    permalink: permalink,
    thumbnail: image,
    free_shipping: looksFreeShipping(html.slice(0, 8000)),
    available_quantity: 1,
    seller: "—",
  });
}

async function enrichItem(id) {
  var num = String(id || "").replace(/\D/g, "");
  if (!num) return null;
  var urls = [
    "https://produto.mercadolivre.com.br/MLB-" + num,
    "https://www.mercadolivre.com.br/p/MLB" + num,
  ];
  var uas = [
    BOT_UAS[2], // facebook
    BOT_UAS[0], // googlebot
    BOT_UAS[3], // twitter
  ];
  for (var i = 0; i < urls.length; i++) {
    for (var u = 0; u < uas.length; u++) {
      try {
        var r = await fetchText(urls[i], uas[u]);
        var item = parseProductPage(r.text, "MLB" + num);
        if (item) return item;
      } catch (e) {
        /* next */
      }
    }
  }
  return null;
}

async function enrichIds(ids, limit) {
  var out = [];
  var list = (ids || []).slice(0, Math.max(limit * 2, 8));
  for (var i = 0; i < list.length && out.length < limit; i++) {
    var item = await enrichItem(list[i]);
    if (item) out.push(item);
  }
  return out;
}

async function fetchLista(query) {
  var slug = slugQuery(query) || "produto";
  var urls = [
    "https://lista.mercadolivre.com.br/" + slug,
    "https://lista.mercadolivre.com.br/" + encodeURIComponent(slug),
    "https://www.mercadolivre.com.br/" + slug,
  ];
  var last = { ok: false, status: 0, text: "", captcha: false, ids: [] };

  for (var i = 0; i < urls.length; i++) {
    for (var u = 0; u < BOT_UAS.length; u++) {
      try {
        var r = await fetchText(urls[i], BOT_UAS[u]);
        last = {
          ok: r.ok,
          status: r.status,
          text: r.text,
          captcha: isCaptcha(r.text),
          ids: [],
        };
        if (last.captcha) continue;

        var products = parseLdProducts(r.text);
        if (!products.length) products = parseHtmlCards(r.text);
        if (products.length) {
          return {
            ok: true,
            results: products,
            status: r.status,
            url: urls[i],
            mode: "lista_html",
          };
        }

        var ids = extractItemIds(r.text);
        last.ids = ids;
        if (ids.length) {
          return {
            ok: true,
            results: [],
            ids: ids,
            status: r.status,
            url: urls[i],
            mode: "lista_ids",
          };
        }
      } catch (e) {
        last = {
          ok: false,
          status: 0,
          text: String(e && e.message),
          captcha: false,
          ids: [],
        };
      }
    }
  }
  return {
    ok: false,
    results: [],
    ids: last.ids || [],
    status: last.status || 0,
    captcha: !!last.captcha,
    error: last.captcha ? "captcha" : "no_products",
  };
}

async function searchPublicIndex(q, limit) {
  limit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  var variants = buildQueryVariants(q);
  var tried = [];
  var allIds = [];

  for (var i = 0; i < variants.length; i++) {
    tried.push(variants[i]);
    var hit = await fetchLista(variants[i]);

    if (hit.ok && hit.results && hit.results.length) {
      var withPrice = hit.results.filter(function (x) {
        return Number(x.price) > 0;
      });
      var needEnrich = (withPrice.length ? withPrice : hit.results).filter(
        function (x) {
          return !x.price || x.price <= 0;
        }
      );
      var base = withPrice.length ? withPrice : hit.results;
      if (needEnrich.length && base.length < limit) {
        var ids = needEnrich.map(function (x) {
          return x.id;
        }).filter(Boolean);
        var extra = await enrichIds(ids, limit - base.length);
        base = base.concat(extra);
      }
      return {
        ok: true,
        results: dedupeResults(base).slice(0, limit),
        source: "public_index",
        query_used: variants[i],
        tried: tried,
        mode: hit.mode,
      };
    }

    if (hit.ids && hit.ids.length) {
      allIds = allIds.concat(hit.ids);
      var enriched = await enrichIds(hit.ids, limit);
      if (enriched.length) {
        return {
          ok: true,
          results: dedupeResults(enriched).slice(0, limit),
          source: "public_index",
          query_used: variants[i],
          tried: tried,
          mode: "enrich_ids",
        };
      }
    }
  }

  if (allIds.length) {
    var lastTry = await enrichIds(allIds, limit);
    if (lastTry.length) {
      return {
        ok: true,
        results: dedupeResults(lastTry).slice(0, limit),
        source: "public_index",
        query_used: variants[0],
        tried: tried,
        mode: "enrich_ids_merged",
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
  enrichItem: enrichItem,
};
