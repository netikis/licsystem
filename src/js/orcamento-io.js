/* LICSYSTEM — ORCAMENTO / EXPORT / CATALOGO / PROPOSTA */
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
  function listarProdutos(){
    var fn = ctx.listarProdutos || window.listarProdutos || LICSYSTEM.listarProdutos;
    if (typeof fn !== "function") throw new Error("listarProdutos ainda não disponível");
    return fn.apply(this, arguments);
  }

  LICSYSTEM.orcamento = Object.assign(LICSYSTEM.orcamento || {}, {
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
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
