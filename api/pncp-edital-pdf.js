/**
 * GET /api/pncp-edital-pdf
 * Lista / baixa o PDF do edital no PNCP (proxy — evita CORS no browser).
 *
 * Query:
 *   link         URL pncp.gov.br/app/editais/{cnpj}/{ano}/{seq}
 *   cnpj, ano, sequencial  (alternativo ao link)
 *   download=1   stream do PDF (Edital preferencial)
 *   list=1       só JSON com a lista de arquivos
 */
var safeJson = require("./_lib/safe-json");

var PNCP_API = "https://pncp.gov.br/api/pncp/v1";
var FETCH_TIMEOUT_MS = 25000;
var MAX_PDF_BYTES = 25 * 1024 * 1024;

function parseRef(q) {
  q = q || {};
  var cnpj = String(q.cnpj || "").replace(/\D/g, "");
  var ano = String(q.ano || "").replace(/\D/g, "");
  var seq = String(q.sequencial || q.seq || "").replace(/\D/g, "");
  var link = String(q.link || "");
  if ((!cnpj || !ano || !seq) && link) {
    var m = link.match(/\/editais\/([^/]+)\/(\d{4})\/(\d+)/i);
    if (m) {
      cnpj = String(m[1] || "").replace(/\D/g, "");
      ano = String(m[2] || "");
      seq = String(m[3] || "").replace(/\D/g, "");
    }
  }
  if (cnpj.length !== 14 || !/^\d{4}$/.test(ano) || !seq) return null;
  return { cnpj: cnpj, ano: ano, sequencial: String(Number(seq) || seq) };
}

function fetchJson(url) {
  var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = setTimeout(function () {
    try {
      if (ctrl) ctrl.abort();
    } catch (e) {}
  }, FETCH_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal: ctrl ? ctrl.signal : undefined,
  })
    .then(function (res) {
      return res.text().then(function (raw) {
        var body = null;
        try {
          body = raw ? JSON.parse(raw) : null;
        } catch (e) {
          body = null;
        }
        if (!res.ok) {
          var err = new Error(
            (body && (body.message || body.error || body.detail)) ||
              "PNCP HTTP " + res.status
          );
          err.status = res.status;
          throw err;
        }
        return body;
      });
    })
    .finally(function () {
      clearTimeout(timer);
    });
}

function fetchBinary(url) {
  var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = setTimeout(function () {
    try {
      if (ctrl) ctrl.abort();
    } catch (e) {}
  }, FETCH_TIMEOUT_MS);
  return fetch(url, {
    method: "GET",
    headers: { Accept: "application/pdf,*/*" },
    signal: ctrl ? ctrl.signal : undefined,
  })
    .then(function (res) {
      if (!res.ok) {
        var err = new Error("Falha ao baixar arquivo do PNCP (HTTP " + res.status + ")");
        err.status = res.status;
        throw err;
      }
      return res.arrayBuffer().then(function (buf) {
        return {
          buffer: Buffer.from(buf),
          contentType: res.headers.get("content-type") || "application/pdf",
        };
      });
    })
    .finally(function () {
      clearTimeout(timer);
    });
}

function scoreArquivo(a) {
  a = a || {};
  var tipo = String(a.tipoDocumentoNome || a.tipoDocumentoDescricao || "").toLowerCase();
  var titulo = String(a.titulo || "").toLowerCase();
  var score = 0;
  if (tipo.indexOf("edital") !== -1) score += 100;
  if (/\.pdf$/i.test(titulo)) score += 40;
  if (titulo.indexOf("edital") !== -1) score += 30;
  if (a.statusAtivo === false) score -= 50;
  return score;
}

function pickBest(arquivos) {
  var list = Array.isArray(arquivos) ? arquivos.slice() : [];
  if (!list.length) return null;
  list.sort(function (a, b) {
    return scoreArquivo(b) - scoreArquivo(a);
  });
  return list[0];
}

function fileUrl(item) {
  if (!item) return "";
  return String(item.url || item.uri || "").trim();
}

