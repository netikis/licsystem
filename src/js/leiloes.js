/* LICSYSTEM — LICITACOES QUE PARTICIPO / LISTA */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var LEILOES_PARTICIPO_KEY = ctx.LEILOES_PARTICIPO_KEY;
  var ACTIVE_LEILAO_KEY = ctx.ACTIVE_LEILAO_KEY;

  LICSYSTEM.leiloesParticipo = Object.assign(LICSYSTEM.leiloesParticipo || {}, {
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
    _sortOrder: "data",
    orcStatus: function(it){
      // Retorna "ok" (verde), "parcial" (amarelo) ou "" (sem orçamento)
      var orc = it && it.workspace && it.workspace.orcamento;
      var rows = (orc && Array.isArray(orc.items) ? orc.items : []).filter(function(r){
        return String(r.produto || "").trim().length > 0;
      });
      if(!rows.length) return "";
      var total = rows.length;
      var preenchidos = rows.filter(function(r){ return Number(r.vunit) > 0; }).length;
      if(preenchidos === total) return "ok";
      if(preenchidos > 0) return "parcial";
      return "parcial";
    },
    sortItems: function(arr, order){
      var copy = arr.slice();
      if(order === "alfa"){
        copy.sort(function(a,b){
          return String(a.titulo||"").localeCompare(String(b.titulo||""), "pt-BR", {sensitivity:"base"});
        });
      } else if(order === "anexo"){
        // mais recente primeiro
        copy.sort(function(a,b){ return (b.dataAnalise||0) - (a.dataAnalise||0); });
      } else {
        // "data" = data do edital (DD/MM) — crescente: Janeiro primeiro, Dezembro por último
        copy.sort(function(a,b){
          var da = LICSYSTEM.leiloesParticipo._extractEditalDate(a);
          var db = LICSYSTEM.leiloesParticipo._extractEditalDate(b);
          if(da && db) return da - db;   // crescente: menor data primeiro
          if(da) return -1;
          if(db) return 1;
          return (a.createdAt||0) - (b.createdAt||0);
        });
      }
      return copy;
    },
    _extractEditalDate: function(it){
      // Extrai data no formato DD/MM ou DD.MM do título ou filename
      // Ex: "EDITAL GODOY MOREIRA 02.09" → dia=02, mês=09
      var str = String(it.titulo||"") + " " + String(it.filename||"");
      // Busca padrão DD.MM ou DD/MM (dia 1-31, mês 1-12)
      var m = str.match(/\b(\d{1,2})[\/\.](\d{1,2})(?:[\/\.](\d{2,4}))?\b/);
      if(!m) return null;
      var day = Number(m[1]);
      var mon = Number(m[2]);
      if(day < 1 || day > 31 || mon < 1 || mon > 12) return null;
      var now = new Date();
      var year = m[3] ? (m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3])) : now.getFullYear();
      var d = new Date(year, mon - 1, day);
      return isNaN(d.getTime()) ? null : d.getTime();
    },
    render: function(){
      var box = el("leiloesList");
      var sum = el("leiloesSummary");
      if(!box) return;

      var active = LICSYSTEM.leiloesParticipo.items.filter(function(it){ return it.status !== "arquivado"; });
      var archived = LICSYSTEM.leiloesParticipo.items.filter(function(it){ return it.status === "arquivado"; });
      var order = LICSYSTEM.leiloesParticipo._sortOrder || "data";
      active = LICSYSTEM.leiloesParticipo.sortItems(active, order);

      if(sum){
        if(!LICSYSTEM.leiloesParticipo.items.length){
          sum.innerHTML = "";
        } else {
          sum.innerHTML =
            '<span class="docs-pill">' + active.length + " participando</span>" +
            (archived.length ? '<span class="docs-pill pend">' + archived.length + " arquivado" + (archived.length === 1 ? "" : "s") + "</span>" : "") +
            '<span style="margin-left:auto;display:flex;gap:6px;align-items:center">' +
              '<span class="muted small" style="margin-right:2px">Ordenar:</span>' +
              '<button type="button" class="btn btn-ghost btn-sm lpSort' + (order==="data"?" btn-sort-active":"") + '" data-sort="data" title="Ordenar por data do edital">📅 Data</button>' +
              '<button type="button" class="btn btn-ghost btn-sm lpSort' + (order==="alfa"?" btn-sort-active":"") + '" data-sort="alfa" title="Ordenar alfabeticamente">🔤 A-Z</button>' +
              '<button type="button" class="btn btn-ghost btn-sm lpSort' + (order==="anexo"?" btn-sort-active":"") + '" data-sort="anexo" title="Ordenar por data do PDF anexado">📎 Anexo</button>' +
            "</span>";
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
        var orcSt = !isArch ? LICSYSTEM.leiloesParticipo.orcStatus(it) : "";
        var orcBadge = "";
        if(orcSt === "ok"){
          orcBadge = '<button type="button" class="btn btn-sm" style="background:#1e9e5a;color:#fff;cursor:default;pointer-events:none" title="Todos os preços preenchidos">✓ ORÇADO</button>';
        } else if(orcSt === "parcial"){
          orcBadge = '<button type="button" class="btn btn-sm" style="background:#e0a800;color:#fff;cursor:default;pointer-events:none" title="Orçamento incompleto — faltam preços">⚠ INCOMPLETO</button>';
        }
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
              orcBadge +
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

      if(sum){
        sum.querySelectorAll(".lpSort").forEach(function(btn){
          btn.addEventListener("click", function(){
            LICSYSTEM.leiloesParticipo._sortOrder = btn.getAttribute("data-sort") || "data";
            LICSYSTEM.leiloesParticipo.render();
          });
        });
      }
    },
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
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
