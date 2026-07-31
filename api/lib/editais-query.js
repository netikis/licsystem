/**
 * Consulta PNCP (propostas em aberto) por município ou região Norte Pioneiro.
 * Usado por /api/editais-chat e /api/chat-editais.
 *
 * Importante: no endpoint /contratacoes/proposta, dataFinal é o limite superior
 * da data de encerramento da proposta. Usar "hoje" exclui editais com abertura
 * futura (ex.: Ibaiti encerrando em agosto). Padrão = janela anual (~365 dias).
 */
var PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";
var PAGE_SIZE = 50;
var MAX_PAGES = 4;
/** Janela curta (toggle UI / janela=45). */
var JANELA_45_DIAS = 45;
/** Janela anual padrão: hoje → hoje+365 (propostas com encerramento no horizonte). */
var JANELA_ANUAL_DIAS = 365;
var MAX_DIAS_JANELA = 400;
/** Tamanho do pedaço se o PNCP rejeitar intervalo largo (fallback). */
var CHUNK_DIAS = 100;
var DEFAULT_MODALIDADES = [6];
var EXTRA_MODALIDADES = [4, 7];
/** Modalidades extras usadas por padrão em busca por município (não só ampliar=1). */
var MUNICIPIO_EXTRA_MODALIDADES = [4, 7, 8];
var ESFERA_LABEL = { M: "Municipal", E: "Estadual", F: "Federal", D: "Distrital" };

var CATEGORIA_KEYWORDS = {
  reforma: ["reforma", "reformas", "obra", "obras", "construcao", "engenharia"],
  comida: [
    "alimento",
    "alimentos",
    "genero alimenticio",
    "generos alimenticios",
    "merenda",
    "hortifruti",
    "comida",
    "alimentacao",
  ],
  cestas: ["cesta basica", "cestas basicas", "cesta", "cestas"],
  cafe: ["cafe", "cafe da manha", "lanche escolar", "kit lanche"],
  natal: ["natal", "kit natal", "ceia de natal", "presente de natal"],
  eletro: [
    "eletrodomestico",
    "eletrodomesticos",
    "geladeira",
    "fogao",
    "microondas",
    "maquina de lavar",
    "eletro",
  ],
};

var _municipios = null;
var _byIbge = null;
var _norte = null;

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function loadMunicipios() {
  if (_municipios) return _municipios;
  /* Sempre via módulo dedicado (require estático) — nunca fs. */
  _municipios = require("./municipios-data");
  _byIbge = Object.create(null);
  for (var i = 0; i < _municipios.length; i++) {
    _byIbge[_municipios[i].i] = _municipios[i];
  }
  return _municipios;
}

function loadNortePioneiro() {
  if (_norte) return _norte;
  _norte = require("./norte-pioneiro-data");
  return _norte;
}

function ymd(d) {
  var y = d.getFullYear();
  var m = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return "" + y + m + day;
}

/** dataFinal PNCP: hoje + N dias (propostas com encerramento futuro). */
function dataFinalProposta(dias) {
  var n =
    dias != null && Number.isFinite(Number(dias))
      ? Number(dias)
      : JANELA_ANUAL_DIAS;
  n = Math.max(0, Math.min(MAX_DIAS_JANELA, n));
  var d = new Date();
  d.setDate(d.getDate() + n);
  return ymd(d);
}

/**
 * Resolve janela de encerramento (dataFinal PNCP).
 * Padrão "ano": hoje → hoje+365. Alternativa "45": próximos 45 dias.
 * Também aceita dias/janelaDias numérico explícito.
 *
 * Preferência documentada: horizonte anual para acompanhar o que sai no ano;
 * perto do fim do ano o rolling 365 já cobre o Q1 seguinte.
 */
