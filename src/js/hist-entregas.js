/* LICSYSTEM — HIST ENTREGAS (20-hist-entregas.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }

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
        if(raw != null){
          var saved = JSON.parse(raw);
          if(Array.isArray(saved)){
            LICSYSTEM.histEntregas.items = saved;
          } else if(saved && typeof saved === "object" && Array.isArray(saved.items)){
            LICSYSTEM.histEntregas.items = saved.items;
          } else {
            LICSYSTEM.histEntregas.items = [];
          }
        } else {
          /* Sem dados locais: começa vazio (não reinsere exemplos ao atualizar). */
          LICSYSTEM.histEntregas.items = [];
        }
      }catch(e){
        LICSYSTEM.histEntregas.items = [];
      }
      LICSYSTEM.histEntregas._loaded = true;
      return LICSYSTEM.histEntregas.items;
    },

    saveLocal: function(opts){
      opts = opts || {};
      var now = Date.now();
      var items = LICSYSTEM.histEntregas.items || [];
      var empty = !items.length;
      try{
        localStorage.setItem(HIST_ENTREGAS_KEY, JSON.stringify({
          v: 1,
          updatedAt: now,
          cleared: empty,
          items: items
        }));
        if(LICSYSTEM.cloudSync){
          LICSYSTEM.cloudSync.notifyLocalChange("histEntregas", {
            updatedAt: now,
            immediate: opts.immediate !== false,
            forceClear: empty
          });
        }
      }catch(e){}
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
      LICSYSTEM.histEntregas.saveLocal({ immediate: true });
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Item removido e sincronizado.");
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


  ctx.HIST_ENTREGAS_KEY = HIST_ENTREGAS_KEY;
  ctx.calcularFaltaEntregar = calcularFaltaEntregar;
  ctx.calcularResumoFinanceiro = calcularResumoFinanceiro;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
