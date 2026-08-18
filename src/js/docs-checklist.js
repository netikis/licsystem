/* LICSYSTEM — DOCS CHECKLIST (10-docs-checklist.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  var DOCS_CHECKLIST_KEY = ctx.DOCS_CHECKLIST_KEY;
  var DOCS_ACCORDION_KEY = ctx.DOCS_ACCORDION_KEY;
  var COFRE_DOCS = ctx.COFRE_DOCS;

  /* ============================ DOCS CHECKLIST (edital) ============================ */
  LICSYSTEM.docsChecklist = {
    data: {
      editalNome: "",
      filename: "",
      updatedAt: 0,
      documentos: []
    },

    emptyData: function(){
      return { editalNome: "", filename: "", updatedAt: 0, documentos: [] };
    },

    load: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(DOCS_CHECKLIST_KEY) || "null");
        if(raw && typeof raw === "object" && !Array.isArray(raw)){
          LICSYSTEM.docsChecklist.applyData(raw, { skipPersist: true });
        } else {
          LICSYSTEM.docsChecklist.data = LICSYSTEM.docsChecklist.emptyData();
        }
      }catch(e){
        LICSYSTEM.docsChecklist.data = LICSYSTEM.docsChecklist.emptyData();
      }
    },

    applyData: function(data, opts){
      opts = opts || {};
      var src = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
      var docs = Array.isArray(src.documentos) ? src.documentos : [];
      LICSYSTEM.docsChecklist.data = {
        editalNome: String(src.editalNome || "").slice(0, 220),
        filename: String(src.filename || "").slice(0, 220),
        updatedAt: Number(src.updatedAt || 0) || 0,
        documentos: docs.map(function(d, i){
          return LICSYSTEM.docsChecklist.normalizeItem(d, i);
        })
      };
      if(!opts.skipPersist){
        try{ localStorage.setItem(DOCS_CHECKLIST_KEY, JSON.stringify(LICSYSTEM.docsChecklist.data)); }catch(e){}
      }
      if(LICSYSTEM.state.currentView === "docsChecklist"){
        try{ LICSYSTEM.docsChecklist.render(); }catch(e){}
      }
    },

    normalizeItem: function(d, idx){
      d = d || {};
      var id = String(d.id || ("doc_" + Date.now() + "_" + (idx || 0)));
      return {
        id: id,
        nome: String(d.nome || "").trim().slice(0, 220) || "Documento",
        tipo: LICSYSTEM.docsChecklist.normTipo(d.tipo),
        obs: String(d.obs || "").trim().slice(0, 400),
        ok: !!d.ok,
        cofreKey: d.cofreKey ? String(d.cofreKey) : null,
        manual: !!d.manual
      };
    },

    normTipo: function(tipo){
      var t = String(tipo || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      if(t.indexOf("tecnic") !== -1) return "tecnica";
      if(t.indexOf("habilit") !== -1 || t.indexOf("jurid") !== -1 || t.indexOf("fiscal") !== -1 || t.indexOf("econom") !== -1){
        return "habilitacao";
      }
      return "outro";
    },

    tipoLabel: function(tipo){
      var t = LICSYSTEM.docsChecklist.normTipo(tipo);
      if(t === "tecnica") return "Técnica";
      if(t === "habilitacao") return "Habilitação";
      return "Outro";
    },

    normText: function(s){
      var t = String(s || "").toLowerCase();
      try{ t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }catch(e){}
      return t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    },

    matchCofre: function(nome){
      var n = LICSYSTEM.docsChecklist.normText(nome);
      if(!n) return null;
      var aliases = {
        cnpj: ["cnpj", "cartao cnpj", "comprovante de inscricao", "cadastro nacional"],
        cndFederal: ["cnd federal", "receita federal", "divida ativa da uniao", "certidao conjunta federal", "pgfn"],
        cndEstadual: ["cnd estadual", "fazenda estadual", "icms", "certidao estadual"],
        cndMunicipal: ["cnd municipal", "fazenda municipal", "iss", "certidao municipal"],
        fgts: ["fgts", "crf", "caixa economica", "regularidade do fgts"],
        cndt: ["cndt", "inss", "trabalhista", "debito trabalhista", "tst"],
        balanco: ["balanco", "balanco patrimonial", "demonstracoes contabeis", "indice de liquidez"],
        contratoSocial: ["contrato social", "estatuto social", "ato constitutivo", "alteracao contratual"]
      };
      var best = null;
      var bestScore = 0;
      function scoreDoc(key, label){
        var labelN = LICSYSTEM.docsChecklist.normText(label);
        var score = 0;
        if(!labelN) return;
        if(n.indexOf(labelN) !== -1 || labelN.indexOf(n) !== -1) score = 8;
        var words = labelN.split(" ").filter(function(w){ return w.length > 2; });
        words.forEach(function(w){ if(n.indexOf(w) !== -1) score += 2; });
        (aliases[key] || []).forEach(function(a){
          if(n.indexOf(a) !== -1) score += 5;
        });
        if(score > bestScore){
          bestScore = score;
          best = { key: key, label: label };
        }
      }
      COFRE_DOCS.forEach(function(doc){ scoreDoc(doc.key, doc.label); });
      // Também considera documentos customizados no cofre
      LICSYSTEM.cofre.items().forEach(function(it){
        scoreDoc(it.key || it.id, it.nome);
      });
      if(bestScore < 5) return null;
      return best;
    },

    persist: function(opts){
      opts = opts || {};
      LICSYSTEM.docsChecklist.data.updatedAt = Date.now();
      try{
        localStorage.setItem(DOCS_CHECKLIST_KEY, JSON.stringify(LICSYSTEM.docsChecklist.data));
      }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("docsChecklist", {
          updatedAt: LICSYSTEM.docsChecklist.data.updatedAt,
          immediate: !!opts.immediate
        });
      }
    },

    setFromAnalysis: function(docs, meta){
      meta = meta || {};
      var prevOk = {};
      (LICSYSTEM.docsChecklist.data.documentos || []).forEach(function(d){
        var k = LICSYSTEM.docsChecklist.normText(d.nome);
        if(k) prevOk[k] = !!d.ok;
      });
      var list = (Array.isArray(docs) ? docs : []).map(function(d, i){
        var item = LICSYSTEM.docsChecklist.normalizeItem(d, i);
        var match = LICSYSTEM.docsChecklist.matchCofre(item.nome);
        if(match){
          item.cofreKey = match.key;
          var val = LICSYSTEM.cofre.getValidade(match.key);
          var st = LICSYSTEM.cofre.statusOf(val);
          // Auto-sugerir OK se cofre tem data válida (não vencido)
          if(st && st.cls === "b-green" && !item.ok) item.ok = true;
        }
        var pk = LICSYSTEM.docsChecklist.normText(item.nome);
        if(pk && prevOk[pk] != null) item.ok = prevOk[pk];
        return item;
      });
      LICSYSTEM.docsChecklist.data = {
        editalNome: String(meta.editalNome || meta.filename || "Edital analisado").slice(0, 220),
        filename: String(meta.filename || "").slice(0, 220),
        updatedAt: Date.now(),
        documentos: list
      };
      LICSYSTEM.docsChecklist.persist({ immediate: true });
      LICSYSTEM.docsChecklist.render();
    },

    summary: function(docs){
      var list = Array.isArray(docs) ? docs : (LICSYSTEM.docsChecklist.data.documentos || []);
      var ok = 0;
      list.forEach(function(d){ if(d.ok) ok++; });
      return { total: list.length, ok: ok, pend: Math.max(0, list.length - ok) };
    },

    sameEdital: function(a, b){
      a = a || {};
      b = b || {};
      var af = LICSYSTEM.docsChecklist.normText(a.filename);
      var bf = LICSYSTEM.docsChecklist.normText(b.filename);
      if(af && bf && af === bf) return true;
      var an = LICSYSTEM.docsChecklist.normText(a.editalNome || a.titulo);
      var bn = LICSYSTEM.docsChecklist.normText(b.editalNome || b.titulo);
      return !!(an && bn && an === bn);
    },

    loadExpandStore: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(DOCS_ACCORDION_KEY) || "{}");
        return (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
      }catch(e){
        return {};
      }
    },

    isExpanded: function(sessionId){
      var store = LICSYSTEM.docsChecklist.loadExpandStore();
      return !!store[String(sessionId || "")];
    },

    setExpanded: function(sessionId, expanded){
      var store = LICSYSTEM.docsChecklist.loadExpandStore();
      var key = String(sessionId || "");
      if(!key) return;
      if(expanded) store[key] = true;
      else delete store[key];
      try{ localStorage.setItem(DOCS_ACCORDION_KEY, JSON.stringify(store)); }catch(e){}
    },

    collectSessions: function(){
      var data = LICSYSTEM.docsChecklist.data || LICSYSTEM.docsChecklist.emptyData();
      var chkDocs = data.documentos || [];
      var hasChecklist = !!(chkDocs.length || data.editalNome || data.filename);
      var usedChecklist = false;
      var sessions = [];
      var lpItems = (LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.items)
        ? LICSYSTEM.leiloesParticipo.items.filter(function(it){
            return it && it.status !== "arquivado" && Array.isArray(it.documentosExigidos) && it.documentosExigidos.length;
          })
        : [];

      lpItems.sort(function(a, b){
        return (Number(b.updatedAt || b.dataAnalise || 0) || 0) - (Number(a.updatedAt || a.dataAnalise || 0) || 0);
      });

      lpItems.forEach(function(it){
        var matchChk = hasChecklist && LICSYSTEM.docsChecklist.sameEdital(data, {
          editalNome: it.titulo,
          filename: it.filename
        });
        var docs;
        var updatedAt;
        if(matchChk){
          docs = chkDocs.map(function(d, i){ return LICSYSTEM.docsChecklist.normalizeItem(d, i); });
          updatedAt = data.updatedAt || it.updatedAt || it.dataAnalise || 0;
          usedChecklist = true;
        } else {
          docs = (it.documentosExigidos || []).map(function(d, i){
            return LICSYSTEM.docsChecklist.normalizeItem(d, i);
          });
          updatedAt = it.updatedAt || it.dataAnalise || 0;
        }
        sessions.push({
          id: String(it.id),
          source: "leilao",
          leilaoId: String(it.id),
          editalNome: it.titulo || it.filename || "Edital",
          filename: it.filename || "",
          updatedAt: Number(updatedAt) || 0,
          documentos: docs,
          usesChecklist: matchChk
        });
      });

      if(hasChecklist && !usedChecklist){
        sessions.unshift({
          id: "checklist",
          source: "checklist",
          leilaoId: null,
          editalNome: data.editalNome || data.filename || "Checklist",
          filename: data.filename || "",
          updatedAt: Number(data.updatedAt) || 0,
          documentos: chkDocs.map(function(d, i){ return LICSYSTEM.docsChecklist.normalizeItem(d, i); }),
          usesChecklist: true
        });
      }

      return sessions;
    },

    findLeilao: function(leilaoId){
      var items = (LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.items) || [];
      for(var i = 0; i < items.length; i++){
        if(String(items[i].id) === String(leilaoId)) return items[i];
      }
      return null;
    },

    renderDocRows: function(docs, sessionId){
      var html = "";
      (docs || []).forEach(function(d){
        var match = d.cofreKey && LICSYSTEM.cofre.findByKey(d.cofreKey)
          ? { key: d.cofreKey, label: LICSYSTEM.cofre.getLabel(d.cofreKey) }
          : LICSYSTEM.docsChecklist.matchCofre(d.nome);
        var cofreHint = "";
        if(match && LICSYSTEM.cofre.findByKey(match.key)){
          var val = LICSYSTEM.cofre.getValidade(match.key);
          var st = LICSYSTEM.cofre.statusOf(val);
          cofreHint =
            '<span class="docs-badge cofre">Encontrado no cofre: ' + utils.escapeHtml(match.label) +
            (st ? " · " + utils.escapeHtml(st.txt) : "") + "</span>";
          d.cofreKey = match.key;
        }
        html +=
          '<div class="docs-row' + (d.ok ? " is-ok" : "") + '" data-id="' + utils.escapeHtml(d.id) + '" data-session="' + utils.escapeHtml(sessionId) + '">' +
            '<label class="docs-ok"><input type="checkbox" class="docsOkChk"' + (d.ok ? " checked" : "") + ' /> OK</label>' +
            '<div>' +
              '<div class="docs-name">' + utils.escapeHtml(d.nome) + "</div>" +
              (d.obs ? '<div class="docs-obs">' + utils.escapeHtml(d.obs) + "</div>" : "") +
              '<div class="docs-badges">' +
                '<span class="docs-badge">' + utils.escapeHtml(LICSYSTEM.docsChecklist.tipoLabel(d.tipo)) + "</span>" +
                (d.ok ? '<span class="docs-badge ok">Tenho</span>' : "") +
                cofreHint +
              "</div>" +
            "</div>" +
            '<div class="docs-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm docsRemove" title="Remover">✕</button>' +
            "</div>" +
          "</div>";
      });
      return html;
    },

    render: function(){
      var box = el("docsList");
      var meta = el("docsMeta");
      var sum = el("docsSummary");
      if(!box) return;

      if(meta){
        meta.style.display = "none";
        meta.innerHTML = "";
      }

      var sessions = LICSYSTEM.docsChecklist.collectSessions();
      var totalAll = 0;
      var okAll = 0;
      sessions.forEach(function(s){
        var sm = LICSYSTEM.docsChecklist.summary(s.documentos);
        totalAll += sm.total;
        okAll += sm.ok;
      });
      var pendAll = Math.max(0, totalAll - okAll);

      if(sum){
        if(!sessions.length){
          sum.innerHTML = "";
        } else {
          sum.innerHTML =
            '<span class="docs-pill">' + sessions.length + " edital" + (sessions.length === 1 ? "" : "is") + "</span>" +
            '<span class="docs-pill">' + totalAll + " documento" + (totalAll === 1 ? "" : "s") + "</span>" +
            '<span class="docs-pill ok">' + okAll + " OK</span>" +
            '<span class="docs-pill pend">' + pendAll + " pendente" + (pendAll === 1 ? "" : "s") + "</span>";
        }
      }

      if(!sessions.length){
        box.innerHTML = '<div class="muted small">Nenhum checklist ainda. Rode a <b>Análise IA</b> em um edital para gerar a lista, ou adicione um documento manualmente.</div>';
        return;
      }

      var html = "";
      sessions.forEach(function(sess){
        var expanded = LICSYSTEM.docsChecklist.isExpanded(sess.id);
        var sm = LICSYSTEM.docsChecklist.summary(sess.documentos);
        var nome = sess.editalNome || sess.filename || "Edital";
        var updatedTxt = sess.updatedAt
          ? utils.escapeHtml(new Date(sess.updatedAt).toLocaleString("pt-BR"))
          : "";
        html +=
          '<div class="docs-accordion' + (expanded ? " is-open" : "") + '" data-session="' + utils.escapeHtml(sess.id) + '">' +
            '<button type="button" class="docs-acc-head" aria-expanded="' + (expanded ? "true" : "false") + '">' +
              '<span class="docs-acc-chevron" aria-hidden="true">' + (expanded ? "▾" : "▸") + "</span>" +
              '<span class="docs-acc-meta">' +
                '<span class="docs-acc-title">Edital: <b class="docs-edital-name">' + utils.escapeHtml(nome) + "</b></span>" +
                (sess.filename ? '<span class="docs-acc-file">' + utils.escapeHtml(sess.filename) + "</span>" : "") +
                (updatedTxt ? '<span class="docs-acc-updated">Atualizado: ' + updatedTxt + "</span>" : "") +
              "</span>" +
              '<span class="docs-acc-pills">' +
                '<span class="docs-pill">' + sm.total + "</span>" +
                '<span class="docs-pill ok">' + sm.ok + " OK</span>" +
                '<span class="docs-pill pend">' + sm.pend + " pend.</span>" +
              "</span>" +
            "</button>" +
            '<div class="docs-acc-body"' + (expanded ? "" : " hidden") + ">" +
              (sm.total
                ? LICSYSTEM.docsChecklist.renderDocRows(sess.documentos, sess.id)
                : '<div class="muted small">Nenhum documento neste edital.</div>') +
            "</div>" +
          "</div>";
      });
      box.innerHTML = html;

      box.querySelectorAll(".docs-acc-head").forEach(function(btn){
        btn.addEventListener("click", function(){
          var acc = btn.closest(".docs-accordion");
          if(!acc) return;
          var sid = acc.getAttribute("data-session");
          var open = !acc.classList.contains("is-open");
          acc.classList.toggle("is-open", open);
          btn.setAttribute("aria-expanded", open ? "true" : "false");
          var chev = btn.querySelector(".docs-acc-chevron");
          if(chev) chev.textContent = open ? "▾" : "▸";
          var body = acc.querySelector(".docs-acc-body");
          if(body) body.hidden = !open;
          LICSYSTEM.docsChecklist.setExpanded(sid, open);
        });
      });

      box.querySelectorAll(".docsOkChk").forEach(function(chk){
        chk.addEventListener("change", function(){
          var row = chk.closest(".docs-row");
          var id = row && row.getAttribute("data-id");
          var sid = row && row.getAttribute("data-session");
          LICSYSTEM.docsChecklist.setOk(id, chk.checked, sid);
        });
      });
      box.querySelectorAll(".docsRemove").forEach(function(btn){
        btn.addEventListener("click", function(){
          var row = btn.closest(".docs-row");
          var id = row && row.getAttribute("data-id");
          var sid = row && row.getAttribute("data-session");
          LICSYSTEM.docsChecklist.remove(id, sid);
        });
      });
    },

    resolveSession: function(sessionId){
      var sessions = LICSYSTEM.docsChecklist.collectSessions();
      var sid = String(sessionId || "");
      for(var i = 0; i < sessions.length; i++){
        if(String(sessions[i].id) === sid) return sessions[i];
      }
      if(sessions.length === 1) return sessions[0];
      return null;
    },

    setOk: function(id, ok, sessionId){
      var sess = LICSYSTEM.docsChecklist.resolveSession(sessionId);
      var ref = null;
      if(sess){
        for(var r = 0; r < (sess.documentos || []).length; r++){
          if(String(sess.documentos[r].id) === String(id)){ ref = sess.documentos[r]; break; }
        }
      }

      if(!sess || sess.usesChecklist || sess.source === "checklist"){
        var docs = LICSYSTEM.docsChecklist.data.documentos || [];
        for(var j = 0; j < docs.length; j++){
          if(docs[j].id === id || (ref && LICSYSTEM.docsChecklist.normText(docs[j].nome) === LICSYSTEM.docsChecklist.normText(ref.nome))){
            docs[j].ok = !!ok;
            break;
          }
        }
        LICSYSTEM.docsChecklist.persist();
      }

      if(sess && sess.leilaoId){
        var item = LICSYSTEM.docsChecklist.findLeilao(sess.leilaoId);
        if(item){
          var lpDocs = item.documentosExigidos || [];
          for(var k = 0; k < lpDocs.length; k++){
            if(String(lpDocs[k].id) === String(id) ||
              (ref && LICSYSTEM.docsChecklist.normText(lpDocs[k].nome) === LICSYSTEM.docsChecklist.normText(ref.nome))){
              lpDocs[k].ok = !!ok;
              break;
            }
          }
          item.updatedAt = Date.now();
          LICSYSTEM.leiloesParticipo.persist();
        }
      }

      LICSYSTEM.docsChecklist.render();
    },

    remove: function(id, sessionId){
      var sess = LICSYSTEM.docsChecklist.resolveSession(sessionId);
      var ref = null;
      if(sess){
        for(var r = 0; r < (sess.documentos || []).length; r++){
          if(String(sess.documentos[r].id) === String(id)){ ref = sess.documentos[r]; break; }
        }
      }

      if(!sess || sess.usesChecklist || sess.source === "checklist"){
        LICSYSTEM.docsChecklist.data.documentos = (LICSYSTEM.docsChecklist.data.documentos || []).filter(function(d){
          if(d.id === id) return false;
          if(ref && LICSYSTEM.docsChecklist.normText(d.nome) === LICSYSTEM.docsChecklist.normText(ref.nome)) return false;
          return true;
        });
        LICSYSTEM.docsChecklist.persist();
      }

      if(sess && sess.leilaoId){
        var item = LICSYSTEM.docsChecklist.findLeilao(sess.leilaoId);
        if(item){
          item.documentosExigidos = (item.documentosExigidos || []).filter(function(d){
            if(String(d.id) === String(id)) return false;
            if(ref && LICSYSTEM.docsChecklist.normText(d.nome) === LICSYSTEM.docsChecklist.normText(ref.nome)) return false;
            return true;
          });
          item.updatedAt = Date.now();
          LICSYSTEM.leiloesParticipo.persist();
        }
      }

      LICSYSTEM.docsChecklist.render();
    },

    addManual: function(){
      var nome = window.prompt("Nome do documento exigido:");
      if(nome == null) return;
      nome = String(nome).trim();
      if(!nome) return;
      var item = LICSYSTEM.docsChecklist.normalizeItem({
        nome: nome,
        tipo: "outro",
        obs: "Adicionado manualmente",
        manual: true,
        ok: false
      }, (LICSYSTEM.docsChecklist.data.documentos || []).length);
      var match = LICSYSTEM.docsChecklist.matchCofre(item.nome);
      if(match) item.cofreKey = match.key;
      LICSYSTEM.docsChecklist.data.documentos.push(item);
      if(!LICSYSTEM.docsChecklist.data.editalNome){
        LICSYSTEM.docsChecklist.data.editalNome = "Checklist manual";
      }
      LICSYSTEM.docsChecklist.persist();
      LICSYSTEM.docsChecklist.render();
      showAlert("docsAlert", "ok", "Documento adicionado.");
    },

    clearOk: function(){
      var sessions = LICSYSTEM.docsChecklist.collectSessions();
      var any = false;
      sessions.forEach(function(s){
        (s.documentos || []).forEach(function(d){ if(d.ok) any = true; });
      });
      if(!any && !(LICSYSTEM.docsChecklist.data.documentos || []).length) return;
      if(!confirm("Limpar todos os OK marcados?")) return;

      (LICSYSTEM.docsChecklist.data.documentos || []).forEach(function(d){ d.ok = false; });
      LICSYSTEM.docsChecklist.persist();

      sessions.forEach(function(s){
        if(!s.leilaoId) return;
        var item = LICSYSTEM.docsChecklist.findLeilao(s.leilaoId);
        if(!item) return;
        (item.documentosExigidos || []).forEach(function(d){ d.ok = false; });
        item.updatedAt = Date.now();
      });
      if(LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.persist){
        LICSYSTEM.leiloesParticipo.persist();
      }
      LICSYSTEM.docsChecklist.render();
    },

    save: function(){
      LICSYSTEM.docsChecklist.persist({ immediate: true });
      showAlert("docsAlert", "ok", "Checklist salvo" + (LICSYSTEM.cloudSync && LICSYSTEM.cloudSync._uid ? " (sincronizando…)" : "") + ".");
    },

    showModal: function(docs, meta){
      meta = meta || {};
      var ov = el("docsOverlay");
      var list = el("docsModalList");
      var lead = el("docsModalLead");
      if(!ov || !list) return;
      var arr = Array.isArray(docs) ? docs : [];
      if(lead){
        lead.textContent = arr.length
          ? ("A IA identificou " + arr.length + " documento" + (arr.length === 1 ? "" : "s") + " exigido" + (arr.length === 1 ? "" : "s") + ". Confira e marque o que você já tem.")
          : "Não foi possível listar documentos estruturados. Você ainda pode abrir o checklist e adicionar manualmente.";
      }
      if(!arr.length){
        list.innerHTML = '<div class="muted small">Nenhum documento estruturado retornado. Use o botão abaixo para abrir a tela e incluir itens.</div>';
      } else {
        list.innerHTML = arr.map(function(d){
          var tipo = LICSYSTEM.docsChecklist.normTipo(d.tipo);
          return (
            '<div class="docs-modal-item">' +
              '<span class="di-tipo t-' + tipo + '">' + utils.escapeHtml(LICSYSTEM.docsChecklist.tipoLabel(tipo)) + "</span>" +
              '<div class="di-body">' +
                '<div class="di-nome">' + utils.escapeHtml(d.nome || "Documento") + "</div>" +
                (d.obs ? '<div class="di-obs">' + utils.escapeHtml(d.obs) + "</div>" : "") +
              "</div>" +
            "</div>"
          );
        }).join("");
      }
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
      LICSYSTEM.docsChecklist._pendingMeta = meta;
      LICSYSTEM.docsChecklist._pendingDocs = arr;
    },

    closeModal: function(opts){
      opts = opts || {};
      var ov = el("docsOverlay");
      if(!ov) return;
      var wasOpen = ov.classList.contains("open");
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
      if(wasOpen && !opts.skipParticiparAsk && LICSYSTEM.analiseIa && LICSYSTEM.analiseIa._pendingParticiparAsk){
        LICSYSTEM.analiseIa._pendingParticiparAsk = false;
        setTimeout(function(){
          try{ LICSYSTEM.leiloesParticipo.showParticiparModal(); }catch(e){}
        }, 180);
      }
    },

    goFromModal: function(){
      var docs = LICSYSTEM.docsChecklist._pendingDocs;
      var meta = LICSYSTEM.docsChecklist._pendingMeta || {};
      if(Array.isArray(docs) && docs.length){
        LICSYSTEM.docsChecklist.setFromAnalysis(docs, meta);
      } else if(!(LICSYSTEM.docsChecklist.data.documentos || []).length){
        LICSYSTEM.docsChecklist.data.editalNome = meta.editalNome || meta.filename || "Edital analisado";
        LICSYSTEM.docsChecklist.data.filename = meta.filename || "";
        LICSYSTEM.docsChecklist.persist();
      }
      LICSYSTEM.docsChecklist.closeModal();
      if(window.__lsActivateView) window.__lsActivateView("docsChecklist");
      else LICSYSTEM.docsChecklist.render();
    }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
