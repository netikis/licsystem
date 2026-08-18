/* LICSYSTEM — FERRAMENTAS (13-ferramentas.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  function licsystemPdfHeader(){
    var fn = ctx.licsystemPdfHeader || window.licsystemPdfHeader || LICSYSTEM.licsystemPdfHeader;
    if (typeof fn !== "function") throw new Error("licsystemPdfHeader ainda não disponível");
    return fn.apply(this, arguments);
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
          prev.removeAttribute("hidden");
          prev.style.display = "";
        } else {
          prev.removeAttribute("src");
          prev.setAttribute("hidden", "");
          prev.style.display = "";
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
        showAlert("ferramentasStatus","ok","✅ Perfil salvo.");
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
        if(prev){ prev.src = b64; prev.removeAttribute("hidden"); prev.style.display = ""; }
      }).catch(function(err){
        showAlert("ferramentasStatus","warn",utils.escapeHtml(err.message));
      });
    },

    exportarBackup: function(){
      showAlert("backupStatus","info",'<span class="spinner" style="border-color:#ccc;border-top-color:#152642"></span> Exportando backup…');
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
        showAlert("backupStatus","ok","✅ Backup baixado.");
      }).catch(function(err){
        showAlert("backupStatus","error","Falha ao exportar: "+utils.escapeHtml(err.message));
      });
    },

    importarBackup: function(file){
      if(!file){ showAlert("backupStatus","warn","Selecione um arquivo JSON."); return; }
      if(!confirm("Importar este backup?\nIsso pode sobrescrever dados existentes.")) return;
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
            showAlert("backupStatus","ok","✅ Backup importado.");
          }).catch(function(err){
            showAlert("backupStatus","error","Falha ao importar: "+utils.escapeHtml(err.message));
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
  // licsystemPdfHeader publicado em 12-concorrencia.js

  if (ctx.licsystemPdfHeader) {
    LICSYSTEM.licsystemPdfHeader = ctx.licsystemPdfHeader;
    window.licsystemPdfHeader = ctx.licsystemPdfHeader;
  }

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
