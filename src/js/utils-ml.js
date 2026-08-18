/* LICSYSTEM — UTILS / Mercado Livre */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils || (LICSYSTEM.utils = {});

  /* ------- Mercado Livre via proxy backend (nunca direto no browser) ------- */
  utils.mlProxyBase = function(){
    // Frete e utilidades legadas
    if(LICSYSTEM.config && LICSYSTEM.config.mlProxyUrl) return String(LICSYSTEM.config.mlProxyUrl).replace(/\/$/,"");
    return "/api/ml-proxy";
  };

  /** Busca oficial limpa — /api/search-ml (OAuth no servidor). */
  utils.mlSearchBase = function(){
    if(LICSYSTEM.config && LICSYSTEM.config.mlSearchUrl) return String(LICSYSTEM.config.mlSearchUrl).replace(/\/$/,"");
    return "/api/search-ml";
  };

  utils.mlProxy = function(params){
    var qs = Object.keys(params || {}).map(function(k){
      return encodeURIComponent(k) + "=" + encodeURIComponent(params[k] == null ? "" : params[k]);
    }).join("&");
    var url = utils.mlProxyBase() + (qs ? ("?" + qs) : "");
    return fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      }
    }).then(function(r){
      return r.json().then(function(j){
        // Proxy pode responder 200 com results=[] + warning — não tratar como hard fail
        if(!r.ok && !(j && Array.isArray(j.results))){
          var msg = (j && (j.message || j.error || j.warning)) || ("HTTP " + r.status);
          var err = new Error(msg);
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j || { results: [] };
      }, function(){
        throw new Error("HTTP " + r.status + " (resposta inválida do proxy)");
      });
    });
  };

  /** Limpa termo do edital para busca ML (ex.: "12A 20mm x 9mm"). */
  utils.mlQueryFromTermo = function(termo, embalagem){
    var raw = String(termo == null ? "" : termo)
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
      .replace(/(\d)A(\d)/gi, "$1 a $2")
      .replace(/(\d)A\b/gi, "$1 a")
      .replace(/\bx\b/gi, " ");
    var s = utils.sanitizar(raw);
    var emb = utils.sanitizar(embalagem || "");
    // embalagem generica nao ajuda na busca
    if(/^(unidade|unid|und|un|peca|pecas)$/i.test(emb)) emb = "";
    var q = (s + (emb ? " " + emb : "")).replace(/\s+/g, " ").trim();
    // evita query gigante de especificacao
    var words = q.split(" ").filter(Boolean);
    if(words.length > 8) words = words.slice(0, 8);
    return words.join(" ");
  };

  /**
   * Tokens de marca no termo (ex.: "bosch chave de impacto" → ["bosch"]).
   * Ignora palavras genéricas de produto/medida.
   */
  utils.mlBrandTokens = function(termo){
    var stop = {
      chave:1, impacto:1, alicate:1, abracadeira:1, borboleta:1, mangueira:1,
      parafuso:1, porca:1, arruela:1, broca:1, serra:1, fita:1, cabo:1, fio:1,
      tomada:1, interruptor:1, lampada:1, led:1, tinta:1, oleo:1, graxa:1,
      jogo:1, kit:1, jogo:1, conjunto:1, peca:1, pecas:1, und:1, un:1, unidade:1,
      mm:1, cm:1, pol:1, polegadas:1, poleg:1, volt:1, volts:1, ampere:1, amperes:1,
      w:1, watts:1, v:1, ah:1, lithium:1, litio:1, bateria:1, sem:1, com:1, para:1,
      de:1, da:1, do:1, das:1, dos:1, em:1, e:1, a:1, o:1, as:1, os:1,
      eletrico:1, eletrica:1, pneumatico:1, industrial:1, profissional:1,
      fazendeiro:1, universal:1, original:1, generico:1, novo:1, usada:1, usado:1
    };
    var words = utils.sanitizar(termo || "").split(/\s+/).filter(Boolean);
    var brands = [];
    words.forEach(function(w, idx){
      if(w.length < 3) return;
      if(/^\d/.test(w)) return; // medidas / modelos numéricos
      if(stop[w]) return;
      /* marca costuma ser a 1ª palavra significativa; aceita também tokens “próprios” curtos */
      if(idx === 0 || w.length >= 4) brands.push(w);
    });
    /* dedupe */
    var seen = {};
    return brands.filter(function(b){
      if(seen[b]) return false;
      seen[b] = 1;
      return true;
    }).slice(0, 3);
  };

  utils.mlTitleHasBrand = function(title, brandTokens){
    if(!brandTokens || !brandTokens.length) return true;
    var t = utils.sanitizar(title || "");
    if(!t) return false;
    return brandTokens.every(function(b){
      return t.indexOf(b) !== -1;
    });
  };

  /** Formata ml_debug da /api/search-ml para console + UI. */
  utils.formatMlDebug = function(j){
    var d = (j && (j.ml_debug || j)) || {};
    var endpoint = d.endpoint || j && j.upstream_endpoint || "—";
    var status = d.status != null ? d.status : (j && j.upstream_status);
    var body = d.body != null ? d.body : (j && j.upstream_body);
    var raw = d.rawBody || "";
    var bodyStr = "";
    try {
      bodyStr = typeof body === "string" ? body : JSON.stringify(body, null, 2);
    } catch (e) {
      bodyStr = String(body || raw || "");
    }
    if(!bodyStr && raw) bodyStr = raw;
    var where =
      String(endpoint).indexOf("oauth") !== -1
        ? "TOKEN (/oauth/token)"
        : String(endpoint).indexOf("search") !== -1
          ? "BUSCA (/sites/MLB/search)"
          : "ML";
    return {
      where: where,
      endpoint: endpoint,
      status: status,
      bodyStr: bodyStr,
      summary:
        "[" + where + "] HTTP " + (status != null ? status : "?") +
        " · endpoint " + endpoint +
        (bodyStr ? " · body: " + bodyStr.slice(0, 500) : "")
    };
  };

  utils.mlLocalBridgeBase = function(){
    return "http://127.0.0.1:3847";
  };

  /** HTTPS (Vercel) bloqueia fetch para http://127.0.0.1 — ponte só funciona em localhost HTTP. */
  utils.mlBridgeUsable = function(){
    try {
      var proto = String(location.protocol || "");
      var host = String(location.hostname || "");
      if(proto === "https:" && host !== "localhost" && host !== "127.0.0.1"){
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  };

  utils.mlSearchLocalBridge = function(q, limit){
    if(!utils.mlBridgeUsable()) return Promise.resolve(null);
    var lim = limit || 10;
    var url =
      utils.mlLocalBridgeBase() +
      "/search?q=" +
      encodeURIComponent(q || "") +
      "&limit=" +
      encodeURIComponent(lim);
    return fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    }).then(function(r){
      return r.json().then(function(j){
        if(j && j.ok && j.results && j.results.length){
          console.log("[LICSYSTEM ML] ponte local OK", { q: q, n: j.results.length });
          return j;
        }
        return null;
      }, function(){ return null; });
    }).catch(function(){ return null; });
  };

  utils.mlSearchFailMessage = function(j){
    if(j && (j.need_search_keys || j.need_serper)){
      return String(j.error || "") ||
        "Configure na Vercel: ML_APP_ID + ML_CLIENT_SECRET e/ou SERPER_API_KEY — depois Redeploy.";
    }
    if(j && j.error && !/forbidden|UNAUTHORIZED|sites\/MLB\/search/i.test(String(j.error))){
      return String(j.error);
    }
    return (
      "Busca no Mercado Livre indisponível no momento. " +
      "Confira na Vercel se ML_APP_ID + ML_CLIENT_SECRET (ou SERPER_API_KEY) estão configurados e faça Redeploy."
    );
  };

  utils.mlSearch = function(q, limit){
    var lim = limit || 10;
    var url =
      utils.mlSearchBase() +
      "?q=" +
      encodeURIComponent(q || "") +
      "&limit=" +
      encodeURIComponent(lim);

    /* Em localhost: tenta ponte local primeiro (IP da casa — o que funciona). */
    var start = utils.mlBridgeUsable()
      ? utils.mlSearchLocalBridge(q, lim)
      : Promise.resolve(null);

    return start.then(function(localFirst){
      if(localFirst) return localFirst;
      return fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" }
      }).then(function(r){
        return r.json().then(function(j){
          if(j && j.ok && j.results && j.results.length){
            return j;
          }
          return utils.mlSearchLocalBridge(q, lim).then(function(local){
            if(local) return local;
            console.error("[LICSYSTEM ML] busca bloqueada", j);
            var err = new Error(utils.mlSearchFailMessage(j));
            err.status = (j && j.upstream_status) || r.status;
            err.body = j;
            err.mlDebug = utils.formatMlDebug(j || {});
            throw err;
          });
        }, function(){
          return utils.mlSearchLocalBridge(q, lim).then(function(local){
            if(local) return local;
            throw new Error(utils.mlSearchFailMessage(null));
          });
        });
      });
    }).catch(function(err){
      if(err && err.message && /bloqueia a busca|ponte local/i.test(err.message)) throw err;
      if(err && err.body) throw err;
      return utils.mlSearchLocalBridge(q, lim).then(function(local){
        if(local) return local;
        throw err || new Error(utils.mlSearchFailMessage(null));
      });
    });
  };

  utils.mlShipping = function(itemId, cep, permalink){
    var p = { action: "shipping", itemId: itemId || "", cep: cep || "" };
    if(permalink) p.permalink = permalink;
    return utils.mlProxy(p);
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
