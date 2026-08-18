/**
 * POST /api/analyze-pdf
 * Relatório completo de edital em Markdown (Lei 14.133/2021).
 * HTTP fetch nativo — sem SDK.
 * Retorna { relatorio: "...", documentosExigidos: [{ nome, tipo, obs }] }.
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
    "Aja como um especialista em licitações públicas brasileiras. Leia o texto do edital a seguir e entregue um relatório completo, formatado em Markdown, dividido estritamente nos seguintes 11 tópicos (considerando a Lei 14.133/2021): 1. Informações Gerais, 2. Cronograma Completo, 3. Exigências de Habilitação, 4. Especificações do Objeto, 5. Regras de Proposta Comercial, 6. Critérios de Julgamento, 7. Penalidades e Riscos, 8. Condições de Entrega e Execução, 9. Contrato ou Ata, 10. Checklist Final, 11. Resumo Simples. Finalize com um alerta dos 3 maiores riscos e como evitar desclassificação.\n\n" +
    "AO FINAL do relatório Markdown (depois de tudo), inclua OBRIGATORIAMENTE um único bloco de código JSON (cercado por ```json ... ```) com a lista estruturada de documentos exigidos pelo edital (habilitação jurídica, fiscal, econômico-financeira, técnica, declarações, atestados, etc.). Use exatamente este formato:\n" +
    '```json\n{"documentosExigidos":[{"nome":"Nome do documento","tipo":"habilitacao|tecnica|outro","obs":"detalhe opcional do edital"}]}\n```\n' +
    "Liste cada documento de forma objetiva (um item por documento). Se o edital não deixar claro, inclua os mais prováveis com obs explicando a incerteza. Não invente números de artigos se não estiverem no texto.\n\n" +
    "TEXTO DO EDITAL: " +
    texto
  );
}

function normalizeDocTipo(tipo) {
  var t = String(tipo || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (t.indexOf("tecnic") !== -1) return "tecnica";
  if (
    t.indexOf("habilit") !== -1 ||
    t.indexOf("jurid") !== -1 ||
    t.indexOf("fiscal") !== -1 ||
    t.indexOf("econom") !== -1
  ) {
    return "habilitacao";
  }
  return "outro";
}

function normalizeDocumentosExigidos(list) {
  if (!Array.isArray(list)) return [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (!item) continue;
    var nome =
      typeof item === "string"
        ? item.trim()
        : String(item.nome || item.name || item.documento || "").trim();
    if (!nome || nome.length < 2) continue;
    var key = nome.toLowerCase().replace(/\s+/g, " ");
    if (seen[key]) continue;
    seen[key] = true;
    out.push({
      nome: nome.slice(0, 220),
      tipo: normalizeDocTipo(item.tipo || item.type || "outro"),
      obs: String(item.obs || item.observacao || item.detalhe || "").trim().slice(0, 400),
    });
  }
  return out.slice(0, 80);
}

/**
 * Extrai bloco JSON final com documentosExigidos e remove do Markdown.
 * @returns {{ relatorio: string, documentosExigidos: Array }}
 */
function splitRelatorioAndDocs(rawText) {
  var text = String(rawText || "").trim();
  var documentosExigidos = [];
  var relatorio = text;

  function tryParseJson(chunk) {
    try {
      var obj = JSON.parse(chunk);
      if (obj && Array.isArray(obj.documentosExigidos)) {
        return normalizeDocumentosExigidos(obj.documentosExigidos);
      }
      if (Array.isArray(obj)) {
        return normalizeDocumentosExigidos(obj);
      }
    } catch (e) {}
    return null;
  }

  // Prefer last fenced ```json ... ``` block
  var fenceRe = /```(?:json)?\s*([\s\S]*?)```/gi;
  var m;
  var last = null;
  while ((m = fenceRe.exec(text))) {
    last = m;
  }
  if (last) {
    var parsed = tryParseJson(String(last[1] || "").trim());
    if (parsed && parsed.length) {
      documentosExigidos = parsed;
      relatorio = (text.slice(0, last.index) + text.slice(last.index + last[0].length)).trim();
      return { relatorio: relatorio, documentosExigidos: documentosExigidos };
    }
  }

  // Fallback: trailing raw JSON object
  var brace = text.lastIndexOf('{"documentosExigidos"');
  if (brace === -1) brace = text.lastIndexOf('{ "documentosExigidos"');
  if (brace !== -1) {
    var tail = text.slice(brace).trim();
    var parsedTail = tryParseJson(tail);
    if (parsedTail && parsedTail.length) {
      documentosExigidos = parsedTail;
      relatorio = text.slice(0, brace).trim();
    }
  }

  return { relatorio: relatorio, documentosExigidos: documentosExigidos };
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

function callGemini(apiKey, modelName, prompt) {
  return callGeminiParts(apiKey, modelName, [{ text: prompt }], {
    temperature: 0.3,
    maxOutputTokens: 8192
  });
}

async function callGeminiParts(apiKey, modelName, parts, generationConfig) {
  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    modelName +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  var upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: parts }],
      generationConfig: generationConfig || {
        temperature: 0.3,
        maxOutputTokens: 8192
      }
    })
  });

  var upstreamJson = await upstream.json().catch(function () {
    return null;
  });

  return { ok: upstream.ok, status: upstream.status, json: upstreamJson };
}

function parseBrNum(v) {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  var s = String(v).trim();
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s) || (s.indexOf(".") >= 0 && s.indexOf(",") >= 0)) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    s = s.replace(/\./g, "");
  } else if (/,\d+$/.test(s)) {
    s = s.replace(/\./g, "").replace(",", ".");
  }
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}

