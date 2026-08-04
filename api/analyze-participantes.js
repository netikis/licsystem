/**
 * POST /api/analyze-participantes
 * A partir do relatório/texto do edital, a IA indica quem pode participar
 * (critérios + perfis). Opcionalmente cruza com contratos recentes do PNCP
 * (fornecedores reais de objeto semelhante).
 *
 * Body JSON: { text|relatorio, objeto?, municipio?, uf?, orgao? }
 * Resposta: { ok, criterios, restricoes, perfisAptos, empresasPncp, resumo, ... }
 */
var safeJson = require("./_lib/safe-json");

var DEFAULT_MODEL = "gemini-2.5-flash-lite";
var MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-flash-latest",
];
var MAX_CHARS = 60000;
var PNCP_TIMEOUT_MS = 12000;

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

function normalizeModelId(name) {
  var m = String(name || DEFAULT_MODEL).trim();
  if (m.toLowerCase().indexOf("models/") === 0) m = m.slice(7);
  return m;
}

function buildModelQueue(preferred) {
  var first = normalizeModelId(preferred);
  var queue = [first];
  for (var i = 0; i < MODEL_FALLBACKS.length; i++) {
    if (queue.indexOf(MODEL_FALLBACKS[i]) === -1) queue.push(MODEL_FALLBACKS[i]);
  }
  return queue;
}

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function extractJsonObject(raw) {
  var text = String(raw || "").trim();
  if (!text) return null;
  var fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = String(fence[1] || "").trim();
  var start = text.indexOf("{");
  var end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

function ymd(d) {
  var y = d.getFullYear();
  var m = ("0" + (d.getMonth() + 1)).slice(-2);
  var day = ("0" + d.getDate()).slice(-2);
  return "" + y + m + day;
}

function keywordList(objeto, texto) {
  var base = fold((objeto || "") + " " + String(texto || "").slice(0, 800));
  var stop = {
    para: 1, com: 1, dos: 1, das: 1, pelo: 1, pela: 1, que: 1, uma: 1, uno: 1,
    este: 1, esta: 1, sob: 1, sobre: 1, municipio: 1, prefeitura: 1, edital: 1,
    pregao: 1, eletronico: 1, contratacao: 1, objeto: 1, servico: 1, servicos: 1,
    fornecimento: 1, aquisicao: 1, registro: 1, precos: 1, ata: 1, processo: 1,
  };
  var words = base
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(function (w) {
      return w.length >= 5 && !stop[w];
    });
  var seen = {};
  var out = [];
  for (var i = 0; i < words.length && out.length < 8; i++) {
    if (seen[words[i]]) continue;
    seen[words[i]] = true;
    out.push(words[i]);
  }
  return out;
}

async function fetchPncpFornecedores(opts) {
  opts = opts || {};
  var keywords = opts.keywords || [];
  var uf = String(opts.uf || "").toUpperCase().slice(0, 2);
  if (!keywords.length) return [];

  var end = new Date();
  var start = new Date();
  start.setDate(end.getDate() - 120);
  var url =
    "https://pncp.gov.br/api/consulta/v1/contratos/atualizacao?dataInicial=" +
    ymd(start) +
    "&dataFinal=" +
    ymd(end) +
    "&pagina=1";

  var ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
  var timer = setTimeout(function () {
    try {
      if (ctrl) ctrl.abort();
    } catch (e) {}
  }, PNCP_TIMEOUT_MS);

  try {
    var res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: ctrl ? ctrl.signal : undefined,
    });
    var raw = await res.text();
    var body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch (e) {
      body = null;
    }
    if (!res.ok || !body) return [];
    var rows = Array.isArray(body.data) ? body.data : Array.isArray(body) ? body : [];
    var scored = [];
    for (var i = 0; i < rows.length; i++) {
      var r = rows[i] || {};
      var objeto = fold(
        r.objetoContrato ||
          r.objetoCompra ||
          (r.compra && r.compra.objetoCompra) ||
          ""
      );
      var nome = String(r.nomeRazaoSocialFornecedor || r.nomeFornecedor || "").trim();
      if (!nome || nome.length < 3) continue;
      var rowUf =
        (r.unidadeOrgao && r.unidadeOrgao.ufSigla) ||
        (r.orgaoEntidade && r.orgaoEntidade.ufSigla) ||
        r.uf ||
        "";
      if (uf && rowUf && String(rowUf).toUpperCase() !== uf) continue;
      var hits = 0;
      for (var k = 0; k < keywords.length; k++) {
        if (objeto.indexOf(keywords[k]) !== -1) hits++;
      }
      if (hits < 1) continue;
      scored.push({
        nome: nome.slice(0, 180),
        cnpj: String(r.niFornecedor || r.cnpjFornecedor || "").replace(/\D/g, "").slice(0, 14) || null,
        objeto: String(r.objetoContrato || r.objetoCompra || "").slice(0, 220),
        orgao:
          (r.orgaoEntidade && r.orgaoEntidade.razaoSocial) ||
          r.nomeOrgao ||
          "",
        uf: String(rowUf || "").slice(0, 2),
        valor:
          r.valorGlobal != null
            ? Number(r.valorGlobal)
            : r.valorInicial != null
              ? Number(r.valorInicial)
              : null,
        data: r.dataAssinatura || r.dataVigenciaInicio || null,
        hits: hits,
        fonte: "pncp",
      });
    }
    scored.sort(function (a, b) {
      return b.hits - a.hits;
    });
    var uniq = [];
    var seenNome = {};
    for (var j = 0; j < scored.length && uniq.length < 8; j++) {
      var key = fold(scored[j].nome);
      if (seenNome[key]) continue;
      seenNome[key] = true;
      uniq.push(scored[j]);
    }
    return uniq;
  } catch (e) {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(meta) {
  return (
    "Você é especialista em licitações públicas brasileiras (Lei 14.133/2021).\n" +
    "Com base no texto do edital/relatório abaixo, diga QUEM PODE PARTICIPAR desta licitação.\n" +
    "NÃO invente nomes de empresas reais nem CNPJ. Foque em critérios e perfis.\n" +
    "Responda APENAS um JSON válido (sem markdown) com este formato:\n" +
    "{\n" +
    '  "resumo": "2-3 frases sobre quem está apto a disputar",\n' +
    '  "exclusivoMeEpp": true|false|null,\n' +
    '  "criterios": ["regra objetiva 1", "regra 2"],\n' +
    '  "restricoes": ["barreira técnica/geográfica/documental"],\n' +
    '  "perfisAptos": [{"perfil":"tipo de empresa","porte":"ME/EPP|qualquer|grande","porQue":"motivo curto"}],\n' +
    '  "alertaConcorrencia": "o que torna a disputa mais/menos aberta"\n' +
    "}\n" +
    "Máximo 6 critérios, 5 restrições, 5 perfis.\n\n" +
    "Contexto:\n" +
    "- Órgão: " +
    (meta.orgao || "—") +
    "\n- Município/UF: " +
    (meta.municipio || "—") +
    " " +
    (meta.uf || "") +
    "\n- Objeto: " +
    (meta.objeto || "—") +
    "\n\nTEXTO:\n" +
    String(meta.text || "").slice(0, MAX_CHARS)
  );
}

async function callGemini(apiKey, modelName, prompt) {
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    modelName +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  var upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.25,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    }),
  });

  var upstreamJson = await upstream.json().catch(function () {
    return null;
  });
  return { ok: upstream.ok, status: upstream.status, json: upstreamJson };
}

