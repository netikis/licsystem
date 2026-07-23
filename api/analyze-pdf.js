/**
 * POST /api/analyze-pdf
 * Analyzes edital text with Google Gemini REST API.
 * GEMINI_API_KEY stays only in process.env (never in the frontend).
 * No npm dependency ù uses native fetch.
 */
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

    var modelName = process.env.GEMINI_MODEL || "gemini-1.5-flash";
    var url =
      "https://generativelanguage.googleapis.com/v1beta/models/" +
      encodeURIComponent(modelName) +
      ":generateContent?key=" +
      encodeURIComponent(apiKey);

    var upstream = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: buildPrompt(filename, text) }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    });

    var upstreamJson = await upstream.json().catch(function () {
      return null;
    });

    if (!upstream.ok) {
      var detail =
        (upstreamJson &&
          upstreamJson.error &&
          (upstreamJson.error.message || JSON.stringify(upstreamJson.error))) ||
        ("Gemini HTTP " + upstream.status);
      return send(res, 502, {
        error: "Gemini request failed",
        detail: detail,
        model: modelName,
      });
    }

    var rawText = "";
    try {
      rawText =
        upstreamJson.candidates[0].content.parts
          .map(function (p) {
            return p.text || "";
          })
          .join("");
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
    return send(res, 500, {
      error: "analyze_pdf_crash",
      detail: (err && err.message) || String(err),
    });
  }
};
