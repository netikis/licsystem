/* LICSYSTEM — CRONOGRAMA DE LICITAÇÕES */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }

  var STORAGE_KEY = ctx.STATUS_LICITACOES_KEY || "licsystem_status_licitacoes_v1";
  var STATUS_OPTS = [
    { id: "", label: "—" },
    { id: "habilitado", label: "HABILITADO" },
    { id: "adjudicacao", label: "ADJUDICAÇÃO" },
    { id: "homologado", label: "HOMOLOGADO" },
    { id: "julgamento", label: "JULGAMENTO" }
  ];

  function uid(){
    return "sl_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function todayIso(){
    var d = new Date();
    var m = ("0" + (d.getMonth() + 1)).slice(-2);
    var day = ("0" + d.getDate()).slice(-2);
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function fold(s){
    if(utils && typeof utils.fold === "function") return String(utils.fold(s) || "");
    return String(s || "");
  }

  function esc(s){
    if(utils && typeof utils.escapeHtml === "function") return utils.escapeHtml(s);
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function normFlag(v){
    v = String(v || "").toLowerCase();
    if(v === "ok" || v === "yes" || v === "sim" || v === "1") return "ok";
    if(v === "no" || v === "nao" || v === "nok" || v === "0") return "no";
    return "";
  }

  function normStatus(v){
    var f = fold(v).toLowerCase();
    if(f.indexOf("habilit") >= 0) return "habilitado";
    if(f.indexOf("adjudic") >= 0) return "adjudicacao";
    if(f.indexOf("homolog") >= 0) return "homologado";
    if(f.indexOf("julg") >= 0) return "julgamento";
    return "";
  }

  function markClass(v){
    if(v === "ok") return " is-ok";
    if(v === "no") return " is-no";
    return "";
  }

  function normHora(v){
    var s = String(v || "").trim();
    var m = s.match(/^(\d{1,2}):(\d{2})/);
    if(!m) return "";
    var h = Number(m[1]);
    var min = Number(m[2]);
    if(h < 0 || h > 23 || min < 0 || min > 59) return "";
    return ("0" + h).slice(-2) + ":" + ("0" + min).slice(-2);
  }

  function parseMoney(v){
    if(typeof v === "number") return isFinite(v) && v > 0 ? v : 0;
    var s = String(v || "").trim();
    if(!s) return 0;
    s = s.replace(/[^\d,.\-]/g, "");
    if(!s) return 0;
    if(s.indexOf(",") >= 0){
      s = s.replace(/\./g, "").replace(",", ".");
    }
    var n = Number(s);
    if(!isFinite(n) || n < 0) return 0;
    return Math.round(n * 100) / 100;
  }

  function formatMoneyInput(n){
    n = Number(n) || 0;
    if(!(n > 0)) return "";
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatMoneyTotal(n){
    n = Number(n) || 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function fracHtml(ok, total, title){
    var cls = ok > 0 ? " is-ok" : "";
    return '<span class="sl-foot-frac'+cls+'" title="'+esc(title)+'">'+ok+"/"+total+"</span>";
  }

  function pdfKey(id){
    return "cronograma:" + String(id || "");
  }

  function shortNome(nome){
    var s = String(nome || "").trim();
    if(!s) return "PDF";
    if(s.length <= 22) return s;
    return s.slice(0, 18) + "…";
  }

  function editalCell(it, sid){
    var nome = String(it.editalNome || "").trim();
    if(nome){
      return '<div class="sl-edital is-on">'+
        '<button type="button" class="sl-edital-open" data-sl-pdf-open="'+sid+'" title="Abrir '+esc(nome)+'">📎 '+esc(shortNome(nome))+"</button>"+
        '<button type="button" class="sl-edital-clear" data-sl-pdf-clear="'+sid+'" title="Remover PDF">✕</button>'+
      "</div>";
    }
    return '<div class="sl-edital">'+
      '<button type="button" class="sl-edital-pick" data-sl-pdf-pick="'+sid+'" title="Anexar edital em PDF">📎 PDF</button>'+
    "</div>";
  }

  LICSYSTEM.statusLicitacoes = {
    items: [],
    _loaded: false,
    sortKey: "data",
    sortDir: -1,

    emptyItem: function(){
      return {
        id: uid(),
        data: todayIso(),
        hora: "",
        nome: "",
        municipio: "",
        plataforma: "",
        valor: 0,
        orcada: "",
        cadastrada: "",
        status: "",
        editalNome: "",
        editalSize: 0,
        editalAt: 0
      };
    },

    normalize: function(it){
      it = it || {};
      return {
        id: String(it.id || uid()),
        data: String(it.data || "").slice(0, 10),
        hora: normHora(it.hora),
        nome: String(it.nome || it.licitacao || "").slice(0, 220),
        municipio: String(it.municipio || "").slice(0, 120),
        plataforma: String(it.plataforma || it.portal || "").slice(0, 80),
        valor: parseMoney(it.valor),
        orcada: normFlag(it.orcada),
        cadastrada: normFlag(it.cadastrada),
        status: normStatus(it.status),
        editalNome: String(it.editalNome || "").slice(0, 220),
        editalSize: Number(it.editalSize) > 0 ? Number(it.editalSize) : 0,
        editalAt: Number(it.editalAt) || 0
      };
    },

    load: function(){
      if(LICSYSTEM.statusLicitacoes._loaded) return LICSYSTEM.statusLicitacoes.items;
      try{
        var raw = localStorage.getItem(STORAGE_KEY);
        if(raw != null){
          var saved = JSON.parse(raw);
          var list = [];
          if(Array.isArray(saved)) list = saved;
          else if(saved && typeof saved === "object" && Array.isArray(saved.items)) list = saved.items;
          var out = [];
          for(var i=0;i<list.length;i++) out.push(LICSYSTEM.statusLicitacoes.normalize(list[i]));
          LICSYSTEM.statusLicitacoes.items = out;
        } else {
          LICSYSTEM.statusLicitacoes.items = [];
        }
      }catch(e){
        LICSYSTEM.statusLicitacoes.items = [];
      }
      LICSYSTEM.statusLicitacoes._loaded = true;
      return LICSYSTEM.statusLicitacoes.items;
    },

    saveLocal: function(opts){
      opts = opts || {};
      var now = Date.now();
      var items = LICSYSTEM.statusLicitacoes.items || [];
      var empty = !items.length;
      try{
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          v: 1,
          updatedAt: now,
          cleared: empty,
          items: items
        }));
        if(LICSYSTEM.cloudSync){
          LICSYSTEM.cloudSync.notifyLocalChange("statusLicitacoes", {
            updatedAt: now,
            immediate: opts.immediate !== false,
            forceClear: empty
          });
        }
      }catch(e){}
    },

    applyData: function(list){
      var arr = Array.isArray(list) ? list : [];
      var out = [];
      for(var i=0;i<arr.length;i++) out.push(LICSYSTEM.statusLicitacoes.normalize(arr[i]));
      LICSYSTEM.statusLicitacoes.items = out;
      LICSYSTEM.statusLicitacoes._loaded = true;
    },

    find: function(id){
      LICSYSTEM.statusLicitacoes.load();
      var items = LICSYSTEM.statusLicitacoes.items;
      for(var i=0;i<items.length;i++){
        if(items[i].id === id) return items[i];
      }
      return null;
    },

    sorted: function(){
      LICSYSTEM.statusLicitacoes.load();
      var list = LICSYSTEM.statusLicitacoes.items.slice();
      var key = LICSYSTEM.statusLicitacoes.sortKey || "data";
      var dir = Number(LICSYSTEM.statusLicitacoes.sortDir) || 1;
      list.sort(function(a, b){
        var va;
        var vb;
        if(key === "nome"){
          va = fold(a.nome).toLowerCase();
          vb = fold(b.nome).toLowerCase();
        } else if(key === "municipio"){
          va = fold(a.municipio).toLowerCase();
          vb = fold(b.municipio).toLowerCase();
        } else if(key === "plataforma"){
          va = fold(a.plataforma).toLowerCase();
          vb = fold(b.plataforma).toLowerCase();
        } else if(key === "hora"){
          va = String(a.hora || "");
          vb = String(b.hora || "");
        } else if(key === "valor"){
          va = Number(a.valor) || 0;
          vb = Number(b.valor) || 0;
        } else {
          va = String(a.data || "") + "T" + String(a.hora || "00:00");
          vb = String(b.data || "") + "T" + String(b.hora || "00:00");
        }
        if(va < vb) return -1 * dir;
        if(va > vb) return 1 * dir;
        var na = fold(a.nome).toLowerCase();
        var nb = fold(b.nome).toLowerCase();
        if(na < nb) return -1;
        if(na > nb) return 1;
        return 0;
      });
      return list;
    },

    setSort: function(key){
      if(LICSYSTEM.statusLicitacoes.sortKey === key){
        LICSYSTEM.statusLicitacoes.sortDir = LICSYSTEM.statusLicitacoes.sortDir === 1 ? -1 : 1;
      } else {
        LICSYSTEM.statusLicitacoes.sortKey = key;
        LICSYSTEM.statusLicitacoes.sortDir = (key === "nome" || key === "municipio" || key === "hora" || key === "plataforma") ? 1 : -1;
      }
      LICSYSTEM.statusLicitacoes.renderTabela();
    },

    onEdit: function(id, field, value){
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item) return;
      if(field === "data") item.data = String(value || "").slice(0, 10);
      else if(field === "hora") item.hora = normHora(value);
      else if(field === "nome") item.nome = String(value || "").slice(0, 220);
      else if(field === "municipio") item.municipio = String(value || "").slice(0, 120);
      else if(field === "plataforma") item.plataforma = String(value || "").slice(0, 80);
      else if(field === "valor") item.valor = parseMoney(value);
      else if(field === "status") item.status = normStatus(value);
      LICSYSTEM.statusLicitacoes.saveLocal();
      if(field === "status") LICSYSTEM.statusLicitacoes.renderTabela();
      else if(field === "valor") LICSYSTEM.statusLicitacoes.renderTotais();
    },

    pickEdital: function(id){
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item) return;
      LICSYSTEM.statusLicitacoes._pdfTargetId = id;
      var inp = el("slEditalFile");
      if(!inp) return;
      inp.value = "";
      inp.click();
    },

    onEditalFile: function(file){
      var id = LICSYSTEM.statusLicitacoes._pdfTargetId;
      LICSYSTEM.statusLicitacoes._pdfTargetId = "";
      if(!id || !file) return;
      var nome = String(file.name || "").toLowerCase();
      if(file.type && file.type !== "application/pdf" && nome.slice(-4) !== ".pdf"){
        showAlert("slAlert", "warn", "Anexe um arquivo PDF do edital.");
        return;
      }
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item) return;
      var go = function(rec){
        item.editalNome = String((rec && rec.name) || file.name || "edital.pdf").slice(0, 220);
        item.editalSize = Number((rec && rec.size) || file.size || 0);
        item.editalAt = Date.now();
        LICSYSTEM.statusLicitacoes.saveLocal();
        LICSYSTEM.statusLicitacoes.renderTabela();
        showAlert("slAlert", "ok", "Edital anexado: " + item.editalNome);
      };
      if(LICSYSTEM.editalPdf && typeof LICSYSTEM.editalPdf.save === "function"){
        LICSYSTEM.editalPdf.save(pdfKey(id), file).then(go).catch(function(){ go(null); });
        return;
      }
      go(null);
    },

    formatValorInput: function(inp){
      if(!inp) return;
      inp.value = formatMoneyInput(parseMoney(inp.value));
    },

    openEdital: function(id){
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item || !item.editalNome){
        showAlert("slAlert", "warn", "Nenhum PDF anexado nesta linha.");
        return;
      }
      if(!LICSYSTEM.editalPdf || typeof LICSYSTEM.editalPdf.getFile !== "function"){
        showAlert("slAlert", "warn", "Não foi possível abrir o PDF.");
        return;
      }
      LICSYSTEM.editalPdf.getFile(pdfKey(id)).then(function(f){
        if(!f){
          showAlert("slAlert", "warn", "PDF não encontrado neste aparelho. Anexe o edital de novo.");
          return;
        }
        var url = URL.createObjectURL(f);
        var w = window.open(url, "_blank");
        if(!w){
          var a = document.createElement("a");
          a.href = url;
          a.download = item.editalNome || "edital.pdf";
          a.click();
        }
      }).catch(function(){
        showAlert("slAlert", "warn", "Não foi possível abrir o PDF.");
      });
    },

    clearEdital: function(id){
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item || !item.editalNome) return;
      if(!confirm("Remover o PDF anexado desta licitação?")) return;
      item.editalNome = "";
      item.editalSize = 0;
      item.editalAt = 0;
      if(LICSYSTEM.editalPdf && typeof LICSYSTEM.editalPdf.remove === "function"){
        try{ LICSYSTEM.editalPdf.remove(pdfKey(id)); }catch(e){}
      }
      LICSYSTEM.statusLicitacoes.saveLocal();
      LICSYSTEM.statusLicitacoes.renderTabela();
      showAlert("slAlert", "ok", "PDF removido.");
    },

    setFlag: function(id, field, value){
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item) return;
      if(field !== "orcada" && field !== "cadastrada") return;
      var next = normFlag(value);
      if(item[field] === next) next = "";
      item[field] = next;
      LICSYSTEM.statusLicitacoes.saveLocal();
      LICSYSTEM.statusLicitacoes.renderTabela();
    },

    adicionarVazio: function(){
      LICSYSTEM.statusLicitacoes.load();
      LICSYSTEM.statusLicitacoes.items.unshift(LICSYSTEM.statusLicitacoes.emptyItem());
      LICSYSTEM.statusLicitacoes.saveLocal();
      LICSYSTEM.statusLicitacoes.render();
      showAlert("slAlert", "ok", "Linha adicionada — preencha direto na tabela.");
      var first = document.querySelector("#slBody input[data-sl-f=nome]");
      if(first) first.focus();
    },

    /** Nova linha vinda do PDF do edital (Nova licitação pelo edital). */
    adicionarDoEdital: function(d, file){
      d = d || {};
      LICSYSTEM.statusLicitacoes.load();
      var item = LICSYSTEM.statusLicitacoes.emptyItem();
      item.nome = String(d.numero || "").slice(0, 220);
      item.municipio = String(d.municipio || "").slice(0, 120);
      item.plataforma = String(d.plataforma || "").slice(0, 80);
      if(/^\d{4}-\d{2}-\d{2}$/.test(String(d.data || ""))) item.data = d.data;
      item.hora = normHora(d.hora);
      item.valor = parseMoney(d.valor);
      LICSYSTEM.statusLicitacoes.items.unshift(item);
      var done = function(rec){
        if(file){
          item.editalNome = String((rec && rec.name) || file.name || "edital.pdf").slice(0, 220);
          item.editalSize = Number((rec && rec.size) || file.size || 0);
          item.editalAt = Date.now();
        }
        LICSYSTEM.statusLicitacoes.saveLocal({ immediate: true });
        LICSYSTEM.statusLicitacoes.render();
        return item;
      };
      if(file && LICSYSTEM.editalPdf && typeof LICSYSTEM.editalPdf.save === "function"){
        return LICSYSTEM.editalPdf.save(pdfKey(item.id), file).then(done).catch(function(){ return done(null); });
      }
      return Promise.resolve(done(null));
    },

    remover: function(id){
      if(!id) return;
      if(!confirm("Remover esta licitação da lista de status?")) return;
      LICSYSTEM.statusLicitacoes.load();
      var keep = [];
      var items = LICSYSTEM.statusLicitacoes.items;
      for(var i=0;i<items.length;i++){
        if(items[i].id !== id) keep.push(items[i]);
        else if(LICSYSTEM.editalPdf && typeof LICSYSTEM.editalPdf.remove === "function"){
          try{ LICSYSTEM.editalPdf.remove(pdfKey(id)); }catch(e){}
        }
      }
      LICSYSTEM.statusLicitacoes.items = keep;
      LICSYSTEM.statusLicitacoes.saveLocal({ immediate: true });
      LICSYSTEM.statusLicitacoes.render();
      showAlert("slAlert", "ok", "Removido.");
    },

    render: function(){
      LICSYSTEM.statusLicitacoes.renderTabela();
    },

    renderTotais: function(){
      var foot = el("slFoot");
      if(!foot) return;
      LICSYSTEM.statusLicitacoes.load();
      var items = LICSYSTEM.statusLicitacoes.items || [];
      var n = items.length;
      if(!n){
        foot.innerHTML = "";
        return;
      }
      var total = 0;
      var orcadaOk = 0;
      var cadOk = 0;
      var statusOk = 0;
      var i;
      for(i=0;i<n;i++){
        var it = items[i];
        total += Number(it.valor) || 0;
        if(it.orcada === "ok") orcadaOk++;
        if(it.cadastrada === "ok") cadOk++;
        if(it.status) statusOk++;
      }
      foot.innerHTML =
        "<tr>"+
          "<td colspan=\"11\">"+
            "<div class=\"sl-foot-bar\">"+
              "<span class=\"sl-foot-label\">TOTAL</span>"+
              "<span class=\"sl-foot-n\">"+n+(n===1?" licitação":" licitações")+"</span>"+
              "<span class=\"sl-foot-valor\">R$ "+formatMoneyTotal(total)+"</span>"+
              "<span class=\"sl-foot-chip\">ORÇADA "+fracHtml(orcadaOk, n, orcadaOk+" orçadas (V verde) de "+n)+"</span>"+
              "<span class=\"sl-foot-chip\">CADASTRADA "+fracHtml(cadOk, n, cadOk+" cadastradas (V verde) de "+n)+"</span>"+
              "<span class=\"sl-foot-chip\">STATUS "+fracHtml(statusOk, n, statusOk+" com status preenchido de "+n)+"</span>"+
            "</div>"+
          "</td>"+
        "</tr>";
    },

    renderTabela: function(){
      var body = el("slBody");
      if(!body) return;
      var list = LICSYSTEM.statusLicitacoes.sorted();
      var ths = document.querySelectorAll("#slTable thead th.sl-th-sort");
      for(var t=0;t<ths.length;t++){
        var k = ths[t].getAttribute("data-sl-sort");
        var on = k === LICSYSTEM.statusLicitacoes.sortKey;
        ths[t].classList.toggle("is-sort", on);
        ths[t].classList.toggle("is-sort-asc", on && LICSYSTEM.statusLicitacoes.sortDir === 1);
      }
      var btnNome = el("btnSlSortNome");
      var btnData = el("btnSlSortData");
      if(btnNome) btnNome.classList.toggle("btn-gold", LICSYSTEM.statusLicitacoes.sortKey === "nome");
      if(btnData) btnData.classList.toggle("btn-gold", LICSYSTEM.statusLicitacoes.sortKey === "data");

      if(!list.length){
        body.innerHTML = '<tr><td colspan="11" class="sl-empty">Nenhuma licitação nesta lista. Clique em + Nova linha para começar.</td></tr>';
        LICSYSTEM.statusLicitacoes.renderTotais();
        return;
      }

      var html = [];
      for(var i=0;i<list.length;i++){
        var it = list[i];
        var sid = esc(it.id);
        var opts = [];
        for(var s=0;s<STATUS_OPTS.length;s++){
          var op = STATUS_OPTS[s];
          opts.push(
            '<option value="'+esc(op.id)+'"'+(it.status === op.id ? " selected" : "")+">"+esc(op.label)+"</option>"
          );
        }
        html.push(
          "<tr data-sl-row=\""+sid+"\">"+
            "<td><input type=\"date\" class=\"sl-in sl-in-date\" data-sl-id=\""+sid+"\" data-sl-f=\"data\" value=\""+esc(it.data)+"\"></td>"+
            "<td><input type=\"time\" class=\"sl-in sl-in-hora\" data-sl-id=\""+sid+"\" data-sl-f=\"hora\" value=\""+esc(it.hora)+"\"></td>"+
            "<td class=\"sl-td-licitacao\"><input type=\"text\" class=\"sl-in sl-in-licitacao\" data-sl-id=\""+sid+"\" data-sl-f=\"nome\" value=\""+esc(it.nome)+"\" placeholder=\"000/2026\"></td>"+
            "<td class=\"sl-td-edital\">"+editalCell(it, sid)+"</td>"+
            "<td class=\"sl-td-municipio\"><input type=\"text\" class=\"sl-in sl-in-municipio\" data-sl-id=\""+sid+"\" data-sl-f=\"municipio\" value=\""+esc(it.municipio)+"\" placeholder=\"Município\"></td>"+
            "<td><input type=\"text\" class=\"sl-in sl-in-plataforma\" data-sl-id=\""+sid+"\" data-sl-f=\"plataforma\" value=\""+esc(it.plataforma)+"\" list=\"slPlataformas\" placeholder=\"Plataforma\" autocomplete=\"off\"></td>"+
            "<td class=\"sl-td-right\"><div class=\"sl-valor\"><span class=\"sl-valor-prefix\">R$</span>"+
              "<input type=\"text\" class=\"sl-in sl-in-valor\" data-sl-id=\""+sid+"\" data-sl-f=\"valor\" value=\""+esc(formatMoneyInput(it.valor))+"\" inputmode=\"decimal\" placeholder=\"0,00\">"+
            "</div></td>"+
            "<td class=\"sl-td-center\"><div class=\"sl-marks\">"+
              "<button type=\"button\" class=\"sl-mark"+markClass(it.orcada === "ok" ? "ok" : "")+"\" data-sl-flag=\"orcada\" data-sl-val=\"ok\" data-sl-id=\""+sid+"\" title=\"Orçada: ok\">V</button>"+
              "<button type=\"button\" class=\"sl-mark"+markClass(it.orcada === "no" ? "no" : "")+"\" data-sl-flag=\"orcada\" data-sl-val=\"no\" data-sl-id=\""+sid+"\" title=\"Orçada: não\">X</button>"+
            "</div></td>"+
            "<td class=\"sl-td-center\"><div class=\"sl-marks\">"+
              "<button type=\"button\" class=\"sl-mark"+markClass(it.cadastrada === "ok" ? "ok" : "")+"\" data-sl-flag=\"cadastrada\" data-sl-val=\"ok\" data-sl-id=\""+sid+"\" title=\"Cadastrada: ok\">V</button>"+
              "<button type=\"button\" class=\"sl-mark"+markClass(it.cadastrada === "no" ? "no" : "")+"\" data-sl-flag=\"cadastrada\" data-sl-val=\"no\" data-sl-id=\""+sid+"\" title=\"Cadastrada: não\">X</button>"+
            "</div></td>"+
            "<td><select class=\"sl-status is-"+esc(it.status || "none")+"\" data-sl-id=\""+sid+"\" data-sl-f=\"status\">"+opts.join("")+"</select></td>"+
            "<td><button type=\"button\" class=\"btn btn-ghost btn-sm\" data-sl-del=\""+sid+"\" title=\"Remover\">✕</button></td>"+
          "</tr>"
        );
      }
      body.innerHTML = html.join("");
      LICSYSTEM.statusLicitacoes.renderTotais();
    }
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
