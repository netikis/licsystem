/* LICSYSTEM — LEILOES PARTICIPO (11-leiloes.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var LEILOES_PARTICIPO_KEY = ctx.LEILOES_PARTICIPO_KEY;
  var ACTIVE_LEILAO_KEY = ctx.ACTIVE_LEILAO_KEY;
  var LEILAO_SCOPED_VIEWS = ctx.LEILAO_SCOPED_VIEWS;

  /* ============================ LEILÃO QUE PARTICIPO ============================ */
  LICSYSTEM.leiloesParticipo = {
    items: [],

    load: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(LEILOES_PARTICIPO_KEY) || "null");
        LICSYSTEM.leiloesParticipo.applyData(Array.isArray(raw) ? raw : [], { skipPersist: true });
      }catch(e){
        LICSYSTEM.leiloesParticipo.items = [];
      }
    },

    applyData: function(list, opts){
      opts = opts || {};
      var arr = Array.isArray(list) ? list : [];
      LICSYSTEM.leiloesParticipo.items = arr.map(function(it, i){
        return LICSYSTEM.leiloesParticipo.normalizeItem(it, i);
      });
      if(!opts.skipPersist){
        try{ localStorage.setItem(LEILOES_PARTICIPO_KEY, JSON.stringify(LICSYSTEM.leiloesParticipo.items)); }catch(e){}
      }
      if(LICSYSTEM.state.currentView === "leiloesParticipo"){
        try{ LICSYSTEM.leiloesParticipo.render(); }catch(e){}
      }
    },

    normalizeWorkspace: function(ws){
      ws = ws || {};
      var orc = ws.orcamento && typeof ws.orcamento === "object" ? ws.orcamento : {};
      var items = Array.isArray(orc.items) ? orc.items : [];
      var meta = orc.meta && typeof orc.meta === "object" ? orc.meta : {};
      return {
        relatorioMd: String(ws.relatorioMd || "").slice(0, 100000),
        pdfKeywords: String(ws.pdfKeywords || "").slice(0, 300),
        captacaoLines: Array.isArray(ws.captacaoLines) ? ws.captacaoLines.slice(0, 500) : [],
        orcamento: {
          v: 2,
          items: items.slice(0, 500).map(function(row){
            return LICSYSTEM.orcamento.normalizeItem(row);
          }),
          meta: {
            nome: String(meta.nome || "").slice(0, 220),
            numero: String(meta.numero || "").slice(0, 120),
            catalogId: meta.catalogId != null ? meta.catalogId : null
          },
          page: Math.max(1, Number(orc.page) || 1)
        },
        cruzamentoAprovados: Array.isArray(ws.cruzamentoAprovados) ? ws.cruzamentoAprovados.slice(0, 300) : []
      };
    },

    emptyWorkspace: function(){
      return LICSYSTEM.leiloesParticipo.normalizeWorkspace({});
    },

    normalizeItem: function(it, idx){
      it = it || {};
      var docs = Array.isArray(it.documentosExigidos) ? it.documentosExigidos : [];
      return {
        id: String(it.id || ("lp_" + Date.now() + "_" + (idx || 0))),
        titulo: String(it.titulo || it.editalNome || "Edital").trim().slice(0, 220),
        orgao: String(it.orgao || "").trim().slice(0, 220),
        municipio: String(it.municipio || "").trim().slice(0, 120),
        filename: String(it.filename || "").trim().slice(0, 220),
        dataAnalise: Number(it.dataAnalise || it.createdAt || Date.now()) || Date.now(),
        resumo: String(it.resumo || it.analysisSnippet || "").trim().slice(0, 600),
        analysisSnippet: String(it.analysisSnippet || it.resumo || "").trim().slice(0, 600),
        documentosExigidos: docs.map(function(d, i){
          return {
            id: String(d.id || ("lpdoc_" + String(it.id || idx || 0) + "_" + i)),
            nome: String(d.nome || "Documento").trim().slice(0, 220),
            tipo: String(d.tipo || "outro").slice(0, 40),
            obs: String(d.obs || "").trim().slice(0, 400),
            ok: !!d.ok
          };
        }).slice(0, 80),
        workspace: LICSYSTEM.leiloesParticipo.normalizeWorkspace(it.workspace),
        status: (it.status === "arquivado") ? "arquivado" : "participando",
        createdAt: Number(it.createdAt || it.dataAnalise || Date.now()) || Date.now(),
        updatedAt: Number(it.updatedAt || Date.now()) || Date.now()
      };
    },

    findById: function(id){
      id = String(id || "");
      if(!id) return null;
      var items = LICSYSTEM.leiloesParticipo.items || [];
      for(var i = 0; i < items.length; i++){
        if(String(items[i].id) === id) return items[i];
      }
      return null;
    },

    getActiveItem: function(){
      return LICSYSTEM.leiloesParticipo.findById(LICSYSTEM.state.activeLeilaoId);
    },

    setActiveId: function(id){
      id = id ? String(id) : null;
      var anterior = LICSYSTEM.state.activeLeilaoId ? String(LICSYSTEM.state.activeLeilaoId) : null;
      LICSYSTEM.state.activeLeilaoId = id;
      try{
        if(id) localStorage.setItem(ACTIVE_LEILAO_KEY, id);
        else localStorage.removeItem(ACTIVE_LEILAO_KEY);
      }catch(e){}
      // Os avisos citam o edital pelo nome: ao trocar de edital eles viram informação falsa.
      if(anterior !== id) LICSYSTEM.leiloesParticipo.limparAvisosDoEdital();
      LICSYSTEM.leiloesParticipo.updateContextBar();
    },

    /** Apaga alertas presos na tela que se referem ao edital anterior. */
    limparAvisosDoEdital: function(){
      var ids = ["orcAlert", "pdfStatus", "docsAlert", "iaAlert", "lwHubAlert"];
      for(var i = 0; i < ids.length; i++){
        try{ if(el(ids[i])) hideAlert(ids[i]); }catch(e){}
      }
    },

    restoreActiveId: function(){
      try{
        var id = localStorage.getItem(ACTIVE_LEILAO_KEY) || "";
        if(id && LICSYSTEM.leiloesParticipo.findById(id)){
          LICSYSTEM.state.activeLeilaoId = id;
        } else {
          LICSYSTEM.state.activeLeilaoId = null;
          localStorage.removeItem(ACTIVE_LEILAO_KEY);
        }
      }catch(e){
        LICSYSTEM.state.activeLeilaoId = null;
      }
    },

    syncActiveOrcamento: function(payload){
      var bound = LICSYSTEM.state.orcBoundLeilaoId;
      var targetId = (payload && payload.leilaoId) || bound || null;
      if(!targetId) return;
      var item = LICSYSTEM.leiloesParticipo.findById(targetId);
      if(!item) return;
      if(payload && payload.leilaoId && String(payload.leilaoId) !== String(item.id)) return;
      if(bound && String(bound) !== String(item.id)) return;
      if(!item.workspace) item.workspace = LICSYSTEM.leiloesParticipo.emptyWorkspace();
      item.workspace.orcamento = {
        v: 2,
        items: Array.isArray(payload && payload.items) ? payload.items.slice(0, 500) : [],
        meta: (payload && payload.meta) || { nome: "", numero: "", catalogId: null },
        page: Math.max(1, Number(payload && payload.page) || 1)
      };
      item.updatedAt = Date.now();
      LICSYSTEM.leiloesParticipo.persist({ immediate: !!payload && !!payload.immediate });
    },

    saveActiveWorkspace: function(opts){
      opts = opts || {};
      var item = LICSYSTEM.leiloesParticipo.getActiveItem();
      if(!item) return;
      var bound = LICSYSTEM.state.orcBoundLeilaoId;
      var boundMatches = !!(bound && String(bound) === String(item.id));
      if(boundMatches && LICSYSTEM.state._orcRendered !== false){
        try{ if(LICSYSTEM.orcamento && LICSYSTEM.orcamento.syncFromDom) LICSYSTEM.orcamento.syncFromDom(); }catch(e){}
      }
      var prev = item.workspace || LICSYSTEM.leiloesParticipo.emptyWorkspace();
      var kwEl = el("pdfKeywords");
      // Só sobrescreve orçamento se a planilha em memória for DESTE edital.
      var orcBlock = boundMatches
        ? {
            v: 2,
            items: Array.isArray(LICSYSTEM.state.orcItems) ? LICSYSTEM.state.orcItems : [],
            meta: {
              nome: LICSYSTEM.state.orcMetaNome || "",
              numero: LICSYSTEM.state.orcMetaNumero || "",
              catalogId: LICSYSTEM.state.orcCatalogId || null
            },
            page: LICSYSTEM.state.orcPage || 1
          }
        : (prev.orcamento || { v: 2, items: [], meta: { nome: "", numero: "", catalogId: null }, page: 1 });
      item.workspace = LICSYSTEM.leiloesParticipo.normalizeWorkspace({
        relatorioMd: (LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd) || prev.relatorioMd || "",
        pdfKeywords: kwEl ? String(kwEl.value || "") : (prev.pdfKeywords || ""),
        captacaoLines: Array.isArray(LICSYSTEM.state.captacaoLines) ? LICSYSTEM.state.captacaoLines : (prev.captacaoLines || []),
        orcamento: orcBlock,
        cruzamentoAprovados: Array.isArray(LICSYSTEM.state.aprovadosCruzamento)
          ? LICSYSTEM.state.aprovadosCruzamento
          : (prev.cruzamentoAprovados || [])
      });
      item.updatedAt = Date.now();
      LICSYSTEM.leiloesParticipo.persist({ immediate: !!opts.immediate });
    },

    loadActiveWorkspace: function(opts){
      opts = opts || {};
      var item = LICSYSTEM.leiloesParticipo.getActiveItem();
      if(!item) return null;
      if(!item.workspace) item.workspace = LICSYSTEM.leiloesParticipo.emptyWorkspace();
      var ws = item.workspace;

      if(opts.docs !== false){
        try{
          LICSYSTEM.docsChecklist.setFromAnalysis(item.documentosExigidos || [], {
            editalNome: item.titulo || item.filename || "Edital",
            filename: item.filename || ""
          });
        }catch(e){}
      }

      if(opts.orcamento !== false){
        var orc = ws.orcamento || {};
        var rows = Array.isArray(orc.items) ? orc.items : [];
        LICSYSTEM.state.orcItems = rows.length
          ? rows.map(function(row){ return LICSYSTEM.orcamento.normalizeItem(row); })
          : [LICSYSTEM.orcamento.emptyItem()];
        var meta = orc.meta || {};
        LICSYSTEM.state.orcMetaNome = meta.nome != null ? String(meta.nome) : (item.titulo || "");
        LICSYSTEM.state.orcMetaNumero = meta.numero != null ? String(meta.numero) : "";
        LICSYSTEM.state.orcCatalogId = meta.catalogId != null ? meta.catalogId : null;
        LICSYSTEM.state.orcPage = Math.max(1, Number(orc.page) || 1);
        LICSYSTEM.state.orcBoundLeilaoId = String(item.id);
        LICSYSTEM.state._orcRendered = false;
        LICSYSTEM.state._orcDirty = false;
        try{
          clearTimeout(LICSYSTEM.orcamento._saveTimer);
          LICSYSTEM.orcamento._saveTimer = null;
        }catch(e){}
        try{ LICSYSTEM.orcamento.updateMeta(); }catch(e){}
      }

      if(opts.importar !== false){
        LICSYSTEM.state.captacaoLines = Array.isArray(ws.captacaoLines) ? ws.captacaoLines.slice() : [];
        var kw = el("pdfKeywords");
        if(kw) kw.value = ws.pdfKeywords || "";
        try{
          if(LICSYSTEM.captacao && LICSYSTEM.captacao.render){
            LICSYSTEM.captacao.render(LICSYSTEM.state.captacaoLines, false);
          }
        }catch(e){}
      }

      if(opts.cruzamento !== false){
        LICSYSTEM.state.aprovadosCruzamento = Array.isArray(ws.cruzamentoAprovados)
          ? ws.cruzamentoAprovados.slice()
          : [];
      }

      if(opts.analise !== false){
        var md = ws.relatorioMd || "";
        if(md){
          try{ LICSYSTEM.analiseIa.renderRelatorio(md); }catch(e){}
          LICSYSTEM.analiseIa.documentosExigidos = item.documentosExigidos || [];
        } else {
          try{ LICSYSTEM.analiseIa.limparRelatorio(); }catch(e){}
        }
        var metaBox = el("iaFileMeta");
        if(metaBox && item.filename){
          metaBox.className = "ia-file-meta show";
          metaBox.textContent = "Edital: " + item.filename + " (salvo no painel)";
        }
      }

      return item;
    },

    updateContextBar: function(){
      var bar = el("lwContextBar");
      var title = el("lwContextTitle");
      var item = LICSYSTEM.leiloesParticipo.getActiveItem();
      var view = LICSYSTEM.state.currentView || "";
      var show = !!(item && (LEILAO_SCOPED_VIEWS[view] || view === "analiseIa" && LICSYSTEM.state._lwAnaliseContext));
      if(bar){
        if(show) bar.removeAttribute("hidden");
        else bar.setAttribute("hidden", "");
      }
      if(title) title.textContent = item ? (item.titulo || item.filename || "Edital") : "—";
      var tabKey = view === "leilaoWorkspace" ? "hub" : view;
      document.querySelectorAll(".lw-tab").forEach(function(btn){
        var t = btn.getAttribute("data-lw-tab");
        btn.classList.toggle("is-active", t === tabKey || (t === "hub" && view === "leilaoWorkspace"));
      });
    },

    renderHub: function(){
      var item = LICSYSTEM.leiloesParticipo.getActiveItem();
      var hTitle = el("lwHubTitle");
      var hDesc = el("lwHubDesc");
      var hTag = el("lwHubTag");
      if(!item){
        if(hTitle) hTitle.textContent = "📋 Painel do Edital";
        if(hDesc) hDesc.textContent = "Selecione um edital na lista para abrir o painel.";
        if(hTag) hTag.textContent = "Workspace";
        return;
      }
      if(hTitle) hTitle.textContent = "📋 " + (item.titulo || "Painel do Edital");
      if(hTag) hTag.textContent = (item.documentosExigidos || []).length + " doc(s)";
      if(hDesc){
        var bits = [];
        if(item.filename) bits.push(item.filename);
        if(item.municipio) bits.push(item.municipio);
        hDesc.textContent = bits.length
          ? bits.join(" · ") + " — ferramentas independentes deste edital."
          : "Ferramentas independentes deste edital.";
      }
    },

    openWorkspace: function(id, tool){
      var item = LICSYSTEM.leiloesParticipo.findById(id);
      if(!item){
        showAlert("leiloesAlert", "warn", "Edital não encontrado.");
        return;
      }
      if(item.status === "arquivado"){
        showAlert("leiloesAlert", "info", "Reabra/desarquive o edital para trabalhar nele. Por enquanto use Docs na lista.");
        return;
      }
      var prevId = LICSYSTEM.state.activeLeilaoId;
      if(prevId && String(prevId) !== String(item.id)){
        try{
          clearTimeout(LICSYSTEM.orcamento._saveTimer);
          LICSYSTEM.orcamento._saveTimer = null;
        }catch(e){}
        if(!LICSYSTEM.state.orcBoundLeilaoId){
          LICSYSTEM.state.orcBoundLeilaoId = String(prevId);
        }
        try{ LICSYSTEM.orcamento.flushSave({ immediate: true }); }catch(e){}
        try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace(); }catch(e){}
      }
      LICSYSTEM.leiloesParticipo.setActiveId(item.id);
      LICSYSTEM.leiloesParticipo.loadActiveWorkspace();
      var target = tool || "leilaoWorkspace";
      if(target === "analiseIa") LICSYSTEM.state._lwAnaliseContext = true;
      if(window.__lsActivateView){
        window.__lsActivateView(target, { fromWorkspace: true, skipLeilaoGate: true });
      }
      LICSYSTEM.leiloesParticipo.renderHub();
      LICSYSTEM.leiloesParticipo.updateContextBar();
    },

    openTool: function(tool){
      if(!LICSYSTEM.state.activeLeilaoId){
        if(window.__lsActivateView) window.__lsActivateView("leiloesParticipo");
        showAlert("leiloesAlert", "info", "Clique em um edital da lista para abrir as ferramentas dele.");
        return;
      }
      try{
        if(
          LICSYSTEM.state.orcBoundLeilaoId &&
          String(LICSYSTEM.state.orcBoundLeilaoId) === String(LICSYSTEM.state.activeLeilaoId)
        ){
          LICSYSTEM.leiloesParticipo.saveActiveWorkspace();
        }
      }catch(e){}
      LICSYSTEM.leiloesParticipo.loadActiveWorkspace();
      if(tool === "analiseIa") LICSYSTEM.state._lwAnaliseContext = true;
      if(tool === "hub" || tool === "leilaoWorkspace"){
        if(window.__lsActivateView) window.__lsActivateView("leilaoWorkspace", { fromWorkspace: true, skipLeilaoGate: true });
        LICSYSTEM.leiloesParticipo.renderHub();
      } else if(window.__lsActivateView){
        window.__lsActivateView(tool, { fromWorkspace: true, skipLeilaoGate: true });
      }
      LICSYSTEM.leiloesParticipo.updateContextBar();
    },

    closeWorkspace: function(opts){
      opts = opts || {};
      try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace(); }catch(e){}
      LICSYSTEM.state._lwAnaliseContext = false;
      if(!opts.keepActive) LICSYSTEM.leiloesParticipo.setActiveId(null);
      else LICSYSTEM.leiloesParticipo.updateContextBar();
      if(window.__lsActivateView) window.__lsActivateView("leiloesParticipo");
    },

    wireWorkspaceUi: function(){
      var back = el("lwBackList");
      if(back && !back._lwBound){
        back._lwBound = true;
        back.addEventListener("click", function(){ LICSYSTEM.leiloesParticipo.closeWorkspace(); });
      }
      var hubBack = el("lwHubBack");
      if(hubBack && !hubBack._lwBound){
        hubBack._lwBound = true;
        hubBack.addEventListener("click", function(){ LICSYSTEM.leiloesParticipo.closeWorkspace(); });
      }
      document.querySelectorAll(".lw-tab").forEach(function(btn){
        if(btn._lwBound) return;
        btn._lwBound = true;
        btn.addEventListener("click", function(){
          var tab = btn.getAttribute("data-lw-tab");
          LICSYSTEM.leiloesParticipo.openTool(tab === "hub" ? "leilaoWorkspace" : tab);
        });
      });
      document.querySelectorAll("[data-lw-open]").forEach(function(btn){
        if(btn._lwBound) return;
        btn._lwBound = true;
        btn.addEventListener("click", function(){
          LICSYSTEM.leiloesParticipo.openTool(btn.getAttribute("data-lw-open"));
        });
      });
    },

    persist: function(opts){
      opts = opts || {};
      var ts = Date.now();
      try{
        localStorage.setItem(LEILOES_PARTICIPO_KEY, JSON.stringify(LICSYSTEM.leiloesParticipo.items));
      }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("leiloesParticipo", {
          updatedAt: ts,
          immediate: !!opts.immediate
        });
      }
    },

    extractMetaFromReport: function(md){
      var text = String(md || "");
      var out = { orgao: "", municipio: "", resumo: "" };
      if(!text.trim()) return out;

      function grab(re){
        var m = text.match(re);
        return m && m[1] ? String(m[1]).replace(/\*\*/g, "").replace(/`/g, "").trim() : "";
      }

      out.orgao = grab(/(?:[Oo]rg[aã]o|[Ee]ntidade|[Pp]refeitura|[Uu]nidade\s+[Gg]estora)\s*[:\-–]\s*([^\n|]{3,120})/);
      out.municipio = grab(/(?:[Mm]unic[ií]pio|[Cc]idade|[Ll]ocalidade)\s*[:\-–]\s*([^\n|]{2,80})/);
      if(!out.municipio){
        var mun2 = text.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç ]{2,40})\s*\/\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
        if(mun2) out.municipio = (mun2[1] + "/" + mun2[2]).trim();
      }

      // Resumo: preferseção "Resumo Simples", senão primeiros ~280 chars úteis
      var resumoSec = text.match(/(?:#{1,4}\s*)?(?:\d+\.\s*)?Resumo\s+Simples[\s\S]{0,40}?([\s\S]{40,500}?)(?=\n#{1,4}\s|\n```|\n\*\*Alerta|\n---|\s*$)/i);
      if(resumoSec && resumoSec[1]){
        out.resumo = resumoSec[1]
          .replace(/^[-*•]\s+/gm, "")
          .replace(/\*\*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 400);
      } else {
        out.resumo = text
          .replace(/```[\s\S]*?```/g, " ")
          .replace(/#{1,6}\s*/g, "")
          .replace(/\*\*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 280);
      }
      return out;
    },

    buildFromAnalysis: function(){
      var filename = (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
      var docs = LICSYSTEM.analiseIa.documentosExigidos || [];
      if(!docs.length && LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data){
        docs = LICSYSTEM.docsChecklist.data.documentos || [];
      }
      var parsed = LICSYSTEM.leiloesParticipo.extractMetaFromReport(LICSYSTEM.analiseIa.relatorioMd || "");
      var titulo =
        parsed.orgao ||
        (LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data && LICSYSTEM.docsChecklist.data.editalNome) ||
        (filename ? filename.replace(/\.pdf$/i, "") : "") ||
        "Edital analisado";
      return {
        titulo: titulo,
        orgao: parsed.orgao || "",
        municipio: parsed.municipio || "",
        filename: filename || (LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data && LICSYSTEM.docsChecklist.data.filename) || "",
        dataAnalise: Date.now(),
        resumo: parsed.resumo || "",
        analysisSnippet: parsed.resumo || "",
        documentosExigidos: docs,
        status: "participando"
      };
    },

    findDuplicate: function(entry){
      var fn = String(entry.filename || "").toLowerCase();
      var tit = String(entry.titulo || "").toLowerCase();
      for(var i = 0; i < LICSYSTEM.leiloesParticipo.items.length; i++){
        var it = LICSYSTEM.leiloesParticipo.items[i];
        if(it.status === "arquivado") continue;
        if(fn && String(it.filename || "").toLowerCase() === fn) return it;
        if(tit && String(it.titulo || "").toLowerCase() === tit) return it;
      }
      return null;
    },

    addFromAnalysis: function(){
      if(!(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd)){
        showAlert("iaAlert", "warn", "Analise um edital antes de confirmar participação.");
        return null;
      }
      var draft = LICSYSTEM.leiloesParticipo.buildFromAnalysis();
      var relatorioMd = String(LICSYSTEM.analiseIa.relatorioMd || "").slice(0, 100000);
      var dup = LICSYSTEM.leiloesParticipo.findDuplicate(draft);
      var now = Date.now();
      if(dup){
        dup.titulo = draft.titulo;
        dup.orgao = draft.orgao || dup.orgao;
        dup.municipio = draft.municipio || dup.municipio;
        dup.filename = draft.filename || dup.filename;
        dup.dataAnalise = now;
        dup.resumo = draft.resumo || dup.resumo;
        dup.analysisSnippet = draft.analysisSnippet || dup.analysisSnippet;
        dup.documentosExigidos = draft.documentosExigidos;
        dup.status = "participando";
        dup.updatedAt = now;
        if(!dup.workspace) dup.workspace = LICSYSTEM.leiloesParticipo.emptyWorkspace();
        dup.workspace.relatorioMd = relatorioMd || dup.workspace.relatorioMd || "";
        LICSYSTEM.leiloesParticipo.persist({ immediate: true });
        LICSYSTEM.leiloesParticipo.anexarPdfDaAnalise(dup.id);
        LICSYSTEM.leiloesParticipo.render();
        return dup;
      }
      var item = LICSYSTEM.leiloesParticipo.normalizeItem({
        id: "lp_" + now + "_" + Math.random().toString(36).slice(2, 7),
        titulo: draft.titulo,
        orgao: draft.orgao,
        municipio: draft.municipio,
        filename: draft.filename,
        dataAnalise: now,
        resumo: draft.resumo,
        analysisSnippet: draft.analysisSnippet,
        documentosExigidos: draft.documentosExigidos,
        workspace: { relatorioMd: relatorioMd },
        status: "participando",
        createdAt: now,
        updatedAt: now
      });
      LICSYSTEM.leiloesParticipo.items.unshift(item);
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.anexarPdfDaAnalise(item.id);
      LICSYSTEM.leiloesParticipo.render();
      return item;
    },

    /** Herda o PDF usado na Análise IA para o edital, evitando reenvio no Importar. */
    anexarPdfDaAnalise: function(leilaoId){
      var file = LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.file;
      if(!leilaoId || !file || !LICSYSTEM.editalPdf) return Promise.resolve(null);
      return LICSYSTEM.editalPdf.save(leilaoId, file).catch(function(){ return null; });
    },

    archive: function(id){
      var found = LICSYSTEM.leiloesParticipo.findById(id);
      if(!found) return;
      if(!confirm("Arquivar este leilão da lista de participação?")) return;
      if(String(LICSYSTEM.state.activeLeilaoId) === String(id)){
        try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace(); }catch(e){}
        LICSYSTEM.leiloesParticipo.setActiveId(null);
        LICSYSTEM.state._lwAnaliseContext = false;
      }
      found.status = "arquivado";
      found.updatedAt = Date.now();
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.render();
      showAlert("leiloesAlert", "ok", "Leilão arquivado.");
    },

    remove: function(id){
      if(!confirm("Remover este leilão permanentemente da lista?")) return;
      if(String(LICSYSTEM.state.activeLeilaoId) === String(id)){
        LICSYSTEM.leiloesParticipo.setActiveId(null);
        LICSYSTEM.state._lwAnaliseContext = false;
      }
      LICSYSTEM.leiloesParticipo.items = LICSYSTEM.leiloesParticipo.items.filter(function(it){
        return it.id !== id;
      });
      try{ if(LICSYSTEM.editalPdf) LICSYSTEM.editalPdf.remove(id); }catch(e){}
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.render();
      showAlert("leiloesAlert", "ok", "Leilão removido.");
    },

    openDocs: function(id){
      LICSYSTEM.leiloesParticipo.openWorkspace(id, "docsChecklist");
    },

    showParticiparModal: function(){
      if(!(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd)){
        showAlert("iaAlert", "warn", "Não há análise ativa. Analise um PDF primeiro.");
        return;
      }
      var ov = el("participarOverlay");
      var metaBox = el("participarModalMeta");
      var lead = el("participarModalLead");
      if(!ov) return;
      var draft = LICSYSTEM.leiloesParticipo.buildFromAnalysis();
      if(lead){
        lead.innerHTML = "Deseja marcar este edital em <b>Licitações que Participo</b> para acompanhar a disputa?";
      }
      if(metaBox){
        var bits = [];
        bits.push("<div><b>Edital:</b> " + utils.escapeHtml(draft.titulo || "—") + "</div>");
        if(draft.orgao) bits.push("<div><b>Órgão:</b> " + utils.escapeHtml(draft.orgao) + "</div>");
        if(draft.municipio) bits.push("<div><b>Município:</b> " + utils.escapeHtml(draft.municipio) + "</div>");
        if(draft.filename) bits.push("<div class='muted small'>" + utils.escapeHtml(draft.filename) + "</div>");
        if(draft.documentosExigidos && draft.documentosExigidos.length){
          bits.push("<div class='muted small'>" + draft.documentosExigidos.length + " documento(s) exigido(s) serão vinculados</div>");
        }
        if(draft.resumo){
          bits.push("<div class='participar-resumo'>" + utils.escapeHtml(draft.resumo) + "</div>");
        }
        metaBox.innerHTML = bits.join("");
      }
      LICSYSTEM.leiloesParticipo.renderParticipantesLoading();
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
      LICSYSTEM.leiloesParticipo.loadParticipantesAnalysis(draft);
    },

    renderParticipantesLoading: function(){
      var box = el("participarEmpresasBody");
      if(!box) return;
      box.innerHTML =
        '<div class="participar-empresas-loading muted small">' +
          '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:#ccc;border-top-color:#152642"></span>' +
          " A IA está analisando quem pode disputar este leilão…" +
        "</div>";
    },

    formatCnpj: function(cnpj){
      var d = String(cnpj || "").replace(/\D/g, "");
      if(d.length !== 14) return d || "";
      return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    },

    renderParticipantesResult: function(data){
      var box = el("participarEmpresasBody");
      if(!box) return;
      data = data || {};
      var html = [];
      if(data.exclusivoMeEpp === true){
        html.push('<span class="participar-pill is-me">Exclusivo / prioridade ME·EPP</span>');
      } else if(data.exclusivoMeEpp === false){
        html.push('<span class="participar-pill">Aberto a qualquer porte (conforme edital)</span>');
      }
      if(data.resumo){
        html.push('<p class="participar-empresas-resumo">' + utils.escapeHtml(data.resumo) + "</p>");
      }
      if(data.criterios && data.criterios.length){
        html.push('<div class="participar-sub">Critérios de participação</div><ul class="participar-list">');
        data.criterios.forEach(function(c){
          html.push("<li>" + utils.escapeHtml(c) + "</li>");
        });
        html.push("</ul>");
      }
      if(data.restricoes && data.restricoes.length){
        html.push('<div class="participar-sub">Restrições / barreiras</div><ul class="participar-list">');
        data.restricoes.forEach(function(c){
          html.push("<li>" + utils.escapeHtml(c) + "</li>");
        });
        html.push("</ul>");
      }
      if(data.perfisAptos && data.perfisAptos.length){
        html.push('<div class="participar-sub">Perfis de empresas aptas</div>');
        data.perfisAptos.forEach(function(p){
          html.push(
            '<div class="participar-empresa-item">' +
              "<strong>" + utils.escapeHtml(p.perfil || "Perfil") +
              (p.porte ? ' <span class="muted">· ' + utils.escapeHtml(p.porte) + "</span>" : "") +
              "</strong>" +
              (p.porQue ? '<div class="muted">' + utils.escapeHtml(p.porQue) + "</div>" : "") +
            "</div>"
          );
        });
      }
      if(data.empresasPncp && data.empresasPncp.length){
        html.push('<div class="participar-sub">Empresas com contratos semelhantes (PNCP)</div>');
        data.empresasPncp.forEach(function(e){
          var cnpjFmt = LICSYSTEM.leiloesParticipo.formatCnpj(e.cnpj);
          html.push(
            '<div class="participar-empresa-item">' +
              "<strong>" + utils.escapeHtml(e.nome || "Fornecedor") + "</strong>" +
              (cnpjFmt ? '<div class="muted">CNPJ ' + utils.escapeHtml(cnpjFmt) + "</div>" : "") +
              (e.objeto ? '<div class="muted">' + utils.escapeHtml(e.objeto) + "</div>" : "") +
              ((e.orgao || e.uf)
                ? '<div class="muted">' + utils.escapeHtml([e.orgao, e.uf].filter(Boolean).join(" · ")) + "</div>"
                : "") +
            "</div>"
          );
        });
      }
      if(data.alertaConcorrencia){
        html.push(
          '<div class="participar-sub">Concorrência</div>' +
          '<p class="participar-empresas-resumo" style="margin:0">' + utils.escapeHtml(data.alertaConcorrencia) + "</p>"
        );
      }
      html.push(
        '<div class="participar-empresas-aviso">' +
          utils.escapeHtml(
            data.aviso ||
            "Não é lista oficial de inscritos — critérios do edital + perfis e, se houver, fornecedores do PNCP com objeto parecido."
          ) +
        "</div>"
      );
      if(!data.resumo && !(data.criterios && data.criterios.length) && !(data.perfisAptos && data.perfisAptos.length)){
        box.innerHTML = '<div class="muted small">Não foi possível montar o perfil de participantes.</div>';
        return;
      }
      box.innerHTML = html.join("");
    },

    loadParticipantesAnalysis: function(draft){
      draft = draft || {};
      var token = String(Date.now());
      LICSYSTEM.leiloesParticipo._partToken = token;
      var text =
        String(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd || "") ||
        String(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.text || "");
      if(!text || text.length < 40){
        var box = el("participarEmpresasBody");
        if(box) box.innerHTML = '<div class="muted small">Sem texto de análise para estimar participantes.</div>';
        return;
      }
      var uf = "";
      var mun = String(draft.municipio || "");
      var mUf = mun.match(/\/\s*([A-Za-z]{2})\b/);
      if(mUf) uf = mUf[1].toUpperCase();

      var objeto = String(draft.resumo || "").slice(0, 280);
      var objM = text.match(/(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*)?objeto(?:\s+da\s+contrata[cç][aã]o)?(?:\*\*)?\s*[:\-–]\s*([^\n]{12,240})/i);
      if(objM && objM[1]) objeto = objM[1].replace(/\*\*/g, "").trim().slice(0, 280);

      fetch("/api/analyze-participantes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 60000),
          orgao: draft.orgao || "",
          municipio: draft.municipio || "",
          uf: uf,
          objeto: objeto || draft.titulo || ""
        })
      })
        .then(function(res){
          return res.text().then(function(raw){
            var body = null;
            try{ body = raw ? JSON.parse(raw) : null; }catch(e){}
            if(!res.ok){
              var msg = (body && (body.error || body.detail)) || ("Erro HTTP " + res.status);
              throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
            }
            return body;
          });
        })
        .then(function(body){
          if(LICSYSTEM.leiloesParticipo._partToken !== token) return;
          LICSYSTEM.leiloesParticipo.renderParticipantesResult(body);
        })
        .catch(function(err){
          if(LICSYSTEM.leiloesParticipo._partToken !== token) return;
          var box = el("participarEmpresasBody");
          if(box){
            box.innerHTML =
              '<div class="muted small">Não deu para analisar participantes agora' +
              (err && err.message ? ": " + utils.escapeHtml(err.message) : ".") +
              "</div>";
          }
        });
    },

    closeParticiparModal: function(){
      var ov = el("participarOverlay");
      if(!ov) return;
      LICSYSTEM.leiloesParticipo._partToken = null;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
    },

    confirmSim: function(){
      var item = LICSYSTEM.leiloesParticipo.addFromAnalysis();
      LICSYSTEM.leiloesParticipo.closeParticiparModal();
      if(!item) return;
      showAlert("iaAlert", "ok", "Salvo em Licitações que Participo.");
      LICSYSTEM.leiloesParticipo.openWorkspace(item.id, "leilaoWorkspace");
      showAlert("lwHubAlert", "ok", "Participação confirmada. Use o painel abaixo para Docs, Análise, Importar, Orçamento e Cruzamento deste edital.");
    },

    confirmNao: function(){
      LICSYSTEM.leiloesParticipo.closeParticiparModal();
      showAlert("iaAlert", "info", "Ok — edital não foi adicionado à lista.");
    },

    render: function(){
      var box = el("leiloesList");
      var sum = el("leiloesSummary");
      if(!box) return;

      var active = LICSYSTEM.leiloesParticipo.items.filter(function(it){ return it.status !== "arquivado"; });
      var archived = LICSYSTEM.leiloesParticipo.items.filter(function(it){ return it.status === "arquivado"; });

      if(sum){
        if(!LICSYSTEM.leiloesParticipo.items.length){
          sum.innerHTML = "";
        } else {
          sum.innerHTML =
            '<span class="docs-pill">' + active.length + " participando</span>" +
            (archived.length ? '<span class="docs-pill pend">' + archived.length + " arquivado" + (archived.length === 1 ? "" : "s") + "</span>" : "");
        }
      }

      if(!active.length && !archived.length){
        box.innerHTML = '<div class="muted small" style="padding:18px;text-align:center">Nenhum leilão marcado ainda. Analise um edital e confirme em <b>Vamos participar?</b></div>';
        return;
      }

      function cardHtml(it, isArch){
        var dataStr = "";
        try{ dataStr = new Date(it.dataAnalise).toLocaleString("pt-BR"); }catch(e){ dataStr = "—"; }
        var docsN = (it.documentosExigidos || []).length;
        var sub = [];
        if(it.orgao && it.orgao !== it.titulo) sub.push(it.orgao);
        if(it.municipio) sub.push(it.municipio);
        if(it.filename) sub.push(it.filename);
        return (
          '<div class="leilao-item' + (isArch ? " is-archived" : "") + '" data-id="' + utils.escapeHtml(it.id) + '"' +
            (isArch ? "" : ' title="Clique para abrir o painel deste edital"') + ">" +
            '<div class="leilao-main">' +
              '<div class="leilao-title">' + utils.escapeHtml(it.titulo || "Edital") + "</div>" +
              (sub.length ? '<div class="leilao-sub">' + utils.escapeHtml(sub.join(" · ")) + "</div>" : "") +
              '<div class="leilao-meta">' +
                '<span class="docs-badge">' + (isArch ? "Arquivado" : "Participando") + "</span>" +
                '<span class="muted small">Análise: ' + utils.escapeHtml(dataStr) + "</span>" +
                (docsN ? '<span class="muted small">' + docsN + " doc(s)</span>" : "") +
              "</div>" +
              (it.resumo ? '<div class="leilao-resumo">' + utils.escapeHtml(it.resumo) + "</div>" : "") +
            "</div>" +
            '<div class="leilao-actions">' +
              (!isArch ? '<button type="button" class="btn btn-gold btn-sm lpOrcar" title="Abrir orçamento deste edital">Orçar</button>' : "") +
              (!isArch ? '<button type="button" class="btn btn-ghost btn-sm lpEncaminhar" title="Encaminhar para Entrega">Encaminhar</button>' : "") +
              (docsN ? '<button type="button" class="btn btn-ghost btn-sm lpDocs" title="Abrir checklist">📑 Docs</button>' : "") +
              (!isArch ? '<button type="button" class="btn btn-ghost btn-sm lpArchive" title="Arquivar">Arquivar</button>' : "") +
              '<button type="button" class="btn btn-ghost btn-sm lpRemove" title="Remover">✕</button>' +
            "</div>" +
          "</div>"
        );
      }

      var html = "";
      active.forEach(function(it){ html += cardHtml(it, false); });
      if(archived.length){
        html += '<div class="leiloes-arch-label muted small">Arquivados</div>';
        archived.forEach(function(it){ html += cardHtml(it, true); });
      }
      box.innerHTML = html;

      box.querySelectorAll(".leilao-item:not(.is-archived)").forEach(function(row){
        row.addEventListener("click", function(ev){
          if(ev.target.closest(".leilao-actions")) return;
          var id = row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.openWorkspace(id, "leilaoWorkspace");
        });
      });
      box.querySelectorAll(".lpOrcar").forEach(function(btn){
        btn.addEventListener("click", function(ev){
          ev.stopPropagation();
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.openWorkspace(id, "orcamento");
        });
      });
      box.querySelectorAll(".lpEncaminhar").forEach(function(btn){
        btn.addEventListener("click", function(ev){
          ev.stopPropagation();
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.encaminharParaEntrega(id);
        });
      });
      box.querySelectorAll(".lpDocs").forEach(function(btn){
        btn.addEventListener("click", function(ev){
          ev.stopPropagation();
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.openDocs(id);
        });
      });
      box.querySelectorAll(".lpArchive").forEach(function(btn){
        btn.addEventListener("click", function(ev){
          ev.stopPropagation();
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.archive(id);
        });
      });
      box.querySelectorAll(".lpRemove").forEach(function(btn){
        btn.addEventListener("click", function(ev){
          ev.stopPropagation();
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.remove(id);
        });
      });
    },

    /** Encaminha o edital para o módulo Entrega, com dados pré-preenchidos. */
    encaminharParaEntrega: function(id){
      var item = LICSYSTEM.leiloesParticipo.findById(id);
      if(!item){
        showAlert("leiloesAlert", "warn", "Edital não encontrado.");
        return;
      }
      if(window.__lsActivateView) window.__lsActivateView("entregas");
      if(LICSYSTEM.entregas){
        try{
          LICSYSTEM.entregas.resetForm();
          var nome = el("entregaNomeLicitacao");
          if(nome) nome.value = String(item.titulo || "").slice(0, 220);
          var obs = el("entregaObservacoes");
          if(obs){
            var bits = [];
            if(item.orgao) bits.push("Órgão: " + item.orgao);
            if(item.municipio) bits.push("Município: " + item.municipio);
            if(item.filename) bits.push("Arquivo: " + item.filename);
            if(item.resumo) bits.push(item.resumo);
            obs.value = bits.join("\n").slice(0, 2000);
          }
          LICSYSTEM.entregas.open();
          showAlert("entregaAlert", "ok", "Edital encaminhado — complete os dados da entrega e salve.");
        }catch(e){
          showAlert("leiloesAlert", "error", "Não foi possível abrir o formulário de entrega.");
        }
      }
    }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
