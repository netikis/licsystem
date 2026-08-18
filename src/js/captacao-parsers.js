/* LICSYSTEM — parsers de edital (core / despachante) */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  var BLACKLIST = ctx.BLACKLIST;
  var EDITAL_UNDS = ctx.EDITAL_UNDS;
  var EDITAL_COTAS_TXT = ctx.EDITAL_COTAS_TXT;
  var RE_EDITAL_HEAD = ctx.RE_EDITAL_HEAD;
  var RE_EDITAL_THEO_HEAD = ctx.RE_EDITAL_THEO_HEAD;
  var RE_INICIO_SPEC_EDITAL = ctx.RE_INICIO_SPEC_EDITAL;

  LICSYSTEM.captacao = LICSYSTEM.captacao || {};
  var bag = LICSYSTEM.captacaoParsers || (LICSYSTEM.captacaoParsers = {});

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

  function ensureSplitters() {
    if (bag._installed) return bag;
    var deps = {
      limparPagina: limparPagina,
      pushParsed: pushParsed,
      dedupeCaptacao: dedupeCaptacao,
      utils: utils,
      EDITAL_UNDS: EDITAL_UNDS,
      EDITAL_COTAS_TXT: EDITAL_COTAS_TXT,
      RE_EDITAL_HEAD: RE_EDITAL_HEAD,
      RE_EDITAL_THEO_HEAD: RE_EDITAL_THEO_HEAD,
      RE_INICIO_SPEC_EDITAL: RE_INICIO_SPEC_EDITAL
    };
    if (typeof bag.installElotech === "function") bag.installElotech(deps);
    if (typeof bag.installMaringa === "function") bag.installMaringa(deps);
    if (typeof bag.installMunicipais === "function") bag.installMunicipais(deps);
    if (typeof bag.installClassico === "function") bag.installClassico(deps);
    Object.keys(deps).forEach(function (k) {
      bag[k] = deps[k];
    });
    bag._installed = true;
    return bag;
  }

  /**
   * Despacha pelo registro permanente de modelos (captacao-modelos.js).
   * Guarda o modelo usado em LICSYSTEM.captacao.lastModelo.
   */
  LICSYSTEM.captacao.splitEdital = function (text) {
    var P = ensureSplitters();
    if (typeof bag.runModelos !== "function") {
      LICSYSTEM.captacao.lastModelo = {
        id: "desconhecido",
        label: "Registro de modelos não carregado",
        family: "",
        via: "erro",
        at: new Date().toISOString()
      };
      return [];
    }
    return bag.runModelos(text, P) || [];
  };

  LICSYSTEM.captacao.packApiItens = function (list) {
    var out = [];
    (list || []).forEach(function (it) {
      if (!it) return;
      var qtd = Number(it.qtd) || 0;
      var vu = Number(it.editalVunit) || 0;
      var vt = Number(it.editalTotal) || 0;
      var und = String(it.und || "UN").toUpperCase();
      var produto = String(it.produto || "").replace(/\s+/g, " ").trim();
      var lote = String(it.lote || "").trim();
      if (!(qtd > 0) || !produto) return;
      var packed = {
        lote: lote || String(out.length + 1),
        qtd: qtd,
        und: und,
        produto: produto,
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
    });
    return out;
    };


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
