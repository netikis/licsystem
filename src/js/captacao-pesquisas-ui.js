/* LICSYSTEM — CAPTACAO / COLLAPSE CARDS PESQUISAS */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  LICSYSTEM.captacao = Object.assign(LICSYSTEM.captacao || {}, {
COLLAPSE_KEY: "licsystem_captacao_collapse_v1",

    PESQUISAS_CARD_IDS: [
      "cardChatEditais",
      "cardProxEditais",
      "cardRadarPncp"
    ],

    collapseSummaryIdForKey: function (key) {
      if (key === "prox-editais") return "proxCollapseSummary";
      if (key === "radar-pncp") return "radarCollapseSummary";
      if (key === "alertas-pncp") return "alertasCollapseSummary";
      return "chatCollapseSummary";
    },

    updateCollapseSummary: function (which, text) {
      var id =
        which === "prox"
          ? "proxCollapseSummary"
          : which === "radar"
            ? "radarCollapseSummary"
            : which === "alertas"
              ? "alertasCollapseSummary"
              : "chatCollapseSummary";
      var sum = el(id);
      if (!sum) return;
      sum.textContent = text || "";
      var card =
        which === "prox"
          ? el("cardProxEditais")
          : which === "radar"
            ? el("cardRadarPncp")
            : which === "alertas"
              ? el("cardAlertasPncp")
              : el("cardChatEditais");
      var collapsed = card && card.classList.contains("is-collapsed");
      sum.hidden = !collapsed || !text;
    },

    applyCardCollapse: function (card, collapsed, opts) {
      if (!card) return;
      opts = opts || {};
      var btn = card.querySelector(".card-collapse-btn");
      var key = card.getAttribute("data-collapse-key");
      card.classList.toggle("is-collapsed", !!collapsed);
      if (btn) {
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        btn.textContent = collapsed ? "▸ Expandir" : "▾ Minimizar";
        btn.title = collapsed ? "Expandir painel" : "Minimizar painel";
      }
      var sumId = LICSYSTEM.captacao.collapseSummaryIdForKey(key);
      var sum = el(sumId);
      if (sum) {
        sum.hidden = !collapsed || !String(sum.textContent || "").trim();
      }
      if (opts.skipPersist) return;
      try {
        var store = JSON.parse(
          localStorage.getItem(LICSYSTEM.captacao.COLLAPSE_KEY) || "{}"
        );
        if (key) store[key] = !!collapsed;
        localStorage.setItem(
          LICSYSTEM.captacao.COLLAPSE_KEY,
          JSON.stringify(store)
        );
      } catch (e) {}
    },

    /** Force all Pesquisas cards minimized (F5 / parent view). */
    minimizeAllPesquisasCards: function () {
      LICSYSTEM.captacao.PESQUISAS_CARD_IDS.forEach(function (id) {
        LICSYSTEM.captacao.applyCardCollapse(el(id), true, {
          skipPersist: true
        });
      });
    },

    /** Expand one card for submenu use; keep siblings minimized. */
    expandPesquisasCard: function (cardId) {
      LICSYSTEM.captacao.PESQUISAS_CARD_IDS.forEach(function (id) {
        LICSYSTEM.captacao.applyCardCollapse(el(id), id !== cardId, {
          skipPersist: true
        });
      });
    },

    initCardCollapse: function () {
      // Always start minimized on load — ignore prior expanded localStorage.
      LICSYSTEM.captacao.PESQUISAS_CARD_IDS.forEach(function (id) {
        var card = el(id);
        if (!card) return;
        LICSYSTEM.captacao.applyCardCollapse(card, true);
        var btn = card.querySelector(".card-collapse-btn");
        if (btn && !btn._collapseWired) {
          btn._collapseWired = true;
          btn.addEventListener("click", function () {
            LICSYSTEM.captacao.applyCardCollapse(
              card,
              !card.classList.contains("is-collapsed")
            );
          });
        }
      });
    },

    /* ---------- Radar PNCP ---------- */
    /**
     * dataFinal do endpoint /contratacoes/proposta = limite do encerramento.
     * Usar "hoje" zera o horizonte. Rolling hoje+365 no ano seguinte costuma 500.
     * Padrão: fim do ano civil (igual editais-proximos / editais-query).
     */
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
