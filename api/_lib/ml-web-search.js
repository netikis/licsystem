/**
 * Busca ML em produção (Vercel) — custo zero quando possível.
 *
 * Ordem:
 * 1) Listagem pública (sem chave)
 * 2) Google Custom Search — GOOGLE_CSE_API_KEY + GOOGLE_CSE_CX (100/dia grátis)
 * 3) Serper — SERPER_API_KEY (2.500 grátis no cadastro; depois créditos do CLIENTE)
 *
 * Modelo de venda: cada cliente coloca as CHAVES DELE na Vercel dele.
 * Você (vendedor) não paga a busca dos clientes.
 */

var mlPublic = require("./ml-public-search");

function env(key) {
  return String(process.env[key] || "").trim();
}

function getSerperKey() {
  return env("SERPER_API_KEY") || env("SERPER_KEY") || "";
}

function getGoogleCse() {
  return {
    key: env("GOOGLE_CSE_API_KEY") || env("GOOGLE_API_KEY") || "",
    cx: env("GOOGLE_CSE_CX") || env("GOOGLE_CSE_ID") || "",
  };
}

function hasPaidOrFreeSearchKeys() {
  var cse = getGoogleCse();
  return !!(getSerperKey() || (cse.key && cse.cx));
}

function itemIdFromUrl(url) {
  var m = String(url || "").match(/MLB-?(\d{8,14})/i);
  if (m) return "MLB" + m[1];
  var c = String(url || "").match(/\/(?:p|up)\/(MLB[U0-9A-Z]+)/i);
  return c ? c[1].toUpperCase() : null;
}

function parsePriceText(s) {
  var t = String(s || "").replace(/[^\d,.]/g, "");
  if (!t) return 0;
  if (t.indexOf(",") !== -1 && t.indexOf(".") !== -1) {
    t = t.replace(/\./g, "").replace(",", ".");
  } else if (t.indexOf(",") !== -1) {
    t = t.replace(",", ".");
  }
  var n = Number(t);
  return isFinite(n) ? n : 0;
}

function isMlProductUrl(u) {
  return (
    /mercadolivre\.com\.br/i.test(u || "") &&
    !/lista\.mercadolivre|account-verification|gz\/|ajuda\.|\/c\//i.test(u || "")
  );
}

function normalizeHit(item) {
  var link = String(item.permalink || item.link || item.url || "");
  var id = itemIdFromUrl(link);
  var price =
    Number(item.price) ||
    parsePriceText(item.priceStr || item.price_str || "") ||
    0;
  return mlPublic.normalizePublicItem({
    id: id,
    title: String(item.title || item.name || id || "Produto ML"),
    price: price,
    permalink: link,
    thumbnail: item.image || item.thumbnail || "",
    free_shipping: !!item.free_shipping,
    available_quantity: 1,
    seller: "—",
  });
}

async function enrichMissingPrices(out, limit) {
  var need = out
    .filter(function (x) {
      return !(Number(x.price) > 0) && x.id;
    })
    .slice(0, Math.min(limit, 6));
  for (var i = 0; i < need.length; i++) {
    try {
      var enriched = await mlPublic.enrichItem(need[i].id);
      if (enriched && enriched.price > 0) {
        need[i].price = enriched.price;
        need[i].title = enriched.title || need[i].title;
        need[i].thumbnail = enriched.thumbnail || need[i].thumbnail;
        need[i].permalink = enriched.permalink || need[i].permalink;
        need[i].free_shipping = enriched.free_shipping;
        need[i].freteLabel = enriched.freteLabel;
      }
    } catch (e) {
      /* ignora */
    }
  }
  var withPrice = out.filter(function (x) {
    return Number(x.price) > 0;
  });
  return (withPrice.length ? withPrice : out).slice(0, limit);
}

/**
 * Google Programmable Search (Custom Search JSON API) — até 100/dia grátis.
 */
