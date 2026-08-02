/**
 * OAuth2 Client Credentials — Mercado Livre
 * POST https://api.mercadolibre.com/oauth/token
 * grant_type=client_credentials + client_id + client_secret
 */

var _cache = { token: "", expiresAt: 0 };

function env(key) {
  return String(process.env[key] || "").trim();
}

function getCredentials() {
  return {
    appId: env("ML_APP_ID") || env("MERCADOLIBRE_APP_ID"),
    secret: env("ML_CLIENT_SECRET") || env("MERCADOLIBRE_CLIENT_SECRET"),
  };
}

function attachMlError(err, fields) {
  fields = fields || {};
  err.endpoint = fields.endpoint || err.endpoint || "";
  err.status = fields.status != null ? fields.status : err.status;
  err.body = fields.body !== undefined ? fields.body : err.body;
  err.rawBody =
    fields.rawBody !== undefined
      ? fields.rawBody
      : err.rawBody != null
        ? err.rawBody
        : "";
  err.code = fields.code || err.code;
  return err;
}

/**
 * Gera (ou reutiliza em cache) access_token via client_credentials.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  var cred = getCredentials();
  if (!cred.appId || !cred.secret) {
    throw attachMlError(
      new Error(
        "ML_APP_ID e/ou ML_CLIENT_SECRET ausentes nas Environment Variables da Vercel."
      ),
      {
        endpoint: "/oauth/token",
        status: 500,
        body: {
          error: "ml_credentials_missing",
          message:
            "Cadastre ML_APP_ID e ML_CLIENT_SECRET na Vercel (Environment Variables).",
        },
        rawBody: "",
        code: "ml_credentials_missing",
      }
    );
  }

  var now = Date.now();
  if (_cache.token && _cache.expiresAt > now + 60000) {
    return _cache.token;
  }

  var body =
    "grant_type=client_credentials" +
    "&client_id=" +
    encodeURIComponent(cred.appId) +
    "&client_secret=" +
    encodeURIComponent(cred.secret);

  var r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body,
  });

  var text = await r.text();
  var j = null;
  try {
    j = text ? JSON.parse(text) : null;
  } catch (e) {
    j = null;
  }

  if (!r.ok || !j || !j.access_token) {
    var err = new Error(
      (j && (j.message || j.error_description || j.error)) ||
        "Falha ao obter access_token ML (HTTP " + r.status + ")"
    );
    throw attachMlError(err, {
      endpoint: "/oauth/token",
      status: r.status || 502,
      body: j != null ? j : { raw: String(text || "").slice(0, 2000) },
      rawBody: String(text || "").slice(0, 4000),
      code: "ml_token_failed",
    });
  }

  var expiresIn = Number(j.expires_in) || 21600;
  _cache.token = String(j.access_token);
  _cache.expiresAt = now + expiresIn * 1000;
  return _cache.token;
}

/** Força novo token (ex.: após 401 na busca). */
function clearTokenCache() {
  _cache.token = "";
  _cache.expiresAt = 0;
}

function authHeaders(token) {
  if (!token) {
    throw attachMlError(
      new Error("access_token obrigatório para Authorization: Bearer"),
      {
        endpoint: "/sites/MLB/search",
        status: 500,
        body: { error: "missing_access_token" },
        rawBody: "",
        code: "ml_token_empty",
      }
    );
  }
  return {
    Accept: "application/json",
    Authorization: "Bearer " + token,
  };
}

module.exports = {
  getCredentials: getCredentials,
  getAccessToken: getAccessToken,
  clearTokenCache: clearTokenCache,
  authHeaders: authHeaders,
  attachMlError: attachMlError,
};
