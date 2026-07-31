/**
 * Widget Voiceflow "Suporte LICSYSTEM".
 * O embed NÃO consulta o PNCP sozinho — para editais abertos use Captação → Perguntar editais
 * ou conecte um Custom Action no VF para https://licsystem.vercel.app/api/editais-chat
 * (passo a passo: docs/voiceflow-editais-chat.md).
 */
(function(){
  var VF_PROJECT_ID = "6a5cf8b3de847e8e5630f8f1";
  var VF_RUNTIME = "https://general-runtime.voiceflow.com";
  var VF_VOICE = "https://runtime-api.voiceflow.com";
  var VF_BUNDLE = "https://cdn.voiceflow.com/widget-next/bundle.mjs";
  var scriptLoaded = false;
  var bootRequested = false;

  function pagePayload(view){
    view = view || (window.LICSYSTEM && LICSYSTEM.state && LICSYSTEM.state.currentView) || "dashboard";
    var titulo = (window.LICSYSTEM && LICSYSTEM.VIEW_TITLES && LICSYSTEM.VIEW_TITLES[view]) || view;
    return {
      pagina: view,
      pagina_atual: view,
      titulo: titulo,
      sistema: "LICSYSTEM"
    };
  }

  function buildConfig(view){
    return {
      verify: { projectID: VF_PROJECT_ID },
      url: VF_RUNTIME,
      voice: { url: VF_VOICE },
      launch: {
        event: {
          type: "launch",
          payload: pagePayload(view)
        }
      }
    };
  }

  function ensureLICSYSTEMVoiceflow(){
    if(!window.LICSYSTEM) window.LICSYSTEM = {};
    var api = LICSYSTEM.voiceflow = LICSYSTEM.voiceflow || {};
    api.ready = !!api.ready;
    api.currentView = api.currentView || "dashboard";

    api.loadChat = function(view){
      api.currentView = view || api.currentView || "dashboard";
      if(!(window.voiceflow && window.voiceflow.chat && typeof window.voiceflow.chat.load === "function")) return;
      try{
        window.voiceflow.chat.load(buildConfig(api.currentView));
        api.ready = true;
      }catch(e){}
    };

    api.syncContext = function(view){
      api.currentView = view || api.currentView || "dashboard";
      // Não recarrega o widget a cada troca de menu (causava lentidão)
    };

    return api;
  }

  function injectBundle(onReady){
    if(scriptLoaded){
      if(onReady) onReady();
      return;
    }
    if(window.voiceflow && window.voiceflow.chat){
      scriptLoaded = true;
      if(onReady) onReady();
      return;
    }
    var v = document.createElement("script");
    var s = document.getElementsByTagName("script")[0];
    v.onload = function(){
      scriptLoaded = true;
      if(onReady) onReady();
    };
    v.onerror = function(){ /* silencioso — IA opcional */ };
    v.src = VF_BUNDLE;
    v.type = "text/javascript";
    s.parentNode.insertBefore(v, s);
  }

  window.__licsystemInitVoiceflow = function(){
    bootRequested = true;
    var api = ensureLICSYSTEMVoiceflow();
    injectBundle(function(){
      api.loadChat((LICSYSTEM.state && LICSYSTEM.state.currentView) || "dashboard");
    });
  };

  // Se o boot já rodou antes deste script (race raro), inicia agora
  if(window.LICSYSTEM && LICSYSTEM.state && bootRequested === false){
    /* aguarda chamada explícita do boot */
  }
})();
