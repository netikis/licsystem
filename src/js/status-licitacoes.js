/* LICSYSTEM — STATUS LICITAÇÕES */
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

  LICSYSTEM.statusLicitacoes = {
    items: [],
    _loaded: false,
    sortKey: "data",
    sortDir: -1,

    emptyItem: function(){
      return {
        id: uid(),
        data: todayIso(),
        nome: "",
        municipio: "",
        orcada: "",
        cadastrada: "",
        status: ""
      };
    },

    normalize: function(it){
      it = it || {};
      return {
        id: String(it.id || uid()),
        data: String(it.data || "").slice(0, 10),
        nome: String(it.nome || it.licitacao || "").slice(0, 220),
        municipio: String(it.municipio || "").slice(0, 120),
        orcada: normFlag(it.orcada),
        cadastrada: normFlag(it.cadastrada),
        status: normStatus(it.status)
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
        } else {
          va = String(a.data || "");
          vb = String(b.data || "");
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
        LICSYSTEM.statusLicitacoes.sortDir = (key === "nome" || key === "municipio") ? 1 : -1;
      }
      LICSYSTEM.statusLicitacoes.renderTabela();
    },

    onEdit: function(id, field, value){
      var item = LICSYSTEM.statusLicitacoes.find(id);
      if(!item) return;
      if(field === "data") item.data = String(value || "").slice(0, 10);
      else if(field === "nome") item.nome = String(value || "").slice(0, 220);
      else if(field === "municipio") item.municipio = String(value || "").slice(0, 120);
      else if(field === "status") item.status = normStatus(value);
      LICSYSTEM.statusLicitacoes.saveLocal();
      if(field === "status") LICSYSTEM.statusLicitacoes.renderTabela();
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

    adicionar: function(){
      var dataEl = el("slNewData");
      var nomeEl = el("slNewNome");
      var munEl = el("slNewMunicipio");
      var nome = nomeEl ? String(nomeEl.value || "").trim() : "";
      var municipio = munEl ? String(munEl.value || "").trim() : "";
      var data = dataEl && dataEl.value ? String(dataEl.value) : todayIso();
      if(!nome){
        showAlert("slAlert", "warn", "Informe o nome da licitação.");
        if(nomeEl) nomeEl.focus();
        return;
      }
      var row = LICSYSTEM.statusLicitacoes.emptyItem();
      row.data = data;
      row.nome = nome;
      row.municipio = municipio;
      LICSYSTEM.statusLicitacoes.load();
      LICSYSTEM.statusLicitacoes.items.unshift(row);
      LICSYSTEM.statusLicitacoes.saveLocal({ immediate: true });
      if(nomeEl) nomeEl.value = "";
      if(munEl) munEl.value = "";
      LICSYSTEM.statusLicitacoes.render();
      showAlert("slAlert", "ok", "Licitação adicionada.");
    },

    adicionarVazio: function(){
      LICSYSTEM.statusLicitacoes.load();
      LICSYSTEM.statusLicitacoes.items.unshift(LICSYSTEM.statusLicitacoes.emptyItem());
      LICSYSTEM.statusLicitacoes.saveLocal();
      LICSYSTEM.statusLicitacoes.render();
      showAlert("slAlert", "ok", "Linha adicionada — preencha data, licitação e município.");
    },

    remover: function(id){
      if(!id) return;
      if(!confirm("Remover esta licitação da lista de status?")) return;
      LICSYSTEM.statusLicitacoes.load();
      var keep = [];
      var items = LICSYSTEM.statusLicitacoes.items;
      for(var i=0;i<items.length;i++){
        if(items[i].id !== id) keep.push(items[i]);
      }
      LICSYSTEM.statusLicitacoes.items = keep;
      LICSYSTEM.statusLicitacoes.saveLocal({ immediate: true });
      LICSYSTEM.statusLicitacoes.render();
      showAlert("slAlert", "ok", "Removido.");
    },

    render: function(){
      var dataEl = el("slNewData");
      if(dataEl && !dataEl.value) dataEl.value = todayIso();
      LICSYSTEM.statusLicitacoes.renderTabela();
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
        body.innerHTML = '<tr><td colspan="7" class="sl-empty">Nenhuma licitação nesta lista. Preencha acima e clique em Adicionar.</td></tr>';
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
            "<td><input type=\"text\" class=\"sl-in\" data-sl-id=\""+sid+"\" data-sl-f=\"nome\" value=\""+esc(it.nome)+"\" placeholder=\"Nome da licitação\"></td>"+
            "<td><input type=\"text\" class=\"sl-in\" data-sl-id=\""+sid+"\" data-sl-f=\"municipio\" value=\""+esc(it.municipio)+"\" placeholder=\"Município\"></td>"+
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
    }
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
