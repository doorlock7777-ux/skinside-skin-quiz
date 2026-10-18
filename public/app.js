(function(){
var CFG = window.SK || {}, CHECKOUT = CFG.MODE === "checkout";
var D = null, P = {}, user = null;
var $app = document.getElementById("app"), $nv = document.getElementById("nv"), $bk = document.getElementById("bk");

function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function won(n){ return Number(n).toLocaleString("ko-KR") + "원"; }
var MEM = {}, HM = "#/", HS = [], DEMO = !!CFG.DEMO, SORT = "pop", POP = {}, TOP = {}, SEEN = {};
function sc(p){ var s = POP[p.id]; return s ? s.v + 5 * s.c + 20 * s.b : 0; }
function buys(p){ return POP[p.id] ? POP[p.id].d || 0 : 0; } /* 화면에 표시하는 구매 수: 클릭마다 서버가 정한 값을 더한다(100 이하 +10, 300 이하 +4~9, 1000 이하 +1~3, 이후 +1). 100 이하면 화면에서 숨김 */
function byPop(ps){ var ix = {}; D.products.forEach(function(p, i){ ix[p.id] = i; }); return ps.slice().sort(function(a, b){ return sc(b) - sc(a) || ix[a.id] - ix[b.id]; }); }
function rank(){ TOP = {}; byPop(D.products).slice(0, 3).forEach(function(p){ if(sc(p) > 0) TOP[p.id] = 1; }); }
function track(id, e){ if(e === "v"){ if(SEEN[id]) return; SEEN[id] = 1; } var s = POP[id] = POP[id] || {v:0, c:0, b:0, d:0}; s[e]++; try{ fetch("/api/track", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({id:id, e:e}), keepalive:true}).then(function(r){ return r.json(); }).then(function(j){ if(j && j.inc) s.d = (s.d || 0) + j.inc; }).catch(function(){}); }catch(x){} }
function catOrder(){ var ks = Object.keys(D.categories), tot = {}; ks.forEach(function(k){ tot[k] = 0; }); D.products.forEach(function(p){ tot[p.cat] = (tot[p.cat] || 0) + sc(p); }); return ks.map(function(k, i){ return [k, i]; }).sort(function(a, b){ return tot[b[0]] - tot[a[0]] || a[1] - b[1]; }).map(function(x){ return x[0]; }); }
function ls(k, v){ try{ if(v === undefined) return JSON.parse(localStorage.getItem(k)); localStorage.setItem(k, JSON.stringify(v)); }catch(e){ if(v === undefined) return MEM[k] === undefined ? null : MEM[k]; MEM[k] = v; return null; } }
function getH(){ return DEMO ? HM : location.hash; }
function setH(v){ if(DEMO){ HS.push(HM); HM = v; route(); } else location.hash = v; }
/* 카테고리 칩 이동: 칩끼리 옮겨 다녀도 기록을 쌓지 않아서, 뒤로가기 한 번이면 칩을 누르기 전 화면(전체)으로 간다 */
var CHIPBASE = false; /* 칩을 처음 누른 화면이 전체(#/)였는지 */
function chipGo(v){
  var onCat = /^#\/c\//.test(getH() || "");
  if(!onCat){ CHIPBASE = (getH() || "#/") === "#/"; return setH(v); }
  if(v === "#/" && CHIPBASE){ CHIPBASE = false; if(DEMO){ HM = HS.pop() || "#/"; return route(); } return history.back(); }
  if(DEMO){ HM = v; route(); } else location.replace(v);
}
if(DEMO) window.__goto = setH;
var QZ = DEMO ? "#quiz" : "/", QT = ""; /* 미리보기에서는 같은 화면 안에서 진단으로 전환 */
function toast(t){ var e = document.createElement("div"); e.className = "toast"; e.textContent = t; document.body.appendChild(e); setTimeout(function(){ e.remove(); }, 1800); }

var KO = {MINIC:"미닉", LIVNA:"리브나", GRAFEN:"그라펜", MEDIHEAL:"메디힐", TORRIDEN:"토리든", NUMBUZIN:"넘버즈인", HWAPASA:"화파사", "B.READY":"비레디", ETUDE:"에뛰드", Lindsay:"린제이", "Medi Flower":"메디플라워", JMW:"제이엠더블유"};
/* 가격 */
function pr(p, oi){ return p.options && p.options[oi || 0] ? p.options[oi || 0].price : p.price; }
function lp(p, oi){ return p.options && p.options[oi || 0] ? p.options[oi || 0].list || null : p.list; }
function discAt(p, oi){ var l = lp(p, oi), v = pr(p, oi); return l && l > v ? Math.round((l - v) / l * 100) : 0; }
function disc(p){ var m = 0; (p.options || [0]).forEach(function(o, i){ m = Math.max(m, discAt(p, i)); }); return m; }
function saved(p){ var m = 0; (p.options || [0]).forEach(function(o, i){ var l = lp(p, i), v = pr(p, i); if(l && l > v) m = Math.max(m, l - v); }); return m; }

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
function lnk(p){ return CHECKOUT ? 'href="#/p/' + esc(p.id) + '"' : 'href="' + esc(p.url || CFG.STORE_URL) + '" target="_blank" rel="noopener" data-pid="' + esc(p.id) + '"'; }
function card(p){
  var d = disc(p);
  return '<a class="pc" ' + lnk(p) + '><div class="im">' + img(p) + (TOP[p.id] ? '<span class="tag">인기</span>' : '') + '</div>'
    + '<div class="br">' + esc(p.brandName) + '</div><div class="nm">' + esc(p.name) + '</div>'
    + '<div class="pr">' + (d ? '<span class="d">' + (p.options ? '최대 ' : '') + d + '%</span>' : '') + '<span class="p">' + won(pr(p)) + (p.options ? '~' : '') + '</span>' + (d && !p.options ? '<span class="l">' + won(p.list) + '</span>' : '') + '</div></a>';
}
function chips(cur){
  var h = '<div class="chips"><a class="chip' + (!cur ? ' on' : '') + '" href="#/">전체</a>';
  catOrder().forEach(function(k){ h += '<a class="chip' + (cur === k ? ' on' : '') + '" href="#/c/' + k + '">' + esc(D.categories[k]) + '</a>'; });
  return h + '</div>';
}
function drawTabs(){
  var h = getH() || "#/", n = cartCount(), open = CFG.STORE_OPEN;
  function t(href, label, on, extra){ return '<a href="' + href + '"' + (/^http/.test(href) ? QT : '') + ' class="' + (on ? 'on' : '') + '"><i></i>' + label + (extra || '') + '</a>'; }
  document.querySelector(".tabs").hidden = open && /^#\/(p\/|checkout)/.test(h);
  $nv.innerHTML = t(DEMO ? "#/" : "/store", "스토어", !/^#\/(cart|checkout|me|orders|points|done|admin)/.test(h)) + t(QZ, "피부 진단", false)
    + (open && CHECKOUT ? t("#/cart", "장바구니", /^#\/(cart|checkout)/.test(h), n ? '<span class="bd">' + n + '</span>' : '') + t("#/me", "내 정보", /^#\/(me|orders|points|done)/.test(h)) : '');
}
function searchForm(q){ return '<form class="search" id="sf"><input id="q" value="' + esc(q || "") + '" placeholder="제품이나 브랜드 검색" enterkeyhint="search"></form>'; }
function bindSearch(){ var f = document.getElementById("sf"); if(f) f.onsubmit = function(e){ e.preventDefault(); var q = document.getElementById("q").value.trim(); if(q) setH("#/search/" + encodeURIComponent(q)); }; }
function soon(){
  $app.innerHTML = '<div class="soon"><span class="pill">COMING SOON</span><h1>스토어 오픈 준비 중이에요</h1><p>문장군이 고른 제품을 더 좋은 가격으로<br>곧 만나보실 수 있게 준비하고 있어요.</p></div>'
    + '<div style="padding:0 20px"><a class="btn" href="' + QZ + '"' + QT + '>피부 진단 먼저 해보기</a></div>';
}

/* 홈 */
function myResult(){ try{ var r = JSON.parse(localStorage.getItem("skinside_result") || "null"); return r && r.key && r.p ? r : null; }catch(e){ return null; } }
function myCard(r){
  var cx = 75, cy = 62, R = 38, ks = ["od","sr","pn","wt"], nm = ["피지","민감","색소","주름"];
  function P(f){ return ks.map(function(k, i){ var a = -Math.PI / 2 + i * Math.PI / 2, v = typeof f === "number" ? f : Math.max(8, r.p[k] || 0), rr = R * v / 100; return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]; }); }
  function pts(a){ return a.map(function(q){ return q[0].toFixed(1) + "," + q[1].toFixed(1); }).join(" "); }
  var g = '<svg viewBox="0 0 150 124" role="img" aria-label="피부 레이더 차트"><defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity=".25"/></linearGradient></defs>';
  [33, 66, 100].forEach(function(l){ g += '<polygon points="' + pts(P(l)) + '" fill="none" stroke="rgba(255,255,255,.28)" stroke-width=".8"/>'; });
  P(100).forEach(function(q){ g += '<line x1="75" y1="62" x2="' + q[0].toFixed(1) + '" y2="' + q[1].toFixed(1) + '" stroke="rgba(255,255,255,.22)" stroke-width=".8"/>'; });
  g += '<polygon points="' + pts(P()) + '" fill="url(#rg)" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/>';
  P().forEach(function(q){ g += '<circle cx="' + q[0].toFixed(1) + '" cy="' + q[1].toFixed(1) + '" r="2.2" fill="#fff"/>'; });
  [[75, 14], [128, 66], [75, 118], [22, 66]].forEach(function(q, i){ g += '<text x="' + q[0] + '" y="' + q[1] + '" text-anchor="middle" font-size="11" fill="#fff" opacity=".85">' + nm[i] + '</text>'; });
  g += '</svg>';
  return '<div class="sec" style="padding-bottom:8px"><a class="hero my" href="' + QZ + '"' + QT + '><div class="tx"><span class="k">나의 피부타입</span><b class="cd">' + esc(r.key) + '</b><span class="k">' + esc(r.desc || "") + '</span></div>' + g + '</a></div>';
}
function quizDone(){ try{ return JSON.parse(localStorage.getItem("skinside_quiz_v2") || "{}").screen === "result"; }catch(e){ return false; } }
function home(){
  var best = D.products.filter(function(p){ return !p.soldOut; }).sort(function(x, y){ return buys(y) - buys(x) || sc(y) - sc(x); })[0];
  var mr = myResult(); /* 다시 진단하는 중이어도 가장 최근 결과를 보여준다 */
  var h = mr ? myCard(mr) : quizDone() ? '<div class="sec" style="padding-bottom:8px"><a class="hero" href="' + QZ + '"' + QT + '><b>내 진단 결과를<br>다시 확인해보세요</b><span class="go">결과 보기</span></a></div>' : '<div class="sec" style="padding-bottom:8px"><a class="hero" href="' + QZ + '"' + QT + '><b>내 피부타입부터 확인하고<br>맞는 제품만 사세요</b><span>몇 가지 질문으로 결과 카드까지</span><br><span class="go">피부타입 진단하기</span></a></div>';
  h += '<div class="sec" style="padding-top:16px">' + searchForm("") + chips("") + '</div>';
  if(best){
    var em = [buys(best) > 100 ? '지금 ' + buys(best).toLocaleString("ko-KR") + '명이 구매 중' : '', disc(best) ? '최대 ' + disc(best) + '% 할인' : ''].filter(Boolean).join(' · ');
    h += '<div class="band"></div><div class="sec"><h2>지금 가장 많이 구매하는 제품</h2><a class="best" ' + lnk(best) + '><div class="im">' + img(best) + '</div><div>' + (em ? '<div class="em">' + em + '</div>' : '') + '<div class="nm">' + esc(best.name) + '</div><div class="big">' + won(best.price) + '</div></div></a></div>';
  }
  h += '<div class="band"></div><div class="sec"><h2>인기 제품</h2><div class="grid">' + byPop(D.products).map(card).join("") + '</div></div>';
  h += foot();
  $app.innerHTML = h;
  bindSearch();
}
function foot(){ return '<div class="foot">스킨인사이드 마켓<br>제품은 각 브랜드에서 직접 발송합니다. 교환과 반품은 브랜드 기준을 따릅니다.<br><a href="' + esc(CFG.KAKAO_URL) + '" target="_blank" rel="noopener" style="text-decoration:underline">카카오톡 채널 문의</a></div>'; }
function sortBar(){ return '<div class="chips" style="margin-top:10px">' + [["pop","인기순"],["disc","할인율순"],["low","낮은 가격순"]].map(function(x){ return '<button class="chip' + (SORT === x[0] ? ' on' : '') + '" data-sort="' + x[0] + '">' + x[1] + '</button>'; }).join("") + '</div>'; }
function sorted(ps){ var a = byPop(ps); if(SORT === "disc") a.sort(function(x, y){ return disc(y) - disc(x); }); else if(SORT === "low") a.sort(function(x, y){ return pr(x) - pr(y); }); return a; }
function list(title, ps, cur, q){ ps = sorted(ps);
  $app.innerHTML = '<div class="sec"><h1>' + esc(title) + '</h1><p class="sub" style="margin-bottom:16px">' + ps.length + '개 제품</p>' + searchForm(q) + chips(cur) + sortBar() + '<div style="height:16px"></div>'
    + (ps.length ? '<div class="grid">' + ps.map(card).join("") + '</div>' : '<div class="empty">찾는 제품이 없어요.</div>') + '</div>' + foot();
  bindSearch();
  [].forEach.call($app.querySelectorAll("[data-sort]"), function(b){ b.onclick = function(){ SORT = b.dataset.sort; route(); }; });
}

/* 상세 */
function stars(n){ var s = ""; for(var i = 1; i <= 5; i++) s += i <= n ? "★" : '<span style="color:var(--line)">★</span>'; return '<span style="color:#ffb400;letter-spacing:1px">' + s + '</span>'; }
function loadReviews(id){
  var box = document.getElementById("rvbox"); if(!box) return;
  fetch("/api/review?product=" + encodeURIComponent(id)).then(function(r){ return r.json(); }).then(function(j){
    if(!document.getElementById("rvbox")) return;
    box.innerHTML = '<b>구매 후기 ' + (j.count ? stars(Math.round(j.avg)) + ' ' + j.avg + ' (' + j.count + '개)' : '') + '</b>' + (j.reviews.length ? j.reviews.slice(0, 20).map(function(r){
      return '<div style="padding:10px 0;border-top:1px solid var(--line)"><div>' + stars(r.rating) + (r.best ? ' <span style="font-size:12px;font-weight:800;color:var(--pri)">베스트</span>' : '') + ' <span class="s" style="margin-left:6px">' + esc(r.userName) + ' · ' + new Date(r.createdAt).toLocaleDateString("ko-KR") + '</span></div><p style="margin:6px 0 0;white-space:pre-wrap">' + esc(r.text) + '</p>' + ((r.photos && r.photos.length) ? '<div class="rv-ph">' + r.photos.map(function(u){ return '<img loading="lazy" decoding="async" src="' + esc(u) + '" data-full="' + esc(u) + '" alt="후기 사진">'; }).join("") + '</div>' : '') + '</div>'; }).join("") : '<p class="sub">아직 후기가 없어요. 첫 후기를 남겨주세요.</p>');
  }).catch(function(){ box.innerHTML = '<b>구매 후기</b><p class="sub">후기를 불러오지 못했어요.</p>'; });
}
function detail(id){
  var p = P[id]; if(!p){ $app.innerHTML = '<div class="empty">없는 제품이에요.</div>'; return; }
  var oi = 0;
  function draw(){
    var price = pr(p, oi), d = discAt(p, oi);
    var h = '<div class="pd"><div class="big">' + img(p) + '</div><div class="sec">'
      + '<div class="sub">' + esc(p.brandName) + '</div><h1>' + esc(p.name) + '</h1>'
      + '<div class="price">' + (d ? '<span class="d">' + d + '%</span>' : '') + '<span class="p">' + won(price) + '</span>' + (d ? '<span class="l">' + won(lp(p, oi)) + '</span>' : '') + '</div>';
    if(p.options) h += '<div class="seg">' + p.options.map(function(o, i){ return '<button data-o="' + i + '" class="' + (i === oi ? 'on' : '') + '">' + esc(o.n) + ' ' + won(o.price) + '</button>'; }).join("") + '</div>';
    if(p.note) h += '<div class="note"><b>문장군의 한마디</b><p>' + esc(p.note) + '</p></div>';
    h += '<div class="note"><b>리뷰 3줄 요약' + (DEMO && p.reviews && p.reviews.length ? ' <span class="sub" style="font-weight:600">(미리보기 예시)</span>' : '') + '</b>' + (p.reviews && p.reviews.length ? '<ul class="rv">' + p.reviews.slice(0, 3).map(function(r){ return '<li>' + esc(r) + '</li>'; }).join("") + '</ul>' : '<p class="sub">아직 구매 후기가 없어요. 후기가 모이면 세 줄로 요약해 보여드려요.</p>') + '</div>';
    var s = D.shipping || {};
    if(CHECKOUT) h += '<div class="note"><b>배송</b><p>브랜드에서 직접 발송해요. 배송비 ' + won(s.fee) + ', ' + won(s.freeOver) + ' 이상 무료.</p></div>';
    if(CHECKOUT) h += '<div class="note" id="rvbox"><b>구매 후기</b><p class="sub">불러오는 중</p></div>';
    h += '</div></div><div class="cta"><div class="in">';
    if(p.soldOut) h += '<span class="btn off">품절</span>';
    else if(CHECKOUT) h += '<button class="btn sub2" id="ad">장바구니 담기</button><button class="btn" id="by">바로 구매</button>';
    else h += '<a class="btn" id="go" target="_blank" rel="noopener" href="' + esc(p.url || CFG.STORE_URL) + '">구매하기</a>';
    h += '</div></div>';
    $app.innerHTML = h;
    if(CHECKOUT) loadReviews(p.id);
    [].forEach.call($app.querySelectorAll("[data-o]"), function(b){ b.onclick = function(){ oi = +b.dataset.o; draw(); }; });
    var ad = document.getElementById("ad"), by = document.getElementById("by");
    var gl = document.getElementById("go"); if(gl) gl.onclick = function(){ track(p.id, "c"); };
    if(ad) ad.onclick = function(){ track(p.id, "c"); addCart(p.id, oi, 1); toast("장바구니에 담았어요"); };
    if(by) by.onclick = function(){ track(p.id, "c"); ls("sk_direct", [{id:p.id, opt:oi, q:1}]); setH("#/checkout/direct"); };
  }
  track(p.id, "v");
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
  h += sumBox(t) + '</div><div style="height:64px"></div><div class="cta up"><div class="in"><a class="btn" href="#/checkout">' + won(t.total) + ' 주문하기</a></div></div>';
  $app.innerHTML = h;
  function mod(f){ return function(){ var i = +this.dataset[f]; f === "a" ? c[i].q = Math.min(20, c[i].q + 1) : f === "m" ? c[i].q = Math.max(1, c[i].q - 1) : c.splice(i, 1); setCart(c); cartPage(); }; }
  ["a", "m", "r"].forEach(function(f){ [].forEach.call($app.querySelectorAll("[data-" + f + "]"), function(b){ b.onclick = mod(f); }); });
}
function sumBox(t, pts){ pts = pts || 0; return '<div class="sum"><div><span>상품금액</span><span>' + won(t.sub) + '</span></div><div><span>배송비</span><span>' + (t.ship ? won(t.ship) : '무료') + '</span></div>' + (pts ? '<div><span>포인트 사용</span><span>-' + won(pts) + '</span></div>' : '') + '<div class="tot"><span>결제금액</span><span>' + won(t.total - pts) + '</span></div></div>'; }

/* 로그인 */
function loginBox(next){
  return '<div class="empty"><h2 style="color:var(--ink)">네이버로 3초 만에 시작해요</h2><p>주문 내역과 배송 조회를 위해 로그인이 필요해요.</p>'
    + (CFG.LOGIN ? (DEMO ? '<button class="btn" data-demo-login style="display:inline-block;padding:14px 26px;background:#03c75a">네이버로 시작하기 (데모)</button>' : '<a class="btn" style="display:inline-block;padding:14px 26px;background:#03c75a" href="/api/auth/naver/start?next=' + encodeURIComponent(next) + '">네이버로 시작하기</a>') : '<div class="ntc">로그인 기능은 준비 중이에요.</div>') + '</div>';
}

/* 주문서 */
function checkout(direct){
  if(!user){ $app.innerHTML = loginBox(getH()); return; }
  var items = direct ? (ls("sk_direct") || []) : cart(), ls_ = lines(items);
  if(!ls_.length){ setH("#/cart"); return; }
  var t = totals(ls_), sv = ls("sk_ship") || {}, method = "NAVERPAY";
  var h = '<div class="sec"><h1>주문서</h1><h2 style="margin-top:20px;font-size:17px">주문 제품</h2>';
  ls_.forEach(function(l){ h += '<div class="row"><div class="im">' + img(l.p) + '</div><div class="t"><div class="nm">' + esc(l.p.name) + (l.p.options ? ' (' + esc(l.p.options[l.opt].n) + ')' : '') + '</div><div class="s">' + l.q + '개 · ' + won(l.unit * l.q) + '</div></div></div>'; });
  h += '<h2 style="margin-top:24px;font-size:17px">배송지</h2>'
    + '<label class="f">받는 분</label><input class="in2" id="nm" value="' + esc(sv.name || user.name || "") + '" autocomplete="name">'
    + '<label class="f">휴대폰 번호</label><input class="in2" id="ph" inputmode="tel" value="' + esc(sv.phone || user.phone || "") + '" autocomplete="tel" placeholder="010-0000-0000">'
    + '<label class="f">주소</label><div style="display:flex;gap:8px"><input class="in2" id="zp" value="' + esc(sv.zip || "") + '" placeholder="우편번호" readonly style="max-width:130px"><button class="btn sub2" id="sa" style="flex:none;padding:12px 16px">주소 찾기</button></div>'
    + '<input class="in2" id="a1" style="margin-top:8px" value="' + esc(sv.addr1 || "") + '" placeholder="기본 주소" autocomplete="address-line1"><input class="in2" id="a2" style="margin-top:8px" value="' + esc(sv.addr2 || "") + '" placeholder="상세 주소 (동·호수)" autocomplete="address-line2">'
    + '<label class="f">배송 메모 (선택)</label><input class="in2" id="mm" value="' + esc(sv.memo || "") + '" placeholder="문 앞에 놔주세요">'
    + '<h2 style="margin-top:24px;font-size:17px">결제 수단</h2><div class="pay2"><button data-m="NAVERPAY" class="on npay"><i>N</i>네이버페이</button><button data-m="CARD">카드·간편결제</button><button data-m="TRANSFER">계좌이체</button></div>'
    + '<h2 style="margin-top:24px;font-size:17px">포인트</h2><div class="ptb"><div class="r1"><span>보유 포인트</span><b id="pb">조회 중</b></div><div class="r2"><input class="in2" id="pu" inputmode="numeric" placeholder="사용할 포인트" autocomplete="off"><button class="btn sub2" id="pa" style="flex:none;padding:12px 16px">전액 사용</button></div><p class="s">현금처럼 결제에 쓸 수 있어요. 최소 100원은 결제해요.</p></div>'
    + '<div id="sb">' + sumBox(t, 0) + '</div><label class="ck"><input type="checkbox" id="ag"><span>주문 내용을 확인했으며, 배송을 위해 이름·연락처·주소를 해당 브랜드에 제공하는 것에 동의합니다.</span></label>'
    + (CFG.TOSS_CLIENT_KEY ? '' : '<div class="ntc" style="margin-top:14px">결제 기능은 준비 중이에요.</div>')
    + '</div><div class="cta"><div class="in"><button class="btn' + (CFG.TOSS_CLIENT_KEY ? '' : ' off') + '" id="pay">' + won(t.total) + ' 결제하기</button></div></div>';
  $app.innerHTML = h;
  var PB = 0, PTS = 0, pcap = function(){ return Math.max(0, Math.min(PB, t.total - 100)); };
  function setPts(v){ PTS = Math.max(0, Math.min(pcap(), Math.floor(Number(v) || 0))); document.getElementById("sb").innerHTML = sumBox(t, PTS); document.getElementById("pay").textContent = won(t.total - PTS) + " 결제하기"; }
  fetch("/api/points").then(function(r){ return r.ok ? r.json() : {balance:0}; }).then(function(j){ PB = j.balance || 0; document.getElementById("pb").textContent = PB.toLocaleString("ko-KR") + " P"; }).catch(function(){ document.getElementById("pb").textContent = "0 P"; });
  document.getElementById("pu").oninput = function(){ var n = parseInt(this.value.replace(/[^0-9]/g, ""), 10) || 0; if(n > pcap()) n = pcap(); this.value = n ? String(n) : ""; setPts(n); };
  document.getElementById("pa").onclick = function(){ document.getElementById("pu").value = pcap() ? String(pcap()) : ""; setPts(pcap()); };
  [].forEach.call($app.querySelectorAll("[data-m]"), function(b){ b.onclick = function(){ method = b.dataset.m; [].forEach.call($app.querySelectorAll("[data-m]"), function(x){ x.classList.toggle("on", x === b); }); }; });
  document.getElementById("sa").onclick = function(){
    if(DEMO){ document.getElementById("zp").value = "06236"; document.getElementById("a1").value = "서울특별시 강남구 테헤란로 123 (예시 주소)"; document.getElementById("a2").focus(); return; }
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
    var btn = this; if(btn.dataset.busy) return; btn.dataset.busy = "1"; btn.classList.add("off");
    fetch("/api/order", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({items:items, ship:ship, usePoints:PTS})})
      .then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "주문을 만들지 못했어요"); return j; }); })
      .then(function(o){ return startToss(o, method); })
      .catch(function(e){ btn.dataset.busy = ""; btn.classList.remove("off"); toast(e.message || "결제를 시작하지 못했어요"); });
  };
}
function startToss(o, method){
  function go(){
    var tp = TossPayments(CFG.TOSS_CLIENT_KEY), payment = tp.payment({customerKey: "u_" + user.id.replace(/[^A-Za-z0-9_\-=.@]/g, "").slice(0, 40)});
    /* 네이버페이는 토스페이먼츠 결제창에서 네이버페이 자체창을 바로 연다 (토스 상점 설정에서 네이버페이 연동 필요) */
    var pm = method === "NAVERPAY" ? {method:"CARD", card:{flowMode:"DIRECT", easyPay:"NAVERPAY"}} : {method:method};
    return payment.requestPayment({method:pm.method, card:pm.card, amount:{currency:"KRW", value:o.amount}, orderId:o.orderId, orderName:o.orderName,
      successUrl:location.origin + "/pay/success/", failUrl:location.origin + "/pay/fail/", customerName:user.name || undefined, customerEmail:user.email || undefined});
  }
  if(window.TossPayments) return go();
  return new Promise(function(res, rej){ var s = document.createElement("script"); s.src = "https://js.tosspayments.com/v2/standard"; s.onload = function(){ res(go()); }; s.onerror = function(){ rej(new Error("결제창을 불러오지 못했어요")); }; document.head.appendChild(s); });
}

