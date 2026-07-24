/**
 * POST /api/analyze-pdf
 * Relatório completo de edital em Markdown (Lei 14.133/2021).
 * HTTP fetch nativo — sem SDK. Retorna { relatorio: "..." }.
 */
var MAX_CHARS = 150000;
var DEFAULT_MODEL = "gemini-2.5-flash-lite";

var MODEL_FALLBACKS = [
  "gemini-2.5-flash-lite",
  "gemini-flash-lite-latest",
  "gemini-2.5-flash",
  "gemini-flash-latest",
  "gemini-3.1-flash-lite",
  "gemini-3.6-flash",
];

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

function normalizeModelId(name) {
  var m = String(name || DEFAULT_MODEL).trim();
  if (m.toLowerCase().indexOf("models/") === 0) m = m.slice(7);
  var retired = {
    "gemini-1.5-flash": "gemini-2.5-flash-lite",
    "gemini-1.5-flash-latest": "gemini-2.5-flash-lite",
    "gemini-1.5-pro": "gemini-2.5-flash",
    "gemini-1.5-pro-latest": "gemini-2.5-flash",
    "gemini-2.0-flash": "gemini-2.5-flash",
    "gemini-2.0-flash-lite": "gemini-2.5-flash-lite",
  };
  if (retired[m]) m = retired[m];
  return m;
}

function buildPrompt(textoExtraido) {
  var texto = String(textoExtraido || "").substring(0, MAX_CHARS);
  return (
    "Aja como um especialista em licitações públicas brasileiras. Leia o texto do edital a seguir e entregue um relatório completo, formatado em Markdown, dividido estritamente nos seguintes 11 tópicos (considerando a Lei 14.133/2021): 1. Informações Gerais, 2. Cronograma Completo, 3. Exigências de Habilitação, 4. Especificações do Objeto, 5. Regras de Proposta Comercial, 6. Critérios de Julgamento, 7. Penalidades e Riscos, 8. Condições de Entrega e Execução, 9. Contrato ou Ata, 10. Checklist Final, 11. Resumo Simples. Finalize com um alerta dos 3 maiores riscos e como evitar desclassificação. TEXTO DO EDITAL: " +
    texto
  );
}

function extractTextFromGeminiResponse(upstreamJson) {
  try {
    return String(
      (((upstreamJson.candidates || [])[0] || {}).content || {}).parts[0].text || ""
    ).trim();
  } catch (e) {
    try {
      var parts = upstreamJson.candidates[0].content.parts || [];
      return parts
        .map(function (p) {
          return p.text || "";
        })
        .join("")
        .trim();
    } catch (e2) {
      return "";
    }
  }
}

function isNotFoundPayload(upstreamJson, status) {
  if (status === 404) return true;
  var msg = String(
    (upstreamJson &&
      upstreamJson.error &&
      (upstreamJson.error.message || JSON.stringify(upstreamJson.error))) ||
      ""
  ).toLowerCase();
  return msg.indexOf("not found") !== -1 || msg.indexOf("not supported") !== -1;
}

function buildModelQueue(preferred) {
  var first = normalizeModelId(preferred);
  var queue = [first];
  for (var i = 0; i < MODEL_FALLBACKS.length; i++) {
    if (queue.indexOf(MODEL_FALLBACKS[i]) === -1) queue.push(MODEL_FALLBACKS[i]);
  }
  return queue;
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
        temperature: 0.3,
        maxOutputTokens: 8192,
      },
    }),
  });

  var upstreamJson = await upstream.json().catch(function () {
    return null;
  });

  return { ok: upstream.ok, status: upstream.status, json: upstreamJson };
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
    var textoExtraido = String((body && body.text) || "").trim();
    var filename = String((body && body.filename) || "edital.pdf").slice(0, 200);

    if (!textoExtraido || textoExtraido.length < 40) {
      return send(res, 400, {
        error: "Insufficient edital text",
        detail: "Send extracted PDF text (min ~40 chars).",
      });
    }

    var preferred = process.env.GEMINI_MODEL || DEFAULT_MODEL;
    var queue = buildModelQueue(preferred);
    var prompt = buildPrompt(textoExtraido);
    var tried = [];
    var lastDetail = "";
    var usedModel = queue[0];

    for (var i = 0; i < queue.length; i++) {
      var modelName = queue[i];
      tried.push(modelName);
      var result = await callGemini(apiKey, modelName, prompt);

      if (result.ok) {
        var respostaIA = extractTextFromGeminiResponse(result.json);
        if (!respostaIA) {
          lastDetail = "Empty Gemini response from " + modelName;
          continue;
        }
        usedModel = modelName;
        return send(res, 200, {
          ok: true,
          model: usedModel,
          tried: tried,
          filename: filename,
          relatorio: respostaIA,
        });
      }

      lastDetail =
        (result.json &&
          result.json.error &&
          (result.json.error.message || JSON.stringify(result.json.error))) ||
        ("Gemini HTTP " + result.status);

      if (isNotFoundPayload(result.json, result.status)) continue;

      return send(res, 502, {
        error: "Gemini request failed",
        detail: lastDetail,
        model: modelName,
        tried: tried,
        status: result.status,
      });
    }

    return send(res, 502, {
      error: "Gemini request failed",
      detail: lastDetail || "Nenhum modelo Gemini disponivel",
      model: usedModel,
      tried: tried,
      hint: "Na Vercel use GEMINI_MODEL=gemini-2.5-flash-lite",
    });
  } catch (err) {
    return send(res, 500, {
      error: "analyze_pdf_crash",
      detail: (err && err.message) || String(err),
      model: normalizeModelId(process.env.GEMINI_MODEL || DEFAULT_MODEL),
    });
  }
};
