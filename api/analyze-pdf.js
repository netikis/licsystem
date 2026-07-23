/**
 * POST /api/analyze-pdf
 * Análise de edital com Google Gemini.
 * A GEMINI_API_KEY fica APENAS em process.env (Vercel / .env) — nunca no frontend.
 *
 * Body JSON: { text: string, filename?: string }
 * Resposta: { modalidade, abrangencia, valor_estimado, total_produtos, resumo_objeto }
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

var MAX_CHARS = 120000;

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function json(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === "object") {
      return resolve(req.body);
    }
    if (typeof req.body === "string" && req.body) {
      try {
        return resolve(JSON.parse(req.body));
      } catch (e) {
        return reject(new Error("JSON inválido"));
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
        reject(new Error("JSON inválido"));
      }
    });
    req.on("error", reject);
  });
}

function extractJson(text) {
  var raw = String(text || "").trim();
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Resposta da IA não contém JSON válido");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeResult(obj) {
  obj = obj || {};
  var valor = obj.valor_estimado;
  if (typeof valor === "number") {
    valor = valor.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  } else if (valor == null) {
    valor = "";
  } else {
    valor = String(valor);
  }

  var total = obj.total_produtos;
  if (total == null || total === "") total = "";
  else total = String(total);

  return {
    modalidade: String(obj.modalidade || "").trim(),
    abrangencia: String(obj.abrangencia || "").trim(),
    valor_estimado: valor,
    total_produtos: total,
    resumo_objeto: String(obj.resumo_objeto || "").trim(),
  };
}

function buildPrompt(filename, text) {
  return [
    "Você é um analista especialista em licitações públicas brasileiras.",
    "Analise o texto do edital abaixo e responda SOMENTE com um JSON válido (sem markdown, sem comentários), no formato:",
    '{',
    '  "modalidade": "string (ex.: Pregão Eletrônico, Concorrência, Dispensa, Tomada de Preços)",',
    '  "abrangencia": "string (ex.: Municipal, Estadual, Federal, Consórcio — cite UF/cidade se houver)",',
    '  "valor_estimado": "string em R$ ou número; se não houver, string vazia",',
    '  "total_produtos": "número estimado de itens/produtos do objeto ou string vazia",',
    '  "resumo_objeto": "resumo claro e objetivo do objeto da licitação em até 600 caracteres"',
    "}",
    "",
    "Arquivo: " + (filename || "edital.pdf"),
    "--- TEXTO DO EDITAL ---",
    text,
  ].join("\n");
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed" });
  }

  var apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, {
      error: "GEMINI_API_KEY não configurada",
      detail: "Defina a chave no .env local ou nas Environment Variables da Vercel.",
    });
  }

  var body;
  try {
    body = await readBody(req);
  } catch (e) {
    return json(res, 400, { error: e.message || "Body inválido" });
  }

  var text = String((body && body.text) || "").trim();
  var filename = String((body && body.filename) || "edital.pdf").slice(0, 200);
  if (!text || text.length < 40) {
    return json(res, 400, {
      error: "Texto do edital insuficiente",
      detail: "Envie o texto extraído do PDF (mín. ~40 caracteres).",
    });
  }

  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS) + "\n\n[...texto truncado pelo servidor...]";
  }

  var modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

  try {
    var genAI = new GoogleGenerativeAI(apiKey);
    var model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
      },
    });

    var result = await model.generateContent(buildPrompt(filename, text));
    var response = await result.response;
    var rawText = "";
    try {
      rawText = response.text();
    } catch (e) {
      rawText = "";
    }

    if (!rawText) {
      return json(res, 502, {
        error: "Resposta vazia do Gemini",
        model: modelName,
      });
    }

    var parsed = normalizeResult(extractJson(rawText));
    return json(res, 200, {
      ok: true,
      model: modelName,
      data: parsed,
      // espelha no root para o frontend preencher direto
      modalidade: parsed.modalidade,
      abrangencia: parsed.abrangencia,
      valor_estimado: parsed.valor_estimado,
      total_produtos: parsed.total_produtos,
      resumo_objeto: parsed.resumo_objeto,
    });
  } catch (err) {
    var msg = (err && err.message) || String(err);
    return json(res, 502, {
      error: "Falha na análise com Gemini",
      detail: msg,
      model: modelName,
    });
  }
};
