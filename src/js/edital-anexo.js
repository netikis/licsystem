/* LICSYSTEM — anexa o PDF oficial (PNCP) no aviso, como o agregador baixa da fonte */
(function (LICSYSTEM) {
  "use strict";

  var queue = [];
  var inflight = 0;
  var running = Object.create(null);
  var queued = Object.create(null);
  var MAX_INFLIGHT = 2;
  var MAX_QUEUE = 12;

  function storeId(ed) {
    ed = ed || {};
    var k = String(ed.numeroControlePNCP || ed.key || ed.id || "").trim();
    return k ? "aviso:" + k : "";
  }

  function detectFonte(ed) {
    ed = ed || {};
    if (ed.fonte) return String(ed.fonte);
    var orig = String(ed.linkOrigem || ed.linkSistemaOrigem || "");
    if (/bllcompras|\.bll\.|bll\.org/i.test(orig)) return "bll";
    if (/licitanet/i.test(orig)) return "licitanet";
    if (/comprasnet|compras\.gov/i.test(orig)) return "comprasnet";
    return "pncp";
  }

  function inInteressados(ed) {
    var list = LICSYSTEM.alertas && LICSYSTEM.alertas.interessados;
    if (!list || !ed) return false;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (it.id === ed.id || (ed.key && it.key === ed.key) ||
          (ed.numeroControlePNCP && it.numeroControlePNCP === ed.numeroControlePNCP)) {
        return true;
      }
    }
    return false;
  }

  function patchEdital(ed, fields) {
    if (!ed || !fields || !LICSYSTEM.alertas) {
      if (ed && fields) Object.assign(ed, fields);
      return;
    }
    function apply(list) {
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        var it = list[i];
        if (
          it.id === ed.id ||
          (ed.key && it.key === ed.key) ||
          (ed.numeroControlePNCP && it.numeroControlePNCP === ed.numeroControlePNCP)
        ) {
          Object.assign(it, fields);
        }
      }
    }
    apply(LICSYSTEM.alertas.alerts);
    apply(LICSYSTEM.alertas.interessados);
    Object.assign(ed, fields);
    try {
      LICSYSTEM.alertas.persistAlerts({ skipCloud: true });
    } catch (e) {}
    if (inInteressados(ed)) {
      try {
        LICSYSTEM.alertas.persistInteressados();
      } catch (e2) {}
    }
  }

  function downloadPncpFile(ed) {
    var url =
      LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.pncpPdfApiUrl
        ? LICSYSTEM.analiseIa.pncpPdfApiUrl(ed, true)
        : null;
    if (!url) {
      return Promise.reject(new Error("Sem referência PNCP para baixar o PDF."));
    }
    return fetch(url, { method: "GET", headers: { Accept: "application/pdf,application/json" } }).then(
      function (res) {
        var ctype = String(res.headers.get("content-type") || "");
        if (ctype.indexOf("application/json") !== -1 || !res.ok) {
          return res.text().then(function (raw) {
            var body = null;
            try {
              body = raw ? JSON.parse(raw) : null;
            } catch (e) {}
            var msg =
              (body && (body.error || body.detail || body.message)) ||
              "Não foi possível baixar o PDF (HTTP " + res.status + ").";
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
          });
        }
        return res.blob().then(function (blob) {
          var titulo = "";
          try {
            titulo = decodeURIComponent(res.headers.get("X-Pncp-Titulo") || "");
          } catch (e) {
            titulo = "";
          }
          if (!titulo) {
            titulo =
              (ed.orgao || "edital") + (ed.numeroCompra ? "-" + ed.numeroCompra : "") + ".pdf";
          }
          if (!/\.pdf$/i.test(titulo)) titulo += ".pdf";
          if (!blob || !blob.size) throw new Error("PDF vazio retornado pelo PNCP.");
          return new File([blob], titulo.slice(0, 180), {
            type: blob.type || "application/pdf"
          });
        });
      }
    );
  }

  function drain() {
    while (inflight < MAX_INFLIGHT && queue.length) {
      var job = queue.shift();
      inflight++;
      LICSYSTEM.editalAnexo
        .anexar(job.ed)
        .catch(function () {})
        .then(function () {
          inflight--;
          delete queued[job.id];
          drain();
        });
    }
  }

  function doAnexar(ed) {
    ed = ed || {};
    var id = storeId(ed);
    if (!id) {
      return Promise.reject(new Error("Edital sem identificador para anexar PDF."));
    }
    patchEdital(ed, { pdfStatus: "pending" });
    return LICSYSTEM.editalAnexo.getFile(ed).then(function (cached) {
      if (cached && cached.size) {
        patchEdital(ed, {
          pdfStatus: "ok",
          pdfName: cached.name,
          pdfSource: ed.pdfSource || detectFonte(ed),
          pdfAt: Date.now(),
          pdfError: null
        });
        return cached;
      }
      return downloadPncpFile(ed).then(function (file) {
        var source = detectFonte(ed) === "bll" ? "bll-pncp" : "pncp";
        return LICSYSTEM.editalPdf.save(id, file).then(function () {
          patchEdital(ed, {
            pdfStatus: "ok",
            pdfName: file.name,
            pdfSource: source,
            pdfAt: Date.now(),
            pdfError: null
          });
          return file;
        });
      });
    }).catch(function (err) {
      patchEdital(ed, {
        pdfStatus: "fail",
        pdfError: String((err && err.message) || "Falha ao anexar").slice(0, 180)
      });
      throw err;
    });
  }

  LICSYSTEM.editalAnexo = {
    storeId: storeId,
    detectFonte: detectFonte,

    getFile: function (ed) {
      var id = storeId(ed);
      if (!id || !LICSYSTEM.editalPdf) return Promise.resolve(null);
      return LICSYSTEM.editalPdf.getFile(id);
    },

    /**
     * Baixa o PDF oficial do PNCP e guarda no IndexedDB da ficha do aviso.
     * Fonte BLL: o arquivo também vem pelo PNCP (a BLL publica lá).
     */
    anexar: function (ed) {
      var id = storeId(ed);
      if (!id) {
        return Promise.reject(new Error("Edital sem identificador para anexar PDF."));
      }
      if (running[id]) return running[id];
      var p = doAnexar(ed).then(
        function (file) {
          delete running[id];
          return file;
        },
        function (err) {
          delete running[id];
          throw err;
        }
      );
      running[id] = p;
      return p;
    },

    enqueue: function (ed) {
      if (!ed) return;
      var id = storeId(ed);
      if (!id) return;
      if (ed.pdfStatus === "ok" || ed.pdfStatus === "pending") return;
      if (running[id] || queued[id]) return;
      if (queue.length >= MAX_QUEUE) return;
      queued[id] = 1;
      queue.push({ id: id, ed: ed });
      drain();
    },

    enqueueMany: function (list) {
      if (!list || !list.length) return;
      for (var i = 0; i < list.length && i < MAX_QUEUE; i++) {
        LICSYSTEM.editalAnexo.enqueue(list[i]);
      }
    }
  };
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
