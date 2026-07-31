/**
 * Assistentes LICSYSTEM — entrada pelo menu Ferramentas (sem FAB no canto).
 * Suporte: editais PNCP via POST /api/editais-chat.
 * Chat IA: widget Voiceflow (launcher oculto; abre via menu).
 * Custom Action VF opcional: docs/voiceflow-editais-chat.md
 */
(function () {
  var VF_PROJECT_ID = "6a5cf8b3de847e8e5630f8f1";
  var VF_RUNTIME = "https://general-runtime.voiceflow.com";
  var VF_VOICE = "https://runtime-api.voiceflow.com";
  var VF_BUNDLE = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
  /* Shadow DOM do VF: CSS da página não entra — stylesheet no load oculta o "Talk to AI" */
  var VF_HIDE_LAUNCHER_CSS =
    ".vfrc-launcher,.vfrc-launcher *,[class*='launcher']{" +
    "display:none!important;opacity:0!important;visibility:hidden!important;" +
    "pointer-events:none!important;width:0!important;height:0!important;" +
    "overflow:hidden!important;position:absolute!important;left:-9999px!important;}";
  var scriptLoaded = false;
  var bootRequested = false;
  var panelBuilt = false;

  function fold(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function linkify(text) {
    return escapeHtml(text).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>'
    );
  }

  /**
   * Detecta intenção de listar editais/licitações abertas (PNCP).
   */
  function isEditaisIntent(text) {
    var f = fold(text).trim();
    if (!f || f.length < 3) return false;
    if (/norte\s*pioneiro|norte-pioneiro|amunorpi/.test(f)) return true;
    if (
      /licita|edital|editais|pncp|pregao|concorrencia|proposta\s+aberta|propostas\s+abertas/.test(
        f
      )
    ) {
      return true;
    }
    if (
      /(quais|quero|tem|terei|tera|terao|busca|buscar|mostra|mostrar|lista|listar)\b/.test(
        f
      ) &&
      /\b(em|no|na|de)\s+[a-z]/.test(f) &&
      /(cidade|municipio|ibaiti|jacarezinho|santo antonio|wenceslau|bandeirantes|andira|assis|japura|guaraci|congonhinhas|ribeirao|cambara|carlopolis)/.test(
        f
      )
    ) {
      return true;
    }
    /* "quais terão em Ibaiti" / "em Ibaiti" com verbo de existência */
    if (
      /quais\b/.test(f) &&
      /\bem\s+[a-zà-ÿ]{3,}/.test(f) &&
      /(ter|tem|havera|haver|sera|serao|vai\s+ter|vao\s+ter)/.test(f)
    ) {
      return true;
    }
    return false;
  }

  function pagePayload(view) {
    view =
      view ||
      (window.LICSYSTEM && LICSYSTEM.state && LICSYSTEM.state.currentView) ||
      "dashboard";
    var titulo =
      (window.LICSYSTEM &&
        LICSYSTEM.VIEW_TITLES &&
        LICSYSTEM.VIEW_TITLES[view]) ||
      view;
    return {
      pagina: view,
      pagina_atual: view,
      titulo: titulo,
      sistema: "LICSYSTEM",
    };
  }

  function buildConfig(view) {
    return {
      verify: { projectID: VF_PROJECT_ID },
      url: VF_RUNTIME,
      voice: { url: VF_VOICE },
      assistant: {
        stylesheet: "data:text/css;charset=utf-8," + encodeURIComponent(VF_HIDE_LAUNCHER_CSS),
      },
      launch: {
        event: {
          type: "launch",
          payload: pagePayload(view),
        },
      },
    };
  }

  function ensureLICSYSTEMVoiceflow() {
    if (!window.LICSYSTEM) window.LICSYSTEM = {};
    var api = (LICSYSTEM.voiceflow = LICSYSTEM.voiceflow || {});
    api.ready = !!api.ready;
    api.currentView = api.currentView || "dashboard";

    api.loadChat = function (view) {
      api.currentView = view || api.currentView || "dashboard";
      if (
        !(
          window.voiceflow &&
          window.voiceflow.chat &&
          typeof window.voiceflow.chat.load === "function"
        )
      ) {
        return;
      }
      try {
        window.voiceflow.chat.load(buildConfig(api.currentView));
        api.ready = true;
        /* Esconde widget até o menu Chat IA; stylesheet mantém launcher oculto ao reabrir */
        try {
          if (typeof window.voiceflow.chat.close === "function") {
            window.voiceflow.chat.close();
          }
          if (typeof window.voiceflow.chat.hide === "function") {
            window.voiceflow.chat.hide();
          }
        } catch (eHide) {}
        scheduleHideVfLauncher();
      } catch (e) {}
    };

    api.syncContext = function (view) {
      api.currentView = view || api.currentView || "dashboard";
    };

    api.openPanel = function () {
      ensurePanel();
      openPanel();
    };

    api.closePanel = function () {
      closePanel();
    };

    api.openChatIA = function (text) {
      openVoiceflowGeneral(text || "");
    };

    return api;
  }

  function injectVfLauncherCss(root) {
    if (!root || root.getElementById("ls-vf-hide-launcher")) return;
    try {
      var style = document.createElement("style");
      style.id = "ls-vf-hide-launcher";
      style.textContent = VF_HIDE_LAUNCHER_CSS;
      root.appendChild(style);
    } catch (e) {}
  }

  function scheduleHideVfLauncher() {
    var tries = 0;
    function tick() {
      tries += 1;
      var host =
        document.getElementById("voiceflow-chat") ||
        document.querySelector("[class*='vfrc']");
      if (host && host.shadowRoot) {
        injectVfLauncherCss(host.shadowRoot);
        return;
      }
      var nodes = document.querySelectorAll("*");
      for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].shadowRoot && nodes[i].shadowRoot.querySelector(".vfrc-launcher, [class*='launcher']")) {
          injectVfLauncherCss(nodes[i].shadowRoot);
          return;
        }
      }
      if (tries < 40) setTimeout(tick, 250);
    }
    setTimeout(tick, 100);
  }

  function injectBundle(onReady) {
    if (scriptLoaded) {
      if (onReady) onReady();
      return;
    }
    if (window.voiceflow && window.voiceflow.chat) {
      scriptLoaded = true;
      if (onReady) onReady();
      return;
    }
    var v = document.createElement("script");
    var s = document.getElementsByTagName("script")[0];
    v.onload = function () {
      scriptLoaded = true;
      if (onReady) onReady();
    };
    v.onerror = function () {
      /* VF opcional — chat local de editais continua */
    };
    v.src = VF_BUNDLE;
    v.type = "text/javascript";
    s.parentNode.insertBefore(v, s);
  }

  function ensurePanel() {
    if (panelBuilt) return;
    panelBuilt = true;

    var root = document.createElement("div");
    root.id = "lsSupportRoot";
    root.innerHTML =
      '<div id="lsSupportPanel" role="dialog" aria-labelledby="lsSupportTitle" hidden>' +
      '<div class="ls-sup-head">' +
      '<div class="ls-sup-brand">' +
      '<div class="ls-sup-mark">LS</div>' +
      "<div>" +
      '<strong id="lsSupportTitle">Suporte LICSYSTEM</strong>' +
      '<span class="ls-sup-sub">Editais PNCP · ajuda do sistema</span>' +
      "</div>" +
      "</div>" +
      '<button type="button" class="ls-sup-close" id="lsSupportClose" aria-label="Fechar">×</button>' +
      "</div>" +
      '<div class="ls-sup-chips" id="lsSupportChips">' +
      '<button type="button" data-ls-prompt="Quais licitações terão em Ibaiti">Ibaiti</button>' +
      '<button type="button" data-ls-prompt="Licitações abertas no Norte Pioneiro">Norte Pioneiro</button>' +
      '<button type="button" data-ls-prompt="Editais Norte Pioneiro com cestas básicas">Norte · cestas</button>' +
      '<button type="button" data-ls-prompt="Licitações em Jacarezinho">Jacarezinho</button>' +
      "</div>" +
      '<div class="ls-sup-msgs" id="lsSupportMsgs"></div>' +
      '<form class="ls-sup-form" id="lsSupportForm">' +
      '<input type="text" id="lsSupportInput" placeholder="Ex.: Quais licitações terão em Ibaiti" autocomplete="off" maxlength="500" />' +
      '<button type="submit" id="lsSupportSend" class="ls-sup-send">Enviar</button>' +
      "</form>" +
      '<div class="ls-sup-foot">' +
      '<button type="button" class="ls-sup-link" id="lsSupportOpenVf">Abrir Chat IA (menu Ferramentas)</button>' +
      "</div>" +
      "</div>";

    document.body.appendChild(root);

    document.getElementById("lsSupportClose").addEventListener("click", closePanel);
    document.getElementById("lsSupportForm").addEventListener("submit", function (e) {
      e.preventDefault();
      sendUserMessage();
    });
    document.getElementById("lsSupportOpenVf").addEventListener("click", function () {
      closePanel();
      openVoiceflowGeneral("");
    });
    document.getElementById("lsSupportChips").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-ls-prompt]");
      if (!btn) return;
      var input = document.getElementById("lsSupportInput");
      if (input) input.value = btn.getAttribute("data-ls-prompt") || "";
      sendUserMessage();
    });

    appendBot(
      "Olá! Posso listar <b>propostas com encerramento no horizonte anual</b> no PNCP.\n\n" +
        "Exemplos:\n" +
        "• Quais licitações terão em Ibaiti\n" +
        "• Licitações no Norte Pioneiro\n" +
        "• Editais em Jacarezinho com cestas\n\n" +
        "Pergunte pelo município ou use os atalhos acima."
    );
  }

  function openPanel() {
    ensurePanel();
    try {
      if (window.voiceflow && window.voiceflow.chat && typeof window.voiceflow.chat.close === "function") {
        window.voiceflow.chat.close();
      }
    } catch (e) {}
    var panel = document.getElementById("lsSupportPanel");
    if (panel) panel.hidden = false;
    var input = document.getElementById("lsSupportInput");
    if (input) setTimeout(function () { input.focus(); }, 50);
  }

  function closePanel() {
    var panel = document.getElementById("lsSupportPanel");
    if (panel) panel.hidden = true;
  }

  function appendMsg(role, htmlOrText, asHtml) {
    ensurePanel();
    var box = document.getElementById("lsSupportMsgs");
    if (!box) return;
    var div = document.createElement("div");
    div.className = "ls-sup-msg ls-sup-" + role;
    if (asHtml) div.innerHTML = htmlOrText;
    else div.innerHTML = linkify(htmlOrText).replace(/\n/g, "<br/>");
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
    return div;
  }

  function appendBot(text) {
    return appendMsg("bot", text, /<[a-z][\s\S]*>/i.test(text));
  }

  function appendUser(text) {
    return appendMsg("user", text, false);
  }

  function setBusy(busy) {
    var send = document.getElementById("lsSupportSend");
    var input = document.getElementById("lsSupportInput");
    if (send) send.disabled = !!busy;
    if (input) input.disabled = !!busy;
  }

  function formatClientReply(j) {
    if (j && j.respostaTexto) return String(j.respostaTexto);
    var escopo = (j && j.escopo) || {};
    var onde =
      escopo.tipo === "regiao"
        ? escopo.nome || "região"
        : (escopo.nome || "município") +
          (escopo.uf ? "/" + escopo.uf : "");
    var list = (j && j.editais) || [];
    if (!list.length) {
      return (
        "Nenhuma proposta aberta no PNCP neste momento para " +
        onde +
        "."
      );
    }
    var lines = ["Licitações abertas em " + onde + " (PNCP):"];
    var n = Math.min(list.length, 25);
    for (var i = 0; i < n; i++) {
      var e = list[i];
      var valor =
        e.valorEstimado != null && Number.isFinite(Number(e.valorEstimado))
          ? Number(e.valorEstimado).toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })
          : "valor não informado";
      var data = "data não informada";
      if (e.dataAbertura) {
        try {
          var d = new Date(e.dataAbertura);
          if (!isNaN(d.getTime())) {
            data = d.toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
          }
        } catch (err) {}
      }
      lines.push(
        i +
          1 +
          ". " +
          String(e.objeto || "Objeto não informado").slice(0, 140) +
          " — " +
          valor +
          " — abertura " +
          data +
          (e.link ? " — " + e.link : "")
      );
    }
    if (list.length > n) {
      lines.push("… e mais " + (list.length - n) + " no total (" + list.length + ").");
    }
    return lines.join("\n");
  }

  function queryEditais(mensagem) {
    return fetch("/api/editais-chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        mensagem: mensagem,
        esferas: "M,E",
        janela: "ano",
      }),
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok) {
          var err = new Error(
            (j && j.error) || "HTTP " + r.status
          );
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j;
      });
    });
  }

  function openVoiceflowGeneral(text) {
    var api = ensureLICSYSTEMVoiceflow();
    closePanel();
    function go() {
      try {
        if (window.voiceflow && window.voiceflow.chat) {
          scheduleHideVfLauncher();
          if (typeof window.voiceflow.chat.show === "function") {
            window.voiceflow.chat.show();
          }
          if (typeof window.voiceflow.chat.open === "function") {
            window.voiceflow.chat.open();
          }
          scheduleHideVfLauncher();
          if (
            text &&
            typeof window.voiceflow.chat.interact === "function"
          ) {
            window.voiceflow.chat.interact({
              type: "text",
              payload: text,
            });
          }
        } else {
          ensurePanel();
          openPanel();
          appendBot(
            "O Chat IA (Voiceflow) não carregou. " +
              "Para editais, use Ferramentas → Suporte LICSYSTEM ou Captação → Perguntar editais."
          );
        }
      } catch (e) {
        ensurePanel();
        openPanel();
        appendBot(
          "Não foi possível abrir o Chat IA agora. Use Captação → Perguntar editais para consultas PNCP."
        );
      }
    }
    if (api.ready || (window.voiceflow && window.voiceflow.chat)) {
      go();
    } else {
      injectBundle(function () {
        api.loadChat(
          (LICSYSTEM.state && LICSYSTEM.state.currentView) || "dashboard"
        );
        setTimeout(go, 400);
      });
    }
  }

  function sendUserMessage() {
    var input = document.getElementById("lsSupportInput");
    var text = String((input && input.value) || "").trim();
    if (!text) return;
    if (input) input.value = "";
    appendUser(text);

    if (!isEditaisIntent(text)) {
      appendBot(
        "Essa pergunta não parece ser sobre editais/licitações abertas. " +
          "Abrindo o assistente geral…\n\n" +
          "Para consultar o PNCP, diga por exemplo:\n" +
          "• Quais licitações terão em Ibaiti\n" +
          "• Licitações no Norte Pioneiro"
      );
      openVoiceflowGeneral(text);
      return;
    }

    setBusy(true);
    var loading = appendBot("Consultando editais abertos no PNCP…");
    queryEditais(text)
      .then(function (j) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        appendBot(formatClientReply(j));
      })
      .catch(function (err) {
        if (loading && loading.parentNode) loading.parentNode.removeChild(loading);
        var msg = (err && err.message) || String(err);
        appendBot(
          "Não consegui consultar o PNCP agora (" +
            msg +
            "). Tente de novo em instantes ou use Captação → Perguntar editais."
        );
      })
      .then(function () {
        setBusy(false);
        if (input) input.focus();
      });
  }

  window.__licsystemInitVoiceflow = function () {
    bootRequested = true;
    var api = ensureLICSYSTEMVoiceflow();
    ensurePanel();
    injectBundle(function () {
      api.loadChat(
        (LICSYSTEM.state && LICSYSTEM.state.currentView) || "dashboard"
      );
    });
  };

  if (window.LICSYSTEM && LICSYSTEM.state && bootRequested === false) {
    /* aguarda chamada explícita do boot */
  }
})();
