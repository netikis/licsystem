/* LICSYSTEM — ALERTAS PNCP / UI */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

  LICSYSTEM.alertas = Object.assign(LICSYSTEM.alertas || {}, {
    updateBell: function(){
      var badge = el("bellBadge");
      if(!badge) return;
      var n = this.unreadCount();
      badge.textContent = String(n);
      badge.classList.toggle("zero", n === 0);
      var sub = el("bellPanelSub");
      if(sub){
        var ativo = this.watches.filter(function(w){ return w.enabled !== false; }).length;
        sub.textContent = ativo
          ? (n + " novo(s) · " + ativo + " monitoramento(s) ativo(s)")
          : "Nenhum monitoramento ativo";
      }
    },
    setPanelOpen: function(open){
      this._panelOpen = !!open;
      var panel = el("bellPanel");
      var bell = el("bell");
      if(panel) panel.hidden = !this._panelOpen;
      if(bell) bell.setAttribute("aria-expanded", this._panelOpen ? "true" : "false");
      if(this._panelOpen) this.renderPanelList();
    },
    togglePanel: function(){
      this.setPanelOpen(!this._panelOpen);
    },
    renderPanelList: function(){
      var box = el("bellPanelList");
      if(!box) return;
      if(!this.alerts.length){
        box.innerHTML = '<div class="small muted">Nenhum alerta ainda. Ative um monitoramento em <b>Pesquisas de Editais</b>.</div>';
        return;
      }
      var sorted = this.sortByPrazo(this.alerts);
      var html = "";
      var self = this;
      sorted.slice(0, 40).forEach(function(a){
        var unread = !a.readAt;
        var title = a.link
          ? '<a href="'+utils.escapeHtml(a.link)+'" target="_blank" rel="noopener">'+utils.escapeHtml(a.orgao || "Órgão")+'</a>'
          : '<b>'+utils.escapeHtml(a.orgao || "Órgão")+'</b>';
        html += '<div class="bell-item'+(unread?' is-unread':'')+'" data-alert-id="'+utils.escapeHtml(a.id)+'">'+
          title+
          ' <span class="badge-status b-yellow">'+utils.escapeHtml(a.uf || "")+'</span>'+
          (a.watchLabel ? ' <span class="small muted">· '+utils.escapeHtml(a.watchLabel)+'</span>' : '')+
          '<div class="small muted" style="margin-top:4px">'+utils.escapeHtml((a.objeto || "").slice(0, 160))+'</div>'+
          '<div class="small" style="margin-top:4px;font-weight:700;color:var(--ls-navy)">Prazo: '+utils.escapeHtml(self.formatPrazo(a.dataEncerramento))+'</div>'+
          (a.municipio ? '<div class="small muted">'+utils.escapeHtml(a.municipio)+'</div>' : '')+
          '</div>';
      });
      box.innerHTML = html;
    },
    prazoTs: function(iso){
      if(!iso) return Number.POSITIVE_INFINITY;
      var t = new Date(iso).getTime();
      return isNaN(t) ? Number.POSITIVE_INFINITY : t;
    },
    formatPrazo: function(iso){
      try{
        if(LICSYSTEM.captacao && LICSYSTEM.captacao.formatProxDate){
          return LICSYSTEM.captacao.formatProxDate(iso);
        }
      }catch(e){}
      if(!iso) return "—";
      try{
        var d = new Date(iso);
        if(isNaN(d.getTime())) return String(iso);
        return d.toLocaleString("pt-BR", {
          day: "2-digit", month: "2-digit", year: "numeric",
          hour: "2-digit", minute: "2-digit"
        });
      }catch(e){ return String(iso); }
    },
    sortByPrazo: function(list){
      var self = this;
      return (list || []).slice().sort(function(a, b){
        var da = self.prazoTs(a && a.dataEncerramento);
        var db = self.prazoTs(b && b.dataEncerramento);
        if(da !== db) return da - db;
        return Number((b && b.foundAt) || 0) - Number((a && a.foundAt) || 0);
      });
    },
    isPrazoUrgente: function(iso){
      var t = this.prazoTs(iso);
      if(!isFinite(t)) return false;
      var diff = t - Date.now();
      return diff >= 0 && diff <= 3 * 24 * 60 * 60 * 1000;
    },
    balloonHtml: function(a, opts){
      opts = opts || {};
      var self = this;
      var unread = !a.readAt;
      var urgente = self.isPrazoUrgente(a.dataEncerramento);
      var nome = a.orgao || "Órgão";
      var nomeHtml = a.link
        ? '<a href="'+utils.escapeHtml(a.link)+'" target="_blank" rel="noopener">'+utils.escapeHtml(nome)+'</a>'
        : utils.escapeHtml(nome);
      var editalLabel = a.numeroCompra
        ? ("Nº " + a.numeroCompra)
        : (a.numeroControlePNCP || a.modalidade || "Edital PNCP");
      var meta = [];
      if(a.municipio) meta.push(a.municipio);
      if(a.uf) meta.push(a.uf);
      if(a.watchLabel) meta.push(a.watchLabel);
      var actions = "";
      if(opts.mode === "interessado"){
        actions =
          '<div class="alerta-balloon-actions">'+
            '<button type="button" class="btn btn-gold btn-sm" data-interessado-analisar="'+utils.escapeHtml(a.id)+'">✨ Analisar com IA</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" data-interessado-pdf="'+utils.escapeHtml(a.id)+'"'+(a.link ? "" : " disabled title=\"Sem link PNCP\"")+'>Baixar PDF</button>'+
            (a.link
              ? '<a class="btn btn-ghost btn-sm" href="'+utils.escapeHtml(a.link)+'" target="_blank" rel="noopener">Abrir no PNCP</a>'
              : '')+
            '<button type="button" class="btn btn-ghost btn-sm" data-interessado-rm="'+utils.escapeHtml(a.id)+'">Remover</button>'+
          '</div>';
      } else {
        actions =
          '<div class="alerta-balloon-actions">'+
            '<button type="button" class="btn btn-gold btn-sm" data-alert-interesse="'+utils.escapeHtml(a.id)+'">Há interesse</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" data-alert-dismiss="'+utils.escapeHtml(a.id)+'">Não há interesse</button>'+
          '</div>';
      }
      return (
        '<div class="alerta-balloon'+(unread && opts.mode !== "interessado" ? " is-unread" : "")+(urgente ? " is-urgente" : "")+'" data-alert-id="'+utils.escapeHtml(a.id)+'">'+
          '<div class="alerta-balloon-prazo">'+(urgente ? "Prazo próximo · " : "Prazo · ")+utils.escapeHtml(self.formatPrazo(a.dataEncerramento))+'</div>'+
          '<div class="alerta-balloon-nome">'+nomeHtml+'</div>'+
          (meta.length ? '<div class="alerta-balloon-meta">'+utils.escapeHtml(meta.join(" · "))+'</div>' : '')+
          '<div class="alerta-balloon-edital"><b>Edital:</b> '+utils.escapeHtml(editalLabel)+
            (a.objeto ? ' — '+utils.escapeHtml(a.objeto) : '')+
          '</div>'+
          '<div class="alerta-balloon-prazo-line"><span class="label">Prazo</span> '+utils.escapeHtml(self.formatPrazo(a.dataEncerramento))+'</div>'+
          actions+
        '</div>'
      );
    },
    renderEditaisBalloons: function(){
      var box = el("alertasEditaisList");
      if(!box) return;
      if(!this.alerts.length){
        box.innerHTML = '<div class="small muted">Nenhum edital novo ainda. Quando o monitoramento achar algo, aparece aqui em balões.</div>';
        this.updateCollapseSummary();
        return;
      }
      var sorted = this.sortByPrazo(this.alerts);
      var html = "";
      var self = this;
      sorted.forEach(function(a){
        html += self.balloonHtml(a, { mode: "alerta" });
      });
      box.innerHTML = html;
      this.updateCollapseSummary();
    },
    updateCollapseSummary: function(){
      var nWatch = this.watches.length;
      var nEditais = this.alerts.length;
      var parts = [];
      if(nWatch) parts.push(nWatch + " monitoramento" + (nWatch === 1 ? "" : "s"));
      if(nEditais) parts.push(nEditais + " edital" + (nEditais === 1 ? "" : "is"));
      var text = parts.length ? parts.join(" · ") : "Nenhum alerta ativo";
      try{
        if(LICSYSTEM.captacao && LICSYSTEM.captacao.updateCollapseSummary){
          LICSYSTEM.captacao.updateCollapseSummary("alertas", text);
        }
      }catch(e){}
    },
    renderInteressadosIa: function(){
      var wrap = el("iaPendingEditaisWrap");
      var box = el("iaPendingEditais");
      if(!box) return;
      if(!this.interessados.length){
        if(wrap) wrap.hidden = true;
        box.innerHTML = "";
        return;
      }
      if(wrap) wrap.hidden = false;
      var sorted = this.sortByPrazo(this.interessados);
      var html = "";
      var self = this;
      sorted.forEach(function(a){
        html += self.balloonHtml(a, { mode: "interessado" });
      });
      box.innerHTML = html;
    },
    renderWatches: function(){
      var box = el("alertasWatchList");
      if(!box) return;
      if(!this.watches.length){
        box.innerHTML = '<div class="small muted">Nenhum alerta ativo. Use “Ativar alerta” em Editais próximos (recomendado), Radar ou Perguntar editais.</div>';
        this.updateCollapseSummary();
        return;
      }
      var html = "";
      this.watches.forEach(function(w){
        var off = w.enabled === false;
        var tipoLabel =
          w.tipo === "radar" ? "Radar" :
          (w.tipo === "proximos" || w.tipo === "raio" || w.tipo === "vizinhos") ? ("Próximos · " + (w.raio || 250) + " km") :
          "Município";
        html += '<div class="alerta-watch-row'+(off?' off':'')+'" data-watch-id="'+utils.escapeHtml(w.id)+'">'+
          '<div>'+
            '<div style="font-weight:700;color:var(--ls-navy)">'+utils.escapeHtml(w.label || w.id)+'</div>'+
            '<div class="alerta-watch-meta small muted">'+
              '<span>'+utils.escapeHtml(tipoLabel)+'</span>'+
              (w.lastCheckedAt ? '<span>· última verificação '+utils.escapeHtml(new Date(w.lastCheckedAt).toLocaleString("pt-BR"))+'</span>' : '<span>· ainda não verificado</span>')+
              (off ? '<span>· pausado</span>' : '')+
            '</div>'+
          '</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
            '<button type="button" class="btn btn-ghost btn-sm" data-watch-toggle="'+utils.escapeHtml(w.id)+'">'+(off?'Ativar':'Pausar')+'</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" data-watch-del="'+utils.escapeHtml(w.id)+'">Excluir</button>'+
          '</div>'+
        '</div>';
      });
      box.innerHTML = html;
      this.updateCollapseSummary();
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
