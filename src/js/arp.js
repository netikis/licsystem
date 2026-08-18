/* LICSYSTEM — ARP (18-arp.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

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
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("arp");
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


  ctx.ARP_KEY = ARP_KEY;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
