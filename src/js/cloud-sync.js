/* LICSYSTEM — CLOUD SYNC (03-cloud-sync.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  var ORC_KEY = ctx.ORC_KEY;
  var COFRE_KEY = ctx.COFRE_KEY;
  var DOCS_CHECKLIST_KEY = ctx.DOCS_CHECKLIST_KEY;
  var LEILOES_PARTICIPO_KEY = ctx.LEILOES_PARTICIPO_KEY;
  var PNCP_WATCHES_KEY = ctx.PNCP_WATCHES_KEY;
  var PNCP_ALERTS_KEY = ctx.PNCP_ALERTS_KEY;
  var CLOUD_META_KEY = ctx.CLOUD_META_KEY;
  var CLOUD_LAST_UID_KEY = ctx.CLOUD_LAST_UID_KEY;
  function listarProdutos(){
    var fn = ctx.listarProdutos || window.listarProdutos || LICSYSTEM.listarProdutos;
    if (typeof fn !== "function") throw new Error("listarProdutos ainda não disponível");
    return fn.apply(this, arguments);
  }

  /* ============================ CLOUD SYNC (Firebase RTDB per uid) ============================
   * Paths: users/{uid}/orcamento|catalogo|cofre|docsChecklist|leiloesParticipo|arp|entregas|histEntregas|pncpWatches|pncpAlerts
   * Envelope: { updatedAt:ms, cleared?:bool, writeId?:string, data:... }
   * Merge: newest updatedAt wins; empty local never overwrites cloud unless Limpar (cleared).
   * Live: after login, onValue listeners apply newer remote envelopes without re-login.
   *
   * Suggested RTDB rules (optional; open "auth != null" still works):
   *   { "rules": { "users": {
   *     "$uid": { ".read": "auth != null && auth.uid === $uid",
   *               ".write": "auth != null && auth.uid === $uid" }
   *   }}}
   * Captação PDF permanece no navegador; watches/alertas PNCP sincronizam na nuvem.
   */
  LICSYSTEM.cloudSync = {
    DEBOUNCE_MS: 900,
    REMOTE_DEFER_MS: 700,
    KEYS: ["orcamento", "catalogo", "cofre", "docsChecklist", "leiloesParticipo", "arp", "entregas", "histEntregas", "pncpWatches", "pncpAlerts"],
    _uid: null,
    _onlineWired: false,
    _pulling: false,
    _applyingRemote: false,
    _pushTimers: {},
    _pendingRemoteTimers: {},
    _pendingRemote: {},
    _echoAt: {},
    _echoWriteId: {},
    _listenerRefs: {},
    _meta: null,

    path: function(key){
      var uid = this._uid || (LICSYSTEM.state.authUser && LICSYSTEM.state.authUser.uid);
      if(!uid) return null;
      return "users/" + uid + "/" + key;
    },

    readMeta: function(){
      if(this._meta) return this._meta;
      try{
        this._meta = JSON.parse(localStorage.getItem(CLOUD_META_KEY) || "{}") || {};
      }catch(e){ this._meta = {}; }
      return this._meta;
    },

    touchMeta: function(key, ts){
      var m = this.readMeta();
      m[key] = Number(ts) || Date.now();
      this._meta = m;
      try{ localStorage.setItem(CLOUD_META_KEY, JSON.stringify(m)); }catch(e){}
    },

    metaTs: function(key){
      var m = this.readMeta();
      return Number(m[key] || 0) || 0;
    },

    newWriteId: function(){
      return (this._uid || "local") + "-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8);
    },

    setStatus: function(kind, text){
      var node = el("syncStatus");
      if(!node) return;
      if(!text){
        node.hidden = true;
        node.textContent = "";
        node.className = "sync-status";
        node.removeAttribute("title");
        return;
      }
      node.hidden = false;
      node.textContent = text;
      node.className = "sync-status" + (kind ? (" is-" + kind) : "");
      if(kind === "offline"){
        node.title = "Sem conexão. As alterações ficam neste PC e sincronizam automaticamente ao voltar a internet.";
      } else if(kind === "ok"){
        node.title = "Dados sincronizados em tempo real com a nuvem (mesmo login em outros PCs).";
      } else if(kind === "syncing"){
        node.title = "Sincronizando com a nuvem…";
      } else if(kind === "error"){
        node.title = "Falha ao sincronizar. Verifique a conexão e tente novamente.";
      } else {
        node.title = "Sincronização na nuvem";
      }
    },

    toFb: function(obj){
      try{ return JSON.parse(JSON.stringify(obj)); }
      catch(e){ return obj; }
    },

    isOrcDataEmpty: function(data){
      if(!data) return true;
      var items = Array.isArray(data) ? data : data.items;
      if(!items || !items.length) return true;
      var meta = (!Array.isArray(data) && data.meta) ? data.meta : {};
      var hasMeta = !!(meta && (String(meta.nome||"").trim() || String(meta.numero||"").trim() || meta.catalogId));
      var hasRow = false;
      for(var i=0;i<items.length;i++){
        if(LICSYSTEM.orcamento && !LICSYSTEM.orcamento.isEmptyRow(items[i])){ hasRow = true; break; }
      }
      return !hasRow && !hasMeta;
    },

    isListEmpty: function(data){
      if(data == null) return true;
      if(Array.isArray(data)) return !data.length;
      if(typeof data === "object") return !Object.keys(data).length;
      return false;
    },

    buildOrcData: function(){
      return {
        v: 2,
        items: (LICSYSTEM.state.orcItems || []).map(function(it){
          return LICSYSTEM.orcamento.normalizeItem(it);
        }),
        meta: {
          nome: LICSYSTEM.state.orcMetaNome || "",
          numero: LICSYSTEM.state.orcMetaNumero || "",
          catalogId: LICSYSTEM.state.orcCatalogId || null
        },
        page: LICSYSTEM.state.orcPage || 1,
        savedAt: Date.now()
      };
    },

    applyOrcData: function(data){
      if(!data) return;
      var items = Array.isArray(data) ? data : (data.items || []);
      var meta = (!Array.isArray(data) && data.meta) ? data.meta : {};
      LICSYSTEM.state.orcItems = (items.length ? items : [LICSYSTEM.orcamento.emptyItem()])
        .map(function(it){ return LICSYSTEM.orcamento.normalizeItem(it); });
      if(!LICSYSTEM.state.orcItems.length) LICSYSTEM.state.orcItems = [LICSYSTEM.orcamento.emptyItem()];
      LICSYSTEM.state.orcMetaNome = meta.nome != null ? String(meta.nome) : "";
      LICSYSTEM.state.orcMetaNumero = meta.numero != null ? String(meta.numero) : "";
      LICSYSTEM.state.orcCatalogId = meta.catalogId != null ? meta.catalogId : null;
      if(!Array.isArray(data) && data.page != null){
        LICSYSTEM.state.orcPage = Math.max(1, Number(data.page) || 1);
      }
      var payload = {
        v: 2,
        items: LICSYSTEM.state.orcItems.map(function(it){ return LICSYSTEM.orcamento.normalizeItem(it); }),
        meta: {
          nome: LICSYSTEM.state.orcMetaNome || "",
          numero: LICSYSTEM.state.orcMetaNumero || "",
          catalogId: LICSYSTEM.state.orcCatalogId || null
        },
        page: LICSYSTEM.state.orcPage || 1,
        savedAt: Number((!Array.isArray(data) && (data.updatedAt || data.savedAt)) || Date.now()),
        updatedAt: Number((!Array.isArray(data) && (data.updatedAt || data.savedAt)) || Date.now())
      };
      try{ localStorage.setItem(ORC_KEY, JSON.stringify(payload)); }catch(e){}
      LICSYSTEM.state._orcRendered = false;
      try{ LICSYSTEM.orcamento.updateMeta(); }catch(e){}
      if(LICSYSTEM.state.currentView === "orcamento"){
        try{ LICSYSTEM.orcamento.render({ save:false }); }catch(e){}
      }
    },

    readLocalEnvelope: function(key){
      try{
        if(key === "orcamento"){
          var raw = JSON.parse(localStorage.getItem(ORC_KEY) || "null");
          if(raw == null) return null;
          var data = Array.isArray(raw)
            ? { v:2, items: raw, meta:{}, page:1, savedAt: this.metaTs("orcamento") }
            : raw;
          var ts = Number(data.updatedAt || data.savedAt || this.metaTs("orcamento") || 0);
          return { updatedAt: ts, cleared: !!data.cleared, data: data };
        }
        if(key === "catalogo"){
          var cat = JSON.parse(localStorage.getItem("licsystem_catalogo_v1") || "null");
          if(cat == null) return null;
          return { updatedAt: this.metaTs("catalogo"), data: Array.isArray(cat) ? cat : [] };
        }
        if(key === "cofre"){
          var cof = JSON.parse(localStorage.getItem(COFRE_KEY) || "null");
          if(cof == null) return null;
          return { updatedAt: this.metaTs("cofre"), data: cof && typeof cof === "object" ? cof : {} };
        }
        if(key === "docsChecklist"){
          var dchk = JSON.parse(localStorage.getItem(DOCS_CHECKLIST_KEY) || "null");
          if(dchk == null) return null;
          return { updatedAt: this.metaTs("docsChecklist"), data: dchk && typeof dchk === "object" ? dchk : {} };
        }
        if(key === "leiloesParticipo"){
          var lp = JSON.parse(localStorage.getItem(LEILOES_PARTICIPO_KEY) || "null");
          if(lp == null) return null;
          return { updatedAt: this.metaTs("leiloesParticipo"), data: Array.isArray(lp) ? lp : [] };
        }
        if(key === "pncpWatches"){
          var pw = JSON.parse(localStorage.getItem(PNCP_WATCHES_KEY) || "null");
          if(pw == null) return null;
          return { updatedAt: this.metaTs("pncpWatches"), data: Array.isArray(pw) ? pw : [] };
        }
        if(key === "pncpAlerts"){
          var pa = JSON.parse(localStorage.getItem(PNCP_ALERTS_KEY) || "null");
          if(pa == null) return null;
          return { updatedAt: this.metaTs("pncpAlerts"), data: Array.isArray(pa) ? pa : [] };
        }
        if(key === "arp"){
          var arp = JSON.parse(localStorage.getItem("licsystem_arp_v1") || "null");
          if(arp == null) return null;
          return { updatedAt: this.metaTs("arp"), data: Array.isArray(arp) ? arp : [] };
        }
        if(key === "entregas"){
          var ent = JSON.parse(localStorage.getItem("licsystem_entregas_v1") || "null");
          if(ent == null) return null;
          return { updatedAt: this.metaTs("entregas"), data: Array.isArray(ent) ? ent : [] };
        }
        if(key === "histEntregas"){
          var histRaw = JSON.parse(localStorage.getItem("licsystem_hist_entregas_v1") || "null");
          if(histRaw == null) return null;
          var histData = Array.isArray(histRaw)
            ? histRaw
            : (histRaw && Array.isArray(histRaw.items) ? histRaw.items : []);
          var histTs = Number(
            (histRaw && !Array.isArray(histRaw) && (histRaw.updatedAt || histRaw.savedAt)) ||
            this.metaTs("histEntregas") ||
            0
          );
          return {
            updatedAt: histTs,
            cleared: !!(histRaw && !Array.isArray(histRaw) && histRaw.cleared) || (Array.isArray(histData) && !histData.length && histTs > 0),
            data: histData
          };
        }
      }catch(e){}
      return null;
    },

    isEnvelopeEmpty: function(key, env){
      if(!env) return true;
      if(env.cleared) return true;
      var data = env.data;
      if(key === "orcamento") return this.isOrcDataEmpty(data);
      if(key === "docsChecklist"){
        if(!data || typeof data !== "object") return true;
        return !Array.isArray(data.documentos) || !data.documentos.length;
      }
      if(key === "cofre"){
        if(!data || typeof data !== "object") return true;
        if(Array.isArray(data.items)) return !data.items.length;
        return !Object.keys(data).filter(function(k){ return k !== "v" && k !== "items"; }).length;
      }
      return this.isListEmpty(data);
    },

    applyEnvelope: function(key, env){
      if(!env) return;
      var data = env.data;
      var ts = Number(env.updatedAt || Date.now());
      if(key === "orcamento"){
        if(env.cleared || this.isOrcDataEmpty(data)){
          LICSYSTEM.state.orcItems = [LICSYSTEM.orcamento.emptyItem()];
          LICSYSTEM.state.orcPage = 1;
          LICSYSTEM.state.orcCatalogId = null;
          LICSYSTEM.state.orcMetaNome = "";
          LICSYSTEM.state.orcMetaNumero = "";
          var emptyPayload = this.buildOrcData();
          emptyPayload.savedAt = ts;
          emptyPayload.updatedAt = ts;
          emptyPayload.cleared = !!env.cleared;
          try{ localStorage.setItem(ORC_KEY, JSON.stringify(emptyPayload)); }catch(e){}
          this.touchMeta("orcamento", ts);
          LICSYSTEM.state._orcDirty = false;
          try{ LICSYSTEM.orcamento.updateMeta(); }catch(e){}
          if(LICSYSTEM.state.currentView === "orcamento"){
            try{ LICSYSTEM.orcamento.render({ save:false }); }catch(e){}
          }
        } else {
          if(data && typeof data === "object" && !Array.isArray(data)){
            data.updatedAt = ts;
            data.savedAt = ts;
          }
          this.applyOrcData(data);
          this.touchMeta("orcamento", ts);
          LICSYSTEM.state._orcDirty = false;
        }
        return;
      }
      if(key === "catalogo"){
        LICSYSTEM.catalogo.items = Array.isArray(data) ? data : [];
        try{ localStorage.setItem("licsystem_catalogo_v1", JSON.stringify(LICSYSTEM.catalogo.items)); }catch(e){}
        this.touchMeta("catalogo", ts);
        try{ if(typeof listarProdutos === "function") listarProdutos(); }catch(e){}
        return;
      }
      if(key === "cofre"){
        if(LICSYSTEM.cofre){
          // Persiste localmente o envelope da nuvem (já migrado para v2)
          LICSYSTEM.cofre.applyData(data, { skipPersist: false });
        } else {
          try{ localStorage.setItem(COFRE_KEY, JSON.stringify(data && typeof data === "object" ? data : {})); }catch(e){}
        }
        this.touchMeta("cofre", ts);
        try{ if(LICSYSTEM.cofre) LICSYSTEM.cofre.render(); }catch(e){}
        return;
      }
      if(key === "docsChecklist"){
        if(LICSYSTEM.docsChecklist){
          LICSYSTEM.docsChecklist.applyData(
            (data && typeof data === "object" && !Array.isArray(data)) ? data : {}
          );
        }
        this.touchMeta("docsChecklist", ts);
        return;
      }
      if(key === "leiloesParticipo"){
        if(LICSYSTEM.leiloesParticipo){
          LICSYSTEM.leiloesParticipo.applyData(Array.isArray(data) ? data : [], { skipPersist: false });
        } else {
          try{ localStorage.setItem(LEILOES_PARTICIPO_KEY, JSON.stringify(Array.isArray(data) ? data : [])); }catch(e){}
        }
        this.touchMeta("leiloesParticipo", ts);
        return;
      }
      if(key === "pncpWatches"){
        if(LICSYSTEM.alertas){
          LICSYSTEM.alertas.applyWatches(Array.isArray(data) ? data : [], { skipPersist: false, skipCloud: true });
        } else {
          try{ localStorage.setItem(PNCP_WATCHES_KEY, JSON.stringify(Array.isArray(data) ? data : [])); }catch(e){}
        }
        this.touchMeta("pncpWatches", ts);
        return;
      }
      if(key === "pncpAlerts"){
        if(LICSYSTEM.alertas){
          LICSYSTEM.alertas.applyAlerts(Array.isArray(data) ? data : [], { skipPersist: false, skipCloud: true });
        } else {
          try{ localStorage.setItem(PNCP_ALERTS_KEY, JSON.stringify(Array.isArray(data) ? data : [])); }catch(e){}
        }
        this.touchMeta("pncpAlerts", ts);
        return;
      }
      if(key === "arp"){
        LICSYSTEM.arp.atas = Array.isArray(data) ? data : [];
        try{ localStorage.setItem("licsystem_arp_v1", JSON.stringify(LICSYSTEM.arp.atas)); }catch(e){}
        this.touchMeta("arp", ts);
        try{ if(LICSYSTEM.arp.renderAll) LICSYSTEM.arp.renderAll(); }catch(e){}
        return;
      }
      if(key === "entregas"){
        LICSYSTEM.entregas.items = Array.isArray(data) ? data : [];
        try{ localStorage.setItem("licsystem_entregas_v1", JSON.stringify(LICSYSTEM.entregas.items)); }catch(e){}
        this.touchMeta("entregas", ts);
        try{
          if(LICSYSTEM.state.currentView === "entregas" && LICSYSTEM.entregas.renderLista){
            LICSYSTEM.entregas.renderLista();
          }
        }catch(e){}
        return;
      }
      if(key === "histEntregas"){
        LICSYSTEM.histEntregas.items = Array.isArray(data) ? data : [];
        LICSYSTEM.histEntregas._loaded = true;
        try{
          localStorage.setItem("licsystem_hist_entregas_v1", JSON.stringify({
            v: 1,
            updatedAt: ts,
            cleared: !!env.cleared || !LICSYSTEM.histEntregas.items.length,
            items: LICSYSTEM.histEntregas.items
          }));
        }catch(e){}
        this.touchMeta("histEntregas", ts);
        try{ if(LICSYSTEM.histEntregas.render) LICSYSTEM.histEntregas.render(); }catch(e){}
      }
    },

    pickWinner: function(localEnv, cloudEnv){
      if(!localEnv && !cloudEnv) return null;
      if(!localEnv) return { source: "cloud", env: cloudEnv };
      if(!cloudEnv) return { source: "local", env: localEnv };
      var lt = Number(localEnv.updatedAt || 0);
      var ct = Number(cloudEnv.updatedAt || 0);
      if(ct > lt) return { source: "cloud", env: cloudEnv };
      if(lt > ct) return { source: "local", env: localEnv };
      return { source: "local", env: localEnv };
    },

    pushKey: function(key, opts){
      opts = opts || {};
      var self = this;
      var path = self.path(key);
      if(!path || !utils.hasFirebaseConfig()) return Promise.resolve({ skipped: true });
      // Com edital ativo, a planilha vive no workspace (leiloesParticipo) — não sobrescrever o orçamento global.
      if(
        key === "orcamento" &&
        LICSYSTEM.state.activeLeilaoId &&
        !opts.forceGlobalOrc
      ){
        return Promise.resolve({ skipped: true, reason: "workspace-scoped" });
      }
      if(!navigator.onLine){
        self.setStatus("offline", "Offline — sync ao voltar");
        return Promise.resolve({ offline: true });
      }

      var env = opts.env || self.readLocalEnvelope(key);
      if(!env && opts.forceClear){
        env = {
          updatedAt: Date.now(),
          cleared: true,
          data: key === "orcamento"
            ? self.buildOrcData()
            : (key === "cofre" || key === "docsChecklist" ? {} : [])
        };
      }
      if(!env) return Promise.resolve({ skipped: true });

      var empty = self.isEnvelopeEmpty(key, env);
      if(empty && !opts.forceClear && !env.cleared){
        // Fresh/empty browser must not wipe cloud.
        return Promise.resolve({ skipped: true, reason: "empty-local" });
      }

      if(opts.forceClear){
        env.cleared = true;
        env.updatedAt = Date.now();
      }
      if(!env.updatedAt) env.updatedAt = Date.now();
      if(!env.writeId) env.writeId = self.newWriteId();

      self.setStatus("syncing", "Sincronizando…");
      var payload = self.toFb({
        updatedAt: env.updatedAt,
        cleared: !!env.cleared,
        writeId: env.writeId,
        data: env.data
      });
      self._echoAt[key] = Number(env.updatedAt) || 0;
      self._echoWriteId[key] = env.writeId;
      return utils.firebaseSet(path, payload).then(function(){
        self.touchMeta(key, env.updatedAt);
        self.setStatus("ok", "Sincronizado");
        return { ok: true };
      }).catch(function(err){
        console.warn("cloudSync push "+key, err);
        self.setStatus("error", "Sync falhou");
        return { ok: false, error: err };
      });
    },

    schedulePush: function(key, opts){
      var self = this;
      if(self._pulling || self._applyingRemote) return;
      clearTimeout(self._pushTimers[key]);
      self._pushTimers[key] = setTimeout(function(){
        self._pushTimers[key] = null;
        if(self._pulling || self._applyingRemote) return;
        self.pushKey(key, opts);
      }, self.DEBOUNCE_MS);
    },

    flushPush: function(key, opts){
      clearTimeout(this._pushTimers[key]);
      this._pushTimers[key] = null;
      return this.pushKey(key, opts);
    },

    notifyLocalChange: function(key, opts){
      opts = opts || {};
      var ts = Number(opts.updatedAt || Date.now());
      this.touchMeta(key, ts);
      if(opts.immediate || opts.forceClear){
        return this.flushPush(key, opts);
      }
      this.schedulePush(key, opts);
      return Promise.resolve();
    },

    mergeKey: function(key, cloudEnv, opts){
      opts = opts || {};
      var localEnv = this.readLocalEnvelope(key);
      // After account switch, ignore previous user's local until cloud applied.
      if(opts.replaceFromCloud){
        if(cloudEnv){
          this.applyEnvelope(key, cloudEnv);
          return { source: "cloud" };
        }
        // No cloud yet for new user — start clean (don't keep other account's work).
        if(key === "orcamento"){
          this.applyEnvelope(key, { updatedAt: Date.now(), cleared: true, data: this.buildOrcData() });
        } else if(key === "cofre" || key === "docsChecklist"){
          this.applyEnvelope(key, { updatedAt: Date.now(), cleared: true, data: {} });
        } else {
          this.applyEnvelope(key, { updatedAt: Date.now(), cleared: true, data: [] });
        }
        return { source: "cleared" };
      }

      // Local empty + cloud has data:
      // - intentional clear / newer local empty → keep local and push clear
      // - otherwise take cloud (fresh browser with no local work)
      if(this.isEnvelopeEmpty(key, localEnv) && cloudEnv && !this.isEnvelopeEmpty(key, cloudEnv)){
        var ltEmpty = Number(localEnv.updatedAt || 0);
        var ctFull = Number(cloudEnv.updatedAt || 0);
        if(localEnv.cleared || (ltEmpty > 0 && ltEmpty >= ctFull)){
          this.pushKey(key, { env: localEnv, forceClear: true, immediate: true });
          return { source: "local" };
        }
        this.applyEnvelope(key, cloudEnv);
        return { source: "cloud" };
      }
      // Cloud empty/cleared older than local with data → keep local and push.
      var win = this.pickWinner(localEnv, cloudEnv);
      if(!win) return { source: "none" };
      if(win.source === "cloud"){
        this.applyEnvelope(key, win.env);
        return { source: "cloud" };
      }
      // local wins (or tie): push if cloud missing/older
      if(!cloudEnv || Number((cloudEnv && cloudEnv.updatedAt) || 0) < Number((localEnv && localEnv.updatedAt) || 0)){
        if(!this.isEnvelopeEmpty(key, localEnv) || (localEnv && localEnv.cleared)){
          this.pushKey(key, { env: localEnv, forceClear: !!(localEnv && localEnv.cleared) });
        }
      }
      return { source: "local" };
    },

    parseCloudEnv: function(raw){
      if(!raw || typeof raw !== "object") return null;
      return {
        updatedAt: Number(raw.updatedAt || 0),
        cleared: !!raw.cleared,
        writeId: raw.writeId ? String(raw.writeId) : "",
        data: raw.data !== undefined ? raw.data : raw
      };
    },

    isOrcBusy: function(){
      if(LICSYSTEM.state._orcDirty) return true;
      if(LICSYSTEM.orcamento && LICSYSTEM.orcamento._saveTimer) return true;
      try{
        var ae = document.activeElement;
        if(ae && ae.closest && ae.closest("#orcBody, #orcMetaNome, #orcMetaNumero")) return true;
      }catch(e){}
      return false;
    },

    isEcho: function(key, cloudEnv){
      if(!cloudEnv) return true;
      var remoteTs = Number(cloudEnv.updatedAt || 0);
      var echoTs = Number(this._echoAt[key] || 0);
      if(cloudEnv.writeId && this._echoWriteId[key] && cloudEnv.writeId === this._echoWriteId[key]){
        return true;
      }
      if(remoteTs && echoTs && remoteTs <= echoTs) return true;
      var localTs = this.metaTs(key);
      if(remoteTs && localTs && remoteTs <= localTs) return true;
      return false;
    },

    applyRemoteEnvelope: function(key, cloudEnv){
      if(!cloudEnv) return;
      var self = this;
      // Edital ativo: não misturar orçamento global da nuvem na planilha do workspace.
      if(key === "orcamento" && LICSYSTEM.state.activeLeilaoId){
        if(cloudEnv.writeId) self._echoWriteId[key] = cloudEnv.writeId;
        self._echoAt[key] = Number(cloudEnv.updatedAt || 0);
        return;
      }
      self._applyingRemote = true;
      try{
        self.applyEnvelope(key, cloudEnv);
        if(key === "orcamento"){
          LICSYSTEM.state._orcDirty = false;
        }
        if(cloudEnv.writeId) self._echoWriteId[key] = cloudEnv.writeId;
        self._echoAt[key] = Number(cloudEnv.updatedAt || 0);
        self.setStatus("ok", "Sincronizado");
      }finally{
        self._applyingRemote = false;
      }
    },

    schedulePendingRemote: function(key){
      var self = this;
      clearTimeout(self._pendingRemoteTimers[key]);
      self._pendingRemoteTimers[key] = setTimeout(function(){
        self._pendingRemoteTimers[key] = null;
        var env = self._pendingRemote[key];
        if(!env) return;
        if(key === "orcamento" && self.isOrcBusy()){
          // Keep deferring while typing; local saves will win via newer updatedAt.
          self.schedulePendingRemote(key);
          return;
        }
        delete self._pendingRemote[key];
        if(self.isEcho(key, env)) return;
        self.applyRemoteEnvelope(key, env);
      }, self.REMOTE_DEFER_MS);
    },

    onRemoteSnap: function(key, snap){
      var self = this;
      if(self._pulling || self._applyingRemote) return;
      if(!self._uid) return;
      var cloudEnv = self.parseCloudEnv(snap && snap.val ? snap.val() : null);
      if(!cloudEnv) return;
      if(self.isEcho(key, cloudEnv)) return;

      if(key === "orcamento" && self.isOrcBusy()){
        self._pendingRemote[key] = cloudEnv;
        self.schedulePendingRemote(key);
        self.setStatus("syncing", "Sync pendente…");
        return;
      }

      self.applyRemoteEnvelope(key, cloudEnv);
    },

    stopRealtime: function(){
      var self = this;
      Object.keys(self._listenerRefs).forEach(function(key){
        try{
          var ref = self._listenerRefs[key];
          if(ref) ref.off("value");
        }catch(e){}
      });
      self._listenerRefs = {};
      Object.keys(self._pendingRemoteTimers).forEach(function(key){
        clearTimeout(self._pendingRemoteTimers[key]);
        self._pendingRemoteTimers[key] = null;
      });
      self._pendingRemote = {};
    },

    startRealtime: function(){
      var self = this;
      if(!utils.hasFirebaseConfig() || !self._uid) return Promise.resolve();
      self.stopRealtime();
      return utils.ensureFirebase().then(function(fb){
        if(!self._uid) return;
        self.KEYS.forEach(function(key){
          var path = self.path(key);
          if(!path) return;
          var ref = fb.database().ref(path);
          self._listenerRefs[key] = ref;
          ref.on("value", function(snap){
            self.onRemoteSnap(key, snap);
          }, function(err){
            console.warn("cloudSync live "+key, err);
            self.setStatus("error", "Sync falhou");
          });
        });
      }).catch(function(err){
        console.warn("cloudSync startRealtime", err);
      });
    },

    pullAll: function(opts){
      opts = opts || {};
      var self = this;
      if(!utils.hasFirebaseConfig() || !self.path("orcamento")){
        return Promise.resolve();
      }
      if(!navigator.onLine){
        self.setStatus("offline", "Offline — sync ao voltar");
        return Promise.resolve();
      }
      self._pulling = true;
      self.setStatus("syncing", "Sincronizando…");
      var keys = self.KEYS;
      return utils.ensureFirebase().then(function(fb){
        var uid = self._uid || (LICSYSTEM.state.authUser && LICSYSTEM.state.authUser.uid);
        return fb.database().ref("users/" + uid).once("value").then(function(snap){
          return snap.val() || {};
        });
      }).then(function(root){
        keys.forEach(function(key){
          var cloudEnv = self.parseCloudEnv(root[key]);
          self.mergeKey(key, cloudEnv, opts);
          if(cloudEnv){
            self._echoAt[key] = Number(cloudEnv.updatedAt || self.metaTs(key) || 0);
            if(cloudEnv.writeId) self._echoWriteId[key] = cloudEnv.writeId;
          }
        });
        self.setStatus("ok", "Sincronizado");
      }).catch(function(err){
        console.warn("cloudSync pullAll", err);
        self.setStatus("error", "Sync falhou");
      }).then(function(){
        self._pulling = false;
      });
    },

    onUser: function(user){
      if(!user || !user.uid) return Promise.resolve();
      var self = this;
      var prev = null;
      try{ prev = localStorage.getItem(CLOUD_LAST_UID_KEY); }catch(e){}
      var switched = !!(prev && prev !== user.uid);
      if(self._uid && self._uid !== user.uid){
        self.stopRealtime();
      }
      self._uid = user.uid;
      try{ localStorage.setItem(CLOUD_LAST_UID_KEY, user.uid); }catch(e){}
      self.wireOnline();
      // Flush pending orçamento edits before merge
      try{ if(LICSYSTEM.orcamento && LICSYSTEM.orcamento.flushSave) LICSYSTEM.orcamento.flushSave({ skipCloud: true }); }catch(e){}
      return self.pullAll({ replaceFromCloud: switched }).then(function(){
        return self.startRealtime();
      }).then(function(){
        try{ if(LICSYSTEM.alertas && LICSYSTEM.alertas.onLogin) LICSYSTEM.alertas.onLogin(); }catch(e){}
      });
    },

    onLogout: function(){
      var self = this;
      Object.keys(self._pushTimers).forEach(function(k){
        clearTimeout(self._pushTimers[k]);
        self._pushTimers[k] = null;
      });
      self.stopRealtime();
      self._echoAt = {};
      self._echoWriteId = {};
      self._uid = null;
      self.setStatus("", "");
      try{ if(LICSYSTEM.alertas && LICSYSTEM.alertas.onLogout) LICSYSTEM.alertas.onLogout(); }catch(e){}
    },

    wireOnline: function(){
      if(this._onlineWired) return;
      this._onlineWired = true;
      var self = this;
      window.addEventListener("online", function(){
        if(self._uid || (LICSYSTEM.state.authUser && LICSYSTEM.state.authUser.uid)){
          self.pullAll().then(function(){
            return self.startRealtime();
          });
        }
      });
      window.addEventListener("offline", function(){
        self.setStatus("offline", "Offline — sync ao voltar");
      });
    }
  };

  /* risk dictionary */
  var PALAVRAS_RISCO = ["instalação","instalacao","amostra","garantia","visita técnica","visita tecnica","treinamento","montagem","mão de obra","mao de obra","serviços","servicos"];

  /**
   * "garantia mínima de 12 meses" é texto padrão de quase todo edital e não é
   * risco real. Só marca quando for garantia estendida: acima de 12 meses,
   * 2 anos ou mais, ou explicitamente "estendida".
   */
  function garantiaEhRisco(t){
    if(t.indexOf("garantia estendida") !== -1) return true;
    var re = /garantia[^.]{0,40}?(\d{1,3})\s*(meses|mes|anos|ano)/g;
    var m;
    while((m = re.exec(t)) !== null){
      var n = parseInt(m[1], 10);
      if(m[2].indexOf("ano") === 0){
        if(n >= 2) return true;
      } else if(n > 12){
        return true;
      }
    }
    return false;
  }

  utils.riscoMatch = function(text){
    var t = utils.fold(String(text||"")).toLowerCase();
    var hits = [];
    for(var i=0;i<PALAVRAS_RISCO.length;i++){
      var w = utils.fold(PALAVRAS_RISCO[i]).toLowerCase();
      if(t.indexOf(w) === -1) continue;
      if(w === "garantia" && !garantiaEhRisco(t)) continue;
      hits.push(PALAVRAS_RISCO[i]);
    }
    return hits;
  };


  if (typeof PALAVRAS_RISCO !== "undefined") ctx.PALAVRAS_RISCO = PALAVRAS_RISCO;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