function resolveJanela(opts) {
  opts = opts || {};
  var raw = String(opts.janela || opts.janelaTipo || opts.horizonte || "")
    .trim()
    .toLowerCase();
  var diasOpt = opts.dias != null ? opts.dias : opts.janelaDias;

  if (
    diasOpt != null &&
    String(diasOpt).trim() !== "" &&
    Number.isFinite(Number(diasOpt))
  ) {
    var n = Math.max(0, Math.min(MAX_DIAS_JANELA, Number(diasOpt)));
    var is45 = n === JANELA_45_DIAS;
    return {
      janela: is45 ? "45" : n >= 300 ? "ano" : "custom",
      label: is45
        ? "45 dias"
        : n >= 300
          ? "janela anual"
          : n + " dias",
      dias: n,
      dataFinal: dataFinalProposta(n),
    };
  }

  if (
    raw === "45" ||
    raw === "45d" ||
    raw === "curta" ||
    raw === "short"
  ) {
    return {
      janela: "45",
      label: "45 dias",
      dias: JANELA_45_DIAS,
      dataFinal: dataFinalProposta(JANELA_45_DIAS),
    };
  }

  /* Padrão: janela anual (hoje + 365). */
  return {
    janela: "ano",
    label: "janela anual",
    dias: JANELA_ANUAL_DIAS,
    dataFinal: dataFinalProposta(JANELA_ANUAL_DIAS),
  };
}

/** Datas finais intermediárias (chunks) até o alvo — fallback se PNCP rejeitar ano. */
function dataFinalChunks(dataFinalAlvo) {
  var alvo = String(dataFinalAlvo || "");
  var out = [];
  var cursor = new Date();
  var guard = 0;
  while (guard < 8) {
    guard++;
    cursor = new Date(cursor.getTime());
    cursor.setDate(cursor.getDate() + CHUNK_DIAS);
    var y = ymd(cursor);
    if (y >= alvo) {
      out.push(alvo);
      break;
    }
    out.push(y);
  }
  if (!out.length) out.push(alvo);
  return out;
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

function pncpLink(item) {
  var cnpj =
    (item.orgaoEntidade && item.orgaoEntidade.cnpj) || item.cnpjOrgao || "";
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

async function fetchPncpJson(url) {
  var r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "LICSYSTEM/1.0 (editais-chat)",
    },
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
}

/**
 * Consulta /contratacoes/proposta.
 * Prefira codigoMunicipioIbge: com UF ampla o PNCP pagina milhares e municípios
 * pequenos somem das primeiras páginas.
 */
async function fetchPropostas(opts) {
  opts = opts || {};
  var pages = Math.max(1, Math.min(5, Number(opts.maxPages) || MAX_PAGES));
  var dataFinal = opts.dataFinal || dataFinalProposta();
  var modalidade = opts.modalidade;
  var out = [];
  for (var pagina = 1; pagina <= pages; pagina++) {
    var url =
      PNCP_BASE +
      "/contratacoes/proposta?dataFinal=" +
      dataFinal +
      "&codigoModalidadeContratacao=" +
      modalidade +
      "&pagina=" +
      pagina +
      "&tamanhoPagina=" +
      PAGE_SIZE;
    if (opts.codigoMunicipioIbge) {
      url +=
        "&codigoMunicipioIbge=" +
        encodeURIComponent(String(opts.codigoMunicipioIbge));
    } else if (opts.uf) {
      url += "&uf=" + encodeURIComponent(opts.uf);
    }
    var j = await fetchPncpJson(url);
    var arr = (j && j.data) || [];
    if (!Array.isArray(arr) || !arr.length) break;
    for (var i = 0; i < arr.length; i++) out.push(arr[i]);
    var totalPaginas = Number(j.totalPaginas || 1);
    if (pagina >= totalPaginas) break;
  }
  return out;
}

async function fetchPropostasUf(uf, dataFinal, modalidade, maxPages) {
  return fetchPropostas({
    uf: uf,
    dataFinal: dataFinal,
    modalidade: modalidade,
    maxPages: maxPages,
  });
}

async function fetchPropostasMunicipio(ibge, dataFinal, modalidade, maxPages) {
  return fetchPropostas({
    codigoMunicipioIbge: ibge,
    dataFinal: dataFinal,
    modalidade: modalidade,
    maxPages: maxPages,
  });
}

/**
 * Busca propostas por município; se dataFinal anual falhar (4xx), tenta chunks ~100 dias.
 */
async function fetchPropostasMunicipioRobusto(ibge, dataFinal, modalidade, maxPages) {
  try {
    return await fetchPropostasMunicipio(ibge, dataFinal, modalidade, maxPages);
  } catch (e) {
    var st = e && e.status;
    if (st !== 400 && st !== 422 && st !== 500) throw e;
    var chunks = dataFinalChunks(dataFinal);
    if (chunks.length <= 1) throw e;
    var merged = [];
    var seenLocal = Object.create(null);
    var lastErr = e;
    for (var i = 0; i < chunks.length; i++) {
      try {
        var part = await fetchPropostasMunicipio(
          ibge,
          chunks[i],
          modalidade,
          maxPages
        );
        for (var j = 0; j < part.length; j++) {
          var k = compraKey(part[j]);
          if (seenLocal[k]) continue;
          seenLocal[k] = true;
          merged.push(part[j]);
        }
        lastErr = null;
      } catch (e2) {
        lastErr = e2;
      }
    }
    if (lastErr && !merged.length) throw lastErr;
    return merged;
  }
}

function itemMatchesMunicipio(o, targetIbges, targetNamesFolded) {
  var uo = o.unidadeOrgao || {};
  var oe = o.orgaoEntidade || {};
  var codigo = uo.codigoIbge ? Number(uo.codigoIbge) : 0;
  if (codigo && targetIbges[codigo]) return true;

  var munFold = fold(uo.municipioNome || "");
  if (munFold && targetNamesFolded[munFold]) return true;

  var orgaoFold = fold(oe.razaoSocial || o.nomeOrgao || "");
  if (orgaoFold) {
    var names = Object.keys(targetNamesFolded);
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (n.length >= 4 && orgaoFold.indexOf(n) !== -1) return true;
    }
  }
  return false;
}

