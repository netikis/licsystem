/* LICSYSTEM — UTILS (núcleo) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});

  /* ============================ UTILS ============================ */
  var utils = LICSYSTEM.utils = {};

  utils.escapeHtml = function(s){
    var str = String(s == null ? "" : s);
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  };

  /** Extrai mensagem legível de Error / string / objeto JSON da API (evita [object Object]). */
  utils.formatApiError = function(err){
    if (err == null) return "erro desconhecido";
    if (typeof err === "string") return err;
    if (err instanceof Error && err.message) {
      var m = err.message;
      if (m !== "[object Object]") return m;
    }
    var raw = err.error != null ? err.error : err.message != null ? err.message : err;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      if (typeof raw.message === "string") return raw.message;
      try {
        return JSON.stringify(raw);
      } catch (e) {
        return String(raw);
      }
    }
    if (err && typeof err === "object") {
      try {
        return JSON.stringify(err);
      } catch (e2) {
        return String(err);
      }
    }
    return String(err);
  };

  /**
   * Lê Response: se não for JSON (HTML da Vercel etc.), devolve
   * { ok:false, error:"HTTP N: texto…" } em vez de Unexpected token.
   */
  utils.parseApiResponse = function(r){
    return r.text().then(function(text){
      var trimmed = String(text == null ? "" : text).trim();
      var j = null;
      if (trimmed) {
        try {
          j = JSON.parse(trimmed);
        } catch (e) {
          var snippet = trimmed.replace(/\s+/g, " ").slice(0, 160);
          var err = new Error(
            "HTTP " +
              r.status +
              " (resposta não-JSON): " +
              snippet +
              (trimmed.length > 160 ? "…" : "")
          );
          err.status = r.status;
          err.nonJson = true;
          throw err;
        }
      } else {
        j = {};
      }
      if (!r.ok) {
        var msg =
          utils.formatApiError((j && j.error) || j) || "HTTP " + r.status;
        var err2 = new Error(msg);
        err2.status = r.status;
        err2.body = j;
        err2.errosParciais = j && j.errosParciais;
        throw err2;
      }
      return j;
    });
  };

  /** Dica de ambiente: em produção (Vercel) não sugerir npm run dev. */
  utils.apiHintHtml = function(){
    try {
      var h = String(location.hostname || "");
      if (/\.vercel\.app$/i.test(h) || (h && h !== "localhost" && h !== "127.0.0.1")) {
        return "Se o problema continuar, aguarde o redeploy ou confira os logs da função na Vercel.";
      }
    } catch (e) {}
    return "Localmente use <code>npm run dev</code> (Vite+API); em produção o deploy na Vercel precisa incluir as APIs.";
  };

  // fold: remove accents / normalize
  utils.fold = function(s){
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  };

  utils.levenshtein = function(a,b){
    a = String(a||""); b = String(b||"");
    var m = a.length, n = b.length;
    if(m === 0) return n;
    if(n === 0) return m;
    var prev = new Array(n+1), curr = new Array(n+1), i, j;
    for(j=0;j<=n;j++) prev[j] = j;
    for(i=1;i<=m;i++){
      curr[0] = i;
      for(j=1;j<=n;j++){
        var cost = a.charAt(i-1) === b.charAt(j-1) ? 0 : 1;
        curr[j] = Math.min(prev[j]+1, curr[j-1]+1, prev[j-1]+cost);
      }
      for(j=0;j<=n;j++) prev[j] = curr[j];
    }
    return prev[n];
  };

  utils.similaridade = function(a,b){
    a = utils.sanitizar(a); b = utils.sanitizar(b);
    if(!a && !b) return 100;
    var dist = utils.levenshtein(a,b);
    var maxLen = Math.max(a.length, b.length) || 1;
    var sim = (1 - dist/maxLen) * 100;
    if(sim < 0) sim = 0;
    return Math.round(sim);
  };

  utils.formatBrl = function(v){
    var n = Number(v);
    if(!isFinite(n)) n = 0;
    return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  };

  /** Normalize pasted URLs (add https:// when missing). Returns "" if not usable. */
  utils.normalizeHttpUrl = function(raw){
    var s = String(raw || "").trim();
    if(!s) return "";
    if(/^https?:\/\//i.test(s)) return s;
    // Domain-like: example.com, www.x.com/path, subdomain.site.gov.br/...
    if(/^(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([\/?#].*)?$/i.test(s)){
      return "https://" + s;
    }
    return "";
  };

  // dynamic script injection (async, never blocks UI)
  var _loaded = {};
  utils.loadScript = function(src){
    if(_loaded[src]) return _loaded[src];
    _loaded[src] = new Promise(function(resolve,reject){
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function(){ resolve(true); };
      s.onerror = function(){ delete _loaded[src]; reject(new Error("Falha ao carregar: "+src)); };
      document.head.appendChild(s);
    });
    return _loaded[src];
  };

  utils.ensurePdfJs = function(){
    if(window.pdfjsLib) return Promise.resolve();
    return utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js")
      .then(function(){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      });
  };

  /** OCR de páginas/imagem (editais com planilha embutida como imagem — ex.: Pinhalão). */
  utils.ensureTesseract = function () {
    if (window.Tesseract && typeof window.Tesseract.recognize === "function") {
      return Promise.resolve();
    }
    return utils.loadScript(
      "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js"
    );
  };

  utils.ensureJsPdf = function(){
    var need = [];
    if(!(window.jspdf && window.jspdf.jsPDF)) need.push("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    var p = Promise.resolve();
    need.forEach(function(u){ p = p.then(function(){ return utils.loadScript(u); }); });
    return p.then(function(){
      // autotable requires jspdf present first
      return utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    });
  };

  utils.ensureXlsx = function(){
    if(window.XLSX) return Promise.resolve();
    return utils.loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
  };

  utils.ensureChart = function(){
    if(window.Chart) return Promise.resolve();
    return utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js");
  };

  utils.ymd = function(d){
    d = d || new Date();
    return ""+d.getFullYear()+("0"+(d.getMonth()+1)).slice(-2)+("0"+d.getDate()).slice(-2);
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
