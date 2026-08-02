/**
 * GET|POST /api/editais-chat
 * Editais PNCP com propostas em aberto por município ou região Norte Pioneiro.
 *
 * Parâmetros (query ou JSON body):
 *   municipio | cidade     nome do município (ex.: Ibaiti)
 *   ibge                   código IBGE
 *   regiao                 "norte-pioneiro"
 *   mensagem | pergunta    texto livre em PT (ex.: "Quais licitações terão em Jacarezinho")
 *   categoria              reforma,comida,cestas,cafe,natal,eletro (vírgula)
 *   q | keywords           palavras-chave extras (vírgula)
 *   ampliar=1              inclui concorrência / pregão presencial
 *   leiloes=1              inclui Leilão Eletrônico (1) e Presencial (13)
 *   janela                 "ano" (padrão, ~365 dias) | "45"
 *   esferas                M,E (default) ou M,E,F
 *   limite                 máx. itens (default 80)
 *
 * Resposta: { ok, escopo, editais:[{orgao,municipio,objeto,valorEstimado,dataAbertura,link,modalidade}], respostaTexto }
 *
 * Voiceflow: Custom Action / API step → GET ou POST neste endpoint (CORS liberado).
 */
var queryLib = require("./_lib/editais-query");
var safeJson = require("./_lib/safe-json");

function cors(res) {
  safeJson.applyCors(res, "GET,POST,OPTIONS");
}

function json(res, status, body) {
  safeJson.sendJson(res, status, body, "GET,POST,OPTIONS");
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
    municipio: b.municipio || b.cidade || q.municipio || q.cidade || q.nome,
    ibge: b.ibge || b.codigoIbge || q.ibge || q.codigoIbge,
    uf: b.uf || q.uf,
    regiao: b.regiao || b.region || b.preset || q.regiao || q.region || q.preset,
    mensagem: b.mensagem || b.pergunta || b.text || q.mensagem || q.pergunta || q.text,
    categoria: b.categoria || b.categorias || q.categoria || q.categorias,
    q: b.q || b.keywords || q.q || q.keywords,
    ampliar: b.ampliar != null ? b.ampliar : b.extra != null ? b.extra : q.ampliar || q.extra,
    leiloes:
      b.leiloes != null
        ? b.leiloes
        : b.incluirLeiloes != null
          ? b.incluirLeiloes
          : q.leiloes || q.incluirLeiloes,
    esferas: b.esferas || q.esferas,
    limite: b.limite || b.limit || q.limite || q.limit,
    paginas: b.paginas || b.pages || q.paginas || q.pages,
    janela: b.janela || b.janelaTipo || b.horizonte || q.janela || q.janelaTipo || q.horizonte,
    dias: b.dias != null ? b.dias : b.janelaDias != null ? b.janelaDias : q.dias || q.janelaDias,
  };
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

  try {
    var body = {};
    if (req.method === "POST") {
      body = await readBody(req);
    }
    var opts = mergeOpts(req.query || {}, body);

    if (String(req.query && req.query.meta) === "1") {
      var norte = queryLib.loadNortePioneiro();
      return json(res, 200, {
        ok: true,
        endpoint: "/api/editais-chat",
        categorias: Object.keys(queryLib.CATEGORIA_KEYWORDS),
        regioes: [
          {
            id: norte.id,
            nome: norte.nome,
            municipios: norte.municipios.length,
            fonte: norte.fonte,
          },
        ],
        exemplos: [
          { regiao: "norte-pioneiro" },
          { municipio: "Ibaiti" },
          {
            mensagem:
              "Quais licitações terão em Jacarezinho com cestas básicas",
          },
          {
            regiao: "norte-pioneiro",
            categoria: "reforma,comida,cestas,cafe,natal,eletro",
          },
        ],
      });
    }

    var result = await queryLib.queryEditais(opts);
    return json(res, 200, result);
  } catch (err) {
    var status = err.status || 500;
    return json(res, status, {
      ok: false,
      error: err.message || String(err),
      errosParciais: err.errosParciais || undefined,
    });
  }
}

module.exports = safeJson.wrapHandler(handler, "GET,POST,OPTIONS");
