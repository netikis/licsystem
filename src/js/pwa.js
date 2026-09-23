/* LICSYSTEM — instalação PWA (Android, iPhone e computador) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  function el(id){ var fn = ctx.el || LICSYSTEM.el; return fn ? fn(id) : document.getElementById(id); }

  var deferredPrompt = null;

  function isStandalone(){
    try{
      if(window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) return true;
    }catch(e){}
    return !!window.navigator.standalone;
  }

  function isIos(){
    var ua = String(navigator.userAgent || "");
    if(/iPhone|iPad|iPod/i.test(ua)) return true;
    return navigator.platform === "MacIntel" && Number(navigator.maxTouchPoints || 0) > 1;
  }

  function isAndroid(){
    return /Android/i.test(String(navigator.userAgent || ""));
  }

  function showOverlay(){
    var ov = el("pwaOverlay");
    if(!ov) return;
    ov.classList.add("show");
    ov.setAttribute("aria-hidden", "false");
  }

  function hideOverlay(){
    var ov = el("pwaOverlay");
    if(!ov) return;
    ov.classList.remove("show");
    ov.setAttribute("aria-hidden", "true");
  }

  function setHelp(kind){
    var ios = el("pwaHelpIos");
    var and = el("pwaHelpAndroid");
    var desk = el("pwaHelpDesktop");
    var title = el("pwaHelpTitle");
    if(ios) ios.hidden = kind !== "ios";
    if(and) and.hidden = kind !== "android";
    if(desk) desk.hidden = kind !== "desktop";
    if(title){
      if(kind === "ios") title.textContent = "Instalar no iPhone";
      else if(kind === "android") title.textContent = "Instalar no Android";
      else title.textContent = "Instalar no computador";
    }
  }

  function nativeInstall(){
    if(!deferredPrompt) return Promise.resolve(false);
    var ev = deferredPrompt;
    deferredPrompt = null;
    return ev.prompt().then(function(){
      return ev.userChoice;
    }).then(function(choice){
      LICSYSTEM.pwa.updateUi();
      return !!(choice && choice.outcome === "accepted");
    }).catch(function(){
      return false;
    });
  }

  LICSYSTEM.pwa = {
    isStandalone: isStandalone,
    isIos: isIos,
    isAndroid: isAndroid,

    updateUi: function(){
      var installed = isStandalone();
      var top = el("btnPwaInstallTop");
      if(top) top.hidden = installed;
      var note = el("pwaInstalledNote");
      if(note) note.hidden = !installed;
      var actions = el("pwaInstallActions");
      if(actions) actions.hidden = installed;
    },

    installAndroid: function(){
      if(isStandalone()){
        LICSYSTEM.pwa.updateUi();
        return;
      }
      nativeInstall().then(function(ok){
        if(!ok){
          setHelp("android");
          showOverlay();
        }
      });
    },

    installIphone: function(){
      if(isStandalone()){
        LICSYSTEM.pwa.updateUi();
        return;
      }
      setHelp("ios");
      showOverlay();
    },

    installDesktop: function(){
      if(isStandalone()){
        LICSYSTEM.pwa.updateUi();
        return;
      }
      if(isIos()){
        LICSYSTEM.pwa.installIphone();
        return;
      }
      nativeInstall().then(function(ok){
        if(!ok){
          setHelp("desktop");
          showOverlay();
        }
      });
    },

    installAuto: function(){
      if(isIos()) LICSYSTEM.pwa.installIphone();
      else if(isAndroid()) LICSYSTEM.pwa.installAndroid();
      else LICSYSTEM.pwa.installDesktop();
    },

    closeHelp: function(){
      hideOverlay();
    },

    wire: function(){
      window.addEventListener("beforeinstallprompt", function(e){
        e.preventDefault();
        deferredPrompt = e;
        LICSYSTEM.pwa.updateUi();
      });
      window.addEventListener("appinstalled", function(){
        deferredPrompt = null;
        hideOverlay();
        LICSYSTEM.pwa.updateUi();
      });
      if("serviceWorker" in navigator){
        navigator.serviceWorker.register("/sw.js").catch(function(){});
      }
      function bind(id, fn){
        var n = el(id);
        if(n) n.addEventListener("click", fn);
      }
      bind("btnPwaAuthAndroid", function(){ LICSYSTEM.pwa.installAndroid(); });
      bind("btnPwaAuthIphone", function(){ LICSYSTEM.pwa.installIphone(); });
      bind("btnPwaAuthDesktop", function(){ LICSYSTEM.pwa.installDesktop(); });
      bind("btnPwaHelpClose", function(){ LICSYSTEM.pwa.closeHelp(); });
      var pwaOv = el("pwaOverlay");
      if(pwaOv){
        pwaOv.addEventListener("click", function(e){
          if(e.target === pwaOv) LICSYSTEM.pwa.closeHelp();
        });
      }
      LICSYSTEM.pwa.updateUi();
    }
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
