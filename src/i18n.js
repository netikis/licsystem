/**
 * LICSYSTEM — internacionalização (i18n)
 * Idiomas: pt-BR (padrão), en, es
 */
(function () {
  var LANG_KEY = "licsystem_lang_v1";
  var SUPPORTED = ["pt-BR", "en", "es"];

  var DICT = {
    "pt-BR": {
      "lang.label": "Idioma",
      "lang.pt": "Português (Brasil)",
      "lang.en": "English",
      "lang.es": "Español",
      "top.subtitle": "LICSYSTEM — Inteligência em Licitações",
      "top.logout": "Sair",
      "top.alerts": "Alertas de editais",
      "top.alertsSub": "Monitoramento automático PNCP",
      "top.alertsUpdate": "Atualizar",
      "top.alertsMark": "Marcar lidos",
      "top.alertsEmpty": "Nenhum alerta ainda. Ative um monitoramento em Pesquisas de Editais.",
      "nav.dashboard": "Dashboard",
      "nav.pesquisas": "Pesquisas de Editais",
      "nav.perguntarEditais": "Perguntar editais",
      "nav.editaisProximos": "Editais próximos",
      "nav.radarPncp": "Radar PNCP",
      "nav.analiseIa": "Análise IA",
      "nav.leiloesParticipo": "Leilão que Participo",
      "nav.docsChecklist": "Docs do Edital",
      "nav.importarEdital": "Importar Edital (PDF)",
      "nav.orcamento": "Orçamento",
      "nav.cruzamento": "Cruzamento ML",
      "nav.entregas": "Entrega",
      "nav.histEntregas": "Histórico de Entregas",
      "nav.cofre": "Cofre de Documentos",
      "nav.concorrencia": "Concorrência",
      "nav.catalogo": "Catálogo",
      "nav.arp": "Atas de Registro",
      "nav.disputa": "Robô de Disputa",
      "nav.ferramentas": "Configurações",
      "nav.chat": "Pergunte ao Chat",
      "nav.suporte": "Suporte LICSYSTEM",
      "nav.chatIa": "Chat IA",
      "view.dashboard": "Dashboard",
      "view.pesquisas": "Pesquisas de Editais",
      "view.perguntarEditais": "Perguntar editais",
      "view.editaisProximos": "Editais próximos",
      "view.radarPncp": "Radar PNCP",
      "view.analiseIa": "Análise Inteligente de Editais",
      "view.leiloesParticipo": "Leilão que Participo",
      "view.leilaoWorkspace": "Painel do Edital",
      "view.importarEdital": "Importar Edital (PDF)",
      "view.orcamento": "Orçamento",
      "view.cruzamento": "Cruzamento Inteligente (ML)",
      "view.cofre": "Cofre de Documentos",
      "view.docsChecklist": "Docs do Edital",
      "view.entregas": "Entrega",
      "view.histEntregas": "Histórico de Entregas",
      "view.concorrencia": "Análise de Concorrência",
      "view.catalogo": "Catálogo Interno",
      "view.arp": "Atas de Registro (ARP)",
      "view.disputa": "Robô de Disputa",
      "view.ferramentas": "Configurações",
      "view.chat": "Pergunte ao Chat",
      "cfg.title": "Configurações",
      "cfg.saveProfile": "Salvar perfil",
      "cfg.name": "Nome",
      "cfg.cnpj": "CNPJ",
      "cfg.address": "Endereço",
      "cfg.phone": "Telefone",
      "cfg.cep": "CEP (frete / cruzamento)",
      "cfg.logo": "Logo (PNG/JPG)",
      "cfg.logoHint": "Máx. recomendado ~500 KB para PDFs leves.",
      "cfg.langTitle": "Idioma do sistema",
      "cfg.langDesc": "Escolha o idioma da interface. A preferência fica salva neste navegador.",
      "cfg.backup": "Backup",
      "cfg.export": "Exportar backup",
      "cfg.import": "Importar backup",
      "common.save": "Salvar",
      "common.cancel": "Cancelar",
      "common.clear": "Limpar",
      "common.search": "Buscar",
      "common.back": "Voltar",
      "lw.backList": "← Lista",
      "lw.activeEdital": "Edital ativo",
      "lw.tab.hub": "Painel",
      "lw.tab.docs": "Docs",
      "lw.tab.analise": "Análise IA",
      "lw.tab.importar": "Importar",
      "lw.tab.orcamento": "Orçamento",
      "lw.tab.cruzamento": "Cruzamento ML",
      "cat.title": "Catálogo Interno",
      "cat.formTitle": "Cadastro de produto",
      "cat.nome": "Nome do Produto / Descrição",
      "cat.sku": "Código / SKU",
      "cat.preco": "Preço de Referência (R$)",
      "cat.marca": "Marca / Fabricante",
      "cat.save": "Salvar Produto",
      "disputa.title": "Robô de Disputa",
      "disputa.desc": "Informe o lance do concorrente: o robô cobre automaticamente até a margem que você definir.",
      "disputa.on": "Ligar robô",
      "disputa.off": "Parar",
      "disputa.cover": "Cobrir agora",
      "disputa.clear": "Limpar sessão",
      "side.foot": "LICSYSTEM © Sistema Licitação"
    },
    en: {
      "lang.label": "Language",
      "lang.pt": "Portuguese (Brazil)",
      "lang.en": "English",
      "lang.es": "Spanish",
      "top.subtitle": "LICSYSTEM — Bidding Intelligence",
      "top.logout": "Sign out",
      "top.alerts": "Bid alerts",
      "top.alertsSub": "Automatic PNCP monitoring",
      "top.alertsUpdate": "Refresh",
      "top.alertsMark": "Mark all read",
      "top.alertsEmpty": "No alerts yet. Enable monitoring in Bid Searches.",
      "nav.dashboard": "Dashboard",
      "nav.pesquisas": "Bid Searches",
      "nav.perguntarEditais": "Ask about notices",
      "nav.editaisProximos": "Nearby notices",
      "nav.radarPncp": "PNCP Radar",
      "nav.analiseIa": "AI Analysis",
      "nav.leiloesParticipo": "Auctions I Join",
      "nav.docsChecklist": "Bid Documents",
      "nav.importarEdital": "Import Notice (PDF)",
      "nav.orcamento": "Budget",
      "nav.cruzamento": "ML Matching",
      "nav.entregas": "Delivery",
      "nav.histEntregas": "Delivery History",
      "nav.cofre": "Document Vault",
      "nav.concorrencia": "Competition",
      "nav.catalogo": "Catalog",
      "nav.arp": "Price Registration",
      "nav.disputa": "Bidding Robot",
      "nav.ferramentas": "Settings",
      "nav.chat": "Ask Chat",
      "nav.suporte": "LICSYSTEM Support",
      "nav.chatIa": "AI Chat",
      "view.dashboard": "Dashboard",
      "view.pesquisas": "Bid Searches",
      "view.perguntarEditais": "Ask about notices",
      "view.editaisProximos": "Nearby notices",
      "view.radarPncp": "PNCP Radar",
      "view.analiseIa": "Smart Notice Analysis",
      "view.leiloesParticipo": "Auctions I Join",
      "view.leilaoWorkspace": "Notice Panel",
      "view.importarEdital": "Import Notice (PDF)",
      "view.orcamento": "Budget",
      "view.cruzamento": "Smart Matching (ML)",
      "view.cofre": "Document Vault",
      "view.docsChecklist": "Bid Documents",
      "view.entregas": "Delivery",
      "view.histEntregas": "Delivery History",
      "view.concorrencia": "Competition Analysis",
      "view.catalogo": "Internal Catalog",
      "view.arp": "Price Registration (ARP)",
      "view.disputa": "Bidding Robot",
      "view.ferramentas": "Settings",
      "view.chat": "Ask Chat",
      "cfg.title": "Settings",
      "cfg.saveProfile": "Save profile",
      "cfg.name": "Name",
      "cfg.cnpj": "Tax ID (CNPJ)",
      "cfg.address": "Address",
      "cfg.phone": "Phone",
      "cfg.cep": "ZIP (shipping / matching)",
      "cfg.logo": "Logo (PNG/JPG)",
      "cfg.logoHint": "Recommended max ~500 KB for lighter PDFs.",
      "cfg.langTitle": "System language",
      "cfg.langDesc": "Choose the interface language. Preference is saved in this browser.",
      "cfg.backup": "Backup",
      "cfg.export": "Export backup",
      "cfg.import": "Import backup",
      "common.save": "Save",
      "common.cancel": "Cancel",
      "common.clear": "Clear",
      "common.search": "Search",
      "common.back": "Back",
      "lw.backList": "← List",
      "lw.activeEdital": "Active notice",
      "lw.tab.hub": "Panel",
      "lw.tab.docs": "Docs",
      "lw.tab.analise": "AI Analysis",
      "lw.tab.importar": "Import",
      "lw.tab.orcamento": "Budget",
      "lw.tab.cruzamento": "ML Matching",
      "cat.title": "Internal Catalog",
      "cat.formTitle": "Product registration",
      "cat.nome": "Product name / Description",
      "cat.sku": "Code / SKU",
      "cat.preco": "Reference price",
      "cat.marca": "Brand / Manufacturer",
      "cat.save": "Save product",
      "disputa.title": "Bidding Robot",
      "disputa.desc": "Enter the competitor bid: the robot covers automatically up to your margin.",
      "disputa.on": "Start robot",
      "disputa.off": "Stop",
      "disputa.cover": "Cover now",
      "disputa.clear": "Clear session",
      "side.foot": "LICSYSTEM © Bidding System"
    },
    es: {
      "lang.label": "Idioma",
      "lang.pt": "Portugués (Brasil)",
      "lang.en": "Inglés",
      "lang.es": "Español",
      "top.subtitle": "LICSYSTEM — Inteligencia en Licitaciones",
      "top.logout": "Salir",
      "top.alerts": "Alertas de edictos",
      "top.alertsSub": "Monitoreo automático PNCP",
      "top.alertsUpdate": "Actualizar",
      "top.alertsMark": "Marcar leídos",
      "top.alertsEmpty": "Aún no hay alertas. Active un monitoreo en Búsqueda de Edictos.",
      "nav.dashboard": "Panel",
      "nav.pesquisas": "Búsqueda de Edictos",
      "nav.perguntarEditais": "Preguntar edictos",
      "nav.editaisProximos": "Edictos cercanos",
      "nav.radarPncp": "Radar PNCP",
      "nav.analiseIa": "Análisis IA",
      "nav.leiloesParticipo": "Subastas en las que participo",
      "nav.docsChecklist": "Docs del Edicto",
      "nav.importarEdital": "Importar Edicto (PDF)",
      "nav.orcamento": "Presupuesto",
      "nav.cruzamento": "Cruce ML",
      "nav.entregas": "Entrega",
      "nav.histEntregas": "Historial de Entregas",
      "nav.cofre": "Caja de Documentos",
      "nav.concorrencia": "Competencia",
      "nav.catalogo": "Catálogo",
      "nav.arp": "Actas de Registro",
      "nav.disputa": "Robot de Disputa",
      "nav.ferramentas": "Configuración",
      "nav.chat": "Pregunte al Chat",
      "nav.suporte": "Soporte LICSYSTEM",
      "nav.chatIa": "Chat IA",
      "view.dashboard": "Panel",
      "view.pesquisas": "Búsqueda de Edictos",
      "view.perguntarEditais": "Preguntar edictos",
      "view.editaisProximos": "Edictos cercanos",
      "view.radarPncp": "Radar PNCP",
      "view.analiseIa": "Análisis Inteligente de Edictos",
      "view.leiloesParticipo": "Subastas en las que participo",
      "view.leilaoWorkspace": "Panel del Edicto",
      "view.importarEdital": "Importar Edicto (PDF)",
      "view.orcamento": "Presupuesto",
      "view.cruzamento": "Cruce Inteligente (ML)",
      "view.cofre": "Caja de Documentos",
      "view.docsChecklist": "Docs del Edicto",
      "view.entregas": "Entrega",
      "view.histEntregas": "Historial de Entregas",
      "view.concorrencia": "Análisis de Competencia",
      "view.catalogo": "Catálogo Interno",
      "view.arp": "Actas de Registro (ARP)",
      "view.disputa": "Robot de Disputa",
      "view.ferramentas": "Configuración",
      "view.chat": "Pregunte al Chat",
      "cfg.title": "Configuración",
      "cfg.saveProfile": "Guardar perfil",
      "cfg.name": "Nombre",
      "cfg.cnpj": "CNPJ / RUC",
      "cfg.address": "Dirección",
      "cfg.phone": "Teléfono",
      "cfg.cep": "CP (flete / cruce)",
      "cfg.logo": "Logo (PNG/JPG)",
      "cfg.logoHint": "Máx. recomendado ~500 KB para PDFs ligeros.",
      "cfg.langTitle": "Idioma del sistema",
      "cfg.langDesc": "Elija el idioma de la interfaz. La preferencia se guarda en este navegador.",
      "cfg.backup": "Respaldo",
      "cfg.export": "Exportar respaldo",
      "cfg.import": "Importar respaldo",
      "common.save": "Guardar",
      "common.cancel": "Cancelar",
      "common.clear": "Limpiar",
      "common.search": "Buscar",
      "common.back": "Volver",
      "lw.backList": "← Lista",
      "lw.activeEdital": "Edicto activo",
      "lw.tab.hub": "Panel",
      "lw.tab.docs": "Docs",
      "lw.tab.analise": "Análisis IA",
      "lw.tab.importar": "Importar",
      "lw.tab.orcamento": "Presupuesto",
      "lw.tab.cruzamento": "Cruce ML",
      "cat.title": "Catálogo Interno",
      "cat.formTitle": "Registro de producto",
      "cat.nome": "Nombre del producto / Descripción",
      "cat.sku": "Código / SKU",
      "cat.preco": "Precio de referencia",
      "cat.marca": "Marca / Fabricante",
      "cat.save": "Guardar producto",
      "disputa.title": "Robot de Disputa",
      "disputa.desc": "Ingrese la oferta del competidor: el robot cubre automáticamente hasta su margen.",
      "disputa.on": "Encender robot",
      "disputa.off": "Detener",
      "disputa.cover": "Cubrir ahora",
      "disputa.clear": "Limpiar sesión",
      "side.foot": "LICSYSTEM © Sistema de Licitación"
    }
  };

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

  function setAttr(el, attr, key) {
    if (!el || !key) return;
    var val = t(key);
    if (attr === "text") {
      el.textContent = val;
    } else if (attr === "html") {
      el.innerHTML = val;
    } else {
      el.setAttribute(attr, val);
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
      p.setAttribute("placeholder", t(p.getAttribute("data-i18n-placeholder"), p.getAttribute("placeholder") || ""));
    }
    var titles = root.querySelectorAll("[data-i18n-title]");
    for (var k = 0; k < titles.length; k++) {
      var ti = titles[k];
      ti.setAttribute("title", t(ti.getAttribute("data-i18n-title"), ti.getAttribute("title") || ""));
    }
    var aria = root.querySelectorAll("[data-i18n-aria]");
    for (var a = 0; a < aria.length; a++) {
      var ar = aria[a];
      ar.setAttribute("aria-label", t(ar.getAttribute("data-i18n-aria"), ar.getAttribute("aria-label") || ""));
    }
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
    // Atualiza título da tela atual
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
  // atalho global
  window.__lsT = t;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
