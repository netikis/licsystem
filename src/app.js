(function(){
  "use strict";

  var LICSYSTEM = window.LICSYSTEM = {};

  /* ============================ UTILS ============================ */
  var utils = LICSYSTEM.utils = {};

  utils.escapeHtml = function(s){
    var str = String(s == null ? "" : s);
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  };

  // fold: remove accents / normalize
  utils.fold = function(s){
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  };

  var PACK_JUNK = ["unidade","unid","und","un","kit","jogo","conjunto","cx","caixa","pct","pacote","pc","peca","pecas","par","pares","embalagem","cartela","fardo","rolo","frasco","galao","balde","saco","lata","display"];
  const BLACKLIST = ["Edital","Pregão","Secretaria","Objeto","Vigência"];

  // Retorna "" se a linha contiver termo da BLACKLIST (descarta); senão, texto limpo p/ match
  utils.sanitizar = function(s){
    var raw = String(s == null ? "" : s);
    var folded = utils.fold(raw).toLowerCase();
    for(var b=0;b<BLACKLIST.length;b++){
      if(folded.indexOf(utils.fold(BLACKLIST[b]).toLowerCase()) !== -1) return "";
    }
    var t = folded.replace(/[^a-z0-9\s]/g," ");
    var words = t.split(/\s+/).filter(function(w){
      if(!w) return false;
      if(PACK_JUNK.indexOf(w) !== -1) return false;
      return true;
    });
    return words.join(" ").replace(/\s+/g," ").trim();
  };

  var RE_INICIO_SPEC_EDITAL = [
    /^deve\s+(possuir|permitir|ser|apresentar|garantir|conter)/i,
    /^apresenta(r?\s+)?(boa|alta|consist)/i,
    /^sendo\s+indicado/i,
    /^fixa(cao|ção)\s/i,
    /^proporcionando/i,
    /^garantindo/i,
    /^firme\s+e\s+dur/i,
    /^colagem\b/i,
    /^coladas,\s/i,
    /^uni[aã]o\s+por\s+contato/i,
    /^ader[eê]ncia\s+imediata/i,
    /^embalagem\s+contendo/i,
    /^devidamente\s+lacrad/i,
    /^consist[eê]ncia\s+homog/i,
    /^f[aá]cil\s+aplica[cç][aã]o/i,
    /^pincel,\s*esp[aá]tula/i,
    /^e\s+boas?\s+/i,
    /jun[cç][aã]o\s+das\s+pe[cç]as/i,
    /cisalhamento/i,
    /evapora[cç][aã]o\s+do\s+solvente/i,
    /tempo\s+de\s+secagem/i,
    /envelhecimento\s+natural/i,
    /identifica[cç][aã]o\s+do\s+fabricante/i,
    /resist[eê]ncia\s+final/i,
    /resist[eê]ncia\s+ao\s+cisalhamento/i
  ];

  /** Trecho de descrição (sem qtd/UN) que parece parágrafo de especificação. */
  utils.isTextoSpecEdital = function (texto) {
    texto = String(texto == null ? "" : texto).replace(/\s+/g, " ").trim();
    if (!texto || texto.length < 4) return false;

    var i;
    for (i = 0; i < RE_INICIO_SPEC_EDITAL.length; i++) {
      if (RE_INICIO_SPEC_EDITAL[i].test(texto)) return true;
    }

    if (/^[a-záàâãéêíóôúç]/.test(texto.charAt(0)) && texto.length > 35) return true;
    if (/^(e|ou|com|para|em|na|no|de|da|do|das|dos|ap[oó]s)\s+/i.test(texto) && texto.length > 25) {
      return true;
    }

    return false;
  };

  /** Linha completa: sem formato planilha ou descrição = especificação. */
  utils.isLinhaSpecEdital = function (line) {
    var raw = String(line == null ? "" : line).replace(/\s+/g, " ").trim();
    if (!raw || raw.length < 4) return true;

    var temPlanilha = /^\d{1,3}(?:\.\d{3})*,\d{3}\s+(UN|UND|UNI|UNID)\s+/i.test(raw);
    if (!temPlanilha) return true;

    var m = raw.match(/^\d{1,3}(?:\.\d{3})*,\d{3}\s+(?:UN|UND|UNI|UNID)\s+(.+)$/i);
    return utils.isTextoSpecEdital(m ? m[1] : raw);
  };

  /** Só linhas válidas de produto (qtd + UN + descrição, sem bloco de especificação). */
  utils.isLinhaProdutoEdital = function (line) {
    var fmt = utils.formatLinhaEdital(line);
    if (!fmt) return false;
    if (utils.isLinhaSpecEdital(fmt)) return false;
    if (!/^\d{1,3}(?:\.\d{3})*,\d{3}\s+(UN|UND|UNI|UNID)\s+/i.test(fmt)) return false;
    return true;
  };

  /**
   * Descrição: mantém "Produto - Produto" curto; remove só bloco técnico longo após " - ".
   */
  utils.enxugarDescricaoEdital = function (desc) {
    desc = String(desc || "").replace(/\s+/g, " ").trim();
    if (!desc) return "";
    var specHint =
      /^(o\s+produto|indicado\s+para|destinado|caracter[ií]sticas|conformidade|normas?\s+t[eé]cnicas|deve\s+(ser|possuir|permitir|apresentar|garantir|conter)|fabricado|aproximadamente|comprimento|tratamento|ergon[oô]mico|isolante|resist[eê]ncia|garantir|submetido|fixa(cao|ção)|proporcionando|garantindo|apresenta|sendo\s+indicado|embalagem\s+contendo)/i;
    var idx = desc.search(/\s+[-–]\s+/);
    if (idx === -1) return desc;
    var left = desc.slice(0, idx).trim();
    var right = desc.slice(idx).replace(/^\s+[-–]\s+/, "").trim();
    if (!right) return left;
    if (specHint.test(right) || right.length > 85) return left;
    var lf = utils.fold(left).toLowerCase();
    var rf = utils.fold(right).toLowerCase();
    if (rf.indexOf(lf.slice(0, Math.min(lf.length, 14))) === 0 || right.length <= left.length * 1.6) {
      return desc.trim();
    }
    return left;
  };

  /**
   * Formato planilha do edital: "100,000 UN Viga 5x15mt - Viga 5x15mt"
   * (sem código do item nem preços unitário/total).
   */
  utils.formatLinhaEdital = function (raw) {
    var s = String(raw == null ? "" : raw).replace(/\s+/g, " ").trim();
    if (!s) return null;

    var m = s.match(/^(\d{1,5})\s+(\d{1,3}(?:\.\d{3})*,\d{3})\s+(UN|UND|UNI|UNID)\s+(.+)$/i);
    if (m) {
      var desc = m[4]
        .replace(/\s+\d{1,3}(?:\.\d{3})*,\d{2,4}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s*$/, "")
        .trim();
      desc = utils.enxugarDescricaoEdital(desc);
      if (desc.length < 2 || utils.isTextoSpecEdital(desc)) return null;
      return m[2] + " " + m[3].toUpperCase() + " " + desc;
    }

    m = s.match(/^(\d{1,3}(?:\.\d{3})*,\d{3})\s+(UN|UND|UNI|UNID)\s+(.+)$/i);
    if (m) {
      var desc2 = m[3]
        .replace(/\s+\d{1,3}(?:\.\d{3})*,\d{2,4}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s*$/, "")
        .trim();
      desc2 = utils.enxugarDescricaoEdital(desc2);
      if (desc2.length < 2 || utils.isTextoSpecEdital(desc2)) return null;
      return m[1] + " " + m[2].toUpperCase() + " " + desc2;
    }

    return null;
  };

  /** Termo curto para busca (opcional): remove qtd/UN e pega trecho antes do " - ". */
  utils.nomeProdutoEdital = function (line) {
    var fmt = utils.formatLinhaEdital(line) || String(line || "").trim();
    var m = fmt.match(/^\d{1,3}(?:\.\d{3})*,\d{3}\s+(?:UN|UND|UNI|UNID)\s+(.+)$/i);
    if (m) {
      var d = m[1].split(/\s+[-–]\s+/)[0].trim();
      return d.toLowerCase();
    }
    return fmt.toLowerCase();
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

  /* ------- Firebase (config via import.meta.env.VITE_FIREBASE_* → firebaseConfig.js) ------- */
  utils.getFirebaseConfig = function(){
    if(window.LICSYSTEMFirebase && typeof window.LICSYSTEMFirebase.getConfigSync === "function"){
      return window.LICSYSTEMFirebase.getConfigSync();
    }
    return null;
  };

  utils.hasFirebaseConfig = function(){
    return !!(window.LICSYSTEMFirebase && typeof window.LICSYSTEMFirebase.ensureAuth === "function");
  };

  var _fbInit = null;
  var _fbAuthInit = null;

  /** Só App + Auth (login rápido). Database sobe sob demanda. */
  utils.ensureFirebaseAuth = function(){
    if(!utils.hasFirebaseConfig()) return Promise.reject(new Error("firebase-config-vazio"));
    if(_fbAuthInit) return _fbAuthInit;
    _fbAuthInit = window.LICSYSTEMFirebase.ensureAuth()
      .catch(function(err){ _fbAuthInit = null; throw err; });
    return _fbAuthInit;
  };

  /** App + Auth + Realtime Database (paralelo após o app). */
  utils.ensureFirebase = function(){
    if(!utils.hasFirebaseConfig()) return Promise.reject(new Error("firebase-config-vazio"));
    if(_fbInit) return _fbInit;
    _fbInit = window.LICSYSTEMFirebase.ensureDatabase()
      .catch(function(err){ _fbInit = null; throw err; });
    return _fbInit;
  };

  utils.firebasePush = function(path, obj){
    return utils.ensureFirebase().then(function(fb){
      return fb.database().ref(path).push(obj);
    });
  };

  utils.firebaseSet = function(path, obj){
    return utils.ensureFirebase().then(function(fb){
      var ref = (path === "/" || path === "") ? fb.database().ref() : fb.database().ref(path);
      return ref.set(obj);
    });
  };

  utils.firebaseGet = function(path){
    return utils.ensureFirebase().then(function(fb){
      return fb.database().ref(path).once("value").then(function(snap){
        return snap.val();
      });
    });
  };

  /* ------- Mercado Livre via proxy backend (nunca direto no browser) ------- */
  utils.mlProxyBase = function(){
    // Permite override: LICSYSTEM.config.mlProxyUrl = "https://xxx/api/ml-proxy"
    if(LICSYSTEM.config && LICSYSTEM.config.mlProxyUrl) return String(LICSYSTEM.config.mlProxyUrl).replace(/\/$/,"");
    return "/api/ml-proxy";
  };

  utils.mlProxy = function(params){
    var qs = Object.keys(params || {}).map(function(k){
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k] == null ? "" : params[k]);
    }).join("&");
    var url = utils.mlProxyBase() + (qs ? ("?" + qs) : "");
    return fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    }).then(function(r){
      return r.json().then(function(j){
        // Proxy pode responder 200 com results=[] + warning — não tratar como hard fail
        if(!r.ok && !(j && Array.isArray(j.results))){
          var msg = (j && (j.message || j.error || j.warning)) || ("HTTP " + r.status);
          var err = new Error(msg);
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j || { results: [] };
      }, function(){
        throw new Error("HTTP " + r.status + " (resposta inválida do proxy)");
      });
    });
  };

  /** Limpa termo do edital para busca ML (ex.: "12A 20mm x 9mm"). */
  utils.mlQueryFromTermo = function(termo, embalagem){
    var raw = String(termo == null ? "" : termo)
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/(\d)A(\d)/gi, "$1 a $2")
      .replace(/(\d)A\b/gi, "$1 a")
      .replace(/\bx\b/gi, " ");
    var s = utils.sanitizar(raw);
    var emb = utils.sanitizar(embalagem || "");
    // embalagem generica nao ajuda na busca
    if(/^(unidade|unid|und|un|peca|pecas)$/i.test(emb)) emb = "";
    var q = (s + (emb ? " " + emb : "")).replace(/\s+/g, " ").trim();
    // evita query gigante de especificacao
    var words = q.split(" ").filter(Boolean);
    if(words.length > 8) words = words.slice(0, 8);
    return words.join(" ");
  };

  utils.mlSearch = function(q, limit){
    return utils.mlProxy({ action: "search", q: q, limit: limit || 5 });
  };

  utils.mlShipping = function(itemId, cep, permalink){
    var p = { action: "shipping", itemId: itemId || "", cep: cep || "" };
    if(permalink) p.permalink = permalink;
    return utils.mlProxy(p);
  };

  // build EXACT path: licitacoes/${YYYY}/${MM}/${DD}-${HHh}/resultados_cruzamento
  utils.buildFirebasePath = function(d){
    d = d || new Date();
    var YYYY = d.getFullYear();
    var MM = ("0"+(d.getMonth()+1)).slice(-2);
    var DD = ("0"+d.getDate()).slice(-2);
    var HH = ("0"+d.getHours()).slice(-2);
    return "licitacoes/"+YYYY+"/"+MM+"/"+DD+"-"+HH+"h/resultados_cruzamento";
  };

  utils.ymd = function(d){
    d = d || new Date();
    return ""+d.getFullYear()+("0"+(d.getMonth()+1)).slice(-2)+("0"+d.getDate()).slice(-2);
  };

  /* ============================ STATE ============================ */
  LICSYSTEM.config = LICSYSTEM.config || {
    mlProxyUrl: "/api/ml-proxy" // Vercel serverless — não chamar api.mercadolibre.com no browser
  };

  LICSYSTEM.state = {
    authUser: null,
    _orcDirty: true,
    _orcRendered: false,
    _dashReady: false,
    _cofreRendered: false,
    orcPage: 1,
    orcPageSize: 100,
    capPage: 1,
    capPageSize: 100,
    capFiltered: [],
    orcItems: [],
    aprovadosCruzamento: [],
    pncpAlerts: [],
    lastBdi: null,
    dashboardMetrics: {
      volumeDisputado: 0,
      ganhos: 0,
      perdidos: 0,
      emAnalise: 0,
      volumeMensal: [0,0,0,0,0,0]
    },
    captacaoLines: [],
    empresaPerfil: null
  };

  var ORC_KEY = "licsystem_orcamento_v1";
  var COFRE_KEY = "licsystem_cofre_v1";

  /* risk dictionary */
  var PALAVRAS_RISCO = ["instalação","instalacao","amostra","garantia","visita técnica","visita tecnica","treinamento","montagem","mão de obra","mao de obra","serviços","servicos"];
  utils.riscoMatch = function(text){
    var t = utils.fold(String(text||"")).toLowerCase();
    var hits = [];
    for(var i=0;i<PALAVRAS_RISCO.length;i++){
      var w = utils.fold(PALAVRAS_RISCO[i]).toLowerCase();
      if(t.indexOf(w) !== -1) hits.push(PALAVRAS_RISCO[i]);
    }
    return hits;
  };

  function el(id){ return document.getElementById(id); }
  function showAlert(id, type, msg){
    var a = el(id); if(!a) return;
    a.className = "alert show alert-"+type;
    a.innerHTML = msg;
  }
  function hideAlert(id){ var a=el(id); if(a) a.className="alert"; }

  /* ============================ BELL / PNCP badge ============================ */
  LICSYSTEM.updateBell = function(){
    var badge = el("bellBadge");
    if(!badge) return;
    var n = LICSYSTEM.state.pncpAlerts.length;
    badge.textContent = String(n);
    badge.classList.toggle("zero", n === 0);
  };

  /* ============================ DASHBOARD ============================ */
  LICSYSTEM.dashboard = {
    _charts:{},
    renderKpis:function(){
      var m = LICSYSTEM.state.dashboardMetrics;
      var grid = el("kpiGrid");
      if(!grid) return;
      grid.innerHTML =
        kpi("Volume Financeiro Disputado", utils.formatBrl(m.volumeDisputado), "Acumulado no período", false) +
        kpi("Pregões Ganhos", m.ganhos, "Homologados a favor do LICSYSTEM", true) +
        kpi("Pregões Perdidos", m.perdidos, "Não vencidos", true) +
        kpi("Em Análise", m.emAnalise, "Aguardando decisão", true);
      function kpi(label,val,sub,alt){
        return '<div class="kpi-card'+(alt?' alt':'')+'">'+
          '<div class="k-label">'+utils.escapeHtml(label)+'</div>'+
          '<div class="k-value">'+utils.escapeHtml(val)+'</div>'+
          '<div class="k-sub">'+utils.escapeHtml(sub)+'</div></div>';
      }
    },
    initCharts:function(){
      utils.ensureChart().then(function(){
        var m = LICSYSTEM.state.dashboardMetrics;
        var dEl = el("chartDoughnut"), bEl = el("chartBar");
        if(dEl){
          if(LICSYSTEM.dashboard._charts.d) LICSYSTEM.dashboard._charts.d.destroy();
          LICSYSTEM.dashboard._charts.d = new Chart(dEl.getContext("2d"),{
            type:"doughnut",
            data:{ labels:["Ganhos","Perdidos","Em Análise"],
              datasets:[{ data:[m.ganhos,m.perdidos,m.emAnalise],
                backgroundColor:["#1e9e5a","#d23b3b","#c9a227"], borderWidth:0 }]},
            options:{ responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ position:"bottom" } }, cutout:"62%" }
          });
        }
        if(bEl){
          if(LICSYSTEM.dashboard._charts.b) LICSYSTEM.dashboard._charts.b.destroy();
          var labels = lastMonths(6);
          LICSYSTEM.dashboard._charts.b = new Chart(bEl.getContext("2d"),{
            type:"bar",
            data:{ labels:labels,
              datasets:[{ label:"R$ mil", data:m.volumeMensal,
                backgroundColor:"#152642", borderRadius:6 }]},
            options:{ responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ display:false } },
              scales:{ y:{ beginAtZero:true } } }
          });
        }
      }).catch(function(){ /* chart cdn failed — silent */ });
      function lastMonths(n){
        var names=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        var out=[], d=new Date();
        for(var i=n-1;i>=0;i--){ var dd=new Date(d.getFullYear(),d.getMonth()-i,1); out.push(names[dd.getMonth()]); }
        return out;
      }
    },
    renderPncp:function(){
      var box = el("dashPncpList");
      if(!box) return;
      var arr = LICSYSTEM.state.pncpAlerts;
      if(!arr.length){ box.innerHTML='<span class="muted">Nenhuma oportunidade capturada ainda. Use o Radar PNCP em <b>Captação</b>.</span>'; return; }
      var html='<div style="display:flex;flex-direction:column;gap:8px">';
      arr.slice(0,10).forEach(function(o){
        html+='<div style="padding:10px 12px;border:1px solid var(--ls-line);border-radius:10px">'+
          '<b>'+utils.escapeHtml(o.orgao||"Órgão")+'</b> <span class="badge-status b-yellow">'+utils.escapeHtml(o.uf||"")+'</span><br/>'+
          '<span class="small muted">'+utils.escapeHtml((o.objeto||"").slice(0,180))+'</span></div>';
      });
      html+='</div>';
      box.innerHTML=html;
    },
    render:function(){ this.renderKpis(); this.initCharts(); this.renderPncp(); }
  };

  /* ============================ CAPTAÇÃO ============================ */
  var UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  LICSYSTEM.captacao = {
    BLACKLIST: BLACKLIST,

    initUf:function(){
      var sel = el("pncpUf");
      if(!sel || sel.options.length) return;
      var html='<option value="">Todas</option>';
      UF_LIST.forEach(function(u){ html+='<option value="'+u+'">'+u+'</option>'; });
      sel.innerHTML = html;
    },

    // Planilha do edital: uma linha = "100,000 UN Viga 5x15mt - Viga 5x15mt"
    splitEdital: function (text) {
      function limparPagina(s) {
        return String(s || "")
          .replace(/\bP[aá]gina\s*:\s*\d+\s*\/\s*\d+/gi, "\n")
          .replace(/\u00A0/g, " ")
          .replace(/[\t ]+/g, " ")
          .trim();
      }

      function cortarPorIndices(chunk, starts) {
        starts.sort(function (a, b) {
          return a - b;
        });
        var uniq = [];
        for (var i = 0; i < starts.length; i++) {
          if (i === 0 || starts[i] - uniq[uniq.length - 1] > 12) uniq.push(starts[i]);
        }
        var out = [];
        for (var j = 0; j < uniq.length; j++) {
          var end = j + 1 < uniq.length ? uniq[j + 1] : chunk.length;
          out.push(chunk.slice(uniq[j], end).trim());
        }
        return out;
      }

      /** Só quebra onde começa novo item: código + qtd + UN/UND */
      function splitChunkPlanilha(chunk) {
        chunk = limparPagina(chunk);
        if (!chunk) return [];

        var direto = utils.formatLinhaEdital(chunk);
        if (direto && utils.isLinhaProdutoEdital(direto)) return [direto];

        var starts = [];
        var reStart = /(?:^|\s)(\d{3,5})\s+(\d{1,3}(?:\.\d{3})*,\d{3})\s+(UN|UND|UNI|UNID)\s+/gi;
        var m;
        while ((m = reStart.exec(chunk)) !== null) {
          var pos = m.index;
          if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") pos = m.index + 1;
          starts.push(pos);
        }

        if (starts.length < 2) {
          var reParen = /(?:^|\s)(\d{2,5})\s*[\)\.]\s*[-–]\s+/g;
          while ((m = reParen.exec(chunk)) !== null) {
            var p2 = m.index;
            if (m[0].charAt(0) === " ") p2 = m.index + 1;
            starts.push(p2);
          }
        }

        if (starts.length < 2) {
          if (starts.length === 1) {
            var solo = chunk.slice(starts[0]).trim();
            var fs = utils.formatLinhaEdital(solo);
            if (fs && utils.isLinhaProdutoEdital(fs)) return [fs];
          }
          return [];
        }

        var partes = cortarPorIndices(chunk, starts);
        var fmtParts = [];
        for (var i = 0; i < partes.length; i++) {
          var f = utils.formatLinhaEdital(partes[i]);
          if (f && utils.isLinhaProdutoEdital(f)) fmtParts.push(f);
        }
        return fmtParts;
      }

      var t = limparPagina(text).replace(/\r\n?/g, "\n");
      var rawLines = t.split(/\n+/);
      var merged = [];
      for (var r = 0; r < rawLines.length; r++) {
        var ln = rawLines[r].trim();
        if (!ln) continue;
        var parts = splitChunkPlanilha(ln);
        for (var p = 0; p < parts.length; p++) merged.push(parts[p]);
      }

      var seen = {};
      var out = [];
      merged.forEach(function (l) {
        l = String(l || "").replace(/\s+/g, " ").trim();
        var fmt = utils.formatLinhaEdital(l);
        if (!fmt || !utils.isLinhaProdutoEdital(fmt)) return;
        if (!utils.sanitizar(fmt)) return;
        if (/^(P[aá]gina|Total|Subtotal|Valor|Prefeitura|Estado|Munic[ií]pio)\b/i.test(fmt)) return;
        var k = fmt.toLowerCase();
        if (seen[k]) return;
        seen[k] = 1;
        out.push(fmt);
      });
      return out;
    },

    extrair:function(){
      var f = el("pdfFile").files[0];
      if(!f){ showAlert("pdfStatus","warn","Selecione um arquivo PDF primeiro."); return; }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Carregando biblioteca e extraindo texto…');
      utils.ensurePdfJs().then(function(){
        var reader = new FileReader();
        reader.onload = function(){
          var data = new Uint8Array(reader.result);
          window.pdfjsLib.getDocument({data:data}).promise.then(function(pdf){
            var pages=[], p;
            var chain = Promise.resolve();
            for(p=1;p<=pdf.numPages;p++){
              (function(pg){
                chain = chain.then(function(){
                  return pdf.getPage(pg).then(function(page){
                    return page.getTextContent().then(function(tc){
                      var items = (tc.items || []).slice();
                      items.sort(function (a, b) {
                        var ya = a.transform ? a.transform[5] : 0;
                        var yb = b.transform ? b.transform[5] : 0;
                        if (Math.abs(ya - yb) > 3) return yb - ya;
                        var xa = a.transform ? a.transform[4] : 0;
                        var xb = b.transform ? b.transform[4] : 0;
                        return xa - xb;
                      });
                      var pageLines = [];
                      var buf = [];
                      var lastY = null;
                      for (var ii = 0; ii < items.length; ii++) {
                        var it = items[ii];
                        var str = it.str || "";
                        if (!str.trim()) continue;
                        var y = it.transform ? it.transform[5] : 0;
                        if (lastY !== null && Math.abs(y - lastY) > 3) {
                          if (buf.length) pageLines.push(buf.join(" ").replace(/\s+/g, " ").trim());
                          buf = [];
                        }
                        buf.push(str);
                        lastY = y;
                      }
                      if (buf.length) pageLines.push(buf.join(" ").replace(/\s+/g, " ").trim());
                      pages.push(pageLines.join("\n"));
                    });
                  });
                });
              })(p);
            }
            chain.then(function(){
              var full = pages.join("\n");
              var items = LICSYSTEM.captacao.splitEdital(full);
              LICSYSTEM.state.captacaoLines = items;
              LICSYSTEM.state.capPage = 1;
              LICSYSTEM.captacao.render(items);
              showAlert("pdfStatus","ok","Texto extraído: "+items.length+" linha(s) no formato qtd + UN + descrição (ex.: 100,000 UN Viga 5x15mt - Viga 5x15mt).");
            });
          }).catch(function(err){
            showAlert("pdfStatus","error","Erro ao ler PDF: "+utils.escapeHtml(err.message));
          });
        };
        reader.readAsArrayBuffer(f);
      }).catch(function(err){
        showAlert("pdfStatus","error","Falha ao carregar pdf.js: "+utils.escapeHtml(err.message)+" — verifique a conexão.");
      });
    },

    // Uma <tr> por item, com checkbox individual — paginado (100/página)
    render:function(lines, filterAll){
      var kw = (el("pdfKeywords").value||"").split(",").map(function(s){return utils.fold(s).toLowerCase().trim();}).filter(Boolean);
      var body = el("captacaoBody");
      var data = lines || LICSYSTEM.state.captacaoLines || [];
      var filtered = data.filter(function(l){
        return utils.isLinhaProdutoEdital(l);
      });
      if(kw.length && !filterAll){
        filtered = filtered.filter(function(l){
          var t = utils.fold(l).toLowerCase();
          return kw.some(function(k){ return t.indexOf(k) !== -1; });
        });
      }
      LICSYSTEM.state.capFiltered = filtered;
      var size = LICSYSTEM.state.capPageSize || 100;
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      if(!LICSYSTEM.state.capPage || LICSYSTEM.state.capPage < 1) LICSYSTEM.state.capPage = 1;
      if(LICSYSTEM.state.capPage > pages) LICSYSTEM.state.capPage = pages;

      if(!total){
        body.innerHTML='<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Nenhuma linha corresponde ao filtro.</td></tr>';
        LICSYSTEM.captacao.updatePager();
        return;
      }

      var page = LICSYSTEM.state.capPage;
      var start = (page - 1) * size;
      var end = Math.min(start + size, total);
      var html="";
      for(var idx = start; idx < end; idx++){
        var l = filtered[idx];
        if(!utils.isLinhaProdutoEdital(l)) continue;
        var linha = utils.formatLinhaEdital(l) || l;
        var risco = utils.riscoMatch(linha);
        var flag = risco.length ? '<span class="risk-flag" title="Risco: '+utils.escapeHtml(risco.join(", "))+'">⚠</span>' : "";
        html+='<tr class="'+(risco.length?'risk-row':'')+'" data-item-idx="'+idx+'">'+
          '<td><input type="checkbox" class="capChk" data-line="'+utils.escapeHtml(linha)+'" aria-label="Selecionar item '+(idx+1)+'"></td>'+
          '<td>'+(idx+1)+'</td>'+
          '<td>'+flag+utils.escapeHtml(linha)+'</td>'+
          '<td><button type="button" class="btn btn-ghost btn-sm capGoogle" data-q="'+utils.escapeHtml(utils.nomeProdutoEdital(linha))+'">🔎 Google</button></td>'+
          '</tr>';
      }
      body.innerHTML = html;
      var all = el("capCheckAll");
      if(all) all.checked = false;
      LICSYSTEM.captacao.updatePager();
    },

    updatePager:function(){
      var pager = el("capPager");
      var info = el("capPagerInfo");
      var prev = el("capPrev");
      var next = el("capNext");
      var total = (LICSYSTEM.state.capFiltered || []).length;
      var size = LICSYSTEM.state.capPageSize || 100;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var page = LICSYSTEM.state.capPage || 1;
      if(!pager) return;
      if(total <= size){
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? ((page - 1) * size + 1) : 0;
      var end = Math.min(page * size, total);
      if(info) info.innerHTML = "Itens <b>"+start+"–"+end+"</b> de <b>"+total+"</b> · Página <b>"+page+"</b>/"+pages+" (100 por página)";
      if(prev) prev.disabled = page <= 1;
      if(next) next.disabled = page >= pages;
    },

    goPage:function(delta){
      var size = LICSYSTEM.state.capPageSize || 100;
      var total = (LICSYSTEM.state.capFiltered || []).length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var next = (LICSYSTEM.state.capPage || 1) + delta;
      if(next < 1) next = 1;
      if(next > pages) next = pages;
      LICSYSTEM.state.capPage = next;
      LICSYSTEM.captacao.render(LICSYSTEM.state.captacaoLines, false);
    },

    exportarPdf:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      if(!checks.length){ showAlert("pdfStatus","warn","Selecione ao menos um item para exportar."); return; }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Gerando PDF…');
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"portrait"});
        return licsystemPdfHeader(doc,"Itens Selecionados do Edital").then(function(startY){
          var rows=[];
          checks.forEach(function(c,i){ rows.push([i+1, c.getAttribute("data-line")]); });
          doc.autoTable({
            startY:startY, head:[["#","Item / Descrição"]], body:rows,
            styles:{fontSize:9,cellPadding:3},
            headStyles:{fillColor:[21,38,66],textColor:255},
            columnStyles:{0:{cellWidth:14}},
            alternateRowStyles:{fillColor:[248,250,253]}
          });
          doc.save("edital-itens-selecionados.pdf");
          showAlert("pdfStatus","ok","PDF gerado com "+rows.length+" itens.");
        });
      }).catch(function(err){ showAlert("pdfStatus","error","Falha ao gerar PDF: "+utils.escapeHtml(err.message)); });
    },

    googleSelecionados:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      if(!checks.length){ showAlert("pdfStatus","warn","Selecione ao menos um item."); return; }
      var n=0;
      checks.forEach(function(c){
        if(n>=8) return; // avoid opening too many tabs
        var q = c.getAttribute("data-line");
        window.open("https://www.google.com/search?q="+encodeURIComponent(q),"_blank");
        n++;
      });
    },

    paraOrcamento:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      var lines;
      if(checks.length){ lines=[]; checks.forEach(function(c){ lines.push(c.getAttribute("data-line")); }); }
      else lines = LICSYSTEM.state.captacaoLines.slice();
      if(!lines.length){ showAlert("pdfStatus","warn","Nada para enviar. Extraia um edital primeiro."); return; }
      LICSYSTEM.orcamento.addFromLines(lines);
      showAlert("pdfStatus","ok",lines.length+" linha(s) enviadas ao Orçamento.");
      if(window.__lsActivateView) window.__lsActivateView("orcamento");
    },

    /* ---------- Radar PNCP ---------- */
    buscarPncp:function(){
      var kw = (el("pncpKeywords").value||"").split(",").map(function(s){return utils.fold(s).toLowerCase().trim();}).filter(Boolean);
      var uf = el("pncpUf").value;
      var today = new Date();
      var start = new Date(); start.setDate(start.getDate()-15);
      var dIni = utils.ymd(start), dFim = utils.ymd(today);
      hideAlert("pncpAlert");
      el("pncpResults").innerHTML = '<div class="muted small"><span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Consultando PNCP…</div>';

      var url1 = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao?dataInicial="+dIni+"&dataFinal="+dFim+"&codigoModalidadeContratacao=6"+(uf?"&uf="+uf:"")+"&pagina=1&tamanhoPagina=20";
      var url2 = "https://pncp.gov.br/api/consulta/v1/contratacoes/proposta?dataFinal="+dFim+(uf?"&uf="+uf:"")+"&pagina=1";

      fetch(url1).then(function(r){
        if(!r.ok) throw new Error("HTTP "+r.status);
        return r.json();
      }).then(function(j){ LICSYSTEM.captacao._handlePncp(j, kw, uf); })
      .catch(function(){
        // fallback
        fetch(url2).then(function(r){ if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); })
          .then(function(j){ LICSYSTEM.captacao._handlePncp(j, kw, uf); })
          .catch(function(err){
            el("pncpResults").innerHTML="";
            showAlert("pncpAlert","error","Não foi possível consultar o PNCP ("+utils.escapeHtml(err.message)+"). Se você abriu via <b>file://</b>, o navegador pode bloquear a requisição (CORS). Tente abrir por um servidor local (ex.: <code>python -m http.server</code>).");
          });
      });
    },

    _handlePncp:function(json, kw, uf){
      var arr = (json && (json.data || json.items || json.resultado)) || [];
      if(!Array.isArray(arr)) arr = [];
      var matches = arr.filter(function(o){
        var obj = utils.fold(o.objetoCompra || o.objeto || o.objetoContratacao || "").toLowerCase();
        if(!kw.length) return true;
        return kw.some(function(k){ return obj.indexOf(k) !== -1; });
      });
      var box = el("pncpResults");
      if(!matches.length){
        box.innerHTML='<div class="muted small">Nenhuma contratação encontrada para os filtros informados ('+arr.length+' registros no período).</div>';
        showAlert("pncpAlert","info","Consulta concluída — nenhuma oportunidade correspondente às palavras-chave.");
        return;
      }
      // register alerts + bell
      matches.forEach(function(o){
        LICSYSTEM.state.pncpAlerts.push({
          orgao:(o.orgaoEntidade && o.orgaoEntidade.razaoSocial) || o.nomeOrgao || o.orgao || "Órgão público",
          uf:(o.unidadeOrgao && o.unidadeOrgao.ufSigla) || o.uf || uf || "",
          objeto:o.objetoCompra || o.objeto || o.objetoContratacao || ""
        });
      });
      LICSYSTEM.updateBell();
      LICSYSTEM.dashboard.renderPncp();
      showAlert("pncpAlert","ok","🎯 "+matches.length+" oportunidade(s) PNCP encontradas! Alertas adicionados ao sino.");
      var html='<div style="display:flex;flex-direction:column;gap:10px">';
      matches.forEach(function(o){
        var orgao=(o.orgaoEntidade && o.orgaoEntidade.razaoSocial) || o.nomeOrgao || o.orgao || "Órgão público";
        var objeto=o.objetoCompra || o.objeto || o.objetoContratacao || "";
        var link=o.linkSistemaOrigem || o.link || "";
        var val=o.valorTotalEstimado || o.valorGlobal || null;
        html+='<div class="result-item r-green">'+
          '<div class="ri-title">'+utils.escapeHtml(orgao)+' <span class="badge-status b-yellow">'+utils.escapeHtml((o.unidadeOrgao&&o.unidadeOrgao.ufSigla)||o.uf||uf||"")+'</span></div>'+
          '<div class="ri-sub">'+utils.escapeHtml(objeto)+'</div>'+
          (val?'<div class="small" style="margin-top:6px"><b>Estimado:</b> '+utils.formatBrl(val)+'</div>':'')+
          (link?'<div style="margin-top:8px"><a class="link" target="_blank" href="'+utils.escapeHtml(link)+'">Ver no sistema de origem ↗</a></div>':'')+
          '</div>';
      });
      html+='</div>';
      box.innerHTML=html;
    }
  };

  /* ============================ ORÇAMENTO ============================ */
  LICSYSTEM.orcamento = {
    load:function(){
      try{
        var saved = JSON.parse(localStorage.getItem(ORC_KEY) || "null");
        if(saved && Array.isArray(saved)) LICSYSTEM.state.orcItems = saved;
      }catch(e){}
      if(!LICSYSTEM.state.orcItems.length){
        LICSYSTEM.state.orcItems = [ {produto:"",qtd:1,vunit:0,pct:0,link:""} ];
      }
    },
    save:function(){
      try{
        localStorage.setItem(ORC_KEY, JSON.stringify(LICSYSTEM.state.orcItems));
      }catch(e){
        console.warn("Orçamento: não foi possível salvar tudo no navegador (limite de armazenamento).", e);
      }
    },
    calcTotal:function(it){
      var q=Number(it.qtd)||0, v=Number(it.vunit)||0, p=Number(it.pct)||0;
      return q*v*(1+p/100);
    },
    pageCount:function(){
      var n = LICSYSTEM.state.orcItems.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      return Math.max(1, Math.ceil(n / size) || 1);
    },
    clampPage:function(){
      var pages = LICSYSTEM.orcamento.pageCount();
      if(!LICSYSTEM.state.orcPage || LICSYSTEM.state.orcPage < 1) LICSYSTEM.state.orcPage = 1;
      if(LICSYSTEM.state.orcPage > pages) LICSYSTEM.state.orcPage = pages;
      return LICSYSTEM.state.orcPage;
    },
    updatePager:function(){
      var pager = el("orcPager");
      var info = el("orcPagerInfo");
      var prev = el("orcPrev");
      var next = el("orcNext");
      if(!pager) return;
      var total = LICSYSTEM.state.orcItems.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      var pages = LICSYSTEM.orcamento.pageCount();
      var page = LICSYSTEM.orcamento.clampPage();
      if(total <= size){
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? ((page - 1) * size + 1) : 0;
      var end = Math.min(page * size, total);
      if(info) info.innerHTML = "Itens <b>"+start+"–"+end+"</b> de <b>"+total+"</b> · Página <b>"+page+"</b>/"+pages+" (100 por página)";
      if(prev) prev.disabled = page <= 1;
      if(next) next.disabled = page >= pages;
    },
    goPage:function(delta){
      var pages = LICSYSTEM.orcamento.pageCount();
      var next = (LICSYSTEM.state.orcPage || 1) + delta;
      if(next < 1) next = 1;
      if(next > pages) next = pages;
      LICSYSTEM.state.orcPage = next;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render({ save:false });
    },
    render:function(opts){
      opts = opts || {};
      var body = el("orcBody");
      if(!body) return;
      var items = LICSYSTEM.state.orcItems;
      var n = items.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      var page = LICSYSTEM.orcamento.clampPage();
      var start = (page - 1) * size;
      var end = Math.min(start + size, n);

      // Total geral sempre de TODOS os itens (não só da página)
      var geral = 0;
      for(var g = 0; g < n; g++) geral += LICSYSTEM.orcamento.calcTotal(items[g]);

      var buf = [];
      for(var i = start; i < end; i++){
        var it = items[i];
        var total = LICSYSTEM.orcamento.calcTotal(it);
        var risco = utils.riscoMatch(it.produto);
        var flag = risco.length ? '<span class="risk-flag" title="Risco: '+utils.escapeHtml(risco.join(", "))+'">⚠</span>' : "";
        buf.push(
          '<tr class="'+(risco.length?'risk-row':'')+'" data-item-idx="'+i+'">'+
          '<td><input type="checkbox" class="orcChk" data-i="'+i+'" aria-label="Selecionar item '+(i+1)+'"></td>'+
          '<td>'+(i+1)+'</td>'+
          '<td class="'+(risco.length?'risk-cell':'')+'">'+flag+'<input type="text" data-i="'+i+'" data-f="produto" value="'+utils.escapeHtml(it.produto)+'" placeholder="Descrição"></td>'+
          '<td><input type="number" data-i="'+i+'" data-f="qtd" value="'+utils.escapeHtml(it.qtd)+'" step="1" min="0"></td>'+
          '<td><input type="number" data-i="'+i+'" data-f="vunit" value="'+utils.escapeHtml(it.vunit)+'" step="0.01" min="0"></td>'+
          '<td><input type="number" data-i="'+i+'" data-f="pct" value="'+utils.escapeHtml(it.pct)+'" step="0.1"></td>'+
          '<td style="font-weight:700;color:var(--ls-navy)">'+utils.formatBrl(total)+'</td>'+
          '<td><input type="text" data-i="'+i+'" data-f="link" value="'+utils.escapeHtml(it.link||"")+'" placeholder="URL"></td>'+
          '<td><div class="btn-row" style="margin:0">'+
            '<button type="button" class="btn btn-ghost btn-sm orcGoogle" data-i="'+i+'">G</button>'+
            '<button type="button" class="btn btn-ghost btn-sm orcMl" data-i="'+i+'">ML</button></div></td>'+
          '<td><button type="button" class="btn btn-ghost btn-sm orcDel" data-i="'+i+'">✕</button></td>'+
          '</tr>'
        );
      }
      if(!buf.length){
        body.innerHTML = '<tr><td colspan="10" class="muted" style="text-align:center;padding:20px">Nenhum item nesta página.</td></tr>';
      } else {
        body.innerHTML = buf.join("");
      }
      el("orcTotalGeral").textContent = utils.formatBrl(geral);
      var all = el("orcCheckAll");
      if(all) all.checked = false;
      LICSYSTEM.state._orcDirty = false;
      LICSYSTEM.state._orcRendered = true;
      LICSYSTEM.orcamento.updatePager();
      if(opts.save !== false) LICSYSTEM.orcamento.save();
    },
    addLinha:function(){
      LICSYSTEM.state.orcItems.push({produto:"",qtd:1,vunit:0,pct:0,link:""});
      LICSYSTEM.state.orcPage = LICSYSTEM.orcamento.pageCount();
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },
    addFromLines:function(lines){
      (lines || []).forEach(function(l){
        var desc = String(l).trim();
        if(!desc || !utils.sanitizar(desc)) return;
        LICSYSTEM.state.orcItems.push({produto:desc, qtd:1, vunit:0, pct:0, link:"", selected:false});
      });
      // remove initial empty row if present
      LICSYSTEM.state.orcItems = LICSYSTEM.state.orcItems.filter(function(it,idx){
        return !(idx===0 && !it.produto && !Number(it.vunit));
      });
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },
    limpar:function(){
      if(!confirm("Limpar toda a planilha de orçamento?")) return;
      LICSYSTEM.state.orcItems = [ {produto:"",qtd:1,vunit:0,pct:0,link:""} ];
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },

    handleFile:function(file){
      if(!file) return;
      showAlertOrc('<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Lendo planilha…',"info");
      utils.ensureXlsx().then(function(){
        var reader = new FileReader();
        reader.onload = function(){
          try{
            var wb = XLSX.read(new Uint8Array(reader.result), {type:"array"});
            var ws = wb.Sheets[wb.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
            LICSYSTEM.orcamento._mapRows(rows);
          }catch(err){ showAlertOrc("Erro ao ler arquivo: "+utils.escapeHtml(err.message),"error"); }
        };
        reader.readAsArrayBuffer(file);
      }).catch(function(err){ showAlertOrc("Falha ao carregar SheetJS: "+utils.escapeHtml(err.message),"error"); });
      function showAlertOrc(msg,type){
        var d=el("orcDrop"); d.innerHTML='<span class="big">📊</span>'+msg;
        setTimeout(function(){ LICSYSTEM.orcamento._restoreDrop(); }, type==="info"?60000:4000);
      }
    },
    _restoreDrop:function(){
      el("orcDrop").innerHTML='<span class="big">📊</span><b>Arraste um Excel/CSV aqui</b> ou clique para selecionar<br/><span class="small muted">Mapeamento automático de colunas (descrição, qtd, valor)</span><input type="file" id="orcFile" accept=".xlsx,.xls,.csv" style="display:none" />';
      wireOrcFileInput();
    },
    _mapRows:function(rows){
      if(!rows || !rows.length){ LICSYSTEM.orcamento._restoreDrop(); return; }
      // find header row heuristically
      var header = rows[0].map(function(c){ return utils.fold(String(c)).toLowerCase().trim(); });
      var colDesc=-1, colQtd=-1, colVal=-1;
      header.forEach(function(h,i){
        if(colDesc<0 && (h.indexOf("descr")!==-1 || h.indexOf("produto")!==-1 || h.indexOf("item")!==-1 || h.indexOf("especific")!==-1)) colDesc=i;
        if(colQtd<0 && (h.indexOf("qtd")!==-1 || h.indexOf("quant")!==-1)) colQtd=i;
        if(colVal<0 && (h.indexOf("valor")!==-1 || h.indexOf("preco")!==-1 || h.indexOf("unit")!==-1 || h.indexOf("custo")!==-1)) colVal=i;
      });
      var startRow = 1;
      if(colDesc<0){ colDesc=0; startRow=0; } // no header — assume first col desc
      var added=0;
      for(var r=startRow;r<rows.length;r++){
        var row = rows[r];
        var desc = String(row[colDesc]!=null?row[colDesc]:"").trim();
        if(!desc) continue;
        // mesma BLACKLIST da captação — descarta cabeçalhos/metadados
        if(!utils.sanitizar(desc)) continue;
        var qtd = colQtd>=0 ? parseNum(row[colQtd]) : 1;
        var val = colVal>=0 ? parseNum(row[colVal]) : 0;
        // cada linha Excel = um item individual (checkbox no render)
        LICSYSTEM.state.orcItems.push({produto:desc, qtd:qtd||1, vunit:val||0, pct:0, link:"", selected:false});
        added++;
        if(added>=1000) break;
      }
      LICSYSTEM.state.orcItems = LICSYSTEM.state.orcItems.filter(function(it,idx){
        return !(idx===0 && !it.produto && !Number(it.vunit));
      });
      LICSYSTEM.orcamento.render();
      LICSYSTEM.orcamento._restoreDrop();
      function parseNum(v){
        if(v==null) return 0;
        var s=String(v).replace(/[^0-9,.-]/g,"").replace(/\.(?=\d{3}(\D|$))/g,"").replace(",",".");
        var n=parseFloat(s); return isFinite(n)?n:0;
      }
    },

    gerarProposta:function(){
      if(!LICSYSTEM.state.orcItems.length){ alert("Planilha vazia."); return; }
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"landscape"});
        return licsystemPdfHeader(doc,"Proposta Comercial", true).then(function(startY){
          var y = startY;
          if(LICSYSTEM.state.lastBdi){
            doc.setFontSize(9); doc.setTextColor(90);
            doc.text("BDI aplicado (último cruzamento): Margem "+LICSYSTEM.state.lastBdi.margem+"% | Imposto "+LICSYSTEM.state.lastBdi.imposto+"% | Custo Op. "+LICSYSTEM.state.lastBdi.custoOperacional+"%", 14, y);
            y+=6;
          }
          var rows=[], geral=0;
          LICSYSTEM.state.orcItems.forEach(function(it,i){
            if(!it.produto) return;
            var total=LICSYSTEM.orcamento.calcTotal(it); geral+=total;
            rows.push([i+1, it.produto, it.qtd, utils.formatBrl(it.vunit), it.pct+"%", utils.formatBrl(total)]);
          });
          doc.autoTable({
            startY:y+2,
            head:[["#","Descrição","Qtd","V. Unit","Margem","Total"]],
            body:rows,
            foot:[["","","","","TOTAL GERAL", utils.formatBrl(geral)]],
            styles:{fontSize:9,cellPadding:3},
            headStyles:{fillColor:[21,38,66],textColor:255},
            footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
            alternateRowStyles:{fillColor:[248,250,253]}
          });
          doc.save("proposta-comercial-licsystem.pdf");
        });
      }).catch(function(err){ alert("Falha ao gerar PDF: "+err.message); });
    },

    onEdit:function(i,f,val){
      var it=LICSYSTEM.state.orcItems[i]; if(!it) return;
      if(f==="produto"||f==="link") it[f]=val;
      else it[f]=Number(val)||0;
      LICSYSTEM.state._orcDirty = true;
      // Atualiza só o total da linha + geral (não remonta 2000 linhas)
      var row = document.querySelector('#orcBody tr[data-item-idx="'+i+'"]');
      if(row && row.cells && row.cells[6]){
        row.cells[6].textContent = utils.formatBrl(LICSYSTEM.orcamento.calcTotal(it));
      }
      var geral = 0;
      for(var k=0;k<LICSYSTEM.state.orcItems.length;k++){
        geral += LICSYSTEM.orcamento.calcTotal(LICSYSTEM.state.orcItems[k]);
      }
      if(el("orcTotalGeral")) el("orcTotalGeral").textContent = utils.formatBrl(geral);
      clearTimeout(LICSYSTEM.orcamento._saveTimer);
      LICSYSTEM.orcamento._saveTimer = setTimeout(function(){
        LICSYSTEM.orcamento.save();
        LICSYSTEM.state._orcDirty = false;
      }, 400);
    }
  };

  /* ============================ CRUZAMENTO ============================ */
  LICSYSTEM.cruzamento = {
    BATCH_SIZE: 20,
    REQUEST_DELAY_MS: 1000,
    _busy: false,

    sleep: function(ms){
      return new Promise(function(resolve){ setTimeout(resolve, ms); });
    },

    setProgress: function(done, total, label){
      var bar = el("progress-bar");
      var lab = el("progressLabel");
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if(bar){
        bar.style.width = pct + "%";
        bar.setAttribute("aria-valuenow", String(pct));
      }
      if(lab) lab.textContent = label || (done + " / " + total + " itens (" + pct + "%)");
    },

    getSelectedItens: function(){
      var selected = [];
      document.querySelectorAll(".orcChk:checked").forEach(function(c){
        var i = Number(c.getAttribute("data-i"));
        var it = LICSYSTEM.state.orcItems[i];
        if(it && String(it.produto||"").trim()){
          selected.push({ fonte:"orcamento", index:i, descricao:String(it.produto).trim() });
        }
      });
      if(!selected.length){
        var avulso = (el("cruzItem").value || "").trim();
        if(avulso) selected.push({ fonte:"avulso", index:-1, descricao:avulso });
      }
      return selected;
    },

    resolveCep: function(){
      return LICSYSTEM.ferramentas.getPerfil().then(function(perfil){
        var cepPerfil = String((perfil && perfil.cep) || "").replace(/\D/g,"");
        var cepInput = (el("cruzCep").value || "").replace(/\D/g,"");
        if(cepPerfil && el("cruzCep") && !cepInput) el("cruzCep").value = cepPerfil;
        return cepPerfil || cepInput || "";
      }).catch(function(){
        return (el("cruzCep").value || "").replace(/\D/g,"");
      });
    },

    fetchFrete: function(itemId, cep, permalink){
      if(!cep) return Promise.resolve({ cost:0, note:"CEP do perfil não informado" });
      // Sempre via proxy backend (evita 403/CORS no browser). permalink resolve ID real do anúncio.
      return utils.mlShipping(itemId, cep, permalink).then(function(sj){
        if(sj && typeof sj.cost === "number" && (sj.cost > 0 || (sj.options && sj.options.length) || /grátis|gratis|R\$\s*0/i.test(sj.note||""))){
          return { cost: sj.cost, note: sj.note || "", itemId: sj.itemId || itemId };
        }
        var opts = (sj && sj.options) || [];
        var cost = 0, found = false;
        opts.forEach(function(o){
          if(typeof o.cost === "number"){
            if(!found || o.cost < cost){ cost = o.cost; found = true; }
          }
        });
        return { cost: found ? cost : (Number(sj && sj.cost) || 0), note: found ? (sj.note || "") : (sj.note || "Frete não retornado"), itemId: (sj && sj.itemId) || itemId };
      }).catch(function(err){
        return { cost:0, note:"Falha ao consultar frete via proxy" + (err && err.message ? " ("+err.message+")" : "") };
      });
    },

    calcValorFinal: function(precoMl, frete, desconto, margem, imposto, custoOp){
      var base = (Number(precoMl)||0) + (Number(frete)||0) - (Number(desconto)||0);
      if(base < 0) base = 0;
      return base * (1 + ((Number(margem)||0) + (Number(imposto)||0) + (Number(custoOp)||0)) / 100);
    },

    processarItem: function(termo, opts){
      var embalagem = opts.embalagem;
      var cep = opts.cep;
      var margem = opts.margem;
      var imposto = opts.imposto;
      var custoOp = opts.custoOp;
      var desconto = opts.desconto;
      var query = utils.mlQueryFromTermo(termo, embalagem);
      if(!query) return Promise.resolve(null);

      // Busca SOMENTE pelo proxy (/api/ml-proxy) — nunca direto no Mercado Livre
      return utils.mlSearch(query, 5).then(function(j){
        var results = ((j && j.results) || []).filter(function(it){
          return it.available_quantity !== 0;
        });
        // Se veio vazio, tenta so as 3 primeiras palavras (mais generico)
        if(!results.length){
          var shortQ = query.split(/\s+/).slice(0, 3).join(" ");
          if(shortQ && shortQ !== query){
            return utils.mlSearch(shortQ, 5).then(function(j2){
              return LICSYSTEM.cruzamento._finishMlItem(termo, opts, j2 || j, shortQ);
            });
          }
        }
        return LICSYSTEM.cruzamento._finishMlItem(termo, opts, j, query);
      }).catch(function(err){
        var msg = (err && err.message) ? err.message : String(err);
        if(/failed to fetch|NetworkError|Load failed/i.test(msg)){
          msg = "Proxy /api/ml-proxy indisponivel. Faca deploy na Vercel com a pasta api/.";
        }
        throw new Error(msg);
      });
    },

    _finishMlItem: function(termo, opts, j, queryUsada){
      var embalagem = opts.embalagem;
      var cep = opts.cep;
      var margem = opts.margem;
      var imposto = opts.imposto;
      var custoOp = opts.custoOp;
      var desconto = opts.desconto;
      var results = ((j && j.results) || []).filter(function(it){
        return it.available_quantity !== 0;
      });
      if(!results.length){
        var motivo = "Sem produto no ML para \"" + (queryUsada || termo) + "\".";
        if(j && j.upstream_status === 403){
          motivo += " API oficial bloqueada — e necessario redeploy do proxy (pasta api/) na Vercel.";
        } else if(j && j.warning){
          motivo += " " + j.warning;
        }
        return { skipped:true, itemGoverno:termo, motivo:motivo };
      }

      results.forEach(function(it){ it.__sim = utils.similaridade(termo, it.title); });
      results.sort(function(a,b){ return b.__sim - a.__sim; });
      var best = results[0];

      return LICSYSTEM.cruzamento.fetchFrete(best.id, cep, best.permalink || "").then(function(fr){
        var precoMl = Number(best.price)||0;
        var frete = Number(fr.cost)||0;
        var custoReal = Math.max(0, precoMl + frete - desconto);
        var precoVenda = LICSYSTEM.cruzamento.calcValorFinal(precoMl, frete, desconto, margem, imposto, custoOp);
        var sim = best.__sim;
        var status, cls, statusLabel;
        if(sim>=80){ status="Match Automatico"; cls="r-green"; statusLabel="b-green"; }
        else if(sim>=60){ status="Revisao Manual"; cls="r-yellow"; statusLabel="b-yellow"; }
        else { status="Descartado"; cls="r-red"; statusLabel="b-red"; }

        var idMl = (fr && fr.itemId) || best.id;
        var notes = [];
        if(fr && fr.note) notes.push(fr.note);
        if(!(precoMl > 0)) notes.push("Preco nao retornado — informe manualmente.");
        if(j && j.source === "public_index" && precoMl > 0){
          /* silencioso: fallback ok com preco */
        }

        var record = {
          itemGoverno: termo,
          produtoML: best.title,
          idML: idMl,
          custoProduto: precoMl,
          frete: frete,
          descontoFornecedor: desconto,
          custoReal: custoReal,
          precoVenda: precoVenda,
          margem: margem,
          imposto: imposto,
          custoOperacional: custoOp,
          embalagem: embalagem,
          similaridade: sim,
          status: status,
          link: best.permalink || "",
          cepUsado: cep,
          mlSource: (j && j.source) || "proxy",
          queryUsada: queryUsada || "",
          processadoEm: new Date().toISOString()
        };
        return { record:record, cls:cls, statusLabel:statusLabel, freteNote:notes.join(" · ") };
      });
    },

    processar: function(){
      if(LICSYSTEM.cruzamento._busy){
        showAlert("cruzStatus","warn","Já existe um lote em andamento.");
        return;
      }

      var itens = LICSYSTEM.cruzamento.getSelectedItens();
      if(!itens.length){
        showAlert("cruzStatus","warn","Selecione itens no Orçamento (checkbox) ou informe um item avulso.");
        return;
      }

      var embalagem = (document.querySelector('input[name=embalagem]:checked')||{}).value || "unidade";
      var margem = Number(el("cruzMargem").value)||0;
      var imposto = Number(el("cruzImposto").value)||0;
      var custoOp = Number(el("cruzCustoOp").value)||0;
      var desconto = Number((el("cruzDesconto") && el("cruzDesconto").value) || 0) || 0;
      LICSYSTEM.state.lastBdi = { margem:margem, imposto:imposto, custoOperacional:custoOp, descontoFornecedor:desconto };

      if(utils.hasFirebaseConfig()){
        showAlert("cruzMode","info","Lote ML — resultados aprovados serão gravados no Realtime Database. CEP do perfil será usado no frete.");
      } else {
        hideAlert("cruzMode");
      }

      var btn = el("btnCruzar");
      if(btn){ btn.disabled = true; btn.textContent = "⏳ Processando…"; }
      LICSYSTEM.cruzamento._busy = true;
      el("cruzResults").innerHTML = "";
      LICSYSTEM.cruzamento.setProgress(0, itens.length, "Preparando lote de "+itens.length+" item(ns)…");
      showAlert("cruzStatus","info",'<span class="spinner"></span> Processando lote (grupos de '+LICSYSTEM.cruzamento.BATCH_SIZE+', delay '+ (LICSYSTEM.cruzamento.REQUEST_DELAY_MS/1000) +'s)…');

      LICSYSTEM.cruzamento.resolveCep().then(function(cep){
        var opts = { embalagem:embalagem, cep:cep, margem:margem, imposto:imposto, custoOp:custoOp, desconto:desconto };
        var done = 0;
        var total = itens.length;
        var ok = 0, fail = 0;

        function runBatch(start){
          if(start >= total){
            LICSYSTEM.cruzamento._busy = false;
            if(btn){ btn.disabled = false; btn.textContent = "⚙️ Processar Lote (ML)"; }
            LICSYSTEM.cruzamento.setProgress(total, total, "Concluído: "+ok+" ok · "+fail+" falha(s)/sem match");
            showAlert("cruzStatus","ok","✅ Lote finalizado — "+ok+" processado(s), "+fail+" sem resultado/erro.");
            return Promise.resolve();
          }

          var end = Math.min(start + LICSYSTEM.cruzamento.BATCH_SIZE, total);
          var chunk = itens.slice(start, end);
          var seq = Promise.resolve();

          chunk.forEach(function(item, idxInChunk){
            seq = seq.then(function(){
              var globalIdx = start + idxInChunk;
              LICSYSTEM.cruzamento.setProgress(done, total, "Grupo "+(Math.floor(start/LICSYSTEM.cruzamento.BATCH_SIZE)+1)+" — item "+(globalIdx+1)+"/"+total+": "+item.descricao.slice(0,48));
              return LICSYSTEM.cruzamento.processarItem(item.descricao, opts).then(function(out){
                done++;
                if(!out || out.skipped){
                  fail++;
                  if(out && out.skipped){
                    el("cruzResults").insertAdjacentHTML("afterbegin",
                      '<div class="result-item r-red"><div class="ri-title">'+utils.escapeHtml(out.itemGoverno)+'</div>'+
                      '<div class="ri-sub">'+utils.escapeHtml(out.motivo||"Ignorado")+'</div></div>');
                  }
                } else {
                  ok++;
                  LICSYSTEM.cruzamento.renderResult(out.record, out.cls, out.statusLabel, out.freteNote);
                  if(out.record.similaridade >= 80) LICSYSTEM.cruzamento.aprovar(out.record, true);
                }
                LICSYSTEM.cruzamento.setProgress(done, total);
                // delay 1s entre cada requisição (exceto após o último do lote total)
                if(globalIdx < total - 1) return LICSYSTEM.cruzamento.sleep(LICSYSTEM.cruzamento.REQUEST_DELAY_MS);
              }).catch(function(err){
                done++; fail++;
                el("cruzResults").insertAdjacentHTML("afterbegin",
                  '<div class="result-item r-red"><div class="ri-title">'+utils.escapeHtml(item.descricao)+'</div>'+
                  '<div class="ri-sub">Erro: '+utils.escapeHtml(err.message||String(err))+'</div></div>');
                LICSYSTEM.cruzamento.setProgress(done, total);
                if(globalIdx < total - 1) return LICSYSTEM.cruzamento.sleep(LICSYSTEM.cruzamento.REQUEST_DELAY_MS);
              });
            });
          });

          return seq.then(function(){ return runBatch(end); });
        }

        return runBatch(0);
      }).catch(function(err){
        LICSYSTEM.cruzamento._busy = false;
        if(btn){ btn.disabled = false; btn.textContent = "⚙️ Processar Lote (ML)"; }
        showAlert("cruzStatus","error","Falha no motor de cruzamento: "+utils.escapeHtml(err.message||String(err)));
      });
    },

    renderResult:function(rec, cls, statusLabel, freteNote){
      var box = el("cruzResults");
      var id = "res_"+Date.now()+"_"+Math.floor(Math.random()*1000);
      var showForce = (rec.similaridade>=60 && rec.similaridade<80);
      var html='<div class="result-item '+cls+'" id="'+id+'">'+
        '<div class="ri-head">'+
          '<div><div class="ri-title">'+utils.escapeHtml(rec.produtoML)+'</div>'+
          '<div class="ri-sub">Item edital: '+utils.escapeHtml(rec.itemGoverno)+'</div></div>'+
          '<div style="text-align:right"><div class="sim-ring" style="color:'+(rec.similaridade>=80?'#1e9e5a':rec.similaridade>=60?'#c9911f':'#d23b3b')+'">'+rec.similaridade+'%</div>'+
          '<span class="badge-status '+statusLabel+'">'+utils.escapeHtml(rec.status)+'</span></div>'+
        '</div>'+
        '<div class="ri-grid">'+
          metric("Preço ML", utils.formatBrl(rec.custoProduto))+
          metric("Frete", utils.formatBrl(rec.frete)+(freteNote?' <span class="small muted">('+utils.escapeHtml(freteNote)+')</span>':''))+
          metric("Desconto Forn.", utils.formatBrl(rec.descontoFornecedor||0))+
          metric("Custo Real", utils.formatBrl(rec.custoReal))+
          metric("Valor Final", utils.formatBrl(rec.precoVenda))+
          metric("Embalagem", rec.embalagem)+
        '</div>'+
        '<div class="btn-row" style="margin-top:12px">'+
          (rec.link?'<a class="btn btn-ghost btn-sm" target="_blank" href="'+utils.escapeHtml(rec.link)+'">🔗 Ver Anúncio</a>':'')+
          (showForce?'<button type="button" class="btn btn-green btn-sm cruzForce">✔ Forçar Aprovação</button>':'')+
        '</div></div>';
      box.insertAdjacentHTML("afterbegin", html);
      if(showForce){
        var node = el(id).querySelector(".cruzForce");
        node.addEventListener("click", function(){
          LICSYSTEM.cruzamento.aprovar(rec, false);
          node.textContent="✔ Aprovado";
          node.disabled=true;
          node.classList.remove("btn-green"); node.classList.add("btn-ghost");
        });
      }
      function metric(l,v){ return '<div class="ri-metric"><div class="m-l">'+utils.escapeHtml(l)+'</div><div class="m-v">'+v+'</div></div>'; }
    },

    aprovar:function(rec, auto){
      var exists = LICSYSTEM.state.aprovadosCruzamento.some(function(a){ return a.idML===rec.idML && a.itemGoverno===rec.itemGoverno; });
      if(!exists){ LICSYSTEM.state.aprovadosCruzamento.push(rec); }
      var path = utils.buildFirebasePath();
      if(utils.hasFirebaseConfig()){
        utils.firebasePush(path, rec).then(function(){
          /* silencioso em lote — status geral no fim */
        }).catch(function(){ /* silencioso */ });
      } else if(auto){
        /* modo local — silencioso em lote */
      }
    },

    gerarProposta:function(){
      if(!LICSYSTEM.state.aprovadosCruzamento.length){ alert("Nenhum item aprovado no cruzamento ainda."); return; }
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"landscape"});
        return licsystemPdfHeader(doc,"Proposta Comercial — Cruzamento ML", true).then(function(startY){
          var y = startY;
          if(LICSYSTEM.state.lastBdi){
            doc.setFontSize(9); doc.setTextColor(90);
            doc.text("BDI: Margem "+LICSYSTEM.state.lastBdi.margem+"% | Imposto "+LICSYSTEM.state.lastBdi.imposto+"% | Custo Op. "+LICSYSTEM.state.lastBdi.custoOperacional+"% | Desc. "+utils.formatBrl(LICSYSTEM.state.lastBdi.descontoFornecedor||0), 14, y);
            y+=6;
          }
          var rows=[], geral=0;
          LICSYSTEM.state.aprovadosCruzamento.forEach(function(a,i){
            geral+=Number(a.precoVenda)||0;
            rows.push([i+1, a.itemGoverno, a.produtoML, a.similaridade+"%", utils.formatBrl(a.custoReal), utils.formatBrl(a.precoVenda)]);
          });
          doc.autoTable({
            startY:y+2,
            head:[["#","Item Edital","Produto ML","Sim.","Custo Real","Valor Final"]],
            body:rows,
            foot:[["","","","","TOTAL", utils.formatBrl(geral)]],
            styles:{fontSize:8.5,cellPadding:3},
            headStyles:{fillColor:[21,38,66],textColor:255},
            footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
            alternateRowStyles:{fillColor:[248,250,253]}
          });
          doc.save("proposta-cruzamento-licsystem.pdf");
        });
      }).catch(function(err){ alert("Falha ao gerar PDF: "+err.message); });
    }
  };

  /* ============================ COFRE ============================ */
  var COFRE_DOCS = [
    {key:"cnpj", label:"CNPJ (Cartão)"},
    {key:"cndFederal", label:"CND Federal"},
    {key:"cndEstadual", label:"CND Estadual"},
    {key:"cndMunicipal", label:"CND Municipal"},
    {key:"fgts", label:"FGTS (CRF)"},
    {key:"cndt", label:"INSS / CNDT"},
    {key:"balanco", label:"Balanço Patrimonial"},
    {key:"contratoSocial", label:"Contrato Social"}
  ];
  LICSYSTEM.cofre = {
    data:{},
    load:function(){
      try{ LICSYSTEM.cofre.data = JSON.parse(localStorage.getItem(COFRE_KEY) || "{}") || {}; }catch(e){ LICSYSTEM.cofre.data={}; }
    },
    statusOf:function(dateStr){
      if(!dateStr) return {cls:"b-red", txt:"Sem data"};
      var d = new Date(dateStr+"T00:00:00");
      var now = new Date(); now.setHours(0,0,0,0);
      var diff = Math.round((d - now)/86400000);
      if(diff < 0) return {cls:"b-red", txt:"Vencido"};
      if(diff <= 15) return {cls:"b-yellow", txt:"Vence em "+diff+"d"};
      return {cls:"b-green", txt:"Válido"};
    },
    render:function(){
      var box = el("cofreList");
      var html="";
      COFRE_DOCS.forEach(function(doc){
        var val = LICSYSTEM.cofre.data[doc.key] || "";
        var st = LICSYSTEM.cofre.statusOf(val);
        html+='<div class="checklist-item">'+
          '<div class="ci-name">'+utils.escapeHtml(doc.label)+'</div>'+
          '<input type="date" data-key="'+doc.key+'" value="'+utils.escapeHtml(val)+'">'+
          '<span class="badge-status '+st.cls+'">'+utils.escapeHtml(st.txt)+'</span>'+
          '</div>';
      });
      box.innerHTML = html;
      box.querySelectorAll('input[type=date]').forEach(function(inp){
        inp.addEventListener("change", function(){
          LICSYSTEM.cofre.data[inp.getAttribute("data-key")] = inp.value;
          LICSYSTEM.cofre.render();
        });
      });
    },
    save:function(){
      try{ localStorage.setItem(COFRE_KEY, JSON.stringify(LICSYSTEM.cofre.data)); showAlertTmp("Documentos salvos."); }catch(e){}
      function showAlertTmp(){ /* subtle feedback */ }
    }
  };

  /* ============================ CONCORRÊNCIA ============================ */
  LICSYSTEM.concorrencia = {
    buscar:function(){
      var raw = (el("cnpjInput").value||"").replace(/\D/g,"");
      if(raw.length !== 14){ showAlert("cnpjStatus","warn","Informe um CNPJ válido (14 dígitos)."); return; }
      showAlert("cnpjStatus","info",'<span class="spinner"></span> Consultando BrasilAPI…');
      el("cnpjResult").innerHTML="";
      fetch("https://brasilapi.com.br/api/cnpj/v1/"+raw).then(function(r){
        if(r.status===404) throw new Error("not-found");
        if(!r.ok) throw new Error("HTTP "+r.status);
        return r.json();
      }).then(function(j){
        hideAlert("cnpjStatus");
        var sit = (j.descricao_situacao_cadastral||"").toUpperCase();
        var sitCls = sit.indexOf("ATIVA")!==-1 ? "b-green" : (sit.indexOf("BAIXADA")!==-1||sit.indexOf("INAPTA")!==-1||sit.indexOf("SUSPENSA")!==-1 ? "b-red":"b-yellow");
        var html='<div class="card" style="margin:0;box-shadow:none;border-color:var(--ls-line)">'+
          '<h2 style="margin-bottom:12px">'+utils.escapeHtml(j.razao_social||j.nome_fantasia||"—")+'</h2>'+
          '<div class="ri-grid">'+
            m("Situação Cadastral", '<span class="badge-status '+sitCls+'">'+utils.escapeHtml(j.descricao_situacao_cadastral||"—")+'</span>')+
            m("Capital Social", utils.formatBrl(j.capital_social))+
            m("UF / Município", utils.escapeHtml((j.uf||"—")+" / "+(j.municipio||"—")))+
            m("Atividade Principal", utils.escapeHtml(j.cnae_fiscal_descricao||"—"))+
            m("Porte", utils.escapeHtml(j.porte||"—"))+
            m("Abertura", utils.escapeHtml(j.data_inicio_atividade||"—"))+
          '</div></div>';
        el("cnpjResult").innerHTML=html;
        function m(l,v){ return '<div class="ri-metric"><div class="m-l">'+utils.escapeHtml(l)+'</div><div class="m-v">'+v+'</div></div>'; }
      }).catch(function(err){
        if(err.message==="not-found") showAlert("cnpjStatus","error","CNPJ não encontrado.");
        else showAlert("cnpjStatus","error","Falha na consulta: "+utils.escapeHtml(err.message)+". (Se aberto via file://, pode haver bloqueio CORS.)");
      });
    }
  };

  /* ============================ PDF HEADER HELPER ============================ */
  // Returns Promise<number> — startY for content after header (fetches empresa_perfil from Firebase)
  function licsystemPdfHeader(doc, subtitle, landscape){
    return LICSYSTEM.ferramentas.getPerfil().then(function(perfil){
      var w = doc.internal.pageSize.getWidth();
      var nome = (perfil && perfil.nome) ? String(perfil.nome) : "LICSYSTEM";
      var cnpj = (perfil && perfil.cnpj) ? String(perfil.cnpj) : "";
      var telefone = (perfil && perfil.telefone) ? String(perfil.telefone) : "";
      var endereco = (perfil && perfil.endereco) ? String(perfil.endereco) : "";
      var logo = (perfil && perfil.logoBase64) ? String(perfil.logoBase64) : "";
      var hasExtra = !!(cnpj || telefone || endereco);
      var headerH = hasExtra ? 34 : 26;

      doc.setFillColor(21,38,66);
      doc.rect(0,0,w,headerH,"F");
      doc.setFillColor(201,162,39);
      doc.rect(0,headerH,w,2,"F");

      var textX = 14;
      if(logo && logo.indexOf("data:image") === 0){
        try{
          var fmt = "JPEG";
          if(/data:image\/png/i.test(logo)) fmt = "PNG";
          else if(/data:image\/webp/i.test(logo)) fmt = "WEBP";
          else if(/data:image\/gif/i.test(logo)) fmt = "GIF";
          var logoH = hasExtra ? 22 : 16;
          var logoW = logoH * 1.4;
          doc.addImage(logo, fmt, 10, (headerH - logoH) / 2, logoW, logoH);
          textX = 14 + logoW + 4;
        }catch(e){ /* logo inválido — segue sem imagem */ }
      }

      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold"); doc.setFontSize(13);
      doc.text(nome, textX, hasExtra ? 11 : 12);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.setTextColor(201,162,39);
      if(hasExtra){
        var line2 = [cnpj ? "CNPJ "+cnpj : "", telefone ? "Tel. "+telefone : ""].filter(Boolean).join("  ·  ");
        if(line2) doc.text(line2, textX, 18);
        if(endereco){
          var end = endereco.length > 90 ? endereco.slice(0,87)+"…" : endereco;
          doc.setTextColor(185,198,219);
          doc.text(end, textX, 25);
        }
      } else {
        doc.text("LICSYSTEM", textX, 19);
      }

      doc.setFontSize(8); doc.setTextColor(185,198,219);
      doc.text("Emitido em "+new Date().toLocaleString("pt-BR"), w-14, hasExtra ? 11 : 12, {align:"right"});

      var titleY = headerH + 10;
      doc.setTextColor(21,38,66); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text(subtitle||"", 14, titleY);
      return titleY + 6;
    });
  }

  /* ============================ FERRAMENTAS ============================ */
  LICSYSTEM.ferramentas = {
    _logoPending: null,

    fileToBase64: function(file){
      return new Promise(function(resolve, reject){
        if(!file){ resolve(""); return; }
        if(file.size > 1.5 * 1024 * 1024){
          reject(new Error("Logo muito grande (máx. 1,5 MB)."));
          return;
        }
        var reader = new FileReader();
        reader.onload = function(){ resolve(String(reader.result || "")); };
        reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo de logo.")); };
        reader.readAsDataURL(file);
      });
    },

    getPerfil: function(force){
      if(!force && LICSYSTEM.state.empresaPerfil) return Promise.resolve(LICSYSTEM.state.empresaPerfil);
      return utils.firebaseGet("empresa_perfil").then(function(val){
        LICSYSTEM.state.empresaPerfil = val || {
          nome: "LICSYSTEM",
          cnpj: "",
          endereco: "",
          telefone: "",
          cep: "",
          logoBase64: ""
        };
        return LICSYSTEM.state.empresaPerfil;
      }).catch(function(){
        if(!LICSYSTEM.state.empresaPerfil){
          LICSYSTEM.state.empresaPerfil = {
            nome: "LICSYSTEM",
            cnpj: "",
            endereco: "",
            telefone: "",
            cep: "",
            logoBase64: ""
          };
        }
        return LICSYSTEM.state.empresaPerfil;
      });
    },

    salvarPerfil: function(dados){
      var payload = {
        nome: String((dados && dados.nome) || "").trim(),
        cnpj: String((dados && dados.cnpj) || "").trim(),
        endereco: String((dados && dados.endereco) || "").trim(),
        telefone: String((dados && dados.telefone) || "").trim(),
        cep: String((dados && dados.cep) || "").replace(/\D/g,"").trim(),
        logoBase64: String((dados && dados.logoBase64) || ""),
        atualizadoEm: new Date().toISOString()
      };
      return utils.firebaseSet("empresa_perfil", payload).then(function(){
        LICSYSTEM.state.empresaPerfil = payload;
        return payload;
      });
    },

    fillForm: function(perfil){
      perfil = perfil || {};
      if(el("empNome")) el("empNome").value = perfil.nome || "";
      if(el("empCnpj")) el("empCnpj").value = perfil.cnpj || "";
      if(el("empEndereco")) el("empEndereco").value = perfil.endereco || "";
      if(el("empTelefone")) el("empTelefone").value = perfil.telefone || "";
      if(el("empCep")) el("empCep").value = perfil.cep || "";
      var prev = el("empLogoPreview");
      if(prev){
        if(perfil.logoBase64){
          prev.src = perfil.logoBase64;
          prev.style.display = "block";
        } else {
          prev.removeAttribute("src");
          prev.style.display = "none";
        }
      }
      LICSYSTEM.ferramentas._logoPending = perfil.logoBase64 || null;
    },

    carregarView: function(){
      showAlert("ferramentasStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Carregando perfil…');
      LICSYSTEM.ferramentas.getPerfil(true).then(function(perfil){
        LICSYSTEM.ferramentas.fillForm(perfil);
        hideAlert("ferramentasStatus");
      }).catch(function(err){
        showAlert("ferramentasStatus","error","Não foi possível carregar o perfil: "+utils.escapeHtml(err.message));
      });
    },

    onSalvarClick: function(){
      var file = el("empLogo") && el("empLogo").files && el("empLogo").files[0];
      showAlert("ferramentasStatus","info",'<span class="spinner"></span> Salvando perfil…');
      var basePromise = file
        ? LICSYSTEM.ferramentas.fileToBase64(file)
        : Promise.resolve(LICSYSTEM.ferramentas._logoPending || (LICSYSTEM.state.empresaPerfil && LICSYSTEM.state.empresaPerfil.logoBase64) || "");

      basePromise.then(function(logoBase64){
        return LICSYSTEM.ferramentas.salvarPerfil({
          nome: el("empNome").value,
          cnpj: el("empCnpj").value,
          endereco: el("empEndereco").value,
          telefone: el("empTelefone").value,
          cep: el("empCep") ? el("empCep").value : "",
          logoBase64: logoBase64
        });
      }).then(function(){
        showAlert("ferramentasStatus","ok","✅ Perfil salvo em empresa_perfil.");
        if(el("empLogo")) el("empLogo").value = "";
      }).catch(function(err){
        showAlert("ferramentasStatus","error","Falha ao salvar: "+utils.escapeHtml(err.message));
      });
    },

    onLogoChange: function(){
      var file = el("empLogo") && el("empLogo").files && el("empLogo").files[0];
      if(!file) return;
      LICSYSTEM.ferramentas.fileToBase64(file).then(function(b64){
        LICSYSTEM.ferramentas._logoPending = b64;
        var prev = el("empLogoPreview");
        if(prev){ prev.src = b64; prev.style.display = "block"; }
      }).catch(function(err){
        showAlert("ferramentasStatus","warn",utils.escapeHtml(err.message));
      });
    },

    exportarBackup: function(){
      showAlert("backupStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Exportando licitacoes/…');
      utils.firebaseGet("licitacoes").then(function(data){
        var payload = {
          exportadoEm: new Date().toISOString(),
          origem: "licitacoes",
          licitacoes: data || {}
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "backup-licsystem-"+utils.ymd()+".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
        showAlert("backupStatus","ok","✅ Backup baixado (nó licitacoes/).");
      }).catch(function(err){
        showAlert("backupStatus","error","Falha ao exportar: "+utils.escapeHtml(err.message));
      });
    },

    importarBackup: function(file){
      if(!file){ showAlert("backupStatus","warn","Selecione um arquivo JSON."); return; }
      if(!confirm("Importar backup na raiz do Firebase?\nIsso pode sobrescrever dados existentes na raiz do Realtime Database.")) return;
      showAlert("backupStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Importando…');
      var reader = new FileReader();
      reader.onload = function(){
        try{
          var parsed = JSON.parse(String(reader.result || ""));
          // Aceita export LICSYSTEM ({licitacoes:...}) ou JSON já no formato da raiz
          var rootPayload = parsed;
          if(parsed && parsed.origem === "licitacoes" && parsed.licitacoes !== undefined){
            rootPayload = { licitacoes: parsed.licitacoes };
            if(LICSYSTEM.state.empresaPerfil) rootPayload.empresa_perfil = LICSYSTEM.state.empresaPerfil;
          }
          utils.firebaseSet("/", rootPayload).then(function(){
            showAlert("backupStatus","ok","✅ Backup importado na raiz do Firebase.");
          }).catch(function(err){
            showAlert("backupStatus","error","Falha no firebaseSet: "+utils.escapeHtml(err.message));
          });
        }catch(err){
          showAlert("backupStatus","error","JSON inválido: "+utils.escapeHtml(err.message));
        }
      };
      reader.onerror = function(){
        showAlert("backupStatus","error","Não foi possível ler o arquivo.");
      };
      reader.readAsText(file);
    }
  };

  // API pública LICSYSTEM
  LICSYSTEM.exportarBackup = function(){ return LICSYSTEM.ferramentas.exportarBackup(); };
  LICSYSTEM.importarBackup = function(file){ return LICSYSTEM.ferramentas.importarBackup(file); };
  LICSYSTEM.licsystemPdfHeader = licsystemPdfHeader;

  /* ============================ EVENT WIRING ============================ */
  function wireOrcFileInput(){
    var drop = el("orcDrop");
    var input = el("orcFile");
    if(!drop || !input) return;
    drop.onclick = function(){ input.click(); };
    input.onchange = function(){ if(input.files[0]) LICSYSTEM.orcamento.handleFile(input.files[0]); };
    drop.ondragover = function(e){ e.preventDefault(); drop.classList.add("drag"); };
    drop.ondragleave = function(){ drop.classList.remove("drag"); };
    drop.ondrop = function(e){
      e.preventDefault(); drop.classList.remove("drag");
      if(e.dataTransfer.files && e.dataTransfer.files[0]) LICSYSTEM.orcamento.handleFile(e.dataTransfer.files[0]);
    };
  }
  window.wireOrcFileInput = wireOrcFileInput;

  function wire(){
    function on(id, evt, fn){
      var n = el(id);
      if(n) n.addEventListener(evt, fn);
    }
    // Captação
    on("btnExtrair","click", LICSYSTEM.captacao.extrair);
    on("btnMostrarTudo","click", function(){ LICSYSTEM.captacao.render(null, true); });
    on("btnExportCaptacao","click", LICSYSTEM.captacao.exportarPdf);
    on("btnGoogleSel","click", LICSYSTEM.captacao.googleSelecionados);
    on("btnParaOrcamento","click", LICSYSTEM.captacao.paraOrcamento);
    on("btnPncp","click", LICSYSTEM.captacao.buscarPncp);
    on("capCheckAll","change", function(){
      var onChk = this.checked;
      document.querySelectorAll(".capChk").forEach(function(c){ c.checked = onChk; });
    });
    on("captacaoBody","click", function(e){
      var g = e.target.closest(".capGoogle");
      if(g){ window.open("https://www.google.com/search?q="+encodeURIComponent(g.getAttribute("data-q")),"_blank"); }
    });
    on("pdfFile","change", function(){
      var st = el("pdfStatus");
      if(st && this.files && this.files[0]){
        st.className = "alert show alert-info";
        st.textContent = "Arquivo selecionado: " + this.files[0].name + " — clique em Extrair texto e filtrar.";
      }
    });

    // Análise Inteligente de Editais (IA)
    LICSYSTEM.analiseIa.wire();
    on("btnIaAnalisar","click", function(){ LICSYSTEM.analiseIa.analisar(); });
    on("btnIaLimpar","click", function(){ LICSYSTEM.analiseIa.limpar(); });
    on("btnIaCopiar","click", function(){ LICSYSTEM.analiseIa.copiarRelatorio(); });
    on("btnIaImprimir","click", function(){ LICSYSTEM.analiseIa.imprimirRelatorio(); });

    // Orçamento
    on("btnAddLinha","click", LICSYSTEM.orcamento.addLinha);
    on("btnLimparOrc","click", LICSYSTEM.orcamento.limpar);
    on("btnPropostaOrc","click", LICSYSTEM.orcamento.gerarProposta);
    on("orcPrev","click", function(){ LICSYSTEM.orcamento.goPage(-1); });
    on("orcNext","click", function(){ LICSYSTEM.orcamento.goPage(1); });
    on("capPrev","click", function(){ LICSYSTEM.captacao.goPage(-1); });
    on("capNext","click", function(){ LICSYSTEM.captacao.goPage(1); });
    on("orcCheckAll","change", function(){
      var onChk = this.checked;
      document.querySelectorAll(".orcChk").forEach(function(c){ c.checked = onChk; });
    });
    on("orcBody","input", function(e){
      var inp = e.target.closest("input[data-i]");
      if(!inp) return;
      LICSYSTEM.orcamento.onEdit(Number(inp.getAttribute("data-i")), inp.getAttribute("data-f"), inp.value);
    });
    on("orcBody","click", function(e){
      var del = e.target.closest(".orcDel");
      if(del){ var i=Number(del.getAttribute("data-i")); LICSYSTEM.state.orcItems.splice(i,1); if(!LICSYSTEM.state.orcItems.length) LICSYSTEM.state.orcItems.push({produto:"",qtd:1,vunit:0,pct:0,link:""}); LICSYSTEM.orcamento.render(); return; }
      var g = e.target.closest(".orcGoogle");
      if(g){ var it=LICSYSTEM.state.orcItems[Number(g.getAttribute("data-i"))]; if(it&&it.produto) window.open("https://www.google.com/search?q="+encodeURIComponent(it.produto),"_blank"); return; }
      var ml = e.target.closest(".orcMl");
      if(ml){ var it2=LICSYSTEM.state.orcItems[Number(ml.getAttribute("data-i"))]; if(it2&&it2.produto) window.open("https://lista.mercadolivre.com.br/"+encodeURIComponent(it2.produto),"_blank"); return; }
    });
    wireOrcFileInput();

    // Cruzamento
    on("btnCruzar","click", LICSYSTEM.cruzamento.processar);
    on("btnPropostaCruz","click", LICSYSTEM.cruzamento.gerarProposta);

    // Cofre
    on("btnSalvarCofre","click", LICSYSTEM.cofre.save);

    // Entregas (offcanvas)
    LICSYSTEM.entregas.wire();

    // Histórico e Controle de Entregas
    on("histBusca","input", function(){ LICSYSTEM.histEntregas.aplicarFiltros(); });
    on("histStatus","change", function(){ LICSYSTEM.histEntregas.aplicarFiltros(); });
    on("btnHistAdd","click", function(){ LICSYSTEM.histEntregas.adicionarItem(); });
    on("btnHistSeed","click", function(){ LICSYSTEM.histEntregas.carregarExemplos(true); });
    on("histEntregasBody","input", function(e){
      var inp = e.target.closest("input[data-hist-id]");
      if(!inp) return;
      var id = inp.getAttribute("data-hist-id");
      var field = inp.getAttribute("data-hist-f");
      if(field === "qtdEntregue"){
        calcularFaltaEntregar(id, inp.value);
      } else {
        LICSYSTEM.histEntregas.onEdit(id, field, inp.value);
      }
    });
    on("histEntregasBody","change", function(e){
      var chk = e.target.closest("input.hist-check[data-hist-id]");
      if(chk){
        LICSYSTEM.histEntregas.toggleConcluido(chk.getAttribute("data-hist-id"), chk.checked);
        return;
      }
    });
    on("histEntregasBody","click", function(e){
      var del = e.target.closest(".histDel");
      if(del){ LICSYSTEM.histEntregas.remover(del.getAttribute("data-hist-id")); }
    });

    // Catálogo Interno
    on("btnSalvarProduto","click", salvarProduto);
    on("btnCancelarEditCat","click", function(){ LICSYSTEM.catalogo.cancelEdit(); });
    on("catBusca","input", filtrarCatalogo);
    on("catalogoBody","click", function(e){
      var ed = e.target.closest(".catEdit");
      if(ed){ LICSYSTEM.catalogo.editar(ed.getAttribute("data-id")); return; }
      var ex = e.target.closest(".catDel");
      if(ex){ LICSYSTEM.catalogo.excluir(ex.getAttribute("data-id")); return; }
    });

    // Atas de Registro (ARP)
    on("btnArpAddItem","click", function(){ LICSYSTEM.arp.adicionarItem(); });
    on("btnArpSalvarAta","click", function(){ LICSYSTEM.arp.salvarAta(); });
    on("btnArpNova","click", function(){ LICSYSTEM.arp.novaAta(); });
    on("arpItensBody","click", function(e){
      var del = e.target.closest(".arpDelItem");
      if(del){ LICSYSTEM.arp.removerItem(Number(del.getAttribute("data-i"))); return; }
    });
    on("arpItensBody","input", function(e){
      var inp = e.target.closest("input[data-arp-i]");
      if(!inp) return;
      LICSYSTEM.arp.onEditItem(
        Number(inp.getAttribute("data-arp-i")),
        inp.getAttribute("data-arp-f"),
        inp.value
      );
    });
    on("arpListaSalvas","click", function(e){
      var loadBtn = e.target.closest(".arpLoad");
      if(loadBtn){ LICSYSTEM.arp.carregarAta(loadBtn.getAttribute("data-id")); return; }
      var delBtn = e.target.closest(".arpDelAta");
      if(delBtn){ LICSYSTEM.arp.excluirAta(delBtn.getAttribute("data-id")); return; }
    });

    // Sala de Disputa (cálculos ao vivo)
    ["disputaPrecoRef","disputaDegrau","disputaLanceConcorrente","disputaMeuCusto"].forEach(function(id){
      on(id,"input", function(){ LICSYSTEM.disputa.atualizarResultados(); });
      on(id,"change", function(){ LICSYSTEM.disputa.atualizarResultados(); });
    });
    on("btnRegistrarLance","click", function(){ LICSYSTEM.disputa.registrarLance(); });
    on("btnLimparDisputa","click", function(){ LICSYSTEM.disputa.limparSessao(); });

    // Concorrência
    on("btnCnpj","click", LICSYSTEM.concorrencia.buscar);
    on("cnpjInput","keydown", function(e){ if(e.key==="Enter") LICSYSTEM.concorrencia.buscar(); });

    // Ferramentas
    on("btnSalvarPerfil","click", LICSYSTEM.ferramentas.onSalvarClick);
    on("empLogo","change", LICSYSTEM.ferramentas.onLogoChange);
    on("btnExportBackup","click", LICSYSTEM.ferramentas.exportarBackup);
    on("btnImportBackup","click", function(){ var f=el("backupFile"); if(f) f.click(); });
    on("backupFile","change", function(){
      if(this.files && this.files[0]) LICSYSTEM.ferramentas.importarBackup(this.files[0]);
      this.value = "";
    });

    // Bell
    on("bell","click", function(){
      if(window.__lsActivateView) window.__lsActivateView("captacao");
    });
  }

  /* ============================ VIEW CHANGE HOOK ============================ */
  var VIEW_TITLES = {
    dashboard:'Dashboard',
    captacao:'Captação de Editais',
    analiseIa:'Análise Inteligente de Editais',
    orcamento:'Orçamento',
    cruzamento:'Cruzamento Inteligente (ML)',
    cofre:'Cofre de Documentos',
    entregas:'Licitação',
    histEntregas:'Histórico e Controle de Entregas',
    concorrencia:'Análise de Concorrência',
    catalogo:'Catálogo Interno',
    arp:'Atas de Registro (ARP)',
    disputa:'Sala de Disputa',
    ferramentas:'Ferramentas'
  };
  LICSYSTEM.VIEW_TITLES = VIEW_TITLES;

  LICSYSTEM.onViewChange = function(view){
    LICSYSTEM.state.currentView = view || "dashboard";
    // Não remonta telas pesadas a cada clique no menu
    if(view==="dashboard"){
      if(!LICSYSTEM.state._dashReady){
        LICSYSTEM.state._dashReady = true;
        LICSYSTEM.dashboard.render();
      }
    }
    if(view==="orcamento"){
      if(LICSYSTEM.state._orcDirty || !LICSYSTEM.state._orcRendered){
        LICSYSTEM.orcamento.render({ save:false });
      }
    }
    if(view==="cofre"){
      if(!LICSYSTEM.state._cofreRendered){
        LICSYSTEM.state._cofreRendered = true;
        LICSYSTEM.cofre.render();
      }
    }
    if(view==="ferramentas") LICSYSTEM.ferramentas.carregarView();
    if(view==="entregas") LICSYSTEM.entregas.renderLista();
    if(view==="histEntregas") LICSYSTEM.histEntregas.render();
    if(view==="catalogo") listarProdutos();
    if(view==="arp") LICSYSTEM.arp.renderAll();
    if(view==="disputa") LICSYSTEM.disputa.atualizarResultados();
    if(view==="cruzamento"){
      // CEP em background — não bloqueia a troca de tela
      setTimeout(function(){
        LICSYSTEM.cruzamento.resolveCep().catch(function(){});
      }, 0);
    }
    // Voiceflow: só guarda a página — NÃO recarrega o chat a cada clique
    try{
      if(LICSYSTEM.voiceflow) LICSYSTEM.voiceflow.currentView = view;
    }catch(e){}
  };

  /* ============================ ENTREGAS ============================ */
  var ENTREGAS_KEY = "licsystem_entregas_v1";

  /**
   * Monta o payload da entrega (texto + arquivo) para persistência futura.
   * Pronto para: Firebase Storage (arquivo) + Firestore/RTDB (metadados).
   * @returns {{ ok:boolean, erro?:string, dados?:object, arquivo?:File|null }}
   */
  function coletarDadosEntrega(){
    var val = function(id){ var n = el(id); return n ? String(n.value || "").trim() : ""; };
    var statusEl = document.querySelector('input[name="entregaStatusNota"]:checked');
    var destinoEl = document.querySelector('input[name="entregaTipoDestino"]:checked');
    var fileInput = el("entregaArquivoNf");
    var arquivo = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;

    var statusNota = statusEl ? statusEl.value : "NAO_FEITO";
    var tipoDestino = destinoEl ? destinoEl.value : "DESTINO_FINAL";

    var dados = {
      // --- Identificação ---
      nomeLicitacao: val("entregaNomeLicitacao"),
      numeroEmpenho: val("entregaNumeroEmpenho"),

      // --- Faturamento / anexos ---
      statusNota: statusNota, // "FEITO" | "NAO_FEITO"
      observacoes: val("entregaObservacoes"),
      materialOrigem: val("entregaMaterialOrigem"),
      // Metadados do anexo (o File em si vai em `arquivo` abaixo)
      anexo: arquivo ? {
        nome: arquivo.name,
        tipo: arquivo.type || "",
        tamanho: arquivo.size || 0
        // TODO Firebase Storage:
        // 1) storage.ref("entregas/"+id+"/"+arquivo.name).put(arquivo)
        // 2) url = await snap.ref.getDownloadURL()
        // 3) dados.anexo.url = url
      } : null,

      // --- Logística ---
      tipoDestino: tipoDestino, // "DESTINO_FINAL" | "MINHA_LOJA"
      destinoFinal: null,
      minhaLoja: null,

      // --- Controle ---
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
      // TODO Firestore/RTDB:
      // await firebase.firestore().collection("entregas").add(dados)
      // ou utils.firebasePush("entregas", dados)
    };

    if(tipoDestino === "DESTINO_FINAL"){
      dados.destinoFinal = {
        localResponsavel: val("entregaLocalResponsavel"),
        cep: val("entregaCep").replace(/\D/g,""),
        endereco: val("entregaEndereco"),
        numero: val("entregaNumero"),
        complemento: val("entregaComplemento"),
        bairro: val("entregaBairro"),
        cidade: val("entregaCidade"),
        uf: val("entregaUf").toUpperCase()
      };
    } else {
      dados.minhaLoja = {
        transporte: val("entregaTransporte") // CORREIOS | TRANSPORTADORA | VEICULO_PROPRIO
      };
    }

    if(!dados.nomeLicitacao){
      return { ok:false, erro:"Informe o Nome da Licitação." };
    }
    if(tipoDestino === "MINHA_LOJA" && !(dados.minhaLoja && dados.minhaLoja.transporte)){
      return { ok:false, erro:"Selecione o transporte para envio futuro." };
    }

    return { ok:true, dados:dados, arquivo:arquivo };
  }
  // Exposto globalmente conforme solicitado
  window.coletarDadosEntrega = coletarDadosEntrega;

  LICSYSTEM.entregas = {
    items: [],

    load:function(){
      try{
        var saved = JSON.parse(localStorage.getItem(ENTREGAS_KEY) || "[]");
        LICSYSTEM.entregas.items = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.entregas.items = [];
      }
    },

    saveLocal:function(){
      try{
        localStorage.setItem(ENTREGAS_KEY, JSON.stringify(LICSYSTEM.entregas.items));
      }catch(e){
        console.warn("Entregas: falha ao salvar localmente", e);
      }
    },

    open:function(){
      var oc = el("entregaOffcanvas");
      var ov = el("entregaOverlay");
      if(oc){
        oc.classList.add("open");
        oc.setAttribute("aria-hidden","false");
      }
      if(ov){
        ov.classList.add("show");
        ov.setAttribute("aria-hidden","false");
      }
      document.body.classList.add("entrega-open");
      hideAlert("entregaFormAlert");
      setTimeout(function(){ var f = el("entregaNomeLicitacao"); if(f) f.focus(); }, 200);
    },

    close:function(){
      var oc = el("entregaOffcanvas");
      var ov = el("entregaOverlay");
      if(oc){
        oc.classList.remove("open");
        oc.setAttribute("aria-hidden","true");
      }
      if(ov){
        ov.classList.remove("show");
        ov.setAttribute("aria-hidden","true");
      }
      document.body.classList.remove("entrega-open");
    },

    resetForm:function(){
      [
        "entregaNomeLicitacao","entregaNumeroEmpenho","entregaObservacoes","entregaMaterialOrigem",
        "entregaLocalResponsavel","entregaCep","entregaEndereco","entregaNumero","entregaComplemento",
        "entregaBairro","entregaCidade","entregaUf"
      ].forEach(function(id){ if(el(id)) el(id).value = ""; });
      if(el("entregaTransporte")) el("entregaTransporte").value = "";
      if(el("entregaStatusNaoFeito")) el("entregaStatusNaoFeito").checked = true;
      if(el("entregaDestinoFinal")) el("entregaDestinoFinal").checked = true;
      if(el("entregaArquivoNf")) el("entregaArquivoNf").value = "";
      if(el("entregaArquivoNome")) el("entregaArquivoNome").textContent = "PDF ou imagem";
      if(el("entregaCepHint")) el("entregaCepHint").textContent = "Digite o CEP (8 dígitos) para preencher via ViaCEP.";
      LICSYSTEM.entregas.syncStatusUi();
      LICSYSTEM.entregas.syncDestinoUi();
      hideAlert("entregaFormAlert");
    },

    syncStatusUi:function(){
      var feito = el("entregaStatusFeito") && el("entregaStatusFeito").checked;
      var lblN = el("lblStatusNaoFeito");
      var lblF = el("lblStatusFeito");
      if(lblN) lblN.className = "status-nf" + (feito ? "" : " is-nao");
      if(lblF) lblF.className = "status-nf" + (feito ? " is-feito" : "");
    },

    syncDestinoUi:function(){
      var loja = el("entregaMinhaLoja") && el("entregaMinhaLoja").checked;
      var cardF = el("cardDestinoFinal");
      var cardL = el("cardMinhaLoja");
      if(cardF) cardF.classList.toggle("is-active", !loja);
      if(cardL) cardL.classList.toggle("is-active", !!loja);
      if(el("painelDestinoFinal")) el("painelDestinoFinal").style.display = loja ? "none" : "";
      if(el("painelMinhaLoja")) el("painelMinhaLoja").style.display = loja ? "" : "none";
    },

    /** ViaCEP — preenche endereço ao completar 8 dígitos */
    buscarCep:function(){
      var cepInput = el("entregaCep");
      if(!cepInput) return;
      var cep = String(cepInput.value || "").replace(/\D/g,"");
      if(cep.length === 8){
        cepInput.value = cep.slice(0,5) + "-" + cep.slice(5);
      }
      var hint = el("entregaCepHint");
      if(cep.length !== 8){
        if(hint) hint.textContent = "Digite o CEP (8 dígitos) para preencher via ViaCEP.";
        return;
      }
      if(hint) hint.textContent = "Consultando ViaCEP…";
      fetch("https://viacep.com.br/ws/"+cep+"/json/")
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(!j || j.erro){
            if(hint) hint.textContent = "CEP não encontrado.";
            return;
          }
          if(el("entregaEndereco")) el("entregaEndereco").value = j.logradouro || "";
          if(el("entregaBairro")) el("entregaBairro").value = j.bairro || "";
          if(el("entregaCidade")) el("entregaCidade").value = j.localidade || "";
          if(el("entregaUf")) el("entregaUf").value = j.uf || "";
          if(hint) hint.textContent = "Endereço preenchido via ViaCEP. Confira o número.";
          if(el("entregaNumero")) el("entregaNumero").focus();
        })
        .catch(function(){
          if(hint) hint.textContent = "Falha ao consultar ViaCEP (rede/CORS). Preencha manualmente.";
        });
    },

    renderLista:function(){
      LICSYSTEM.entregas.load();
      var box = el("entregaList");
      if(!box) return;
      var list = LICSYSTEM.entregas.items || [];
      if(!list.length){
        box.innerHTML = '<div class="muted small" style="padding:18px;text-align:center">Nenhuma entrega registrada ainda.</div>';
        return;
      }
      var html = "";
      list.slice().reverse().forEach(function(it, revIdx){
        var idx = list.length - 1 - revIdx;
        var badge = it.statusNota === "FEITO"
          ? '<span class="badge-nf ok">NF FEITO</span>'
          : '<span class="badge-nf pend">NF NÃO FEITO</span>';
        var dest = it.tipoDestino === "MINHA_LOJA"
          ? ("Loja · " + ((it.minhaLoja && it.minhaLoja.transporte) || "—"))
          : ("Destino · " + ((it.destinoFinal && (it.destinoFinal.cidade || it.destinoFinal.localResponsavel)) || "—"));
        html += '<div class="entrega-item" data-idx="'+idx+'">'+
          '<div>'+
            '<div class="ei-title">'+utils.escapeHtml(it.nomeLicitacao||"Sem nome")+'</div>'+
            '<div class="ei-meta">Empenho: '+utils.escapeHtml(it.numeroEmpenho||"—")+
              ' · '+utils.escapeHtml(dest)+
              (it.anexo && it.anexo.nome ? ' · 📎 '+utils.escapeHtml(it.anexo.nome) : '')+
            '</div>'+
          '</div>'+badge+
        '</div>';
      });
      box.innerHTML = html;
    },

    salvar:function(){
      var pack = coletarDadosEntrega();
      if(!pack.ok){
        showAlert("entregaFormAlert","warn", utils.escapeHtml(pack.erro));
        return;
      }
      // Persistência local imediata (metadados). Arquivo fica só no File/seleção atual.
      // TODO: integrar Storage + Firestore aqui usando pack.dados + pack.arquivo
      var registro = pack.dados;
      registro.id = "ent_"+Date.now();
      LICSYSTEM.entregas.load();
      LICSYSTEM.entregas.items.push(registro);
      LICSYSTEM.entregas.saveLocal();
      LICSYSTEM.entregas.renderLista();
      LICSYSTEM.entregas.close();
      LICSYSTEM.entregas.resetForm();
      showAlert("entregaAlert","ok","✅ Entrega salva localmente ("+utils.escapeHtml(registro.nomeLicitacao)+").");
    },

    wire:function(){
      function on(id, evt, fn){
        var n = el(id); if(n) n.addEventListener(evt, fn);
      }
      on("btnNovaEntrega","click", function(){
        LICSYSTEM.entregas.resetForm();
        LICSYSTEM.entregas.open();
      });
      on("btnFecharEntrega","click", LICSYSTEM.entregas.close);
      on("btnCancelarEntrega","click", function(){
        LICSYSTEM.entregas.close();
        LICSYSTEM.entregas.resetForm();
      });
      on("btnSalvarEntrega","click", LICSYSTEM.entregas.salvar);
      on("entregaOverlay","click", function(e){
        // Fecha só ao clicar no fundo escuro, não no card do formulário
        if(e.target && e.target.id === "entregaOverlay") LICSYSTEM.entregas.close();
      });

      ["entregaStatusFeito","entregaStatusNaoFeito"].forEach(function(id){
        on(id,"change", LICSYSTEM.entregas.syncStatusUi);
      });
      ["entregaDestinoFinal","entregaMinhaLoja"].forEach(function(id){
        on(id,"change", LICSYSTEM.entregas.syncDestinoUi);
      });
      on("entregaCep","blur", LICSYSTEM.entregas.buscarCep);
      on("entregaCep","input", function(){
        var v = (el("entregaCep").value || "").replace(/\D/g,"");
        if(v.length === 8) LICSYSTEM.entregas.buscarCep();
      });
      on("entregaArquivoNf","change", function(){
        var f = el("entregaArquivoNf");
        var nome = (f && f.files && f.files[0]) ? f.files[0].name : "PDF ou imagem";
        if(el("entregaArquivoNome")) el("entregaArquivoNome").textContent = nome;
      });

      document.addEventListener("keydown", function(e){
        if(e.key === "Escape" && document.body.classList.contains("entrega-open")){
          LICSYSTEM.entregas.close();
        }
      });
    }
  };

  /* ============================ CATÁLOGO INTERNO ============================ */
  var CATALOGO_KEY = "licsystem_catalogo_v1";

  LICSYSTEM.catalogo = {
    items: [],
    filtro: "",

    /** Carrega do localStorage. Trocar por Firestore: collection('catalogo').get() */
    load: function(){
      try{
        var saved = JSON.parse(localStorage.getItem(CATALOGO_KEY) || "[]");
        LICSYSTEM.catalogo.items = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.catalogo.items = [];
      }
      return LICSYSTEM.catalogo.items;
    },

    /**
     * Persiste localmente.
     * TODO Firestore:
     *   await firebase.firestore().collection('catalogo').doc(id).set(produto, { merge:true })
     *   ou .add(produto) para novos
     */
    saveLocal: function(){
      try{
        localStorage.setItem(CATALOGO_KEY, JSON.stringify(LICSYSTEM.catalogo.items));
      }catch(e){
        console.warn("Catálogo: falha ao salvar localmente", e);
      }
    },

    limparForm: function(){
      if(el("catEditId")) el("catEditId").value = "";
      if(el("catNome")) el("catNome").value = "";
      if(el("catSku")) el("catSku").value = "";
      if(el("catPreco")) el("catPreco").value = "";
      if(el("catMarca")) el("catMarca").value = "";
      var badge = el("catEditBadge");
      if(badge) badge.classList.remove("show");
      var btnCancel = el("btnCancelarEditCat");
      if(btnCancel) btnCancel.style.display = "none";
      var btnSave = el("btnSalvarProduto");
      if(btnSave) btnSave.textContent = "💾 Salvar Produto";
    },

    cancelEdit: function(){
      LICSYSTEM.catalogo.limparForm();
      hideAlert("catalogoAlert");
    },

    editar: function(id){
      LICSYSTEM.catalogo.load();
      var item = null;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === id){ item = LICSYSTEM.catalogo.items[i]; break; }
      }
      if(!item) return;
      if(el("catEditId")) el("catEditId").value = item.id;
      if(el("catNome")) el("catNome").value = item.nome || "";
      if(el("catSku")) el("catSku").value = item.sku || "";
      if(el("catPreco")) el("catPreco").value = item.preco != null ? item.preco : "";
      if(el("catMarca")) el("catMarca").value = item.marca || "";
      var badge = el("catEditBadge");
      if(badge) badge.classList.add("show");
      var btnCancel = el("btnCancelarEditCat");
      if(btnCancel) btnCancel.style.display = "";
      var btnSave = el("btnSalvarProduto");
      if(btnSave) btnSave.textContent = "💾 Atualizar Produto";
      if(el("catNome")) el("catNome").focus();
    },

    excluir: function(id){
      if(!id || !confirm("Excluir este produto do catálogo?")) return;
      LICSYSTEM.catalogo.load();
      LICSYSTEM.catalogo.items = LICSYSTEM.catalogo.items.filter(function(it){ return it.id !== id; });
      LICSYSTEM.catalogo.saveLocal();
      // TODO Firestore: await firebase.firestore().collection('catalogo').doc(id).delete()
      listarProdutos();
      showAlert("catalogoAlert","ok","Produto excluído.");
      if((el("catEditId")||{}).value === id) LICSYSTEM.catalogo.limparForm();
    }
  };

  /**
   * Salva (cria ou atualiza) um produto do formulário.
   * Estrutura pronta para coleção Firestore 'catalogo'.
   */
  function salvarProduto(){
    var nome = ((el("catNome") && el("catNome").value) || "").trim();
    var sku = ((el("catSku") && el("catSku").value) || "").trim();
    var marca = ((el("catMarca") && el("catMarca").value) || "").trim();
    var preco = Number((el("catPreco") && el("catPreco").value) || 0);
    var editId = ((el("catEditId") && el("catEditId").value) || "").trim();

    if(!nome){
      showAlert("catalogoAlert","warn","Informe o Nome do Produto / Descrição.");
      if(el("catNome")) el("catNome").focus();
      return null;
    }
    if(preco < 0 || !isFinite(preco)){
      showAlert("catalogoAlert","warn","Preço de referência inválido.");
      return null;
    }

    LICSYSTEM.catalogo.load();
    var agora = new Date().toISOString();
    var produto;

    if(editId){
      var found = false;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === editId){
          produto = LICSYSTEM.catalogo.items[i];
          produto.nome = nome;
          produto.sku = sku;
          produto.marca = marca;
          produto.preco = preco;
          produto.atualizadoEm = agora;
          found = true;
          break;
        }
      }
      if(!found){
        showAlert("catalogoAlert","error","Produto para edição não encontrado.");
        return null;
      }
      // TODO Firestore: collection('catalogo').doc(editId).update({ nome, sku, marca, preco, atualizadoEm })
    } else {
      produto = {
        id: "cat_" + Date.now() + "_" + Math.floor(Math.random()*1000),
        nome: nome,
        sku: sku,
        marca: marca,
        preco: preco,
        criadoEm: agora,
        atualizadoEm: agora
      };
      LICSYSTEM.catalogo.items.push(produto);
      // TODO Firestore: collection('catalogo').add({ ...produto sem id, ou .doc(produto.id).set(produto) })
    }

    LICSYSTEM.catalogo.saveLocal();
    LICSYSTEM.catalogo.limparForm();
    listarProdutos();
    showAlert("catalogoAlert","ok", editId ? "✅ Produto atualizado." : "✅ Produto salvo no catálogo.");
    return produto;
  }

  /**
   * Lista produtos na tabela (respeita filtro atual).
   * TODO Firestore: snapshot = await collection('catalogo').orderBy('nome').get()
   */
  function listarProdutos(){
    LICSYSTEM.catalogo.load();
    var body = el("catalogoBody");
    if(!body) return;
    var q = utils.fold(LICSYSTEM.catalogo.filtro || "").toLowerCase().trim();
    var list = LICSYSTEM.catalogo.items.slice();

    if(q){
      list = list.filter(function(it){
        var blob = utils.fold([it.nome, it.sku, it.marca].join(" ")).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    list.sort(function(a,b){
      return String(a.nome||"").localeCompare(String(b.nome||""), "pt-BR", { sensitivity:"base" });
    });

    if(!list.length){
      body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">'+(
        q ? "Nenhum produto correspondente à busca." : "Nenhum produto cadastrado."
      )+'</td></tr>';
      return;
    }

    var html = "";
    list.forEach(function(it){
      html += '<tr data-id="'+utils.escapeHtml(it.id)+'">'+
        '<td>'+utils.escapeHtml(it.sku || "—")+'</td>'+
        '<td>'+utils.escapeHtml(it.nome || "")+'</td>'+
        '<td>'+utils.escapeHtml(it.marca || "—")+'</td>'+
        '<td style="font-weight:700;color:var(--ls-navy)">'+utils.formatBrl(Number(it.preco)||0)+'</td>'+
        '<td><div class="cat-actions">'+
          '<button type="button" class="btn btn-ghost btn-sm catEdit" data-id="'+utils.escapeHtml(it.id)+'">✎ Editar</button>'+
          '<button type="button" class="btn btn-ghost btn-sm catDel" data-id="'+utils.escapeHtml(it.id)+'">✕</button>'+
        '</div></td>'+
      '</tr>';
    });
    body.innerHTML = html;
  }

  /**
   * Filtra a tabela pelo texto da barra de pesquisa (#catBusca).
   */
  function filtrarCatalogo(){
    LICSYSTEM.catalogo.filtro = (el("catBusca") && el("catBusca").value) || "";
    listarProdutos();
  }

  // API pública (conforme solicitado)
  window.salvarProduto = salvarProduto;
  window.listarProdutos = listarProdutos;
  window.filtrarCatalogo = filtrarCatalogo;

  /* ============================ ATAS DE REGISTRO (ARP) ============================ */
  var ARP_KEY = "licsystem_arp_v1";

  /**
   * Calcula saldo disponível: Qtd Total Homologada − Qtd Consumida/Empenhada.
   * Nunca retorna negativo (piso em 0).
   * @param {number|string} qtdTotal
   * @param {number|string} qtdConsumida
   * @returns {number}
   */
  function calcularSaldoAta(qtdTotal, qtdConsumida){
    var total = Number(qtdTotal) || 0;
    var cons = Number(qtdConsumida) || 0;
    var saldo = total - cons;
    if(saldo < 0) saldo = 0;
    return saldo;
  }
  window.calcularSaldoAta = calcularSaldoAta;

  LICSYSTEM.arp = {
    /** Itens da ata em edição (rascunho na tela) */
    draftItens: [],
    /** Lista de atas persistidas */
    atas: [],

    load: function(){
      try{
        var saved = JSON.parse(localStorage.getItem(ARP_KEY) || "[]");
        LICSYSTEM.arp.atas = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.arp.atas = [];
      }
      return LICSYSTEM.arp.atas;
    },

    /**
     * Persistência local.
     * TODO banco (RTDB/Firestore):
     *   utils.firebaseSet("arp/"+ata.id, ata)
     *   ou firestore.collection("arp").doc(ata.id).set(ata)
     */
    saveLocal: function(){
      try{
        localStorage.setItem(ARP_KEY, JSON.stringify(LICSYSTEM.arp.atas));
      }catch(e){
        console.warn("ARP: falha ao salvar localmente", e);
      }
    },

    /** Monta objeto estruturado da ata atual (cabeçalho + itens com saldo). */
    coletarAta: function(){
      var orgao = ((el("arpOrgao") && el("arpOrgao").value) || "").trim();
      var numero = ((el("arpNumero") && el("arpNumero").value) || "").trim();
      var validade = ((el("arpValidade") && el("arpValidade").value) || "").trim();
      var aceitaCarona = !!(el("arpAceitaCarona") && el("arpAceitaCarona").checked);
      var id = ((el("arpId") && el("arpId").value) || "").trim();

      var itens = (LICSYSTEM.arp.draftItens || []).map(function(it){
        var total = Number(it.qtdTotal) || 0;
        var cons = Number(it.qtdConsumida) || 0;
        return {
          id: it.id || ("item_"+Date.now()+"_"+Math.floor(Math.random()*999)),
          produto: String(it.produto || "").trim(),
          qtdTotal: total,
          qtdConsumida: cons,
          saldoDisponivel: calcularSaldoAta(total, cons)
        };
      });

      return {
        id: id || ("arp_"+Date.now()),
        orgaoGerenciador: orgao,
        numeroPregaoArp: numero,
        dataValidade: validade,
        aceitaCarona: aceitaCarona,
        itens: itens,
        atualizadoEm: new Date().toISOString()
      };
    },

    adicionarItem: function(){
      var produto = ((el("arpItemProduto") && el("arpItemProduto").value) || "").trim();
      var qtdTotal = Number((el("arpItemQtdTotal") && el("arpItemQtdTotal").value) || 0);
      var qtdConsumida = Number((el("arpItemQtdConsumida") && el("arpItemQtdConsumida").value) || 0);

      if(!produto){
        showAlert("arpAlert","warn","Informe o Produto do item.");
        if(el("arpItemProduto")) el("arpItemProduto").focus();
        return;
      }
      if(qtdTotal < 0 || qtdConsumida < 0){
        showAlert("arpAlert","warn","Quantidades não podem ser negativas.");
        return;
      }
      if(qtdConsumida > qtdTotal){
        showAlert("arpAlert","warn","Quantidade consumida não pode ser maior que a homologada.");
        return;
      }

      LICSYSTEM.arp.draftItens.push({
        id: "item_"+Date.now()+"_"+Math.floor(Math.random()*999),
        produto: produto,
        qtdTotal: qtdTotal,
        qtdConsumida: qtdConsumida
      });

      if(el("arpItemProduto")) el("arpItemProduto").value = "";
      if(el("arpItemQtdTotal")) el("arpItemQtdTotal").value = "";
      if(el("arpItemQtdConsumida")) el("arpItemQtdConsumida").value = "0";
      LICSYSTEM.arp.renderItens();
      hideAlert("arpAlert");
      if(el("arpItemProduto")) el("arpItemProduto").focus();
    },

    removerItem: function(index){
      if(index < 0 || index >= LICSYSTEM.arp.draftItens.length) return;
      LICSYSTEM.arp.draftItens.splice(index, 1);
      LICSYSTEM.arp.renderItens();
    },

    onEditItem: function(index, field, value){
      var it = LICSYSTEM.arp.draftItens[index];
      if(!it) return;
      if(field === "produto") it.produto = value;
      else it[field] = Number(value) || 0;
      // Recalcula só o saldo da linha no DOM (rápido)
      var row = document.querySelector('#arpItensBody tr[data-i="'+index+'"]');
      if(row){
        var saldo = calcularSaldoAta(it.qtdTotal, it.qtdConsumida);
        var cell = row.querySelector(".arp-saldo");
        if(cell){
          cell.textContent = String(saldo);
          cell.className = "arp-saldo " + (saldo === 0 ? "saldo-esgotado" : "saldo-ok");
        }
        row.classList.toggle("saldo-zero", saldo === 0);
      }
    },

    renderItens: function(){
      var body = el("arpItensBody");
      if(!body) return;
      var itens = LICSYSTEM.arp.draftItens || [];
      if(!itens.length){
        body.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Nenhum item adicionado a esta ata.</td></tr>';
        return;
      }
      var html = "";
      itens.forEach(function(it, i){
        var saldo = calcularSaldoAta(it.qtdTotal, it.qtdConsumida);
        var zero = saldo === 0;
        html += '<tr class="'+(zero?"saldo-zero":"")+'" data-i="'+i+'">'+
          '<td>'+(i+1)+'</td>'+
          '<td><input type="text" data-arp-i="'+i+'" data-arp-f="produto" value="'+utils.escapeHtml(it.produto)+'" /></td>'+
          '<td><input type="number" data-arp-i="'+i+'" data-arp-f="qtdTotal" min="0" step="1" value="'+utils.escapeHtml(it.qtdTotal)+'" /></td>'+
          '<td><input type="number" data-arp-i="'+i+'" data-arp-f="qtdConsumida" min="0" step="1" value="'+utils.escapeHtml(it.qtdConsumida)+'" /></td>'+
          '<td class="arp-saldo '+(zero?"saldo-esgotado":"saldo-ok")+'">'+saldo+'</td>'+
          '<td><button type="button" class="btn btn-ghost btn-sm arpDelItem" data-i="'+i+'">✕</button></td>'+
        '</tr>';
      });
      body.innerHTML = html;
    },

    renderListaSalvas: function(){
      LICSYSTEM.arp.load();
      var box = el("arpListaSalvas");
      if(!box) return;
      var list = LICSYSTEM.arp.atas || [];
      if(!list.length){
        box.innerHTML = '<div class="muted small" style="padding:14px;text-align:center">Nenhuma ARP salva ainda.</div>';
        return;
      }
      var html = "";
      list.slice().reverse().forEach(function(ata){
        var nItens = (ata.itens && ata.itens.length) || 0;
        var saldosZero = 0;
        (ata.itens || []).forEach(function(it){
          if(calcularSaldoAta(it.qtdTotal, it.qtdConsumida) === 0) saldosZero++;
        });
        html += '<div class="entrega-item">'+
          '<div>'+
            '<div class="ei-title">'+utils.escapeHtml(ata.orgaoGerenciador || "Sem órgão")+'</div>'+
            '<div class="ei-meta">'+utils.escapeHtml(ata.numeroPregaoArp || "—")+
              ' · Validade: '+utils.escapeHtml(ata.dataValidade || "—")+
              ' · '+nItens+' item(ns)'+
              (ata.aceitaCarona ? ' · Carona: sim' : '')+
              (saldosZero ? ' · '+saldosZero+' esgotado(s)' : '')+
            '</div>'+
          '</div>'+
          '<div class="cat-actions">'+
            '<button type="button" class="btn btn-ghost btn-sm arpLoad" data-id="'+utils.escapeHtml(ata.id)+'">Abrir</button>'+
            '<button type="button" class="btn btn-ghost btn-sm arpDelAta" data-id="'+utils.escapeHtml(ata.id)+'">✕</button>'+
          '</div>'+
        '</div>';
      });
      box.innerHTML = html;
    },

    renderAll: function(){
      LICSYSTEM.arp.renderItens();
      LICSYSTEM.arp.renderListaSalvas();
    },

    novaAta: function(){
      if(el("arpId")) el("arpId").value = "";
      if(el("arpOrgao")) el("arpOrgao").value = "";
      if(el("arpNumero")) el("arpNumero").value = "";
      if(el("arpValidade")) el("arpValidade").value = "";
      if(el("arpAceitaCarona")) el("arpAceitaCarona").checked = false;
      LICSYSTEM.arp.draftItens = [];
      LICSYSTEM.arp.renderItens();
      hideAlert("arpAlert");
      if(el("arpOrgao")) el("arpOrgao").focus();
    },

    carregarAta: function(id){
      LICSYSTEM.arp.load();
      var ata = null;
      for(var i=0;i<LICSYSTEM.arp.atas.length;i++){
        if(LICSYSTEM.arp.atas[i].id === id){ ata = LICSYSTEM.arp.atas[i]; break; }
      }
      if(!ata) return;
      if(el("arpId")) el("arpId").value = ata.id || "";
      if(el("arpOrgao")) el("arpOrgao").value = ata.orgaoGerenciador || "";
      if(el("arpNumero")) el("arpNumero").value = ata.numeroPregaoArp || "";
      if(el("arpValidade")) el("arpValidade").value = ata.dataValidade || "";
      if(el("arpAceitaCarona")) el("arpAceitaCarona").checked = !!ata.aceitaCarona;
      LICSYSTEM.arp.draftItens = (ata.itens || []).map(function(it){
        return {
          id: it.id,
          produto: it.produto,
          qtdTotal: Number(it.qtdTotal)||0,
          qtdConsumida: Number(it.qtdConsumida)||0
        };
      });
      LICSYSTEM.arp.renderItens();
      showAlert("arpAlert","info","Ata carregada para edição.");
      window.scrollTo(0,0);
    },

    excluirAta: function(id){
      if(!id || !confirm("Excluir esta ARP salva?")) return;
      LICSYSTEM.arp.load();
      LICSYSTEM.arp.atas = LICSYSTEM.arp.atas.filter(function(a){ return a.id !== id; });
      LICSYSTEM.arp.saveLocal();
      // TODO: firebase/firestore delete doc(id)
      if((el("arpId")||{}).value === id) LICSYSTEM.arp.novaAta();
      LICSYSTEM.arp.renderListaSalvas();
      showAlert("arpAlert","ok","ARP excluída.");
    },

    salvarAta: function(){
      var ata = LICSYSTEM.arp.coletarAta();
      if(!ata.orgaoGerenciador){
        showAlert("arpAlert","warn","Informe o Órgão Gerenciador.");
        if(el("arpOrgao")) el("arpOrgao").focus();
        return null;
      }
      if(!ata.numeroPregaoArp){
        showAlert("arpAlert","warn","Informe o Número do Pregão / ARP.");
        return null;
      }
      if(!ata.itens.length){
        showAlert("arpAlert","warn","Adicione ao menos um item à ata.");
        return null;
      }

      if(!ata.criadoEm) ata.criadoEm = new Date().toISOString();

      LICSYSTEM.arp.load();
      var idx = -1;
      for(var i=0;i<LICSYSTEM.arp.atas.length;i++){
        if(LICSYSTEM.arp.atas[i].id === ata.id){ idx = i; break; }
      }
      if(idx >= 0){
        ata.criadoEm = LICSYSTEM.arp.atas[idx].criadoEm || ata.criadoEm;
        LICSYSTEM.arp.atas[idx] = ata;
      } else {
        LICSYSTEM.arp.atas.push(ata);
      }

      if(el("arpId")) el("arpId").value = ata.id;
      LICSYSTEM.arp.saveLocal();
      // TODO Firestore/RTDB:
      // await firestore.collection('arp').doc(ata.id).set(ata)
      // ou utils.firebaseSet('arp/'+ata.id, ata)

      LICSYSTEM.arp.renderListaSalvas();
      showAlert("arpAlert","ok","✅ Ata salva ("+utils.escapeHtml(ata.numeroPregaoArp)+") com "+ata.itens.length+" item(ns).");
      return ata;
    }
  };

  /* ============================ SALA DE DISPUTA ============================ */
  LICSYSTEM.disputa = {
    historico: [],

    num: function(id){
      var n = el(id);
      var v = n ? Number(n.value) : NaN;
      return isFinite(v) ? v : 0;
    },

    /** Atualiza cards de desconto % e margem restante em tempo real (oninput/onchange). */
    atualizarResultados: function(){
      var ref = LICSYSTEM.disputa.num("disputaPrecoRef");
      var degrau = LICSYSTEM.disputa.num("disputaDegrau");
      var lanceConc = LICSYSTEM.disputa.num("disputaLanceConcorrente");
      var custo = LICSYSTEM.disputa.num("disputaMeuCusto");

      // Desconto atual (%) em relação ao preço de referência
      var descontoPct = null;
      if(ref > 0 && lanceConc > 0){
        descontoPct = ((ref - lanceConc) / ref) * 100;
      }
      var elPct = el("disputaDescontoPct");
      var elPctSub = el("disputaDescontoSub");
      if(elPct){
        elPct.textContent = descontoPct == null ? "—" : (descontoPct.toFixed(2).replace(".", ",") + "%");
      }
      if(elPctSub){
        elPctSub.textContent = lanceConc > 0
          ? ("Lance concorrente: " + utils.formatBrl(lanceConc))
          : "Informe o lance do concorrente";
      }

      // Margem restante = preço/lance atual − meu custo
      // Se custo não informado, usa (preço ref − margem implícita) via próprio custo campo
      var margem = null;
      if(lanceConc > 0 && (el("disputaMeuCusto") && String(el("disputaMeuCusto").value || "").trim() !== "")){
        margem = lanceConc - custo;
      }
      var elMarg = el("disputaMargemRestante");
      var elMargSub = el("disputaMargemSub");
      var cardMarg = el("cardMargemRestante");
      if(elMarg){
        elMarg.textContent = margem == null ? "—" : utils.formatBrl(margem);
      }
      if(elMargSub){
        if(margem == null) elMargSub.textContent = "Informe meu custo e o lance atual";
        else if(margem < 0) elMargSub.textContent = "⚠ PARAR — margem negativa / prejuízo";
        else elMargSub.textContent = "Lance atual − meu custo";
      }
      if(cardMarg){
        cardMarg.classList.remove("warn","ok");
        if(margem != null && margem < 0) cardMarg.classList.add("warn");
        else if(margem != null && margem >= 0) cardMarg.classList.add("ok");
      }

      // Próximo lance sugerido = lance concorrente − degrau
      var prox = null;
      if(lanceConc > 0 && degrau >= 0){
        prox = Math.max(0, lanceConc - degrau);
      }
      if(el("disputaMeuProximoLance")){
        el("disputaMeuProximoLance").value = prox == null ? "" : prox.toFixed(2);
      }
    },

    registrarLance: function(){
      LICSYSTEM.disputa.atualizarResultados();
      var degrau = LICSYSTEM.disputa.num("disputaDegrau");
      var lanceConc = LICSYSTEM.disputa.num("disputaLanceConcorrente");
      if(!(lanceConc > 0)){
        showAlert("disputaAlert","warn","Informe o Lance Atual do Concorrente.");
        if(el("disputaLanceConcorrente")) el("disputaLanceConcorrente").focus();
        return;
      }
      var meuLance = Math.max(0, lanceConc - degrau);
      // Atualiza o "lance atual" para o meu lance (próxima rodada)
      if(el("disputaLanceConcorrente")) el("disputaLanceConcorrente").value = meuLance.toFixed(2);

      var agora = new Date();
      var hh = ("0"+agora.getHours()).slice(-2);
      var mm = ("0"+agora.getMinutes()).slice(-2);
      var ss = ("0"+agora.getSeconds()).slice(-2);
      var hora = hh+":"+mm+":"+ss;

      LICSYSTEM.disputa.historico.unshift({
        hora: hora,
        valor: meuLance,
        ts: agora.toISOString()
      });

      LICSYSTEM.disputa.renderHistorico();
      LICSYSTEM.disputa.atualizarResultados();
      hideAlert("disputaAlert");
      showAlert("disputaAlert","ok","Lance registrado: "+utils.formatBrl(meuLance)+" às "+hora);
    },

    renderHistorico: function(){
      var ul = el("disputaHistorico");
      var count = el("disputaHistCount");
      var list = LICSYSTEM.disputa.historico || [];
      if(count) count.textContent = list.length + " registro(s)";
      if(!ul) return;
      if(!list.length){
        ul.innerHTML = '<li class="lh-empty">Nenhum lance registrado ainda.</li>';
        return;
      }
      var html = "";
      list.forEach(function(it, i){
        html += '<li>'+
          '<span class="lh-hora">'+utils.escapeHtml(it.hora)+'</span>'+
          '<span class="lh-val">'+(i===0?"→ ":"")+utils.formatBrl(it.valor)+'</span>'+
        '</li>';
      });
      ul.innerHTML = html;
    },

    limparSessao: function(){
      if(LICSYSTEM.disputa.historico.length && !confirm("Limpar histórico e campos da disputa?")) return;
      LICSYSTEM.disputa.historico = [];
      ["disputaPrecoRef","disputaDegrau","disputaLanceConcorrente","disputaMeuCusto","disputaMeuProximoLance"].forEach(function(id){
        if(el(id)) el(id).value = "";
      });
      LICSYSTEM.disputa.renderHistorico();
      LICSYSTEM.disputa.atualizarResultados();
      hideAlert("disputaAlert");
    }
  };

  /* ============================ HISTÓRICO E CONTROLE DE ENTREGAS ============================ */
  var HIST_ENTREGAS_KEY = "licsystem_hist_entregas_v1";

  function histUid(){
    return "he_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function histStatusOf(it){
    var sol = Number(it.qtdSolicitada) || 0;
    var ent = Number(it.qtdEntregue) || 0;
    if(ent <= 0) return "pendente";
    if(ent >= sol && sol > 0) return "concluido";
    return "parcial";
  }

  /**
   * Atualiza "Falta Entregar" ao alterar Qtd Entregue.
   * Se entregue === solicitada, marca a checkbox e destaca a linha.
   */
  function calcularFaltaEntregar(id, qtdEntregueRaw){
    LICSYSTEM.histEntregas.load();
    var item = null;
    for(var i=0;i<LICSYSTEM.histEntregas.items.length;i++){
      if(LICSYSTEM.histEntregas.items[i].id === id){ item = LICSYSTEM.histEntregas.items[i]; break; }
    }
    if(!item) return 0;

    var solicitada = Math.max(0, Number(item.qtdSolicitada) || 0);
    var entregue = Math.max(0, Number(qtdEntregueRaw));
    if(!isFinite(entregue)) entregue = 0;
    if(entregue > solicitada) entregue = solicitada;
    item.qtdEntregue = entregue;

    var falta = Math.max(0, solicitada - entregue);
    item.concluido = (solicitada > 0 && entregue >= solicitada);

    var row = document.querySelector('tr[data-hist-row="'+id+'"]');
    if(row){
      var faltaCell = row.querySelector(".hist-falta");
      if(faltaCell){
        faltaCell.textContent = String(falta);
        faltaCell.classList.toggle("zero", falta === 0 && solicitada > 0);
      }
      var chk = row.querySelector(".hist-check");
      if(chk) chk.checked = !!item.concluido;
      var lbl = row.querySelector(".hist-check-label");
      if(lbl) lbl.textContent = item.concluido ? "Concluído" : (entregue > 0 ? "Parcial" : "Pendente");
      row.classList.toggle("hist-done", !!item.concluido);
      var qInp = row.querySelector('input[data-hist-f="qtdEntregue"]');
      if(qInp && String(qInp.value) !== String(entregue)) qInp.value = entregue;
    }

    LICSYSTEM.histEntregas.saveLocal();
    calcularResumoFinanceiro();
    return falta;
  }

  /**
   * Multiplica Qtd Entregue × Custo/Venda e atualiza os cards do topo.
   * Card 4: soma das unidades ainda pendentes (lista filtrada).
   */
  function calcularResumoFinanceiro(){
    LICSYSTEM.histEntregas.load();
    var list = LICSYSTEM.histEntregas.filtrados();
    var totalVendido = 0;
    var custoTotal = 0;
    var pendentes = 0;

    for(var i=0;i<list.length;i++){
      var it = list[i];
      var ent = Math.max(0, Number(it.qtdEntregue) || 0);
      var sol = Math.max(0, Number(it.qtdSolicitada) || 0);
      var custo = Math.max(0, Number(it.custoUn) || 0);
      var venda = Math.max(0, Number(it.vendaUn) || 0);
      totalVendido += ent * venda;
      custoTotal += ent * custo;
      pendentes += Math.max(0, sol - ent);
    }

    var lucro = totalVendido - custoTotal;
    if(el("histTotalVendido")) el("histTotalVendido").textContent = utils.formatBrl(totalVendido);
    if(el("histCustoTotal")) el("histCustoTotal").textContent = utils.formatBrl(custoTotal);
    if(el("histLucroBruto")) el("histLucroBruto").textContent = utils.formatBrl(lucro);
    if(el("histPendentes")) el("histPendentes").textContent = String(pendentes);
    return { totalVendido: totalVendido, custoTotal: custoTotal, lucroBruto: lucro, pendentes: pendentes };
  }

  window.calcularFaltaEntregar = calcularFaltaEntregar;
  window.calcularResumoFinanceiro = calcularResumoFinanceiro;

  LICSYSTEM.histEntregas = {
    items: [],
    _loaded: false,
    filtroTexto: "",
    filtroStatus: "todos",

    exemplos: function(){
      return [
        { id: histUid(), empenho: "Pref. Ibaiti — 2026/001", produto: "Abraçadeira Borboleta 12–20mm (kit 10)", qtdSolicitada: 50, qtdEntregue: 20, custoUn: 8.5, vendaUn: 14.9, concluido: false },
        { id: histUid(), empenho: "Pref. Ibaiti — 2026/001", produto: "Furadeira de Impacto 750W", qtdSolicitada: 12, qtdEntregue: 12, custoUn: 189, vendaUn: 279, concluido: true },
        { id: histUid(), empenho: "Câmara Jacarezinho — NE 2026/088", produto: "Trena Laser 40m", qtdSolicitada: 8, qtdEntregue: 0, custoUn: 95, vendaUn: 149.9, concluido: false },
        { id: histUid(), empenho: "Pref. Santo Antônio — PE 014/2026", produto: "Parafusadeira 12V + kit bits", qtdSolicitada: 25, qtdEntregue: 10, custoUn: 210, vendaUn: 329, concluido: false },
        { id: histUid(), empenho: "Consórcio Norte Pioneiro — ARP 03/2026", produto: "Disco de Corte 4.1/2\" (cx 25)", qtdSolicitada: 40, qtdEntregue: 40, custoUn: 42, vendaUn: 68, concluido: true }
      ];
    },

    load: function(){
      if(LICSYSTEM.histEntregas._loaded) return LICSYSTEM.histEntregas.items;
      try{
        var raw = localStorage.getItem(HIST_ENTREGAS_KEY);
        var saved = raw ? JSON.parse(raw) : null;
        if(Array.isArray(saved) && saved.length){
          LICSYSTEM.histEntregas.items = saved;
        } else {
          LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.exemplos();
          LICSYSTEM.histEntregas.saveLocal();
        }
      }catch(e){
        LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.exemplos();
      }
      LICSYSTEM.histEntregas._loaded = true;
      return LICSYSTEM.histEntregas.items;
    },

    saveLocal: function(){
      try{
        localStorage.setItem(HIST_ENTREGAS_KEY, JSON.stringify(LICSYSTEM.histEntregas.items || []));
      }catch(e){}
      // TODO Firestore: collection('historico_entregas').doc(id).set(item, { merge:true })
    },

    carregarExemplos: function(force){
      if(force && !confirm("Substituir a lista atual pelos exemplos de demonstração?")) return;
      LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.exemplos();
      LICSYSTEM.histEntregas._loaded = true;
      LICSYSTEM.histEntregas.saveLocal();
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Exemplos carregados.");
    },

    filtrados: function(){
      LICSYSTEM.histEntregas.load();
      var q = utils.fold(LICSYSTEM.histEntregas.filtroTexto || "").toLowerCase().trim();
      var st = LICSYSTEM.histEntregas.filtroStatus || "todos";
      return LICSYSTEM.histEntregas.items.filter(function(it){
        var status = histStatusOf(it);
        if(st !== "todos" && status !== st) return false;
        if(!q) return true;
        var blob = utils.fold((it.empenho||"")+" "+(it.produto||"")).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    },

    aplicarFiltros: function(){
      LICSYSTEM.histEntregas.filtroTexto = (el("histBusca") && el("histBusca").value) || "";
      LICSYSTEM.histEntregas.filtroStatus = (el("histStatus") && el("histStatus").value) || "todos";
      LICSYSTEM.histEntregas.renderTabela();
      calcularResumoFinanceiro();
    },

    find: function(id){
      LICSYSTEM.histEntregas.load();
      for(var i=0;i<LICSYSTEM.histEntregas.items.length;i++){
        if(LICSYSTEM.histEntregas.items[i].id === id) return LICSYSTEM.histEntregas.items[i];
      }
      return null;
    },

    onEdit: function(id, field, value){
      var item = LICSYSTEM.histEntregas.find(id);
      if(!item) return;
      if(field === "empenho" || field === "produto"){
        item[field] = String(value || "");
      } else if(field === "qtdSolicitada"){
        var sol = Math.max(0, Number(value) || 0);
        item.qtdSolicitada = sol;
        if((Number(item.qtdEntregue)||0) > sol) item.qtdEntregue = sol;
        calcularFaltaEntregar(id, item.qtdEntregue);
        return;
      } else if(field === "custoUn" || field === "vendaUn"){
        item[field] = Math.max(0, Number(value) || 0);
        LICSYSTEM.histEntregas.saveLocal();
        calcularResumoFinanceiro();
        return;
      }
      LICSYSTEM.histEntregas.saveLocal();
    },

    toggleConcluido: function(id, checked){
      var item = LICSYSTEM.histEntregas.find(id);
      if(!item) return;
      var sol = Math.max(0, Number(item.qtdSolicitada) || 0);
      if(checked){
        calcularFaltaEntregar(id, sol);
      } else {
        var atual = Math.max(0, Number(item.qtdEntregue) || 0);
        var novo = atual >= sol ? Math.max(0, sol - 1) : atual;
        calcularFaltaEntregar(id, novo);
      }
    },

    adicionarItem: function(){
      LICSYSTEM.histEntregas.load();
      LICSYSTEM.histEntregas.items.unshift({
        id: histUid(),
        empenho: "",
        produto: "",
        qtdSolicitada: 1,
        qtdEntregue: 0,
        custoUn: 0,
        vendaUn: 0,
        concluido: false
      });
      LICSYSTEM.histEntregas.saveLocal();
      if(el("histStatus")) el("histStatus").value = "todos";
      LICSYSTEM.histEntregas.filtroStatus = "todos";
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Linha adicionada — preencha empenho, produto e quantidades.");
    },

    remover: function(id){
      if(!confirm("Remover este item do histórico?")) return;
      LICSYSTEM.histEntregas.load();
      LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.items.filter(function(it){ return it.id !== id; });
      LICSYSTEM.histEntregas.saveLocal();
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Item removido.");
    },

    render: function(){
      if(el("histBusca")) LICSYSTEM.histEntregas.filtroTexto = el("histBusca").value || "";
      if(el("histStatus")) LICSYSTEM.histEntregas.filtroStatus = el("histStatus").value || "todos";
      LICSYSTEM.histEntregas.load();
      LICSYSTEM.histEntregas.renderTabela();
      calcularResumoFinanceiro();
    },

    renderTabela: function(){
      var body = el("histEntregasBody");
      if(!body) return;
      var list = LICSYSTEM.histEntregas.filtrados();
      if(!list.length){
        body.innerHTML = '<tr><td colspan="9" class="muted small" style="text-align:center;padding:22px">Nenhum item encontrado com os filtros atuais.</td></tr>';
        return;
      }
      var html = "";
      for(var i=0;i<list.length;i++){
        var it = list[i];
        var sol = Math.max(0, Number(it.qtdSolicitada) || 0);
        var ent = Math.max(0, Number(it.qtdEntregue) || 0);
        var falta = Math.max(0, sol - ent);
        var done = sol > 0 && ent >= sol;
        var st = histStatusOf(it);
        var stLabel = st === "concluido" ? "Concluído" : (st === "parcial" ? "Parcial" : "Pendente");
        html +=
          '<tr data-hist-row="'+utils.escapeHtml(it.id)+'" class="'+(done?"hist-done":"")+'">'+
            '<td><input type="text" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="empenho" value="'+utils.escapeHtml(it.empenho||"")+'" placeholder="ex.: Pref. Ibaiti — 2026/001" /></td>'+
            '<td><input type="text" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="produto" value="'+utils.escapeHtml(it.produto||"")+'" placeholder="Nome do item" /></td>'+
            '<td><input class="hist-qtd" type="number" min="0" step="1" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="qtdSolicitada" value="'+sol+'" /></td>'+
            '<td><input class="hist-qtd" type="number" min="0" step="1" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="qtdEntregue" value="'+ent+'" /></td>'+
            '<td class="hist-falta'+(falta===0 && sol>0?" zero":"")+'">'+falta+'</td>'+
            '<td><input class="hist-money" type="number" min="0" step="0.01" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="custoUn" value="'+(Number(it.custoUn)||0)+'" /></td>'+
            '<td><input class="hist-money" type="number" min="0" step="0.01" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="vendaUn" value="'+(Number(it.vendaUn)||0)+'" /></td>'+
            '<td><div class="hist-check-wrap">'+
              '<input class="hist-check" type="checkbox" data-hist-id="'+utils.escapeHtml(it.id)+'" '+(done?"checked":"")+' aria-label="Marcar como concluído" />'+
              '<span class="hist-check-label">'+stLabel+'</span>'+
            '</div></td>'+
            '<td><button type="button" class="btn btn-ghost btn-sm histDel" data-hist-id="'+utils.escapeHtml(it.id)+'" title="Remover">🗑</button></td>'+
          '</tr>';
      }
      body.innerHTML = html;
    }
  };

  /* ============================ ANÁLISE INTELIGENTE DE EDITAIS (IA) ============================ */
  LICSYSTEM.analiseIa = {
    file: null,
    text: "",
    relatorioMd: "",
    busy: false,
    MAX_PAGES: 45,
    MAX_CHARS: 150000,

    setBusy: function(on){
      LICSYSTEM.analiseIa.busy = !!on;
      var btn = el("btnIaAnalisar");
      if(btn){
        btn.disabled = !!on;
        btn.textContent = on ? "Analisando…" : "✨ Analisar com IA";
      }
      var prog = el("iaProgress");
      if(prog){
        prog.classList.toggle("show", !!on);
        prog.setAttribute("aria-hidden", on ? "false" : "true");
      }
    },

    setActionButtons: function(enabled){
      var c = el("btnIaCopiar");
      var p = el("btnIaImprimir");
      if(c) c.disabled = !enabled;
      if(p) p.disabled = !enabled;
    },

    limparRelatorio: function(){
      LICSYSTEM.analiseIa.relatorioMd = "";
      var sheet = el("iaReportSheet");
      if(sheet){
        sheet.className = "ia-report-sheet ia-empty";
        sheet.innerHTML = "O relatório da análise aparecerá aqui após processar o edital.";
      }
      LICSYSTEM.analiseIa.setActionButtons(false);
    },

    limpar: function(){
      LICSYSTEM.analiseIa.file = null;
      LICSYSTEM.analiseIa.text = "";
      var inp = el("iaPdfFile");
      if(inp) inp.value = "";
      var meta = el("iaFileMeta");
      if(meta){ meta.className = "ia-file-meta"; meta.textContent = ""; }
      LICSYSTEM.analiseIa.limparRelatorio();
      hideAlert("iaAlert");
      LICSYSTEM.analiseIa.setBusy(false);
    },

    renderRelatorio: function(md){
      var sheet = el("iaReportSheet");
      if(!sheet) return;
      var raw = String(md || "").trim();
      LICSYSTEM.analiseIa.relatorioMd = raw;
      if(!raw){
        LICSYSTEM.analiseIa.limparRelatorio();
        return;
      }
      var html = "";
      try{
        if(window.marked && typeof window.marked.parse === "function"){
          html = window.marked.parse(raw);
        } else if(window.marked && typeof window.marked === "function"){
          html = window.marked(raw);
        } else {
          html = "<pre style='white-space:pre-wrap;font-family:inherit'>"+utils.escapeHtml(raw)+"</pre>";
        }
      }catch(e){
        html = "<pre style='white-space:pre-wrap;font-family:inherit'>"+utils.escapeHtml(raw)+"</pre>";
      }
      sheet.className = "ia-report-sheet";
      sheet.innerHTML = html;
      LICSYSTEM.analiseIa.setActionButtons(true);
    },

    copiarRelatorio: function(){
      var md = LICSYSTEM.analiseIa.relatorioMd || "";
      if(!md){
        showAlert("iaAlert","warn","Não há relatório para copiar.");
        return;
      }
      var done = function(){
        showAlert("iaAlert","ok","Relatório copiado para a área de transferência.");
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(md).then(done).catch(function(){
          var ta = document.createElement("textarea");
          ta.value = md;
          document.body.appendChild(ta);
          ta.select();
          try{ document.execCommand("copy"); done(); }
          catch(e){ showAlert("iaAlert","error","Não foi possível copiar."); }
          document.body.removeChild(ta);
        });
      } else {
        showAlert("iaAlert","warn","Copiar não disponível neste navegador.");
      }
    },

    imprimirRelatorio: function(){
      if(!LICSYSTEM.analiseIa.relatorioMd){
        showAlert("iaAlert","warn","Não há relatório para imprimir.");
        return;
      }
      try{ window.print(); }catch(e){
        showAlert("iaAlert","error","Falha ao abrir impressão.");
      }
    },

    errMsg: function(err){
      if(!err) return "Erro desconhecido";
      if(typeof err === "string") return err;
      if(err.message && typeof err.message === "string") return err.message;
      try{ return JSON.stringify(err); }catch(e){ return String(err); }
    },

    onFile: function(file){
      if(!file) return;
      if(file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name||"")){
        showAlert("iaAlert","warn","Selecione um arquivo PDF.");
        return;
      }
      LICSYSTEM.analiseIa.file = file;
      LICSYSTEM.analiseIa.text = "";
      LICSYSTEM.analiseIa.limparRelatorio();
      LICSYSTEM.analiseIa.setBusy(false);
      var meta = el("iaFileMeta");
      if(meta){
        var kb = (file.size / 1024).toFixed(1);
        meta.className = "ia-file-meta show";
        meta.textContent = "Arquivo: " + file.name + " (" + kb + " KB) — clique em Analisar com IA.";
      }
      hideAlert("iaAlert");
    },

    extrairTextoPdf: function(file){
      var maxPages = LICSYSTEM.analiseIa.MAX_PAGES;
      var maxChars = LICSYSTEM.analiseIa.MAX_CHARS;

      return utils.ensurePdfJs().then(function(){
        return new Promise(function(resolve, reject){
          var reader = new FileReader();
          reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo PDF.")); };
          reader.onload = function(){
            try{ resolve(new Uint8Array(reader.result)); }
            catch(e){ reject(e); }
          };
          reader.readAsArrayBuffer(file);
        });
      }).then(function(data){
        return window.pdfjsLib.getDocument({ data: data }).promise;
      }).then(function(pdf){
        var total = pdf.numPages || 0;
        var limit = Math.min(total, maxPages);
        var pages = [];
        var i = 1;

        function next(){
          if(i > limit){
            var joined = pages.join("\n\n");
            if(total > limit){
              joined += "\n\n[... truncado: lidas "+limit+" de "+total+" páginas ...]";
            }
            return Promise.resolve(joined);
          }
          showAlert(
            "iaAlert",
            "info",
            '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Extraindo texto… página '+i+' de '+limit+(total>limit?' (edital tem '+total+')':'')+'…'
          );
          return pdf.getPage(i).then(function(page){
            return page.getTextContent().then(function(tc){
              var line = (tc.items || []).map(function(it){ return it.str || ""; }).join(" ");
              pages.push(line);
              var soFar = pages.join("\n\n");
              i++;
              if(soFar.length >= maxChars){
                return soFar.slice(0, maxChars) + "\n\n[... texto truncado para análise ...]";
              }
              return next();
            });
          });
        }
        return next();
      });
    },

    analisar: function(){
      if(LICSYSTEM.analiseIa.busy) return;
      var file = LICSYSTEM.analiseIa.file;
      if(!file){
        showAlert("iaAlert","warn","Selecione o PDF do edital primeiro.");
        return;
      }

      LICSYSTEM.analiseIa.setBusy(true);
      LICSYSTEM.analiseIa.limparRelatorio();
      showAlert("iaAlert","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Carregando PDF e extraindo texto…');

      LICSYSTEM.analiseIa.extrairTextoPdf(file).then(function(text){
        text = String(text || "").replace(/\s+/g, " ").trim();
        if(!text || text.length < 40){
          throw new Error("Não foi possível extrair texto suficiente deste PDF (pode ser imagem escaneada).");
        }
        LICSYSTEM.analiseIa.text = text;
        showAlert(
          "iaAlert",
          "info",
          '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Texto extraído ('+text.length+' caracteres). Gerando relatório com a IA…'
        );

        return fetch("/api/analyze-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            text: text,
            filename: file.name || "edital.pdf"
          })
        }).then(function(res){
          return res.text().then(function(raw){
            var body = null;
            try{ body = raw ? JSON.parse(raw) : null; }catch(e){
              throw new Error("Resposta inválida da API (HTTP "+res.status+").");
            }
            if(!res.ok){
              var msg = (body && (body.detail || body.error)) || ("Erro HTTP " + res.status);
              throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
            }
            return body;
          });
        });
      }).then(function(body){
        var md = (body && body.relatorio) || "";
        if(!md) throw new Error("A API não retornou o campo relatorio.");
        LICSYSTEM.analiseIa.renderRelatorio(md);
        showAlert("iaAlert","ok","✅ Relatório gerado com sucesso.");
      }).catch(function(err){
        showAlert("iaAlert","error", utils.escapeHtml(LICSYSTEM.analiseIa.errMsg(err)));
      }).then(function(){
        LICSYSTEM.analiseIa.setBusy(false);
      });
    },

    wire: function(){
      var drop = el("iaDrop");
      var inp = el("iaPdfFile");
      if(drop && inp){
        drop.addEventListener("click", function(){ inp.click(); });
        drop.addEventListener("keydown", function(e){
          if(e.key === "Enter" || e.key === " "){ e.preventDefault(); inp.click(); }
        });
        ["dragenter","dragover"].forEach(function(ev){
          drop.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            drop.classList.add("drag");
          });
        });
        ["dragleave","drop"].forEach(function(ev){
          drop.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            drop.classList.remove("drag");
          });
        });
        drop.addEventListener("drop", function(e){
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if(f) LICSYSTEM.analiseIa.onFile(f);
        });
        inp.addEventListener("change", function(){
          if(this.files && this.files[0]) LICSYSTEM.analiseIa.onFile(this.files[0]);
        });
      }
    }
  };

  /* ============================ AUTH (Firebase) ============================ */
  LICSYSTEM.auth = {
    _booted: false,
    _ready: false,

    mapError: function(err){
      var code = (err && err.code) || "";
      var map = {
        "auth/invalid-email": "E-mail inválido.",
        "auth/user-disabled": "Usuário desativado.",
        "auth/user-not-found": "Usuário não encontrado. Crie o usuário no Firebase Console.",
        "auth/wrong-password": "Senha incorreta.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/operation-not-allowed": "Ative o provedor E-mail/senha no Firebase Console → Authentication.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde e tente de novo.",
        "auth/network-request-failed": "Falha de rede. Verifique a conexão.",
        "auth/unauthorized-domain": "Domínio não autorizado. Em Authentication → Settings, adicione licsystem.vercel.app."
      };
      return map[code] || ((err && err.message) ? err.message : "Falha na autenticação.");
    },

    lock: function(){
      document.body.classList.add("auth-locked");
      var btn = el("btnLogout");
      if(btn) btn.style.display = "none";
    },

    unlock: function(user){
      document.body.classList.remove("auth-locked");
      LICSYSTEM.state.authUser = user || null;
      var email = (user && user.email) || "";
      var name = email ? email.split("@")[0] : "LICSYSTEM";
      if(el("topUserName")) el("topUserName").textContent = name;
      if(el("topUserEmail")) el("topUserEmail").textContent = email || "Setor de Licitações";
      var btn = el("btnLogout");
      if(btn) btn.style.display = "";
    },

    requireAuth: function(){
      return !!(LICSYSTEM.state.authUser && LICSYSTEM.state.authUser.uid);
    },

    login: function(email, pass){
      return utils.ensureFirebaseAuth().then(function(fb){
        return fb.auth().signInWithEmailAndPassword(email, pass);
      });
    },

    logout: function(){
      return utils.ensureFirebaseAuth().then(function(fb){
        return fb.auth().signOut();
      }).then(function(){
        LICSYSTEM.state.authUser = null;
        LICSYSTEM.auth.lock();
        showAlert("authAlert","ok","Você saiu do sistema.");
      }).catch(function(err){
        showAlert("authAlert","error", utils.escapeHtml(LICSYSTEM.auth.mapError(err)));
      });
    },

    onSubmit: function(ev){
      if(ev) ev.preventDefault();
      var email = ((el("authEmail") && el("authEmail").value) || "").trim();
      var pass = (el("authPass") && el("authPass").value) || "";
      if(!email || !pass){
        showAlert("authAlert","warn","Preencha e-mail e senha.");
        return;
      }
      if(pass.length < 6){
        showAlert("authAlert","warn","A senha deve ter no mínimo 6 caracteres.");
        return;
      }
      var btn = el("authSubmit");
      if(btn){ btn.disabled = true; btn.textContent = "Aguarde…"; }
      showAlert("authAlert","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Validando…');

      LICSYSTEM.auth.login(email, pass).then(function(){
        hideAlert("authAlert");
        if(el("authPass")) el("authPass").value = "";
      }).catch(function(err){
        showAlert("authAlert","error", utils.escapeHtml(LICSYSTEM.auth.mapError(err)));
      }).then(function(){
        if(btn){ btn.disabled = false; btn.textContent = "Entrar"; }
      });
    },

    wire: function(){
      var form = el("authForm");
      if(form) form.addEventListener("submit", LICSYSTEM.auth.onSubmit);
      var out = el("btnLogout");
      if(out) out.addEventListener("click", function(){
        if(confirm("Sair do LICSYSTEM?")) LICSYSTEM.auth.logout();
      });
    },

    start: function(onReady){
      LICSYSTEM.auth.wire();
      LICSYSTEM.auth.lock();

      return utils.ensureFirebaseAuth().then(function(fb){
        return new Promise(function(resolve){
          var first = true;
          fb.auth().onAuthStateChanged(function(user){
            if(user){
              LICSYSTEM.auth.unlock(user);
              if(!LICSYSTEM.auth._booted){
                LICSYSTEM.auth._booted = true;
                if(typeof onReady === "function") onReady(user);
              }
            } else {
              LICSYSTEM.state.authUser = null;
              LICSYSTEM.auth.lock();
            }
            if(first){
              first = false;
              LICSYSTEM.auth._ready = true;
              resolve(user || null);
            }
          });
        });
      }).catch(function(err){
        LICSYSTEM.auth.lock();
        var msg = (err && err.message) ? err.message : (typeof err === "string" ? err : "erro desconhecido");
        try{ if(typeof msg !== "string") msg = JSON.stringify(msg); }catch(e){ msg = String(err); }
        showAlert("authAlert","error",
          "Não foi possível carregar o Firebase Auth: "+utils.escapeHtml(msg)+
          "<br/><span class=\"small\">Confira FIREBASE_* nas Environment Variables da Vercel e se /api/firebase-config responde. Depois faça Redeploy.</span>"
        );
        throw err;
      });
    }
  };

  /* ============================ BOOT ============================ */
  function bootApp(){
    wire();
    LICSYSTEM.captacao.initUf();
    LICSYSTEM.orcamento.load();
    LICSYSTEM.state._orcDirty = true;
    LICSYSTEM.state._orcRendered = false;
    LICSYSTEM.state._dashReady = false;
    LICSYSTEM.state._cofreRendered = false;
    LICSYSTEM.updateBell();
    LICSYSTEM.state.currentView = "dashboard";

    // UI primeiro; pesado depois (não trava a abertura)
    requestAnimationFrame(function(){
      LICSYSTEM.dashboard.render();
      LICSYSTEM.state._dashReady = true;
    LICSYSTEM.cofre.load();
    LICSYSTEM.cofre.render();
    LICSYSTEM.state._cofreRendered = true;
    LICSYSTEM.entregas.load();
    // Orçamento só monta quando abrir a aba (planilha grande)
      setTimeout(function(){
        LICSYSTEM.ferramentas.getPerfil(true).catch(function(){});
        // Database em background (perfil/Firebase)
        utils.ensureFirebase().catch(function(){});
      }, 400);
      setTimeout(function(){
        if(window.__licsystemInitVoiceflow) window.__licsystemInitVoiceflow();
      }, 2500);
    });
  }

  function boot(){
    LICSYSTEM.state.authUser = null;
    LICSYSTEM.auth.start(function(){
      bootApp();
    }).catch(function(){
      // permanece na tela de login
    });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
