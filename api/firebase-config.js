/**
 * GET /api/firebase-config
 * Returns Firebase web config from process.env (Vercel Environment Variables).
 * Aceita FIREBASE_* ou VITE_FIREBASE_* (espelho do frontend Vite).
 */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function env(key) {
  return process.env[key] || process.env["VITE_" + key] || "";
}

module.exports = function handler(req, res) {
  try {
    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
      return res.end();
    }

    if (req.method !== "GET") {
      return send(res, 405, { error: "Method not allowed" });
    }

    var cfg = {
      apiKey: env("FIREBASE_API_KEY"),
      authDomain: env("FIREBASE_AUTH_DOMAIN"),
      databaseURL: env("FIREBASE_DATABASE_URL"),
      projectId: env("FIREBASE_PROJECT_ID"),
      storageBucket: env("FIREBASE_STORAGE_BUCKET"),
      messagingSenderId: env("FIREBASE_MESSAGING_SENDER_ID"),
      appId: env("FIREBASE_APP_ID"),
    };

    if (!cfg.apiKey || !cfg.projectId) {
      return send(res, 500, {
        error: "Firebase not configured",
        detail:
          "Set VITE_FIREBASE_API_KEY / FIREBASE_API_KEY and PROJECT_ID in Vercel Environment Variables.",
      });
    }

    return send(res, 200, cfg);
  } catch (err) {
    return send(res, 500, {
      error: "firebase_config_crash",
      detail: (err && err.message) || String(err),
    });
  }
};
