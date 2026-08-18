/* LICSYSTEM — ENTREGAS (16-entregas.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  function wire(){
    var fn = ctx.wire || window.wire || LICSYSTEM.wire;
    if (typeof fn !== "function") throw new Error("wire ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ ENTREGAS ============================ */
  var ENTREGAS_KEY = "licsystem_entregas_v1";

  /**
   * Monta o payload da entrega (texto + arquivo) para persistência futura.
   * Pronto para: Firebase Storage (arquivo) + Firestore/RTDB (metadados).
   * @returns {{ ok:boolean, erro?:string, dados?:object, arquivo?:File|null }}
   */
  function coletarDadosEntrega(){
    var val = function(id){ var n = el(id); return n ? String(n.value || "").trim() : ""; };
    var statusEl = document.querySelector('input[name="entregaStatusNota"]:checked');
    var destinoEl = document.querySelector('input[name="entregaTipoDestino"]:checked');
    var fileInput = el("entregaArquivoNf");
    var arquivo = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;

    var statusNota = statusEl ? statusEl.value : "NAO_FEITO";
    var tipoDestino = destinoEl ? destinoEl.value : "DESTINO_FINAL";

    var dados = {
      // --- Identificação ---
      nomeLicitacao: val("entregaNomeLicitacao"),
      numeroEmpenho: val("entregaNumeroEmpenho"),
      preenchidoPor: val("entregaPreenchidoPor"),

      // --- Faturamento / anexos ---
      statusNota: statusNota, // "FEITO" | "NAO_FEITO"
      observacoes: val("entregaObservacoes"),
      materialOrigem: val("entregaMaterialOrigem"),
      // Metadados do anexo (o File em si vai em `arquivo` abaixo)
      anexo: arquivo ? {
        nome: arquivo.name,
        tipo: arquivo.type || "",
        tamanho: arquivo.size || 0
        // TODO Firebase Storage:
        // 1) storage.ref("entregas/"+id+"/"+arquivo.name).put(arquivo)
        // 2) url = await snap.ref.getDownloadURL()
        // 3) dados.anexo.url = url
      } : null,

      // --- Logística ---
      tipoDestino: tipoDestino, // "DESTINO_FINAL" | "MINHA_LOJA"
      destinoFinal: null,
      minhaLoja: null,

      // --- Controle ---
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
      // TODO Firestore/RTDB:
      // await firebase.firestore().collection("entregas").add(dados)
      // ou utils.firebasePush("entregas", dados)
    };

    if(tipoDestino === "DESTINO_FINAL"){
      dados.destinoFinal = {
        localResponsavel: val("entregaLocalResponsavel"),
        cep: val("entregaCep").replace(/\D/g,""),
        endereco: val("entregaEndereco"),
        numero: val("entregaNumero"),
        complemento: val("entregaComplemento"),
        bairro: val("entregaBairro"),
        cidade: val("entregaCidade"),
        uf: val("entregaUf").toUpperCase()
      };
    } else {
      dados.minhaLoja = {
        transporte: val("entregaTransporte") // CORREIOS | TRANSPORTADORA | VEICULO_PROPRIO
      };
    }

    if(!dados.nomeLicitacao){
      return { ok:false, erro:"Informe o Nome da Licitação." };
    }
    if(!dados.preenchidoPor){
      return { ok:false, erro:"Informe o nome de quem preencheu (obrigatório)." };
    }
    if(tipoDestino === "MINHA_LOJA" && !(dados.minhaLoja && dados.minhaLoja.transporte)){
      return { ok:false, erro:"Selecione o transporte para envio futuro." };
    }

    return { ok:true, dados:dados, arquivo:arquivo };
  }
  // Exposto globalmente conforme solicitado
  window.coletarDadosEntrega = coletarDadosEntrega;

  LICSYSTEM.entregas = {
    items: [],

    load:function(){
      try{
        var saved = JSON.parse(localStorage.getItem(ENTREGAS_KEY) || "[]");
        LICSYSTEM.entregas.items = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.entregas.items = [];
      }
    },

    saveLocal:function(){
      try{
        localStorage.setItem(ENTREGAS_KEY, JSON.stringify(LICSYSTEM.entregas.items));
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("entregas");
      }catch(e){
        console.warn("Entregas: falha ao salvar localmente", e);
      }
    },

    open:function(){
      var oc = el("entregaOffcanvas");
      var ov = el("entregaOverlay");
      if(oc){
        oc.classList.add("open");
        oc.setAttribute("aria-hidden","false");
      }
      if(ov){
        ov.classList.add("show");
        ov.setAttribute("aria-hidden","false");
      }
      document.body.classList.add("entrega-open");
      hideAlert("entregaFormAlert");
      try{
        var last = localStorage.getItem("licsystem_entrega_preenchido_por") || "";
        var por = el("entregaPreenchidoPor");
        if(por && !por.value && last) por.value = last;
      }catch(e){}
      setTimeout(function(){
        var f = el("entregaPreenchidoPor");
        if(f && !String(f.value||"").trim()){ f.focus(); return; }
        f = el("entregaNomeLicitacao");
        if(f) f.focus();
      }, 200);
    },

    close:function(){
      var oc = el("entregaOffcanvas");
      var ov = el("entregaOverlay");
      if(oc){
        oc.classList.remove("open");
        oc.setAttribute("aria-hidden","true");
      }
      if(ov){
        ov.classList.remove("show");
        ov.setAttribute("aria-hidden","true");
      }
      document.body.classList.remove("entrega-open");
    },

    resetForm:function(){
      [
        "entregaNomeLicitacao","entregaNumeroEmpenho","entregaPreenchidoPor","entregaObservacoes","entregaMaterialOrigem",
        "entregaLocalResponsavel","entregaCep","entregaEndereco","entregaNumero","entregaComplemento",
        "entregaBairro","entregaCidade","entregaUf"
      ].forEach(function(id){ if(el(id)) el(id).value = ""; });
      if(el("entregaTransporte")) el("entregaTransporte").value = "";
      if(el("entregaStatusNaoFeito")) el("entregaStatusNaoFeito").checked = true;
      if(el("entregaDestinoFinal")) el("entregaDestinoFinal").checked = true;
      if(el("entregaArquivoNf")) el("entregaArquivoNf").value = "";
      if(el("entregaArquivoNome")) el("entregaArquivoNome").textContent = "PDF ou imagem";
      if(el("entregaCepHint")) el("entregaCepHint").textContent = "Digite o CEP (8 dígitos) para preencher via ViaCEP.";
      LICSYSTEM.entregas.syncStatusUi();
      LICSYSTEM.entregas.syncDestinoUi();
      hideAlert("entregaFormAlert");
    },

    syncStatusUi:function(){
      var feito = el("entregaStatusFeito") && el("entregaStatusFeito").checked;
      var lblN = el("lblStatusNaoFeito");
      var lblF = el("lblStatusFeito");
      if(lblN) lblN.className = "status-nf" + (feito ? "" : " is-nao");
      if(lblF) lblF.className = "status-nf" + (feito ? " is-feito" : "");
    },

    syncDestinoUi:function(){
      var loja = el("entregaMinhaLoja") && el("entregaMinhaLoja").checked;
      var cardF = el("cardDestinoFinal");
      var cardL = el("cardMinhaLoja");
      if(cardF) cardF.classList.toggle("is-active", !loja);
      if(cardL) cardL.classList.toggle("is-active", !!loja);
      if(el("painelDestinoFinal")) el("painelDestinoFinal").style.display = loja ? "none" : "";
      if(el("painelMinhaLoja")) el("painelMinhaLoja").style.display = loja ? "" : "none";
    },

    /** ViaCEP — preenche endereço ao completar 8 dígitos */
    buscarCep:function(){
      var cepInput = el("entregaCep");
      if(!cepInput) return;
      var cep = String(cepInput.value || "").replace(/\D/g,"");
      if(cep.length === 8){
        cepInput.value = cep.slice(0,5) + "-" + cep.slice(5);
      }
      var hint = el("entregaCepHint");
      if(cep.length !== 8){
        if(hint) hint.textContent = "Digite o CEP (8 dígitos) para preencher via ViaCEP.";
        return;
      }
      if(hint) hint.textContent = "Consultando ViaCEP…";
      fetch("https://viacep.com.br/ws/"+cep+"/json/")
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(!j || j.erro){
            if(hint) hint.textContent = "CEP não encontrado.";
            return;
          }
          if(el("entregaEndereco")) el("entregaEndereco").value = j.logradouro || "";
          if(el("entregaBairro")) el("entregaBairro").value = j.bairro || "";
          if(el("entregaCidade")) el("entregaCidade").value = j.localidade || "";
          if(el("entregaUf")) el("entregaUf").value = j.uf || "";
          if(hint) hint.textContent = "Endereço preenchido via ViaCEP. Confira o número.";
          if(el("entregaNumero")) el("entregaNumero").focus();
        })
        .catch(function(){
          if(hint) hint.textContent = "Falha ao consultar ViaCEP (rede/CORS). Preencha manualmente.";
        });
    },

    renderLista:function(){
      LICSYSTEM.entregas.load();
      var box = el("entregaList");
      if(!box) return;
      var list = LICSYSTEM.entregas.items || [];
      if(!list.length){
        box.innerHTML = '<div class="muted small" style="padding:18px;text-align:center">Nenhuma entrega registrada ainda.</div>';
        return;
      }
      var html = "";
      list.slice().reverse().forEach(function(it, revIdx){
        var idx = list.length - 1 - revIdx;
        var badge = it.statusNota === "FEITO"
          ? '<span class="badge-nf ok">NF FEITO</span>'
          : '<span class="badge-nf pend">NF NÃO FEITO</span>';
        var dest = it.tipoDestino === "MINHA_LOJA"
          ? ("Loja · " + ((it.minhaLoja && it.minhaLoja.transporte) || "—"))
          : ("Destino · " + ((it.destinoFinal && (it.destinoFinal.cidade || it.destinoFinal.localResponsavel)) || "—"));
        html += '<div class="entrega-item" data-idx="'+idx+'">'+
          '<div>'+
            '<div class="ei-title">'+utils.escapeHtml(it.nomeLicitacao||"Sem nome")+'</div>'+
            '<div class="ei-meta">Empenho: '+utils.escapeHtml(it.numeroEmpenho||"—")+
              ' · '+utils.escapeHtml(dest)+
              (it.preenchidoPor ? ' · Preenchido por: '+utils.escapeHtml(it.preenchidoPor) : '')+
              (it.anexo && it.anexo.nome ? ' · 📎 '+utils.escapeHtml(it.anexo.nome) : '')+
            '</div>'+
          '</div>'+badge+
        '</div>';
      });
      box.innerHTML = html;
    },

    salvar:function(){
      var pack = coletarDadosEntrega();
      if(!pack.ok){
        showAlert("entregaFormAlert","warn", utils.escapeHtml(pack.erro));
        return;
      }
      // Persistência local imediata (metadados). Arquivo fica só no File/seleção atual.
      // TODO: integrar Storage + Firestore aqui usando pack.dados + pack.arquivo
      var registro = pack.dados;
      registro.id = "ent_"+Date.now();
      try{
        if(registro.preenchidoPor){
          localStorage.setItem("licsystem_entrega_preenchido_por", registro.preenchidoPor);
        }
      }catch(e){}
      LICSYSTEM.entregas.load();
      LICSYSTEM.entregas.items.push(registro);
      LICSYSTEM.entregas.saveLocal();
      LICSYSTEM.entregas.renderLista();
      LICSYSTEM.entregas.close();
      LICSYSTEM.entregas.resetForm();
      showAlert("entregaAlert","ok","✅ Entrega salva localmente ("+utils.escapeHtml(registro.nomeLicitacao)+").");
    },

    wire:function(){
      function on(id, evt, fn){
        var n = el(id); if(n) n.addEventListener(evt, fn);
      }
      on("btnNovaEntrega","click", function(){
        LICSYSTEM.entregas.resetForm();
        LICSYSTEM.entregas.open();
      });
      on("btnFecharEntrega","click", LICSYSTEM.entregas.close);
      on("btnCancelarEntrega","click", function(){
        LICSYSTEM.entregas.close();
        LICSYSTEM.entregas.resetForm();
      });
      on("btnSalvarEntrega","click", LICSYSTEM.entregas.salvar);
      on("entregaOverlay","click", function(e){
        // Fecha só ao clicar no fundo escuro, não no card do formulário
        if(e.target && e.target.id === "entregaOverlay") LICSYSTEM.entregas.close();
      });

      ["entregaStatusFeito","entregaStatusNaoFeito"].forEach(function(id){
        on(id,"change", LICSYSTEM.entregas.syncStatusUi);
      });
      ["entregaDestinoFinal","entregaMinhaLoja"].forEach(function(id){
        on(id,"change", LICSYSTEM.entregas.syncDestinoUi);
      });
      on("entregaCep","blur", LICSYSTEM.entregas.buscarCep);
      on("entregaCep","input", function(){
        var v = (el("entregaCep").value || "").replace(/\D/g,"");
        if(v.length === 8) LICSYSTEM.entregas.buscarCep();
      });
      on("entregaArquivoNf","change", function(){
        var f = el("entregaArquivoNf");
        var nome = (f && f.files && f.files[0]) ? f.files[0].name : "PDF ou imagem";
        if(el("entregaArquivoNome")) el("entregaArquivoNome").textContent = nome;
      });

      document.addEventListener("keydown", function(e){
        if(e.key === "Escape" && document.body.classList.contains("entrega-open")){
          LICSYSTEM.entregas.close();
        }
      });
    }
  };


  ctx.ENTREGAS_KEY = ENTREGAS_KEY;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