function amostraMunicipios(raw, limite) {
  var counts = Object.create(null);
  for (var i = 0; i < raw.length; i++) {
    var uo = raw[i].unidadeOrgao || {};
    var nome = String(uo.municipioNome || "").trim() || "?";
    var uf = String(uo.ufSigla || "").trim();
    var key = nome + (uf ? "/" + uf : "");
    if (!counts[key]) {
      counts[key] = {
        municipio: nome,
        uf: uf,
        ibge: uo.codigoIbge ? Number(uo.codigoIbge) : null,
        qtd: 0,
      };
    }
    counts[key].qtd++;
  }
  return Object.keys(counts)
    .map(function (k) {
      return counts[k];
    })
    .sort(function (a, b) {
      return b.qtd - a.qtd;
    })
    .slice(0, limite || 12);
}

function parseEsferas(raw) {
  var def = { M: true, E: true };
  if (!raw || !String(raw).trim()) return def;
  var set = Object.create(null);
  String(raw)
    .split(",")
    .map(function (s) {
      return s.trim().toUpperCase();
    })
    .filter(Boolean)
    .forEach(function (c) {
      set[c] = true;
    });
  return set;
}

function resolveKeywords(opts) {
  var keys = [];
  var cats = [];
  var rawCat = String(opts.categoria || opts.categorias || "").trim();
  if (rawCat) {
    rawCat.split(/[,;|]/).forEach(function (c) {
      var id = fold(c).trim().replace(/\s+/g, "");
      if (id === "aquisicoesdecomida" || id === "aquisicaodecomida") id = "comida";
      if (id === "cestasbasicas" || id === "cestabasia") id = "cestas";
      if (id === "eletrodomesticos") id = "eletro";
      if (id === "reformas") id = "reforma";
      if (CATEGORIA_KEYWORDS[id]) {
        cats.push(id);
        keys = keys.concat(CATEGORIA_KEYWORDS[id]);
      } else if (fold(c).trim()) {
        keys.push(fold(c).trim());
      }
    });
  }
  var q = String(opts.q || opts.keywords || "").trim();
  if (q) {
    q.split(/[,;]/).forEach(function (s) {
      var t = fold(s).trim();
      if (t) keys.push(t);
    });
  }
  // dedupe
  var seen = Object.create(null);
  var uniq = [];
  for (var i = 0; i < keys.length; i++) {
    if (seen[keys[i]]) continue;
    seen[keys[i]] = true;
    uniq.push(keys[i]);
  }
  return { keywords: uniq, categorias: cats };
}