function safeFilename(name, fallback) {
  var n = String(name || fallback || "edital.pdf")
    .replace(/[^\w.\-()\[\] áàâãéêíóôõúçÁÀÂÃÉÊÍÓÔÕÚÇ]+/gi, "_")
    .trim();
  if (!/\.pdf$/i.test(n)) n += ".pdf";
  return n.slice(0, 180) || "edital.pdf";
}

module.exports = safeJson.wrapHandler(async function handler(req, res) {
  if (req.method === "OPTIONS") {
    safeJson.applyCors(res, "GET,OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return safeJson.sendJson(res, 405, { ok: false, error: "Use GET" });
  }

  var q = req.query || {};
  var ref = parseRef(q);
  if (!ref) {
    return safeJson.sendJson(res, 400, {
      ok: false,
      error: "Informe link PNCP (…/editais/cnpj/ano/seq) ou cnpj + ano + sequencial.",
    });
  }

  var listUrl =
    PNCP_API +
    "/orgaos/" +
    encodeURIComponent(ref.cnpj) +
    "/compras/" +
    encodeURIComponent(ref.ano) +
    "/" +
    encodeURIComponent(ref.sequencial) +
    "/arquivos";

  var arquivos;
  try {
    arquivos = await fetchJson(listUrl);
  } catch (e) {
    return safeJson.sendJson(res, e.status && e.status < 500 ? e.status : 502, {
      ok: false,
      error: (e && e.message) || "Não foi possível listar arquivos no PNCP.",
      ref: ref,
    });
  }

  if (!Array.isArray(arquivos)) arquivos = [];
  var wantList = String(q.list || "") === "1" || String(q.mode || "") === "list";
  var wantDownload =
    String(q.download || "") === "1" || String(q.mode || "") === "download";

  var mapped = arquivos.map(function (a) {
    return {
      titulo: a.titulo || null,
      tipoDocumentoNome: a.tipoDocumentoNome || null,
      sequencialDocumento: a.sequencialDocumento,
      url: fileUrl(a),
      statusAtivo: a.statusAtivo !== false,
    };
  });

  var best = pickBest(arquivos);
  if (wantList || !wantDownload) {
    return safeJson.sendJson(res, 200, {
      ok: true,
      ref: ref,
      arquivos: mapped,
      melhor: best
        ? {
            titulo: best.titulo || null,
            tipoDocumentoNome: best.tipoDocumentoNome || null,
            sequencialDocumento: best.sequencialDocumento,
            url: fileUrl(best),
          }
        : null,
      downloadHint:
        "/api/pncp-edital-pdf?cnpj=" +
        encodeURIComponent(ref.cnpj) +
        "&ano=" +
        encodeURIComponent(ref.ano) +
        "&sequencial=" +
        encodeURIComponent(ref.sequencial) +
        "&download=1",
    });
  }

  if (!best || !fileUrl(best)) {
    return safeJson.sendJson(res, 404, {
      ok: false,
      error: "Nenhum arquivo/PDF encontrado para este edital no PNCP.",
      ref: ref,
      arquivos: mapped,
    });
  }

  var remote = fileUrl(best);
  var bin;
  try {
    bin = await fetchBinary(remote);
  } catch (e) {
    return safeJson.sendJson(res, 502, {
      ok: false,
      error: (e && e.message) || "Falha ao baixar o PDF no PNCP.",
      remote: remote,
    });
  }

  if (!bin.buffer || !bin.buffer.length) {
    return safeJson.sendJson(res, 502, { ok: false, error: "Arquivo vazio no PNCP." });
  }
  if (bin.buffer.length > MAX_PDF_BYTES) {
    return safeJson.sendJson(res, 413, {
      ok: false,
      error: "PDF maior que 25 MB — baixe pelo site do PNCP.",
    });
  }

  var fname = safeFilename(best.titulo, "edital-" + ref.sequencial + ".pdf");
  safeJson.applyCors(res, "GET,OPTIONS");
  res.statusCode = 200;
  res.setHeader("Content-Type", bin.contentType || "application/pdf");
  res.setHeader("Content-Disposition", 'attachment; filename="' + fname + '"');
  res.setHeader("Cache-Control", "private, max-age=300");
  res.setHeader("X-Pncp-Titulo", encodeURIComponent(String(best.titulo || fname)));
  res.end(bin.buffer);
}, "GET,OPTIONS");
