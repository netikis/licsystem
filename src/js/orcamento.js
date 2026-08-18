/* LICSYSTEM — ORCAMENTO (07-orcamento.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var ORC_KEY = ctx.ORC_KEY;
  var ORC_KEY_LEGACY = ctx.ORC_KEY_LEGACY;
  function licsystemPdfHeader(){
    var fn = ctx.licsystemPdfHeader || window.licsystemPdfHeader || LICSYSTEM.licsystemPdfHeader;
    if (typeof fn !== "function") throw new Error("licsystemPdfHeader ainda não disponível");
    return fn.apply(this, arguments);
  }
  function wireOrcFileInput(){
    var fn = ctx.wireOrcFileInput || window.wireOrcFileInput || LICSYSTEM.wireOrcFileInput;
    if (typeof fn !== "function") throw new Error("wireOrcFileInput ainda não disponível");
    return fn.apply(this, arguments);
  }
  function listarProdutos(){
    var fn = ctx.listarProdutos || window.listarProdutos || LICSYSTEM.listarProdutos;
    if (typeof fn !== "function") throw new Error("listarProdutos ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ ORÇAMENTO ============================ */
  LICSYSTEM.orcamento = {
    emptyItem:function(){
      return {lote:"", qtd:1, qtdEstoque:0, produto:"", editalVunit:0, editalTotal:0, vunit:0, vvenda:0, pct:0, link:"", compensa:null};
    },
    normalizeItem:function(it){
      it = it || {};
      var qtd = Number(it.qtd); if(!isFinite(qtd) || qtd < 0) qtd = 1;
      var qtdEstoque = Number(it.qtdEstoque != null ? it.qtdEstoque : (it.estoque != null ? it.estoque : 0));
      if(!isFinite(qtdEstoque) || qtdEstoque < 0) qtdEstoque = 0;
      var editalVunit = Number(it.editalVunit != null ? it.editalVunit : 0) || 0;
      var editalTotal = Number(it.editalTotal != null ? it.editalTotal : 0) || 0;
      if(!editalTotal && editalVunit) editalTotal = qtd * editalVunit;
      if(!editalVunit && editalTotal && qtd) editalVunit = editalTotal / qtd;
      var vunit = Number(it.vunit) || 0;
      var pct = Number(it.pct) || 0;
      var vvenda = Number(it.vvenda != null ? it.vvenda : it.vVenda);
      if(!isFinite(vvenda) || vvenda < 0) vvenda = 0;
      if(!vvenda && vunit){
        vvenda = pct ? (vunit * (1 + pct / 100)) : vunit;
      }
      if(vunit > 0 && vvenda > 0 && !pct){
        pct = ((vvenda - vunit) / vunit) * 100;
      }
      var row = {
        lote: it.lote != null && it.lote !== "" ? String(it.lote) : "",
        qtd: qtd,
        qtdEstoque: qtdEstoque,
        produto: String(it.produto || it.descricao || ""),
        editalVunit: editalVunit,
        editalTotal: editalTotal,
        vunit: vunit,
        vvenda: Math.round(vvenda * 10000) / 10000,
        pct: Math.round(pct * 1000) / 1000,
        link: String(it.link || ""),
        compensa: null
      };
      row.compensa = LICSYSTEM.orcamento.evalCompensa(row);
      return row;
    },

    /** Margem % a partir do custo (vunit) e do V. Venda. */
    calcPctFromVenda:function(vunit, vvenda){
      vunit = Number(vunit) || 0;
      vvenda = Number(vvenda) || 0;
      if(vunit <= 0) return 0;
      return Math.round((((vvenda - vunit) / vunit) * 100) * 1000) / 1000;
    },

    /** V. Venda a partir do custo e da %. */
    calcVendaFromPct:function(vunit, pct){
      vunit = Number(vunit) || 0;
      pct = Number(pct) || 0;
      return Math.round((vunit * (1 + pct / 100)) * 10000) / 10000;
    },

    /**
     * Mantém vunit ↔ vvenda ↔ % sincronizados.
     * changed: "vunit" | "vvenda" | "pct"
     */
    syncPricing:function(it, changed){
      if(!it) return;
      var vunit = Number(it.vunit) || 0;
      var vvenda = Number(it.vvenda) || 0;
      var pct = Number(it.pct) || 0;
      if(changed === "pct"){
        it.vvenda = LICSYSTEM.orcamento.calcVendaFromPct(vunit, pct);
      } else if(changed === "vvenda"){
        it.pct = LICSYSTEM.orcamento.calcPctFromVenda(vunit, vvenda);
      } else if(changed === "vunit"){
        if(pct){
          it.vvenda = LICSYSTEM.orcamento.calcVendaFromPct(vunit, pct);
        } else if(vvenda > 0 && vunit > 0){
          it.pct = LICSYSTEM.orcamento.calcPctFromVenda(vunit, vvenda);
        } else if(vunit > 0 && !vvenda){
          it.vvenda = vunit;
          it.pct = 0;
        }
      }
      it.compensa = LICSYSTEM.orcamento.evalCompensa(it);
    },

    /** COMPENSA se meu V. Final < V. Final do edital; NÃO COMPENSA se maior. */
    evalCompensa:function(it){
      var meus = LICSYSTEM.orcamento.calcTotal(it);
      var edital = LICSYSTEM.orcamento.calcEditalTotal(it);
      if(!(meus > 0) || !(edital > 0)) return null;
      if(meus < edital) return true;
      if(meus > edital) return false;
      return true;
    },

    calcEditalTotal:function(it){
      var stored = Number(it.editalTotal)||0;
      if(stored > 0) return stored;
      return (Number(it.qtd)||0) * (Number(it.editalVunit)||0);
    },
    /** MEUS PREÇOS V. Venda unitário — cai para custo + margem quando não gravado. */
    calcVendaUnit:function(it){
      var vv = Number(it.vvenda);
      if(isFinite(vv) && vv > 0) return vv;
      return (Number(it.vunit) || 0) * (1 + (Number(it.pct) || 0) / 100);
    },
    /** MEUS PREÇOS V. Final = Qtd do edital × V. Venda */
    calcTotal:function(it){
      return (Number(it.qtd) || 0) * LICSYSTEM.orcamento.calcVendaUnit(it);
    },
    isEmptyRow:function(it){
      if(!it) return true;
      return !String(it.produto||"").trim() && !Number(it.vunit) && !Number(it.editalVunit) && !String(it.lote||"").trim();
    },
    load:function(){
      try{
        var raw = JSON.parse(localStorage.getItem(ORC_KEY) || "null");
        if(raw == null && ORC_KEY_LEGACY){
          raw = JSON.parse(localStorage.getItem(ORC_KEY_LEGACY) || "null");
        }
        var items = null;
        // v2 object: { v, items, meta, page } — legacy: bare array
        if(raw && Array.isArray(raw)){
          items = raw;
        } else if(raw && typeof raw === "object" && Array.isArray(raw.items)){
          items = raw.items;
          var meta = raw.meta || {};
          LICSYSTEM.state.orcMetaNome = meta.nome != null ? String(meta.nome) : (LICSYSTEM.state.orcMetaNome || "");
          LICSYSTEM.state.orcMetaNumero = meta.numero != null ? String(meta.numero) : (LICSYSTEM.state.orcMetaNumero || "");
          LICSYSTEM.state.orcCatalogId = meta.catalogId != null ? meta.catalogId : (LICSYSTEM.state.orcCatalogId || null);
          if(raw.page != null) LICSYSTEM.state.orcPage = Math.max(1, Number(raw.page) || 1);
        }
        if(items){
          LICSYSTEM.state.orcItems = items.map(function(it){ return LICSYSTEM.orcamento.normalizeItem(it); });
        }
      }catch(e){}
      if(!LICSYSTEM.state.orcItems.length){
        LICSYSTEM.state.orcItems = [ LICSYSTEM.orcamento.emptyItem() ];
      }
      LICSYSTEM.orcamento.updateMeta();
    },
    save:function(opts){
      opts = opts || {};
      try{
        var now = Date.now();
        var boundId = LICSYSTEM.state.orcBoundLeilaoId || null;
        if(!boundId && LICSYSTEM.state.activeLeilaoId && opts.bindActive){
          boundId = String(LICSYSTEM.state.activeLeilaoId);
          LICSYSTEM.state.orcBoundLeilaoId = boundId;
        }
        var payload = {
          v: 2,
          items: (LICSYSTEM.state.orcItems || []).map(function(it){
            return LICSYSTEM.orcamento.normalizeItem(it);
          }),
          meta: {
            nome: LICSYSTEM.state.orcMetaNome || "",
            numero: LICSYSTEM.state.orcMetaNumero || "",
            catalogId: LICSYSTEM.state.orcCatalogId || null
          },
          page: LICSYSTEM.state.orcPage || 1,
          leilaoId: boundId || "",
          savedAt: now,
          updatedAt: now,
          immediate: !!opts.immediate
        };
        if(opts.forceClear) payload.cleared = true;
        // Sempre grava rascunho global + nuvem (para não sumir ao atualizar).
        try{ localStorage.setItem(ORC_KEY, JSON.stringify(payload)); }catch(e){}
        if(!opts.skipCloud && LICSYSTEM.cloudSync){
          LICSYSTEM.cloudSync.notifyLocalChange("orcamento", {
            updatedAt: now,
            forceClear: !!opts.forceClear,
            immediate: !!opts.immediate
          });
        }
        // Só espelha no workspace do edital ao qual a planilha pertence.
        if(
          boundId &&
          LICSYSTEM.state.activeLeilaoId &&
          String(boundId) === String(LICSYSTEM.state.activeLeilaoId) &&
          LICSYSTEM.leiloesParticipo &&
          LICSYSTEM.leiloesParticipo.syncActiveOrcamento
        ){
          LICSYSTEM.leiloesParticipo.syncActiveOrcamento(Object.assign({}, payload, { immediate: !!opts.immediate }));
        }
      }catch(e){
        console.warn("Orçamento: não foi possível salvar tudo no navegador (limite de armazenamento).", e);
      }
    },
    /** Salva na hora (estilo Word) e sincroniza com o banco — sem ir ao catálogo. */
    salvarAgora:function(){
      function showSavedFeedback(msg){
        try{
          showAlert("orcAlert", "ok", msg || "✅ <b>ORÇAMENTO SALVO</b>");
          var alertEl = el("orcAlert");
          if(alertEl && alertEl.scrollIntoView){
            alertEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
          }
        }catch(e){}
        try{
          var toast = el("orcSaveToast");
          if(!toast){
            toast = document.createElement("div");
            toast.id = "orcSaveToast";
            document.body.appendChild(toast);
          }
          toast.textContent = "ORÇAMENTO SALVO";
          toast.className = "show";
          clearTimeout(LICSYSTEM.orcamento._toastTimer);
          LICSYSTEM.orcamento._toastTimer = setTimeout(function(){ toast.className = ""; }, 2800);
        }catch(e){}
        try{
          if(LICSYSTEM.cloudSync && LICSYSTEM.cloudSync.setStatus){
            LICSYSTEM.cloudSync.setStatus("ok", "ORÇAMENTO SALVO");
          }
        }catch(e){}
        var btn = el("btnSalvarOrcamento") || el("btnSalvarOrc");
        if(btn){
          if(!btn.getAttribute("data-prev-html")) btn.setAttribute("data-prev-html", btn.innerHTML);
          btn.innerHTML = "✅ ORÇAMENTO SALVO";
          btn.disabled = true;
          clearTimeout(LICSYSTEM.orcamento._salvarBtnTimer);
          LICSYSTEM.orcamento._salvarBtnTimer = setTimeout(function(){
            var prev = btn.getAttribute("data-prev-html");
            if(prev) btn.innerHTML = prev;
            btn.disabled = false;
            btn.removeAttribute("data-prev-html");
          }, 2800);
        }
      }

      // Feedback na hora — antes do save pesado (evita botão “morto”).
      showSavedFeedback("✅ <b>ORÇAMENTO SALVO</b> — gravando…");

      setTimeout(function(){
        try{
          if(LICSYSTEM.state.activeLeilaoId && !LICSYSTEM.state.orcBoundLeilaoId){
            LICSYSTEM.state.orcBoundLeilaoId = String(LICSYSTEM.state.activeLeilaoId);
          }
          try{ LICSYSTEM.orcamento.syncFromDom(); }catch(e){}
          LICSYSTEM.orcamento.flushSave({ immediate: true, bindActive: true });
          LICSYSTEM.state._orcDirty = false;
          try{
            if(LICSYSTEM.state.activeLeilaoId && LICSYSTEM.leiloesParticipo){
              LICSYSTEM.leiloesParticipo.saveActiveWorkspace({ immediate: true });
            }
          }catch(e){}
          try{
            if(LICSYSTEM.cloudSync){
              // Sem edital: sync orçamento global. Com edital: só o workspace (evita vazamento A↔B).
              if(!LICSYSTEM.state.activeLeilaoId){
                LICSYSTEM.cloudSync.flushPush("orcamento", { immediate: true });
              }
              LICSYSTEM.cloudSync.flushPush("leiloesParticipo", { immediate: true });
            }
          }catch(e){}

          var n = (LICSYSTEM.state.orcItems || []).filter(function(it){
            return LICSYSTEM.orcamento && !LICSYSTEM.orcamento.isEmptyRow(it);
          }).length;
          var editalNome = "";
          try{
            var active = LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.getActiveItem
              ? LICSYSTEM.leiloesParticipo.getActiveItem() : null;
            if(active) editalNome = active.titulo || active.filename || "";
          }catch(e){}
          showSavedFeedback(
            "✅ <b>ORÇAMENTO SALVO</b>" +
            (editalNome ? " — <b>" + utils.escapeHtml(String(editalNome).slice(0, 80)) + "</b>" : "") +
            " · " + n + " item(ns) gravado(s) neste edital."
          );
        }catch(err){
          console.warn("salvarAgora", err);
          showAlert("orcAlert", "error", "❌ Falha ao salvar. Tente de novo (Ctrl+F5 se persistir).");
        }
      }, 0);
    },
    scheduleSave:function(){
      clearTimeout(LICSYSTEM.orcamento._saveTimer);
      LICSYSTEM.orcamento._saveTimer = setTimeout(function(){
        LICSYSTEM.orcamento._saveTimer = null;
        LICSYSTEM.orcamento.save();
        LICSYSTEM.state._orcDirty = false;
      }, 400);
    },
    flushSave:function(opts){
      opts = opts || {};
      clearTimeout(LICSYSTEM.orcamento._saveTimer);
      LICSYSTEM.orcamento._saveTimer = null;
      LICSYSTEM.orcamento.syncFromDom();
      LICSYSTEM.orcamento.save(opts);
      LICSYSTEM.state._orcDirty = false;
    },
    /** Pull live input values into state (covers pending keystrokes before leave). */
    syncFromDom:function(){
      // DOM desatualizado após trocar de edital — não misturar planilhas.
      if(LICSYSTEM.state._orcRendered === false) return;
      if(
        LICSYSTEM.state.activeLeilaoId &&
        LICSYSTEM.state.orcBoundLeilaoId &&
        String(LICSYSTEM.state.activeLeilaoId) !== String(LICSYSTEM.state.orcBoundLeilaoId)
      ){
        return;
      }
      var body = el("orcBody");
      if(!body) return;
      var inputs = body.querySelectorAll("input[data-i][data-f]");
      for(var n = 0; n < inputs.length; n++){
        var inp = inputs[n];
        var i = Number(inp.getAttribute("data-i"));
        var f = inp.getAttribute("data-f");
        var it = LICSYSTEM.state.orcItems[i];
        if(!it || !f) continue;
        if(f === "produto" || f === "link" || f === "lote"){
          if(f === "produto") continue; /* descrição bloqueada */
          it[f] = inp.value;
        } else it[f] = Number(inp.value) || 0;
        if(f === "qtd" || f === "editalVunit"){
          if(Number(it.editalVunit) > 0){
            it.editalTotal = (Number(it.qtd) || 0) * (Number(it.editalVunit) || 0);
          }
        }
        if(f === "vunit" || f === "vvenda" || f === "pct"){
          LICSYSTEM.orcamento.syncPricing(it, f);
        } else if(f === "qtd" || f === "editalVunit"){
          it.compensa = LICSYSTEM.orcamento.evalCompensa(it);
        }
      }
    },
    pageCount:function(){
      var n = LICSYSTEM.state.orcItems.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      return Math.max(1, Math.ceil(n / size) || 1);
    },
    clampPage:function(){
      var pages = LICSYSTEM.orcamento.pageCount();
      if(!LICSYSTEM.state.orcPage || LICSYSTEM.state.orcPage < 1) LICSYSTEM.state.orcPage = 1;
      if(LICSYSTEM.state.orcPage > pages) LICSYSTEM.state.orcPage = pages;
      return LICSYSTEM.state.orcPage;
    },
    updatePager:function(){
      var pager = el("orcPager");
      var info = el("orcPagerInfo");
      var prev = el("orcPrev");
      var next = el("orcNext");
      if(!pager) return;
      var total = LICSYSTEM.state.orcItems.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      var pages = LICSYSTEM.orcamento.pageCount();
      var page = LICSYSTEM.orcamento.clampPage();
      if(total <= size){
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? ((page - 1) * size + 1) : 0;
      var end = Math.min(page * size, total);
      if(info) info.innerHTML = "Itens <b>"+start+"–"+end+"</b> de <b>"+total+"</b> · Página <b>"+page+"</b>/"+pages+" (100 por página)";
      if(prev) prev.disabled = page <= 1;
      if(next) next.disabled = page >= pages;
    },
    goPage:function(delta){
      var pages = LICSYSTEM.orcamento.pageCount();
      var next = (LICSYSTEM.state.orcPage || 1) + delta;
      if(next < 1) next = 1;
      if(next > pages) next = pages;
      LICSYSTEM.state.orcPage = next;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render({ save:false });
    },
    render:function(opts){
      opts = opts || {};
      var body = el("orcBody");
      if(!body) return;
      var items = LICSYSTEM.state.orcItems;
      var n = items.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      var page = LICSYSTEM.orcamento.clampPage();
      var start = (page - 1) * size;
      var end = Math.min(start + size, n);

      var geralMeus = 0, geralEdital = 0;
      for(var g = 0; g < n; g++){
        geralMeus += LICSYSTEM.orcamento.calcTotal(items[g]);
        geralEdital += LICSYSTEM.orcamento.calcEditalTotal(items[g]);
      }

      var buf = [];
      for(var i = start; i < end; i++){
        var it = items[i];
        if(!(Number(it.vvenda) > 0) && Number(it.vunit) > 0){
          LICSYSTEM.orcamento.syncPricing(it, Number(it.pct) ? "pct" : "vunit");
        } else {
          it.compensa = LICSYSTEM.orcamento.evalCompensa(it);
        }
        var totalMeus = LICSYSTEM.orcamento.calcTotal(it);
        var totalEdital = LICSYSTEM.orcamento.calcEditalTotal(it);
        var editalUnitShow = Number(it.editalVunit)||0;
        if(!editalUnitShow && totalEdital > 0 && Number(it.qtd) > 0){
          editalUnitShow = totalEdital / Number(it.qtd);
        }
        var risco = utils.riscoMatch(it.produto);
        var flag = risco.length ? '<span class="risk-flag" title="Risco: '+utils.escapeHtml(risco.join(", "))+'">⚠</span>' : "";
        var rowCls = [];
        if(risco.length) rowCls.push("risk-row");
        if(it.compensa === true) rowCls.push("orc-row-compensa");
        else if(it.compensa === false) rowCls.push("orc-row-nao-compensa");
        var statusBadge = "";
        if(it.compensa === true){
          statusBadge = '<span class="orc-status-badge is-ok" style="background:#1e9e5a;color:#fff" title="Meu V. Final abaixo do edital">COMPENSA</span>';
        } else if(it.compensa === false){
          statusBadge = '<span class="orc-status-badge is-bad" style="background:#d23b3b;color:#fff" title="Meu V. Final acima do edital">NÃO COMPENSA</span>';
        }
        var hasLink = !!(String(it.link || "").trim());
        var btnLinkCls = "btn btn-ghost btn-sm orcOpenLink"+(hasLink ? " is-ready" : "");
        var pctShow = Number(it.pct) || 0;
        var vvendaShow = Number(it.vvenda) || 0;
        buf.push(
          '<tr class="'+rowCls.join(" ")+'" data-item-idx="'+i+'">'+
            '<td class="td-chk"><input type="checkbox" class="orcChk" data-i="'+i+'" aria-label="Selecionar lote '+(it.lote||(i+1))+'"></td>'+
            '<td class="td-lote"><input type="text" class="orc-lote" data-i="'+i+'" data-f="lote" value="'+utils.escapeHtml(it.lote)+'" placeholder="—" title="Lote ou Item do edital"></td>'+
            '<td class="td-qtd"><input type="number" class="orc-qtd" data-i="'+i+'" data-f="qtd" value="'+utils.escapeHtml(it.qtd)+'" step="1" min="0" title="Quantidade"></td>'+
            '<td><div class="orc-desc-wrap'+(risco.length?' risk-cell':'')+'">'+flag+
              '<div class="orc-produto-locked" data-i="'+i+'" title="'+utils.escapeHtml(it.produto)+'">'+(utils.escapeHtml(it.produto)||'<span class="orc-desc-vazia">Descrição do edital</span>')+'</div>'+
            '</div></td>'+
            '<td class="td-money"><input type="number" data-i="'+i+'" data-f="editalVunit" value="'+utils.escapeHtml(editalUnitShow)+'" step="0.0001" min="0" title="Valor unitário do edital"></td>'+
            '<td class="td-money split-end"><span class="cell-ro" data-edital-total="'+i+'">'+utils.formatBrl(totalEdital)+'</span></td>'+
            '<td class="td-money split-start"><input type="number" data-i="'+i+'" data-f="vunit" value="'+utils.escapeHtml(it.vunit)+'" step="0.01" min="0" title="Meu valor unitário (custo)"></td>'+
            '<td class="td-money"><input type="number" data-i="'+i+'" data-f="vvenda" value="'+utils.escapeHtml(vvendaShow)+'" step="0.01" min="0" title="Valor de venda"></td>'+
            '<td class="td-pct"><input type="number" class="orc-pct" data-i="'+i+'" data-f="pct" value="'+utils.escapeHtml(pctShow)+'" step="0.1" title="Margem % (automática)"></td>'+
            '<td class="td-money"><div class="orc-final-cell"><span class="cell-total" data-meus-total="'+i+'">'+utils.formatBrl(totalMeus)+'</span>'+statusBadge+'</div></td>'+
            '<td class="td-link"><input type="text" data-i="'+i+'" data-f="link" value="'+utils.escapeHtml(it.link||"")+'" placeholder="Link"></td>'+
            '<td class="td-actions"><div class="orc-actions">'+
              '<button type="button" class="btn btn-ghost btn-sm orcGoogle" data-i="'+i+'" title="Google">G</button>'+
              '<button type="button" class="btn btn-ghost btn-sm orcMl" data-i="'+i+'" title="Mercado Livre">ML</button>'+
              '<button type="button" class="'+btnLinkCls+'" data-i="'+i+'" title="'+(hasLink?"Abrir link de acesso":"Cole um link no campo Link de Acesso")+'"'+(hasLink?"":" disabled")+'>LINK</button>'+
              '<button type="button" class="btn btn-ghost btn-sm orcDel" data-i="'+i+'" title="Remover">✕</button>'+
            '</div></td>'+
          '</tr>'
        );
      }
      if(!buf.length){
        body.innerHTML = '<tr><td colspan="12" class="orc-empty">Nenhum item nesta página. Importe o Excel do edital ou adicione uma linha.</td></tr>';
      } else {
        body.innerHTML = buf.join("");
      }
      if(el("orcTotalGeral")) el("orcTotalGeral").textContent = utils.formatBrl(geralMeus);
      if(el("orcTotalEdital")) el("orcTotalEdital").textContent = utils.formatBrl(geralEdital);
      var all = el("orcCheckAll");
      if(all) all.checked = false;
      LICSYSTEM.state._orcDirty = false;
      LICSYSTEM.state._orcRendered = true;
      LICSYSTEM.orcamento.updatePager();
      if(opts.save !== false) LICSYSTEM.orcamento.save();
    },
    addLinha:function(){
      LICSYSTEM.state.orcItems.push(LICSYSTEM.orcamento.emptyItem());
      LICSYSTEM.state.orcPage = LICSYSTEM.orcamento.pageCount();
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },
    addFromLines:function(lines){
      var added = 0;
      (lines || []).forEach(function(l){
        var itCap = utils.asCaptacaoItem(l);
        if(!itCap) return;

        // Se a descrição ainda carrega "100,000 UN ..." ou linha THEO, reparseia
        var dirty =
          /^\d{1,3}([.,]\d{3})*\s+(UN|UND|UNI|UNID)\b/i.test(itCap.produto || "") ||
          (/^\d{1,5}\s+(UN|UND|UNI|UNID|LT|BL|GAL)\b/i.test(itCap.produto || "") &&
            !(Number(itCap.editalVunit) > 0));
        if (dirty || (!itCap.editalVunit && itCap.line)) {
          var again = utils.parseLinhaEdital(itCap.line || itCap.produto);
          if (again) itCap = again;
        }

        var rawCheck = itCap.line || itCap.produto || "";
        if(!rawCheck || !utils.sanitizar(rawCheck)) return;

        var item = LICSYSTEM.orcamento.emptyItem();
        item.lote = itCap.lote != null && String(itCap.lote).trim() !== "" ? String(itCap.lote) : "";
        item.qtd = Number(itCap.qtd) || 1;
        item.produto = String(itCap.produto || "").trim();
        item.editalVunit = Number(itCap.editalVunit) || 0;
        item.editalTotal = Number(itCap.editalTotal) || 0;
        if(!item.editalTotal && item.editalVunit){
          item.editalTotal = item.qtd * item.editalVunit;
        }
        if(!item.produto) return;

        added++;
        if(!String(item.lote||"").trim()) item.lote = String(added);
        LICSYSTEM.state.orcItems.push(item);
      });
      LICSYSTEM.state.orcItems = LICSYSTEM.state.orcItems.filter(function(it,idx){
        return !(idx===0 && LICSYSTEM.orcamento.isEmptyRow(it));
      });
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },
    limpar:function(){
      if(!confirm("Limpar toda a planilha de orçamento?")) return;
      LICSYSTEM.state.orcItems = [ LICSYSTEM.orcamento.emptyItem() ];
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state.orcCatalogId = null;
      LICSYSTEM.state.orcMetaNome = "";
      LICSYSTEM.state.orcMetaNumero = "";
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render({ save:false });
      LICSYSTEM.orcamento.flushSave({ forceClear: true, immediate: true });
      LICSYSTEM.orcamento.updateMeta();
    },

    updateMeta:function(){
      var box = el("orcMeta");
      if(!box) return;
      var nome = LICSYSTEM.state.orcMetaNome || "";
      var numero = LICSYSTEM.state.orcMetaNumero || "";
      if(!nome && !numero){
        box.style.display = "none";
        box.innerHTML = "";
        return;
      }
      box.style.display = "flex";
      box.innerHTML =
        '<span class="tag">Catálogo</span>'+
        (numero ? '<span><b>Nº</b> '+utils.escapeHtml(numero)+'</span>' : '')+
        (nome ? '<span><b>Nome</b> '+utils.escapeHtml(nome)+'</span>' : '')+
        (LICSYSTEM.state.orcCatalogId ? '<span class="small muted">salvo — edite e clique em Salvar no Catálogo para atualizar</span>' : '');
    },

    exportarExcel:function(){
      var items = (LICSYSTEM.state.orcItems || []).filter(function(it){
        return !LICSYSTEM.orcamento.isEmptyRow(it);
      });
      if(!items.length){ showAlert("orcAlert","warn","Planilha vazia — nada para exportar."); return; }
      utils.ensureXlsx().then(function(){
        var rows = [[
          "Lote","Qtd","Descrição",
          "Edital V. Unitário","Edital V. Final",
          "Meu V. Unitário","%","Meu V. Final","Link"
        ]];
        items.forEach(function(it){
          rows.push([
            it.lote || "",
            Number(it.qtd)||0,
            it.produto || "",
            Number(it.editalVunit)||0,
            LICSYSTEM.orcamento.calcEditalTotal(it),
            Number(it.vunit)||0,
            Number(it.pct)||0,
            LICSYSTEM.orcamento.calcTotal(it),
            it.link || ""
          ]);
        });
        var ws = XLSX.utils.aoa_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Orcamento");
        var nome = (LICSYSTEM.state.orcMetaNumero || LICSYSTEM.state.orcMetaNome || "orcamento")
          .toString().replace(/[^\w\-]+/g,"_").slice(0,40);
        XLSX.writeFile(wb, nome + "-licsystem.xlsx");
        showAlert("orcAlert","ok","Excel exportado com "+items.length+" item(ns).");
      }).catch(function(err){
        showAlert("orcAlert","error","Falha ao exportar Excel: "+utils.escapeHtml(err.message||err));
      });
    },

    exportarPdf:function(){
      LICSYSTEM.orcamento.gerarProposta();
    },

    abrirModalSalvarCatalogo:function(){
      var items = (LICSYSTEM.state.orcItems || []).filter(function(it){
        return !LICSYSTEM.orcamento.isEmptyRow(it);
      });
      if(!items.length){
        showAlert("orcAlert","warn","Monte o orçamento antes de salvar no catálogo.");
        return;
      }
      var ov = el("orcSaveOverlay");
      if(!ov) return;
      hideAlert("orcSaveAlert");
      if(el("orcSaveNome")) el("orcSaveNome").value = LICSYSTEM.state.orcMetaNome || "";
      if(el("orcSaveNumero")) el("orcSaveNumero").value = LICSYSTEM.state.orcMetaNumero || "";
      ov.classList.add("open");
      ov.setAttribute("aria-hidden","false");
      setTimeout(function(){ if(el("orcSaveNome")) el("orcSaveNome").focus(); }, 30);
    },

    fecharModalSalvarCatalogo:function(){
      var ov = el("orcSaveOverlay");
      if(!ov) return;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden","true");
      hideAlert("orcSaveAlert");
    },

    confirmarSalvarCatalogo:function(){
      var nome = ((el("orcSaveNome") && el("orcSaveNome").value) || "").trim();
      var numero = ((el("orcSaveNumero") && el("orcSaveNumero").value) || "").trim();
      if(!nome){
        showAlert("orcSaveAlert","warn","Informe o nome da licitação.");
        if(el("orcSaveNome")) el("orcSaveNome").focus();
        return;
      }
      if(!numero){
        showAlert("orcSaveAlert","warn","Informe o número da licitação.");
        if(el("orcSaveNumero")) el("orcSaveNumero").focus();
        return;
      }

      var itens = (LICSYSTEM.state.orcItems || [])
        .filter(function(it){ return !LICSYSTEM.orcamento.isEmptyRow(it); })
        .map(function(it){ return LICSYSTEM.orcamento.normalizeItem(it); });
      if(!itens.length){
        showAlert("orcSaveAlert","warn","Nenhum item válido para salvar.");
        return;
      }

      var totalMeus = 0, totalEdital = 0;
      itens.forEach(function(it){
        totalMeus += LICSYSTEM.orcamento.calcTotal(it);
        totalEdital += LICSYSTEM.orcamento.calcEditalTotal(it);
      });

      LICSYSTEM.catalogo.load();
      var agora = new Date().toISOString();
      var editId = LICSYSTEM.state.orcCatalogId;
      var entry = null;

      if(editId){
        for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
          if(LICSYSTEM.catalogo.items[i].id === editId){
            entry = LICSYSTEM.catalogo.items[i];
            break;
          }
        }
      }

      if(entry && entry.tipo === "orcamento"){
        entry.nome = nome;
        entry.numero = numero;
        entry.sku = numero;
        entry.marca = "Orçamento";
        entry.preco = totalMeus;
        entry.totalEdital = totalEdital;
        entry.itens = itens;
        entry.qtdItens = itens.length;
        entry.atualizadoEm = agora;
      } else {
        entry = {
          id: "orc_" + Date.now() + "_" + Math.floor(Math.random()*1000),
          tipo: "orcamento",
          nome: nome,
          numero: numero,
          sku: numero,
          marca: "Orçamento",
          preco: totalMeus,
          totalEdital: totalEdital,
          itens: itens,
          qtdItens: itens.length,
          criadoEm: agora,
          atualizadoEm: agora
        };
        LICSYSTEM.catalogo.items.push(entry);
      }

      LICSYSTEM.catalogo.saveLocal();
      LICSYSTEM.state.orcCatalogId = entry.id;
      LICSYSTEM.state.orcMetaNome = nome;
      LICSYSTEM.state.orcMetaNumero = numero;
      LICSYSTEM.orcamento.save();
      LICSYSTEM.orcamento.updateMeta();
      LICSYSTEM.orcamento.fecharModalSalvarCatalogo();
      if(typeof listarProdutos === "function") listarProdutos();
      showAlert("orcAlert","ok","Orçamento salvo no Catálogo: <b>"+utils.escapeHtml(nome)+"</b> ("+utils.escapeHtml(numero)+") — "+itens.length+" item(ns).");
    },

    abrirDoCatalogo:function(id){
      LICSYSTEM.catalogo.load();
      var item = null;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === id){ item = LICSYSTEM.catalogo.items[i]; break; }
      }
      if(!item || item.tipo !== "orcamento"){
        showAlert("catalogoAlert","warn","Este registro não é um orçamento salvo.");
        return;
      }
      var itens = Array.isArray(item.itens) ? item.itens.map(function(it){
        return LICSYSTEM.orcamento.normalizeItem(it);
      }) : [];
      if(!itens.length) itens = [ LICSYSTEM.orcamento.emptyItem() ];

      LICSYSTEM.state.orcItems = itens;
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state.orcCatalogId = item.id;
      LICSYSTEM.state.orcMetaNome = item.nome || "";
      LICSYSTEM.state.orcMetaNumero = item.numero || item.sku || "";
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.save();
      LICSYSTEM.orcamento.render();
      LICSYSTEM.orcamento.updateMeta();
      showAlert("orcAlert","ok","Orçamento reaberto: <b>"+utils.escapeHtml(item.nome||"")+"</b> — continue editando e salve de novo no catálogo quando quiser.");
      if(window.__lsActivateView) window.__lsActivateView("orcamento");
    },

    handleFile:function(file){
      if(!file) return;
      showAlertOrc('<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Lendo planilha do edital…',"info");
      utils.ensureXlsx().then(function(){
        var reader = new FileReader();
        reader.onload = function(){
          try{
            var wb = XLSX.read(new Uint8Array(reader.result), {type:"array"});
            var ws = wb.Sheets[wb.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
            LICSYSTEM.orcamento._mapRows(rows);
          }catch(err){ showAlertOrc("Erro ao ler arquivo: "+utils.escapeHtml(err.message),"error"); }
        };
        reader.readAsArrayBuffer(file);
      }).catch(function(err){ showAlertOrc("Falha ao carregar SheetJS: "+utils.escapeHtml(err.message),"error"); });
      function showAlertOrc(msg,type){
        var d=el("orcDrop"); d.innerHTML='<span class="big">📊</span>'+msg;
        setTimeout(function(){ LICSYSTEM.orcamento._restoreDrop(); }, type==="info"?60000:4000);
      }
    },
    _restoreDrop:function(){
      el("orcDrop").innerHTML='<span class="big">📊</span><b>Arraste Excel/CSV do edital aqui</b> ou clique para selecionar<br/><span class="small muted">Mapeia Lote/Item, Quantidade, Descrição, Valor Unitário e Valor Final (também Valor Máximo)</span><input type="file" id="orcFile" accept=".xlsx,.xls,.csv" style="display:none" />';
      wireOrcFileInput();
    },
    _mapRows:function(rows){
      if(!rows || !rows.length){ LICSYSTEM.orcamento._restoreDrop(); return; }

      // localiza linha de cabeçalho (até a 10ª) — aceita LOTE ou ITEM
      var headerRow = 0, header = null;
      for(var hr=0; hr<Math.min(10, rows.length); hr++){
        var cand = (rows[hr] || []).map(function(c){
          return utils.fold(String(c)).toLowerCase().replace(/\s+/g, " ").trim();
        });
        var score = 0;
        cand.forEach(function(h){
          if(!h) return;
          if(h.indexOf("descr")!==-1 || h.indexOf("produto")!==-1) score += 3;
          if(h.indexOf("qtde")!==-1 || h.indexOf("qtd")!==-1 || h.indexOf("quant")!==-1) score += 2;
          if(h.indexOf("unitario")!==-1 || h.indexOf("maximo unit")!==-1 || (h.indexOf("valor")!==-1 && h.indexOf("unit")!==-1)) score += 3;
          if(h.indexOf("maximo total")!==-1 || h.indexOf("valor maximo total")!==-1 || (h.indexOf("total")!==-1 && h.indexOf("unit")===-1)) score += 2;
          if(h==="item" || h.indexOf("lote")!==-1) score += 3;
          if(h==="und" || h==="unid" || h.indexOf("unidade")===0) score += 1;
        });
        if(score >= 5){ headerRow = hr; header = cand; break; }
      }
      if(!header) header = (rows[0] || []).map(function(c){
        return utils.fold(String(c)).toLowerCase().replace(/\s+/g, " ").trim();
      });

      var colLote=-1, colDesc=-1, colQtd=-1, colUnit=-1, colFinal=-1, colUnd=-1;
      // 1) ITEM / LOTE (nunca Cód / Cotas)
      header.forEach(function(h,i){
        if(!h) return;
        if(colLote>=0) return;
        if(h.indexOf("cotas")!==-1 || h==="cod" || h==="codigo" || h.indexOf("cod ")===0 || h.indexOf("codigo ")===0) return;
        if(h==="item" || h==="lote" || h.indexOf("item ")===0 || h.indexOf("lote")===0) colLote=i;
        else if((h==="n" || h==="nº" || h==="n°" || h==="nr" || h==="num") && h.indexOf("cotas")===-1) colLote=i;
      });
      // 2) Quantidade (não Cotas)
      header.forEach(function(h,i){
        if(!h || colQtd>=0) return;
        if(h.indexOf("cotas")!==-1) return;
        if(h==="qtde" || h==="qtd" || h.indexOf("qtde")!==-1 || (h.indexOf("quant")!==-1 && h.indexOf("cotas")===-1)) colQtd=i;
      });
      // 3) Descrição / Produto
      header.forEach(function(h,i){
        if(!h || colDesc>=0) return;
        if(h.indexOf("descr")!==-1 || h.indexOf("produto")!==-1 || h.indexOf("especific")!==-1) colDesc=i;
      });
      // 4) Unidade (só referência)
      header.forEach(function(h,i){
        if(!h || colUnd>=0) return;
        if(h==="und" || h==="un" || h==="unid" || h==="unidade") colUnd=i;
      });
      // 5) Valor unitário / Valor Máximo Unit.
      header.forEach(function(h,i){
        if(!h || colUnit>=0) return;
        if(h.indexOf("maximo unit")!==-1 || h.indexOf("valor maximo unit")!==-1) colUnit=i;
        else if(h.indexOf("unitario")!==-1 || h.indexOf("v. unit")!==-1 || h.indexOf("v unit")!==-1) colUnit=i;
        else if(h.indexOf("unit")!==-1 && h.indexOf("total")===-1 && h.indexOf("und")===-1 && h!=="und") colUnit=i;
      });
      if(colUnit<0){
        header.forEach(function(h,i){
          if(!h) return;
          if(h.indexOf("valor")!==-1 && h.indexOf("total")===-1 && h.indexOf("final")===-1 && i!==colQtd && i!==colUnd) colUnit=i;
        });
      }
      // 6) Valor total / Valor Máximo Total
      header.forEach(function(h,i){
        if(!h || colFinal>=0) return;
        if(h.indexOf("maximo total")!==-1 || h.indexOf("valor maximo total")!==-1) colFinal=i;
        else if(h.indexOf("final")!==-1 || (h.indexOf("total")!==-1 && h.indexOf("unit")===-1 && i!==colUnit)) colFinal=i;
      });

      // Fallback posicional:
      // Item | Cotas | Qtde | Und | Cód | Produto | V.Unit | V.Total  (8 cols)
      // Item | Qtde | Und | Descrição | V.Unit | V.Final (6 cols)
      if(colDesc<0 && header.length >= 6){
        if(header.length >= 8){
          if(colLote<0) colLote = 0;
          if(colQtd<0) colQtd = 2;
          if(colDesc<0) colDesc = 5;
          if(colUnit<0) colUnit = 6;
          if(colFinal<0) colFinal = 7;
        } else {
          if(colLote<0) colLote = 0;
          if(colQtd<0) colQtd = 1;
          if(colDesc<0) colDesc = header.length >= 6 ? 3 : 2;
          if(colUnit<0) colUnit = header.length - 2;
          if(colFinal<0) colFinal = header.length - 1;
        }
      }

      var startRow = headerRow + 1;
      if(colDesc<0){ colDesc = 0; startRow = 0; }

      var added=0;
      for(var r=startRow;r<rows.length;r++){
        var row = rows[r] || [];
        var desc = String(row[colDesc]!=null?row[colDesc]:"").trim();
        if(!desc) continue;
        if(!utils.sanitizar(desc)) continue;

        var qtd = colQtd>=0 ? utils.parseBrNum(row[colQtd]) : 0;
        var unit = colUnit>=0 ? utils.parseBrNum(row[colUnit]) : 0;
        var fin = colFinal>=0 ? utils.parseBrNum(row[colFinal]) : 0;
        var lote = colLote>=0 ? String(row[colLote]!=null?row[colLote]:"").trim() : "";

        // se a descrição ainda carrega a linha completa do edital, extrai preços dela
        var parsed = utils.parseLinhaEdital(
          (lote ? lote + " " : "") +
          (qtd ? qtd + " " : "") +
          (colUnd>=0 ? String(row[colUnd]||"UN") + " " : "") +
          desc +
          (unit ? " " + unit : "") +
          (fin ? " " + fin : "")
        );
        if(parsed){
          if(!lote && parsed.lote) lote = parsed.lote;
          if(!qtd && parsed.qtd) qtd = parsed.qtd;
          desc = parsed.produto || desc;
          if(!unit && parsed.editalVunit) unit = parsed.editalVunit;
          if(!fin && parsed.editalTotal) fin = parsed.editalTotal;
        } else {
          var parsedDesc = utils.parseLinhaEdital(desc);
          if(parsedDesc){
            if(!lote && parsedDesc.lote) lote = parsedDesc.lote;
            if(!qtd && parsedDesc.qtd) qtd = parsedDesc.qtd;
            desc = parsedDesc.produto || desc;
            if(!unit && parsedDesc.editalVunit) unit = parsedDesc.editalVunit;
            if(!fin && parsedDesc.editalTotal) fin = parsedDesc.editalTotal;
          }
        }

        if(!unit){
          for(var c=0;c<row.length;c++){
            if(c===colDesc || c===colQtd || c===colLote || c===colFinal || c===colUnd) continue;
            var maybe = utils.parseBrNum(row[c]);
            var rawCell = String(row[c]==null?"":row[c]).trim();
            if(maybe > 0 && /,\d{2,4}$/.test(rawCell.replace(/\s/g,"")) && maybe < 1e7){
              if(/,\d{3,4}$/.test(rawCell.replace(/\s/g,"")) || maybe !== qtd){
                unit = maybe;
                break;
              }
            }
          }
        }

        if(!qtd) qtd = 1;
        if(!fin && unit) fin = qtd * unit;
        if(!lote) lote = String(added+1);

        var item = LICSYSTEM.orcamento.emptyItem();
        item.lote = lote;
        item.produto = desc;
        item.qtd = qtd;
        item.editalVunit = unit||0;
        item.editalTotal = fin||0;
        LICSYSTEM.state.orcItems.push(item);
        added++;
        if(added>=5000) break;
      }
      LICSYSTEM.state.orcItems = LICSYSTEM.state.orcItems.filter(function(it,idx){
        return !(idx===0 && LICSYSTEM.orcamento.isEmptyRow(it));
      });
      LICSYSTEM.orcamento.render();
      LICSYSTEM.orcamento._restoreDrop();
    },

    /** Linhas da proposta comercial (mostra o preço de venda, nunca o custo nem a %). */
    propostaRows:function(){
      var rows=[], geralMeus=0, geralEdital=0;
      LICSYSTEM.state.orcItems.forEach(function(it){
        if(!it.produto && !it.lote) return;
        var meus=LICSYSTEM.orcamento.calcTotal(it);
        var edital=LICSYSTEM.orcamento.calcEditalTotal(it);
        geralMeus+=meus; geralEdital+=edital;
        rows.push([
          it.lote || "",
          it.produto || "",
          it.qtd,
          utils.formatBrl(it.editalVunit),
          utils.formatBrl(edital),
          utils.formatBrl(LICSYSTEM.orcamento.calcVendaUnit(it)),
          utils.formatBrl(meus)
        ]);
      });
      return { rows: rows, geralMeus: geralMeus, geralEdital: geralEdital };
    },

    gerarProposta:function(){
      if(!LICSYSTEM.state.orcItems.length){ alert("Planilha vazia."); return; }
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"landscape"});
        return licsystemPdfHeader(doc,"Proposta Comercial — Espelho Edital", true).then(function(startY){
          var y = startY;
          var data = LICSYSTEM.orcamento.propostaRows();
          if(!data.rows.length){ alert("Nenhum item para exportar."); return; }
          doc.autoTable({
            startY:y+2,
            head:[["Lote","Descrição","Qtd","Edital V.Unit","Edital Final","Meu V.Unit","Meu Final"]],
            body:data.rows,
            foot:[["","","","","","TOTAL EDITAL", utils.formatBrl(data.geralEdital)]],
            styles:{fontSize:8,cellPadding:2.5},
            headStyles:{fillColor:[21,38,66],textColor:255},
            footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
            alternateRowStyles:{fillColor:[248,250,253]},
            columnStyles:{
              0:{cellWidth:18},
              2:{cellWidth:18,halign:"right"},
              3:{cellWidth:28,halign:"right"},
              4:{cellWidth:28,halign:"right"},
              5:{cellWidth:28,halign:"right"},
              6:{cellWidth:32,halign:"right"}
            }
          });
          var finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) || (y + 20);
          doc.setFillColor(201,162,39);
          doc.rect(14, finalY + 3, doc.internal.pageSize.getWidth() - 28, 10, "F");
          doc.setTextColor(21,38,66);
          doc.setFontSize(9);
          doc.setFont(undefined, "bold");
          doc.text("TOTAL MEUS: "+utils.formatBrl(data.geralMeus), doc.internal.pageSize.getWidth() - 18, finalY + 9.5, {align:"right"});
          doc.save("proposta-comercial-licsystem.pdf");
        });
      }).catch(function(err){ alert("Falha ao gerar PDF: "+err.message); });
    },

    gerarPropostaExcel:function(){
      if(!LICSYSTEM.state.orcItems.length){ alert("Planilha vazia."); return; }
      utils.ensureXlsx().then(function(){
        var data = LICSYSTEM.orcamento.propostaRows();
        if(!data.rows.length){ alert("Nenhum item para exportar."); return; }
        var sheet = [[
          "Lote","Descrição","Qtd","Edital V.Unit","Edital Final","Meu V.Unit","Meu Final"
        ]];
        data.rows.forEach(function(r){ sheet.push(r); });
        sheet.push(["","","","","","TOTAL EDITAL", utils.formatBrl(data.geralEdital)]);
        sheet.push(["","","","","","TOTAL MEUS", utils.formatBrl(data.geralMeus)]);
        var ws = XLSX.utils.aoa_to_sheet(sheet);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Proposta");
        var nome = (LICSYSTEM.state.orcMetaNumero || LICSYSTEM.state.orcMetaNome || "proposta")
          .toString().replace(/[^\w\-]+/g,"_").slice(0,40);
        XLSX.writeFile(wb, nome + "-proposta-licsystem.xlsx");
        showAlert("orcAlert","ok","Proposta Excel exportada ("+data.rows.length+" item(ns)).");
      }).catch(function(err){
        alert("Falha ao gerar Excel: "+(err.message||err));
      });
    },

    onEdit:function(i,f,val){
      var it=LICSYSTEM.state.orcItems[i]; if(!it) return;
      /* Descrição do produto vem do edital e não pode ser alterada */
      if(f === "produto") return;
      if(f==="link"||f==="lote") it[f]=val;
      else it[f]=Number(val)||0;

      if(f==="qtd" || f==="editalVunit"){
        if(Number(it.editalVunit) > 0){
          it.editalTotal = (Number(it.qtd)||0) * (Number(it.editalVunit)||0);
        }
      }
      if(f==="vunit" || f==="vvenda" || f==="pct"){
        LICSYSTEM.orcamento.syncPricing(it, f);
      } else {
        it.compensa = LICSYSTEM.orcamento.evalCompensa(it);
      }

      LICSYSTEM.state._orcDirty = true;
      var row = document.querySelector('#orcBody [data-item-idx="'+i+'"]');
      if(row){
        var edCell = row.querySelector('[data-edital-total="'+i+'"]');
        var meCell = row.querySelector('[data-meus-total="'+i+'"]');
        if(edCell) edCell.textContent = utils.formatBrl(LICSYSTEM.orcamento.calcEditalTotal(it));
        if(meCell) meCell.textContent = utils.formatBrl(LICSYSTEM.orcamento.calcTotal(it));
        var pctInp = row.querySelector('input[data-f="pct"]');
        var vvInp = row.querySelector('input[data-f="vvenda"]');
        if(pctInp && document.activeElement !== pctInp) pctInp.value = Number(it.pct) || 0;
        if(vvInp && document.activeElement !== vvInp) vvInp.value = Number(it.vvenda) || 0;
        row.classList.toggle("orc-row-compensa", it.compensa === true);
        row.classList.toggle("orc-row-nao-compensa", it.compensa === false);
        var finalCell = row.querySelector(".orc-final-cell");
        if(finalCell){
          var badge = finalCell.querySelector(".orc-status-badge");
          if(it.compensa === true){
            if(!badge){
              badge = document.createElement("span");
              badge.className = "orc-status-badge is-ok";
              finalCell.appendChild(badge);
            }
            badge.className = "orc-status-badge is-ok";
            badge.style.background = "#1e9e5a";
            badge.style.color = "#fff";
            badge.title = "Meu V. Final abaixo do edital";
            badge.textContent = "COMPENSA";
          } else if(it.compensa === false){
            if(!badge){
              badge = document.createElement("span");
              badge.className = "orc-status-badge is-bad";
              finalCell.appendChild(badge);
            }
            badge.className = "orc-status-badge is-bad";
            badge.style.background = "#d23b3b";
            badge.style.color = "#fff";
            badge.title = "Meu V. Final acima do edital";
            badge.textContent = "NÃO COMPENSA";
          } else if(badge){
            badge.remove();
          }
        }
        if(f==="link"){
          var linkBtn = row.querySelector(".orcOpenLink");
          if(linkBtn){
            var ready = !!(String(val || "").trim());
            linkBtn.disabled = !ready;
            linkBtn.classList.toggle("is-ready", ready);
            linkBtn.title = ready ? "Abrir link de acesso" : "Cole um link no campo Link de Acesso";
          }
        }
      }
      var geralMeus = 0, geralEdital = 0;
      for(var k=0;k<LICSYSTEM.state.orcItems.length;k++){
        geralMeus += LICSYSTEM.orcamento.calcTotal(LICSYSTEM.state.orcItems[k]);
        geralEdital += LICSYSTEM.orcamento.calcEditalTotal(LICSYSTEM.state.orcItems[k]);
      }
      if(el("orcTotalGeral")) el("orcTotalGeral").textContent = utils.formatBrl(geralMeus);
      if(el("orcTotalEdital")) el("orcTotalEdital").textContent = utils.formatBrl(geralEdital);
      LICSYSTEM.orcamento.scheduleSave();
    }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
