(function(){
var CFG = window.SK || {}, CHECKOUT = CFG.MODE === "checkout";
var D = null, P = {}, user = null;
var $app = document.getElementById("app"), $nv = document.getElementById("nv"), $bk = document.getElementById("bk");

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function won(n){ return Number(n).toLocaleString("ko-KR") + "원"; }
function ls(k, v){ try{ if(v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); }catch(e){ return null; } }
function toast(t){ var e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.appendChild(e); setTimeout(function(){ e.remove(); }, 1800); }

var KO = {MINIC:"미닉", LIVNA:"리브나", GRAFEN:"그라펜", MEDIHEAL:"메디힐", TORRIDEN:"토리든", NUMBUZIN:"넘버즈인", HWAPASA:"화파사", BRDY:"브르디", ETUDE:"에뛰드", Lindsay:"린제이", "Medi Flower":"메디플라워", JMW:"제이엠더블유"};
/* 가격 */
function pr(p, oi){ return p.options && p.options[oi || 0] ? p.options[oi || 0].price : p.price; }
function disc(p){ return p.list && p.list > p.price ? Math.round((p.list - p.price) / p.list * 100) : 0; }
function saved(p){ return p.list && p.list > p.price ? p.list - p.price : 0; }

/* 장바구니 */
function cart(){ return ls("sk_cart") || []; }
function setCart(c){ ls("sk_cart", c); drawTabs(); }
function cartCount(){ return cart().reduce(function(a, x){ return a + x.q; }, 0); }
function addCart(id, opt, q){
  var c = cart(), f = c.filter(function(x){ return x.id === id && x.opt === opt; })[0];
  if(f) f.q = Math.min(20, f.q + q); else c.push({id:id, opt:opt, q:q});
  setCart(c);
}
function lines(items){
  return items.map(function(x){ var p = P[x.id]; if(!p) return null; return {p:p, opt:x.opt || 0, q:x.q, unit:pr(p, x.opt)}; }).filter(Boolean);
}
function totals(ls_){
  var sub = ls_.reduce(function(a, l){ return a + l.unit * l.q; }, 0), s = D.shipping || {fee:0, freeOver:0};
  var ship = !sub ? 0 : (sub >= s.freeOver ? 0 : s.fee);
  return {sub:sub, ship:ship, total:sub + ship};
}

/* 화면 조각 */
function img(p){ return p.img ? '<img src="' + esc(p.img) + '" alt="' + esc(p.name) + '" loading="lazy">' : '<div class="ph">' + esc(p.brandName) + '</div>'; }
function card(p){
  var d = disc(p);
  return '<a class="pc" href="#/p/' + esc(p.id) + '"><div class="im">' + img(p) + (p.hot ? '<span class="tag">인기</span>' : '') + '</div>'
    + '<div class="br">' + esc(p.brandName) + '</div><div class="nm">' + esc(p.name) + '</div>'
    + '<div class="pr">' + (d ? '<span class="d">' + d + '%</span>' : '') + '<span class="p">' + won(pr(p)) + (p.options ? '~' : '') + '</span>' + (d ? '<span class="l">' + won(p.list) + '</span>' : '') + '</div></a>';
}
function chips(cur){
  var h = '<div class="chips"><a class="chip' + (!cur ? ' on' : '') + '" href="#/">전체</a>';
  Object.keys(D.categories).forEach(function(k){ h += '<a class="chip' + (cur === k ? ' on' : '') + '" href="#/c/' + k + '">' + esc(D.categories[k]) + '</a>'; });
  return h + '</div>';
}
function drawTabs(){
  var h = location.hash || "#/", n = cartCount(), open = CFG.STORE_OPEN;
  function t(href, label, on, extra){ return '<a href="' + href + '" class="' + (on ? 'on' : '') + '"><i></i>' + label + (extra || '') + '</a>'; }
  document.querySelector(".tabs").hidden = open && /^#\/(p\/|cart|checkout)/.test(h);
  $nv.innerHTML = t("#/store", "스토어", /^#\/(store|p\/|c\/|search|cat)/.test(h)) + t("quiz/", "피부 진단", false)
    + (open && CHECKOUT ? t("#/cart", "장바구니", /^#\/(cart|checkout)/.test(h), n ? '<span class="bd">' + n + '</span>' : '') + t("#/me", "내 정보", /^#\/(me|orders|done)/.test(h)) : '');
}
function searchForm(q){ return '<form class="search" id="sf"><input id="q" value="' + esc(q || "") + '" placeholder="제품이나 브랜드 검색" enterkeyhint="search"></form>'; }
function bindSearch(){ var f = document.getElementById("sf"); if(f) f.onsubmit = function(e){ e.preventDefault(); var q = document.getElementById("q").value.trim(); if(q) location.hash = "#/search/" + encodeURIComponent(q); }; }
function soon(){
  $app.innerHTML = '<div class="soon"><span class="pill">COMING SOON</span><h1>스토어 오픈 준비 중이에요</h1><p>문장군이 고른 제품을 더 좋은 가격으로<br>곧 만나보실 수 있게 준비하고 있어요.</p></div>'
    + '<div style="padding:0 20px"><a class="btn" href="quiz/">피부 진단 먼저 해보기</a></div>';
}
function landing(){
  var items = [["나만의 피부타입 코드", "피지, 민감도, 색소, 탄력 네 가지를 한 번에 확인해요."], ["내 피부 성향 분석", "왜 그런 타입인지 쉽게 풀어서 알려드려요."], ["타입별 맞춤 루틴", "내 피부에 맞는 제품만 골라서 추천해요."], ["피부 진단 결과 카드", "이미지로 저장하고 공유할 수 있어요."]];
  $app.innerHTML = '<div class="sec"><a class="hero" href="quiz/"><b>헷갈리는 내 피부타입<br>5분이면 알 수 있어요</b><span>세안 후 대기 테스트까지 더한 진단</span><br><span class="go">피부 진단 시작하기</span></a></div>'
    + '<div class="band"></div><div class="sec"><h2>진단이 끝나면 받는 것</h2>' + items.map(function(x, i){ return '<div class="row"><div class="im" style="font-weight:800;color:var(--pri);font-size:20px">' + (i + 1) + '</div><div class="t"><div class="nm">' + x[0] + '</div><div class="s">' + x[1] + '</div></div></div>'; }).join("") + '</div><div style="padding:0 20px 8px"><a class="btn" href="quiz/">피부 진단 시작하기</a></div>' + foot();
}

/* 홈 */
function home(){
  var best = D.products.filter(function(p){ return disc(p) > 0 && !p.soldOut; }).sort(function(a, b){ return saved(b) - saved(a); })[0];
  var hot = D.products.filter(function(p){ return p.hot; });
  var h = '<div class="sec" style="padding-bottom:8px"><a class="hero" href="quiz/"><b>내 피부타입부터 확인하고<br>맞는 제품만 사세요</b><span>몇 가지 질문으로 결과 카드까지</span><br><span class="go">피부타입 진단하기</span></a></div>';
  h += '<div class="sec" style="padding-top:16px">' + searchForm("") + chips("") + '</div>';
  if(best){
    h += '<div class="band"></div><div class="sec"><h2>지금 가장 많이 아끼는 제품</h2><a class="best" href="#/p/' + esc(best.id) + '"><div class="im">' + img(best) + '</div><div><div class="em">최대 ' + disc(best) + '% 할인</div><div class="nm">' + esc(best.name) + '</div><div class="big">' + won(best.price) + '</div></div></a></div>';
  }
  h += '<div class="band"></div><div class="sec"><h2>문장군이 자주 추천하는 제품</h2><div class="grid">' + hot.map(card).join("") + '</div></div>';
  h += '<div class="band"></div><div class="sec"><h2>전체 제품</h2><div class="grid">' + D.products.map(card).join("") + '</div></div>';
  h += foot();
  $app.innerHTML = h;
  bindSearch();
}
function foot(){ return '<div class="foot">스킨인사이드 마켓<br>제품은 각 브랜드에서 직접 발송합니다. 교환과 반품은 브랜드 기준을 따릅니다.<br><a href="' + esc(CFG.KAKAO_URL) + '" target="_blank" rel="noopener" style="text-decoration:underline">카카오톡 채널 문의</a></div>'; }
function list(title, ps, cur, q){
  $app.innerHTML = '<div class="sec"><h1>' + esc(title) + '</h1><p class="sub" style="margin-bottom:16px">' + ps.length + '개 제품</p>' + searchForm(q) + chips(cur) + '<div style="height:16px"></div>'
    + (ps.length ? '<div class="grid">' + ps.map(card).join("") + '</div>' : '<div class="empty">찾는 제품이 없어요.</div>') + '</div>' + foot();
  bindSearch();
}

/* 상세 */
function detail(id){
  var p = P[id]; if(!p){ $app.innerHTML = '<div class="empty">없는 제품이에요.</div>'; return; }
  var oi = 0, d = disc(p);
  function draw(){
    var price = pr(p, oi);
    var h = '<div class="pd"><div class="big">' + img(p) + '</div><div class="sec">'
      + '<div class="sub">' + esc(p.brandName) + '</div><h1>' + esc(p.name) + '</h1>'
      + '<div class="price">' + (d && !p.options ? '<span class="d">' + d + '%</span>' : '') + '<span class="p">' + won(price) + '</span>' + (d && !p.options ? '<span class="l">' + won(p.list) + '</span>' : '') + '</div>';
    if(p.options) h += '<div class="seg">' + p.options.map(function(o, i){ return '<button data-o="' + i + '" class="' + (i === oi ? 'on' : '') + '">' + esc(o.n) + ' ' + won(o.price) + '</button>'; }).join("") + '</div>';
    if(p.note) h += '<div class="note"><b>문장군의 한마디</b><p>' + esc(p.note) + '</p></div>';
    h += '<div class="note"><b>리뷰 3줄 요약</b>' + (p.reviews && p.reviews.length ? '<ul class="rv">' + p.reviews.slice(0, 3).map(function(r){ return '<li>' + esc(r) + '</li>'; }).join("") + '</ul>' : '<p class="sub">아직 구매 후기가 없어요. 후기가 모이면 세 줄로 요약해 보여드려요.</p>') + '</div>';
    var s = D.shipping || {};
    if(CHECKOUT) h += '<div class="note"><b>배송</b><p>브랜드에서 직접 발송해요. 배송비 ' + won(s.fee) + ', ' + won(s.freeOver) + ' 이상 무료.</p></div>';
    h += '</div></div><div class="cta"><div class="in">';
    if(p.soldOut) h += '<span class="btn off">품절</span>';
    else if(CHECKOUT) h += '<button class="btn sub2" id="ad">장바구니 담기</button><button class="btn" id="by">바로 구매</button>';
    else h += '<a class="btn" id="go" target="_blank" rel="noopener" href="' + esc(p.url || CFG.STORE_URL) + '">구매하기</a>';
    h += '</div></div>';
    $app.innerHTML = h;
    [].forEach.call($app.querySelectorAll("[data-o]"), function(b){ b.onclick = function(){ oi = +b.dataset.o; draw(); }; });
    var ad = document.getElementById("ad"), by = document.getElementById("by");
    if(ad) ad.onclick = function(){ addCart(p.id, oi, 1); toast("장바구니에 담았어요"); };
    if(by) by.onclick = function(){ ls("sk_direct", [{id:p.id, opt:oi, q:1}]); location.hash = "#/checkout/direct"; };
  }
  draw();
}

/* 장바구니 */
function cartPage(){
  var ls_ = lines(cart());
  if(!ls_.length){ $app.innerHTML = '<div class="empty">장바구니가 비었어요.<br><br><a class="btn" href="#/" style="display:inline-block;padding:12px 22px">제품 보러가기</a></div>'; return; }
  var t = totals(ls_), c = cart();
  var h = '<div class="sec"><h1>장바구니</h1>';
  ls_.forEach(function(l, i){
    h += '<div class="row"><div class="im">' + img(l.p) + '</div><div class="t"><div class="s">' + esc(l.p.brandName) + '</div><div class="nm">' + esc(l.p.name) + (l.p.options ? ' (' + esc(l.p.options[l.opt].n) + ')' : '') + '</div>'
      + '<div class="qty"><button data-m="' + i + '">-</button><span>' + l.q + '</span><button data-a="' + i + '">+</button></div></div><div style="text-align:right"><div style="font-weight:800">' + won(l.unit * l.q) + '</div><button class="x" data-r="' + i + '">삭제</button></div></div>';
  });
  h += sumBox(t) + '</div><div class="cta"><div class="in"><a class="btn" href="#/checkout">' + won(t.total) + ' 주문하기</a></div></div>';
  $app.innerHTML = h;
  function mod(f){ return function(){ var i = +this.dataset[f]; f === "a" ? c[i].q = Math.min(20, c[i].q + 1) : f === "m" ? c[i].q = Math.max(1, c[i].q - 1) : c.splice(i, 1); setCart(c); cartPage(); }; }
  ["a", "m", "r"].forEach(function(f){ [].forEach.call($app.querySelectorAll("[data-" + f + "]"), function(b){ b.onclick = mod(f); }); });
}
function sumBox(t){ return '<div class="sum"><div><span>상품금액</span><span>' + won(t.sub) + '</span></div><div><span>배송비</span><span>' + (t.ship ? won(t.ship) : '무료') + '</span></div><div class="tot"><span>결제금액</span><span>' + won(t.total) + '</span></div></div>'; }

/* 로그인 */
function loginBox(next){
  return '<div class="empty"><h2 style="color:var(--ink)">네이버로 3초 만에 시작해요</h2><p>주문 내역과 배송 조회를 위해 로그인이 필요해요.</p>'
    + (CFG.LOGIN ? '<a class="btn" style="display:inline-block;padding:14px 26px;background:#03c75a" href="/api/auth/naver/start?next=' + encodeURIComponent(next) + '">네이버로 시작하기</a>' : '<div class="ntc">로그인 기능은 준비 중이에요.</div>') + '</div>';
}

/* 주문서 */
function checkout(direct){
  if(!user){ $app.innerHTML = loginBox(location.hash); return; }
  var items = direct ? (ls("sk_direct") || []) : cart(), ls_ = lines(items);
  if(!ls_.length){ location.hash = "#/cart"; return; }
  var t = totals(ls_), sv = ls("sk_ship") || {}, method = "CARD";
  var h = '<div class="sec"><h1>주문서</h1><h2 style="margin-top:20px;font-size:17px">주문 제품</h2>';
  ls_.forEach(function(l){ h += '<div class="row"><div class="im">' + img(l.p) + '</div><div class="t"><div class="nm">' + esc(l.p.name) + (l.p.options ? ' (' + esc(l.p.options[l.opt].n) + ')' : '') + '</div><div class="s">' + l.q + '개 · ' + won(l.unit * l.q) + '</div></div></div>'; });
  h += '<h2 style="margin-top:24px;font-size:17px">배송지</h2>'
    + '<label class="f">받는 분</label><input class="in2" id="nm" value="' + esc(sv.name || user.name || "") + '" autocomplete="name">'
    + '<label class="f">휴대폰 번호</label><input class="in2" id="ph" inputmode="tel" value="' + esc(sv.phone || user.phone || "") + '" autocomplete="tel" placeholder="010-0000-0000">'
    + '<label class="f">주소</label><div style="display:flex;gap:8px"><input class="in2" id="zp" value="' + esc(sv.zip || "") + '" placeholder="우편번호" readonly style="max-width:130px"><button class="btn sub2" id="sa" style="flex:none;padding:12px 16px">주소 찾기</button></div>'
    + '<input class="in2" id="a1" style="margin-top:8px" value="' + esc(sv.addr1 || "") + '" placeholder="기본 주소" autocomplete="address-line1"><input class="in2" id="a2" style="margin-top:8px" value="' + esc(sv.addr2 || "") + '" placeholder="상세 주소 (동·호수)" autocomplete="address-line2">'
    + '<label class="f">배송 메모 (선택)</label><input class="in2" id="mm" value="' + esc(sv.memo || "") + '" placeholder="문 앞에 놔주세요">'
    + '<h2 style="margin-top:24px;font-size:17px">결제 수단</h2><div class="pay2"><button data-m="CARD" class="on">카드·간편결제</button><button data-m="TRANSFER">계좌이체</button></div>'
    + sumBox(t) + '<label class="ck"><input type="checkbox" id="ag"><span>주문 내용을 확인했으며, 배송을 위해 이름·연락처·주소를 해당 브랜드에 제공하는 것에 동의합니다.</span></label>'
    + (CFG.TOSS_CLIENT_KEY ? '' : '<div class="ntc" style="margin-top:14px">결제 기능은 준비 중이에요.</div>')
    + '</div><div class="cta"><div class="in"><button class="btn' + (CFG.TOSS_CLIENT_KEY ? '' : ' off') + '" id="pay">' + won(t.total) + ' 결제하기</button></div></div>';
  $app.innerHTML = h;
  [].forEach.call($app.querySelectorAll("[data-m]"), function(b){ b.onclick = function(){ method = b.dataset.m; [].forEach.call($app.querySelectorAll("[data-m]"), function(x){ x.classList.toggle("on", x === b); }); }; });
  document.getElementById("sa").onclick = function(){
    function open(){ new daum.Postcode({oncomplete: function(r){ document.getElementById("zp").value = r.zonecode; document.getElementById("a1").value = r.roadAddress || r.jibunAddress; document.getElementById("a2").focus(); }}).open(); }
    if(window.daum && daum.Postcode) return open();
    var s = document.createElement("script"); s.src = "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"; s.onload = open; s.onerror = function(){ toast("주소 검색을 불러오지 못했어요. 직접 입력해주세요."); document.getElementById("zp").readOnly = false; }; document.head.appendChild(s);
  };
  document.getElementById("pay").onclick = function(){
    var v = function(i){ return document.getElementById(i).value.trim(); };
    var ship = {name:v("nm"), phone:v("ph"), zip:v("zp"), addr1:v("a1"), addr2:v("a2"), memo:v("mm")};
    if(!ship.name || !/^[0-9\-+ ]{9,15}$/.test(ship.phone) || !ship.addr1){ toast("받는 분, 연락처, 주소를 확인해주세요"); return; }
    if(!document.getElementById("ag").checked){ toast("동의 항목을 체크해주세요"); return; }
    ls("sk_ship", ship);
    var btn = this; btn.classList.add("off");
    fetch("/api/order", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({items:items, ship:ship})})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "주문을 만들지 못했어요"); return j; }); })
      .then(function(o){ return startToss(o, method); })
      .catch(function(e){ btn.classList.remove("off"); toast(e.message || "결제를 시작하지 못했어요"); });
  };
}
function startToss(o, method){
  function go(){
    var tp = TossPayments(CFG.TOSS_CLIENT_KEY), payment = tp.payment({customerKey: "u_" + user.id.replace(/[^A-Za-z0-9_\-=.@]/g, "").slice(0, 40)});
    return payment.requestPayment({method:method, amount:{currency:"KRW", value:o.amount}, orderId:o.orderId, orderName:o.orderName,
      successUrl:location.origin + "/pay/success/", failUrl:location.origin + "/pay/fail/", customerName:user.name || undefined, customerEmail:user.email || undefined});
  }
  if(window.TossPayments) return go();
  return new Promise(function(res, rej){ var s = document.createElement("script"); s.src = "https://js.tosspayments.com/v2/standard"; s.onload = function(){ res(go()); }; s.onerror = function(){ rej(new Error("결제창을 불러오지 못했어요")); }; document.head.appendChild(s); });
}

