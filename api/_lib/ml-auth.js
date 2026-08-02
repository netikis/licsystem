/**
 * Token de aplicativo Mercado Livre (OAuth client_credentials).
 * Usa ML_APP_ID + ML_CLIENT_SECRET (somente backend / Vercel — nunca VITE_).
 */

var _cache = { token: "", expiresAt: 0 };

function env(key) {
  return String(process.env[key] || "").trim();
}

function getCredentials() {
  return {
    appId: env("ML_APP_ID") || env("MERCADOLIBRE_APP_ID"),
    secret: env("ML_CLIENT_SECRET") || env("MERCADOLIBRE_CLIENT_SECRET"),
    accessToken: env("ML_ACCESS_TOKEN"),
  };
}

/**
 * @returns {Promise<string>} Bearer token ou "" se indisponível
 */
async function getAccessToken() {
  var cred = getCredentials();
  if (cred.accessToken) return cred.accessToken;

  if (!cred.appId || !cred.secret) return "";

  var now = Date.now();
  if (_cache.token && _cache.expiresAt > now + 60000) {
    return _cache.token;
  }

  var body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: cred.appId,
    client_secret: cred.secret,
  });

  var r = await fetch("https://api.mercadolibre.com/oauth/token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
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
        "Falha ao obter token ML (HTTP " + r.status + ")"
    );
    err.status = r.status;
    err.body = j;
    throw err;
  }

  var expiresIn = Number(j.expires_in) || 21600;
  _cache.token = String(j.access_token);
  _cache.expiresAt = now + expiresIn * 1000;
  return _cache.token;
}

function authHeaders(token) {
  var h = { Accept: "application/json" };
  if (token) h.Authorization = "Bearer " + token;
  return h;
}

module.exports = {
  getCredentials: getCredentials,
  getAccessToken: getAccessToken,
  authHeaders: authHeaders,
};
