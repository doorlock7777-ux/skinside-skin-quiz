/* 실시간 접속 신호: 화면이 보이는 동안 1분마다 /api/live 에 임의 id와 화면 이름(store/quiz)만 보낸다. 개인정보 없음 */
(function(){
  try{
    var s = document.currentScript, P = (s && s.getAttribute("data-p")) || "store", day = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10), vid = "", first = true;
    var mk = function(){ return (Math.random().toString(36).slice(2, 10) + Date.now().toString(36)).replace(/[^a-z0-9]/g, "").slice(0, 24); };
    try{ vid = localStorage.getItem("sk_vid") || ""; if(!/^[a-z0-9]{8,32}$/.test(vid)){ vid = mk(); localStorage.setItem("sk_vid", vid); } first = localStorage.getItem("sk_vday") !== day; }catch(e){ vid = vid || mk(); }
    if(location.protocol.indexOf("http") !== 0) return;
    var last = 0;
    var beat = function(){
      if(document.hidden || Date.now() - last < 20000) return;
      last = Date.now();
      var b = {v:vid, p:P}; if(first) b.f = 1;
      try{ fetch("/api/live", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(b), keepalive:true}).then(function(r){ if(r.ok && first){ first = false; try{ localStorage.setItem("sk_vday", day); }catch(e){} } }).catch(function(){}); }catch(e){}
    };
    beat(); setInterval(beat, 60000);
    document.addEventListener("visibilitychange", function(){ if(!document.hidden) beat(); });
  }catch(e){}
})();
