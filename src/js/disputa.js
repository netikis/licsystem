/* LICSYSTEM — DISPUTA (19-disputa.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

  /* ============================ SALA DE DISPUTA ============================ */
  LICSYSTEM.disputa = {
    historico: [],
    ativo: false,
    ocupado: false,
    lastCoveredConc: null,
    _timer: null,
    _stopReason: "",

    num: function(id){
      var n = el(id);
      var v = n ? Number(n.value) : NaN;
      return isFinite(v) ? v : 0;
    },

    hasValue: function(id){
      var n = el(id);
      return !!(n && String(n.value || "").trim() !== "");
    },

    round2: function(v){
      return Math.round((Number(v) || 0) * 100) / 100;
    },

    agoraHora: function(){
      var agora = new Date();
      var hh = ("0"+agora.getHours()).slice(-2);
      var mm = ("0"+agora.getMinutes()).slice(-2);
      var ss = ("0"+agora.getSeconds()).slice(-2);
      return hh+":"+mm+":"+ss;
    },

    /** Avalia se o próximo lance ainda respeita margem e piso. */
    avaliar: function(){
      var custo = LICSYSTEM.disputa.num("disputaMeuCusto");
      var degrau = LICSYSTEM.disputa.num("disputaDegrau");
      var lanceConc = LICSYSTEM.disputa.num("disputaLanceConcorrente");
      var piso = LICSYSTEM.disputa.hasValue("disputaPiso") ? LICSYSTEM.disputa.num("disputaPiso") : 0;
      var margemMin = LICSYSTEM.disputa.num("disputaMargemMin");
      var tipo = (el("disputaMargemTipo") && el("disputaMargemTipo").value) || "reais";
      var ref = LICSYSTEM.disputa.num("disputaPrecoRef");

      var out = {
        ok: false,
        lance: null,
        margem: null,
        margemPct: null,
        descontoPct: null,
        motivo: "Informe o lance do concorrente",
        decisao: "Aguardando"
      };

      if(!(lanceConc > 0)) return out;
      if(!LICSYSTEM.disputa.hasValue("disputaMeuCusto")){
        out.motivo = "Informe seu custo";
        out.decisao = "Bloqueado";
        return out;
      }

      var prox = LICSYSTEM.disputa.round2(Math.max(0, lanceConc - Math.max(0, degrau)));
      out.lance = prox;
      out.margem = LICSYSTEM.disputa.round2(prox - custo);
      if(prox > 0) out.margemPct = (out.margem / prox) * 100;
      if(ref > 0 && prox > 0) out.descontoPct = ((ref - prox) / ref) * 100;

      if(piso > 0 && prox < piso){
        out.motivo = "Abaixo do piso (" + utils.formatBrl(piso) + ")";
        out.decisao = "Parar";
        return out;
      }
      if(out.margem < 0){
        out.motivo = "Prejuízo — margem negativa";
        out.decisao = "Parar";
        return out;
      }
      if(tipo === "pct"){
        if((out.margemPct == null ? 0 : out.margemPct) + 1e-9 < margemMin){
          out.motivo = "Margem " + out.margemPct.toFixed(2).replace(".", ",") + "% < mínima " + margemMin + "%";
          out.decisao = "Parar";
          return out;
        }
      } else if(out.margem + 1e-9 < margemMin){
        out.motivo = "Margem " + utils.formatBrl(out.margem) + " < mínima " + utils.formatBrl(margemMin);
        out.decisao = "Parar";
        return out;
      }

      out.ok = true;
      out.motivo = "Pode cobrir";
      out.decisao = "Cobrir";
      return out;
    },

    setStatusUi: function(mode, titulo, msg){
      var bar = el("disputaRoboStatusBar");
      var tag = el("disputaRoboTag");
      var estado = el("disputaRoboEstado");
      var msgEl = el("disputaRoboMsg");
      var btnOn = el("btnRoboLigar");
      var btnOff = el("btnRoboParar");
      if(bar){
        bar.classList.remove("is-on","is-stop","is-warn");
        if(mode === "on") bar.classList.add("is-on");
        else if(mode === "stop") bar.classList.add("is-stop");
        else if(mode === "warn") bar.classList.add("is-warn");
      }
      if(tag){
        tag.textContent = mode === "on" ? "Ativo" : (mode === "warn" || mode === "stop" ? "Parado" : "Desligado");
      }
      if(estado) estado.textContent = titulo || "Robô desligado";
      if(msgEl) msgEl.textContent = msg || "";
      if(btnOn) btnOn.disabled = mode === "on";
      if(btnOff) btnOff.disabled = mode !== "on";
    },

    atualizarResultados: function(){
      var av = LICSYSTEM.disputa.avaliar();
      var lanceConc = LICSYSTEM.disputa.num("disputaLanceConcorrente");

      if(el("disputaMeuProximoLance")){
        el("disputaMeuProximoLance").value = av.lance == null ? "" : av.lance.toFixed(2);
      }
      var proxTxt = el("disputaMeuProximoLanceTxt");
      if(proxTxt) proxTxt.textContent = av.lance == null ? "—" : utils.formatBrl(av.lance);
      var proxSub = el("disputaProximoSub");
      if(proxSub){
        proxSub.textContent = lanceConc > 0
          ? ("Concorrente " + utils.formatBrl(lanceConc) + " − degrau")
          : "Concorrente − degrau";
      }

      var elMarg = el("disputaMargemRestante");
      var elMargSub = el("disputaMargemSub");
      var cardMarg = el("cardMargemRestante");
      if(elMarg) elMarg.textContent = av.margem == null ? "—" : utils.formatBrl(av.margem);
      if(elMargSub){
        if(av.margem == null) elMargSub.textContent = "Informe custo e lance";
        else if(av.margemPct != null) elMargSub.textContent = av.margemPct.toFixed(2).replace(".", ",") + "% sobre o próximo lance";
        else elMargSub.textContent = "Lance − meu custo";
      }
      if(cardMarg){
        cardMarg.classList.remove("warn","ok");
        if(av.margem != null && !av.ok) cardMarg.classList.add("warn");
        else if(av.ok) cardMarg.classList.add("ok");
      }

      var elPct = el("disputaDescontoPct");
      var elPctSub = el("disputaDescontoSub");
      if(elPct){
        elPct.textContent = av.descontoPct == null ? "—" : (av.descontoPct.toFixed(2).replace(".", ",") + "%");
      }
      if(elPctSub){
        elPctSub.textContent = LICSYSTEM.disputa.hasValue("disputaPrecoRef")
          ? "Sobre o preço de referência"
          : "Informe a referência (opcional)";
      }

      var dec = el("disputaDecisao");
      var decSub = el("disputaDecisaoSub");
      var cardDec = el("cardRoboDecisao");
      if(dec) dec.textContent = av.decisao;
      if(decSub) decSub.textContent = av.motivo;
      if(cardDec){
        cardDec.classList.remove("warn","ok");
        if(av.ok) cardDec.classList.add("ok");
        else if(av.decisao === "Parar" || av.decisao === "Bloqueado") cardDec.classList.add("warn");
      }

      if(LICSYSTEM.disputa.ativo){
        LICSYSTEM.disputa.setStatusUi(
          "on",
          "Robô ativo — monitorando",
          av.ok
            ? ("Pronto para cobrir em " + utils.formatBrl(av.lance))
            : (av.motivo || "Aguardando lance válido")
        );
      } else if(LICSYSTEM.disputa._stopReason){
        LICSYSTEM.disputa.setStatusUi("stop", "Robô parado", LICSYSTEM.disputa._stopReason);
      } else {
        LICSYSTEM.disputa.setStatusUi("off", "Robô desligado", "Configure e clique em Ligar robô.");
      }

      return av;
    },

    onFieldChange: function(id){
      LICSYSTEM.disputa.atualizarResultados();
      if(id === "disputaLanceConcorrente" && LICSYSTEM.disputa.ativo){
        LICSYSTEM.disputa.agendarCobertura();
      }
    },

    ligar: function(){
      var av = LICSYSTEM.disputa.atualizarResultados();
      if(!LICSYSTEM.disputa.hasValue("disputaMeuCusto")){
        showAlert("disputaAlert","warn","Informe seu custo antes de ligar o robô.");
        if(el("disputaMeuCusto")) el("disputaMeuCusto").focus();
        return;
      }
      LICSYSTEM.disputa.ativo = true;
      LICSYSTEM.disputa._stopReason = "";
      LICSYSTEM.disputa.lastCoveredConc = null;
      LICSYSTEM.disputa.setStatusUi("on", "Robô ativo — monitorando", "Aguardando lance do concorrente…");
      showAlert("disputaAlert","ok","Robô ligado. Digite/cole o lance do concorrente — ele cobre até a sua margem.");
      if(av && av.ok) LICSYSTEM.disputa.agendarCobertura();
    },

    parar: function(motivo){
      LICSYSTEM.disputa.ativo = false;
      LICSYSTEM.disputa.ocupado = false;
      if(LICSYSTEM.disputa._timer){
        clearTimeout(LICSYSTEM.disputa._timer);
        LICSYSTEM.disputa._timer = null;
      }
      LICSYSTEM.disputa._stopReason = motivo || "Parado.";
      var mode = /preju|margem|piso|abaixo/i.test(LICSYSTEM.disputa._stopReason) ? "warn" : "stop";
      LICSYSTEM.disputa.setStatusUi(mode, "Robô parado", LICSYSTEM.disputa._stopReason);
      showAlert("disputaAlert", mode === "warn" ? "warn" : "info", LICSYSTEM.disputa._stopReason);
      LICSYSTEM.disputa.atualizarResultados();
    },

    agendarCobertura: function(){
      if(!LICSYSTEM.disputa.ativo || LICSYSTEM.disputa.ocupado) return;
      var lanceConc = LICSYSTEM.disputa.round2(LICSYSTEM.disputa.num("disputaLanceConcorrente"));
      if(!(lanceConc > 0)) return;
      if(LICSYSTEM.disputa.lastCoveredConc != null &&
         Math.abs(LICSYSTEM.disputa.lastCoveredConc - lanceConc) < 0.001){
        return; // já cobriu este valor
      }
      var av = LICSYSTEM.disputa.avaliar();
      if(!av.ok){
        if(av.decisao === "Parar"){
          LICSYSTEM.disputa.parar("Limite atingido: " + av.motivo);
        }
        return;
      }
      var delay = Math.max(0, LICSYSTEM.disputa.num("disputaDelay") || 0);
      if(LICSYSTEM.disputa._timer) clearTimeout(LICSYSTEM.disputa._timer);
      LICSYSTEM.disputa.setStatusUi(
        "on",
        "Robô cobrindo…",
        "Enviando cobertura em " + delay + " ms → " + utils.formatBrl(av.lance)
      );
      LICSYSTEM.disputa._timer = setTimeout(function(){
        LICSYSTEM.disputa._timer = null;
        if(!LICSYSTEM.disputa.ativo) return;
        LICSYSTEM.disputa.registrarLance({ auto: true });
      }, delay);
    },

    registrarLance: function(opts){
      opts = opts || {};
      var av = LICSYSTEM.disputa.atualizarResultados();
      var lanceConc = LICSYSTEM.disputa.round2(LICSYSTEM.disputa.num("disputaLanceConcorrente"));
      if(!(lanceConc > 0)){
        showAlert("disputaAlert","warn","Informe o lance atual do concorrente.");
        if(el("disputaLanceConcorrente")) el("disputaLanceConcorrente").focus();
        return false;
      }
      if(!av.ok || av.lance == null){
        showAlert("disputaAlert","warn", av.motivo || "Não é seguro cobrir este lance.");
        if(opts.auto && av.decisao === "Parar"){
          LICSYSTEM.disputa.parar("Limite atingido: " + av.motivo);
        }
        return false;
      }

      LICSYSTEM.disputa.ocupado = true;
      var meuLance = LICSYSTEM.disputa.round2(av.lance);
      var hora = LICSYSTEM.disputa.agoraHora();

      LICSYSTEM.disputa.historico.unshift({
        hora: hora,
        valor: meuLance,
        conc: lanceConc,
        auto: !!opts.auto,
        ts: new Date().toISOString()
      });

      LICSYSTEM.disputa.lastCoveredConc = lanceConc;
      // Atualiza campo para o nosso lance (melhor proposta atual)
      if(el("disputaLanceConcorrente")) el("disputaLanceConcorrente").value = meuLance.toFixed(2);

      LICSYSTEM.disputa.renderHistorico();
      LICSYSTEM.disputa.atualizarResultados();
      hideAlert("disputaAlert");
      showAlert(
        "disputaAlert",
        "ok",
        (opts.auto ? "Robô cobriu: " : "Lance registrado: ") +
          utils.formatBrl(meuLance) + " às " + hora +
          " (margem " + utils.formatBrl(av.margem) + ")"
      );
      LICSYSTEM.disputa.ocupado = false;

      // Se o robô continuar ativo, espera o próximo lance do concorrente (valor diferente)
      if(LICSYSTEM.disputa.ativo){
        LICSYSTEM.disputa.setStatusUi(
          "on",
          "Robô ativo — aguardando novo lance",
          "Última cobertura: " + utils.formatBrl(meuLance) + ". Cole o próximo lance do concorrente."
        );
      }
      return true;
    },

    renderHistorico: function(){
      var ul = el("disputaHistorico");
      var count = el("disputaHistCount");
      var list = LICSYSTEM.disputa.historico || [];
      if(count) count.textContent = list.length + " registro(s)";
      if(!ul) return;
      if(!list.length){
        ul.innerHTML = '<li class="lh-empty">Nenhum lance ainda. Ligue o robô e informe o lance do concorrente.</li>';
        return;
      }
      var html = "";
      list.forEach(function(it, i){
        html += '<li>'+
          '<span class="lh-hora">'+utils.escapeHtml(it.hora)+(it.auto ? " · auto" : " · manual")+'</span>'+
          '<span class="lh-val">'+(i===0?"→ ":"")+utils.formatBrl(it.valor)+'</span>'+
        '</li>';
      });
      ul.innerHTML = html;
    },

    limparSessao: function(){
      if(LICSYSTEM.disputa.historico.length && !confirm("Limpar histórico e campos do robô?")) return;
      if(LICSYSTEM.disputa.ativo) LICSYSTEM.disputa.parar("Sessão limpa.");
      LICSYSTEM.disputa.historico = [];
      LICSYSTEM.disputa.lastCoveredConc = null;
      LICSYSTEM.disputa._stopReason = "";
      [
        "disputaPrecoRef","disputaLanceConcorrente","disputaMeuCusto",
        "disputaPiso","disputaMeuProximoLance","disputaMargemMin"
      ].forEach(function(id){
        if(el(id)) el(id).value = id === "disputaMargemMin" ? "0" : "";
      });
      if(el("disputaDegrau")) el("disputaDegrau").value = "0.01";
      if(el("disputaDelay")) el("disputaDelay").value = "800";
      if(el("disputaMargemTipo")) el("disputaMargemTipo").value = "reais";
      LICSYSTEM.disputa.renderHistorico();
      LICSYSTEM.disputa.atualizarResultados();
      hideAlert("disputaAlert");
    }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
