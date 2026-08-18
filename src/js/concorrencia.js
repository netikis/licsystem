/* LICSYSTEM — CONCORRENCIA + PDF HEADER (12-concorrencia.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

  /* ============================ CONCORRÊNCIA ============================ */
  LICSYSTEM.concorrencia = {
    buscar:function(){
      var raw = (el("cnpjInput").value||"").replace(/\D/g,"");
      if(raw.length !== 14){ showAlert("cnpjStatus","warn","Informe um CNPJ válido (14 dígitos)."); return; }
      showAlert("cnpjStatus","info",'<span class="spinner"></span> Consultando BrasilAPI…');
      el("cnpjResult").innerHTML="";
      fetch("https://brasilapi.com.br/api/cnpj/v1/"+raw).then(function(r){
        if(r.status===404) throw new Error("not-found");
        if(!r.ok) throw new Error("HTTP "+r.status);
        return r.json();
      }).then(function(j){
        hideAlert("cnpjStatus");
        var sit = (j.descricao_situacao_cadastral||"").toUpperCase();
        var sitCls = sit.indexOf("ATIVA")!==-1 ? "b-green" : (sit.indexOf("BAIXADA")!==-1||sit.indexOf("INAPTA")!==-1||sit.indexOf("SUSPENSA")!==-1 ? "b-red":"b-yellow");
        var html='<div class="card" style="margin:0;box-shadow:none;border-color:var(--ls-line)">'+
          '<h2 style="margin-bottom:12px">'+utils.escapeHtml(j.razao_social||j.nome_fantasia||"—")+'</h2>'+
          '<div class="ri-grid">'+
            m("Situação Cadastral", '<span class="badge-status '+sitCls+'">'+utils.escapeHtml(j.descricao_situacao_cadastral||"—")+'</span>')+
            m("Capital Social", utils.formatBrl(j.capital_social))+
            m("UF / Município", utils.escapeHtml((j.uf||"—")+" / "+(j.municipio||"—")))+
            m("Atividade Principal", utils.escapeHtml(j.cnae_fiscal_descricao||"—"))+
            m("Porte", utils.escapeHtml(j.porte||"—"))+
            m("Abertura", utils.escapeHtml(j.data_inicio_atividade||"—"))+
          '</div></div>';
        el("cnpjResult").innerHTML=html;
        function m(l,v){ return '<div class="ri-metric"><div class="m-l">'+utils.escapeHtml(l)+'</div><div class="m-v">'+v+'</div></div>'; }
      }).catch(function(err){
        if(err.message==="not-found") showAlert("cnpjStatus","error","CNPJ não encontrado.");
        else showAlert("cnpjStatus","error","Falha na consulta: "+utils.escapeHtml(err.message)+". (Se aberto via file://, pode haver bloqueio CORS.)");
      });
    }
  };

  /* ============================ PDF HEADER HELPER ============================ */
  // Returns Promise<number> — startY for content after header (fetches empresa_perfil from Firebase)
  function licsystemPdfHeader(doc, subtitle, landscape){
    return LICSYSTEM.ferramentas.getPerfil().then(function(perfil){
      var w = doc.internal.pageSize.getWidth();
      var nome = (perfil && perfil.nome) ? String(perfil.nome) : "LICSYSTEM";
      var cnpj = (perfil && perfil.cnpj) ? String(perfil.cnpj) : "";
      var telefone = (perfil && perfil.telefone) ? String(perfil.telefone) : "";
      var endereco = (perfil && perfil.endereco) ? String(perfil.endereco) : "";
      var logo = (perfil && perfil.logoBase64) ? String(perfil.logoBase64) : "";
      var hasExtra = !!(cnpj || telefone || endereco);
      var headerH = hasExtra ? 34 : 26;

      doc.setFillColor(21,38,66);
      doc.rect(0,0,w,headerH,"F");
      doc.setFillColor(201,162,39);
      doc.rect(0,headerH,w,2,"F");

      var textX = 14;
      if(logo && logo.indexOf("data:image") === 0){
        try{
          var fmt = "JPEG";
          if(/data:image\/png/i.test(logo)) fmt = "PNG";
          else if(/data:image\/webp/i.test(logo)) fmt = "WEBP";
          else if(/data:image\/gif/i.test(logo)) fmt = "GIF";
          var logoH = hasExtra ? 22 : 16;
          var logoW = logoH * 1.4;
          doc.addImage(logo, fmt, 10, (headerH - logoH) / 2, logoW, logoH);
          textX = 14 + logoW + 4;
        }catch(e){ /* logo inválido — segue sem imagem */ }
      }

      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold"); doc.setFontSize(13);
      doc.text(nome, textX, hasExtra ? 11 : 12);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.setTextColor(201,162,39);
      if(hasExtra){
        var line2 = [cnpj ? "CNPJ "+cnpj : "", telefone ? "Tel. "+telefone : ""].filter(Boolean).join("  ·  ");
        if(line2) doc.text(line2, textX, 18);
        if(endereco){
          var end = endereco.length > 90 ? endereco.slice(0,87)+"…" : endereco;
          doc.setTextColor(185,198,219);
          doc.text(end, textX, 25);
        }
      } else {
        doc.text("LICSYSTEM", textX, 19);
      }

      doc.setFontSize(8); doc.setTextColor(185,198,219);
      doc.text("Emitido em "+new Date().toLocaleString("pt-BR"), w-14, hasExtra ? 11 : 12, {align:"right"});

      var titleY = headerH + 10;
      doc.setTextColor(21,38,66); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text(subtitle||"", 14, titleY);
      return titleY + 6;
    });
  }

  function licsystemPdfEditalLine(){
    var bits = [];
    try{
      var item = LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.getActiveItem
        ? LICSYSTEM.leiloesParticipo.getActiveItem()
        : null;
      if(item){
        if(item.titulo) bits.push(item.titulo);
        else if(item.filename) bits.push(item.filename);
        if(item.orgao) bits.push(item.orgao);
        if(item.municipio) bits.push(item.municipio);
      }
    }catch(e){}
    var st = LICSYSTEM.state || {};
    if(st.orcMetaNumero) bits.push("Nº " + st.orcMetaNumero);
    else if(st.orcMetaNome && bits.indexOf(st.orcMetaNome) === -1) bits.push(st.orcMetaNome);
    var seen = {};
    return bits.filter(function(b){
      var k = String(b || "").toLowerCase();
      if(!k || seen[k]) return false;
      seen[k] = true;
      return true;
    }).join("  ·  ");
  }

  function licsystemPdfAfterTitle(doc, startY, extraLine){
    var line = extraLine == null ? licsystemPdfEditalLine() : extraLine;
    if(!line) return startY;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(70, 85, 110);
    var maxW = doc.internal.pageSize.getWidth() - 28;
    var lines = doc.splitTextToSize(String(line), maxW);
    doc.text(lines, 14, startY);
    return startY + lines.length * 4.6 + 2;
  }

  function licsystemPdfPageNumbers(doc){
    var n = doc.getNumberOfPages();
    var w = doc.internal.pageSize.getWidth();
    var h = doc.internal.pageSize.getHeight();
    for(var i = 1; i <= n; i++){
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 130, 145);
      doc.text("Página " + i + " de " + n, w - 14, h - 8, {align:"right"});
    }
  }

  function licsystemPdfFileName(prefix){
    var st = LICSYSTEM.state || {};
    var raw = st.orcMetaNumero || st.orcMetaNome || "";
    if(!raw){
      try{
        var item = LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.getActiveItem
          ? LICSYSTEM.leiloesParticipo.getActiveItem()
          : null;
        if(item) raw = item.titulo || item.filename || "";
      }catch(e){}
    }
    var slug = String(raw || prefix || "licsystem")
      .replace(/[^\w\-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 48) || "licsystem";
    return slug + "-" + (prefix || "documento") + ".pdf";
  }

  ctx.licsystemPdfHeader = licsystemPdfHeader;
  LICSYSTEM.licsystemPdfHeader = licsystemPdfHeader;
  window.licsystemPdfHeader = licsystemPdfHeader;
  LICSYSTEM.licsystemPdfAfterTitle = licsystemPdfAfterTitle;
  LICSYSTEM.licsystemPdfPageNumbers = licsystemPdfPageNumbers;
  LICSYSTEM.licsystemPdfFileName = licsystemPdfFileName;
  LICSYSTEM.licsystemPdfEditalLine = licsystemPdfEditalLine;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
