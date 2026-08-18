/* LICSYSTEM — AUTH (22-auth.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils;
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }
  function showAlert(id, type, msg){ var fn = ctx.showAlert || LICSYSTEM.showAlert; if (fn) return fn(id, type, msg); }
  function hideAlert(id){ var fn = ctx.hideAlert || LICSYSTEM.hideAlert; if (fn) return fn(id); }
  function wire(){
    var fn = ctx.wire || window.wire || LICSYSTEM.wire;
    if (typeof fn !== "function") throw new Error("wire ainda não disponível");
    return fn.apply(this, arguments);
  }

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


})(window.LICSYSTEM || (window.LICSYSTEM = {}));
