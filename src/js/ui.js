/* LICSYSTEM — DOM HELPERS + BELL (04-dom.js) */
(function (LICSYSTEM) {
  "use strict";

  var ctx = LICSYSTEM._ctx || (LICSYSTEM._ctx = {});
  function el(id){ return document.getElementById(id); }
  function showAlert(id, type, msg){
    var a = el(id); if(!a) return;
    a.className = "alert show alert-"+type;
    a.innerHTML = msg;
  }
  function hideAlert(id){ var a=el(id); if(a) a.className="alert"; }

  /* ============================ BELL / PNCP badge ============================ */
  LICSYSTEM.updateBell = function(){
    if(LICSYSTEM.alertas && LICSYSTEM.alertas.updateBell){
      LICSYSTEM.alertas.updateBell();
      return;
    }
    var badge = el("bellBadge");
    if(!badge) return;
    var n = (LICSYSTEM.state.pncpAlerts || []).length;
    badge.textContent = String(n);
    badge.classList.toggle("zero", n === 0);
  };


  ctx.el = el;
  ctx.showAlert = showAlert;
  ctx.hideAlert = hideAlert;
  LICSYSTEM.el = el;
  LICSYSTEM.showAlert = showAlert;
  LICSYSTEM.hideAlert = hideAlert;

})(window.LICSYSTEM || (window.LICSYSTEM = {}));
