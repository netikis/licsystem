/* LICSYSTEM — ORCAMENTO / IMPORTAR PLANILHA */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  function wireOrcFileInput(){
    var fn = ctx.wireOrcFileInput || window.wireOrcFileInput || LICSYSTEM.wireOrcFileInput;
    if (typeof fn !== "function") throw new Error("wireOrcFileInput ainda não disponível");
    return fn.apply(this, arguments);
  }

  LICSYSTEM.orcamento = Object.assign(LICSYSTEM.orcamento || {}, {
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
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
