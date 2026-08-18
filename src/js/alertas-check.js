/* LICSYSTEM — ALERTAS PNCP / MONITORAMENTO */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

  LICSYSTEM.alertas = Object.assign(LICSYSTEM.alertas || {}, {
    findWatch: function(id){
      id = String(id || "");
      for(var i = 0; i < this.watches.length; i++){
        if(this.watches[i].id === id) return this.watches[i];
      }
      return null;
    },
    upsertWatch: function(partial, opts){
      opts = opts || {};
      var w = this.normalizeWatch(partial);
      if(!w.label){
        if(w.tipo === "radar") w.label = (w.q || "radar") + (w.uf ? " · " + w.uf : "");
        else if(w.tipo === "proximos" || w.tipo === "raio" || w.tipo === "vizinhos"){
          w.label = (w.municipio || "Origem") + " · " + (w.raio || 250) + " km";
        }
        else w.label = w.municipio || w.mensagem || w.regiao || "Município";
      }
      var dup = null;
      for(var i = 0; i < this.watches.length; i++){
        var x = this.watches[i];
        if(w.tipo === "radar" && x.tipo === "radar" && x.q === w.q && x.uf === w.uf){ dup = x; break; }
        if((w.tipo === "proximos" || w.tipo === "raio") && (x.tipo === "proximos" || x.tipo === "raio") &&
          x.ibge === w.ibge && Number(x.raio || 0) === Number(w.raio || 0) &&
          String(x.q || "") === String(w.q || "") && String(x.cobertura || "") === String(w.cobertura || "")){
          dup = x; break;
        }
        if(w.tipo !== "radar" && w.tipo !== "proximos" && w.tipo !== "raio" &&
          x.tipo !== "radar" && x.tipo !== "proximos" && x.tipo !== "raio" &&
          ((w.ibge && x.ibge === w.ibge) || (w.municipio && x.municipio === w.municipio && x.uf === w.uf))){
          dup = x; break;
        }
      }
      if(dup){
        Object.assign(dup, w, { id: dup.id, seenIds: dup.seenIds || {}, createdAt: dup.createdAt });
        w = dup;
      } else {
        if(this.watches.length >= this.MAX_WATCHES){
          throw new Error("Limite de " + this.MAX_WATCHES + " alertas. Exclua um para criar outro.");
        }
        this.watches.unshift(w);
      }
      this.persistWatches({ immediate: true });
      if(opts.baseline !== false){
        return this.checkWatch(w, { baseline: true }).then(function(){ return w; });
      }
      return Promise.resolve(w);
    },
    removeWatch: function(id){
      this.watches = this.watches.filter(function(w){ return w.id !== id; });
      this.persistWatches({ immediate: true });
    },
    toggleWatch: function(id){
      var w = this.findWatch(id);
      if(!w) return;
      w.enabled = !w.enabled;
      this.persistWatches({ immediate: true });
    },
    markRead: function(id){
      var a = null;
      for(var i = 0; i < this.alerts.length; i++){
        if(this.alerts[i].id === id){ a = this.alerts[i]; break; }
      }
      if(!a || a.readAt) return;
      a.readAt = Date.now();
      this.persistAlerts({ immediate: true });
    },
    markAllRead: function(){
      var now = Date.now();
      var changed = false;
      for(var i = 0; i < this.alerts.length; i++){
        if(!this.alerts[i].readAt){
          this.alerts[i].readAt = now;
          changed = true;
        }
      }
      if(changed) this.persistAlerts({ immediate: true });
    },
    findAlert: function(id){
      id = String(id || "");
      for(var i = 0; i < this.alerts.length; i++){
        if(this.alerts[i].id === id) return this.alerts[i];
      }
      return null;
    },
    removeAlert: function(id){
      id = String(id || "");
      var before = this.alerts.length;
      this.alerts = this.alerts.filter(function(a){ return a.id !== id; });
      if(this.alerts.length !== before){
        this.persistAlerts({ immediate: true });
      }
    },
    dismissAlert: function(id){
      this.removeAlert(id);
    },
    markInteresse: function(id){
      var a = this.findAlert(id);
      if(!a) return null;
      var item = this.normalizeAlert(Object.assign({}, a, {
        interessadoAt: Date.now(),
        readAt: a.readAt || Date.now()
      }));
      this.interessados = this.interessados.filter(function(x){
        return x.id !== item.id && x.key !== item.key;
      });
      this.interessados.unshift(item);
      if(this.interessados.length > this.MAX_INTERESSADOS){
        this.interessados = this.interessados.slice(0, this.MAX_INTERESSADOS);
      }
      this.removeAlert(id);
      this.persistInteressados();
      if(window.__lsActivateView){
        window.__lsActivateView("analiseIa");
      }
      try{
        showAlert(
          "iaAlert",
          "ok",
          "Edital com interesse adicionado ao painel. Use <b>Analisar com IA</b> no balão (sem PDF) ou envie o PDF para análise completa."
        );
      }catch(e){}
      return item;
    },
    removeInteressado: function(id){
      id = String(id || "");
      this.interessados = this.interessados.filter(function(a){ return a.id !== id; });
      this.persistInteressados();
    },
    trimSeen: function(watch){
      var keys = Object.keys(watch.seenIds || {});
      if(keys.length <= this.MAX_SEEN) return;
      keys.sort();
      var drop = keys.length - this.MAX_SEEN;
      for(var i = 0; i < drop; i++) delete watch.seenIds[keys[i]];
    },
    addNovos: function(rows, watch, opts){
      opts = opts || {};
      var baseline = !!opts.baseline;
      var added = 0;
      if(!watch.seenIds) watch.seenIds = {};
      for(var i = 0; i < rows.length; i++){
        var row = rows[i] || {};
        var key = this.editalKey(row);
        if(!key) continue;
        var alreadySeen = !!watch.seenIds[key];
        watch.seenIds[key] = 1;
        if(alreadySeen) continue;
        if(baseline) continue;
        var exists = false;
        for(var j = 0; j < this.alerts.length; j++){
          if(this.alerts[j].key === key){ exists = true; break; }
        }
        if(exists) continue;
        this.alerts.unshift(this.normalizeAlert({
          id: key,
          key: key,
          numeroControlePNCP: row.numeroControlePNCP || null,
          numeroCompra: row.numeroCompra || null,
          orgao: row.orgao,
          municipio: row.municipio,
          uf: row.uf,
          objeto: row.objeto,
          modalidade: row.modalidade,
          valorEstimado: row.valorEstimado,
          dataAbertura: this.pickDataAbertura(row),
          dataEncerramento: this.pickDataPrazo(row),
          link: row.link,
          watchId: watch.id,
          watchLabel: watch.label,
          foundAt: Date.now(),
          readAt: null
        }));
        added++;
      }
      this.trimSeen(watch);
      if(this.alerts.length > this.MAX_ALERTS){
        this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
      }
      return added;
    },
    checkWatch: function(watch, opts){
      opts = opts || {};
      var self = this;
      var knownIds = Object.keys(watch.seenIds || {});
      return fetch("/api/monitor-pncp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ watches: [watch], knownIds: knownIds })
      }).then(function(r){
        return utils.parseApiResponse(r);
      }).then(function(j){
        if(!j || j.ok === false) throw new Error((j && j.error) || "Falha no monitor PNCP");
        var pack = (j.results && j.results[0] && j.results[0].editais) || [];
        var novos = j.novos || [];
        /* baseline: marca tudo visto sem criar alerta */
        var added = self.addNovos(opts.baseline ? pack : novos, watch, opts);
        var enriched = self.enrichAlertsFromRows(pack);
        watch.lastCheckedAt = Date.now();
        self.persistWatches({ immediate: true });
        if(!opts.baseline || enriched) self.persistAlerts({ immediate: true });
        else self.persistWatches({ immediate: true });
        return { added: added, enriched: enriched, total: pack.length, watch: watch };
      });
    },
    checkAll: function(opts){
      opts = opts || {};
      var self = this;
      if(self._busy) return Promise.resolve({ skipped: true });
      var list = self.watches.filter(function(w){ return w.enabled !== false; });
      if(!list.length) return Promise.resolve({ checked: 0, added: 0, enriched: 0 });
      self._busy = true;
      var btnIds = ["btnAlertasCheckNow", "btnBellCheck"];
      btnIds.forEach(function(id){ var b = el(id); if(b) b.disabled = true; });

      var addedTotal = 0;
      var enrichedTotal = 0;
      var chain = Promise.resolve();
      /* API aceita até 4 watches por chamada */
      var chunks = [];
      for(var i = 0; i < list.length; i += 4){
        chunks.push(list.slice(i, i + 4));
      }
      chunks.forEach(function(chunk){
        chain = chain.then(function(){
          var known = [];
          chunk.forEach(function(w){
            Object.keys(w.seenIds || {}).forEach(function(k){ known.push(k); });
          });
          return fetch("/api/monitor-pncp", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ watches: chunk, knownIds: known })
          }).then(function(r){ return utils.parseApiResponse(r); }).then(function(j){
            if(!j || j.ok === false) throw new Error((j && j.error) || "Falha no monitor PNCP");
            var byWatch = Object.create(null);
            (j.results || []).forEach(function(res){
              byWatch[res.watchId] = res;
            });
            chunk.forEach(function(w){
              var res = byWatch[w.id];
              var pack = (res && res.editais) || [];
              var novos = (j.novos || []).filter(function(n){ return n.watchId === w.id; });
              addedTotal += self.addNovos(opts.baseline ? pack : novos, w, opts);
              enrichedTotal += self.enrichAlertsFromRows(pack);
              w.lastCheckedAt = Date.now();
            });
          });
        });
      });

      return chain.then(function(){
        self.persistWatches({ immediate: true });
        self.persistAlerts({ immediate: true });
        return { checked: list.length, added: addedTotal, enriched: enrichedTotal };
      }).catch(function(err){
        console.warn("alertas.checkAll", err);
        throw err;
      }).then(function(r){
        self._busy = false;
        btnIds.forEach(function(id){ var b = el(id); if(b) b.disabled = false; });
        return r;
      }, function(err){
        self._busy = false;
        btnIds.forEach(function(id){ var b = el(id); if(b) b.disabled = false; });
        throw err;
      });
    },
    createFromRadar: function(){
      var q = String((el("pncpKeywords") && el("pncpKeywords").value) || "").trim();
      var uf = String((el("pncpUf") && el("pncpUf").value) || "").trim().toUpperCase();
      if(!q) throw new Error("Informe palavras-chave no Radar PNCP.");
      if(!uf) throw new Error("Escolha uma UF para o alerta do Radar (ex.: SP).");
      var leiloes = !el("pncpIncluirLeiloes") || !!(el("pncpIncluirLeiloes") && el("pncpIncluirLeiloes").checked);
      return this.upsertWatch({
        tipo: "radar",
        q: q,
        uf: uf,
        leiloes: leiloes,
        janela: "45",
        label: q + " · " + uf
      }, { baseline: true });
    },
    createFromChat: function(){
      var texto = String((el("chatEditalMsg") && el("chatEditalMsg").value) || "").trim();
      var cat = String((el("chatEditalCat") && el("chatEditalCat").value) || "").trim();
      var janela = (el("chatEditalJanela") && el("chatEditalJanela").value) || "45";
      var leiloes = !el("chatEditalLeiloes") || !!(el("chatEditalLeiloes") && el("chatEditalLeiloes").checked);
      var ampliar = !!(el("chatEditalAmpliar") && el("chatEditalAmpliar").checked);
      if(!texto && !cat) throw new Error("Digite o nome da cidade ou uma pergunta antes de ativar o alerta.");
      var folded = utils.fold(texto).toLowerCase();
      var regiao = "";
      if(/norte\s*pioneiro/.test(folded)) regiao = "norte-pioneiro";
      return this.upsertWatch({
        tipo: "municipio",
        municipio: regiao ? "" : texto,
        mensagem: regiao ? "" : texto,
        regiao: regiao,
        categoria: cat,
        leiloes: leiloes,
        ampliar: ampliar,
        janela: janela === "ano" ? "ano" : "45",
        label: regiao ? ("Norte Pioneiro" + (cat ? " · " + cat : "")) : texto
      }, { baseline: true });
    },
    createFromProximos: function(){
      var self = this;
      var ibge = Number((el("proxIbge") && el("proxIbge").value) || 0) || 0;
      var nome = String((el("proxMunicipio") && el("proxMunicipio").value) || "").trim();
      var raio = Number((el("proxRaio") && el("proxRaio").value) || 250) || 250;
      var cobertura = String((el("proxCobertura") && el("proxCobertura").value) || "");
      var q = String((el("proxKeywords") && el("proxKeywords").value) || "").trim();
      var janela = (el("proxJanela") && el("proxJanela").value) || "ano";
      var ampliar = !!(el("proxAmpliar") && el("proxAmpliar").checked);
      var leiloes = !el("proxLeiloes") || !!(el("proxLeiloes") && el("proxLeiloes").checked);
      var federal = !!(el("proxFederal") && el("proxFederal").checked);
      if(raio < 10) raio = 10;
      if(raio > 700) raio = 700;

      function saveWatch(m){
        var munNome = (m && (m.nome || m.n)) || nome.split("/")[0].trim() || "Município";
        var uf = (m && (m.uf || m.u)) || "";
        var code = Number((m && (m.ibge || m.i)) || ibge) || 0;
        if(!code) throw new Error("Escolha o município de origem na lista (IBGE).");
        var label =
          munNome +
          (uf ? "/" + uf : "") +
          " · " +
          raio +
          " km" +
          (cobertura === "pr-sp" ? " · PR+SP" : "") +
          (q ? " · " + q : "");
        return self.upsertWatch({
          tipo: "proximos",
          ibge: code,
          municipio: munNome,
          uf: uf,
          raio: raio,
          cobertura: cobertura,
          q: q,
          janela: janela === "45" ? "45" : "ano",
          ampliar: ampliar,
          leiloes: leiloes,
          federal: federal,
          label: label
        }, { baseline: true });
      }

      if(ibge){
        var saved = null;
        try{ saved = LICSYSTEM.captacao.loadOrigem && LICSYSTEM.captacao.loadOrigem(); }catch(e){}
        return Promise.resolve(saveWatch({
          ibge: ibge,
          nome: (saved && saved.nome) || nome.split("/")[0].trim(),
          uf: (saved && saved.uf) || (nome.indexOf("/") >= 0 ? nome.split("/")[1] : "")
        }));
      }
      if(nome.length < 2){
        return Promise.reject(new Error("Informe o município de origem e escolha na lista antes de ativar o alerta."));
      }
      return LICSYSTEM.captacao.resolveMunicipioFromInput().then(function(m){
        if(!m || !m.ibge){
          throw new Error("Não deu para confirmar o município. Clique na sugestão da lista e tente de novo.");
        }
        try{ LICSYSTEM.captacao.selectMunicipio(m); }catch(e){}
        return saveWatch(m);
      });
    },
    startPolling: function(){
      var self = this;
      this.stopPolling();
      this._timer = setInterval(function(){
        if(document.hidden) return;
        self.checkAll().catch(function(){});
      }, this.CHECK_MS);
    },
    stopPolling: function(){
      if(this._timer){
        clearInterval(this._timer);
        this._timer = null;
      }
    },
    onLogin: function(){
      this.load();
      this.startPolling();
      var self = this;
      var missing = this.alertsMissingPrazo();
      var delay = missing ? 1500 : 8000;
      setTimeout(function(){
        self.checkAll().catch(function(){});
      }, delay);
    },
    onLogout: function(){
      this.stopPolling();
      this.setPanelOpen(false);
    },
    wire: function(){
      if(this._wired) return;
      this._wired = true;
      var self = this;
      try{
        var card = el("cardAlertasPncp");
        if(card && LICSYSTEM.captacao && LICSYSTEM.captacao.applyCardCollapse){
          var stored = false;
          try{
            var map = JSON.parse(localStorage.getItem(LICSYSTEM.captacao.COLLAPSE_KEY) || "{}");
            stored = !!(map && map["alertas-pncp"]);
          }catch(e){}
          LICSYSTEM.captacao.applyCardCollapse(card, stored, { skipPersist: true });
          self.updateCollapseSummary();
          var btnCollapse = el("btnCollapseAlertas");
          if(btnCollapse && !btnCollapse._collapseWired){
            btnCollapse._collapseWired = true;
            btnCollapse.addEventListener("click", function(){
              LICSYSTEM.captacao.applyCardCollapse(
                card,
                !card.classList.contains("is-collapsed")
              );
              self.updateCollapseSummary();
            });
          }
        }
      }catch(e){}
      var bell = el("bell");
      if(bell){
        bell.addEventListener("click", function(e){
          e.stopPropagation();
          self.togglePanel();
        });
      }
      document.addEventListener("click", function(e){
        var wrap = el("bellWrap");
        if(!wrap || !self._panelOpen) return;
        if(!wrap.contains(e.target)) self.setPanelOpen(false);
      });
      var list = el("bellPanelList");
      if(list){
        list.addEventListener("click", function(e){
          var item = e.target.closest("[data-alert-id]");
          if(item) self.markRead(item.getAttribute("data-alert-id"));
        });
      }
      var watchesBox = el("alertasWatchList");
      if(watchesBox){
        watchesBox.addEventListener("click", function(e){
          var t = e.target.closest("[data-watch-toggle]");
          if(t){ self.toggleWatch(t.getAttribute("data-watch-toggle")); return; }
          var d = e.target.closest("[data-watch-del]");
          if(d){
            if(confirm("Excluir este alerta?")) self.removeWatch(d.getAttribute("data-watch-del"));
          }
        });
      }
      var editaisBox = el("alertasEditaisList");
      if(editaisBox){
        editaisBox.addEventListener("click", function(e){
          var interesse = e.target.closest("[data-alert-interesse]");
          if(interesse){
            e.preventDefault();
            self.markInteresse(interesse.getAttribute("data-alert-interesse"));
            return;
          }
          var dismiss = e.target.closest("[data-alert-dismiss]");
          if(dismiss){
            e.preventDefault();
            var did = dismiss.getAttribute("data-alert-dismiss");
            if(confirm("Não há interesse neste edital? Ele será excluído dos alertas.")){
              self.dismissAlert(did);
            }
            return;
          }
          var item = e.target.closest("[data-alert-id]");
          if(item && !e.target.closest("a,button")){
            self.markRead(item.getAttribute("data-alert-id"));
          }
        });
      }
      var iaPending = el("iaPendingEditais");
      if(iaPending){
        iaPending.addEventListener("click", function(e){
          function findInteressado(id){
            for(var i = 0; i < self.interessados.length; i++){
              if(self.interessados[i].id === id) return self.interessados[i];
            }
            return null;
          }
          var an = e.target.closest("[data-interessado-analisar]");
          if(an){
            e.preventDefault();
            var ed = findInteressado(an.getAttribute("data-interessado-analisar"));
            if(ed && LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.analisarDeInteresse){
              LICSYSTEM.analiseIa.analisarDeInteresse(ed);
            }
            return;
          }
          var pdfBtn = e.target.closest("[data-interessado-pdf]");
          if(pdfBtn){
            e.preventDefault();
            var edPdf = findInteressado(pdfBtn.getAttribute("data-interessado-pdf"));
            if(edPdf && LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.baixarPdfDeInteresse){
              LICSYSTEM.analiseIa.baixarPdfDeInteresse(edPdf);
            }
            return;
          }
          var rm = e.target.closest("[data-interessado-rm]");
          if(rm){
            e.preventDefault();
            self.removeInteressado(rm.getAttribute("data-interessado-rm"));
          }
        });
      }
      function runCheck(){
        self.checkAll().then(function(r){
          var msg;
          if(r && r.added){
            msg = r.added + " edital(is) novo(s) — veja os balões em Meus alertas.";
          } else if(r && r.enriched){
            msg = "Prazos atualizados em " + r.enriched + " edital(is).";
          } else {
            msg = "Verificação concluída. Nenhum edital novo.";
          }
          showAlert("pncpAlert", (r && (r.added || r.enriched)) ? "ok" : "info", msg);
        }).catch(function(err){
          showAlert("pncpAlert", "error", (err && err.message) || "Falha ao verificar alertas");
        });
      }
      var btnCheck = el("btnAlertasCheckNow");
      if(btnCheck) btnCheck.addEventListener("click", runCheck);
      var btnBellCheck = el("btnBellCheck");
      if(btnBellCheck) btnBellCheck.addEventListener("click", function(e){ e.stopPropagation(); runCheck(); });
      var btnMark = el("btnBellMarkAll");
      if(btnMark) btnMark.addEventListener("click", function(e){ e.stopPropagation(); self.markAllRead(); });
      var btnRadar = el("btnPncpAlerta");
      if(btnRadar){
        btnRadar.addEventListener("click", function(){
          try{
            self.createFromRadar().then(function(){
              showAlert("pncpAlert", "ok", "Alerta ativado! Os editais atuais foram registrados como base; o sino avisará só os novos.");
            }).catch(function(err){
              showAlert("pncpAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
            });
          }catch(err){
            showAlert("pncpAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
          }
        });
      }
      var btnChat = el("btnChatAlerta");
      if(btnChat){
        btnChat.addEventListener("click", function(){
          try{
            self.createFromChat().then(function(){
              showAlert("chatEditalAlert", "ok", "Alerta ativado! O sino avisará quando surgir edital novo para essa busca.");
            }).catch(function(err){
              showAlert("chatEditalAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
            });
          }catch(err){
            showAlert("chatEditalAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
          }
        });
      }
      var btnProx = el("btnProxAlerta");
      if(btnProx){
        btnProx.addEventListener("click", function(){
          btnProx.disabled = true;
          self.createFromProximos().then(function(w){
            showAlert(
              "proxAlert",
              "ok",
              "Alerta de vizinhos ativado" +
                (w && w.label ? " (“" + utils.escapeHtml(w.label) + "”)" : "") +
                ". Os editais atuais viraram base; o sino avisará só os novos no raio."
            );
          }).catch(function(err){
            showAlert("proxAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
          }).then(function(){
            btnProx.disabled = false;
          });
        });
      }
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