function extractText(upstreamJson) {
  try {
    return String(
      (((upstreamJson.candidates || [])[0] || {}).content || {}).parts[0].text || ""
    ).trim();
  } catch (e) {
    return "";
  }
}

function isNotFound(upstreamJson, status) {
  if (status === 404) return true;
  var msg = String(
    (upstreamJson &&
      upstreamJson.error &&
      (upstreamJson.error.message || JSON.stringify(upstreamJson.error))) ||
      ""
  ).toLowerCase();
  return msg.indexOf("not found") !== -1 || msg.indexOf("not supported") !== -1;
}

function normalizeIa(obj) {
  obj = obj || {};
  function arrStr(v, max) {
    if (!Array.isArray(v)) return [];
    return v
      .map(function (x) {
        return String(x || "").trim();
      })
      .filter(Boolean)
      .slice(0, max || 8);
  }
  var perfis = Array.isArray(obj.perfisAptos) ? obj.perfisAptos : [];
  return {
    resumo: String(obj.resumo || "").trim().slice(0, 600),
    exclusivoMeEpp:
      typeof obj.exclusivoMeEpp === "boolean" ? obj.exclusivoMeEpp : null,
    criterios: arrStr(obj.criterios, 8),
    restricoes: arrStr(obj.restricoes, 8),
    perfisAptos: perfis
      .map(function (p) {
        if (!p) return null;
        if (typeof p === "string") {
          return { perfil: p.slice(0, 120), porte: "", porQue: "" };
        }
        return {
          perfil: String(p.perfil || p.tipo || "").trim().slice(0, 140),
          porte: String(p.porte || "").trim().slice(0, 40),
          porQue: String(p.porQue || p.motivo || "").trim().slice(0, 220),
        };
      })
      .filter(function (p) {
        return p && p.perfil;
      })
      .slice(0, 6),
    alertaConcorrencia: String(obj.alertaConcorrencia || "").trim().slice(0, 320),
  };
}

