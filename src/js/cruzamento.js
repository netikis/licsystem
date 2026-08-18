/* LICSYSTEM — CRUZAMENTO (08-cruzamento.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  function licsystemPdfHeader(){
    var fn = ctx.licsystemPdfHeader || window.licsystemPdfHeader || LICSYSTEM.licsystemPdfHeader;
    if (typeof fn !== "function") throw new Error("licsystemPdfHeader ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ CRUZAMENTO ============================ */
  LICSYSTEM.cruzamento = {
    BATCH_SIZE: 20,
    REQUEST_DELAY_MS: 1000,
    _busy: false,

    sleep: function(ms){
      return new Promise(function(resolve){ setTimeout(resolve, ms); });
    },

    setProgress: function(done, total, label){
      var bar = el("progress-bar");
      var lab = el("progressLabel");
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if(bar){
        bar.style.width = pct + "%";
        bar.setAttribute("aria-valuenow", String(pct));
      }
      if(lab) lab.textContent = label || (done + " / " + total + " itens (" + pct + "%)");
    },

    getSelectedItens: function(){
      var selected = [];
      document.querySelectorAll(".orcChk:checked").forEach(function(c){
        var i = Number(c.getAttribute("data-i"));
        var it = LICSYSTEM.state.orcItems[i];
        if(it && String(it.produto||"").trim()){
          selected.push({ fonte:"orcamento", index:i, descricao:String(it.produto).trim() });
        }
      });
      if(!selected.length){
        var avulso = (el("cruzItem").value || "").trim();
        if(avulso) selected.push({ fonte:"avulso", index:-1, descricao:avulso });
      }
      return selected;
    },

    resolveCep: function(){
      return LICSYSTEM.ferramentas.getPerfil().then(function(perfil){
        var cepPerfil = String((perfil && perfil.cep) || "").replace(/\D/g,"");
        var cepInput = (el("cruzCep").value || "").replace(/\D/g,"");
        if(cepPerfil && el("cruzCep") && !cepInput) el("cruzCep").value = cepPerfil;
        return cepPerfil || cepInput || "";
      }).catch(function(){
        return (el("cruzCep").value || "").replace(/\D/g,"");
      });
    },

    fetchFrete: function(itemId, cep, permalink, opts){
      opts = opts || {};
      /* Anúncio já veio com frete grátis na busca ML */
      if(opts.freeShipping){
        return Promise.resolve({
          cost: 0,
          note: "FRETE GRÁTIS",
          free_shipping: true,
          itemId: itemId,
          calculated: false
        });
      }
      if(!cep){
        return Promise.resolve({
          cost: 0,
          note: "Informe o CEP da sua cidade para calcular o frete",
          free_shipping: false,
          itemId: itemId,
          calculated: false
        });
      }
      // Proxy backend — calcula frete para o CEP (cidade do perfil / campo)
      return utils.mlShipping(itemId, cep, permalink).then(function(sj){
        var optsShip = (sj && sj.options) || [];
        var cost = null;
        optsShip.forEach(function(o){
          if(typeof o.cost === "number"){
            if(cost === null || o.cost < cost) cost = o.cost;
          }
        });
        if(cost === null && typeof (sj && sj.cost) === "number") cost = Number(sj.cost);
        var free =
          !!(sj && sj.free_shipping) ||
          cost === 0 ||
          /frete\s*gr[aá]tis|gratis/i.test(String((sj && sj.note) || ""));
        if(free){
          return {
            cost: 0,
            note: "FRETE GRÁTIS",
            free_shipping: true,
            itemId: (sj && sj.itemId) || itemId,
            calculated: true,
            options: optsShip
          };
        }
        if(cost === null){
          return {
            cost: 0,
            note: (sj && sj.note) || "Frete não disponível para este CEP",
            free_shipping: false,
            itemId: (sj && sj.itemId) || itemId,
            calculated: false,
            options: optsShip
          };
        }
        return {
          cost: cost,
          note: "Frete para CEP " + String(cep).replace(/^(\d{5})(\d{3})$/, "$1-$2"),
          free_shipping: false,
          itemId: (sj && sj.itemId) || itemId,
          calculated: true,
          options: optsShip
        };
      }).catch(function(err){
        return {
          cost: 0,
          note: "Falha ao calcular frete" + (err && err.message ? " ("+err.message+")" : ""),
          free_shipping: false,
          itemId: itemId,
          calculated: false
        };
      });
    },

    calcValorFinal: function(precoMl, frete, desconto, margem, imposto, custoOp){
      var base = (Number(precoMl)||0) + (Number(frete)||0) - (Number(desconto)||0);
      if(base < 0) base = 0;
      return base * (1 + ((Number(margem)||0) + (Number(imposto)||0) + (Number(custoOp)||0)) / 100);
    },

    processarItem: function(termo, opts){
      var embalagem = opts.embalagem;
      var cep = opts.cep;
      var margem = opts.margem;
      var imposto = opts.imposto;
      var custoOp = opts.custoOp;
      var desconto = opts.desconto;
      var query = utils.mlQueryFromTermo(termo, embalagem);
      if(!query) return Promise.resolve(null);

      // Busca SOMENTE via /api/search-ml (OAuth no servidor) — nunca direto no ML
      return utils.mlSearch(query, 10).then(function(j){
        var results = ((j && j.results) || []).filter(function(it){
          return it.available_quantity !== 0;
        });
        // Se veio vazio, tenta so as 3 primeiras palavras (mais generico)
        if(!results.length){
          var shortQ = query.split(/\s+/).slice(0, 3).join(" ");
          if(shortQ && shortQ !== query){
            return utils.mlSearch(shortQ, 10).then(function(j2){
              return LICSYSTEM.cruzamento._finishMlItem(termo, opts, j2 || j, shortQ);
            });
          }
        }
        return LICSYSTEM.cruzamento._finishMlItem(termo, opts, j, query);
      }).catch(function(err){
        var msg = (err && err.message) ? err.message : String(err);
        if(/failed to fetch|NetworkError|Load failed/i.test(msg)){
          msg = utils.mlSearchFailMessage(err && err.body);
        }
        if(err && (err.mlDebug || err.body)){
          console.error("[LICSYSTEM ML] processarItem falhou", err.mlDebug || err.body);
        }
        /* Não sobrescrever com o JSON cru do 403 — msg amigável já vem do mlSearch */
        showAlert("cruzStatus", "error", utils.escapeHtml(msg));
        throw new Error(msg);
      });
    },

    _finishMlItem: function(termo, opts, j, queryUsada){
      var embalagem = opts.embalagem;
      var cep = opts.cep;
      var margem = opts.margem;
      var imposto = opts.imposto;
      var custoOp = opts.custoOp;
      var desconto = opts.desconto;
      var results = ((j && j.results) || []).filter(function(it){
        return it.available_quantity !== 0;
      });
      if(!results.length){
        var motivo = "Nenhum produto encontrado no Mercado Livre para \"" + (queryUsada || termo) + "\".";
        if(j && (j.ml_debug || j.upstream_status === 403 || /forbidden|unauthorized/i.test(String(j.error || "")))){
          console.error("[LICSYSTEM ML] sem resultados — bloqueio ML", j.ml_debug || j);
          motivo = utils.mlSearchFailMessage(j);
          showAlert("cruzStatus", "error", utils.escapeHtml(motivo));
        } else if(j && j.error){
          motivo = String(j.error);
          showAlert("cruzStatus", "error", utils.escapeHtml(motivo));
        } else if(j && j.warning){
          motivo += " " + j.warning;
        }
        return { skipped:true, itemGoverno:termo, motivo:motivo };
      }

      results.forEach(function(it){ it.__sim = utils.similaridade(termo, it.title); });
      /* Se o termo traz marca (ex.: BOSCH chave de impacto), prioriza anúncios da mesma marca. */
      var brandTokens = utils.mlBrandTokens(termo);
      var comMarca = brandTokens.length
        ? results.filter(function(it){ return utils.mlTitleHasBrand(it.title, brandTokens); })
        : [];
      if(brandTokens.length && !comMarca.length){
        return {
          skipped: true,
          itemGoverno: termo,
          motivo:
            "Nenhum anúncio da marca \"" +
            brandTokens.join(" ").toUpperCase() +
            "\" encontrado para \"" +
            termo +
            "\". Ajuste o termo ou confira se a marca aparece no título do ML."
        };
      }
      var basePool = comMarca.length ? comMarca : results;
      /* Entre matches bons (≥60%), prioriza menor preço. */
      var bons = basePool.filter(function(it){ return (it.__sim || 0) >= 60; });
      var pool = bons.length ? bons : basePool.slice();
      pool.sort(function(a, b){
        var priceA = Number(a.price) || 0;
        var priceB = Number(b.price) || 0;
        if(priceA !== priceB) return priceA - priceB;
        var freeA = !!(a.free_shipping || /frete\s*gr[aá]tis/i.test(a.freteLabel || ""));
        var freeB = !!(b.free_shipping || /frete\s*gr[aá]tis/i.test(b.freteLabel || ""));
        if(freeA !== freeB) return freeA ? -1 : 1; /* empate de preço: frete grátis primeiro */
        return (b.__sim || 0) - (a.__sim || 0);
      });
      var best = pool[0];
      var freeFromSearch = !!(best.free_shipping || /frete\s*gr[aá]tis/i.test(best.freteLabel || ""));

      return LICSYSTEM.cruzamento.fetchFrete(best.id, cep, best.permalink || "", {
        freeShipping: freeFromSearch
      }).then(function(fr){
        var precoMl = Number(best.price)||0;
        var freteGratis = !!(fr && fr.free_shipping) || freeFromSearch || Number(fr && fr.cost) === 0 && /frete\s*gr[aá]tis/i.test(String((fr && fr.note) || ""));
        var frete = freteGratis ? 0 : (Number(fr.cost)||0);
        var freteOk = freteGratis || !!(fr && fr.calculated && frete >= 0 && Number(fr.cost) === frete && !/não disponível|Falha|Informe o CEP/i.test(fr.note || ""));
        if(fr && fr.calculated && typeof fr.cost === "number" && !freteGratis){
          freteOk = true;
          frete = Number(fr.cost) || 0;
        }
        var custoReal = Math.max(0, precoMl + frete - desconto);
        var precoVenda = LICSYSTEM.cruzamento.calcValorFinal(precoMl, frete, desconto, margem, imposto, custoOp);
        var sim = best.__sim;
        var status, cls, statusLabel;
        if(sim>=80){ status="Match Automatico"; cls="r-green"; statusLabel="b-green"; }
        else if(sim>=60){ status="Revisao Manual"; cls="r-yellow"; statusLabel="b-yellow"; }
        else { status="Descartado"; cls="r-red"; statusLabel="b-red"; }

        var idMl = (fr && fr.itemId) || best.id;
        var notes = [];
        if(freteGratis){
          notes.push("FRETE GRÁTIS");
        } else if(fr && fr.calculated && frete >= 0){
          notes.push(fr.note || ("Frete para sua cidade (CEP " + cep + ")"));
        } else if(!cep){
          notes.push("Informe o CEP da sua cidade para calcular o frete");
        } else if(fr && fr.note){
          notes.push(fr.note);
        }
        if(!(precoMl > 0)) notes.push("Preço não retornado — informe manualmente.");
        if(best.seller) notes.push("Vendedor: " + best.seller);

        var record = {
          itemGoverno: termo,
          produtoML: best.title,
          idML: idMl,
          custoProduto: precoMl,
          frete: frete,
          freteGratis: freteGratis,
          freteOk: freteOk,
          descontoFornecedor: desconto,
          custoReal: custoReal,
          precoVenda: precoVenda,
          margem: margem,
          imposto: imposto,
          custoOperacional: custoOp,
          embalagem: embalagem,
          similaridade: sim,
          status: status,
          link: best.permalink || "",
          cepUsado: cep,
          seller: best.seller || "",
          mlSource: (j && j.source) || "proxy",
          queryUsada: queryUsada || "",
          processadoEm: new Date().toISOString()
        };
        return { record:record, cls:cls, statusLabel:statusLabel, freteNote:notes.join(" · ") };
      });
    },

    processar: function(){
      if(LICSYSTEM.cruzamento._busy){
        showAlert("cruzStatus","warn","Já existe um lote em andamento.");
        return;
      }

      var itens = LICSYSTEM.cruzamento.getSelectedItens();
      if(!itens.length){
        showAlert("cruzStatus","warn","Selecione itens no Orçamento (checkbox) ou informe um item avulso.");
        return;
      }

      var embalagem = (document.querySelector('input[name=embalagem]:checked')||{}).value || "unidade";
      var margem = Number(el("cruzMargem").value)||0;
      var imposto = Number(el("cruzImposto").value)||0;
      var custoOp = Number(el("cruzCustoOp").value)||0;
      var desconto = Number((el("cruzDesconto") && el("cruzDesconto").value) || 0) || 0;
      LICSYSTEM.state.lastBdi = { margem:margem, imposto:imposto, custoOperacional:custoOp, descontoFornecedor:desconto };

      if(utils.hasFirebaseConfig()){
        showAlert("cruzMode","info","Lote ML — resultados aprovados serão gravados no Realtime Database. CEP do perfil será usado no frete.");
      } else {
        hideAlert("cruzMode");
      }

      var btn = el("btnCruzar");
      if(btn){ btn.disabled = true; btn.textContent = "⏳ Processando…"; }
      LICSYSTEM.cruzamento._busy = true;
      el("cruzResults").innerHTML = "";
      LICSYSTEM.cruzamento.setProgress(0, itens.length, "Preparando lote de "+itens.length+" item(ns)…");
      showAlert("cruzStatus","info",'<span class="spinner"></span> Processando lote (grupos de '+LICSYSTEM.cruzamento.BATCH_SIZE+', delay '+ (LICSYSTEM.cruzamento.REQUEST_DELAY_MS/1000) +'s)…');

      LICSYSTEM.cruzamento.resolveCep().then(function(cep){
        var opts = { embalagem:embalagem, cep:cep, margem:margem, imposto:imposto, custoOp:custoOp, desconto:desconto };
        var done = 0;
        var total = itens.length;
        var ok = 0, fail = 0;

        function runBatch(start){
          if(start >= total){
            LICSYSTEM.cruzamento._busy = false;
            if(btn){ btn.disabled = false; btn.textContent = "⚙️ Processar Lote (ML)"; }
            LICSYSTEM.cruzamento.setProgress(total, total, "Concluído: "+ok+" ok · "+fail+" falha(s)/sem match");
            showAlert("cruzStatus","ok","✅ Lote finalizado — "+ok+" processado(s), "+fail+" sem resultado/erro.");
            return Promise.resolve();
          }

          var end = Math.min(start + LICSYSTEM.cruzamento.BATCH_SIZE, total);
          var chunk = itens.slice(start, end);
          var seq = Promise.resolve();

          chunk.forEach(function(item, idxInChunk){
            seq = seq.then(function(){
              var globalIdx = start + idxInChunk;
              LICSYSTEM.cruzamento.setProgress(done, total, "Grupo "+(Math.floor(start/LICSYSTEM.cruzamento.BATCH_SIZE)+1)+" — item "+(globalIdx+1)+"/"+total+": "+item.descricao.slice(0,48));
              return LICSYSTEM.cruzamento.processarItem(item.descricao, opts).then(function(out){
                done++;
                if(!out || out.skipped){
                  fail++;
                  if(out && out.skipped){
                    el("cruzResults").insertAdjacentHTML("afterbegin",
                      '<div class="result-item r-red"><div class="ri-title">'+utils.escapeHtml(out.itemGoverno)+'</div>'+
                      '<div class="ri-sub">'+utils.escapeHtml(out.motivo||"Ignorado")+'</div></div>');
                  }
                } else {
                  ok++;
                  LICSYSTEM.cruzamento.renderResult(out.record, out.cls, out.statusLabel, out.freteNote);
                  if(out.record.similaridade >= 80) LICSYSTEM.cruzamento.aprovar(out.record, true);
                }
                LICSYSTEM.cruzamento.setProgress(done, total);
                // delay 1s entre cada requisição (exceto após o último do lote total)
                if(globalIdx < total - 1) return LICSYSTEM.cruzamento.sleep(LICSYSTEM.cruzamento.REQUEST_DELAY_MS);
              }).catch(function(err){
                done++; fail++;
                el("cruzResults").insertAdjacentHTML("afterbegin",
                  '<div class="result-item r-red"><div class="ri-title">'+utils.escapeHtml(item.descricao)+'</div>'+
                  '<div class="ri-sub">Erro: '+utils.escapeHtml(err.message||String(err))+'</div></div>');
                LICSYSTEM.cruzamento.setProgress(done, total);
                if(globalIdx < total - 1) return LICSYSTEM.cruzamento.sleep(LICSYSTEM.cruzamento.REQUEST_DELAY_MS);
              });
            });
          });

          return seq.then(function(){ return runBatch(end); });
        }

        return runBatch(0);
      }).catch(function(err){
        LICSYSTEM.cruzamento._busy = false;
        if(btn){ btn.disabled = false; btn.textContent = "⚙️ Processar Lote (ML)"; }
        showAlert("cruzStatus","error","Falha no motor de cruzamento: "+utils.escapeHtml(err.message||String(err)));
      });
    },

    renderResult:function(rec, cls, statusLabel, freteNote){
      var box = el("cruzResults");
      var id = "res_"+Date.now()+"_"+Math.floor(Math.random()*1000);
      var showForce = (rec.similaridade>=60 && rec.similaridade<80);
      var freteHtml;
      if(rec.freteGratis || Number(rec.frete) === 0 && /frete\s*gr[aá]tis/i.test(freteNote || "")){
        freteHtml = '<span style="color:#1e9e5a;font-weight:800">FRETE GRÁTIS</span>';
      } else if(rec.freteOk || Number(rec.frete) > 0){
        freteHtml = utils.formatBrl(rec.frete) +
          (rec.cepUsado ? ' <span class="small muted">(CEP '+utils.escapeHtml(String(rec.cepUsado).replace(/^(\d{5})(\d{3})$/, "$1-$2"))+')</span>' : "");
      } else {
        freteHtml = '<span class="small muted">'+utils.escapeHtml(freteNote || "Frete não calculado")+'</span>';
      }
      var html='<div class="result-item '+cls+'" id="'+id+'">'+
        '<div class="ri-head">'+
          '<div><div class="ri-title">'+utils.escapeHtml(rec.produtoML)+'</div>'+
          '<div class="ri-sub">Item edital: '+utils.escapeHtml(rec.itemGoverno)+'</div>'+
          (rec.freteGratis ? '<div style="margin-top:6px"><span class="badge-status b-green">FRETE GRÁTIS</span></div>' : '')+
          '</div>'+
          '<div style="text-align:right"><div class="sim-ring" style="color:'+(rec.similaridade>=80?'#1e9e5a':rec.similaridade>=60?'#c9911f':'#d23b3b')+'">'+rec.similaridade+'%</div>'+
          '<span class="badge-status '+statusLabel+'">'+utils.escapeHtml(rec.status)+'</span></div>'+
        '</div>'+
        '<div class="ri-grid">'+
          metric("Preço ML", utils.formatBrl(rec.custoProduto))+
          metric("Frete", freteHtml)+
          metric("Desconto Forn.", utils.formatBrl(rec.descontoFornecedor||0))+
          metric("Custo Real", utils.formatBrl(rec.custoReal))+
          metric("Valor Final", utils.formatBrl(rec.precoVenda))+
          metric("Embalagem", rec.embalagem)+
        '</div>'+
        (freteNote && !rec.freteGratis ? '<div class="small muted" style="margin-top:8px">'+utils.escapeHtml(freteNote)+'</div>' : '')+
        '<div class="btn-row" style="margin-top:12px">'+
          (rec.link?'<a class="btn btn-ghost btn-sm" target="_blank" href="'+utils.escapeHtml(rec.link)+'">🔗 Ver Anúncio</a>':'')+
          (showForce?'<button type="button" class="btn btn-green btn-sm cruzForce">✔ Forçar Aprovação</button>':'')+
        '</div></div>';
      box.insertAdjacentHTML("afterbegin", html);
      if(showForce){
        var node = el(id).querySelector(".cruzForce");
        node.addEventListener("click", function(){
          LICSYSTEM.cruzamento.aprovar(rec, false);
          node.textContent="✔ Aprovado";
          node.disabled=true;
          node.classList.remove("btn-green"); node.classList.add("btn-ghost");
        });
      }
      function metric(l,v){ return '<div class="ri-metric"><div class="m-l">'+utils.escapeHtml(l)+'</div><div class="m-v">'+v+'</div></div>'; }
    },

    aprovar:function(rec, auto){
      var exists = LICSYSTEM.state.aprovadosCruzamento.some(function(a){ return a.idML===rec.idML && a.itemGoverno===rec.itemGoverno; });
      if(!exists){ LICSYSTEM.state.aprovadosCruzamento.push(rec); }
      if(LICSYSTEM.state.activeLeilaoId){
        try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace(); }catch(e){}
      }
      var path = utils.buildFirebasePath();
      if(utils.hasFirebaseConfig()){
        utils.firebasePush(path, rec).then(function(){
          /* silencioso em lote — status geral no fim */
        }).catch(function(){ /* silencioso */ });
      } else if(auto){
        /* modo local — silencioso em lote */
      }
    },

    gerarProposta:function(){
      if(!LICSYSTEM.state.aprovadosCruzamento.length){ alert("Nenhum item aprovado no cruzamento ainda."); return; }
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"landscape"});
        return licsystemPdfHeader(doc,"Proposta Comercial — Cruzamento ML", true).then(function(startY){
          var y = LICSYSTEM.licsystemPdfAfterTitle ? LICSYSTEM.licsystemPdfAfterTitle(doc, startY) : startY;
          if(LICSYSTEM.state.lastBdi){
            doc.setFont("helvetica","normal");
            doc.setFontSize(9); doc.setTextColor(90);
            doc.text("BDI: Margem "+LICSYSTEM.state.lastBdi.margem+"% | Imposto "+LICSYSTEM.state.lastBdi.imposto+"% | Custo Op. "+LICSYSTEM.state.lastBdi.custoOperacional+"% | Desc. "+utils.formatBrl(LICSYSTEM.state.lastBdi.descontoFornecedor||0), 14, y);
            y+=6;
          }
          var rows=[], geral=0;
          LICSYSTEM.state.aprovadosCruzamento.forEach(function(a,i){
            geral+=Number(a.precoVenda)||0;
            rows.push([i+1, a.itemGoverno, a.produtoML, a.similaridade+"%", utils.formatBrl(a.custoReal), utils.formatBrl(a.precoVenda)]);
          });
          doc.autoTable({
            startY:y+2,
            head:[["#","Item Edital","Produto ML","Sim.","Custo Real","Valor Final"]],
            body:rows,
            foot:[[
              {content:"TOTAL", colSpan:5, styles:{halign:"right"}},
              {content:utils.formatBrl(geral), styles:{halign:"right"}}
            ]],
            styles:{fontSize:8.5,cellPadding:3,overflow:"linebreak"},
            headStyles:{fillColor:[21,38,66],textColor:255},
            footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
            alternateRowStyles:{fillColor:[248,250,253]},
            columnStyles:{
              0:{cellWidth:12},
              3:{cellWidth:18,halign:"right"},
              4:{cellWidth:28,halign:"right"},
              5:{cellWidth:32,halign:"right"}
            }
          });
          if(LICSYSTEM.licsystemPdfPageNumbers) LICSYSTEM.licsystemPdfPageNumbers(doc);
          var nome = LICSYSTEM.licsystemPdfFileName
            ? LICSYSTEM.licsystemPdfFileName("cruzamento")
            : "proposta-cruzamento-licsystem.pdf";
          doc.save(nome);
        });
      }).catch(function(err){ alert("Falha ao gerar PDF: "+err.message); });
    }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
