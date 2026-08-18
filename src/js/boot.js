/* LICSYSTEM — BOOT (23-boot.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var LAST_VIEW_KEY = ctx.LAST_VIEW_KEY;
  var LEILAO_SCOPED_VIEWS = ctx.LEILAO_SCOPED_VIEWS;
  function wire(){
    var fn = ctx.wire || window.wire || LICSYSTEM.wire;
    if (typeof fn !== "function") throw new Error("wire ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ BOOT ============================ */
  function bootApp(){
    wire();
    LICSYSTEM.captacao.initUf();
    LICSYSTEM.captacao.initProximos();
    LICSYSTEM.captacao.initChatEditais();
    LICSYSTEM.captacao.initCardCollapse();
    LICSYSTEM.orcamento.load();
    try{ if(LICSYSTEM.alertas) LICSYSTEM.alertas.load(); }catch(e){}
    LICSYSTEM.state._orcDirty = false;
    LICSYSTEM.state._orcRendered = false;
    LICSYSTEM.state._dashReady = false;
    LICSYSTEM.state._cofreRendered = false;
    LICSYSTEM.updateBell();
    LICSYSTEM.state.currentView = "dashboard";

    // Flush orçamento ao fechar/ocultar a aba (debounce pendente não se perde)
    if(!LICSYSTEM._orcPersistWired){
      LICSYSTEM._orcPersistWired = true;
      function flushOrcOnLeave(){
        try{ LICSYSTEM.orcamento.flushSave({ immediate: true }); }catch(e){}
        try{
          if(LICSYSTEM.state.activeLeilaoId){
            LICSYSTEM.leiloesParticipo.saveActiveWorkspace({ immediate: true });
          }
        }catch(e2){}
        try{
          if(LICSYSTEM.cloudSync){
            if(!LICSYSTEM.state.activeLeilaoId){
              LICSYSTEM.cloudSync.flushPush("orcamento");
            }
            LICSYSTEM.cloudSync.flushPush("leiloesParticipo");
          }
        }catch(e3){}
      }
      window.addEventListener("beforeunload", flushOrcOnLeave);
      document.addEventListener("visibilitychange", function(){
        if(document.visibilityState === "hidden") flushOrcOnLeave();
      });
    }

    // UI primeiro; pesado depois (não trava a abertura)
    requestAnimationFrame(function(){
      LICSYSTEM.dashboard.render();
      LICSYSTEM.state._dashReady = true;
      LICSYSTEM.cofre.load();
      LICSYSTEM.cofre.render();
      LICSYSTEM.state._cofreRendered = true;
      LICSYSTEM.docsChecklist.load();
      LICSYSTEM.leiloesParticipo.load();
      LICSYSTEM.leiloesParticipo.restoreActiveId();
      // Carrega a planilha do edital ativo (não a cópia global) antes de qualquer save.
      try{
        if(LICSYSTEM.state.activeLeilaoId){
          LICSYSTEM.leiloesParticipo.loadActiveWorkspace();
        } else {
          LICSYSTEM.state.orcBoundLeilaoId = null;
        }
      }catch(e){}
      LICSYSTEM.leiloesParticipo.wireWorkspaceUi();
      LICSYSTEM.entregas.load();
      // Restaura última tela: hash da URL tem prioridade (Voltar/F5); senão localStorage
      var lastView = "dashboard";
      try{
        var fromHash = typeof window.__lsViewFromHash === "function" ? window.__lsViewFromHash() : null;
        lastView = fromHash || localStorage.getItem(LAST_VIEW_KEY) || "dashboard";
      }catch(e){}
      if(lastView && typeof window.__lsActivateView === "function"){
        var restoreOpts = { skipEnsureGroup: true, replaceHistory: true };
        if(LEILAO_SCOPED_VIEWS[lastView] && LICSYSTEM.state.activeLeilaoId){
          restoreOpts.skipLeilaoGate = true;
          restoreOpts.fromWorkspace = true;
        } else if(lastView === "analiseIa" && LICSYSTEM.state.activeLeilaoId){
          // Análise global no reload — não força contexto do edital
          lastView = "dashboard";
        } else if(LEILAO_SCOPED_VIEWS[lastView] && !LICSYSTEM.state.activeLeilaoId){
          lastView = "leiloesParticipo";
        }
        // skipEnsureGroup: keep all nav accordions collapsed after F5
        window.__lsActivateView(lastView, restoreOpts);
      } else {
        LICSYSTEM.state.currentView = "dashboard";
        try{
          if(typeof window.__lsActivateView === "function"){
            window.__lsActivateView("dashboard", { skipEnsureGroup: true, replaceHistory: true });
          }
        }catch(e2){}
      }
      // Orçamento só monta quando abrir a aba (planilha grande)
      setTimeout(function(){
        LICSYSTEM.ferramentas.getPerfil(true).catch(function(){});
        // Database + sync na nuvem (por conta)
        utils.ensureFirebase().then(function(){
          if(LICSYSTEM.state.authUser && LICSYSTEM.cloudSync){
            return LICSYSTEM.cloudSync.onUser(LICSYSTEM.state.authUser);
          }
        }).catch(function(){});
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


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
