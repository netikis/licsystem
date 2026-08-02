(function(){
  "use strict";

  var LICSYSTEM = window.LICSYSTEM = {};

  /* ============================ UTILS ============================ */
  var utils = LICSYSTEM.utils = {};

  utils.escapeHtml = function(s){
    var str = String(s == null ? "" : s);
    return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
              .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  };

  /** Extrai mensagem legível de Error / string / objeto JSON da API (evita [object Object]). */
  utils.formatApiError = function(err){
    if (err == null) return "erro desconhecido";
    if (typeof err === "string") return err;
    if (err instanceof Error && err.message) {
      var m = err.message;
      if (m !== "[object Object]") return m;
    }
    var raw = err.error != null ? err.error : err.message != null ? err.message : err;
    if (typeof raw === "string") return raw;
    if (raw && typeof raw === "object") {
      if (typeof raw.message === "string") return raw.message;
      try {
        return JSON.stringify(raw);
      } catch (e) {
        return String(raw);
      }
    }
    if (err && typeof err === "object") {
      try {
        return JSON.stringify(err);
      } catch (e2) {
        return String(err);
      }
    }
    return String(err);
  };

  /**
   * Lê Response: se não for JSON (HTML da Vercel etc.), devolve
   * { ok:false, error:"HTTP N: texto…" } em vez de Unexpected token.
   */
  utils.parseApiResponse = function(r){
    return r.text().then(function(text){
      var trimmed = String(text == null ? "" : text).trim();
      var j = null;
      if (trimmed) {
        try {
          j = JSON.parse(trimmed);
        } catch (e) {
          var snippet = trimmed.replace(/\s+/g, " ").slice(0, 160);
          var err = new Error(
            "HTTP " +
              r.status +
              " (resposta não-JSON): " +
              snippet +
              (trimmed.length > 160 ? "…" : "")
          );
          err.status = r.status;
          err.nonJson = true;
          throw err;
        }
      } else {
        j = {};
      }
      if (!r.ok) {
        var msg =
          utils.formatApiError((j && j.error) || j) || "HTTP " + r.status;
        var err2 = new Error(msg);
        err2.status = r.status;
        err2.body = j;
        err2.errosParciais = j && j.errosParciais;
        throw err2;
      }
      return j;
    });
  };

  /** Dica de ambiente: em produção (Vercel) não sugerir npm run dev. */
  utils.apiHintHtml = function(){
    try {
      var h = String(location.hostname || "");
      if (/\.vercel\.app$/i.test(h) || (h && h !== "localhost" && h !== "127.0.0.1")) {
        return "Se o problema continuar, aguarde o redeploy ou confira os logs da função na Vercel.";
      }
    } catch (e) {}
    return "Localmente use <code>npm run dev</code> (Vite+API); em produção o deploy na Vercel precisa incluir as APIs.";
  };

  // fold: remove accents / normalize
  utils.fold = function(s){
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  };

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
    "UNID|UND|UNI|UN|QUILO|METRO|ROLO|BARRA|LT|L|BL|BAL|GAL|KG|MT|M³|M²|M3|M2|M|PC|PÇ|CX|PAR|CJ|KIT|PCT|POTE|RL|BD|SC|GL|JOGO|PAR|SV|HR|VB|DZ";

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
    m = s.match(new RegExp("^(\\d{1,5})\\s+" + QTD + "\\s+" + UND + "\\s+(.+)$", "i"));
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

  utils.levenshtein = function(a,b){
    a = String(a||""); b = String(b||"");
    var m = a.length, n = b.length;
    if(m === 0) return n;
    if(n === 0) return m;
    var prev = new Array(n+1), curr = new Array(n+1), i, j;
    for(j=0;j<=n;j++) prev[j] = j;
    for(i=1;i<=m;i++){
      curr[0] = i;
      for(j=1;j<=n;j++){
        var cost = a.charAt(i-1) === b.charAt(j-1) ? 0 : 1;
        curr[j] = Math.min(prev[j]+1, curr[j-1]+1, prev[j-1]+cost);
      }
      for(j=0;j<=n;j++) prev[j] = curr[j];
    }
    return prev[n];
  };

  utils.similaridade = function(a,b){
    a = utils.sanitizar(a); b = utils.sanitizar(b);
    if(!a && !b) return 100;
    var dist = utils.levenshtein(a,b);
    var maxLen = Math.max(a.length, b.length) || 1;
    var sim = (1 - dist/maxLen) * 100;
    if(sim < 0) sim = 0;
    return Math.round(sim);
  };

  utils.formatBrl = function(v){
    var n = Number(v);
    if(!isFinite(n)) n = 0;
    return n.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
  };

  /** Normalize pasted URLs (add https:// when missing). Returns "" if not usable. */
  utils.normalizeHttpUrl = function(raw){
    var s = String(raw || "").trim();
    if(!s) return "";
    if(/^https?:\/\//i.test(s)) return s;
    // Domain-like: example.com, www.x.com/path, subdomain.site.gov.br/...
    if(/^(www\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([\/?#].*)?$/i.test(s)){
      return "https://" + s;
    }
    return "";
  };

  // dynamic script injection (async, never blocks UI)
  var _loaded = {};
  utils.loadScript = function(src){
    if(_loaded[src]) return _loaded[src];
    _loaded[src] = new Promise(function(resolve,reject){
      var s = document.createElement("script");
      s.src = src; s.async = true;
      s.onload = function(){ resolve(true); };
      s.onerror = function(){ delete _loaded[src]; reject(new Error("Falha ao carregar: "+src)); };
      document.head.appendChild(s);
    });
    return _loaded[src];
  };

  utils.ensurePdfJs = function(){
    if(window.pdfjsLib) return Promise.resolve();
    return utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js")
      .then(function(){
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      });
  };

  utils.ensureJsPdf = function(){
    var need = [];
    if(!(window.jspdf && window.jspdf.jsPDF)) need.push("https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js");
    var p = Promise.resolve();
    need.forEach(function(u){ p = p.then(function(){ return utils.loadScript(u); }); });
    return p.then(function(){
      // autotable requires jspdf present first
      return utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.3/jspdf.plugin.autotable.min.js");
    });
  };

  utils.ensureXlsx = function(){
    if(window.XLSX) return Promise.resolve();
    return utils.loadScript("https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js");
  };

  utils.ensureChart = function(){
    if(window.Chart) return Promise.resolve();
    return utils.loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js");
  };

  /* ------- Firebase (config via import.meta.env.VITE_FIREBASE_* → firebaseConfig.js) ------- */
  utils.getFirebaseConfig = function(){
    if(window.LICSYSTEMFirebase && typeof window.LICSYSTEMFirebase.getConfigSync === "function"){
      return window.LICSYSTEMFirebase.getConfigSync();
    }
    return null;
  };

  utils.hasFirebaseConfig = function(){
    if(!(window.LICSYSTEMFirebase && typeof window.LICSYSTEMFirebase.ensureAuth === "function")) return false;
    var cfg = utils.getFirebaseConfig();
    return !!(cfg && cfg.apiKey && cfg.projectId);
  };

  var _fbInit = null;
  var _fbAuthInit = null;

  /** Só App + Auth (login rápido). Database sobe sob demanda. */
  utils.ensureFirebaseAuth = function(){
    if(!utils.hasFirebaseConfig()) return Promise.reject(new Error("firebase-config-vazio"));
    if(_fbAuthInit) return _fbAuthInit;
    _fbAuthInit = window.LICSYSTEMFirebase.ensureAuth()
      .catch(function(err){ _fbAuthInit = null; throw err; });
    return _fbAuthInit;
  };

  /** App + Auth + Realtime Database (paralelo após o app). */
  utils.ensureFirebase = function(){
    if(!utils.hasFirebaseConfig()) return Promise.reject(new Error("firebase-config-vazio"));
    if(_fbInit) return _fbInit;
    _fbInit = window.LICSYSTEMFirebase.ensureDatabase()
      .catch(function(err){ _fbInit = null; throw err; });
    return _fbInit;
  };

  utils.firebasePush = function(path, obj){
    return utils.ensureFirebase().then(function(fb){
      return fb.database().ref(path).push(obj);
    });
  };

  utils.firebaseSet = function(path, obj){
    return utils.ensureFirebase().then(function(fb){
      var ref = (path === "/" || path === "") ? fb.database().ref() : fb.database().ref(path);
      return ref.set(obj);
    });
  };

  utils.firebaseGet = function(path){
    return utils.ensureFirebase().then(function(fb){
      return fb.database().ref(path).once("value").then(function(snap){
        return snap.val();
      });
    });
  };

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

  utils.mlSearch = function(q, limit){
    var lim = limit || 10;
    var url =
      utils.mlSearchBase() +
      "?q=" +
      encodeURIComponent(q || "") +
      "&limit=" +
      encodeURIComponent(lim);
    return fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" }
    }).then(function(r){
      return r.json().then(function(j){
        if(!r.ok || (j && j.ok === false && !(j.results && j.results.length))){
          var msg = (j && (j.error || j.message || j.warning)) || ("HTTP " + r.status);
          var err = new Error(msg);
          err.status = r.status;
          err.body = j;
          throw err;
        }
        return j || { ok: true, results: [] };
      }, function(){
        throw new Error("HTTP " + r.status + " (resposta inválida de /api/search-ml)");
      });
    });
  };

  utils.mlShipping = function(itemId, cep, permalink){
    var p = { action: "shipping", itemId: itemId || "", cep: cep || "" };
    if(permalink) p.permalink = permalink;
    return utils.mlProxy(p);
  };

  // build EXACT path: licitacoes/${YYYY}/${MM}/${DD}-${HHh}/resultados_cruzamento
  utils.buildFirebasePath = function(d){
    d = d || new Date();
    var YYYY = d.getFullYear();
    var MM = ("0"+(d.getMonth()+1)).slice(-2);
    var DD = ("0"+d.getDate()).slice(-2);
    var HH = ("0"+d.getHours()).slice(-2);
    return "licitacoes/"+YYYY+"/"+MM+"/"+DD+"-"+HH+"h/resultados_cruzamento";
  };

  utils.ymd = function(d){
    d = d || new Date();
    return ""+d.getFullYear()+("0"+(d.getMonth()+1)).slice(-2)+("0"+d.getDate()).slice(-2);
  };

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
    orcMetaNumero: ""
  };

  var ORC_KEY = "licsystem_orcamento_v2";
  var ORC_KEY_LEGACY = "licsystem_orcamento_v1";
  var COFRE_KEY = "licsystem_cofre_v1";
  var DOCS_CHECKLIST_KEY = "licsystem_docs_checklist_v1";
  var DOCS_ACCORDION_KEY = "licsystem_docs_accordion_v1";
  var LEILOES_PARTICIPO_KEY = "licsystem_leiloes_participo_v1";
  var PNCP_WATCHES_KEY = "licsystem_pncp_watches_v1";
  var PNCP_ALERTS_KEY = "licsystem_pncp_alerts_v1";
  var CLOUD_META_KEY = "licsystem_cloud_meta_v1";
  var LAST_VIEW_KEY = "licsystem_last_view_v1";
  var CLOUD_LAST_UID_KEY = "licsystem_cloud_last_uid";

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
          var hist = JSON.parse(localStorage.getItem("licsystem_hist_entregas_v1") || "null");
          if(hist == null) return null;
          return { updatedAt: this.metaTs("histEntregas"), data: Array.isArray(hist) ? hist : [] };
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
        try{ localStorage.setItem("licsystem_hist_entregas_v1", JSON.stringify(LICSYSTEM.histEntregas.items)); }catch(e){}
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

      // Local empty + cloud has data → take cloud (even if local ts missing/0).
      if(this.isEnvelopeEmpty(key, localEnv) && cloudEnv && !this.isEnvelopeEmpty(key, cloudEnv)){
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
  utils.riscoMatch = function(text){
    var t = utils.fold(String(text||"")).toLowerCase();
    var hits = [];
    for(var i=0;i<PALAVRAS_RISCO.length;i++){
      var w = utils.fold(PALAVRAS_RISCO[i]).toLowerCase();
      if(t.indexOf(w) !== -1) hits.push(PALAVRAS_RISCO[i]);
    }
    return hits;
  };

  function el(id){ return document.getElementById(id); }
  function showAlert(id, type, msg){
    var a = el(id); if(!a) return;
    a.className = "alert show alert-"+type;
    a.innerHTML = msg;
  }
  function hideAlert(id){ var a=el(id); if(a) a.className="alert"; }

  /* ============================ BELL / PNCP badge ============================ */
  LICSYSTEM.updateBell = function(){
    if(LICSYSTEM.alertas && LICSYSTEM.alertas.updateBell){
      LICSYSTEM.alertas.updateBell();
      return;
    }
    var badge = el("bellBadge");
    if(!badge) return;
    var n = (LICSYSTEM.state.pncpAlerts || []).length;
    badge.textContent = String(n);
    badge.classList.toggle("zero", n === 0);
  };

  /* ============================ DASHBOARD ============================ */
  LICSYSTEM.dashboard = {
    _charts:{},
    renderKpis:function(){
      var m = LICSYSTEM.state.dashboardMetrics;
      var grid = el("kpiGrid");
      if(!grid) return;
      grid.innerHTML =
        kpi("Volume Financeiro Disputado", utils.formatBrl(m.volumeDisputado), "Acumulado no período", false) +
        kpi("Pregões Ganhos", m.ganhos, "Homologados a favor do LICSYSTEM", true) +
        kpi("Pregões Perdidos", m.perdidos, "Não vencidos", true) +
        kpi("Em Análise", m.emAnalise, "Aguardando decisão", true);
      function kpi(label,val,sub,alt){
        return '<div class="kpi-card'+(alt?' alt':'')+'">'+
          '<div class="k-label">'+utils.escapeHtml(label)+'</div>'+
          '<div class="k-value">'+utils.escapeHtml(val)+'</div>'+
          '<div class="k-sub">'+utils.escapeHtml(sub)+'</div></div>';
      }
    },
    initCharts:function(){
      utils.ensureChart().then(function(){
        var m = LICSYSTEM.state.dashboardMetrics;
        var dEl = el("chartDoughnut"), bEl = el("chartBar");
        if(dEl){
          if(LICSYSTEM.dashboard._charts.d) LICSYSTEM.dashboard._charts.d.destroy();
          LICSYSTEM.dashboard._charts.d = new Chart(dEl.getContext("2d"),{
            type:"doughnut",
            data:{ labels:["Ganhos","Perdidos","Em Análise"],
              datasets:[{ data:[m.ganhos,m.perdidos,m.emAnalise],
                backgroundColor:["#1e9e5a","#d23b3b","#c9a227"], borderWidth:0 }]},
            options:{ responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ position:"bottom" } }, cutout:"62%" }
          });
        }
        if(bEl){
          if(LICSYSTEM.dashboard._charts.b) LICSYSTEM.dashboard._charts.b.destroy();
          var labels = lastMonths(6);
          LICSYSTEM.dashboard._charts.b = new Chart(bEl.getContext("2d"),{
            type:"bar",
            data:{ labels:labels,
              datasets:[{ label:"R$ mil", data:m.volumeMensal,
                backgroundColor:"#152642", borderRadius:6 }]},
            options:{ responsive:true, maintainAspectRatio:false,
              plugins:{ legend:{ display:false } },
              scales:{ y:{ beginAtZero:true } } }
          });
        }
      }).catch(function(){ /* chart cdn failed — silent */ });
      function lastMonths(n){
        var names=["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
        var out=[], d=new Date();
        for(var i=n-1;i>=0;i--){ var dd=new Date(d.getFullYear(),d.getMonth()-i,1); out.push(names[dd.getMonth()]); }
        return out;
      }
    },
    renderPncp:function(){
      var box = el("dashPncpList");
      if(!box) return;
      var arr = (LICSYSTEM.alertas && LICSYSTEM.alertas.alerts && LICSYSTEM.alertas.alerts.length)
        ? LICSYSTEM.alertas.alerts
        : (LICSYSTEM.state.pncpAlerts || []);
      if(!arr.length){
        box.innerHTML='<span class="muted">Nenhum alerta ainda. Ative um monitoramento em <b>Pesquisas de Editais</b> (botão “Ativar alerta”).</span>';
        return;
      }
      var html='<div style="display:flex;flex-direction:column;gap:8px">';
      arr.slice(0,10).forEach(function(o){
        var title = o.link
          ? '<a href="'+utils.escapeHtml(o.link)+'" target="_blank" rel="noopener" style="color:inherit;text-decoration:none"><b>'+utils.escapeHtml(o.orgao||"Órgão")+'</b></a>'
          : '<b>'+utils.escapeHtml(o.orgao||"Órgão")+'</b>';
        html+='<div style="padding:10px 12px;border:1px solid var(--ls-line);border-radius:10px'+(o.readAt?'':';background:#fffbeb')+'">'+
          title+' <span class="badge-status b-yellow">'+utils.escapeHtml(o.uf||"")+'</span>'+
          (o.watchLabel ? ' <span class="small muted">· '+utils.escapeHtml(o.watchLabel)+'</span>' : '')+'<br/>'+
          '<span class="small muted">'+utils.escapeHtml((o.objeto||"").slice(0,180))+'</span></div>';
      });
      html+='</div>';
      box.innerHTML=html;
    },
    render:function(){ this.renderKpis(); this.initCharts(); this.renderPncp(); }
  };

  /* ============================ CAPTAÇÃO ============================ */
  var UF_LIST = ["AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO"];

  LICSYSTEM.captacao = {
    BLACKLIST: BLACKLIST,

    initUf:function(){
      var sel = el("pncpUf");
      if(!sel || sel.options.length) return;
      var html='<option value="">Todas</option>';
      UF_LIST.forEach(function(u){ html+='<option value="'+u+'">'+u+'</option>'; });
      sel.innerHTML = html;
    },

    // Planilha do edital PDF (THEO / Castro / São Mateus / Contenda / Três Barras / clássico)
    splitEdital: function (text) {
      function limparPagina(s) {
        return String(s || "")
          .replace(/\bP[aá]gina\s*:\s*\d+\s*\/\s*\d+/gi, "\n")
          .replace(/\bP[aá]gina\s+\d+\s+de\s+\d+/gi, "\n")
          // Cabeçalho curto (NÃO atravessar a página até o rodapé — isso apagava todos os itens)
          .replace(
            /Munic[ií]pio de Castro\s*(?:\r?\n|\s)+Diretoria de Suprimentos/gi,
            "\n"
          )
          // Rodapé Castro (endereço + CNPJ + site/e-mail) — janela limitada
          .replace(
            /Pra[cç]a\s+Pedro\s+Kaled[\s\S]{0,220}?(?:licitacao\.castro@gmail\.com|www\.castro\.pr\.gov\.br)/gi,
            "\n"
          )
          .replace(
            /CNPJ\s+[\d.\/-]+[\s\S]{0,160}?(?:licitacao\.castro@gmail\.com|www\.castro\.pr\.gov\.br)/gi,
            "\n"
          )
          .replace(/\bE-mail:\s*\S+/gi, "\n")
          .replace(/\bSite:\s*www\.castro\.pr\.gov\.br/gi, "\n")
          .replace(
            /Item\s+Cotas\s+Qtde\s+Und\s+C[oó]d[\s\S]{0,120}?Valor\s+M[aá]ximo\s+Total/gi,
            "\n"
          )
          .replace(/\bSoma:\s*[\d.,]+/gi, "\n")
          // São Mateus do Sul: marcadores curtos de página/cabeçalho (nunca engolir a tabela)
          .replace(/^\s*[-–]\s*\d{1,3}\s*[-–]\s*$/gm, "\n")
          .replace(
            /\bEDITAL DA LICITA[CÇ][AÃ]O\s+PREG[AÃ]O ELETR[OÔ]NICO\s+N[ºo°\.]?\s*[\d\/]+/gi,
            "\n"
          )
          // Contenda / Elotech: cabeçalho/rodapé de página + R$ partido pelo pdf.js
          .replace(/\bPE\s*\(SRP\)\s*n[ºo°.]?\s*[\d\s\/]+/gi, "\n")
          .replace(
            /Tramitado e Assinado Eletronicamente[\s\S]{0,280}?code=[^\s]+/gi,
            "\n"
          )
          // Três Barras do Paraná: rodapé de página (não engolir a tabela)
          .replace(
            /Av\.\s*Brasil,\s*245[\s\S]{0,220}?licitacao@tresbarras\.pr\.gov\.br/gi,
            "\n"
          )
          .replace(/R\s+\$/g, "R$")
          .replace(/R\$\s*(\d+)\s*\.\s*(\d{3})\s*,\s*(\d{2})\b/gi, "R$ $1.$2,$3")
          .replace(/R\$\s*(\d+)\s*,\s*(\d{2})\b/gi, "R$ $1,$2")
          .replace(/\u00A0/g, " ")
          .replace(/[\t ]+/g, " ")
          .trim();
      }

      function pushParsed(list, chunk) {
        var f = utils.parseLinhaEdital(chunk);
        if (f && utils.isLinhaProdutoEdital(f)) list.push(f);
      }

      function dedupeCaptacao(list) {
        var seen = {};
        var out = [];
        list.forEach(function (it) {
          var item = utils.asCaptacaoItem(it);
          if (!item || !item.produto) return;
          if (!utils.isLinhaProdutoEdital(item)) return;
          // sanitizar/BLACKLIST (Secretaria, Edital…) é p/ linhas-lixo; não descartar
          // item já precificado cuja descrição só menciona esses termos (ex.: Contenda EPI).
          var priced = Number(item.editalVunit) > 0 && Number(item.qtd) > 0;
          if (!priced && !utils.sanitizar(item.line || item.produto)) return;
          if (
            /^(P[aá]gina|Total|Subtotal|Valor|Prefeitura|Estado|Munic[ií]pio|Especifica|ANEXO|RELA|Destaco)\b/i.test(
              item.produto
            )
          )
            return;
          var k = (item.lote + "|" + item.qtd + "|" + item.produto).toLowerCase();
          if (seen[k]) return;
          seen[k] = 1;
          out.push(item);
        });
        return out;
      }

      /**
       * São Mateus do Sul (Elotech / quadro LOTE+ITEM):
       *   LOTE ITEM DESCRIÇÃO DO OBJETO UND QTD Unitário Total
       * pdf.js embaralha: nº do item no meio da descrição; preços com "R$".
       * Ex.: "… 1 qualidade. Produto deverá ser PCT 3000 R$ 15,93 R$ 47.790,00 …"
       * Usa a tabela COM preços (Unitário/Total); ignora a de "item por cesta".
       */
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

      /**
       * Contenda / Elotech TR (EPI e similares):
       *   ITEM DESCRIÇÃO UNIDADE QUANTIDADE / UNITÁRIO TOTAL
       * pdf.js embute o nº do item no meio da descrição; ordem das colunas:
       *   UND  R$ unitário  QTD  R$ total
       * Ex.: "… 2 PAR R$115,32 60 R$6.919,20 …"
       * Diferente de São Mateus (UND QTD R$ u R$ t). Prefere a tabela COM R$.
       */
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

      /**
       * Três Barras do Paraná (Anexo I – materiais elétricos):
       *   ITEM PRODUTO UND. QTDE. UNIT. / VALOR MÁX. (sem prefixo R$)
       * pdf.js: nº do item no meio da descrição; continuação após preços;
       *   "… 16 UND 10 261,51 2.615,10 GALVANIZADO CN1 …"
       *   "2 BASE PARA RELÉ … UND 50 17,65 882,50"
       * Diferente de São Mateus/Contenda (com R$) e de THEO ("N UND desc" + qtd no rodapé).
       */
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

      /**
       * PDF THEO: itens quebrados em várias linhas
       *   "1 UN Abraçadeira..."
       *   "continuação descrição"
       *   "5,0600 506,00100,000"
       * Junta pelo início "N UNIDADE ".
       */
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

      /**
       * Corta texto após o último par unitário+total, ignorando falsos pares em que o
       * 1º número é Cód municipal (ex.: 18.223 24,28) — isso engolia o total real.
       */
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

      /**
       * pdf.js (Captação) frequentemente emite a coluna Cotas antes do Item:
       *   "Exclusivo\n1 ME/EPP/MEI 30 QUILO ..."
       *   "Exclusivo\n2 ARMAÇÃO 1 X 1\nME/EPP/MEI 45 UND ..."
       *   "Exclusivo BLOCOS...\n5 ME/EPP/MEI 50 UND ..."
       *   "Ampla\n8 Concorrência 200 UND ..."
       * Reescreve para o formato canônico: "N Exclusivo ME/EPP/MEI QTD UND ..."
       */
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

      /**
       * Portal Castro / cotas textuais (itens multilinha).
       * Aceita layout canônico "N Exclusivo ME/EPP..." e o layout pdf.js
       * "Exclusivo\\nN ME/EPP..." / "Ampla\\nN Concorrência...".
       */
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

      /** Clássico / portal: quebra onde começa novo ITEM|LOTE (+ cotas opcional) + qtd + UN */
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

      var rawText = String(text || "");
      // Layout canônico OU pdf.js (Exclusivo/Ampla em linha separada do ME/EPP ou Concorrência)
      var castroHint =
        /Exclusivo\s+ME\/?EPP\/?MEI|Ampla\s+Concorr/i.test(rawText) ||
        /Exclusivo[\s\S]{0,80}ME\/?EPP\/?MEI|Ampla[\s\S]{0,80}Concorr/i.test(rawText);

      var saoMateusHint =
        /LOTE\s+ITEM\s+DESCRI[CÇ][AÃ]O\s+DO\s+OBJETO\s+UND\s+QTD/i.test(rawText) ||
        (/S[aã]o\s+Mateus\s+do\s+Sul/i.test(rawText) &&
          /(?:PCT|POTE|UND)\s+\d{2,}\s+R\$\s*[\d.,]+\s+R\$/i.test(rawText));

      // Contenda / Elotech TR: ITEM DESCRIÇÃO UNIDADE QUANTIDADE + UND R$ u QTD R$ t
      var contendaHint =
        /ITEM\s+DESCRI[CÇ][AÃ]O\s+UNIDADE\s+QUANTIDADE/i.test(rawText) ||
        (/(?:Munic[ií]pio de Contenda|CONTENDA\/PR)/i.test(rawText) &&
          /\b(?:PAR|UN|UND)\s+R\$\s*[\d.,]+\s+\d{1,5}\s+R\$\s*[\d.,]+/i.test(rawText));

      // Três Barras: ITEM PRODUTO UND. QTDE. UNIT. (sem R$) — antes do THEO
      var tresBarrasHint =
        /ITEM\s+PRODUTO\s+UND\.?\s*QTDE\.?\s*UNIT/i.test(rawText) ||
        (/Tr[eê]s\s+Barras\s+do\s+Paran[aá]/i.test(rawText) &&
          /\b(?:UND\.?|M)\s+\d{1,5}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,3}(?:\.\d{3})*,\d{2}/i.test(
            rawText
          ));

      // 1) Portal Castro / cotas textuais (prioritário quando o PDF tem esse quadro)
      if (castroHint) {
        var castroFirst = splitCastroBlocks(text);
        if (castroFirst.length >= 2) {
          var outCF = dedupeCaptacao(castroFirst);
          if (outCF.length >= 2) return outCF;
        }
      }

      // 2) São Mateus do Sul (LOTE+ITEM + R$) — antes do THEO (senão "N PCT …" vira falso THEO)
      if (saoMateusHint) {
        var smsFirst = splitSaoMateusBlocks(text);
        if (smsFirst.length >= 2) {
          var outSms = dedupeCaptacao(smsFirst);
          if (outSms.length >= 2) return outSms;
        }
      }

      // 3) Contenda / Elotech TR (UND R$ unitário QTD R$ total) — antes do THEO
      if (contendaHint) {
        var contFirst = splitContendaBlocks(text);
        if (contFirst.length >= 2) {
          var outCont = dedupeCaptacao(contFirst);
          if (outCont.length >= 2) return outCont;
        }
      }

      // 4) Três Barras do Paraná (UND QTD unit total sem R$) — antes do THEO
      if (tresBarrasHint) {
        var tbFirst = splitTresBarrasBlocks(text);
        if (tbFirst.length >= 2) {
          var outTb = dedupeCaptacao(tbFirst);
          if (outTb.length >= 2) return outTb;
        }
      }

      // 5) Formato THEO (Pinhalão / compras)
      var theo = splitTheoBlocks(text);
      if (theo.length >= 2) {
        var outT = dedupeCaptacao(theo);
        if (outT.length >= 2) return outT;
      }

      // 6) Portal Castro (fallback se o hint falhou)
      if (!castroHint) {
        var castro = splitCastroBlocks(text);
        if (castro.length >= 2) {
          var outC = dedupeCaptacao(castro);
          if (outC.length >= 2) return outC;
        }
      }

      // 7) São Mateus (fallback se o hint falhou)
      if (!saoMateusHint) {
        var sms = splitSaoMateusBlocks(text);
        if (sms.length >= 2) {
          var outS = dedupeCaptacao(sms);
          if (outS.length >= 2) return outS;
        }
      }

      // 8) Contenda (fallback se o hint falhou)
      if (!contendaHint) {
        var cont = splitContendaBlocks(text);
        if (cont.length >= 2) {
          var outCt = dedupeCaptacao(cont);
          if (outCt.length >= 2) return outCt;
        }
      }

      // 9) Três Barras (fallback se o hint falhou)
      if (!tresBarrasHint) {
        var tb = splitTresBarrasBlocks(text);
        if (tb.length >= 2) {
          var outTb2 = dedupeCaptacao(tb);
          if (outTb2.length >= 2) return outTb2;
        }
      }

      // 10) Fallback clássico linha a linha
      var t = limparPagina(text).replace(/\r\n?/g, "\n");
      var rawLines = t.split(/\n+/);
      var merged = [];
      for (var r = 0; r < rawLines.length; r++) {
        var ln = rawLines[r].trim();
        if (!ln) continue;
        var parts = splitChunkPlanilha(ln);
        for (var p = 0; p < parts.length; p++) merged.push(parts[p]);
      }

      return dedupeCaptacao(merged);
    },

    extrair:function(){
      var f = el("pdfFile").files[0];
      if(!f){ showAlert("pdfStatus","warn","Selecione um arquivo PDF primeiro."); return; }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Carregando biblioteca e extraindo texto…');
      utils.ensurePdfJs().then(function(){
        var reader = new FileReader();
        reader.onload = function(){
          var data = new Uint8Array(reader.result);
          window.pdfjsLib.getDocument({data:data}).promise.then(function(pdf){
            var pages=[], p;
            var chain = Promise.resolve();
            for(p=1;p<=pdf.numPages;p++){
              (function(pg){
                chain = chain.then(function(){
                  return pdf.getPage(pg).then(function(page){
                    return page.getTextContent().then(function(tc){
                      var items = (tc.items || []).slice();
                      items.sort(function (a, b) {
                        var ya = a.transform ? a.transform[5] : 0;
                        var yb = b.transform ? b.transform[5] : 0;
                        if (Math.abs(ya - yb) > 3) return yb - ya;
                        var xa = a.transform ? a.transform[4] : 0;
                        var xb = b.transform ? b.transform[4] : 0;
                        return xa - xb;
                      });
                      var pageLines = [];
                      var buf = [];
                      var lastY = null;
                      for (var ii = 0; ii < items.length; ii++) {
                        var it = items[ii];
                        var str = it.str || "";
                        if (!str.trim()) continue;
                        var y = it.transform ? it.transform[5] : 0;
                        if (lastY !== null && Math.abs(y - lastY) > 3) {
                          if (buf.length) pageLines.push(buf.join(" ").replace(/\s+/g, " ").trim());
                          buf = [];
                        }
                        buf.push(str);
                        lastY = y;
                      }
                      if (buf.length) pageLines.push(buf.join(" ").replace(/\s+/g, " ").trim());
                      pages.push(pageLines.join("\n"));
                    });
                  });
                });
              })(p);
            }
            chain.then(function(){
              var full = pages.join("\n");
              var items = LICSYSTEM.captacao.splitEdital(full);
              LICSYSTEM.state.captacaoLines = items;
              LICSYSTEM.state.capPage = 1;
              LICSYSTEM.captacao.render(items);
              showAlert("pdfStatus","ok","Texto extraído: "+items.length+" item(ns) com lote, quantidade, descrição e valores do edital.");
            });
          }).catch(function(err){
            showAlert("pdfStatus","error","Erro ao ler PDF: "+utils.escapeHtml(err.message));
          });
        };
        reader.readAsArrayBuffer(f);
      }).catch(function(err){
        showAlert("pdfStatus","error","Falha ao carregar pdf.js: "+utils.escapeHtml(err.message)+" — verifique a conexão.");
      });
    },

    // Uma <tr> por item, com checkbox individual — paginado (100/página)
    render:function(lines, filterAll){
      var kw = (el("pdfKeywords").value||"").split(",").map(function(s){return utils.fold(s).toLowerCase().trim();}).filter(Boolean);
      var body = el("captacaoBody");
      var data = lines || LICSYSTEM.state.captacaoLines || [];
      var filtered = data.map(function(l){ return utils.asCaptacaoItem(l); }).filter(function(it){
        return it && utils.isLinhaProdutoEdital(it);
      });
      if(kw.length && !filterAll){
        filtered = filtered.filter(function(it){
          var t = utils.fold(it.line || it.produto || "").toLowerCase();
          return kw.some(function(k){ return t.indexOf(k) !== -1; });
        });
      }
      LICSYSTEM.state.capFiltered = filtered;
      var size = LICSYSTEM.state.capPageSize || 100;
      var total = filtered.length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      if(!LICSYSTEM.state.capPage || LICSYSTEM.state.capPage < 1) LICSYSTEM.state.capPage = 1;
      if(LICSYSTEM.state.capPage > pages) LICSYSTEM.state.capPage = pages;

      if(!total){
        body.innerHTML='<tr><td colspan="4" class="muted" style="text-align:center;padding:24px">Nenhuma linha corresponde ao filtro.</td></tr>';
        LICSYSTEM.captacao.updatePager();
        return;
      }

      var page = LICSYSTEM.state.capPage;
      var start = (page - 1) * size;
      var end = Math.min(start + size, total);
      var html="";
      for(var idx = start; idx < end; idx++){
        var it = filtered[idx];
        if(!it) continue;
        var linha = it.line || ((it.lote ? it.lote + " " : "") + it.qtd + " " + (it.und||"UN") + " " + it.produto);
        var risco = utils.riscoMatch(linha);
        var flag = risco.length ? '<span class="risk-flag" title="Risco: '+utils.escapeHtml(risco.join(", "))+'">⚠</span>' : "";
        html+='<tr class="'+(risco.length?'risk-row':'')+'" data-item-idx="'+idx+'">'+
          '<td><input type="checkbox" class="capChk" data-idx="'+idx+'" aria-label="Selecionar item '+(idx+1)+'"></td>'+
          '<td>'+(idx+1)+'</td>'+
          '<td>'+flag+utils.escapeHtml(linha)+'</td>'+
          '<td><button type="button" class="btn btn-ghost btn-sm capGoogle" data-q="'+utils.escapeHtml(utils.nomeProdutoEdital(linha))+'">🔎 Google</button></td>'+
          '</tr>';
      }
      body.innerHTML = html;
      var all = el("capCheckAll");
      if(all) all.checked = false;
      LICSYSTEM.captacao.updatePager();
    },

    updatePager:function(){
      var pager = el("capPager");
      var info = el("capPagerInfo");
      var prev = el("capPrev");
      var next = el("capNext");
      var total = (LICSYSTEM.state.capFiltered || []).length;
      var size = LICSYSTEM.state.capPageSize || 100;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var page = LICSYSTEM.state.capPage || 1;
      if(!pager) return;
      if(total <= size){
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? ((page - 1) * size + 1) : 0;
      var end = Math.min(page * size, total);
      if(info) info.innerHTML = "Itens <b>"+start+"–"+end+"</b> de <b>"+total+"</b> · Página <b>"+page+"</b>/"+pages+" (100 por página)";
      if(prev) prev.disabled = page <= 1;
      if(next) next.disabled = page >= pages;
    },

    goPage:function(delta){
      var size = LICSYSTEM.state.capPageSize || 100;
      var total = (LICSYSTEM.state.capFiltered || []).length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var next = (LICSYSTEM.state.capPage || 1) + delta;
      if(next < 1) next = 1;
      if(next > pages) next = pages;
      LICSYSTEM.state.capPage = next;
      LICSYSTEM.captacao.render(LICSYSTEM.state.captacaoLines, false);
    },

    exportarPdf:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      if(!checks.length){ showAlert("pdfStatus","warn","Selecione ao menos um item para exportar."); return; }
      showAlert("pdfStatus","info",'<span class="spinner"></span> Gerando PDF…');
      var filtered = LICSYSTEM.state.capFiltered || [];
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"portrait"});
        return licsystemPdfHeader(doc,"Itens Selecionados do Edital").then(function(startY){
          var rows=[];
          checks.forEach(function(c,i){
            var idx = Number(c.getAttribute("data-idx"));
            var it = filtered[idx];
            var line = it ? (it.line || it.produto || "") : (c.getAttribute("data-line") || "");
            rows.push([i+1, line]);
          });
          doc.autoTable({
            startY:startY, head:[["#","Item / Descrição"]], body:rows,
            styles:{fontSize:9,cellPadding:3},
            headStyles:{fillColor:[21,38,66],textColor:255},
            columnStyles:{0:{cellWidth:14}},
            alternateRowStyles:{fillColor:[248,250,253]}
          });
          doc.save("edital-itens-selecionados.pdf");
          showAlert("pdfStatus","ok","PDF gerado com "+rows.length+" itens.");
        });
      }).catch(function(err){ showAlert("pdfStatus","error","Falha ao gerar PDF: "+utils.escapeHtml(err.message)); });
    },

    googleSelecionados:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      if(!checks.length){ showAlert("pdfStatus","warn","Selecione ao menos um item."); return; }
      var filtered = LICSYSTEM.state.capFiltered || [];
      var n=0;
      checks.forEach(function(c){
        if(n>=8) return;
        var idx = Number(c.getAttribute("data-idx"));
        var it = filtered[idx];
        var q = it ? (it.produto || it.line || "") : (c.getAttribute("data-line") || "");
        window.open("https://www.google.com/search?q="+encodeURIComponent(q),"_blank");
        n++;
      });
    },

    paraOrcamento:function(){
      var checks = document.querySelectorAll(".capChk:checked");
      var filtered = LICSYSTEM.state.capFiltered || [];
      var lines;
      if(checks.length){
        lines=[];
        checks.forEach(function(c){
          var idx = Number(c.getAttribute("data-idx"));
          var it = filtered[idx];
          if(it) lines.push(it);
          else if(c.getAttribute("data-line")) lines.push(c.getAttribute("data-line"));
        });
      } else {
        lines = (LICSYSTEM.state.captacaoLines || []).map(function(l){ return utils.asCaptacaoItem(l); }).filter(Boolean);
      }
      if(!lines.length){ showAlert("pdfStatus","warn","Nada para enviar. Extraia um edital primeiro."); return; }
      // Substitui a planilha (evita misturar import antigo quebrado no localStorage)
      LICSYSTEM.state.orcItems = [];
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.orcamento.addFromLines(lines);
      showAlert("pdfStatus","ok",lines.length+" item(ns) enviados ao Orçamento com lote, qtd, descrição e valores do edital.");
      if(window.__lsActivateView) window.__lsActivateView("orcamento");
    },

    /* ---------- Editais próximos (município + raio) ---------- */
    ORIGEM_KEY: "licsystem_origem_municipio_v1",
    _proxTimer: null,
    _proxBusy: false,
    _proxSuggestions: [],
    _proxActiveIdx: 0,
    _proxRaioTouched: false,
    _proxSuggestSeq: 0,
    _municipiosLocal: null,
    _municipiosLocalPromise: null,

    foldTxt: function (s) {
      return String(s || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
    },

    /** Dataset IBGE estático em /municipios.json (public/ → dist no build). */
    loadMunicipiosLocal: function () {
      if (LICSYSTEM.captacao._municipiosLocal) {
        return Promise.resolve(LICSYSTEM.captacao._municipiosLocal);
      }
      if (LICSYSTEM.captacao._municipiosLocalPromise) {
        return LICSYSTEM.captacao._municipiosLocalPromise;
      }
      LICSYSTEM.captacao._municipiosLocalPromise = fetch("/municipios.json", {
        credentials: "same-origin",
        cache: "force-cache",
      })
        .then(function (r) {
          var ctype = String((r.headers && r.headers.get("content-type")) || "");
          if (!r.ok) throw new Error("HTTP " + r.status);
          if (ctype.indexOf("json") === -1 && ctype.indexOf("text/html") !== -1) {
            throw new Error("municipios.json indisponível");
          }
          return r.json();
        })
        .then(function (list) {
          if (!Array.isArray(list)) throw new Error("Dataset inválido");
          LICSYSTEM.captacao._municipiosLocal = list;
          return list;
        })
        .catch(function (err) {
          LICSYSTEM.captacao._municipiosLocalPromise = null;
          throw err;
        });
      return LICSYSTEM.captacao._municipiosLocalPromise;
    },

    searchMunicipiosLocal: function (q, uf) {
      var term = LICSYSTEM.captacao.foldTxt(q);
      var ufFilter = String(uf || "")
        .trim()
        .toUpperCase();
      if (term.length < 2 && !ufFilter) return Promise.resolve([]);
      return LICSYSTEM.captacao.loadMunicipiosLocal().then(function (list) {
        var out = [];
        for (var j = 0; j < list.length; j++) {
          var m = list[j];
          if (ufFilter && m.u !== ufFilter) continue;
          if (term && LICSYSTEM.captacao.foldTxt(m.n).indexOf(term) === -1) continue;
          out.push({
            ibge: m.i,
            nome: m.n,
            uf: m.u,
            lat: m.a,
            lng: m.o,
          });
          if (out.length >= 30) break;
        }
        out.sort(function (a, b) {
          var an = LICSYSTEM.captacao.foldTxt(a.nome);
          var bn = LICSYSTEM.captacao.foldTxt(b.nome);
          var ap = term && an.indexOf(term) === 0 ? 0 : 1;
          var bp = term && bn.indexOf(term) === 0 ? 0 : 1;
          if (ap !== bp) return ap - bp;
          return an.localeCompare(bn, "pt-BR");
        });
        return out;
      });
    },

    /**
     * Autocomplete: prioriza /municipios.json (estático na Vercel).
     * /api/municipios fica como reforço; nunca depende só do serverless.
     */
    fetchMunicipios: function (q) {
      var term = String(q || "").trim();
      return LICSYSTEM.captacao.searchMunicipiosLocal(term).catch(function () {
        return fetch("/api/municipios?q=" + encodeURIComponent(term))
          .then(function (r) {
            return r.json().then(function (j) {
              if (!r.ok) throw new Error((j && j.error) || "HTTP " + r.status);
              return (j && j.municipios) || [];
            });
          });
      });
    },

    loadOrigem: function () {
      try {
        return JSON.parse(localStorage.getItem(LICSYSTEM.captacao.ORIGEM_KEY) || "null");
      } catch (e) {
        return null;
      }
    },

    saveOrigem: function (m) {
      if (!m || !m.ibge) return;
      var payload = {
        ibge: Number(m.ibge),
        nome: String(m.nome || ""),
        uf: String(m.uf || ""),
        lat: m.lat != null ? Number(m.lat) : null,
        lng: m.lng != null ? Number(m.lng) : null,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(LICSYSTEM.captacao.ORIGEM_KEY, JSON.stringify(payload));
      } catch (e) {}
      LICSYSTEM.captacao.refreshOrigemHint();
    },

    refreshOrigemHint: function () {
      var hint = el("proxOrigemHint");
      if (!hint) return;
      var m = LICSYSTEM.captacao.loadOrigem();
      if (!m || !m.ibge) {
        hint.textContent =
          "Digite o nome, clique na sugestão (ou Enter) e busque. Ex.: Ibaiti.";
        return;
      }
      hint.innerHTML =
        "Origem: <b>" +
        utils.escapeHtml(m.nome) +
        "</b> / " +
        utils.escapeHtml(m.uf) +
        " (IBGE " +
        utils.escapeHtml(String(m.ibge)) +
        ") — pronta para buscar.";
    },

    clearQuickPick: function () {
      var qp = el("proxQuickPick");
      if (!qp) return;
      qp.hidden = true;
      qp.innerHTML = "";
    },

    showQuickPick: function (m) {
      var qp = el("proxQuickPick");
      if (!qp || !m || !m.ibge) return;
      var label = (m.nome || "") + (m.uf ? "/" + m.uf : "");
      qp.innerHTML =
        '<button type="button" class="btn btn-sm btn-gold" id="btnProxUsarMatch">Usar ' +
        utils.escapeHtml(label) +
        "</button>" +
        ' <span class="small muted">único resultado — clique ou pressione Enter</span>';
      qp.hidden = false;
      var btn = el("btnProxUsarMatch");
      if (btn) {
        btn.addEventListener("click", function () {
          LICSYSTEM.captacao.selectMunicipio(m);
        });
      }
    },

    applyCoberturaPreset: function (opts) {
      opts = opts || {};
      var sel = el("proxCobertura");
      var raioEl = el("proxRaio");
      var hint = el("proxCoberturaHint");
      var cobertura = sel ? String(sel.value || "") : "";
      if (cobertura === "pr-sp") {
        if (raioEl) {
          var atual = Number(raioEl.value);
          var shouldBump =
            opts.forceBump ||
            !LICSYSTEM.captacao._proxRaioTouched ||
            !Number.isFinite(atual) ||
            atual <= 250;
          if (shouldBump && (!Number.isFinite(atual) || atual < 450)) {
            raioEl.value = "500";
          }
        }
        var raioNow = raioEl ? Number(raioEl.value) : 500;
        if (hint) {
          if (Number.isFinite(raioNow) && raioNow < 400) {
            hint.innerHTML =
              "Cobertura PR + divisas SP: com raio " +
              raioNow +
              " km a área fica estreita. <b>Sugestão: 500 km</b> (atalho abaixo) para cobrir bem o Paraná e a fronteira com SP.";
          } else {
            hint.textContent =
              "Preset: consulta PR (estado inteiro) + SP no raio da origem. Raio sugerido 500 km (editável; máx. 700).";
          }
        }
      } else if (hint) {
        hint.textContent =
          "Raio livre: até 700 km. Municípios das UFs dentro do raio. Padrão 250 km.";
      }
    },

    initProximos: function () {
      var input = el("proxMunicipio");
      var ibge = el("proxIbge");
      var box = el("proxSuggest");
      if (!input || !ibge) return;

      /* Pré-carrega lista estática para o autocomplete não esperar cold start. */
      LICSYSTEM.captacao.loadMunicipiosLocal().catch(function () {});

      var saved = LICSYSTEM.captacao.loadOrigem();
      if (saved && saved.ibge) {
        input.value = (saved.nome || "") + (saved.uf ? " / " + saved.uf : "");
        ibge.value = String(saved.ibge);
      }
      LICSYSTEM.captacao.refreshOrigemHint();
      LICSYSTEM.captacao.applyCoberturaPreset({ forceBump: false });

      if (input._proxWired) return;
      input._proxWired = true;

      input.addEventListener("input", function () {
        ibge.value = "";
        LICSYSTEM.captacao.clearQuickPick();
        var q = String(input.value || "").trim();
        clearTimeout(LICSYSTEM.captacao._proxTimer);
        if (q.length < 2) {
          LICSYSTEM.captacao._proxSuggestions = [];
          if (box) {
            box.hidden = true;
            box.innerHTML = "";
          }
          return;
        }
        LICSYSTEM.captacao._proxTimer = setTimeout(function () {
          LICSYSTEM.captacao.suggestMunicipios(q);
        }, 220);
      });

      input.addEventListener("keydown", function (e) {
        var list = LICSYSTEM.captacao._proxSuggestions || [];
        if (e.key === "ArrowDown" && list.length) {
          e.preventDefault();
          LICSYSTEM.captacao._proxActiveIdx = Math.min(
            list.length - 1,
            (LICSYSTEM.captacao._proxActiveIdx || 0) + 1
          );
          LICSYSTEM.captacao._paintSuggestActive();
          return;
        }
        if (e.key === "ArrowUp" && list.length) {
          e.preventDefault();
          LICSYSTEM.captacao._proxActiveIdx = Math.max(
            0,
            (LICSYSTEM.captacao._proxActiveIdx || 0) - 1
          );
          LICSYSTEM.captacao._paintSuggestActive();
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          if (list.length) {
            var idx = Math.max(
              0,
              Math.min(list.length - 1, LICSYSTEM.captacao._proxActiveIdx || 0)
            );
            LICSYSTEM.captacao.selectMunicipio(list[idx]);
            return;
          }
          LICSYSTEM.captacao.resolveMunicipioFromInput().then(function (m) {
            if (m) LICSYSTEM.captacao.selectMunicipio(m);
            else
              showAlert(
                "proxAlert",
                "info",
                "Nenhum município encontrado para esse texto. Digite pelo menos 2 letras e escolha na lista."
              );
          });
        }
        if (e.key === "Escape" && box) {
          box.hidden = true;
        }
      });

      input.addEventListener("blur", function () {
        setTimeout(function () {
          if (box) box.hidden = true;
        }, 200);
      });

      input.addEventListener("focus", function () {
        if (
          box &&
          LICSYSTEM.captacao._proxSuggestions &&
          LICSYSTEM.captacao._proxSuggestions.length &&
          !ibge.value
        ) {
          box.hidden = false;
        }
      });

      if (box) {
        box.addEventListener("mousedown", function (e) {
          var btn = e.target.closest("button[data-ibge]");
          if (!btn) return;
          e.preventDefault();
          LICSYSTEM.captacao.selectMunicipio({
            ibge: Number(btn.getAttribute("data-ibge")),
            nome: btn.getAttribute("data-nome") || "",
            uf: btn.getAttribute("data-uf") || "",
            lat: Number(btn.getAttribute("data-lat") || 0) || null,
            lng: Number(btn.getAttribute("data-lng") || 0) || null,
          });
        });
      }

      var raioEl = el("proxRaio");
      if (raioEl && !raioEl._proxWired) {
        raioEl._proxWired = true;
        raioEl.addEventListener("change", function () {
          LICSYSTEM.captacao._proxRaioTouched = true;
          LICSYSTEM.captacao.applyCoberturaPreset();
        });
        raioEl.addEventListener("input", function () {
          LICSYSTEM.captacao._proxRaioTouched = true;
        });
      }

      var cob = el("proxCobertura");
      if (cob && !cob._proxWired) {
        cob._proxWired = true;
        cob.addEventListener("change", function () {
          if (String(cob.value || "") === "pr-sp") {
            LICSYSTEM.captacao._proxRaioTouched = false;
          }
          LICSYSTEM.captacao.applyCoberturaPreset({ forceBump: true });
        });
      }
    },

    _paintSuggestActive: function () {
      var box = el("proxSuggest");
      if (!box) return;
      var buttons = box.querySelectorAll("button[data-ibge]");
      var idx = LICSYSTEM.captacao._proxActiveIdx || 0;
      for (var i = 0; i < buttons.length; i++) {
        if (i === idx) buttons[i].classList.add("sg-active");
        else buttons[i].classList.remove("sg-active");
      }
      if (buttons[idx] && buttons[idx].scrollIntoView) {
        buttons[idx].scrollIntoView({ block: "nearest" });
      }
    },

    pickBestMunicipio: function (arr, q) {
      if (!arr || !arr.length) return null;
      var term = LICSYSTEM.captacao.foldTxt(q);
      if (!term) return arr[0];
      var exact = [];
      var starts = [];
      for (var i = 0; i < arr.length; i++) {
        var fn = LICSYSTEM.captacao.foldTxt(arr[i].nome);
        if (fn === term) exact.push(arr[i]);
        else if (fn.indexOf(term) === 0) starts.push(arr[i]);
      }
      if (exact.length === 1) return exact[0];
      if (exact.length > 1) {
        var pr = exact.filter(function (m) {
          return String(m.uf || "").toUpperCase() === "PR";
        });
        if (pr.length === 1) return pr[0];
        return exact[0];
      }
      if (arr.length === 1) return arr[0];
      if (starts.length === 1) return starts[0];
      return null;
    },

    resolveMunicipioFromInput: function () {
      var input = el("proxMunicipio");
      var q = String((input && input.value) || "")
        .split("/")[0]
        .trim();
      if (q.length < 2) return Promise.resolve(null);
      var cached = LICSYSTEM.captacao.pickBestMunicipio(
        LICSYSTEM.captacao._proxSuggestions,
        q
      );
      if (cached) return Promise.resolve(cached);
      return LICSYSTEM.captacao
        .fetchMunicipios(q)
        .then(function (arr) {
          LICSYSTEM.captacao._proxSuggestions = arr || [];
          return LICSYSTEM.captacao.pickBestMunicipio(arr, q);
        })
        .catch(function () {
          return null;
        });
    },

    suggestMunicipios: function (q) {
      var box = el("proxSuggest");
      if (!box) return;
      var seq = ++LICSYSTEM.captacao._proxSuggestSeq;
      LICSYSTEM.captacao
        .fetchMunicipios(q)
        .then(function (arr) {
          if (seq !== LICSYSTEM.captacao._proxSuggestSeq) return;
          arr = arr || [];
          LICSYSTEM.captacao._proxSuggestions = arr;
          LICSYSTEM.captacao._proxActiveIdx = 0;
          LICSYSTEM.captacao.clearQuickPick();
          if (!arr.length) {
            box.innerHTML =
              '<div class="small muted" style="padding:10px 12px">Nenhum município encontrado. Tente outro nome.</div>';
            box.hidden = false;
            return;
          }
          var best = LICSYSTEM.captacao.pickBestMunicipio(arr, q);
          /* Único resultado (ex.: Ibaiti): auto-seleciona e confirma visualmente. */
          if (arr.length === 1 && best) {
            LICSYSTEM.captacao.selectMunicipio(best);
            showAlert(
              "proxAlert",
              "ok",
              "Município selecionado: <b>" +
                utils.escapeHtml(best.nome) +
                " / " +
                utils.escapeHtml(best.uf) +
                "</b>. Pode clicar em Buscar no raio."
            );
            return;
          }
          if (best && LICSYSTEM.captacao.foldTxt(best.nome) === LICSYSTEM.captacao.foldTxt(q)) {
            LICSYSTEM.captacao.selectMunicipio(best);
            showAlert(
              "proxAlert",
              "ok",
              "Município selecionado: <b>" +
                utils.escapeHtml(best.nome) +
                " / " +
                utils.escapeHtml(best.uf) +
                "</b>. Pode clicar em Buscar no raio."
            );
            return;
          }
          box.innerHTML = arr
            .map(function (m, i) {
              return (
                '<button type="button" class="' +
                (i === 0 ? "sg-active" : "") +
                '" data-ibge="' +
                utils.escapeHtml(String(m.ibge)) +
                '" data-nome="' +
                utils.escapeHtml(m.nome) +
                '" data-uf="' +
                utils.escapeHtml(m.uf) +
                '" data-lat="' +
                utils.escapeHtml(String(m.lat)) +
                '" data-lng="' +
                utils.escapeHtml(String(m.lng)) +
                '"><span class="sg-uf">' +
                utils.escapeHtml(m.uf) +
                "</span>" +
                utils.escapeHtml(m.nome) +
                "</button>"
              );
            })
            .join("");
          box.hidden = false;
          if (best) LICSYSTEM.captacao.showQuickPick(best);
        })
        .catch(function () {
          if (seq !== LICSYSTEM.captacao._proxSuggestSeq) return;
          LICSYSTEM.captacao._proxSuggestions = [];
          LICSYSTEM.captacao.clearQuickPick();
          box.innerHTML =
            '<div class="small muted" style="padding:10px 12px">Não foi possível carregar municípios. Atualize o site (Ctrl+F5) ou tente novamente.</div>';
          box.hidden = false;
        });
    },

    selectMunicipio: function (m) {
      var input = el("proxMunicipio");
      var ibge = el("proxIbge");
      var box = el("proxSuggest");
      if (!m || !m.ibge) return;
      if (input) input.value = m.nome + (m.uf ? " / " + m.uf : "");
      if (ibge) ibge.value = String(m.ibge);
      if (box) {
        box.hidden = true;
        box.innerHTML = "";
      }
      LICSYSTEM.captacao._proxSuggestions = [m];
      LICSYSTEM.captacao._proxActiveIdx = 0;
      LICSYSTEM.captacao.clearQuickPick();
      hideAlert("proxAlert");
      LICSYSTEM.captacao.saveOrigem(m);
    },

    formatProxDate: function (iso) {
      if (!iso) return "—";
      try {
        var d = new Date(iso);
        if (isNaN(d.getTime())) return String(iso);
        return d.toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch (e) {
        return String(iso);
      }
    },

    buscarProximos: function () {
      if (LICSYSTEM.captacao._proxBusy) return;
      hideAlert("proxAlert");
      var ibgeEl = el("proxIbge");
      var ibge = Number((ibgeEl && ibgeEl.value) || 0);
      if (ibge) {
        LICSYSTEM.captacao._runBuscarProximos(ibge);
        return;
      }
      var typed = String((el("proxMunicipio") && el("proxMunicipio").value) || "").trim();
      if (typed.length < 2) {
        showAlert(
          "proxAlert",
          "info",
          "Informe o município de origem (ex.: Ibaiti). Digite o nome e escolha na lista, ou pressione Enter."
        );
        var inp = el("proxMunicipio");
        if (inp) inp.focus();
        return;
      }
      LICSYSTEM.captacao._proxBusy = true;
      var btnWait = el("btnProxBuscar");
      if (btnWait) btnWait.disabled = true;
      LICSYSTEM.captacao
        .resolveMunicipioFromInput()
        .then(function (m) {
          LICSYSTEM.captacao._proxBusy = false;
          if (btnWait) btnWait.disabled = false;
          if (!m || !m.ibge) {
            showAlert(
              "proxAlert",
              "info",
              "Não deu para confirmar o município só com o texto digitado. Clique na sugestão da lista (ou use Enter quando houver um único resultado)."
            );
            var inp2 = el("proxMunicipio");
            if (inp2) {
              inp2.focus();
              LICSYSTEM.captacao.suggestMunicipios(
                typed.split("/")[0].trim()
              );
            }
            return;
          }
          LICSYSTEM.captacao.selectMunicipio(m);
          LICSYSTEM.captacao._runBuscarProximos(Number(m.ibge));
        })
        .catch(function () {
          LICSYSTEM.captacao._proxBusy = false;
          if (btnWait) btnWait.disabled = false;
          showAlert(
            "proxAlert",
            "error",
            "Falha ao confirmar o município. Recarregue a página e tente de novo (autocomplete usa a lista local IBGE)."
          );
        });
    },

    _runBuscarProximos: function (ibge) {
      var raio = Number((el("proxRaio") && el("proxRaio").value) || 250);
      var cobertura = (el("proxCobertura") && el("proxCobertura").value) || "";
      var kw = (el("proxKeywords") && el("proxKeywords").value) || "";
      var ampliar = !!(el("proxAmpliar") && el("proxAmpliar").checked);
      var leiloes = !el("proxLeiloes") || !!(el("proxLeiloes") && el("proxLeiloes").checked);
      var federal = !!(el("proxFederal") && el("proxFederal").checked);
      var janela = (el("proxJanela") && el("proxJanela").value) || "ano";

      if (!Number.isFinite(raio) || raio < 10) raio = 250;
      if (raio > 700) raio = 700;
      if (el("proxRaio")) el("proxRaio").value = String(raio);

      if (cobertura === "pr-sp" && raio < 400) {
        LICSYSTEM.captacao.applyCoberturaPreset();
      }

      var saved = LICSYSTEM.captacao.loadOrigem();
      if (!saved || Number(saved.ibge) !== ibge) {
        var nomeTxt = ((el("proxMunicipio") && el("proxMunicipio").value) || "")
          .split("/")[0]
          .trim();
        LICSYSTEM.captacao.saveOrigem({
          ibge: ibge,
          nome: nomeTxt,
          uf: (saved && saved.uf) || "",
        });
      }

      LICSYSTEM.captacao._proxBusy = true;
      var btn = el("btnProxBuscar");
      if (btn) btn.disabled = true;
      if (el("proxMeta")) el("proxMeta").textContent = "";
      LICSYSTEM.captacao._proxList = [];
      LICSYSTEM.captacao._proxData = null;
      LICSYSTEM.state.proxPage = 1;
      LICSYSTEM.captacao.updateProxPager();
      LICSYSTEM.captacao.updateCollapseSummary("prox", "");
      el("proxResults").innerHTML =
        '<div class="muted small"><span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Consultando PNCP no raio (horizonte ' +
        (janela === "45" ? "45 dias" : "anual") +
        ")… isso pode levar alguns segundos.</div>";

      var url =
        "/api/editais-proximos?ibge=" +
        encodeURIComponent(ibge) +
        "&raio=" +
        encodeURIComponent(raio) +
        "&janela=" +
        encodeURIComponent(janela) +
        (cobertura ? "&cobertura=" + encodeURIComponent(cobertura) : "") +
        (kw ? "&q=" + encodeURIComponent(kw) : "") +
        (ampliar ? "&ampliar=1" : "") +
        (leiloes ? "&leiloes=1" : "") +
        (federal ? "&esferas=M,E,F" : "&esferas=M,E");

      var proxCtrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var proxTimer = null;
      if (proxCtrl) {
        proxTimer = setTimeout(function () {
          try {
            proxCtrl.abort();
          } catch (e) {}
        }, 90000);
      }

      fetch(url, proxCtrl ? { signal: proxCtrl.signal } : undefined)
        .then(function (r) {
          return utils.parseApiResponse(r);
        })
        .then(function (j) {
          LICSYSTEM.captacao._renderProximos(j);
        })
        .catch(function (err) {
          el("proxResults").innerHTML = "";
          LICSYSTEM.captacao._proxList = [];
          LICSYSTEM.captacao.updateProxPager();
          LICSYSTEM.captacao.updateCollapseSummary("prox", "");
          var aborted =
            err &&
            (err.name === "AbortError" || /aborted|timeout/i.test(String(err.message || "")));
          showAlert(
            "proxAlert",
            "error",
            aborted
              ? "A consulta ao PNCP excedeu o tempo limite (90s). O portal pode estar lento — tente de novo ou use janela 45 dias. " +
                utils.apiHintHtml()
              : "Não foi possível buscar editais no PNCP (" +
                utils.escapeHtml(utils.formatApiError(err)) +
                "). A seleção de município funciona offline. " +
                utils.apiHintHtml()
          );
        })
        .then(function () {
          if (proxTimer) clearTimeout(proxTimer);
          LICSYSTEM.captacao._proxBusy = false;
          if (btn) btn.disabled = false;
        });
    },

    _renderProximos: function (j) {
      var box = el("proxResults");
      var meta = el("proxMeta");
      if (!box) return;
      var origem = (j && j.origem) || {};
      var list = (j && j.editais) || [];

      if (origem && origem.ibge) {
        LICSYSTEM.captacao.saveOrigem({
          ibge: origem.ibge,
          nome: origem.nome,
          uf: origem.uf,
          lat: origem.lat,
          lng: origem.lng,
        });
      }

      LICSYSTEM.captacao._proxData = j || {};
      LICSYSTEM.captacao._proxList = list;
      LICSYSTEM.state.proxPage = 1;

      if (meta) {
        meta.textContent =
          "Origem: " +
          (origem.nome || "—") +
          "/" +
          (origem.uf || "—") +
          " · raio " +
          (j.raioKm || "—") +
          " km" +
          (j.cobertura === "pr-sp" ? " · cobertura Paraná + divisas SP" : "") +
          " · " +
          (j.janelaLabel || "janela anual") +
          (j.dataFinalPncp ? " até " + j.dataFinalPncp : "") +
          " · " +
          (j.municipiosNoRaio || 0) +
          " municípios no raio · UFs: " +
          ((j.ufsConsultadas || []).join(", ") || "—") +
          " · " +
          (j.total || list.length || 0) +
          " edital(is)";
      }

      LICSYSTEM.captacao.updateCollapseSummary(
        "prox",
        (j.total || list.length || 0) + " edital(is)…"
      );

      if (!list.length) {
        var proxErros = (j && j.errosParciais) || [];
        var proxErroTxt = proxErros.length
          ? " Falhas parciais no PNCP: " +
            proxErros
              .slice(0, 3)
              .map(function (e) {
                return (
                  (e.uf || e.ibge || "?") +
                  " — " +
                  (e.error || "erro")
                );
              })
              .join("; ") +
            "."
          : "";
        box.innerHTML =
          '<div class="muted small">Nenhuma proposta com encerramento no horizonte ' +
          utils.escapeHtml(j.janelaLabel || "anual") +
          " encontrada no raio" +
          (j.totalBrutoPncp
            ? " (o PNCP retornou " +
              j.totalBrutoPncp +
              " registro(s) nas UFs consultadas, mas nenhum ficou dentro do raio/filtros)."
            : ".") +
          proxErroTxt +
          (j.estrategia === "municipio-fallback"
            ? " Estratégia: fallback por município (UF indisponível no PNCP)."
            : "") +
          " Tente aumentar o raio, marcar Incluir leilões, ampliar modalidades ou limpar as palavras-chave. Leilões de veículos/sucata muitas vezes não estão no PNCP.</div>";
        LICSYSTEM.captacao.updateProxPager();
        showAlert(
          "proxAlert",
          proxErros.length && !j.totalBrutoPncp ? "error" : "info",
          proxErros.length && !j.totalBrutoPncp
            ? "PNCP falhou em parte das consultas — sem editais utilizáveis. " +
              utils.escapeHtml(
                (proxErros[0] && proxErros[0].error) || "Erro no portal"
              ) +
              "."
            : "Consulta concluída — nenhum edital no raio com os filtros atuais. Fonte: PNCP (dados reais; sem resultados inventados)."
        );
        return;
      }

      list.forEach(function (o) {
        LICSYSTEM.state.pncpAlerts.push({
          orgao: o.orgao || "Órgão público",
          uf: o.uf || "",
          objeto: o.objeto || "",
        });
      });
      LICSYSTEM.updateBell();
      LICSYSTEM.dashboard.renderPncp();

      LICSYSTEM.captacao.paintProximosPage();
      showAlert(
        "proxAlert",
        "ok",
        list.length +
          " edital(is) com proposta em aberto no raio de " +
          (j.raioKm || "—") +
          " km · " +
          (j.janelaLabel || "janela anual") +
          " (fonte PNCP)."
      );
    },

    paintProximosPage: function () {
      var box = el("proxResults");
      if (!box) return;
      var list = LICSYSTEM.captacao._proxList || [];
      var j = LICSYSTEM.captacao._proxData || {};
      var size = LICSYSTEM.state.proxPageSize || 50;
      var total = list.length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      if (!LICSYSTEM.state.proxPage || LICSYSTEM.state.proxPage < 1) LICSYSTEM.state.proxPage = 1;
      if (LICSYSTEM.state.proxPage > pages) LICSYSTEM.state.proxPage = pages;
      var page = LICSYSTEM.state.proxPage;
      var start = (page - 1) * size;
      var end = Math.min(start + size, total);

      if (!total) {
        LICSYSTEM.captacao.updateProxPager();
        return;
      }

      var html = '<div style="display:flex;flex-direction:column;gap:10px">';
      for (var i = start; i < end; i++) {
        var o = list[i];
        if (!o) continue;
        var border =
          o.esfera === "E" ? "r-yellow" : o.esfera === "F" ? "r-red" : "r-green";
        html +=
          '<div class="result-item ' +
          border +
          '">' +
          '<div class="ri-head">' +
          '<div class="ri-title">' +
          utils.escapeHtml(o.orgao || "Órgão") +
          ' <span class="badge-status b-yellow">' +
          utils.escapeHtml(o.uf || "") +
          "</span></div>" +
          '<div class="prox-dist">' +
          (o.distanciaKm != null ? o.distanciaKm + " km" : "") +
          "</div>" +
          "</div>" +
          '<div class="ri-sub">' +
          utils.escapeHtml(o.municipio || "—") +
          " · " +
          utils.escapeHtml(o.esferaNome || o.esfera || "—") +
          " · " +
          utils.escapeHtml(o.modalidade || "—") +
          "</div>" +
          '<div class="ri-sub" style="margin-top:6px">' +
          utils.escapeHtml(o.objeto || "") +
          "</div>" +
          '<div class="ri-grid">' +
          '<div class="ri-metric"><div class="m-l">Abertura</div><div class="m-v" style="font-size:12px">' +
          utils.escapeHtml(LICSYSTEM.captacao.formatProxDate(o.dataAbertura)) +
          "</div></div>" +
          '<div class="ri-metric"><div class="m-l">Encerramento</div><div class="m-v" style="font-size:12px">' +
          utils.escapeHtml(LICSYSTEM.captacao.formatProxDate(o.dataEncerramento)) +
          "</div></div>" +
          (o.valorEstimado != null
            ? '<div class="ri-metric"><div class="m-l">Estimado</div><div class="m-v" style="font-size:12px">' +
              utils.formatBrl(o.valorEstimado) +
              "</div></div>"
            : "") +
          "</div>" +
          (o.link
            ? '<div style="margin-top:8px"><a class="link" target="_blank" rel="noopener" href="' +
              utils.escapeHtml(o.link) +
              '">Abrir no PNCP ↗</a></div>'
            : "") +
          "</div>";
      }
      html += "</div>";
      if (j.avisos && j.avisos.length && page === 1) {
        html +=
          '<div class="small muted" style="margin-top:10px">' +
          j.avisos
            .map(function (a) {
              return "• " + utils.escapeHtml(a);
            })
            .join("<br/>") +
          "</div>";
      }
      box.innerHTML = html;
      LICSYSTEM.captacao.updateProxPager();
    },

    updateProxPager: function () {
      var pager = el("proxPager");
      var info = el("proxPagerInfo");
      var prev = el("proxPrev");
      var next = el("proxNext");
      var total = (LICSYSTEM.captacao._proxList || []).length;
      var size = LICSYSTEM.state.proxPageSize || 50;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var page = LICSYSTEM.state.proxPage || 1;
      if (!pager) return;
      if (total <= size) {
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? (page - 1) * size + 1 : 0;
      var end = Math.min(page * size, total);
      if (info)
        info.innerHTML =
          "Itens <b>" +
          start +
          "–" +
          end +
          "</b> de <b>" +
          total +
          "</b> · Página <b>" +
          page +
          "</b>/" +
          pages +
          " (50 por página)";
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= pages;
    },

    goProxPage: function (delta) {
      var size = LICSYSTEM.state.proxPageSize || 50;
      var total = (LICSYSTEM.captacao._proxList || []).length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var next = (LICSYSTEM.state.proxPage || 1) + delta;
      if (next < 1) next = 1;
      if (next > pages) next = pages;
      if (next === LICSYSTEM.state.proxPage) return;
      LICSYSTEM.state.proxPage = next;
      LICSYSTEM.captacao.paintProximosPage();
    },

    /* ---------- Perguntar editais (chat helper) ---------- */
    initChatEditais: function () {
      if (LICSYSTEM.captacao._chatWired) return;
      LICSYSTEM.captacao._chatWired = true;
      var msg = el("chatEditalMsg");
      if (msg) {
        msg.addEventListener("keydown", function (e) {
          if (e.key === "Enter") {
            e.preventDefault();
            LICSYSTEM.captacao.buscarChatEditais();
          }
        });
      }
      document.querySelectorAll("[data-chat-prompt]").forEach(function (btn) {
        btn.addEventListener("click", function () {
          LICSYSTEM.captacao.runChatPrompt(btn.getAttribute("data-chat-prompt"));
        });
      });
    },

    runChatPrompt: function (id) {
      var cat = el("chatEditalCat");
      var msg = el("chatEditalMsg");
      var map = {
        "norte-pioneiro": { regiao: "norte-pioneiro", categoria: "", label: "Norte Pioneiro do Paraná (todos os editais abertos)" },
        "norte-comida": { regiao: "norte-pioneiro", categoria: "comida,cestas,cafe", label: "Norte Pioneiro · comida / cestas / café" },
        "norte-reforma": { regiao: "norte-pioneiro", categoria: "reforma", label: "Norte Pioneiro · reformas" },
        "norte-natal": { regiao: "norte-pioneiro", categoria: "natal", label: "Norte Pioneiro · Natal" },
        "norte-eletro": { regiao: "norte-pioneiro", categoria: "eletro", label: "Norte Pioneiro · eletrodomésticos" },
      };
      var p = map[id];
      if (!p) return;
      if (msg) msg.value = p.label;
      if (cat) {
        var first = String(p.categoria || "").split(",")[0] || "";
        cat.value = first;
      }
      LICSYSTEM.captacao._runChatEditais({
        regiao: p.regiao,
        categoria: p.categoria,
      });
    },

    buscarChatEditais: function () {
      var texto = String((el("chatEditalMsg") && el("chatEditalMsg").value) || "").trim();
      var cat = (el("chatEditalCat") && el("chatEditalCat").value) || "";
      if (!texto && !cat) {
        showAlert(
          "chatEditalAlert",
          "info",
          "Digite o nome da cidade (ex.: Santa Cruz do Rio Pardo), uma pergunta (ex.: Quais licitações terão em Ibaiti) ou use um atalho do Norte Pioneiro."
        );
        return;
      }
      var opts = { mensagem: texto };
      if (cat) opts.categoria = cat;
      // Atalho textual: se o usuário só escreveu "norte pioneiro"
      var folded = utils.fold(texto).toLowerCase();
      if (/norte\s*pioneiro/.test(folded) && texto.length < 40) {
        opts.regiao = "norte-pioneiro";
        opts.mensagem = "";
      }
      LICSYSTEM.captacao._runChatEditais(opts);
    },

    _runChatEditais: function (opts) {
      if (LICSYSTEM.captacao._chatBusy) return;
      opts = opts || {};
      hideAlert("chatEditalAlert");
      var ampliar = !!(el("chatEditalAmpliar") && el("chatEditalAmpliar").checked);
      var leiloes = !el("chatEditalLeiloes") || !!(el("chatEditalLeiloes") && el("chatEditalLeiloes").checked);
      var janela = (el("chatEditalJanela") && el("chatEditalJanela").value) || "ano";
      var body = {
        mensagem: opts.mensagem || undefined,
        regiao: opts.regiao || undefined,
        municipio: opts.municipio || undefined,
        categoria: opts.categoria || undefined,
        ampliar: ampliar ? "1" : undefined,
        leiloes: leiloes ? "1" : undefined,
        janela: janela,
        esferas: "M,E",
      };
      Object.keys(body).forEach(function (k) {
        if (body[k] == null || body[k] === "") delete body[k];
      });

      LICSYSTEM.captacao._chatBusy = true;
      var btn = el("btnChatEdital");
      if (btn) btn.disabled = true;
      if (el("chatEditalMeta")) el("chatEditalMeta").textContent = "";
      LICSYSTEM.captacao._chatList = [];
      LICSYSTEM.captacao._chatData = null;
      LICSYSTEM.state.chatPage = 1;
      LICSYSTEM.captacao.updateChatPager();
      LICSYSTEM.captacao.updateCollapseSummary("chat", "");
      if (el("chatEditalResults")) {
        el("chatEditalResults").innerHTML =
          '<div class="muted small"><span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Consultando PNCP (' +
          (janela === "45" ? "45 dias" : "horizonte anual") +
          ")… isso pode levar alguns segundos.</div>";
      }

      var chatCtrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var chatTimer = null;
      if (chatCtrl) {
        chatTimer = setTimeout(function () {
          try {
            chatCtrl.abort();
          } catch (e) {}
        }, 90000);
      }

      fetch("/api/editais-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: chatCtrl ? chatCtrl.signal : undefined,
      })
        .then(function (r) {
          return utils.parseApiResponse(r);
        })
        .then(function (j) {
          LICSYSTEM.captacao._renderChatEditais(j);
        })
        .catch(function (err) {
          if (el("chatEditalResults")) el("chatEditalResults").innerHTML = "";
          LICSYSTEM.captacao._chatList = [];
          LICSYSTEM.captacao.updateChatPager();
          LICSYSTEM.captacao.updateCollapseSummary("chat", "");
          var aborted =
            err &&
            (err.name === "AbortError" || /aborted|timeout/i.test(String(err.message || "")));
          showAlert(
            "chatEditalAlert",
            "error",
            aborted
              ? "A consulta ao PNCP excedeu o tempo limite (90s). O portal pode estar lento — tente de novo (Norte Pioneiro consulta vários municípios). " +
                utils.apiHintHtml()
              : "Não foi possível consultar editais (" +
                utils.escapeHtml(utils.formatApiError(err)) +
                "). " +
                utils.apiHintHtml()
          );
        })
        .then(function () {
          if (chatTimer) clearTimeout(chatTimer);
          LICSYSTEM.captacao._chatBusy = false;
          if (btn) btn.disabled = false;
        });
    },

    _renderChatEditais: function (j) {
      var box = el("chatEditalResults");
      var meta = el("chatEditalMeta");
      if (!box) return;
      var escopo = (j && j.escopo) || {};
      var list = (j && j.editais) || [];

      var onde =
        escopo.tipo === "regiao"
          ? (escopo.nome || "Região") +
            " · " +
            (escopo.municipios || 0) +
            " municípios"
          : (escopo.nome || "—") + "/" + (escopo.uf || "—");

      LICSYSTEM.captacao._chatData = j || {};
      LICSYSTEM.captacao._chatList = list;
      LICSYSTEM.captacao._chatOnde = onde;
      LICSYSTEM.state.chatPage = 1;

      if (meta) {
        meta.textContent =
          onde +
          " · " +
          (j.janelaLabel || "janela anual") +
          (j.dataFinalPncp ? " até " + j.dataFinalPncp : "") +
          " · " +
          (j.total || list.length || 0) +
          " edital(is)" +
          (j.categorias && j.categorias.length
            ? " · categorias: " + j.categorias.join(", ")
            : "") +
          " · UFs: " +
          ((j.ufsConsultadas || []).join(", ") || "—");
      }

      LICSYSTEM.captacao.updateCollapseSummary(
        "chat",
        (j.total || list.length || 0) + " edital(is)…"
      );

      if (!list.length) {
        var amostra = (j && j.amostraMunicipios) || [];
        var amostraTxt = amostra.length
          ? " Municípios nos registros brutos do PNCP: " +
            amostra
              .slice(0, 8)
              .map(function (a) {
                return (
                  (a.municipio || "?") +
                  (a.uf ? "/" + a.uf : "") +
                  " (" +
                  (a.qtd || 0) +
                  ")"
                );
              })
              .join(", ") +
            "."
          : "";
        var chatErros = (j && j.errosParciais) || [];
        var chatErroTxt = chatErros.length
          ? " Falhas parciais no PNCP: " +
            chatErros
              .slice(0, 3)
              .map(function (e) {
                return (
                  (e.ibge || e.uf || "?") +
                  " — " +
                  (e.error || "erro")
                );
              })
              .join("; ") +
            "."
          : "";
        box.innerHTML =
          '<div class="muted small">Nenhuma proposta com encerramento no horizonte ' +
          utils.escapeHtml(j.janelaLabel || "anual") +
          " no PNCP para este escopo" +
          (j.totalBrutoPncp
            ? " (PNCP retornou " +
              j.totalBrutoPncp +
              " registro(s) brutos; nenhum passou no filtro de município/categoria)."
            : ".") +
          amostraTxt +
          chatErroTxt +
          (j.dataFinalPncp
            ? " dataFinal PNCP até " + j.dataFinalPncp + "."
            : "") +
          " Se o edital existir só no portal da prefeitura, não aparece aqui. Leilões de veículos/sucata muitas vezes não estão no PNCP (sites especializados).</div>";
        LICSYSTEM.captacao.updateChatPager();
        showAlert(
          "chatEditalAlert",
          chatErros.length && !j.totalBrutoPncp ? "error" : "info",
          chatErros.length && !j.totalBrutoPncp
            ? "PNCP falhou em parte das consultas — sem editais utilizáveis."
            : "Consulta concluída — sem resultados com os filtros atuais (dados reais do PNCP)."
        );
        return;
      }

      list.forEach(function (o) {
        LICSYSTEM.state.pncpAlerts.push({
          orgao: o.orgao || "Órgão público",
          uf: o.uf || "",
          objeto: o.objeto || "",
        });
      });
      LICSYSTEM.updateBell();
      LICSYSTEM.dashboard.renderPncp();

      LICSYSTEM.captacao.paintChatPage();
      showAlert(
        "chatEditalAlert",
        "ok",
        list.length +
          " edital(is) com encerramento no horizonte " +
          utils.escapeHtml(j.janelaLabel || "anual") +
          " para " +
          utils.escapeHtml(onde) +
          " (PNCP)."
      );
    },

    paintChatPage: function () {
      var box = el("chatEditalResults");
      if (!box) return;
      var list = LICSYSTEM.captacao._chatList || [];
      var j = LICSYSTEM.captacao._chatData || {};
      var size = LICSYSTEM.state.chatPageSize || 50;
      var total = list.length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      if (!LICSYSTEM.state.chatPage || LICSYSTEM.state.chatPage < 1) LICSYSTEM.state.chatPage = 1;
      if (LICSYSTEM.state.chatPage > pages) LICSYSTEM.state.chatPage = pages;
      var page = LICSYSTEM.state.chatPage;
      var start = (page - 1) * size;
      var end = Math.min(start + size, total);

      if (!total) {
        LICSYSTEM.captacao.updateChatPager();
        return;
      }

      var html =
        '<div class="tbl-wrap"><table class="chat-edital-table"><thead><tr>' +
        "<th>Município</th><th>Órgão</th><th>Objeto</th><th>Valor estimado</th><th>Abertura</th><th>Modalidade</th><th>Edital</th>" +
        "</tr></thead><tbody>";
      for (var i = start; i < end; i++) {
        var o = list[i];
        if (!o) continue;
        html +=
          "<tr>" +
          "<td>" +
          utils.escapeHtml(o.municipio || "—") +
          "</td>" +
          "<td>" +
          utils.escapeHtml(o.orgao || "—") +
          "</td>" +
          '<td class="chat-edital-obj">' +
          utils.escapeHtml(o.objeto || "—") +
          "</td>" +
          "<td>" +
          (o.valorEstimado != null
            ? utils.formatBrl(o.valorEstimado)
            : "—") +
          "</td>" +
          "<td>" +
          utils.escapeHtml(LICSYSTEM.captacao.formatProxDate(o.dataAbertura)) +
          "</td>" +
          "<td>" +
          utils.escapeHtml(o.modalidade || "—") +
          "</td>" +
          "<td>" +
          (o.link
            ? '<a class="link" target="_blank" rel="noopener" href="' +
              utils.escapeHtml(o.link) +
              '">PNCP ↗</a>'
            : "—") +
          "</td>" +
          "</tr>";
      }
      html += "</tbody></table></div>";
      if (j.avisos && j.avisos.length && page === 1) {
        html +=
          '<div class="small muted" style="margin-top:10px">' +
          j.avisos
            .map(function (a) {
              return "• " + utils.escapeHtml(a);
            })
            .join("<br/>") +
          "</div>";
      }
      box.innerHTML = html;
      LICSYSTEM.captacao.updateChatPager();
    },

    updateChatPager: function () {
      var pager = el("chatPager");
      var info = el("chatPagerInfo");
      var prev = el("chatPrev");
      var next = el("chatNext");
      var total = (LICSYSTEM.captacao._chatList || []).length;
      var size = LICSYSTEM.state.chatPageSize || 50;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var page = LICSYSTEM.state.chatPage || 1;
      if (!pager) return;
      if (total <= size) {
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? (page - 1) * size + 1 : 0;
      var end = Math.min(page * size, total);
      if (info)
        info.innerHTML =
          "Itens <b>" +
          start +
          "–" +
          end +
          "</b> de <b>" +
          total +
          "</b> · Página <b>" +
          page +
          "</b>/" +
          pages +
          " (50 por página)";
      if (prev) prev.disabled = page <= 1;
      if (next) next.disabled = page >= pages;
    },

    goChatPage: function (delta) {
      var size = LICSYSTEM.state.chatPageSize || 50;
      var total = (LICSYSTEM.captacao._chatList || []).length;
      var pages = Math.max(1, Math.ceil(total / size) || 1);
      var next = (LICSYSTEM.state.chatPage || 1) + delta;
      if (next < 1) next = 1;
      if (next > pages) next = pages;
      if (next === LICSYSTEM.state.chatPage) return;
      LICSYSTEM.state.chatPage = next;
      LICSYSTEM.captacao.paintChatPage();
    },

    COLLAPSE_KEY: "licsystem_captacao_collapse_v1",

    PESQUISAS_CARD_IDS: [
      "cardChatEditais",
      "cardProxEditais",
      "cardRadarPncp"
    ],

    collapseSummaryIdForKey: function (key) {
      if (key === "prox-editais") return "proxCollapseSummary";
      if (key === "radar-pncp") return "radarCollapseSummary";
      return "chatCollapseSummary";
    },

    updateCollapseSummary: function (which, text) {
      var id =
        which === "prox"
          ? "proxCollapseSummary"
          : which === "radar"
            ? "radarCollapseSummary"
            : "chatCollapseSummary";
      var sum = el(id);
      if (!sum) return;
      sum.textContent = text || "";
      var card =
        which === "prox"
          ? el("cardProxEditais")
          : which === "radar"
            ? el("cardRadarPncp")
            : el("cardChatEditais");
      var collapsed = card && card.classList.contains("is-collapsed");
      sum.hidden = !collapsed || !text;
    },

    applyCardCollapse: function (card, collapsed, opts) {
      if (!card) return;
      opts = opts || {};
      var btn = card.querySelector(".card-collapse-btn");
      var key = card.getAttribute("data-collapse-key");
      card.classList.toggle("is-collapsed", !!collapsed);
      if (btn) {
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        btn.textContent = collapsed ? "▸ Expandir" : "▾ Minimizar";
        btn.title = collapsed ? "Expandir painel" : "Minimizar painel";
      }
      var sumId = LICSYSTEM.captacao.collapseSummaryIdForKey(key);
      var sum = el(sumId);
      if (sum) {
        sum.hidden = !collapsed || !String(sum.textContent || "").trim();
      }
      if (opts.skipPersist) return;
      try {
        var store = JSON.parse(
          localStorage.getItem(LICSYSTEM.captacao.COLLAPSE_KEY) || "{}"
        );
        if (key) store[key] = !!collapsed;
        localStorage.setItem(
          LICSYSTEM.captacao.COLLAPSE_KEY,
          JSON.stringify(store)
        );
      } catch (e) {}
    },

    /** Force all Pesquisas cards minimized (F5 / parent view). */
    minimizeAllPesquisasCards: function () {
      LICSYSTEM.captacao.PESQUISAS_CARD_IDS.forEach(function (id) {
        LICSYSTEM.captacao.applyCardCollapse(el(id), true, {
          skipPersist: true
        });
      });
    },

    /** Expand one card for submenu use; keep siblings minimized. */
    expandPesquisasCard: function (cardId) {
      LICSYSTEM.captacao.PESQUISAS_CARD_IDS.forEach(function (id) {
        LICSYSTEM.captacao.applyCardCollapse(el(id), id !== cardId, {
          skipPersist: true
        });
      });
    },

    initCardCollapse: function () {
      // Always start minimized on load — ignore prior expanded localStorage.
      LICSYSTEM.captacao.PESQUISAS_CARD_IDS.forEach(function (id) {
        var card = el(id);
        if (!card) return;
        LICSYSTEM.captacao.applyCardCollapse(card, true);
        var btn = card.querySelector(".card-collapse-btn");
        if (btn && !btn._collapseWired) {
          btn._collapseWired = true;
          btn.addEventListener("click", function () {
            LICSYSTEM.captacao.applyCardCollapse(
              card,
              !card.classList.contains("is-collapsed")
            );
          });
        }
      });
    },

    /* ---------- Radar PNCP ---------- */
    /**
     * dataFinal do endpoint /contratacoes/proposta = limite do encerramento.
     * Usar "hoje" zera o horizonte. Rolling hoje+365 no ano seguinte costuma 500.
     * Padrão: fim do ano civil (igual editais-proximos / editais-query).
     */
    _pncpDataFinalProposta:function(){
      var today = new Date();
      var yearEnd = new Date(today.getFullYear(), 11, 31);
      if(today.getMonth() >= 10){
        var cap = new Date(yearEnd.getTime());
        cap.setDate(cap.getDate() + 120);
        return utils.ymd(cap);
      }
      return utils.ymd(yearEnd);
    },
    /** Sinônimos para leilão / veículo / sucata (OR). */
    _pncpLeilaoSynonyms:function(){
      return [
        "leilao","leiloes","sucata","sucatas","veiculo","veiculos",
        "automovel","automoveis","documentado","documentados","frota",
        "alienacao","alienacoes","inservivel","inserviveis"
      ];
    },
    _pncpLooksLikeLeilao:function(raw){
      return /leil|sucat|veicul|automov|frota|alienac|documentad|inserviv/.test(
        utils.fold(raw || "")
      );
    },
    /** Intenção de veículo/sucata (não só leilão de imóvel/terreno). */
    _pncpLooksLikeVeiculoSucata:function(raw){
      return /sucat|veicul|automov|frota|documentad/.test(utils.fold(raw || ""));
    },
    _pncpHaystackVeiculoSucata:function(haystack){
      return /sucat|veicul|automov|frota|documentad|maquin|moveis|bem movel|bens moveis|inserviv/.test(
        haystack || ""
      );
    },
    /** "CESTA BASICA, CAFÉ" → [["cesta","basica"],["cafe"]] (vírgula=OU, espaços=E). */
    _pncpParseKeywords:function(raw){
      return String(raw || "")
        .split(/[,;]/)
        .map(function(group){
          return utils.fold(group).toLowerCase().trim().split(/\s+/).filter(Boolean);
        })
        .filter(function(g){ return g.length; });
    },
    /**
     * Frases de leilão/veículo/sucata viram grupos OU de sinônimos
     * (não exige AND estilo "cesta basica").
     */
    _pncpExpandKeywordGroups:function(kwGroups, raw){
      var groups = Array.isArray(kwGroups) ? kwGroups.slice() : [];
      if(!LICSYSTEM.captacao._pncpLooksLikeLeilao(raw || "")) return groups;
      var syns = LICSYSTEM.captacao._pncpLeilaoSynonyms();
      for(var i = 0; i < syns.length; i++){
        groups.push([syns[i]]);
      }
      return groups;
    },
    _pncpTextHaystack:function(o){
      var parts = [
        o.objetoCompra,
        o.objeto,
        o.objetoContratacao,
        o.informacaoComplementar,
        o.descricao,
        o.titulo,
        o.modalidadeNome
      ];
      return utils.fold(parts.filter(Boolean).join(" ")).toLowerCase();
    },
    /**
     * Grupo: AND dos tokens; em domínio leilão, também basta qualquer token ≥4.
     * Qualquer grupo basta (OU).
     */
    _pncpKeywordMatch:function(haystack, kwGroups){
      if(!kwGroups || !kwGroups.length) return true;
      return kwGroups.some(function(tokens){
        if(!tokens || !tokens.length) return false;
        if(tokens.every(function(t){ return haystack.indexOf(t) !== -1; })) return true;
        var joined = tokens.join(" ");
        if(LICSYSTEM.captacao._pncpLooksLikeLeilao(joined)){
          return tokens.some(function(t){
            return t.length >= 4 && haystack.indexOf(t) !== -1;
          });
        }
        return false;
      });
    },
    /** @deprecated PNCP direto no browser — CORS bloqueia em produção. Use /api/radar-pncp. */
    _pncpFetchPropostaPage:function(dataFinal, uf, page, pageSize, modalidade){
      var mod = modalidade != null ? modalidade : 6;
      var url =
        "/api/radar-pncp?uf=" +
        encodeURIComponent(uf || "") +
        "&paginas=1&incluirLeiloes=" +
        (mod === 1 || mod === 13 ? "1" : "0");
      return fetch(url).then(function(r){
        return utils.parseApiResponse(r);
      });
    },
    buscarPncp:function(){
      var rawKw = (el("pncpKeywords") && el("pncpKeywords").value) || "";
      var uf = (el("pncpUf") && el("pncpUf").value) || "";
      var incluirLeiloes =
        !el("pncpIncluirLeiloes") ||
        !!(el("pncpIncluirLeiloes") && el("pncpIncluirLeiloes").checked) ||
        LICSYSTEM.captacao._pncpLooksLikeLeilao(rawKw);
      var modalidades = incluirLeiloes ? [1, 13, 6] : [6];
      hideAlert("pncpAlert");
      el("pncpResults").innerHTML =
        '<div class="muted small"><span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Consultando PNCP via proxy (mods ' +
        utils.escapeHtml(modalidades.join(", ")) +
        ")…</div>";

      var url =
        "/api/radar-pncp?q=" +
        encodeURIComponent(rawKw) +
        "&uf=" +
        encodeURIComponent(uf) +
        "&incluirLeiloes=" +
        (incluirLeiloes ? "1" : "0");

      var radarCtrl =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      var radarTimer = null;
      if (radarCtrl) {
        radarTimer = setTimeout(function () {
          try {
            radarCtrl.abort();
          } catch (e) {}
        }, 90000);
      }

      fetch(url, radarCtrl ? { signal: radarCtrl.signal } : undefined)
        .then(function (r) {
          return utils.parseApiResponse(r);
        })
        .then(function (j) {
          LICSYSTEM.captacao._renderRadarPncp(j, rawKw, uf);
        })
        .catch(function (err) {
          el("pncpResults").innerHTML = "";
          var aborted =
            err &&
            (err.name === "AbortError" ||
              /aborted|timeout/i.test(String(err.message || "")));
          showAlert(
            "pncpAlert",
            "error",
            aborted
              ? "A consulta ao PNCP excedeu o tempo limite. Tente novamente ou reduza o escopo (UF)."
              : "Não foi possível consultar o PNCP (" +
                utils.escapeHtml(utils.formatApiError(err)) +
                "). A busca usa o proxy <code>/api/radar-pncp</code> (mesmo domínio). " +
                utils.apiHintHtml()
          );
        })
        .then(function () {
          if (radarTimer) clearTimeout(radarTimer);
        });
    },

    _renderRadarPncp:function(j, rawKw, uf){
      var list = (j && (j.editais || j.data)) || [];
      var kwGroups = LICSYSTEM.captacao._pncpExpandKeywordGroups(
        LICSYSTEM.captacao._pncpParseKeywords(rawKw || (j && j.rawKeywords) || ""),
        rawKw || (j && j.rawKeywords) || ""
      );
      /* API já filtra; _handlePncp ainda renderiza (aceita itens mapeados). */
      LICSYSTEM.captacao._handlePncp(list, [], uf || (j && j.uf) || "", {
        dataFinal: (j && j.dataFinalPncp) || "",
        pagesFetched: (j && j.pagesFetched) || 0,
        totalRegistros: (j && j.totalRegistrosPncp) || (j && j.totalBrutoPncp) || list.length,
        modalidades: (j && j.modalidades) || [],
        leilaoDomain: !!(j && j.leilaoDomain),
        rawKeywords: rawKw || (j && j.rawKeywords) || "",
        fromProxy: true,
        totalBruto: (j && j.totalBrutoPncp) || 0,
        avisos: (j && j.avisos) || []
      });
      /* Se API já filtrou e passou lista vazia com bruto > 0, _handlePncp trata. */
      if (kwGroups && !list.length && j && j.totalBrutoPncp) {
        /* noop — _handlePncp já mostra mensagem */
      }
    },

    _handlePncp:function(arr, kwGroups, uf, meta){
      meta = meta || {};
      if(!Array.isArray(arr)) arr = [];
      var fromProxy = !!meta.fromProxy;
      var wantVeiculo = LICSYSTEM.captacao._pncpLooksLikeVeiculoSucata(meta.rawKeywords || "");
      /* Proxy /api/radar-pncp já filtra no servidor — não refiltrar. */
      var matches = fromProxy
        ? arr.slice()
        : arr.filter(function(o){
            var hay = LICSYSTEM.captacao._pncpTextHaystack(o);
            if(!LICSYSTEM.captacao._pncpKeywordMatch(hay, kwGroups)) return false;
            if(wantVeiculo && !LICSYSTEM.captacao._pncpHaystackVeiculoSucata(hay)) return false;
            return true;
          });
      var box = el("pncpResults");
      var kwLabel = (meta.rawKeywords || "")
        .trim() ||
        (kwGroups || [])
          .filter(function(g){ return g.length <= 3; })
          .slice(0, 8)
          .map(function(g){ return g.join(" "); })
          .join(", ");
      var horizonte =
        meta.dataFinal
          ? "propostas com encerramento até " + meta.dataFinal
          : "período consultado";
      var modLabel =
        meta.modalidades && meta.modalidades.length
          ? "mods " + meta.modalidades.join(", ")
          : "mod. 6";
      var bruto = meta.totalBruto != null ? Number(meta.totalBruto) : arr.length;
      var scanned =
        (fromProxy ? bruto : arr.length) +
        " registro(s) varridos" +
        (meta.pagesFetched ? " em " + meta.pagesFetched + " página(s)" : "") +
        " (" +
        modLabel +
        ")" +
        (meta.totalRegistros != null
          ? " (PNCP informa ~" + meta.totalRegistros + " no total nas modalidades)"
          : "");
      if(!matches.length){
        if(!bruto){
          box.innerHTML =
            '<div class="muted small">PNCP não retornou propostas abertas para os filtros (' +
            utils.escapeHtml(horizonte) +
            (uf ? ", UF " + utils.escapeHtml(uf) : "") +
            ", " +
            utils.escapeHtml(modLabel) +
            ").</div>";
          showAlert(
            "pncpAlert",
            "info",
            "Consulta concluída — nenhuma proposta aberta no horizonte PNCP."
          );
          return;
        }
        box.innerHTML =
          '<div class="muted small">Nenhum edital com as palavras-chave' +
          (kwLabel ? " (<b>" + utils.escapeHtml(kwLabel) + "</b>)" : "") +
          " entre " +
          utils.escapeHtml(scanned) +
          " (" +
          utils.escapeHtml(horizonte) +
          ").</div>";
        showAlert(
          "pncpAlert",
          "info",
          "Consulta concluída — " +
            bruto +
            " registro(s) no PNCP, nenhum com as palavras-chave informadas."
        );
        return;
      }
      matches.forEach(function(o){
        LICSYSTEM.state.pncpAlerts.push({
          orgao:(o.orgaoEntidade && o.orgaoEntidade.razaoSocial) || o.nomeOrgao || o.orgao || "Órgão público",
          uf:(o.unidadeOrgao && o.unidadeOrgao.ufSigla) || o.uf || uf || "",
          objeto:o.objetoCompra || o.objeto || o.objetoContratacao || ""
        });
      });
      LICSYSTEM.updateBell();
      LICSYSTEM.dashboard.renderPncp();
      showAlert(
        "pncpAlert",
        "ok",
        "🎯 " +
          matches.length +
          " oportunidade(s) PNCP encontradas! Alertas adicionados ao sino. (" +
          scanned +
          ")"
      );
      var html='<div style="display:flex;flex-direction:column;gap:10px">';
      matches.forEach(function(o){
        var orgao=(o.orgaoEntidade && o.orgaoEntidade.razaoSocial) || o.nomeOrgao || o.orgao || "Órgão público";
        var objeto=o.objetoCompra || o.objeto || o.objetoContratacao || "";
        var link=o.linkSistemaOrigem || o.link || "";
        var val=o.valorTotalEstimado || o.valorGlobal || null;
        var modNome = o.modalidadeNome || (o._lsModalidade != null ? ("Mod. " + o._lsModalidade) : "");
        html+='<div class="result-item r-green">'+
          '<div class="ri-title">'+utils.escapeHtml(orgao)+' <span class="badge-status b-yellow">'+utils.escapeHtml((o.unidadeOrgao&&o.unidadeOrgao.ufSigla)||o.uf||uf||"")+'</span>'+
          (modNome ? ' <span class="badge-status b-blue">'+utils.escapeHtml(modNome)+'</span>' : '')+
          '</div>'+
          '<div class="ri-sub">'+utils.escapeHtml(objeto)+'</div>'+
          (val?'<div class="small" style="margin-top:6px"><b>Estimado:</b> '+utils.formatBrl(val)+'</div>':'')+
          (link?'<div style="margin-top:8px"><a class="link" target="_blank" href="'+utils.escapeHtml(link)+'">Ver no sistema de origem ↗</a></div>':'')+
          '</div>';
      });
      html+='</div>';
      box.innerHTML=html;
    }
  };

  /* ============================ ORÇAMENTO ============================ */
  LICSYSTEM.orcamento = {
    emptyItem:function(){
      return {lote:"", qtd:1, qtdEstoque:0, produto:"", editalVunit:0, editalTotal:0, vunit:0, pct:0, link:"", compensa:null};
    },
    normalizeItem:function(it){
      it = it || {};
      var qtd = Number(it.qtd); if(!isFinite(qtd) || qtd < 0) qtd = 1;
      var qtdEstoque = Number(it.qtdEstoque != null ? it.qtdEstoque : (it.estoque != null ? it.estoque : 0));
      if(!isFinite(qtdEstoque) || qtdEstoque < 0) qtdEstoque = 0;
      var editalVunit = Number(it.editalVunit != null ? it.editalVunit : 0) || 0;
      var editalTotal = Number(it.editalTotal != null ? it.editalTotal : 0) || 0;
      if(!editalTotal && editalVunit) editalTotal = qtd * editalVunit;
      if(!editalVunit && editalTotal && qtd) editalVunit = editalTotal / qtd;
      var compensa = null;
      if(it.compensa === true || it.compensa === "true" || it.statusCompensa === "compensa") compensa = true;
      else if(it.compensa === false || it.compensa === "false" || it.statusCompensa === "nao") compensa = false;
      return {
        lote: it.lote != null && it.lote !== "" ? String(it.lote) : "",
        qtd: qtd,
        qtdEstoque: qtdEstoque,
        produto: String(it.produto || it.descricao || ""),
        editalVunit: editalVunit,
        editalTotal: editalTotal,
        vunit: Number(it.vunit) || 0,
        pct: Number(it.pct) || 0,
        link: String(it.link || ""),
        compensa: compensa
      };
    },
    isEmptyRow:function(it){
      if(!it) return true;
      return !String(it.produto||"").trim() && !Number(it.vunit) && !Number(it.editalVunit) && !String(it.lote||"").trim();
    },
    load:function(){
      try{
        var raw = JSON.parse(localStorage.getItem(ORC_KEY) || "null");
        if(raw == null && ORC_KEY_LEGACY){
          raw = JSON.parse(localStorage.getItem(ORC_KEY_LEGACY) || "null");
        }
        var items = null;
        // v2 object: { v, items, meta, page } — legacy: bare array
        if(raw && Array.isArray(raw)){
          items = raw;
        } else if(raw && typeof raw === "object" && Array.isArray(raw.items)){
          items = raw.items;
          var meta = raw.meta || {};
          LICSYSTEM.state.orcMetaNome = meta.nome != null ? String(meta.nome) : (LICSYSTEM.state.orcMetaNome || "");
          LICSYSTEM.state.orcMetaNumero = meta.numero != null ? String(meta.numero) : (LICSYSTEM.state.orcMetaNumero || "");
          LICSYSTEM.state.orcCatalogId = meta.catalogId != null ? meta.catalogId : (LICSYSTEM.state.orcCatalogId || null);
          if(raw.page != null) LICSYSTEM.state.orcPage = Math.max(1, Number(raw.page) || 1);
        }
        if(items){
          LICSYSTEM.state.orcItems = items.map(function(it){ return LICSYSTEM.orcamento.normalizeItem(it); });
        }
      }catch(e){}
      if(!LICSYSTEM.state.orcItems.length){
        LICSYSTEM.state.orcItems = [ LICSYSTEM.orcamento.emptyItem() ];
      }
      LICSYSTEM.orcamento.updateMeta();
    },
    save:function(opts){
      opts = opts || {};
      try{
        var now = Date.now();
        var payload = {
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
          savedAt: now,
          updatedAt: now
        };
        if(opts.forceClear) payload.cleared = true;
        localStorage.setItem(ORC_KEY, JSON.stringify(payload));
        if(!opts.skipCloud && LICSYSTEM.cloudSync){
          LICSYSTEM.cloudSync.notifyLocalChange("orcamento", {
            updatedAt: now,
            forceClear: !!opts.forceClear,
            immediate: !!opts.immediate
          });
        }
      }catch(e){
        console.warn("Orçamento: não foi possível salvar tudo no navegador (limite de armazenamento).", e);
      }
    },
    scheduleSave:function(){
      clearTimeout(LICSYSTEM.orcamento._saveTimer);
      LICSYSTEM.orcamento._saveTimer = setTimeout(function(){
        LICSYSTEM.orcamento._saveTimer = null;
        LICSYSTEM.orcamento.save();
        LICSYSTEM.state._orcDirty = false;
      }, 400);
    },
    flushSave:function(opts){
      opts = opts || {};
      clearTimeout(LICSYSTEM.orcamento._saveTimer);
      LICSYSTEM.orcamento._saveTimer = null;
      LICSYSTEM.orcamento.syncFromDom();
      LICSYSTEM.orcamento.save(opts);
      LICSYSTEM.state._orcDirty = false;
    },
    /** Pull live input values into state (covers pending keystrokes before leave). */
    syncFromDom:function(){
      var body = el("orcBody");
      if(!body) return;
      var inputs = body.querySelectorAll("input[data-i][data-f]");
      for(var n = 0; n < inputs.length; n++){
        var inp = inputs[n];
        var i = Number(inp.getAttribute("data-i"));
        var f = inp.getAttribute("data-f");
        var it = LICSYSTEM.state.orcItems[i];
        if(!it || !f) continue;
        if(f === "produto" || f === "link" || f === "lote") it[f] = inp.value;
        else it[f] = Number(inp.value) || 0;
        if(f === "qtd" || f === "editalVunit"){
          if(Number(it.editalVunit) > 0){
            it.editalTotal = (Number(it.qtd) || 0) * (Number(it.editalVunit) || 0);
          }
        }
      }
    },
    calcEditalTotal:function(it){
      var stored = Number(it.editalTotal)||0;
      if(stored > 0) return stored;
      return (Number(it.qtd)||0) * (Number(it.editalVunit)||0);
    },
    /** MEUS PREÇOS V. Final: always qtdEstoque (0 → R$ 0,00), never edital qtd. */
    calcTotal:function(it){
      var q=Number(it.qtdEstoque)||0, v=Number(it.vunit)||0, p=Number(it.pct)||0;
      return q*v*(1+p/100);
    },
    pageCount:function(){
      var n = LICSYSTEM.state.orcItems.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      return Math.max(1, Math.ceil(n / size) || 1);
    },
    clampPage:function(){
      var pages = LICSYSTEM.orcamento.pageCount();
      if(!LICSYSTEM.state.orcPage || LICSYSTEM.state.orcPage < 1) LICSYSTEM.state.orcPage = 1;
      if(LICSYSTEM.state.orcPage > pages) LICSYSTEM.state.orcPage = pages;
      return LICSYSTEM.state.orcPage;
    },
    updatePager:function(){
      var pager = el("orcPager");
      var info = el("orcPagerInfo");
      var prev = el("orcPrev");
      var next = el("orcNext");
      if(!pager) return;
      var total = LICSYSTEM.state.orcItems.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      var pages = LICSYSTEM.orcamento.pageCount();
      var page = LICSYSTEM.orcamento.clampPage();
      if(total <= size){
        pager.style.display = "none";
        return;
      }
      pager.style.display = "flex";
      var start = total ? ((page - 1) * size + 1) : 0;
      var end = Math.min(page * size, total);
      if(info) info.innerHTML = "Itens <b>"+start+"–"+end+"</b> de <b>"+total+"</b> · Página <b>"+page+"</b>/"+pages+" (100 por página)";
      if(prev) prev.disabled = page <= 1;
      if(next) next.disabled = page >= pages;
    },
    goPage:function(delta){
      var pages = LICSYSTEM.orcamento.pageCount();
      var next = (LICSYSTEM.state.orcPage || 1) + delta;
      if(next < 1) next = 1;
      if(next > pages) next = pages;
      LICSYSTEM.state.orcPage = next;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render({ save:false });
    },
    render:function(opts){
      opts = opts || {};
      var body = el("orcBody");
      if(!body) return;
      var items = LICSYSTEM.state.orcItems;
      var n = items.length;
      var size = LICSYSTEM.state.orcPageSize || 100;
      var page = LICSYSTEM.orcamento.clampPage();
      var start = (page - 1) * size;
      var end = Math.min(start + size, n);

      var geralMeus = 0, geralEdital = 0;
      for(var g = 0; g < n; g++){
        geralMeus += LICSYSTEM.orcamento.calcTotal(items[g]);
        geralEdital += LICSYSTEM.orcamento.calcEditalTotal(items[g]);
      }

      var buf = [];
      for(var i = start; i < end; i++){
        var it = items[i];
        var totalMeus = LICSYSTEM.orcamento.calcTotal(it);
        var totalEdital = LICSYSTEM.orcamento.calcEditalTotal(it);
        var editalUnitShow = Number(it.editalVunit)||0;
        if(!editalUnitShow && totalEdital > 0 && Number(it.qtd) > 0){
          editalUnitShow = totalEdital / Number(it.qtd);
        }
        var risco = utils.riscoMatch(it.produto);
        var flag = risco.length ? '<span class="risk-flag" title="Risco: '+utils.escapeHtml(risco.join(", "))+'">⚠</span>' : "";
        var rowCls = [];
        if(risco.length) rowCls.push("risk-row");
        if(it.compensa === true) rowCls.push("orc-row-compensa");
        else if(it.compensa === false) rowCls.push("orc-row-nao-compensa");
        var btnCompensaCls = "btn btn-sm orcCompensa"+(it.compensa === true ? " is-active" : "");
        var btnNaoCls = "btn btn-sm orcNaoCompensa"+(it.compensa === false ? " is-active" : "");
        var hasLink = !!(String(it.link || "").trim());
        var btnLinkCls = "btn btn-ghost btn-sm orcOpenLink"+(hasLink ? " is-ready" : "");
        buf.push(
          '<tr class="'+rowCls.join(" ")+'" data-item-idx="'+i+'">'+
            '<td class="td-chk"><input type="checkbox" class="orcChk" data-i="'+i+'" aria-label="Selecionar lote '+(it.lote||(i+1))+'"></td>'+
            '<td class="td-lote"><input type="text" class="orc-lote" data-i="'+i+'" data-f="lote" value="'+utils.escapeHtml(it.lote)+'" placeholder="—" title="Lote ou Item do edital"></td>'+
            '<td class="td-qtd"><input type="number" class="orc-qtd" data-i="'+i+'" data-f="qtd" value="'+utils.escapeHtml(it.qtd)+'" step="1" min="0" title="Quantidade"></td>'+
            '<td><div class="orc-desc-wrap'+(risco.length?' risk-cell':'')+'">'+flag+
              '<input type="text" data-i="'+i+'" data-f="produto" value="'+utils.escapeHtml(it.produto)+'" placeholder="Descrição do edital">'+
            '</div></td>'+
            '<td class="td-money"><input type="number" data-i="'+i+'" data-f="editalVunit" value="'+utils.escapeHtml(editalUnitShow)+'" step="0.0001" min="0" title="Valor unitário do edital"></td>'+
            '<td class="td-money split-end"><span class="cell-ro" data-edital-total="'+i+'">'+utils.formatBrl(totalEdital)+'</span></td>'+
            '<td class="td-qtd split-start"><input type="number" class="orc-qtd" data-i="'+i+'" data-f="qtdEstoque" value="'+utils.escapeHtml(it.qtdEstoque)+'" step="1" min="0" title="Quantidade em estoque / posso entregar"></td>'+
            '<td class="td-money"><input type="number" data-i="'+i+'" data-f="vunit" value="'+utils.escapeHtml(it.vunit)+'" step="0.01" min="0" title="Meu valor unitário"></td>'+
            '<td class="td-pct"><input type="number" class="orc-pct" data-i="'+i+'" data-f="pct" value="'+utils.escapeHtml(it.pct)+'" step="0.1" title="Porcentagem"></td>'+
            '<td class="td-money"><span class="cell-total" data-meus-total="'+i+'">'+utils.formatBrl(totalMeus)+'</span></td>'+
            '<td class="td-link"><input type="text" data-i="'+i+'" data-f="link" value="'+utils.escapeHtml(it.link||"")+'" placeholder="Link"></td>'+
            '<td class="td-actions"><div class="orc-actions">'+
              '<button type="button" class="btn btn-ghost btn-sm orcGoogle" data-i="'+i+'" title="Google">G</button>'+
              '<button type="button" class="btn btn-ghost btn-sm orcMl" data-i="'+i+'" title="Mercado Livre">ML</button>'+
              '<button type="button" class="'+btnLinkCls+'" data-i="'+i+'" title="'+(hasLink?"Abrir link de acesso":"Cole um link no campo Link de Acesso")+'"'+(hasLink?"":" disabled")+'>LINK</button>'+
              '<button type="button" class="'+btnCompensaCls+'" data-i="'+i+'" title="COMPENSA">(C)</button>'+
              '<button type="button" class="'+btnNaoCls+'" data-i="'+i+'" title="NÃO COMPENSA">(N)</button>'+
              '<button type="button" class="btn btn-ghost btn-sm orcDel" data-i="'+i+'" title="Remover">✕</button>'+
            '</div></td>'+
          '</tr>'
        );
      }
      if(!buf.length){
        body.innerHTML = '<tr><td colspan="12" class="orc-empty">Nenhum item nesta página. Importe o Excel do edital ou adicione uma linha.</td></tr>';
      } else {
        body.innerHTML = buf.join("");
      }
      if(el("orcTotalGeral")) el("orcTotalGeral").textContent = utils.formatBrl(geralMeus);
      if(el("orcTotalEdital")) el("orcTotalEdital").textContent = utils.formatBrl(geralEdital);
      var all = el("orcCheckAll");
      if(all) all.checked = false;
      LICSYSTEM.state._orcDirty = false;
      LICSYSTEM.state._orcRendered = true;
      LICSYSTEM.orcamento.updatePager();
      if(opts.save !== false) LICSYSTEM.orcamento.save();
    },
    addLinha:function(){
      LICSYSTEM.state.orcItems.push(LICSYSTEM.orcamento.emptyItem());
      LICSYSTEM.state.orcPage = LICSYSTEM.orcamento.pageCount();
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },
    addFromLines:function(lines){
      var added = 0;
      (lines || []).forEach(function(l){
        var itCap = utils.asCaptacaoItem(l);
        if(!itCap) return;

        // Se a descrição ainda carrega "100,000 UN ..." ou linha THEO, reparseia
        var dirty =
          /^\d{1,3}([.,]\d{3})*\s+(UN|UND|UNI|UNID)\b/i.test(itCap.produto || "") ||
          (/^\d{1,5}\s+(UN|UND|UNI|UNID|LT|BL|GAL)\b/i.test(itCap.produto || "") &&
            !(Number(itCap.editalVunit) > 0));
        if (dirty || (!itCap.editalVunit && itCap.line)) {
          var again = utils.parseLinhaEdital(itCap.line || itCap.produto);
          if (again) itCap = again;
        }

        var rawCheck = itCap.line || itCap.produto || "";
        if(!rawCheck || !utils.sanitizar(rawCheck)) return;

        var item = LICSYSTEM.orcamento.emptyItem();
        item.lote = itCap.lote != null && String(itCap.lote).trim() !== "" ? String(itCap.lote) : "";
        item.qtd = Number(itCap.qtd) || 1;
        item.produto = String(itCap.produto || "").trim();
        item.editalVunit = Number(itCap.editalVunit) || 0;
        item.editalTotal = Number(itCap.editalTotal) || 0;
        if(!item.editalTotal && item.editalVunit){
          item.editalTotal = item.qtd * item.editalVunit;
        }
        if(!item.produto) return;

        added++;
        if(!String(item.lote||"").trim()) item.lote = String(added);
        LICSYSTEM.state.orcItems.push(item);
      });
      LICSYSTEM.state.orcItems = LICSYSTEM.state.orcItems.filter(function(it,idx){
        return !(idx===0 && LICSYSTEM.orcamento.isEmptyRow(it));
      });
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render();
    },
    limpar:function(){
      if(!confirm("Limpar toda a planilha de orçamento?")) return;
      LICSYSTEM.state.orcItems = [ LICSYSTEM.orcamento.emptyItem() ];
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state.orcCatalogId = null;
      LICSYSTEM.state.orcMetaNome = "";
      LICSYSTEM.state.orcMetaNumero = "";
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.render({ save:false });
      LICSYSTEM.orcamento.flushSave({ forceClear: true, immediate: true });
      LICSYSTEM.orcamento.updateMeta();
    },

    updateMeta:function(){
      var box = el("orcMeta");
      if(!box) return;
      var nome = LICSYSTEM.state.orcMetaNome || "";
      var numero = LICSYSTEM.state.orcMetaNumero || "";
      if(!nome && !numero){
        box.style.display = "none";
        box.innerHTML = "";
        return;
      }
      box.style.display = "flex";
      box.innerHTML =
        '<span class="tag">Catálogo</span>'+
        (numero ? '<span><b>Nº</b> '+utils.escapeHtml(numero)+'</span>' : '')+
        (nome ? '<span><b>Nome</b> '+utils.escapeHtml(nome)+'</span>' : '')+
        (LICSYSTEM.state.orcCatalogId ? '<span class="small muted">salvo — edite e clique em Salvar no Catálogo para atualizar</span>' : '');
    },

    exportarExcel:function(){
      var items = (LICSYSTEM.state.orcItems || []).filter(function(it){
        return !LICSYSTEM.orcamento.isEmptyRow(it);
      });
      if(!items.length){ showAlert("orcAlert","warn","Planilha vazia — nada para exportar."); return; }
      utils.ensureXlsx().then(function(){
        var rows = [[
          "Lote","Qtd","Descrição",
          "Edital V. Unitário","Edital V. Final",
          "Meu V. Unitário","%","Meu V. Final","Link"
        ]];
        items.forEach(function(it){
          rows.push([
            it.lote || "",
            Number(it.qtd)||0,
            it.produto || "",
            Number(it.editalVunit)||0,
            LICSYSTEM.orcamento.calcEditalTotal(it),
            Number(it.vunit)||0,
            Number(it.pct)||0,
            LICSYSTEM.orcamento.calcTotal(it),
            it.link || ""
          ]);
        });
        var ws = XLSX.utils.aoa_to_sheet(rows);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Orcamento");
        var nome = (LICSYSTEM.state.orcMetaNumero || LICSYSTEM.state.orcMetaNome || "orcamento")
          .toString().replace(/[^\w\-]+/g,"_").slice(0,40);
        XLSX.writeFile(wb, nome + "-licsystem.xlsx");
        showAlert("orcAlert","ok","Excel exportado com "+items.length+" item(ns).");
      }).catch(function(err){
        showAlert("orcAlert","error","Falha ao exportar Excel: "+utils.escapeHtml(err.message||err));
      });
    },

    exportarPdf:function(){
      LICSYSTEM.orcamento.gerarProposta();
    },

    abrirModalSalvarCatalogo:function(){
      var items = (LICSYSTEM.state.orcItems || []).filter(function(it){
        return !LICSYSTEM.orcamento.isEmptyRow(it);
      });
      if(!items.length){
        showAlert("orcAlert","warn","Monte o orçamento antes de salvar no catálogo.");
        return;
      }
      var ov = el("orcSaveOverlay");
      if(!ov) return;
      hideAlert("orcSaveAlert");
      if(el("orcSaveNome")) el("orcSaveNome").value = LICSYSTEM.state.orcMetaNome || "";
      if(el("orcSaveNumero")) el("orcSaveNumero").value = LICSYSTEM.state.orcMetaNumero || "";
      ov.classList.add("open");
      ov.setAttribute("aria-hidden","false");
      setTimeout(function(){ if(el("orcSaveNome")) el("orcSaveNome").focus(); }, 30);
    },

    fecharModalSalvarCatalogo:function(){
      var ov = el("orcSaveOverlay");
      if(!ov) return;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden","true");
      hideAlert("orcSaveAlert");
    },

    confirmarSalvarCatalogo:function(){
      var nome = ((el("orcSaveNome") && el("orcSaveNome").value) || "").trim();
      var numero = ((el("orcSaveNumero") && el("orcSaveNumero").value) || "").trim();
      if(!nome){
        showAlert("orcSaveAlert","warn","Informe o nome da licitação.");
        if(el("orcSaveNome")) el("orcSaveNome").focus();
        return;
      }
      if(!numero){
        showAlert("orcSaveAlert","warn","Informe o número da licitação.");
        if(el("orcSaveNumero")) el("orcSaveNumero").focus();
        return;
      }

      var itens = (LICSYSTEM.state.orcItems || [])
        .filter(function(it){ return !LICSYSTEM.orcamento.isEmptyRow(it); })
        .map(function(it){ return LICSYSTEM.orcamento.normalizeItem(it); });
      if(!itens.length){
        showAlert("orcSaveAlert","warn","Nenhum item válido para salvar.");
        return;
      }

      var totalMeus = 0, totalEdital = 0;
      itens.forEach(function(it){
        totalMeus += LICSYSTEM.orcamento.calcTotal(it);
        totalEdital += LICSYSTEM.orcamento.calcEditalTotal(it);
      });

      LICSYSTEM.catalogo.load();
      var agora = new Date().toISOString();
      var editId = LICSYSTEM.state.orcCatalogId;
      var entry = null;

      if(editId){
        for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
          if(LICSYSTEM.catalogo.items[i].id === editId){
            entry = LICSYSTEM.catalogo.items[i];
            break;
          }
        }
      }

      if(entry && entry.tipo === "orcamento"){
        entry.nome = nome;
        entry.numero = numero;
        entry.sku = numero;
        entry.marca = "Orçamento";
        entry.preco = totalMeus;
        entry.totalEdital = totalEdital;
        entry.itens = itens;
        entry.qtdItens = itens.length;
        entry.atualizadoEm = agora;
      } else {
        entry = {
          id: "orc_" + Date.now() + "_" + Math.floor(Math.random()*1000),
          tipo: "orcamento",
          nome: nome,
          numero: numero,
          sku: numero,
          marca: "Orçamento",
          preco: totalMeus,
          totalEdital: totalEdital,
          itens: itens,
          qtdItens: itens.length,
          criadoEm: agora,
          atualizadoEm: agora
        };
        LICSYSTEM.catalogo.items.push(entry);
      }

      LICSYSTEM.catalogo.saveLocal();
      LICSYSTEM.state.orcCatalogId = entry.id;
      LICSYSTEM.state.orcMetaNome = nome;
      LICSYSTEM.state.orcMetaNumero = numero;
      LICSYSTEM.orcamento.save();
      LICSYSTEM.orcamento.updateMeta();
      LICSYSTEM.orcamento.fecharModalSalvarCatalogo();
      if(typeof listarProdutos === "function") listarProdutos();
      showAlert("orcAlert","ok","Orçamento salvo no Catálogo: <b>"+utils.escapeHtml(nome)+"</b> ("+utils.escapeHtml(numero)+") — "+itens.length+" item(ns).");
    },

    abrirDoCatalogo:function(id){
      LICSYSTEM.catalogo.load();
      var item = null;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === id){ item = LICSYSTEM.catalogo.items[i]; break; }
      }
      if(!item || item.tipo !== "orcamento"){
        showAlert("catalogoAlert","warn","Este registro não é um orçamento salvo.");
        return;
      }
      var itens = Array.isArray(item.itens) ? item.itens.map(function(it){
        return LICSYSTEM.orcamento.normalizeItem(it);
      }) : [];
      if(!itens.length) itens = [ LICSYSTEM.orcamento.emptyItem() ];

      LICSYSTEM.state.orcItems = itens;
      LICSYSTEM.state.orcPage = 1;
      LICSYSTEM.state.orcCatalogId = item.id;
      LICSYSTEM.state.orcMetaNome = item.nome || "";
      LICSYSTEM.state.orcMetaNumero = item.numero || item.sku || "";
      LICSYSTEM.state._orcDirty = true;
      LICSYSTEM.orcamento.save();
      LICSYSTEM.orcamento.render();
      LICSYSTEM.orcamento.updateMeta();
      showAlert("orcAlert","ok","Orçamento reaberto: <b>"+utils.escapeHtml(item.nome||"")+"</b> — continue editando e salve de novo no catálogo quando quiser.");
      if(window.__lsActivateView) window.__lsActivateView("orcamento");
    },

    handleFile:function(file){
      if(!file) return;
      showAlertOrc('<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Lendo planilha do edital…',"info");
      utils.ensureXlsx().then(function(){
        var reader = new FileReader();
        reader.onload = function(){
          try{
            var wb = XLSX.read(new Uint8Array(reader.result), {type:"array"});
            var ws = wb.Sheets[wb.SheetNames[0]];
            var rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:""});
            LICSYSTEM.orcamento._mapRows(rows);
          }catch(err){ showAlertOrc("Erro ao ler arquivo: "+utils.escapeHtml(err.message),"error"); }
        };
        reader.readAsArrayBuffer(file);
      }).catch(function(err){ showAlertOrc("Falha ao carregar SheetJS: "+utils.escapeHtml(err.message),"error"); });
      function showAlertOrc(msg,type){
        var d=el("orcDrop"); d.innerHTML='<span class="big">📊</span>'+msg;
        setTimeout(function(){ LICSYSTEM.orcamento._restoreDrop(); }, type==="info"?60000:4000);
      }
    },
    _restoreDrop:function(){
      el("orcDrop").innerHTML='<span class="big">📊</span><b>Arraste Excel/CSV do edital aqui</b> ou clique para selecionar<br/><span class="small muted">Mapeia Lote/Item, Quantidade, Descrição, Valor Unitário e Valor Final (também Valor Máximo)</span><input type="file" id="orcFile" accept=".xlsx,.xls,.csv" style="display:none" />';
      wireOrcFileInput();
    },
    _mapRows:function(rows){
      if(!rows || !rows.length){ LICSYSTEM.orcamento._restoreDrop(); return; }

      // localiza linha de cabeçalho (até a 10ª) — aceita LOTE ou ITEM
      var headerRow = 0, header = null;
      for(var hr=0; hr<Math.min(10, rows.length); hr++){
        var cand = (rows[hr] || []).map(function(c){
          return utils.fold(String(c)).toLowerCase().replace(/\s+/g, " ").trim();
        });
        var score = 0;
        cand.forEach(function(h){
          if(!h) return;
          if(h.indexOf("descr")!==-1 || h.indexOf("produto")!==-1) score += 3;
          if(h.indexOf("qtde")!==-1 || h.indexOf("qtd")!==-1 || h.indexOf("quant")!==-1) score += 2;
          if(h.indexOf("unitario")!==-1 || h.indexOf("maximo unit")!==-1 || (h.indexOf("valor")!==-1 && h.indexOf("unit")!==-1)) score += 3;
          if(h.indexOf("maximo total")!==-1 || h.indexOf("valor maximo total")!==-1 || (h.indexOf("total")!==-1 && h.indexOf("unit")===-1)) score += 2;
          if(h==="item" || h.indexOf("lote")!==-1) score += 3;
          if(h==="und" || h==="unid" || h.indexOf("unidade")===0) score += 1;
        });
        if(score >= 5){ headerRow = hr; header = cand; break; }
      }
      if(!header) header = (rows[0] || []).map(function(c){
        return utils.fold(String(c)).toLowerCase().replace(/\s+/g, " ").trim();
      });

      var colLote=-1, colDesc=-1, colQtd=-1, colUnit=-1, colFinal=-1, colUnd=-1;
      // 1) ITEM / LOTE (nunca Cód / Cotas)
      header.forEach(function(h,i){
        if(!h) return;
        if(colLote>=0) return;
        if(h.indexOf("cotas")!==-1 || h==="cod" || h==="codigo" || h.indexOf("cod ")===0 || h.indexOf("codigo ")===0) return;
        if(h==="item" || h==="lote" || h.indexOf("item ")===0 || h.indexOf("lote")===0) colLote=i;
        else if((h==="n" || h==="nº" || h==="n°" || h==="nr" || h==="num") && h.indexOf("cotas")===-1) colLote=i;
      });
      // 2) Quantidade (não Cotas)
      header.forEach(function(h,i){
        if(!h || colQtd>=0) return;
        if(h.indexOf("cotas")!==-1) return;
        if(h==="qtde" || h==="qtd" || h.indexOf("qtde")!==-1 || (h.indexOf("quant")!==-1 && h.indexOf("cotas")===-1)) colQtd=i;
      });
      // 3) Descrição / Produto
      header.forEach(function(h,i){
        if(!h || colDesc>=0) return;
        if(h.indexOf("descr")!==-1 || h.indexOf("produto")!==-1 || h.indexOf("especific")!==-1) colDesc=i;
      });
      // 4) Unidade (só referência)
      header.forEach(function(h,i){
        if(!h || colUnd>=0) return;
        if(h==="und" || h==="un" || h==="unid" || h==="unidade") colUnd=i;
      });
      // 5) Valor unitário / Valor Máximo Unit.
      header.forEach(function(h,i){
        if(!h || colUnit>=0) return;
        if(h.indexOf("maximo unit")!==-1 || h.indexOf("valor maximo unit")!==-1) colUnit=i;
        else if(h.indexOf("unitario")!==-1 || h.indexOf("v. unit")!==-1 || h.indexOf("v unit")!==-1) colUnit=i;
        else if(h.indexOf("unit")!==-1 && h.indexOf("total")===-1 && h.indexOf("und")===-1 && h!=="und") colUnit=i;
      });
      if(colUnit<0){
        header.forEach(function(h,i){
          if(!h) return;
          if(h.indexOf("valor")!==-1 && h.indexOf("total")===-1 && h.indexOf("final")===-1 && i!==colQtd && i!==colUnd) colUnit=i;
        });
      }
      // 6) Valor total / Valor Máximo Total
      header.forEach(function(h,i){
        if(!h || colFinal>=0) return;
        if(h.indexOf("maximo total")!==-1 || h.indexOf("valor maximo total")!==-1) colFinal=i;
        else if(h.indexOf("final")!==-1 || (h.indexOf("total")!==-1 && h.indexOf("unit")===-1 && i!==colUnit)) colFinal=i;
      });

      // Fallback posicional:
      // Item | Cotas | Qtde | Und | Cód | Produto | V.Unit | V.Total  (8 cols)
      // Item | Qtde | Und | Descrição | V.Unit | V.Final (6 cols)
      if(colDesc<0 && header.length >= 6){
        if(header.length >= 8){
          if(colLote<0) colLote = 0;
          if(colQtd<0) colQtd = 2;
          if(colDesc<0) colDesc = 5;
          if(colUnit<0) colUnit = 6;
          if(colFinal<0) colFinal = 7;
        } else {
          if(colLote<0) colLote = 0;
          if(colQtd<0) colQtd = 1;
          if(colDesc<0) colDesc = header.length >= 6 ? 3 : 2;
          if(colUnit<0) colUnit = header.length - 2;
          if(colFinal<0) colFinal = header.length - 1;
        }
      }

      var startRow = headerRow + 1;
      if(colDesc<0){ colDesc = 0; startRow = 0; }

      var added=0;
      for(var r=startRow;r<rows.length;r++){
        var row = rows[r] || [];
        var desc = String(row[colDesc]!=null?row[colDesc]:"").trim();
        if(!desc) continue;
        if(!utils.sanitizar(desc)) continue;

        var qtd = colQtd>=0 ? utils.parseBrNum(row[colQtd]) : 0;
        var unit = colUnit>=0 ? utils.parseBrNum(row[colUnit]) : 0;
        var fin = colFinal>=0 ? utils.parseBrNum(row[colFinal]) : 0;
        var lote = colLote>=0 ? String(row[colLote]!=null?row[colLote]:"").trim() : "";

        // se a descrição ainda carrega a linha completa do edital, extrai preços dela
        var parsed = utils.parseLinhaEdital(
          (lote ? lote + " " : "") +
          (qtd ? qtd + " " : "") +
          (colUnd>=0 ? String(row[colUnd]||"UN") + " " : "") +
          desc +
          (unit ? " " + unit : "") +
          (fin ? " " + fin : "")
        );
        if(parsed){
          if(!lote && parsed.lote) lote = parsed.lote;
          if(!qtd && parsed.qtd) qtd = parsed.qtd;
          desc = parsed.produto || desc;
          if(!unit && parsed.editalVunit) unit = parsed.editalVunit;
          if(!fin && parsed.editalTotal) fin = parsed.editalTotal;
        } else {
          var parsedDesc = utils.parseLinhaEdital(desc);
          if(parsedDesc){
            if(!lote && parsedDesc.lote) lote = parsedDesc.lote;
            if(!qtd && parsedDesc.qtd) qtd = parsedDesc.qtd;
            desc = parsedDesc.produto || desc;
            if(!unit && parsedDesc.editalVunit) unit = parsedDesc.editalVunit;
            if(!fin && parsedDesc.editalTotal) fin = parsedDesc.editalTotal;
          }
        }

        if(!unit){
          for(var c=0;c<row.length;c++){
            if(c===colDesc || c===colQtd || c===colLote || c===colFinal || c===colUnd) continue;
            var maybe = utils.parseBrNum(row[c]);
            var rawCell = String(row[c]==null?"":row[c]).trim();
            if(maybe > 0 && /,\d{2,4}$/.test(rawCell.replace(/\s/g,"")) && maybe < 1e7){
              if(/,\d{3,4}$/.test(rawCell.replace(/\s/g,"")) || maybe !== qtd){
                unit = maybe;
                break;
              }
            }
          }
        }

        if(!qtd) qtd = 1;
        if(!fin && unit) fin = qtd * unit;
        if(!lote) lote = String(added+1);

        var item = LICSYSTEM.orcamento.emptyItem();
        item.lote = lote;
        item.produto = desc;
        item.qtd = qtd;
        item.editalVunit = unit||0;
        item.editalTotal = fin||0;
        LICSYSTEM.state.orcItems.push(item);
        added++;
        if(added>=5000) break;
      }
      LICSYSTEM.state.orcItems = LICSYSTEM.state.orcItems.filter(function(it,idx){
        return !(idx===0 && LICSYSTEM.orcamento.isEmptyRow(it));
      });
      LICSYSTEM.orcamento.render();
      LICSYSTEM.orcamento._restoreDrop();
    },

    gerarProposta:function(){
      if(!LICSYSTEM.state.orcItems.length){ alert("Planilha vazia."); return; }
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"landscape"});
        return licsystemPdfHeader(doc,"Proposta Comercial — Espelho Edital", true).then(function(startY){
          var y = startY;
          var rows=[], geralMeus=0, geralEdital=0;
          LICSYSTEM.state.orcItems.forEach(function(it){
            if(!it.produto && !it.lote) return;
            var meus=LICSYSTEM.orcamento.calcTotal(it);
            var edital=LICSYSTEM.orcamento.calcEditalTotal(it);
            geralMeus+=meus; geralEdital+=edital;
            rows.push([
              it.lote || "",
              it.produto || "",
              it.qtd,
              utils.formatBrl(it.editalVunit),
              utils.formatBrl(edital),
              utils.formatBrl(it.vunit),
              (it.pct||0)+"%",
              utils.formatBrl(meus)
            ]);
          });
          doc.autoTable({
            startY:y+2,
            head:[["Lote","Descrição","Qtd","Edital V.Unit","Edital Final","Meu V.Unit","%","Meu Final"]],
            body:rows,
            foot:[["","","","","TOTAL EDITAL", utils.formatBrl(geralEdital),"TOTAL MEUS", utils.formatBrl(geralMeus)]],
            styles:{fontSize:8,cellPadding:2.5},
            headStyles:{fillColor:[21,38,66],textColor:255},
            footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
            alternateRowStyles:{fillColor:[248,250,253]}
          });
          doc.save("proposta-comercial-licsystem.pdf");
        });
      }).catch(function(err){ alert("Falha ao gerar PDF: "+err.message); });
    },

    onEdit:function(i,f,val){
      var it=LICSYSTEM.state.orcItems[i]; if(!it) return;
      if(f==="produto"||f==="link"||f==="lote") it[f]=val;
      else it[f]=Number(val)||0;

      if(f==="qtd" || f==="editalVunit"){
        if(Number(it.editalVunit) > 0){
          it.editalTotal = (Number(it.qtd)||0) * (Number(it.editalVunit)||0);
        }
      }

      LICSYSTEM.state._orcDirty = true;
      var row = document.querySelector('#orcBody [data-item-idx="'+i+'"]');
      if(row){
        var edCell = row.querySelector('[data-edital-total="'+i+'"]');
        var meCell = row.querySelector('[data-meus-total="'+i+'"]');
        if(edCell) edCell.textContent = utils.formatBrl(LICSYSTEM.orcamento.calcEditalTotal(it));
        if(meCell) meCell.textContent = utils.formatBrl(LICSYSTEM.orcamento.calcTotal(it));
        if(f==="link"){
          var linkBtn = row.querySelector(".orcOpenLink");
          if(linkBtn){
            var ready = !!(String(val || "").trim());
            linkBtn.disabled = !ready;
            linkBtn.classList.toggle("is-ready", ready);
            linkBtn.title = ready ? "Abrir link de acesso" : "Cole um link no campo Link de Acesso";
          }
        }
      }
      var geralMeus = 0, geralEdital = 0;
      for(var k=0;k<LICSYSTEM.state.orcItems.length;k++){
        geralMeus += LICSYSTEM.orcamento.calcTotal(LICSYSTEM.state.orcItems[k]);
        geralEdital += LICSYSTEM.orcamento.calcEditalTotal(LICSYSTEM.state.orcItems[k]);
      }
      if(el("orcTotalGeral")) el("orcTotalGeral").textContent = utils.formatBrl(geralMeus);
      if(el("orcTotalEdital")) el("orcTotalEdital").textContent = utils.formatBrl(geralEdital);
      LICSYSTEM.orcamento.scheduleSave();
    }
  };

  /* ============================ CRUZAMENTO ============================ */
  LICSYSTEM.cruzamento = {
    BATCH_SIZE: 20,
    REQUEST_DELAY_MS: 1000,
    _busy: false,

    sleep: function(ms){
      return new Promise(function(resolve){ setTimeout(resolve, ms); });
    },

    setProgress: function(done, total, label){
      var bar = el("progress-bar");
      var lab = el("progressLabel");
      var pct = total > 0 ? Math.round((done / total) * 100) : 0;
      if(bar){
        bar.style.width = pct + "%";
        bar.setAttribute("aria-valuenow", String(pct));
      }
      if(lab) lab.textContent = label || (done + " / " + total + " itens (" + pct + "%)");
    },

    getSelectedItens: function(){
      var selected = [];
      document.querySelectorAll(".orcChk:checked").forEach(function(c){
        var i = Number(c.getAttribute("data-i"));
        var it = LICSYSTEM.state.orcItems[i];
        if(it && String(it.produto||"").trim()){
          selected.push({ fonte:"orcamento", index:i, descricao:String(it.produto).trim() });
        }
      });
      if(!selected.length){
        var avulso = (el("cruzItem").value || "").trim();
        if(avulso) selected.push({ fonte:"avulso", index:-1, descricao:avulso });
      }
      return selected;
    },

    resolveCep: function(){
      return LICSYSTEM.ferramentas.getPerfil().then(function(perfil){
        var cepPerfil = String((perfil && perfil.cep) || "").replace(/\D/g,"");
        var cepInput = (el("cruzCep").value || "").replace(/\D/g,"");
        if(cepPerfil && el("cruzCep") && !cepInput) el("cruzCep").value = cepPerfil;
        return cepPerfil || cepInput || "";
      }).catch(function(){
        return (el("cruzCep").value || "").replace(/\D/g,"");
      });
    },

    fetchFrete: function(itemId, cep, permalink, opts){
      opts = opts || {};
      /* Anúncio já veio com frete grátis na busca ML */
      if(opts.freeShipping){
        return Promise.resolve({
          cost: 0,
          note: "FRETE GRÁTIS",
          free_shipping: true,
          itemId: itemId,
          calculated: false
        });
      }
      if(!cep){
        return Promise.resolve({
          cost: 0,
          note: "Informe o CEP da sua cidade para calcular o frete",
          free_shipping: false,
          itemId: itemId,
          calculated: false
        });
      }
      // Proxy backend — calcula frete para o CEP (cidade do perfil / campo)
      return utils.mlShipping(itemId, cep, permalink).then(function(sj){
        var optsShip = (sj && sj.options) || [];
        var cost = null;
        optsShip.forEach(function(o){
          if(typeof o.cost === "number"){
            if(cost === null || o.cost < cost) cost = o.cost;
          }
        });
        if(cost === null && typeof (sj && sj.cost) === "number") cost = Number(sj.cost);
        var free =
          !!(sj && sj.free_shipping) ||
          cost === 0 ||
          /frete\s*gr[aá]tis|gratis/i.test(String((sj && sj.note) || ""));
        if(free){
          return {
            cost: 0,
            note: "FRETE GRÁTIS",
            free_shipping: true,
            itemId: (sj && sj.itemId) || itemId,
            calculated: true,
            options: optsShip
          };
        }
        if(cost === null){
          return {
            cost: 0,
            note: (sj && sj.note) || "Frete não disponível para este CEP",
            free_shipping: false,
            itemId: (sj && sj.itemId) || itemId,
            calculated: false,
            options: optsShip
          };
        }
        return {
          cost: cost,
          note: "Frete para CEP " + String(cep).replace(/^(\d{5})(\d{3})$/, "$1-$2"),
          free_shipping: false,
          itemId: (sj && sj.itemId) || itemId,
          calculated: true,
          options: optsShip
        };
      }).catch(function(err){
        return {
          cost: 0,
          note: "Falha ao calcular frete" + (err && err.message ? " ("+err.message+")" : ""),
          free_shipping: false,
          itemId: itemId,
          calculated: false
        };
      });
    },

    calcValorFinal: function(precoMl, frete, desconto, margem, imposto, custoOp){
      var base = (Number(precoMl)||0) + (Number(frete)||0) - (Number(desconto)||0);
      if(base < 0) base = 0;
      return base * (1 + ((Number(margem)||0) + (Number(imposto)||0) + (Number(custoOp)||0)) / 100);
    },

    processarItem: function(termo, opts){
      var embalagem = opts.embalagem;
      var cep = opts.cep;
      var margem = opts.margem;
      var imposto = opts.imposto;
      var custoOp = opts.custoOp;
      var desconto = opts.desconto;
      var query = utils.mlQueryFromTermo(termo, embalagem);
      if(!query) return Promise.resolve(null);

      // Busca SOMENTE via /api/search-ml (OAuth no servidor) — nunca direto no ML
      return utils.mlSearch(query, 10).then(function(j){
        var results = ((j && j.results) || []).filter(function(it){
          return it.available_quantity !== 0;
        });
        // Se veio vazio, tenta so as 3 primeiras palavras (mais generico)
        if(!results.length){
          var shortQ = query.split(/\s+/).slice(0, 3).join(" ");
          if(shortQ && shortQ !== query){
            return utils.mlSearch(shortQ, 10).then(function(j2){
              return LICSYSTEM.cruzamento._finishMlItem(termo, opts, j2 || j, shortQ);
            });
          }
        }
        return LICSYSTEM.cruzamento._finishMlItem(termo, opts, j, query);
      }).catch(function(err){
        var msg = (err && err.message) ? err.message : String(err);
        if(/failed to fetch|NetworkError|Load failed/i.test(msg)){
          msg = "API /api/search-ml indisponível. Faça deploy na Vercel com ML_APP_ID e ML_CLIENT_SECRET.";
        }
        throw new Error(msg);
      });
    },

    _finishMlItem: function(termo, opts, j, queryUsada){
      var embalagem = opts.embalagem;
      var cep = opts.cep;
      var margem = opts.margem;
      var imposto = opts.imposto;
      var custoOp = opts.custoOp;
      var desconto = opts.desconto;
      var results = ((j && j.results) || []).filter(function(it){
        return it.available_quantity !== 0;
      });
      if(!results.length){
        var motivo = "Nenhum produto encontrado no Mercado Livre para \"" + (queryUsada || termo) + "\".";
        if(j && j.error){
          motivo = String(j.error);
        } else if(j && j.warning){
          motivo += " " + j.warning;
        }
        return { skipped:true, itemGoverno:termo, motivo:motivo };
      }

      results.forEach(function(it){ it.__sim = utils.similaridade(termo, it.title); });
      results.sort(function(a,b){ return b.__sim - a.__sim; });
      var best = results[0];
      var freeFromSearch = !!(best.free_shipping || /frete\s*gr[aá]tis/i.test(best.freteLabel || ""));

      return LICSYSTEM.cruzamento.fetchFrete(best.id, cep, best.permalink || "", {
        freeShipping: freeFromSearch
      }).then(function(fr){
        var precoMl = Number(best.price)||0;
        var freteGratis = !!(fr && fr.free_shipping) || freeFromSearch || Number(fr && fr.cost) === 0 && /frete\s*gr[aá]tis/i.test(String((fr && fr.note) || ""));
        var frete = freteGratis ? 0 : (Number(fr.cost)||0);
        var freteOk = freteGratis || !!(fr && fr.calculated && frete >= 0 && Number(fr.cost) === frete && !/não disponível|Falha|Informe o CEP/i.test(fr.note || ""));
        if(fr && fr.calculated && typeof fr.cost === "number" && !freteGratis){
          freteOk = true;
          frete = Number(fr.cost) || 0;
        }
        var custoReal = Math.max(0, precoMl + frete - desconto);
        var precoVenda = LICSYSTEM.cruzamento.calcValorFinal(precoMl, frete, desconto, margem, imposto, custoOp);
        var sim = best.__sim;
        var status, cls, statusLabel;
        if(sim>=80){ status="Match Automatico"; cls="r-green"; statusLabel="b-green"; }
        else if(sim>=60){ status="Revisao Manual"; cls="r-yellow"; statusLabel="b-yellow"; }
        else { status="Descartado"; cls="r-red"; statusLabel="b-red"; }

        var idMl = (fr && fr.itemId) || best.id;
        var notes = [];
        if(freteGratis){
          notes.push("FRETE GRÁTIS");
        } else if(fr && fr.calculated && frete >= 0){
          notes.push(fr.note || ("Frete para sua cidade (CEP " + cep + ")"));
        } else if(!cep){
          notes.push("Informe o CEP da sua cidade para calcular o frete");
        } else if(fr && fr.note){
          notes.push(fr.note);
        }
        if(!(precoMl > 0)) notes.push("Preço não retornado — informe manualmente.");
        if(best.seller) notes.push("Vendedor: " + best.seller);

        var record = {
          itemGoverno: termo,
          produtoML: best.title,
          idML: idMl,
          custoProduto: precoMl,
          frete: frete,
          freteGratis: freteGratis,
          freteOk: freteOk,
          descontoFornecedor: desconto,
          custoReal: custoReal,
          precoVenda: precoVenda,
          margem: margem,
          imposto: imposto,
          custoOperacional: custoOp,
          embalagem: embalagem,
          similaridade: sim,
          status: status,
          link: best.permalink || "",
          cepUsado: cep,
          seller: best.seller || "",
          mlSource: (j && j.source) || "proxy",
          queryUsada: queryUsada || "",
          processadoEm: new Date().toISOString()
        };
        return { record:record, cls:cls, statusLabel:statusLabel, freteNote:notes.join(" · ") };
      });
    },

    processar: function(){
      if(LICSYSTEM.cruzamento._busy){
        showAlert("cruzStatus","warn","Já existe um lote em andamento.");
        return;
      }

      var itens = LICSYSTEM.cruzamento.getSelectedItens();
      if(!itens.length){
        showAlert("cruzStatus","warn","Selecione itens no Orçamento (checkbox) ou informe um item avulso.");
        return;
      }

      var embalagem = (document.querySelector('input[name=embalagem]:checked')||{}).value || "unidade";
      var margem = Number(el("cruzMargem").value)||0;
      var imposto = Number(el("cruzImposto").value)||0;
      var custoOp = Number(el("cruzCustoOp").value)||0;
      var desconto = Number((el("cruzDesconto") && el("cruzDesconto").value) || 0) || 0;
      LICSYSTEM.state.lastBdi = { margem:margem, imposto:imposto, custoOperacional:custoOp, descontoFornecedor:desconto };

      if(utils.hasFirebaseConfig()){
        showAlert("cruzMode","info","Lote ML — resultados aprovados serão gravados no Realtime Database. CEP do perfil será usado no frete.");
      } else {
        hideAlert("cruzMode");
      }

      var btn = el("btnCruzar");
      if(btn){ btn.disabled = true; btn.textContent = "⏳ Processando…"; }
      LICSYSTEM.cruzamento._busy = true;
      el("cruzResults").innerHTML = "";
      LICSYSTEM.cruzamento.setProgress(0, itens.length, "Preparando lote de "+itens.length+" item(ns)…");
      showAlert("cruzStatus","info",'<span class="spinner"></span> Processando lote (grupos de '+LICSYSTEM.cruzamento.BATCH_SIZE+', delay '+ (LICSYSTEM.cruzamento.REQUEST_DELAY_MS/1000) +'s)…');

      LICSYSTEM.cruzamento.resolveCep().then(function(cep){
        var opts = { embalagem:embalagem, cep:cep, margem:margem, imposto:imposto, custoOp:custoOp, desconto:desconto };
        var done = 0;
        var total = itens.length;
        var ok = 0, fail = 0;

        function runBatch(start){
          if(start >= total){
            LICSYSTEM.cruzamento._busy = false;
            if(btn){ btn.disabled = false; btn.textContent = "⚙️ Processar Lote (ML)"; }
            LICSYSTEM.cruzamento.setProgress(total, total, "Concluído: "+ok+" ok · "+fail+" falha(s)/sem match");
            showAlert("cruzStatus","ok","✅ Lote finalizado — "+ok+" processado(s), "+fail+" sem resultado/erro.");
            return Promise.resolve();
          }

          var end = Math.min(start + LICSYSTEM.cruzamento.BATCH_SIZE, total);
          var chunk = itens.slice(start, end);
          var seq = Promise.resolve();

          chunk.forEach(function(item, idxInChunk){
            seq = seq.then(function(){
              var globalIdx = start + idxInChunk;
              LICSYSTEM.cruzamento.setProgress(done, total, "Grupo "+(Math.floor(start/LICSYSTEM.cruzamento.BATCH_SIZE)+1)+" — item "+(globalIdx+1)+"/"+total+": "+item.descricao.slice(0,48));
              return LICSYSTEM.cruzamento.processarItem(item.descricao, opts).then(function(out){
                done++;
                if(!out || out.skipped){
                  fail++;
                  if(out && out.skipped){
                    el("cruzResults").insertAdjacentHTML("afterbegin",
                      '<div class="result-item r-red"><div class="ri-title">'+utils.escapeHtml(out.itemGoverno)+'</div>'+
                      '<div class="ri-sub">'+utils.escapeHtml(out.motivo||"Ignorado")+'</div></div>');
                  }
                } else {
                  ok++;
                  LICSYSTEM.cruzamento.renderResult(out.record, out.cls, out.statusLabel, out.freteNote);
                  if(out.record.similaridade >= 80) LICSYSTEM.cruzamento.aprovar(out.record, true);
                }
                LICSYSTEM.cruzamento.setProgress(done, total);
                // delay 1s entre cada requisição (exceto após o último do lote total)
                if(globalIdx < total - 1) return LICSYSTEM.cruzamento.sleep(LICSYSTEM.cruzamento.REQUEST_DELAY_MS);
              }).catch(function(err){
                done++; fail++;
                el("cruzResults").insertAdjacentHTML("afterbegin",
                  '<div class="result-item r-red"><div class="ri-title">'+utils.escapeHtml(item.descricao)+'</div>'+
                  '<div class="ri-sub">Erro: '+utils.escapeHtml(err.message||String(err))+'</div></div>');
                LICSYSTEM.cruzamento.setProgress(done, total);
                if(globalIdx < total - 1) return LICSYSTEM.cruzamento.sleep(LICSYSTEM.cruzamento.REQUEST_DELAY_MS);
              });
            });
          });

          return seq.then(function(){ return runBatch(end); });
        }

        return runBatch(0);
      }).catch(function(err){
        LICSYSTEM.cruzamento._busy = false;
        if(btn){ btn.disabled = false; btn.textContent = "⚙️ Processar Lote (ML)"; }
        showAlert("cruzStatus","error","Falha no motor de cruzamento: "+utils.escapeHtml(err.message||String(err)));
      });
    },

    renderResult:function(rec, cls, statusLabel, freteNote){
      var box = el("cruzResults");
      var id = "res_"+Date.now()+"_"+Math.floor(Math.random()*1000);
      var showForce = (rec.similaridade>=60 && rec.similaridade<80);
      var freteHtml;
      if(rec.freteGratis || Number(rec.frete) === 0 && /frete\s*gr[aá]tis/i.test(freteNote || "")){
        freteHtml = '<span style="color:#1e9e5a;font-weight:800">FRETE GRÁTIS</span>';
      } else if(rec.freteOk || Number(rec.frete) > 0){
        freteHtml = utils.formatBrl(rec.frete) +
          (rec.cepUsado ? ' <span class="small muted">(CEP '+utils.escapeHtml(String(rec.cepUsado).replace(/^(\d{5})(\d{3})$/, "$1-$2"))+')</span>' : "");
      } else {
        freteHtml = '<span class="small muted">'+utils.escapeHtml(freteNote || "Frete não calculado")+'</span>';
      }
      var html='<div class="result-item '+cls+'" id="'+id+'">'+
        '<div class="ri-head">'+
          '<div><div class="ri-title">'+utils.escapeHtml(rec.produtoML)+'</div>'+
          '<div class="ri-sub">Item edital: '+utils.escapeHtml(rec.itemGoverno)+'</div>'+
          (rec.freteGratis ? '<div style="margin-top:6px"><span class="badge-status b-green">FRETE GRÁTIS</span></div>' : '')+
          '</div>'+
          '<div style="text-align:right"><div class="sim-ring" style="color:'+(rec.similaridade>=80?'#1e9e5a':rec.similaridade>=60?'#c9911f':'#d23b3b')+'">'+rec.similaridade+'%</div>'+
          '<span class="badge-status '+statusLabel+'">'+utils.escapeHtml(rec.status)+'</span></div>'+
        '</div>'+
        '<div class="ri-grid">'+
          metric("Preço ML", utils.formatBrl(rec.custoProduto))+
          metric("Frete", freteHtml)+
          metric("Desconto Forn.", utils.formatBrl(rec.descontoFornecedor||0))+
          metric("Custo Real", utils.formatBrl(rec.custoReal))+
          metric("Valor Final", utils.formatBrl(rec.precoVenda))+
          metric("Embalagem", rec.embalagem)+
        '</div>'+
        (freteNote && !rec.freteGratis ? '<div class="small muted" style="margin-top:8px">'+utils.escapeHtml(freteNote)+'</div>' : '')+
        '<div class="btn-row" style="margin-top:12px">'+
          (rec.link?'<a class="btn btn-ghost btn-sm" target="_blank" href="'+utils.escapeHtml(rec.link)+'">🔗 Ver Anúncio</a>':'')+
          (showForce?'<button type="button" class="btn btn-green btn-sm cruzForce">✔ Forçar Aprovação</button>':'')+
        '</div></div>';
      box.insertAdjacentHTML("afterbegin", html);
      if(showForce){
        var node = el(id).querySelector(".cruzForce");
        node.addEventListener("click", function(){
          LICSYSTEM.cruzamento.aprovar(rec, false);
          node.textContent="✔ Aprovado";
          node.disabled=true;
          node.classList.remove("btn-green"); node.classList.add("btn-ghost");
        });
      }
      function metric(l,v){ return '<div class="ri-metric"><div class="m-l">'+utils.escapeHtml(l)+'</div><div class="m-v">'+v+'</div></div>'; }
    },

    aprovar:function(rec, auto){
      var exists = LICSYSTEM.state.aprovadosCruzamento.some(function(a){ return a.idML===rec.idML && a.itemGoverno===rec.itemGoverno; });
      if(!exists){ LICSYSTEM.state.aprovadosCruzamento.push(rec); }
      var path = utils.buildFirebasePath();
      if(utils.hasFirebaseConfig()){
        utils.firebasePush(path, rec).then(function(){
          /* silencioso em lote — status geral no fim */
        }).catch(function(){ /* silencioso */ });
      } else if(auto){
        /* modo local — silencioso em lote */
      }
    },

    gerarProposta:function(){
      if(!LICSYSTEM.state.aprovadosCruzamento.length){ alert("Nenhum item aprovado no cruzamento ainda."); return; }
      utils.ensureJsPdf().then(function(){
        var jsPDF = window.jspdf.jsPDF;
        var doc = new jsPDF({orientation:"landscape"});
        return licsystemPdfHeader(doc,"Proposta Comercial — Cruzamento ML", true).then(function(startY){
          var y = startY;
          if(LICSYSTEM.state.lastBdi){
            doc.setFontSize(9); doc.setTextColor(90);
            doc.text("BDI: Margem "+LICSYSTEM.state.lastBdi.margem+"% | Imposto "+LICSYSTEM.state.lastBdi.imposto+"% | Custo Op. "+LICSYSTEM.state.lastBdi.custoOperacional+"% | Desc. "+utils.formatBrl(LICSYSTEM.state.lastBdi.descontoFornecedor||0), 14, y);
            y+=6;
          }
          var rows=[], geral=0;
          LICSYSTEM.state.aprovadosCruzamento.forEach(function(a,i){
            geral+=Number(a.precoVenda)||0;
            rows.push([i+1, a.itemGoverno, a.produtoML, a.similaridade+"%", utils.formatBrl(a.custoReal), utils.formatBrl(a.precoVenda)]);
          });
          doc.autoTable({
            startY:y+2,
            head:[["#","Item Edital","Produto ML","Sim.","Custo Real","Valor Final"]],
            body:rows,
            foot:[["","","","","TOTAL", utils.formatBrl(geral)]],
            styles:{fontSize:8.5,cellPadding:3},
            headStyles:{fillColor:[21,38,66],textColor:255},
            footStyles:{fillColor:[201,162,39],textColor:[21,38,66],fontStyle:"bold"},
            alternateRowStyles:{fillColor:[248,250,253]}
          });
          doc.save("proposta-cruzamento-licsystem.pdf");
        });
      }).catch(function(err){ alert("Falha ao gerar PDF: "+err.message); });
    }
  };

  /* ============================ COFRE ============================ */
  var COFRE_DOCS = [
    {key:"cnpj", label:"CNPJ (Cartão)", tipo:"habilitacao"},
    {key:"cndFederal", label:"CND Federal", tipo:"certidao"},
    {key:"cndEstadual", label:"CND Estadual", tipo:"certidao"},
    {key:"cndMunicipal", label:"CND Municipal", tipo:"certidao"},
    {key:"fgts", label:"FGTS (CRF)", tipo:"certidao"},
    {key:"cndt", label:"INSS / CNDT", tipo:"certidao"},
    {key:"balanco", label:"Balanço Patrimonial", tipo:"habilitacao"},
    {key:"contratoSocial", label:"Contrato Social", tipo:"contrato"}
  ];
  var COFRE_MAX_FILE = 1.5 * 1024 * 1024; // 1,5 MB — base64 (~33% maior) no localStorage/Firebase RTDB
  LICSYSTEM.cofre = {
    data: { v: 2, items: [] },
    _pendingFile: null,
    _selected: {},

    emptyData: function(){
      return { v: 2, items: [] };
    },

    tipoLabel: function(tipo){
      var map = {
        habilitacao: "Habilitação",
        certidao: "Certidão",
        contrato: "Contrato",
        tecnica: "Técnica",
        outro: "Outro"
      };
      return map[tipo] || "Outro";
    },

    normalizeItem: function(d, idx){
      d = d || {};
      var id = String(d.id || d.key || ("cof_" + Date.now() + "_" + (idx || 0)));
      var key = d.key != null && d.key !== "" ? String(d.key) : null;
      var tipo = String(d.tipo || "outro").toLowerCase();
      if(["habilitacao","certidao","contrato","tecnica","outro"].indexOf(tipo) === -1) tipo = "outro";
      return {
        id: id,
        key: key,
        nome: String(d.nome || d.label || "Documento").trim().slice(0, 220) || "Documento",
        tipo: tipo,
        validade: String(d.validade || d.date || "").trim().slice(0, 12),
        link: String(d.link || "").trim().slice(0, 500),
        obs: String(d.obs || "").trim().slice(0, 400),
        arquivoNome: String(d.arquivoNome || "").trim().slice(0, 220),
        arquivoMime: String(d.arquivoMime || "").trim().slice(0, 120),
        arquivoData: typeof d.arquivoData === "string" ? d.arquivoData : "",
        fixed: !!d.fixed
      };
    },

    migrateLegacy: function(raw){
      if(!raw || typeof raw !== "object" || Array.isArray(raw)) return this.emptyData();
      if(Array.isArray(raw.items)){
        return {
          v: 2,
          items: raw.items.map(function(it, i){ return LICSYSTEM.cofre.normalizeItem(it, i); })
        };
      }
      // Legacy flat map: { cnpj: "2025-01-01", ... }
      var items = COFRE_DOCS.map(function(doc, i){
        return LICSYSTEM.cofre.normalizeItem({
          id: doc.key,
          key: doc.key,
          nome: doc.label,
          tipo: doc.tipo || "outro",
          validade: raw[doc.key] || "",
          fixed: true
        }, i);
      });
      // Keep any unknown keys as custom docs
      Object.keys(raw).forEach(function(k, i){
        if(k === "v" || k === "items") return;
        if(COFRE_DOCS.some(function(d){ return d.key === k; })) return;
        var val = raw[k];
        if(typeof val === "string"){
          items.push(LICSYSTEM.cofre.normalizeItem({
            id: "legacy_" + k,
            key: k,
            nome: k,
            validade: val
          }, 100 + i));
        }
      });
      return { v: 2, items: items };
    },

    applyData: function(data, opts){
      opts = opts || {};
      LICSYSTEM.cofre.data = LICSYSTEM.cofre.migrateLegacy(data);
      if(!opts.skipPersist){
        try{ localStorage.setItem(COFRE_KEY, JSON.stringify(LICSYSTEM.cofre.data)); }catch(e){}
      }
      if(LICSYSTEM.state.currentView === "cofre" || LICSYSTEM.state._cofreRendered){
        try{ LICSYSTEM.cofre.render(); }catch(e){}
      }
    },

    load: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(COFRE_KEY) || "null");
        if(raw && typeof raw === "object"){
          // Persist local se migrar do formato antigo { chave: data }
          var isV2 = Array.isArray(raw.items);
          LICSYSTEM.cofre.applyData(raw, { skipPersist: isV2 });
        } else {
          LICSYSTEM.cofre.data = LICSYSTEM.cofre.emptyData();
        }
      }catch(e){
        LICSYSTEM.cofre.data = LICSYSTEM.cofre.emptyData();
      }
    },

    items: function(){
      return (LICSYSTEM.cofre.data && LICSYSTEM.cofre.data.items) || [];
    },

    findById: function(id){
      id = String(id || "");
      return LICSYSTEM.cofre.items().filter(function(it){ return it.id === id; })[0] || null;
    },

    findByKey: function(key){
      key = String(key || "");
      if(!key) return null;
      return LICSYSTEM.cofre.items().filter(function(it){
        return it.key === key || it.id === key;
      })[0] || null;
    },

    getValidade: function(key){
      var it = LICSYSTEM.cofre.findByKey(key);
      return it ? (it.validade || "") : "";
    },

    getLabel: function(key){
      var it = LICSYSTEM.cofre.findByKey(key);
      if(it) return it.nome;
      var fixed = COFRE_DOCS.filter(function(d){ return d.key === key; })[0];
      return fixed ? fixed.label : key;
    },

    statusOf: function(dateStr){
      if(!dateStr) return {cls:"b-red", txt:"Sem data", kind:"none"};
      var d = new Date(dateStr+"T00:00:00");
      if(isNaN(d.getTime())) return {cls:"b-red", txt:"Sem data", kind:"none"};
      var now = new Date(); now.setHours(0,0,0,0);
      var diff = Math.round((d - now)/86400000);
      if(diff < 0) return {cls:"b-red", txt:"Vencido", kind:"expired"};
      if(diff <= 15) return {cls:"b-yellow", txt:"Vence em "+diff+"d", kind:"warn"};
      return {cls:"b-green", txt:"Válido", kind:"ok"};
    },

    persist: function(opts){
      opts = opts || {};
      try{
        localStorage.setItem(COFRE_KEY, JSON.stringify(LICSYSTEM.cofre.data));
      }catch(e){
        showAlert("cofreAlert","error","Não foi possível salvar (armazenamento cheio?). Remova arquivos grandes ou use link.");
        return false;
      }
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("cofre", {
          updatedAt: Date.now(),
          immediate: !!opts.immediate
        });
      }
      return true;
    },

    save: function(){
      if(LICSYSTEM.cofre.persist({ immediate: true })){
        showAlert("cofreAlert","ok","Cofre salvo" + (LICSYSTEM.cloudSync ? " e sincronizado." : "."));
      }
    },

    seedDefaults: function(force){
      var existing = LICSYSTEM.cofre.items();
      if(existing.length && !force){
        showAlert("cofreAlert","warn","Já existem documentos. Use Adicionar para incluir novos.");
        return;
      }
      if(existing.length && force){
        if(!confirm("Isso adiciona os documentos padrão que ainda não existem (não apaga os atuais). Continuar?")) return;
      }
      var keys = {};
      existing.forEach(function(it){ if(it.key) keys[it.key] = true; });
      var added = 0;
      COFRE_DOCS.forEach(function(doc, i){
        if(keys[doc.key]) return;
        existing.push(LICSYSTEM.cofre.normalizeItem({
          id: doc.key,
          key: doc.key,
          nome: doc.label,
          tipo: doc.tipo || "outro",
          validade: "",
          fixed: true
        }, i));
        added++;
      });
      LICSYSTEM.cofre.data = { v: 2, items: existing };
      LICSYSTEM.cofre.persist({ immediate: true });
      LICSYSTEM.cofre.render();
      showAlert("cofreAlert","ok", added ? (added + " documento(s) padrão adicionado(s).") : "Todos os padrões já estão no cofre.");
    },

    selectedIds: function(){
      var box = el("cofreList");
      if(!box) return [];
      var ids = [];
      box.querySelectorAll(".cofreSelChk:checked").forEach(function(chk){
        ids.push(chk.getAttribute("data-id"));
      });
      return ids;
    },

    openModal: function(item){
      var ov = el("cofreOverlay");
      if(!ov) return;
      hideAlert("cofreModalAlert");
      LICSYSTEM.cofre._pendingFile = null;
      var editing = !!item;
      el("cofreModalTitle").textContent = editing ? "Editar documento" : "Adicionar documento";
      el("cofreModalLead").textContent = editing
        ? "Atualize validade, arquivo ou dados — útil para documentos vencidos."
        : "Informe os dados do documento. Arquivo (PDF/imagem) ou link externo.";
      el("cofreEditId").value = editing ? item.id : "";
      el("cofreNome").value = editing ? (item.nome || "") : "";
      el("cofreTipo").value = editing ? (item.tipo || "outro") : "habilitacao";
      el("cofreValidade").value = editing ? (item.validade || "") : "";
      el("cofreLink").value = editing ? (item.link || "") : "";
      el("cofreObs").value = editing ? (item.obs || "") : "";
      var fileInp = el("cofreArquivo");
      if(fileInp) fileInp.value = "";
      var info = el("cofreArquivoInfo");
      if(info){
        info.textContent = editing && item.arquivoNome
          ? ("Arquivo atual: " + item.arquivoNome + " (envie outro para substituir)")
          : "Nenhum arquivo anexado.";
      }
      ov.classList.add("open");
      ov.setAttribute("aria-hidden","false");
      try{ el("cofreNome").focus(); }catch(e){}
    },

    closeModal: function(){
      var ov = el("cofreOverlay");
      if(!ov) return;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden","true");
      LICSYSTEM.cofre._pendingFile = null;
    },

    readFileAsDataUrl: function(file){
      return new Promise(function(resolve, reject){
        if(!file){ resolve(null); return; }
        if(file.size > COFRE_MAX_FILE){
          reject(new Error("Máximo 1,5 MB. Para arquivos maiores, use o campo Link."));
          return;
        }
        var okMime = /^(application\/pdf|image\/)/i.test(file.type) || /\.(pdf|png|jpe?g|webp|gif)$/i.test(file.name || "");
        if(!okMime){
          reject(new Error("Formato não suportado. Use PDF ou imagem."));
          return;
        }
        var reader = new FileReader();
        reader.onload = function(){ resolve({ nome: file.name, mime: file.type || "application/octet-stream", data: String(reader.result || "") }); };
        reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo.")); };
        reader.readAsDataURL(file);
      });
    },

    saveFromModal: function(){
      var nome = String((el("cofreNome") && el("cofreNome").value) || "").trim();
      if(!nome){
        showAlert("cofreModalAlert","warn","Informe o nome do documento.");
        return;
      }
      var editId = String((el("cofreEditId") && el("cofreEditId").value) || "");
      var existing = editId ? LICSYSTEM.cofre.findById(editId) : null;
      var fileInp = el("cofreArquivo");
      var file = fileInp && fileInp.files && fileInp.files[0] ? fileInp.files[0] : null;

      function commit(fileMeta){
        var item = LICSYSTEM.cofre.normalizeItem({
          id: existing ? existing.id : ("cof_" + Date.now()),
          key: existing ? existing.key : null,
          nome: nome,
          tipo: (el("cofreTipo") && el("cofreTipo").value) || "outro",
          validade: (el("cofreValidade") && el("cofreValidade").value) || "",
          link: (el("cofreLink") && el("cofreLink").value) || "",
          obs: (el("cofreObs") && el("cofreObs").value) || "",
          arquivoNome: fileMeta ? fileMeta.nome : (existing ? existing.arquivoNome : ""),
          arquivoMime: fileMeta ? fileMeta.mime : (existing ? existing.arquivoMime : ""),
          arquivoData: fileMeta ? fileMeta.data : (existing ? existing.arquivoData : ""),
          fixed: existing ? existing.fixed : false
        });
        var list = LICSYSTEM.cofre.items().slice();
        if(existing){
          list = list.map(function(it){ return it.id === existing.id ? item : it; });
        } else {
          list.push(item);
        }
        LICSYSTEM.cofre.data = { v: 2, items: list };
        if(!LICSYSTEM.cofre.persist({ immediate: true })) return;
        LICSYSTEM.cofre.closeModal();
        LICSYSTEM.cofre.render();
        showAlert("cofreAlert","ok", existing ? "Documento atualizado." : "Documento adicionado.");
      }

      if(file){
        LICSYSTEM.cofre.readFileAsDataUrl(file).then(commit).catch(function(err){
          showAlert("cofreModalAlert","error", err.message || "Erro ao ler arquivo.");
        });
      } else {
        commit(null);
      }
    },

    add: function(){ LICSYSTEM.cofre.openModal(null); },

    editSelected: function(){
      var ids = LICSYSTEM.cofre.selectedIds();
      if(ids.length !== 1){
        showAlert("cofreAlert","warn","Selecione exatamente um documento para editar.");
        return;
      }
      var item = LICSYSTEM.cofre.findById(ids[0]);
      if(!item){ showAlert("cofreAlert","error","Documento não encontrado."); return; }
      LICSYSTEM.cofre.openModal(item);
    },

    editById: function(id){
      var item = LICSYSTEM.cofre.findById(id);
      if(!item) return;
      LICSYSTEM.cofre.openModal(item);
    },

    removeSelected: function(){
      var ids = LICSYSTEM.cofre.selectedIds();
      if(!ids.length){
        showAlert("cofreAlert","warn","Selecione ao menos um documento para remover.");
        return;
      }
      var msg = ids.length === 1
        ? "Remover este documento do cofre?"
        : ("Remover " + ids.length + " documentos do cofre?");
      if(!confirm(msg)) return;
      var set = {};
      ids.forEach(function(id){ set[id] = true; });
      LICSYSTEM.cofre.data = {
        v: 2,
        items: LICSYSTEM.cofre.items().filter(function(it){ return !set[it.id]; })
      };
      LICSYSTEM.cofre.persist({ immediate: true });
      LICSYSTEM.cofre.render();
      showAlert("cofreAlert","ok", ids.length + " documento(s) removido(s).");
    },

    dataUrlToUint8: function(dataUrl){
      try{
        var parts = String(dataUrl || "").split(",");
        var b64 = parts.length > 1 ? parts[1] : parts[0];
        var bin = atob(b64);
        var arr = new Uint8Array(bin.length);
        for(var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        return arr;
      }catch(e){ return null; }
    },

    safeFileName: function(name, fallback){
      var n = String(name || fallback || "documento").replace(/[\\/:*?"<>|]+/g, "_").trim();
      return n.slice(0, 120) || "documento";
    },

    exportZip: function(){
      if(typeof JSZip === "undefined"){
        showAlert("cofreAlert","error","Biblioteca JSZip não carregou. Verifique a conexão e recarregue a página.");
        return;
      }
      var ids = LICSYSTEM.cofre.selectedIds();
      var all = LICSYSTEM.cofre.items();
      var list = ids.length
        ? all.filter(function(it){ return ids.indexOf(it.id) !== -1; })
        : all.slice();
      if(!list.length){
        showAlert("cofreAlert","warn","Nenhum documento para exportar.");
        return;
      }
      showAlert("cofreAlert","info",'<span class="spinner"></span> Gerando ZIP…');
      var zip = new JSZip();
      var csv = ["nome;tipo;validade;status;link;arquivo;observacoes"];
      var folder = zip.folder("documentos");
      list.forEach(function(it, idx){
        var st = LICSYSTEM.cofre.statusOf(it.validade);
        var fname = "";
        if(it.arquivoData){
          var bytes = LICSYSTEM.cofre.dataUrlToUint8(it.arquivoData);
          if(bytes){
            var base = LICSYSTEM.cofre.safeFileName(it.arquivoNome || (it.nome + ".bin"), "doc_" + (idx + 1));
            fname = ("0" + (idx + 1)).slice(-2) + "_" + base;
            folder.file(fname, bytes);
          }
        }
        csv.push([
          it.nome,
          LICSYSTEM.cofre.tipoLabel(it.tipo),
          it.validade || "",
          st.txt,
          it.link || "",
          fname || (it.arquivoNome || ""),
          (it.obs || "").replace(/[\r\n;]+/g, " ")
        ].map(function(c){ return '"' + String(c).replace(/"/g, '""') + '"'; }).join(";"));
      });
      zip.file("indice.csv", "\uFEFF" + csv.join("\r\n"));
      zip.file("indice.txt", list.map(function(it, i){
        var st = LICSYSTEM.cofre.statusOf(it.validade);
        return (i + 1) + ". " + it.nome +
          "\n   Tipo: " + LICSYSTEM.cofre.tipoLabel(it.tipo) +
          "\n   Validade: " + (it.validade || "—") + " (" + st.txt + ")" +
          "\n   Link: " + (it.link || "—") +
          "\n   Arquivo: " + (it.arquivoNome || "—") +
          "\n   Obs: " + (it.obs || "—") + "\n";
      }).join("\n"));

      zip.generateAsync({ type: "blob" }).then(function(blob){
        var a = document.createElement("a");
        var url = URL.createObjectURL(blob);
        a.href = url;
        a.download = "cofre-documentos-" + new Date().toISOString().slice(0, 10) + ".zip";
        document.body.appendChild(a);
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); a.remove(); }, 1500);
        showAlert("cofreAlert","ok", "ZIP exportado com " + list.length + " documento(s).");
      }).catch(function(err){
        showAlert("cofreAlert","error","Falha ao gerar ZIP: " + utils.escapeHtml(err.message || String(err)));
      });
    },

    render: function(){
      var box = el("cofreList");
      if(!box) return;
      var items = LICSYSTEM.cofre.items();
      var selAll = el("cofreSelectAll");

      if(!items.length){
        box.innerHTML =
          '<div class="cofre-empty">Nenhum documento no cofre.<br/>' +
          'Clique em <b>Adicionar</b> ou em <b>Carregar padrões</b> (CNPJ, CNDs, FGTS…).</div>';
        if(selAll) selAll.checked = false;
        return;
      }

      var html = "";
      items.forEach(function(it){
        var st = LICSYSTEM.cofre.statusOf(it.validade);
        var rowCls = "cofre-item";
        if(st.kind === "expired" || st.kind === "none") rowCls += " is-expired";
        else if(st.kind === "warn") rowCls += " is-warn";
        var fileHtml = "";
        if(it.arquivoData && it.arquivoNome){
          fileHtml = '<span class="cofre-file-tag">📎 <a href="' + utils.escapeHtml(it.arquivoData) +
            '" download="' + utils.escapeHtml(it.arquivoNome) + '" target="_blank" rel="noopener">'+
            utils.escapeHtml(it.arquivoNome) + "</a></span>";
        } else if(it.arquivoNome){
          fileHtml = '<span class="cofre-file-tag">📎 ' + utils.escapeHtml(it.arquivoNome) + "</span>";
        }
        if(it.link){
          var url = utils.normalizeHttpUrl ? utils.normalizeHttpUrl(it.link) : it.link;
          if(url){
            fileHtml += (fileHtml ? " · " : "") +
              '<span class="cofre-file-tag">🔗 <a href="' + utils.escapeHtml(url) +
              '" target="_blank" rel="noopener noreferrer">Abrir link</a></span>';
          }
        }
        html +=
          '<div class="' + rowCls + '" data-id="' + utils.escapeHtml(it.id) + '">' +
            '<div class="ci-check"><input type="checkbox" class="cofreSelChk" data-id="' +
              utils.escapeHtml(it.id) + '" /></div>' +
            '<div class="ci-body">' +
              '<div class="ci-name">' + utils.escapeHtml(it.nome) + "</div>" +
              '<div class="ci-meta">' +
                '<span class="cofre-tipo">' + utils.escapeHtml(LICSYSTEM.cofre.tipoLabel(it.tipo)) + "</span>" +
                '<span class="badge-status ' + st.cls + '">' + utils.escapeHtml(st.txt) + "</span>" +
                (it.validade
                  ? '<span class="muted small">Validade: ' + utils.escapeHtml(it.validade.split("-").reverse().join("/")) + "</span>"
                  : '<span class="muted small">Sem validade</span>') +
                fileHtml +
              "</div>" +
              (it.obs ? '<div class="ci-obs">' + utils.escapeHtml(it.obs) + "</div>" : "") +
            "</div>" +
            '<div class="ci-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm cofreEditOne" data-id="' +
                utils.escapeHtml(it.id) + '">Editar</button>' +
            "</div>" +
          "</div>";
      });
      box.innerHTML = html;
      if(selAll){
        var checked = box.querySelectorAll(".cofreSelChk:checked").length;
        selAll.checked = checked === items.length && items.length > 0;
      }
    },

    wire: function(){
      function bind(id, evt, fn){
        var n = el(id);
        if(n && !n._cofreBound){
          n._cofreBound = true;
          n.addEventListener(evt, fn);
        }
      }
      bind("btnCofreAdd","click", function(){ LICSYSTEM.cofre.add(); });
      bind("btnCofreEdit","click", function(){ LICSYSTEM.cofre.editSelected(); });
      bind("btnCofreRemove","click", function(){ LICSYSTEM.cofre.removeSelected(); });
      bind("btnCofreExportZip","click", function(){ LICSYSTEM.cofre.exportZip(); });
      bind("btnCofreSeed","click", function(){ LICSYSTEM.cofre.seedDefaults(true); });
      bind("btnCofreModalCancel","click", function(){ LICSYSTEM.cofre.closeModal(); });
      bind("btnCofreModalSave","click", function(){ LICSYSTEM.cofre.saveFromModal(); });
      bind("cofreSelectAll","change", function(){
        var onAll = !!(el("cofreSelectAll") && el("cofreSelectAll").checked);
        var box = el("cofreList");
        if(!box) return;
        box.querySelectorAll(".cofreSelChk").forEach(function(chk){ chk.checked = onAll; });
      });
      var list = el("cofreList");
      if(list && !list._cofreWired){
        list._cofreWired = true;
        list.addEventListener("click", function(e){
          var btn = e.target.closest(".cofreEditOne");
          if(btn){
            LICSYSTEM.cofre.editById(btn.getAttribute("data-id"));
          }
        });
      }
      var ov = el("cofreOverlay");
      if(ov && !ov._cofreWired){
        ov._cofreWired = true;
        ov.addEventListener("click", function(e){
          if(e.target === ov) LICSYSTEM.cofre.closeModal();
        });
      }
    },

    listDocs: function(){
      var items = LICSYSTEM.cofre.items();
      if(items.length){
        return items.map(function(it){
          return { key: it.key || it.id, label: it.nome };
        });
      }
      return COFRE_DOCS.slice();
    }
  };

  /* ============================ DOCS CHECKLIST (edital) ============================ */
  LICSYSTEM.docsChecklist = {
    data: {
      editalNome: "",
      filename: "",
      updatedAt: 0,
      documentos: []
    },

    emptyData: function(){
      return { editalNome: "", filename: "", updatedAt: 0, documentos: [] };
    },

    load: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(DOCS_CHECKLIST_KEY) || "null");
        if(raw && typeof raw === "object" && !Array.isArray(raw)){
          LICSYSTEM.docsChecklist.applyData(raw, { skipPersist: true });
        } else {
          LICSYSTEM.docsChecklist.data = LICSYSTEM.docsChecklist.emptyData();
        }
      }catch(e){
        LICSYSTEM.docsChecklist.data = LICSYSTEM.docsChecklist.emptyData();
      }
    },

    applyData: function(data, opts){
      opts = opts || {};
      var src = (data && typeof data === "object" && !Array.isArray(data)) ? data : {};
      var docs = Array.isArray(src.documentos) ? src.documentos : [];
      LICSYSTEM.docsChecklist.data = {
        editalNome: String(src.editalNome || "").slice(0, 220),
        filename: String(src.filename || "").slice(0, 220),
        updatedAt: Number(src.updatedAt || 0) || 0,
        documentos: docs.map(function(d, i){
          return LICSYSTEM.docsChecklist.normalizeItem(d, i);
        })
      };
      if(!opts.skipPersist){
        try{ localStorage.setItem(DOCS_CHECKLIST_KEY, JSON.stringify(LICSYSTEM.docsChecklist.data)); }catch(e){}
      }
      if(LICSYSTEM.state.currentView === "docsChecklist"){
        try{ LICSYSTEM.docsChecklist.render(); }catch(e){}
      }
    },

    normalizeItem: function(d, idx){
      d = d || {};
      var id = String(d.id || ("doc_" + Date.now() + "_" + (idx || 0)));
      return {
        id: id,
        nome: String(d.nome || "").trim().slice(0, 220) || "Documento",
        tipo: LICSYSTEM.docsChecklist.normTipo(d.tipo),
        obs: String(d.obs || "").trim().slice(0, 400),
        ok: !!d.ok,
        cofreKey: d.cofreKey ? String(d.cofreKey) : null,
        manual: !!d.manual
      };
    },

    normTipo: function(tipo){
      var t = String(tipo || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      if(t.indexOf("tecnic") !== -1) return "tecnica";
      if(t.indexOf("habilit") !== -1 || t.indexOf("jurid") !== -1 || t.indexOf("fiscal") !== -1 || t.indexOf("econom") !== -1){
        return "habilitacao";
      }
      return "outro";
    },

    tipoLabel: function(tipo){
      var t = LICSYSTEM.docsChecklist.normTipo(tipo);
      if(t === "tecnica") return "Técnica";
      if(t === "habilitacao") return "Habilitação";
      return "Outro";
    },

    normText: function(s){
      var t = String(s || "").toLowerCase();
      try{ t = t.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); }catch(e){}
      return t.replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
    },

    matchCofre: function(nome){
      var n = LICSYSTEM.docsChecklist.normText(nome);
      if(!n) return null;
      var aliases = {
        cnpj: ["cnpj", "cartao cnpj", "comprovante de inscricao", "cadastro nacional"],
        cndFederal: ["cnd federal", "receita federal", "divida ativa da uniao", "certidao conjunta federal", "pgfn"],
        cndEstadual: ["cnd estadual", "fazenda estadual", "icms", "certidao estadual"],
        cndMunicipal: ["cnd municipal", "fazenda municipal", "iss", "certidao municipal"],
        fgts: ["fgts", "crf", "caixa economica", "regularidade do fgts"],
        cndt: ["cndt", "inss", "trabalhista", "debito trabalhista", "tst"],
        balanco: ["balanco", "balanco patrimonial", "demonstracoes contabeis", "indice de liquidez"],
        contratoSocial: ["contrato social", "estatuto social", "ato constitutivo", "alteracao contratual"]
      };
      var best = null;
      var bestScore = 0;
      function scoreDoc(key, label){
        var labelN = LICSYSTEM.docsChecklist.normText(label);
        var score = 0;
        if(!labelN) return;
        if(n.indexOf(labelN) !== -1 || labelN.indexOf(n) !== -1) score = 8;
        var words = labelN.split(" ").filter(function(w){ return w.length > 2; });
        words.forEach(function(w){ if(n.indexOf(w) !== -1) score += 2; });
        (aliases[key] || []).forEach(function(a){
          if(n.indexOf(a) !== -1) score += 5;
        });
        if(score > bestScore){
          bestScore = score;
          best = { key: key, label: label };
        }
      }
      COFRE_DOCS.forEach(function(doc){ scoreDoc(doc.key, doc.label); });
      // Também considera documentos customizados no cofre
      LICSYSTEM.cofre.items().forEach(function(it){
        scoreDoc(it.key || it.id, it.nome);
      });
      if(bestScore < 5) return null;
      return best;
    },

    persist: function(opts){
      opts = opts || {};
      LICSYSTEM.docsChecklist.data.updatedAt = Date.now();
      try{
        localStorage.setItem(DOCS_CHECKLIST_KEY, JSON.stringify(LICSYSTEM.docsChecklist.data));
      }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("docsChecklist", {
          updatedAt: LICSYSTEM.docsChecklist.data.updatedAt,
          immediate: !!opts.immediate
        });
      }
    },

    setFromAnalysis: function(docs, meta){
      meta = meta || {};
      var prevOk = {};
      (LICSYSTEM.docsChecklist.data.documentos || []).forEach(function(d){
        var k = LICSYSTEM.docsChecklist.normText(d.nome);
        if(k) prevOk[k] = !!d.ok;
      });
      var list = (Array.isArray(docs) ? docs : []).map(function(d, i){
        var item = LICSYSTEM.docsChecklist.normalizeItem(d, i);
        var match = LICSYSTEM.docsChecklist.matchCofre(item.nome);
        if(match){
          item.cofreKey = match.key;
          var val = LICSYSTEM.cofre.getValidade(match.key);
          var st = LICSYSTEM.cofre.statusOf(val);
          // Auto-sugerir OK se cofre tem data válida (não vencido)
          if(st && st.cls === "b-green" && !item.ok) item.ok = true;
        }
        var pk = LICSYSTEM.docsChecklist.normText(item.nome);
        if(pk && prevOk[pk] != null) item.ok = prevOk[pk];
        return item;
      });
      LICSYSTEM.docsChecklist.data = {
        editalNome: String(meta.editalNome || meta.filename || "Edital analisado").slice(0, 220),
        filename: String(meta.filename || "").slice(0, 220),
        updatedAt: Date.now(),
        documentos: list
      };
      LICSYSTEM.docsChecklist.persist({ immediate: true });
      LICSYSTEM.docsChecklist.render();
    },

    summary: function(docs){
      var list = Array.isArray(docs) ? docs : (LICSYSTEM.docsChecklist.data.documentos || []);
      var ok = 0;
      list.forEach(function(d){ if(d.ok) ok++; });
      return { total: list.length, ok: ok, pend: Math.max(0, list.length - ok) };
    },

    sameEdital: function(a, b){
      a = a || {};
      b = b || {};
      var af = LICSYSTEM.docsChecklist.normText(a.filename);
      var bf = LICSYSTEM.docsChecklist.normText(b.filename);
      if(af && bf && af === bf) return true;
      var an = LICSYSTEM.docsChecklist.normText(a.editalNome || a.titulo);
      var bn = LICSYSTEM.docsChecklist.normText(b.editalNome || b.titulo);
      return !!(an && bn && an === bn);
    },

    loadExpandStore: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(DOCS_ACCORDION_KEY) || "{}");
        return (raw && typeof raw === "object" && !Array.isArray(raw)) ? raw : {};
      }catch(e){
        return {};
      }
    },

    isExpanded: function(sessionId){
      var store = LICSYSTEM.docsChecklist.loadExpandStore();
      return !!store[String(sessionId || "")];
    },

    setExpanded: function(sessionId, expanded){
      var store = LICSYSTEM.docsChecklist.loadExpandStore();
      var key = String(sessionId || "");
      if(!key) return;
      if(expanded) store[key] = true;
      else delete store[key];
      try{ localStorage.setItem(DOCS_ACCORDION_KEY, JSON.stringify(store)); }catch(e){}
    },

    collectSessions: function(){
      var data = LICSYSTEM.docsChecklist.data || LICSYSTEM.docsChecklist.emptyData();
      var chkDocs = data.documentos || [];
      var hasChecklist = !!(chkDocs.length || data.editalNome || data.filename);
      var usedChecklist = false;
      var sessions = [];
      var lpItems = (LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.items)
        ? LICSYSTEM.leiloesParticipo.items.filter(function(it){
            return it && it.status !== "arquivado" && Array.isArray(it.documentosExigidos) && it.documentosExigidos.length;
          })
        : [];

      lpItems.sort(function(a, b){
        return (Number(b.updatedAt || b.dataAnalise || 0) || 0) - (Number(a.updatedAt || a.dataAnalise || 0) || 0);
      });

      lpItems.forEach(function(it){
        var matchChk = hasChecklist && LICSYSTEM.docsChecklist.sameEdital(data, {
          editalNome: it.titulo,
          filename: it.filename
        });
        var docs;
        var updatedAt;
        if(matchChk){
          docs = chkDocs.map(function(d, i){ return LICSYSTEM.docsChecklist.normalizeItem(d, i); });
          updatedAt = data.updatedAt || it.updatedAt || it.dataAnalise || 0;
          usedChecklist = true;
        } else {
          docs = (it.documentosExigidos || []).map(function(d, i){
            return LICSYSTEM.docsChecklist.normalizeItem(d, i);
          });
          updatedAt = it.updatedAt || it.dataAnalise || 0;
        }
        sessions.push({
          id: String(it.id),
          source: "leilao",
          leilaoId: String(it.id),
          editalNome: it.titulo || it.filename || "Edital",
          filename: it.filename || "",
          updatedAt: Number(updatedAt) || 0,
          documentos: docs,
          usesChecklist: matchChk
        });
      });

      if(hasChecklist && !usedChecklist){
        sessions.unshift({
          id: "checklist",
          source: "checklist",
          leilaoId: null,
          editalNome: data.editalNome || data.filename || "Checklist",
          filename: data.filename || "",
          updatedAt: Number(data.updatedAt) || 0,
          documentos: chkDocs.map(function(d, i){ return LICSYSTEM.docsChecklist.normalizeItem(d, i); }),
          usesChecklist: true
        });
      }

      return sessions;
    },

    findLeilao: function(leilaoId){
      var items = (LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.items) || [];
      for(var i = 0; i < items.length; i++){
        if(String(items[i].id) === String(leilaoId)) return items[i];
      }
      return null;
    },

    renderDocRows: function(docs, sessionId){
      var html = "";
      (docs || []).forEach(function(d){
        var match = d.cofreKey && LICSYSTEM.cofre.findByKey(d.cofreKey)
          ? { key: d.cofreKey, label: LICSYSTEM.cofre.getLabel(d.cofreKey) }
          : LICSYSTEM.docsChecklist.matchCofre(d.nome);
        var cofreHint = "";
        if(match && LICSYSTEM.cofre.findByKey(match.key)){
          var val = LICSYSTEM.cofre.getValidade(match.key);
          var st = LICSYSTEM.cofre.statusOf(val);
          cofreHint =
            '<span class="docs-badge cofre">Encontrado no cofre: ' + utils.escapeHtml(match.label) +
            (st ? " · " + utils.escapeHtml(st.txt) : "") + "</span>";
          d.cofreKey = match.key;
        }
        html +=
          '<div class="docs-row' + (d.ok ? " is-ok" : "") + '" data-id="' + utils.escapeHtml(d.id) + '" data-session="' + utils.escapeHtml(sessionId) + '">' +
            '<label class="docs-ok"><input type="checkbox" class="docsOkChk"' + (d.ok ? " checked" : "") + ' /> OK</label>' +
            '<div>' +
              '<div class="docs-name">' + utils.escapeHtml(d.nome) + "</div>" +
              (d.obs ? '<div class="docs-obs">' + utils.escapeHtml(d.obs) + "</div>" : "") +
              '<div class="docs-badges">' +
                '<span class="docs-badge">' + utils.escapeHtml(LICSYSTEM.docsChecklist.tipoLabel(d.tipo)) + "</span>" +
                (d.ok ? '<span class="docs-badge ok">Tenho</span>' : "") +
                cofreHint +
              "</div>" +
            "</div>" +
            '<div class="docs-actions">' +
              '<button type="button" class="btn btn-ghost btn-sm docsRemove" title="Remover">✕</button>' +
            "</div>" +
          "</div>";
      });
      return html;
    },

    render: function(){
      var box = el("docsList");
      var meta = el("docsMeta");
      var sum = el("docsSummary");
      if(!box) return;

      if(meta){
        meta.style.display = "none";
        meta.innerHTML = "";
      }

      var sessions = LICSYSTEM.docsChecklist.collectSessions();
      var totalAll = 0;
      var okAll = 0;
      sessions.forEach(function(s){
        var sm = LICSYSTEM.docsChecklist.summary(s.documentos);
        totalAll += sm.total;
        okAll += sm.ok;
      });
      var pendAll = Math.max(0, totalAll - okAll);

      if(sum){
        if(!sessions.length){
          sum.innerHTML = "";
        } else {
          sum.innerHTML =
            '<span class="docs-pill">' + sessions.length + " edital" + (sessions.length === 1 ? "" : "is") + "</span>" +
            '<span class="docs-pill">' + totalAll + " documento" + (totalAll === 1 ? "" : "s") + "</span>" +
            '<span class="docs-pill ok">' + okAll + " OK</span>" +
            '<span class="docs-pill pend">' + pendAll + " pendente" + (pendAll === 1 ? "" : "s") + "</span>";
        }
      }

      if(!sessions.length){
        box.innerHTML = '<div class="muted small">Nenhum checklist ainda. Rode a <b>Análise IA</b> em um edital para gerar a lista, ou adicione um documento manualmente.</div>';
        return;
      }

      var html = "";
      sessions.forEach(function(sess){
        var expanded = LICSYSTEM.docsChecklist.isExpanded(sess.id);
        var sm = LICSYSTEM.docsChecklist.summary(sess.documentos);
        var nome = sess.editalNome || sess.filename || "Edital";
        var updatedTxt = sess.updatedAt
          ? utils.escapeHtml(new Date(sess.updatedAt).toLocaleString("pt-BR"))
          : "";
        html +=
          '<div class="docs-accordion' + (expanded ? " is-open" : "") + '" data-session="' + utils.escapeHtml(sess.id) + '">' +
            '<button type="button" class="docs-acc-head" aria-expanded="' + (expanded ? "true" : "false") + '">' +
              '<span class="docs-acc-chevron" aria-hidden="true">' + (expanded ? "▾" : "▸") + "</span>" +
              '<span class="docs-acc-meta">' +
                '<span class="docs-acc-title">Edital: <b class="docs-edital-name">' + utils.escapeHtml(nome) + "</b></span>" +
                (sess.filename ? '<span class="docs-acc-file">' + utils.escapeHtml(sess.filename) + "</span>" : "") +
                (updatedTxt ? '<span class="docs-acc-updated">Atualizado: ' + updatedTxt + "</span>" : "") +
              "</span>" +
              '<span class="docs-acc-pills">' +
                '<span class="docs-pill">' + sm.total + "</span>" +
                '<span class="docs-pill ok">' + sm.ok + " OK</span>" +
                '<span class="docs-pill pend">' + sm.pend + " pend.</span>" +
              "</span>" +
            "</button>" +
            '<div class="docs-acc-body"' + (expanded ? "" : " hidden") + ">" +
              (sm.total
                ? LICSYSTEM.docsChecklist.renderDocRows(sess.documentos, sess.id)
                : '<div class="muted small">Nenhum documento neste edital.</div>') +
            "</div>" +
          "</div>";
      });
      box.innerHTML = html;

      box.querySelectorAll(".docs-acc-head").forEach(function(btn){
        btn.addEventListener("click", function(){
          var acc = btn.closest(".docs-accordion");
          if(!acc) return;
          var sid = acc.getAttribute("data-session");
          var open = !acc.classList.contains("is-open");
          acc.classList.toggle("is-open", open);
          btn.setAttribute("aria-expanded", open ? "true" : "false");
          var chev = btn.querySelector(".docs-acc-chevron");
          if(chev) chev.textContent = open ? "▾" : "▸";
          var body = acc.querySelector(".docs-acc-body");
          if(body) body.hidden = !open;
          LICSYSTEM.docsChecklist.setExpanded(sid, open);
        });
      });

      box.querySelectorAll(".docsOkChk").forEach(function(chk){
        chk.addEventListener("change", function(){
          var row = chk.closest(".docs-row");
          var id = row && row.getAttribute("data-id");
          var sid = row && row.getAttribute("data-session");
          LICSYSTEM.docsChecklist.setOk(id, chk.checked, sid);
        });
      });
      box.querySelectorAll(".docsRemove").forEach(function(btn){
        btn.addEventListener("click", function(){
          var row = btn.closest(".docs-row");
          var id = row && row.getAttribute("data-id");
          var sid = row && row.getAttribute("data-session");
          LICSYSTEM.docsChecklist.remove(id, sid);
        });
      });
    },

    resolveSession: function(sessionId){
      var sessions = LICSYSTEM.docsChecklist.collectSessions();
      var sid = String(sessionId || "");
      for(var i = 0; i < sessions.length; i++){
        if(String(sessions[i].id) === sid) return sessions[i];
      }
      if(sessions.length === 1) return sessions[0];
      return null;
    },

    setOk: function(id, ok, sessionId){
      var sess = LICSYSTEM.docsChecklist.resolveSession(sessionId);
      var ref = null;
      if(sess){
        for(var r = 0; r < (sess.documentos || []).length; r++){
          if(String(sess.documentos[r].id) === String(id)){ ref = sess.documentos[r]; break; }
        }
      }

      if(!sess || sess.usesChecklist || sess.source === "checklist"){
        var docs = LICSYSTEM.docsChecklist.data.documentos || [];
        for(var j = 0; j < docs.length; j++){
          if(docs[j].id === id || (ref && LICSYSTEM.docsChecklist.normText(docs[j].nome) === LICSYSTEM.docsChecklist.normText(ref.nome))){
            docs[j].ok = !!ok;
            break;
          }
        }
        LICSYSTEM.docsChecklist.persist();
      }

      if(sess && sess.leilaoId){
        var item = LICSYSTEM.docsChecklist.findLeilao(sess.leilaoId);
        if(item){
          var lpDocs = item.documentosExigidos || [];
          for(var k = 0; k < lpDocs.length; k++){
            if(String(lpDocs[k].id) === String(id) ||
              (ref && LICSYSTEM.docsChecklist.normText(lpDocs[k].nome) === LICSYSTEM.docsChecklist.normText(ref.nome))){
              lpDocs[k].ok = !!ok;
              break;
            }
          }
          item.updatedAt = Date.now();
          LICSYSTEM.leiloesParticipo.persist();
        }
      }

      LICSYSTEM.docsChecklist.render();
    },

    remove: function(id, sessionId){
      var sess = LICSYSTEM.docsChecklist.resolveSession(sessionId);
      var ref = null;
      if(sess){
        for(var r = 0; r < (sess.documentos || []).length; r++){
          if(String(sess.documentos[r].id) === String(id)){ ref = sess.documentos[r]; break; }
        }
      }

      if(!sess || sess.usesChecklist || sess.source === "checklist"){
        LICSYSTEM.docsChecklist.data.documentos = (LICSYSTEM.docsChecklist.data.documentos || []).filter(function(d){
          if(d.id === id) return false;
          if(ref && LICSYSTEM.docsChecklist.normText(d.nome) === LICSYSTEM.docsChecklist.normText(ref.nome)) return false;
          return true;
        });
        LICSYSTEM.docsChecklist.persist();
      }

      if(sess && sess.leilaoId){
        var item = LICSYSTEM.docsChecklist.findLeilao(sess.leilaoId);
        if(item){
          item.documentosExigidos = (item.documentosExigidos || []).filter(function(d){
            if(String(d.id) === String(id)) return false;
            if(ref && LICSYSTEM.docsChecklist.normText(d.nome) === LICSYSTEM.docsChecklist.normText(ref.nome)) return false;
            return true;
          });
          item.updatedAt = Date.now();
          LICSYSTEM.leiloesParticipo.persist();
        }
      }

      LICSYSTEM.docsChecklist.render();
    },

    addManual: function(){
      var nome = window.prompt("Nome do documento exigido:");
      if(nome == null) return;
      nome = String(nome).trim();
      if(!nome) return;
      var item = LICSYSTEM.docsChecklist.normalizeItem({
        nome: nome,
        tipo: "outro",
        obs: "Adicionado manualmente",
        manual: true,
        ok: false
      }, (LICSYSTEM.docsChecklist.data.documentos || []).length);
      var match = LICSYSTEM.docsChecklist.matchCofre(item.nome);
      if(match) item.cofreKey = match.key;
      LICSYSTEM.docsChecklist.data.documentos.push(item);
      if(!LICSYSTEM.docsChecklist.data.editalNome){
        LICSYSTEM.docsChecklist.data.editalNome = "Checklist manual";
      }
      LICSYSTEM.docsChecklist.persist();
      LICSYSTEM.docsChecklist.render();
      showAlert("docsAlert", "ok", "Documento adicionado.");
    },

    clearOk: function(){
      var sessions = LICSYSTEM.docsChecklist.collectSessions();
      var any = false;
      sessions.forEach(function(s){
        (s.documentos || []).forEach(function(d){ if(d.ok) any = true; });
      });
      if(!any && !(LICSYSTEM.docsChecklist.data.documentos || []).length) return;
      if(!confirm("Limpar todos os OK marcados?")) return;

      (LICSYSTEM.docsChecklist.data.documentos || []).forEach(function(d){ d.ok = false; });
      LICSYSTEM.docsChecklist.persist();

      sessions.forEach(function(s){
        if(!s.leilaoId) return;
        var item = LICSYSTEM.docsChecklist.findLeilao(s.leilaoId);
        if(!item) return;
        (item.documentosExigidos || []).forEach(function(d){ d.ok = false; });
        item.updatedAt = Date.now();
      });
      if(LICSYSTEM.leiloesParticipo && LICSYSTEM.leiloesParticipo.persist){
        LICSYSTEM.leiloesParticipo.persist();
      }
      LICSYSTEM.docsChecklist.render();
    },

    save: function(){
      LICSYSTEM.docsChecklist.persist({ immediate: true });
      showAlert("docsAlert", "ok", "Checklist salvo" + (LICSYSTEM.cloudSync && LICSYSTEM.cloudSync._uid ? " (sincronizando…)" : "") + ".");
    },

    showModal: function(docs, meta){
      meta = meta || {};
      var ov = el("docsOverlay");
      var list = el("docsModalList");
      var lead = el("docsModalLead");
      if(!ov || !list) return;
      var arr = Array.isArray(docs) ? docs : [];
      if(lead){
        lead.textContent = arr.length
          ? ("A IA identificou " + arr.length + " documento" + (arr.length === 1 ? "" : "s") + " exigido" + (arr.length === 1 ? "" : "s") + ". Confira e marque o que você já tem.")
          : "Não foi possível listar documentos estruturados. Você ainda pode abrir o checklist e adicionar manualmente.";
      }
      if(!arr.length){
        list.innerHTML = '<div class="muted small">Nenhum documento estruturado retornado. Use o botão abaixo para abrir a tela e incluir itens.</div>';
      } else {
        list.innerHTML = arr.map(function(d){
          var tipo = LICSYSTEM.docsChecklist.normTipo(d.tipo);
          return (
            '<div class="docs-modal-item">' +
              '<span class="di-tipo t-' + tipo + '">' + utils.escapeHtml(LICSYSTEM.docsChecklist.tipoLabel(tipo)) + "</span>" +
              '<div class="di-body">' +
                '<div class="di-nome">' + utils.escapeHtml(d.nome || "Documento") + "</div>" +
                (d.obs ? '<div class="di-obs">' + utils.escapeHtml(d.obs) + "</div>" : "") +
              "</div>" +
            "</div>"
          );
        }).join("");
      }
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
      LICSYSTEM.docsChecklist._pendingMeta = meta;
      LICSYSTEM.docsChecklist._pendingDocs = arr;
    },

    closeModal: function(opts){
      opts = opts || {};
      var ov = el("docsOverlay");
      if(!ov) return;
      var wasOpen = ov.classList.contains("open");
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
      if(wasOpen && !opts.skipParticiparAsk && LICSYSTEM.analiseIa && LICSYSTEM.analiseIa._pendingParticiparAsk){
        LICSYSTEM.analiseIa._pendingParticiparAsk = false;
        setTimeout(function(){
          try{ LICSYSTEM.leiloesParticipo.showParticiparModal(); }catch(e){}
        }, 180);
      }
    },

    goFromModal: function(){
      var docs = LICSYSTEM.docsChecklist._pendingDocs;
      var meta = LICSYSTEM.docsChecklist._pendingMeta || {};
      if(Array.isArray(docs) && docs.length){
        LICSYSTEM.docsChecklist.setFromAnalysis(docs, meta);
      } else if(!(LICSYSTEM.docsChecklist.data.documentos || []).length){
        LICSYSTEM.docsChecklist.data.editalNome = meta.editalNome || meta.filename || "Edital analisado";
        LICSYSTEM.docsChecklist.data.filename = meta.filename || "";
        LICSYSTEM.docsChecklist.persist();
      }
      LICSYSTEM.docsChecklist.closeModal();
      if(window.__lsActivateView) window.__lsActivateView("docsChecklist");
      else LICSYSTEM.docsChecklist.render();
    }
  };

  /* ============================ LEILÃO QUE PARTICIPO ============================ */
  LICSYSTEM.leiloesParticipo = {
    items: [],

    load: function(){
      try{
        var raw = JSON.parse(localStorage.getItem(LEILOES_PARTICIPO_KEY) || "null");
        LICSYSTEM.leiloesParticipo.applyData(Array.isArray(raw) ? raw : [], { skipPersist: true });
      }catch(e){
        LICSYSTEM.leiloesParticipo.items = [];
      }
    },

    applyData: function(list, opts){
      opts = opts || {};
      var arr = Array.isArray(list) ? list : [];
      LICSYSTEM.leiloesParticipo.items = arr.map(function(it, i){
        return LICSYSTEM.leiloesParticipo.normalizeItem(it, i);
      });
      if(!opts.skipPersist){
        try{ localStorage.setItem(LEILOES_PARTICIPO_KEY, JSON.stringify(LICSYSTEM.leiloesParticipo.items)); }catch(e){}
      }
      if(LICSYSTEM.state.currentView === "leiloesParticipo"){
        try{ LICSYSTEM.leiloesParticipo.render(); }catch(e){}
      }
    },

    normalizeItem: function(it, idx){
      it = it || {};
      var docs = Array.isArray(it.documentosExigidos) ? it.documentosExigidos : [];
      return {
        id: String(it.id || ("lp_" + Date.now() + "_" + (idx || 0))),
        titulo: String(it.titulo || it.editalNome || "Edital").trim().slice(0, 220),
        orgao: String(it.orgao || "").trim().slice(0, 220),
        municipio: String(it.municipio || "").trim().slice(0, 120),
        filename: String(it.filename || "").trim().slice(0, 220),
        dataAnalise: Number(it.dataAnalise || it.createdAt || Date.now()) || Date.now(),
        resumo: String(it.resumo || it.analysisSnippet || "").trim().slice(0, 600),
        analysisSnippet: String(it.analysisSnippet || it.resumo || "").trim().slice(0, 600),
        documentosExigidos: docs.map(function(d, i){
          return {
            id: String(d.id || ("lpdoc_" + String(it.id || idx || 0) + "_" + i)),
            nome: String(d.nome || "Documento").trim().slice(0, 220),
            tipo: String(d.tipo || "outro").slice(0, 40),
            obs: String(d.obs || "").trim().slice(0, 400),
            ok: !!d.ok
          };
        }).slice(0, 80),
        status: (it.status === "arquivado") ? "arquivado" : "participando",
        createdAt: Number(it.createdAt || it.dataAnalise || Date.now()) || Date.now(),
        updatedAt: Number(it.updatedAt || Date.now()) || Date.now()
      };
    },

    persist: function(opts){
      opts = opts || {};
      var ts = Date.now();
      try{
        localStorage.setItem(LEILOES_PARTICIPO_KEY, JSON.stringify(LICSYSTEM.leiloesParticipo.items));
      }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("leiloesParticipo", {
          updatedAt: ts,
          immediate: !!opts.immediate
        });
      }
    },

    extractMetaFromReport: function(md){
      var text = String(md || "");
      var out = { orgao: "", municipio: "", resumo: "" };
      if(!text.trim()) return out;

      function grab(re){
        var m = text.match(re);
        return m && m[1] ? String(m[1]).replace(/\*\*/g, "").replace(/`/g, "").trim() : "";
      }

      out.orgao = grab(/(?:[Oo]rg[aã]o|[Ee]ntidade|[Pp]refeitura|[Uu]nidade\s+[Gg]estora)\s*[:\-–]\s*([^\n|]{3,120})/);
      out.municipio = grab(/(?:[Mm]unic[ií]pio|[Cc]idade|[Ll]ocalidade)\s*[:\-–]\s*([^\n|]{2,80})/);
      if(!out.municipio){
        var mun2 = text.match(/\b([A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç ]{2,40})\s*\/\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/);
        if(mun2) out.municipio = (mun2[1] + "/" + mun2[2]).trim();
      }

      // Resumo: preferseção "Resumo Simples", senão primeiros ~280 chars úteis
      var resumoSec = text.match(/(?:#{1,4}\s*)?(?:\d+\.\s*)?Resumo\s+Simples[\s\S]{0,40}?([\s\S]{40,500}?)(?=\n#{1,4}\s|\n```|\n\*\*Alerta|\n---|\s*$)/i);
      if(resumoSec && resumoSec[1]){
        out.resumo = resumoSec[1]
          .replace(/^[-*•]\s+/gm, "")
          .replace(/\*\*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 400);
      } else {
        out.resumo = text
          .replace(/```[\s\S]*?```/g, " ")
          .replace(/#{1,6}\s*/g, "")
          .replace(/\*\*/g, "")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, 280);
      }
      return out;
    },

    buildFromAnalysis: function(){
      var filename = (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
      var docs = LICSYSTEM.analiseIa.documentosExigidos || [];
      if(!docs.length && LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data){
        docs = LICSYSTEM.docsChecklist.data.documentos || [];
      }
      var parsed = LICSYSTEM.leiloesParticipo.extractMetaFromReport(LICSYSTEM.analiseIa.relatorioMd || "");
      var titulo =
        parsed.orgao ||
        (LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data && LICSYSTEM.docsChecklist.data.editalNome) ||
        (filename ? filename.replace(/\.pdf$/i, "") : "") ||
        "Edital analisado";
      return {
        titulo: titulo,
        orgao: parsed.orgao || "",
        municipio: parsed.municipio || "",
        filename: filename || (LICSYSTEM.docsChecklist && LICSYSTEM.docsChecklist.data && LICSYSTEM.docsChecklist.data.filename) || "",
        dataAnalise: Date.now(),
        resumo: parsed.resumo || "",
        analysisSnippet: parsed.resumo || "",
        documentosExigidos: docs,
        status: "participando"
      };
    },

    findDuplicate: function(entry){
      var fn = String(entry.filename || "").toLowerCase();
      var tit = String(entry.titulo || "").toLowerCase();
      for(var i = 0; i < LICSYSTEM.leiloesParticipo.items.length; i++){
        var it = LICSYSTEM.leiloesParticipo.items[i];
        if(it.status === "arquivado") continue;
        if(fn && String(it.filename || "").toLowerCase() === fn) return it;
        if(tit && String(it.titulo || "").toLowerCase() === tit) return it;
      }
      return null;
    },

    addFromAnalysis: function(){
      if(!(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd)){
        showAlert("iaAlert", "warn", "Analise um edital antes de confirmar participação.");
        return null;
      }
      var draft = LICSYSTEM.leiloesParticipo.buildFromAnalysis();
      var dup = LICSYSTEM.leiloesParticipo.findDuplicate(draft);
      var now = Date.now();
      if(dup){
        dup.titulo = draft.titulo;
        dup.orgao = draft.orgao || dup.orgao;
        dup.municipio = draft.municipio || dup.municipio;
        dup.filename = draft.filename || dup.filename;
        dup.dataAnalise = now;
        dup.resumo = draft.resumo || dup.resumo;
        dup.analysisSnippet = draft.analysisSnippet || dup.analysisSnippet;
        dup.documentosExigidos = draft.documentosExigidos;
        dup.status = "participando";
        dup.updatedAt = now;
        LICSYSTEM.leiloesParticipo.persist({ immediate: true });
        LICSYSTEM.leiloesParticipo.render();
        return dup;
      }
      var item = LICSYSTEM.leiloesParticipo.normalizeItem({
        id: "lp_" + now + "_" + Math.random().toString(36).slice(2, 7),
        titulo: draft.titulo,
        orgao: draft.orgao,
        municipio: draft.municipio,
        filename: draft.filename,
        dataAnalise: now,
        resumo: draft.resumo,
        analysisSnippet: draft.analysisSnippet,
        documentosExigidos: draft.documentosExigidos,
        status: "participando",
        createdAt: now,
        updatedAt: now
      });
      LICSYSTEM.leiloesParticipo.items.unshift(item);
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.render();
      return item;
    },

    archive: function(id){
      var found = null;
      for(var i = 0; i < LICSYSTEM.leiloesParticipo.items.length; i++){
        if(LICSYSTEM.leiloesParticipo.items[i].id === id){
          found = LICSYSTEM.leiloesParticipo.items[i];
          break;
        }
      }
      if(!found) return;
      if(!confirm("Arquivar este leilão da lista de participação?")) return;
      found.status = "arquivado";
      found.updatedAt = Date.now();
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.render();
      showAlert("leiloesAlert", "ok", "Leilão arquivado.");
    },

    remove: function(id){
      if(!confirm("Remover este leilão permanentemente da lista?")) return;
      LICSYSTEM.leiloesParticipo.items = LICSYSTEM.leiloesParticipo.items.filter(function(it){
        return it.id !== id;
      });
      LICSYSTEM.leiloesParticipo.persist({ immediate: true });
      LICSYSTEM.leiloesParticipo.render();
      showAlert("leiloesAlert", "ok", "Leilão removido.");
    },

    openDocs: function(id){
      var item = null;
      for(var i = 0; i < LICSYSTEM.leiloesParticipo.items.length; i++){
        if(LICSYSTEM.leiloesParticipo.items[i].id === id){ item = LICSYSTEM.leiloesParticipo.items[i]; break; }
      }
      if(!item) return;
      if(item.documentosExigidos && item.documentosExigidos.length){
        try{
          LICSYSTEM.docsChecklist.setFromAnalysis(item.documentosExigidos, {
            editalNome: item.titulo || item.filename || "Edital",
            filename: item.filename || ""
          });
        }catch(e){}
      }
      if(window.__lsActivateView) window.__lsActivateView("docsChecklist");
      else LICSYSTEM.docsChecklist.render();
    },

    showParticiparModal: function(){
      if(!(LICSYSTEM.analiseIa && LICSYSTEM.analiseIa.relatorioMd)){
        showAlert("iaAlert", "warn", "Não há análise ativa. Analise um PDF primeiro.");
        return;
      }
      var ov = el("participarOverlay");
      var metaBox = el("participarModalMeta");
      var lead = el("participarModalLead");
      if(!ov) return;
      var draft = LICSYSTEM.leiloesParticipo.buildFromAnalysis();
      if(lead){
        lead.innerHTML = "Deseja marcar este edital em <b>Leilão que Participo</b> para acompanhar a disputa?";
      }
      if(metaBox){
        var bits = [];
        bits.push("<div><b>Edital:</b> " + utils.escapeHtml(draft.titulo || "—") + "</div>");
        if(draft.orgao) bits.push("<div><b>Órgão:</b> " + utils.escapeHtml(draft.orgao) + "</div>");
        if(draft.municipio) bits.push("<div><b>Município:</b> " + utils.escapeHtml(draft.municipio) + "</div>");
        if(draft.filename) bits.push("<div class='muted small'>" + utils.escapeHtml(draft.filename) + "</div>");
        if(draft.documentosExigidos && draft.documentosExigidos.length){
          bits.push("<div class='muted small'>" + draft.documentosExigidos.length + " documento(s) exigido(s) serão vinculados</div>");
        }
        if(draft.resumo){
          bits.push("<div class='participar-resumo'>" + utils.escapeHtml(draft.resumo) + "</div>");
        }
        metaBox.innerHTML = bits.join("");
      }
      ov.classList.add("open");
      ov.setAttribute("aria-hidden", "false");
    },

    closeParticiparModal: function(){
      var ov = el("participarOverlay");
      if(!ov) return;
      ov.classList.remove("open");
      ov.setAttribute("aria-hidden", "true");
    },

    confirmSim: function(){
      var item = LICSYSTEM.leiloesParticipo.addFromAnalysis();
      LICSYSTEM.leiloesParticipo.closeParticiparModal();
      if(!item) return;
      showAlert("iaAlert", "ok", "Salvo em Leilão que Participo.");
      if(window.__lsActivateView) window.__lsActivateView("leiloesParticipo");
      showAlert("leiloesAlert", "ok", "Participação confirmada: " + (item.titulo || "edital") + ".");
    },

    confirmNao: function(){
      LICSYSTEM.leiloesParticipo.closeParticiparModal();
      showAlert("iaAlert", "info", "Ok — edital não foi adicionado à lista.");
    },

    render: function(){
      var box = el("leiloesList");
      var sum = el("leiloesSummary");
      if(!box) return;

      var active = LICSYSTEM.leiloesParticipo.items.filter(function(it){ return it.status !== "arquivado"; });
      var archived = LICSYSTEM.leiloesParticipo.items.filter(function(it){ return it.status === "arquivado"; });

      if(sum){
        if(!LICSYSTEM.leiloesParticipo.items.length){
          sum.innerHTML = "";
        } else {
          sum.innerHTML =
            '<span class="docs-pill">' + active.length + " participando</span>" +
            (archived.length ? '<span class="docs-pill pend">' + archived.length + " arquivado" + (archived.length === 1 ? "" : "s") + "</span>" : "");
        }
      }

      if(!active.length && !archived.length){
        box.innerHTML = '<div class="muted small" style="padding:18px;text-align:center">Nenhum leilão marcado ainda. Analise um edital e confirme em <b>Vamos participar?</b></div>';
        return;
      }

      function cardHtml(it, isArch){
        var dataStr = "";
        try{ dataStr = new Date(it.dataAnalise).toLocaleString("pt-BR"); }catch(e){ dataStr = "—"; }
        var docsN = (it.documentosExigidos || []).length;
        var sub = [];
        if(it.orgao && it.orgao !== it.titulo) sub.push(it.orgao);
        if(it.municipio) sub.push(it.municipio);
        if(it.filename) sub.push(it.filename);
        return (
          '<div class="leilao-item' + (isArch ? " is-archived" : "") + '" data-id="' + utils.escapeHtml(it.id) + '">' +
            '<div class="leilao-main">' +
              '<div class="leilao-title">' + utils.escapeHtml(it.titulo || "Edital") + "</div>" +
              (sub.length ? '<div class="leilao-sub">' + utils.escapeHtml(sub.join(" · ")) + "</div>" : "") +
              '<div class="leilao-meta">' +
                '<span class="docs-badge">' + (isArch ? "Arquivado" : "Participando") + "</span>" +
                '<span class="muted small">Análise: ' + utils.escapeHtml(dataStr) + "</span>" +
                (docsN ? '<span class="muted small">' + docsN + " doc(s)</span>" : "") +
              "</div>" +
              (it.resumo ? '<div class="leilao-resumo">' + utils.escapeHtml(it.resumo) + "</div>" : "") +
            "</div>" +
            '<div class="leilao-actions">' +
              (docsN ? '<button type="button" class="btn btn-ghost btn-sm lpDocs" title="Abrir checklist">📑 Docs</button>' : "") +
              (!isArch ? '<button type="button" class="btn btn-ghost btn-sm lpArchive" title="Arquivar">Arquivar</button>' : "") +
              '<button type="button" class="btn btn-ghost btn-sm lpRemove" title="Remover">✕</button>' +
            "</div>" +
          "</div>"
        );
      }

      var html = "";
      active.forEach(function(it){ html += cardHtml(it, false); });
      if(archived.length){
        html += '<div class="leiloes-arch-label muted small">Arquivados</div>';
        archived.forEach(function(it){ html += cardHtml(it, true); });
      }
      box.innerHTML = html;

      box.querySelectorAll(".lpDocs").forEach(function(btn){
        btn.addEventListener("click", function(){
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.openDocs(id);
        });
      });
      box.querySelectorAll(".lpArchive").forEach(function(btn){
        btn.addEventListener("click", function(){
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.archive(id);
        });
      });
      box.querySelectorAll(".lpRemove").forEach(function(btn){
        btn.addEventListener("click", function(){
          var row = btn.closest(".leilao-item");
          var id = row && row.getAttribute("data-id");
          LICSYSTEM.leiloesParticipo.remove(id);
        });
      });
    }
  };

  /* ============================ CONCORRÊNCIA ============================ */
  LICSYSTEM.concorrencia = {
    buscar:function(){
      var raw = (el("cnpjInput").value||"").replace(/\D/g,"");
      if(raw.length !== 14){ showAlert("cnpjStatus","warn","Informe um CNPJ válido (14 dígitos)."); return; }
      showAlert("cnpjStatus","info",'<span class="spinner"></span> Consultando BrasilAPI…');
      el("cnpjResult").innerHTML="";
      fetch("https://brasilapi.com.br/api/cnpj/v1/"+raw).then(function(r){
        if(r.status===404) throw new Error("not-found");
        if(!r.ok) throw new Error("HTTP "+r.status);
        return r.json();
      }).then(function(j){
        hideAlert("cnpjStatus");
        var sit = (j.descricao_situacao_cadastral||"").toUpperCase();
        var sitCls = sit.indexOf("ATIVA")!==-1 ? "b-green" : (sit.indexOf("BAIXADA")!==-1||sit.indexOf("INAPTA")!==-1||sit.indexOf("SUSPENSA")!==-1 ? "b-red":"b-yellow");
        var html='<div class="card" style="margin:0;box-shadow:none;border-color:var(--ls-line)">'+
          '<h2 style="margin-bottom:12px">'+utils.escapeHtml(j.razao_social||j.nome_fantasia||"—")+'</h2>'+
          '<div class="ri-grid">'+
            m("Situação Cadastral", '<span class="badge-status '+sitCls+'">'+utils.escapeHtml(j.descricao_situacao_cadastral||"—")+'</span>')+
            m("Capital Social", utils.formatBrl(j.capital_social))+
            m("UF / Município", utils.escapeHtml((j.uf||"—")+" / "+(j.municipio||"—")))+
            m("Atividade Principal", utils.escapeHtml(j.cnae_fiscal_descricao||"—"))+
            m("Porte", utils.escapeHtml(j.porte||"—"))+
            m("Abertura", utils.escapeHtml(j.data_inicio_atividade||"—"))+
          '</div></div>';
        el("cnpjResult").innerHTML=html;
        function m(l,v){ return '<div class="ri-metric"><div class="m-l">'+utils.escapeHtml(l)+'</div><div class="m-v">'+v+'</div></div>'; }
      }).catch(function(err){
        if(err.message==="not-found") showAlert("cnpjStatus","error","CNPJ não encontrado.");
        else showAlert("cnpjStatus","error","Falha na consulta: "+utils.escapeHtml(err.message)+". (Se aberto via file://, pode haver bloqueio CORS.)");
      });
    }
  };

  /* ============================ PDF HEADER HELPER ============================ */
  // Returns Promise<number> — startY for content after header (fetches empresa_perfil from Firebase)
  function licsystemPdfHeader(doc, subtitle, landscape){
    return LICSYSTEM.ferramentas.getPerfil().then(function(perfil){
      var w = doc.internal.pageSize.getWidth();
      var nome = (perfil && perfil.nome) ? String(perfil.nome) : "LICSYSTEM";
      var cnpj = (perfil && perfil.cnpj) ? String(perfil.cnpj) : "";
      var telefone = (perfil && perfil.telefone) ? String(perfil.telefone) : "";
      var endereco = (perfil && perfil.endereco) ? String(perfil.endereco) : "";
      var logo = (perfil && perfil.logoBase64) ? String(perfil.logoBase64) : "";
      var hasExtra = !!(cnpj || telefone || endereco);
      var headerH = hasExtra ? 34 : 26;

      doc.setFillColor(21,38,66);
      doc.rect(0,0,w,headerH,"F");
      doc.setFillColor(201,162,39);
      doc.rect(0,headerH,w,2,"F");

      var textX = 14;
      if(logo && logo.indexOf("data:image") === 0){
        try{
          var fmt = "JPEG";
          if(/data:image\/png/i.test(logo)) fmt = "PNG";
          else if(/data:image\/webp/i.test(logo)) fmt = "WEBP";
          else if(/data:image\/gif/i.test(logo)) fmt = "GIF";
          var logoH = hasExtra ? 22 : 16;
          var logoW = logoH * 1.4;
          doc.addImage(logo, fmt, 10, (headerH - logoH) / 2, logoW, logoH);
          textX = 14 + logoW + 4;
        }catch(e){ /* logo inválido — segue sem imagem */ }
      }

      doc.setTextColor(255,255,255);
      doc.setFont("helvetica","bold"); doc.setFontSize(13);
      doc.text(nome, textX, hasExtra ? 11 : 12);
      doc.setFont("helvetica","normal"); doc.setFontSize(7.5);
      doc.setTextColor(201,162,39);
      if(hasExtra){
        var line2 = [cnpj ? "CNPJ "+cnpj : "", telefone ? "Tel. "+telefone : ""].filter(Boolean).join("  ·  ");
        if(line2) doc.text(line2, textX, 18);
        if(endereco){
          var end = endereco.length > 90 ? endereco.slice(0,87)+"…" : endereco;
          doc.setTextColor(185,198,219);
          doc.text(end, textX, 25);
        }
      } else {
        doc.text("LICSYSTEM", textX, 19);
      }

      doc.setFontSize(8); doc.setTextColor(185,198,219);
      doc.text("Emitido em "+new Date().toLocaleString("pt-BR"), w-14, hasExtra ? 11 : 12, {align:"right"});

      var titleY = headerH + 10;
      doc.setTextColor(21,38,66); doc.setFontSize(13); doc.setFont("helvetica","bold");
      doc.text(subtitle||"", 14, titleY);
      return titleY + 6;
    });
  }

  /* ============================ FERRAMENTAS ============================ */
  LICSYSTEM.ferramentas = {
    _logoPending: null,

    fileToBase64: function(file){
      return new Promise(function(resolve, reject){
        if(!file){ resolve(""); return; }
        if(file.size > 1.5 * 1024 * 1024){
          reject(new Error("Logo muito grande (máx. 1,5 MB)."));
          return;
        }
        var reader = new FileReader();
        reader.onload = function(){ resolve(String(reader.result || "")); };
        reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo de logo.")); };
        reader.readAsDataURL(file);
      });
    },

    getPerfil: function(force){
      if(!force && LICSYSTEM.state.empresaPerfil) return Promise.resolve(LICSYSTEM.state.empresaPerfil);
      return utils.firebaseGet("empresa_perfil").then(function(val){
        LICSYSTEM.state.empresaPerfil = val || {
          nome: "LICSYSTEM",
          cnpj: "",
          endereco: "",
          telefone: "",
          cep: "",
          logoBase64: ""
        };
        return LICSYSTEM.state.empresaPerfil;
      }).catch(function(){
        if(!LICSYSTEM.state.empresaPerfil){
          LICSYSTEM.state.empresaPerfil = {
            nome: "LICSYSTEM",
            cnpj: "",
            endereco: "",
            telefone: "",
            cep: "",
            logoBase64: ""
          };
        }
        return LICSYSTEM.state.empresaPerfil;
      });
    },

    salvarPerfil: function(dados){
      var payload = {
        nome: String((dados && dados.nome) || "").trim(),
        cnpj: String((dados && dados.cnpj) || "").trim(),
        endereco: String((dados && dados.endereco) || "").trim(),
        telefone: String((dados && dados.telefone) || "").trim(),
        cep: String((dados && dados.cep) || "").replace(/\D/g,"").trim(),
        logoBase64: String((dados && dados.logoBase64) || ""),
        atualizadoEm: new Date().toISOString()
      };
      return utils.firebaseSet("empresa_perfil", payload).then(function(){
        LICSYSTEM.state.empresaPerfil = payload;
        return payload;
      });
    },

    fillForm: function(perfil){
      perfil = perfil || {};
      if(el("empNome")) el("empNome").value = perfil.nome || "";
      if(el("empCnpj")) el("empCnpj").value = perfil.cnpj || "";
      if(el("empEndereco")) el("empEndereco").value = perfil.endereco || "";
      if(el("empTelefone")) el("empTelefone").value = perfil.telefone || "";
      if(el("empCep")) el("empCep").value = perfil.cep || "";
      var prev = el("empLogoPreview");
      if(prev){
        if(perfil.logoBase64){
          prev.src = perfil.logoBase64;
          prev.style.display = "block";
        } else {
          prev.removeAttribute("src");
          prev.style.display = "none";
        }
      }
      LICSYSTEM.ferramentas._logoPending = perfil.logoBase64 || null;
    },

    carregarView: function(){
      showAlert("ferramentasStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Carregando perfil…');
      LICSYSTEM.ferramentas.getPerfil(true).then(function(perfil){
        LICSYSTEM.ferramentas.fillForm(perfil);
        hideAlert("ferramentasStatus");
      }).catch(function(err){
        showAlert("ferramentasStatus","error","Não foi possível carregar o perfil: "+utils.escapeHtml(err.message));
      });
    },

    onSalvarClick: function(){
      var file = el("empLogo") && el("empLogo").files && el("empLogo").files[0];
      showAlert("ferramentasStatus","info",'<span class="spinner"></span> Salvando perfil…');
      var basePromise = file
        ? LICSYSTEM.ferramentas.fileToBase64(file)
        : Promise.resolve(LICSYSTEM.ferramentas._logoPending || (LICSYSTEM.state.empresaPerfil && LICSYSTEM.state.empresaPerfil.logoBase64) || "");

      basePromise.then(function(logoBase64){
        return LICSYSTEM.ferramentas.salvarPerfil({
          nome: el("empNome").value,
          cnpj: el("empCnpj").value,
          endereco: el("empEndereco").value,
          telefone: el("empTelefone").value,
          cep: el("empCep") ? el("empCep").value : "",
          logoBase64: logoBase64
        });
      }).then(function(){
        showAlert("ferramentasStatus","ok","✅ Perfil salvo em empresa_perfil.");
        if(el("empLogo")) el("empLogo").value = "";
      }).catch(function(err){
        showAlert("ferramentasStatus","error","Falha ao salvar: "+utils.escapeHtml(err.message));
      });
    },

    onLogoChange: function(){
      var file = el("empLogo") && el("empLogo").files && el("empLogo").files[0];
      if(!file) return;
      LICSYSTEM.ferramentas.fileToBase64(file).then(function(b64){
        LICSYSTEM.ferramentas._logoPending = b64;
        var prev = el("empLogoPreview");
        if(prev){ prev.src = b64; prev.style.display = "block"; }
      }).catch(function(err){
        showAlert("ferramentasStatus","warn",utils.escapeHtml(err.message));
      });
    },

    exportarBackup: function(){
      showAlert("backupStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Exportando licitacoes/…');
      utils.firebaseGet("licitacoes").then(function(data){
        var payload = {
          exportadoEm: new Date().toISOString(),
          origem: "licitacoes",
          licitacoes: data || {}
        };
        var blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = "backup-licsystem-"+utils.ymd()+".json";
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
        showAlert("backupStatus","ok","✅ Backup baixado (nó licitacoes/).");
      }).catch(function(err){
        showAlert("backupStatus","error","Falha ao exportar: "+utils.escapeHtml(err.message));
      });
    },

    importarBackup: function(file){
      if(!file){ showAlert("backupStatus","warn","Selecione um arquivo JSON."); return; }
      if(!confirm("Importar backup na raiz do Firebase?\nIsso pode sobrescrever dados existentes na raiz do Realtime Database.")) return;
      showAlert("backupStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Importando…');
      var reader = new FileReader();
      reader.onload = function(){
        try{
          var parsed = JSON.parse(String(reader.result || ""));
          // Aceita export LICSYSTEM ({licitacoes:...}) ou JSON já no formato da raiz
          var rootPayload = parsed;
          if(parsed && parsed.origem === "licitacoes" && parsed.licitacoes !== undefined){
            rootPayload = { licitacoes: parsed.licitacoes };
            if(LICSYSTEM.state.empresaPerfil) rootPayload.empresa_perfil = LICSYSTEM.state.empresaPerfil;
          }
          utils.firebaseSet("/", rootPayload).then(function(){
            showAlert("backupStatus","ok","✅ Backup importado na raiz do Firebase.");
          }).catch(function(err){
            showAlert("backupStatus","error","Falha no firebaseSet: "+utils.escapeHtml(err.message));
          });
        }catch(err){
          showAlert("backupStatus","error","JSON inválido: "+utils.escapeHtml(err.message));
        }
      };
      reader.onerror = function(){
        showAlert("backupStatus","error","Não foi possível ler o arquivo.");
      };
      reader.readAsText(file);
    }
  };

  // API pública LICSYSTEM
  LICSYSTEM.exportarBackup = function(){ return LICSYSTEM.ferramentas.exportarBackup(); };
  LICSYSTEM.importarBackup = function(file){ return LICSYSTEM.ferramentas.importarBackup(file); };
  LICSYSTEM.licsystemPdfHeader = licsystemPdfHeader;

  /* ============================ ALERTAS PNCP (estilo ConLicitação) ============================ */
  LICSYSTEM.alertas = {
    CHECK_MS: 15 * 60 * 1000,
    MAX_WATCHES: 12,
    MAX_ALERTS: 200,
    MAX_SEEN: 400,
    watches: [],
    alerts: [],
    _timer: null,
    _busy: false,
    _wired: false,
    _panelOpen: false,

    load: function(){
      try{
        var w = JSON.parse(localStorage.getItem(PNCP_WATCHES_KEY) || "[]");
        this.watches = Array.isArray(w) ? w.map(function(x){ return LICSYSTEM.alertas.normalizeWatch(x); }) : [];
      }catch(e){ this.watches = []; }
      try{
        var a = JSON.parse(localStorage.getItem(PNCP_ALERTS_KEY) || "[]");
        this.alerts = Array.isArray(a) ? a.map(function(x){ return LICSYSTEM.alertas.normalizeAlert(x); }) : [];
      }catch(e){ this.alerts = []; }
      LICSYSTEM.state.pncpAlerts = this.alerts.filter(function(x){ return !x.readAt; });
      this.updateBell();
      this.renderWatches();
      this.renderPanelList();
      try{ LICSYSTEM.dashboard.renderPncp(); }catch(e){}
    },

    normalizeWatch: function(raw){
      raw = raw || {};
      var seen = raw.seenIds && typeof raw.seenIds === "object" ? raw.seenIds : {};
      var raio = Number(raw.raio || 0) || 0;
      if(raio && raio < 10) raio = 10;
      if(raio > 700) raio = 700;
      return {
        id: String(raw.id || ("w_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7))),
        tipo: String(raw.tipo || "municipio"),
        label: String(raw.label || "").slice(0, 160),
        q: String(raw.q || raw.keywords || "").slice(0, 200),
        uf: String(raw.uf || "").trim().toUpperCase().slice(0, 2),
        municipio: String(raw.municipio || "").slice(0, 120),
        ibge: Number(raw.ibge || 0) || 0,
        raio: raio || 0,
        cobertura: String(raw.cobertura || "").slice(0, 20),
        federal: !!raw.federal,
        regiao: String(raw.regiao || "").slice(0, 60),
        mensagem: String(raw.mensagem || "").slice(0, 200),
        categoria: String(raw.categoria || "").slice(0, 80),
        leiloes: raw.leiloes !== false,
        ampliar: !!raw.ampliar,
        janela: raw.janela === "ano" ? "ano" : "45",
        enabled: raw.enabled !== false,
        createdAt: Number(raw.createdAt || Date.now()),
        lastCheckedAt: Number(raw.lastCheckedAt || 0) || 0,
        seenIds: seen
      };
    },

    normalizeAlert: function(raw){
      raw = raw || {};
      var key = String(raw.key || raw.numeroControlePNCP || raw.id || "");
      return {
        id: String(raw.id || key || ("a_" + Date.now())),
        key: key,
        numeroControlePNCP: raw.numeroControlePNCP || null,
        orgao: String(raw.orgao || "").slice(0, 200),
        municipio: String(raw.municipio || "").slice(0, 120),
        uf: String(raw.uf || "").slice(0, 2),
        objeto: String(raw.objeto || "").slice(0, 500),
        modalidade: String(raw.modalidade || "").slice(0, 80),
        valorEstimado: raw.valorEstimado != null ? Number(raw.valorEstimado) : null,
        dataAbertura: raw.dataAbertura || null,
        link: raw.link || null,
        watchId: String(raw.watchId || ""),
        watchLabel: String(raw.watchLabel || "").slice(0, 160),
        foundAt: Number(raw.foundAt || Date.now()),
        readAt: raw.readAt != null ? Number(raw.readAt) || null : null
      };
    },

    applyWatches: function(arr, opts){
      opts = opts || {};
      this.watches = (Array.isArray(arr) ? arr : []).map(function(x){
        return LICSYSTEM.alertas.normalizeWatch(x);
      });
      if(!opts.skipPersist){
        try{ localStorage.setItem(PNCP_WATCHES_KEY, JSON.stringify(this.watches)); }catch(e){}
      }
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpWatches", { immediate: !!opts.immediate });
      }
      this.renderWatches();
    },

    applyAlerts: function(arr, opts){
      opts = opts || {};
      this.alerts = (Array.isArray(arr) ? arr : []).map(function(x){
        return LICSYSTEM.alertas.normalizeAlert(x);
      });
      if(!opts.skipPersist){
        try{ localStorage.setItem(PNCP_ALERTS_KEY, JSON.stringify(this.alerts)); }catch(e){}
      }
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpAlerts", { immediate: !!opts.immediate });
      }
      LICSYSTEM.state.pncpAlerts = this.alerts.filter(function(x){ return !x.readAt; });
      this.updateBell();
      this.renderPanelList();
      try{ LICSYSTEM.dashboard.renderPncp(); }catch(e){}
    },

    persistWatches: function(opts){
      opts = opts || {};
      try{ localStorage.setItem(PNCP_WATCHES_KEY, JSON.stringify(this.watches)); }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpWatches", { immediate: !!opts.immediate });
      }
      this.renderWatches();
    },

    persistAlerts: function(opts){
      opts = opts || {};
      try{ localStorage.setItem(PNCP_ALERTS_KEY, JSON.stringify(this.alerts)); }catch(e){}
      if(!opts.skipCloud && LICSYSTEM.cloudSync){
        LICSYSTEM.cloudSync.notifyLocalChange("pncpAlerts", { immediate: !!opts.immediate });
      }
      LICSYSTEM.state.pncpAlerts = this.alerts.filter(function(x){ return !x.readAt; });
      this.updateBell();
      this.renderPanelList();
      try{ LICSYSTEM.dashboard.renderPncp(); }catch(e){}
    },

    editalKey: function(o){
      if(!o) return "";
      if(o.key) return String(o.key);
      if(o.numeroControlePNCP) return String(o.numeroControlePNCP);
      return [o.orgao || "", o.objeto || "", o.dataAbertura || "", o.uf || ""].join("|");
    },

    unreadCount: function(){
      var n = 0;
      for(var i = 0; i < this.alerts.length; i++){
        if(!this.alerts[i].readAt) n++;
      }
      return n;
    },

    updateBell: function(){
      var badge = el("bellBadge");
      if(!badge) return;
      var n = this.unreadCount();
      badge.textContent = String(n);
      badge.classList.toggle("zero", n === 0);
      var sub = el("bellPanelSub");
      if(sub){
        var ativo = this.watches.filter(function(w){ return w.enabled !== false; }).length;
        sub.textContent = ativo
          ? (n + " novo(s) · " + ativo + " monitoramento(s) ativo(s)")
          : "Nenhum monitoramento ativo";
      }
    },

    setPanelOpen: function(open){
      this._panelOpen = !!open;
      var panel = el("bellPanel");
      var bell = el("bell");
      if(panel) panel.hidden = !this._panelOpen;
      if(bell) bell.setAttribute("aria-expanded", this._panelOpen ? "true" : "false");
      if(this._panelOpen) this.renderPanelList();
    },

    togglePanel: function(){
      this.setPanelOpen(!this._panelOpen);
    },

    renderPanelList: function(){
      var box = el("bellPanelList");
      if(!box) return;
      if(!this.alerts.length){
        box.innerHTML = '<div class="small muted">Nenhum alerta ainda. Ative um monitoramento em <b>Pesquisas de Editais</b>.</div>';
        return;
      }
      var sorted = this.alerts.slice().sort(function(a, b){
        return Number(b.foundAt || 0) - Number(a.foundAt || 0);
      });
      var html = "";
      sorted.slice(0, 40).forEach(function(a){
        var unread = !a.readAt;
        var title = a.link
          ? '<a href="'+utils.escapeHtml(a.link)+'" target="_blank" rel="noopener">'+utils.escapeHtml(a.orgao || "Órgão")+'</a>'
          : '<b>'+utils.escapeHtml(a.orgao || "Órgão")+'</b>';
        html += '<div class="bell-item'+(unread?' is-unread':'')+'" data-alert-id="'+utils.escapeHtml(a.id)+'">'+
          title+
          ' <span class="badge-status b-yellow">'+utils.escapeHtml(a.uf || "")+'</span>'+
          (a.watchLabel ? ' <span class="small muted">· '+utils.escapeHtml(a.watchLabel)+'</span>' : '')+
          '<div class="small muted" style="margin-top:4px">'+utils.escapeHtml((a.objeto || "").slice(0, 160))+'</div>'+
          (a.municipio ? '<div class="small muted">'+utils.escapeHtml(a.municipio)+'</div>' : '')+
          '</div>';
      });
      box.innerHTML = html;
    },

    renderWatches: function(){
      var box = el("alertasWatchList");
      if(!box) return;
      if(!this.watches.length){
        box.innerHTML = '<div class="small muted">Nenhum alerta ativo. Use “Ativar alerta” em Editais próximos (recomendado), Radar ou Perguntar editais.</div>';
        return;
      }
      var html = "";
      this.watches.forEach(function(w){
        var off = w.enabled === false;
        var tipoLabel =
          w.tipo === "radar" ? "Radar" :
          (w.tipo === "proximos" || w.tipo === "raio" || w.tipo === "vizinhos") ? ("Próximos · " + (w.raio || 250) + " km") :
          "Município";
        html += '<div class="alerta-watch-row'+(off?' off':'')+'" data-watch-id="'+utils.escapeHtml(w.id)+'">'+
          '<div>'+
            '<div style="font-weight:700;color:var(--ls-navy)">'+utils.escapeHtml(w.label || w.id)+'</div>'+
            '<div class="alerta-watch-meta small muted">'+
              '<span>'+utils.escapeHtml(tipoLabel)+'</span>'+
              (w.lastCheckedAt ? '<span>· última verificação '+utils.escapeHtml(new Date(w.lastCheckedAt).toLocaleString("pt-BR"))+'</span>' : '<span>· ainda não verificado</span>')+
              (off ? '<span>· pausado</span>' : '')+
            '</div>'+
          '</div>'+
          '<div style="display:flex;gap:6px;flex-wrap:wrap">'+
            '<button type="button" class="btn btn-ghost btn-sm" data-watch-toggle="'+utils.escapeHtml(w.id)+'">'+(off?'Ativar':'Pausar')+'</button>'+
            '<button type="button" class="btn btn-ghost btn-sm" data-watch-del="'+utils.escapeHtml(w.id)+'">Excluir</button>'+
          '</div>'+
        '</div>';
      });
      box.innerHTML = html;
    },

    findWatch: function(id){
      id = String(id || "");
      for(var i = 0; i < this.watches.length; i++){
        if(this.watches[i].id === id) return this.watches[i];
      }
      return null;
    },

    upsertWatch: function(partial, opts){
      opts = opts || {};
      var w = this.normalizeWatch(partial);
      if(!w.label){
        if(w.tipo === "radar") w.label = (w.q || "radar") + (w.uf ? " · " + w.uf : "");
        else if(w.tipo === "proximos" || w.tipo === "raio" || w.tipo === "vizinhos"){
          w.label = (w.municipio || "Origem") + " · " + (w.raio || 250) + " km";
        }
        else w.label = w.municipio || w.mensagem || w.regiao || "Município";
      }
      var dup = null;
      for(var i = 0; i < this.watches.length; i++){
        var x = this.watches[i];
        if(w.tipo === "radar" && x.tipo === "radar" && x.q === w.q && x.uf === w.uf){ dup = x; break; }
        if((w.tipo === "proximos" || w.tipo === "raio") && (x.tipo === "proximos" || x.tipo === "raio") &&
          x.ibge === w.ibge && Number(x.raio || 0) === Number(w.raio || 0) &&
          String(x.q || "") === String(w.q || "") && String(x.cobertura || "") === String(w.cobertura || "")){
          dup = x; break;
        }
        if(w.tipo !== "radar" && w.tipo !== "proximos" && w.tipo !== "raio" &&
          x.tipo !== "radar" && x.tipo !== "proximos" && x.tipo !== "raio" &&
          ((w.ibge && x.ibge === w.ibge) || (w.municipio && x.municipio === w.municipio && x.uf === w.uf))){
          dup = x; break;
        }
      }
      if(dup){
        Object.assign(dup, w, { id: dup.id, seenIds: dup.seenIds || {}, createdAt: dup.createdAt });
        w = dup;
      } else {
        if(this.watches.length >= this.MAX_WATCHES){
          throw new Error("Limite de " + this.MAX_WATCHES + " alertas. Exclua um para criar outro.");
        }
        this.watches.unshift(w);
      }
      this.persistWatches({ immediate: true });
      if(opts.baseline !== false){
        return this.checkWatch(w, { baseline: true }).then(function(){ return w; });
      }
      return Promise.resolve(w);
    },

    removeWatch: function(id){
      this.watches = this.watches.filter(function(w){ return w.id !== id; });
      this.persistWatches({ immediate: true });
    },

    toggleWatch: function(id){
      var w = this.findWatch(id);
      if(!w) return;
      w.enabled = !w.enabled;
      this.persistWatches({ immediate: true });
    },

    markRead: function(id){
      var a = null;
      for(var i = 0; i < this.alerts.length; i++){
        if(this.alerts[i].id === id){ a = this.alerts[i]; break; }
      }
      if(!a || a.readAt) return;
      a.readAt = Date.now();
      this.persistAlerts({ immediate: true });
    },

    markAllRead: function(){
      var now = Date.now();
      var changed = false;
      for(var i = 0; i < this.alerts.length; i++){
        if(!this.alerts[i].readAt){
          this.alerts[i].readAt = now;
          changed = true;
        }
      }
      if(changed) this.persistAlerts({ immediate: true });
    },

    trimSeen: function(watch){
      var keys = Object.keys(watch.seenIds || {});
      if(keys.length <= this.MAX_SEEN) return;
      keys.sort();
      var drop = keys.length - this.MAX_SEEN;
      for(var i = 0; i < drop; i++) delete watch.seenIds[keys[i]];
    },

    addNovos: function(rows, watch, opts){
      opts = opts || {};
      var baseline = !!opts.baseline;
      var added = 0;
      if(!watch.seenIds) watch.seenIds = {};
      for(var i = 0; i < rows.length; i++){
        var row = rows[i] || {};
        var key = this.editalKey(row);
        if(!key) continue;
        var alreadySeen = !!watch.seenIds[key];
        watch.seenIds[key] = 1;
        if(alreadySeen) continue;
        if(baseline) continue;
        var exists = false;
        for(var j = 0; j < this.alerts.length; j++){
          if(this.alerts[j].key === key){ exists = true; break; }
        }
        if(exists) continue;
        this.alerts.unshift(this.normalizeAlert({
          id: key,
          key: key,
          numeroControlePNCP: row.numeroControlePNCP || null,
          orgao: row.orgao,
          municipio: row.municipio,
          uf: row.uf,
          objeto: row.objeto,
          modalidade: row.modalidade,
          valorEstimado: row.valorEstimado,
          dataAbertura: row.dataAbertura,
          link: row.link,
          watchId: watch.id,
          watchLabel: watch.label,
          foundAt: Date.now(),
          readAt: null
        }));
        added++;
      }
      this.trimSeen(watch);
      if(this.alerts.length > this.MAX_ALERTS){
        this.alerts = this.alerts.slice(0, this.MAX_ALERTS);
      }
      return added;
    },

    checkWatch: function(watch, opts){
      opts = opts || {};
      var self = this;
      var knownIds = Object.keys(watch.seenIds || {});
      return fetch("/api/monitor-pncp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ watches: [watch], knownIds: knownIds })
      }).then(function(r){
        return utils.parseApiResponse(r);
      }).then(function(j){
        if(!j || j.ok === false) throw new Error((j && j.error) || "Falha no monitor PNCP");
        var pack = (j.results && j.results[0] && j.results[0].editais) || [];
        var novos = j.novos || [];
        /* baseline: marca tudo visto sem criar alerta */
        var added = self.addNovos(opts.baseline ? pack : novos, watch, opts);
        watch.lastCheckedAt = Date.now();
        self.persistWatches({ immediate: true });
        if(!opts.baseline) self.persistAlerts({ immediate: true });
        else self.persistWatches({ immediate: true });
        return { added: added, total: pack.length, watch: watch };
      });
    },

    checkAll: function(opts){
      opts = opts || {};
      var self = this;
      if(self._busy) return Promise.resolve({ skipped: true });
      var list = self.watches.filter(function(w){ return w.enabled !== false; });
      if(!list.length) return Promise.resolve({ checked: 0, added: 0 });
      self._busy = true;
      var btnIds = ["btnAlertasCheckNow", "btnBellCheck"];
      btnIds.forEach(function(id){ var b = el(id); if(b) b.disabled = true; });

      var addedTotal = 0;
      var chain = Promise.resolve();
      /* API aceita até 4 watches por chamada */
      var chunks = [];
      for(var i = 0; i < list.length; i += 4){
        chunks.push(list.slice(i, i + 4));
      }
      chunks.forEach(function(chunk){
        chain = chain.then(function(){
          var known = [];
          chunk.forEach(function(w){
            Object.keys(w.seenIds || {}).forEach(function(k){ known.push(k); });
          });
          return fetch("/api/monitor-pncp", {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ watches: chunk, knownIds: known })
          }).then(function(r){ return utils.parseApiResponse(r); }).then(function(j){
            if(!j || j.ok === false) throw new Error((j && j.error) || "Falha no monitor PNCP");
            var byWatch = Object.create(null);
            (j.results || []).forEach(function(res){
              byWatch[res.watchId] = res;
            });
            chunk.forEach(function(w){
              var res = byWatch[w.id];
              var pack = (res && res.editais) || [];
              var novos = (j.novos || []).filter(function(n){ return n.watchId === w.id; });
              addedTotal += self.addNovos(opts.baseline ? pack : novos, w, opts);
              w.lastCheckedAt = Date.now();
            });
          });
        });
      });

      return chain.then(function(){
        self.persistWatches({ immediate: true });
        self.persistAlerts({ immediate: true });
        return { checked: list.length, added: addedTotal };
      }).catch(function(err){
        console.warn("alertas.checkAll", err);
        throw err;
      }).then(function(r){
        self._busy = false;
        btnIds.forEach(function(id){ var b = el(id); if(b) b.disabled = false; });
        return r;
      }, function(err){
        self._busy = false;
        btnIds.forEach(function(id){ var b = el(id); if(b) b.disabled = false; });
        throw err;
      });
    },

    createFromRadar: function(){
      var q = String((el("pncpKeywords") && el("pncpKeywords").value) || "").trim();
      var uf = String((el("pncpUf") && el("pncpUf").value) || "").trim().toUpperCase();
      if(!q) throw new Error("Informe palavras-chave no Radar PNCP.");
      if(!uf) throw new Error("Escolha uma UF para o alerta do Radar (ex.: SP).");
      var leiloes = !el("pncpIncluirLeiloes") || !!(el("pncpIncluirLeiloes") && el("pncpIncluirLeiloes").checked);
      return this.upsertWatch({
        tipo: "radar",
        q: q,
        uf: uf,
        leiloes: leiloes,
        janela: "45",
        label: q + " · " + uf
      }, { baseline: true });
    },

    createFromChat: function(){
      var texto = String((el("chatEditalMsg") && el("chatEditalMsg").value) || "").trim();
      var cat = String((el("chatEditalCat") && el("chatEditalCat").value) || "").trim();
      var janela = (el("chatEditalJanela") && el("chatEditalJanela").value) || "45";
      var leiloes = !el("chatEditalLeiloes") || !!(el("chatEditalLeiloes") && el("chatEditalLeiloes").checked);
      var ampliar = !!(el("chatEditalAmpliar") && el("chatEditalAmpliar").checked);
      if(!texto && !cat) throw new Error("Digite o nome da cidade ou uma pergunta antes de ativar o alerta.");
      var folded = utils.fold(texto).toLowerCase();
      var regiao = "";
      if(/norte\s*pioneiro/.test(folded)) regiao = "norte-pioneiro";
      return this.upsertWatch({
        tipo: "municipio",
        municipio: regiao ? "" : texto,
        mensagem: regiao ? "" : texto,
        regiao: regiao,
        categoria: cat,
        leiloes: leiloes,
        ampliar: ampliar,
        janela: janela === "ano" ? "ano" : "45",
        label: regiao ? ("Norte Pioneiro" + (cat ? " · " + cat : "")) : texto
      }, { baseline: true });
    },

    createFromProximos: function(){
      var self = this;
      var ibge = Number((el("proxIbge") && el("proxIbge").value) || 0) || 0;
      var nome = String((el("proxMunicipio") && el("proxMunicipio").value) || "").trim();
      var raio = Number((el("proxRaio") && el("proxRaio").value) || 250) || 250;
      var cobertura = String((el("proxCobertura") && el("proxCobertura").value) || "");
      var q = String((el("proxKeywords") && el("proxKeywords").value) || "").trim();
      var janela = (el("proxJanela") && el("proxJanela").value) || "ano";
      var ampliar = !!(el("proxAmpliar") && el("proxAmpliar").checked);
      var leiloes = !el("proxLeiloes") || !!(el("proxLeiloes") && el("proxLeiloes").checked);
      var federal = !!(el("proxFederal") && el("proxFederal").checked);
      if(raio < 10) raio = 10;
      if(raio > 700) raio = 700;

      function saveWatch(m){
        var munNome = (m && (m.nome || m.n)) || nome.split("/")[0].trim() || "Município";
        var uf = (m && (m.uf || m.u)) || "";
        var code = Number((m && (m.ibge || m.i)) || ibge) || 0;
        if(!code) throw new Error("Escolha o município de origem na lista (IBGE).");
        var label =
          munNome +
          (uf ? "/" + uf : "") +
          " · " +
          raio +
          " km" +
          (cobertura === "pr-sp" ? " · PR+SP" : "") +
          (q ? " · " + q : "");
        return self.upsertWatch({
          tipo: "proximos",
          ibge: code,
          municipio: munNome,
          uf: uf,
          raio: raio,
          cobertura: cobertura,
          q: q,
          janela: janela === "45" ? "45" : "ano",
          ampliar: ampliar,
          leiloes: leiloes,
          federal: federal,
          label: label
        }, { baseline: true });
      }

      if(ibge){
        var saved = null;
        try{ saved = LICSYSTEM.captacao.loadOrigem && LICSYSTEM.captacao.loadOrigem(); }catch(e){}
        return Promise.resolve(saveWatch({
          ibge: ibge,
          nome: (saved && saved.nome) || nome.split("/")[0].trim(),
          uf: (saved && saved.uf) || (nome.indexOf("/") >= 0 ? nome.split("/")[1] : "")
        }));
      }
      if(nome.length < 2){
        return Promise.reject(new Error("Informe o município de origem e escolha na lista antes de ativar o alerta."));
      }
      return LICSYSTEM.captacao.resolveMunicipioFromInput().then(function(m){
        if(!m || !m.ibge){
          throw new Error("Não deu para confirmar o município. Clique na sugestão da lista e tente de novo.");
        }
        try{ LICSYSTEM.captacao.selectMunicipio(m); }catch(e){}
        return saveWatch(m);
      });
    },

    startPolling: function(){
      var self = this;
      this.stopPolling();
      this._timer = setInterval(function(){
        if(document.hidden) return;
        self.checkAll().catch(function(){});
      }, this.CHECK_MS);
    },

    stopPolling: function(){
      if(this._timer){
        clearInterval(this._timer);
        this._timer = null;
      }
    },

    onLogin: function(){
      this.load();
      this.startPolling();
      var self = this;
      setTimeout(function(){
        self.checkAll().catch(function(){});
      }, 8000);
    },

    onLogout: function(){
      this.stopPolling();
      this.setPanelOpen(false);
    },

    wire: function(){
      if(this._wired) return;
      this._wired = true;
      var self = this;
      var bell = el("bell");
      if(bell){
        bell.addEventListener("click", function(e){
          e.stopPropagation();
          self.togglePanel();
        });
      }
      document.addEventListener("click", function(e){
        var wrap = el("bellWrap");
        if(!wrap || !self._panelOpen) return;
        if(!wrap.contains(e.target)) self.setPanelOpen(false);
      });
      var list = el("bellPanelList");
      if(list){
        list.addEventListener("click", function(e){
          var item = e.target.closest("[data-alert-id]");
          if(item) self.markRead(item.getAttribute("data-alert-id"));
        });
      }
      var watchesBox = el("alertasWatchList");
      if(watchesBox){
        watchesBox.addEventListener("click", function(e){
          var t = e.target.closest("[data-watch-toggle]");
          if(t){ self.toggleWatch(t.getAttribute("data-watch-toggle")); return; }
          var d = e.target.closest("[data-watch-del]");
          if(d){
            if(confirm("Excluir este alerta?")) self.removeWatch(d.getAttribute("data-watch-del"));
          }
        });
      }
      function runCheck(){
        self.checkAll().then(function(r){
          var msg = r && r.added
            ? (r.added + " edital(is) novo(s) encontrado(s). Veja o sino.")
            : "Verificação concluída. Nenhum edital novo.";
          showAlert("pncpAlert", r && r.added ? "ok" : "info", msg);
        }).catch(function(err){
          showAlert("pncpAlert", "error", (err && err.message) || "Falha ao verificar alertas");
        });
      }
      var btnCheck = el("btnAlertasCheckNow");
      if(btnCheck) btnCheck.addEventListener("click", runCheck);
      var btnBellCheck = el("btnBellCheck");
      if(btnBellCheck) btnBellCheck.addEventListener("click", function(e){ e.stopPropagation(); runCheck(); });
      var btnMark = el("btnBellMarkAll");
      if(btnMark) btnMark.addEventListener("click", function(e){ e.stopPropagation(); self.markAllRead(); });
      var btnRadar = el("btnPncpAlerta");
      if(btnRadar){
        btnRadar.addEventListener("click", function(){
          try{
            self.createFromRadar().then(function(){
              showAlert("pncpAlert", "ok", "Alerta ativado! Os editais atuais foram registrados como base; o sino avisará só os novos.");
            }).catch(function(err){
              showAlert("pncpAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
            });
          }catch(err){
            showAlert("pncpAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
          }
        });
      }
      var btnChat = el("btnChatAlerta");
      if(btnChat){
        btnChat.addEventListener("click", function(){
          try{
            self.createFromChat().then(function(){
              showAlert("chatEditalAlert", "ok", "Alerta ativado! O sino avisará quando surgir edital novo para essa busca.");
            }).catch(function(err){
              showAlert("chatEditalAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
            });
          }catch(err){
            showAlert("chatEditalAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
          }
        });
      }
      var btnProx = el("btnProxAlerta");
      if(btnProx){
        btnProx.addEventListener("click", function(){
          btnProx.disabled = true;
          self.createFromProximos().then(function(w){
            showAlert(
              "proxAlert",
              "ok",
              "Alerta de vizinhos ativado" +
                (w && w.label ? " (“" + utils.escapeHtml(w.label) + "”)" : "") +
                ". Os editais atuais viraram base; o sino avisará só os novos no raio."
            );
          }).catch(function(err){
            showAlert("proxAlert", "error", (err && err.message) || "Não foi possível ativar o alerta");
          }).then(function(){
            btnProx.disabled = false;
          });
        });
      }
    }
  };

  /* ============================ EVENT WIRING ============================ */
  function wireOrcFileInput(){
    var drop = el("orcDrop");
    var input = el("orcFile");
    if(!drop || !input) return;
    drop.onclick = function(){ input.click(); };
    input.onchange = function(){ if(input.files[0]) LICSYSTEM.orcamento.handleFile(input.files[0]); };
    drop.ondragover = function(e){ e.preventDefault(); drop.classList.add("drag"); };
    drop.ondragleave = function(){ drop.classList.remove("drag"); };
    drop.ondrop = function(e){
      e.preventDefault(); drop.classList.remove("drag");
      if(e.dataTransfer.files && e.dataTransfer.files[0]) LICSYSTEM.orcamento.handleFile(e.dataTransfer.files[0]);
    };
  }
  window.wireOrcFileInput = wireOrcFileInput;

  function wire(){
    function on(id, evt, fn){
      var n = el(id);
      if(n) n.addEventListener(evt, fn);
    }
    // Captação
    on("btnExtrair","click", LICSYSTEM.captacao.extrair);
    on("btnMostrarTudo","click", function(){ LICSYSTEM.captacao.render(null, true); });
    on("btnExportCaptacao","click", LICSYSTEM.captacao.exportarPdf);
    on("btnGoogleSel","click", LICSYSTEM.captacao.googleSelecionados);
    on("btnParaOrcamento","click", LICSYSTEM.captacao.paraOrcamento);
    on("btnPncp","click", LICSYSTEM.captacao.buscarPncp);
    on("btnProxBuscar","click", LICSYSTEM.captacao.buscarProximos);
    on("btnChatEdital","click", LICSYSTEM.captacao.buscarChatEditais);
    if(LICSYSTEM.alertas && LICSYSTEM.alertas.wire) LICSYSTEM.alertas.wire();
    on("proxRaio","keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); LICSYSTEM.captacao.buscarProximos(); }
    });
    on("proxKeywords","keydown", function(e){
      if(e.key === "Enter"){ e.preventDefault(); LICSYSTEM.captacao.buscarProximos(); }
    });
    on("proxCobertura","change", function(){
      if (String((el("proxCobertura") && el("proxCobertura").value) || "") === "pr-sp") {
        LICSYSTEM.captacao._proxRaioTouched = false;
      }
      LICSYSTEM.captacao.applyCoberturaPreset({ forceBump: true });
    });
    document.querySelectorAll("[data-prox-raio]").forEach(function(btn){
      btn.addEventListener("click", function(){
        var v = btn.getAttribute("data-prox-raio");
        var raioEl = el("proxRaio");
        if(raioEl && v){
          raioEl.value = String(v);
          LICSYSTEM.captacao._proxRaioTouched = true;
          LICSYSTEM.captacao.applyCoberturaPreset();
        }
      });
    });
    on("capCheckAll","change", function(){
      var onChk = this.checked;
      document.querySelectorAll(".capChk").forEach(function(c){ c.checked = onChk; });
    });
    on("captacaoBody","click", function(e){
      var g = e.target.closest(".capGoogle");
      if(g){ window.open("https://www.google.com/search?q="+encodeURIComponent(g.getAttribute("data-q")),"_blank"); }
    });
    on("pdfFile","change", function(){
      var st = el("pdfStatus");
      if(st && this.files && this.files[0]){
        st.className = "alert show alert-info";
        st.textContent = "Arquivo selecionado: " + this.files[0].name + " — clique em Extrair texto e filtrar.";
      }
    });

    // Análise Inteligente de Editais (IA)
    LICSYSTEM.analiseIa.wire();
    on("btnIaAnalisar","click", function(){ LICSYSTEM.analiseIa.analisar(); });
    on("btnIaLimpar","click", function(){ LICSYSTEM.analiseIa.limpar(); });
    on("btnIaCopiar","click", function(){ LICSYSTEM.analiseIa.copiarRelatorio(); });
    on("btnIaImprimir","click", function(){ LICSYSTEM.analiseIa.imprimirRelatorio(); });
    on("btnIaDocs","click", function(){ LICSYSTEM.analiseIa.openDocsModal(); });
    on("btnIaParticipar","click", function(){
      LICSYSTEM.analiseIa._pendingParticiparAsk = false;
      try{ LICSYSTEM.docsChecklist.closeModal({ skipParticiparAsk: true }); }catch(e){}
      LICSYSTEM.leiloesParticipo.showParticiparModal();
    });

    // Checklist documentos do edital
    on("btnDocsSalvar","click", function(){ LICSYSTEM.docsChecklist.save(); });
    on("btnDocsAdd","click", function(){ LICSYSTEM.docsChecklist.addManual(); });
    on("btnDocsClearOk","click", function(){ LICSYSTEM.docsChecklist.clearOk(); });
    on("btnDocsModalClose","click", function(){ LICSYSTEM.docsChecklist.closeModal(); });
    on("btnDocsModalGo","click", function(){ LICSYSTEM.docsChecklist.goFromModal(); });
    on("docsOverlay","click", function(e){
      if(e.target === el("docsOverlay")) LICSYSTEM.docsChecklist.closeModal();
    });
    on("btnParticiparSim","click", function(){ LICSYSTEM.leiloesParticipo.confirmSim(); });
    on("btnParticiparNao","click", function(){ LICSYSTEM.leiloesParticipo.confirmNao(); });
    on("participarOverlay","click", function(e){
      if(e.target === el("participarOverlay")) LICSYSTEM.leiloesParticipo.confirmNao();
    });
    document.addEventListener("keydown", function(e){
      if(e.key === "Escape"){
        var pov = el("participarOverlay");
        if(pov && pov.classList.contains("open")){
          LICSYSTEM.leiloesParticipo.confirmNao();
          return;
        }
        var ov = el("docsOverlay");
        if(ov && ov.classList.contains("open")) LICSYSTEM.docsChecklist.closeModal();
      }
    });

    // Orçamento
    on("btnAddLinha","click", LICSYSTEM.orcamento.addLinha);
    on("btnLimparOrc","click", LICSYSTEM.orcamento.limpar);
    on("btnPropostaOrc","click", LICSYSTEM.orcamento.gerarProposta);
    on("btnExportOrcExcel","click", LICSYSTEM.orcamento.exportarExcel);
    on("btnExportOrcPdf","click", LICSYSTEM.orcamento.exportarPdf);
    on("btnSalvarOrcCatalogo","click", LICSYSTEM.orcamento.abrirModalSalvarCatalogo);
    on("btnOrcSaveCancel","click", LICSYSTEM.orcamento.fecharModalSalvarCatalogo);
    on("btnOrcSaveConfirm","click", LICSYSTEM.orcamento.confirmarSalvarCatalogo);
    on("orcSaveOverlay","click", function(e){
      if(e.target === el("orcSaveOverlay")) LICSYSTEM.orcamento.fecharModalSalvarCatalogo();
    });
    ["orcSaveNome","orcSaveNumero"].forEach(function(id){
      on(id, "keydown", function(e){
        if(e.key === "Enter"){
          e.preventDefault();
          LICSYSTEM.orcamento.confirmarSalvarCatalogo();
        }
      });
    });
    on("orcPrev","click", function(){ LICSYSTEM.orcamento.goPage(-1); });
    on("orcNext","click", function(){ LICSYSTEM.orcamento.goPage(1); });
    on("capPrev","click", function(){ LICSYSTEM.captacao.goPage(-1); });
    on("capNext","click", function(){ LICSYSTEM.captacao.goPage(1); });
    on("proxPrev","click", function(){ LICSYSTEM.captacao.goProxPage(-1); });
    on("proxNext","click", function(){ LICSYSTEM.captacao.goProxPage(1); });
    on("chatPrev","click", function(){ LICSYSTEM.captacao.goChatPage(-1); });
    on("chatNext","click", function(){ LICSYSTEM.captacao.goChatPage(1); });
    on("orcCheckAll","change", function(){
      var onChk = this.checked;
      document.querySelectorAll(".orcChk").forEach(function(c){ c.checked = onChk; });
    });
    on("orcBody","input", function(e){
      var inp = e.target.closest("input[data-i]");
      if(!inp) return;
      LICSYSTEM.orcamento.onEdit(Number(inp.getAttribute("data-i")), inp.getAttribute("data-f"), inp.value);
    });
    on("orcBody","click", function(e){
      var del = e.target.closest(".orcDel");
      if(del){ var i=Number(del.getAttribute("data-i")); LICSYSTEM.state.orcItems.splice(i,1); if(!LICSYSTEM.state.orcItems.length) LICSYSTEM.state.orcItems.push(LICSYSTEM.orcamento.emptyItem()); LICSYSTEM.orcamento.render(); return; }
      var yes = e.target.closest(".orcCompensa");
      if(yes){
        var iy = Number(yes.getAttribute("data-i"));
        var ity = LICSYSTEM.state.orcItems[iy];
        if(ity){
          ity.compensa = (ity.compensa === true) ? null : true;
          LICSYSTEM.orcamento.render();
        }
        return;
      }
      var no = e.target.closest(".orcNaoCompensa");
      if(no){
        var ino = Number(no.getAttribute("data-i"));
        var itn = LICSYSTEM.state.orcItems[ino];
        if(itn){
          itn.compensa = (itn.compensa === false) ? null : false;
          LICSYSTEM.orcamento.render();
        }
        return;
      }
      var g = e.target.closest(".orcGoogle");
      if(g){ var it=LICSYSTEM.state.orcItems[Number(g.getAttribute("data-i"))]; if(it&&it.produto) window.open("https://www.google.com/search?q="+encodeURIComponent(it.produto),"_blank"); return; }
      var ml = e.target.closest(".orcMl");
      if(ml){ var it2=LICSYSTEM.state.orcItems[Number(ml.getAttribute("data-i"))]; if(it2&&it2.produto) window.open("https://lista.mercadolivre.com.br/"+encodeURIComponent(it2.produto),"_blank"); return; }
      var openL = e.target.closest(".orcOpenLink");
      if(openL){
        var itL = LICSYSTEM.state.orcItems[Number(openL.getAttribute("data-i"))];
        if(itL){
          var url = utils.normalizeHttpUrl(itL.link);
          if(url) window.open(url, "_blank", "noopener,noreferrer");
        }
        return;
      }
    });
    wireOrcFileInput();

    // Cruzamento
    on("btnCruzar","click", LICSYSTEM.cruzamento.processar);
    on("btnPropostaCruz","click", LICSYSTEM.cruzamento.gerarProposta);

    // Cofre
    on("btnSalvarCofre","click", LICSYSTEM.cofre.save);
    try{ LICSYSTEM.cofre.wire(); }catch(e){}

    // Entregas (offcanvas)
    LICSYSTEM.entregas.wire();

    // Histórico e Controle de Entregas
    on("histBusca","input", function(){ LICSYSTEM.histEntregas.aplicarFiltros(); });
    on("histStatus","change", function(){ LICSYSTEM.histEntregas.aplicarFiltros(); });
    on("btnHistAdd","click", function(){ LICSYSTEM.histEntregas.adicionarItem(); });
    on("btnHistSeed","click", function(){ LICSYSTEM.histEntregas.carregarExemplos(true); });
    on("histEntregasBody","input", function(e){
      var inp = e.target.closest("input[data-hist-id]");
      if(!inp) return;
      var id = inp.getAttribute("data-hist-id");
      var field = inp.getAttribute("data-hist-f");
      if(field === "qtdEntregue"){
        calcularFaltaEntregar(id, inp.value);
      } else {
        LICSYSTEM.histEntregas.onEdit(id, field, inp.value);
      }
    });
    on("histEntregasBody","change", function(e){
      var chk = e.target.closest("input.hist-check[data-hist-id]");
      if(chk){
        LICSYSTEM.histEntregas.toggleConcluido(chk.getAttribute("data-hist-id"), chk.checked);
        return;
      }
    });
    on("histEntregasBody","click", function(e){
      var del = e.target.closest(".histDel");
      if(del){ LICSYSTEM.histEntregas.remover(del.getAttribute("data-hist-id")); }
    });

    // Catálogo Interno
    on("btnSalvarProduto","click", salvarProduto);
    on("btnCancelarEditCat","click", function(){ LICSYSTEM.catalogo.cancelEdit(); });
    on("catBusca","input", filtrarCatalogo);
    on("catalogoBody","click", function(e){
      var ed = e.target.closest(".catEdit");
      if(ed){ LICSYSTEM.catalogo.editar(ed.getAttribute("data-id")); return; }
      var ex = e.target.closest(".catDel");
      if(ex){ LICSYSTEM.catalogo.excluir(ex.getAttribute("data-id")); return; }
    });

    // Atas de Registro (ARP)
    on("btnArpAddItem","click", function(){ LICSYSTEM.arp.adicionarItem(); });
    on("btnArpSalvarAta","click", function(){ LICSYSTEM.arp.salvarAta(); });
    on("btnArpNova","click", function(){ LICSYSTEM.arp.novaAta(); });
    on("arpItensBody","click", function(e){
      var del = e.target.closest(".arpDelItem");
      if(del){ LICSYSTEM.arp.removerItem(Number(del.getAttribute("data-i"))); return; }
    });
    on("arpItensBody","input", function(e){
      var inp = e.target.closest("input[data-arp-i]");
      if(!inp) return;
      LICSYSTEM.arp.onEditItem(
        Number(inp.getAttribute("data-arp-i")),
        inp.getAttribute("data-arp-f"),
        inp.value
      );
    });
    on("arpListaSalvas","click", function(e){
      var loadBtn = e.target.closest(".arpLoad");
      if(loadBtn){ LICSYSTEM.arp.carregarAta(loadBtn.getAttribute("data-id")); return; }
      var delBtn = e.target.closest(".arpDelAta");
      if(delBtn){ LICSYSTEM.arp.excluirAta(delBtn.getAttribute("data-id")); return; }
    });

    // Sala de Disputa (cálculos ao vivo)
    ["disputaPrecoRef","disputaDegrau","disputaLanceConcorrente","disputaMeuCusto"].forEach(function(id){
      on(id,"input", function(){ LICSYSTEM.disputa.atualizarResultados(); });
      on(id,"change", function(){ LICSYSTEM.disputa.atualizarResultados(); });
    });
    on("btnRegistrarLance","click", function(){ LICSYSTEM.disputa.registrarLance(); });
    on("btnLimparDisputa","click", function(){ LICSYSTEM.disputa.limparSessao(); });

    // Concorrência
    on("btnCnpj","click", LICSYSTEM.concorrencia.buscar);
    on("cnpjInput","keydown", function(e){ if(e.key==="Enter") LICSYSTEM.concorrencia.buscar(); });

    // Ferramentas
    on("btnSalvarPerfil","click", LICSYSTEM.ferramentas.onSalvarClick);
    on("empLogo","change", LICSYSTEM.ferramentas.onLogoChange);
    on("btnExportBackup","click", LICSYSTEM.ferramentas.exportarBackup);
    on("btnImportBackup","click", function(){ var f=el("backupFile"); if(f) f.click(); });
    on("backupFile","change", function(){
      if(this.files && this.files[0]) LICSYSTEM.ferramentas.importarBackup(this.files[0]);
      this.value = "";
    });

    // Bell
    on("bell","click", function(){
      if(window.__lsActivateView) window.__lsActivateView("radarPncp");
    });
  }

  /* ============================ VIEW CHANGE HOOK ============================ */
  var VIEW_TITLES = {
    dashboard:'Dashboard',
    pesquisas:'Pesquisas de Editais',
    perguntarEditais:'Perguntar editais',
    editaisProximos:'Editais próximos',
    radarPncp:'Radar PNCP',
    captacao:'Pesquisas de Editais',
    analiseIa:'Análise Inteligente de Editais',
    leiloesParticipo:'Leilão que Participo',
    importarEdital:'Importar Edital (PDF)',
    orcamento:'Orçamento',
    cruzamento:'Cruzamento Inteligente (ML)',
    cofre:'Cofre de Documentos',
    docsChecklist:'Docs do Edital',
    entregas:'Entrega',
    histEntregas:'Histórico de Entregas',
    concorrencia:'Análise de Concorrência',
    catalogo:'Catálogo Interno',
    arp:'Atas de Registro (ARP)',
    disputa:'Sala de Disputa',
    ferramentas:'Ferramentas',
    chat:'Pergunte ao Chat',
    suporte:'Suporte LICSYSTEM',
    'chat-ia':'Chat IA'
  };
  LICSYSTEM.VIEW_TITLES = VIEW_TITLES;

  LICSYSTEM.onViewChange = function(view, navKey){
    var prev = LICSYSTEM.state.currentView;
    view = view || "dashboard";
    // Ao sair do Orçamento: sincroniza inputs pendentes e grava (não limpa orcItems)
    if(prev === "orcamento" && view !== "orcamento"){
      try{ LICSYSTEM.orcamento.flushSave(); }catch(e){}
    }
    LICSYSTEM.state.currentView = view;
    try{ localStorage.setItem(LAST_VIEW_KEY, navKey || view); }catch(e){}
    // Não remonta telas pesadas a cada clique no menu
    if(view==="dashboard"){
      if(!LICSYSTEM.state._dashReady){
        LICSYSTEM.state._dashReady = true;
        LICSYSTEM.dashboard.render();
      }
    }
    if(view==="orcamento"){
      // Remonta a partir do estado em memória (não zera orcItems; garante tabela após troca de aba)
      LICSYSTEM.orcamento.render({ save:false });
      LICSYSTEM.orcamento.updateMeta();
    }
    if(view==="cofre"){
      try{ LICSYSTEM.cofre.load(); }catch(e){}
      LICSYSTEM.state._cofreRendered = true;
      LICSYSTEM.cofre.render();
    }
    if(view==="docsChecklist"){
      try{ LICSYSTEM.cofre.load(); }catch(e){}
      LICSYSTEM.docsChecklist.render();
    }
    if(view==="leiloesParticipo"){
      try{ LICSYSTEM.leiloesParticipo.render(); }catch(e){}
    }
    if(view==="ferramentas") LICSYSTEM.ferramentas.carregarView();
    if(view==="entregas") LICSYSTEM.entregas.renderLista();
    if(view==="histEntregas") LICSYSTEM.histEntregas.render();
    if(view==="catalogo") listarProdutos();
    if(view==="arp") LICSYSTEM.arp.renderAll();
    if(view==="disputa") LICSYSTEM.disputa.atualizarResultados();
    if(view==="cruzamento"){
      // CEP em background — não bloqueia a troca de tela
      setTimeout(function(){
        LICSYSTEM.cruzamento.resolveCep().catch(function(){});
      }, 0);
    }
    // Voiceflow: só guarda a página — NÃO recarrega o chat a cada clique
    try{
      if(LICSYSTEM.voiceflow) LICSYSTEM.voiceflow.currentView = view;
    }catch(e){}
  };

  /* ============================ ENTREGAS ============================ */
  var ENTREGAS_KEY = "licsystem_entregas_v1";

  /**
   * Monta o payload da entrega (texto + arquivo) para persistência futura.
   * Pronto para: Firebase Storage (arquivo) + Firestore/RTDB (metadados).
   * @returns {{ ok:boolean, erro?:string, dados?:object, arquivo?:File|null }}
   */
  function coletarDadosEntrega(){
    var val = function(id){ var n = el(id); return n ? String(n.value || "").trim() : ""; };
    var statusEl = document.querySelector('input[name="entregaStatusNota"]:checked');
    var destinoEl = document.querySelector('input[name="entregaTipoDestino"]:checked');
    var fileInput = el("entregaArquivoNf");
    var arquivo = (fileInput && fileInput.files && fileInput.files[0]) ? fileInput.files[0] : null;

    var statusNota = statusEl ? statusEl.value : "NAO_FEITO";
    var tipoDestino = destinoEl ? destinoEl.value : "DESTINO_FINAL";

    var dados = {
      // --- Identificação ---
      nomeLicitacao: val("entregaNomeLicitacao"),
      numeroEmpenho: val("entregaNumeroEmpenho"),

      // --- Faturamento / anexos ---
      statusNota: statusNota, // "FEITO" | "NAO_FEITO"
      observacoes: val("entregaObservacoes"),
      materialOrigem: val("entregaMaterialOrigem"),
      // Metadados do anexo (o File em si vai em `arquivo` abaixo)
      anexo: arquivo ? {
        nome: arquivo.name,
        tipo: arquivo.type || "",
        tamanho: arquivo.size || 0
        // TODO Firebase Storage:
        // 1) storage.ref("entregas/"+id+"/"+arquivo.name).put(arquivo)
        // 2) url = await snap.ref.getDownloadURL()
        // 3) dados.anexo.url = url
      } : null,

      // --- Logística ---
      tipoDestino: tipoDestino, // "DESTINO_FINAL" | "MINHA_LOJA"
      destinoFinal: null,
      minhaLoja: null,

      // --- Controle ---
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString()
      // TODO Firestore/RTDB:
      // await firebase.firestore().collection("entregas").add(dados)
      // ou utils.firebasePush("entregas", dados)
    };

    if(tipoDestino === "DESTINO_FINAL"){
      dados.destinoFinal = {
        localResponsavel: val("entregaLocalResponsavel"),
        cep: val("entregaCep").replace(/\D/g,""),
        endereco: val("entregaEndereco"),
        numero: val("entregaNumero"),
        complemento: val("entregaComplemento"),
        bairro: val("entregaBairro"),
        cidade: val("entregaCidade"),
        uf: val("entregaUf").toUpperCase()
      };
    } else {
      dados.minhaLoja = {
        transporte: val("entregaTransporte") // CORREIOS | TRANSPORTADORA | VEICULO_PROPRIO
      };
    }

    if(!dados.nomeLicitacao){
      return { ok:false, erro:"Informe o Nome da Licitação." };
    }
    if(tipoDestino === "MINHA_LOJA" && !(dados.minhaLoja && dados.minhaLoja.transporte)){
      return { ok:false, erro:"Selecione o transporte para envio futuro." };
    }

    return { ok:true, dados:dados, arquivo:arquivo };
  }
  // Exposto globalmente conforme solicitado
  window.coletarDadosEntrega = coletarDadosEntrega;

  LICSYSTEM.entregas = {
    items: [],

    load:function(){
      try{
        var saved = JSON.parse(localStorage.getItem(ENTREGAS_KEY) || "[]");
        LICSYSTEM.entregas.items = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.entregas.items = [];
      }
    },

    saveLocal:function(){
      try{
        localStorage.setItem(ENTREGAS_KEY, JSON.stringify(LICSYSTEM.entregas.items));
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("entregas");
      }catch(e){
        console.warn("Entregas: falha ao salvar localmente", e);
      }
    },

    open:function(){
      var oc = el("entregaOffcanvas");
      var ov = el("entregaOverlay");
      if(oc){
        oc.classList.add("open");
        oc.setAttribute("aria-hidden","false");
      }
      if(ov){
        ov.classList.add("show");
        ov.setAttribute("aria-hidden","false");
      }
      document.body.classList.add("entrega-open");
      hideAlert("entregaFormAlert");
      setTimeout(function(){ var f = el("entregaNomeLicitacao"); if(f) f.focus(); }, 200);
    },

    close:function(){
      var oc = el("entregaOffcanvas");
      var ov = el("entregaOverlay");
      if(oc){
        oc.classList.remove("open");
        oc.setAttribute("aria-hidden","true");
      }
      if(ov){
        ov.classList.remove("show");
        ov.setAttribute("aria-hidden","true");
      }
      document.body.classList.remove("entrega-open");
    },

    resetForm:function(){
      [
        "entregaNomeLicitacao","entregaNumeroEmpenho","entregaObservacoes","entregaMaterialOrigem",
        "entregaLocalResponsavel","entregaCep","entregaEndereco","entregaNumero","entregaComplemento",
        "entregaBairro","entregaCidade","entregaUf"
      ].forEach(function(id){ if(el(id)) el(id).value = ""; });
      if(el("entregaTransporte")) el("entregaTransporte").value = "";
      if(el("entregaStatusNaoFeito")) el("entregaStatusNaoFeito").checked = true;
      if(el("entregaDestinoFinal")) el("entregaDestinoFinal").checked = true;
      if(el("entregaArquivoNf")) el("entregaArquivoNf").value = "";
      if(el("entregaArquivoNome")) el("entregaArquivoNome").textContent = "PDF ou imagem";
      if(el("entregaCepHint")) el("entregaCepHint").textContent = "Digite o CEP (8 dígitos) para preencher via ViaCEP.";
      LICSYSTEM.entregas.syncStatusUi();
      LICSYSTEM.entregas.syncDestinoUi();
      hideAlert("entregaFormAlert");
    },

    syncStatusUi:function(){
      var feito = el("entregaStatusFeito") && el("entregaStatusFeito").checked;
      var lblN = el("lblStatusNaoFeito");
      var lblF = el("lblStatusFeito");
      if(lblN) lblN.className = "status-nf" + (feito ? "" : " is-nao");
      if(lblF) lblF.className = "status-nf" + (feito ? " is-feito" : "");
    },

    syncDestinoUi:function(){
      var loja = el("entregaMinhaLoja") && el("entregaMinhaLoja").checked;
      var cardF = el("cardDestinoFinal");
      var cardL = el("cardMinhaLoja");
      if(cardF) cardF.classList.toggle("is-active", !loja);
      if(cardL) cardL.classList.toggle("is-active", !!loja);
      if(el("painelDestinoFinal")) el("painelDestinoFinal").style.display = loja ? "none" : "";
      if(el("painelMinhaLoja")) el("painelMinhaLoja").style.display = loja ? "" : "none";
    },

    /** ViaCEP — preenche endereço ao completar 8 dígitos */
    buscarCep:function(){
      var cepInput = el("entregaCep");
      if(!cepInput) return;
      var cep = String(cepInput.value || "").replace(/\D/g,"");
      if(cep.length === 8){
        cepInput.value = cep.slice(0,5) + "-" + cep.slice(5);
      }
      var hint = el("entregaCepHint");
      if(cep.length !== 8){
        if(hint) hint.textContent = "Digite o CEP (8 dígitos) para preencher via ViaCEP.";
        return;
      }
      if(hint) hint.textContent = "Consultando ViaCEP…";
      fetch("https://viacep.com.br/ws/"+cep+"/json/")
        .then(function(r){ return r.json(); })
        .then(function(j){
          if(!j || j.erro){
            if(hint) hint.textContent = "CEP não encontrado.";
            return;
          }
          if(el("entregaEndereco")) el("entregaEndereco").value = j.logradouro || "";
          if(el("entregaBairro")) el("entregaBairro").value = j.bairro || "";
          if(el("entregaCidade")) el("entregaCidade").value = j.localidade || "";
          if(el("entregaUf")) el("entregaUf").value = j.uf || "";
          if(hint) hint.textContent = "Endereço preenchido via ViaCEP. Confira o número.";
          if(el("entregaNumero")) el("entregaNumero").focus();
        })
        .catch(function(){
          if(hint) hint.textContent = "Falha ao consultar ViaCEP (rede/CORS). Preencha manualmente.";
        });
    },

    renderLista:function(){
      LICSYSTEM.entregas.load();
      var box = el("entregaList");
      if(!box) return;
      var list = LICSYSTEM.entregas.items || [];
      if(!list.length){
        box.innerHTML = '<div class="muted small" style="padding:18px;text-align:center">Nenhuma entrega registrada ainda.</div>';
        return;
      }
      var html = "";
      list.slice().reverse().forEach(function(it, revIdx){
        var idx = list.length - 1 - revIdx;
        var badge = it.statusNota === "FEITO"
          ? '<span class="badge-nf ok">NF FEITO</span>'
          : '<span class="badge-nf pend">NF NÃO FEITO</span>';
        var dest = it.tipoDestino === "MINHA_LOJA"
          ? ("Loja · " + ((it.minhaLoja && it.minhaLoja.transporte) || "—"))
          : ("Destino · " + ((it.destinoFinal && (it.destinoFinal.cidade || it.destinoFinal.localResponsavel)) || "—"));
        html += '<div class="entrega-item" data-idx="'+idx+'">'+
          '<div>'+
            '<div class="ei-title">'+utils.escapeHtml(it.nomeLicitacao||"Sem nome")+'</div>'+
            '<div class="ei-meta">Empenho: '+utils.escapeHtml(it.numeroEmpenho||"—")+
              ' · '+utils.escapeHtml(dest)+
              (it.anexo && it.anexo.nome ? ' · 📎 '+utils.escapeHtml(it.anexo.nome) : '')+
            '</div>'+
          '</div>'+badge+
        '</div>';
      });
      box.innerHTML = html;
    },

    salvar:function(){
      var pack = coletarDadosEntrega();
      if(!pack.ok){
        showAlert("entregaFormAlert","warn", utils.escapeHtml(pack.erro));
        return;
      }
      // Persistência local imediata (metadados). Arquivo fica só no File/seleção atual.
      // TODO: integrar Storage + Firestore aqui usando pack.dados + pack.arquivo
      var registro = pack.dados;
      registro.id = "ent_"+Date.now();
      LICSYSTEM.entregas.load();
      LICSYSTEM.entregas.items.push(registro);
      LICSYSTEM.entregas.saveLocal();
      LICSYSTEM.entregas.renderLista();
      LICSYSTEM.entregas.close();
      LICSYSTEM.entregas.resetForm();
      showAlert("entregaAlert","ok","✅ Entrega salva localmente ("+utils.escapeHtml(registro.nomeLicitacao)+").");
    },

    wire:function(){
      function on(id, evt, fn){
        var n = el(id); if(n) n.addEventListener(evt, fn);
      }
      on("btnNovaEntrega","click", function(){
        LICSYSTEM.entregas.resetForm();
        LICSYSTEM.entregas.open();
      });
      on("btnFecharEntrega","click", LICSYSTEM.entregas.close);
      on("btnCancelarEntrega","click", function(){
        LICSYSTEM.entregas.close();
        LICSYSTEM.entregas.resetForm();
      });
      on("btnSalvarEntrega","click", LICSYSTEM.entregas.salvar);
      on("entregaOverlay","click", function(e){
        // Fecha só ao clicar no fundo escuro, não no card do formulário
        if(e.target && e.target.id === "entregaOverlay") LICSYSTEM.entregas.close();
      });

      ["entregaStatusFeito","entregaStatusNaoFeito"].forEach(function(id){
        on(id,"change", LICSYSTEM.entregas.syncStatusUi);
      });
      ["entregaDestinoFinal","entregaMinhaLoja"].forEach(function(id){
        on(id,"change", LICSYSTEM.entregas.syncDestinoUi);
      });
      on("entregaCep","blur", LICSYSTEM.entregas.buscarCep);
      on("entregaCep","input", function(){
        var v = (el("entregaCep").value || "").replace(/\D/g,"");
        if(v.length === 8) LICSYSTEM.entregas.buscarCep();
      });
      on("entregaArquivoNf","change", function(){
        var f = el("entregaArquivoNf");
        var nome = (f && f.files && f.files[0]) ? f.files[0].name : "PDF ou imagem";
        if(el("entregaArquivoNome")) el("entregaArquivoNome").textContent = nome;
      });

      document.addEventListener("keydown", function(e){
        if(e.key === "Escape" && document.body.classList.contains("entrega-open")){
          LICSYSTEM.entregas.close();
        }
      });
    }
  };

  /* ============================ CATÁLOGO INTERNO ============================ */
  var CATALOGO_KEY = "licsystem_catalogo_v1";

  LICSYSTEM.catalogo = {
    items: [],
    filtro: "",

    /** Carrega do localStorage. Trocar por Firestore: collection('catalogo').get() */
    load: function(){
      try{
        var saved = JSON.parse(localStorage.getItem(CATALOGO_KEY) || "[]");
        LICSYSTEM.catalogo.items = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.catalogo.items = [];
      }
      return LICSYSTEM.catalogo.items;
    },

    /**
     * Persiste localmente.
     * TODO Firestore:
     *   await firebase.firestore().collection('catalogo').doc(id).set(produto, { merge:true })
     *   ou .add(produto) para novos
     */
    saveLocal: function(){
      try{
        localStorage.setItem(CATALOGO_KEY, JSON.stringify(LICSYSTEM.catalogo.items));
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("catalogo");
      }catch(e){
        console.warn("Catálogo: falha ao salvar localmente", e);
      }
    },

    limparForm: function(){
      if(el("catEditId")) el("catEditId").value = "";
      if(el("catNome")) el("catNome").value = "";
      if(el("catSku")) el("catSku").value = "";
      if(el("catPreco")) el("catPreco").value = "";
      if(el("catMarca")) el("catMarca").value = "";
      var badge = el("catEditBadge");
      if(badge) badge.classList.remove("show");
      var btnCancel = el("btnCancelarEditCat");
      if(btnCancel) btnCancel.style.display = "none";
      var btnSave = el("btnSalvarProduto");
      if(btnSave) btnSave.textContent = "💾 Salvar Produto";
    },

    cancelEdit: function(){
      LICSYSTEM.catalogo.limparForm();
      hideAlert("catalogoAlert");
    },

    editar: function(id){
      LICSYSTEM.catalogo.load();
      var item = null;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === id){ item = LICSYSTEM.catalogo.items[i]; break; }
      }
      if(!item) return;

      // Orçamento salvo → reabre a planilha completa
      if(item.tipo === "orcamento"){
        LICSYSTEM.orcamento.abrirDoCatalogo(id);
        return;
      }

      if(el("catEditId")) el("catEditId").value = item.id;
      if(el("catNome")) el("catNome").value = item.nome || "";
      if(el("catSku")) el("catSku").value = item.sku || "";
      if(el("catPreco")) el("catPreco").value = item.preco != null ? item.preco : "";
      if(el("catMarca")) el("catMarca").value = item.marca || "";
      var badge = el("catEditBadge");
      if(badge) badge.classList.add("show");
      var btnCancel = el("btnCancelarEditCat");
      if(btnCancel) btnCancel.style.display = "";
      var btnSave = el("btnSalvarProduto");
      if(btnSave) btnSave.textContent = "💾 Atualizar Produto";
      if(el("catNome")) el("catNome").focus();
    },

    excluir: function(id){
      if(!id) return;
      LICSYSTEM.catalogo.load();
      var item = null;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === id){ item = LICSYSTEM.catalogo.items[i]; break; }
      }
      var label = item && item.tipo === "orcamento"
        ? "Excluir este orçamento salvo do catálogo?"
        : "Excluir este produto do catálogo?";
      if(!confirm(label)) return;
      LICSYSTEM.catalogo.items = LICSYSTEM.catalogo.items.filter(function(it){ return it.id !== id; });
      LICSYSTEM.catalogo.saveLocal();
      if(item && item.tipo === "orcamento" && LICSYSTEM.state.orcCatalogId === id){
        LICSYSTEM.state.orcCatalogId = null;
        LICSYSTEM.orcamento.updateMeta();
      }
      listarProdutos();
      showAlert("catalogoAlert","ok", item && item.tipo === "orcamento" ? "Orçamento excluído." : "Produto excluído.");
      if((el("catEditId")||{}).value === id) LICSYSTEM.catalogo.limparForm();
    }
  };

  /**
   * Salva (cria ou atualiza) um produto do formulário.
   * Estrutura pronta para coleção Firestore 'catalogo'.
   */
  function salvarProduto(){
    var nome = ((el("catNome") && el("catNome").value) || "").trim();
    var sku = ((el("catSku") && el("catSku").value) || "").trim();
    var marca = ((el("catMarca") && el("catMarca").value) || "").trim();
    var preco = Number((el("catPreco") && el("catPreco").value) || 0);
    var editId = ((el("catEditId") && el("catEditId").value) || "").trim();

    if(!nome){
      showAlert("catalogoAlert","warn","Informe o Nome do Produto / Descrição.");
      if(el("catNome")) el("catNome").focus();
      return null;
    }
    if(preco < 0 || !isFinite(preco)){
      showAlert("catalogoAlert","warn","Preço de referência inválido.");
      return null;
    }

    LICSYSTEM.catalogo.load();
    var agora = new Date().toISOString();
    var produto;

    if(editId){
      var found = false;
      for(var i=0;i<LICSYSTEM.catalogo.items.length;i++){
        if(LICSYSTEM.catalogo.items[i].id === editId){
          produto = LICSYSTEM.catalogo.items[i];
          produto.nome = nome;
          produto.sku = sku;
          produto.marca = marca;
          produto.preco = preco;
          produto.atualizadoEm = agora;
          found = true;
          break;
        }
      }
      if(!found){
        showAlert("catalogoAlert","error","Produto para edição não encontrado.");
        return null;
      }
      // TODO Firestore: collection('catalogo').doc(editId).update({ nome, sku, marca, preco, atualizadoEm })
    } else {
      produto = {
        id: "cat_" + Date.now() + "_" + Math.floor(Math.random()*1000),
        nome: nome,
        sku: sku,
        marca: marca,
        preco: preco,
        criadoEm: agora,
        atualizadoEm: agora
      };
      LICSYSTEM.catalogo.items.push(produto);
      // TODO Firestore: collection('catalogo').add({ ...produto sem id, ou .doc(produto.id).set(produto) })
    }

    LICSYSTEM.catalogo.saveLocal();
    LICSYSTEM.catalogo.limparForm();
    listarProdutos();
    showAlert("catalogoAlert","ok", editId ? "✅ Produto atualizado." : "✅ Produto salvo no catálogo.");
    return produto;
  }

  /**
   * Lista produtos na tabela (respeita filtro atual).
   * TODO Firestore: snapshot = await collection('catalogo').orderBy('nome').get()
   */
  function listarProdutos(){
    LICSYSTEM.catalogo.load();
    var body = el("catalogoBody");
    if(!body) return;
    var q = utils.fold(LICSYSTEM.catalogo.filtro || "").toLowerCase().trim();
    var list = LICSYSTEM.catalogo.items.slice();

    if(q){
      list = list.filter(function(it){
        var blob = utils.fold([it.nome, it.sku, it.marca, it.numero, it.tipo].join(" ")).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    }

    list.sort(function(a,b){
      var ta = a.tipo === "orcamento" ? 0 : 1;
      var tb = b.tipo === "orcamento" ? 0 : 1;
      if(ta !== tb) return ta - tb;
      return String(a.nome||"").localeCompare(String(b.nome||""), "pt-BR", { sensitivity:"base" });
    });

    if(!list.length){
      body.innerHTML = '<tr><td colspan="5" class="muted" style="text-align:center;padding:24px">'+(
        q ? "Nenhum item correspondente à busca." : "Nenhum produto ou orçamento cadastrado."
      )+'</td></tr>';
      return;
    }

    var html = "";
    list.forEach(function(it){
      var isOrc = it.tipo === "orcamento";
      var codigo = isOrc ? (it.numero || it.sku || "—") : (it.sku || "—");
      var desc = utils.escapeHtml(it.nome || "");
      if(isOrc){
        desc += ' <span class="cat-tipo-orc">Orçamento'+(it.qtdItens ? ' · '+it.qtdItens+' itens' : '')+'</span>';
      }
      var tipo = isOrc ? "Orçamento salvo" : (it.marca || "—");
      html += '<tr data-id="'+utils.escapeHtml(it.id)+'"'+(isOrc?' class="cat-row-orc"':'')+'>'+
        '<td>'+utils.escapeHtml(codigo)+'</td>'+
        '<td>'+desc+'</td>'+
        '<td>'+utils.escapeHtml(tipo)+'</td>'+
        '<td style="font-weight:700;color:var(--ls-navy)">'+utils.formatBrl(Number(it.preco)||0)+'</td>'+
        '<td><div class="cat-actions">'+
          '<button type="button" class="btn btn-ghost btn-sm catEdit" data-id="'+utils.escapeHtml(it.id)+'">'+(isOrc?'✎ Abrir':'✎ Editar')+'</button>'+
          '<button type="button" class="btn btn-ghost btn-sm catDel" data-id="'+utils.escapeHtml(it.id)+'">✕</button>'+
        '</div></td>'+
      '</tr>';
    });
    body.innerHTML = html;
  }

  /**
   * Filtra a tabela pelo texto da barra de pesquisa (#catBusca).
   */
  function filtrarCatalogo(){
    LICSYSTEM.catalogo.filtro = (el("catBusca") && el("catBusca").value) || "";
    listarProdutos();
  }

  // API pública (conforme solicitado)
  window.salvarProduto = salvarProduto;
  window.listarProdutos = listarProdutos;
  window.filtrarCatalogo = filtrarCatalogo;

  /* ============================ ATAS DE REGISTRO (ARP) ============================ */
  var ARP_KEY = "licsystem_arp_v1";

  /**
   * Calcula saldo disponível: Qtd Total Homologada − Qtd Consumida/Empenhada.
   * Nunca retorna negativo (piso em 0).
   * @param {number|string} qtdTotal
   * @param {number|string} qtdConsumida
   * @returns {number}
   */
  function calcularSaldoAta(qtdTotal, qtdConsumida){
    var total = Number(qtdTotal) || 0;
    var cons = Number(qtdConsumida) || 0;
    var saldo = total - cons;
    if(saldo < 0) saldo = 0;
    return saldo;
  }
  window.calcularSaldoAta = calcularSaldoAta;

  LICSYSTEM.arp = {
    /** Itens da ata em edição (rascunho na tela) */
    draftItens: [],
    /** Lista de atas persistidas */
    atas: [],

    load: function(){
      try{
        var saved = JSON.parse(localStorage.getItem(ARP_KEY) || "[]");
        LICSYSTEM.arp.atas = Array.isArray(saved) ? saved : [];
      }catch(e){
        LICSYSTEM.arp.atas = [];
      }
      return LICSYSTEM.arp.atas;
    },

    /**
     * Persistência local.
     * TODO banco (RTDB/Firestore):
     *   utils.firebaseSet("arp/"+ata.id, ata)
     *   ou firestore.collection("arp").doc(ata.id).set(ata)
     */
    saveLocal: function(){
      try{
        localStorage.setItem(ARP_KEY, JSON.stringify(LICSYSTEM.arp.atas));
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("arp");
      }catch(e){
        console.warn("ARP: falha ao salvar localmente", e);
      }
    },

    /** Monta objeto estruturado da ata atual (cabeçalho + itens com saldo). */
    coletarAta: function(){
      var orgao = ((el("arpOrgao") && el("arpOrgao").value) || "").trim();
      var numero = ((el("arpNumero") && el("arpNumero").value) || "").trim();
      var validade = ((el("arpValidade") && el("arpValidade").value) || "").trim();
      var aceitaCarona = !!(el("arpAceitaCarona") && el("arpAceitaCarona").checked);
      var id = ((el("arpId") && el("arpId").value) || "").trim();

      var itens = (LICSYSTEM.arp.draftItens || []).map(function(it){
        var total = Number(it.qtdTotal) || 0;
        var cons = Number(it.qtdConsumida) || 0;
        return {
          id: it.id || ("item_"+Date.now()+"_"+Math.floor(Math.random()*999)),
          produto: String(it.produto || "").trim(),
          qtdTotal: total,
          qtdConsumida: cons,
          saldoDisponivel: calcularSaldoAta(total, cons)
        };
      });

      return {
        id: id || ("arp_"+Date.now()),
        orgaoGerenciador: orgao,
        numeroPregaoArp: numero,
        dataValidade: validade,
        aceitaCarona: aceitaCarona,
        itens: itens,
        atualizadoEm: new Date().toISOString()
      };
    },

    adicionarItem: function(){
      var produto = ((el("arpItemProduto") && el("arpItemProduto").value) || "").trim();
      var qtdTotal = Number((el("arpItemQtdTotal") && el("arpItemQtdTotal").value) || 0);
      var qtdConsumida = Number((el("arpItemQtdConsumida") && el("arpItemQtdConsumida").value) || 0);

      if(!produto){
        showAlert("arpAlert","warn","Informe o Produto do item.");
        if(el("arpItemProduto")) el("arpItemProduto").focus();
        return;
      }
      if(qtdTotal < 0 || qtdConsumida < 0){
        showAlert("arpAlert","warn","Quantidades não podem ser negativas.");
        return;
      }
      if(qtdConsumida > qtdTotal){
        showAlert("arpAlert","warn","Quantidade consumida não pode ser maior que a homologada.");
        return;
      }

      LICSYSTEM.arp.draftItens.push({
        id: "item_"+Date.now()+"_"+Math.floor(Math.random()*999),
        produto: produto,
        qtdTotal: qtdTotal,
        qtdConsumida: qtdConsumida
      });

      if(el("arpItemProduto")) el("arpItemProduto").value = "";
      if(el("arpItemQtdTotal")) el("arpItemQtdTotal").value = "";
      if(el("arpItemQtdConsumida")) el("arpItemQtdConsumida").value = "0";
      LICSYSTEM.arp.renderItens();
      hideAlert("arpAlert");
      if(el("arpItemProduto")) el("arpItemProduto").focus();
    },

    removerItem: function(index){
      if(index < 0 || index >= LICSYSTEM.arp.draftItens.length) return;
      LICSYSTEM.arp.draftItens.splice(index, 1);
      LICSYSTEM.arp.renderItens();
    },

    onEditItem: function(index, field, value){
      var it = LICSYSTEM.arp.draftItens[index];
      if(!it) return;
      if(field === "produto") it.produto = value;
      else it[field] = Number(value) || 0;
      // Recalcula só o saldo da linha no DOM (rápido)
      var row = document.querySelector('#arpItensBody tr[data-i="'+index+'"]');
      if(row){
        var saldo = calcularSaldoAta(it.qtdTotal, it.qtdConsumida);
        var cell = row.querySelector(".arp-saldo");
        if(cell){
          cell.textContent = String(saldo);
          cell.className = "arp-saldo " + (saldo === 0 ? "saldo-esgotado" : "saldo-ok");
        }
        row.classList.toggle("saldo-zero", saldo === 0);
      }
    },

    renderItens: function(){
      var body = el("arpItensBody");
      if(!body) return;
      var itens = LICSYSTEM.arp.draftItens || [];
      if(!itens.length){
        body.innerHTML = '<tr><td colspan="6" class="muted" style="text-align:center;padding:24px">Nenhum item adicionado a esta ata.</td></tr>';
        return;
      }
      var html = "";
      itens.forEach(function(it, i){
        var saldo = calcularSaldoAta(it.qtdTotal, it.qtdConsumida);
        var zero = saldo === 0;
        html += '<tr class="'+(zero?"saldo-zero":"")+'" data-i="'+i+'">'+
          '<td>'+(i+1)+'</td>'+
          '<td><input type="text" data-arp-i="'+i+'" data-arp-f="produto" value="'+utils.escapeHtml(it.produto)+'" /></td>'+
          '<td><input type="number" data-arp-i="'+i+'" data-arp-f="qtdTotal" min="0" step="1" value="'+utils.escapeHtml(it.qtdTotal)+'" /></td>'+
          '<td><input type="number" data-arp-i="'+i+'" data-arp-f="qtdConsumida" min="0" step="1" value="'+utils.escapeHtml(it.qtdConsumida)+'" /></td>'+
          '<td class="arp-saldo '+(zero?"saldo-esgotado":"saldo-ok")+'">'+saldo+'</td>'+
          '<td><button type="button" class="btn btn-ghost btn-sm arpDelItem" data-i="'+i+'">✕</button></td>'+
        '</tr>';
      });
      body.innerHTML = html;
    },

    renderListaSalvas: function(){
      LICSYSTEM.arp.load();
      var box = el("arpListaSalvas");
      if(!box) return;
      var list = LICSYSTEM.arp.atas || [];
      if(!list.length){
        box.innerHTML = '<div class="muted small" style="padding:14px;text-align:center">Nenhuma ARP salva ainda.</div>';
        return;
      }
      var html = "";
      list.slice().reverse().forEach(function(ata){
        var nItens = (ata.itens && ata.itens.length) || 0;
        var saldosZero = 0;
        (ata.itens || []).forEach(function(it){
          if(calcularSaldoAta(it.qtdTotal, it.qtdConsumida) === 0) saldosZero++;
        });
        html += '<div class="entrega-item">'+
          '<div>'+
            '<div class="ei-title">'+utils.escapeHtml(ata.orgaoGerenciador || "Sem órgão")+'</div>'+
            '<div class="ei-meta">'+utils.escapeHtml(ata.numeroPregaoArp || "—")+
              ' · Validade: '+utils.escapeHtml(ata.dataValidade || "—")+
              ' · '+nItens+' item(ns)'+
              (ata.aceitaCarona ? ' · Carona: sim' : '')+
              (saldosZero ? ' · '+saldosZero+' esgotado(s)' : '')+
            '</div>'+
          '</div>'+
          '<div class="cat-actions">'+
            '<button type="button" class="btn btn-ghost btn-sm arpLoad" data-id="'+utils.escapeHtml(ata.id)+'">Abrir</button>'+
            '<button type="button" class="btn btn-ghost btn-sm arpDelAta" data-id="'+utils.escapeHtml(ata.id)+'">✕</button>'+
          '</div>'+
        '</div>';
      });
      box.innerHTML = html;
    },

    renderAll: function(){
      LICSYSTEM.arp.renderItens();
      LICSYSTEM.arp.renderListaSalvas();
    },

    novaAta: function(){
      if(el("arpId")) el("arpId").value = "";
      if(el("arpOrgao")) el("arpOrgao").value = "";
      if(el("arpNumero")) el("arpNumero").value = "";
      if(el("arpValidade")) el("arpValidade").value = "";
      if(el("arpAceitaCarona")) el("arpAceitaCarona").checked = false;
      LICSYSTEM.arp.draftItens = [];
      LICSYSTEM.arp.renderItens();
      hideAlert("arpAlert");
      if(el("arpOrgao")) el("arpOrgao").focus();
    },

    carregarAta: function(id){
      LICSYSTEM.arp.load();
      var ata = null;
      for(var i=0;i<LICSYSTEM.arp.atas.length;i++){
        if(LICSYSTEM.arp.atas[i].id === id){ ata = LICSYSTEM.arp.atas[i]; break; }
      }
      if(!ata) return;
      if(el("arpId")) el("arpId").value = ata.id || "";
      if(el("arpOrgao")) el("arpOrgao").value = ata.orgaoGerenciador || "";
      if(el("arpNumero")) el("arpNumero").value = ata.numeroPregaoArp || "";
      if(el("arpValidade")) el("arpValidade").value = ata.dataValidade || "";
      if(el("arpAceitaCarona")) el("arpAceitaCarona").checked = !!ata.aceitaCarona;
      LICSYSTEM.arp.draftItens = (ata.itens || []).map(function(it){
        return {
          id: it.id,
          produto: it.produto,
          qtdTotal: Number(it.qtdTotal)||0,
          qtdConsumida: Number(it.qtdConsumida)||0
        };
      });
      LICSYSTEM.arp.renderItens();
      showAlert("arpAlert","info","Ata carregada para edição.");
      window.scrollTo(0,0);
    },

    excluirAta: function(id){
      if(!id || !confirm("Excluir esta ARP salva?")) return;
      LICSYSTEM.arp.load();
      LICSYSTEM.arp.atas = LICSYSTEM.arp.atas.filter(function(a){ return a.id !== id; });
      LICSYSTEM.arp.saveLocal();
      // TODO: firebase/firestore delete doc(id)
      if((el("arpId")||{}).value === id) LICSYSTEM.arp.novaAta();
      LICSYSTEM.arp.renderListaSalvas();
      showAlert("arpAlert","ok","ARP excluída.");
    },

    salvarAta: function(){
      var ata = LICSYSTEM.arp.coletarAta();
      if(!ata.orgaoGerenciador){
        showAlert("arpAlert","warn","Informe o Órgão Gerenciador.");
        if(el("arpOrgao")) el("arpOrgao").focus();
        return null;
      }
      if(!ata.numeroPregaoArp){
        showAlert("arpAlert","warn","Informe o Número do Pregão / ARP.");
        return null;
      }
      if(!ata.itens.length){
        showAlert("arpAlert","warn","Adicione ao menos um item à ata.");
        return null;
      }

      if(!ata.criadoEm) ata.criadoEm = new Date().toISOString();

      LICSYSTEM.arp.load();
      var idx = -1;
      for(var i=0;i<LICSYSTEM.arp.atas.length;i++){
        if(LICSYSTEM.arp.atas[i].id === ata.id){ idx = i; break; }
      }
      if(idx >= 0){
        ata.criadoEm = LICSYSTEM.arp.atas[idx].criadoEm || ata.criadoEm;
        LICSYSTEM.arp.atas[idx] = ata;
      } else {
        LICSYSTEM.arp.atas.push(ata);
      }

      if(el("arpId")) el("arpId").value = ata.id;
      LICSYSTEM.arp.saveLocal();
      // TODO Firestore/RTDB:
      // await firestore.collection('arp').doc(ata.id).set(ata)
      // ou utils.firebaseSet('arp/'+ata.id, ata)

      LICSYSTEM.arp.renderListaSalvas();
      showAlert("arpAlert","ok","✅ Ata salva ("+utils.escapeHtml(ata.numeroPregaoArp)+") com "+ata.itens.length+" item(ns).");
      return ata;
    }
  };

  /* ============================ SALA DE DISPUTA ============================ */
  LICSYSTEM.disputa = {
    historico: [],

    num: function(id){
      var n = el(id);
      var v = n ? Number(n.value) : NaN;
      return isFinite(v) ? v : 0;
    },

    /** Atualiza cards de desconto % e margem restante em tempo real (oninput/onchange). */
    atualizarResultados: function(){
      var ref = LICSYSTEM.disputa.num("disputaPrecoRef");
      var degrau = LICSYSTEM.disputa.num("disputaDegrau");
      var lanceConc = LICSYSTEM.disputa.num("disputaLanceConcorrente");
      var custo = LICSYSTEM.disputa.num("disputaMeuCusto");

      // Desconto atual (%) em relação ao preço de referência
      var descontoPct = null;
      if(ref > 0 && lanceConc > 0){
        descontoPct = ((ref - lanceConc) / ref) * 100;
      }
      var elPct = el("disputaDescontoPct");
      var elPctSub = el("disputaDescontoSub");
      if(elPct){
        elPct.textContent = descontoPct == null ? "—" : (descontoPct.toFixed(2).replace(".", ",") + "%");
      }
      if(elPctSub){
        elPctSub.textContent = lanceConc > 0
          ? ("Lance concorrente: " + utils.formatBrl(lanceConc))
          : "Informe o lance do concorrente";
      }

      // Margem restante = preço/lance atual − meu custo
      // Se custo não informado, usa (preço ref − margem implícita) via próprio custo campo
      var margem = null;
      if(lanceConc > 0 && (el("disputaMeuCusto") && String(el("disputaMeuCusto").value || "").trim() !== "")){
        margem = lanceConc - custo;
      }
      var elMarg = el("disputaMargemRestante");
      var elMargSub = el("disputaMargemSub");
      var cardMarg = el("cardMargemRestante");
      if(elMarg){
        elMarg.textContent = margem == null ? "—" : utils.formatBrl(margem);
      }
      if(elMargSub){
        if(margem == null) elMargSub.textContent = "Informe meu custo e o lance atual";
        else if(margem < 0) elMargSub.textContent = "⚠ PARAR — margem negativa / prejuízo";
        else elMargSub.textContent = "Lance atual − meu custo";
      }
      if(cardMarg){
        cardMarg.classList.remove("warn","ok");
        if(margem != null && margem < 0) cardMarg.classList.add("warn");
        else if(margem != null && margem >= 0) cardMarg.classList.add("ok");
      }

      // Próximo lance sugerido = lance concorrente − degrau
      var prox = null;
      if(lanceConc > 0 && degrau >= 0){
        prox = Math.max(0, lanceConc - degrau);
      }
      if(el("disputaMeuProximoLance")){
        el("disputaMeuProximoLance").value = prox == null ? "" : prox.toFixed(2);
      }
    },

    registrarLance: function(){
      LICSYSTEM.disputa.atualizarResultados();
      var degrau = LICSYSTEM.disputa.num("disputaDegrau");
      var lanceConc = LICSYSTEM.disputa.num("disputaLanceConcorrente");
      if(!(lanceConc > 0)){
        showAlert("disputaAlert","warn","Informe o Lance Atual do Concorrente.");
        if(el("disputaLanceConcorrente")) el("disputaLanceConcorrente").focus();
        return;
      }
      var meuLance = Math.max(0, lanceConc - degrau);
      // Atualiza o "lance atual" para o meu lance (próxima rodada)
      if(el("disputaLanceConcorrente")) el("disputaLanceConcorrente").value = meuLance.toFixed(2);

      var agora = new Date();
      var hh = ("0"+agora.getHours()).slice(-2);
      var mm = ("0"+agora.getMinutes()).slice(-2);
      var ss = ("0"+agora.getSeconds()).slice(-2);
      var hora = hh+":"+mm+":"+ss;

      LICSYSTEM.disputa.historico.unshift({
        hora: hora,
        valor: meuLance,
        ts: agora.toISOString()
      });

      LICSYSTEM.disputa.renderHistorico();
      LICSYSTEM.disputa.atualizarResultados();
      hideAlert("disputaAlert");
      showAlert("disputaAlert","ok","Lance registrado: "+utils.formatBrl(meuLance)+" às "+hora);
    },

    renderHistorico: function(){
      var ul = el("disputaHistorico");
      var count = el("disputaHistCount");
      var list = LICSYSTEM.disputa.historico || [];
      if(count) count.textContent = list.length + " registro(s)";
      if(!ul) return;
      if(!list.length){
        ul.innerHTML = '<li class="lh-empty">Nenhum lance registrado ainda.</li>';
        return;
      }
      var html = "";
      list.forEach(function(it, i){
        html += '<li>'+
          '<span class="lh-hora">'+utils.escapeHtml(it.hora)+'</span>'+
          '<span class="lh-val">'+(i===0?"→ ":"")+utils.formatBrl(it.valor)+'</span>'+
        '</li>';
      });
      ul.innerHTML = html;
    },

    limparSessao: function(){
      if(LICSYSTEM.disputa.historico.length && !confirm("Limpar histórico e campos da disputa?")) return;
      LICSYSTEM.disputa.historico = [];
      ["disputaPrecoRef","disputaDegrau","disputaLanceConcorrente","disputaMeuCusto","disputaMeuProximoLance"].forEach(function(id){
        if(el(id)) el(id).value = "";
      });
      LICSYSTEM.disputa.renderHistorico();
      LICSYSTEM.disputa.atualizarResultados();
      hideAlert("disputaAlert");
    }
  };

  /* ============================ HISTÓRICO E CONTROLE DE ENTREGAS ============================ */
  var HIST_ENTREGAS_KEY = "licsystem_hist_entregas_v1";

  function histUid(){
    return "he_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 8);
  }

  function histStatusOf(it){
    var sol = Number(it.qtdSolicitada) || 0;
    var ent = Number(it.qtdEntregue) || 0;
    if(ent <= 0) return "pendente";
    if(ent >= sol && sol > 0) return "concluido";
    return "parcial";
  }

  /**
   * Atualiza "Falta Entregar" ao alterar Qtd Entregue.
   * Se entregue === solicitada, marca a checkbox e destaca a linha.
   */
  function calcularFaltaEntregar(id, qtdEntregueRaw){
    LICSYSTEM.histEntregas.load();
    var item = null;
    for(var i=0;i<LICSYSTEM.histEntregas.items.length;i++){
      if(LICSYSTEM.histEntregas.items[i].id === id){ item = LICSYSTEM.histEntregas.items[i]; break; }
    }
    if(!item) return 0;

    var solicitada = Math.max(0, Number(item.qtdSolicitada) || 0);
    var entregue = Math.max(0, Number(qtdEntregueRaw));
    if(!isFinite(entregue)) entregue = 0;
    if(entregue > solicitada) entregue = solicitada;
    item.qtdEntregue = entregue;

    var falta = Math.max(0, solicitada - entregue);
    item.concluido = (solicitada > 0 && entregue >= solicitada);

    var row = document.querySelector('tr[data-hist-row="'+id+'"]');
    if(row){
      var faltaCell = row.querySelector(".hist-falta");
      if(faltaCell){
        faltaCell.textContent = String(falta);
        faltaCell.classList.toggle("zero", falta === 0 && solicitada > 0);
      }
      var chk = row.querySelector(".hist-check");
      if(chk) chk.checked = !!item.concluido;
      var lbl = row.querySelector(".hist-check-label");
      if(lbl) lbl.textContent = item.concluido ? "Concluído" : (entregue > 0 ? "Parcial" : "Pendente");
      row.classList.toggle("hist-done", !!item.concluido);
      var qInp = row.querySelector('input[data-hist-f="qtdEntregue"]');
      if(qInp && String(qInp.value) !== String(entregue)) qInp.value = entregue;
    }

    LICSYSTEM.histEntregas.saveLocal();
    calcularResumoFinanceiro();
    return falta;
  }

  /**
   * Multiplica Qtd Entregue × Custo/Venda e atualiza os cards do topo.
   * Card 4: soma das unidades ainda pendentes (lista filtrada).
   */
  function calcularResumoFinanceiro(){
    LICSYSTEM.histEntregas.load();
    var list = LICSYSTEM.histEntregas.filtrados();
    var totalVendido = 0;
    var custoTotal = 0;
    var pendentes = 0;

    for(var i=0;i<list.length;i++){
      var it = list[i];
      var ent = Math.max(0, Number(it.qtdEntregue) || 0);
      var sol = Math.max(0, Number(it.qtdSolicitada) || 0);
      var custo = Math.max(0, Number(it.custoUn) || 0);
      var venda = Math.max(0, Number(it.vendaUn) || 0);
      totalVendido += ent * venda;
      custoTotal += ent * custo;
      pendentes += Math.max(0, sol - ent);
    }

    var lucro = totalVendido - custoTotal;
    if(el("histTotalVendido")) el("histTotalVendido").textContent = utils.formatBrl(totalVendido);
    if(el("histCustoTotal")) el("histCustoTotal").textContent = utils.formatBrl(custoTotal);
    if(el("histLucroBruto")) el("histLucroBruto").textContent = utils.formatBrl(lucro);
    if(el("histPendentes")) el("histPendentes").textContent = String(pendentes);
    return { totalVendido: totalVendido, custoTotal: custoTotal, lucroBruto: lucro, pendentes: pendentes };
  }

  window.calcularFaltaEntregar = calcularFaltaEntregar;
  window.calcularResumoFinanceiro = calcularResumoFinanceiro;

  LICSYSTEM.histEntregas = {
    items: [],
    _loaded: false,
    filtroTexto: "",
    filtroStatus: "todos",

    exemplos: function(){
      return [
        { id: histUid(), empenho: "Pref. Ibaiti — 2026/001", produto: "Abraçadeira Borboleta 12–20mm (kit 10)", qtdSolicitada: 50, qtdEntregue: 20, custoUn: 8.5, vendaUn: 14.9, concluido: false },
        { id: histUid(), empenho: "Pref. Ibaiti — 2026/001", produto: "Furadeira de Impacto 750W", qtdSolicitada: 12, qtdEntregue: 12, custoUn: 189, vendaUn: 279, concluido: true },
        { id: histUid(), empenho: "Câmara Jacarezinho — NE 2026/088", produto: "Trena Laser 40m", qtdSolicitada: 8, qtdEntregue: 0, custoUn: 95, vendaUn: 149.9, concluido: false },
        { id: histUid(), empenho: "Pref. Santo Antônio — PE 014/2026", produto: "Parafusadeira 12V + kit bits", qtdSolicitada: 25, qtdEntregue: 10, custoUn: 210, vendaUn: 329, concluido: false },
        { id: histUid(), empenho: "Consórcio Norte Pioneiro — ARP 03/2026", produto: "Disco de Corte 4.1/2\" (cx 25)", qtdSolicitada: 40, qtdEntregue: 40, custoUn: 42, vendaUn: 68, concluido: true }
      ];
    },

    load: function(){
      if(LICSYSTEM.histEntregas._loaded) return LICSYSTEM.histEntregas.items;
      try{
        var raw = localStorage.getItem(HIST_ENTREGAS_KEY);
        if(raw != null){
          var saved = JSON.parse(raw);
          LICSYSTEM.histEntregas.items = Array.isArray(saved) ? saved : [];
        } else {
          LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.exemplos();
          LICSYSTEM.histEntregas.saveLocal();
        }
      }catch(e){
        LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.exemplos();
      }
      LICSYSTEM.histEntregas._loaded = true;
      return LICSYSTEM.histEntregas.items;
    },

    saveLocal: function(){
      try{
        localStorage.setItem(HIST_ENTREGAS_KEY, JSON.stringify(LICSYSTEM.histEntregas.items || []));
        if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.notifyLocalChange("histEntregas");
      }catch(e){}
      // TODO Firestore: collection('historico_entregas').doc(id).set(item, { merge:true })
    },

    carregarExemplos: function(force){
      if(force && !confirm("Substituir a lista atual pelos exemplos de demonstração?")) return;
      LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.exemplos();
      LICSYSTEM.histEntregas._loaded = true;
      LICSYSTEM.histEntregas.saveLocal();
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Exemplos carregados.");
    },

    filtrados: function(){
      LICSYSTEM.histEntregas.load();
      var q = utils.fold(LICSYSTEM.histEntregas.filtroTexto || "").toLowerCase().trim();
      var st = LICSYSTEM.histEntregas.filtroStatus || "todos";
      return LICSYSTEM.histEntregas.items.filter(function(it){
        var status = histStatusOf(it);
        if(st !== "todos" && status !== st) return false;
        if(!q) return true;
        var blob = utils.fold((it.empenho||"")+" "+(it.produto||"")).toLowerCase();
        return blob.indexOf(q) !== -1;
      });
    },

    aplicarFiltros: function(){
      LICSYSTEM.histEntregas.filtroTexto = (el("histBusca") && el("histBusca").value) || "";
      LICSYSTEM.histEntregas.filtroStatus = (el("histStatus") && el("histStatus").value) || "todos";
      LICSYSTEM.histEntregas.renderTabela();
      calcularResumoFinanceiro();
    },

    find: function(id){
      LICSYSTEM.histEntregas.load();
      for(var i=0;i<LICSYSTEM.histEntregas.items.length;i++){
        if(LICSYSTEM.histEntregas.items[i].id === id) return LICSYSTEM.histEntregas.items[i];
      }
      return null;
    },

    onEdit: function(id, field, value){
      var item = LICSYSTEM.histEntregas.find(id);
      if(!item) return;
      if(field === "empenho" || field === "produto"){
        item[field] = String(value || "");
      } else if(field === "qtdSolicitada"){
        var sol = Math.max(0, Number(value) || 0);
        item.qtdSolicitada = sol;
        if((Number(item.qtdEntregue)||0) > sol) item.qtdEntregue = sol;
        calcularFaltaEntregar(id, item.qtdEntregue);
        return;
      } else if(field === "custoUn" || field === "vendaUn"){
        item[field] = Math.max(0, Number(value) || 0);
        LICSYSTEM.histEntregas.saveLocal();
        calcularResumoFinanceiro();
        return;
      }
      LICSYSTEM.histEntregas.saveLocal();
    },

    toggleConcluido: function(id, checked){
      var item = LICSYSTEM.histEntregas.find(id);
      if(!item) return;
      var sol = Math.max(0, Number(item.qtdSolicitada) || 0);
      if(checked){
        calcularFaltaEntregar(id, sol);
      } else {
        var atual = Math.max(0, Number(item.qtdEntregue) || 0);
        var novo = atual >= sol ? Math.max(0, sol - 1) : atual;
        calcularFaltaEntregar(id, novo);
      }
    },

    adicionarItem: function(){
      LICSYSTEM.histEntregas.load();
      LICSYSTEM.histEntregas.items.unshift({
        id: histUid(),
        empenho: "",
        produto: "",
        qtdSolicitada: 1,
        qtdEntregue: 0,
        custoUn: 0,
        vendaUn: 0,
        concluido: false
      });
      LICSYSTEM.histEntregas.saveLocal();
      if(el("histStatus")) el("histStatus").value = "todos";
      LICSYSTEM.histEntregas.filtroStatus = "todos";
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Linha adicionada — preencha empenho, produto e quantidades.");
    },

    remover: function(id){
      if(!confirm("Remover este item do histórico?")) return;
      LICSYSTEM.histEntregas.load();
      LICSYSTEM.histEntregas.items = LICSYSTEM.histEntregas.items.filter(function(it){ return it.id !== id; });
      LICSYSTEM.histEntregas.saveLocal();
      LICSYSTEM.histEntregas.render();
      showAlert("histEntregasAlert","ok","Item removido.");
    },

    render: function(){
      if(el("histBusca")) LICSYSTEM.histEntregas.filtroTexto = el("histBusca").value || "";
      if(el("histStatus")) LICSYSTEM.histEntregas.filtroStatus = el("histStatus").value || "todos";
      LICSYSTEM.histEntregas.load();
      LICSYSTEM.histEntregas.renderTabela();
      calcularResumoFinanceiro();
    },

    renderTabela: function(){
      var body = el("histEntregasBody");
      if(!body) return;
      var list = LICSYSTEM.histEntregas.filtrados();
      if(!list.length){
        body.innerHTML = '<tr><td colspan="9" class="muted small" style="text-align:center;padding:22px">Nenhum item encontrado com os filtros atuais.</td></tr>';
        return;
      }
      var html = "";
      for(var i=0;i<list.length;i++){
        var it = list[i];
        var sol = Math.max(0, Number(it.qtdSolicitada) || 0);
        var ent = Math.max(0, Number(it.qtdEntregue) || 0);
        var falta = Math.max(0, sol - ent);
        var done = sol > 0 && ent >= sol;
        var st = histStatusOf(it);
        var stLabel = st === "concluido" ? "Concluído" : (st === "parcial" ? "Parcial" : "Pendente");
        html +=
          '<tr data-hist-row="'+utils.escapeHtml(it.id)+'" class="'+(done?"hist-done":"")+'">'+
            '<td><input type="text" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="empenho" value="'+utils.escapeHtml(it.empenho||"")+'" placeholder="ex.: Pref. Ibaiti — 2026/001" /></td>'+
            '<td><input type="text" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="produto" value="'+utils.escapeHtml(it.produto||"")+'" placeholder="Nome do item" /></td>'+
            '<td><input class="hist-qtd" type="number" min="0" step="1" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="qtdSolicitada" value="'+sol+'" /></td>'+
            '<td><input class="hist-qtd" type="number" min="0" step="1" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="qtdEntregue" value="'+ent+'" /></td>'+
            '<td class="hist-falta'+(falta===0 && sol>0?" zero":"")+'">'+falta+'</td>'+
            '<td><input class="hist-money" type="number" min="0" step="0.01" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="custoUn" value="'+(Number(it.custoUn)||0)+'" /></td>'+
            '<td><input class="hist-money" type="number" min="0" step="0.01" data-hist-id="'+utils.escapeHtml(it.id)+'" data-hist-f="vendaUn" value="'+(Number(it.vendaUn)||0)+'" /></td>'+
            '<td><div class="hist-check-wrap">'+
              '<input class="hist-check" type="checkbox" data-hist-id="'+utils.escapeHtml(it.id)+'" '+(done?"checked":"")+' aria-label="Marcar como concluído" />'+
              '<span class="hist-check-label">'+stLabel+'</span>'+
            '</div></td>'+
            '<td><button type="button" class="btn btn-ghost btn-sm histDel" data-hist-id="'+utils.escapeHtml(it.id)+'" title="Remover">🗑</button></td>'+
          '</tr>';
      }
      body.innerHTML = html;
    }
  };

  /* ============================ ANÁLISE INTELIGENTE DE EDITAIS (IA) ============================ */
  LICSYSTEM.analiseIa = {
    file: null,
    text: "",
    relatorioMd: "",
    documentosExigidos: [],
    busy: false,
    MAX_PAGES: 45,
    MAX_CHARS: 150000,

    setBusy: function(on){
      LICSYSTEM.analiseIa.busy = !!on;
      var btn = el("btnIaAnalisar");
      if(btn){
        btn.disabled = !!on;
        btn.textContent = on ? "Analisando…" : "✨ Analisar com IA";
      }
      var prog = el("iaProgress");
      if(prog){
        prog.classList.toggle("show", !!on);
        prog.setAttribute("aria-hidden", on ? "false" : "true");
      }
    },

    setActionButtons: function(enabled){
      var c = el("btnIaCopiar");
      var p = el("btnIaImprimir");
      var d = el("btnIaDocs");
      var part = el("btnIaParticipar");
      if(c) c.disabled = !enabled;
      if(p) p.disabled = !enabled;
      if(d) d.disabled = !enabled;
      if(part) part.disabled = !enabled;
    },

    limparRelatorio: function(){
      LICSYSTEM.analiseIa.relatorioMd = "";
      LICSYSTEM.analiseIa.documentosExigidos = [];
      var sheet = el("iaReportSheet");
      if(sheet){
        sheet.className = "ia-report-sheet ia-empty";
        sheet.innerHTML = "O relatório da análise aparecerá aqui após processar o edital.";
      }
      LICSYSTEM.analiseIa.setActionButtons(false);
    },

    limpar: function(){
      LICSYSTEM.analiseIa.file = null;
      LICSYSTEM.analiseIa.text = "";
      LICSYSTEM.analiseIa._pendingParticiparAsk = false;
      var inp = el("iaPdfFile");
      if(inp) inp.value = "";
      var meta = el("iaFileMeta");
      if(meta){ meta.className = "ia-file-meta"; meta.textContent = ""; }
      LICSYSTEM.analiseIa.limparRelatorio();
      hideAlert("iaAlert");
      LICSYSTEM.analiseIa.setBusy(false);
      try{ LICSYSTEM.leiloesParticipo.closeParticiparModal(); }catch(e){}
    },

    normDocsList: function(list){
      if(!Array.isArray(list)) return [];
      var out = [];
      var seen = {};
      list.forEach(function(item){
        if(!item) return;
        var nome = typeof item === "string"
          ? item.trim()
          : String(item.nome || item.name || item.documento || "").trim();
        if(!nome || nome.length < 2) return;
        var key = nome.toLowerCase().replace(/\s+/g, " ");
        if(seen[key]) return;
        seen[key] = true;
        out.push({
          nome: nome.slice(0, 220),
          tipo: LICSYSTEM.docsChecklist.normTipo(item.tipo || item.type || "outro"),
          obs: String(item.obs || item.observacao || "").trim().slice(0, 400)
        });
      });
      return out.slice(0, 80);
    },

    /** Fallback: tenta ler listas do Markdown (habilitação / checklist). */
    parseDocsFromMarkdown: function(md){
      var text = String(md || "");
      if(!text.trim()) return [];
      var lines = text.split(/\r?\n/);
      var collecting = false;
      var tipoAtual = "habilitacao";
      var items = [];
      var sectionRe = /^(#{1,4}\s*)?(\d+\.\s*)?(exig[eê]ncias?\s+de\s+habilita|habilita[cç][aã]o|checklist\s+final|documentos?\s+exig|qualifica[cç][aã]o\s+t[eé]cnica)/i;
      var stopRe = /^(#{1,4}\s*)?(\d+\.\s*)?(informa[cç][oõ]es\s+gerais|cronograma|especifica[cç]|regras\s+de\s+proposta|crit[eé]rios|penalidades|condi[cç][oõ]es\s+de\s+entrega|contrato\s+ou\s+ata|resumo\s+simples)/i;

      for(var i = 0; i < lines.length; i++){
        var line = lines[i].trim();
        if(!line) continue;
        if(sectionRe.test(line)){
          collecting = true;
          if(/t[eé]cnica/i.test(line)) tipoAtual = "tecnica";
          else if(/checklist/i.test(line)) tipoAtual = "outro";
          else tipoAtual = "habilitacao";
          continue;
        }
        if(collecting && stopRe.test(line)){
          collecting = false;
          continue;
        }
        if(!collecting) continue;
        var m = line.match(/^[-*•]\s+(.+)/) || line.match(/^\d+[.)]\s+(.+)/);
        if(!m) continue;
        var nome = String(m[1] || "")
          .replace(/\*\*/g, "")
          .replace(/`/g, "")
          .replace(/\s+/g, " ")
          .trim();
        // Evita bullets genéricos muito longos (parágrafos)
        if(nome.length < 4 || nome.length > 180) continue;
        if(/^(os|as|o|a|de|da|do)\s/i.test(nome) && nome.length > 120) continue;
        items.push({ nome: nome, tipo: tipoAtual, obs: "Extraído do relatório" });
      }
      return LICSYSTEM.analiseIa.normDocsList(items);
    },

    openDocsModal: function(){
      var docs = LICSYSTEM.analiseIa.documentosExigidos || [];
      if(!docs.length && LICSYSTEM.analiseIa.relatorioMd){
        docs = LICSYSTEM.analiseIa.parseDocsFromMarkdown(LICSYSTEM.analiseIa.relatorioMd);
        LICSYSTEM.analiseIa.documentosExigidos = docs;
      }
      var filename = (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
      LICSYSTEM.docsChecklist.showModal(docs, {
        filename: filename,
        editalNome: filename ? filename.replace(/\.pdf$/i, "") : "Edital analisado"
      });
    },

    renderRelatorio: function(md){
      var sheet = el("iaReportSheet");
      if(!sheet) return;
      var raw = String(md || "").trim();
      LICSYSTEM.analiseIa.relatorioMd = raw;
      if(!raw){
        LICSYSTEM.analiseIa.limparRelatorio();
        return;
      }
      var html = "";
      try{
        if(window.marked && typeof window.marked.parse === "function"){
          html = window.marked.parse(raw);
        } else if(window.marked && typeof window.marked === "function"){
          html = window.marked(raw);
        } else {
          html = "<pre style='white-space:pre-wrap;font-family:inherit'>"+utils.escapeHtml(raw)+"</pre>";
        }
      }catch(e){
        html = "<pre style='white-space:pre-wrap;font-family:inherit'>"+utils.escapeHtml(raw)+"</pre>";
      }
      sheet.className = "ia-report-sheet";
      sheet.innerHTML = html;
      LICSYSTEM.analiseIa.setActionButtons(true);
    },

    copiarRelatorio: function(){
      var md = LICSYSTEM.analiseIa.relatorioMd || "";
      if(!md){
        showAlert("iaAlert","warn","Não há relatório para copiar.");
        return;
      }
      var done = function(){
        showAlert("iaAlert","ok","Relatório copiado para a área de transferência.");
      };
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(md).then(done).catch(function(){
          var ta = document.createElement("textarea");
          ta.value = md;
          document.body.appendChild(ta);
          ta.select();
          try{ document.execCommand("copy"); done(); }
          catch(e){ showAlert("iaAlert","error","Não foi possível copiar."); }
          document.body.removeChild(ta);
        });
      } else {
        showAlert("iaAlert","warn","Copiar não disponível neste navegador.");
      }
    },

    imprimirRelatorio: function(){
      if(!LICSYSTEM.analiseIa.relatorioMd){
        showAlert("iaAlert","warn","Não há relatório para imprimir.");
        return;
      }
      try{ window.print(); }catch(e){
        showAlert("iaAlert","error","Falha ao abrir impressão.");
      }
    },

    errMsg: function(err){
      if(!err) return "Erro desconhecido";
      if(typeof err === "string") return err;
      if(err.message && typeof err.message === "string") return err.message;
      try{ return JSON.stringify(err); }catch(e){ return String(err); }
    },

    onFile: function(file){
      if(!file) return;
      if(file.type && file.type !== "application/pdf" && !/\.pdf$/i.test(file.name||"")){
        showAlert("iaAlert","warn","Selecione um arquivo PDF.");
        return;
      }
      LICSYSTEM.analiseIa.file = file;
      LICSYSTEM.analiseIa.text = "";
      LICSYSTEM.analiseIa.limparRelatorio();
      LICSYSTEM.analiseIa.setBusy(false);
      var meta = el("iaFileMeta");
      if(meta){
        var kb = (file.size / 1024).toFixed(1);
        meta.className = "ia-file-meta show";
        meta.textContent = "Arquivo: " + file.name + " (" + kb + " KB) — clique em Analisar com IA.";
      }
      hideAlert("iaAlert");
    },

    extrairTextoPdf: function(file){
      var maxPages = LICSYSTEM.analiseIa.MAX_PAGES;
      var maxChars = LICSYSTEM.analiseIa.MAX_CHARS;

      return utils.ensurePdfJs().then(function(){
        return new Promise(function(resolve, reject){
          var reader = new FileReader();
          reader.onerror = function(){ reject(new Error("Falha ao ler o arquivo PDF.")); };
          reader.onload = function(){
            try{ resolve(new Uint8Array(reader.result)); }
            catch(e){ reject(e); }
          };
          reader.readAsArrayBuffer(file);
        });
      }).then(function(data){
        return window.pdfjsLib.getDocument({ data: data }).promise;
      }).then(function(pdf){
        var total = pdf.numPages || 0;
        var limit = Math.min(total, maxPages);
        var pages = [];
        var i = 1;

        function next(){
          if(i > limit){
            var joined = pages.join("\n\n");
            if(total > limit){
              joined += "\n\n[... truncado: lidas "+limit+" de "+total+" páginas ...]";
            }
            return Promise.resolve(joined);
          }
          showAlert(
            "iaAlert",
            "info",
            '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Extraindo texto… página '+i+' de '+limit+(total>limit?' (edital tem '+total+')':'')+'…'
          );
          return pdf.getPage(i).then(function(page){
            return page.getTextContent().then(function(tc){
              var line = (tc.items || []).map(function(it){ return it.str || ""; }).join(" ");
              pages.push(line);
              var soFar = pages.join("\n\n");
              i++;
              if(soFar.length >= maxChars){
                return soFar.slice(0, maxChars) + "\n\n[... texto truncado para análise ...]";
              }
              return next();
            });
          });
        }
        return next();
      });
    },

    analisar: function(){
      if(LICSYSTEM.analiseIa.busy) return;
      var file = LICSYSTEM.analiseIa.file;
      if(!file){
        showAlert("iaAlert","warn","Selecione o PDF do edital primeiro.");
        return;
      }

      LICSYSTEM.analiseIa.setBusy(true);
      LICSYSTEM.analiseIa.limparRelatorio();
      showAlert("iaAlert","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Carregando PDF e extraindo texto…');

      LICSYSTEM.analiseIa.extrairTextoPdf(file).then(function(text){
        text = String(text || "").replace(/\s+/g, " ").trim();
        if(!text || text.length < 40){
          throw new Error("Não foi possível extrair texto suficiente deste PDF (pode ser imagem escaneada).");
        }
        LICSYSTEM.analiseIa.text = text;
        showAlert(
          "iaAlert",
          "info",
          '<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Texto extraído ('+text.length+' caracteres). Gerando relatório com a IA…'
        );

        return fetch("/api/analyze-pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            text: text,
            filename: file.name || "edital.pdf"
          })
        }).then(function(res){
          return res.text().then(function(raw){
            var body = null;
            try{ body = raw ? JSON.parse(raw) : null; }catch(e){
              throw new Error("Resposta inválida da API (HTTP "+res.status+").");
            }
            if(!res.ok){
              var msg = (body && (body.detail || body.error)) || ("Erro HTTP " + res.status);
              throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
            }
            return body;
          });
        });
      }).then(function(body){
        var md = (body && body.relatorio) || "";
        if(!md) throw new Error("A API não retornou o campo relatorio.");
        var docs = LICSYSTEM.analiseIa.normDocsList(body && body.documentosExigidos);
        if(!docs.length){
          docs = LICSYSTEM.analiseIa.parseDocsFromMarkdown(md);
        }
        LICSYSTEM.analiseIa.documentosExigidos = docs;
        LICSYSTEM.analiseIa.renderRelatorio(md);
        var n = docs.length;
        showAlert(
          "iaAlert",
          "ok",
          "✅ Relatório gerado com sucesso." +
            (n ? (" " + n + " documento" + (n === 1 ? "" : "s") + " exigido" + (n === 1 ? "" : "s") + " identificado" + (n === 1 ? "" : "s") + ".") : "")
        );
        var filename = (LICSYSTEM.analiseIa.file && LICSYSTEM.analiseIa.file.name) || "";
        var meta = {
          filename: filename,
          editalNome: filename ? filename.replace(/\.pdf$/i, "") : "Edital analisado"
        };
        // Já grava o checklist (mesmo se o usuário fechar o modal)
        if(docs.length){
          try{ LICSYSTEM.docsChecklist.setFromAnalysis(docs, meta); }catch(e){}
        }
        // Após fechar o modal de documentos, pergunta "Vamos participar?"
        LICSYSTEM.analiseIa._pendingParticiparAsk = true;
        // Modal pós-análise com lista + atalho para marcar OK
        setTimeout(function(){
          LICSYSTEM.docsChecklist.showModal(docs, meta);
        }, 120);
      }).catch(function(err){
        showAlert("iaAlert","error", utils.escapeHtml(LICSYSTEM.analiseIa.errMsg(err)));
      }).then(function(){
        LICSYSTEM.analiseIa.setBusy(false);
      });
    },

    wire: function(){
      var drop = el("iaDrop");
      var inp = el("iaPdfFile");
      if(drop && inp){
        drop.addEventListener("click", function(){ inp.click(); });
        drop.addEventListener("keydown", function(e){
          if(e.key === "Enter" || e.key === " "){ e.preventDefault(); inp.click(); }
        });
        ["dragenter","dragover"].forEach(function(ev){
          drop.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            drop.classList.add("drag");
          });
        });
        ["dragleave","drop"].forEach(function(ev){
          drop.addEventListener(ev, function(e){
            e.preventDefault(); e.stopPropagation();
            drop.classList.remove("drag");
          });
        });
        drop.addEventListener("drop", function(e){
          var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
          if(f) LICSYSTEM.analiseIa.onFile(f);
        });
        inp.addEventListener("change", function(){
          if(this.files && this.files[0]) LICSYSTEM.analiseIa.onFile(this.files[0]);
        });
      }
    }
  };

  /* ============================ AUTH (Firebase) ============================ */
  LICSYSTEM.auth = {
    _booted: false,
    _ready: false,

    mapError: function(err){
      var code = (err && err.code) || "";
      var map = {
        "auth/invalid-email": "E-mail inválido.",
        "auth/user-disabled": "Usuário desativado.",
        "auth/user-not-found": "Usuário não encontrado. Crie o usuário no Firebase Console.",
        "auth/wrong-password": "Senha incorreta.",
        "auth/invalid-credential": "E-mail ou senha incorretos.",
        "auth/operation-not-allowed": "Ative o provedor E-mail/senha no Firebase Console → Authentication.",
        "auth/too-many-requests": "Muitas tentativas. Aguarde e tente de novo.",
        "auth/network-request-failed": "Falha de rede. Verifique a conexão.",
        "auth/unauthorized-domain": "Domínio não autorizado. Em Authentication → Settings → Authorized domains, adicione localhost.",
        "auth/requests-from-referer-http://localhost:5173-are-blocked.": "API Key bloqueando localhost. No Google Cloud → Credenciais → restrições HTTP, inclua http://localhost/*",
        "auth/requests-from-referer-http://localhost:5174-are-blocked.": "API Key bloqueando localhost. No Google Cloud → Credenciais → restrições HTTP, inclua http://localhost/*"
      };
      if(code && /requests-from-referer/i.test(code)){
        return "Firebase bloqueou este endereço local (referer). Use http://localhost:5173 e, no Google Cloud → APIs e serviços → Credenciais → sua API Key, em restrições de site HTTP, adicione: http://localhost/* e http://127.0.0.1/*";
      }
      return map[code] || ((err && err.message) ? err.message : "Falha na autenticação.");
    },

    beginChecking: function(){
      document.body.classList.remove("auth-locked");
      document.body.classList.add("auth-checking");
      var btn = el("btnLogout");
      if(btn) btn.style.display = "none";
    },

    lock: function(){
      document.body.classList.remove("auth-checking");
      document.body.classList.add("auth-locked");
      var btn = el("btnLogout");
      if(btn) btn.style.display = "none";
    },

    unlock: function(user){
      document.body.classList.remove("auth-checking");
      document.body.classList.remove("auth-locked");
      LICSYSTEM.state.authUser = user || null;
      var email = (user && user.email) || "";
      var name = email ? email.split("@")[0] : "LICSYSTEM";
      if(el("topUserName")) el("topUserName").textContent = name;
      if(el("topUserEmail")) el("topUserEmail").textContent = email || "Setor de Licitações";
      var btn = el("btnLogout");
      if(btn) btn.style.display = "";
    },

    requireAuth: function(){
      return !!(LICSYSTEM.state.authUser && LICSYSTEM.state.authUser.uid);
    },

    login: function(email, pass){
      return utils.ensureFirebaseAuth().then(function(fb){
        var authCall = fb.auth().signInWithEmailAndPassword(email, pass);
        var timeout = new Promise(function(_, reject){
          setTimeout(function(){
            reject(new Error("Tempo esgotado ao validar no Firebase. Verifique a internet e se o domínio localhost está autorizado no Firebase Authentication → Settings → Authorized domains."));
          }, 20000);
        });
        return Promise.race([authCall, timeout]);
      });
    },

    logout: function(){
      return utils.ensureFirebaseAuth().then(function(fb){
        return fb.auth().signOut();
      }).then(function(){
        try{ if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.onLogout(); }catch(e){}
        LICSYSTEM.state.authUser = null;
        LICSYSTEM.auth.lock();
        showAlert("authAlert","ok","Você saiu do sistema.");
      }).catch(function(err){
        showAlert("authAlert","error", utils.escapeHtml(LICSYSTEM.auth.mapError(err)));
      });
    },

    onSubmit: function(ev){
      if(ev) ev.preventDefault();
      var email = ((el("authEmail") && el("authEmail").value) || "").trim();
      var pass = (el("authPass") && el("authPass").value) || "";
      if(!email || !pass){
        showAlert("authAlert","warn","Preencha e-mail e senha.");
        return;
      }
      if(pass.length < 6){
        showAlert("authAlert","warn","A senha deve ter no mínimo 6 caracteres.");
        return;
      }
      if(!utils.hasFirebaseConfig()){
        showAlert("authAlert","error",
          "Firebase não configurado neste PC. Crie o arquivo <b>.env</b> com as chaves VITE_FIREBASE_* e reinicie <code>npm run dev</code>."
        );
        return;
      }
      var btn = el("authSubmit");
      if(btn){ btn.disabled = true; btn.textContent = "Aguarde…"; }
      showAlert("authAlert","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Validando…');

      LICSYSTEM.auth.login(email, pass).then(function(cred){
        hideAlert("authAlert");
        if(el("authPass")) el("authPass").value = "";
        var user = cred && cred.user ? cred.user : (cred || null);
        if(user){
          LICSYSTEM.auth.unlock(user);
          if(!LICSYSTEM.auth._booted){
            LICSYSTEM.auth._booted = true;
            // garante app montado mesmo se onAuthStateChanged atrasar
            if(typeof LICSYSTEM.auth._onReady === "function"){
              LICSYSTEM.auth._onReady(user);
              LICSYSTEM.auth._onReady = null;
            }
          }
        }
      }).catch(function(err){
        var msg = LICSYSTEM.auth.mapError(err);
        if(/firebase-config-vazio|não configurado|Firebase não configurado/i.test(String((err && err.message) || ""))){
          msg = "Firebase não configurado. Preencha o .env (VITE_FIREBASE_*) e reinicie o servidor local.";
        }
        showAlert("authAlert","error", utils.escapeHtml(msg));
      }).then(function(){
        if(btn){ btn.disabled = false; btn.textContent = "Entrar"; }
      });
    },

    wire: function(){
      var form = el("authForm");
      if(form) form.addEventListener("submit", LICSYSTEM.auth.onSubmit);
      var out = el("btnLogout");
      if(out) out.addEventListener("click", function(){
        if(confirm("Sair do LICSYSTEM?")) LICSYSTEM.auth.logout();
      });
    },

    start: function(onReady){
      LICSYSTEM.auth.wire();
      // Não mostra login até o Firebase dizer se há sessão (evita flash no F5)
      LICSYSTEM.auth.beginChecking();
      LICSYSTEM.auth._onReady = onReady;

      if(!utils.hasFirebaseConfig()){
        LICSYSTEM.auth.lock();
        showAlert("authAlert","warn",
          "Firebase local sem chaves. Crie/atualize o <b>.env</b> e reinicie <code>npm run dev</code>."
        );
        return Promise.reject(new Error("firebase-config-vazio"));
      }

      return utils.ensureFirebaseAuth().then(function(fb){
        return new Promise(function(resolve){
          var first = true;
          fb.auth().onAuthStateChanged(function(user){
            if(user){
              LICSYSTEM.auth.unlock(user);
              if(!LICSYSTEM.auth._booted){
                LICSYSTEM.auth._booted = true;
                if(typeof LICSYSTEM.auth._onReady === "function"){
                  LICSYSTEM.auth._onReady(user);
                  LICSYSTEM.auth._onReady = null;
                }
              } else {
                try{ if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.onUser(user); }catch(e){}
              }
            } else {
              try{ if(LICSYSTEM.cloudSync) LICSYSTEM.cloudSync.onLogout(); }catch(e){}
              LICSYSTEM.state.authUser = null;
              LICSYSTEM.auth.lock();
            }
            if(first){
              first = false;
              LICSYSTEM.auth._ready = true;
              resolve(user || null);
            }
          });
        });
      }).catch(function(err){
        LICSYSTEM.auth.lock();
        var msg = (err && err.message) ? err.message : (typeof err === "string" ? err : "erro desconhecido");
        try{ if(typeof msg !== "string") msg = JSON.stringify(msg); }catch(e){ msg = String(err); }
        showAlert("authAlert","error",
          "Não foi possível carregar o Firebase Auth: "+utils.escapeHtml(msg)+
          "<br/><span class=\"small\">Confira o arquivo .env (VITE_FIREBASE_*) e reinicie o Vite. No Firebase, Authorization domains deve incluir <b>localhost</b>.</span>"
        );
        throw err;
      });
    }
  };

  /* ============================ BOOT ============================ */
  function bootApp(){
    wire();
    LICSYSTEM.captacao.initUf();
    LICSYSTEM.captacao.initProximos();
    LICSYSTEM.captacao.initChatEditais();
    LICSYSTEM.captacao.initCardCollapse();
    LICSYSTEM.orcamento.load();
    try{ if(LICSYSTEM.alertas) LICSYSTEM.alertas.load(); }catch(e){}
    LICSYSTEM.state._orcDirty = true;
    LICSYSTEM.state._orcRendered = false;
    LICSYSTEM.state._dashReady = false;
    LICSYSTEM.state._cofreRendered = false;
    LICSYSTEM.updateBell();
    LICSYSTEM.state.currentView = "dashboard";

    // Flush orçamento ao fechar/ocultar a aba (debounce pendente não se perde)
    if(!LICSYSTEM._orcPersistWired){
      LICSYSTEM._orcPersistWired = true;
      window.addEventListener("beforeunload", function(){
        try{ LICSYSTEM.orcamento.flushSave(); }catch(e){}
      });
      document.addEventListener("visibilitychange", function(){
        if(document.visibilityState === "hidden"){
          try{ LICSYSTEM.orcamento.flushSave(); }catch(e){}
        }
      });
    }

    // UI primeiro; pesado depois (não trava a abertura)
    requestAnimationFrame(function(){
      LICSYSTEM.dashboard.render();
      LICSYSTEM.state._dashReady = true;
      LICSYSTEM.cofre.load();
      LICSYSTEM.cofre.render();
      LICSYSTEM.state._cofreRendered = true;
      LICSYSTEM.docsChecklist.load();
      LICSYSTEM.leiloesParticipo.load();
      LICSYSTEM.entregas.load();
      // Restaura última tela após F5 (localStorage)
      var lastView = "dashboard";
      try{ lastView = localStorage.getItem(LAST_VIEW_KEY) || "dashboard"; }catch(e){}
      if(lastView && lastView !== "dashboard" && typeof window.__lsActivateView === "function"){
        // skipEnsureGroup: keep all nav accordions collapsed after F5
        window.__lsActivateView(lastView, { skipEnsureGroup: true });
      } else {
        LICSYSTEM.state.currentView = "dashboard";
      }
      // Orçamento só monta quando abrir a aba (planilha grande)
      setTimeout(function(){
        LICSYSTEM.ferramentas.getPerfil(true).catch(function(){});
        // Database + sync na nuvem (por conta)
        utils.ensureFirebase().then(function(){
          if(LICSYSTEM.state.authUser && LICSYSTEM.cloudSync){
            return LICSYSTEM.cloudSync.onUser(LICSYSTEM.state.authUser);
          }
        }).catch(function(){});
      }, 400);
      setTimeout(function(){
        if(window.__licsystemInitVoiceflow) window.__licsystemInitVoiceflow();
      }, 2500);
    });
  }

  function boot(){
    LICSYSTEM.state.authUser = null;
    LICSYSTEM.auth.start(function(){
      bootApp();
    }).catch(function(){
      // permanece na tela de login
    });
  }

  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

})();