function findMunicipioByName(nome, ufPrefer) {
  loadMunicipios();
  var term = fold(nome).trim();
  if (!term || term.length < 2) return null;
  var uf = String(ufPrefer || "")
    .trim()
    .toUpperCase();
  var exact = [];
  var starts = [];
  var partial = [];
  for (var i = 0; i < _municipios.length; i++) {
    var m = _municipios[i];
    if (uf && m.u !== uf) continue;
    var fn = fold(m.n);
    if (fn === term) exact.push(m);
    else if (fn.indexOf(term) === 0) starts.push(m);
    else if (fn.indexOf(term) !== -1) partial.push(m);
  }
  function preferPr(arr) {
    if (arr.length === 1) return arr[0];
    var pr = arr.filter(function (x) {
      return x.u === "PR";
    });
    if (pr.length === 1) return pr[0];
    return arr[0] || null;
  }
  if (exact.length) return preferPr(exact);
  if (starts.length) return preferPr(starts);
  if (partial.length === 1) return partial[0];
  return null;
}

/**
 * Extrai intenção de texto livre em português (sem IA).
 */
function parseMensagem(mensagem) {
  var text = String(mensagem || "").trim();
  var folded = fold(text);
  var out = {
    regiao: null,
    municipio: null,
    categorias: [],
    keywords: [],
  };

  if (
    /norte\s*pioneiro/.test(folded) ||
    folded.indexOf("norte-pioneiro") !== -1 ||
    folded.indexOf("amunorpi") !== -1
  ) {
    out.regiao = "norte-pioneiro";
  }

  Object.keys(CATEGORIA_KEYWORDS).forEach(function (id) {
    var words = CATEGORIA_KEYWORDS[id];
    for (var i = 0; i < words.length; i++) {
      if (folded.indexOf(words[i]) !== -1) {
        out.categorias.push(id);
        break;
      }
    }
  });
  if (/reforma/.test(folded)) {
    if (out.categorias.indexOf("reforma") === -1) out.categorias.push("reforma");
  }
  if (/natal/.test(folded)) {
    if (out.categorias.indexOf("natal") === -1) out.categorias.push("natal");
  }
  if (/cesta/.test(folded)) {
    if (out.categorias.indexOf("cestas") === -1) out.categorias.push("cestas");
  }
  if (/eletro/.test(folded)) {
    if (out.categorias.indexOf("eletro") === -1) out.categorias.push("eletro");
  }
  if (/(comida|alimento|merenda|genero aliment)/.test(folded)) {
    if (out.categorias.indexOf("comida") === -1) out.categorias.push("comida");
  }
  if (/\bcafe\b/.test(folded)) {
    if (out.categorias.indexOf("cafe") === -1) out.categorias.push("cafe");
  }

  if (!out.regiao) {
    var patterns = [
      /quais\s+licita(?:coes|ções)?\s+ter[aã]o?\s+em\s+([^?.!,;]+)/i,
      /licita(?:coes|ções)?\s+(?:em|de|no|na)\s+([^?.!,;]+)/i,
      /editais?\s+(?:em|de|no|na|para)\s+([^?.!,;]+)/i,
      /munic[ií]pio\s+(?:de\s+)?([^?.!,;]+)/i,
      /cidade\s+(?:de\s+)?([^?.!,;]+)/i,
      /em\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ\s']{1,40})(?:\s*\/\s*PR)?/i,
    ];
    for (var p = 0; p < patterns.length; p++) {
      var m = text.match(patterns[p]);
      if (!m || !m[1]) continue;
      var cand = m[1]
        .replace(/\b(pr|parana|paraná)\b/gi, "")
        .replace(
          /\b(aberto|abertos|aberta|abertas|com|proposta|propostas|hoje|agora)\b/gi,
          ""
        )
        .trim()
        .replace(/[.,;:]+$/, "")
        .trim();
      if (cand.length >= 2 && !/norte\s*pioneiro/i.test(cand)) {
        out.municipio = cand;
        break;
      }
    }
  }

  return out;
}

function mapItem(o) {
  var uo = o.unidadeOrgao || {};
  var oe = o.orgaoEntidade || {};
  var esfera = oe.esferaId || "";
  return {
    orgao: oe.razaoSocial || o.nomeOrgao || "Órgão público",
    municipio: uo.municipioNome || "",
    uf: uo.ufSigla || "",
    ibge: uo.codigoIbge ? Number(uo.codigoIbge) : null,
    esfera: esfera,
    esferaNome: ESFERA_LABEL[esfera] || esfera || "—",
    modalidade: o.modalidadeNome || "",
    numeroCompra: o.numeroCompra != null ? String(o.numeroCompra) : null,
    objeto: o.objetoCompra || o.objeto || "",
    valorEstimado:
      o.valorTotalEstimado != null ? Number(o.valorTotalEstimado) : null,
    dataAbertura: o.dataAberturaProposta || null,
    dataEncerramento: o.dataEncerramentoProposta || null,
    numeroControlePNCP: o.numeroControlePNCP || null,
    link: pncpLink(o),
  };
}

