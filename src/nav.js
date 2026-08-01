(function(){
    var MQ = window.matchMedia("(max-width: 768px)");
    var NAV_OPEN_KEY = "licsystem_nav_open_v1";
    var VIEW_RESOLVE = {
      captacao: { view: "pesquisas" },
      perguntarEditais: { view: "pesquisas", section: "cardChatEditais" },
      editaisProximos: { view: "pesquisas", section: "cardProxEditais" },
      radarPncp: { view: "pesquisas", section: "cardRadarPncp" }
    };
    var CHILD_TO_GROUP = {
      perguntarEditais: "pesquisas",
      editaisProximos: "pesquisas",
      radarPncp: "pesquisas",
      docsChecklist: "leilao",
      importarEdital: "leilao",
      orcamento: "leilao",
      cruzamento: "leilao",
      histEntregas: "entrega"
    };
    var PARENT_VIEWS = {
      pesquisas: "pesquisas",
      leiloesParticipo: "leilao",
      entregas: "entrega"
    };

    function setSidebar(open){
      document.body.classList.toggle("sidebar-open", !!open);
      var overlay = document.getElementById("sidebar-overlay");
      var toggle = document.getElementById("menuToggle");
      if(overlay){
        overlay.classList.toggle("show", !!open);
        overlay.setAttribute("aria-hidden", open ? "false" : "true");
      }
      if(toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    function closeSidebar(){ setSidebar(false); }
    function toggleSidebar(){ setSidebar(!document.body.classList.contains("sidebar-open")); }

    function loadOpenGroups(){
      try{
        var raw = localStorage.getItem(NAV_OPEN_KEY);
        var parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
      }catch(e){
        return {};
      }
    }
    function saveOpenGroups(map){
      try{ localStorage.setItem(NAV_OPEN_KEY, JSON.stringify(map || {})); }catch(e){}
    }
    function setGroupOpen(groupId, open, opts){
      opts = opts || {};
      var group = document.querySelector('#nav .nav-group[data-nav-group="' + groupId + '"]');
      if(!group) return;
      var parent = group.querySelector(".nav-parent");
      var children = group.querySelector(".nav-children");
      group.classList.toggle("open", !!open);
      if(parent) parent.setAttribute("aria-expanded", open ? "true" : "false");
      if(children){
        if(open) children.removeAttribute("hidden");
        else children.setAttribute("hidden", "");
      }
      if(!opts.skipPersist){
        var map = loadOpenGroups();
        if(open) map[groupId] = true;
        else delete map[groupId];
        saveOpenGroups(map);
      }
    }
    function closeOtherGroups(exceptId){
      var groups = document.querySelectorAll("#nav .nav-group[data-nav-group]");
      for(var i=0;i<groups.length;i++){
        var id = groups[i].getAttribute("data-nav-group");
        if(id && id !== exceptId) setGroupOpen(id, false);
      }
    }
    function ensureGroupForView(view){
      var groupId = CHILD_TO_GROUP[view] || PARENT_VIEWS[view];
      if(!groupId && VIEW_RESOLVE[view]){
        groupId = PARENT_VIEWS[VIEW_RESOLVE[view].view];
      }
      if(!groupId) return;
      closeOtherGroups(groupId);
      setGroupOpen(groupId, true);
    }
    function restoreNavGroups(){
      var map = loadOpenGroups();
      var groups = document.querySelectorAll("#nav .nav-group[data-nav-group]");
      for(var i=0;i<groups.length;i++){
        var id = groups[i].getAttribute("data-nav-group");
        setGroupOpen(id, !!map[id], { skipPersist: true });
      }
    }

    function activate(view, opts){
      opts = opts || {};
      if(document.body.classList.contains("auth-locked")) return;
      view = view || "dashboard";
      var resolved = VIEW_RESOLVE[view];
      var targetView = resolved ? resolved.view : view;
      var navKey = view;

      var btns=document.querySelectorAll("#nav button[data-view]");
      for(var i=0;i<btns.length;i++){
        var btn = btns[i];
        var bv = btn.getAttribute("data-view");
        var isParent = btn.classList.contains("nav-parent");
        var gid = btn.getAttribute("data-nav-toggle");
        var isActive = bv === navKey;
        var branchActive = isParent && gid && CHILD_TO_GROUP[navKey] === gid && !isActive;
        btn.classList.toggle("active", isActive);
        btn.classList.toggle("nav-branch-active", !!branchActive);
      }

      var views=document.querySelectorAll(".view");
      for(var j=0;j<views.length;j++){
        views[j].classList.toggle("active", views[j].id===("view-"+targetView));
      }
      var titleEl=document.getElementById("topTitle");
      var map={
        dashboard:"Dashboard",
        pesquisas:"Pesquisas de Editais",
        perguntarEditais:"Perguntar editais",
        editaisProximos:"Editais próximos",
        radarPncp:"Radar PNCP",
        captacao:"Pesquisas de Editais",
        analiseIa:"Análise Inteligente de Editais",
        leiloesParticipo:"Leilão que Participo",
        importarEdital:"Importar Edital (PDF)",
        orcamento:"Orçamento",
        cruzamento:"Cruzamento Inteligente (ML)",
        cofre:"Cofre de Documentos",
        docsChecklist:"Docs do Edital",
        entregas:"Entrega",
        histEntregas:"Histórico de Entregas",
        concorrencia:"Análise de Concorrência",
        catalogo:"Catálogo Interno",
        arp:"Atas de Registro (ARP)",
        disputa:"Sala de Disputa",
        ferramentas:"Ferramentas"
      };
      if(titleEl) titleEl.textContent = map[navKey]||map[targetView]||"LICSYSTEM";
      if(!opts.skipEnsureGroup) ensureGroupForView(navKey);
      try{ if(window.LICSYSTEM && LICSYSTEM.onViewChange) LICSYSTEM.onViewChange(targetView, navKey); }catch(e){}
      if(resolved && resolved.section){
        setTimeout(function(){
          var sec = document.getElementById(resolved.section);
          if(sec && typeof sec.scrollIntoView === "function"){
            try{ sec.scrollIntoView({ behavior: "smooth", block: "start" }); }catch(e){ sec.scrollIntoView(true); }
          }
        }, 40);
      }else{
        try{ window.scrollTo(0,0); }catch(e){}
      }
      if(MQ.matches) closeSidebar();
    }
    var nav=document.getElementById("nav");
    nav.addEventListener("click", function(ev){
      var actionBtn=ev.target.closest("button[data-ls-action]");
      if(actionBtn){
        var action=actionBtn.getAttribute("data-ls-action");
        try{
          if(action==="suporte" && window.LICSYSTEM && LICSYSTEM.voiceflow && typeof LICSYSTEM.voiceflow.openPanel==="function"){
            LICSYSTEM.voiceflow.openPanel();
          }else if(action==="chat-ia" && window.LICSYSTEM && LICSYSTEM.voiceflow && typeof LICSYSTEM.voiceflow.openChatIA==="function"){
            LICSYSTEM.voiceflow.openChatIA();
          }else if(window.__licsystemInitVoiceflow){
            window.__licsystemInitVoiceflow();
            setTimeout(function(){
              if(action==="suporte" && LICSYSTEM.voiceflow) LICSYSTEM.voiceflow.openPanel();
              else if(action==="chat-ia" && LICSYSTEM.voiceflow) LICSYSTEM.voiceflow.openChatIA();
            }, 200);
          }
        }catch(e){}
        if(MQ.matches) closeSidebar();
        return;
      }
      var parentBtn=ev.target.closest("button.nav-parent[data-nav-toggle]");
      if(parentBtn && nav.contains(parentBtn)){
        var gid=parentBtn.getAttribute("data-nav-toggle");
        var willOpen=!parentBtn.closest(".nav-group").classList.contains("open");
        if(willOpen) closeOtherGroups(gid);
        setGroupOpen(gid, willOpen);
        var pv=parentBtn.getAttribute("data-view");
        // skipEnsureGroup: allow collapsing the branch without activate() forcing it open again
        if(pv) activate(pv, { skipEnsureGroup: true });
        return;
      }
      var b=ev.target.closest("button[data-view]");
      if(!b || !nav.contains(b)) return;
      activate(b.getAttribute("data-view"));
    });

    function wireMobileNav(){
      var toggle = document.getElementById("menuToggle");
      var closeBtn = document.getElementById("sidebarClose");
      var overlay = document.getElementById("sidebar-overlay");
      if(toggle) toggle.addEventListener("click", toggleSidebar);
      if(closeBtn) closeBtn.addEventListener("click", closeSidebar);
      if(overlay) overlay.addEventListener("click", closeSidebar);
      document.addEventListener("keydown", function(e){
        if(e.key === "Escape") closeSidebar();
      });
      function onMq(){ if(!MQ.matches) closeSidebar(); }
      if(MQ.addEventListener) MQ.addEventListener("change", onMq);
      else if(MQ.addListener) MQ.addListener(onMq);
      restoreNavGroups();
    }
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireMobileNav);
    else wireMobileNav();

    window.__lsActivateView=activate;
    window.__lsCloseSidebar=closeSidebar;
    window.__lsToggleSidebar=toggleSidebar;
  })();