/* 주문내역 (네이버플러스스토어 주문/배송내역과 같은 구성) */
var ST2 = {paid:"결제완료", partial:"배송 준비중", shipped:"배송중", canceled:"주문취소"};
var CARR = {cj:["CJ대한통운", "kr.cjlogistics"], lotte:["롯데택배", "kr.lotte"], hanjin:["한진택배", "kr.hanjin"], post:["우체국", "kr.epost"], logen:["로젠택배", "kr.logen"]};
var OFILTER = "all", OCACHE = null;
function kdate(iso){ var d = new Date(new Date(iso).getTime() + 9 * 36e5), p = function(n){ return (n < 10 ? "0" : "") + n; }; return p(d.getUTCMonth() + 1) + "." + p(d.getUTCDate()) + ". " + p(d.getUTCHours()) + ":" + p(d.getUTCMinutes()); }
function orders(){
  if(!user){ $app.innerHTML = loginBox("#/orders"); return; }
  $app.innerHTML = '<div class="empty">불러오는 중</div>';
  Promise.all([fetch("/api/order").then(function(r){ return r.json(); }), fetch("/api/review/mine").then(function(r){ return r.ok ? r.json() : {done:[]}; }).catch(function(){ return {done:[]}; }), fetch("/api/cs/mine").then(function(r){ return r.ok ? r.json() : {tickets:[]}; }).catch(function(){ return {tickets:[]}; })]).then(function(rr){
    var os = ((rr[0] && rr[0].orders) || []).filter(function(o){ return o.status !== "pending" && o.status !== "failed"; });
    OCACHE = {os:os, done:(rr[1] && rr[1].done) || [], tk:(rr[2] && rr[2].tickets) || []};
    drawOrders();
  }).catch(function(){ $app.innerHTML = '<div class="empty">불러오지 못했어요.</div>'; });
}
function maskPh(p){ var d = String(p || "").replace(/[^0-9]/g, ""); return d.length >= 9 ? d.slice(0, 3) + "-****-" + d.slice(-4) : ""; }
function shipInfo(o){
  var s = o.ship || {}, h = '<div class="shp"><b>배송 정보</b>', seen = {};
  o.items.forEach(function(l){
    if(seen[l.brand]) return; seen[l.brand] = 1;
    var sh = (o.shipments || {})[l.brand], bn = brandLabel(l) || l.brand, st = o.status === "canceled" ? "취소됨" : (sh && sh.tracking ? "발송 완료" : "상품 준비중");
    var tr = "";
    if(sh && sh.tracking){ var c = CARR[sh.carrier] || [sh.carrier, ""]; tr = ' · ' + esc(c[0]) + ' ' + esc(sh.tracking) + ' <a target="_blank" rel="noopener" href="https://tracker.delivery/#/' + esc(c[1]) + '/' + encodeURIComponent(sh.tracking) + '">배송 조회</a>'; }
    h += '<div><span>' + esc(bn) + '</span><span>' + st + tr + '</span></div>';
  });
  if(s.name) h += '<div><span>받는 분</span><span>' + esc(s.name) + (maskPh(s.phone) ? ' · ' + maskPh(s.phone) : '') + '</span></div><div><span>주소</span><span>' + (s.zip ? '(' + esc(s.zip) + ') ' : '') + esc(s.addr1 || "") + ' ' + esc(s.addr2 || "") + '</span></div>' + (s.memo ? '<div><span>배송 메모</span><span>' + esc(s.memo) + '</span></div>' : '');
  return h + '</div>';
}
function drawOrders(){
  var C = OCACHE, os = C.os, DONE = C.done, TK = C.tk, claim = {};
  TK.forEach(function(t){ if(t.type !== "inquiry") claim[t.orderId] = 1; });
  var claimN = os.filter(function(o){ return o.status === "canceled" || claim[o.id]; }).length;
  var list = OFILTER === "claim" ? os.filter(function(o){ return o.status === "canceled" || claim[o.id]; }) : os;
  var h = '<div class="oc-page"><div class="sec"><h1>주문/배송내역</h1></div><div class="oc-chips"><button data-of="all" class="' + (OFILTER === "all" ? "on" : "") + '">전체</button><button data-of="claim" class="' + (OFILTER === "claim" ? "on" : "") + '">취소/교환/반품 <b>' + claimN + '</b></button></div><div class="oc-list">';
  if(!os.length) h += '<div class="empty">아직 주문이 없어요.</div>';
  else if(!list.length) h += '<div class="empty">내역이 없어요.</div>';
  list.forEach(function(o){
    var canCancel = o.status === "paid" && !Object.keys(o.shipments || {}).some(function(k){ return o.shipments[k] && o.shipments[k].tracking; });
    h += '<div class="oc"><div class="st"><b>' + (ST2[o.status] || o.status) + '</b>' + (o.status === "canceled" ? '<span>' + kdate(o.canceledAt || o.createdAt) + ' 취소</span>' : '') + '</div>';
    o.items.forEach(function(l, ix){
      var p = P[l.id], key = o.id + "|" + l.id, sh = (o.shipments || {})[l.brand], tr = "";
      if(sh && sh.tracking){ var c = CARR[sh.carrier] || [sh.carrier, ""]; tr = '<div class="s"><a style="color:var(--pri);font-weight:700" target="_blank" rel="noopener" href="https://tracker.delivery/#/' + esc(c[1]) + '/' + encodeURIComponent(sh.tracking) + '">배송 조회</a> · ' + esc(c[0]) + ' ' + esc(sh.tracking) + '</div>'; }
      h += '<div class="oi"><div class="im">' + (p ? img(p) : '') + '</div><div class="t"><div class="d">' + kdate(o.paidAt || o.createdAt) + ' 주문</div><div class="nm">' + esc(l.name) + (l.optName ? ' (' + esc(l.optName) + ')' : '') + '</div><div class="pr"><b>' + won(l.unit * l.q) + '</b> <span>· ' + l.q + '개</span></div>' + tr
        + '<div class="lk"><a data-od="' + esc(o.id) + '">상세보기 &#8250;</a><a data-oc="' + esc(o.id + "|" + l.brand) + '">판매자정보/문의 &#8250;</a></div></div></div>';
      var acts = '';
      if(o.status !== "canceled"){
        acts += DONE.indexOf(key) >= 0 ? '<button class="ob" disabled>리뷰 작성 완료</button>' : '<span class="obw"><button class="ob pri" data-rv="open" data-k="' + esc(key) + '">리뷰쓰기</button><i class="bub">최대 500P</i></span>';
      }
      if(p) acts += '<button class="ob" data-add="' + esc(l.id) + '" data-opt="' + (l.opt || 0) + '">장바구니 담기</button>';
      h += '<div class="obs">' + acts + '</div><div data-rvform="' + esc(key) + '"></div>';
    });
    if(canCancel) h += '<div class="obs"><button class="ob" data-ocancel="' + esc(o.id) + '">취소요청</button></div><div data-cform="' + esc(o.id) + '" hidden></div>';
    else if(o.status === "partial" || o.status === "shipped") h += '<p class="s" style="margin:6px 0 0">발송이 시작돼서 직접 취소할 수 없어요. 판매자정보/문의에서 교환·반품을 신청해주세요.</p>';
    var pay = o.payAmount !== undefined ? o.payAmount : o.total;
    h += '<div data-det="' + esc(o.id) + '" class="det" hidden><div><span>주문번호</span><span>' + esc(o.id) + '</span></div><div><span>상품금액</span><span>' + won(o.sub !== undefined ? o.sub : o.total) + '</span></div><div><span>배송비</span><span>' + (o.shipFee ? won(o.shipFee) : '무료') + '</span></div>' + (o.pointsUsed ? '<div><span>포인트 사용</span><span>-' + won(o.pointsUsed) + '</span></div>' : '') + '<div class="tot"><span>결제금액</span><span>' + won(pay) + '</span></div>' + shipInfo(o) + (o.status === "canceled" ? '<p class="s" style="margin:8px 0 0">결제 취소는 카드사·결제수단에 따라 반영까지 영업일 기준 3~5일 걸릴 수 있어요.' + (o.pointsUsed ? ' 사용한 포인트는 바로 돌려드렸어요.' : '') + '</p>' : '') + '</div>';
    var seen = {};
    o.items.forEach(function(l){ if(seen[l.brand]) return; seen[l.brand] = 1; var tks = TK.filter(function(t){ return t.orderId === o.id && t.brand === l.brand; }); h += '<div data-csw="' + esc(o.id + "|" + l.brand) + '"' + (tks.length ? '' : ' hidden') + '>' + csBox(o, l, tks) + '</div>'; });
    h += '</div>';
  });
  $app.innerHTML = h + '</div></div>';
}
document.addEventListener("click", function(e){
  var t = e.target, q = function(sel){ return t.closest && t.closest(sel); }, b;
  if((b = q("[data-of]"))){ OFILTER = b.dataset.of; if(OCACHE) drawOrders(); return; }
  if((b = q("[data-od]"))){ var d = document.querySelector('[data-det="' + b.dataset.od + '"]'); if(d) d.hidden = !d.hidden; return; }
  if((b = q("[data-oc]"))){ var w = document.querySelector('[data-csw="' + b.dataset.oc + '"]'); if(w) w.hidden = !w.hidden; return; }
  if((b = q("[data-add]"))){ addCart(b.dataset.add, +b.dataset.opt || 0, 1); toast("장바구니에 담았어요"); return; }
  if((b = q("[data-ocancel]"))){ var f = document.querySelector('[data-cform="' + b.dataset.ocancel + '"]'); if(!f.hidden){ f.hidden = true; return; } f.hidden = false;
    f.innerHTML = '<div class="cf"><b>주문을 취소할까요?</b><p class="s">아직 발송 전이라 바로 취소돼요. 결제는 취소(환불)되고, 사용한 포인트는 바로 돌려드려요. 이 주문에 남긴 리뷰와 적립 포인트는 함께 사라져요.</p><select>' + ["단순 변심", "주문을 잘못 했어요", "배송지를 잘못 입력했어요", "다른 곳에서 구매했어요", "기타"].map(function(x){ return '<option>' + x + '</option>'; }).join("") + '</select><div class="row2"><button class="ob" data-ocn="x">닫기</button><button class="ob red" data-ocx="' + esc(b.dataset.ocancel) + '">주문 취소하기</button></div><span class="s" data-cerr></span></div>'; return; }
  if((b = q("[data-ocn]"))){ var f2 = b.closest("[data-cform]"); f2.hidden = true; return; }
  if((b = q("[data-ocx]"))){ var box = b.closest(".cf"); b.disabled = true;
    fetch("/api/order/cancel", {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({orderId:b.dataset.ocx, reason:box.querySelector("select").value})}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "취소하지 못했어요"); return j; }); })
      .then(function(j){ toast("주문을 취소했어요" + (j.pointsBack ? " · " + j.pointsBack.toLocaleString("ko-KR") + "P 반환" : "")); orders(); }).catch(function(x){ b.disabled = false; box.querySelector("[data-cerr]").textContent = x.message; }); return; }
});
var CST = {open:"답변 대기", answered:"답변 완료", approved:"승인됨", rejected:"거절됨", received:"반품 입고 확인", refunded:"환불 완료", closed:"종료"}, CTY = {inquiry:"문의", exchange:"교환", return:"반품"};
function csBox(o, l, tks){
  var k = esc(o.id + "|" + l.brand), h = '<div class="csb" style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px">';
  tks.forEach(function(t){
    var fin = t.status === "refunded" || t.status === "closed" || t.status === "rejected";
    h += '<div style="background:var(--bg);border-radius:12px;padding:10px 12px;margin-bottom:8px;font-size:13px"><b>' + CTY[t.type] + ' · ' + CST[t.status] + '</b>' + (t.refundAmount ? ' · ' + won(t.refundAmount) + ' 환불' : '')
      + t.messages.map(function(m){ return '<div style="margin-top:6px"><span class="s">' + ({customer:"나", partner:esc(t.brandName), admin:"스킨인사이드"}[m.from] || "") + '</span><br>' + esc(m.text) + '</div>'; }).join("")
      + (fin ? '' : '<div style="display:flex;gap:6px;margin-top:8px"><input data-rt="' + esc(t.id) + '" placeholder="추가로 남길 말" style="flex:1;min-width:0;font:inherit;padding:8px 10px;border:1px solid var(--line);border-radius:10px"><button type="button" data-cs="reply" data-id="' + esc(t.id) + '" style="font:inherit;font-weight:700;border:0;background:var(--pri);color:#fff;border-radius:10px;padding:0 14px">보내기</button></div>'
        + (t.escalated ? '<div class="s" style="margin-top:6px">스킨인사이드에 확인을 요청했어요.</div>' : '<button type="button" data-cs="escalate" data-id="' + esc(t.id) + '" style="font:inherit;border:0;background:none;color:var(--mute);text-decoration:underline;margin-top:6px;padding:0">답변이 늦나요? 스킨인사이드에 확인 요청</button>')) + '</div>';
  });
  h += '<button type="button" data-cs="open" data-k="' + k + '" style="font:inherit;font-weight:700;border:1px solid var(--line);background:#fff;color:var(--ink);border-radius:10px;padding:8px 12px">' + esc(brandLabel(l)) + ' 문의 · 교환 · 반품</button><div data-form="' + k + '"></div></div>';
  return h;
}
function brandLabel(l){ var p = P[l.id]; return (p && p.brandName) || (p && p.brand) || ""; }
/* 포토리뷰: 사진은 올리기 전에 화면에서 줄인다 (긴 변 1280px, 장당 약 600KB 이하) */
function shrink(file){
  return new Promise(function(res, rej){
    var fr = new FileReader();
    fr.onerror = function(){ rej(new Error("사진을 읽지 못했어요")); };
    fr.onload = function(){
      var im = new Image();
      im.onerror = function(){ rej(new Error("사진 형식을 확인해주세요")); };
      im.onload = function(){
        var sc = Math.min(1, 1280 / Math.max(im.width, im.height)), c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(im.width * sc)); c.height = Math.max(1, Math.round(im.height * sc));
        var g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(im, 0, 0, c.width, c.height);
        var q = .85, d = c.toDataURL("image/jpeg", q);
        while(d.length * .75 > 600 * 1024 && q > .3){ q -= .1; d = c.toDataURL("image/jpeg", q); }
        if(d.length * .75 > 690 * 1024) rej(new Error("사진이 너무 커요")); else res(d);
      };
      im.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
function drawPh(w){
  var row = w.querySelector("[data-ph]"), a = w._ph || [];
  row.innerHTML = a.map(function(d, i){ return '<div class="ph-th"><img src="' + d + '" alt=""><button type="button" data-phdel="' + i + '" aria-label="사진 삭제">×</button></div>'; }).join("") + (a.length < 3 ? '<button type="button" class="ph-add" data-phadd>＋ 사진<br>' + a.length + '/3</button>' : '');
}
document.addEventListener("change", function(e){
  var f = e.target; if(!f.matches || !f.matches("[data-phf]")) return;
  var w = f.parentNode, files = [].slice.call(f.files || []); f.value = "";
  w._ph = w._ph || [];
  var room = 3 - w._ph.length; if(files.length > room) toast("사진은 최대 3장까지 올릴 수 있어요");
  files.slice(0, room).reduce(function(p, file){ return p.then(function(){ return shrink(file).then(function(d){ w._ph.push(d); drawPh(w); }); }); }, Promise.resolve()).catch(function(x){ toast(x.message || "사진을 올리지 못했어요"); });
});
document.addEventListener("click", function(e){
  var t0 = e.target, pa = t0.closest && t0.closest("[data-phadd]"), pd = t0.closest && t0.closest("[data-phdel]"), zi = t0.closest && t0.closest(".rv-ph img");
  if(pa){ pa.closest("[data-rvform]").querySelector("[data-phf]").click(); return; }
  if(pd){ var w0 = pd.closest("[data-rvform]").firstChild; w0._ph.splice(+pd.dataset.phdel, 1); drawPh(w0); return; }
  if(zi){ var lb = document.createElement("div"); lb.className = "lbx"; lb.innerHTML = '<img src="' + zi.dataset.full + '" alt="">'; lb.onclick = function(){ lb.remove(); }; document.body.appendChild(lb); return; }
  var rb = e.target.closest && e.target.closest("[data-rv]");
  if(rb){
    var rpost = function(u, body){ return fetch(u, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "오류"); return j; }); }); };
    if(rb.dataset.rv === "open"){ var f = document.querySelector('[data-rvform="' + rb.dataset.k + '"]'); if(f.innerHTML){ f.innerHTML = ""; return; }
      f.innerHTML = '<div style="margin-top:6px"><div data-stars="5" style="font-size:26px;cursor:pointer;color:#ffb400">' + [1,2,3,4,5].map(function(i){ return '<span data-s="' + i + '">★</span>'; }).join("") + '</div><div class="s" style="margin:4px 0">리뷰를 남기면 500P가 적립돼요</div><textarea placeholder="사용해보신 느낌을 5자 이상 적어주세요" style="display:block;width:100%;min-height:80px;margin-top:6px;font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px"></textarea><div class="ph-row" data-ph><button type="button" class="ph-add" data-phadd>＋ 사진<br>0/3</button></div><input type="file" accept="image/*" multiple hidden data-phf><button type="button" data-rv="send" data-k="' + rb.dataset.k + '" style="font:inherit;font-weight:700;border:0;background:var(--pri);color:#fff;border-radius:10px;padding:10px 16px;margin-top:8px">리뷰 등록</button> <span class="s" data-rerr></span></div>'; return; }
    if(rb.dataset.rv === "send"){ var w = rb.parentNode, k = rb.dataset.k.split("|"), n = +w.querySelector("[data-stars]").dataset.stars; rb.disabled = true;
      rpost("/api/review/new", {orderId:k[0], productId:k[1], rating:n, text:w.querySelector("textarea").value, photos:w._ph || []}).then(function(j){ toast(j.points ? j.points + "P가 적립됐어요" : "리뷰를 남겼어요"); orders(); }).catch(function(x){ rb.disabled = false; w.querySelector("[data-rerr]").textContent = x.message; }); }
    return;
  }
  var st = e.target.closest && e.target.closest("[data-stars] [data-s]");
  if(st){ var bx = st.parentNode, v = +st.dataset.s; bx.dataset.stars = v; [].forEach.call(bx.querySelectorAll("[data-s]"), function(x){ x.style.opacity = +x.dataset.s <= v ? 1 : .25; }); return; }
  var b = e.target.closest && e.target.closest("[data-cs]"); if(!b) return;
  var a = b.dataset.cs, post = function(u, body){ return fetch(u, {method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify(body)}).then(function(r){ return r.json().then(function(j){ if(!r.ok) throw new Error(j.error || "오류"); return j; }); }); };
  if(a === "open"){
    var f = document.querySelector('[data-form="' + b.dataset.k + '"]'); if(f.innerHTML){ f.innerHTML = ""; return; }
    f.innerHTML = '<div style="margin-top:8px"><select style="font:inherit;padding:9px;border:1px solid var(--line);border-radius:10px"><option value="inquiry">문의</option><option value="exchange">교환 (발송 후)</option><option value="return">반품 (발송 후)</option></select><textarea placeholder="내용을 적어주세요" style="display:block;width:100%;min-height:80px;margin-top:8px;font:inherit;padding:10px;border:1px solid var(--line);border-radius:10px"></textarea><button type="button" data-cs="new" data-k="' + b.dataset.k + '" style="font:inherit;font-weight:700;border:0;background:var(--pri);color:#fff;border-radius:10px;padding:10px 16px;margin-top:8px">보내기</button> <span class="s" data-err></span></div>';
    return;
  }
  var done = function(){ orders(); }, err = function(m){ var x = b.parentNode.querySelector("[data-err]") || b.parentNode; x.textContent = m; };
  if(a === "new"){ var w = b.parentNode, k = b.dataset.k.split("|"); b.disabled = true; post("/api/cs/new", {orderId:k[0], brand:k[1], type:w.querySelector("select").value, text:w.querySelector("textarea").value}).then(done).catch(function(x){ b.disabled = false; err(x.message); }); }
  if(a === "reply"){ var inp = document.querySelector('[data-rt="' + b.dataset.id + '"]'); b.disabled = true; post("/api/cs/reply", {id:b.dataset.id, text:inp.value}).then(done).catch(function(x){ b.disabled = false; inp.value = ""; inp.placeholder = x.message; }); }
  if(a === "escalate"){ b.disabled = true; post("/api/cs/escalate", {id:b.dataset.id}).then(done).catch(function(){ b.disabled = false; }); }
});
function done(id){
  $app.innerHTML = '<div class="empty"><h2 style="color:var(--ink)">주문이 완료됐어요</h2><p>주문번호 ' + esc(id) + '<br>브랜드에서 곧 발송해드려요.</p><a class="btn" style="display:inline-block;padding:13px 24px" href="#/orders">주문 내역 보기</a></div>';
  ls("sk_cart", []); ls("sk_direct", []); drawTabs();
}
function points(){
  if(!user){ $app.innerHTML = loginBox("#/points"); return; }
  $app.innerHTML = '<div class="empty">불러오는 중</div>';
  fetch("/api/points").then(function(r){ return r.json(); }).then(function(j){
    var T = {earn:"적립", use:"사용", "return":"반환", claw:"회수"};
    $app.innerHTML = '<div class="sec"><h1>내 포인트</h1><div class="ptcard"><span>보유 포인트</span><b>' + (j.balance || 0).toLocaleString("ko-KR") + ' P</b><p>현금처럼 결제할 때 쓸 수 있어요. 리뷰를 쓰면 500P가 적립돼요.</p></div><h2 style="font-size:16px;margin:20px 0 4px">포인트 내역</h2>'
      + ((j.log || []).length ? j.log.map(function(x){ return '<div class="row"><div class="t"><div class="nm">' + esc(x.note || T[x.type]) + '</div><div class="s">' + kdate(x.at) + ' · ' + (T[x.type] || "") + '</div></div><b style="color:' + (x.amount < 0 ? 'var(--red)' : 'var(--pri)') + '">' + (x.amount > 0 ? "+" : "") + x.amount.toLocaleString("ko-KR") + ' P</b></div>'; }).join("") : '<div class="empty" style="padding:32px 0">아직 내역이 없어요.</div>') + '</div>';
  }).catch(function(){ $app.innerHTML = '<div class="empty">불러오지 못했어요.</div>'; });
}
function me(){
  var h = '<div class="sec"><h1>' + (user ? esc(user.name || "회원") + '님' : '내 정보') + '</h1></div>';
  if(!user && CFG.LOGIN) h += loginBox("#/me");
  else if(!user) h += '<div class="sec"><div class="ntc">로그인 기능은 준비 중이에요.</div></div>';
  h += '<div class="sec menu" style="padding-top:0">' + (CHECKOUT ? '<a href="#/orders">주문/배송내역<span>&#8250;</span></a>' + (user ? '<a href="#/points">내 포인트<span id="mypt">&#8250;</span></a>' : '') : '') + '<a href="' + QZ + '"' + QT + '>피부타입 진단<span>&#8250;</span></a><a href="' + esc(CFG.KAKAO_URL) + '" target="_blank" rel="noopener">카카오톡 채널 문의<span>&#8250;</span></a>' + (DEMO ? '<a href="#/admin">관리자 화면 (데모)<span>&#8250;</span></a>' : '') + (user ? '<a href="#/" id="lo">로그아웃<span>&#8250;</span></a>' : '') + '</div>' + foot();
  $app.innerHTML = h;
  if(CHECKOUT && user) fetch("/api/points").then(function(r){ return r.ok ? r.json() : null; }).then(function(j){ var e = document.getElementById("mypt"); if(j && e) e.textContent = (j.balance || 0).toLocaleString("ko-KR") + " P \u203A"; }).catch(function(){});
  var lo = document.getElementById("lo");
  if(lo) lo.onclick = function(e){ e.preventDefault(); fetch("/api/logout", {method:"POST"}).then(function(){ user = null; setH("#/"); }); };
}

