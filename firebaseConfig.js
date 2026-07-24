/**
 * firebaseConfig.js — LICSYSTEM (Vite)
 * Credenciais via import.meta.env.VITE_FIREBASE_* (injetadas no build).
 * Expõe window.LICSYSTEMFirebase para o app principal.
 */

const FB_APP = "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";
const FB_AUTH = "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js";
const FB_DB = "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "",
};

const _scripts = {};
let _ready = null;

function errMsg(err) {
  if (!err) return "Unknown error";
  if (typeof err === "string") return err;
  if (err.message && typeof err.message === "string") return err.message;
  try {
    return JSON.stringify(err);
  } catch (e) {
    return String(err);
  }
}

function validateConfig(cfg) {
  if (!cfg || !cfg.apiKey || !cfg.projectId) {
    throw new Error(
      "Firebase não configurado. Defina VITE_FIREBASE_API_KEY e VITE_FIREBASE_PROJECT_ID no .env (e na Vercel)."
    );
  }
  return cfg;
}

function loadScript(src) {
  if (_scripts[src]) return _scripts[src];
  _scripts[src] = new Promise(function (resolve, reject) {
    var existing = document.querySelector('script[src="' + src + '"]');
    if (existing) {
      if (src.indexOf("firebase-app") !== -1 && window.firebase) return resolve();
      existing.addEventListener("load", function () {
        resolve();
      });
      existing.addEventListener("error", function () {
        reject(new Error("Failed to load: " + src));
      });
      return;
    }
    var s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = function () {
      resolve();
    };
    s.onerror = function () {
      delete _scripts[src];
      reject(new Error("Failed to load: " + src));
    };
    document.head.appendChild(s);
  });
  return _scripts[src];
}

function getConfigSync() {
  try {
    return validateConfig(firebaseConfig);
  } catch (e) {
    return null;
  }
}

function loadConfig() {
  return Promise.resolve(validateConfig(firebaseConfig));
}

function initializeApp() {
  return loadConfig().then(function (cfg) {
    return loadScript(FB_APP).then(function () {
      if (!window.firebase) throw new Error("Firebase SDK did not load");
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(cfg);
      }
      return window.firebase;
    });
  });
}

function ensureAuth() {
  return initializeApp().then(function () {
    return loadScript(FB_AUTH).then(function () {
      return window.firebase;
    });
  });
}

function ensureDatabase() {
  return ensureAuth().then(function () {
    return loadScript(FB_DB).then(function () {
      return window.firebase;
    });
  });
}

window.LICSYSTEMFirebase = {
  loadConfig: loadConfig,
  getConfigSync: getConfigSync,
  initializeApp: initializeApp,
  ensureAuth: ensureAuth,
  ensureDatabase: ensureDatabase,
};

export {
  firebaseConfig,
  loadConfig,
  getConfigSync,
  initializeApp,
  ensureAuth,
  ensureDatabase,
};
