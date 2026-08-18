/* LICSYSTEM — COFRE (09-cofre.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var COFRE_KEY = ctx.COFRE_KEY;
  function wire(){
    var fn = ctx.wire || window.wire || LICSYSTEM.wire;
    if (typeof fn !== "function") throw new Error("wire ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ COFRE ============================ */
  var COFRE_DOCS = [
    {key:"cnpj", label:"CNPJ (Cartão)", tipo:"habilitacao"},
    {key:"cndFederal", label:"CND Federal", tipo:"certidao"},
    {key:"cndEstadual", label:"CND Estadual", tipo:"certidao"},
    {key:"cndMunicipal", label:"CND Municipal", tipo:"certidao"},
    {key:"fgts", label:"FGTS (CRF)", tipo:"certidao"},
    {key:"cndt", label:"INSS / CNDT", tipo:"certidao"},
    {key:"balanco", label:"Balanço Patrimonial", tipo:"habilitacao"},
    {key:"contratoSocial", label:"Contrato Social", tipo:"contrato"}
  ];
  var COFRE_MAX_FILE = 1.5 * 1024 * 1024; // 1,5 MB — base64 (~33% maior) no localStorage/Firebase RTDB
  LICSYSTEM.cofre = {
    data: { v: 2, items: [] },
    _pendingFile: null,
    _selected: {},
    _attachTargetId: null,
    _viewBlobUrl: null,
    _viewZoom: 1,
    _viewItemId: null,

    emptyData: function(){
      return { v: 2, items: [] };
    },

    tipoLabel: function(tipo){
      var map = {
        habilitacao: "Habilitação",
        certidao: "Certidão",
        contrato: "Contrato",
        tecnica: "Técnica",
        outro: "Outro"
      };
      return map[tipo] || "Outro";
    },

    normalizeItem: function(d, idx){
      d = d || {};
      var id = String(d.id || d.key || ("cof_" + Date.now() + "_" + (idx || 0)));
      var key = d.key != null && d.key !== "" ? String(d.key) : null;
      var tipo = String(d.tipo || "outro").toLowerCase();
      if(["habilitacao","certidao","contrato","tecnica","outro"].indexOf(tipo) === -1) tipo = "outro";
      return {
        id: id,
        key: key,
        nome: String(d.nome || d.label || "Documento").trim().slice(0, 220) || "Documento",
        tipo: tipo,
        validade: String(d.validade || d.date || "").trim().slice(0, 12),
        link: String(d.link || "").trim().slice(0, 500),
        obs: String(d.obs || "").trim().slice(0, 400),
        arquivoNome: String(d.arquivoNome || "").trim().slice(0, 220),
        arquivoMime: String(d.arquivoMime || "").trim().slice(0, 120),
        arquivoData: typeof d.arquivoData === "string" ? d.arquivoData : "",
        fixed: !!d.fixed
      };
    },

    migrateLegacy: function(raw){
      if(!raw || typeof raw !== "object" || Array.isArray(raw)) return this.emptyData();
      if(Array.isArray(raw.items)){
        return {
          v: 2,
          items: raw.items.map(function(it, i){ return LICSYSTEM.cofre.normalizeItem(it, i); })
        };
      }
      // Legacy flat map: { cnpj: "2025-01-01", ... }
      var items = COFRE_DOCS.map(function(doc, i){
        return LICSYSTEM.cofre.normalizeItem({
          id: doc.key,
          key: doc.key,
          nome: doc.label,
          tipo: doc.tipo || "outro",
          validade: raw[doc.key] || "",
          fixed: true
        }, i);
      });
      // Keep any unknown keys as custom docs
      Object.keys(raw).forEach(function(k, i){
        if(k === "v" || k === "items") return;
        if(COFRE_DOCS.some(function(d){ return d.key === k; })) return;
        var val = raw[k];
        if(typeof val === "string"){
          items.push(LICSYSTEM.cofre.normalizeItem({
            id: "legacy_" + k,
            key: k,
            nome: k,
            validade: val
          }, 100 + i));
        }
      });
      return { v: 2, items: items };
    },

    applyData: function(data, opts){
      opts = opts || {};
      LICSYSTEM.cofre.data = LICSYSTEM.cofre.migrateLegacy(data);
      if(!opts.skipPersist){
        try{ localStorage.setItem(COFRE_KEY, JSON.stringify(LICSYSTEM.cofre.data)); }catch(e){}
      }
      if(LICSYSTEM.state.currentView === "cofre" || LICSYSTEM.state._cofreRendered){
        try{ LICSYSTEM.cofre.render(); }catch(e){}
      }
    },

    load: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(COFRE_KEY) || "null");
        if(raw && typeof raw === "object"){
          // Persist local se migrar do formato antigo { chave: data }
          var isV2 = Array.isArray(raw.items);
          LICSYSTEM.cofre.applyData(raw, { skipPersist: isV2 });
        } else {
          LICSYSTEM.cofre.data = LICSYSTEM.cofre.emptyData();
        }
      }catch(e){
        LICSYSTEM.cofre.data = LICSYSTEM.cofre.emptyData();
      }
    },

    items: function(){
      return (LICSYSTEM.cofre.data && LICSYSTEM.cofre.data.items) || [];
    },

    findById: function(id){
      id = String(id || "");
      return LICSYSTEM.cofre.items().filter(function(it){ return it.id === id; })[0] || null;
    },

    findByKey: function(key){
      key = String(key || "");
      if(!key) return null;
      return LICSYSTEM.cofre.items().filter(function(it){
        return it.key === key || it.id === key;
      })[0] || null;
    },

    getValidade: function(key){
      var it = LICSYSTEM.cofre.findByKey(key);
      return it ? (it.validade || "") : "";
    },

    getLabel: function(key){
      var it = LICSYSTEM.cofre.findByKey(key);
      if(it) return it.nome;
      var fixed = COFRE_DOCS.filter(function(d){ return d.key === key; })[0];
      return fixed ? fixed.label : key;
    },

    statusOf: function(dateStr){
      if(!dateStr) return {cls:"b-red", txt:"Sem data", kind:"none"};
      var d = new Date(dateStr+"T00:00:00");
      if(isNaN(d.getTime())) return {cls:"b-red", txt:"Sem data", kind:"none"};
      var now = new Date(); now.setHours(0,0,0,0);
      var diff = Math.round((d - now)/86400000);
      if(diff < 0) return {cls:"b-red", txt:"Vencido", kind:"expired"};
      if(diff <= 15) return {cls:"b-yellow", txt:"Vence em "+diff+"d", kind:"warn"};
      return {cls:"b-green", txt:"Válido", kind:"ok"};
    },

    persist: function(opts){
      opts = opts || {};
      try{
        localStorage.setItem(COFRE_KEY, JSON.stringify(LICSYSTEM.cofre.data));
      }catch(e){
        showAlert("cofreAlert","error","Não foi possível salvar (armazenamento cheio?). Remova arquivos grandes ou use link.");
        return false;
      }
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("cofre", {
          updatedAt: Date.now(),
          immediate: !!opts.immediate
        });
      }
      return true;
    },

    save: function(){
      if(LICSYSTEM.cofre.persist({ immediate: true })){
        showAlert("cofreAlert","ok","Cofre salvo" + (LICSYSTEM.cloudSync ? " e sincronizado." : "."));
      }
    },

    seedDefaults: function(force){
      var existing = LICSYSTEM.cofre.items();
      if(existing.length && !force){
        showAlert("cofreAlert","warn","Já existem documentos. Use Adicionar para incluir novos.");
        return;
      }
      if(existing.length && force){
        if(!confirm("Isso adiciona os documentos padrão que ainda não existem (não apaga os atuais). Continuar?")) return;
      }
      var keys = {};
      existing.forEach(function(it){ if(it.key) keys[it.key] = true; });
      var added = 0;
      COFRE_DOCS.forEach(function(doc, i){
        if(keys[doc.key]) return;
        existing.push(LICSYSTEM.cofre.normalizeItem({
          id: doc.key,
          key: doc.key,
          nome: doc.label,
          tipo: doc.tipo || "outro",
          validade: "",
          fixed: true
        }, i));
        added++;
      });
      LICSYSTEM.cofre.data = { v: 2, items: existing };
      LICSYSTEM.cofre.persist({ immediate: true });
      LICSYSTEM.cofre.render();
      showAlert("cofreAlert","ok", added ? (added + " documento(s) padrão adicionado(s).") : "Todos os padrões já estão no cofre.");
    },

    selectedIds: function(){
      var box = el("cofreList");
      if(!box) return [];
      var ids = [];
      box.querySelectorAll(".cofreSelChk:checked").forEach(function(chk){
        ids.push(chk.getAttribute("data-id"));
      });
      return ids;
    },

    openModal: function(item){
      var ov = el("cofreOverlay");
      if(!ov) return;
      hideAlert("cofreModalAlert");
      LICSYSTEM.cofre._pendingFile = null;
      var editing = !!item;
      el("cofreModalTitle").textContent = editing ? "Editar documento" : "Adicionar documento";
      el("cofreModalLead").textContent = editing
        ? "Atualize validade, arquivo ou dados — útil para documentos vencidos."
        : "Informe os dados do documento. Arquivo (PDF/imagem) ou link externo.";
      el("cofreEditId").value = editing ? item.id : "";
      el("cofreNome").value = editing ? (item.nome || "") : "";
      el("cofreTipo").value = editing ? (item.tipo || "outro") : "habilitacao";
      el("cofreValidade").value = editing ? (item.validade || "") : "";
      el("cofreLink").value = editing ? (item.link || "") : "";
      el("cofreObs").value = editing ? (item.obs || "") : "";
      var fileInp = el("cofreArquivo");
      if(fileInp) fileInp.value = "";
      var info = el("cofreArquivoInfo");
      if(info){
        info.textContent = editing && item.arquivoNome
          ? ("Arquivo atual: " + item.arquivoNome + " — envie outro para substituir (máx. 1,5 MB, sem compressão)")
          : "Nenhum arquivo anexado. PDF ou imagem até 1,5 MB (qualidade original).";
      }
      ov.classList.add("open");
      ov.setAttribute("aria-hidden","false");
      try{ el("cofreNome").focus(); }catch(e){}
    },

    closeModal: function(){
      var ov = el("cofreOverlay");
      if(!ov) return;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden","true");
      LICSYSTEM.cofre._pendingFile = null;
    },

    readFileAsDataUrl: function(file){
      return new Promise(function(resolve, reject){
        if(!file){ resolve(null); return; }
        if(file.size > COFRE_MAX_FILE){
          reject(new Error("Máximo 1,5 MB. Comprima o PDF/imagem ou use o campo Link para arquivos maiores."));
          return;
        }
        var okMime = /^(application\/pdf|image\/)/i.test(file.type) || /\.(pdf|png|jpe?g|webp|gif)$/i.test(file.name || "");
        if(!okMime){
          reject(new Error("Formato não suportado. Use PDF ou imagem (PNG/JPG/WEBP)."));
          return;
        }
        // Sem redimensionar/comprimir — mantém nitidez original do arquivo.
        var reader = new FileReader();
        reader.onload = function(){
          resolve({
            nome: file.name,
            mime: file.type || (/\.pdf$/i.test(file.name) ? "application/pdf" : "application/octet-stream"),
            data: String(reader.result || ""),
            size: file.size
          });
        };
        reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo.")); };
        reader.readAsDataURL(file);
      });
    },

    formatBytes: function(n){
      n = Number(n) || 0;
      if(n < 1024) return n + " B";
      if(n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
      return (n / (1024 * 1024)).toFixed(2) + " MB";
    },

    isImageMime: function(mime, name){
      return /^image\//i.test(mime || "") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name || "");
    },

    isPdfMime: function(mime, name){
      return /pdf/i.test(mime || "") || /\.pdf$/i.test(name || "");
    },

    revokeViewBlob: function(){
      if(LICSYSTEM.cofre._viewBlobUrl){
        try{ URL.revokeObjectURL(LICSYSTEM.cofre._viewBlobUrl); }catch(e){}
        LICSYSTEM.cofre._viewBlobUrl = null;
      }
    },

    dataUrlToBlobUrl: function(dataUrl, mime){
      var bytes = LICSYSTEM.cofre.dataUrlToUint8(dataUrl);
      if(!bytes) return null;
      var blob = new Blob([bytes], { type: mime || "application/octet-stream" });
      return URL.createObjectURL(blob);
    },

    attachPrompt: function(id){
      var item = LICSYSTEM.cofre.findById(id);
      if(!item){
        showAlert("cofreAlert","error","Documento não encontrado.");
        return;
      }
      LICSYSTEM.cofre._attachTargetId = String(id);
      var inp = el("cofreQuickFile");
      if(!inp){
        showAlert("cofreAlert","error","Campo de anexo não encontrado. Recarregue a página.");
        return;
      }
      inp.value = "";
      inp.click();
    },

    attachFromQuickFile: function(file){
      var id = LICSYSTEM.cofre._attachTargetId;
      LICSYSTEM.cofre._attachTargetId = null;
      if(!id || !file) return;
      var item = LICSYSTEM.cofre.findById(id);
      if(!item){
        showAlert("cofreAlert","error","Documento não encontrado.");
        return;
      }
      showAlert("cofreAlert","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Anexando…');
      LICSYSTEM.cofre.readFileAsDataUrl(file).then(function(meta){
        if(!meta || !meta.data){
          showAlert("cofreAlert","error","Arquivo vazio.");
          return;
        }
        var list = LICSYSTEM.cofre.items().map(function(it){
          if(it.id !== item.id) return it;
          return LICSYSTEM.cofre.normalizeItem(Object.assign({}, it, {
            arquivoNome: meta.nome,
            arquivoMime: meta.mime,
            arquivoData: meta.data
          }));
        });
        LICSYSTEM.cofre.data = { v: 2, items: list };
        if(!LICSYSTEM.cofre.persist({ immediate: true })) return;
        LICSYSTEM.cofre.render();
        showAlert(
          "cofreAlert",
          "ok",
          "📎 Anexo salvo em <b>" + utils.escapeHtml(item.nome) + "</b> (" +
            utils.escapeHtml(meta.nome) + " · " + LICSYSTEM.cofre.formatBytes(meta.size) + ")."
        );
      }).catch(function(err){
        showAlert("cofreAlert","error", err.message || "Erro ao anexar.");
      });
    },

    /** Remove só o arquivo anexado — o documento (nome/validade) continua no cofre. */
    removeAnexoById: function(id){
      var item = LICSYSTEM.cofre.findById(id);
      if(!item){
        showAlert("cofreAlert","error","Documento não encontrado.");
        return;
      }
      if(!item.arquivoData && !item.arquivoNome){
        showAlert("cofreAlert","warn","Este documento não tem anexo.");
        return;
      }
      var nomeArq = item.arquivoNome || "arquivo";
      if(!confirm("Remover o anexo \"" + nomeArq + "\" de \"" + (item.nome || "documento") + "\"?\nO cadastro do documento permanece.")){
        return;
      }
      var list = LICSYSTEM.cofre.items().map(function(it){
        if(it.id !== item.id) return it;
        return LICSYSTEM.cofre.normalizeItem(Object.assign({}, it, {
          arquivoNome: "",
          arquivoMime: "",
          arquivoData: ""
        }));
      });
      LICSYSTEM.cofre.data = { v: 2, items: list };
      if(!LICSYSTEM.cofre.persist({ immediate: true })) return;
      try{
        if(LICSYSTEM.cofre._viewItemId && String(LICSYSTEM.cofre._viewItemId) === String(item.id)){
          LICSYSTEM.cofre.closeView();
        }
      }catch(e){}
      LICSYSTEM.cofre.render();
      showAlert("cofreAlert","ok","Anexo removido de <b>" + utils.escapeHtml(item.nome) + "</b>.");
    },

    applyViewZoom: function(){
      var z = LICSYSTEM.cofre._viewZoom || 1;
      var img = el("cofreViewImg");
      var frame = el("cofreViewFrame");
      var label = el("btnCofreViewZoomReset");
      if(label) label.textContent = Math.round(z * 100) + "%";
      if(img){
        img.style.transform = "scale(" + z + ")";
        img.style.transformOrigin = "center top";
      }
      if(frame){
        frame.style.transform = "scale(" + z + ")";
        frame.style.transformOrigin = "top left";
        frame.style.width = (100 / z) + "%";
        frame.style.height = (100 / z) + "%";
      }
    },

    closeView: function(){
      var ov = el("cofreViewOverlay");
      if(ov){
        ov.classList.remove("open");
        ov.setAttribute("aria-hidden","true");
      }
      var body = el("cofreViewBody");
      if(body) body.innerHTML = "";
      LICSYSTEM.cofre.revokeViewBlob();
      LICSYSTEM.cofre._viewItemId = null;
      LICSYSTEM.cofre._viewZoom = 1;
    },

    viewById: function(id){
      var item = LICSYSTEM.cofre.findById(id);
      if(!item){
        showAlert("cofreAlert","error","Documento não encontrado.");
        return;
      }
      if(!item.arquivoData && item.link){
        var url = utils.normalizeHttpUrl ? utils.normalizeHttpUrl(item.link) : item.link;
        if(url) window.open(url, "_blank", "noopener,noreferrer");
        else showAlert("cofreAlert","warn","Link inválido. Anexe um arquivo ou corrija o link.");
        return;
      }
      if(!item.arquivoData){
        showAlert("cofreAlert","warn","Nenhum arquivo anexado. Clique em <b>Anexar</b> (máx. 1,5 MB).");
        return;
      }

      LICSYSTEM.cofre.revokeViewBlob();
      LICSYSTEM.cofre._viewItemId = item.id;
      LICSYSTEM.cofre._viewZoom = 1;

      var mime = item.arquivoMime || "";
      var blobUrl = LICSYSTEM.cofre.dataUrlToBlobUrl(item.arquivoData, mime);
      if(blobUrl) LICSYSTEM.cofre._viewBlobUrl = blobUrl;
      var src = blobUrl || item.arquivoData;

      var title = el("cofreViewTitle");
      var meta = el("cofreViewMeta");
      var body = el("cofreViewBody");
      var ov = el("cofreViewOverlay");
      if(!body || !ov){
        // Fallback: abre em nova aba
        window.open(src, "_blank", "noopener");
        return;
      }
      if(title) title.textContent = item.nome || "Documento";
      if(meta){
        meta.textContent = (item.arquivoNome || "arquivo") +
          (item.validade ? " · Validade " + item.validade.split("-").reverse().join("/") : "");
      }

      var html = "";
      if(LICSYSTEM.cofre.isImageMime(mime, item.arquivoNome)){
        html =
          '<div class="cofre-view-scroll">' +
            '<img id="cofreViewImg" class="cofre-view-img" alt="' + utils.escapeHtml(item.nome || "Documento") +
              '" src="' + utils.escapeHtml(src) + '" draggable="false" />' +
          "</div>";
      } else if(LICSYSTEM.cofre.isPdfMime(mime, item.arquivoNome)){
        html =
          '<div class="cofre-view-scroll cofre-view-scroll-pdf">' +
            '<iframe id="cofreViewFrame" class="cofre-view-frame" title="PDF" src="' +
              utils.escapeHtml(src) + '#toolbar=1&navpanes=0"></iframe>' +
          "</div>";
      } else {
        html =
          '<div class="cofre-view-fallback">' +
            '<p>Pré-visualização não disponível para este tipo.</p>' +
            '<a class="btn btn-primary" href="' + utils.escapeHtml(src) + '" download="' +
              utils.escapeHtml(item.arquivoNome || "documento") + '">⬇️ Baixar arquivo</a>' +
          "</div>";
      }
      body.innerHTML = html;
      ov.classList.add("open");
      ov.setAttribute("aria-hidden","false");
      LICSYSTEM.cofre.applyViewZoom();
    },

    downloadView: function(){
      var item = LICSYSTEM.cofre.findById(LICSYSTEM.cofre._viewItemId);
      if(!item || !item.arquivoData) return;
      var a = document.createElement("a");
      a.href = LICSYSTEM.cofre._viewBlobUrl || item.arquivoData;
      a.download = LICSYSTEM.cofre.safeFileName(item.arquivoNome || item.nome, "documento");
      document.body.appendChild(a);
      a.click();
      setTimeout(function(){ a.remove(); }, 500);
    },

    saveFromModal: function(){
      var nome = String((el("cofreNome") && el("cofreNome").value) || "").trim();
      if(!nome){
        showAlert("cofreModalAlert","warn","Informe o nome do documento.");
        return;
      }
      var editId = String((el("cofreEditId") && el("cofreEditId").value) || "");
      var existing = editId ? LICSYSTEM.cofre.findById(editId) : null;
      var fileInp = el("cofreArquivo");
      var file = fileInp && fileInp.files && fileInp.files[0] ? fileInp.files[0] : null;

      function commit(fileMeta){
        var item = LICSYSTEM.cofre.normalizeItem({
          id: existing ? existing.id : ("cof_" + Date.now()),
          key: existing ? existing.key : null,
          nome: nome,
          tipo: (el("cofreTipo") && el("cofreTipo").value) || "outro",
          validade: (el("cofreValidade") && el("cofreValidade").value) || "",
          link: (el("cofreLink") && el("cofreLink").value) || "",
          obs: (el("cofreObs") && el("cofreObs").value) || "",
          arquivoNome: fileMeta ? fileMeta.nome : (existing ? existing.arquivoNome : ""),
          arquivoMime: fileMeta ? fileMeta.mime : (existing ? existing.arquivoMime : ""),
          arquivoData: fileMeta ? fileMeta.data : (existing ? existing.arquivoData : ""),
          fixed: existing ? existing.fixed : false
        });
        var list = LICSYSTEM.cofre.items().slice();
        if(existing){
          list = list.map(function(it){ return it.id === existing.id ? item : it; });
        } else {
          list.push(item);
        }
        LICSYSTEM.cofre.data = { v: 2, items: list };
        if(!LICSYSTEM.cofre.persist({ immediate: true })) return;
        LICSYSTEM.cofre.closeModal();
        LICSYSTEM.cofre.render();
        showAlert("cofreAlert","ok", existing ? "Documento atualizado." : "Documento adicionado.");
      }

      if(file){
        LICSYSTEM.cofre.readFileAsDataUrl(file).then(commit).catch(function(err){
          showAlert("cofreModalAlert","error", err.message || "Erro ao ler arquivo.");
        });
      } else {
        commit(null);
      }
    },

    add: function(){ LICSYSTEM.cofre.openModal(null); },

    editSelected: function(){
      var ids = LICSYSTEM.cofre.selectedIds();
      if(ids.length !== 1){
        showAlert("cofreAlert","warn","Selecione exatamente um documento para editar.");
        return;
      }
      var item = LICSYSTEM.cofre.findById(ids[0]);
      if(!item){ showAlert("cofreAlert","error","Documento não encontrado."); return; }
      LICSYSTEM.cofre.openModal(item);
    },

    editById: function(id){
      var item = LICSYSTEM.cofre.findById(id);
      if(!item) return;
      LICSYSTEM.cofre.openModal(item);
    },

    removeSelected: function(){
      var ids = LICSYSTEM.cofre.selectedIds();
      if(!ids.length){
        showAlert("cofreAlert","warn","Selecione ao menos um documento para remover.");
        return;
      }
      var msg = ids.length === 1
        ? "Remover este documento do cofre?"
        : ("Remover " + ids.length + " documentos do cofre?");
      if(!confirm(msg)) return;
      var set = {};
      ids.forEach(function(id){ set[id] = true; });
      LICSYSTEM.cofre.data = {
        v: 2,
        items: LICSYSTEM.cofre.items().filter(function(it){ return !set[it.id]; })
      };
      LICSYSTEM.cofre.persist({ immediate: true });
      LICSYSTEM.cofre.render();
      showAlert("cofreAlert","ok", ids.length + " documento(s) removido(s).");
    },

    dataUrlToUint8: function(dataUrl){
      try{
        var parts = String(dataUrl || "").split(",");
        var b64 = parts.length > 1 ? parts[1] : parts[0];
        var bin = atob(b64);
        var arr = new Uint8Array(bin.length);
        for(var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }catch(e){ return null; }
    },

    safeFileName: function(name, fallback){
      var n = String(name || fallback || "documento").replace(/[\\/:*?"<>|]+/g, "_").trim();
      return n.slice(0, 120) || "documento";
    },

    exportZip: function(){
      if(typeof JSZip === "undefined"){
        showAlert("cofreAlert","error","Biblioteca JSZip não carregou. Verifique a conexão e recarregue a página.");
        return;
      }
      var ids = LICSYSTEM.cofre.selectedIds();
      var all = LICSYSTEM.cofre.items();
      var list = ids.length
        ? all.filter(function(it){ return ids.indexOf(it.id) !== -1; })
        : all.slice();
      if(!list.length){
        showAlert("cofreAlert","warn","Nenhum documento para exportar.");
        return;
      }
      showAlert("cofreAlert","info",'<span class="spinner"></span> Gerando ZIP…');
      var zip = new JSZip();
      var csv = ["nome;tipo;validade;status;link;arquivo;observacoes"];
      var folder = zip.folder("documentos");
      list.forEach(function(it, idx){
        var st = LICSYSTEM.cofre.statusOf(it.validade);
        var fname = "";
        if(it.arquivoData){
          var bytes = LICSYSTEM.cofre.dataUrlToUint8(it.arquivoData);
          if(bytes){
            var base = LICSYSTEM.cofre.safeFileName(it.arquivoNome || (it.nome + ".bin"), "doc_" + (idx + 1));
            fname = ("0" + (idx + 1)).slice(-2) + "_" + base;
            folder.file(fname, bytes);
          }
        }
        csv.push([
          it.nome,
          LICSYSTEM.cofre.tipoLabel(it.tipo),
          it.validade || "",
          st.txt,
          it.link || "",
          fname || (it.arquivoNome || ""),
          (it.obs || "").replace(/[\r\n;]+/g, " ")
        ].map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(";"));
      });
      zip.file("indice.csv", "\uFEFF" + csv.join("\r\n"));
      zip.file("indice.txt", list.map(function(it, i){
        var st = LICSYSTEM.cofre.statusOf(it.validade);
        return (i + 1) + ". " + it.nome +
          "\n   Tipo: " + LICSYSTEM.cofre.tipoLabel(it.tipo) +
          "\n   Validade: " + (it.validade || "—") + " (" + st.txt + ")" +
          "\n   Link: " + (it.link || "—") +
          "\n   Arquivo: " + (it.arquivoNome || "—") +
          "\n   Obs: " + (it.obs || "—") + "\n";
      }).join("\n"));

      zip.generateAsync({ type: "blob" }).then(function(blob){
        var a = document.createElement("a");
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = "cofre-documentos-" + new Date().toISOString().slice(0, 10) + ".zip";
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1500);
        showAlert("cofreAlert","ok", "ZIP exportado com " + list.length + " documento(s).");
      }).catch(function(err){
        showAlert("cofreAlert","error","Falha ao gerar ZIP: " + utils.escapeHtml(err.message || String(err)));
      });
    },

    render: function(){
      var box = el("cofreList");
      if(!box) return;
      var items = LICSYSTEM.cofre.items();
      var selAll = el("cofreSelectAll");

      if(!items.length){
        box.innerHTML =
          '<div class="cofre-empty">Nenhum documento no cofre.<br/>' +
          'Clique em <b>Adicionar</b> ou em <b>Carregar padrões</b> (CNPJ, CNDs, FGTS…).</div>';
        if(selAll) selAll.checked = false;
        return;
      }

      var html = "";
      items.forEach(function(it){
        var st = LICSYSTEM.cofre.statusOf(it.validade);
        var rowCls = "cofre-item";
        if(st.kind === "expired" || st.kind === "none") rowCls += " is-expired";
        else if(st.kind === "warn") rowCls += " is-warn";
        var hasFile = !!(it.arquivoData && it.arquivoNome);
        var hasLink = !!String(it.link || "").trim();
        var fileHtml = "";
        if(hasFile){
          fileHtml = '<span class="cofre-file-tag is-ok">📎 ' + utils.escapeHtml(it.arquivoNome) + "</span>";
        } else {
          fileHtml = '<span class="cofre-file-tag is-empty">Sem anexo</span>';
        }
        if(hasLink){
          fileHtml += (fileHtml ? " · " : "") +
            '<span class="cofre-file-tag">🔗 Link</span>';
        }
        var canView = hasFile || hasLink;
        html +=
          '<div class="' + rowCls + '" data-id="' + utils.escapeHtml(it.id) + '">' +
            '<div class="ci-check"><input type="checkbox" class="cofreSelChk" data-id="' +
              utils.escapeHtml(it.id) + '" /></div>' +
            '<div class="ci-body">' +
              '<div class="ci-name">' + utils.escapeHtml(it.nome) + "</div>" +
              '<div class="ci-meta">' +
                '<span class="cofre-tipo">' + utils.escapeHtml(LICSYSTEM.cofre.tipoLabel(it.tipo)) + "</span>" +
                '<span class="badge-status ' + st.cls + '">' + utils.escapeHtml(st.txt) + "</span>" +
                (it.validade
                  ? '<span class="muted small">Validade: ' + utils.escapeHtml(it.validade.split("-").reverse().join("/")) + "</span>"
                  : '<span class="muted small">Sem validade</span>') +
                fileHtml +
              "</div>" +
              (it.obs ? '<div class="ci-obs">' + utils.escapeHtml(it.obs) + "</div>" : "") +
            "</div>" +
            '<div class="ci-actions">' +
              '<button type="button" class="btn btn-primary btn-sm cofreViewOne" data-id="' +
                utils.escapeHtml(it.id) + '"' + (canView ? "" : " disabled") +
                ' title="' + (canView ? "Ver documento nítido" : "Anexe um arquivo ou informe um link") +
                '">👁 Ver</button>' +
              '<button type="button" class="btn btn-gold btn-sm cofreAttachOne" data-id="' +
                utils.escapeHtml(it.id) + '" title="Anexar PDF ou imagem (máx. 1,5 MB)">📎 Anexar</button>' +
              (hasFile
                ? '<button type="button" class="btn btn-red btn-sm cofreRemoveAnexo" data-id="' +
                    utils.escapeHtml(it.id) + '" title="Apagar só o arquivo anexado">🗑 Anexo</button>'
                : "") +
              '<button type="button" class="btn btn-ghost btn-sm cofreEditOne" data-id="' +
                utils.escapeHtml(it.id) + '">Editar</button>' +
            "</div>" +
          "</div>";
      });
      box.innerHTML = html;
      if(selAll){
        var checked = box.querySelectorAll(".cofreSelChk:checked").length;
        selAll.checked = checked === items.length && items.length > 0;
      }
    },

    wire: function(){
      function bind(id, evt, fn){
        var n = el(id);
        if(n && !n._cofreBound){
          n._cofreBound = true;
          n.addEventListener(evt, fn);
        }
      }
      bind("btnCofreAdd","click", function(){ LICSYSTEM.cofre.add(); });
      bind("btnCofreEdit","click", function(){ LICSYSTEM.cofre.editSelected(); });
      bind("btnCofreRemove","click", function(){ LICSYSTEM.cofre.removeSelected(); });
      bind("btnCofreExportZip","click", function(){ LICSYSTEM.cofre.exportZip(); });
      bind("btnCofreSeed","click", function(){ LICSYSTEM.cofre.seedDefaults(true); });
      bind("btnCofreModalCancel","click", function(){ LICSYSTEM.cofre.closeModal(); });
      bind("btnCofreModalSave","click", function(){ LICSYSTEM.cofre.saveFromModal(); });
      bind("btnCofreViewClose","click", function(){ LICSYSTEM.cofre.closeView(); });
      bind("btnCofreViewDownload","click", function(){ LICSYSTEM.cofre.downloadView(); });
      bind("btnCofreViewRemoveAnexo","click", function(){
        var id = LICSYSTEM.cofre._viewItemId;
        if(id) LICSYSTEM.cofre.removeAnexoById(id);
      });
      bind("btnCofreViewZoomIn","click", function(){
        LICSYSTEM.cofre._viewZoom = Math.min(3, (LICSYSTEM.cofre._viewZoom || 1) + 0.25);
        LICSYSTEM.cofre.applyViewZoom();
      });
      bind("btnCofreViewZoomOut","click", function(){
        LICSYSTEM.cofre._viewZoom = Math.max(0.5, (LICSYSTEM.cofre._viewZoom || 1) - 0.25);
        LICSYSTEM.cofre.applyViewZoom();
      });
      bind("btnCofreViewZoomReset","click", function(){
        LICSYSTEM.cofre._viewZoom = 1;
        LICSYSTEM.cofre.applyViewZoom();
      });
      bind("cofreQuickFile","change", function(){
        var f = this.files && this.files[0] ? this.files[0] : null;
        if(f) LICSYSTEM.cofre.attachFromQuickFile(f);
        this.value = "";
      });
      bind("cofreSelectAll","change", function(){
        var onAll = !!(el("cofreSelectAll") && el("cofreSelectAll").checked);
        var box = el("cofreList");
        if(!box) return;
        box.querySelectorAll(".cofreSelChk").forEach(function(chk){ chk.checked = onAll; });
      });
      var list = el("cofreList");
      if(list && !list._cofreWired){
        list._cofreWired = true;
        list.addEventListener("click", function(e){
          var viewBtn = e.target.closest(".cofreViewOne");
          if(viewBtn && !viewBtn.disabled){
            LICSYSTEM.cofre.viewById(viewBtn.getAttribute("data-id"));
            return;
          }
          var attachBtn = e.target.closest(".cofreAttachOne");
          if(attachBtn){
            LICSYSTEM.cofre.attachPrompt(attachBtn.getAttribute("data-id"));
            return;
          }
          var remAnexo = e.target.closest(".cofreRemoveAnexo");
          if(remAnexo){
            LICSYSTEM.cofre.removeAnexoById(remAnexo.getAttribute("data-id"));
            return;
          }
          var editBtn = e.target.closest(".cofreEditOne");
          if(editBtn){
            LICSYSTEM.cofre.editById(editBtn.getAttribute("data-id"));
          }
        });
      }
      var ov = el("cofreOverlay");
      if(ov && !ov._cofreWired){
        ov._cofreWired = true;
        ov.addEventListener("click", function(e){
          if(e.target === ov) LICSYSTEM.cofre.closeModal();
        });
      }
      var viewOv = el("cofreViewOverlay");
      if(viewOv && !viewOv._cofreWired){
        viewOv._cofreWired = true;
        viewOv.addEventListener("click", function(e){
          if(e.target === viewOv) LICSYSTEM.cofre.closeView();
        });
      }
      if(!LICSYSTEM.cofre._escWired){
        LICSYSTEM.cofre._escWired = true;
        document.addEventListener("keydown", function(e){
          if(e.key !== "Escape") return;
          var v = el("cofreViewOverlay");
          if(v && v.classList.contains("open")) LICSYSTEM.cofre.closeView();
        });
      }
    },

    listDocs: function(){
      var items = LICSYSTEM.cofre.items();
      if(items.length){
        return items.map(function(it){
          return { key: it.key || it.id, label: it.nome };
        });
      }
      return COFRE_DOCS.slice();
    }
  };


  ctx.COFRE_DOCS = COFRE_DOCS;
  ctx.COFRE_MAX_FILE = COFRE_MAX_FILE;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
