/* 히든 버튼: 화면 하단에서 쑥 올라오는 반투명 특가 버튼 + 왼쪽 실시간 타이머. 문구·링크·종료 시각은 관리자 > 제품 > 히든 버튼에서 정한다.
   스토어(app.js)와 진단 결과 화면(quiz)이 같이 쓴다. SkHidden.show(true/false)로 이 화면에서 보일지 정한다. */
(function(){
  var st = document.createElement("style"); st.textContent = ".hb{position:fixed;left:50%;bottom:calc(env(safe-area-inset-bottom,0px) + 70px);z-index:25;width:calc(100% - 28px);max-width:532px;box-sizing:border-box;display:flex;align-items:center;gap:12px;padding:9px 16px 9px 12px;border-radius:30px;background:rgba(78,87,162,.72);-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);color:#fff;font-family:'Pretendard','Apple SD Gothic Neo','Noto Sans KR','Malgun Gothic',system-ui,sans-serif;font-size:15px;font-weight:800;-webkit-font-smoothing:antialiased;letter-spacing:-.2px;line-height:1.3;text-decoration:none;text-shadow:0 1px 3px rgba(0,0,0,.45);box-shadow:0 10px 28px rgba(40,46,110,.32);border:1px solid rgba(255,255,255,.28);transform:translate(-50%,170%);opacity:0;pointer-events:none;transition:transform .7s cubic-bezier(.2,1.25,.4,1),opacity .5s}\n.hb,.hb *{box-sizing:border-box;margin:0}.hb.show{transform:translate(-50%,0);opacity:1;pointer-events:auto}\n.hb .tx{flex:1;text-align:center;min-width:0;word-break:keep-all}\n.hb i{font-style:normal;font-size:20px;line-height:1;display:inline-flex;align-items:center;height:28px}\n.hb:active{filter:brightness(.92)}\n.hb .tm{display:flex;align-items:center;gap:3px;flex:none;padding-right:12px;border-right:1px solid rgba(255,255,255,.35);font-variant-numeric:tabular-nums;white-space:nowrap}\n.hb .tm em{display:inline-flex;align-items:center;justify-content:center;height:28px;font-style:normal;font-size:17px;font-weight:900;line-height:1;background:rgba(15,20,70,.4);border-radius:7px;padding:0 4px;min-width:27px;transition:color .3s}\n.hb .tm u{display:inline-flex;align-items:center;height:28px;line-height:1;text-decoration:none;font-size:12px;font-weight:800;margin:0 5px 0 2px;opacity:.95}\n.hb .tm s{display:inline-flex;align-items:center;height:28px;line-height:1;text-decoration:none;font-weight:900;opacity:.8}\n.hb .tm em.hot1{color:#ffe066}.hb .tm em.hot2{color:#ffab40}.hb .tm em.hot3{color:#ff6b6b}\n"; document.head.appendChild(st);
  var HB = null, want = false, seen = false, off = 0, tmr = null, loaded = false;
  var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); };
  function tick(){
    var el = document.getElementById("hb"); if(!el || !HB) return;
    if(!HB.end) return;
    var left = Math.max(0, HB.end - (Date.now() + off));
    if(left <= 0){ el.classList.remove("show"); HB.on = false; clearInterval(tmr); return; }
    var v = [Math.floor(left / 86400e3), Math.floor(left % 86400e3 / 3600e3), Math.floor(left % 3600e3 / 60e3), Math.floor(left % 60e3 / 1e3)];
    var e = el.querySelectorAll(".tm em"); if(e.length !== 4) return;
    for(var i = 0; i < 4; i++) e[i].textContent = (v[i] < 10 ? "0" : "") + v[i];
    /* 줄어들수록 강조: 3시간 이하 노랑, 10분 이하 주황, 20초 이하 빨강 (일은 그대로) */
    e[1].className = left <= 3 * 3600e3 ? "hot1" : ""; e[2].className = left <= 600e3 ? "hot2" : ""; e[3].className = left <= 20e3 ? "hot3" : "";
  }
  function draw(){
    var el = document.getElementById("hb");
    var ok = want && HB && HB.on && HB.text && /^https?:\/\//i.test(HB.url || "");
    if(!ok){ if(el) el.classList.remove("show"); return; }
    if(!el){
      el = document.createElement("a"); el.id = "hb"; el.className = "hb"; el.target = "_blank"; el.rel = "noopener";
      el.onclick = function(){ try{ fetch("/api/event", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({e:"hidden_click"}), keepalive:true}); }catch(x){} };
      document.body.appendChild(el);
    }
    el.href = HB.url;
    el.innerHTML = (HB.end ? '<b class="tm" aria-hidden="true"><em>00</em><u>일</u><em>00</em><s>:</s><em>00</em><s>:</s><em>00</em></b>' : '') + '<span class="tx">' + esc(HB.text) + '</span><i>&#8250;</i>';
    tick(); clearInterval(tmr); if(HB.end) tmr = setInterval(tick, 1000);
    if(seen) el.classList.add("show"); else { seen = true; setTimeout(function(){ el.classList.add("show"); }, 1200); }
  }
  function load(){
    if(loaded) return; loaded = true;
    var p = window.__HB_DEMO ? Promise.resolve(window.__HB_DEMO()) : fetch("/api/hidden").then(function(r){ return r.ok ? r.json() : null; });
    p.catch(function(){ return null; }).then(function(j){ HB = j; if(j && j.now) off = j.now - Date.now(); draw(); });
  }
  window.SkHidden = { show: function(v){ want = !!v; load(); draw(); } };
})();
