/**
 * GET /api/firebase-config
 * Returns Firebase web config from process.env (Vercel Environment Variables).
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
      apiKey: process.env.FIREBASE_API_KEY || "",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
      databaseURL: process.env.FIREBASE_DATABASE_URL || "",
      projectId: process.env.FIREBASE_PROJECT_ID || "",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
      appId: process.env.FIREBASE_APP_ID || "",
    };

    if (!cfg.apiKey || !cfg.projectId) {
      return send(res, 500, {
        error: "Firebase not configured",
        detail: "Set FIREBASE_API_KEY and FIREBASE_PROJECT_ID in Vercel Environment Variables.",
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
