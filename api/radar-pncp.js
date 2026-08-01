/**
 * GET|POST /api/radar-pncp
 * Proxy same-origin para o PNCP (evita CORS do browser em vercel.app).
 *
 * Query/body:
 *   q | keywords     palavras-chave (vírgula = OU)
 *   uf               UF opcional (ex.: PR)
 *   incluirLeiloes | leiloes   1|true → modalidades 1,13 + 6
 *   paginas          máx. páginas pregão (default 6, máx. 10)
 *
 * Sempre JSON: { ok, editais, total, ... } ou { ok:false, error }.
 */
var safeJson = require("./lib/safe-json");
var queryLib = require("./lib/editais-query");

var PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";
var PAGE_SIZE = 50;
var HANDLER_BUDGET_MS = 55000;
/** Mod 13 UF PR costuma 25–45s por página — precisa ficar sob maxDuration 60. */
var FETCH_TIMEOUT_MS = 48000;

function cors(res) {
  safeJson.applyCors(res, "GET,POST,OPTIONS");
}

function json(res, status, body) {
  safeJson.sendJson(res, status, body, "GET,POST,OPTIONS");
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object") return resolve(req.body);
    if (typeof req.body === "string" && req.body) {
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        return reject(new Error("Invalid JSON"));
      }
    }
    var chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("end", function () {
      var raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function mergeOpts(query, body) {
  var q = query || {};
  var b = body || {};
  return {
    q: b.q || b.keywords || q.q || q.keywords || "",
    uf: String(b.uf || q.uf || "")
      .trim()
      .toUpperCase(),
    leiloes:
      b.leiloes != null
        ? b.leiloes
        : b.incluirLeiloes != null
          ? b.incluirLeiloes
          : q.leiloes || q.incluirLeiloes,
    paginas: b.paginas || b.pages || q.paginas || q.pages,
    janela: b.janela || q.janela,
    dias: b.dias != null ? b.dias : q.dias,
  };
}

function pncpLink(item) {
  var cnpj =
    (item.orgaoEntidade && item.orgaoEntidade.cnpj) ||
    item.cnpjOrgao ||
    "";
  var ano = item.anoCompra || item.ano;
  var seq = item.sequencialCompra || item.sequencial;
  if (cnpj && ano && seq != null) {
    return (
      "https://pncp.gov.br/app/editais/" +
      encodeURIComponent(cnpj) +
      "/" +
      encodeURIComponent(ano) +
      "/" +
      encodeURIComponent(seq)
    );
  }
  return item.linkSistemaOrigem || item.linkProcessoEletronico || null;
}

function mapItem(o) {
  var uo = o.unidadeOrgao || {};
  var oe = o.orgaoEntidade || {};
  return {
    orgao: oe.razaoSocial || o.nomeOrgao || "Órgão público",
    municipio: uo.municipioNome || "",
    uf: uo.ufSigla || "",
    modalidade: o.modalidadeNome || (o._lsModalidade != null ? "Mod. " + o._lsModalidade : ""),
    objeto: o.objetoCompra || o.objeto || "",
    dataAbertura: o.dataAberturaProposta || null,
    dataEncerramento: o.dataEncerramentoProposta || null,
    valorEstimado:
      o.valorTotalEstimado != null ? Number(o.valorTotalEstimado) : null,
    numeroControlePNCP: o.numeroControlePNCP || null,
    link: pncpLink(o) || o.linkSistemaOrigem || null,
    /* Campos brutos p/ UI legado que lê orgaoEntidade etc. */
    orgaoEntidade: oe,
    unidadeOrgao: uo,
    objetoCompra: o.objetoCompra || o.objeto || "",
    nomeOrgao: o.nomeOrgao,
    valorTotalEstimado: o.valorTotalEstimado,
    linkSistemaOrigem: o.linkSistemaOrigem || pncpLink(o),
    modalidadeNome: o.modalidadeNome,
    _lsModalidade: o._lsModalidade,
  };
}

async function fetchPncpOnce(url) {
  var ctrl =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = null;
  if (ctrl) {
    timer = setTimeout(function () {
      try {
        ctrl.abort();
      } catch (e) {}
    }, FETCH_TIMEOUT_MS);
  }
  try {
    var r = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "LICSYSTEM/1.0 (radar-pncp)",
      },
      signal: ctrl ? ctrl.signal : undefined,
    });
    var text = await r.text();
    var body = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch (e) {
      body = null;
    }
    if (!r.ok) {
      var msg =
        (body && (body.message || body.error)) || "HTTP " + r.status;
      var err = new Error(String(msg));
      err.status = r.status;
      throw err;
    }
    return body || {};
  } catch (e) {
    if (
      e &&
      (e.name === "AbortError" || /aborted/i.test(String(e.message || "")))
    ) {
      var te = new Error("PNCP timeout (" + FETCH_TIMEOUT_MS + "ms)");
      te.status = 504;
      throw te;
    }
    throw e;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchModPages(opts) {
  var dataFinal = opts.dataFinal;
  var uf = opts.uf;
  var modalidade = opts.modalidade;
  var maxPages = opts.maxPages;
  var deadline = opts.deadline;
  var out = [];
  var pagesFetched = 0;
  var totalRegistros = null;

  for (var pagina = 1; pagina <= maxPages; pagina++) {
    if (Date.now() >= deadline) break;
    var url =
      PNCP_BASE +
      "/contratacoes/proposta?dataFinal=" +
      encodeURIComponent(dataFinal) +
      "&codigoModalidadeContratacao=" +
      encodeURIComponent(modalidade) +
      (uf ? "&uf=" + encodeURIComponent(uf) : "") +
      "&pagina=" +
      pagina +
      "&tamanhoPagina=" +
      PAGE_SIZE;
    var j = await fetchPncpOnce(url);
    pagesFetched++;
    if (pagina === 1 && j && j.totalRegistros != null) {
      totalRegistros = Number(j.totalRegistros) || 0;
    }
    var arr = (j && (j.data || j.items || j.resultado)) || [];
    if (!Array.isArray(arr) || !arr.length) break;
    for (var i = 0; i < arr.length; i++) {
      var item = arr[i];
      if (item && item._lsModalidade == null) item._lsModalidade = modalidade;
      out.push(item);
    }
    var totalPaginas =
      j && j.totalPaginas != null ? Number(j.totalPaginas) : null;
    var more =
      totalPaginas != null ? pagina < totalPaginas : arr.length >= PAGE_SIZE;
    if (!more) break;
  }
  return {
    items: out,
    pagesFetched: pagesFetched,
    totalRegistros: totalRegistros,
  };
}

function compraKey(item) {
  return (
    item.numeroControlePNCP ||
    [
      (item.orgaoEntidade && item.orgaoEntidade.cnpj) || "",
      item.anoCompra,
      item.sequencialCompra,
    ].join("-")
  );
}

function textHaystack(o) {
  var parts = [
    o.objetoCompra,
    o.objeto,
    o.objetoContratacao,
    o.informacaoComplementar,
    o.descricao,
    o.titulo,
    o.modalidadeNome,
  ];
  return fold(parts.filter(Boolean).join(" "));
}

async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Use GET ou POST" });
  }

  var deadline = Date.now() + HANDLER_BUDGET_MS;

  try {
    var body = {};
    if (req.method === "POST") body = await readBody(req);
    var opts = mergeOpts(req.query || {}, body);

    var rawKw = String(opts.q || "").trim();
    var keywords = rawKw
      .split(/[,;]/)
      .map(function (s) {
        return fold(s).trim();
      })
      .filter(Boolean);
    if (queryLib.expandLeilaoKeywords) {
      keywords = queryLib.expandLeilaoKeywords(keywords);
      var seenKw = Object.create(null);
      keywords = keywords.filter(function (k) {
        if (!k || seenKw[k]) return false;
        seenKw[k] = true;
        return true;
      });
    }

    var leiloesFlag =
      String(opts.leiloes || "") === "1" ||
      String(opts.leiloes || "").toLowerCase() === "true";
    var querLeilao =
      leiloesFlag ||
      (queryLib.looksLikeLeilaoText &&
        queryLib.looksLikeLeilaoText(rawKw || keywords.join(" ")));

    /*
     * Domínio leilão/sucata: prioriza mod 13 (presencial). Mod 1 (eletrônico)
     * frequentemente HTTP 500 no PNCP. Pregão UF (~55s/página) fica de fora
     * neste domínio para caber no maxDuration.
     * Fora disso: só pregão, poucas páginas.
     */
    var modalidades = querLeilao ? [13] : [6];
    if (querLeilao && String(opts.paginas || "") === "ampliar") {
      modalidades = [13, 1];
    }
    /* Opt-in explícito: incluirLeiloes=1&pregao=1 mistura 13+6 (mais lento). */
    var alsoPregao =
      String(
        (req.query && (req.query.pregao || req.query.incluirPregao)) ||
          (body && (body.pregao || body.incluirPregao)) ||
          ""
      ) === "1";
    if (querLeilao && alsoPregao) {
      modalidades = [13, 6];
    }
    var uf = opts.uf || "";
    if (uf && !/^[A-Z]{2}$/.test(uf)) {
      return json(res, 400, {
        ok: false,
        error: "UF inválida (use sigla de 2 letras, ex.: PR).",
      });
    }

    var janelaInfo = queryLib.resolveJanela({
      /* Ano civil costuma ser mais estável que rolling 45d no PNCP. */
      janela: opts.janela || "ano",
      dias: opts.dias,
    });
    var dataFinal = janelaInfo.dataFinal;

    var maxPregao = Math.max(
      1,
      Math.min(2, Number(opts.paginas) || 1)
    );
    /* Leilão: 1 página (50 itens) — 2ª página estoura o orçamento Vercel. */
    var maxLeilao = Math.max(1, Math.min(2, Number(opts.paginas) || 1));

    var all = [];
    var seen = Object.create(null);
    var pagesFetched = 0;
    var totalRegistros = 0;
    var errors = [];
    var truncated = false;

    /* Paralelo limitado: leilão 13+1 juntos; pregão sozinho. */
    async function runMod(mod) {
      var maxP = mod === 6 ? maxPregao : maxLeilao;
      return fetchModPages({
        dataFinal: dataFinal,
        uf: uf,
        modalidade: mod,
        maxPages: maxP,
        deadline: deadline,
      }).then(function (part) {
        return { ok: true, mod: mod, part: part };
      }).catch(function (e) {
        return {
          ok: false,
          mod: mod,
          error: e.message || String(e),
        };
      });
    }

    var settledMods = await Promise.all(modalidades.map(runMod));
    for (var mi = 0; mi < settledMods.length; mi++) {
      var sm = settledMods[mi];
      if (!sm.ok) {
        errors.push({ modalidade: sm.mod, error: sm.error });
        continue;
      }
      var part = sm.part || {};
      pagesFetched += part.pagesFetched || 0;
      if (part.totalRegistros != null) totalRegistros += part.totalRegistros;
      var items = part.items || [];
      for (var i = 0; i < items.length; i++) {
        var o = items[i];
        var k = compraKey(o);
        if (seen[k]) continue;
        seen[k] = true;
        all.push(o);
      }
    }
    if (Date.now() >= deadline) truncated = true;

    var wantVeiculo =
      queryLib.looksLikeVeiculoSucataText &&
      queryLib.looksLikeVeiculoSucataText(rawKw);

    /* Se PNCP falhou em tudo: ainda JSON 200 com lista vazia + erros (não HTML). */
    if (!all.length && errors.length && errors.length >= modalidades.length) {
      return json(res, 200, {
        ok: true,
        uf: uf || null,
        keywords: keywords,
        rawKeywords: rawKw,
        modalidades: modalidades,
        dataFinalPncp: dataFinal,
        totalBrutoPncp: 0,
        total: 0,
        editais: [],
        data: [],
        avisos: [
          "PNCP indisponível ou lento neste momento.",
          errors
            .slice(0, 3)
            .map(function (e) {
              return "Mod " + e.modalidade + ": " + e.error;
            })
            .join(" | "),
          "Tente novamente em instantes.",
        ],
        errosParciais: errors,
        leilaoDomain: !!(querLeilao || wantVeiculo),
      });
    }

    var matches = [];
    for (var ri = 0; ri < all.length; ri++) {
      var row = all[ri];
      var hay = textHaystack(row);
      if (keywords.length) {
        var hit = queryLib.keywordMatchesObjeto
          ? queryLib.keywordMatchesObjeto(hay, keywords)
          : keywords.some(function (k) {
              return hay.indexOf(k) !== -1;
            });
        if (!hit) continue;
      }
      if (
        wantVeiculo &&
        queryLib.haystackVeiculoSucata &&
        !queryLib.haystackVeiculoSucata(hay)
      ) {
        continue;
      }
      matches.push(mapItem(row));
    }

    var avisos = [
      "Fonte: PNCP via proxy /api/radar-pncp (same-origin — sem CORS no browser).",
      "Horizonte: " +
        janelaInfo.label +
        " (dataFinal até " +
        dataFinal +
        ").",
      "Modalidades: " + modalidades.join(", ") + ".",
      "Leilões de veículos/sucata muitas vezes não estão no PNCP.",
    ];
    if (truncated) {
      avisos.push(
        "Consulta interrompida por limite de tempo — resultados podem estar incompletos."
      );
    }
    if (errors.length) {
      avisos.push(
        "Avisos PNCP: " + errors.length + " modalidade(s) falharam parcialmente."
      );
    }

    return json(res, 200, {
      ok: true,
      uf: uf || null,
      keywords: keywords,
      rawKeywords: rawKw,
      modalidades: modalidades,
      janela: janelaInfo.janela,
      janelaLabel: janelaInfo.label,
      dataFinalPncp: dataFinal,
      pagesFetched: pagesFetched,
      totalRegistrosPncp: totalRegistros || undefined,
      totalBrutoPncp: all.length,
      total: matches.length,
      editais: matches,
      /* Alias p/ cliente que espera `data` */
      data: matches,
      avisos: avisos,
      parcialPorTempo: truncated || undefined,
      errosParciais: errors.length ? errors : undefined,
      leilaoDomain: !!(querLeilao || wantVeiculo),
    });
  } catch (err) {
    return json(res, err.status || 500, {
      ok: false,
      error: err.message || String(err),
    });
  }
}

module.exports = safeJson.wrapHandler(handler, "GET,POST,OPTIONS");