/* 라우터 */
function route(){
  var h = getH() || "#/", m;
  $bk.hidden = !CFG.STORE_OPEN || !/^#\/(p|cart|checkout|orders|points|search|c\/)/.test(h);
  drawTabs(); window.scrollTo(0, 0);
  if(!CFG.STORE_OPEN) return soon();
  if((m = h.match(/^#\/p\/(.+)/))) return detail(decodeURIComponent(m[1]));
  if((m = h.match(/^#\/c\/(.+)/))){ var k = decodeURIComponent(m[1]); return list(D.categories[k] || "제품", D.products.filter(function(p){ return p.cat === k; }), k); }
  if(h === "#/cat") return list("카테고리", D.products, "");
  if((m = h.match(/^#\/search\/(.+)/))){ var q0 = decodeURIComponent(m[1]), q = q0.toLowerCase(); return list("'" + q0 + "' 검색 결과", D.products.filter(function(p){ return (p.name + p.brandName + p.brand + (KO[p.brandName] || "")).toLowerCase().indexOf(q) >= 0; }), "", q0); }
  if(CHECKOUT && h === "#/cart") return cartPage();
  if(CHECKOUT && h === "#/checkout") return checkout(false);
  if(CHECKOUT && h === "#/checkout/direct") return checkout(true);
  if(CHECKOUT && h === "#/orders") return orders();
  if(CHECKOUT && h === "#/points") return points();
  if((m = h.match(/^#\/done\/(.+)/))) return done(decodeURIComponent(m[1]));
  if(DEMO && h === "#/admin" && window.DEMO_ADMIN) return window.DEMO_ADMIN($app, toast);
  if(h === "#/me") return me();
  home();
}
document.addEventListener("click", function(e){ var c = e.target.closest && e.target.closest("a.chip"); if(c && !c.classList.contains("on") && (c.getAttribute("href") || "").indexOf("#/") === 0){ e.preventDefault(); chipGo(c.getAttribute("href")); return; } var a = e.target.closest && e.target.closest("[data-pid]"); if(a) track(a.getAttribute("data-pid"), "c"); });
$bk.onclick = function(){ if(DEMO){ HM = HS.pop() || "#/"; route(); } else history.length > 1 ? history.back() : (location.hash = "#/"); };
window.addEventListener("hashchange", route);
window.__skRoute = route;
if(DEMO) document.addEventListener("click", function(e){
  var dl = e.target.closest && e.target.closest("[data-demo-login]");
  if(dl){ fetch("/api/demo-login", {method:"POST"}).then(function(r){ return r.json(); }).then(function(j){ user = j.user; route(); }); return; }
  var a = e.target.closest && e.target.closest("a"), hr = a && a.getAttribute("href");
  if(hr && hr.indexOf("#/") === 0 && !(a.classList.contains("chip"))){ e.preventDefault(); setH(hr); }
});

/* 시작할 때 필요한 5가지를 한꺼번에 받는다 (전에는 하나씩 차례로 받았음). 하나가 실패해도 나머지는 그대로 쓴다 */
var soft = function(u){ return fetch(u).then(function(r){ return r.ok ? r.json() : null; }).catch(function(){ return null; }); };
Promise.all([
  fetch("data/products.json").then(function(r){ return r.json(); }),
  soft("/api/extra"), soft("/api/stock"), soft("/api/popular"),
  (CFG.LOGIN || CHECKOUT) ? soft("/api/me") : Promise.resolve(null)
]).then(function(a){
  var j = a[0], x = a[1] || {}, st = a[2] || {};
  /* 관리자 페이지에서 추가한 제품을 합친다 (실패해도 기본 제품은 그대로) */
  (x.products || []).forEach(function(p){ if(p && p.id && j.categories[p.cat] && !j.products.some(function(q){ return q.id === p.id; })) j.products.push(p); });
  (st.soldOut || []).forEach(function(id){ var p = j.products.filter(function(q){ return q.id === id; })[0]; if(p) p.soldOut = true; });
  D = j; j.products.forEach(function(p){ P[p.id] = p; });
  POP = (a[3] && a[3].stats) || {};
  user = a[4] && a[4].user;
  rank(); route();
}).catch(function(){ $app.innerHTML = '<div class="empty">제품 정보를 불러오지 못했어요.</div>'; });
})();
