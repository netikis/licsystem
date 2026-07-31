/**
 * POST /api/chat-editais
 * Interpreta pergunta em português (Gemini se GEMINI_API_KEY existir; senão parser local)
 * e consulta editais abertos no PNCP via a mesma lógica de /api/editais-chat.
 *
 * Body JSON: { mensagem: "Quais licitações terão em Ibaiti" }
 * Opcional: { categoria, ampliar, esferas, limite }
 */
var queryLib = require("./lib/editais-query");

var DEFAULT_MODEL = "gemini-2.5-flash-lite";

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

function extractJsonObject(text) {
  var s = String(text || "");
  var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1];
  var start = s.indexOf("{");
  var end = s.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(s.slice(start, end + 1));
  } catch (e) {
    return null;
  }
}

async function interpretWithGemini(apiKey, mensagem) {
  var model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  var prompt =
    "Você extrai parâmetros para busca de editais no PNCP (Brasil).\n" +
    "Responda APENAS um JSON válido, sem markdown:\n" +
    '{"regiao":"norte-pioneiro"|null,"municipio":"nome ou null","categorias":["reforma"|"comida"|"cestas"|"cafe"|"natal"|"eletro"],"keywords":["..."]}\n' +
    "Regras: se mencionar Norte Pioneiro / AMUNORPI, regiao=norte-pioneiro e municipio=null. " +
    "Categorias só se o usuário pedir. Não invente município.\n\nPergunta: " +
    String(mensagem || "").slice(0, 2000);

  var url =
    "https://generativelanguage.googleapis.com/v1beta/models/" +
    encodeURIComponent(model) +
    ":generateContent?key=" +
    encodeURIComponent(apiKey);

  var r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
    }),
  });
  var j = await r.json().catch(function () {
    return null;
  });
  if (!r.ok) {
    var err = new Error(
      (j && j.error && j.error.message) || "Gemini HTTP " + r.status
    );
    err.status = 502;
    throw err;
  }
  var text = "";
  try {
    text = j.candidates[0].content.parts
      .map(function (p) {
        return p.text || "";
      })
      .join("");
  } catch (e) {
    text = "";
  }
  return extractJsonObject(text);
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Use POST" });
  }

  try {
    var body = await readBody(req);
    var mensagem = String(
      body.mensagem || body.pergunta || body.text || body.q || ""
    ).trim();
    if (!mensagem) {
      return json(res, 400, {
        ok: false,
        error: 'Envie { "mensagem": "Quais licitações terão em Ibaiti" }',
      });
    }

    var opts = {
      mensagem: mensagem,
      categoria: body.categoria || body.categorias,
      q: body.keywords,
      ampliar: body.ampliar || body.extra,
      esferas: body.esferas,
      limite: body.limite || body.limit,
      municipio: body.municipio,
      ibge: body.ibge,
      regiao: body.regiao,
      janela: body.janela || body.janelaTipo || body.horizonte,
      dias: body.dias != null ? body.dias : body.janelaDias,
    };

    var interpreter = "local";
    var apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && String(body.forceLocal || "") !== "1") {
      try {
        var ai = await interpretWithGemini(apiKey, mensagem);
        if (ai && typeof ai === "object") {
          interpreter = "gemini";
          if (ai.regiao) opts.regiao = ai.regiao;
          if (ai.municipio) opts.municipio = ai.municipio;
          if (Array.isArray(ai.categorias) && ai.categorias.length) {
            opts.categoria = ai.categorias.join(",");
          }
          if (Array.isArray(ai.keywords) && ai.keywords.length) {
            opts.q = ai.keywords.join(",");
          }
          // Se Gemini preencheu escopo, evita re-parse ambíguo
          if (opts.regiao || opts.municipio) {
            opts.mensagem = "";
          }
        }
      } catch (e) {
        interpreter = "local-fallback";
        opts.mensagem = mensagem;
      }
    }

    var result = await queryLib.queryEditais(opts);
    result.interpreter = interpreter;
    return json(res, 200, result);
  } catch (err) {
    var status = err.status || 500;
    return json(res, status, {
      ok: false,
      error: err.message || String(err),
    });
  }
};
