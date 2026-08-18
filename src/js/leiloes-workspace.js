/* LICSYSTEM — LICITACOES QUE PARTICIPO / WORKSPACE */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var LEILAO_SCOPED_VIEWS = ctx.LEILAO_SCOPED_VIEWS;

  LICSYSTEM.leiloesParticipo = Object.assign(LICSYSTEM.leiloesParticipo || {}, {
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
      if(opts.forceOrcamento && item && item.id){
        LICSYSTEM.state.orcBoundLeilaoId = String(item.id);
        bound = LICSYSTEM.state.orcBoundLeilaoId;
      }
      var boundMatches = !!(bound && String(bound) === String(item.id));
      if(boundMatches && LICSYSTEM.state._orcRendered !== false && !opts.forceOrcamento){
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
    openDocs: function(id){
      LICSYSTEM.leiloesParticipo.openWorkspace(id, "docsChecklist");
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
