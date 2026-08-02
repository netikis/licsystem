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

/**
 * Gera (ou reutiliza em cache) access_token via client_credentials.
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  var cred = getCredentials();
  if (!cred.appId || !cred.secret) {
    var missing = new Error(
      "ML_APP_ID e/ou ML_CLIENT_SECRET ausentes nas Environment Variables da Vercel."
    );
    missing.status = 500;
    missing.code = "ml_credentials_missing";
    throw missing;
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
    err.status = r.status || 502;
    err.code = "ml_token_failed";
    err.body = j;
    throw err;
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
    throw new Error("access_token obrigatório para Authorization: Bearer");
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
};
