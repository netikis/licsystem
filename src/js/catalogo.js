/* LICSYSTEM — CATALOGO (17-catalogo.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

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
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("catalogo");
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

      // Orçamento salvo → reabre a planilha completa
      if(item.tipo === "orcamento"){
        LICSYSTEM.orcamento.abrirDoCatalogo(id);
        return;
      }

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
      if(!id) return;
      LICSYSTEM.catalogo.load();
      var item = null;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === id){ item = LICSYSTEM.catalogo.items[i]; break; }
      }
      var label = item && item.tipo === "orcamento"
        ? "Excluir este orçamento salvo do catálogo?"
        : "Excluir este produto do catálogo?";
      if(!confirm(label)) return;
      LICSYSTEM.catalogo.items = LICSYSTEM.catalogo.items.filter(function(it){ return it.id !== id; });
      LICSYSTEM.catalogo.saveLocal();
      if(item && item.tipo === "orcamento" && LICSYSTEM.state.orcCatalogId === id){
        LICSYSTEM.state.orcCatalogId = null;
        LICSYSTEM.orcamento.updateMeta();
      }
      listarProdutos();
      showAlert("catalogoAlert","ok", item && item.tipo === "orcamento" ? "Orçamento excluído." : "Produto excluído.");
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
        var blob = utils.fold([it.nome, it.sku, it.marca, it.numero, it.tipo].join(" ")).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    list.sort(function(a,b){
      var ta = a.tipo === "orcamento" ? 0 : 1;
      var tb = b.tipo === "orcamento" ? 0 : 1;
      if(ta !== tb) return ta - tb;
      return String(a.nome||"").localeCompare(String(b.nome||""), "pt-BR", { sensitivity:"base" });
    });

    if(!list.length){
      body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">'+(
        q ? "Nenhum item correspondente à busca." : "Nenhum produto ou orçamento cadastrado."
      )+'</td></tr>';
      return;
    }

    var html = "";
    list.forEach(function(it){
      var isOrc = it.tipo === "orcamento";
      var codigo = isOrc ? (it.numero || it.sku || "—") : (it.sku || "—");
      var desc = utils.escapeHtml(it.nome || "");
      if(isOrc){
        desc += ' <span class="cat-tipo-orc">Orçamento'+(it.qtdItens ? ' · '+it.qtdItens+' itens' : '')+'</span>';
      }
      var tipo = isOrc ? "Orçamento salvo" : (it.marca || "—");
      html += '<tr data-id="'+utils.escapeHtml(it.id)+'"'+(isOrc?' class="cat-row-orc"':'')+'>'+
        '<td>'+utils.escapeHtml(codigo)+'</td>'+
        '<td>'+desc+'</td>'+
        '<td>'+utils.escapeHtml(tipo)+'</td>'+
        '<td style="font-weight:700;color:var(--ls-navy)">'+utils.formatBrl(Number(it.preco)||0)+'</td>'+
        '<td><div class="cat-actions">'+
          '<button type="button" class="btn btn-ghost btn-sm catEdit" data-id="'+utils.escapeHtml(it.id)+'">'+(isOrc?'✎ Abrir':'✎ Editar')+'</button>'+
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


  ctx.CATALOGO_KEY = CATALOGO_KEY;
  ctx.salvarProduto = salvarProduto;
  ctx.listarProdutos = listarProdutos;
  ctx.filtrarCatalogo = filtrarCatalogo;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
