/* 사이트 공지 띠 (스토어·진단 공용, 강의사이트와 같은 방식)
   - 관리자 > 제품 > 공지 띠에서 켜면 모든 화면 맨 위(로고 아래)에 노란 띠로 보인다.
   - 방문자는 접었다 펼 수만 있고 닫을 수 없다(접어도 얇은 띠로 남음). 관리자가 내용을 고쳐 저장하면 다시 펼쳐진다.
   - 글꼴·굵기·크기는 여기서 직접 지정해서 두 화면이 똑같이 보인다. */
(function(){
  var KEY = "sk_notice_fold", FONT = '"Noto Sans KR","Pretendard","Apple SD Gothic Neo","Malgun Gothic",sans-serif';
  function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
  function css(){
    if(document.getElementById("sk-nt-css")) return;
    var st = document.createElement("style"); st.id = "sk-nt-css";
    st.textContent = ".sk-nt{background:#fee500;color:#171a33;font-family:" + FONT + ";font-size:14px;font-weight:700;line-height:1.5;letter-spacing:0;border-bottom:3px solid #171a33;text-align:left;position:relative;z-index:5}"
      + ".sk-nt .w{max-width:760px;margin:0 auto;box-sizing:border-box;padding:10px max(16px,env(safe-area-inset-right,0px)) 10px max(16px,env(safe-area-inset-left,0px));display:flex;align-items:flex-start;gap:10px}"
      + ".sk-nt .tx{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;word-break:keep-all;overflow-wrap:anywhere}"
      + ".sk-nt .tg{flex:none;display:inline-flex;align-items:center;height:22px;box-sizing:border-box;background:#171a33;color:#fee500;font-size:11.5px;padding:0 7px;border-radius:3px;letter-spacing:.04em}"
      + ".sk-nt .m{min-width:0}"
      + ".sk-nt a{display:inline-flex;align-items:center;height:28px;box-sizing:border-box;background:#171a33;color:#fff;text-decoration:none;white-space:nowrap;padding:0 13px;border-radius:999px;font-size:13px;font-weight:700}"
      + ".sk-nt a:hover{background:#000}"
      + ".sk-nt .fd{flex:none;display:inline-flex;align-items:center;height:24px;box-sizing:border-box;margin-top:-1px;background:none;border:1px solid currentColor;color:inherit;font-family:" + FONT + ";font-size:11.5px;font-weight:700;padding:0 9px;border-radius:999px;cursor:pointer;opacity:.8;white-space:nowrap}"
      + ".sk-nt .fd:hover{opacity:1}.sk-nt .fd:focus-visible,.sk-nt a:focus-visible{outline:3px solid #171a33;outline-offset:2px}"
      + ".sk-nt.folded .w{padding-top:5px;padding-bottom:5px;align-items:center}.sk-nt.folded .m,.sk-nt.folded a{display:none}.sk-nt.folded .tx:after{content:\"공지가 있어요\";font-size:13px}";
    document.head.appendChild(st);
  }
  function render(n){
    var box = document.getElementById("sk-nt");
    if(!n || !n.text){ if(box) box.parentNode.removeChild(box); return; }
    css();
    if(!box){
      box = document.createElement("div"); box.id = "sk-nt"; box.className = "sk-nt"; box.setAttribute("role", "region"); box.setAttribute("aria-label", "공지");
      var hd = document.querySelector("header");
      if(hd && hd.parentNode) hd.parentNode.insertBefore(box, hd.nextSibling); else document.body.insertBefore(box, document.body.firstChild);
    }
    var ext = /^https:/i.test(n.link || "");
    box.innerHTML = '<div class="w"><div class="tx" id="sk-nt-tx"><span class="tg">공지</span><span class="m">' + esc(n.text) + '</span>'
      + (n.link ? '<a href="' + esc(n.link) + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + esc(n.linkText || "자세히 보기") + ' &#8250;</a>' : '')
      + '</div><button type="button" class="fd" aria-controls="sk-nt-tx"></button></div>';
    var fb = box.querySelector(".fd"), folded = false;
    try{ folded = localStorage.getItem(KEY) === (n.updatedAt || n.text); }catch(e){}
    var apply = function(){ box.classList.toggle("folded", folded); fb.textContent = folded ? "펼치기 ▼" : "접기 ▲"; fb.setAttribute("aria-expanded", String(!folded)); };
    apply();
    fb.onclick = function(){ folded = !folded; apply(); try{ if(folded) localStorage.setItem(KEY, n.updatedAt || n.text); else localStorage.removeItem(KEY); }catch(e){} };
  }
  window.SkNotice = {render:render};
  function load(){ try{ fetch("/api/notice").then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ render(j && j.notice); }).catch(function(){}); }catch(e){} }
  if(location.protocol.indexOf("http") === 0){ if(document.readyState === "loading") document.addEventListener("DOMContentLoaded", load); else load(); }
})();
