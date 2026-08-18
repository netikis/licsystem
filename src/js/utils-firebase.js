/* LICSYSTEM — UTILS / Firebase */
(function (LICSYSTEM) {
  "use strict";
  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  var utils = LICSYSTEM.utils || (LICSYSTEM.utils = {});

  /* ------- Firebase (config via import.meta.env.VITE_FIREBASE_* → firebaseConfig.js) ------- */
  utils.getFirebaseConfig = function(){
    if(window.LICSYSTEMFirebase && typeof window.LICSYSTEMFirebase.getConfigSync === "function"){
      return window.LICSYSTEMFirebase.getConfigSync();
    }
    return null;
  };

  utils.hasFirebaseConfig = function(){
    if(!(window.LICSYSTEMFirebase && typeof window.LICSYSTEMFirebase.ensureAuth === "function")) return false;
    var cfg = utils.getFirebaseConfig();
    return !!(cfg && cfg.apiKey && cfg.projectId);
  };

  var _fbInit = null;
  var _fbAuthInit = null;

  /** Só App + Auth (login rápido). Database sobe sob demanda. */
  utils.ensureFirebaseAuth = function(){
    if(!utils.hasFirebaseConfig()) return Promise.reject(new Error("firebase-config-vazio"));
    if(_fbAuthInit) return _fbAuthInit;
    _fbAuthInit = window.LICSYSTEMFirebase.ensureAuth()
      .catch(function(err){ _fbAuthInit = null; throw err; });
    return _fbAuthInit;
  };

  /** App + Auth + Realtime Database (paralelo após o app). */
  utils.ensureFirebase = function(){
    if(!utils.hasFirebaseConfig()) return Promise.reject(new Error("firebase-config-vazio"));
    if(_fbInit) return _fbInit;
    _fbInit = window.LICSYSTEMFirebase.ensureDatabase()
      .catch(function(err){ _fbInit = null; throw err; });
    return _fbInit;
  };

  utils.firebasePush = function(path, obj){
    return utils.ensureFirebase().then(function(fb){
      return fb.database().ref(path).push(obj);
    });
  };

  utils.firebaseSet = function(path, obj){
    return utils.ensureFirebase().then(function(fb){
      var ref = (path === "/" || path === "") ? fb.database().ref() : fb.database().ref(path);
      return ref.set(obj);
    });
  };

  utils.firebaseGet = function(path){
    return utils.ensureFirebase().then(function(fb){
      return fb.database().ref(path).once("value").then(function(snap){
        return snap.val();
      });
    });
  };

  // build EXACT path: licitacoes/${YYYY}/${MM}/${DD}-${HHh}/resultados_cruzamento
  utils.buildFirebasePath = function(d){
    d = d || new Date();
    var YYYY = d.getFullYear();
    var MM = ("0"+(d.getMonth()+1)).slice(-2);
    var DD = ("0"+d.getDate()).slice(-2);
    var HH = ("0"+d.getHours()).slice(-2);
    return "licitacoes/"+YYYY+"/"+MM+"/"+DD+"-"+HH+"h/resultados_cruzamento";
  };

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
