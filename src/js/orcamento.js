/* LICSYSTEM — ORCAMENTO / PLANILHA */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var ORC_KEY = ctx.ORC_KEY;
  var ORC_KEY_LEGACY = ctx.ORC_KEY_LEGACY;

  LICSYSTEM.orcamento = Object.assign(LICSYSTEM.orcamento || {}, {
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
    calcPctFromVenda:function(vunit, vvenda){
      vunit = Number(vunit) || 0;
      vvenda = Number(vvenda) || 0;
      if(vunit <= 0) return 0;
      return Math.round((((vvenda - vunit) / vunit) * 100) * 1000) / 1000;
    },
    calcVendaFromPct:function(vunit, pct){
      vunit = Number(vunit) || 0;
      pct = Number(pct) || 0;
      return Math.round((vunit * (1 + pct / 100)) * 10000) / 10000;
    },
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
    calcVendaUnit:function(it){
      var vv = Number(it.vvenda);
      if(isFinite(vv) && vv > 0) return vv;
      return (Number(it.vunit) || 0) * (1 + (Number(it.pct) || 0) / 100);
    },
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
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
