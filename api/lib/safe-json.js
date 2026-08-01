/**
 * Respostas JSON seguras para serverless Vercel.
 * Nunca deixar exceção virar HTML "An error occurred...".
 */

function applyCors(res, methods) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    methods || "GET,POST,OPTIONS"
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function sendJson(res, status, body, methods) {
  try {
    if (res.headersSent) return;
    applyCors(res, methods);
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify(body != null ? body : { ok: false, error: "empty" }));
  } catch (e) {
    try {
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(
          JSON.stringify({
            ok: false,
            error: "Falha ao serializar resposta JSON",
          })
        );
      }
    } catch (e2) {}
  }
}

/**
 * Envolve handler async: qualquer throw → JSON 500 { ok:false, error }.
 */
function wrapHandler(handler, methods) {
  return async function safeHandler(req, res) {
    try {
      await handler(req, res);
    } catch (err) {
      sendJson(
        res,
        500,
        {
          ok: false,
          error:
            (err && err.message) ||
            String(err || "Erro interno na função serverless"),
        },
        methods
      );
    }
  };
}

module.exports = {
  applyCors: applyCors,
  sendJson: sendJson,
  wrapHandler: wrapHandler,
};
