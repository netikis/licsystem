/**
 * LICSYSTEM — internacionalização (motor)
 * Dicionários em src/i18n/dict-*.js e src/i18n/phrases-*.js
 * Idiomas: pt-BR (padrão), en, es
 * - data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-aria
 * - Tradução automática de frases estáticas (PHRASES) sem data-i18n
 */
(function () {
  var LANG_KEY = "licsystem_lang_v1";
  var SUPPORTED = ["pt-BR", "en", "es"];
  window.LICSYSTEM = window.LICSYSTEM || {};
  var bag = LICSYSTEM._i18n || (LICSYSTEM._i18n = { dict: {}, phrases: {} });
  var DICT = bag.dict;
  var PHRASES = bag.phrases;

  var AUTO_SEL = [
    "h2", "h3", "h4",
    "label.fld",
    ".desc",
    "button.btn", ".btn",
    "th",
    ".cat-form-title",
    ".disputa-sec-title",
    ".dc-label", ".dc-sub",
    ".lw-tab", ".lw-context-label",
    ".card-collapse-btn",
    ".auth-lead",
    "#authTitle", "#authSubmit",
    ".pill-group label span",
    ".chat-opt", ".prox-opt",
    ".robo-status-text b", ".robo-status-text span",
    ".tag",
    "option",
    ".hk-label", ".hk-sub",
    ".oc-label",
    ".lw-hub-card b", ".lw-hub-card > span:not(.lw-hub-ico)",
    ".ia-drop b", ".ia-drop > span",
    ".dropzone b", ".dropzone .small",
    "td.muted",
    ".muted.small",
    ".badge-edit-mode",
    ".chat-prompt-label", ".prox-raio-label",
    ".chat-prompt-chip",
    "label.cofre-check-all",
    ".toggle-row > label",
    "#progressLabel",
    "#iaReportSheet.ia-empty",
    ".rc-title", ".rc-sub",
    ".ub-txt b", ".ub-txt > span",
    ".status-nf",
    ".oc-head p",
    ".orc-save-card > p",
    ".docs-modal-card > p",
    ".foot-edital-label", ".foot-meus-label",
    ".brand .txt > span",
    ".auth-brand span",
    "label.small",
    ".lh-empty",
    "#entregaCepHint",
    "#proxOrigemHint",
    "#dashPncpList",
    ".orc-title-edital", ".orc-title-meus"
  ].join(",");

  var ROOT_SEL = "#app, #authGate, #entregaOverlay, #orcSaveOverlay, #docsOverlay, #participarOverlay, #cofreOverlay";

  function normalizeLang(code) {
    code = String(code || "").trim();
    if (SUPPORTED.indexOf(code) !== -1) return code;
    if (/^pt/i.test(code)) return "pt-BR";
    if (/^en/i.test(code)) return "en";
    if (/^es/i.test(code)) return "es";
    return "pt-BR";
  }

  function loadLang() {
    try {
      var saved = localStorage.getItem(LANG_KEY);
      if (saved) return normalizeLang(saved);
    } catch (e) {}
    try {
      if (navigator.language) return normalizeLang(navigator.language);
    } catch (e2) {}
    return "pt-BR";
  }

  var current = loadLang();

  function t(key, fallback) {
    var pack = DICT[current] || DICT["pt-BR"];
    var val = pack[key];
    if (val == null && current !== "pt-BR") val = DICT["pt-BR"][key];
    if (val == null) val = fallback != null ? fallback : key;
    return val;
  }

  function normKey(s) {
    return String(s || "")
      .replace(/\u00a0/g, " ")
      .replace(/[\u200b-\u200d\ufeff]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function stripDecor(s) {
    // Remove emojis / símbolos no início para fallback de busca
    return normKey(String(s || "").replace(/^[^A-Za-zÀ-ÿ0-9]+/g, ""));
  }

  function phraseLookup(lang, src) {
    if (!src) return null;
    var pack = PHRASES[lang];
    if (!pack) return null;
    var k = normKey(src);
    if (pack[k] != null) return pack[k];
    if (pack[src] != null) return pack[src];
    var bare = stripDecor(k);
    if (bare && pack[bare] != null) return pack[bare];
    // Procura chave cuja parte textual (sem decoração) coincida
    if (bare) {
      for (var key in pack) {
        if (!Object.prototype.hasOwnProperty.call(pack, key)) continue;
        if (stripDecor(key) === bare) return pack[key];
      }
    }
    return null;
  }

  function isSkippable(el) {
    if (!el || el.nodeType !== 1) return true;
    var tag = el.tagName;
    if (tag === "SCRIPT" || tag === "STYLE" || tag === "NOSCRIPT") return true;
    if (el.hasAttribute("data-i18n")) return true;
    // Never overwrite parents that wrap data-i18n children (e.g. h2 + span[data-i18n])
    if (el.querySelector && el.querySelector("[data-i18n]")) return true;
    if (el.closest) {
      var anc = el.closest("[data-i18n]");
      if (anc && anc !== el) return true;
    }
    return false;
  }

  function hasInteractiveNest(el) {
    return !!(el.querySelector && el.querySelector("input, select, textarea, table, button, a[href]"));
  }

  function isForceTranslateTag(el) {
    if (!el) return false;
    var tag = (el.tagName || "").toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || tag === "h4" || tag === "th" || tag === "option") {
      return true;
    }
    if (tag === "label" && el.classList && el.classList.contains("fld")) return true;
    if (el.classList && el.classList.contains("desc")) return true;
    if (el.classList && el.classList.contains("cat-form-title")) return true;
    if (el.classList && el.classList.contains("disputa-sec-title")) return true;
    if (el.classList && (el.classList.contains("dc-label") || el.classList.contains("dc-sub"))) return true;
    if (tag === "button" || (el.classList && el.classList.contains("btn"))) return true;
    return false;
  }

  function isMostlyLeaf(el) {
    if (!el) return false;
    if (isForceTranslateTag(el)) {
      // botões/labels com input interno ainda podem ser traduzidos
      if ((el.tagName || "").toLowerCase() === "label" && el.querySelector("input")) return true;
      if (!hasInteractiveNest(el)) return true;
      if ((el.tagName || "").toLowerCase() === "button" || (el.classList && el.classList.contains("btn"))) {
        return true;
      }
    }
    var tag = (el.tagName || "").toLowerCase();
    if (
      tag === "label" &&
      (el.classList.contains("chat-opt") ||
        el.classList.contains("prox-opt") ||
        el.classList.contains("status-nf") ||
        el.classList.contains("cofre-check-all") ||
        el.classList.contains("radio-card") ||
        el.classList.contains("small"))
    ) {
      return true;
    }
    if (tag === "option") return true;
    if (!hasInteractiveNest(el)) return true;
    if (tag === "button" || el.classList.contains("btn")) {
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) {
        var c = kids[i];
        var ct = (c.tagName || "").toLowerCase();
        if (ct === "script" || ct === "style") continue;
        if (c.classList && c.classList.contains("ico")) continue;
        if (ct === "span" && !c.querySelector("input,select,textarea,button")) continue;
        if (ct === "b" || ct === "strong" || ct === "i" || ct === "em" || ct === "br") continue;
        return false;
      }
      return true;
    }
    return false;
  }

  function applyLabelText(el, text) {
    var keep = [];
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 1) keep.push(n);
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    for (var j = 0; j < keep.length; j++) el.appendChild(keep[j]);
    el.appendChild(document.createTextNode(" " + String(text).replace(/^\s+/, "")));
  }

  function setTextPreservingIco(el, text) {
    var ico = null;
    for (var i = 0; i < el.childNodes.length; i++) {
      var n = el.childNodes[i];
      if (n.nodeType === 1 && n.classList && n.classList.contains("ico")) {
        ico = n;
        break;
      }
    }
    if (!ico) {
      if ((el.tagName || "").toLowerCase() === "label" && el.querySelector("input")) {
        applyLabelText(el, text);
        return;
      }
      el.textContent = text;
      return;
    }
    while (el.firstChild) el.removeChild(el.firstChild);
    el.appendChild(ico);
    el.appendChild(document.createTextNode(" " + String(text).replace(/^\s+/, "")));
  }

  function getLabelSourceText(el) {
    var clone = el.cloneNode(true);
    var remove = clone.querySelectorAll(
      "input, select, textarea, .ico, .rc-ico, .ub-ico, .sb-ico, .nav-chevron, .burger"
    );
    for (var i = 0; i < remove.length; i++) {
      if (remove[i].parentNode) remove[i].parentNode.removeChild(remove[i]);
    }
    return normKey(clone.textContent);
  }

  function usesHtml(el) {
    if (!el) return false;
    var html = el.innerHTML || "";
    if (!/<(b|strong|i|em|br)\b/i.test(html)) return false;
    if (el.classList && el.classList.contains("desc")) return true;
    var tag = (el.tagName || "").toLowerCase();
    return tag === "div" || tag === "p" || tag === "li";
  }

  function applyPhrases(root) {
    var scopes = [];
    if (root && root.querySelectorAll) {
      if (root === document || root === document.documentElement || root === document.body) {
        var nodes = document.querySelectorAll(ROOT_SEL);
        for (var r = 0; r < nodes.length; r++) scopes.push(nodes[r]);
      } else if (root.matches && root.matches(ROOT_SEL.replace(/,\s*/g, ", "))) {
        scopes.push(root);
      } else {
        scopes.push(root);
      }
    } else {
      var all = document.querySelectorAll(ROOT_SEL);
      for (var a = 0; a < all.length; a++) scopes.push(all[a]);
    }

    var lang = current;
    var isPt = lang === "pt-BR";

    for (var s = 0; s < scopes.length; s++) {
      var scope = scopes[s];
      if (!scope || !scope.querySelectorAll) continue;
      var els = scope.querySelectorAll(AUTO_SEL);
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (isSkippable(el)) continue;
        if (!isMostlyLeaf(el)) continue;

        if (usesHtml(el)) {
          if (!el.hasAttribute("data-ls-pt-html")) {
            el.setAttribute("data-ls-pt-html", normKey(el.innerHTML));
          }
          var srcH = el.getAttribute("data-ls-pt-html");
          if (isPt) {
            if (normKey(el.innerHTML) !== srcH) el.innerHTML = srcH;
          } else {
            var trH = phraseLookup(lang, srcH);
            if (trH != null) el.innerHTML = trH;
          }
          continue;
        }

        var tag = (el.tagName || "").toLowerCase();
        var src;
        if (tag === "label" && el.querySelector("input")) {
          if (!el.hasAttribute("data-ls-pt")) {
            el.setAttribute("data-ls-pt", getLabelSourceText(el));
          }
          src = el.getAttribute("data-ls-pt");
          if (isPt) applyLabelText(el, src);
          else {
            var trL = phraseLookup(lang, src);
            if (trL != null) applyLabelText(el, trL);
          }
          continue;
        }

        if (!el.hasAttribute("data-ls-pt")) {
          el.setAttribute("data-ls-pt", normKey(el.textContent));
        }
        src = el.getAttribute("data-ls-pt");
        if (!src) continue;

        if (isPt) {
          if (el.querySelector && el.querySelector(".ico")) setTextPreservingIco(el, src);
          else if (normKey(el.textContent) !== src) {
            if (el.children && el.children.length === 1 && (el.children[0].tagName || "").toLowerCase() === "span") {
              el.children[0].textContent = src;
            } else {
              el.textContent = src;
            }
          }
        } else {
          var tr = phraseLookup(lang, src);
          if (tr != null) {
            if (el.querySelector && el.querySelector(".ico")) setTextPreservingIco(el, tr);
            else if (el.children && el.children.length === 1 && (el.children[0].tagName || "").toLowerCase() === "span") {
              el.children[0].textContent = tr;
            } else {
              el.textContent = tr;
            }
          }
        }
      }

      var withPh = scope.querySelectorAll("[placeholder]");
      for (var p = 0; p < withPh.length; p++) {
        var inp = withPh[p];
        if (inp.hasAttribute("data-i18n-placeholder")) continue;
        var ph = inp.getAttribute("placeholder");
        if (!ph) continue;
        if (!inp.hasAttribute("data-ls-pt-placeholder")) {
          inp.setAttribute("data-ls-pt-placeholder", ph);
        }
        var srcPh = inp.getAttribute("data-ls-pt-placeholder");
        if (isPt) inp.setAttribute("placeholder", srcPh);
        else {
          var trPh = phraseLookup(lang, srcPh);
          if (trPh != null) inp.setAttribute("placeholder", trPh);
        }
      }

      var withTitle = scope.querySelectorAll("[title]");
      for (var ti = 0; ti < withTitle.length; ti++) {
        var tel = withTitle[ti];
        if (tel.hasAttribute("data-i18n-title")) continue;
        var tv = tel.getAttribute("title");
        if (!tv || !tv.trim()) continue;
        if (!tel.hasAttribute("data-ls-pt-title")) {
          tel.setAttribute("data-ls-pt-title", tv);
        }
        var srcT = tel.getAttribute("data-ls-pt-title");
        if (isPt) tel.setAttribute("title", srcT);
        else {
          var trT = phraseLookup(lang, srcT);
          if (trT != null) tel.setAttribute("title", trT);
        }
      }

      var withAria = scope.querySelectorAll("[aria-label]");
      for (var ar = 0; ar < withAria.length; ar++) {
        var ael = withAria[ar];
        if (ael.hasAttribute("data-i18n-aria")) continue;
        var av = ael.getAttribute("aria-label");
        if (!av || !av.trim()) continue;
        if (!ael.hasAttribute("data-ls-pt-aria")) {
          ael.setAttribute("data-ls-pt-aria", av);
        }
        var srcA = ael.getAttribute("data-ls-pt-aria");
        if (isPt) ael.setAttribute("aria-label", srcA);
        else {
          var trA = phraseLookup(lang, srcA);
          if (trA != null) ael.setAttribute("aria-label", trA);
        }
      }
    }
  }

  function apply(root) {
    root = root || document;
    var nodes = root.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      if (!key) continue;
      var mode = el.getAttribute("data-i18n-mode") || "text";
      if (mode === "html") el.innerHTML = t(key, el.innerHTML);
      else el.textContent = t(key, el.textContent);
    }
    var ph = root.querySelectorAll("[data-i18n-placeholder]");
    for (var j = 0; j < ph.length; j++) {
      var p = ph[j];
      p.setAttribute(
        "placeholder",
        t(p.getAttribute("data-i18n-placeholder"), p.getAttribute("placeholder") || "")
      );
    }
    var titles = root.querySelectorAll("[data-i18n-title]");
    for (var k = 0; k < titles.length; k++) {
      var ti = titles[k];
      ti.setAttribute("title", t(ti.getAttribute("data-i18n-title"), ti.getAttribute("title") || ""));
    }
    var aria = root.querySelectorAll("[data-i18n-aria]");
    for (var a = 0; a < aria.length; a++) {
      var ar = aria[a];
      ar.setAttribute(
        "aria-label",
        t(ar.getAttribute("data-i18n-aria"), ar.getAttribute("aria-label") || "")
      );
    }

    applyPhrases(root);

    try {
      document.documentElement.setAttribute("lang", current === "pt-BR" ? "pt-BR" : current);
    } catch (e) {}
    var selTop = document.getElementById("langSelect");
    if (selTop && selTop.value !== current) selTop.value = current;
    var selCfg = document.getElementById("langSelectCfg");
    if (selCfg && selCfg.value !== current) selCfg.value = current;
  }

  function viewTitles() {
    return {
      dashboard: t("view.dashboard"),
      pesquisas: t("view.pesquisas"),
      perguntarEditais: t("view.perguntarEditais"),
      editaisProximos: t("view.editaisProximos"),
      radarPncp: t("view.radarPncp"),
      captacao: t("view.pesquisas"),
      analiseIa: t("view.analiseIa"),
      leiloesParticipo: t("view.leiloesParticipo"),
      leilaoWorkspace: t("view.leilaoWorkspace"),
      importarEdital: t("view.importarEdital"),
      orcamento: t("view.orcamento"),
      cruzamento: t("view.cruzamento"),
      cofre: t("view.cofre"),
      docsChecklist: t("view.docsChecklist"),
      entregas: t("view.entregas"),
      histEntregas: t("view.histEntregas"),
      concorrencia: t("view.concorrencia"),
      catalogo: t("view.catalogo"),
      arp: t("view.arp"),
      disputa: t("view.disputa"),
      ferramentas: t("view.ferramentas"),
      chat: t("view.chat"),
      suporte: t("nav.suporte"),
      "chat-ia": t("nav.chatIa")
    };
  }

  function setLang(code, opts) {
    opts = opts || {};
    current = normalizeLang(code);
    try {
      localStorage.setItem(LANG_KEY, current);
    } catch (e) {}
    apply(document);
    try {
      if (window.LICSYSTEM) {
        LICSYSTEM.VIEW_TITLES = viewTitles();
      }
    } catch (e2) {}
    try {
      var titleEl = document.getElementById("topTitle");
      var map = viewTitles();
      var cv = (window.LICSYSTEM && LICSYSTEM.state && LICSYSTEM.state.currentView) || "dashboard";
      if (titleEl) titleEl.textContent = map[cv] || "LICSYSTEM";
    } catch (e3) {}
    if (!opts.silent) {
      try {
        document.dispatchEvent(new CustomEvent("licsystem:langchange", { detail: { lang: current } }));
      } catch (e4) {}
    }
    return current;
  }

  function wireSelects() {
    function onChange(ev) {
      var v = ev.target && ev.target.value;
      if (v) setLang(v);
    }
    var a = document.getElementById("langSelect");
    var b = document.getElementById("langSelectCfg");
    if (a && !a._i18nBound) {
      a._i18nBound = true;
      a.addEventListener("change", onChange);
    }
    if (b && !b._i18nBound) {
      b._i18nBound = true;
      b.addEventListener("change", onChange);
    }
  }

  function init() {
    wireSelects();
    setLang(current, { silent: true });
  }

  window.LICSYSTEM = window.LICSYSTEM || {};
  LICSYSTEM.i18n = {
    t: t,
    apply: apply,
    setLang: setLang,
    getLang: function () {
      return current;
    },
    viewTitles: viewTitles,
    supported: SUPPORTED.slice(),
    init: init,
    wire: wireSelects
  };
  window.__lsT = t;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
