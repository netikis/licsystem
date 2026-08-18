/* LICSYSTEM — parsers / Elotech (S. Mateus · Contenda · Três Barras) */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

  /**
   * Instala splitters Elotech no bag (fecha sobre limparPagina / utils / EDITAL_UNDS).
   */
  bag.installElotech = function (deps) {
    var limparPagina = deps.limparPagina;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;

    function splitSaoMateusBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!t) return [];

      var headRe =
        /LOTE\s+ITEM\s+DESCRI[CÇ][AÃ]O\s+DO\s+OBJETO\s+UND\s+QTD\s+Unit[aá]rio\s+Total/i;
      var headM = headRe.exec(t);
      var region = t;
      if (headM) {
        region = t.slice(headM.index + headM[0].length);
      } else if (!/(?:PCT|POTE|UND)\s+\d{2,}\s+R\$\s*[\d.,]+\s+R\$/i.test(t)) {
        return [];
      }

      var endM = region.search(
        /\n\s*Valor\s+total\s+R\$|"Geral"\s*:|ANEXO\s+II\b/i
      );
      if (endM > 40) region = region.slice(0, endM);

      var flat = region
        .replace(/\b\d{1,5}\s+Geral\b/gi, " ")
        .replace(/\bBenef[ií]cio\s+para\s+MPE\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!flat) return [];

      var undAlt = EDITAL_UNDS;
      var reAnchor = new RegExp(
        "\\b(" +
          undAlt +
          ")\\s+(\\d{1,3}(?:\\.\\d{3})+|\\d{2,})\\s+R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})\\s+R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})",
        "gi"
      );

      var anchors = [];
      var m;
      while ((m = reAnchor.exec(flat)) !== null) {
        anchors.push({
          undIndex: m.index,
          end: m.index + m[0].length,
          und: m[1].toUpperCase(),
          qtdRaw: m[2],
          unitRaw: m[3],
          totalRaw: m[4]
        });
      }
      if (anchors.length < 2) return [];

      function findItemNo(before, expected) {
        var reNum = /\b(\d{1,5})\b/g;
        var cands = [];
        var nm;
        while ((nm = reNum.exec(before)) !== null) {
          var n = parseInt(nm[1], 10);
          if (n >= 1 && n <= 999) cands.push({ n: n, idx: nm.index, len: nm[1].length });
        }
        if (!cands.length) return { n: expected, idx: before.length, len: 0 };
        for (var i = cands.length - 1; i >= 0; i--) {
          if (cands[i].n === expected) return cands[i];
        }
        // Prefere número perto do UND (últimos 80 chars)
        var near = [];
        var base = Math.max(0, before.length - 80);
        for (var j = 0; j < cands.length; j++) {
          if (cands[j].idx >= base) near.push(cands[j]);
        }
        if (near.length) return near[near.length - 1];
        return cands[cands.length - 1];
      }

      var out = [];
      var expected = 1;
      for (var a = 0; a < anchors.length; a++) {
        var prevEnd = a === 0 ? 0 : anchors[a - 1].end;
        var before = flat.slice(prevEnd, anchors[a].undIndex);
        var itemInfo = findItemNo(before, expected);
        var itemNo = itemInfo.n;
        expected = itemNo + 1;

        var leading = before.slice(0, itemInfo.idx).trim();
        var between = before.slice(itemInfo.idx + itemInfo.len).trim();

        // Nome do produto: última inicial maiúscula “forte” perto do fim
        // (ignora restos do item anterior e maiúsculas no meio da especificação).
        function pickProductStart(lead) {
          lead = String(lead || "").replace(/\s+/g, " ").trim();
          if (!lead) return "";
          var noise =
            /^(ABIC|Embalagem|Produto|Nota|Pacote|CESTAS?|Benef[ií]cio|Valor|Geral|Unidade|Leguminosa|validade|Tipo|No\.?|N[ºo]|Rua|CEP|O)\b/i;
          var midSpec =
            /^(Proveniente|Composto|Beneficiado|Enriquecido|Isento|Polido|Torrado|Mo[ií]do|Aproximado|Emulsificante|Aromatizante|Tradicional|Superior|Selado|Qualidade|Sensorial|Longo|Fino|Pacotes?|Certifica|Índice|Pureza|Homog[eê]neo)\b/i;
          // Janela inteira: specs longas (ex. café/ABIC) empurram o nome para fora
          // se cortarmos só os últimos N caracteres.
          var best = -1;
          var reCap = /(?:^|\s)([A-ZÁÀÂÃÉÊÍÓÔÚÇ][A-Za-zÀ-ÿ]{2,})/g;
          var cm;
          while ((cm = reCap.exec(lead)) !== null) {
            if (noise.test(cm[1]) || midSpec.test(cm[1])) continue;
            best = cm.index + (cm[0].charAt(0) === " " ? 1 : 0);
          }
          return best >= 0 ? lead.slice(best).trim() : lead;
        }

        var desc = (pickProductStart(leading) + " " + between)
          .replace(/\bQtd\.?\s*de\s*cesta\b/gi, " ")
          .replace(/\bpara\s+MPE\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();

        // Remove restos de cabeçalho colados no 1º item
        if (a === 0) {
          desc = desc
            .replace(/^[\s\S]*?\bCESTAS?\s+B[AÁ]SICAS\b\s*/i, "")
            .replace(/^\s*Valor\s+estimado\b\s*/i, "")
            .trim();
          desc = pickProductStart(desc) || desc;
        }

        var qtd = utils.parseBrNum(anchors[a].qtdRaw);
        var vu = utils.parseBrNum(anchors[a].unitRaw);
        var vt = utils.parseBrNum(anchors[a].totalRaw);
        if (!(qtd > 0) || !desc || desc.length < 3) continue;

        var descClean = utils.enxugarDescricaoEdital(desc);
        if (!descClean || descClean.length < 3) descClean = desc;

        var packed = {
          lote: String(itemNo),
          qtd: qtd,
          und: anchors[a].und,
          produto: descClean,
          editalVunit: vu,
          editalTotal: vt || (vu && qtd ? vu * qtd : 0),
          line: ""
        };
        // Monta line canônica
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

    function splitContendaBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!t) return [];

      var headRe = /ITEM\s+DESCRI[CÇ][AÃ]O\s+UNIDADE\s+QUANTIDADE/i;
      var headM = headRe.exec(t);
      var region = t;
      if (headM) {
        region = t.slice(headM.index + headM[0].length);
      } else if (
        !/\b(?:PAR|UN|UND|CX|KIT|PC|PÇ)\s+R\$\s*[\d.,]+\s+\d{1,5}\s+R\$\s*[\d.,]+/i.test(t)
      ) {
        return [];
      }

      // Só a 1ª planilha com preços (evita duplicar a tabela sem R$ / resumo)
      var endM = region.search(
        /\n\s*Valor\s*:\s*R\$|\n\s*2\.\s*FUNDAMENTA|\n\s*10\.\s*ESTIMATIVA|\n\s*ITEM\s+VALOR\s+UNIT[AÁ]RIO\b/i
      );
      var secondHead = region.search(/\n\s*ITEM\s+DESCRI[CÇ][AÃ]O\s+UNIDADE\s+QUANTIDADE/i);
      if (secondHead > 40 && (endM < 0 || secondHead < endM)) endM = secondHead;
      if (endM > 40) region = region.slice(0, endM);

      var flat = region
        .replace(/^\s*UNIT[AÁ]RIO\s+TOTAL\s*/i, "")
        .replace(/\bVALOR\s+VALOR\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!flat) return [];

      var undAlt = EDITAL_UNDS;
      // Contenda: UND R$ unitário QTD R$ total
      var reAnchor = new RegExp(
        "\\b(" +
          undAlt +
          ")\\s+R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})\\s+(\\d{1,5})\\s+R\\$\\s*(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})",
        "gi"
      );

      var anchors = [];
      var m;
      while ((m = reAnchor.exec(flat)) !== null) {
        anchors.push({
          undIndex: m.index,
          end: m.index + m[0].length,
          und: m[1].toUpperCase(),
          unitRaw: m[2],
          qtdRaw: m[3],
          totalRaw: m[4]
        });
      }
      if (anchors.length < 2) return [];

      function findItemNo(before, expected) {
        var reNum = /\b(\d{1,5})\b/g;
        var cands = [];
        var nm;
        while ((nm = reNum.exec(before)) !== null) {
          var n = parseInt(nm[1], 10);
          if (n < 1 || n > 999) continue;
          // Ignora decimais do PDF (9,5 cm / 7,5 cm) e dígitos colados
          var after = before.slice(nm.index + nm[1].length, nm.index + nm[1].length + 2);
          var beforeCh = before.charAt(nm.index - 1);
          if (/^,\d/.test(after)) continue;
          if (beforeCh && /\d/.test(beforeCh)) continue;
          cands.push({ n: n, idx: nm.index, len: nm[1].length });
        }
        if (!cands.length) return { n: expected, idx: before.length, len: 0 };
        // Prefere o esperado perto da UND (últimos 48 chars)
        var base = Math.max(0, before.length - 48);
        for (var i = cands.length - 1; i >= 0; i--) {
          if (cands[i].n === expected && cands[i].idx >= base) return cands[i];
        }
        for (var j = cands.length - 1; j >= 0; j--) {
          if (cands[j].n === expected) return cands[j];
        }
        var near = [];
        for (var k = 0; k < cands.length; k++) {
          if (cands[k].idx >= base) near.push(cands[k]);
        }
        if (near.length) return near[near.length - 1];
        return cands[cands.length - 1];
      }

      function cutPrevResidue(lead) {
        lead = String(lead || "").replace(/\s+/g, " ").trim();
        if (!lead) return "";
        // Só marcadores típicos de FIM de item (não "COR A DEFINIR" no meio da spec)
        var markers =
          /(?:CERTIFICADO DE APROVA[CÇ][AÃ]O\)?\.?|C\.?A\.?\s*\([^)]{0,80}\)\.?|DO\s+\d+\s+AO\s+\d+\.?|todos os tamanhos\.?)/gi;
        var last = 0;
        var mm;
        while ((mm = markers.exec(lead)) !== null) {
          last = mm.index + mm[0].length;
        }
        var cut = lead.slice(last).trim();
        return cut || lead;
      }

      function pickContendaProduct(lead) {
        lead = cutPrevResidue(lead);
        if (!lead) return "";
        var reProd =
          /\b(Botina|Luva|Capa|BON[EÉ]|Bon[eé]|Colete|Uniforme|Jaqueta|Óculos|Oculos|Avental|Camisa|Camiseta|Cal[cç]a|Cal[cç][aã]o|Jortes|Capacete|Protetor|M[aá]scara|Bota|Sapato|Cinto|Vestimenta)\b/gi;
        var matches = [];
        var pm;
        while ((pm = reProd.exec(lead)) !== null) {
          matches.push({ idx: pm.index, word: pm[1] });
        }
        if (matches.length) {
          var last = matches[matches.length - 1];
          // "Uniforme … (Jortes, Calção) / Calça / Camisa" → manter "Uniforme"
          if (/^(Camisa|Camiseta|Cal[cç]a|Cal[cç][aã]o|Jortes)$/i.test(last.word)) {
            for (var bi = matches.length - 2; bi >= 0; bi--) {
              if (
                /^Uniforme$/i.test(matches[bi].word) &&
                last.idx - matches[bi].idx < 72
              ) {
                last = matches[bi];
                break;
              }
            }
          }
          return lead.slice(last.idx).trim();
        }
        // Fallback: primeira maiúscula “forte”
        var noise =
          /^(ABIC|Embalagem|Produto|Nota|Pacote|Benef[ií]cio|Valor|Geral|Unidade|Item|Descri|UNIT|TOTAL|PE|SRP|Tramitado|Assinado|Munic[ií]pio|Contenda|Anexo|TERMO|IDENTIFICA|Processo|Secretaria|Servidor|Data|MODALIDADE|FORMA|DEFINIR|DEFINI|Registro|Bras[aã]o|Quanto|Fio|Gola|Antpelling|Com|Possui|Z[ií]per|EXG)\b/i;
        var midSpec =
          /^(Proveniente|Composto|acolchoado|confeccionad[ao]|interna|componentes|palmilha|sistema|espessura|revestimento|acabamento|resist[eê]ncia|impermeabilidade|faixas?|Manga|Abertura|Coeficiente|Gramatura|Punho|Costura|Prespontada|Material|especialmente|durabilidade|proporcionando|execução|equipamento|biqueira|aproximado)\b/i;
        var reCap = /(?:^|\s)([A-ZÁÀÂÃÉÊÍÓÔÚÇ][A-Za-zÀ-ÿ]{2,})/g;
        var cm;
        while ((cm = reCap.exec(lead)) !== null) {
          if (noise.test(cm[1]) || midSpec.test(cm[1])) continue;
          return lead.slice(cm.index + (cm[0].charAt(0) === " " ? 1 : 0)).trim();
        }
        return lead;
      }

      var out = [];
      var expected = 1;
      for (var a = 0; a < anchors.length; a++) {
        var prevEnd = a === 0 ? 0 : anchors[a - 1].end;
        var before = flat.slice(prevEnd, anchors[a].undIndex);
        var itemInfo = findItemNo(before, expected);
        var itemNo = itemInfo.n;
        expected = itemNo + 1;

        var leading = before.slice(0, itemInfo.idx).trim();
        var between = before.slice(itemInfo.idx + itemInfo.len).trim();
        // Nº do item antes do nome (ex.: "13 Óculos…") → descrição começa em between
        var desc;
        if (
          /^(Botina|Luva|Capa|BON[EÉ]|Bon[eé]|Colete|Uniforme|Jaqueta|Óculos|Oculos|Avental|Camisa|Camiseta|Cal[cç]a|Protetor|M[aá]scara|Vestimenta)\b/i.test(
            between
          )
        ) {
          desc = between;
        } else {
          desc = (pickContendaProduct(leading) + " " + between).replace(/\s+/g, " ").trim();
        }
        desc = desc
          .replace(/\bUNIT[AÁ]RIO\s+TOTAL\b/gi, " ")
          .replace(/^TAMANHOS?\s*[PMGEX,\s.–-]*\.?\s*/i, "")
          .replace(/\s+/g, " ")
          .trim();

        if (a === 0) {
          desc = pickContendaProduct(desc) || desc;
        }

        var qtd = utils.parseBrNum(anchors[a].qtdRaw);
        var vu = utils.parseBrNum(anchors[a].unitRaw);
        var vt = utils.parseBrNum(anchors[a].totalRaw);
        if (!(qtd > 0) || !desc || desc.length < 3) continue;

        var descClean = utils.enxugarDescricaoEdital(desc);
        if (!descClean || descClean.length < 3) descClean = desc;

        var packed = {
          lote: String(itemNo),
          qtd: qtd,
          und: anchors[a].und,
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

    function splitTresBarrasBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!t) return [];

      var headRe = /ITEM\s+PRODUTO\s+UND\.?\s*QTDE\.?\s*UNIT/i;
      var headM = headRe.exec(t);
      var region = t;
      if (headM) {
        region = t.slice(headM.index + headM[0].length);
      } else if (
        !/\b(?:UND\.?|M)\s+\d{1,5}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,3}(?:\.\d{3})*,\d{2}/i.test(
          t
        )
      ) {
        return [];
      }

      // Só o quadro de preços do Anexo I (ignora modelos de proposta sem valores)
      var endM = region.search(/VALOR\s+M[AÁ]XIMO\s+DA\s+LICITA[CÇ][AÃ]O/i);
      if (endM > 40) region = region.slice(0, endM);
      var secondHead = region.search(/\n\s*ITEM\s+QNTD\s+UNID\b/i);
      if (secondHead > 40 && (endM < 0 || secondHead < endM)) {
        region = region.slice(0, secondHead);
      }

      var flat = region
        .replace(/\bVALOR\s+M[AÁ]X\.?\b/gi, " ")
        .replace(/\bM[AÁ]X\.?\b/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!flat) return [];

      var undAlt = EDITAL_UNDS;
      // Três Barras: UND|M  QTD  unitário  total  (sem R$)
      var reAnchor = new RegExp(
        "\\b(" +
          undAlt +
          ")\\.?\\s+(\\d{1,3}(?:\\.\\d{3})+|\\d+)\\s+(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})\\s+(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})",
        "gi"
      );

      var anchors = [];
      var m;
      while ((m = reAnchor.exec(flat)) !== null) {
        anchors.push({
          undIndex: m.index,
          end: m.index + m[0].length,
          und: String(m[1] || "")
            .toUpperCase()
            .replace(/\.$/, ""),
          qtdRaw: m[2],
          unitRaw: m[3],
          totalRaw: m[4]
        });
      }
      if (anchors.length < 2) return [];

      function findItemNo(before, expected) {
        var reNum = /\b(\d{1,5})\b/g;
        var cands = [];
        var nm;
        while ((nm = reNum.exec(before)) !== null) {
          var n = parseInt(nm[1], 10);
          if (n < 1 || n > 999) continue;
          var after = before.slice(
            nm.index + nm[1].length,
            nm.index + nm[1].length + 2
          );
          var beforeCh = before.charAt(nm.index - 1);
          if (/^,\d/.test(after)) continue;
          if (/^\.\d/.test(after)) continue;
          if (beforeCh && /\d/.test(beforeCh)) continue;
          cands.push({ n: n, idx: nm.index, len: nm[1].length });
        }
        if (!cands.length) return { n: expected, idx: before.length, len: 0 };
        var base = Math.max(0, before.length - 80);
        for (var i = cands.length - 1; i >= 0; i--) {
          if (cands[i].n === expected && cands[i].idx >= base) return cands[i];
        }
        for (var j = cands.length - 1; j >= 0; j--) {
          if (cands[j].n === expected) return cands[j];
        }
        var near = [];
        for (var k = 0; k < cands.length; k++) {
          if (cands[k].idx >= base) near.push(cands[k]);
        }
        if (near.length) return near[near.length - 1];
        return cands[cands.length - 1];
      }

      function pickTresBarrasProduct(lead) {
        lead = String(lead || "").replace(/\s+/g, " ").trim();
        if (!lead) return "";
        var reProd =
          /\b(CONJUNTO|BASE\s+PARA|BOCAL|BRA[CÇ]O|CABO|CAIXA|CONECTOR|REFLETOR|CONTACTORA|DISJUNTOR|FIO|GRAMPO|HASTE|L[AÂ]MPADA|FITA|PARAFUSO|POSTE|REATOR|REL[EÉ]|TERMINAL|BARRAMENTO|BORNE)\b/gi;
        var pm = reProd.exec(lead);
        if (pm) return lead.slice(pm.index).trim();
        // Sem lexico: aceita leading “forte”, ignora continuação de frase do item anterior
        if (
          /^(SECUNDARIA|DE\s+NO|NO\s+M[IÍ]NIMO|TUBULAR|AMARELA|PONTAS|FUNCIONAMENTO|VIDA\s+UTIL|GALVANIZADO|DA\s+COR|ALUMINIO|POT[EÊ]NCIA|IDENTIFICA|NTC|A[CÇ]O\s+GALV|COM\s+SELO|GARANTIA|DIMENS)/i.test(
            lead
          )
        ) {
          return "";
        }
        return lead.length > 12 ? lead : "";
      }

      // Pass 1: nº do item (posição absoluta)
      var itemInfos = [];
      var expected = 1;
      for (var a0 = 0; a0 < anchors.length; a0++) {
        var prevEnd0 = a0 === 0 ? 0 : anchors[a0 - 1].end;
        var before0 = flat.slice(prevEnd0, anchors[a0].undIndex);
        var info0 = findItemNo(before0, expected);
        itemInfos.push({
          n: info0.n,
          absIdx: prevEnd0 + info0.idx,
          len: info0.len,
          idxInBefore: info0.idx
        });
        expected = info0.n + 1;
      }

      var out = [];
      for (var a = 0; a < anchors.length; a++) {
        var prevEnd = a === 0 ? 0 : anchors[a - 1].end;
        var before = flat.slice(prevEnd, anchors[a].undIndex);
        var itemInfo = itemInfos[a];
        var itemNo = itemInfo.n;

        var leading = before.slice(0, itemInfo.idxInBefore).trim();
        var between = before.slice(itemInfo.idxInBefore + itemInfo.len).trim();

        var nextItemAbs =
          a + 1 < itemInfos.length ? itemInfos[a + 1].absIdx : flat.length;
        var afterSlice = flat.slice(anchors[a].end, nextItemAbs).trim();
        var nextProd = pickTresBarrasProduct(afterSlice);
        var trailing = afterSlice;
        if (nextProd) {
          var cutAt = afterSlice.indexOf(nextProd);
          if (cutAt >= 0) trailing = afterSlice.slice(0, cutAt).trim();
        }

        var leadProd = pickTresBarrasProduct(leading);
        leading = leadProd || "";

        var desc = (leading + " " + between + " " + trailing)
          .replace(/\s+/g, " ")
          .trim();
        desc = desc.replace(/^(M[AÁ]X\.?|VALOR)\s+/i, "").trim();

        var qtd = utils.parseBrNum(anchors[a].qtdRaw);
        var vu = utils.parseBrNum(anchors[a].unitRaw);
        var vt = utils.parseBrNum(anchors[a].totalRaw);
        if (!(qtd > 0) || !desc || desc.length < 3) continue;

        var descClean = utils.enxugarDescricaoEdital(desc);
        if (!descClean || descClean.length < 3) descClean = desc;

        var packed = {
          lote: String(itemNo),
          qtd: qtd,
          und: anchors[a].und,
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

    deps.splitSaoMateusBlocks = splitSaoMateusBlocks;
    deps.splitContendaBlocks = splitContendaBlocks;
    deps.splitTresBarrasBlocks = splitTresBarrasBlocks;
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