/**
 * @param {object} opts
 * @returns {Promise<object>}
 */
async function queryEditais(opts) {
  opts = opts || {};
  loadMunicipios();
  var norte = loadNortePioneiro();

  var mensagem = String(opts.mensagem || opts.pergunta || "").trim();
  var parsed = mensagem ? parseMensagem(mensagem) : null;

  var regiao = String(opts.regiao || opts.region || opts.preset || "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!regiao && parsed && parsed.regiao) regiao = parsed.regiao;
  if (
    regiao === "nortepioneiro" ||
    regiao === "norte pioneiro" ||
    regiao === "np"
  ) {
    regiao = "norte-pioneiro";
  }

  var ibge = Number(opts.ibge || opts.codigoIbge || 0) || 0;
  var municipioNome = String(opts.municipio || opts.cidade || opts.nome || "").trim();
  if (!municipioNome && parsed && parsed.municipio) {
    municipioNome = parsed.municipio;
  }

  var targetIbges = Object.create(null);
  var targetNamesFolded = Object.create(null);
  var escopo = null;
  var municipioResolvido = null;

  function addTarget(m) {
    if (!m) return;
    targetIbges[m.i] = m.n;
    targetNamesFolded[fold(m.n)] = m.n;
  }

  if (regiao === "norte-pioneiro") {
    escopo = {
      tipo: "regiao",
      id: "norte-pioneiro",
      nome: norte.nome,
      uf: "PR",
      municipios: norte.municipios.length,
      fonte: norte.fonte,
    };
    for (var ni = 0; ni < norte.municipios.length; ni++) {
      addTarget(norte.municipios[ni]);
    }
  } else if (ibge && _byIbge[ibge]) {
    municipioResolvido = _byIbge[ibge];
    addTarget(municipioResolvido);
    escopo = {
      tipo: "municipio",
      ibge: municipioResolvido.i,
      nome: municipioResolvido.n,
      uf: municipioResolvido.u,
    };
  } else if (municipioNome) {
    var found = findMunicipioByName(municipioNome, opts.uf || "PR");
    if (!found) found = findMunicipioByName(municipioNome, null);
    if (!found) {
      var err = new Error(
        'Município não encontrado: "' +
          municipioNome +
          '". Informe o nome completo (ex.: Ibaiti) ou use regiao=norte-pioneiro.'
      );
      err.status = 400;
      throw err;
    }
    municipioResolvido = found;
    addTarget(found);
    escopo = {
      tipo: "municipio",
      ibge: found.i,
      nome: found.n,
      uf: found.u,
    };
  } else {
    var err2 = new Error(
      "Informe municipio (nome), ibge, regiao=norte-pioneiro ou mensagem em português."
    );
    err2.status = 400;
    throw err2;
  }

  var kwOpts = Object.assign({}, opts);
  if (parsed && parsed.categorias.length && !kwOpts.categoria) {
    kwOpts.categoria = parsed.categorias.join(",");
  }
  var kw = resolveKeywords(kwOpts);
  if (parsed && parsed.keywords.length) {
    kw.keywords = kw.keywords.concat(parsed.keywords);
  }

  var esferas = parseEsferas(opts.esferas);
  var ampliar =
    String(opts.extra || opts.ampliar || "") === "1" ||
    String(opts.extra || opts.ampliar || "").toLowerCase() === "true";
  /* Município: mais modalidades por padrão. Região: só pregão, salvo ampliar=1. */
  var modalidades =
    escopo.tipo === "municipio"
      ? DEFAULT_MODALIDADES.concat(MUNICIPIO_EXTRA_MODALIDADES)
      : ampliar
        ? DEFAULT_MODALIDADES.concat(EXTRA_MODALIDADES)
        : DEFAULT_MODALIDADES.slice();
  var modSeen = Object.create(null);
  modalidades = modalidades.filter(function (m) {
    if (modSeen[m]) return false;
    modSeen[m] = true;
    return true;
  });

  var ufList =
    escopo.tipo === "regiao" ? ["PR"] : [escopo.uf || "PR"];

  var janelaInfo = resolveJanela(opts);
  var dataFinal = janelaInfo.dataFinal;
  var raw = [];
  var errors = [];
  var seen = Object.create(null);
  /* Região: menos páginas por município (muitos jobs). Município: até 5. */
  var pagesDefault = escopo.tipo === "regiao" ? 3 : MAX_PAGES;
  var pages = Number(opts.paginas || opts.pages || pagesDefault) || pagesDefault;
  pages = Math.max(1, Math.min(5, pages));

  /* Consulta por IBGE do município — evita sumiço nas primeiras páginas da UF. */
  var ibgeTargets = Object.keys(targetIbges).map(Number);
  var jobs = [];
  for (var ti = 0; ti < ibgeTargets.length; ti++) {
    for (var mi = 0; mi < modalidades.length; mi++) {
      jobs.push({
        ibge: ibgeTargets[ti],
        modalidade: modalidades[mi],
      });
    }
  }

  async function runJob(job) {
    try {
      var chunk = await fetchPropostasMunicipioRobusto(
        job.ibge,
        dataFinal,
        job.modalidade,
        pages
      );
      return { ok: true, job: job, chunk: chunk };
    } catch (e) {
      return {
        ok: false,
        job: job,
        error: e.message || String(e),
      };
    }
  }

  /* Concorrência limitada — PNCP devolve 429 se disparar dezenas de calls. */
  var CONCURRENCY = escopo.tipo === "regiao" ? 5 : 6;
  var settled = [];
  for (var batchStart = 0; batchStart < jobs.length; batchStart += CONCURRENCY) {
    var batch = jobs.slice(batchStart, batchStart + CONCURRENCY);
    var batchResult = await Promise.all(batch.map(runJob));
    for (var bi = 0; bi < batchResult.length; bi++) {
      settled.push(batchResult[bi]);
    }
  }

  for (var si = 0; si < settled.length; si++) {
    var s = settled[si];
    if (!s.ok) {
      errors.push({
        ibge: s.job.ibge,
        modalidade: s.job.modalidade,
        error: s.error,
      });
      continue;
    }
    var chunk = s.chunk || [];
    for (var ci = 0; ci < chunk.length; ci++) {
      var item = chunk[ci];
      var key = compraKey(item);
      if (seen[key]) continue;
      seen[key] = true;
      raw.push(item);
    }
  }

  var results = [];
  for (var ri = 0; ri < raw.length; ri++) {
    var o = raw[ri];
    var oe = o.orgaoEntidade || {};
    var esfera = String(oe.esferaId || "").toUpperCase();
    if (esfera && !esferas[esfera]) continue;

    if (!itemMatchesMunicipio(o, targetIbges, targetNamesFolded)) continue;

    var objeto = fold(o.objetoCompra || o.objeto || "");
    if (kw.keywords.length) {
      var hit = kw.keywords.some(function (k) {
        return objeto.indexOf(k) !== -1;
      });
      if (!hit) continue;
    }

    results.push(mapItem(o));
  }

  results.sort(function (a, b) {
    var da = a.dataAbertura ? String(a.dataAbertura) : "9999";
    var db = b.dataAbertura ? String(b.dataAbertura) : "9999";
    return da.localeCompare(db);
  });

  var limite = Number(opts.limite || opts.limit || 80);
  if (!Number.isFinite(limite) || limite < 1) limite = 80;
  limite = Math.min(200, limite);
  var truncated = results.length > limite;
  if (truncated) results = results.slice(0, limite);

  var amostra = amostraMunicipios(raw, 12);

  var avisos = [
    "Fonte oficial: PNCP (propostas em aberto). Sem dados inventados.",
    "Horizonte: propostas com encerramento na " +
      janelaInfo.label +
      " (dataFinal PNCP até " +
      dataFinal +
      ").",
    escopo.tipo === "municipio"
      ? "Consulta por código IBGE do município + modalidades " +
        modalidades.join(", ") +
        "."
      : "Padrão: Pregão Eletrônico (mod. 6). Use ampliar=1 para concorrência/pregão presencial.",
    "Editais só em portais locais (fora do PNCP) não aparecem.",
  ];
  if (escopo.tipo === "regiao") {
    avisos.push(
      "Região " +
        norte.nome +
        ": " +
        norte.municipios.length +
        " municípios consultados individualmente no PNCP (AMUNORPI / IG INPI)."
    );
  }

  var respostaTexto = formatRespostaPt(escopo, results, kw, amostra, janelaInfo);

  return {
    ok: true,
    escopo: escopo,
    categorias: kw.categorias,
    keywords: kw.keywords,
    ufsConsultadas: ufList,
    modalidades: modalidades,
    janela: janelaInfo.janela,
    janelaLabel: janelaInfo.label,
    janelaDias: janelaInfo.dias,
    dataFinalPncp: dataFinal,
    totalBrutoPncp: raw.length,
    total: results.length,
    truncado: truncated || undefined,
    editais: results,
    respostaTexto: respostaTexto,
    avisos: avisos,
    amostraMunicipios: !results.length && amostra.length ? amostra : undefined,
    errosParciais: errors.length ? errors : undefined,
    interpretacao: parsed || undefined,
  };
}

function formatBrl(n) {
  if (n == null || !Number.isFinite(Number(n))) return "não informado";
  try {
    return Number(n).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } catch (e) {
    return "R$ " + Number(n).toFixed(2);
  }
}

function formatDatePt(iso) {
  if (!iso) return "não informada";
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    return String(iso);
  }
}

