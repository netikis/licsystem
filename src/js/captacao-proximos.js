/* LICSYSTEM — CAPTACAO / EDITAIS PROXIMOS */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  LICSYSTEM.captacao = Object.assign(LICSYSTEM.captacao || {}, {
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
  });

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
