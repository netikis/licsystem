/**
 * firebaseConfig.js - LICSYSTEM client
 * Loads Firebase config from /api/firebase-config (env vars on the server)
 * and initializes the compat SDK. No keys hardcoded here.
 */
(function (global) {
  "use strict";

  var FB_APP = "https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js";
  var FB_AUTH = "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js";
  var FB_DB = "https://www.gstatic.com/firebasejs/10.14.1/firebase-database-compat.js";

  var _configPromise = null;
  var _config = null;
  var _scripts = {};

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

  function loadScript(src) {
    if (_scripts[src]) return _scripts[src];
    _scripts[src] = new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (src.indexOf("firebase-app") !== -1 && global.firebase) return resolve();
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

  function loadConfig() {
    if (_config) return Promise.resolve(_config);
    if (_configPromise) return _configPromise;

    _configPromise = fetch("/api/firebase-config", {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then(function (res) {
        return res.text().then(function (raw) {
          var body = null;
          try {
            body = raw ? JSON.parse(raw) : null;
          } catch (e) {
            throw new Error(
              "firebase-config returned non-JSON (HTTP " +
                res.status +
                "). Redeploy api/firebase-config.js on Vercel."
            );
          }
          if (!res.ok) {
            var msg =
              (body && (body.detail || body.error)) ||
              "Could not load Firebase config (HTTP " + res.status + ")";
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
          }
          if (!body || !body.apiKey || !body.projectId) {
            throw new Error("Incomplete Firebase config from /api/firebase-config");
          }
          _config = {
            apiKey: body.apiKey,
            authDomain: body.authDomain,
            databaseURL: body.databaseURL,
            projectId: body.projectId,
            storageBucket: body.storageBucket,
            messagingSenderId: body.messagingSenderId,
            appId: body.appId,
          };
          return _config;
        });
      })
      .catch(function (err) {
        _configPromise = null;
        throw new Error(errMsg(err));
      });

    return _configPromise;
  }

  function getConfigSync() {
    return _config;
  }

  function initializeApp() {
    return loadConfig().then(function (cfg) {
      return loadScript(FB_APP).then(function () {
        if (!global.firebase) throw new Error("Firebase SDK did not load");
        if (!global.firebase.apps.length) {
          global.firebase.initializeApp(cfg);
        }
        return global.firebase;
      });
    });
  }

  function ensureAuth() {
    return initializeApp().then(function () {
      return loadScript(FB_AUTH).then(function () {
        return global.firebase;
      });
    });
  }

  function ensureDatabase() {
    return ensureAuth().then(function () {
      return loadScript(FB_DB).then(function () {
        return global.firebase;
      });
    });
  }

  global.LICSYSTEMFirebase = {
    loadConfig: loadConfig,
    getConfigSync: getConfigSync,
    initializeApp: initializeApp,
    ensureAuth: ensureAuth,
    ensureDatabase: ensureDatabase,
  };
})(typeof window !== "undefined" ? window : globalThis);
