/* LICSYSTEM — UTILS / edital (parse, blacklist, unidades) */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils || (LICSYSTEM.utils = {});

  var PACK_JUNK = ["unidade","unid","und","un","kit","jogo","conjunto","cx","caixa","pct","pacote","pc","peca","pecas","par","pares","embalagem","cartela","fardo","rolo","frasco","galao","balde","saco","lata","display"];
  const BLACKLIST = ["Edital","Pregão","Secretaria","Objeto","Vigência"];

  // Retorna "" se a linha contiver termo da BLACKLIST (descarta); senão, texto limpo p/ match
  utils.sanitizar = function(s){
    var raw = String(s == null ? "" : s);
    var folded = utils.fold(raw).toLowerCase();
    for(var b=0;b<BLACKLIST.length;b++){
      if(folded.indexOf(utils.fold(BLACKLIST[b]).toLowerCase()) !== -1) return "";
    }
    var t = folded.replace(/[^a-z0-9\s]/g," ");
    var words = t.split(/\s+/).filter(function(w){
      if(!w) return false;
      if(PACK_JUNK.indexOf(w) !== -1) return false;
      return true;
    });
    return words.join(" ").replace(/\s+/g," ").trim();
  };

  var RE_INICIO_SPEC_EDITAL = [
    /^deve\s+(possuir|permitir|ser|apresentar|garantir|conter)/i,
    /^apresenta(r?\s+)?(boa|alta|consist)/i,
    /^sendo\s+indicado/i,
    /^fixa(cao|ção)\s/i,
    /^proporcionando/i,
    /^garantindo/i,
    /^firme\s+e\s+dur/i,
    /^colagem\b/i,
    /^coladas,\s/i,
    /^uni[aã]o\s+por\s+contato/i,
    /^ader[eê]ncia\s+imediata/i,
    /^embalagem\s+contendo/i,
    /^devidamente\s+lacrad/i,
    /^consist[eê]ncia\s+homog/i,
    /^f[aá]cil\s+aplica[cç][aã]o/i,
    /^pincel,\s*esp[aá]tula/i,
    /^e\s+boas?\s+/i,
    /jun[cç][aã]o\s+das\s+pe[cç]as/i,
    /cisalhamento/i,
    /evapora[cç][aã]o\s+do\s+solvente/i,
    /tempo\s+de\s+secagem/i,
    /envelhecimento\s+natural/i,
    /identifica[cç][aã]o\s+do\s+fabricante/i,
    /resist[eê]ncia\s+final/i,
    /resist[eê]ncia\s+ao\s+cisalhamento/i
  ];

  /** Trecho de descrição (sem qtd/UN) que parece parágrafo de especificação. */
  utils.isTextoSpecEdital = function (texto) {
    texto = String(texto == null ? "" : texto).replace(/\s+/g, " ").trim();
    if (!texto || texto.length < 4) return false;

    var i;
    for (i = 0; i < RE_INICIO_SPEC_EDITAL.length; i++) {
      if (RE_INICIO_SPEC_EDITAL[i].test(texto)) return true;
    }

    if (/^[a-záàâãéêíóôúç]/.test(texto.charAt(0)) && texto.length > 35) return true;
    if (/^(e|ou|com|para|em|na|no|de|da|do|das|dos|ap[oó]s)\s+/i.test(texto) && texto.length > 25) {
      return true;
    }

    return false;
  };

  /** Unidades comuns em editais (THEO / compras / portais municipais). */
  var EDITAL_UNDS =
    "UNID\\.?|UND\\.?|UNI|UN|Unid\\.?|QUILO|METRO|ROLO|BARRA|LT|L|BL|BAL|GAL|KG|MT|M³|M²|M3|M2|M|PC|PÇ|CX|PAR|CJ|KIT|PCT|POTE|RL|BD|SC|GL|JOGO|PAR|SV|HR|VB|DZ";

  /** Cotas textuais (Castro / portais): Exclusivo ME/EPP/MEI | Ampla Concorrência */
  var EDITAL_COTAS_TXT =
    "Exclusivo(?:\\s+ME\\/?EPP\\/?MEI)?|Ampla(?:\\s+Concorr[eê]ncia)?";

  /**
   * Localiza par unitário+total no texto (inclusive no meio da descrição, comum em PDF
   * com quebra de página). Prefere o par em que total ≈ qtd × unitário.
   */
  utils.findEditalPricePair = function (str, qtdHint) {
    str = String(str == null ? "" : str);
    var re =
      /\s+(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})(?=\s|$)/g;
    var best = null;
    var m;
    var qtd = Number(qtdHint) || 0;
    while ((m = re.exec(str)) !== null) {
      // Ignora Cód municipal (18.223) colado antes do unitário
      if (/^\d{1,3}(\.\d{3})+$/.test(m[1])) {
        re.lastIndex = m.index + 1;
        continue;
      }
      var u = utils.parseBrNum(m[1]);
      var t = utils.parseBrNum(m[2]);
      if (!(u > 0) || !(t > 0)) continue;
      var score = 5;
      if (qtd > 0) {
        var expect = qtd * u;
        var rel = Math.abs(expect - t) / Math.max(Math.abs(t), Math.abs(expect), 1);
        if (rel <= 0.015) score = 100;
        else if (rel <= 0.05) score = 70;
        else if (rel <= 0.12) score = 30;
        else score = 2;
      }
      if (!best || score > best.score || (score === best.score && m.index >= best.index)) {
        best = {
          unit: u,
          total: t,
          index: m.index,
          len: m[0].length,
          score: score
        };
      }
    }
    if (!best) return null;
    if (qtd > 0 && best.score < 30) return null;
    return best;
  };

  /**
   * Prefixo de item:
   * - clássico: [lote] qtd UN descrição
   * - THEO: lote UN descrição  (quantidade vem no rodapé de preços)
   */
  var RE_EDITAL_HEAD = new RegExp(
    "^(?:(\\d{1,5})\\s+)?(?:(\\d{1,3}(?:\\.\\d{3})+,\\d{3}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)\\s+)?(" +
      EDITAL_UNDS +
      ")\\s+",
    "i"
  );
  var RE_EDITAL_THEO_HEAD = new RegExp(
    "^(\\d{1,5})\\s+(" + EDITAL_UNDS + ")\\s+(.+)$",
    "i"
  );

  /** Remove preços no fim e devolve só a parte planilha + descrição. */
  utils.stripPrecosEdital = function (line) {
    return String(line == null ? "" : line)
      .replace(/\s+/g, " ")
      .trim()
      // THEO colado: 5,0600 506,00100,000
      .replace(
        /\s+(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})(\d{1,3}(?:\.\d{3})*,\d{3}|\d+,\d{3})\s*$/,
        ""
      )
      .replace(
        /\s+(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+[.,]\d{2,4})(?:\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2}))?\s*$/,
        ""
      )
      .trim();
  };

  /** Linha completa: sem formato planilha ou descrição = especificação. */
  utils.isLinhaSpecEdital = function (line) {
    var raw = utils.stripPrecosEdital(line);
    if (!raw || raw.length < 4) return true;

    var temPlanilha = RE_EDITAL_HEAD.test(raw) || RE_EDITAL_THEO_HEAD.test(raw);
    if (!temPlanilha) return true;

    var m =
      raw.match(RE_EDITAL_THEO_HEAD) ||
      raw.match(
        new RegExp(
          "^(?:\\d{1,5}\\s+)?(?:\\d{1,3}(?:\\.\\d{3})+,\\d{3}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)\\s+(?:" +
            EDITAL_UNDS +
            ")\\s+(.+)$",
          "i"
        )
      );
    return utils.isTextoSpecEdital(m ? m[m.length - 1] : raw);
  };

  /** Só linhas válidas de produto. */
  utils.isLinhaProdutoEdital = function (line) {
    if (line && typeof line === "object") {
      var it = utils.asCaptacaoItem(line);
      if (!it || !it.produto || it.produto.length < 2) return false;
      // Item já estruturado (lote/qtd/preço do PDF): não descartar por desc começar com "com/do/..."
      // (comum quando pdf.js parte a descrição entre linhas).
      if (String(it.lote || "").trim() && Number(it.qtd) > 0) return true;
      if (Number(it.editalVunit) > 0 && Number(it.qtd) > 0) return true;
      if (utils.isTextoSpecEdital(it.produto)) return false;
      return utils.isLinhaProdutoEdital(
        it.line || (it.lote ? it.lote + " " : "") + it.qtd + " UN " + it.produto
      );
    }
    var fmt = utils.formatLinhaEdital(line);
    if (!fmt) return false;
    if (utils.isLinhaSpecEdital(fmt)) return false;
    var head = utils.stripPrecosEdital(fmt);
    if (!RE_EDITAL_HEAD.test(head) && !RE_EDITAL_THEO_HEAD.test(head)) return false;
    return true;
  };

  /**
   * Descrição: mantém "Produto - Produto" curto; remove só bloco técnico longo após " - ".
   */
  utils.enxugarDescricaoEdital = function (desc) {
    desc = String(desc || "").replace(/\s+/g, " ").trim();
    if (!desc) return "";
    var specHint =
      /^(o\s+produto|indicado\s+para|destinado|caracter[ií]sticas|conformidade|normas?\s+t[eé]cnicas|deve\s+(ser|possuir|permitir|apresentar|garantir|conter)|fabricado|aproximadamente|comprimento|tratamento|ergon[oô]mico|isolante|resist[eê]ncia|garantir|submetido|fixa(cao|ção)|proporcionando|garantindo|apresenta|sendo\s+indicado|embalagem\s+contendo)/i;
    var idx = desc.search(/\s+[-–]\s+/);
    if (idx === -1) return desc;
    var left = desc.slice(0, idx).trim();
    var right = desc.slice(idx).replace(/^\s+[-–]\s+/, "").trim();
    if (!right) return left;
    if (specHint.test(right) || right.length > 85) return left;
    var lf = utils.fold(left).toLowerCase();
    var rf = utils.fold(right).toLowerCase();
    if (rf.indexOf(lf.slice(0, Math.min(lf.length, 14))) === 0 || right.length <= left.length * 1.6) {
      return desc.trim();
    }
    return left;
  };

  /** Número BR: 10,000 | 1.234,56 | 38,1700 */
  utils.parseBrNum = function (v) {
    if (v == null || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    var s = String(v).trim();
    if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s) || (s.indexOf(".") >= 0 && s.indexOf(",") >= 0)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
      s = s.replace(/\./g, "");
    } else if (/,\d+$/.test(s)) {
      s = s.replace(/\./g, "").replace(",", ".");
    } else {
      s = s.replace(/[^0-9,.-]/g, "").replace(",", ".");
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  /**
   * Extrai lote/item, qtd, descrição, valor unitário e valor final da linha do edital (PDF).
   *
   * Formato THEO (Pinhalão / compras):
   *   "1 UN Abraçadeira ... 5,0600 506,00100,000"
   *   → lote=1, UN, desc, unit=5,06, total=506,00, qtd=100,000 (total+qtd colados)
   *
   * Formato portal (ITEM + Cotas numérica/hífen):
   *   "12 1 100,000 UN ABC123 Produto - Desc 15,50 1.550,00"
   *   "12 - 20 UN Broca madeira 5,00 100,00"
   *
   * Formato portal cotas textuais (Castro / quadro resumo):
   *   "1 Exclusivo ME/EPP/MEI 30 QUILO 36.535 ARAME ... 19,20 576,00"
   *   "8 Ampla Concorrência 200 UND 80.856 BRAÇO ... 520,00 104.000,00"
   *   Cotas e Cód NÃO são lote nem quantidade.
   *
   * Formato São Mateus do Sul (LOTE + ITEM + UND + QTD + R$):
   *   "1 Açúcar refinado ... PCT 3000 R$ 15,93 R$ 47.790,00"
   *   LOTE/Benefício (ex.: "1 Geral") NÃO é quantidade.
   *
   * Formato Três Barras do Paraná (ITEM + PRODUTO + UND + QTDE + UNIT + TOTAL, sem R$):
   *   "2 BASE PARA RELÉ FOTOCÉLULA BIVOLT UND 50 17,65 882,50"
   *   Multilinha: nome antes do nº; nº no meio da descrição; continuação após preços.
   *   (splitEdital / splitTresBarrasBlocks — não confundir com THEO "N UND …")
   *
   * Formato clássico (ITEM|LOTE):
   *   "117 10,000 UND ALICATE ... 38,1700 381,70"
   */
  utils.parseLinhaEdital = function (raw) {
    var s = String(raw == null ? "" : raw)
      .replace(/[\u00A0\u202F\u2007\u2009\u200A\u2008]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      // R$ 3 ,87 → R$ 3,87 (pdf.js às vezes parte o decimal)
      .replace(/R\$\s*(\d+)\s*,\s*(\d{2})\b/gi, "R$ $1,$2");
    if (!s) return null;

    function pack(lote, qtd, und, desc, editalVunit, editalTotal) {
      desc = utils.enxugarDescricaoEdital(String(desc || "").trim());
      if (!desc || desc.length < 2) return null;
      qtd = Number(qtd) || 0;
      editalVunit = Number(editalVunit) || 0;
      editalTotal = Number(editalTotal) || 0;
      if (!editalTotal && editalVunit && qtd) editalTotal = qtd * editalVunit;
      if (!qtd) qtd = 1;
      var qtdStr = (Math.round(qtd * 1000) / 1000).toLocaleString("pt-BR", {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
      });
      var line =
        (lote ? lote + " " : "") +
        qtdStr +
        " " +
        und +
        " " +
        desc;
      if (editalVunit > 0) {
        line +=
          " " +
          editalVunit.toLocaleString("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4
          });
        if (editalTotal > 0) {
          line +=
            " " +
            editalTotal.toLocaleString("pt-BR", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
        }
      }
      return {
        lote: lote || "",
        qtd: qtd,
        und: und || "UN",
        produto: desc,
        editalVunit: editalVunit,
        editalTotal: editalTotal,
        line: line
      };
    }

    // --- Formato THEO: preços no fim (unitário + total colado na qtd) ---
    // Ex.: 5,0600 506,00100,000  |  14,5300 1.453,00100,000  |  48,2600 1.447,8030,000
    var theoFoot = s.match(
      /(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})(\d{1,3}(?:\.\d{3})*,\d{3}|\d+,\d{3})\s*$/
    );
    var theoUnit = 0,
      theoTotal = 0,
      theoQtd = 0;
    var theoFootSp = null;
    if (theoFoot) {
      theoUnit = utils.parseBrNum(theoFoot[1]);
      theoTotal = utils.parseBrNum(theoFoot[2]);
      theoQtd = utils.parseBrNum(theoFoot[3]);
      s = s.slice(0, theoFoot.index).trim();
    } else {
      // THEO com espaço entre total e qtd
      theoFootSp = s.match(
        /(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{3}|\d+,\d{3})\s*$/
      );
      if (theoFootSp) {
        theoUnit = utils.parseBrNum(theoFootSp[1]);
        theoTotal = utils.parseBrNum(theoFootSp[2]);
        theoQtd = utils.parseBrNum(theoFootSp[3]);
        s = s.slice(0, theoFootSp.index).trim();
      }
    }

    var mTheo = s.match(new RegExp("^(\\d{1,5})\\s+(" + EDITAL_UNDS + ")\\s+(.+)$", "i"));
    if (mTheo && (theoQtd > 0 || theoUnit > 0 || theoTotal > 0 || !/^\d+[.,]\d+\s+(UN|UND)\b/i.test(mTheo[3]))) {
      // Evita confundir com clássico "100,000 UN desc" (sem lote) — nesse caso mTheo não casa com lote.
      // Se o 2º token é unidade de medida (UN/LT/GAL…) e há descrição textual, é THEO.
      var undTheo = mTheo[2].toUpperCase();
      var descTheo = mTheo[3].trim();
      // Clássico sem lote começa com qtd numérica + UN — já coberto abaixo.
      // Se descTheo começa com número tipo qtd, pode ser clássico mal capturado; só aceite THEO se und é unidade curta.
      if (!/^\d{1,3}([.,]\d{3})*\s+(UN|UND|UNI|UNID)\b/i.test(descTheo)) {
        var got = pack(mTheo[1], theoQtd || 0, undTheo, descTheo, theoUnit, theoTotal);
        if (got) return got;
      }
    }

    // Sem rodapé THEO, mas cabeçalho "12 UN Descrição..." (qtd ausente → 1 até achar preços)
    if (mTheo && !theoFoot && !theoFootSp) {
      var undOnly = mTheo[2].toUpperCase();
      var descOnly = mTheo[3].trim();
      if (!/^\d+[.,]\d+\s+/i.test(descOnly)) {
        var got2 = pack(mTheo[1], 0, undOnly, descOnly, 0, 0);
        if (got2) return got2;
      }
    }

    // --- Preços clássicos/portal no fim (unitário + total) ---
    s = String(raw == null ? "" : raw)
      .replace(/[\u00A0\u202F\u2007\u2009\u200A\u2008]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/R\$\s*(\d+)\s*,\s*(\d{2})\b/gi, "R$ $1,$2");

    var editalVunit = 0,
      editalTotal = 0;
    // Se já pegamos rodapé THEO, reuse
    if (theoUnit || theoTotal || theoQtd) {
      editalVunit = theoUnit;
      editalTotal = theoTotal;
    }
    // São Mateus / portais com prefixo R$
    var pmRs = s.match(
      /\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s*$/i
    );
    if (pmRs && !theoFoot && !theoFootSp) {
      editalVunit = utils.parseBrNum(pmRs[1]);
      editalTotal = utils.parseBrNum(pmRs[2]);
      s = s.slice(0, pmRs.index).trim();
    }
    var priceRe =
      /\s+(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})\s*$/;
    var pm = !pmRs ? s.match(priceRe) : null;
    if (pm && !theoFoot && !theoFootSp) {
      editalVunit = utils.parseBrNum(pm[1]);
      editalTotal = utils.parseBrNum(pm[2]);
      s = s.slice(0, pm.index).trim();
    } else if (!theoFoot && !theoFootSp && !pmRs) {
      var onlyUnit = s.match(/\s+(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+[.,]\d{3,4})\s*$/);
      if (onlyUnit) {
        editalVunit = utils.parseBrNum(onlyUnit[1]);
        s = s.slice(0, onlyUnit.index).trim();
      }
      // Remove também o foot THEO colado se ainda estiver
      var glued = s.match(
        /\s+(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2})(\d{1,3}(?:\.\d{3})*,\d{3}|\d+,\d{3})\s*$/
      );
      if (glued) {
        editalVunit = utils.parseBrNum(glued[1]);
        editalTotal = utils.parseBrNum(glued[2]);
        // qtd no glued[3] usada nos packs abaixo via theoQtd
        theoQtd = utils.parseBrNum(glued[3]);
        s = s.slice(0, glued.index).trim();
      }
    } else {
      // s já foi cortado no bloco THEO; reaplicar corte no raw limpo
      s = String(raw == null ? "" : raw)
        .replace(/[\u00A0\u202F\u2007\u2009\u200A\u2008]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (theoFoot) s = s.slice(0, theoFoot.index).trim();
      else if (theoFootSp) s = s.slice(0, theoFootSp.index).trim();
    }

    var UND = "(" + EDITAL_UNDS + ")";
    var QTD = "(\\d{1,3}(?:\\.\\d{3})+,\\d{3}|\\d{1,3}(?:\\.\\d{3})+|\\d+(?:[.,]\\d+)?)";
    // Cód municipal: 36.535 | 1.139 | 661 (não confundir com qtd/lote)
    var COD_OPT = "(?:((?:\\d{1,3}(?:\\.\\d{3})+|\\d{1,6}))\\s+)?";

    // Portal Castro: ITEM + Cotas textuais + QTDE + UND + [CÓD] + DESCRIÇÃO
    // Ex.: "1 Exclusivo ME/EPP/MEI 30 QUILO 36.535 ARAME GALVANIZADO 14-AWG"
    var m = s.match(
      new RegExp(
        "^(\\d{1,5})\\s+(?:" +
          EDITAL_COTAS_TXT +
          ")\\s+" +
          QTD +
          "\\s+" +
          UND +
          "\\s+" +
          COD_OPT +
          "(.+)$",
        "i"
      )
    );
    if (m) {
      var qtdC = utils.parseBrNum(m[2]) || theoQtd;
      var descC = String(m[5] || "").trim();
      var vuC = editalVunit;
      var vtC = editalTotal;
      if (!vuC && !vtC) {
        var midP = utils.findEditalPricePair(descC, qtdC);
        if (midP) {
          vuC = midP.unit;
          vtC = midP.total;
          descC = (descC.slice(0, midP.index) + " " + descC.slice(midP.index + midP.len))
            .replace(/\s+/g, " ")
            .trim();
        }
      }
      // Remove restos de cabeçalho/rodapé de página colados na descrição
      descC = descC
        .replace(
          /Munic[ií]pio de Castro\s+Diretoria de Suprimentos/gi,
          " "
        )
        .replace(
          /Pra[cç]a\s+Pedro\s+Kaled[\s\S]{0,220}?(?:licitacao\.castro@gmail\.com|www\.castro\.pr\.gov\.br)/gi,
          " "
        )
        .replace(/\bE-mail:\s*\S+/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      return pack(m[1], qtdC, m[3].toUpperCase(), descC, vuC, vtC);
    }

    // Portal: ITEM COTAS QTDE UND [CÓD] DESCRIÇÃO
    // Ex.: "12 1 100,000 UN ABC123 Abraçadeira" | "12 - 20 UN Broca madeira"
    // Cód opcional: token alfanumérico com ao menos 1 dígito (não engole a descrição)
    m = s.match(
      new RegExp(
        "^(\\d{1,5})\\s+(\\d+|[-–])\\s+" +
          QTD +
          "\\s+" +
          UND +
          "\\s+(?:((?=[\\w.\\/-]*\\d)[A-Za-z0-9][\\w.\\/-]{0,24})\\s+)?(.+)$",
        "i"
      )
    );
    if (m) {
      return pack(
        m[1],
        utils.parseBrNum(m[3]) || theoQtd,
        m[4].toUpperCase(),
        m[6] || m[5] || "",
        editalVunit,
        editalTotal
      );
    }

    // Clássico / Item: ITEM|LOTE QTDE UND DESCRIÇÃO
    m = s.match(new RegExp("^(\\d{1,4}(?:\\.\\d{1,4})?)\\s+" + QTD + "\\s+" + UND + "\\s+(.+)$", "i"));
    if (m) {
      return pack(m[1], utils.parseBrNum(m[2]) || theoQtd, m[3].toUpperCase(), m[4], editalVunit, editalTotal);
    }
    m = s.match(new RegExp("^" + QTD + "\\s+" + UND + "\\s+(.+)$", "i"));
    if (m) {
      return pack("", utils.parseBrNum(m[1]) || theoQtd, m[2].toUpperCase(), m[3], editalVunit, editalTotal);
    }

    return null;
  };

  /** Normaliza item da Captação (string antiga ou objeto parseado). */
  utils.asCaptacaoItem = function (entry) {
    if (entry && typeof entry === "object" && (entry.produto || entry.line || entry.qtd)) {
      var qtd = Number(entry.qtd) || 0;
      var editalVunit = Number(entry.editalVunit) || 0;
      var editalTotal = Number(entry.editalTotal) || 0;
      if (!editalTotal && editalVunit && qtd) editalTotal = qtd * editalVunit;
      var produto = String(entry.produto || "").trim();
      var lote = entry.lote != null && entry.lote !== "" ? String(entry.lote) : "";
      var und = String(entry.und || "UN").toUpperCase();
      var line = entry.line || "";
      if (!line && produto) {
        var rebuilt = utils.parseLinhaEdital(
          (lote ? lote + " " : "") + (qtd || 1) + " " + und + " " + produto +
          (editalVunit ? " " + editalVunit : "") +
          (editalTotal ? " " + editalTotal : "")
        );
        line = (rebuilt && rebuilt.line) || ((lote ? lote + " " : "") + qtd + " " + und + " " + produto);
      }
      return {
        lote: lote,
        qtd: qtd || 1,
        und: und,
        produto: produto,
        editalVunit: editalVunit,
        editalTotal: editalTotal,
        line: line
      };
    }
    var parsed = utils.parseLinhaEdital(entry);
    if (parsed) return parsed;
    var raw = String(entry == null ? "" : entry).trim();
    if (!raw) return null;
    return { lote: "", qtd: 1, und: "UN", produto: raw, editalVunit: 0, editalTotal: 0, line: raw };
  };

  /**
   * Formato planilha do edital (texto). Mantém preços no fim quando existirem.
   */
  utils.formatLinhaEdital = function (raw) {
    var parsed = utils.parseLinhaEdital(raw);
    return parsed ? parsed.line : null;
  };

  /** Termo curto para busca (opcional): remove qtd/UN e pega trecho antes do " - ". */
  utils.nomeProdutoEdital = function (line) {
    var parsed = utils.parseLinhaEdital(line);
    if (parsed && parsed.produto) {
      return parsed.produto.split(/\s+[-–]\s+/)[0].trim().toLowerCase();
    }
    var fmt = utils.formatLinhaEdital(line) || String(line || "").trim();
    var m = fmt.match(/^(?:\d{1,5}\s+)?\d{1,3}(?:\.\d{3})*,\d{3}\s+(?:UN|UND|UNI|UNID)\s+(.+)$/i);
    if (m) {
      var d = m[1].split(/\s+[-–]\s+/)[0].trim();
      return d.toLowerCase();
    }
    return fmt.toLowerCase();
  };

  ctx.PACK_JUNK = PACK_JUNK;
  ctx.BLACKLIST = BLACKLIST;
  ctx.RE_INICIO_SPEC_EDITAL = RE_INICIO_SPEC_EDITAL;
  ctx.EDITAL_UNDS = EDITAL_UNDS;
  ctx.EDITAL_COTAS_TXT = EDITAL_COTAS_TXT;
  ctx.RE_EDITAL_HEAD = RE_EDITAL_HEAD;
  ctx.RE_EDITAL_THEO_HEAD = RE_EDITAL_THEO_HEAD;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
