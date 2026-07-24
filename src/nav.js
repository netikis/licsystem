(function(){
    var MQ = window.matchMedia("(max-width: 768px)");

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

    function activate(view){
      if(document.body.classList.contains("auth-locked")) return;
      var btns=document.querySelectorAll('#nav button');
      for(var i=0;i<btns.length;i++){
        btns[i].classList.toggle('active', btns[i].getAttribute('data-view')===view);
      }
      var views=document.querySelectorAll('.view');
      for(var j=0;j<views.length;j++){
        views[j].classList.toggle('active', views[j].id===('view-'+view));
      }
      var titleEl=document.getElementById('topTitle');
      var map={dashboard:'Dashboard',captacao:'Captação de Editais',analiseIa:'Análise Inteligente de Editais',orcamento:'Orçamento',cruzamento:'Cruzamento Inteligente (ML)',cofre:'Cofre de Documentos',entregas:'Licitação',histEntregas:'Histórico e Controle de Entregas',concorrencia:'Análise de Concorrência',catalogo:'Catálogo Interno',arp:'Atas de Registro (ARP)',disputa:'Sala de Disputa',ferramentas:'Ferramentas'};
      if(titleEl) titleEl.textContent = map[view]||'LICSYSTEM';
      // notify app modules (guarded — nav never depends on this)
      try{ if(window.LICSYSTEM && LICSYSTEM.onViewChange) LICSYSTEM.onViewChange(view); }catch(e){}
      try{ window.scrollTo(0,0); }catch(e){}
      // close drawer after navigation on mobile
      if(MQ.matches) closeSidebar();
    }
    var nav=document.getElementById('nav');
    nav.addEventListener('click', function(ev){
      var b=ev.target.closest('button[data-view]');
      if(!b) return;
      activate(b.getAttribute('data-view'));
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
    }
    if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", wireMobileNav);
    else wireMobileNav();

    window.__lsActivateView=activate;
    window.__lsCloseSidebar=closeSidebar;
    window.__lsToggleSidebar=toggleSidebar;
  })();
