/**
 * Consulta PNCP (propostas em aberto) por município ou região Norte Pioneiro.
 * Usado por /api/editais-chat e /api/chat-editais.
 */
var PNCP_BASE = "https://pncp.gov.br/api/consulta/v1";
var PAGE_SIZE = 50;
var MAX_PAGES = 3;
var DEFAULT_MODALIDADES = [6];
var EXTRA_MODALIDADES = [4, 7];
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

async function fetchPropostasUf(uf, dataFinal, modalidade, maxPages) {
  var pages = Math.max(1, Math.min(5, Number(maxPages) || MAX_PAGES));
  var out = [];
  for (var pagina = 1; pagina <= pages; pagina++) {
    var url =
      PNCP_BASE +
      "/contratacoes/proposta?dataFinal=" +
      dataFinal +
      "&codigoModalidadeContratacao=" +
      modalidade +
      "&uf=" +
      encodeURIComponent(uf) +
      "&pagina=" +
      pagina +
      "&tamanhoPagina=" +
      PAGE_SIZE;
    var j = await fetchPncpJson(url);
    var arr = (j && j.data) || [];
    if (!Array.isArray(arr) || !arr.length) break;
    for (var i = 0; i < arr.length; i++) out.push(arr[i]);
    var totalPaginas = Number(j.totalPaginas || 1);
    if (pagina >= totalPaginas) break;
  }
  return out;
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
  var escopo = null;
  var municipioResolvido = null;

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
      targetIbges[norte.municipios[ni].i] = norte.municipios[ni].n;
    }
  } else if (ibge && _byIbge[ibge]) {
    municipioResolvido = _byIbge[ibge];
    targetIbges[ibge] = municipioResolvido.n;
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
    targetIbges[found.i] = found.n;
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
  var modalidades = DEFAULT_MODALIDADES.slice();
  if (String(opts.extra || opts.ampliar || "") === "1") {
    modalidades = DEFAULT_MODALIDADES.concat(EXTRA_MODALIDADES);
  }

  var ufList =
    escopo.tipo === "regiao"
      ? ["PR"]
      : [escopo.uf || "PR"];

  var dataFinal = ymd(new Date());
  var raw = [];
  var errors = [];
  var seen = Object.create(null);
  var pages = Number(opts.paginas || opts.pages || MAX_PAGES) || MAX_PAGES;
  pages = Math.max(1, Math.min(5, pages));

  var jobs = [];
  for (var ui = 0; ui < ufList.length; ui++) {
    for (var mi = 0; mi < modalidades.length; mi++) {
      jobs.push({ uf: ufList[ui], modalidade: modalidades[mi] });
    }
  }

  var settled = await Promise.all(
    jobs.map(function (job) {
      return fetchPropostasUf(job.uf, dataFinal, job.modalidade, pages)
        .then(function (chunk) {
          return { ok: true, job: job, chunk: chunk };
        })
        .catch(function (e) {
          return {
            ok: false,
            job: job,
            error: e.message || String(e),
          };
        });
    })
  );

  for (var si = 0; si < settled.length; si++) {
    var s = settled[si];
    if (!s.ok) {
      errors.push({
        uf: s.job.uf,
        modalidade: s.job.modalidade,
        error: s.error,
      });
      continue;
    }
    var chunk = s.chunk || [];
    for (var ci = 0; ci < chunk.length; ci++) {
      var item = chunk[ci];
      var key =
        item.numeroControlePNCP ||
        [
          (item.orgaoEntidade && item.orgaoEntidade.cnpj) || "",
          item.anoCompra,
          item.sequencialCompra,
        ].join("-");
      if (seen[key]) continue;
      seen[key] = true;
      raw.push(item);
    }
  }

  var results = [];
  for (var ri = 0; ri < raw.length; ri++) {
    var o = raw[ri];
    var uo = o.unidadeOrgao || {};
    var oe = o.orgaoEntidade || {};
    var esfera = String(oe.esferaId || "").toUpperCase();
    if (!esferas[esfera]) continue;

    var codigo = uo.codigoIbge ? Number(uo.codigoIbge) : 0;
    if (!codigo || !targetIbges[codigo]) continue;

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

  var avisos = [
    "Fonte oficial: PNCP (propostas em aberto). Sem dados inventados.",
    "Padrão: Pregão Eletrônico (mod. 6). Use ampliar=1 para concorrência/pregão presencial.",
    "Cobertura limitada às páginas consultadas no PNCP (até " +
      pages +
      " pág. × " +
      PAGE_SIZE +
      " itens/modalidade).",
    "Editais só em portais locais (fora do PNCP) não aparecem.",
  ];
  if (escopo.tipo === "regiao") {
    avisos.push(
      "Região " +
        norte.nome +
        ": " +
        norte.municipios.length +
        " municípios (AMUNORPI / IG INPI)."
    );
  }

  var respostaTexto = formatRespostaPt(escopo, results, kw);

  return {
    ok: true,
    escopo: escopo,
    categorias: kw.categorias,
    keywords: kw.keywords,
    ufsConsultadas: ufList,
    modalidades: modalidades,
    totalBrutoPncp: raw.length,
    total: results.length,
    truncado: truncated || undefined,
    editais: results,
    respostaTexto: respostaTexto,
    avisos: avisos,
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

function formatRespostaPt(escopo, editais, kw) {
  var onde =
    escopo.tipo === "regiao"
      ? escopo.nome + " (" + escopo.municipios + " municípios)"
      : escopo.nome + "/" + escopo.uf;
  var lines = [];
  lines.push(
    "Encontrei " +
      editais.length +
      " edital(is) com proposta em aberto no PNCP para " +
      onde +
      "."
  );
  if (kw && kw.categorias && kw.categorias.length) {
    lines.push("Filtro de categorias: " + kw.categorias.join(", ") + ".");
  }
  if (!editais.length) {
    lines.push(
      "Nenhum resultado com os filtros atuais. Tente sem categoria, ampliar modalidades ou outro município."
    );
    return lines.join(" ");
  }
  var maxList = Math.min(editais.length, 25);
  for (var i = 0; i < maxList; i++) {
    var e = editais[i];
    lines.push(
      i +
        1 +
        ") " +
        (e.municipio || "—") +
        " — " +
        (e.orgao || "Órgão") +
        " | Valor: " +
        formatBrl(e.valorEstimado) +
        " | Abertura: " +
        formatDatePt(e.dataAbertura) +
        " | " +
        (e.link || "sem link") +
        " | Objeto: " +
        String(e.objeto || "").slice(0, 160)
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
  CATEGORIA_KEYWORDS: CATEGORIA_KEYWORDS,
};