async function searchGoogleCse(q, limit) {
  var cse = getGoogleCse();
  if (!cse.key || !cse.cx) {
    return { ok: false, error: "google_cse_missing", results: [] };
  }

  var num = Math.min(Math.max(limit, 1), 10);
  var url =
    "https://www.googleapis.com/customsearch/v1?key=" +
    encodeURIComponent(cse.key) +
    "&cx=" +
    encodeURIComponent(cse.cx) +
    "&q=" +
    encodeURIComponent(String(q) + " site:mercadolivre.com.br") +
    "&num=" +
    num +
    "&gl=br&hl=pt-BR&safe=off";

  var r = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
  });
  var j = null;
  try {
    j = await r.json();
  } catch (e) {
    return { ok: false, error: "google_cse_invalid_json", results: [] };
  }
  if (!r.ok) {
    return {
      ok: false,
      error:
        (j && j.error && j.error.message) ||
        "google_cse_http_" + r.status,
      status: r.status,
      results: [],
    };
  }

  var items = Array.isArray(j.items) ? j.items : [];
  var out = [];
  var seen = Object.create(null);
  items.forEach(function (it) {
    var link = it.link || "";
    if (!isMlProductUrl(link)) return;
    var id = itemIdFromUrl(link);
    var k = id || link.toLowerCase();
    if (seen[k]) return;
    seen[k] = 1;
    var priceStr =
      (it.pagemap &&
        it.pagemap.offer &&
        it.pagemap.offer[0] &&
        it.pagemap.offer[0].price) ||
      (it.pagemap &&
        it.pagemap.product &&
        it.pagemap.product[0] &&
        it.pagemap.product[0].price) ||
      "";
    var image =
      (it.pagemap &&
        it.pagemap.cse_image &&
        it.pagemap.cse_image[0] &&
        it.pagemap.cse_image[0].src) ||
      "";
    out.push(
      normalizeHit({
        title: it.title,
        link: link,
        priceStr: priceStr,
        image: image,
      })
    );
  });

  out = await enrichMissingPrices(out, limit);
  return {
    ok: out.length > 0,
    results: out,
    source: "google_cse",
    query_used: q,
  };
}

async function searchSerper(q, limit) {
  var key = getSerperKey();
  if (!key) {
    return { ok: false, error: "serper_key_missing", results: [] };
  }

  var r = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": key,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      q: String(q) + " site:mercadolivre.com.br",
      gl: "br",
      hl: "pt-br",
      num: Math.min(Math.max(limit * 2, 8), 15),
    }),
  });

  var j = null;
  try {
    j = await r.json();
  } catch (e) {
    return { ok: false, error: "serper_invalid_json", status: r.status, results: [] };
  }

  if (!r.ok) {
    return {
      ok: false,
      error: (j && (j.message || j.error)) || "serper_http_" + r.status,
      status: r.status,
      results: [],
    };
  }

  var organic = Array.isArray(j.organic) ? j.organic : [];
  var shopping = Array.isArray(j.shopping) ? j.shopping : [];
  var out = [];
  var seen = Object.create(null);

  function push(item) {
    var link = String(item.link || item.url || "");
    if (!isMlProductUrl(link)) return;
    var id = itemIdFromUrl(link);
    var keyId = id || link.toLowerCase();
    if (seen[keyId]) return;
    seen[keyId] = 1;
    out.push(
      normalizeHit({
        title: item.title,
        link: link,
        priceStr: item.price || item.priceStr || "",
        image: item.image || item.imageUrl || item.thumbnail || "",
      })
    );
  }

  shopping.forEach(push);
  organic.forEach(push);
  out = await enrichMissingPrices(out, limit);

  return {
    ok: out.length > 0,
    results: out,
    source: "serper",
    query_used: q,
  };
}

/**
 * Busca produção — prioriza custo zero (público), depois chaves do CLIENTE.
 */
async function searchProduction(q, limit) {
  limit = Math.min(Math.max(Number(limit) || 10, 1), 20);

  /* 1) Sem chave — tenta listagem pública */
  try {
    var pub = await mlPublic.searchPublicIndex(q, limit);
    if (pub.ok && pub.results && pub.results.length) {
      return {
        ok: true,
        results: pub.results,
        source: "public_index",
        query_used: pub.query_used || q,
        mode: pub.mode,
      };
    }
  } catch (e0) {
    /* segue */
  }

  /* 2) Google CSE do cliente (grátis 100/dia) */
  var cse = getGoogleCse();
  if (cse.key && cse.cx) {
    try {
      var g = await searchGoogleCse(q, limit);
      if (g.ok && g.results.length) return g;
    } catch (e1) {
      /* segue */
    }
  }

  /* 3) Serper do cliente (trial grátis / créditos dele) */
  if (getSerperKey()) {
    try {
      var ser = await searchSerper(q, limit);
      if (ser.ok && ser.results.length) return ser;
    } catch (e2) {
      /* segue */
    }
  }

  return {
    ok: false,
    results: [],
    source: "none",
    error: hasPaidOrFreeSearchKeys()
      ? "search_empty"
      : "search_keys_missing",
  };
}

module.exports = {
  getSerperKey: getSerperKey,
  getGoogleCse: getGoogleCse,
  hasPaidOrFreeSearchKeys: hasPaidOrFreeSearchKeys,
  searchSerper: searchSerper,
  searchGoogleCse: searchGoogleCse,
  searchProduction: searchProduction,
};
