/* LICSYSTEM — parsers / municipais (Godoy · Ivaí · Cambé · Itapejara · SJP · TR/UNID · Céu Azul) */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

  bag.installMunicipais = function (deps) {
    var limparPagina = deps.limparPagina;
    var utils = deps.utils;
    var EDITAL_UNDS = deps.EDITAL_UNDS;

    function packMunicipioRow(lote, qtd, und, produto, vu, vt) {
      und = String(und || "UN").toUpperCase().replace(/\.$/, "");
      if (und === "PR" || und === "PAR") und = "PAR";
      if (und === "UNID" || und === "UND" || und === "UNI" || und === "UNIDADE") und = "UN";
      if (und === "BR" || und === "BARRA" || und === "BARRAS") und = "BARRA";
      if (und === "ROLO" || und === "ROLOS") und = "ROLO";
      if (und === "PACOTE" || und === "PACOTES") und = "PACOTE";
      if (und === "CONJ" || und === "CJ") und = "CJ";
      if (und === "ROL" || und === "ROLOS") und = "ROLO";
      if (und === "METROS") und = "METRO";
      if (/^PE[CÇ]AS?$/i.test(und)) und = "PEÇA";
      if (und === "PCS" || und === "PC" || und === "PÇ") und = "PEÇA";
      produto = String(produto || "").replace(/\s+/g, " ").trim();
      qtd = Number(qtd) || 0;
      vu = Number(vu) || 0;
      vt = Number(vt) || (vu && qtd ? vu * qtd : 0);
      var packed = {
        lote: String(lote),
        qtd: qtd,
        und: und,
        produto: produto,
        editalVunit: vu,
        editalTotal: vt,
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
      return packed;
    }

    function splitGodoyMoreiraBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var head = t.search(/LOTE\s+ORDEM\s+C[OÓ]D\.?\s*ITEM\s+DESCRICAO/i);
      if (head < 0) return [];
      var region = t.slice(head);
      var end = region.search(
        /Valor Total estimado:|FORMUL[AÁ]RIO PROPOSTA|3\.\s*DESCRI[CÇ][AÃ]O DA SOLU[CÇ]/i
      );
      if (end > 80) region = region.slice(0, end);
      region = region
        .replace(/Assinado por[\s\S]{0,500}?informe o c[oó]digo[^\n]*/gi, "\n")
        .replace(
          /Prefeitura Municipal de Godoy Moreira[\s\S]{0,320}?Godoy Moreira\s*[–-]\s*Pr/gi,
          "\n"
        );
      var flat = region.replace(/\s+/g, " ").trim();
      var parts = flat.split(/(?=\b\d{1,2}\s+1\s+\d{4,6}\s+)/);
      var undRe = "(UNID\\.?|UND\\.?|UN|PR|PAR|CONJ|CJ)";
      var money = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})";
      var reRow = new RegExp(
        "^(\\d{1,2})\\s+1\\s+(\\d{4,6})\\s+(.+?)\\s+" +
          undRe +
          "\\s+(\\d{1,4})\\s+" +
          money +
          "\\s+" +
          money,
        "i"
      );
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var chunk = parts[i].trim();
        var m = reRow.exec(chunk);
        if (!m) continue;
        var packed = packMunicipioRow(
          m[1],
          utils.parseBrNum(m[5]),
          m[4],
          String(m[3] || "").replace(/[;,]\s*$/, ""),
          utils.parseBrNum(m[6]),
          utils.parseBrNum(m[7])
        );
        if (utils.isLinhaProdutoEdital(packed)) out.push(packed);
      }
      return out;
    }

    function repairIvaiMoney(s) {
      s = String(s || "");
      s = s.replace(/(\d{1,3}\.\d)\s+(\d{2},\d{2})\b/g, "$1$2");
      s = s.replace(/(\d{2,3})\s+(0,\d{2})\b/g, function (_, a, b) {
        return a + "0," + b.slice(2);
      });
      s = s.replace(/(^|[^\d])(\d)\s+(\d,\d{2})\b/g, "$1$2$3");
      return s;
    }

    function splitSaoJoaoIvaiBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var head = t.search(/Lote\/\s*Especifica[cç][aã]o/i);
      if (head < 0) return [];
      var region = t.slice(head);
      var end = region.search(/FORMUL[AÁ]RIO PROPOSTA/i);
      if (end > 80) region = region.slice(0, end);
      var lines = region.split("\n").filter(function (ln) {
        var s = ln.trim();
        if (!s) return false;
        if (/^(?:[A-ZÁÉÍÓÚÃÕÇ]\s){6,}/.test(s)) return false;
        if (/AV\.\s*CURITIBA/i.test(s)) return false;
        if (/saojoaodoivai\.pr\.gov\.br/i.test(s)) return false;
        if (/^C C N N P P J J/i.test(s)) return false;
        return true;
      });
      var flat = repairIvaiMoney(lines.join(" ")).replace(/\s+/g, " ").trim();
      var undRe = "(UN|PAR|CONJ|CJ|ROLO|ROL)";
      var money = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})";
      var reTail = new RegExp(
        "^(\\d{1,2})\\s+(.{6,500}?)\\s+" +
          undRe +
          "\\s+(\\d{1,4})\\s+" +
          money +
          "\\s+" +
          money,
        "i"
      );
      var out = [];
      var from = 0;
      for (var n = 1; n <= 80; n++) {
        var searchFrom = from;
        var reN = new RegExp("(?:^|\\s)(" + n + ")\\s+(?=[^\\d\\s])");
        while (searchFrom < flat.length) {
          var slice = flat.slice(searchFrom);
          var mN = reN.exec(slice);
          if (!mN) break;
          var skip = mN[0].charAt(0) === " " ? 1 : 0;
          var abs = searchFrom + mN.index + skip;
          var chunk = flat.slice(abs, abs + 900);
          var m = reTail.exec(chunk);
          searchFrom = abs + Math.max(mN[0].length, 1);
          if (!m) continue;
          var qtd = utils.parseBrNum(m[4]);
          var vu = utils.parseBrNum(m[5]);
          var vt = utils.parseBrNum(m[6]);
          if (!(qtd > 0) || !(vu > 0) || !(vt > 0)) continue;
          var rel = Math.abs(qtd * vu - vt) / Math.max(vt, 1);
          if (rel > 0.08) continue;
          var desc = String(m[2] || "")
            .replace(/\s+/g, " ")
            .replace(/^(Item\s+M[aá]x\.?Unit\.?\s+M[aá]x\.?Total\s*)/i, "")
            .trim();
          if (desc.length < 6) continue;
          if (desc.length > 180) desc = desc.slice(0, 180).replace(/\s+\S*$/, "");
          var packed = packMunicipioRow(n, qtd, m[3], desc, vu, vt);
          if (utils.isLinhaProdutoEdital(packed)) out.push(packed);
          from = abs + m[0].length;
          break;
        }
      }
      return out;
    }

    function repairMunicipalMoney(s) {
      return String(s || "")
        // 38,5 0 → 38,50 | 1.890 ,00 → 1.890,00
        .replace(/(\d{1,3}(?:\.\d{3})*),(\d)\s+(\d)\b/g, "$1,$2$3")
        .replace(/(\d{1,3}(?:\.\d{3})*)\s*,\s*(\d{2})\b/g, "$1,$2")
        .replace(/\s+/g, " ")
        .trim();
    }

    /** Reune acentos que o PDF separou: "ABRA Ç ADEIRA" → "ABRAÇADEIRA". */
    function juntarAcentosSoltos(value) {
      var CURTAS = /^(de|da|do|e|a|o|em|com|por|para|na|no|ao|aos|as|os|dos|das|um|uma)$/i;
      // "À" fica de fora: é palavra inteira ("DESTINADO À UNIÃO"), nunca pedaço.
      var noMeio = /([A-Za-zÀ-ÿ]+)\s+([ÇÃÕÁÉÍÓÚÂÊÔÜçãõáéíóúâêôü]{1,2})\s+([A-Za-zÀ-ÿ]+)/g;
      var noInicio = /(^|[^A-Za-zÀ-ÿ])([ÇÃÕÁÉÍÓÚÂÊÔÜ]{1,2})\s+(?=[A-Za-zÀ-ÿ])/g;
      var out = String(value || "");
      var prev;
      do {
        prev = out;
        out = out
          .replace(noMeio, function (todo, palavra, acento, seguinte) {
            // "DE Á GUA": o acento abre a próxima palavra, não fecha a anterior.
            if (CURTAS.test(palavra) && seguinte.length > 2) return todo;
            return palavra + acento + seguinte;
          })
          .replace(noInicio, "$1$2");
      } while (out !== prev);
      return out
        .replace(/(\d)\s+\.\s+(\d{3})\b/g, "$1.$2")
        .replace(/\b([A-Za-z])\s+([ºª])/g, "$1$2");
    }

    /** Tira cabeçalho/rodapé de página que o pdf.js mistura à descrição. */
    function limparLinhaMunicipio(value) {
      return String(value || "")
        .replace(/Assinado eletronicamente por[\s\S]*$/i, " ")
        .replace(/Edital\s+Preg\s*[ãa]\s*o\s+Eletr[\s\S]*?P\s*[áa]\s*gina\s*\d+/gi, " ")
        .replace(/VL\.\s*M\s*[ÁA]\s*X\./gi, " ")
        .replace(/ITEM\s+ESPECIFICA\s*[ÇC][ÕO]\s*ES\s+UNID\.\s*QTDE\./gi, " ")
        .replace(/^\s*UNIT\.\s*TOTAL\s*$/i, " ")
        .replace(/^\s*LOTE\s+N[º°]\s*0?1\s*[–-].*$/i, " ")
        .replace(/^\s*VALOR\s+VALOR\s*$/i, " ")
        .replace(/^\s*ITEM\s+DESCRI[ÇC][ÃA]O\s+QTD\s*$/i, " ")
        .replace(/^\s*UNIT[ÁA]RIO\s+TOTAL\s*$/i, " ")
        .replace(/^\s*COMISS[ÃA]O DE CONTRATA[ÇC][ÃA]O\s*$/i, " ")
        .replace(/^\s*ANEXO\s+I{1,3}\s*$/i, " ")
        .replace(/^\s*OR[ÇC]AMENTO DA ADMINISTRA.*$/i, " ")
        .replace(/^\s*ITE\s+QT\s*$/i, " ")
        .replace(/^\s*COD\.\s*-\s*PRODUTO.*$/i, " ")
        .replace(/^\s*M\s+DE\s*$/i, " ")
        .replace(/^\s*R\$\s+R\$\s*$/i, " ")
        .replace(/^\s*Prefeitura Municipal de[^\n]*$/i, " ")
        .replace(/^\s*ESTADO DO PARAN[ÁA]\s*$/i, " ")
        .replace(/^\s*SOLICITA[ÇC][ÃA]O DE CONTRATA[ÇC][ÃA]O[^\n]*$/i, " ")
        .replace(/^\s*\d{1,3}\s*\/\s*\d{1,3}\s*$/, " ")
        .replace(/^\s*_+\s*$/, " ")
        .replace(/Rua Passos de Oliveira[^\n]*/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    function cleanMunicipalDescription(value, limit) {
      var text = juntarAcentosSoltos(
        String(value || "")
          .replace(/----- PAGE \d+ -----/gi, " ")
          .replace(/\s+/g, " ")
      ).trim();
      var max = Number(limit) || 380;
      if (text.length > max) text = text.slice(0, max).replace(/\s+\S*$/, "");
      return text.trim();
    }

    /**
     * Nestes quadros a linha de preços fica no MEIO da célula: o texto entre
     * duas linhas de preço traz o fim da descrição anterior seguido do nome do
     * próximo produto. Junta as duas metades para cada item.
     */
    function montarDescricoesMunicipio(lines, rows, corte, cortarPrimeiro) {
      var blocos = [];
      for (var k = 0; k < rows.length; k++) {
        var from = k > 0 ? rows[k - 1].line + 1 : 0;
        blocos.push(lines.slice(from, rows[k].line));
      }
      // O primeiro bloco não tem sobra de item anterior — cortar ali só perde texto.
      var cortes = blocos.map(function (linhas, idx) {
        return idx === 0 && !cortarPrimeiro ? 0 : corte(linhas, rows[idx].inline);
      });
      var descs = [];
      for (var r = 0; r < rows.length; r++) {
        var bloco = blocos[r].join(" ");
        var inicio = bloco.slice(cortes[r]);
        var fim =
          r + 1 < rows.length ? blocos[r + 1].join(" ").slice(0, cortes[r + 1]) : "";
        descs.push(inicio + " " + String(rows[r].inline || "") + " " + fim);
      }
      return descs;
    }

    /**
     * O texto da célula é justificado, então só a última linha do parágrafo
     * fica curta. É nela que termina a descrição do item anterior. Devolve o
     * índice da linha onde começa o produto seguinte, ou -1.
     */
    function linhaInicioProduto(linhas) {
      if (linhas.length < 2) return -1;
      var maior = 0;
      for (var i = 0; i < linhas.length; i++) {
        if (linhas[i].length > maior) maior = linhas[i].length;
      }
      if (maior < 20) return -1;
      // Uma frase terminar exatamente no fim da linha é raro no meio de um
      // parágrafo justificado: quase sempre é o fim da célula do item anterior.
      // Havendo mais de uma candidata, vence a mais curta.
      var comPonto = -1;
      var menorComPonto = Infinity;
      var curtaSemPonto = -1;
      for (var j = 0; j < linhas.length; j++) {
        var len = linhas[j].length;
        if (/[.;]$/.test(linhas[j])) {
          if (len < maior * 0.85 && len < menorComPonto) {
            menorComPonto = len;
            comPonto = j + 1;
          }
        } else if (len < maior * 0.75) {
          curtaSemPonto = j + 1;
        }
      }
      return comPonto > 0 ? comPonto : curtaSemPonto;
    }

    function offsetDaLinha(linhas, idx) {
      return idx <= 0 ? 0 : linhas.slice(0, idx).join(" ").length + 1;
    }

    /** Cambé / Itapejara: corta no fim do parágrafo do item anterior. */
    function corteMunicipio(linhas, inline) {
      var j = linhaInicioProduto(linhas);
      if (j > 0) return offsetDaLinha(linhas, j);
      var bloco = linhas.join(" ");
      var m = /[A-Za-zÀ-ÿ]\.\s+(?=[A-ZÀ-Ý])/.exec(bloco + " " + String(inline || ""));
      return m ? Math.min(m.index + m[0].length, bloco.length) : 0;
    }

    /** São José: cada produto começa no código "140953 - (…". */
    function corteCodigoProduto(linhas) {
      var bloco = linhas.join(" ");
      var re = /\b\d{5,6}\s*-\s*\(/g;
      var ultimo = null;
      var m;
      while ((m = re.exec(bloco)) !== null) ultimo = m;
      return ultimo ? ultimo.index : 0;
    }

    function splitCambeBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var start = t.search(/3\.\s*DESCRI\s*ÇÃ\s*O DETALHADA/i);
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(/4\.\s*COMPATIBILIDADE/i);
      if (end > 100) region = region.slice(0, end);
      var lines = [];
      region.split("\n").forEach(function (raw) {
        var s = limparLinhaMunicipio(raw);
        if (s) lines.push(s);
      });
      for (var h = 0; h < lines.length; h++) {
        if (/^EXCLUSIVO\s+ME/i.test(lines[h])) {
          lines = lines.slice(h + 1);
          break;
        }
      }

      var row =
        /\b(\d{1,3})\b(.*?)\b(unidade|cento|metro|pe[cç]a|par|rolo|caixa|kit|jogo|kg|k\s*g|conjunto)\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i;
      var rows = [];
      var expected = 1;
      for (var i = 0; i < lines.length; i++) {
        var m = row.exec(repairMunicipalMoney(lines[i]));
        if (!m || parseInt(m[1], 10) !== expected) continue;
        var qtd = utils.parseBrNum(m[4]);
        var vu = utils.parseBrNum(m[5]);
        var vt = utils.parseBrNum(m[6]);
        var rel = Math.abs(qtd * vu - vt) / Math.max(vt, 1);
        if (!(qtd > 0) || !(vu > 0) || !(vt > 0) || rel > 0.025) continue;
        rows.push({
          line: i,
          item: expected,
          qtd: qtd,
          und: m[3],
          vu: vu,
          vt: vt,
          inline: m[2]
        });
        expected++;
      }
      if (rows.length < 2) return [];

      var descs = montarDescricoesMunicipio(lines, rows, corteMunicipio);
      var out = [];
      for (var r = 0; r < rows.length; r++) {
        var packed = packMunicipioRow(
          rows[r].item,
          rows[r].qtd,
          rows[r].und,
          cleanMunicipalDescription(descs[r], 1200),
          rows[r].vu,
          rows[r].vt
        );
        if (utils.isLinhaProdutoEdital(packed)) out.push(packed);
      }
      return out;
    }

    function splitItapejaraBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var start = t.search(/LOTE\s+N[º°]\s*0?1\s*[–-]\s*MATERIAIS/i);
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(/O valor total para os materiais propostos/i);
      if (end > 100) region = region.slice(0, end);
      var lines = [];
      region.split("\n").forEach(function (raw) {
        var s = limparLinhaMunicipio(raw);
        if (s) lines.push(s);
      });
      var money = "([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})";
      var rows = [];
      var expected = 1;
      for (var i = 0; i < lines.length; i++) {
        var row = new RegExp(
          "(?:^|\\s)0?" +
            expected +
            "\\s+(.*?)\\s*(\\d{1,4})\\s+R\\$\\s*" +
            money +
            "\\s+R\\$\\s*" +
            money,
          "i"
        );
        var m = row.exec(repairMunicipalMoney(lines[i]));
        if (!m) continue;
        var qtd = utils.parseBrNum(m[2]);
        var vu = utils.parseBrNum(m[3]);
        var vt = utils.parseBrNum(m[4]);
        var rel = Math.abs(qtd * vu - vt) / Math.max(vt, 1);
        if (!(qtd > 0) || !(vu > 0) || !(vt > 0) || rel > 0.025) continue;
        rows.push({
          line: i,
          item: expected,
          qtd: qtd,
          und: "UN",
          vu: vu,
          vt: vt,
          inline: m[1]
        });
        expected++;
      }
      if (rows.length < 2) return [];

      var descs = montarDescricoesMunicipio(lines, rows, corteMunicipio);
      var out = [];
      for (var r = 0; r < rows.length; r++) {
        var packed = packMunicipioRow(
          rows[r].item,
          rows[r].qtd,
          rows[r].und,
          cleanMunicipalDescription(descs[r], 1200),
          rows[r].vu,
          rows[r].vt
        );
        if (utils.isLinhaProdutoEdital(packed)) out.push(packed);
      }
      return out;
    }

    /**
     * Termo de Referência / BLL: ITEM DESCRIÇÃO UNID QTDE VALOR UNIT. VALOR TOTAL
     * Ex.: Mauá da Serra — METROS/PEÇAS/ROLOS/UNIDADE + preços (95 itens).
     *
     * Não depende de sequência rígida 1..N (quebrava no 1º item difícil).
     * Âncoras = UND + QTD + VU + VT com qtd×vu ≈ vt; depois associa o nº do item.
     */
    function splitTermoReferenciaUndBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var start = t.search(
        /ITEM\s+DESCRI[CÇ][AÃ]O\s+UNID\.?\s+QTDE|1\.2\.\s*Do\s+Quantitativo\s+e\s+Valor\s+Estimado/i
      );
      if (start < 0) {
        start = t.search(
          /\b1\s+CABO\s+EL[EÉ]TRICO[\s\S]{0,400}?METROS\s+\d{2,}\s+\d+,\d{2}/i
        );
      }
      if (start < 0) {
        start = t.search(
          /\b(?:METROS|PE[CÇ]AS|ROLOS)\s+\d{2,}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,3}(?:\.\d{3})*,\d{2}/i
        );
      }
      if (start < 0) return [];

      var region = t.slice(start);
      var end = region.search(
        /O\s+valor\s+total\s+estimado\s+da\s+contrata[cç][aã]o|TOTAL\s+939[\d.,]*|ANEXO\s+II\s+MODELO\s+DE\s+PROPOSTA|MODELO\s+DE\s+PROPOSTA\s+COMERCIAL/i
      );
      if (end > 200) region = region.slice(0, end);

      region = region.replace(
        /\n?\s*\d{1,2}\.\s*(?:FUNDAMENTA[CÇ][AÃ]O|DOS\s+REQUISITOS|ADEQUA[CÇ][AÃ]O|EXECU[CÇ][AÃ]O)[^\n]{0,180}/gi,
        "\n"
      );

      var flat = region
        .replace(/--\s*\d+\s+of\s+\d+\s*--/gi, " ")
        .replace(/\bUNIDAD\s*E\b/gi, "UNIDADE")
        .replace(/\bITEM\s+DESCRI[CÇ][AÃ]O\s+UNID\.?\s+QTDE\.?\s+VALOR\s+UNIT\.?\s*R\$\s*VALOR\s+TOTAL\s*R\$/gi, " ")
        .replace(/\bVALOR\s+UNIT\.?\s*R\$/gi, " ")
        .replace(/\bVALOR\s+TOTAL\s*R\$/gi, " ")
        .replace(/\s+/g, " ")
        .trim();

      var unds = "METROS|METRO|PE[CÇ]AS|PE[CÇ]A|PCS|ROLOS|ROLO|UNIDADE|UNIDAD|UNID\\.?|UND\\.?";
      var money = "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})";
      var anchorRe = new RegExp(
        "\\b(" + unds + ")\\s+(\\d{1,6}(?:\\.\\d{3})?)\\s+" + money + "\\s+" + money,
        "gi"
      );

      var anchors = [];
      var am;
      while ((am = anchorRe.exec(flat)) !== null) {
        var qtd = utils.parseBrNum(am[2]);
        var vu = utils.parseBrNum(am[3]);
        var vt = utils.parseBrNum(am[4]);
        if (!(qtd > 0) || !(vu > 0) || !(vt > 0)) continue;
        var rel = Math.abs(qtd * vu - vt) / Math.max(vt, 1);
        // tolerante a arredondamento (ex.: 2 × 1785,66)
        if (rel > 0.08) continue;
        var und = String(am[1] || "UN").toUpperCase().replace(/\.$/, "");
        if (/^PE[CÇ]AS?$/i.test(und) || und === "PCS" || und === "PC" || und === "PÇ") und = "PEÇA";
        if (/^ROLOS$/i.test(und)) und = "ROLO";
        if (/^METROS$/i.test(und)) und = "METRO";
        if (/^UNIDAD(E)?$/i.test(und) || /^UNID$/i.test(und) || /^UND$/i.test(und) || und === "UNI")
          und = "UN";
        anchors.push({
          und: und,
          qtd: qtd,
          vu: vu,
          vt: vt,
          index: am.index,
          end: am.index + am[0].length,
          undLen: am[1].length
        });
      }
      if (anchors.length < 2) return [];

      function findItemNo(before, prefer) {
        // Nº do item imediatamente antes da descrição (último candidato plausível)
        var re = /\b(\d{1,3})\s+(?=[A-Za-zÀ-ú(])/g;
        var last = null;
        var m;
        while ((m = re.exec(before)) !== null) {
          var n = parseInt(m[1], 10);
          if (n < 1 || n > 500) continue;
          // evita capturar "80 Ampères", "12 Polos", bitolas etc. no meio da desc
          // preferimos o que está mais à esquerda só se for o esperado
          last = { n: n, at: m.index, len: m[0].length };
        }
        if (!last) return null;
        if (prefer > 0) {
          // Se há "prefer" (próximo esperado) no fim do trecho, use-o
          var prefRe = new RegExp(
            "\\b" + prefer + "\\s+(?=[A-Za-zÀ-ú(])(?![\\s\\S]{0,40}\\b" + prefer + "\\s+)",
            "i"
          );
          // busca a última ocorrência de `prefer` no before
          var p;
          var best = null;
          var prefScan = new RegExp("\\b(" + prefer + ")\\s+(?=[A-Za-zÀ-ú(])", "g");
          while ((p = prefScan.exec(before)) !== null) {
            best = { n: prefer, at: p.index, len: p[0].length };
          }
          if (best) return best;
        }
        return last;
      }

      var byItem = {};
      var expected = 1;
      for (var a = 0; a < anchors.length; a++) {
        var prevEnd = a > 0 ? anchors[a - 1].end : 0;
        var before = flat.slice(prevEnd, anchors[a].index);
        var hit = findItemNo(before, expected);
        // fallback: procura expected em toda a janela antes do âncora (até 500 chars)
        if (!hit || (hit.n !== expected && expected <= 200)) {
          var win = before.slice(Math.max(0, before.length - 500));
          var expHit = null;
          var er = new RegExp("\\b(" + expected + ")\\s+(?=[A-Za-zÀ-ú(])", "g");
          var em;
          while ((em = er.exec(win)) !== null) {
            expHit = {
              n: expected,
              at: prevEnd + Math.max(0, before.length - 500) + em.index,
              len: em[0].length
            };
          }
          if (expHit) hit = { n: expected, at: expHit.at - prevEnd, len: expHit.len };
        }
        if (!hit) continue;

        var descStart = prevEnd + hit.at + hit.len;
        var desc = flat.slice(descStart, anchors[a].index).replace(/\s+/g, " ").trim();
        desc = desc
          .replace(/\b\d{1,2}\.\s*(?:FUNDAMENTA[CÇ][AÃ]O|DOS\s+REQUISITOS)[\s\S]{0,180}$/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (desc.length < 3) continue;

        if (utils && typeof utils.enxugarDescricaoEdital === "function") {
          var slim = utils.enxugarDescricaoEdital(desc);
          if (slim && slim.length >= 8) desc = slim;
        }

        var itemNo = hit.n;
        // Evita sobrescrever item já bom com âncora falsa posterior
        if (byItem[itemNo] && byItem[itemNo].produto.length >= desc.length) {
          expected = itemNo + 1;
          continue;
        }

        var packed = packMunicipioRow(
          itemNo,
          anchors[a].qtd,
          anchors[a].und,
          desc,
          anchors[a].vu,
          anchors[a].vt
        );
        if (utils.isLinhaProdutoEdital(packed)) {
          byItem[itemNo] = packed;
          expected = itemNo + 1;
        }
      }

      var out = [];
      var keys = Object.keys(byItem)
        .map(function (k) {
          return parseInt(k, 10);
        })
        .filter(function (n) {
          return n > 0;
        })
        .sort(function (a, b) {
          return a - b;
        });
      for (var k = 0; k < keys.length; k++) out.push(byItem[keys[k]]);

      // Fallback: muitas âncoras válidas (qtd×vu≈vt) mas poucos nºs associados
      // (pdf.js embaralha "12 Polos" / quebras). Usa ordem das âncoras = itens 1..N.
      if (anchors.length >= 40 && out.length < Math.floor(anchors.length * 0.7)) {
        var seq = [];
        for (var s = 0; s < anchors.length; s++) {
          var prev = s > 0 ? anchors[s - 1].end : 0;
          var chunk = flat.slice(prev, anchors[s].index).replace(/\s+/g, " ").trim();
          // remove nº do item no início, se houver
          chunk = chunk.replace(/^\d{1,3}\s+/, "").trim();
          chunk = chunk
            .replace(/\b\d{1,2}\.\s*(?:FUNDAMENTA[CÇ][AÃ]O|DOS\s+REQUISITOS)[\s\S]{0,180}/gi, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (chunk.length < 3) chunk = "Item " + (s + 1);
          if (utils && typeof utils.enxugarDescricaoEdital === "function") {
            var slim2 = utils.enxugarDescricaoEdital(chunk);
            if (slim2 && slim2.length >= 8) chunk = slim2;
          }
          var packed2 = packMunicipioRow(
            s + 1,
            anchors[s].qtd,
            anchors[s].und,
            chunk,
            anchors[s].vu,
            anchors[s].vt
          );
          if (utils.isLinhaProdutoEdital(packed2)) seq.push(packed2);
        }
        if (seq.length > out.length) out = seq;
      }

      return out;
    }

    /**
     * Jandaia do Sul / Elotech Anexo I:
     *   ITEM  UNIDADE  QTD  CATMAT  ESPECIFICAÇÃO  UNITÁRIO  TOTAL
     *   01    Rolo     60   604126  Mangueira…     1.102,88  66.172,80
     * O THEO pega "01 Rolo" e perde qtd/preço; números no meio da descrição
     * (ex.: 19 Unidade, 40 metros) viram lote fora de ordem.
     */
    function splitJandaiaCatmatBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (
        !/ITEM\s+CATMAT\s+ESPECIFICA/i.test(t) &&
        !(/Jandaia\s+do\s+Sul/i.test(t) &&
          /\b\d{1,2}\s+(?:Rolo|Unidade|Pacote)\s+\d{1,5}\s+\d{5,8}\s+/i.test(t))
      ) {
        return [];
      }
      var undAlt =
        "ROLOS?|UNIDADE|UNID\\.?|UND\\.?|UN|PACOTES?|CAIXA|CX|PAR|KIT|METROS?|PE[CÇ]AS?";
      var flat = t
        .replace(
          /CNPJ:\s*[\d.\/-]+[\s\S]{0,220}?(?:Elotech Assinatura[^\n]*|Verifique[^\n]*)/gi,
          "\n"
        )
        .replace(
          /PREFEITURA MUNICIPAL DE JANDAIA DO SUL[\s\S]{0,120}?www\.jandaiadosul\.pr\.gov\.br/gi,
          "\n"
        )
        .replace(/\s+/g, " ")
        .trim();
      var re = new RegExp(
        "(?:^|\\s)(\\d{1,2})\\s+(?:(" +
          undAlt +
          ")\\s+)?(\\d{1,5})\\s+(\\d{5,8})(?=\\s)",
        "gi"
      );
      var anchors = [];
      var m;
      var lastUnd = "UN";
      while ((m = re.exec(flat)) !== null) {
        var itemNo = parseInt(m[1], 10);
        var qtd = utils.parseBrNum(m[3]);
        if (!(itemNo >= 1 && itemNo <= 80) || !(qtd > 0)) continue;
        var und = m[2] ? m[2] : lastUnd;
        if (m[2]) lastUnd = m[2];
        var pos = m.index;
        if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") pos = m.index + 1;
        anchors.push({
          itemNo: itemNo,
          und: und,
          qtd: qtd,
          cod: m[4],
          index: pos,
          headEnd: m.index + m[0].length
        });
      }
      if (anchors.length < 4) return [];

      function firstPricePair(str, qtdHint) {
        var all = [];
        var reP =
          /\s+(\d{1,3}(?:\.\d{3})*,\d{2,4}|\d+[.,]\d{2,4})\s+(\d{1,3}(?:\.\d{3})*,\d{2}|\d+[.,]\d{2})(?=\s|$)/g;
        var pm;
        var qtdN = Number(qtdHint) || 0;
        while ((pm = reP.exec(str)) !== null) {
          if (/^\d{1,3}(\.\d{3})+$/.test(pm[1])) {
            reP.lastIndex = pm.index + 1;
            continue;
          }
          var u = utils.parseBrNum(pm[1]);
          var tot = utils.parseBrNum(pm[2]);
          if (!(u > 0) || !(tot > 0)) continue;
          var rel =
            qtdN > 0
              ? Math.abs(qtdN * u - tot) / Math.max(Math.abs(tot), Math.abs(qtdN * u), 1)
              : 1;
          all.push({
            unit: u,
            total: tot,
            index: pm.index,
            len: pm[0].length,
            rel: rel
          });
        }
        var exact = null;
        for (var p = 0; p < all.length; p++) {
          if (all[p].rel <= 0.02) {
            exact = all[p];
            break;
          }
        }
        return exact || all[0] || null;
      }

      var byItem = {};
      for (var i = 0; i < anchors.length; i++) {
        var nextIdx = i + 1 < anchors.length ? anchors[i + 1].index : flat.length;
        var body = flat.slice(anchors[i].headEnd, nextIdx);
        var cut = body.search(
          /\b(?:OBS\s*:|Total\s+\d{1,3}(?:\.\d{3})*,\d{2}|1\.2\.\d+\.|ITEM\s+CATMAT)\b/i
        );
        if (cut > 20) body = body.slice(0, cut);
        var pair = firstPricePair(body, anchors[i].qtd);
        var vu = pair ? pair.unit : 0;
        var vt = pair ? pair.total : 0;
        var desc = body;
        var after = "";
        if (pair) {
          desc = body.slice(0, pair.index);
          after = body.slice(pair.index + pair.len);
        }
        desc = String(desc || "").replace(/\s+/g, " ").trim();
        after = String(after || "")
          .replace(/\bCNPJ:\s*[\d.\/-]+[\s\S]{0,80}/gi, " ")
          .replace(/\bFone:\s*\(?\d{2}\)?[\d\s.-]+/gi, " ")
          .replace(/Pra[cç]a do Caf[eé][\s\S]{0,80}/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (after && after.length >= 8) {
          desc = (desc + " " + after).replace(/\s+/g, " ").trim();
        }
        desc = desc.replace(/\b\d{1,2}\s+\d{1,5}\s+\d{5,8}\b/g, " ").replace(/\s+/g, " ").trim();
        if (desc.length > 700) desc = desc.slice(0, 700).replace(/\s+\S*$/, "");
        if (!desc || desc.length < 4) {
          desc = "Item " + anchors[i].itemNo + " CATMAT " + anchors[i].cod;
        }
        var packed = packMunicipioRow(
          anchors[i].itemNo,
          anchors[i].qtd,
          anchors[i].und,
          desc,
          vu,
          vt
        );
        if (!utils.isLinhaProdutoEdital(packed)) continue;
        var n = anchors[i].itemNo;
        var prev = byItem[n];
        if (!prev) {
          byItem[n] = packed;
        } else if (packed.editalVunit > 0 && !prev.editalVunit) {
          byItem[n] = packed;
        } else if (
          packed.editalVunit > 0 &&
          prev.editalVunit > 0 &&
          packed.produto.length > prev.produto.length &&
          packed.produto.length < 420
        ) {
          byItem[n] = packed;
        }
      }

      var keys = Object.keys(byItem)
        .map(function (k) {
          return parseInt(k, 10);
        })
        .filter(function (n) {
          return n > 0;
        })
        .sort(function (a, b) {
          return a - b;
        });
      var out = [];
      for (var k = 0; k < keys.length; k++) out.push(byItem[keys[k]]);
      return out;
    }

    /**
     * Céu Azul / BLL — Anexo 01 Termo de Referência:
     * ITEM | QTD | UN | DESCRIÇÃO | UNITÁRIO (3–4 casas) | TOTAL (3–4 casas)
     * Ex.: 1 68 UN ABRAÇADEIRA UNIVERSAL PARA … 27,9200 1.898,5600
     * A descrição quebra de linha e o THEO pega "N UN" virando lote lixo.
     */
    function splitCeuAzulBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (
        !/C[eé]u\s+Azul/i.test(t) &&
        !(/Lotes exclusivos ME EPP/i.test(t) &&
          /Uni\.\s*Descri[cç][aã]o do produto/i.test(t))
      ) {
        return [];
      }
      var start = t.search(/Lotes exclusivos ME EPP/i);
      if (start < 0) start = t.search(/N[ºo°]\s*Item[\s\S]{0,120}?Qtde\.?\s*Estima/i);
      if (start < 0) {
        start = t.search(
          /(?:^|\n)\s*1\s+\d{1,5}\s+(?:UN|UNI|P[CÇ]|KG|MT|CX|BR)\s+\S/i
        );
      }
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(
        /Valor m[aá]ximo estimado do processo|1\.2\s*CRIT[EÉ]RIO DE JULGAMENTO/i
      );
      if (end > 80) region = region.slice(0, end);
      region = region
        .replace(
          /MUNIC[IÍ]PIO DE C[EÉ]U AZUL[\s\S]{0,260}?P[aá]gina\s+\d+\s*\/\s*\d+/gi,
          "\n"
        )
        .replace(
          /Edital Preg[aã]o Eletr[oô]nico N[ºo°]?\s*[\d./]+[^\n]{0,100}/gi,
          "\n"
        )
        .replace(
          /PREG[AÃ]O ELETR[OÔ]NICO N[ºo°]?\s*[\d./]+[^\n]{0,120}/gi,
          "\n"
        )
        .replace(/Forma Eletr[oô]nica\.?/gi, "\n")
        .replace(/ANEXO\s*0?1[^\n]{0,80}/gi, "\n")
        .replace(/TERMO DE REFER[EÊ]NCIA[^\n]{0,90}/gi, "\n")
        .replace(/Aten[cç][aã]o:\s*Lotes exclusivos ME EPP/gi, "\n")
        .replace(
          /N[ºo°]\s*Item\s+Qtde\.?\s*Estima[^\n]{0,40}Uni\.\s*Descri[cç][aã]o[^\n]{0,80}Valor Total/gi,
          "\n"
        );
      var flat = region.replace(/\s+/g, " ").trim();
      var undAlt =
        "UNI|UNID\\.?|UND\\.?|UN|P[CÇ]|PE[CÇ]AS?|PCS|KG|MT|METROS?|CX|CAIXA|BR|BARRA";
      var re = new RegExp(
        "(?:^|\\s)(\\d{1,3})\\s+(\\d{1,5})\\s+(" + undAlt + ")(?=\\s)",
        "gi"
      );
      var anchors = [];
      var m;
      while ((m = re.exec(flat)) !== null) {
        var itemNo = parseInt(m[1], 10);
        var qtd = utils.parseBrNum(m[2]);
        if (!(itemNo >= 1 && itemNo <= 400) || !(qtd > 0)) continue;
        var pos = m.index;
        if (m[0].charAt(0) === " " || m[0].charAt(0) === "\t") pos = m.index + 1;
        anchors.push({
          itemNo: itemNo,
          qtd: qtd,
          und: m[3],
          index: pos,
          headEnd: m.index + m[0].length
        });
      }
      if (anchors.length < 8) return [];

      function firstPricePairCeu(str, qtdHint) {
        var all = [];
        var reP =
          /(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})\s+(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})(?=\s|$)/g;
        var pm;
        var qtdN = Number(qtdHint) || 0;
        while ((pm = reP.exec(str)) !== null) {
          var u = utils.parseBrNum(pm[1]);
          var tot = utils.parseBrNum(pm[2]);
          if (!(u > 0) || !(tot > 0)) continue;
          var rel =
            qtdN > 0
              ? Math.abs(qtdN * u - tot) / Math.max(Math.abs(tot), Math.abs(qtdN * u), 1)
              : 1;
          all.push({
            unit: u,
            total: tot,
            index: pm.index,
            len: pm[0].length,
            rel: rel
          });
        }
        var glued = /(\d{1,3}(?:\.\d{3})*,\d{3})(\d{1,3}(?:\.\d{3})*,\d{3,4})/g;
        var gm;
        while ((gm = glued.exec(str)) !== null) {
          var ug = utils.parseBrNum(gm[1]);
          var tg = utils.parseBrNum(gm[2]);
          if (!(ug > 0) || !(tg > 0)) continue;
          var relg =
            qtdN > 0
              ? Math.abs(qtdN * ug - tg) / Math.max(Math.abs(tg), Math.abs(qtdN * ug), 1)
              : 1;
          all.push({
            unit: ug,
            total: tg,
            index: gm.index,
            len: gm[0].length,
            rel: relg
          });
        }
        var exact = null;
        for (var p = 0; p < all.length; p++) {
          if (all[p].rel <= 0.02) {
            exact = all[p];
            break;
          }
        }
        return exact || all[0] || null;
      }

      var byItemC = {};
      for (var i = 0; i < anchors.length; i++) {
        var nextIdx = i + 1 < anchors.length ? anchors[i + 1].index : flat.length;
        var body = flat.slice(anchors[i].headEnd, nextIdx);
        var pair = firstPricePairCeu(body, anchors[i].qtd);
        var vu = pair ? pair.unit : 0;
        var vt = pair ? pair.total : 0;
        var desc = body;
        var after = "";
        if (pair) {
          desc = body.slice(0, pair.index);
          after = body.slice(pair.index + pair.len);
        }
        desc = String(desc || "").replace(/\s+/g, " ").trim();
        after = String(after || "")
          .replace(
            /\b(?:MUNIC[IÍ]PIO DE C[EÉ]U AZUL|P[aá]gina\s+\d+|Forma Eletr[oô]nica|ANEXO\s*0?1|TERMO DE REFER[EÊ]NCIA)\b[\s\S]{0,80}/gi,
            " "
          )
          .replace(/\s+/g, " ")
          .trim();
        if (after && after.length >= 2) {
          desc = (desc + " " + after).replace(/\s+/g, " ").trim();
        }
        desc = desc
          .replace(/\bN[ºo°]\s*Item\b/gi, " ")
          .replace(/\bQtde\.?\s*Estima\w*\b/gi, " ")
          .replace(/\bValor\s+(?:Unit[aá]rio|Total)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (desc.length > 700) desc = desc.slice(0, 700).replace(/\s+\S*$/, "");
        if (!desc || desc.length < 3) {
          desc = "Item " + anchors[i].itemNo;
        }
        if (!(vu > 0) || !(vt > 0)) continue;
        var packed = packMunicipioRow(
          anchors[i].itemNo,
          anchors[i].qtd,
          anchors[i].und,
          desc,
          vu,
          vt
        );
        if (!utils.isLinhaProdutoEdital(packed)) continue;
        var n = anchors[i].itemNo;
        var prev = byItemC[n];
        if (!prev) {
          byItemC[n] = packed;
        } else if (packed.editalVunit > 0 && !prev.editalVunit) {
          byItemC[n] = packed;
        } else if (
          packed.editalVunit > 0 &&
          prev.editalVunit > 0 &&
          packed.produto.length > prev.produto.length &&
          packed.produto.length < 420
        ) {
          byItemC[n] = packed;
        }
      }

      var keysC = Object.keys(byItemC)
        .map(function (k) {
          return parseInt(k, 10);
        })
        .filter(function (n) {
          return n > 0;
        })
        .sort(function (a, b) {
          return a - b;
        });
      var outC = [];
      for (var kc = 0; kc < keysC.length; kc++) outC.push(byItemC[keysC[kc]]);
      return outC.length >= 8 ? outC : [];
    }

    function splitSaoJosePinhaisBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var start = t.search(/ANEXO\s+II\s+OR[CÇ]AMENTO DA ADMINISTRA[CÇ][AÃ]O/i);
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(/VALOR TOTAL DA LICITA[CÇ][AÃ]O/i);
      if (end > 100) region = region.slice(0, end);
      var lines = [];
      region.split("\n").forEach(function (raw) {
        var s = limparLinhaMunicipio(raw);
        if (s) lines.push(s);
      });
      var money = "([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})";
      var rows = [];
      var expected = 1;
      for (var i = 0; i < lines.length; i++) {
        var row = new RegExp(
          "(?:^|\\s)" +
            expected +
            "\\s+(.*?)\\s*(\\d{1,4})\\s+" +
            money +
            "\\s+" +
            money,
          "i"
        );
        var m = row.exec(repairMunicipalMoney(lines[i]));
        if (!m) continue;
        var qtd = utils.parseBrNum(m[2]);
        var vu = utils.parseBrNum(m[3]);
        var vt = utils.parseBrNum(m[4]);
        var rel = Math.abs(qtd * vu - vt) / Math.max(vt, 1);
        if (!(qtd > 0) || !(vu > 0) || !(vt > 0) || rel > 0.025) continue;
        rows.push({
          line: i,
          item: expected,
          qtd: qtd,
          und: "UN",
          vu: vu,
          vt: vt,
          inline: m[1]
        });
        expected++;
      }
      if (rows.length < 2) return [];

      var descs = montarDescricoesMunicipio(lines, rows, corteCodigoProduto, true);
      var out = [];
      for (var r = 0; r < rows.length; r++) {
        var packed = packMunicipioRow(
          rows[r].item,
          rows[r].qtd,
          rows[r].und,
          cleanMunicipalDescription(descs[r], 1200),
          rows[r].vu,
          rows[r].vt
        );
        if (utils.isLinhaProdutoEdital(packed)) out.push(packed);
      }
      return out;
    }

    deps.packMunicipioRow = packMunicipioRow;
    deps.splitGodoyMoreiraBlocks = splitGodoyMoreiraBlocks;
    deps.splitSaoJoaoIvaiBlocks = splitSaoJoaoIvaiBlocks;
    deps.splitCambeBlocks = splitCambeBlocks;
    deps.splitItapejaraBlocks = splitItapejaraBlocks;
    deps.splitSaoJosePinhaisBlocks = splitSaoJosePinhaisBlocks;
    deps.splitTermoReferenciaUndBlocks = splitTermoReferenciaUndBlocks;
    deps.splitJandaiaCatmatBlocks = splitJandaiaCatmatBlocks;
    deps.splitCeuAzulBlocks = splitCeuAzulBlocks;

    if (typeof bag.registerModelos === "function") {
      bag.registerModelos([
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
          id: "jandaia-catmat",
          label: "Jandaia do Sul — ITEM/UNIDADE/QTD/CATMAT",
          family: "municipais",
          split: "splitJandaiaCatmatBlocks",
          minItems: 6,
          priority: 42,
          tryWithoutHint: true,
          hint: function (raw) {
            return (
              /ITEM\s+CATMAT\s+ESPECIFICA/i.test(raw) ||
              (/Jandaia\s+do\s+Sul/i.test(raw) &&
                /\b\d{1,2}\s+(?:Rolo|Unidade|Pacote)\s+\d{1,5}\s+\d{5,8}\s+/i.test(raw))
            );
          }
        },
        {
          id: "ceu-azul-tr",
          label: "Céu Azul — Termo de Referência ITEM/QTD/UN (4 casas)",
          family: "municipais",
          split: "splitCeuAzulBlocks",
          minItems: 20,
          priority: 36,
          tryWithoutHint: true,
          hint: function (raw) {
            return (
              (/C[eé]u\s+Azul/i.test(raw) &&
                (/\bValor\s+Unit[aá]rio\b/i.test(raw) ||
                  /Lotes exclusivos ME EPP/i.test(raw) ||
                  /\d{1,3}(?:\.\d{3})*,\d{4}\s+\d{1,3}(?:\.\d{3})*,\d{4}/.test(raw))) ||
              (/Lotes exclusivos ME EPP/i.test(raw) &&
                /Uni\.\s*Descri[cç][aã]o do produto/i.test(raw))
            );
          }
        },
        {
          id: "termo-referencia-und",
          label: "Termo de Referência — ITEM/UNID/QTDE/valores (Mauá da Serra e similares)",
          family: "municipais",
          split: "splitTermoReferenciaUndBlocks",
          minItems: 8,
          priority: 75,
          tryWithoutHint: true,
          hint: function (raw) {
            return (
              (/Mau[aá]\s+da\s+Serra/i.test(raw) &&
                /\b(?:METROS|PE[CÇ]AS|ROLOS)\s+\d{2,}\s+\d{1,3}(?:\.\d{3})*,\d{2}\s+\d{1,3}(?:\.\d{3})*,\d{2}/i.test(
                  raw
                )) ||
              (/ITEM\s+DESCRI[CÇ][AÃ]O\s+UNID\.?\s+QTDE/i.test(raw) &&
                /\b(?:METROS|PE[CÇ]AS|ROLOS)\s+\d{2,}\s+\d+,\d{2}\s+\d{1,3}(?:\.\d{3})*,\d{2}/i.test(
                  raw
                ))
            );
          }
        }
      ]);
    }
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