/* 주문내역 */
var ST = {pending:["결제 대기", "o"], paid:["결제 완료", ""], partial:["일부 발송", "o"], shipped:["발송 완료", "g"], canceled:["취소됨", "r"], failed:["결제 실패", "r"]};
var CARR = {cj:["CJ대한통운", "kr.cjlogistics"], lotte:["롯데택배", "kr.lotte"], hanjin:["한진택배", "kr.hanjin"], post:["우체국", "kr.epost"], logen:["로젠택배", "kr.logen"]};
function orders(){
  if(!user){ $app.innerHTML = loginBox("#/orders"); return; }
  $app.innerHTML = '<div class="empty">불러오는 중</div>';
  fetch("/api/order").then(function(r){ return r.json(); }).then(function(j){
    var os = (j.orders || []).filter(function(o){ return o.status !== "pending" && o.status !== "failed"; });
    if(!os.length){ $app.innerHTML = '<div class="sec"><h1>주문 내역</h1></div><div class="empty">아직 주문이 없어요.</div>'; return; }
    var h = '<div class="sec"><h1>주문 내역</h1><div style="height:12px"></div>';
    os.forEach(function(o){
      var s = ST[o.status] || [o.status, ""];
      h += '<div class="ord"><div class="h"><span>' + new Date(o.createdAt).toLocaleDateString("ko-KR") + ' · ' + esc(o.id) + '</span><span class="badge ' + s[1] + '">' + s[0] + '</span></div>';
      o.items.forEach(function(l){
        var sh = (o.shipments || {})[l.brand], tr = "";
        if(sh && sh.tracking){ var c = CARR[sh.carrier] || [sh.carrier, ""]; tr = '<div class="s"><a style="color:var(--pri);font-weight:700" target="_blank" rel="noopener" href="https://tracker.delivery/#/' + esc(c[1]) + '/' + encodeURIComponent(sh.tracking) + '">배송 조회</a> · ' + esc(c[0]) + ' ' + esc(sh.tracking) + '</div>'; }
        h += '<div class="row" style="padding:8px 0"><div class="t"><div class="nm">' + esc(l.name) + (l.optName ? ' (' + esc(l.optName) + ')' : '') + '</div><div class="s">' + l.q + '개 · ' + won(l.unit * l.q) + '</div>' + tr + '</div></div>';
      });
      h += '<div style="text-align:right;font-weight:800;margin-top:8px">결제 ' + won(o.total) + '</div></div>';
    });
    $app.innerHTML = h + '</div>';
  }).catch(function(){ $app.innerHTML = '<div class="empty">불러오지 못했어요.</div>'; });
}
function done(id){
  $app.innerHTML = '<div class="empty"><h2 style="color:var(--ink)">주문이 완료됐어요</h2><p>주문번호 ' + esc(id) + '<br>브랜드에서 곧 발송해드려요.</p><a class="btn" style="display:inline-block;padding:13px 24px" href="#/orders">주문 내역 보기</a></div>';
  ls("sk_cart", []); ls("sk_direct", []); drawTabs();
}
function me(){
  var h = '<div class="sec"><h1>' + (user ? esc(user.name || "회원") + '님' : '내 정보') + '</h1></div>';
  if(!user && CFG.LOGIN) h += loginBox("#/me");
  else if(!user) h += '<div class="sec"><div class="ntc">로그인 기능은 준비 중이에요.</div></div>';
  h += '<div class="sec menu" style="padding-top:0">' + (CHECKOUT ? '<a href="#/orders">주문 내역<span>&#8250;</span></a>' : '') + '<a href="quiz/">피부타입 진단<span>&#8250;</span></a><a href="' + esc(CFG.KAKAO_URL) + '" target="_blank" rel="noopener">카카오톡 채널 문의<span>&#8250;</span></a>' + (user ? '<a href="#/" id="lo">로그아웃<span>&#8250;</span></a>' : '') + '</div>' + foot();
  $app.innerHTML = h;
  var lo = document.getElementById("lo");
  if(lo) lo.onclick = function(e){ e.preventDefault(); fetch("/api/logout", {method:"POST"}).then(function(){ user = null; location.hash = "#/"; route(); }); };
}

