/* LICSYSTEM — CAPTACAO / CHAT EDITAIS */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  LICSYSTEM.captacao = Object.assign(LICSYSTEM.captacao || {}, {
initChatEditais: function () {
      if (LICSYSTEM.captacao._chatWired) return;
      LICSYSTEM.captacao._chatWired = true;
      var msg = el("chatEditalMsg");
      if (msg) {
        msg.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            LICSYSTEM.captacao.buscarChatEditais();
          }
        });
      }
      document.querySelectorAll("[data-chat-prompt]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          LICSYSTEM.captacao.runChatPrompt(btn.getAttribute("data-chat-prompt"));
        });
      });
    },

    _setChatPromptActive: function (id) {
      document.querySelectorAll(".chat-prompt-chip,[data-chat-prompt]").forEach(function (b) {
        var on = b.getAttribute("data-chat-prompt") === id;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", on ? "true" : "false");
      });
    },

    runChatPrompt: function (id) {
      var cat = el("chatEditalCat");
      var msg = el("chatEditalMsg");
      var map = {
        "norte-pioneiro": { regiao: "norte-pioneiro", categoria: "", label: "Norte Pioneiro do Paraná (todos os editais abertos)" },
        "norte-comida": { regiao: "norte-pioneiro", categoria: "comida,cestas,cafe", label: "Norte Pioneiro · comida / cestas / café" },
        "norte-reforma": { regiao: "norte-pioneiro", categoria: "reforma", label: "Norte Pioneiro · reformas" },
        "norte-natal": { regiao: "norte-pioneiro", categoria: "natal", label: "Norte Pioneiro · Natal" },
        "norte-eletro": { regiao: "norte-pioneiro", categoria: "eletro", label: "Norte Pioneiro · eletrodomésticos" },
      };
      var p = map[id];
      if (!p) return;
      LICSYSTEM.captacao._setChatPromptActive(id);
      if (msg) msg.value = p.label;
      if (cat) {
        var first = String(p.categoria || "").split(",")[0] || "";
        cat.value = first;
      }
      LICSYSTEM.captacao._runChatEditais({
        regiao: p.regiao,
        categoria: p.categoria,
      });
    },

    buscarChatEditais: function () {
      var texto = String((el("chatEditalMsg") && el("chatEditalMsg").value) || "").trim();
      var cat = (el("chatEditalCat") && el("chatEditalCat").value) || "";
      if (!texto && !cat) {
        showAlert(
          "chatEditalAlert",
          "info",
          "Digite o nome da cidade (ex.: Santa Cruz do Rio Pardo), uma pergunta (ex.: Quais licitações terão em Ibaiti) ou use um atalho do Norte Pioneiro."
        );
        return;
      }
      var opts = { mensagem: texto };
      if (cat) opts.categoria = cat;
      // Atalho textual: se o usuário só escreveu "norte pioneiro"
      var folded = utils.fold(texto).toLowerCase();
      if (/norte\s*pioneiro/.test(folded) && texto.length < 40) {
        opts.regiao = "norte-pioneiro";
        opts.mensagem = "";
      }
      LICSYSTEM.captacao._runChatEditais(opts);
    },

    _runChatEditais: function (opts) {
      if (LICSYSTEM.captacao._chatBusy) return;
      opts = opts || {};
      hideAlert("chatEditalAlert");
      var ampliar = !!(el("chatEditalAmpliar") && el("chatEditalAmpliar").checked);
      var leiloes = !el("chatEditalLeiloes") || !!(el("chatEditalLeiloes") && el("chatEditalLeiloes").checked);
      var janela = (el("chatEditalJanela") && el("chatEditalJanela").value) || "ano";
      var body = {
        mensagem: opts.mensagem || undefined,
        regiao: opts.regiao || undefined,
        municipio: opts.municipio || undefined,
        categoria: opts.categoria || undefined,
        ampliar: ampliar ? "1" : undefined,
        leiloes: leiloes ? "1" : undefined,
        janela: janela,
        esferas: "M,E",
      };
      Object.keys(body).forEach(function (k) {
        if (body[k] == null || body[k] === "") delete body[k];
      });

      LICSYSTEM.captacao._chatBusy = true;
      var btn = el("btnChatEdital");
      if (btn) btn.disabled = true;
      if (el("chatEditalMeta")) el("chatEditalMeta").textContent = "";
      LICSYSTEM.captacao._chatList = [];
      LICSYSTEM.captacao._chatData = null;
      LICSYSTEM.state.chatPage = 1;
      LICSYSTEM.captacao.updateChatPager();
      LICSYSTEM.captacao.updateCollapseSummary("chat", "");
      if (el("chatEditalResults")) {
        el("chatEditalResults").innerHTML =
          '<div class="muted small"><span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Consultando PNCP (' +
          (janela === "45" ? "45 dias" : "horizonte anual") +
          ")… isso pode levar alguns segundos.</div>";
      }

      var chatCtrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var chatTimer = null;
      if (chatCtrl) {
        chatTimer = setTimeout(function () {
          try {
            chatCtrl.abort();
          } catch (e) {}
        }, 90000);
      }

      fetch("/api/editais-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: chatCtrl ? chatCtrl.signal : undefined,
      })
        .then(function (r) {
          return utils.parseApiResponse(r);
        })
        .then(function (j) {
          LICSYSTEM.captacao._renderChatEditais(j);
        })
        .catch(function (err) {
          if (el("chatEditalResults")) el("chatEditalResults").innerHTML = "";
          LICSYSTEM.captacao._chatList = [];
          LICSYSTEM.captacao.updateChatPager();
          LICSYSTEM.captacao.updateCollapseSummary("chat", "");
          var aborted =
            err &&
            (err.name === "AbortError" || /aborted|timeout/i.test(String(err.message || "")));
          showAlert(
            "chatEditalAlert",
            "error",
            aborted
              ? "A consulta ao PNCP excedeu o tempo limite (90s). O portal pode estar lento — tente de novo (Norte Pioneiro consulta vários municípios). " +
                utils.apiHintHtml()
              : "Não foi possível consultar editais (" +
                utils.escapeHtml(utils.formatApiError(err)) +
                "). " +
                utils.apiHintHtml()
          );
        })
        .then(function () {
          if (chatTimer) clearTimeout(chatTimer);
          LICSYSTEM.captacao._chatBusy = false;
          if (btn) btn.disabled = false;
        });
    },

    _renderChatEditais: function (j) {
      var box = el("chatEditalResults");
      var meta = el("chatEditalMeta");
      if (!box) return;
      var escopo = (j && j.escopo) || {};
      var list = (j && j.editais) || [];

      var onde =
        escopo.tipo === "regiao"
          ? (escopo.nome || "Região") +
            " · " +
            (escopo.municipios || 0) +
            " municípios"
          : (escopo.nome || "—") + "/" + (escopo.uf || "—");

      LICSYSTEM.captacao._chatData = j || {};
      LICSYSTEM.captacao._chatList = list;
      LICSYSTEM.captacao._chatOnde = onde;
      LICSYSTEM.state.chatPage = 1;

      if (meta) {
        meta.textContent =
          onde +
          " · " +
          (j.janelaLabel || "janela anual") +
          (j.dataFinalPncp ? " até " + j.dataFinalPncp : "") +
          " · " +
          (j.total || list.length || 0) +
          " edital(is)" +
          (j.categorias && j.categorias.length
            ? " · categorias: " + j.categorias.join(", ")
            : "") +
          " · UFs: " +
          ((j.ufsConsultadas || []).join(", ") || "—");
      }

      LICSYSTEM.captacao.updateCollapseSummary(
        "chat",
        (j.total || list.length || 0) + " edital(is)…"
      );

      if (!list.length) {
        var amostra = (j && j.amostraMunicipios) || [];
        var amostraTxt = amostra.length
          ? " Municípios nos registros brutos do PNCP: " +
            amostra
              .slice(0, 8)
              .map(function (a) {
                return (
                  (a.municipio || "?") +
                  (a.uf ? "/" + a.uf : "") +
                  " (" +
                  (a.qtd || 0) +
                  ")"
                );
              })
              .join(", ") +
            "."
          : "";
        var chatErros = (j && j.errosParciais) || [];
        var chatErroTxt = chatErros.length
          ? " Falhas parciais no PNCP: " +
            chatErros
              .slice(0, 3)
              .map(function (e) {
                return (
                  (e.ibge || e.uf || "?") +
                  " — " +
                  (e.error || "erro")
                );
              })
              .join("; ") +
            "."
          : "";
        box.innerHTML =
          '<div class="muted small">Nenhuma proposta com encerramento no horizonte ' +
          utils.escapeHtml(j.janelaLabel || "anual") +
          " no PNCP para este escopo" +
          (j.totalBrutoPncp
            ? " (PNCP retornou " +
              j.totalBrutoPncp +
              " registro(s) brutos; nenhum passou no filtro de município/categoria)."
            : ".") +
          amostraTxt +
          chatErroTxt +
          (j.dataFinalPncp
            ? " dataFinal PNCP até " + j.dataFinalPncp + "."
            : "") +
          " Se o edital existir só no portal da prefeitura, não aparece aqui. Leilões de veículos/sucata muitas vezes não estão no PNCP (sites especializados).</div>";
        LICSYSTEM.captacao.updateChatPager();
        showAlert(
          "chatEditalAlert",
          chatErros.length && !j.totalBrutoPncp ? "error" : "info",
          chatErros.length && !j.totalBrutoPncp
            ? "PNCP falhou em parte das consultas — sem editais utilizáveis."
            : "Consulta concluída — sem resultados com os filtros atuais (dados reais do PNCP)."
        );
        return;
      }

      list.forEach(function (o) {
        LICSYSTEM.state.pncpAlerts.push({
          orgao: o.orgao || "Órgão público",
          uf: o.uf || "",
          objeto: o.objeto || "",
        });
      });
      LICSYSTEM.updateBell();
      LICSYSTEM.dashboard.renderPncp();

      LICSYSTEM.captacao.paintChatPage();
      showAlert(
        "chatEditalAlert",
        "ok",
        list.length +
          " edital(is) com encerramento no horizonte " +
          utils.escapeHtml(j.janelaLabel || "anual") +
          " para " +
          utils.escapeHtml(onde) +
          " (PNCP)."
      );
    },

    paintChatPage: function () {
      var box = el("chatEditalResults");
      if (!box) return;
      var list = LICSYSTEM.captacao._chatList || [];
      var j = LICSYSTEM.captacao._chatData || {};
      var size = LICSYSTEM.state.chatPageSize || 50;
      var total = list.length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      if (!LICSYSTEM.state.chatPage || LICSYSTEM.state.chatPage < 1) LICSYSTEM.state.chatPage = 1;
      if (LICSYSTEM.state.chatPage > pages) LICSYSTEM.state.chatPage = pages;
      var page = LICSYSTEM.state.chatPage;
      var start = (page - 1) * size;
      var end = Math.min(start + size, total);

      if (!total) {
        LICSYSTEM.captacao.updateChatPager();
        return;
      }

      var html =
        '<div class="tbl-wrap"><table class="chat-edital-table"><thead><tr>' +
        "<th>Município</th><th>Órgão</th><th>Objeto</th><th>Valor estimado</th><th>Abertura</th><th>Modalidade</th><th>Edital</th>" +
        "</tr></thead><tbody>";
      for (var i = start; i < end; i++) {
        var o = list[i];
        if (!o) continue;
        html +=
          "<tr>" +
          "<td>" +
          utils.escapeHtml(o.municipio || "—") +
          "</td>" +
          "<td>" +
          utils.escapeHtml(o.orgao || "—") +
          "</td>" +
          '<td class="chat-edital-obj">' +
          utils.escapeHtml(o.objeto || "—") +
          "</td>" +
          "<td>" +
          (o.valorEstimado != null
            ? utils.formatBrl(o.valorEstimado)
            : "—") +
          "</td>" +
          "<td>" +
          utils.escapeHtml(LICSYSTEM.captacao.formatProxDate(o.dataAbertura)) +
          "</td>" +
          "<td>" +
          utils.escapeHtml(o.modalidade || "—") +
          "</td>" +
          "<td>" +
          (o.link
            ? '<a class="link" target="_blank" rel="noopener" href="' +
              utils.escapeHtml(o.link) +
              '">PNCP ↗</a>'
            : "—") +
          "</td>" +
          "</tr>";
      }
      html += "</tbody></table></div>";
      if (j.avisos && j.avisos.length && page === 1) {
        html +=
          '<div class="small muted" style="margin-top:10px">' +
          j.avisos
            .map(function (a) {
              return "• " + utils.escapeHtml(a);
            })
            .join("<br/>") +
          "</div>";
      }
      box.innerHTML = html;
      LICSYSTEM.captacao.updateChatPager();
    },

    updateChatPager: function () {
      var pager = el("chatPager");
      var info = el("chatPagerInfo");
      var prev = el("chatPrev");
      var next = el("chatNext");
      var total = (LICSYSTEM.captacao._chatList || []).length;
      var size = LICSYSTEM.state.chatPageSize || 50;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var page = LICSYSTEM.state.chatPage || 1;
      if (!pager) return;
      if (total <= size) {
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? (page - 1) * size + 1 : 0;
      var end = Math.min(page * size, total);
      if (info)
        info.innerHTML =
          "Itens <b>" +
          start +
          "–" +
          end +
          "</b> de <b>" +
          total +
          "</b> · Página <b>" +
          page +
          "</b>/" +
          pages +
          " (50 por página)";
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= pages;
    },

    goChatPage: function (delta) {
      var size = LICSYSTEM.state.chatPageSize || 50;
      var total = (LICSYSTEM.captacao._chatList || []).length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var next = (LICSYSTEM.state.chatPage || 1) + delta;
      if (next < 1) next = 1;
      if (next > pages) next = pages;
      if (next === LICSYSTEM.state.chatPage) return;
      LICSYSTEM.state.chatPage = next;
      LICSYSTEM.captacao.paintChatPage();
    }
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
