/* LICSYSTEM — ANALISE IA (21-analise-ia.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  function wire(){
    var fn = ctx.wire || window.wire || LICSYSTEM.wire;
    if (typeof fn !== "function") throw new Error("wire ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ ANÁLISE INTELIGENTE DE EDITAIS (IA) ============================ */
  LICSYSTEM.analiseIa = {
    file: null,
    text: "",
    relatorioMd: "",
    documentosExigidos: [],
    busy: false,
    MAX_PAGES: 45,
    MAX_CHARS: 150000,

    setBusy: function(on){
      LICSYSTEM.analiseIa.busy = !!on;
      var btn = el("btnIaAnalisar");
      if(btn){
        btn.disabled = !!on;
        btn.textContent = on ? "Analisando…" : "✨ Analisar com IA";
      }
      var prog = el("iaProgress");
      if(prog){
        prog.classList.toggle("show", !!on);
        prog.setAttribute("aria-hidden", on ? "false" : "true");
      }
    },

    setActionButtons: function(enabled){
      var c = el("btnIaCopiar");
      var p = el("btnIaImprimir");
      var d = el("btnIaDocs");
      var part = el("btnIaParticipar");
      if(c) c.disabled = !enabled;
      if(p) p.disabled = !enabled;
      if(d) d.disabled = !enabled;
      if(part) part.disabled = !enabled;
    },

    limparRelatorio: function(){
      LICSYSTEM.analiseIa.relatorioMd = "";
      LICSYSTEM.analiseIa.documentosExigidos = [];
      var sheet = el("iaReportSheet");
      if(sheet){
        sheet.className = "ia-report-sheet ia-empty";
        sheet.innerHTML = "O relatório da análise aparecerá aqui após processar o edital.";
      }
      LICSYSTEM.analiseIa.setActionButtons(false);
    },

    limpar: function(){
      LICSYSTEM.analiseIa.file = null;
      LICSYSTEM.analiseIa.text = "";
      LICSYSTEM.analiseIa._pendingParticiparAsk = false;
      var inp = el("iaPdfFile");
      if(inp) inp.value = "";
      var meta = el("iaFileMeta");
      if(meta){ meta.className = "ia-file-meta"; meta.textContent = ""; }
      LICSYSTEM.analiseIa.limparRelatorio();
      hideAlert("iaAlert");
      LICSYSTEM.analiseIa.setBusy(false);
      try{ LICSYSTEM.leiloesParticipo.closeParticiparModal(); }catch(e){}
    },

    normDocsList: function(list){
      if(!Array.isArray(list)) return [];
      var out = [];
      var seen = {};
      list.forEach(function(item){
        if(!item) return;
        var nome = typeof item === "string"
          ? item.trim()
          : String(item.nome || item.name || item.documento || "").trim();
        if(!nome || nome.length < 2) return;
        var key = nome.toLowerCase().replace(/\s+/g, " ");
        if(seen[key]) return;
        seen[key] = true;
        out.push({
          nome: nome.slice(0, 220),
          tipo: LICSYSTEM.docsChecklist.normTipo(item.tipo || item.type || "outro"),
          obs: String(item.obs || item.observacao || "").trim().slice(0, 400)
        });
      });
      return out.slice(0, 80);
    },

    /** Fallback: tenta ler listas do Markdown (habilitação / checklist). */
    parseDocsFromMarkdown: function(md){
      var text = String(md || "");
      if(!text.trim()) return [];
      var lines = text.split(/\r?\n/);
      var collecting = false;
      var tipoAtual = "habilitacao";
      var items = [];
      var sectionRe = /^(#{1,4}\s*)?(\d+\.\s*)?(exig[eê]ncias?\s+de\s+habilita|habilita[cç][aã]o|checklist\s+final|documentos?\s+exig|qualifica[cç][aã]o\s+t[eé]cnica)/i;
      var stopRe = /^(#{1,4}\s*)?(\d+\.\s*)?(informa[cç][oõ]es\s+gerais|cronograma|especifica[cç]|regras\s+de\s+proposta|crit[eé]rios|penalidades|condi[cç][oõ]es\s+de\s+entrega|contrato\s+ou\s+ata|resumo\s+simples)/i;

      for(var i = 0; i < lines.length; i++){
        var line = lines[i].trim();
        if(!line) continue;
        if(sectionRe.test(line)){
          collecting = true;
          if(/t[eé]cnica/i.test(line)) tipoAtual = "tecnica";
          else if(/checklist/i.test(line)) tipoAtual = "outro";
          else tipoAtual = "habilitacao";
          continue;
        }
        if(collecting && stopRe.test(line)){
          collecting = false;
          continue;
        }
        if(!collecting) continue;
        var m = line.match(/^[-*•]\s+(.+)/) || line.match(/^\d+[.)]\s+(.+)/);
        if(!m) continue;
        var nome = String(m[1] || "")
          .replace(/\*\*/g, "")
          .replace(/`/g, "")
          .replace(/\s+/g, " ")
          .trim();
        // Evita bullets genéricos muito longos (parágrafos)
        if(nome.length < 4 || nome.length > 180) continue;
        if(/^(os|as|o|a|de|da|do)\s/i.test(nome) && nome.length > 120) continue;
        items.push({ nome: nome, tipo: tipoAtual, obs: "Extraído do relatório" });
      }
      return LICSYSTEM.analiseIa.normDocsList(items);
    },

    openDocsModal: function(){
      var docs = LICSYSTEM.analiseIa.documentosExigidos || [];
      if(!docs.length && LICSYSTEM.analiseIa.relatorioMd){
        docs = LICSYSTEM.analiseIa.parseDocsFromMarkdown(LICSYSTEM.analiseIa.relatorioMd);
        LICSYSTEM.analiseIa.documentosExigidos = docs;
      }
      var filename = (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
      LICSYSTEM.docsChecklist.showModal(docs, {
        filename: filename,
        editalNome: filename ? filename.replace(/\.pdf$/i, "") : "Edital analisado"
      });
    },

    renderRelatorio: function(md){
      var sheet = el("iaReportSheet");
      if(!sheet) return;
      var raw = String(md || "").trim();
      LICSYSTEM.analiseIa.relatorioMd = raw;
      if(!raw){
        LICSYSTEM.analiseIa.limparRelatorio();
        return;
      }
      var html = "";
      try{
        if(window.marked && typeof window.marked.parse === "function"){
          html = window.marked.parse(raw);
        } else if(window.marked && typeof window.marked === "function"){
          html = window.marked(raw);
        } else {
          html = "<pre style='white-space:pre-wrap;font-family:inherit'>"+utils.escapeHtml(raw)+"</pre>";
        }
      }catch(e){
        html = "<pre style='white-space:pre-wrap;font-family:inherit'>"+utils.escapeHtml(raw)+"</pre>";
      }
      sheet.className = "ia-report-sheet";
      sheet.innerHTML = html;
      LICSYSTEM.analiseIa.setActionButtons(true);
    },

    copiarRelatorio: function(){
      var md = LICSYSTEM.analiseIa.relatorioMd || "";
      if(!md){
        showAlert("iaAlert","warn","Não há relatório para copiar.");
        return;
      }
      var done = function(){
        showAlert("iaAlert","ok","Relatório copiado para a área de transferência.");
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(md).then(done).catch(function(){
          var ta = document.createElement("textarea");
          ta.value = md;
          document.body.appendChild(ta);
          ta.select();
          try{ document.execCommand("copy"); done(); }
          catch(e){ showAlert("iaAlert","error","Não foi possível copiar."); }
          document.body.removeChild(ta);
        });
      } else {
        showAlert("iaAlert","warn","Copiar não disponível neste navegador.");
      }
    },

    imprimirRelatorio: function(){
      if(!LICSYSTEM.analiseIa.relatorioMd){
        showAlert("iaAlert","warn","Não há relatório para imprimir.");
        return;
      }
      try{ window.print(); }catch(e){
        showAlert("iaAlert","error","Falha ao abrir impressão.");
      }
    },

    errMsg: function(err){
      if(!err) return "Erro desconhecido";
      if(typeof err === "string") return err;
      if(err.message && typeof err.message === "string") return err.message;
      try{ return JSON.stringify(err); }catch(e){ return String(err); }
    },

    onFile: function(file){
      if(!file) return;
      if(file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name||"")){
        showAlert("iaAlert","warn","Selecione um arquivo PDF.");
        return;
      }
      LICSYSTEM.analiseIa.file = file;
      LICSYSTEM.analiseIa.text = "";
      LICSYSTEM.analiseIa.limparRelatorio();
      LICSYSTEM.analiseIa.setBusy(false);
      var meta = el("iaFileMeta");
      if(meta){
        var kb = (file.size / 1024).toFixed(1);
        meta.className = "ia-file-meta show";
        meta.textContent = "Arquivo: " + file.name + " (" + kb + " KB) — clique em Analisar com IA.";
      }
      LICSYSTEM.analiseIa.anexarAoEditalAtivo(file);
      hideAlert("iaAlert");
    },

    /**
     * Guarda o PDF no edital ativo (quando já existe) para que Importar não
     * precise pedir o arquivo de novo. Sem edital ativo, fica em memória até
     * a confirmação de participação criar o edital.
     */
    anexarAoEditalAtivo: function(file){
      if(!file || !LICSYSTEM.editalPdf) return Promise.resolve(null);
      var id = LICSYSTEM.state.activeLeilaoId;
      if(!id) return Promise.resolve(null);
      return LICSYSTEM.editalPdf.save(id, file).catch(function(){ return null; });
    },

    extrairTextoPdf: function(file){
      var maxPages = LICSYSTEM.analiseIa.MAX_PAGES;
      var maxChars = LICSYSTEM.analiseIa.MAX_CHARS;

      return utils.ensurePdfJs().then(function(){
        return new Promise(function(resolve, reject){
          var reader = new FileReader();
          reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo PDF.")); };
          reader.onload = function(){
            try{ resolve(new Uint8Array(reader.result)); }
            catch(e){ reject(e); }
          };
          reader.readAsArrayBuffer(file);
        });
      }).then(function(data){
        return window.pdfjsLib.getDocument({ data: data }).promise;
      }).then(function(pdf){
        var total = pdf.numPages || 0;
        var limit = Math.min(total, maxPages);
        var pages = [];
        var i = 1;

        function next(){
          if(i > limit){
            var joined = pages.join("\n\n");
            if(total > limit){
              joined += "\n\n[... truncado: lidas "+limit+" de "+total+" páginas ...]";
            }
            return Promise.resolve(joined);
          }
          showAlert(
            "iaAlert",
            "info",
            '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Extraindo texto… página '+i+' de '+limit+(total>limit?' (edital tem '+total+')':'')+'…'
          );
          return pdf.getPage(i).then(function(page){
            return page.getTextContent().then(function(tc){
              var line = (tc.items || []).map(function(it){ return it.str || ""; }).join(" ");
              pages.push(line);
              var soFar = pages.join("\n\n");
              i++;
              if(soFar.length >= maxChars){
                return soFar.slice(0, maxChars) + "\n\n[... texto truncado para análise ...]";
              }
              return next();
            });
          });
        }
        return next();
      });
    },

    /** Monta texto de análise a partir dos dados do alerta PNCP (sem PDF). */
    textoFromInteresse: function(ed){
      ed = ed || {};
      var lines = [];
      lines.push("RESUMO DO EDITAL (fonte: PNCP / alerta automático — sem PDF completo).");
      lines.push("Analise com base nestes dados públicos e indique o que ainda precisa ser confirmado no PDF oficial.");
      lines.push("");
      lines.push("Órgão / Nome: " + (ed.orgao || "—"));
      var munUf = [ed.municipio || "", ed.uf || ""].filter(Boolean).join("/");
      lines.push("Município/UF: " + (munUf || "—"));
      lines.push("Modalidade: " + (ed.modalidade || "—"));
      lines.push("Número da compra / controle: " + (ed.numeroCompra || ed.numeroControlePNCP || "—"));
      lines.push("Objeto / Edital: " + (ed.objeto || "—"));
      if(ed.valorEstimado != null && isFinite(Number(ed.valorEstimado))){
        lines.push("Valor estimado: R$ " + Number(ed.valorEstimado).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      }
      lines.push("Data de abertura: " + (ed.dataAbertura || "—"));
      lines.push("Data de encerramento (prazo): " + (ed.dataEncerramento || "—"));
      lines.push("Link PNCP: " + (ed.link || "—"));
      if(ed.watchLabel) lines.push("Monitoramento: " + ed.watchLabel);
      lines.push("");
      lines.push("INSTRUÇÕES PARA O RELATÓRIO:");
      lines.push("- Preencha os 11 tópicos com o que for possível a partir deste resumo.");
      lines.push("- Deixe explícito o que é INFERÊNCIA e o que FALTA confirmar no PDF (habilitação, cronograma detalhado, documentos).");
      lines.push("- No checklist de documentos, liste os mais prováveis para este tipo de objeto e marque a incerteza na obs.");
      return lines.join("\n");
    },

    /** Extrai cnpj/ano/seq do link PNCP ou do número de controle. */
    parsePncpRef: function(ed){
      ed = ed || {};
      var link = String(ed.link || "");
      var m = link.match(/\/editais\/([^/]+)\/(\d{4})\/(\d+)/i);
      if(m){
        return {
          cnpj: String(m[1] || "").replace(/\D/g, ""),
          ano: String(m[2] || ""),
          sequencial: String(Number(m[3]) || m[3])
        };
      }
      var nc = String(ed.numeroControlePNCP || "");
      m = nc.match(/^(\d{14})-\d+-(\d+)\/(\d{4})$/);
      if(m){
        return {
          cnpj: m[1],
          ano: m[3],
          sequencial: String(Number(m[2]) || m[2])
        };
      }
      return null;
    },

    pncpPdfApiUrl: function(ed, download){
      var ref = LICSYSTEM.analiseIa.parsePncpRef(ed);
      if(ref && ref.cnpj && ref.ano && ref.sequencial){
        return (
          "/api/pncp-edital-pdf?cnpj=" +
          encodeURIComponent(ref.cnpj) +
          "&ano=" +
          encodeURIComponent(ref.ano) +
          "&sequencial=" +
          encodeURIComponent(ref.sequencial) +
          (download ? "&download=1" : "")
        );
      }
      if(ed && ed.link){
        return (
          "/api/pncp-edital-pdf?link=" +
          encodeURIComponent(ed.link) +
          (download ? "&download=1" : "")
        );
      }
      return null;
    },

    /** Baixa o PDF oficial do PNCP como File (mesmo conteúdo da análise completa). */
    fetchPdfFileDeInteresse: function(ed){
      var url = LICSYSTEM.analiseIa.pncpPdfApiUrl(ed, true);
      if(!url){
        return Promise.reject(new Error("Este edital não tem link PNCP para baixar o PDF."));
      }
      return fetch(url, { method: "GET", headers: { Accept: "application/pdf,application/json" } })
        .then(function(res){
          var ctype = String(res.headers.get("content-type") || "");
          if(ctype.indexOf("application/json") !== -1 || !res.ok){
            return res.text().then(function(raw){
              var body = null;
              try{ body = raw ? JSON.parse(raw) : null; }catch(e){}
              var msg =
                (body && (body.error || body.detail || body.message)) ||
                ("Não foi possível baixar o PDF (HTTP " + res.status + ").");
              throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
            });
          }
          return res.blob().then(function(blob){
            var titulo = "";
            try{
              titulo = decodeURIComponent(res.headers.get("X-Pncp-Titulo") || "");
            }catch(e){ titulo = ""; }
            if(!titulo){
              titulo =
                (ed.orgao || "edital") +
                (ed.numeroCompra ? "-" + ed.numeroCompra : "") +
                ".pdf";
            }
            if(!/\.pdf$/i.test(titulo)) titulo += ".pdf";
            if(!blob || !blob.size){
              throw new Error("PDF vazio retornado pelo PNCP.");
            }
            return new File([blob], titulo.slice(0, 180), {
              type: blob.type || "application/pdf"
            });
          });
        });
    },

    baixarPdfDeInteresse: function(ed){
      if(!ed){
        showAlert("iaAlert","warn","Edital não encontrado.");
        return;
      }
      showAlert(
        "iaAlert",
        "info",
        '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Baixando PDF do PNCP…'
      );
      LICSYSTEM.analiseIa.fetchPdfFileDeInteresse(ed).then(function(file){
        var a = document.createElement("a");
        var objUrl = URL.createObjectURL(file);
        a.href = objUrl;
        a.download = file.name || "edital.pdf";
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){
          try{ URL.revokeObjectURL(objUrl); }catch(e){}
          try{ a.remove(); }catch(e){}
        }, 1500);
        showAlert("iaAlert","ok","PDF baixado: " + utils.escapeHtml(file.name) + " (" + (file.size/1024).toFixed(0) + " KB).");
        try{ LICSYSTEM.analiseIa.onFile(file); }catch(e){}
      }).catch(function(err){
        showAlert(
          "iaAlert",
          "error",
          utils.escapeHtml(LICSYSTEM.analiseIa.errMsg(err)) +
            (ed.link
              ? ' <a href="'+utils.escapeHtml(ed.link)+'" target="_blank" rel="noopener">Abrir no PNCP</a>'
              : "")
        );
      });
    },

    analisarDeInteresseRapido: function(ed){
      var text = LICSYSTEM.analiseIa.textoFromInteresse(ed);
      var nome =
        (ed.orgao || "Edital") +
        (ed.numeroCompra || ed.numeroControlePNCP ? " — " + (ed.numeroCompra || ed.numeroControlePNCP) : "");
      LICSYSTEM.analiseIa.file = null;
      var metaEl = el("iaFileMeta");
      if(metaEl){
        metaEl.className = "ia-file-meta show";
        metaEl.textContent = "Análise rápida (sem PDF): " + nome;
      }
      showAlert(
        "iaAlert",
        "info",
        '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> PDF indisponível — analisando só os dados do PNCP…'
      );
      LICSYSTEM.analiseIa.analisarTexto(text, {
        filename: nome.slice(0, 180) + ".txt",
        editalNome: nome.slice(0, 220),
        fromInteresse: true
      });
    },

    /**
     * Preferência: baixar PDF do PNCP e analisar igual ao upload.
     * Fallback: análise rápida só com metadados se o PDF não existir.
     */
    analisarDeInteresse: function(ed){
      if(LICSYSTEM.analiseIa.busy) return;
      if(!ed){
        showAlert("iaAlert","warn","Edital não encontrado.");
        return;
      }
      if(!LICSYSTEM.analiseIa.pncpPdfApiUrl(ed, true)){
        LICSYSTEM.analiseIa.analisarDeInteresseRapido(ed);
        return;
      }

      LICSYSTEM.analiseIa.setBusy(true);
      LICSYSTEM.analiseIa.limparRelatorio();
      showAlert(
        "iaAlert",
        "info",
        '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Baixando PDF oficial do PNCP…'
      );

      LICSYSTEM.analiseIa.fetchPdfFileDeInteresse(ed).then(function(file){
        LICSYSTEM.analiseIa.file = file;
        LICSYSTEM.analiseIa.anexarAoEditalAtivo(file);
        var meta = el("iaFileMeta");
        if(meta){
          meta.className = "ia-file-meta show";
          meta.textContent =
            "Arquivo (PNCP): " + file.name + " (" + (file.size / 1024).toFixed(1) + " KB)";
        }
        showAlert(
          "iaAlert",
          "info",
          '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> PDF baixado. Extraindo texto…'
        );
        return LICSYSTEM.analiseIa.extrairTextoPdf(file).then(function(text){
          text = String(text || "").replace(/\s+/g, " ").trim();
          if(!text || text.length < 40){
            throw new Error("Não foi possível extrair texto suficiente deste PDF (pode ser imagem escaneada).");
          }
          showAlert(
            "iaAlert",
            "info",
            '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Texto extraído ('+text.length+' caracteres). Gerando relatório com a IA…'
          );
          return LICSYSTEM.analiseIa.analisarTexto(text, {
            filename: file.name || "edital.pdf",
            editalNome: (file.name || "edital").replace(/\.pdf$/i, ""),
            alreadyBusy: true,
            keepReport: true,
            silentProgress: true
          });
        });
      }).catch(function(err){
        LICSYSTEM.analiseIa.setBusy(false);
        var msg = LICSYSTEM.analiseIa.errMsg(err);
        showAlert(
          "iaAlert",
          "warn",
          "Não deu para usar o PDF (" + utils.escapeHtml(msg) + "). Tentando análise rápida…"
        );
        setTimeout(function(){
          LICSYSTEM.analiseIa.analisarDeInteresseRapido(ed);
        }, 400);
      });
    },

    /** Envia texto já pronto para /api/analyze-pdf e renderiza o relatório. */
    analisarTexto: function(text, meta){
      meta = meta || {};
      if(LICSYSTEM.analiseIa.busy && !meta.alreadyBusy) return Promise.resolve();
      text = String(text || "").replace(/\s+/g, " ").trim();
      if(!text || text.length < 40){
        showAlert("iaAlert","warn","Texto insuficiente para análise.");
        return Promise.resolve();
      }

      if(!meta.alreadyBusy) LICSYSTEM.analiseIa.setBusy(true);
      if(!meta.keepReport) LICSYSTEM.analiseIa.limparRelatorio();
      LICSYSTEM.analiseIa.text = text;
      if(!meta.fromInteresse && !meta.silentProgress){
        showAlert(
          "iaAlert",
          "info",
          '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Gerando relatório com a IA…'
        );
      }

      return fetch("/api/analyze-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          text: text,
          filename: meta.filename || "edital.pdf"
        })
      }).then(function(res){
        return res.text().then(function(raw){
          var body = null;
          try{ body = raw ? JSON.parse(raw) : null; }catch(e){
            throw new Error("Resposta inválida da API (HTTP "+res.status+").");
          }
          if(!res.ok){
            var msg = (body && (body.detail || body.error)) || ("Erro HTTP " + res.status);
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
          }
          return body;
        });
      }).then(function(body){
        var md = (body && body.relatorio) || "";
        if(!md) throw new Error("A API não retornou o campo relatorio.");
        if(meta.fromInteresse){
          md =
            "> **Atenção:** análise gerada a partir dos dados públicos do PNCP (sem PDF completo). Confirme habilitação, cronograma e documentos no arquivo oficial.\n\n" +
            md;
        }
        var docs = LICSYSTEM.analiseIa.normDocsList(body && body.documentosExigidos);
        if(!docs.length){
          docs = LICSYSTEM.analiseIa.parseDocsFromMarkdown(md);
        }
        LICSYSTEM.analiseIa.documentosExigidos = docs;
        LICSYSTEM.analiseIa.renderRelatorio(md);
        var n = docs.length;
        showAlert(
          "iaAlert",
          "ok",
          (meta.fromInteresse
            ? "✅ Análise rápida concluída (sem PDF)."
            : "✅ Relatório gerado com sucesso.") +
            (n ? (" " + n + " documento" + (n === 1 ? "" : "s") + " identificado" + (n === 1 ? "" : "s") + ".") : "") +
            (meta.fromInteresse ? " Para mais precisão, envie o PDF do edital." : "")
        );
        var filename = meta.filename || (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
        var metaDocs = {
          filename: filename,
          editalNome: meta.editalNome || (filename ? filename.replace(/\.pdf$/i, "") : "Edital analisado")
        };
        if(docs.length){
          try{ LICSYSTEM.docsChecklist.setFromAnalysis(docs, metaDocs); }catch(e){}
        }
        if(LICSYSTEM.state.activeLeilaoId && LICSYSTEM.state._lwAnaliseContext){
          var act = LICSYSTEM.leiloesParticipo.getActiveItem();
          if(act){
            act.documentosExigidos = (docs || []).map(function(d, i){
              return {
                id: String(d.id || ("lpdoc_" + act.id + "_" + i)),
                nome: String(d.nome || "Documento").trim().slice(0, 220),
                tipo: String(d.tipo || "outro").slice(0, 40),
                obs: String(d.obs || "").trim().slice(0, 400),
                ok: !!d.ok
              };
            }).slice(0, 80);
            if(!act.workspace) act.workspace = LICSYSTEM.leiloesParticipo.emptyWorkspace();
            act.workspace.relatorioMd = String(md || "").slice(0, 100000);
            act.updatedAt = Date.now();
            try{ LICSYSTEM.leiloesParticipo.persist({ immediate: true }); }catch(e){}
          }
        }
        LICSYSTEM.analiseIa._pendingParticiparAsk = true;
        setTimeout(function(){
          LICSYSTEM.docsChecklist.showModal(docs, metaDocs);
        }, 120);
      }).catch(function(err){
        showAlert("iaAlert","error", utils.escapeHtml(LICSYSTEM.analiseIa.errMsg(err)));
      }).then(function(){
        LICSYSTEM.analiseIa.setBusy(false);
      });
    },

    analisar: function(){
      if(LICSYSTEM.analiseIa.busy) return;
      var file = LICSYSTEM.analiseIa.file;
      if(!file){
        showAlert("iaAlert","warn","Selecione o PDF do edital primeiro — ou use <b>Analisar com IA</b> em um balão de interesse.");
        return;
      }

      LICSYSTEM.analiseIa.setBusy(true);
      LICSYSTEM.analiseIa.limparRelatorio();
      showAlert("iaAlert","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Carregando PDF e extraindo texto…');

      LICSYSTEM.analiseIa.extrairTextoPdf(file).then(function(text){
        text = String(text || "").replace(/\s+/g, " ").trim();
        if(!text || text.length < 40){
          throw new Error("Não foi possível extrair texto suficiente deste PDF (pode ser imagem escaneada).");
        }
        showAlert(
          "iaAlert",
          "info",
          '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Texto extraído ('+text.length+' caracteres). Gerando relatório com a IA…'
        );
        return LICSYSTEM.analiseIa.analisarTexto(text, {
          filename: file.name || "edital.pdf",
          editalNome: (file.name || "edital").replace(/\.pdf$/i, ""),
          alreadyBusy: true,
          keepReport: true,
          silentProgress: true
        });
      }).catch(function(err){
        showAlert("iaAlert","error", utils.escapeHtml(LICSYSTEM.analiseIa.errMsg(err)));
        LICSYSTEM.analiseIa.setBusy(false);
      });
    },

    wire: function(){
      var drop = el("iaDrop");
      var inp = el("iaPdfFile");
      if(drop && inp){
        drop.addEventListener("click", function(){ inp.click(); });
        drop.addEventListener("keydown", function(e){
          if(e.key === "Enter" || e.key === " "){ e.preventDefault(); inp.click(); }
        });
        ["dragenter","dragover"].forEach(function(ev){
          drop.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            drop.classList.add("drag");
          });
        });
        ["dragleave","drop"].forEach(function(ev){
          drop.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            drop.classList.remove("drag");
          });
        });
        drop.addEventListener("drop", function(e){
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if(f) LICSYSTEM.analiseIa.onFile(f);
        });
        inp.addEventListener("change", function(){
          if(this.files && this.files[0]) LICSYSTEM.analiseIa.onFile(this.files[0]);
        });
      }
    }
  };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