module.exports = safeJson.wrapHandler(async function handler(req, res) {
  if (req.method === "OPTIONS") {
    safeJson.applyCors(res, "POST,OPTIONS");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return safeJson.sendJson(res, 405, { ok: false, error: "Use POST" }, "POST,OPTIONS");
  }

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return safeJson.sendJson(
      res,
      500,
      {
        ok: false,
        error: "GEMINI_API_KEY not configured",
        detail: "Configure GEMINI_API_KEY na Vercel.",
      },
      "POST,OPTIONS"
    );
  }

  var body = await readBody(req);
  var text = String((body && (body.text || body.relatorio)) || "").trim();
  if (!text || text.length < 40) {
    return safeJson.sendJson(
      res,
      400,
      { ok: false, error: "Envie o texto/relatório do edital (mín. ~40 caracteres)." },
      "POST,OPTIONS"
    );
  }

  var meta = {
    text: text,
    orgao: String((body && body.orgao) || "").slice(0, 200),
    municipio: String((body && body.municipio) || "").slice(0, 120),
    uf: String((body && body.uf) || "").slice(0, 2).toUpperCase(),
    objeto: String((body && body.objeto) || "").slice(0, 400),
  };
  if (!meta.uf && meta.municipio) {
    var mUf = meta.municipio.match(/\/\s*([A-Z]{2})\b/);
    if (mUf) meta.uf = mUf[1];
  }

  var keywords = keywordList(meta.objeto, text);
  var pncpPromise = fetchPncpFornecedores({
    keywords: keywords,
    uf: meta.uf,
  });

  var preferred = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  var queue = buildModelQueue(preferred);
  var prompt = buildPrompt(meta);
  var lastErr = null;
  var parsed = null;

  for (var i = 0; i < queue.length; i++) {
    var model = queue[i];
    try {
      var result = await callGemini(apiKey, model, prompt);
      if (!result.ok) {
        if (isNotFound(result.json, result.status)) {
          lastErr = "model not found: " + model;
          continue;
        }
        lastErr =
          (result.json &&
            result.json.error &&
            (result.json.error.message || JSON.stringify(result.json.error))) ||
          ("Gemini HTTP " + result.status);
        continue;
      }
      var rawText = extractText(result.json);
      parsed = extractJsonObject(rawText) || extractJsonObject(JSON.stringify(result.json));
      if (!parsed) {
        lastErr = "IA não retornou JSON válido";
        continue;
      }
      break;
    } catch (e) {
      lastErr = (e && e.message) || String(e);
    }
  }

  if (!parsed) {
    return safeJson.sendJson(
      res,
      502,
      { ok: false, error: lastErr || "Falha na análise de participantes." },
      "POST,OPTIONS"
    );
  }

  var ia = normalizeIa(parsed);
  var empresasPncp = [];
  try {
    empresasPncp = await pncpPromise;
  } catch (e) {
    empresasPncp = [];
  }

  return safeJson.sendJson(
    res,
    200,
    {
      ok: true,
      resumo: ia.resumo,
      exclusivoMeEpp: ia.exclusivoMeEpp,
      criterios: ia.criterios,
      restricoes: ia.restricoes,
      perfisAptos: ia.perfisAptos,
      alertaConcorrencia: ia.alertaConcorrencia,
      empresasPncp: empresasPncp,
      keywordsUsadas: keywords,
      aviso:
        "Isto não é a lista oficial de inscritos. São critérios do edital + perfis aptos e, quando houver, fornecedores com contratos semelhantes no PNCP.",
    },
    "POST,OPTIONS"
  );
}, "POST,OPTIONS");
