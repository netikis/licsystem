/* LICSYSTEM — registro permanente de modelos de edital
 *
 * Cada layout validado fica memorizado aqui: id, nome, sinais (hint),
 * splitter, mínimo de itens e prioridade. Novos editais no mesmo estilo
 * reutilizam o mesmo modelo sem reaprender do zero.
 */
(function (LICSYSTEM) {
  "use strict";

  LICSYSTEM.captacao = LICSYSTEM.captacao || {};
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

  /**
   * Modelos conhecidos. `priority` menor = tentado antes no passe com hint.
   * `tryWithoutHint: true` permite tentativa no passe de fallback.
   */
  var MODELOS = [
    {
      id: "maringa",
      label: "Maringá SEI (PMM/CATMAT)",
      family: "maringa",
      split: "splitMaringaBlocks",
      minItems: 2,
      priority: 10,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          (/\bPMM\b/i.test(raw) &&
            /\bCATMAT\b/i.test(raw) &&
            /\b(?:AMPLA|COTA\s+ME\/?EPP|EXCLUSIVO\s+ME\/?EPP)\s+\d{1,3}\s+\d{5,7}\s+\d{5,7}/i.test(
              raw
            )) ||
          (/Maring[aá]/i.test(raw) &&
            /\b(?:AMPLA|COTA\s+ME\/?EPP|EXCLUSIVO\s+ME\/?EPP)\s+\d{1,3}\s+\d{5,7}\s+\d{5,7}\s+\d+\s+Unid/i.test(
              raw
            ))
        );
      }
    },
    {
      id: "campo-tenente",
      label: "Campo do Tenente / BLL (por lote)",
      family: "maringa",
      split: "splitCampoTenenteBlocks",
      minItems: 2,
      priority: 20,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /Lote:\s*\d+\s*-\s*Lote\s*\d+/i.test(raw) &&
          (/C[oó]digo\s+do\s+produto/i.test(raw) ||
            /Campo\s+do\s+Tenente/i.test(raw) ||
            /bllcompras/i.test(raw))
        );
      }
    },
    {
      id: "godoy-moreira",
      label: "Godoy Moreira (1Doc — LOTE ORDEM CÓD)",
      family: "municipais",
      split: "splitGodoyMoreiraBlocks",
      minItems: 2,
      priority: 30,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /LOTE\s+ORDEM\s+C[OÓ]D\.?\s*ITEM\s+DESCRICAO/i.test(raw) ||
          (/Godoy\s+Moreira/i.test(raw) &&
            /\b\d{1,2}\s+1\s+\d{5}\s+\S[\s\S]{0,80}?\s+(?:UNID|PR)\s+\d+\s+\d{1,3}(?:\.\d{3})*,\d{2}/i.test(
              raw
            ))
        );
      }
    },
    {
      id: "sao-joao-ivai",
      label: "São João do Ivaí (Lote/Especificação)",
      family: "municipais",
      split: "splitSaoJoaoIvaiBlocks",
      minItems: 2,
      priority: 40,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /Lote\/\s*Especifica[cç][aã]o/i.test(raw) ||
          (/S[aã]o\s+Jo[aã]o\s+do\s+Iva[ií]/i.test(raw) &&
            /M[aá]x\.?\s*Unit\.?\s+M[aá]x\.?\s*Total/i.test(raw))
        );
      }
    },
    {
      id: "cambe",
      label: "Cambé — tabela municipal ITEM/ESPECIFICAÇÕES",
      family: "municipais",
      split: "splitCambeBlocks",
      minItems: 2,
      priority: 50,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /3\.\s*DESCRI\s*ÇÃ\s*O DETALHADA DO OBJETO/i.test(raw) &&
          /ITEM\s+ESPECIFICA\s*ÇÕ\s*ES\s+UNID\.\s+QTDE\./i.test(raw)
        );
      }
    },
    {
      id: "itapejara",
      label: "Itapejara D'Oeste — LOTE materiais",
      family: "municipais",
      split: "splitItapejaraBlocks",
      minItems: 2,
      priority: 60,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /Itapejara\s+D[’']?Oeste/i.test(raw) &&
          /LOTE\s+N[º°]\s*0?1\s*[–-]\s*MATERIAIS/i.test(raw)
        );
      }
    },
    {
      id: "sao-jose-pinhais",
      label: "São José dos Pinhais — Anexo II orçamento",
      family: "municipais",
      split: "splitSaoJosePinhaisBlocks",
      minItems: 2,
      priority: 70,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /S[aã]o\s+Jos[eé]\s+dos\s+Pinhais/i.test(raw) &&
          /ANEXO\s+II\s+OR[CÇ]AMENTO DA ADMINISTRA[CÇ][AÃ]O/i.test(raw)
        );
      }
    },
    {
      id: "relacao-itens",
      label: "Relação dos Itens (OCR / tabela em imagem)",
      family: "classico",
      split: "splitRelacaoItensBlocks",
      minItems: 1,
      priority: 80,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /RELA[CÇ][AÃ]O\s+DOS\s+ITENS/i.test(raw) ||
          (/COTA\s+RESERVADA/i.test(raw) &&
            /\b\d{1,4}\s+\d{1,3}(?:\.\d{3})*,\d{3}\s+(?:UN|UND)\b/i.test(raw))
        );
      }
    },
    {
      id: "castro",
      label: "Castro — portal cotas Exclusivo/Ampla",
      family: "classico",
      split: "splitCastroBlocks",
      minItems: 2,
      priority: 90,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /Exclusivo\s+ME\/?EPP\/?MEI|Ampla\s+Concorr/i.test(raw) ||
          /Exclusivo[\s\S]{0,80}ME\/?EPP\/?MEI|Ampla[\s\S]{0,80}Concorr/i.test(raw)
        );
      }
    },
    {
      id: "sao-mateus",
      label: "São Mateus do Sul — Elotech LOTE+ITEM+R$",
      family: "elotech",
      split: "splitSaoMateusBlocks",
      minItems: 2,
      priority: 100,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /LOTE\s+ITEM\s+DESCRI[CÇ][AÃ]O\s+DO\s+OBJETO\s+UND\s+QTD/i.test(raw) ||
          (/S[aã]o\s+Mateus\s+do\s+Sul/i.test(raw) &&
            /(?:PCT|POTE|UND)\s+\d{2,}\s+R\$\s*[\d.,]+\s+R\$/i.test(raw))
        );
      }
    },
    {
      id: "contenda",
      label: "Contenda — Elotech UND R$ / QTD R$",
      family: "elotech",
      split: "splitContendaBlocks",
      minItems: 2,
      priority: 110,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /ITEM\s+DESCRI[CÇ][AÃ]O\s+UNIDADE\s+QUANTIDADE/i.test(raw) ||
          (/(?:Munic[ií]pio de Contenda|CONTENDA\/PR)/i.test(raw) &&
            /\b(?:PAR|UN|UND)\s+R\$\s*[\d.,]+\s+\d{1,5}\s+R\$\s*[\d.,]+/i.test(raw))
        );
      }
    },
    {
      id: "tres-barras",
      label: "Três Barras do Paraná — ITEM/PRODUTO/UND",
      family: "elotech",
      split: "splitTresBarrasBlocks",
      minItems: 2,
      priority: 120,
      tryWithoutHint: true,
      hint: function (raw) {
        return (
          /ITEM\s+PRODUTO\s+UND\.?\s*QTDE\.?\s*UNIT/i.test(raw) ||
          (/Tr[eê]s\s+Barras\s+do\s+Paran[aá]/i.test(raw) &&
            /\b(?:UND\.?|M)\s+\d{1,5}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,3}(?:\.\d{3})*,\d{2}/i.test(
              raw
            ))
        );
      }
    },
    {
      id: "theo",
      label: "THEO / compras (Pinhalão e similares)",
      family: "classico",
      split: "splitTheoBlocks",
      minItems: 2,
      priority: 200,
      /** Sem hint: sempre tentado depois dos layouts com sinal. */
      always: true,
      tryWithoutHint: false,
      hint: function () {
        return false;
      }
    },
    {
      id: "planilha-classica",
      label: "Planilha clássica (linha a linha)",
      family: "classico",
      split: "splitChunkPlanilha",
      minItems: 1,
      priority: 900,
      classic: true,
      tryWithoutHint: false,
      hint: function () {
        return false;
      }
    }
  ];

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
    last: function () {
      return LICSYSTEM.captacao.lastModelo || null;
    },
    labelOf: function (id) {
      var m = LICSYSTEM.captacao.modelos.get(id);
      return m ? m.label : "";
    }
  };

  bag._modelos = MODELOS;
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
