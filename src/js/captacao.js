/* LICSYSTEM — CAPTACAO / IMPORTAR PDF */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  var BLACKLIST = ctx.BLACKLIST;
  function licsystemPdfHeader(){
    var fn = ctx.licsystemPdfHeader || window.licsystemPdfHeader || LICSYSTEM.licsystemPdfHeader;
    if (typeof fn !== "function") throw new Error("licsystemPdfHeader ainda não disponível");
    return fn.apply(this, arguments);
  }

  var UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  LICSYSTEM.captacao = Object.assign(LICSYSTEM.captacao || {}, {
BLACKLIST: BLACKLIST,

    initUf:function(){
      var sel = el("pncpUf");
      if(!sel || sel.options.length) return;
      var html='<option value="">Todas</option>';
      UF_LIST.forEach(function(u){ html+='<option value="'+u+'">'+u+'</option>'; });
      sel.innerHTML = html;
    },

    // Planilha do edital PDF (THEO / Castro / São Mateus / Contenda / Três Barras / clássico)
    pickOcrPages: function (pageTexts) {
      var list = pageTexts || [];
      var scored = [];
      for (var i = 0; i < list.length; i++) {
        var t = String(list[i] || "");
        var score = 0;
        if (/conforme os seguintes itens/i.test(t)) score += 8;
        if (/RELA[CÇ][AÃ]O\s+DOS\s+ITENS/i.test(t)) score += 10;
        if (/Especifica[cç][aã]o dos Produtos|ANEXO\s*0?1/i.test(t) && t.length < 1400)
          score += 5;
        if (/Total\s+Geral/i.test(t) && t.length < 800) score += 4;
        if (/\bITEM\b/i.test(t) && /\b(QTDE?|QUANT|UND|UNID)\b/i.test(t)) score += 6;
        if ((t.match(/R\$\s*\d/g) || []).length >= 4) score += 5;
        if ((t.match(/\d{1,3}(?:\.\d{3})*,\d{2}\b/g) || []).length >= 8) score += 4;
        if (t.length < 700 && i >= Math.floor(list.length * 0.35)) score += 2;
        if (score > 0) scored.push({ page: i + 1, score: score });
      }
      scored.sort(function (a, b) {
        return b.score - a.score || a.page - b.page;
      });
      var out = [];
      for (var s = 0; s < scored.length && out.length < 4; s++) {
        out.push(scored[s].page);
        // Página seguinte à que diz "conforme os seguintes itens" costuma ter a grade
        var nxt = scored[s].page + 1;
        if (
          /conforme os seguintes itens/i.test(list[scored[s].page - 1] || "") &&
          nxt <= list.length &&
          out.indexOf(nxt) === -1 &&
          out.length < 4
        ) {
          out.push(nxt);
        }
      }
      // Fallback: páginas do meio com pouco texto
      if (!out.length) {
        for (var p = 1; p <= list.length && out.length < 3; p++) {
          if (String(list[p - 1] || "").length < 600) out.push(p);
        }
      }
      return out;
    },

    renderPdfPagesToImages: function (pdf, pageNums) {
      var nums = (pageNums || []).slice(0, 4);
      var images = [];
      var chain = Promise.resolve();
      nums.forEach(function (num) {
        chain = chain.then(function () {
          return pdf.getPage(num).then(function (page) {
            var viewport = page.getViewport({ scale: 2.2 });
            var canvas = document.createElement("canvas");
            canvas.width = Math.ceil(viewport.width);
            canvas.height = Math.ceil(viewport.height);
            var ctx = canvas.getContext("2d");
            return page
              .render({ canvasContext: ctx, viewport: viewport })
              .promise.then(function () {
                var dataUrl = canvas.toDataURL("image/jpeg", 0.86);
                var b64 = dataUrl.replace(/^data:image\/jpeg;base64,/, "");
                images.push({ mimeType: "image/jpeg", data: b64, page: num });
                try {
                  canvas.width = 0;
                  canvas.height = 0;
                } catch (e) {}
              });
          });
        });
      });
      return chain.then(function () {
        return images;
      });
    },

    /** Extração fraca: poucos itens válidos ou tabela grande mal aproveitada. */
    extracaoFraca: function (items, geom) {
      items = items || [];
      var good = 0;
      for (var i = 0; i < items.length; i++) {
        var it = items[i];
        var desc = String((it && it.produto) || "").replace(/\s+/g, " ").trim();
        if (Number(it && it.qtd) > 0 && desc.length >= 4) good++;
      }
      if (good < 2) return true;
      var cand = 0;
      try {
        var bag = LICSYSTEM.captacaoParsers;
        if (geom && bag && typeof bag.countGeoCandidates === "function") {
          cand = bag.countGeoCandidates(geom);
        }
      } catch (e) {}
      if (cand >= 8 && items.length < cand * 0.35) return true;
      return false;
    },

    extractItensViaIa: function (images, textHint, filename) {
      return fetch("/api/analyze-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          mode: "extract-itens",
          images: (images || []).map(function (img) {
            return { mimeType: img.mimeType || "image/jpeg", data: img.data };
          }),
          textHint: String(textHint || "").slice(0, 8000),
          filename: filename || "edital.pdf"
        })
      }).then(function (res) {
        return res.text().then(function (raw) {
          var body = null;
          try {
            body = raw ? JSON.parse(raw) : null;
          } catch (e) {
            throw new Error("Resposta inválida da API analyze-pdf (HTTP " + res.status + ").");
          }
          if (!res.ok) {
            var msg = (body && (body.detail || body.error)) || "Erro HTTP " + res.status;
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
          }
          return LICSYSTEM.captacao.packApiItens(body && body.itens);
        });
      });
    },

    ocrPdfPages: function (pdf, pageNums) {
      var nums = (pageNums || []).slice(0, 4);
      if (!nums.length) return Promise.resolve("");
      showAlert(
        "pdfStatus",
        "info",
        '<span class="spinner"></span> Fallback OCR local (Tesseract)…'
      );
      return utils.ensureTesseract().then(function () {
        var chunks = [];
        var chain = Promise.resolve();
        nums.forEach(function (num) {
          chain = chain.then(function () {
            return pdf.getPage(num).then(function (page) {
              var scale = 2.4;
              var viewport = page.getViewport({ scale: scale });
              var canvas = document.createElement("canvas");
              canvas.width = Math.ceil(viewport.width);
              canvas.height = Math.ceil(viewport.height);
              var ctx = canvas.getContext("2d");
              return page
                .render({ canvasContext: ctx, viewport: viewport })
                .promise.then(function () {
                  return window.Tesseract.recognize(canvas, "por", {
                    logger: function () {}
                  }).then(function (res) {
                    var txt = (res && res.data && res.data.text) || "";
                    if (txt.trim()) chunks.push(txt);
                    try {
                      canvas.width = 0;
                      canvas.height = 0;
                    } catch (e) {}
                  });
                });
            });
          });
        });
        return chain.then(function () {
          return chunks.join("\n");
        });
      });
    },

    finishExtrair: function (items, note) {
      items = items || [];
      LICSYSTEM.state.captacaoLines = items;
      LICSYSTEM.state.capPage = 1;
      LICSYSTEM.captacao.render(items);
      var modelo = null;
      try {
        modelo =
          (LICSYSTEM.captacao.modelos && LICSYSTEM.captacao.modelos.last
            ? LICSYSTEM.captacao.modelos.last()
            : null) || LICSYSTEM.captacao.lastModelo;
      } catch (e) {}
      var msg =
        "Texto extraído: " +
        items.length +
        " item(ns) com lote, quantidade, descrição e valores do edital.";
      if (modelo && modelo.label) {
        msg +=
          " <b>Modelo:</b> " +
          utils.escapeHtml(modelo.label) +
          (modelo.id && modelo.id !== "desconhecido"
            ? ' <span class="muted">(' + utils.escapeHtml(modelo.id) + ")</span>"
            : "");
      } else if (!items.length) {
        msg +=
          " Layout ainda não cadastrado — usando extração genérica/IA quando disponível.";
      }
      if (note) msg += " " + note;
      showAlert("pdfStatus", items.length ? "ok" : "warn", msg);
      if (LICSYSTEM.state.activeLeilaoId) {
        try {
          LICSYSTEM.leiloesParticipo.saveActiveWorkspace();
        } catch (e) {}
      }
    },

    /** Anexa o PDF ao edital ativo para reuso em Importar / Análise IA. */
    guardarPdfDoEdital: function (file) {
      var id = LICSYSTEM.state.activeLeilaoId;
      if (!id || !file || !LICSYSTEM.editalPdf) return Promise.resolve(null);
      return LICSYSTEM.editalPdf.save(id, file).then(function (rec) {
        LICSYSTEM.captacao.renderAnexado(rec);
        return rec;
      });
    },

    renderAnexado: function (rec) {
      var box = el("pdfAnexado");
      if (!box) return;
      if (!rec) {
        box.className = "alert";
        box.innerHTML = "";
        return;
      }
      box.className = "alert show alert-ok";
      box.innerHTML =
        "📎 PDF do edital já anexado: <b>" +
        utils.escapeHtml(LICSYSTEM.editalPdf.label(rec)) +
        '</b> <button type="button" class="btn btn-ghost" id="btnExtrairAnexado" style="margin-left:10px">Extrair itens novamente</button>';
      var btn = el("btnExtrairAnexado");
      if (btn) {
        btn.addEventListener("click", function () {
          LICSYSTEM.captacao.extrair();
        });
      }
    },

    /**
     * Abertura da tela Importar com edital ativo: mostra o PDF anexado e extrai
     * sozinho quando o workspace ainda não tem itens.
     */
    autoImportar: function () {
      var id = LICSYSTEM.state.activeLeilaoId;
      // O campo é por edital: um arquivo escolhido no edital anterior não vale aqui.
      var inp = el("pdfFile");
      if (inp) inp.value = "";
      if (!id || !LICSYSTEM.editalPdf) {
        LICSYSTEM.captacao.renderAnexado(null);
        return;
      }
      LICSYSTEM.editalPdf
        .get(id)
        .then(function (rec) {
          LICSYSTEM.captacao.renderAnexado(rec);
          if (!rec) return;
          if ((LICSYSTEM.state.captacaoLines || []).length) return;
          if (LICSYSTEM.state._autoImportId === id) return;
          LICSYSTEM.state._autoImportId = id;
          LICSYSTEM.captacao.extrair();
        })
        .catch(function () {});
    },

    extrair:function(){
      var inp = el("pdfFile");
      var escolhido = inp && inp.files && inp.files[0];
      if (escolhido) {
        LICSYSTEM.captacao.guardarPdfDoEdital(escolhido);
        LICSYSTEM.captacao.extrairArquivo(escolhido);
        return;
      }
      var id = LICSYSTEM.state.activeLeilaoId;
      if (!id || !LICSYSTEM.editalPdf) {
        showAlert("pdfStatus","warn","Selecione um arquivo PDF primeiro.");
        return;
      }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Abrindo o PDF anexado ao edital…');
      LICSYSTEM.editalPdf.getFile(id).then(function (f) {
        if (!f) {
          showAlert("pdfStatus","warn","Selecione um arquivo PDF primeiro — nenhum PDF anexado a este edital.");
          return;
        }
        LICSYSTEM.captacao.extrairArquivo(f);
      }).catch(function () {
        showAlert("pdfStatus","warn","Selecione um arquivo PDF primeiro.");
      });
    },

    extrairArquivo:function(f){
      if(!f){ showAlert("pdfStatus","warn","Selecione um arquivo PDF primeiro."); return; }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Carregando biblioteca e extraindo texto…');
      utils.ensurePdfJs().then(function(){
        var reader = new FileReader();
        reader.onload = function(){
          var data = new Uint8Array(reader.result);
          window.pdfjsLib.getDocument({data:data}).promise.then(function(pdf){
            var pages=[], geomPages=[], p;
            var chain = Promise.resolve();
            for(p=1;p<=pdf.numPages;p++){
              (function(pg){
                chain = chain.then(function(){
                  return pdf.getPage(pg).then(function(page){
                    return page.getTextContent().then(function(tc){
                      var clustered = null;
                      try {
                        var bag = LICSYSTEM.captacaoParsers;
                        if (bag && typeof bag.clusterPdfTextItems === "function") {
                          clustered = bag.clusterPdfTextItems(tc.items || []);
                        }
                      } catch (e) {}
                      if (clustered && clustered.rows) {
                        geomPages.push({ rows: clustered.rows });
                        pages.push(clustered.text || "");
                        return;
                      }
                      var items = (tc.items || []).slice();
                      items.sort(function (a, b) {
                        var ya = a.transform ? a.transform[5] : 0;
                        var yb = b.transform ? b.transform[5] : 0;
                        if (Math.abs(ya - yb) > 3) return yb - ya;
                        var xa = a.transform ? a.transform[4] : 0;
                        var xb = b.transform ? b.transform[4] : 0;
                        return xa - xb;
                      });
                      var pageLines = [];
                      var buf = [];
                      var lastY = null;
                      for (var ii = 0; ii < items.length; ii++) {
                        var it = items[ii];
                        var str = it.str || "";
                        if (!str.trim()) continue;
                        var y = it.transform ? it.transform[5] : 0;
                        if (lastY !== null && Math.abs(y - lastY) > 3) {
                          if (buf.length) pageLines.push(buf.join(" ").replace(/\s+/g, " ").trim());
                          buf = [];
                        }
                        buf.push(str);
                        lastY = y;
                      }
                      if (buf.length) pageLines.push(buf.join(" ").replace(/\s+/g, " ").trim());
                      pages.push(pageLines.join("\n"));
                    });
                  });
                });
              })(p);
            }
            chain.then(function(){
              var full = pages.join("\n");
              var geom = { pages: geomPages };
              var items = LICSYSTEM.captacao.splitEdital(full, geom);
              var fraca = LICSYSTEM.captacao.extracaoFraca(items, geom);
              var pareceImagem =
                /conforme os seguintes itens/i.test(full) ||
                /RELA[CÇ][AÃ]O\s+DOS\s+ITENS/i.test(full) ||
                /Pinhal[aã]o/i.test(full);
              var precisaFallback = fraca || (items.length < 2 && pareceImagem);

              if (!precisaFallback) {
                LICSYSTEM.captacao.finishExtrair(items);
                return null;
              }

              var ocrPages = LICSYSTEM.captacao.pickOcrPages(pages);
              if (!ocrPages.length) {
                for (var pi = 1; pi <= pages.length && ocrPages.length < 3; pi++) ocrPages.push(pi);
              }
              showAlert(
                "pdfStatus",
                "info",
                '<span class="spinner"></span> Layout não reconhecido com segurança — lendo tabela com IA (páginas ' +
                  ocrPages.join(", ") +
                  ")…"
              );
              var fileName = (f && f.name) || "edital.pdf";
              var hint = full.slice(0, 5000);

              return LICSYSTEM.captacao
                .renderPdfPagesToImages(pdf, ocrPages)
                .then(function (images) {
                  return LICSYSTEM.captacao
                    .extractItensViaIa(images, hint, fileName)
                    .then(function (iaItems) {
                      var iaLen = (iaItems && iaItems.length) || 0;
                      if (iaLen >= 2 && (fraca || iaLen > items.length)) {
                        LICSYSTEM.captacao.lastModelo = {
                          id: "ia-imagem",
                          label: "Tabela lida por IA (layout não cadastrado)",
                          family: "ia",
                          via: "ia",
                          at: new Date().toISOString()
                        };
                        LICSYSTEM.captacao.finishExtrair(
                          iaItems,
                          "(planilha lida por IA)"
                        );
                        return null;
                      }
                      if (items.length) {
                        LICSYSTEM.captacao.finishExtrair(items);
                        return null;
                      }
                      throw new Error("IA não retornou itens");
                    })
                    .catch(function () {
                      return LICSYSTEM.captacao.ocrPdfPages(pdf, ocrPages).then(function (ocrText) {
                        if (!ocrText || ocrText.replace(/\s+/g, "").length < 40) {
                          LICSYSTEM.captacao.finishExtrair(
                            items,
                            items.length
                              ? ""
                              : "Não foi possível ler a planilha (IA/OCR)."
                          );
                          return;
                        }
                        var merged = full + "\n\n" + ocrText;
                        var items2 = LICSYSTEM.captacao.splitEdital(merged, geom);
                        LICSYSTEM.captacao.finishExtrair(
                          items2.length >= items.length ? items2 : items,
                          items2.length
                            ? "(inclui OCR da planilha)"
                            : "OCR rodou, mas o layout da tabela não foi reconhecido."
                        );
                      });
                    });
                });
            }).catch(function(err){
              showAlert("pdfStatus","error","Erro ao ler PDF: "+utils.escapeHtml(err && err.message ? err.message : err));
            });
          }).catch(function(err){
            showAlert("pdfStatus","error","Erro ao ler PDF: "+utils.escapeHtml(err.message));
          });
        };
        reader.readAsArrayBuffer(f);
      }).catch(function(err){
        showAlert("pdfStatus","error","Falha ao carregar pdf.js: "+utils.escapeHtml(err.message)+" — verifique a conexão.");
      });
    },

    // Uma <tr> por item, com checkbox individual — paginado (100/página)
    render:function(lines, filterAll){
      var kw = (el("pdfKeywords").value||"").split(",").map(function(s){return utils.fold(s).toLowerCase().trim();}).filter(Boolean);
      var body = el("captacaoBody");
      var data = lines || LICSYSTEM.state.captacaoLines || [];
      var filtered = data.map(function(l){ return utils.asCaptacaoItem(l); }).filter(function(it){
        return it && utils.isLinhaProdutoEdital(it);
      });
      if(kw.length && !filterAll){
        filtered = filtered.filter(function(it){
          var t = utils.fold(it.line || it.produto || "").toLowerCase();
          return kw.some(function(k){ return t.indexOf(k) !== -1; });
        });
      }
      LICSYSTEM.state.capFiltered = filtered;
      var size = LICSYSTEM.state.capPageSize || 100;
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      if(!LICSYSTEM.state.capPage || LICSYSTEM.state.capPage < 1) LICSYSTEM.state.capPage = 1;
      if(LICSYSTEM.state.capPage > pages) LICSYSTEM.state.capPage = pages;

      if(!total){
        body.innerHTML='<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Nenhuma linha corresponde ao filtro.</td></tr>';
        LICSYSTEM.captacao.updatePager();
        return;
      }

      var page = LICSYSTEM.state.capPage;
      var start = (page - 1) * size;
      var end = Math.min(start + size, total);
      var html="";
      for(var idx = start; idx < end; idx++){
        var it = filtered[idx];
        if(!it) continue;
        var linha = it.line || ((it.lote ? it.lote + " " : "") + it.qtd + " " + (it.und||"UN") + " " + it.produto);
        var risco = utils.riscoMatch(linha);
        var flag = risco.length ? '<span class="risk-flag" title="Risco: '+utils.escapeHtml(risco.join(", "))+'">⚠</span>' : "";
        html+='<tr class="'+(risco.length?'risk-row':'')+'" data-item-idx="'+idx+'">'+
          '<td><input type="checkbox" class="capChk" data-idx="'+idx+'" aria-label="Selecionar item '+(idx+1)+'"></td>'+
          '<td>'+utils.escapeHtml(it.lote || String(idx+1))+'</td>'+
          '<td>'+flag+utils.escapeHtml(linha)+'</td>'+
          '<td><button type="button" class="btn btn-ghost btn-sm capGoogle" data-q="'+utils.escapeHtml(utils.nomeProdutoEdital(linha))+'">🔎 Google</button></td>'+
          '</tr>';
      }
      body.innerHTML = html;
      var all = el("capCheckAll");
      if(all) all.checked = false;
      LICSYSTEM.captacao.updatePager();
    },

    updatePager:function(){
      var pager = el("capPager");
      var info = el("capPagerInfo");
      var prev = el("capPrev");
      var next = el("capNext");
      var total = (LICSYSTEM.state.capFiltered || []).length;
      var size = LICSYSTEM.state.capPageSize || 100;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var page = LICSYSTEM.state.capPage || 1;
      if(!pager) return;
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
      var size = LICSYSTEM.state.capPageSize || 100;
      var total = (LICSYSTEM.state.capFiltered || []).length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var next = (LICSYSTEM.state.capPage || 1) + delta;
      if(next < 1) next = 1;
      if(next > pages) next = pages;
      LICSYSTEM.state.capPage = next;
      LICSYSTEM.captacao.render(LICSYSTEM.state.captacaoLines, false);
    },

    exportarPdf:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      if(!checks.length){ showAlert("pdfStatus","warn","Selecione ao menos um item para exportar."); return; }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Gerando PDF…');
      var filtered = LICSYSTEM.state.capFiltered || [];
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"portrait"});
        return licsystemPdfHeader(doc,"Itens Selecionados do Edital").then(function(startY){
          var y = LICSYSTEM.licsystemPdfAfterTitle ? LICSYSTEM.licsystemPdfAfterTitle(doc, startY) : startY;
          var items = [];
          checks.forEach(function(c){
            var idx = Number(c.getAttribute("data-idx"));
            var it = filtered[idx];
            if(it) items.push(it);
            else if(c.getAttribute("data-line")) items.push({ produto: c.getAttribute("data-line") });
          });
          var structured = items.some(function(it){
            return it && (it.lote || Number(it.qtd) > 0 || Number(it.editalVunit) > 0);
          });
          var rows = [];
          var totalEdital = 0;
          if(structured){
            items.forEach(function(it, i){
              var qtd = Number(it.qtd) || 0;
              var unit = Number(it.editalVunit) || 0;
              var fin = Number(it.editalTotal) || (qtd && unit ? qtd * unit : 0);
              totalEdital += fin;
              rows.push([
                i + 1,
                it.lote || "",
                it.produto || it.line || "",
                qtd || "",
                unit ? utils.formatBrl(unit) : "",
                fin ? utils.formatBrl(fin) : ""
              ]);
            });
            doc.autoTable({
              startY: y,
              head: [["#", "Lote", "Descrição", "Qtd", "V.Unit", "V.Final"]],
              body: rows,
              foot: totalEdital ? [[
                {content:"TOTAL", colSpan:5, styles:{halign:"right"}},
                {content:utils.formatBrl(totalEdital), styles:{halign:"right"}}
              ]] : undefined,
              styles:{fontSize:8,cellPadding:2.5,overflow:"linebreak"},
              headStyles:{fillColor:[21,38,66],textColor:255},
              footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
              alternateRowStyles:{fillColor:[248,250,253]},
              columnStyles:{
                0:{cellWidth:12},
                1:{cellWidth:18},
                3:{cellWidth:18,halign:"right"},
                4:{cellWidth:26,halign:"right"},
                5:{cellWidth:28,halign:"right"}
              }
            });
          } else {
            items.forEach(function(it, i){
              rows.push([i + 1, it.produto || it.line || ""]);
            });
            doc.autoTable({
              startY: y,
              head: [["#", "Item / Descrição"]],
              body: rows,
              styles:{fontSize:9,cellPadding:3,overflow:"linebreak"},
              headStyles:{fillColor:[21,38,66],textColor:255},
              columnStyles:{0:{cellWidth:14}},
              alternateRowStyles:{fillColor:[248,250,253]}
            });
          }
          if(LICSYSTEM.licsystemPdfPageNumbers) LICSYSTEM.licsystemPdfPageNumbers(doc);
          var nome = LICSYSTEM.licsystemPdfFileName
            ? LICSYSTEM.licsystemPdfFileName("itens")
            : "edital-itens-selecionados.pdf";
          doc.save(nome);
          showAlert("pdfStatus","ok","PDF gerado com "+items.length+" itens.");
        });
      }).catch(function(err){ showAlert("pdfStatus","error","Falha ao gerar PDF: "+utils.escapeHtml(err.message)); });
    },

    googleSelecionados:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      if(!checks.length){ showAlert("pdfStatus","warn","Selecione ao menos um item."); return; }
      var filtered = LICSYSTEM.state.capFiltered || [];
      var n=0;
      checks.forEach(function(c){
        if(n>=8) return;
        var idx = Number(c.getAttribute("data-idx"));
        var it = filtered[idx];
        var q = it ? (it.produto || it.line || "") : (c.getAttribute("data-line") || "");
        window.open("https://www.google.com/search?q="+encodeURIComponent(q),"_blank");
        n++;
      });
    },

    paraOrcamento:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      var filtered = LICSYSTEM.state.capFiltered || [];
      var lines;
      if(checks.length){
        lines=[];
        checks.forEach(function(c){
          var idx = Number(c.getAttribute("data-idx"));
          var it = filtered[idx];
          if(it) lines.push(it);
          else if(c.getAttribute("data-line")) lines.push(c.getAttribute("data-line"));
        });
      } else {
        lines = (LICSYSTEM.state.captacaoLines || []).map(function(l){ return utils.asCaptacaoItem(l); }).filter(Boolean);
      }
      if(!lines.length){ showAlert("pdfStatus","warn","Nada para enviar. Extraia um edital primeiro."); return; }
      if(LICSYSTEM.state.activeLeilaoId){
        LICSYSTEM.state.orcBoundLeilaoId = String(LICSYSTEM.state.activeLeilaoId);
      }
      // Substitui a planilha (evita misturar import antigo quebrado no localStorage)
      LICSYSTEM.state.orcItems = [];
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.orcamento.addFromLines(lines);
      showAlert("pdfStatus","ok",lines.length+" item(ns) enviados ao Orçamento com lote, qtd, descrição e valores do edital.");
      if(LICSYSTEM.state.activeLeilaoId){
        try{ LICSYSTEM.leiloesParticipo.saveActiveWorkspace({ immediate: true, forceOrcamento: true }); }catch(e){}
        if(window.__lsActivateView){
          window.__lsActivateView("orcamento", { fromWorkspace: true, skipLeilaoGate: true, keepOrcamento: true });
        }
      } else if(window.__lsActivateView){
        window.__lsActivateView("orcamento", { keepOrcamento: true });
      }
    },

    /* ---------- Editais próximos (município + raio) ---------- */
  });

  ctx.UF_LIST = UF_LIST;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
