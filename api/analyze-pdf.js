/**
 * POST /api/analyze-pdf
 * Analyzes edital text with Google Gemini (@google/generative-ai).
 * GEMINI_API_KEY stays only in process.env (never in the frontend).
 */
const { GoogleGenerativeAI } = require("@google/generative-ai");

var MAX_CHARS = 150000;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
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

function extractJson(text) {
  var raw = String(text || "").trim();
  var fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) raw = fence[1].trim();
  var start = raw.indexOf("{");
  var end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("AI response is not valid JSON");
  }
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeResult(obj) {
  obj = obj || {};
  var valor = obj.valor_estimado;
  if (typeof valor === "number") {
    valor = valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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

/**
 * Model id for getGenerativeModel({ model }) — NEVER include "models/" prefix.
 * SDK / REST path adds that automatically.
 */
function normalizeModelId(name) {
  var m = String(name || "gemini-1.5-flash-latest").trim();
  if (m.toLowerCase().indexOf("models/") === 0) {
    m = m.slice(7);
  }
  // Alias legado ? versão compatível com v1beta
  if (m === "gemini-1.5-flash") {
    m = "gemini-1.5-flash-latest";
  }
  return m;
}

function buildPrompt(filename, text) {
  return [
    "Voce e um analista especialista em licitacoes publicas brasileiras.",
    "Analise o texto do edital abaixo e responda SOMENTE com um JSON valido (sem markdown), no formato:",
    "{",
    '  "modalidade": "string",',
    '  "abrangencia": "string",',
    '  "valor_estimado": "string em R$ ou vazio",',
    '  "total_produtos": "numero ou vazio",',
    '  "resumo_objeto": "resumo do objeto em ate 600 caracteres"',
    "}",
    "",
    "Arquivo: " + (filename || "edital.pdf"),
    "--- TEXTO DO EDITAL ---",
    text,
  ].join("\n");
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
      return res.end();
    }

    if (req.method !== "POST") {
      return send(res, 405, { error: "Method not allowed" });
    }

    var apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return send(res, 500, {
        error: "GEMINI_API_KEY not configured",
        detail: "Set GEMINI_API_KEY in Vercel Environment Variables.",
      });
    }

    var body = await readBody(req);
    var text = String((body && body.text) || "").trim();
    var filename = String((body && body.filename) || "edital.pdf").slice(0, 200);

    if (!text || text.length < 40) {
      return send(res, 400, {
        error: "Insufficient edital text",
        detail: "Send extracted PDF text (min ~40 chars).",
      });
    }

    if (text.length > MAX_CHARS) {
      text = text.substring(0, MAX_CHARS) + "\n\n[...truncated...]";
    }

    var modelName = normalizeModelId(
      process.env.GEMINI_MODEL || "gemini-1.5-flash-latest"
    );

    var genAI = new GoogleGenerativeAI(apiKey);
    var model = genAI.getGenerativeModel({
      model: modelName, // exatamente "gemini-1.5-flash-latest" — sem "models/"
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
      return send(res, 502, { error: "Empty Gemini response", model: modelName });
    }

    var parsed = normalizeResult(extractJson(rawText));
    return send(res, 200, {
      ok: true,
      model: modelName,
      data: parsed,
      modalidade: parsed.modalidade,
      abrangencia: parsed.abrangencia,
      valor_estimado: parsed.valor_estimado,
      total_produtos: parsed.total_produtos,
      resumo_objeto: parsed.resumo_objeto,
    });
  } catch (err) {
    var msg = (err && err.message) || String(err);
    return send(res, 502, {
      error: "Gemini request failed",
      detail: msg,
      model: normalizeModelId(process.env.GEMINI_MODEL || "gemini-1.5-flash-latest"),
    });
  }
};