function formatDateShortPt(iso) {
  if (!iso) return "não informada";
  try {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    return String(iso);
  }
}

function formatRespostaPt(escopo, editais, kw, amostra, janelaInfo) {
  var ondeCurto =
    escopo.tipo === "regiao" ? escopo.nome : escopo.nome + "/" + escopo.uf;
  var janelaTxt =
    janelaInfo && janelaInfo.label
      ? janelaInfo.label
      : "janela anual";
  var lines = [];
  if (!editais.length) {
    lines.push(
      "Nenhuma proposta aberta no PNCP neste momento para " +
        ondeCurto +
        " (horizonte: " +
        janelaTxt +
        ")."
    );
    if (kw && kw.categorias && kw.categorias.length) {
      lines.push("Filtro de categorias: " + kw.categorias.join(", ") + ".");
    }
    if (amostra && amostra.length) {
      lines.push(
        "Amostra de municípios nos registros brutos do PNCP: " +
          amostra
            .slice(0, 8)
            .map(function (a) {
              return a.municipio + (a.uf ? "/" + a.uf : "") + " (" + a.qtd + ")";
            })
            .join(", ") +
          "."
      );
    }
    lines.push(
      "Tente sem categoria, ampliar modalidades ou outro município. Editais só em portais locais (fora do PNCP) não aparecem."
    );
    return lines.join(" ");
  }
  lines.push(
    "Licitações com propostas em aberto em " +
      ondeCurto +
      " (PNCP · encerramento no horizonte " +
      janelaTxt +
      "):"
  );
  if (kw && kw.categorias && kw.categorias.length) {
    lines.push("Filtro: " + kw.categorias.join(", ") + ".");
  }
  lines.push(
    "Encontrei " +
      editais.length +
      " edital(is) com proposta em aberto nesse horizonte."
  );
  var maxList = Math.min(editais.length, 25);
  for (var i = 0; i < maxList; i++) {
    var e = editais[i];
    var prefix =
      escopo.tipo === "regiao" && e.municipio
        ? e.municipio + " — "
        : "";
    lines.push(
      i +
        1 +
        ". " +
        prefix +
        String(e.objeto || "Objeto não informado").slice(0, 160) +
        " — " +
        formatBrl(e.valorEstimado) +
        " — abertura " +
        formatDateShortPt(e.dataAbertura) +
        (e.link ? " — " + e.link : "")
    );
  }
  if (editais.length > maxList) {
    lines.push("… e mais " + (editais.length - maxList) + " no JSON completo.");
  }
  return lines.join("\n");
}

module.exports = {
  queryEditais: queryEditais,
  parseMensagem: parseMensagem,
  loadNortePioneiro: loadNortePioneiro,
  dataFinalProposta: dataFinalProposta,
  resolveJanela: resolveJanela,
  JANELA_ANUAL_DIAS: JANELA_ANUAL_DIAS,
  JANELA_45_DIAS: JANELA_45_DIAS,
  CATEGORIA_KEYWORDS: CATEGORIA_KEYWORDS,
};
