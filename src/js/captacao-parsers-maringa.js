/* LICSYSTEM — parsers / Maringá · Campo do Tenente */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

  bag.installMaringa = function (deps) {
    var limparPagina = deps.limparPagina;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;

    function splitMaringaBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!t) return [];

      var headRe =
        /\b(?:AMPLA|COTA|EXCLUSIVO)\s+(?:\b(?:MASCULINO|FEMININO)\s+)?\d{1,3}\s+\d{5,7}\s+\d{5,7}\s+\d+\s+Unid/i;
      var headM = headRe.exec(t);
      if (!headM) {
        headRe =
          /\b\d{1,3}\s+\d{5,7}\s+\d{5,7}\s+\d+\s+Unid\.?\s+(?:MASCULINO|FEMININO)?\s*\d{1,3}(?:\.\d{3})*,\d{2}/i;
        headM = headRe.exec(t);
      }
      if (!headM) return [];

      var from = Math.max(0, headM.index - 200);
      var region = t.slice(from);
      var endM = region.search(
        /O valor total estimado da Licita|O valor total dos itens para ampla concorr/i
      );
      if (endM > 40) region = region.slice(0, endM);

      var flat = region.replace(/\s+/g, " ").trim();
      if (!flat) return [];

      // Item + PMM + CATMAT + qtd + Unid. + (sexo opcional) + unitário + total
      var reItem =
        /\b(?:(AMPLA|COTA|EXCLUSIVO)\s+)?(?:(MASCULINO|FEMININO)\s+)?(\d{1,3})\s+(\d{5,7})\s+(\d{5,7})\s+(\d+(?:[.,]\d+)?)\s+Unid\.?\s+(?:(MASCULINO|FEMININO)\s+)?(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi;

      var matches = [];
      var m;
      while ((m = reItem.exec(flat)) !== null) {
        matches.push({
          index: m.index,
          end: m.index + m[0].length,
          cotaRaw: m[1] || "",
          sexBefore: m[2] || "",
          itemNo: m[3],
          qtdRaw: m[6],
          sexAfter: m[7] || "",
          unitRaw: m[8],
          totalRaw: m[9]
        });
      }
      if (matches.length < 2) return [];

      var out = [];
      for (var i = 0; i < matches.length; i++) {
        var cur = matches[i];
        var winStart = i === 0 ? 0 : matches[i - 1].end;
        var winEnd =
          i + 1 < matches.length
            ? matches[i + 1].index
            : Math.min(flat.length, cur.end + 180);
        var win = flat.slice(winStart, winEnd);

        var cota = String(cur.cotaRaw || "").toUpperCase();
        if (!cota) {
          var cotaM = /\b(AMPLA|COTA|EXCLUSIVO)\b/i.exec(win);
          if (cotaM) cota = cotaM[1].toUpperCase();
        }
        if (cota === "COTA" || cota === "EXCLUSIVO") cota = cota + " ME/EPP";

        var sex =
          cur.sexAfter ||
          cur.sexBefore ||
          ((/\b(MASCULINO|FEMININO)\b/i.exec(win) || [])[1] || "");
        var tam = ((/TAMANHO\s*\.?\s*(PP|P|M|G|GG)\b/i.exec(win) || [])[1] || "").toUpperCase();

        var descBits = [];
        if (/COLETE/i.test(win) || /BAL[IÍ]STICO/i.test(win)) {
          descBits.push(
            /BAL[IÍ]STICO\s*\./i.test(win)
              ? "COLETE BALÍSTICO. NÍVEL III-A. MODELO"
              : "COLETE BALÍSTICO - NÍVEL III-A, MODELO"
          );
        }
        if (sex) descBits.push(String(sex).toUpperCase());
        if (/OPERACIONAL/i.test(win)) descBits.push("OPERACIONAL TIPO MILITAR");
        if (/COR\s+PRETA/i.test(win)) descBits.push("COR PRETA");
        if (tam) descBits.push("TAMANHO " + tam);
        var desc = descBits.join(" ").replace(/\s+/g, " ").trim();
        if (!desc) {
          desc = win
            .replace(/\b(?:AMPLA|COTA|EXCLUSIVO|ME\/?EPP)\b/gi, " ")
            .replace(/\b\d{1,3}\s+\d{5,7}\s+\d{5,7}\s+\d+(?:[.,]\d+)?\s+Unid\.?/gi, " ")
            .replace(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/g, " ")
            .replace(/\s+/g, " ")
            .trim();
        }
        if (cota) desc = (desc + " [" + cota + "]").trim();

        var qtd = utils.parseBrNum(cur.qtdRaw);
        var vu = utils.parseBrNum(cur.unitRaw);
        var vt = utils.parseBrNum(cur.totalRaw);
        if (!(qtd > 0) || !desc || desc.length < 3) continue;

        var packed = {
          lote: String(cur.itemNo),
          qtd: qtd,
          und: "UN",
          produto: desc,
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
          " " +
          packed.und +
          " " +
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

    function splitCampoTenenteBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!t) return [];

      if (
        !/Lote:\s*\d+\s*-\s*Lote\s*\d+/i.test(t) &&
        !(/Campo\s+do\s+Tenente/i.test(t) && /C[oó]digo\s+do\s+produto/i.test(t))
      ) {
        return [];
      }

      // Só o TR com preços (evita ANEXO 1 descrição detalhada sem valores)
      var startM = t.search(/Lote:\s*1\s*-\s*Lote\s*001/i);
      var region = startM >= 0 ? t.slice(startM) : t;
      var endM = region.search(
        /\n\s*ANEXO\s*1\s*[–-]\s*DESCRI[CÇ][AÃ]O\s+DETALHADA|\n\s*ANEXO\s+II\b|\n\s*ANEXO\s+2\b/i
      );
      if (endM > 80) region = region.slice(0, endM);

      var flat = region
        .replace(/\u00AD/g, "")
        // Captação: "340,0 PA 94,62 32.170,80 … 0 R" → "340,00 PAR 94,62 32.170,80"
        .replace(
          /(\d+),(\d)\s+PA\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})([\s\S]{0,160}?)\b0\s+R\b/gi,
          "$1,$20 PAR $3 $4 "
        )
        // Captação: "32,00 PA … R" (zero já na qtd)
        .replace(
          /(\d+,\d{2})\s+PA\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})([\s\S]{0,160}?)\bR\b/gi,
          "$1 PAR $2 $3 "
        )
        // Captação: "5,00 PC … T 16,23" ou "PC T"
        .replace(/\bPC\s+T\b/gi, "PCT")
        .replace(
          /(\d+,\d{2})\s+PC\s+(?=\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/gi,
          "$1 PCT "
        )
        .replace(/\bPA\s+R\b/gi, "PAR")
        .replace(/\bUN\s+I\s+D\b/gi, "UN")
        // 2.625\n,00 → 2.625,00
        .replace(/(\d{1,3}(?:\.\d{3})*)\s*,\s*(\d{2})\b/g, "$1,$2")
        // 340,0\n0 → 340,00 (quando ainda restar)
        .replace(
          /(\d+,\d)\s+(\d)\s+(?=(?:UN|PAR|CX|PCT|UND|PC|P[ÇC]|KIT|CJ|Unid)\b)/gi,
          "$1$2 "
        )
        // AMPLA CONCORRENCIA colado na qtd (lote 38)
        .replace(/\bAMPLA\s+CONCORR[EÊ]NCIA\s+/gi, "")
        .replace(/\s+/g, " ")
        .trim();
      if (!flat) return [];

      var undAlt = EDITAL_UNDS + "|PA|PC";
      var parts = flat.split(/(?=Lote:\s*\d+\s*-\s*Lote\s*\d+)/i);
      var out = [];

      for (var pi = 0; pi < parts.length; pi++) {
        var part = parts[pi];
        var mL = /Lote:\s*(\d+)\s*-\s*Lote\s*\d+/i.exec(part);
        if (!mL) continue;
        var loteNo = mL[1];

        // qtd: 20,00 | 340,0 | 2.625 (milhar sem decimal, Captação lote 38)
        var reAnchor = new RegExp(
          "(\\d{1,3}(?:\\.\\d{3})+(?!,)|\\d{1,3}(?:\\.\\d{3})*,\\d{1,2}|\\d+,\\d{1,2})\\s+" +
            "(" +
            undAlt +
            ")\\s+" +
            "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})\\s+" +
            "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})",
          "gi"
        );
        var anchors = [];
        var am;
        while ((am = reAnchor.exec(part)) !== null) {
          anchors.push({
            index: am.index,
            end: am.index + am[0].length,
            qtdRaw: am[1],
            und: String(am[2] || "UN").toUpperCase().replace(/\.$/, ""),
            unitRaw: am[3],
            totalRaw: am[4]
          });
        }
        if (!anchors.length) continue;
        // Prefere âncora cujo total ≈ qtd × unitário (evita números da especificação)
        var best = anchors[anchors.length - 1];
        var bestScore = -1;
        for (var ai = 0; ai < anchors.length; ai++) {
          var aq = utils.parseBrNum(anchors[ai].qtdRaw);
          var au = utils.parseBrNum(anchors[ai].unitRaw);
          var at = utils.parseBrNum(anchors[ai].totalRaw);
          var score = 1;
          if (aq > 0 && au > 0 && at > 0) {
            var expect = aq * au;
            var rel =
              Math.abs(expect - at) / Math.max(Math.abs(at), Math.abs(expect), 1);
            if (rel <= 0.02) score = 100;
            else if (rel <= 0.08) score = 50;
            else score = 5;
          }
          if (score >= bestScore) {
            bestScore = score;
            best = anchors[ai];
          }
        }

        var before = part.slice(0, best.index);
        // Remove cabeçalho da tabela
        before = before
          .replace(/^Lote:\s*\d+\s*-\s*Lote\s*\d+\s*/i, "")
          .replace(
            /Ite\s*m\s+C[oó]digo[\s\S]{0,220}?Pre[cç]o\s+m[aá]ximo\s+total\s*/i,
            ""
          )
          .replace(/\bAMPLA\s+CONCORR[EÊ]NCIA\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();

        var head = /\b1\s+(\d{4,7})\s+(.+)$/i.exec(before);
        var code = head ? head[1] : "";
        var desc = head ? head[2] : before;
        desc = desc
          .replace(/^Especifica[cç][aã]o\s+T[eé]\s*cnica\s+(?:de\s+)?/i, "")
          .replace(/\s+Especifica[cç][aã]o\s+T[eé]\s*cnica[\s\S]*$/i, "")
          .replace(/\s+Especif[\s\S]*$/i, "")
          .replace(/^T[eé]\s*cnica\s+de\s+/i, "")
          .replace(/\s+/g, " ")
          .trim();
        // Recupera nome se o PDF cortou "Especificação" → ficou "Técnica de …"
        if (!desc || desc.length < 3 || /^T[eé]\s*cnica\b/i.test(desc)) {
          var fromSpec =
            /Especifica[cç][aã]o\s+T[eé]\s*cnica\s+(?:de\s+)?(.+?)(?:\s+Objeto:|$)/i.exec(
              part
            );
          if (fromSpec) desc = fromSpec[1].replace(/\s+/g, " ").trim();
        }
        if (!(utils.parseBrNum(best.qtdRaw) > 0) || !desc || desc.length < 3) continue;

        var qtd = utils.parseBrNum(best.qtdRaw);
        var vu = utils.parseBrNum(best.unitRaw);
        var vt = utils.parseBrNum(best.totalRaw);
        var und = String(best.und || "UN").toUpperCase().replace(/\.$/, "");
        if (und === "UNID" || und === "UND") und = "UN";
        if (und === "PA") und = "PAR";
        if (und === "PC") und = "PCT";
        // Se qtd veio com 1 casa (340,0) e total fecha com ×10, completa o zero
        if (qtd > 0 && vu > 0 && vt > 0) {
          var rel1 = Math.abs(qtd * vu - vt) / Math.max(vt, 1);
          var rel10 = Math.abs(qtd * 10 * vu - vt) / Math.max(vt, 1);
          if (rel1 > 0.02 && rel10 <= 0.02) qtd = qtd * 10;
        }
        var descClean = utils.enxugarDescricaoEdital(desc);
        if (!descClean || descClean.length < 3) descClean = desc;

        var packed = {
          lote: String(loteNo),
          qtd: qtd,
          und: und,
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
          " " +
          packed.und +
          " " +
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

    deps.splitMaringaBlocks = splitMaringaBlocks;
    deps.splitCampoTenenteBlocks = splitCampoTenenteBlocks;
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
