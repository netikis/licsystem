/* LICSYSTEM — parsers / municipais (Godoy · Ivaí · Cambé · Itapejara · SJP · TR/UNID · Céu Azul · Piraquara · Sarandi · Tomazina) */
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
      if (und === "GALAO" || und === "GALÃO" || und === "GALOES" || und === "GALÕES") und = "GALÃO";
      if (und === "HORAS" || und === "HORA" || und === "HRS" || und === "HR") und = "HORA";
      if (/^SERVI[CÇ]OS?$/i.test(und)) und = "SERVIÇO";
      if (und === "ROLO" || und === "ROLOS") und = "ROLO";
      if (und === "PACOTE" || und === "PACOTES") und = "PACOTE";
      if (und === "CONJ" || und === "CJ" || und === "CONJUNTO" || und === "CONJUNTOS") und = "CJ";
      if (und === "ROL" || und === "ROLOS") und = "ROLO";
      if (und === "METROS" || und === "MT" || und === "MTS") und = "METRO";
      if (und === "DIA" || und === "DIAS") und = "DIA";
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

    function foldCeu(s) {
      return utils.fold(String(s || "")).toLowerCase();
    }

    function looksLikeCeuAzul(raw) {
      var f = foldCeu(raw);
      return (
        f.indexOf("ceu azul") >= 0 ||
        (f.indexOf("lotes exclusivos me epp") >= 0 &&
          f.indexOf("descricao do produto") >= 0)
      );
    }

    /**
     * Céu Azul / BLL — Anexo 01 Termo de Referência:
     * ITEM | QTD | UN | DESCRIÇÃO | UNITÁRIO (3–4 casas) | TOTAL (3–4 casas)
     * Ex.: 1 68 UN ABRAÇADEIRA UNIVERSAL PARA … 27,9200 1.898,5600
     * Sem classe unicode no regex: o build ofusca e o THEO voltava a ganhar.
     */
    function splitCeuAzulBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      if (!looksLikeCeuAzul(t)) return [];
      var start = t.indexOf("Lotes exclusivos ME EPP");
      if (start < 0) start = t.indexOf("Lotes exclusivos ME EPP".toLowerCase());
      if (start < 0) {
        var fAll = foldCeu(t);
        var at = fAll.indexOf("lotes exclusivos me epp");
        if (at < 0) at = fAll.indexOf("qtde. estima");
        if (at < 0) at = fAll.indexOf("1 68 un ");
        if (at >= 0) {
          var iOrig = 0;
          var iFold = 0;
          while (iOrig < t.length && iFold < at) {
            var one = utils.fold(t.charAt(iOrig));
            iOrig++;
            if (one) iFold += one.length;
          }
          start = iOrig;
        }
      }
      if (start < 0) return [];
      var region = t.slice(start);
      var fReg = foldCeu(region);
      var endFold = fReg.indexOf("valor maximo estimado do processo");
      if (endFold < 0) endFold = fReg.indexOf("1.2 criterio de julgamento");
      if (endFold > 80) {
        var eOrig = 0;
        var eFold = 0;
        while (eOrig < region.length && eFold < endFold) {
          var oneE = utils.fold(region.charAt(eOrig));
          eOrig++;
          if (oneE) eFold += oneE.length;
        }
        region = region.slice(0, eOrig);
      }
      region = region
        .replace(/MUNIC.PIO DE C.U AZUL[\s\S]{0,260}?P.gina\s+\d+\s*\/\s*\d+/gi, "\n")
        .replace(/Edital Preg.o Eletr.nico N.?\s*[\d./]+[^\n]{0,100}/gi, "\n")
        .replace(/PREG.O ELETR.NICO N.?\s*[\d./]+[^\n]{0,120}/gi, "\n")
        .replace(/Forma Eletr.nica\.?/gi, "\n")
        .replace(/ANEXO\s*0?1[^\n]{0,80}/gi, "\n")
        .replace(/TERMO DE REFER.NCIA[^\n]{0,90}/gi, "\n")
        .replace(/Aten.{0,3}o:\s*Lotes exclusivos ME EPP/gi, "\n");
      var flat = region.replace(/\s+/g, " ").trim();
      var reUnd =
        "(?:^|\\s)(\\d{1,3})\\s+(\\d{1,5})\\s+(UNI|UNID\\.?|UND\\.?|UN|PCS|PC|P\\u00C7|KG|MT|METROS?|CX|CAIXA|BR|BARRA)(?=\\s)";
      var anchors = [];
      String(flat).replace(new RegExp(reUnd, "gi"), function (whole, itemRaw, qtdRaw, undRaw, idx) {
        var itemNo = parseInt(itemRaw, 10);
        var qtd = utils.parseBrNum(qtdRaw);
        if (!(itemNo >= 1 && itemNo <= 400) || !(qtd > 0)) return whole;
        var pos = idx;
        if (whole.charAt(0) === " " || whole.charAt(0) === "\t") pos = idx + 1;
        anchors.push({
          itemNo: itemNo,
          qtd: qtd,
          und: undRaw,
          index: pos,
          headEnd: idx + whole.length
        });
        return whole;
      });
      if (anchors.length < 8) return [];

      function firstPricePairCeu(str, qtdHint) {
        var all = [];
        var qtdN = Number(qtdHint) || 0;
        function pushPair(uRaw, tRaw, index, len) {
          var u = utils.parseBrNum(uRaw);
          var tot = utils.parseBrNum(tRaw);
          if (!(u > 0) || !(tot > 0)) return;
          var rel =
            qtdN > 0
              ? Math.abs(qtdN * u - tot) / Math.max(Math.abs(tot), Math.abs(qtdN * u), 1)
              : 1;
          all.push({ unit: u, total: tot, index: index, len: len, rel: rel });
        }
        String(str).replace(
          /(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})\s+(\d{1,3}(?:\.\d{3})*,\d{3,4}|\d+,\d{3,4})(?=\s|$)/g,
          function (whole, uRaw, tRaw, idx) {
            pushPair(uRaw, tRaw, idx, whole.length);
            return whole;
          }
        );
        String(str).replace(
          /(\d{1,3}(?:\.\d{3})*,\d{3})(\d{1,3}(?:\.\d{3})*,\d{3,4})/g,
          function (whole, uRaw, tRaw, idx) {
            pushPair(uRaw, tRaw, idx, whole.length);
            return whole;
          }
        );
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
            /\b(?:MUNIC.PIO DE C.U AZUL|P.gina\s+\d+|Forma Eletr.nica|ANEXO\s*0?1|TERMO DE REFER.NCIA)\b[\s\S]{0,80}/gi,
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

    function repairSplitRs(s) {
      s = String(s || "");
      s = s.replace(/R\$\s*/g, " R$ ");
      s = s.replace(/(\d),(\d)\s+(\d)(?=\s|$)/g, "$1,$2$3");
      s = s.replace(/(\d),\s+(\d{2})(?=\s|$)/g, "$1,$2");
      s = s.replace(/(\d{1,3})\s+(\d{3}),(\d{2})/g, "$1.$2,$3");
      return s.replace(/\s+/g, " ").trim();
    }

    function moneyBrRe() {
      return "(\\d{1,3}(?:\\.\\d{3})*,\\d{2}|\\d+,\\d{2})";
    }

    function collectBrMoney(s, requireRs) {
      var out = [];
      var re = requireRs
        ? new RegExp("R\\$\\s*" + moneyBrRe(), "g")
        : new RegExp(moneyBrRe() + "(?![mM]\\b)", "g");
      String(s || "").replace(re, function (w, m, idx) {
        var n = utils.parseBrNum(m);
        if (n > 0) out.push({ n: n, idx: idx, raw: m });
        return w;
      });
      return out;
    }

    function cleanPiraquaraDesc(raw, itemNo) {
      var desc = String(raw || "")
        .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g, " ")
        .replace(/\bMat\.?\s*Item\b/gi, " ")
        .replace(/\bItem\s*Descri[cç][aã]o\b/gi, " ")
        .replace(/\bGrupo\s+\d+\b/gi, " ")
        .replace(/\bC.MARA MUNICIPAL DE PIRAQUARA\b/gi, " ")
        .replace(/\bPREG.O ELETR.NICO\b/gi, " ")
        .replace(/\bValor unit\.?\b/gi, " ")
        .replace(/\bValor total\b/gi, " ")
        .replace(/\bQuant\.?\b/gi, " ")
        .replace(/\bUnidade\b/gi, " ")
        .replace(/\bDescri[cç][aã]o\b/gi, " ")
        .replace(/\bMat\.\s*El[eé]trico\b/gi, " ")
        .replace(/^[\s.\-–]*El[eé]trico\s+/i, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (desc.length > 420) {
        var cut = desc.search(/[A-ZÁÉÍÓÚÂÊÔÃÕÇ][a-záéíóúâêôãõçA-Z]{3,}[^]{0,80}$/);
        if (cut > 40) desc = desc.slice(cut);
        else desc = desc.slice(-360).replace(/^\S*\s/, "");
      }
      if (!desc || desc.length < 3) desc = "Item " + itemNo;
      return desc;
    }

    /**
     * Câmara de Piraquara — TR Grupo/Item:
     * descrição quebra ANTES do nº; depois QTD + R$ unit + R$ total.
     */
    function splitPiraquaraBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var f = foldCeu(t);
      if (f.indexOf("piraquara") < 0) return [];
      if (f.indexOf("valor unit") < 0 && f.indexOf("descricao dos itens") < 0) return [];
      var start = t.search(/DESCRI.AO DOS ITENS, QUANTIDADES E VALORES/i);
      if (start < 0) start = t.search(/Grupo\s*1\b/i);
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(/VALOR TOTAL M.XIMO ESTIMADO/i);
      if (end > 200) region = region.slice(0, end);
      var flat = repairSplitRs(region);
      var pairs = [];
      String(flat).replace(
        new RegExp(
          "(\\d{1,5})\\s+R\\$\\s*" + moneyBrRe() + "\\s+R\\$\\s*" + moneyBrRe(),
          "g"
        ),
        function (whole, qtdRaw, uRaw, tRaw, idx) {
          var qtd = utils.parseBrNum(qtdRaw);
          var vu = utils.parseBrNum(uRaw);
          var vt = utils.parseBrNum(tRaw);
          if (!(qtd > 0) || !(vu > 0) || !(vt > 0)) return whole;
          var rel = Math.abs(qtd * vu - vt) / Math.max(vt, qtd * vu, 1);
          if (rel > 0.08) return whole;
          pairs.push({ qtd: qtd, vu: vu, vt: vt, index: idx, len: whole.length });
          return whole;
        }
      );
      if (pairs.length < 8) return [];
      var byItem = {};
      var expected = 1;
      var i;
      for (i = 0; i < pairs.length; i++) {
        var prevEnd = i ? pairs[i - 1].index + pairs[i - 1].len : 0;
        var chunk = flat.slice(prevEnd, pairs[i].index);
        var itemNo = expected;
        var foundIdx = -1;
        String(chunk).replace(/\b(\d{1,3})\b/g, function (w, n, idx) {
          if (parseInt(n, 10) === expected) foundIdx = idx;
          return w;
        });
        var desc = chunk;
        if (foundIdx >= 0) {
          var before = chunk.slice(0, foundIdx).replace(/\s+/g, " ").trim();
          var after = chunk.slice(foundIdx + String(expected).length).replace(/\s+/g, " ").trim();
          if (before.length > 200) {
            var cap = before.search(/[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^]{12,}$/);
            if (cap < 0) cap = Math.max(0, before.length - 180);
            before = before.slice(cap).replace(/^\S*[a-záéíóú]{2,}\s+/, "");
          }
          desc = (before + " " + after).trim();
        }
        desc = cleanPiraquaraDesc(desc, itemNo);
        var packed = packMunicipioRow(
          itemNo,
          pairs[i].qtd,
          "UN",
          desc,
          pairs[i].vu,
          pairs[i].vt
        );
        if (utils.isLinhaProdutoEdital(packed)) {
          byItem[itemNo] = packed;
          expected++;
        }
      }
      var keysP = Object.keys(byItem)
        .map(function (k) {
          return parseInt(k, 10);
        })
        .sort(function (a, b) {
          return a - b;
        });
      var outP = [];
      for (i = 0; i < keysP.length; i++) outP.push(byItem[keysP[i]]);
      return outP.length >= 8 ? outP : [];
    }

    /**
     * Águas de Sarandi — Item COD Produto Unid Quant R$ unit R$ total.
     * Nº 110 vira "11 0 73794"; qtd 20 vira "2 0"; unidade pode ser UNID./ROLO/BARRA/MT.
     */
    function splitSarandiEletricosBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var f = foldCeu(t);
      if (f.indexOf("sarandi") < 0 && f.indexOf("929307") < 0) return [];
      var start = t.search(/Item\s+COD\s+Produto/i);
      if (start < 0) start = t.search(/1\s+77739\b/);
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(/VALOR TOTAL DO CERTAME/i);
      if (end > 200) region = region.slice(0, end);
      var flat = repairSplitRs(region);
      flat = flat.replace(/\b(UNID|UND|UNIDADE|UN|ROLO|BARRA|METRO|MT|M)\./gi, "$1");
      flat = flat.replace(/(\d{2})\s+(\d)\s+(\d{5})/g, function (_, a, b, cod) {
        var n = parseInt(a, 10) * 10 + parseInt(b, 10);
        if (n >= 100 && n <= 250) return n + " " + cod;
        return a + " " + b + " " + cod;
      });
      var undTok = "UNID|UND|UNIDADE|UN|ROLO|BARRA|METRO|MT|M";
      flat = flat.replace(
        new RegExp("\\b(" + undTok + ")\\b\\s+(\\d{1,3})\\s+(\\d{1,3})\\s+R\\$", "gi"),
        function (w, u, a, b) {
          if (b.length === 1 && b !== "0") return w;
          var n = parseInt(String(a) + String(b), 10);
          if (n >= 10 && n <= 20000) return u + " " + n + " R$";
          return w;
        }
      );
      var pairsS = [];
      String(flat).replace(
        new RegExp(
          "\\b(" +
            undTok +
            ")\\b\\s+(\\d{1,5})\\s+R\\$\\s*" +
            moneyBrRe() +
            "\\s+R\\$\\s*" +
            moneyBrRe(),
          "gi"
        ),
        function (whole, und, qtdRaw, uRaw, tRaw, idx) {
          var qtd = utils.parseBrNum(qtdRaw);
          var vu = utils.parseBrNum(uRaw);
          var vt = utils.parseBrNum(tRaw);
          if (!(qtd > 0) || !(vu > 0) || !(vt > 0)) return whole;
          var rel = Math.abs(qtd * vu - vt) / Math.max(vt, qtd * vu, 1);
          if (rel > 0.08) return whole;
          pairsS.push({
            und: und,
            qtd: qtd,
            vu: vu,
            vt: vt,
            index: idx,
            len: whole.length
          });
          return whole;
        }
      );
      String(flat).replace(
        new RegExp(
          "(\\d{1,5})\\s+R\\$\\s*" + moneyBrRe() + "\\s+R\\$\\s*" + moneyBrRe(),
          "g"
        ),
        function (whole, qtdRaw, uRaw, tRaw, idx) {
          var qtd = utils.parseBrNum(qtdRaw);
          var vu = utils.parseBrNum(uRaw);
          var vt = utils.parseBrNum(tRaw);
          if (!(qtd > 0) || !(vu > 0) || !(vt > 0)) return whole;
          var rel = Math.abs(qtd * vu - vt) / Math.max(vt, qtd * vu, 1);
          if (rel > 0.08) return whole;
          var ov = false;
          var oi;
          for (oi = 0; oi < pairsS.length; oi++) {
            if (idx < pairsS[oi].index + pairsS[oi].len && idx + whole.length > pairsS[oi].index) {
              ov = true;
              break;
            }
          }
          if (ov) return whole;
          pairsS.push({
            und: "UN",
            qtd: qtd,
            vu: vu,
            vt: vt,
            index: idx,
            len: whole.length
          });
          return whole;
        }
      );
      pairsS.sort(function (a, b) {
        return a.index - b.index;
      });
      if (pairsS.length < 8) return [];
      var byItem = {};
      var expected = 1;
      var ps;
      for (ps = 0; ps < pairsS.length; ps++) {
        var prevEndS = ps ? pairsS[ps - 1].index + pairsS[ps - 1].len : 0;
        var chunkS = flat.slice(prevEndS, pairsS[ps].index);
        var itemNo = expected;
        var cod = "";
        var descS = chunkS;
        var lastHead = null;
        String(chunkS).replace(/(\d{1,3})\s+(\d{5})/g, function (w, n, c, idx) {
          lastHead = {
            n: parseInt(n, 10),
            c: c,
            rest: chunkS.slice(idx + w.length),
            idx: idx
          };
          return w;
        });
        if (!lastHead) {
          String(chunkS).replace(/(\d{5})\s+(\d{1,3})/g, function (w, c, n, idx) {
            lastHead = {
              n: parseInt(n, 10),
              c: c,
              rest: chunkS.slice(idx + w.length),
              idx: idx
            };
            return w;
          });
        }
        if (lastHead && lastHead.n >= 1 && lastHead.n <= 250) {
          itemNo = lastHead.n;
          cod = lastHead.c;
          descS = chunkS.slice(0, lastHead.idx) + " " + lastHead.rest;
        }
        descS = String(descS || "")
          .replace(/\bItem\s+COD\s+Produto[^\s]*/gi, " ")
          .replace(/\bImagem\b/gi, " ")
          .replace(/\bUnid\.?\s+Quant\s+(?:Valor\s+Max\.?\s+)*Unit\s+(?:Valor\s+Max\.?\s+)*Total\b/gi, " ")
          .replace(/\bPreg.o Eletr.nico n.?\s*[\d/]+/gi, " ")
          .replace(/\bP[aá]gina\s+\d+\s+de\s+\d+/gi, " ")
          .replace(/\bVALOR TOTAL[^\d]{0,50}/gi, " ")
          .replace(/\bGRUPO\s+\d+[^\d]{0,90}/gi, " ")
          .replace(/\bImagem\b/gi, " ")
          .replace(/\bANEXO I\b/gi, " ")
          .replace(/\bTERMO DE REFER.NCIA\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim();
        if (descS.length > 700) descS = descS.slice(-700).replace(/^\S*\s/, "");
        if (!descS || descS.length < 3) descS = "Item " + itemNo + (cod ? " COD " + cod : "");
        var packedS = packMunicipioRow(
          itemNo,
          pairsS[ps].qtd,
          pairsS[ps].und,
          descS,
          pairsS[ps].vu,
          pairsS[ps].vt
        );
        if (utils.isLinhaProdutoEdital(packedS)) {
          if (!byItem[itemNo]) byItem[itemNo] = packedS;
          expected = itemNo + 1;
        }
      }
      var keysS = Object.keys(byItem)
        .map(function (k) {
          return parseInt(k, 10);
        })
        .sort(function (a, b) {
          return a - b;
        });
      var outS = [];
      var ks;
      for (ks = 0; ks < keysS.length; ks++) outS.push(byItem[keysS[ks]]);
      return outS.length >= 8 ? outS : [];
    }

    /**
     * Tomazina Natal — LOTE N + ITEM/UND/QTD/R$ (páginas 3–9; ignora repetição do TR).
     * Rótulo "LOTE N" cai no meio do lote; item 1 seguinte (ou marca vizinha) troca o lote.
     */
    function splitTomazinaNatalBlocks(full) {
      var t = limparPagina(full).replace(/\r\n?/g, "\n");
      var f = foldCeu(t);
      if (f.indexOf("tomazina") < 0) return [];
      var start = t.search(/ITEM\s+UND\s+QTD\s+DESCRI/i);
      if (start < 0) start = t.search(/LOTE\s*1\s+\d+\s+metros/i);
      if (start < 0) return [];
      var region = t.slice(start);
      var end = region.search(/TOTAL DOS LOTES/i);
      if (end > 80) region = region.slice(0, end);
      region = region.replace(
        /PREFEITURA MUNICIPAL DE TOMAZINA[\s\S]{0,280}?3563-1133/gi,
        "\n"
      );
      var flat = repairSplitRs(region);
      var loteMarks = [];
      String(flat).replace(/LOTE\s+(\d+)/gi, function (w, n, idx) {
        var num = parseInt(n, 10);
        if (num >= 1 && num <= 40) loteMarks.push({ n: num, idx: idx });
        return w;
      });
      var undWord =
        "metros|und|unid|pe[cç]as|pe[cç]a|conjuntos|conjunto|gal[aã]o|galao|rolos|rolo|servi[cç]o|horas|hrs|hora|dia";
      var heads = [];
      String(flat).replace(
        /\b12\s+(\d{1,5})\s+horas\s+horas\b/gi,
        function (w, q, idx) {
          heads.push({
            itemNo: 1,
            loteHint: 12,
            qtd: utils.parseBrNum(q),
            und: "HORA",
            idx: idx,
            len: w.length
          });
          return w;
        }
      );
      String(flat).replace(
        /\b(\d{1,2})\s+DIA\s+(\d{1,5})\s+DIAS\b/gi,
        function (w, item, q, idx) {
          heads.push({
            itemNo: parseInt(item, 10),
            loteHint: 0,
            qtd: utils.parseBrNum(q),
            und: "DIA",
            idx: idx,
            len: w.length
          });
          return w;
        }
      );
      String(flat).replace(
        new RegExp(
          "\\b(\\d{1,2})\\s+(" + undWord + ")\\s+(\\d{1,5})\\b",
          "gi"
        ),
        function (w, item, und, q, idx) {
          heads.push({
            itemNo: parseInt(item, 10),
            loteHint: 0,
            qtd: utils.parseBrNum(q),
            und: und,
            idx: idx,
            len: w.length
          });
          return w;
        }
      );
      String(flat).replace(
        /\b(\d{1,2})\s+(\d{1,5})\s+(servi[cç]o|horas|hrs)\b/gi,
        function (w, item, q, und, idx) {
          heads.push({
            itemNo: parseInt(item, 10),
            loteHint: 0,
            qtd: utils.parseBrNum(q),
            und: und,
            idx: idx,
            len: w.length
          });
          return w;
        }
      );
      String(flat).replace(
        /\b(\d{1,2})\s+(\d{1,5})\s+HRS\s+horas\b/gi,
        function (w, item, q, idx) {
          heads.push({
            itemNo: parseInt(item, 10),
            loteHint: 0,
            qtd: utils.parseBrNum(q),
            und: "HORA",
            idx: idx,
            len: w.length
          });
          return w;
        }
      );
      heads.sort(function (a, b) {
        return a.idx - b.idx;
      });
      var uniq = [];
      var hi;
      for (hi = 0; hi < heads.length; hi++) {
        var prevH = uniq[uniq.length - 1];
        if (prevH && heads[hi].idx < prevH.idx + prevH.len) continue;
        if (heads[hi].itemNo < 1 || heads[hi].itemNo > 20) continue;
        if (!(heads[hi].qtd > 0)) continue;
        uniq.push(heads[hi]);
      }
      heads = uniq;
      if (heads.length < 4) return [];

      function nearbyLote(idx) {
        var best = 0;
        var bm;
        for (bm = 0; bm < loteMarks.length; bm++) {
          var d = loteMarks[bm].idx - idx;
          if (d >= -90 && d <= 50) best = loteMarks[bm].n;
        }
        return best;
      }

      function nextLoteAfter(idx) {
        var bm;
        for (bm = 0; bm < loteMarks.length; bm++) {
          if (loteMarks[bm].idx >= idx) return loteMarks[bm].n;
        }
        return 0;
      }

      function pricesAfter(from, to, qtd) {
        var slice = flat.slice(from, to);
        function almost(a, b) {
          return Math.abs(a - b) / Math.max(a, b, 1) <= 0.08;
        }
        function pickPair(list) {
          var i;
          var j;
          for (i = 0; i < list.length; i++) {
            for (j = i + 1; j < list.length; j++) {
              var a = list[i].n;
              var b = list[j].n;
              if (!(a > 0) || b < a) continue;
              if (almost(qtd * a, b)) return { vu: a, vt: b };
            }
          }
          return null;
        }
        return (
          pickPair(collectBrMoney(slice, true)) ||
          pickPair(collectBrMoney(slice, false)) || { vu: 0, vt: 0 }
        );
      }

      var outT = [];
      var curLote = 1;
      var prevItemNo = 0;
      for (hi = 0; hi < heads.length; hi++) {
        var h = heads[hi];
        var nextIdx = hi + 1 < heads.length ? heads[hi + 1].idx : flat.length;
        var pr = pricesAfter(h.idx, nextIdx, h.qtd);
        var vu = pr.vu;
        var vt = pr.vt;
        var qtd = h.qtd;
        if (!(qtd > 0) || !(vu > 0) || !(vt > 0)) continue;
        var loteNo = h.loteHint || nearbyLote(h.idx);
        if (!loteNo) {
          if (h.itemNo === 1 && prevItemNo > 1) loteNo = curLote + 1;
          else if (h.itemNo === 1 && prevItemNo === 1) loteNo = nextLoteAfter(h.idx) || curLote + 1;
          else loteNo = curLote;
        }
        curLote = loteNo;
        prevItemNo = h.itemNo;
        var desc = flat.slice(h.idx + h.len, Math.min(nextIdx, h.idx + h.len + 900));
        var headJunkPat =
          "\\b\\d{1,2}\\s+(metros|und|unid|pe[cç]as|pe[cç]a|conjuntos|conjunto|gal[aã]o|galao|rolos|rolo|servi[cç]o|horas|hrs|hora|dia)\\s+\\d{1,5}\\b";
        function stripTomazinaDesc(s) {
          return String(s || "")
            .replace(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/g, " ")
            .replace(/LOTE\s+\d+/gi, " ")
            .replace(/ITEM\s+UND\s+QTD\s+DESCRI[^\s]*/gi, " ")
            .replace(/ITEM\s+QUANT\.?\s+UND\s+PRODUTO/gi, " ")
            .replace(/PRE.O UNT/gi, " ")
            .replace(/PRE.O TOTAL/gi, " ")
            .replace(/\bPRE[CÇ]O\b/gi, " ")
            .replace(new RegExp(headJunkPat, "gi"), " ")
            .replace(/\s+/g, " ")
            .trim();
        }
        desc = stripTomazinaDesc(desc);
        var beforeD = stripTomazinaDesc(flat.slice(Math.max(0, h.idx - 220), h.idx));
        if (beforeD.length > 160) beforeD = beforeD.slice(-160).replace(/^\S*\s/, "");
        desc = (beforeD + " " + desc).replace(/\s+/g, " ").trim();
        if (desc.length > 700) desc = desc.slice(0, 700).replace(/\s+\S*$/, "");
        if (!desc || desc.length < 3) desc = "Lote " + loteNo + " item " + h.itemNo;
        var packedT = packMunicipioRow(
          loteNo + "." + h.itemNo,
          qtd,
          h.und,
          desc,
          vu,
          vt
        );
        if (utils.isLinhaProdutoEdital(packedT)) outT.push(packedT);
      }
      return outT.length >= 4 ? outT : [];
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
    deps.splitPiraquaraBlocks = splitPiraquaraBlocks;
    deps.splitSarandiEletricosBlocks = splitSarandiEletricosBlocks;
    deps.splitTomazinaNatalBlocks = splitTomazinaNatalBlocks;

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
            var f = foldCeu(raw);
            return (
              (f.indexOf("ceu azul") >= 0 &&
                (f.indexOf("valor unitario") >= 0 ||
                  f.indexOf("lotes exclusivos me epp") >= 0 ||
                  /,\d{4}\s+\d{1,3}(?:\.\d{3})*,\d{4}/.test(String(raw || "")))) ||
              (f.indexOf("lotes exclusivos me epp") >= 0 &&
                f.indexOf("descricao do produto") >= 0)
            );
          }
        },
        {
          id: "piraquara-tr",
          label: "Piraquara — TR Grupo/Item QTD R$ R$",
          family: "municipais",
          split: "splitPiraquaraBlocks",
          minItems: 12,
          priority: 33,
          tryWithoutHint: true,
          hint: function (raw) {
            var f = foldCeu(raw);
            return (
              f.indexOf("piraquara") >= 0 &&
              (f.indexOf("valor unit") >= 0 || f.indexOf("descricao dos itens") >= 0)
            );
          }
        },
        {
          id: "sarandi-eletricos",
          label: "Sarandi — Item/COD/UNID/R$ (materiais elétricos)",
          family: "municipais",
          split: "splitSarandiEletricosBlocks",
          minItems: 12,
          priority: 34,
          tryWithoutHint: true,
          hint: function (raw) {
            var f = foldCeu(raw);
            return (
              (f.indexOf("sarandi") >= 0 || f.indexOf("929307") >= 0) &&
              (f.indexOf("item") >= 0 && f.indexOf("cod") >= 0 && /R\$/.test(String(raw || "")))
            );
          }
        },
        {
          id: "tomazina-natal",
          label: "Tomazina — LOTE/ITEM/UND/QTD/R$ (decoração natalina)",
          family: "municipais",
          split: "splitTomazinaNatalBlocks",
          minItems: 6,
          priority: 35,
          tryWithoutHint: true,
          hint: function (raw) {
            var f = foldCeu(raw);
            return (
              f.indexOf("tomazina") >= 0 &&
              (f.indexOf("preco unt") >= 0 || f.indexOf("item und qtd") >= 0 || f.indexOf("total dos lotes") >= 0)
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