/* 라우터 */
function route(){
  var h = location.hash || "#/", m;
  $bk.hidden = !CFG.STORE_OPEN || !/^#\/(p|cart|checkout|orders|search|c\/)/.test(h);
  drawTabs(); window.scrollTo(0, 0);
  if(!CFG.STORE_OPEN) return h === "#/" || h === "" ? landing() : soon();
  if(h === "#/store") return list("스토어", D.products, "");
  if((m = h.match(/^#\/p\/(.+)/))) return detail(decodeURIComponent(m[1]));
  if((m = h.match(/^#\/c\/(.+)/))){ var k = decodeURIComponent(m[1]); return list(D.categories[k] || "제품", D.products.filter(function(p){ return p.cat === k; }), k); }
  if(h === "#/cat") return list("카테고리", D.products, "");
  if((m = h.match(/^#\/search\/(.+)/))){ var q0 = decodeURIComponent(m[1]), q = q0.toLowerCase(); return list("'" + q0 + "' 검색 결과", D.products.filter(function(p){ return (p.name + p.brandName + p.brand + (KO[p.brandName] || "")).toLowerCase().indexOf(q) >= 0; }), "", q0); }
  if(CHECKOUT && h === "#/cart") return cartPage();
  if(CHECKOUT && h === "#/checkout") return checkout(false);
  if(CHECKOUT && h === "#/checkout/direct") return checkout(true);
  if(CHECKOUT && h === "#/orders") return orders();
  if((m = h.match(/^#\/done\/(.+)/))) return done(decodeURIComponent(m[1]));
  if(h === "#/me") return me();
  home();
}
$bk.onclick = function(){ history.length > 1 ? history.back() : (location.hash = "#/"); };
window.addEventListener("hashchange", route);

fetch("data/products.json").then(function(r){ return r.json(); }).then(function(j){
  D = j; j.products.forEach(function(p){ P[p.id] = p; });
  var go = function(){ route(); };
  if(CFG.LOGIN || CHECKOUT) fetch("/api/me").then(function(r){ return r.ok ? r.json() : null; }).then(function(u){ user = u && u.user; go(); }).catch(go); else go();
}).catch(function(){ $app.innerHTML = '<div class="empty">제품 정보를 불러오지 못했어요.</div>'; });
})();
