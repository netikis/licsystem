/* LICSYSTEM — DASHBOARD (05-dashboard.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }

  /* ============================ DASHBOARD ============================ */
  LICSYSTEM.dashboard = {
    _charts:{},
    renderKpis:function(){
      var m = LICSYSTEM.state.dashboardMetrics;
      var grid = el("kpiGrid");
      if(!grid) return;
      grid.innerHTML =
        kpi("Volume Financeiro Disputado", utils.formatBrl(m.volumeDisputado), "Acumulado no período", false) +
        kpi("Pregões Ganhos", m.ganhos, "Homologados a favor do LICSYSTEM", true) +
        kpi("Pregões Perdidos", m.perdidos, "Não vencidos", true) +
        kpi("Em Análise", m.emAnalise, "Aguardando decisão", true);
      function kpi(label,val,sub,alt){
        return '<div class="kpi-card'+(alt?' alt':'')+'">'+
          '<div class="k-label">'+utils.escapeHtml(label)+'</div>'+
          '<div class="k-value">'+utils.escapeHtml(val)+'</div>'+
          '<div class="k-sub">'+utils.escapeHtml(sub)+'</div></div>';
      }
    },
    initCharts:function(){
      utils.ensureChart().then(function(){
        var m = LICSYSTEM.state.dashboardMetrics;
        var dEl = el("chartDoughnut"), bEl = el("chartBar");
        if(dEl){
          if(LICSYSTEM.dashboard._charts.d) LICSYSTEM.dashboard._charts.d.destroy();
          LICSYSTEM.dashboard._charts.d = new Chart(dEl.getContext("2d"),{
            type:"doughnut",
            data:{ labels:["Ganhos","Perdidos","Em Análise"],
              datasets:[{ data:[m.ganhos,m.perdidos,m.emAnalise],
                backgroundColor:["#1e9e5a","#d23b3b","#c9a227"], borderWidth:0 }]},
            options:{ responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ position:"bottom" } }, cutout:"62%" }
          });
        }
        if(bEl){
          if(LICSYSTEM.dashboard._charts.b) LICSYSTEM.dashboard._charts.b.destroy();
          var labels = lastMonths(6);
          LICSYSTEM.dashboard._charts.b = new Chart(bEl.getContext("2d"),{
            type:"bar",
            data:{ labels:labels,
              datasets:[{ label:"R$ mil", data:m.volumeMensal,
                backgroundColor:"#152642", borderRadius:6 }]},
            options:{ responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ display:false } },
              scales:{ y:{ beginAtZero:true } } }
          });
        }
      }).catch(function(){ /* chart cdn failed — silent */ });
      function lastMonths(n){
        var names=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        var out=[], d=new Date();
        for(var i=n-1;i>=0;i--){ var dd=new Date(d.getFullYear(),d.getMonth()-i,1); out.push(names[dd.getMonth()]); }
        return out;
      }
    },
    renderPncp:function(){
      var box = el("dashPncpList");
      if(!box) return;
      var arr = (LICSYSTEM.alertas && LICSYSTEM.alertas.alerts && LICSYSTEM.alertas.alerts.length)
        ? LICSYSTEM.alertas.sortByPrazo(LICSYSTEM.alertas.alerts)
        : (LICSYSTEM.state.pncpAlerts || []);
      if(!arr.length){
        box.innerHTML='<span class="muted">Nenhum alerta ainda. Ative um monitoramento em <b>Pesquisas de Editais</b> (botão “Ativar alerta”).</span>';
        return;
      }
      var html='<div style="display:flex;flex-direction:column;gap:8px">';
      arr.slice(0,10).forEach(function(o){
        var title = o.link
          ? '<a href="'+utils.escapeHtml(o.link)+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><b>'+utils.escapeHtml(o.orgao||"Órgão")+'</b></a>'
          : '<b>'+utils.escapeHtml(o.orgao||"Órgão")+'</b>';
        var prazo = (LICSYSTEM.alertas && LICSYSTEM.alertas.formatPrazo)
          ? LICSYSTEM.alertas.formatPrazo(o.dataEncerramento)
          : "—";
        html+='<div style="padding:10px 12px;border:1px solid var(--ls-line);border-radius:10px'+(o.readAt?'':';background:#fffbeb')+'">'+
          title+' <span class="badge-status b-yellow">'+utils.escapeHtml(o.uf||"")+'</span>'+
          (o.watchLabel ? ' <span class="small muted">· '+utils.escapeHtml(o.watchLabel)+'</span>' : '')+'<br/>'+
          '<span class="small muted">'+utils.escapeHtml((o.objeto||"").slice(0,180))+'</span><br/>'+
          '<span class="small" style="font-weight:700;color:var(--ls-navy)">Prazo: '+utils.escapeHtml(prazo)+'</span></div>';
      });
      html+='</div>';
      box.innerHTML=html;
    },
    render:function(){ this.renderKpis(); this.initCharts(); this.renderPncp(); }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
