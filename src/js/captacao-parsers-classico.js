/* LICSYSTEM — parsers / clássico · THEO · Castro · planilha */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

  bag.installClassico = function (deps) {
    var limparPagina = deps.limparPagina;
    var pushParsed = deps.pushParsed;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;
    var EDITAL_COTAS_TXT = deps.EDITAL_COTAS_TXT;
    var RE_EDITAL_HEAD = deps.RE_EDITAL_HEAD;
    var RE_EDITAL_THEO_HEAD = deps.RE_EDITAL_THEO_HEAD;
    var RE_INICIO_SPEC_EDITAL = deps.RE_INICIO_SPEC_EDITAL;

    function splitRelacaoItensBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!t) return [];
      var hint =
        /RELA[CÇ][AÃ]O\s+DOS\s+ITENS/i.test(t) ||
        /COTA\s+RESERVADA/i.test(t) ||
        /\b\d{1,4}\s+\d{1,3}(?:\.\d{3})*,\d{3}\s+(?:UN|UND|Unid\.?)\b/i.test(t);
      if (!hint) return [];

      var region = t;
      var headM = /RELA[CÇ][AÃ]O\s+DOS\s+ITENS|Pre[cç]o\s+Unit[aá]rio/i.exec(t);
      if (headM) region = t.slice(Math.max(0, headM.index - 40));
      var endM = region.search(
        /Total\s+Geral|\(?Valores\s+expressos|ANEXO\s*0?2\b|MODELO\s+DE\s+PROPOSTA/i
      );
      if (endM > 60) region = region.slice(0, endM + 40);

      var flat = region
        .replace(/\u00AD/g, "")
        // OCR: confusões comuns
        .replace(/\bO(?=,|\d)/g, "0")
        .replace(/\s+/g, " ")
        .trim();
      if (!flat) return [];

      var reItem = new RegExp(
        "\\b(\\d{1,4})\\s+" +
          "(\\d{1,3}(?:\\.\\d{3})*,\\d{3}|\\d+,\\d{3})\\s+" +
          "(UN|UND|Unid\\.?)\\s+" +
          "(.+?)\\s+" +
          "(\\d{1,3}(?:\\.\\d{3})*,\\d{2,4}|\\d+,\\d{2,4})\\s+" +
          "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})" +
          "(?=\\s+(?:\\d{1,4}\\s+\\d|\\(?Valores|Total\\s+Geral|$))",
        "gi"
      );

      var out = [];
      var m;
      while ((m = reItem.exec(flat)) !== null) {
        var qtd = utils.parseBrNum(m[2]);
        var vu = utils.parseBrNum(m[5]);
        var vt = utils.parseBrNum(m[6]);
        var desc = String(m[4] || "")
          .replace(/\bN[ºo°]\s*Quantidade\s*Unid\.?[\s\S]{0,80}?Total\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (!(qtd > 0) || !desc || desc.length < 8) continue;
        // Mantém COTA RESERVADA/PRINCIPAL (enxugar cortaria no " - ")
        var descClean = desc;
        var shortCota = desc.match(
          /^(.{8,120}?\bCOTA\s+(?:RESERVADA|PRINCIPAL))\b/i
        );
        if (shortCota) {
          descClean = shortCota[1].replace(/\s+/g, " ").trim();
          var btu = (desc.match(/(\d{1,3}(?:\.\d{3})?)\s*BTUs?/i) || [])[1];
          if (btu && descClean.indexOf("BTU") === -1) {
            descClean += ". " + btu + " BTUs";
          }
        } else {
          descClean = utils.enxugarDescricaoEdital(desc);
          if (!descClean || descClean.length < 8) descClean = desc;
        }

        var packed = {
          lote: String(m[1]),
          qtd: qtd,
          und: "UN",
          produto: descClean,
          editalVunit: vu,
          editalTotal: vt || (vu && qtd ? vu * qtd : 0),
          line: ""
        };
        packed.line =
          packed.lote +
          " " +
          (Math.round(qtd * 1000) / 1000).toLocaleString("pt-BR", {
            minimumFractionDigits: 3,
            maximumFractionDigits: 3
          }) +
          " UN " +
          packed.produto;
        if (packed.editalVunit > 0) {
          packed.line +=
            " " +
            packed.editalVunit.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 4
            });
          if (packed.editalTotal > 0) {
            packed.line +=
              " " +
              packed.editalTotal.toLocaleString("pt-BR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              });
          }
        }
        if (utils.isLinhaProdutoEdital(packed)) out.push(packed);
      }
      return out;
    }

    function splitTheoBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var reStart = new RegExp(
        "(^|\\n)\\s*(\\d{1,5})\\s+(" + EDITAL_UNDS + ")\\s+",
        "gi"
      );
      var starts = [];
      var m;
      while ((m = reStart.exec(t)) !== null) {
        var pos = m.index + (m[1] ? m[1].length : 0);
        // ignora números de página / processo colados sem unidade real
        starts.push(pos);
      }
      if (starts.length < 2) return [];

      var out = [];
      for (var i = 0; i < starts.length; i++) {
        var end = i + 1 < starts.length ? starts[i + 1] : t.length;
        var chunk = t.slice(starts[i], end).replace(/\s+/g, " ").trim();
        pushParsed(out, chunk);
      }
      return out;
    }

    function cutAfterLastEditalPrices(chunk) {
      chunk = String(chunk || "");
      var re =
        /(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})(?=\s|$)/g;
      var last = null;
      var m;
      while ((m = re.exec(chunk)) !== null) {
        // Cód tipo 18.223 / 36.535 (milhar com ponto, sem centavos)
        if (/^\d{1,3}(\.\d{3})+$/.test(m[1])) {
          // Libera o 2º número p/ formar o par real (ex.: 24,28 1.092,60)
          re.lastIndex = m.index + 1;
          continue;
        }
        last = m;
      }
      if (!last) return chunk.trim();
      return chunk.slice(0, last.index + last[0].length).trim();
    }

    function normalizeCastroItemChunk(chunk) {
      chunk = String(chunk || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!chunk) return "";

      if (/^\d{1,5}\s+(?:Exclusivo|Ampla)\b/i.test(chunk)) return chunk;

      var QTD =
        "(\\d{1,3}(?:\\.\\d{3})+,\\d{3}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)";
      var UND = "(" + EDITAL_UNDS + ")";
      var COD = "((?:\\d{1,3}(?:\\.\\d{3})+|\\d{1,6}))";
      var m;
      var qtd;
      var und;
      var cod;
      var rest;
      var descExtra;
      var qm;

      function packCotas(itemNo, cotasLabel, body, extraDesc) {
        qm = body.match(
          new RegExp("^" + QTD + "\\s+" + UND + "\\s+(?:" + COD + "\\s+)?([\\s\\S]+)$", "i")
        );
        if (qm) {
          qtd = qm[1];
          und = qm[2].toUpperCase();
          cod = qm[3] || "";
          rest = String(qm[4] || "").trim();
          descExtra = String(extraDesc || "").trim();
          if (descExtra) {
            // Evita duplicar se a descrição já veio no restante
            var foldExtra = utils.fold(descExtra).toLowerCase().slice(0, 24);
            var foldRest = utils.fold(rest).toLowerCase();
            if (foldExtra && foldRest.indexOf(foldExtra) === -1) {
              rest = (descExtra + " " + rest).replace(/\s+/g, " ").trim();
            }
          }
          return (
            itemNo +
            " " +
            cotasLabel +
            " " +
            qtd +
            " " +
            und +
            " " +
            (cod ? cod + " " : "") +
            rest
          ).replace(/\s+/g, " ").trim();
        }
        return (
          itemNo +
          " " +
          cotasLabel +
          (extraDesc ? " " + extraDesc : "") +
          " " +
          body
        )
          .replace(/\s+/g, " ")
          .trim();
      }

      // Exclusivo N ME/EPP/MEI ...
      m = chunk.match(/^Exclusivo\s+(\d{1,5})\s+ME\/?EPP\/?MEI\s+(.+)$/i);
      if (m) return packCotas(m[1], "Exclusivo ME/EPP/MEI", m[2], "");

      // Exclusivo N <desc> ME/EPP/MEI ...
      m = chunk.match(/^Exclusivo\s+(\d{1,5})\s+(.+?)\s+ME\/?EPP\/?MEI\s+(.+)$/i);
      if (m) return packCotas(m[1], "Exclusivo ME/EPP/MEI", m[3], m[2]);

      // Exclusivo <desc> N ME/EPP/MEI ...
      m = chunk.match(/^Exclusivo\s+(.+?)\s+(\d{1,5})\s+ME\/?EPP\/?MEI\s+(.+)$/i);
      if (m) return packCotas(m[2], "Exclusivo ME/EPP/MEI", m[3], m[1]);

      // Ampla N Concorrência ...
      m = chunk.match(/^Ampla\s+(\d{1,5})\s+Concorr[eê]ncia\s+(.+)$/i);
      if (m) return packCotas(m[1], "Ampla Concorrência", m[2], "");

      // Ampla N <desc> Concorrência ...  |  Ampla <desc> N Concorrência ...
      m = chunk.match(/^Ampla\s+(\d{1,5})\s+(.+?)\s+Concorr[eê]ncia\s+(.+)$/i);
      if (m) return packCotas(m[1], "Ampla Concorrência", m[3], m[2]);

      m = chunk.match(/^Ampla\s+(.+?)\s+(\d{1,5})\s+Concorr[eê]ncia\s+(.+)$/i);
      if (m) return packCotas(m[2], "Ampla Concorrência", m[3], m[1]);

      return chunk;
    }

    function splitCastroBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var flat = t.replace(/\s+/g, " ").trim();
      if (!flat) return [];

      var QTD_RE =
        "(\\d{1,3}(?:\\.\\d{3})+,\\d{3}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)";
      var starts = [];
      var m;

      // 1) Layout canônico: N Exclusivo|Ampla ... QTD UND
      var reCanonical = new RegExp(
        "(?:^|\\s)(\\d{1,5})\\s+(?:" +
          EDITAL_COTAS_TXT +
          ")\\s+" +
          QTD_RE +
          "\\s+(" +
          EDITAL_UNDS +
          ")\\s+",
        "gi"
      );
      while ((m = reCanonical.exec(flat)) !== null) {
        var posCan = m.index;
        if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") posCan = m.index + 1;
        starts.push(posCan);
      }

      // 2) Layout pdf.js: cotas (Exclusivo|Ampla) antes do número do item
      if (starts.length < 2) {
        var rePdfJs = /(?:^|\s)(Exclusivo|Ampla)\b/gi;
        while ((m = rePdfJs.exec(flat)) !== null) {
          var posPj = m.index;
          if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") posPj = m.index + 1;
          starts.push(posPj);
        }
      }

      if (starts.length < 2) return [];

      // índices únicos ordenados
      starts.sort(function (a, b) {
        return a - b;
      });
      var uniqStarts = [];
      for (var u = 0; u < starts.length; u++) {
        if (!uniqStarts.length || starts[u] - uniqStarts[uniqStarts.length - 1] > 8) {
          uniqStarts.push(starts[u]);
        }
      }
      starts = uniqStarts;

      var out = [];
      for (var i = 0; i < starts.length; i++) {
        var end = i + 1 < starts.length ? starts[i + 1] : flat.length;
        var chunk = flat.slice(starts[i], end).trim();
        // Remove rodapé / notas coladas após o último preço do item
        chunk = chunk
          .replace(/\s+Soma:[\s\S]*$/i, "")
          .replace(/\s+Destaco:[\s\S]*$/i, "")
          .trim();

        // Corta lixo após o último par de preços reais (não confundir Cód 18.223 com unitário)
        chunk = cutAfterLastEditalPrices(chunk);

        chunk = normalizeCastroItemChunk(chunk);
        pushParsed(out, chunk);
      }
      return out;
    }

    function cortarPorIndices(chunk, starts) {
      starts.sort(function (a, b) {
        return a - b;
      });
      var uniq = [];
      for (var i = 0; i < starts.length; i++) {
        if (i === 0 || starts[i] - uniq[uniq.length - 1] > 12) uniq.push(starts[i]);
      }
      var out = [];
      for (var j = 0; j < uniq.length; j++) {
        var end = j + 1 < uniq.length ? uniq[j + 1] : chunk.length;
        out.push(chunk.slice(uniq[j], end).trim());
      }
      return out;
    }

    function splitChunkPlanilha(chunk) {
      chunk = limparPagina(chunk);
      if (!chunk) return [];

      var direto = utils.parseLinhaEdital(chunk);
      if (direto && utils.isLinhaProdutoEdital(direto)) return [direto];

      var QTD_RE =
        "(\\d{1,3}(?:\\.\\d{3})+,\\d{3}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)";
      var starts = [];
      var portalRanges = [];
      var m;

      // Portal Castro: ITEM + Cotas textuais + QTDE + UND
      var reCastro = new RegExp(
        "(?:^|\\s)(\\d{1,5})\\s+(?:" +
          EDITAL_COTAS_TXT +
          ")\\s+" +
          QTD_RE +
          "\\s+(" +
          EDITAL_UNDS +
          ")\\s+",
        "gi"
      );
      while ((m = reCastro.exec(chunk)) !== null) {
        var posC = m.index;
        if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") posC = m.index + 1;
        starts.push(posC);
        portalRanges.push({ start: posC, end: m.index + m[0].length });
      }

      // Portal: ITEM COTAS QTDE UND  (evita tratar Cotas como início de item)
      var rePortal = new RegExp(
        "(?:^|\\s)(\\d{1,5})\\s+(\\d+|[-–])\\s+" + QTD_RE + "\\s+(" + EDITAL_UNDS + ")\\s+",
        "gi"
      );
      while ((m = rePortal.exec(chunk)) !== null) {
        var posP = m.index;
        if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") posP = m.index + 1;
        starts.push(posP);
        portalRanges.push({ start: posP, end: m.index + m[0].length });
      }

      var reStart = new RegExp(
        "(?:^|\\s)(\\d{1,5})\\s+" + QTD_RE + "\\s+(" + EDITAL_UNDS + ")\\s+",
        "gi"
      );
      while ((m = reStart.exec(chunk)) !== null) {
        var pos = m.index;
        if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") pos = m.index + 1;
        var insidePortal = false;
        for (var pr = 0; pr < portalRanges.length; pr++) {
          if (pos > portalRanges[pr].start && pos < portalRanges[pr].end) {
            insidePortal = true;
            break;
          }
        }
        if (insidePortal) continue;
        if (starts.indexOf(pos) === -1) starts.push(pos);
      }

      if (starts.length < 2) {
        var reParen = /(?:^|\s)(\d{2,5})\s*[\)\.]\s*[-–]\s+/g;
        while ((m = reParen.exec(chunk)) !== null) {
          var p2 = m.index;
          if (m[0].charAt(0) === " ") p2 = m.index + 1;
          starts.push(p2);
        }
      }

      if (starts.length < 2) {
        if (starts.length === 1) {
          var solo = chunk.slice(starts[0]).trim();
          var fs = utils.parseLinhaEdital(solo);
          if (fs && utils.isLinhaProdutoEdital(fs)) return [fs];
        }
        return [];
      }

      var partes = cortarPorIndices(chunk, starts);
      var fmtParts = [];
      for (var i = 0; i < partes.length; i++) pushParsed(fmtParts, partes[i]);
      return fmtParts;
    }

    deps.splitRelacaoItensBlocks = splitRelacaoItensBlocks;
    deps.splitTheoBlocks = splitTheoBlocks;
    deps.splitCastroBlocks = splitCastroBlocks;
    deps.splitChunkPlanilha = splitChunkPlanilha;
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
