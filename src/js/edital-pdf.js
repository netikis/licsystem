/* LICSYSTEM — PDF DO EDITAL ATIVO (edital-pdf.js) */
(function (LICSYSTEM) {
  "use strict";

  var DB_NAME = "licsystem_edital_pdf";
  var DB_VERSION = 1;
  var STORE = "pdfs";
  // Acima disso o PDF fica só em memória (evita encher o disco do navegador).
  var MAX_BYTES = 60 * 1024 * 1024;

  var memory = {};
  var dbPromise = null;

  function hasIdb() {
    try {
      return typeof indexedDB !== "undefined" && !!indexedDB;
    } catch (e) {
      return false;
    }
  }

  function openDb() {
    if (!hasIdb()) return Promise.reject(new Error("IndexedDB indisponível"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error || new Error("Falha ao abrir IndexedDB"));
      };
    }).catch(function (err) {
      dbPromise = null;
      throw err;
    });
    return dbPromise;
  }

  function tx(mode, run) {
    return openDb().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(STORE, mode);
        var store = t.objectStore(STORE);
        var req = run(store);
        t.oncomplete = function () {
          resolve(req ? req.result : null);
        };
        t.onerror = function () {
          reject(t.error || new Error("Falha na transação IndexedDB"));
        };
        t.onabort = function () {
          reject(t.error || new Error("Transação IndexedDB abortada"));
        };
      });
    });
  }

  function normKey(leilaoId) {
    return String(leilaoId || "").trim();
  }

  function toRecord(id, file) {
    return {
      id: id,
      name: String((file && file.name) || "edital.pdf").slice(0, 220),
      size: Number((file && file.size) || 0),
      type: String((file && file.type) || "application/pdf"),
      savedAt: Date.now(),
      blob: file
    };
  }

  function toFile(rec) {
    if (!rec || !rec.blob) return null;
    if (typeof File !== "undefined" && rec.blob instanceof File) return rec.blob;
    try {
      return new File([rec.blob], rec.name || "edital.pdf", {
        type: rec.type || "application/pdf"
      });
    } catch (e) {
      return rec.blob;
    }
  }

  LICSYSTEM.editalPdf = {
    /** Guarda o PDF do edital para reuso em Importar / Análise IA. */
    save: function (leilaoId, file) {
      var id = normKey(leilaoId);
      if (!id || !file) return Promise.resolve(null);
      if (Number(file.size || 0) > MAX_BYTES) {
        memory[id] = toRecord(id, file);
        return Promise.resolve(memory[id]);
      }
      var rec = toRecord(id, file);
      memory[id] = rec;
      return tx("readwrite", function (store) {
        return store.put(rec);
      })
        .then(function () {
          return rec;
        })
        .catch(function () {
          return rec;
        });
    },

    /** Metadados + blob do PDF salvo (ou null). */
    get: function (leilaoId) {
      var id = normKey(leilaoId);
      if (!id) return Promise.resolve(null);
      if (memory[id]) return Promise.resolve(memory[id]);
      return tx("readonly", function (store) {
        return store.get(id);
      })
        .then(function (rec) {
          if (rec && rec.blob) memory[id] = rec;
          return rec || null;
        })
        .catch(function () {
          return null;
        });
    },

    /** O PDF salvo como File, pronto para pdf.js. */
    getFile: function (leilaoId) {
      return LICSYSTEM.editalPdf.get(leilaoId).then(toFile);
    },

    remove: function (leilaoId) {
      var id = normKey(leilaoId);
      if (!id) return Promise.resolve();
      delete memory[id];
      return tx("readwrite", function (store) {
        return store.delete(id);
      }).catch(function () {});
    },

    /** Rótulo curto para a interface: "edital.pdf (820 KB)". */
    label: function (rec) {
      if (!rec) return "";
      var kb = Number(rec.size || 0) / 1024;
      var size = kb >= 1024 ? (kb / 1024).toFixed(1) + " MB" : kb.toFixed(0) + " KB";
      return String(rec.name || "edital.pdf") + " (" + size + ")";
    }
  };
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