function normalizeItens(list) {
  if (!Array.isArray(list)) return [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var it = list[i] || {};
    var lote = String(
      it.lote != null ? it.lote : it.item != null ? it.item : it.n != null ? it.n : ""
    ).trim();
    var produto = String(it.produto || it.descricao || it.especificacao || "")
      .replace(/\s+/g, " ")
      .trim();
    var und = String(it.und || it.unidade || "UN").trim().toUpperCase() || "UN";
    var qtd = parseBrNum(it.qtd != null ? it.qtd : it.quantidade);
    var vu = parseBrNum(
      it.editalVunit != null
        ? it.editalVunit
        : it.unitario != null
          ? it.unitario
          : it.precoUnitario
    );
    var vt = parseBrNum(
      it.editalTotal != null ? it.editalTotal : it.total != null ? it.total : it.precoTotal
    );
    if (!lote) lote = String(out.length + 1);
    if (!(qtd > 0) || !produto || produto.length < 3) continue;
    if (!(vt > 0) && vu > 0) vt = Math.round(vu * qtd * 100) / 100;
    out.push({
      lote: lote.slice(0, 20),
      qtd: qtd,
      und: und.slice(0, 12),
      produto: produto.slice(0, 500),
      editalVunit: vu,
      editalTotal: vt
    });
  }
  return out.slice(0, 400);
}

function extractJsonObject(raw) {
  var text = String(raw || "").trim();
  var fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fence) text = String(fence[1] || "").trim();
  try {
    return JSON.parse(text);
  } catch (e) {}
  var start = text.indexOf("{");
  var end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch (e2) {}
  }
  return null;
}

function buildExtractItensPrompt(textHint, filename) {
  return (
    "Você é extrator de planilha de edital de licitação (Brasil).\n" +
    "Analise a(s) imagem(ns) da tabela de itens (e o texto auxiliar, se houver) e devolva APENAS JSON válido:\n" +
    '{"itens":[{"lote":"1","qtd":8,"und":"UN","produto":"descrição curta com cota se houver","editalVunit":2603.09,"editalTotal":20824.72}]}\n' +
    "Regras:\n" +
    "- Um objeto por item/linha da tabela.\n" +
    "- qtd/editalVunit/editalTotal em número (ponto decimal).\n" +
    "- Quantidade 8,000 no edital = 8 (três casas = decimal BR de unidade).\n" +
    "- Inclua COTA RESERVADA / COTA PRINCIPAL / ME/EPP no produto quando existir.\n" +
    "- Não invente itens que não estejam na tabela.\n" +
    "- Arquivo: " +
    String(filename || "edital.pdf").slice(0, 120) +
    "\n" +
    "- Texto auxiliar:\n" +
    String(textHint || "").slice(0, 6000)
  );
}

async function handleExtractItens(req, res, apiKey, body) {
  var textHint = String((body && (body.textHint || body.text)) || "").trim();
  var filename = String((body && body.filename) || "edital.pdf").slice(0, 200);
  var images = Array.isArray(body && body.images) ? body.images : [];
  images = images
    .filter(function (img) {
      return img && img.data && String(img.data).length > 80;
    })
    .slice(0, 4);

  if (!images.length && textHint.length < 40) {
    return send(res, 400, {
      error: "Insufficient input",
      detail: "Send page images (base64) and/or textHint."
    });
  }

  var parts = [{ text: buildExtractItensPrompt(textHint, filename) }];
  for (var i = 0; i < images.length; i++) {
    var mime = String(images[i].mimeType || "image/jpeg");
    if (mime !== "image/png" && mime !== "image/jpeg" && mime !== "image/webp") {
      mime = "image/jpeg";
    }
    parts.push({
      inline_data: {
        mime_type: mime,
        data: String(images[i].data).replace(/^data:[^;]+;base64,/, "")
      }
    });
  }

  var queue = buildModelQueue(process.env.GEMINI_MODEL || DEFAULT_MODEL);
  var tried = [];
  var lastDetail = "";

  for (var m = 0; m < queue.length; m++) {
    var modelName = queue[m];
    tried.push(modelName);
    var result = await callGeminiParts(apiKey, modelName, parts, {
      temperature: 0.1,
      maxOutputTokens: 8192,
      responseMimeType: "application/json"
    });
    if (result.ok) {
      var raw = extractTextFromGeminiResponse(result.json);
      var obj = extractJsonObject(raw);
      var itens = normalizeItens(obj && (obj.itens || obj.items || obj));
      if (!itens.length) {
        lastDetail = "Model returned no parsable items (" + modelName + ")";
        continue;
      }
      return send(res, 200, {
        ok: true,
        mode: "extract-itens",
        model: modelName,
        tried: tried,
        filename: filename,
        itens: itens
      });
    }
    lastDetail =
      (result.json &&
        result.json.error &&
        (result.json.error.message || JSON.stringify(result.json.error))) ||
      "Gemini HTTP " + result.status;
    if (isNotFoundPayload(result.json, result.status)) continue;
    return send(res, 502, {
      error: "Gemini request failed",
      detail: lastDetail,
      model: modelName,
      tried: tried
    });
  }

  return send(res, 502, {
    error: "No Gemini model returned items",
    detail: lastDetail || "empty",
    tried: tried
  });
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
    var mode = String((body && body.mode) || "").toLowerCase();
    var hasImages = Array.isArray(body && body.images) && body.images.length > 0;
    if (mode === "extract-itens" || mode === "itens" || hasImages) {
      return await handleExtractItens(req, res, apiKey, body);
    }

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
        var split = splitRelatorioAndDocs(respostaIA);
        return send(res, 200, {
          ok: true,
          model: usedModel,
          tried: tried,
          filename: filename,
          relatorio: split.relatorio || respostaIA,
          documentosExigidos: split.documentosExigidos || [],
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
