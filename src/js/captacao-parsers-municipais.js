/* LICSYSTEM — parsers / municipais (Godoy · Ivaí · Cambé · Itapejara · SJP) */
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
      if (und === "UNID" || und === "UND" || und === "UNI") und = "UN";
      if (und === "CONJ" || und === "CJ") und = "CJ";
      if (und === "ROL") und = "ROLO";
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
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
