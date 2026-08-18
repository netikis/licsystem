/* LICSYSTEM — ALERTAS PNCP / DADOS */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var PNCP_WATCHES_KEY = ctx.PNCP_WATCHES_KEY;
  var PNCP_ALERTS_KEY = ctx.PNCP_ALERTS_KEY;
  var PNCP_INTERESSADOS_KEY = ctx.PNCP_INTERESSADOS_KEY;

  LICSYSTEM.alertas = Object.assign(LICSYSTEM.alertas || {}, {
    CHECK_MS: 15 * 60 * 1000,
    MAX_WATCHES: 12,
    MAX_ALERTS: 200,
    MAX_SEEN: 400,
    MAX_INTERESSADOS: 40,
    watches: [],
    alerts: [],
    interessados: [],
    _timer: null,
    _busy: false,
    _wired: false,
    _panelOpen: false,
    load: function(){
      try{
        var w = JSON.parse(localStorage.getItem(PNCP_WATCHES_KEY) || "[]");
        this.watches = Array.isArray(w) ? w.map(function(x){ return LICSYSTEM.alertas.normalizeWatch(x); }) : [];
      }catch(e){ this.watches = []; }
      try{
        var a = JSON.parse(localStorage.getItem(PNCP_ALERTS_KEY) || "[]");
        this.alerts = Array.isArray(a) ? a.map(function(x){ return LICSYSTEM.alertas.normalizeAlert(x); }) : [];
      }catch(e){ this.alerts = []; }
      try{
        var i = JSON.parse(localStorage.getItem(PNCP_INTERESSADOS_KEY) || "[]");
        this.interessados = Array.isArray(i) ? i.map(function(x){ return LICSYSTEM.alertas.normalizeAlert(x); }) : [];
      }catch(e){ this.interessados = []; }
      LICSYSTEM.state.pncpAlerts = this.alerts.filter(function(x){ return !x.readAt; });
      this.updateBell();
      this.renderWatches();
      this.renderEditaisBalloons();
      this.renderInteressadosIa();
      this.renderPanelList();
      try{ LICSYSTEM.dashboard.renderPncp(); }catch(e){}
      /* Alertas antigos sem prazo: busca de novo no PNCP e preenche as datas */
      if(this.alertsMissingPrazo() > 0 && this.watches.some(function(w){ return w.enabled !== false; })){
        var self = this;
        if(!this._prazoBackfillScheduled){
          this._prazoBackfillScheduled = true;
          setTimeout(function(){
            self.checkAll().catch(function(){}).then(function(){
              self._prazoBackfillScheduled = false;
            }, function(){
              self._prazoBackfillScheduled = false;
            });
          }, 1200);
        }
      }
    },
    normalizeWatch: function(raw){
      raw = raw || {};
      var seen = raw.seenIds && typeof raw.seenIds === "object" ? raw.seenIds : {};
      var raio = Number(raw.raio || 0) || 0;
      if(raio && raio < 10) raio = 10;
      if(raio > 700) raio = 700;
      return {
        id: String(raw.id || ("w_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7))),
        tipo: String(raw.tipo || "municipio"),
        label: String(raw.label || "").slice(0, 160),
        q: String(raw.q || raw.keywords || "").slice(0, 200),
        uf: String(raw.uf || "").trim().toUpperCase().slice(0, 2),
        municipio: String(raw.municipio || "").slice(0, 120),
        ibge: Number(raw.ibge || 0) || 0,
        raio: raio || 0,
        cobertura: String(raw.cobertura || "").slice(0, 20),
        federal: !!raw.federal,
        regiao: String(raw.regiao || "").slice(0, 60),
        mensagem: String(raw.mensagem || "").slice(0, 200),
        categoria: String(raw.categoria || "").slice(0, 80),
        leiloes: raw.leiloes !== false,
        ampliar: !!raw.ampliar,
        janela: raw.janela === "ano" ? "ano" : "45",
        enabled: raw.enabled !== false,
        createdAt: Number(raw.createdAt || Date.now()),
        lastCheckedAt: Number(raw.lastCheckedAt || 0) || 0,
        seenIds: seen
      };
    },
    normalizeAlert: function(raw){
      raw = raw || {};
      var key = String(raw.key || raw.numeroControlePNCP || raw.id || "");
      return {
        id: String(raw.id || key || ("a_" + Date.now())),
        key: key,
        numeroControlePNCP: raw.numeroControlePNCP || null,
        numeroCompra: raw.numeroCompra != null ? String(raw.numeroCompra).slice(0, 80) : null,
        orgao: String(raw.orgao || "").slice(0, 200),
        municipio: String(raw.municipio || "").slice(0, 120),
        uf: String(raw.uf || "").slice(0, 2),
        objeto: String(raw.objeto || "").slice(0, 500),
        modalidade: String(raw.modalidade || "").slice(0, 80),
        valorEstimado: raw.valorEstimado != null ? Number(raw.valorEstimado) : null,
        dataAbertura: LICSYSTEM.alertas.pickDataAbertura(raw),
        dataEncerramento: LICSYSTEM.alertas.pickDataPrazo(raw),
        link: raw.link || null,
        watchId: String(raw.watchId || ""),
        watchLabel: String(raw.watchLabel || "").slice(0, 160),
        foundAt: Number(raw.foundAt || Date.now()),
        readAt: raw.readAt != null ? Number(raw.readAt) || null : null,
        interessadoAt: raw.interessadoAt != null ? Number(raw.interessadoAt) || null : null
      };
    },
    pickDataPrazo: function(raw){
      if(!raw || typeof raw !== "object") return null;
      var v =
        raw.dataEncerramento ||
        raw.dataEncerramentoProposta ||
        raw.dataEncerramentoPropostas ||
        raw.dataFinalProposta ||
        raw.dataFimProposta ||
        raw.dataLimiteProposta ||
        null;
      if(v == null || v === "") return null;
      return String(v);
    },
    pickDataAbertura: function(raw){
      if(!raw || typeof raw !== "object") return null;
      var v = raw.dataAbertura || raw.dataAberturaProposta || null;
      if(v == null || v === "") return null;
      return String(v);
    },
    enrichAlertsFromRows: function(rows){
      if(!rows || !rows.length) return 0;
      var byKey = Object.create(null);
      for(var i = 0; i < rows.length; i++){
        var row = rows[i] || {};
        var key = this.editalKey(row);
        if(key) byKey[key] = row;
        if(row.numeroControlePNCP) byKey[String(row.numeroControlePNCP)] = row;
      }
      var updated = 0;
      for(var j = 0; j < this.alerts.length; j++){
        var a = this.alerts[j];
        var src = byKey[a.key] || byKey[a.id] || (a.numeroControlePNCP ? byKey[String(a.numeroControlePNCP)] : null);
        if(!src) continue;
        var changed = false;
        var prazo = this.pickDataPrazo(src);
        var abertura = this.pickDataAbertura(src);
        if(prazo && String(a.dataEncerramento || "") !== String(prazo)){
          a.dataEncerramento = prazo;
          changed = true;
        }
        if(abertura && !a.dataAbertura){
          a.dataAbertura = abertura;
          changed = true;
        }
        if(src.link && !a.link){ a.link = src.link; changed = true; }
        if(src.numeroCompra != null && !a.numeroCompra){
          a.numeroCompra = String(src.numeroCompra).slice(0, 80);
          changed = true;
        }
        if(src.modalidade && !a.modalidade){
          a.modalidade = String(src.modalidade).slice(0, 80);
          changed = true;
        }
        if(src.valorEstimado != null && a.valorEstimado == null){
          a.valorEstimado = Number(src.valorEstimado);
          changed = true;
        }
        if(changed) updated++;
      }
      return updated;
    },
    alertsMissingPrazo: function(){
      var n = 0;
      for(var i = 0; i < this.alerts.length; i++){
        if(!this.alerts[i].dataEncerramento) n++;
      }
      return n;
    },
    applyWatches: function(arr, opts){
      opts = opts || {};
      this.watches = (Array.isArray(arr) ? arr : []).map(function(x){
        return LICSYSTEM.alertas.normalizeWatch(x);
      });
      if(!opts.skipPersist){
        try{ localStorage.setItem(PNCP_WATCHES_KEY, JSON.stringify(this.watches)); }catch(e){}
      }
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpWatches", { immediate: !!opts.immediate });
      }
      this.renderWatches();
    },
    applyAlerts: function(arr, opts){
      opts = opts || {};
      this.alerts = (Array.isArray(arr) ? arr : []).map(function(x){
        return LICSYSTEM.alertas.normalizeAlert(x);
      });
      if(!opts.skipPersist){
        try{ localStorage.setItem(PNCP_ALERTS_KEY, JSON.stringify(this.alerts)); }catch(e){}
      }
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpAlerts", { immediate: !!opts.immediate });
      }
      LICSYSTEM.state.pncpAlerts = this.alerts.filter(function(x){ return !x.readAt; });
      this.updateBell();
      this.renderEditaisBalloons();
      this.renderPanelList();
      try{ LICSYSTEM.dashboard.renderPncp(); }catch(e){}
    },
    persistWatches: function(opts){
      opts = opts || {};
      try{ localStorage.setItem(PNCP_WATCHES_KEY, JSON.stringify(this.watches)); }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpWatches", { immediate: !!opts.immediate });
      }
      this.renderWatches();
    },
    persistAlerts: function(opts){
      opts = opts || {};
      try{ localStorage.setItem(PNCP_ALERTS_KEY, JSON.stringify(this.alerts)); }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpAlerts", { immediate: !!opts.immediate });
      }
      LICSYSTEM.state.pncpAlerts = this.alerts.filter(function(x){ return !x.readAt; });
      this.updateBell();
      this.renderEditaisBalloons();
      this.renderPanelList();
      try{ LICSYSTEM.dashboard.renderPncp(); }catch(e){}
    },
    persistInteressados: function(){
      try{ localStorage.setItem(PNCP_INTERESSADOS_KEY, JSON.stringify(this.interessados)); }catch(e){}
      this.renderInteressadosIa();
    },
    editalKey: function(o){
      if(!o) return "";
      if(o.key) return String(o.key);
      if(o.numeroControlePNCP) return String(o.numeroControlePNCP);
      return [o.orgao || "", o.objeto || "", o.dataAbertura || "", o.uf || ""].join("|");
    },
    unreadCount: function(){
      var n = 0;
      for(var i = 0; i < this.alerts.length; i++){
        if(!this.alerts[i].readAt) n++;
      }
      return n;
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
