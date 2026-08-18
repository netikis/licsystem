/* LICSYSTEM — CAPTACAO / RADAR PNCP */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  LICSYSTEM.captacao = Object.assign(LICSYSTEM.captacao || {}, {
_pncpDataFinalProposta:function(){
      var today = new Date();
      var yearEnd = new Date(today.getFullYear(), 11, 31);
      if(today.getMonth() >= 10){
        var cap = new Date(yearEnd.getTime());
        cap.setDate(cap.getDate() + 120);
        return utils.ymd(cap);
      }
      return utils.ymd(yearEnd);
    },
    /** Sinônimos para leilão / veículo / sucata (OR). */
    _pncpLeilaoSynonyms:function(){
      return [
        "leilao","leiloes","sucata","sucatas","veiculo","veiculos",
        "automovel","automoveis","documentado","documentados","frota",
        "alienacao","alienacoes","inservivel","inserviveis"
      ];
    },
    _pncpLooksLikeLeilao:function(raw){
      return /leil|sucat|veicul|automov|frota|alienac|documentad|inserviv/.test(
        utils.fold(raw || "")
      );
    },
    /** Intenção de veículo/sucata (não só leilão de imóvel/terreno). */
    _pncpLooksLikeVeiculoSucata:function(raw){
      return /sucat|veicul|automov|frota|documentad/.test(utils.fold(raw || ""));
    },
    _pncpHaystackVeiculoSucata:function(haystack){
      return /sucat|veicul|automov|frota|documentad|maquin|moveis|bem movel|bens moveis|inserviv/.test(
        haystack || ""
      );
    },
    /** "CESTA BASICA, CAFÉ" → [["cesta","basica"],["cafe"]] (vírgula=OU, espaços=E). */
    _pncpParseKeywords:function(raw){
      return String(raw || "")
        .split(/[,;]/)
        .map(function(group){
          return utils.fold(group).toLowerCase().trim().split(/\s+/).filter(Boolean);
        })
        .filter(function(g){ return g.length; });
    },
    /**
     * Frases de leilão/veículo/sucata viram grupos OU de sinônimos
     * (não exige AND estilo "cesta basica").
     */
    _pncpExpandKeywordGroups:function(kwGroups, raw){
      var groups = Array.isArray(kwGroups) ? kwGroups.slice() : [];
      if(!LICSYSTEM.captacao._pncpLooksLikeLeilao(raw || "")) return groups;
      var syns = LICSYSTEM.captacao._pncpLeilaoSynonyms();
      for(var i = 0; i < syns.length; i++){
        groups.push([syns[i]]);
      }
      return groups;
    },
    _pncpTextHaystack:function(o){
      var parts = [
        o.objetoCompra,
        o.objeto,
        o.objetoContratacao,
        o.informacaoComplementar,
        o.descricao,
        o.titulo,
        o.modalidadeNome
      ];
      return utils.fold(parts.filter(Boolean).join(" ")).toLowerCase();
    },
    /**
     * Grupo: AND dos tokens; em domínio leilão, também basta qualquer token ≥4.
     * Qualquer grupo basta (OU).
     */
    _pncpKeywordMatch:function(haystack, kwGroups){
      if(!kwGroups || !kwGroups.length) return true;
      return kwGroups.some(function(tokens){
        if(!tokens || !tokens.length) return false;
        if(tokens.every(function(t){ return haystack.indexOf(t) !== -1; })) return true;
        var joined = tokens.join(" ");
        if(LICSYSTEM.captacao._pncpLooksLikeLeilao(joined)){
          return tokens.some(function(t){
            return t.length >= 4 && haystack.indexOf(t) !== -1;
          });
        }
        return false;
      });
    },
    /** @deprecated PNCP direto no browser — CORS bloqueia em produção. Use /api/radar-pncp. */
    _pncpFetchPropostaPage:function(dataFinal, uf, page, pageSize, modalidade){
      var mod = modalidade != null ? modalidade : 6;
      var url =
        "/api/radar-pncp?uf=" +
        encodeURIComponent(uf || "") +
        "&paginas=1&incluirLeiloes=" +
        (mod === 1 || mod === 13 ? "1" : "0");
      return fetch(url).then(function(r){
        return utils.parseApiResponse(r);
      });
    },
    buscarPncp:function(){
      var rawKw = (el("pncpKeywords") && el("pncpKeywords").value) || "";
      var uf = (el("pncpUf") && el("pncpUf").value) || "";
      var incluirLeiloes =
        !el("pncpIncluirLeiloes") ||
        !!(el("pncpIncluirLeiloes") && el("pncpIncluirLeiloes").checked) ||
        LICSYSTEM.captacao._pncpLooksLikeLeilao(rawKw);
      var modalidades = incluirLeiloes ? [1, 13, 6] : [6];
      hideAlert("pncpAlert");
      el("pncpResults").innerHTML =
        '<div class="muted small"><span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Consultando PNCP via proxy (mods ' +
        utils.escapeHtml(modalidades.join(", ")) +
        ")…</div>";

      var url =
        "/api/radar-pncp?q=" +
        encodeURIComponent(rawKw) +
        "&uf=" +
        encodeURIComponent(uf) +
        "&incluirLeiloes=" +
        (incluirLeiloes ? "1" : "0");

      var radarCtrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var radarTimer = null;
      if (radarCtrl) {
        radarTimer = setTimeout(function () {
          try {
            radarCtrl.abort();
          } catch (e) {}
        }, 90000);
      }

      fetch(url, radarCtrl ? { signal: radarCtrl.signal } : undefined)
        .then(function (r) {
          return utils.parseApiResponse(r);
        })
        .then(function (j) {
          LICSYSTEM.captacao._renderRadarPncp(j, rawKw, uf);
        })
        .catch(function (err) {
          el("pncpResults").innerHTML = "";
          var aborted =
            err &&
            (err.name === "AbortError" ||
              /aborted|timeout/i.test(String(err.message || "")));
          showAlert(
            "pncpAlert",
            "error",
            aborted
              ? "A consulta ao PNCP excedeu o tempo limite. Tente novamente ou reduza o escopo (UF)."
              : "Não foi possível consultar o PNCP (" +
                utils.escapeHtml(utils.formatApiError(err)) +
                "). A busca usa o proxy <code>/api/radar-pncp</code> (mesmo domínio). " +
                utils.apiHintHtml()
          );
        })
        .then(function () {
          if (radarTimer) clearTimeout(radarTimer);
        });
    },

    _renderRadarPncp:function(j, rawKw, uf){
      var list = (j && (j.editais || j.data)) || [];
      var kwGroups = LICSYSTEM.captacao._pncpExpandKeywordGroups(
        LICSYSTEM.captacao._pncpParseKeywords(rawKw || (j && j.rawKeywords) || ""),
        rawKw || (j && j.rawKeywords) || ""
      );
      /* API já filtra; _handlePncp ainda renderiza (aceita itens mapeados). */
      LICSYSTEM.captacao._handlePncp(list, [], uf || (j && j.uf) || "", {
        dataFinal: (j && j.dataFinalPncp) || "",
        pagesFetched: (j && j.pagesFetched) || 0,
        totalRegistros: (j && j.totalRegistrosPncp) || (j && j.totalBrutoPncp) || list.length,
        modalidades: (j && j.modalidades) || [],
        leilaoDomain: !!(j && j.leilaoDomain),
        rawKeywords: rawKw || (j && j.rawKeywords) || "",
        fromProxy: true,
        totalBruto: (j && j.totalBrutoPncp) || 0,
        avisos: (j && j.avisos) || []
      });
      /* Se API já filtrou e passou lista vazia com bruto > 0, _handlePncp trata. */
      if (kwGroups && !list.length && j && j.totalBrutoPncp) {
        /* noop — _handlePncp já mostra mensagem */
      }
    },

    _handlePncp:function(arr, kwGroups, uf, meta){
      meta = meta || {};
      if(!Array.isArray(arr)) arr = [];
      var fromProxy = !!meta.fromProxy;
      var wantVeiculo = LICSYSTEM.captacao._pncpLooksLikeVeiculoSucata(meta.rawKeywords || "");
      /* Proxy /api/radar-pncp já filtra no servidor — não refiltrar. */
      var matches = fromProxy
        ? arr.slice()
        : arr.filter(function(o){
            var hay = LICSYSTEM.captacao._pncpTextHaystack(o);
            if(!LICSYSTEM.captacao._pncpKeywordMatch(hay, kwGroups)) return false;
            if(wantVeiculo && !LICSYSTEM.captacao._pncpHaystackVeiculoSucata(hay)) return false;
            return true;
          });
      var box = el("pncpResults");
      var kwLabel = (meta.rawKeywords || "")
        .trim() ||
        (kwGroups || [])
          .filter(function(g){ return g.length <= 3; })
          .slice(0, 8)
          .map(function(g){ return g.join(" "); })
          .join(", ");
      var horizonte =
        meta.dataFinal
          ? "propostas com encerramento até " + meta.dataFinal
          : "período consultado";
      var modLabel =
        meta.modalidades && meta.modalidades.length
          ? "mods " + meta.modalidades.join(", ")
          : "mod. 6";
      var bruto = meta.totalBruto != null ? Number(meta.totalBruto) : arr.length;
      var scanned =
        (fromProxy ? bruto : arr.length) +
        " registro(s) varridos" +
        (meta.pagesFetched ? " em " + meta.pagesFetched + " página(s)" : "") +
        " (" +
        modLabel +
        ")" +
        (meta.totalRegistros != null
          ? " (PNCP informa ~" + meta.totalRegistros + " no total nas modalidades)"
          : "");
      if(!matches.length){
        if(!bruto){
          box.innerHTML =
            '<div class="muted small">PNCP não retornou propostas abertas para os filtros (' +
            utils.escapeHtml(horizonte) +
            (uf ? ", UF " + utils.escapeHtml(uf) : "") +
            ", " +
            utils.escapeHtml(modLabel) +
            ").</div>";
          showAlert(
            "pncpAlert",
            "info",
            "Consulta concluída — nenhuma proposta aberta no horizonte PNCP."
          );
          return;
        }
        box.innerHTML =
          '<div class="muted small">Nenhum edital com as palavras-chave' +
          (kwLabel ? " (<b>" + utils.escapeHtml(kwLabel) + "</b>)" : "") +
          " entre " +
          utils.escapeHtml(scanned) +
          " (" +
          utils.escapeHtml(horizonte) +
          ").</div>";
        showAlert(
          "pncpAlert",
          "info",
          "Consulta concluída — " +
            bruto +
            " registro(s) no PNCP, nenhum com as palavras-chave informadas."
        );
        return;
      }
      matches.forEach(function(o){
        LICSYSTEM.state.pncpAlerts.push({
          orgao:(o.orgaoEntidade && o.orgaoEntidade.razaoSocial) || o.nomeOrgao || o.orgao || "Órgão público",
          uf:(o.unidadeOrgao && o.unidadeOrgao.ufSigla) || o.uf || uf || "",
          objeto:o.objetoCompra || o.objeto || o.objetoContratacao || ""
        });
      });
      LICSYSTEM.updateBell();
      LICSYSTEM.dashboard.renderPncp();
      showAlert(
        "pncpAlert",
        "ok",
        "🎯 " +
          matches.length +
          " oportunidade(s) PNCP encontradas! Alertas adicionados ao sino. (" +
          scanned +
          ")"
      );
      var html='<div style="display:flex;flex-direction:column;gap:10px">';
      matches.forEach(function(o){
        var orgao=(o.orgaoEntidade && o.orgaoEntidade.razaoSocial) || o.nomeOrgao || o.orgao || "Órgão público";
        var objeto=o.objetoCompra || o.objeto || o.objetoContratacao || "";
        var link=o.linkSistemaOrigem || o.link || "";
        var val=o.valorTotalEstimado || o.valorGlobal || null;
        var modNome = o.modalidadeNome || (o._lsModalidade != null ? ("Mod. " + o._lsModalidade) : "");
        html+='<div class="result-item r-green">'+
          '<div class="ri-title">'+utils.escapeHtml(orgao)+' <span class="badge-status b-yellow">'+utils.escapeHtml((o.unidadeOrgao&&o.unidadeOrgao.ufSigla)||o.uf||uf||"")+'</span>'+
          (modNome ? ' <span class="badge-status b-blue">'+utils.escapeHtml(modNome)+'</span>' : '')+
          '</div>'+
          '<div class="ri-sub">'+utils.escapeHtml(objeto)+'</div>'+
          (val?'<div class="small" style="margin-top:6px"><b>Estimado:</b> '+utils.formatBrl(val)+'</div>':'')+
          (link?'<div style="margin-top:8px"><a class="link" target="_blank" href="'+utils.escapeHtml(link)+'">Ver no sistema de origem ↗</a></div>':'')+
          '</div>';
      });
      html+='</div>';
      box.innerHTML=html;
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
