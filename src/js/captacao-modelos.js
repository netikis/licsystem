/* LICSYSTEM — registro permanente e ADITIVO de modelos de edital
 *
 * Novos layouts entram com registerModelo / registerModelos e SOMAM ao
 * catálogo existente (upsert por id). Nunca esvazia a lista — um padrão
 * cadastrado continua valendo para o próximo PDF no mesmo estilo.
 *
 * Cada família (elotech, maringa, municipais, classico) registra seus
 * modelos no install*; este arquivo só mantém o motor e a API pública.
 */
(function (LICSYSTEM) {
  "use strict";

  LICSYSTEM.captacao = LICSYSTEM.captacao || {};
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

  /** Catálogo vivo — reutilizado se o script recarregar (HMR). Nunca reatribuir []. */
  var MODELOS = bag._modelos || (bag._modelos = []);

  /**
   * Adiciona ou atualiza um modelo pelo `id`. Não remove nenhum outro.
   * @returns {boolean}
   */
  bag.registerModelo = function (modelo) {
    if (!modelo || !modelo.id || !modelo.split) return false;
    var next = {
      id: String(modelo.id),
      label: String(modelo.label || modelo.id),
      family: String(modelo.family || ""),
      split: String(modelo.split),
      minItems: Math.max(1, Number(modelo.minItems) || 1),
      priority: Number(modelo.priority) || 999,
      tryWithoutHint: !!modelo.tryWithoutHint,
      always: !!modelo.always,
      classic: !!modelo.classic,
      hint:
        typeof modelo.hint === "function"
          ? modelo.hint
          : function () {
              return false;
            }
    };
    for (var i = 0; i < MODELOS.length; i++) {
      if (MODELOS[i].id === next.id) {
        MODELOS[i] = next;
        return true;
      }
    }
    MODELOS.push(next);
    return true;
  };

  /** Registra vários modelos; todos somam ao catálogo. */
  bag.registerModelos = function (list) {
    var n = 0;
    (list || []).forEach(function (m) {
      if (bag.registerModelo(m)) n++;
    });
    return n;
  };

  function sortedModelos() {
    return MODELOS.slice().sort(function (a, b) {
      return (a.priority || 999) - (b.priority || 999);
    });
  }

  function setLastModelo(modelo, via) {
    var info = {
      id: modelo ? modelo.id : "desconhecido",
      label: modelo ? modelo.label : "Layout ainda não cadastrado",
      family: modelo ? modelo.family : "",
      via: via || "",
      at: new Date().toISOString()
    };
    LICSYSTEM.captacao.lastModelo = info;
    return info;
  }

  function tryModelo(modelo, text, P, via) {
    var dedupe = P.dedupeCaptacao;
    var min = Math.max(1, Number(modelo.minItems) || 1);
    var fn = P[modelo.split];
    if (typeof fn !== "function") return null;

    if (modelo.classic) {
      var limparPagina = P.limparPagina;
      var splitChunk = P.splitChunkPlanilha;
      var t = limparPagina(text).replace(/\r\n?/g, "\n");
      var rawLines = t.split(/\n+/);
      var merged = [];
      for (var r = 0; r < rawLines.length; r++) {
        var ln = rawLines[r].trim();
        if (!ln) continue;
        var parts = splitChunk(ln);
        for (var p = 0; p < parts.length; p++) merged.push(parts[p]);
      }
      var outC = dedupe(merged);
      if (outC.length >= min) {
        setLastModelo(modelo, via || "classico");
        return outC;
      }
      return null;
    }

    var raw = fn(text) || [];
    var out = dedupe(raw);
    if (out.length >= min) {
      setLastModelo(modelo, via || "hint");
      return out;
    }
    return null;
  }

  function tryGeometric(text, P, geom) {
    if (!geom || typeof bag.splitGeometricBlocks !== "function") return null;
    var raw = bag.splitGeometricBlocks(text, geom, P) || [];
    var out = P.dedupeCaptacao ? P.dedupeCaptacao(raw) : raw;
    var good = 0;
    for (var g = 0; g < out.length; g++) {
      var it = out[g];
      if (
        it &&
        String(it.produto || "").trim().length >= 3 &&
        Number(it.qtd) > 0 &&
        (Number(it.editalVunit) > 0 || Number(it.editalTotal) > 0)
      ) {
        good++;
      }
    }
    if (good < 2) return null;
    // Evita aceitar fatia (ex.: 13 itens) quando o PDF tem dezenas de linhas de tabela
    var cand = 0;
    try {
      if (typeof bag.countGeoCandidates === "function") cand = bag.countGeoCandidates(geom);
    } catch (e) {}
    if (cand >= 40 && out.length < Math.max(20, Math.floor(cand * 0.35))) return null;
    setLastModelo(
      {
        id: "geometrico",
        label: "Tabela genérica (colunas do PDF)",
        family: "geo",
        minItems: 2
      },
      "geo"
    );
    return out;
  }

  /**
   * Hint de município → tabela geométrica → THEO → fallback sem hint → clássico.
   * Percorre TODOS os modelos cadastrados (aditivos).
   */
  bag.runModelos = function (text, P, geom) {
    var rawText = String(text || "");
    var list = sortedModelos();
    var hinted = {};
    var i;
    var m;
    var hit;

    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (m.classic || m.always) continue;
      hinted[m.id] = !!(m.hint && m.hint(rawText));
      if (!hinted[m.id]) continue;
      hit = tryModelo(m, text, P, "hint");
      if (hit) return hit;
    }

    hit = tryGeometric(text, P, geom);
    if (hit) return hit;

    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (!m.always) continue;
      hit = tryModelo(m, text, P, "always");
      if (hit) return hit;
    }

    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (!m.tryWithoutHint || m.classic || m.always) continue;
      if (hinted[m.id]) continue;
      hit = tryModelo(m, text, P, "fallback");
      if (hit) return hit;
    }

    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (!m.classic) continue;
      hit = tryModelo(m, text, P, "classico");
      if (hit) return hit;
    }

    setLastModelo(null, "nenhum");
    return [];
  };

  LICSYSTEM.captacao.modelos = {
    list: function () {
      return sortedModelos().map(function (m) {
        return {
          id: m.id,
          label: m.label,
          family: m.family,
          priority: m.priority,
          minItems: m.minItems
        };
      });
    },
    get: function (id) {
      for (var i = 0; i < MODELOS.length; i++) {
        if (MODELOS[i].id === id) return MODELOS[i];
      }
      return null;
    },
    /** Soma ao catálogo (mesmo que bag.registerModelo). */
    register: function (modelo) {
      return bag.registerModelo(modelo);
    },
    /** Soma vários ao catálogo. */
    registerMany: function (list) {
      return bag.registerModelos(list);
    },
    count: function () {
      return MODELOS.length;
    },
    last: function () {
      return LICSYSTEM.captacao.lastModelo || null;
    },
    labelOf: function (id) {
      var m = LICSYSTEM.captacao.modelos.get(id);
      return m ? m.label : "";
    }
  };
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
