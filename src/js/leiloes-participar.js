/* LICSYSTEM — LICITACOES QUE PARTICIPO / ANALISE / PARTICIPAR */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

  LICSYSTEM.leiloesParticipo = Object.assign(LICSYSTEM.leiloesParticipo || {}, {
    extractMetaFromReport: function(md){
      var text = String(md || "");
      var out = { orgao: "", municipio: "", resumo: "" };
      if(!text.trim()) return out;

      function grab(re){
        var m = text.match(re);
        return m && m[1] ? String(m[1]).replace(/\*\*/g, "").replace(/`/g, "").trim() : "";
      }

      out.orgao = grab(/(?:[Oo]rg[aã]o|[Ee]ntidade|[Pp]refeitura|[Uu]nidade\s+[Gg]estora)\s*[:\-–]\s*([^\n|]{3,120})/);
      out.municipio = grab(/(?:[Mm]unic[ií]pio|[Cc]idade|[Ll]ocalidade)\s*[:\-–]\s*([^\n|]{2,80})/);
      if(!out.municipio){
        var mun2 = text.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç ]{2,40})\s*\/\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
        if(mun2) out.municipio = (mun2[1] + "/" + mun2[2]).trim();
      }

      // Resumo: preferseção "Resumo Simples", senão primeiros ~280 chars úteis
      var resumoSec = text.match(/(?:#{1,4}\s*)?(?:\d+\.\s*)?Resumo\s+Simples[\s\S]{0,40}?([\s\S]{40,500}?)(?=\n#{1,4}\s|\n```|\n\*\*Alerta|\n---|\s*$)/i);
      if(resumoSec && resumoSec[1]){
        out.resumo = resumoSec[1]
          .replace(/^[-*•]\s+/gm, "")
          .replace(/\*\*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 400);
      } else {
        out.resumo = text
          .replace(/```[\s\S]*?```/g, " ")
          .replace(/#{1,6}\s*/g, "")
          .replace(/\*\*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 280);
      }
      return out;
    },
    buildFromAnalysis: function(){
      var filename = (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
      var docs = LICSYSTEM.analiseIa.documentosExigidos || [];
      if(!docs.length && LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data){
        docs = LICSYSTEM.docsChecklist.data.documentos || [];
      }
      var parsed = LICSYSTEM.leiloesParticipo.extractMetaFromReport(LICSYSTEM.analiseIa.relatorioMd || "");
      var titulo =
        parsed.orgao ||
        (LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data && LICSYSTEM.docsChecklist.data.editalNome) ||
        (filename ? filename.replace(/\.pdf$/i, "") : "") ||
        "Edital analisado";
      return {
        titulo: titulo,
        orgao: parsed.orgao || "",
        municipio: parsed.municipio || "",
        filename: filename || (LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data && LICSYSTEM.docsChecklist.data.filename) || "",
        dataAnalise: Date.now(),
        resumo: parsed.resumo || "",
        analysisSnippet: parsed.resumo || "",
        documentosExigidos: docs,
        status: "participando"
      };
    },
    findDuplicate: function(entry){
      var fn = String(entry.filename || "").toLowerCase();
      var tit = String(entry.titulo || "").toLowerCase();
      for(var i = 0; i < LICSYSTEM.leiloesParticipo.items.length; i++){
        var it = LICSYSTEM.leiloesParticipo.items[i];
        if(it.status === "arquivado") continue;
        if(fn && String(it.filename || "").toLowerCase() === fn) return it;
        if(tit && String(it.titulo || "").toLowerCase() === tit) return it;
      }
      return null;
    },
    addFromAnalysis: function(){
      if(!(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd)){
        showAlert("iaAlert", "warn", "Analise um edital antes de confirmar participação.");
        return null;
      }
      var draft = LICSYSTEM.leiloesParticipo.buildFromAnalysis();
      var relatorioMd = String(LICSYSTEM.analiseIa.relatorioMd || "").slice(0, 100000);
      var dup = LICSYSTEM.leiloesParticipo.findDuplicate(draft);
      var now = Date.now();
      if(dup){
        dup.titulo = draft.titulo;
        dup.orgao = draft.orgao || dup.orgao;
        dup.municipio = draft.municipio || dup.municipio;
        dup.filename = draft.filename || dup.filename;
        dup.dataAnalise = now;
        dup.resumo = draft.resumo || dup.resumo;
        dup.analysisSnippet = draft.analysisSnippet || dup.analysisSnippet;
        dup.documentosExigidos = draft.documentosExigidos;
        dup.status = "participando";
        dup.updatedAt = now;
        if(!dup.workspace) dup.workspace = LICSYSTEM.leiloesParticipo.emptyWorkspace();
        dup.workspace.relatorioMd = relatorioMd || dup.workspace.relatorioMd || "";
        LICSYSTEM.leiloesParticipo.persist({ immediate: true });
        LICSYSTEM.leiloesParticipo.anexarPdfDaAnalise(dup.id);
        LICSYSTEM.leiloesParticipo.render();
        return dup;
      }
      var item = LICSYSTEM.leiloesParticipo.normalizeItem({
        id: "lp_" + now + "_" + Math.random().toString(36).slice(2, 7),
        titulo: draft.titulo,
        orgao: draft.orgao,
        municipio: draft.municipio,
        filename: draft.filename,
        dataAnalise: now,
        resumo: draft.resumo,
        analysisSnippet: draft.analysisSnippet,
        documentosExigidos: draft.documentosExigidos,
        workspace: { relatorioMd: relatorioMd },
        status: "participando",
        createdAt: now,
        updatedAt: now
      });
      LICSYSTEM.leiloesParticipo.items.unshift(item);
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.anexarPdfDaAnalise(item.id);
      LICSYSTEM.leiloesParticipo.render();
      return item;
    },
    anexarPdfDaAnalise: function(leilaoId){
      var file = LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.file;
      if(!leilaoId || !file || !LICSYSTEM.editalPdf) return Promise.resolve(null);
      return LICSYSTEM.editalPdf.save(leilaoId, file).catch(function(){ return null; });
    },
    showParticiparModal: function(){
      if(!(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd)){
        showAlert("iaAlert", "warn", "Não há análise ativa. Analise um PDF primeiro.");
        return;
      }
      var ov = el("participarOverlay");
      var metaBox = el("participarModalMeta");
      var lead = el("participarModalLead");
      if(!ov) return;
      var draft = LICSYSTEM.leiloesParticipo.buildFromAnalysis();
      if(lead){
        lead.innerHTML = "Deseja marcar este edital em <b>Licitações que Participo</b> para acompanhar a disputa?";
      }
      if(metaBox){
        var bits = [];
        bits.push("<div><b>Edital:</b> " + utils.escapeHtml(draft.titulo || "—") + "</div>");
        if(draft.orgao) bits.push("<div><b>Órgão:</b> " + utils.escapeHtml(draft.orgao) + "</div>");
        if(draft.municipio) bits.push("<div><b>Município:</b> " + utils.escapeHtml(draft.municipio) + "</div>");
        if(draft.filename) bits.push("<div class='muted small'>" + utils.escapeHtml(draft.filename) + "</div>");
        if(draft.documentosExigidos && draft.documentosExigidos.length){
          bits.push("<div class='muted small'>" + draft.documentosExigidos.length + " documento(s) exigido(s) serão vinculados</div>");
        }
        if(draft.resumo){
          bits.push("<div class='participar-resumo'>" + utils.escapeHtml(draft.resumo) + "</div>");
        }
        metaBox.innerHTML = bits.join("");
      }
      LICSYSTEM.leiloesParticipo.renderParticipantesLoading();
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
      LICSYSTEM.leiloesParticipo.loadParticipantesAnalysis(draft);
    },
    renderParticipantesLoading: function(){
      var box = el("participarEmpresasBody");
      if(!box) return;
      box.innerHTML =
        '<div class="participar-empresas-loading muted small">' +
          '<span class="spinner" style="width:14px;height:14px;border-width:2px;border-color:#ccc;border-top-color:#152642"></span>' +
          " A IA está analisando quem pode disputar este leilão…" +
        "</div>";
    },
    formatCnpj: function(cnpj){
      var d = String(cnpj || "").replace(/\D/g, "");
      if(d.length !== 14) return d || "";
      return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
    },
    renderParticipantesResult: function(data){
      var box = el("participarEmpresasBody");
      if(!box) return;
      data = data || {};
      var html = [];
      if(data.exclusivoMeEpp === true){
        html.push('<span class="participar-pill is-me">Exclusivo / prioridade ME·EPP</span>');
      } else if(data.exclusivoMeEpp === false){
        html.push('<span class="participar-pill">Aberto a qualquer porte (conforme edital)</span>');
      }
      if(data.resumo){
        html.push('<p class="participar-empresas-resumo">' + utils.escapeHtml(data.resumo) + "</p>");
      }
      if(data.criterios && data.criterios.length){
        html.push('<div class="participar-sub">Critérios de participação</div><ul class="participar-list">');
        data.criterios.forEach(function(c){
          html.push("<li>" + utils.escapeHtml(c) + "</li>");
        });
        html.push("</ul>");
      }
      if(data.restricoes && data.restricoes.length){
        html.push('<div class="participar-sub">Restrições / barreiras</div><ul class="participar-list">');
        data.restricoes.forEach(function(c){
          html.push("<li>" + utils.escapeHtml(c) + "</li>");
        });
        html.push("</ul>");
      }
      if(data.perfisAptos && data.perfisAptos.length){
        html.push('<div class="participar-sub">Perfis de empresas aptas</div>');
        data.perfisAptos.forEach(function(p){
          html.push(
            '<div class="participar-empresa-item">' +
              "<strong>" + utils.escapeHtml(p.perfil || "Perfil") +
              (p.porte ? ' <span class="muted">· ' + utils.escapeHtml(p.porte) + "</span>" : "") +
              "</strong>" +
              (p.porQue ? '<div class="muted">' + utils.escapeHtml(p.porQue) + "</div>" : "") +
            "</div>"
          );
        });
      }
      if(data.empresasPncp && data.empresasPncp.length){
        html.push('<div class="participar-sub">Empresas com contratos semelhantes (PNCP)</div>');
        data.empresasPncp.forEach(function(e){
          var cnpjFmt = LICSYSTEM.leiloesParticipo.formatCnpj(e.cnpj);
          html.push(
            '<div class="participar-empresa-item">' +
              "<strong>" + utils.escapeHtml(e.nome || "Fornecedor") + "</strong>" +
              (cnpjFmt ? '<div class="muted">CNPJ ' + utils.escapeHtml(cnpjFmt) + "</div>" : "") +
              (e.objeto ? '<div class="muted">' + utils.escapeHtml(e.objeto) + "</div>" : "") +
              ((e.orgao || e.uf)
                ? '<div class="muted">' + utils.escapeHtml([e.orgao, e.uf].filter(Boolean).join(" · ")) + "</div>"
                : "") +
            "</div>"
          );
        });
      }
      if(data.alertaConcorrencia){
        html.push(
          '<div class="participar-sub">Concorrência</div>' +
          '<p class="participar-empresas-resumo" style="margin:0">' + utils.escapeHtml(data.alertaConcorrencia) + "</p>"
        );
      }
      html.push(
        '<div class="participar-empresas-aviso">' +
          utils.escapeHtml(
            data.aviso ||
            "Não é lista oficial de inscritos — critérios do edital + perfis e, se houver, fornecedores do PNCP com objeto parecido."
          ) +
        "</div>"
      );
      if(!data.resumo && !(data.criterios && data.criterios.length) && !(data.perfisAptos && data.perfisAptos.length)){
        box.innerHTML = '<div class="muted small">Não foi possível montar o perfil de participantes.</div>';
        return;
      }
      box.innerHTML = html.join("");
    },
    loadParticipantesAnalysis: function(draft){
      draft = draft || {};
      var token = String(Date.now());
      LICSYSTEM.leiloesParticipo._partToken = token;
      var text =
        String(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd || "") ||
        String(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.text || "");
      if(!text || text.length < 40){
        var box = el("participarEmpresasBody");
        if(box) box.innerHTML = '<div class="muted small">Sem texto de análise para estimar participantes.</div>';
        return;
      }
      var uf = "";
      var mun = String(draft.municipio || "");
      var mUf = mun.match(/\/\s*([A-Za-z]{2})\b/);
      if(mUf) uf = mUf[1].toUpperCase();

      var objeto = String(draft.resumo || "").slice(0, 280);
      var objM = text.match(/(?:^|\n)\s*(?:\d+\.\s*)?(?:\*\*)?objeto(?:\s+da\s+contrata[cç][aã]o)?(?:\*\*)?\s*[:\-–]\s*([^\n]{12,240})/i);
      if(objM && objM[1]) objeto = objM[1].replace(/\*\*/g, "").trim().slice(0, 280);

      fetch("/api/analyze-participantes", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          text: text.slice(0, 60000),
          orgao: draft.orgao || "",
          municipio: draft.municipio || "",
          uf: uf,
          objeto: objeto || draft.titulo || ""
        })
      })
        .then(function(res){
          return res.text().then(function(raw){
            var body = null;
            try{ body = raw ? JSON.parse(raw) : null; }catch(e){}
            if(!res.ok){
              var msg = (body && (body.error || body.detail)) || ("Erro HTTP " + res.status);
              throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
            }
            return body;
          });
        })
        .then(function(body){
          if(LICSYSTEM.leiloesParticipo._partToken !== token) return;
          LICSYSTEM.leiloesParticipo.renderParticipantesResult(body);
        })
        .catch(function(err){
          if(LICSYSTEM.leiloesParticipo._partToken !== token) return;
          var box = el("participarEmpresasBody");
          if(box){
            box.innerHTML =
              '<div class="muted small">Não deu para analisar participantes agora' +
              (err && err.message ? ": " + utils.escapeHtml(err.message) : ".") +
              "</div>";
          }
        });
    },
    closeParticiparModal: function(){
      var ov = el("participarOverlay");
      if(!ov) return;
      LICSYSTEM.leiloesParticipo._partToken = null;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
    },
    confirmSim: function(){
      var item = LICSYSTEM.leiloesParticipo.addFromAnalysis();
      LICSYSTEM.leiloesParticipo.closeParticiparModal();
      if(!item) return;
      showAlert("iaAlert", "ok", "Salvo em Licitações que Participo.");
      LICSYSTEM.leiloesParticipo.openWorkspace(item.id, "leilaoWorkspace");
      showAlert("lwHubAlert", "ok", "Participação confirmada. Use o painel abaixo para Docs, Análise, Importar, Orçamento e Cruzamento deste edital.");
    },
    confirmNao: function(){
      LICSYSTEM.leiloesParticipo.closeParticiparModal();
      showAlert("iaAlert", "info", "Ok — edital não foi adicionado à lista.");
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
