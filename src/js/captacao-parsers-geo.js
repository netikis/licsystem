/* LICSYSTEM — parser geométrico de tabela (camada universal)
 *
 * Usa X/Y do pdf.js para achar colunas (item, descrição, qtd, und, v.unit, v.total)
 * sem depender do nome do município.
 */
(function (LICSYSTEM) {
  "use strict";

  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});
  var UND_RE =
    /^(UN|UND|UNID\.?|UNIDADE|PC|PCT|P[CÇ]|KG|G|M|M2|M3|ML|L|LT|CX|PAR|JG|KIT|RL|ROLO|GL|GAL|SC|SACO|TON|HR|VB|SERV|PR|POTE|CJ|CONJ)$/i;
  var HEADER_RE =
    /^(item|lote|qtd|qtde|quant|und\.?|unid|descri|especif|valor|unit|total|c[oó]d|produto|ordem|n[ºo°]|max\.?)$/i;
  var SKIP_ROW_RE =
    /^(prefeitura|estado|munic[ií]pio|edital|p[aá]gina|cnpj|e-mail|processo|anexo|rela[cç][aã]o dos itens)\b/i;
  var GROUP_LOTE_RE = /^lote\s+\d+\s*:/i;
  var LEGEND_ROW_RE = /^(ptl|pum[aá]x|ptm[aá]x|und|qtd|abrevia[cç][oõ]es)\s*:/i;
  var CLAUSE_HEAD_RE =
    /^(da|do|dos|das)\s+(fase|recurso|disposi[cç]|penalidade|habilita|julgamento|objeto)\b/i;
  var DOTACAO_RE = /^\d{2}\.\d{2,3}\.\d+/;
  var SECTION_TITLE_RE =
    /^(?:\d{1,2}\s+)?(objeto|requisitos da contrata[cç][aã]o|subcontrata[cç][aã]o|especifica[cç][aã]o do objeto)\b/i;

  function parseNum(utils, raw) {
    var s = String(raw || "").replace(/R\$/gi, "").trim();
    if (!s) return 0;
    if (utils && typeof utils.parseBrNum === "function") return utils.parseBrNum(s) || 0;
    var t = s.replace(/\./g, "").replace(",", ".");
    var n = parseFloat(t);
    return isFinite(n) ? n : 0;
  }

  function almostEq(a, b) {
    if (!(a > 0) || !(b > 0)) return false;
    return Math.abs(a - b) / Math.max(a, b) <= 0.05;
  }

  function isMoneyText(t) {
    var s = String(t || "").replace(/\s/g, "");
    if (/^R\$/.test(s)) return true;
    if (/^\d{1,3}(?:\.\d{3})+,\d{2}$/.test(s)) return true;
    if (/^\d{1,6},\d{2}$/.test(s)) return true;
    if (/^\d{1,4},\d{4}$/.test(s)) return true;
    return false;
  }

  function isQtyText(t) {
    var s = String(t || "").replace(/\s/g, "");
    if (/^\d{1,6}(?:\.\d{3})*,\d{3}$/.test(s)) return true;
    if (/^\d{1,5}$/.test(s) && Number(s) > 0 && Number(s) < 100000) return true;
    return false;
  }

  function isItemNum(t) {
    var s = String(t || "").trim();
    return /^\d{1,4}$/.test(s) && Number(s) >= 1 && Number(s) < 5000;
  }

  function splitLeadingItem(t) {
    var s = String(t || "").trim();
    var m = s.match(/^(\d{1,4})(?:\s+(.+))?$/);
    if (!m) return null;
    var n = Number(m[1]);
    if (!(n >= 1 && n < 5000)) return null;
    var rest = String(m[2] || "").trim();
    if (rest && (UND_RE.test(rest) || isMoneyText(rest) || isQtyText(rest))) return null;
    return { lote: String(n), rest: rest };
  }

  function isClauseFirstCell(t) {
    return /^\d{1,2}\.\d{1,2}\b/.test(String(t || "").trim());
  }

  function mergeRsCells(cells) {
    var out = [];
    for (var i = 0; i < cells.length; i++) {
      var t = String(cells[i].text || "").trim();
      if (/^R\$$/i.test(t) && cells[i + 1]) {
        out.push({
          x: cells[i].x,
          w: (cells[i + 1].x + cells[i + 1].w) - cells[i].x,
          text: "R$ " + String(cells[i + 1].text || "").trim()
        });
        i++;
      } else {
        out.push(cells[i]);
      }
    }
    return out;
  }

  function rowText(row) {
    return ((row && row.cells) || [])
      .map(function (c) {
        return c.text;
      })
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function isHeaderRow(cells) {
    if (!cells.length) return true;
    var hits = 0;
    for (var i = 0; i < cells.length; i++) {
      var t = String(cells[i].text || "").replace(/[.:]/g, "").trim();
      var first = t.split(/\s+/)[0] || "";
      if (HEADER_RE.test(first) || HEADER_RE.test(t)) hits++;
    }
    return hits >= Math.max(2, Math.ceil(cells.length * 0.45));
  }

  /**
   * Agrupa itens do pdf.js em linhas/células pela posição X/Y.
   */
  bag.clusterPdfTextItems = function (tcItems) {
    var items = (tcItems || []).filter(function (it) {
      return String((it && it.str) || "").trim();
    });
    items.sort(function (a, b) {
      var ya = a.transform ? a.transform[5] : 0;
      var yb = b.transform ? b.transform[5] : 0;
      if (Math.abs(ya - yb) > 3.2) return yb - ya;
      var xa = a.transform ? a.transform[4] : 0;
      var xb = b.transform ? b.transform[4] : 0;
      return xa - xb;
    });

    var rows = [];
    var cur = null;
    var Y_TOL = 3.4;

    function flush() {
      if (!cur) return;
      cur.tokens.sort(function (a, b) {
        return a.x - b.x;
      });
      var cells = [];
      for (var i = 0; i < cur.tokens.length; i++) {
        var tk = cur.tokens[i];
        var last = cells[cells.length - 1];
        var gap = last ? tk.x - (last.x + last.w) : 999;
        if (last && gap < 8.5) {
          var space = gap > 1.6 ? " " : "";
          last.text += space + tk.text;
          last.w = Math.max(last.w, tk.x + tk.w - last.x);
        } else {
          cells.push({
            x: tk.x,
            w: tk.w,
            text: String(tk.text || "").replace(/\s+/g, " ").trim()
          });
        }
      }
      cells = mergeRsCells(
        cells.filter(function (c) {
          return c.text;
        })
      );
      if (cells.length) {
        rows.push({ y: cur.y, cells: cells });
      }
      cur = null;
    }

    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var x = it.transform ? it.transform[4] : 0;
      var y = it.transform ? it.transform[5] : 0;
      var w = Number(it.width) || 0;
      var str = String(it.str || "");
      if (!cur || Math.abs(y - cur.y) > Y_TOL) {
        flush();
        cur = { y: y, tokens: [{ x: x, w: w, text: str }] };
      } else {
        cur.tokens.push({ x: x, w: w, text: str });
        cur.y = (cur.y * (cur.tokens.length - 1) + y) / cur.tokens.length;
      }
    }
    flush();

    var lines = rows.map(rowText);
    return { rows: rows, text: lines.join("\n") };
  };

  function classifyRow(row, utils) {
    var cells = mergeRsCells((row && row.cells) || []);
    var text = rowText({ cells: cells });
    if (!text || SKIP_ROW_RE.test(text)) return { skip: true };
    if (GROUP_LOTE_RE.test(text) || LEGEND_ROW_RE.test(text) || CLAUSE_HEAD_RE.test(text)) {
      return { skip: true };
    }
    if (SECTION_TITLE_RE.test(text) || DOTACAO_RE.test(text)) return { skip: true };
    if (cells.length && isClauseFirstCell(cells[0].text)) {
      var clauseHasUnd = false;
      for (var ci = 0; ci < cells.length; ci++) {
        if (UND_RE.test(String(cells[ci].text || "").trim())) {
          clauseHasUnd = true;
          break;
        }
      }
      if (!clauseHasUnd) return { skip: true };
    }
    if (isHeaderRow(cells)) return { skip: true, header: true };

    var used = {};
    var lote = "";
    if (cells.length) {
      var lead = splitLeadingItem(cells[0].text);
      if (lead) {
        lote = lead.lote;
        if (lead.rest) {
          cells[0] = {
            x: cells[0].x,
            w: cells[0].w,
            text: lead.rest
          };
        } else {
          used[0] = 1;
        }
      }
    }

    var moneyIdx = [];
    var qtyIdx = [];
    var undIdx = -1;
    var i;
    for (i = 0; i < cells.length; i++) {
      if (used[i]) continue;
      var t = String(cells[i].text || "").trim();
      if (UND_RE.test(t)) undIdx = i;
      else if (isMoneyText(t)) moneyIdx.push(i);
      else if (isQtyText(t)) qtyIdx.push(i);
    }

    var vunit = 0;
    var vtotal = 0;
    if (moneyIdx.length >= 2) {
      vtotal = parseNum(utils, cells[moneyIdx[moneyIdx.length - 1]].text);
      vunit = parseNum(utils, cells[moneyIdx[moneyIdx.length - 2]].text);
      used[moneyIdx[moneyIdx.length - 1]] = 1;
      used[moneyIdx[moneyIdx.length - 2]] = 1;
      if (vunit > vtotal && vtotal > 0) {
        var tmp = vunit;
        vunit = vtotal;
        vtotal = tmp;
      }
    } else if (moneyIdx.length === 1) {
      vunit = parseNum(utils, cells[moneyIdx[0]].text);
      used[moneyIdx[0]] = 1;
    }

    var qtd = 0;
    if (undIdx >= 0) {
      used[undIdx] = 1;
      var around = [undIdx - 1, undIdx + 1];
      for (i = 0; i < around.length; i++) {
        var ai = around[i];
        if (ai >= 0 && ai < cells.length && !used[ai] && isQtyText(cells[ai].text)) {
          qtd = parseNum(utils, cells[ai].text);
          used[ai] = 1;
          break;
        }
      }
    }
    if (!qtd) {
      for (i = 0; i < qtyIdx.length; i++) {
        if (used[qtyIdx[i]]) continue;
        var cand = parseNum(utils, cells[qtyIdx[i]].text);
        if (cand > 0) {
          qtd = cand;
          used[qtyIdx[i]] = 1;
          break;
        }
      }
    }
    if (!qtd && vunit > 0 && vtotal > 0 && vtotal >= vunit) {
      var inferred = vtotal / vunit;
      if (inferred >= 0.5 && inferred < 1e6) qtd = Math.round(inferred * 1000) / 1000;
    }

    var descParts = [];
    for (i = 0; i < cells.length; i++) {
      if (used[i]) continue;
      var ct = String(cells[i].text || "").trim();
      if (!ct) continue;
      if (HEADER_RE.test(ct) && ct.length < 14) continue;
      descParts.push(ct);
    }
    var produto = descParts.join(" ").replace(/\s+/g, " ").trim();
    if (utils && typeof utils.enxugarDescricaoEdital === "function") {
      produto = utils.enxugarDescricaoEdital(produto);
    }

    var und = undIdx >= 0 ? String(cells[undIdx].text || "UN").toUpperCase().replace(/\.$/, "") : "UN";
    if (und.length > 6) und = "UN";

    if (!vunit && !vtotal && CLAUSE_HEAD_RE.test(produto)) return { skip: true };

    return {
      skip: false,
      lote: lote,
      qtd: qtd,
      und: und,
      produto: produto,
      editalVunit: vunit,
      editalTotal: vtotal || (vunit && qtd ? vunit * qtd : 0),
      hasPrices: vunit > 0 || vtotal > 0,
      hasQty: qtd > 0,
      hasDesc: produto.length >= 3
    };
  }

  function packItem(row, utils) {
    if (!row || !row.hasDesc || !(row.hasQty || row.hasPrices)) return null;
    var qtd = Number(row.qtd) || 0;
    if (!qtd) qtd = 1;
    var vunit = Number(row.editalVunit) || 0;
    var vtotal = Number(row.editalTotal) || 0;
    if (!vtotal && vunit && qtd) vtotal = qtd * vunit;
    if (vunit && vtotal && qtd && !almostEq(qtd * vunit, vtotal) && almostEq(vtotal / vunit, qtd)) {
      qtd = Math.round((vtotal / vunit) * 1000) / 1000;
    }
    var produto = String(row.produto || "").trim();
    if (produto.length < 3) return null;
    var lote = String(row.lote || "").trim();
    var und = String(row.und || "UN").toUpperCase();
    var line =
      (lote ? lote + " " : "") +
      qtd +
      " " +
      und +
      " " +
      produto;
    if (vunit > 0) line += " " + vunit;
    if (vtotal > 0) line += " " + vtotal;
    return {
      lote: lote,
      qtd: qtd,
      und: und,
      produto: produto,
      editalVunit: vunit,
      editalTotal: vtotal,
      line: line
    };
  }

  bag.countGeoCandidates = function (geom) {
    var n = 0;
    ((geom && geom.pages) || []).forEach(function (page) {
      (page.rows || []).forEach(function (row) {
        var t = rowText(row);
        if (!t || SKIP_ROW_RE.test(t) || isHeaderRow(row.cells || [])) return;
        if (/\d/.test(t) && /[A-Za-zÁ-ú]/.test(t)) n++;
      });
    });
    return n;
  };

  bag.splitGeometricBlocks = function (text, geom, deps) {
    deps = deps || {};
    var utils = deps.utils || (LICSYSTEM && LICSYSTEM.utils) || {};
    if (!geom || !geom.pages || !geom.pages.length) return [];

    var items = [];
    var open = null;

    function flush() {
      var packed = packItem(open, utils);
      if (packed) items.push(packed);
      open = null;
    }

    geom.pages.forEach(function (page) {
      (page.rows || []).forEach(function (row) {
        var c = classifyRow(row, utils);
        if (c.skip) {
          if (open && open.hasPrices && open.hasQty) flush();
          return;
        }

        var newItem = !!(c.lote && (c.hasQty || c.hasPrices) && c.hasDesc);
        if (!newItem && c.hasPrices && c.hasDesc && !(open && !open.hasPrices)) {
          newItem = true;
        }
        if (newItem) {
          flush();
          open = c;
          return;
        }
        if (!open) return;

        if (c.hasPrices) {
          if (!open.hasPrices) {
            open.editalVunit = c.editalVunit || open.editalVunit;
            open.editalTotal = c.editalTotal || open.editalTotal;
            open.hasPrices = true;
          }
          if (!open.hasQty && c.hasQty) {
            open.qtd = c.qtd;
            open.hasQty = true;
          }
          if (c.und && c.und !== "UN" && open.und === "UN") open.und = c.und;
        }
        if (c.hasQty && !open.hasQty) {
          open.qtd = c.qtd;
          open.hasQty = true;
          if (c.und && open.und === "UN") open.und = c.und;
        }
        if (c.hasDesc) {
          var legalTail =
            /^(concord[aâ]ncia|havendo|ser[aã]o observados|nos termos)\b/i.test(c.produto) ||
            /\b(concord[aâ]ncia das partes|limites da lei|reequil[ií]brio|compet[eê]ncia tribut[aá]ria)\b/i.test(
              c.produto
            ) ||
            SECTION_TITLE_RE.test(c.produto);
          if (legalTail && open.hasPrices && open.hasQty) {
            flush();
            return;
          }
          open.produto = (open.produto + " " + c.produto).replace(/\s+/g, " ").trim();
          open.hasDesc = true;
        }
      });
    });
    flush();
    return items;
  };
})(window.LICSYSTEM || (window.LICSYSTEM = {}));
