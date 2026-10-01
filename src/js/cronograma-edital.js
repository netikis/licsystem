/* LICSYSTEM — CRONOGRAMA: nova licitação a partir do PDF do edital
 *
 * Ela joga o PDF, o sistema lê número, município, plataforma, data/hora,
 * valor e objeto, mostra um resumo do que fazer e lança no cronograma
 * (com o PDF anexado) ou no calendário (.ics).
 * Regex só com ASCII: o texto é dobrado (sem acento) antes de procurar.
 */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }

  function utils(){ return LICSYSTEM.utils || {}; }

  function fold(s){
    var u = utils();
    if (typeof u.fold === "function") return String(u.fold(s) || "");
    return String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function esc(s){
    var u = utils();
    if (typeof u.escapeHtml === "function") return u.escapeHtml(s);
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function parseBr(v){
    var u = utils();
    if (typeof u.parseBrNum === "function") return u.parseBrNum(v);
    var s = String(v || "").replace(/\./g, "").replace(",", ".");
    var n = parseFloat(s);
    return isFinite(n) ? n : 0;
  }

  function money(n){
    n = Number(n) || 0;
    return n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function pad2(n){ return ("0" + n).slice(-2); }

  function titleCase(s){
    var small = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1 };
    return String(s || "")
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map(function (w, i) {
        if (i > 0 && small[w]) return w;
        return w.charAt(0).toUpperCase() + w.slice(1);
      })
      .join(" ");
  }

  /** Texto dobrado (sem acento) com o mesmo comprimento do original, p/ fatiar o original. */
  function foldSameLength(t){
    var f = fold(t);
    if (f.length === t.length) return f;
    // Raro (caracteres compostos que mudam de tamanho): dobra char a char.
    var out = "";
    for (var i = 0; i < t.length; i++) {
      var c = fold(t.charAt(i));
      out += c.length === 1 ? c : t.charAt(i);
    }
    return out;
  }

  function cleanSpaces(s){
    return String(s || "").replace(/\s+/g, " ").trim();
  }

  /* ---------------- extração ---------------- */

  function acharNumero(f){
    var res = [
      /preg[a]o\s+(?:eletronico|presencial)?\s*(?:n\s*[^\w\s]?|numero|no\.?)?\s*[:.]?\s*(\d{1,4})\s*\/\s*(20\d{2})/i,
      /(?:edital|concorrencia|dispensa|tomada\s+de\s+precos|chamamento|leilao|credenciamento)[^\d\n]{0,40}?(\d{1,4})\s*\/\s*(20\d{2})/i,
      /processo\s+(?:licitatorio|administrativo)?[^\d\n]{0,30}?(\d{1,4})\s*\/\s*(20\d{2})/i,
      /\b(\d{1,4})\s*\/\s*(20\d{2})\b/
    ];
    for (var i = 0; i < res.length; i++) {
      var m = res[i].exec(f);
      if (m) {
        var n = m[1];
        if (n.length < 3) n = ("000" + n).slice(-3);
        return n + "/" + m[2];
      }
    }
    return "";
  }

  function acharModalidade(f){
    if (/preg[a]o\s+eletronico/i.test(f)) return "Pregão Eletrônico";
    if (/preg[a]o\s+presencial/i.test(f)) return "Pregão Presencial";
    if (/concorrencia\s+eletronica/i.test(f)) return "Concorrência Eletrônica";
    if (/\bconcorrencia\b/i.test(f)) return "Concorrência";
    if (/dispensa\s+(?:eletronica|de\s+licitacao)/i.test(f)) return "Dispensa";
    if (/\bleilao\b/i.test(f)) return "Leilão";
    if (/tomada\s+de\s+precos/i.test(f)) return "Tomada de Preços";
    if (/\bpregao\b/i.test(f)) return "Pregão";
    return "";
  }

  function acharMunicipio(t, f){
    var re = /(?:prefeitura\s+(?:municipal\s+)?de|municipio\s+de|camara\s+municipal\s+de)\s+([a-z][a-z' ]{2,40}?)(?=\s*(?:[-\/,(\n]|\u2013|estado\b|\b(?:pr|sp|sc|rs|mg|ms|go|mt|ba|rj|es)\b|cnpj|$))/gi;
    var counts = {};
    var best = "";
    var bestN = 0;
    var m;
    while ((m = re.exec(f)) !== null) {
      var start = m.index + m[0].length - m[1].length;
      var raw = cleanSpaces(t.slice(start, start + m[1].length));
      var key = fold(raw).toLowerCase();
      if (!key || key.length < 3) continue;
      if (/^(licitacao|contratos|compras|administracao|saude|educacao)$/.test(key)) continue;
      counts[key] = (counts[key] || 0) + 1;
      if (counts[key] > bestN) {
        bestN = counts[key];
        best = raw;
      }
    }
    if (!best) {
      var m2 = /\b([a-z][a-z ]{2,30}?)\s*[-\u2013\/]\s*(?:pr|parana|sp|sc)\b/i.exec(f);
      if (m2) best = cleanSpaces(t.slice(m2.index, m2.index + m2[1].length));
    }
    return best ? titleCase(best) : "";
  }

  function acharPlataforma(f){
    var opts = [
      { label: "BLL", re: /\bbll\b|bllcompras|bll\.org/gi },
      { label: "ComprasNet", re: /comprasnet|compras\.gov|gov\.br\/compras/gi },
      { label: "Licitanet", re: /licitanet/gi },
      { label: "BNC", re: /\bbnc\b|bnccompras|bnc\.org/gi },
      { label: "Portal de Compras Públicas", re: /portal\s+de\s+compras\s+publicas|portaldecompraspublicas/gi },
      { label: "Licitações-e", re: /licitacoes-e|licitacoes\s+e\b/gi },
      { label: "Compras Públicas", re: /compras\s+publicas/gi }
    ];
    var best = "";
    var bestN = 0;
    for (var i = 0; i < opts.length; i++) {
      var n = (f.match(opts[i].re) || []).length;
      if (n > bestN) {
        bestN = n;
        best = opts[i].label;
      }
    }
    return best;
  }

  function isoFromBr(d, m, y){
    d = Number(d); m = Number(m); y = Number(y);
    if (y < 100) y += 2000;
    if (!(d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 2020 && y <= 2100)) return "";
    return y + "-" + pad2(m) + "-" + pad2(d);
  }

  var MESES = {
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
    julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12
  };

  function dataNoTrecho(s){
    var m = /\b(\d{1,2})\s*[\/.-]\s*(\d{1,2})\s*[\/.-]\s*(\d{2,4})\b/.exec(s);
    var m2 = /\b(\d{1,2})\s+de\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro)\s+de\s+(\d{4})\b/i.exec(s);
    var a = m ? { iso: isoFromBr(m[1], m[2], m[3]), at: m.index, end: m.index + m[0].length } : null;
    var b = m2 ? { iso: isoFromBr(m2[1], MESES[m2[2].toLowerCase()], m2[3]), at: m2.index, end: m2.index + m2[0].length } : null;
    if (a && !a.iso) a = null;
    if (b && !b.iso) b = null;
    if (a && b) return a.at <= b.at ? a : b;
    return a || b;
  }

  function horaNoTrecho(s){
    var m = /(?:^|[^\d\/.,])([01]?\d|2[0-3])\s*(?::|h|hs|horas?)\s*([0-5]\d)?(?:\s*min\w*)?(?![\d\/.,])/i.exec(s);
    if (!m) return "";
    return pad2(Number(m[1])) + ":" + (m[2] ? m[2] : "00");
  }

  /** "as 09:30 do dia 01/10/2026" / "as 09:00 horas do dia 01 de outubro de 2026" */
  function acharHoraAntesDaData(f){
    var re = /\bas\s+([01]?\d|2[0-3])\s*(?::|h)\s*([0-5]\d)?\s*(?:h|hs|horas?)?\s*(?:min\w*)?\s*(?:,\s*)?(?:do\s+dia|de|no\s+dia)\s+/gi;
    var m;
    while ((m = re.exec(f)) !== null) {
      var d = dataNoTrecho(f.slice(m.index + m[0].length, m.index + m[0].length + 40));
      if (d && d.at <= 2) {
        return { data: d.iso, hora: pad2(Number(m[1])) + ":" + (m[2] ? m[2] : "00"), tipo: "sessao" };
      }
    }
    return null;
  }

  function acharDataHora(f){
    var antes = acharHoraAntesDaData(f);
    if (antes) return antes;
    var keys = /(abertura|sessao\s+publica|inicio\s+da\s+(?:sessao|disputa)|disputa\s+de\s+precos|data\s+da\s+(?:sessao|disputa|abertura)|recebimento\s+das\s+propostas|limite\s+(?:para|de)\s+(?:envio|recebimento|cadastro))/gi;
    var m;
    var achado = null;
    while ((m = keys.exec(f)) !== null) {
      var win = f.slice(m.index, m.index + 260);
      var d = dataNoTrecho(win);
      if (!d) continue;
      var after = win.slice(d.end, d.end + 90);
      var hora = horaNoTrecho(after) || horaNoTrecho(win.slice(0, d.at));
      var cand = { data: d.iso, hora: hora, tipo: m[1] };
      // Prefere abertura/sessão com hora; a primeira com hora vence.
      if (!achado || (!achado.hora && cand.hora)) achado = cand;
      if (achado.hora && /abertura|sessao|disputa/i.test(m[1])) break;
    }
    if (achado) return achado;
    var d2 = dataNoTrecho(f);
    if (d2) return { data: d2.iso, hora: horaNoTrecho(f.slice(d2.end, d2.end + 60)), tipo: "" };
    return { data: "", hora: "", tipo: "" };
  }

  function acharValorTexto(f){
    var re = /valor\s+(?:total\s+|global\s+)?(?:estimado|maximo|global|de\s+referencia|total)[^r\n]{0,80}?r\$\s*(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})/i;
    var m = re.exec(f);
    return m ? parseBr(m[1]) : 0;
  }

  function objetoBom(s){
    s = String(s || "");
    if (s.length < 15) return false;
    var fs = fold(s).toUpperCase();
    if (/CATMAT|QUANTIDADE|UNIDADE\s+VALOR|VALOR\s+VALOR|VALOR\s+UNITARIO|ITEM\s+ESPECIFICACAO/.test(fs)) return false;
    var letras = (s.match(/[A-Za-z]/g) || []).length;
    return letras >= s.length * 0.55;
  }

  function acharObjeto(t, f){
    var res = [
      /\bobjeto\s+d[aoe]\s+(?:presente\s+)?(?:licitacao|pregao|edital|contratacao|dispensa|concorrencia)\s+(?:e|sera|consiste\s+(?:em|na|no))\s+/gi,
      /\btem\s+por\s+objeto\s+/gi,
      /\bconstitui\s+objeto\b[^:\n]{0,60}?[:\-\u2013]?\s*/gi,
      /\bobjeto\s*[:\-\u2013]\s*/gi
    ];
    var best = null;
    for (var r = 0; r < res.length; r++) {
      var m;
      res[r].lastIndex = 0;
      while ((m = res[r].exec(f)) !== null) {
        if (best && m.index >= best.at) break;
        var start = m.index + m[0].length;
        var raw = cleanSpaces(t.slice(start, start + 760));
        // "A presente licitação tem por objeto a ..." → só o que vem depois
        var fr = fold(raw);
        var pre = /^(?:a|o)\s+presente\s+(?:licitacao|contratacao|pregao|dispensa)\s+tem\s+por\s+objeto\s+/i.exec(fr);
        if (pre) raw = raw.slice(pre[0].length);
        raw = raw.replace(/^(?:a|o)\s+(?=[A-Za-z])/i, function (w) { return w; });
        var cut = raw.search(/\.\s+(?=[A-Z0-9])|\s\d{1,2}\.\d{1,2}\.?\s/);
        if (cut > 30) raw = raw.slice(0, cut + 1);
        if (raw.length > 320) raw = raw.slice(0, 317).replace(/\s+\S*$/, "") + "…";
        if (objetoBom(raw)) {
          best = { at: m.index, text: raw };
          break;
        }
      }
    }
    if (!best) return "";
    return best.text.charAt(0).toUpperCase() + best.text.slice(1);
  }

  /**
   * Só afirma o critério quando o edital declara (não "caso o critério seja…",
   * "quando adotado…" ou "menor preço (ou maior desconto)").
   */
  function acharCriterio(f){
    if (/menor\s+preco[^.\n]{0,40}?por\s+lote/i.test(f)) return "menor preço por lote";
    if (/menor\s+preco[^.\n]{0,40}?por\s+item/i.test(f)) return "menor preço por item";
    if (/menor\s+preco\s+global/i.test(f)) return "menor preço global";
    var re = /(?:criterio\s+de\s+julgamento|julgamento\s+das\s+propostas|\btipo)\b[^.\n]{0,50}?(menor\s+preco|maior\s+desconto|maior\s+lance)/gi;
    var m;
    while ((m = re.exec(f)) !== null) {
      var antes = f.slice(Math.max(0, m.index - 40), m.index);
      if (/\b(?:caso|quando|se)\b[^.]*$/i.test(antes)) continue;
      var achado = fold(m[1]).toLowerCase().replace(/\s+/g, " ");
      if (achado === "menor preco") return "menor preço";
      if (achado === "maior desconto") return "maior desconto";
      if (achado === "maior lance") return "maior lance";
    }
    return "";
  }

  function dataBr(iso){
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
  }

  /** Lê o texto do edital (e os itens já extraídos) e devolve os dados da licitação. */
  function extrairDados(full, items){
    var t = String(full || "");
    var f = foldSameLength(t);
    items = items || [];
    var totalItens = 0;
    var comPreco = 0;
    for (var i = 0; i < items.length; i++) {
      var vt = Number(items[i].editalTotal) || 0;
      if (!vt && Number(items[i].editalVunit) > 0) vt = Number(items[i].editalVunit) * (Number(items[i].qtd) || 0);
      if (vt > 0) comPreco++;
      totalItens += vt;
    }
    totalItens = Math.round(totalItens * 100) / 100;
    var valorTexto = acharValorTexto(f);
    var dh = acharDataHora(f);
    var d = {
      numero: acharNumero(f),
      modalidade: acharModalidade(f),
      municipio: acharMunicipio(t, f),
      plataforma: acharPlataforma(f),
      data: dh.data,
      hora: dh.hora,
      valor: totalItens > 0 ? totalItens : valorTexto,
      valorFonte: totalItens > 0 ? "itens" : (valorTexto > 0 ? "texto" : ""),
      objeto: acharObjeto(t, f),
      criterio: acharCriterio(f),
      itens: items.length,
      itensComPreco: comPreco,
      meEpp: /exclusiv\w*\s+(?:para\s+)?(?:a\s+)?(?:participacao\s+de\s+)?(?:me|microempresas?)\b|exclusivo\s+me\s*\/?\s*epp/i.test(f),
      amostra: /\bamostras?\b/i.test(f),
      visita: /visita\s+tecnica/i.test(f)
    };
    d.tarefas = montarTarefas(d);
    return d;
  }

  function montarTarefas(d){
    var out = [];
    var quando = d.data ? dataBr(d.data) + (d.hora ? " às " + d.hora : "") : "";
    if (d.plataforma) {
      out.push("Cadastrar a proposta na plataforma " + d.plataforma + (quando ? " até " + quando : "") + ".");
    } else if (quando) {
      out.push("Cadastrar a proposta até " + quando + " (confira a plataforma no edital).");
    } else {
      out.push("Conferir no edital a plataforma e a data da sessão.");
    }
    if (d.itens > 0) {
      out.push(
        "Orçar " + d.itens + (d.itens === 1 ? " item" : " itens") +
        (d.valor > 0 ? " — total máximo do edital R$ " + money(d.valor) : "") + "."
      );
    } else if (d.valor > 0) {
      out.push("Orçar o objeto — valor estimado R$ " + money(d.valor) + ".");
    }
    if (d.criterio) out.push("Critério de julgamento: " + d.criterio + ".");
    if (d.meEpp) out.push("Tem cota ou lote exclusivo para ME/EPP — confira o enquadramento da empresa.");
    if (d.amostra) out.push("O edital fala em amostra — veja prazo e local de entrega.");
    if (d.visita) out.push("O edital fala em visita técnica — confira se é obrigatória.");
    out.push("Separar os documentos de habilitação pedidos no edital.");
    return out;
  }

  /* ---------------- calendário (.ics) ---------------- */

  function icsEscape(s){
    return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
  }

  function baixarIcs(d){
    if (!d.data) return false;
    var ymd = d.data.replace(/-/g, "");
    var hm = (d.hora || "09:00").replace(":", "");
    var start = ymd + "T" + hm + "00";
    var h = Number(hm.slice(0, 2));
    var endH = Math.min(23, h + 1);
    var end = ymd + "T" + pad2(endH) + hm.slice(2) + "00";
    var titulo = "Licitação " + (d.numero || "") + (d.municipio ? " — " + d.municipio : "") + (d.plataforma ? " (" + d.plataforma + ")" : "");
    var desc = [d.modalidade, d.objeto, d.valor > 0 ? "Valor: R$ " + money(d.valor) : ""].filter(Boolean).join("\n");
    var now = new Date();
    var stamp =
      now.getUTCFullYear() + pad2(now.getUTCMonth() + 1) + pad2(now.getUTCDate()) + "T" +
      pad2(now.getUTCHours()) + pad2(now.getUTCMinutes()) + pad2(now.getUTCSeconds()) + "Z";
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//LICSYSTEM//Cronograma//PT-BR",
      "BEGIN:VEVENT",
      "UID:" + Date.now().toString(36) + "@licsystem",
      "DTSTAMP:" + stamp,
      "DTSTART:" + start,
      "DTEND:" + end,
      "SUMMARY:" + icsEscape(titulo.trim()),
      "DESCRIPTION:" + icsEscape(desc),
      "BEGIN:VALARM",
      "TRIGGER:-PT1H",
      "ACTION:DISPLAY",
      "DESCRIPTION:" + icsEscape(titulo.trim()),
      "END:VALARM",
      "END:VEVENT",
      "END:VCALENDAR"
    ];
    var blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "licitacao-" + String(d.numero || "edital").replace(/[^\w-]+/g, "-") + ".ics";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(url);
      a.remove();
    }, 1500);
    return true;
  }

  /* ---------------- tela ---------------- */

  var DROP_HTML =
    '<span class="big">📥</span><b>Arraste o PDF do edital aqui</b> ou clique para selecionar<br/>' +
    '<span class="small muted">O sistema lê número, município, plataforma, data da sessão e valor e já monta o resumo</span>';

  LICSYSTEM.cronogramaEdital = {
    _file: null,
    _dados: null,
    _busy: false,
    extrairDados: extrairDados,

    wire: function(){
      var drop = el("slNovoDrop");
      var input = el("slNovoFile");
      if (!drop || !input || drop._slWired) return;
      drop._slWired = true;
      drop.addEventListener("click", function(){ input.value = ""; input.click(); });
      drop.addEventListener("keydown", function(e){
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.value = ""; input.click(); }
      });
      input.addEventListener("change", function(){
        if (input.files && input.files[0]) LICSYSTEM.cronogramaEdital.ler(input.files[0]);
      });
      drop.addEventListener("dragover", function(e){ e.preventDefault(); drop.classList.add("drag"); });
      drop.addEventListener("dragleave", function(){ drop.classList.remove("drag"); });
      drop.addEventListener("drop", function(e){
        e.preventDefault();
        drop.classList.remove("drag");
        var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) LICSYSTEM.cronogramaEdital.ler(f);
      });
      var box = el("slNovoBox");
      if (box) {
        box.addEventListener("click", function(e){
          var b = e.target.closest("[data-sl-novo]");
          if (!b) return;
          var act = b.getAttribute("data-sl-novo");
          if (act === "participar") LICSYSTEM.cronogramaEdital.participar();
          else if (act === "calendario") LICSYSTEM.cronogramaEdital.calendario();
          else if (act === "descartar") LICSYSTEM.cronogramaEdital.descartar();
        });
      }
    },

    ler: function(file){
      if (LICSYSTEM.cronogramaEdital._busy) return;
      var nome = String((file && file.name) || "").toLowerCase();
      if (!file || (file.type && file.type !== "application/pdf" && nome.slice(-4) !== ".pdf")) {
        showAlert("slNovoAlert", "warn", "Jogue um arquivo PDF do edital.");
        return;
      }
      if (!LICSYSTEM.captacao || typeof LICSYSTEM.captacao.itensDoPdf !== "function") {
        showAlert("slNovoAlert", "error", "Leitura de PDF indisponível nesta tela.");
        return;
      }
      hideAlert("slNovoAlert");
      LICSYSTEM.cronogramaEdital._busy = true;
      LICSYSTEM.cronogramaEdital._file = file;
      var drop = el("slNovoDrop");
      if (drop) {
        drop.classList.add("is-busy");
        drop.innerHTML =
          '<span class="big">⏳</span><b>Lendo o edital…</b><br/><span class="small muted">' + esc(file.name || "edital.pdf") + "</span>";
      }
      LICSYSTEM.captacao.itensDoPdf(file).then(function(res){
        var dados = extrairDados((res && res.full) || "", (res && res.items) || []);
        LICSYSTEM.cronogramaEdital._dados = dados;
        LICSYSTEM.cronogramaEdital._items = (res && res.items) || [];
        LICSYSTEM.cronogramaEdital.renderResumo();
      }).catch(function(err){
        showAlert("slNovoAlert", "error", "Não consegui ler este PDF: " + esc((err && err.message) || err));
      }).then(function(){
        LICSYSTEM.cronogramaEdital._busy = false;
        if (drop) {
          drop.classList.remove("is-busy");
          drop.innerHTML = DROP_HTML;
        }
      });
    },

    renderResumo: function(){
      var box = el("slNovoBox");
      var d = LICSYSTEM.cronogramaEdital._dados;
      var f = LICSYSTEM.cronogramaEdital._file;
      if (!box) return;
      if (!d) {
        box.hidden = true;
        box.innerHTML = "";
        return;
      }
      var faltando = [];
      if (!d.numero) faltando.push("número");
      if (!d.municipio) faltando.push("município");
      if (!d.data) faltando.push("data");
      if (!d.valor) faltando.push("valor");
      var tarefas = d.tarefas.map(function(x){ return "<li>" + esc(x) + "</li>"; }).join("");
      box.hidden = false;
      box.innerHTML =
        '<div class="sl-novo-head">' +
          '<div><b>📄 ' + esc((f && f.name) || "edital.pdf") + "</b>" +
          (d.modalidade ? ' <span class="tag">' + esc(d.modalidade) + "</span>" : "") +
          "</div>" +
          '<span class="small muted">' + (d.itens ? d.itens + (d.itens === 1 ? " item lido" : " itens lidos") : "itens não lidos") + "</span>" +
        "</div>" +
        (faltando.length
          ? '<div class="sl-novo-falta">Não achei no PDF: <b>' + esc(faltando.join(", ")) + "</b>. Preencha abaixo antes de lançar.</div>"
          : '<div class="sl-novo-ok">Tudo encontrado no edital — confira e lance.</div>') +
        '<div class="sl-novo-grid">' +
          '<label class="sl-novo-f"><span>Licitação nº</span><input type="text" id="slNovoNumero" placeholder="000/2026" value="' + esc(d.numero) + '"></label>' +
          '<label class="sl-novo-f sl-novo-f-wide"><span>Município</span><input type="text" id="slNovoMunicipio" placeholder="Município" value="' + esc(d.municipio) + '"></label>' +
          '<label class="sl-novo-f"><span>Plataforma</span><input type="text" id="slNovoPlataforma" list="slPlataformas" autocomplete="off" placeholder="Plataforma" value="' + esc(d.plataforma) + '"></label>' +
          '<label class="sl-novo-f"><span>Data da sessão</span><input type="date" id="slNovoData" value="' + esc(d.data) + '"></label>' +
          '<label class="sl-novo-f"><span>Hora</span><input type="time" id="slNovoHora" value="' + esc(d.hora) + '"></label>' +
          '<label class="sl-novo-f"><span>Valor (R$)</span><input type="text" id="slNovoValor" inputmode="decimal" placeholder="0,00" value="' + esc(d.valor > 0 ? money(d.valor) : "") + '"></label>' +
        "</div>" +
        (d.objeto ? '<div class="sl-novo-obj"><b>Objeto:</b> ' + esc(d.objeto) + "</div>" : "") +
        '<div class="sl-novo-todo"><b>O que fazer</b><ul>' + tarefas + "</ul></div>" +
        '<div class="btn-row sl-novo-actions">' +
          '<button type="button" class="btn btn-green" data-sl-novo="participar">✅ Vamos participar — lançar no cronograma</button>' +
          '<button type="button" class="btn btn-ghost" data-sl-novo="calendario">📅 Jogar no calendário</button>' +
          '<button type="button" class="btn btn-ghost" data-sl-novo="descartar">Descartar</button>' +
        "</div>";
    },

    _lerCampos: function(){
      var d = Object.assign({}, LICSYSTEM.cronogramaEdital._dados || {});
      function v(id){ var n = el(id); return n ? String(n.value || "").trim() : ""; }
      d.numero = v("slNovoNumero");
      d.municipio = v("slNovoMunicipio");
      d.plataforma = v("slNovoPlataforma");
      d.data = v("slNovoData");
      d.hora = v("slNovoHora");
      d.valor = parseBr(v("slNovoValor"));
      return d;
    },

    participar: function(){
      var d = LICSYSTEM.cronogramaEdital._lerCampos();
      if (!d.numero && !d.municipio) {
        showAlert("slNovoAlert", "warn", "Preencha pelo menos o número da licitação ou o município.");
        return;
      }
      var sl = LICSYSTEM.statusLicitacoes;
      if (!sl || typeof sl.adicionarDoEdital !== "function") {
        showAlert("slNovoAlert", "error", "Cronograma indisponível.");
        return;
      }
      sl.adicionarDoEdital(d, LICSYSTEM.cronogramaEdital._file).then(function(){
        var quem = [d.numero, d.municipio].filter(Boolean).join(" — ");
        LICSYSTEM.cronogramaEdital._dados = null;
        LICSYSTEM.cronogramaEdital._file = null;
        LICSYSTEM.cronogramaEdital.renderResumo();
        showAlert("slNovoAlert", "ok", "Lançado no cronograma: " + esc(quem) + ". Depois é só marcar se foi orçada.");
      });
    },

    calendario: function(){
      var d = LICSYSTEM.cronogramaEdital._lerCampos();
      if (!d.data) {
        showAlert("slNovoAlert", "warn", "Preencha a data da sessão para jogar no calendário.");
        return;
      }
      baixarIcs(d);
      showAlert("slNovoAlert", "ok", "Arquivo do calendário baixado — abra para salvar no Google/Outlook/celular (lembrete 1 hora antes).");
    },

    descartar: function(){
      LICSYSTEM.cronogramaEdital._dados = null;
      LICSYSTEM.cronogramaEdital._file = null;
      LICSYSTEM.cronogramaEdital.renderResumo();
      hideAlert("slNovoAlert");
    }
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
