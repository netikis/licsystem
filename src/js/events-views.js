/* LICSYSTEM — EVENTS + VIEWS (15-events-views.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  var LAST_VIEW_KEY = ctx.LAST_VIEW_KEY;
  var LEILAO_SCOPED_VIEWS = ctx.LEILAO_SCOPED_VIEWS;
  function salvarProduto(){
    var fn = ctx.salvarProduto || window.salvarProduto || LICSYSTEM.salvarProduto;
    if (typeof fn !== "function") throw new Error("salvarProduto ainda não disponível");
    return fn.apply(this, arguments);
  }
  function listarProdutos(){
    var fn = ctx.listarProdutos || window.listarProdutos || LICSYSTEM.listarProdutos;
    if (typeof fn !== "function") throw new Error("listarProdutos ainda não disponível");
    return fn.apply(this, arguments);
  }
  function filtrarCatalogo(){
    var fn = ctx.filtrarCatalogo || window.filtrarCatalogo || LICSYSTEM.filtrarCatalogo;
    if (typeof fn !== "function") throw new Error("filtrarCatalogo ainda não disponível");
    return fn.apply(this, arguments);
  }
  function calcularFaltaEntregar(){
    var fn = ctx.calcularFaltaEntregar || window.calcularFaltaEntregar || LICSYSTEM.calcularFaltaEntregar;
    if (typeof fn !== "function") throw new Error("calcularFaltaEntregar ainda não disponível");
    return fn.apply(this, arguments);
  }

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
    on("btnProxBuscar","click", LICSYSTEM.captacao.buscarProximos);
    on("btnChatEdital","click", LICSYSTEM.captacao.buscarChatEditais);
    if(LICSYSTEM.alertas && LICSYSTEM.alertas.wire) LICSYSTEM.alertas.wire();
    on("proxRaio","keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); LICSYSTEM.captacao.buscarProximos(); }
    });
    on("proxKeywords","keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); LICSYSTEM.captacao.buscarProximos(); }
    });
    on("proxCobertura","change", function(){
      if (String((el("proxCobertura") && el("proxCobertura").value) || "") === "pr-sp") {
        LICSYSTEM.captacao._proxRaioTouched = false;
      }
      LICSYSTEM.captacao.applyCoberturaPreset({ forceBump: true });
    });
    document.querySelectorAll("[data-prox-raio]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var v = btn.getAttribute("data-prox-raio");
        var raioEl = el("proxRaio");
        if(raioEl && v){
          raioEl.value = String(v);
          LICSYSTEM.captacao._proxRaioTouched = true;
          LICSYSTEM.captacao.applyCoberturaPreset();
        }
        document.querySelectorAll(".prox-raio-chip,[data-prox-raio]").forEach(function(b){
          var on = b === btn;
          b.classList.toggle("is-active", on);
          b.setAttribute("aria-pressed", on ? "true" : "false");
        });
      });
    });
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
    on("btnIaDocs","click", function(){ LICSYSTEM.analiseIa.openDocsModal(); });
    on("btnIaParticipar","click", function(){
      LICSYSTEM.analiseIa._pendingParticiparAsk = false;
      try{ LICSYSTEM.docsChecklist.closeModal({ skipParticiparAsk: true }); }catch(e){}
      LICSYSTEM.leiloesParticipo.showParticiparModal();
    });

    // Checklist documentos do edital
    on("btnDocsSalvar","click", function(){ LICSYSTEM.docsChecklist.save(); });
    on("btnDocsAdd","click", function(){ LICSYSTEM.docsChecklist.addManual(); });
    on("btnDocsClearOk","click", function(){ LICSYSTEM.docsChecklist.clearOk(); });
    on("btnDocsModalClose","click", function(){ LICSYSTEM.docsChecklist.closeModal(); });
    on("btnDocsModalGo","click", function(){ LICSYSTEM.docsChecklist.goFromModal(); });
    on("docsOverlay","click", function(e){
      if(e.target === el("docsOverlay")) LICSYSTEM.docsChecklist.closeModal();
    });
    on("btnParticiparSim","click", function(){ LICSYSTEM.leiloesParticipo.confirmSim(); });
    on("btnParticiparNao","click", function(){ LICSYSTEM.leiloesParticipo.confirmNao(); });
    on("participarOverlay","click", function(e){
      if(e.target === el("participarOverlay")) LICSYSTEM.leiloesParticipo.confirmNao();
    });
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape"){
        var pov = el("participarOverlay");
        if(pov && pov.classList.contains("open")){
          LICSYSTEM.leiloesParticipo.confirmNao();
          return;
        }
        var ov = el("docsOverlay");
        if(ov && ov.classList.contains("open")) LICSYSTEM.docsChecklist.closeModal();
      }
    });

    // Orçamento
    on("btnAddLinha","click", LICSYSTEM.orcamento.addLinha);
    on("btnLimparOrc","click", LICSYSTEM.orcamento.limpar);
    on("btnPropostaOrc","click", LICSYSTEM.orcamento.gerarProposta);
    on("btnPropostaOrcExcel","click", LICSYSTEM.orcamento.gerarPropostaExcel);
    on("btnExportOrcExcel","click", LICSYSTEM.orcamento.exportarExcel);
    on("btnExportOrcPdf","click", LICSYSTEM.orcamento.exportarPdf);
    on("btnSalvarOrcamento","click", function(){ LICSYSTEM.orcamento.salvarAgora(); });
    on("btnSalvarOrcCatalogo","click", LICSYSTEM.orcamento.abrirModalSalvarCatalogo);
    on("btnOrcSaveCancel","click", LICSYSTEM.orcamento.fecharModalSalvarCatalogo);
    on("btnOrcSaveConfirm","click", LICSYSTEM.orcamento.confirmarSalvarCatalogo);
    on("orcSaveOverlay","click", function(e){
      if(e.target === el("orcSaveOverlay")) LICSYSTEM.orcamento.fecharModalSalvarCatalogo();
    });
    ["orcSaveNome","orcSaveNumero"].forEach(function(id){
      on(id, "keydown", function(e){
        if(e.key === "Enter"){
          e.preventDefault();
          LICSYSTEM.orcamento.confirmarSalvarCatalogo();
        }
      });
    });
    on("orcPrev","click", function(){ LICSYSTEM.orcamento.goPage(-1); });
    on("orcNext","click", function(){ LICSYSTEM.orcamento.goPage(1); });
    on("capPrev","click", function(){ LICSYSTEM.captacao.goPage(-1); });
    on("capNext","click", function(){ LICSYSTEM.captacao.goPage(1); });
    on("proxPrev","click", function(){ LICSYSTEM.captacao.goProxPage(-1); });
    on("proxNext","click", function(){ LICSYSTEM.captacao.goProxPage(1); });
    on("chatPrev","click", function(){ LICSYSTEM.captacao.goChatPage(-1); });
    on("chatNext","click", function(){ LICSYSTEM.captacao.goChatPage(1); });
    on("orcCheckAll","change", function(){
      var onChk = this.checked;
      document.querySelectorAll(".orcChk").forEach(function(c){ c.checked = onChk; });
    });
    on("orcBody","input", function(e){
      var inp = e.target.closest("input[data-i]");
      if(!inp) return;
      if(inp.getAttribute("data-f") === "produto" || inp.readOnly) return;
      LICSYSTEM.orcamento.onEdit(Number(inp.getAttribute("data-i")), inp.getAttribute("data-f"), inp.value);
    });
    on("orcBody","click", function(e){
      var desc = e.target.closest(".orc-produto-locked");
      if(desc){ desc.classList.toggle("is-open"); return; }
      var del = e.target.closest(".orcDel");
      if(del){ var i=Number(del.getAttribute("data-i")); LICSYSTEM.state.orcItems.splice(i,1); if(!LICSYSTEM.state.orcItems.length) LICSYSTEM.state.orcItems.push(LICSYSTEM.orcamento.emptyItem()); LICSYSTEM.orcamento.render(); return; }
      var g = e.target.closest(".orcGoogle");
      if(g){ var it=LICSYSTEM.state.orcItems[Number(g.getAttribute("data-i"))]; if(it&&it.produto) window.open("https://www.google.com/search?q="+encodeURIComponent(it.produto),"_blank"); return; }
      var ml = e.target.closest(".orcMl");
      if(ml){ var it2=LICSYSTEM.state.orcItems[Number(ml.getAttribute("data-i"))]; if(it2&&it2.produto) window.open("https://lista.mercadolivre.com.br/"+encodeURIComponent(it2.produto),"_blank"); return; }
      var openL = e.target.closest(".orcOpenLink");
      if(openL){
        var itL = LICSYSTEM.state.orcItems[Number(openL.getAttribute("data-i"))];
        if(itL){
          var url = utils.normalizeHttpUrl(itL.link);
          if(url) window.open(url, "_blank", "noopener,noreferrer");
        }
        return;
      }
    });
    wireOrcFileInput();

    // Cruzamento
    on("btnCruzar","click", LICSYSTEM.cruzamento.processar);
    on("btnPropostaCruz","click", LICSYSTEM.cruzamento.gerarProposta);

    // Cofre
    on("btnSalvarCofre","click", LICSYSTEM.cofre.save);
    try{ LICSYSTEM.cofre.wire(); }catch(e){}

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

    // Robô de Disputa
    [
      "disputaPrecoRef","disputaDegrau","disputaLanceConcorrente","disputaMeuCusto",
      "disputaMargemMin","disputaMargemTipo","disputaPiso","disputaDelay"
    ].forEach(function(id){
      on(id,"input", function(){ LICSYSTEM.disputa.onFieldChange(id); });
      on(id,"change", function(){ LICSYSTEM.disputa.onFieldChange(id); });
    });
    on("btnRegistrarLance","click", function(){ LICSYSTEM.disputa.registrarLance({ manual: true }); });
    on("btnLimparDisputa","click", function(){ LICSYSTEM.disputa.limparSessao(); });
    on("btnRoboLigar","click", function(){ LICSYSTEM.disputa.ligar(); });
    on("btnRoboParar","click", function(){ LICSYSTEM.disputa.parar("Parado pelo usuário."); });

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
      if(window.__lsActivateView) window.__lsActivateView("radarPncp");
    });
  }

  /* ============================ VIEW CHANGE HOOK ============================ */
  var VIEW_TITLES = {
    dashboard:'Dashboard',
    pesquisas:'Pesquisas de Editais',
    perguntarEditais:'Perguntar editais',
    editaisProximos:'Editais próximos',
    radarPncp:'Radar PNCP',
    captacao:'Pesquisas de Editais',
    analiseIa:'Análise Inteligente de Editais',
    leiloesParticipo:'Licitações que Participo',
    leilaoWorkspace:'Painel do Edital',
    importarEdital:'Importar Edital (PDF)',
    orcamento:'Orçamento',
    cruzamento:'Cruzamento Inteligente (ML)',
    cofre:'Cofre de Documentos',
    docsChecklist:'Docs do Edital',
    entregas:'Entrega',
    histEntregas:'Histórico de Entregas',
    concorrencia:'Análise de Concorrência',
    catalogo:'Catálogo Interno',
    arp:'Atas de Registro (ARP)',
    disputa:'Robô de Disputa',
    ferramentas:'Configurações',
    chat:'Pergunte ao Chat',
    suporte:'Suporte LICSYSTEM',
    'chat-ia':'Chat IA'
  };
  LICSYSTEM.VIEW_TITLES = (LICSYSTEM.i18n && typeof LICSYSTEM.i18n.viewTitles === "function")
    ? LICSYSTEM.i18n.viewTitles()
    : VIEW_TITLES;
  try{
    if(LICSYSTEM.i18n && typeof LICSYSTEM.i18n.apply === "function"){
      LICSYSTEM.i18n.wire();
      LICSYSTEM.i18n.apply(document);
    }
  }catch(e){}

  LICSYSTEM.beforeActivateView = function(view, opts){
    opts = opts || {};
    view = view || "dashboard";

    // Análise IA pelo menu superior = fluxo global (fecha contexto do edital)
    if(view === "analiseIa" && !opts.fromWorkspace){
      if(LICSYSTEM.state.activeLeilaoId){
        try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace(); }catch(e){}
        LICSYSTEM.leiloesParticipo.setActiveId(null);
      }
      LICSYSTEM.state._lwAnaliseContext = false;
      return view;
    }

    // Ferramentas do grupo Leilão exigem edital aberto
    if(LEILAO_SCOPED_VIEWS[view] && !opts.skipLeilaoGate && !LICSYSTEM.state.activeLeilaoId){
      setTimeout(function(){
        showAlert(
          "leiloesAlert",
          "info",
          "Abra um edital em <b>Licitações que Participo</b> para usar Docs, Importar, Orçamento ou Cruzamento — cada um fica independente."
        );
      }, 0);
      return "leiloesParticipo";
    }

    return view;
  };

  LICSYSTEM.onViewChange = function(view, navKey, opts){
    var prev = LICSYSTEM.state.currentView;
    view = view || "dashboard";
    opts = opts || {};

    // Ao sair de ferramentas com edital ativo: grava workspace
    if(
      LICSYSTEM.state.activeLeilaoId &&
      prev &&
      prev !== view &&
      (LEILAO_SCOPED_VIEWS[prev] || (prev === "analiseIa" && LICSYSTEM.state._lwAnaliseContext))
    ){
      try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace(); }catch(e){}
    }

    // Ao sair do Orçamento: sincroniza inputs pendentes e grava (não limpa orcItems)
    if(prev === "orcamento" && view !== "orcamento"){
      try{ LICSYSTEM.orcamento.flushSave(); }catch(e){}
    }

    // Entrando em ferramenta com edital ativo: carrega dados dele
    if(
      LICSYSTEM.state.activeLeilaoId &&
      (LEILAO_SCOPED_VIEWS[view] || (view === "analiseIa" && LICSYSTEM.state._lwAnaliseContext))
    ){
      try{
        LICSYSTEM.leiloesParticipo.loadActiveWorkspace(
          opts.keepOrcamento ? { orcamento: false } : {}
        );
      }catch(e){}
    }

    if(view !== "analiseIa" && !LEILAO_SCOPED_VIEWS[view]){
      LICSYSTEM.state._lwAnaliseContext = false;
    }

    LICSYSTEM.state.currentView = view;
    try{ localStorage.setItem(LAST_VIEW_KEY, navKey || view); }catch(e){}
    try{ LICSYSTEM.leiloesParticipo.updateContextBar(); }catch(e){}
    // Reaplica idioma na tela ativa (textos estáticos + data-i18n)
    try{
      if(LICSYSTEM.i18n && typeof LICSYSTEM.i18n.apply === "function"){
        var viewEl = document.getElementById("view-" + view);
        if(viewEl) LICSYSTEM.i18n.apply(viewEl);
        else LICSYSTEM.i18n.apply(document);
      }
    }catch(e){}

    // Não remonta telas pesadas a cada clique no menu
    if(view==="dashboard"){
      if(!LICSYSTEM.state._dashReady){
        LICSYSTEM.state._dashReady = true;
        LICSYSTEM.dashboard.render();
      }
    }
    if(view==="orcamento"){
      // Remonta a partir do estado em memória (não zera orcItems; garante tabela após troca de aba)
      LICSYSTEM.orcamento.render({ save:false });
      LICSYSTEM.orcamento.updateMeta();
    }
    if(view==="cofre"){
      try{ LICSYSTEM.cofre.load(); }catch(e){}
      LICSYSTEM.state._cofreRendered = true;
      LICSYSTEM.cofre.render();
    }
    if(view==="docsChecklist"){
      try{ LICSYSTEM.cofre.load(); }catch(e){}
      LICSYSTEM.docsChecklist.render();
    }
    if(view==="leiloesParticipo"){
      try{ LICSYSTEM.leiloesParticipo.render(); }catch(e){}
    }
    if(view==="leilaoWorkspace"){
      try{ LICSYSTEM.leiloesParticipo.renderHub(); }catch(e){}
    }
    if(view==="importarEdital"){
      try{
        if(LICSYSTEM.captacao && LICSYSTEM.captacao.render){
          LICSYSTEM.captacao.render(LICSYSTEM.state.captacaoLines || [], false);
        }
        if(LICSYSTEM.captacao && LICSYSTEM.captacao.autoImportar){
          LICSYSTEM.captacao.autoImportar();
        }
      }catch(e){}
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


  ctx.wire = wire;
  ctx.wireOrcFileInput = wireOrcFileInput;
  window.wireOrcFileInput = wireOrcFileInput;
  LICSYSTEM.wire = wire;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
