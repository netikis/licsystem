/**
 * GET /api/firebase-config
 * Devolve a config pública do Firebase a partir de process.env (.env / Vercel).
 * Assim as chaves não ficam hardcoded no index.html versionado no GitHub.
 *
 * Nota: a apiKey do Firebase Web é pública por design; proteja com
 * restrições de domínio no Google Cloud + regras do Realtime Database.
 */
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

function json(res, status, body) {
  cors(res);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readFirebaseEnv() {
  return {
    apiKey: process.env.FIREBASE_API_KEY || "",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
    databaseURL: process.env.FIREBASE_DATABASE_URL || "",
    projectId: process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_APP_ID || "",
  };
}

module.exports = function handler(req, res) {
  if (req.method === "OPTIONS") {
    cors(res);
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET") {
    return json(res, 405, { error: "Method not allowed" });
  }

  var cfg = readFirebaseEnv();
  if (!cfg.apiKey || !cfg.projectId) {
    return json(res, 500, {
      error: "Firebase não configurado",
      detail:
        "Defina FIREBASE_API_KEY, FIREBASE_PROJECT_ID e demais variáveis no .env / Vercel.",
    });
  }

  return json(res, 200, cfg);
};
