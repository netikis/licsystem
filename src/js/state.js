/* LICSYSTEM — STATE / KEYS (02-state.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});

  /* ============================ STATE ============================ */
  LICSYSTEM.config = LICSYSTEM.config || {
    mlProxyUrl: "/api/ml-proxy", // frete
    mlSearchUrl: "/api/search-ml" // busca oficial OAuth — nunca api.mercadolibre.com no browser
  };

  LICSYSTEM.state = {
    authUser: null,
    _orcDirty: true,
    _orcRendered: false,
    _dashReady: false,
    _cofreRendered: false,
    orcPage: 1,
    orcPageSize: 100,
    capPage: 1,
    capPageSize: 100,
    capFiltered: [],
    proxPage: 1,
    proxPageSize: 50,
    chatPage: 1,
    chatPageSize: 50,
    orcItems: [],
    aprovadosCruzamento: [],
    pncpAlerts: [],
    lastBdi: null,
    dashboardMetrics: {
      volumeDisputado: 0,
      ganhos: 0,
      perdidos: 0,
      emAnalise: 0,
      volumeMensal: [0,0,0,0,0,0]
    },
    captacaoLines: [],
    empresaPerfil: null,
    orcCatalogId: null,
    orcMetaNome: "",
    orcMetaNumero: "",
    /** Edital ao qual a planilha em memória pertence (evita copiar MEUS PREÇOS entre editais). */
    orcBoundLeilaoId: null,
    activeLeilaoId: null
  };

  var ORC_KEY = "licsystem_orcamento_v2";
  var ORC_KEY_LEGACY = "licsystem_orcamento_v1";
  var COFRE_KEY = "licsystem_cofre_v1";
  var DOCS_CHECKLIST_KEY = "licsystem_docs_checklist_v1";
  var DOCS_ACCORDION_KEY = "licsystem_docs_accordion_v1";
  var LEILOES_PARTICIPO_KEY = "licsystem_leiloes_participo_v1";
  var ACTIVE_LEILAO_KEY = "licsystem_active_leilao_v1";
  var PNCP_WATCHES_KEY = "licsystem_pncp_watches_v1";
  var PNCP_ALERTS_KEY = "licsystem_pncp_alerts_v1";
  var PNCP_INTERESSADOS_KEY = "licsystem_pncp_interessados_v1";
  var CLOUD_META_KEY = "licsystem_cloud_meta_v1";
  var LAST_VIEW_KEY = "licsystem_last_view_v1";
  var LEILAO_SCOPED_VIEWS = {
    leilaoWorkspace: true,
    docsChecklist: true,
    importarEdital: true,
    orcamento: true,
    cruzamento: true
  };
  var CLOUD_LAST_UID_KEY = "licsystem_cloud_last_uid";


  ctx.ORC_KEY = ORC_KEY;
  ctx.ORC_KEY_LEGACY = ORC_KEY_LEGACY;
  ctx.COFRE_KEY = COFRE_KEY;
  ctx.DOCS_CHECKLIST_KEY = DOCS_CHECKLIST_KEY;
  ctx.DOCS_ACCORDION_KEY = DOCS_ACCORDION_KEY;
  ctx.LEILOES_PARTICIPO_KEY = LEILOES_PARTICIPO_KEY;
  ctx.ACTIVE_LEILAO_KEY = ACTIVE_LEILAO_KEY;
  ctx.PNCP_WATCHES_KEY = PNCP_WATCHES_KEY;
  ctx.PNCP_ALERTS_KEY = PNCP_ALERTS_KEY;
  ctx.PNCP_INTERESSADOS_KEY = PNCP_INTERESSADOS_KEY;
  ctx.CLOUD_META_KEY = CLOUD_META_KEY;
  ctx.LAST_VIEW_KEY = LAST_VIEW_KEY;
  ctx.LEILAO_SCOPED_VIEWS = LEILAO_SCOPED_VIEWS;
  ctx.CLOUD_LAST_UID_KEY = CLOUD_LAST_UID_KEY;
  LICSYSTEM.keys = {
    ORC_KEY: ORC_KEY,
    ORC_KEY_LEGACY: ORC_KEY_LEGACY,
    COFRE_KEY: COFRE_KEY,
    DOCS_CHECKLIST_KEY: DOCS_CHECKLIST_KEY,
    DOCS_ACCORDION_KEY: DOCS_ACCORDION_KEY,
    LEILOES_PARTICIPO_KEY: LEILOES_PARTICIPO_KEY,
    ACTIVE_LEILAO_KEY: ACTIVE_LEILAO_KEY,
    PNCP_WATCHES_KEY: PNCP_WATCHES_KEY,
    PNCP_ALERTS_KEY: PNCP_ALERTS_KEY,
    PNCP_INTERESSADOS_KEY: PNCP_INTERESSADOS_KEY,
    CLOUD_META_KEY: CLOUD_META_KEY,
    LAST_VIEW_KEY: LAST_VIEW_KEY,
    LEILAO_SCOPED_VIEWS: LEILAO_SCOPED_VIEWS,
    CLOUD_LAST_UID_KEY: CLOUD_LAST_UID_KEY
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
