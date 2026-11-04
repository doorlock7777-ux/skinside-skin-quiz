/* 하단 탭 (스토어와 진단 화면 공용). 두 화면이 같은 메뉴를 같은 모양으로 보여주도록 이 파일 하나에서 만든다.
   SkTabs.html({inStore, active, demo, openQuiz}) -> 탭 안쪽 HTML.  active: store | quiz | feed | cart | me
   후기 탭은 후기 화면에 들어가면 "후기 작성" 버튼(수첩과 연필, 사이트 대표색)으로 바뀌고, 다른 화면에 가면 다시 "후기"가 된다. */
(function(){
  var st = document.createElement("style");
  st.textContent = ".sk-wr{color:var(--accent,var(--pri,#4E57A2))!important}.sk-wr i{background:none!important;opacity:1!important;display:flex!important;align-items:center;justify-content:center}.sk-wr i svg{width:27px;height:25px;display:block;flex:none}";
  document.head.appendChild(st);
  var PEN = '<svg viewBox="0.8 1.2 22.6 21" aria-hidden="true"><rect x="3.5" y="2.5" width="14" height="19" rx="3" fill="currentColor"/><path d="M1.5 7h4M1.5 11h4M1.5 15h4M1.5 19h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M8 7.5h6M8 11h4" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M20 5.2l2.3 2.3-8.1 8.1-3.2.9.9-3.2z" fill="#fff" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
  function count(){ try{ var c = JSON.parse(localStorage.getItem("sk_cart") || "[]"); return c.reduce(function(a, x){ return a + (x.q || 0); }, 0); }catch(e){ return 0; } }
  function html(o){
    var C = window.SK || {}, on = o.active, s = o.inStore, open = C.STORE_OPEN !== false, ck = C.MODE === "checkout" && open, n = o.cart != null ? o.cart : count();
    function t(href, label, k, extra, cls){ return '<a href="' + href + '"' + (o.attr && /^http/.test(href) ? o.attr : '') + ' class="' + (on === k ? 'on ' : '') + (cls || '') + '"><i></i>' + label + (extra || '') + '</a>'; }
    var h = t(s ? (o.demo ? "#/" : "/store") : "/store", "스토어", "store") + t(s ? o.quizHref : "/", "피부 진단", "quiz");
    if(ck){
      var b = s ? "" : "/store";
      h += on === "feed" ? '<a href="' + b + '#/orders" class="on sk-wr" aria-label="후기 작성"><i>' + PEN + '</i>후기 작성</a>' : t(b + "#/feed", "후기", "feed");
      h += t(b + "#/cart", "장바구니", "cart", n ? '<span class="bd">' + n + '</span>' : '') + t(b + "#/me", "내 정보", "me");
    }
    return h;
  }
  window.SkTabs = {html: html};
})();
