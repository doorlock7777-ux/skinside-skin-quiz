/* 미리보기 전용 가짜 서버: 실제 서버 기능(로그인, 주문, 결제 승인, 송장, 정산)을 브라우저 안에서 흉내 낸다. 배포본에는 들어가지 않는다. */
(function(){
var P = window.__PRODUCTS, MAP = {}, FEE = 15;
P.products.forEach(function(p){ MAP[p.id] = p; });
var state = {user:null, orders:[], stats:{}, points:{balance:1200, log:[{type:"earn", amount:700, note:"리뷰 작성", at:"2026-10-12T03:00:00Z"}, {type:"earn", amount:500, note:"리뷰 작성", at:"2026-10-10T03:00:00Z"}]}};
/* 미리보기용 예시 집계: 실제 사이트에서는 방문자 행동으로 쌓인다 */
var SEED = {"bonkorea-cl":[420,70,31],"minic-allinone":[380,66,27],"bonkorea-vit":[350,52,22],"mediheal-sun":[300,48,19],"livna-calm":[260,40,15],"minic-cream":[240,35,12],"citirover-retinol":[210,30,11],"grafen-patch":[190,34,13],"numbuzin-4":[150,22,8],"hwapasa-shampoo":[140,20,7],"grafen-wax":[130,19,6],"torriden-cica":[120,15,5],"jmw-iron":[110,14,3],"grafen-sunstick":[100,16,4],"brdy-powder":[80,9,2]};
if(window.__NOSEED) SEED = {};
try{ var s = JSON.parse(localStorage.getItem("skd")); if(s && s.v === 4) state = s; }catch(e){} state.v = 4;  /* 예전 버전으로 만든 시험 주문이 남아 중복처럼 보이지 않게 버전이 다르면 비운다 */ state.stats = {};  /* 인기 집계는 새로고침하면 초기화: 처음 열면 항상 기본 카테고리 순서 */
function pts(){ state.points = state.points || {balance:0, log:[]}; return state.points; }
function pAdd(n, type, note){ var q = pts(); q.balance += n; q.log.unshift({type:type, amount:n, note:note, at:new Date().toISOString()}); }
function save(){ try{ localStorage.setItem("skd", JSON.stringify(state)); }catch(e){} }
function res(o, st){ return Promise.resolve(new Response(JSON.stringify(o), {status: st || 200, headers:{"content-type":"application/json"}})); }
function esc(s){ return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){ return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]; }); }
function won(n){ return Number(n).toLocaleString("ko-KR") + "원"; }
var realFetch = window.fetch ? window.fetch.bind(window) : null;

window.fetch = function(u, o){
  u = String(u); o = o || {}; var m = (o.method || "GET").toUpperCase(), b = {};
  try{ b = o.body ? JSON.parse(o.body) : {}; }catch(e){}
  if(/data\/products\.json/.test(u)) return res(P);
  if(u === "/api/popular"){ var out = {}; Object.keys(SEED).forEach(function(k){ out[k] = {v:SEED[k][0], c:SEED[k][1], b:SEED[k][2], d:Math.round(SEED[k][1] * 6.5)}; }); Object.keys(state.stats || {}).forEach(function(k){ var s = state.stats[k], t = out[k] = out[k] || {v:0, c:0, b:0}; t.v += s.v; t.c += s.c; t.b += s.b; t.d = (t.d || 0) + (s.d || 0); }); return res({stats: out}); }
  if(u === "/api/track"){ state.stats = state.stats || {}; var s0 = state.stats[b.id] = state.stats[b.id] || {v:0, c:0, b:0, d:0}, inc = 0; if(b.e === "v") s0.v++; if(b.e === "c"){ var cur = s0.d || 0; inc = cur <= 100 ? 10 : cur <= 300 ? 4 + Math.floor(Math.random() * 6) : cur <= 1000 ? 1 + Math.floor(Math.random() * 3) : 1; s0.c++; s0.d = (s0.d || 0) + inc; } save(); return res({ok:true, inc:inc}); }
  if(u === "/api/me") return res({user: state.user});
  if(u === "/api/demo-login"){ state.user = {id:"n_demo", name:"홍길동", email:"demo@example.com", phone:"010-1234-5678"}; save(); return res({user: state.user}); }
  if(u === "/api/logout"){ state.user = null; save(); return res({ok:true}); }
  if(!state.user && /^\/api\/(order|confirm)/.test(u)) return res({error:"로그인이 필요해요"}, 401);
  if(u === "/api/stock") return res({soldOut:[]});
  if(u === "/api/hidden") return res({on:true, text:"오늘만 특가 찬스", url:"https://example.com/event", end:Date.now() + (2 * 86400 + 3 * 3600 + 14 * 60 + 9) * 1000, now:Date.now()});
  if(/^\/api\/review/.test(u)){
    state.reviews = state.reviews || [{id:"R0", productId:"bonkorea-cl", photos:["data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27%3E%3Crect width=%27120%27 height=%27120%27 fill=%27%23c9d3f5%27/%3E%3Ccircle cx=%2760%27 cy=%2750%27 r=%2722%27 fill=%27%235560ea%27/%3E%3Crect x=%2730%27 y=%2782%27 width=%2760%27 height=%2716%27 rx=%278%27 fill=%27%238d98ff%27/%3E%3C/svg%3E"], rating:5, text:"거품이 부드럽고 세안 후 당김이 적어요. 재구매 의사 있어요.", userName:"김*수", createdAt:"2026-10-10T03:00:00Z", best:true}, {id:"R00", productId:"bonkorea-cl", rating:4, text:"무난하게 쓰기 좋아요.", userName:"이*호", createdAt:"2026-10-12T03:00:00Z", best:false}];
    if(/^\/api\/review\?/.test(u)){ var pid = decodeURIComponent(u.split("product=")[1] || ""), l = state.reviews.filter(function(r){ return r.productId === pid; }).sort(function(a, b){ return (b.best ? 1 : 0) - (a.best ? 1 : 0) || (a.createdAt < b.createdAt ? 1 : -1); }); return res({count:l.length, avg:l.length ? Math.round(l.reduce(function(a, r){ return a + r.rating; }, 0) / l.length * 10) / 10 : 0, reviews:l}); }
    if(!state.user) return res({error:"로그인이 필요해요"}, 401);
    if(u === "/api/review/mine") return res({done:state.reviews.filter(function(r){ return r.mine; }).map(function(r){ return r.orderId + "|" + r.productId; })});
    if(u === "/api/review/new"){
      var o3 = state.orders.filter(function(x){ return x.id === b.orderId; })[0], ln = o3 && o3.items.filter(function(l){ return l.id === b.productId; })[0];
      if(!ln) return res({error:"주문한 제품이 아니에요"}, 400);
      if(o3.status === "canceled") return res({error:"취소된 주문에는 리뷰를 쓸 수 없어요"}, 400);
      if(!(b.rating >= 1 && b.rating <= 5)) return res({error:"별점을 선택해주세요"}, 400);
      if(String(b.text || "").trim().length < 5) return res({error:"리뷰는 5자 이상 적어주세요"}, 400);
      state.reviews.push({id:"R" + Date.now(), productId:b.productId, orderId:b.orderId, rating:b.rating, text:b.text, userName:"홍*동", createdAt:new Date().toISOString(), best:false, mine:true, photos:(b.photos || []).slice(0, 3)}); pAdd(500, "earn", "리뷰 작성"); save(); return res({ok:true, points:500});
    }
  }
  if(/^\/api\/cs\//.test(u)){
    state.tickets = state.tickets || [];
    if(u === "/api/cs/mine") return res({tickets: state.tickets});
    if(u === "/api/cs/new"){
      var o2 = state.orders.filter(function(x){ return x.id === b.orderId; })[0];
      if(!o2 || String(b.text || "").trim().length < 2) return res({error:"내용을 입력해주세요"}, 400);
      if(b.type !== "inquiry" && !(o2.shipments && o2.shipments[b.brand] && o2.shipments[b.brand].tracking)) return res({error:"발송 후에 신청할 수 있어요"}, 400);
      var t2 = {id:"C" + Date.now(), orderId:b.orderId, brand:b.brand, brandName:b.brand, type:b.type, status:"open", escalated:false, refundAmount:0, messages:[{from:"customer", text:b.text, at:new Date().toISOString()}]}; state.tickets.push(t2); save(); return res({ticket:t2});
    }
    var t3 = state.tickets.filter(function(x){ return x.id === b.id; })[0]; if(!t3) return res({error:"not found"}, 404);
    if(u === "/api/cs/reply") t3.messages.push({from:"customer", text:b.text, at:new Date().toISOString()});
    if(u === "/api/cs/escalate") t3.escalated = true;
    save(); return res({ticket:t3});
  }
  if(u === "/api/points") return res({balance:pts().balance, log:pts().log.slice(0, 50)});
  if(u === "/api/order/cancel" && m === "POST"){
    var oc = state.orders.filter(function(x){ return x.id === b.orderId; })[0];
    if(!oc) return res({error:"주문을 찾을 수 없어요"}, 404);
    if(oc.status !== "paid" || Object.keys(oc.shipments || {}).some(function(k){ return oc.shipments[k] && oc.shipments[k].tracking; })) return res({error:"이미 발송이 시작돼서 직접 취소할 수 없어요. 아래 교환·반품을 신청해주세요"}, 400);
    var cash = oc.payAmount !== undefined ? oc.payAmount : oc.total, back = oc.pointsUsed || 0;
    oc.status = "canceled"; oc.canceledAt = new Date().toISOString(); if(back) pAdd(back, "return", "주문 취소");
    (state.reviews || []).forEach(function(r){ if(r.orderId === oc.id && r.mine){ r.gone = true; pAdd(-500, "claw", "주문 취소"); } }); state.reviews = (state.reviews || []).filter(function(r){ return !r.gone; });
    save(); return res({ok:true, refundedCash:cash, pointsBack:back});
  }
  if(u === "/api/order" && m === "GET") return res({orders: state.orders.filter(function(x){ return x.status !== "pending" && x.status !== "failed"; }).slice().reverse()});
  if(u === "/api/order" && m === "POST"){
    var items = [];
    for(var i = 0; i < (b.items || []).length; i++){
      var x = b.items[i], p = MAP[x.id], q = Math.floor(Number(x.q));
      if(!p || p.soldOut || !(q >= 1 && q <= 20)) return res({error:"주문할 수 없는 제품이 있어요"}, 400);
      var oi = p.options ? (Number(x.opt) || 0) : 0;
      items.push({id:p.id, brand:p.brand, name:p.name, optName: p.options ? p.options[oi].n : "", opt:oi, q:q, unit: p.options ? p.options[oi].price : p.price});
    }
    if(!items.length) return res({error:"주문 제품이 없어요"}, 400);
    var sh = b.ship || {};
    if(!sh.name || !sh.addr1) return res({error:"배송지를 확인해주세요"}, 400);
    var sub = items.reduce(function(a, l){ return a + l.unit * l.q; }, 0), sp = P.shipping || {fee:0, freeOver:0};
    var fee = sub >= sp.freeOver ? 0 : sp.fee, id = "SK" + Date.now().toString(36).toUpperCase();
    var want = Math.max(0, Math.floor(Number(b.usePoints) || 0)), cap = Math.max(0, Math.min(pts().balance, sub + fee - 100));
    if(want > cap) return res({error:"사용할 수 있는 포인트는 최대 " + cap.toLocaleString("ko-KR") + "P예요"}, 400);
    if(want) pAdd(-want, "use", "주문 결제");
    var order = {id:id, userId:state.user.id, items:items, ship:sh, sub:sub, shipFee:fee, total:sub + fee, pointsUsed:want, payAmount:sub + fee - want, status:"pending", createdAt:new Date().toISOString(), shipments:{}};
    state.orders.push(order); save();
    return res({orderId:id, amount:order.payAmount, pointsUsed:want, orderName: items[0].name + (items.length > 1 ? " 외 " + (items.length - 1) + "건" : "")});
  }
  if(u === "/api/confirm"){
    var o2 = state.orders.filter(function(x){ return x.id === b.orderId; })[0];
    if(!o2) return res({error:"주문을 찾을 수 없어요"}, 404);
    if(Number(b.amount) !== (o2.payAmount !== undefined ? o2.payAmount : o2.total)) return res({error:"결제 금액이 달라요"}, 400);
    o2.status = "paid"; o2.paidAt = new Date().toISOString(); state.stats = state.stats || {}; o2.items.forEach(function(l){ var s1 = state.stats[l.id] = state.stats[l.id] || {v:0, c:0, b:0}; s1.b += l.q; }); save();
    return res({ok:true, orderId:o2.id});
  }
  return realFetch ? realFetch(u, o) : res({error:"offline"}, 404);
};

/* 토스페이먼츠 결제창 흉내 */
window.TossPayments = function(){
  return {payment: function(){ return {requestPayment: function(opt){
    return new Promise(function(resolve, reject){
      var d = document.createElement("div");
      d.style.cssText = "position:fixed;inset:0;background:rgba(25,31,40,.55);z-index:90;display:flex;align-items:flex-end;justify-content:center";
      d.innerHTML = '<div style="background:#fff;width:100%;max-width:560px;border-radius:20px 20px 0 0;padding:24px 20px calc(20px + env(safe-area-inset-bottom,0px))">'
        + '<div style="font-size:12px;font-weight:800;color:#4E57A2;letter-spacing:.06em">TOSS PAYMENTS 데모 결제창</div>'
        + '<div style="font-size:20px;font-weight:800;margin:8px 0 4px">' + won(opt.amount.value) + '</div><div style="color:#6b7684;font-size:14px;margin-bottom:18px">' + esc(opt.orderName) + ' · ' + (opt.card && opt.card.easyPay === "NAVERPAY" ? "네이버페이" : opt.method === "CARD" ? "카드·간편결제" : "계좌이체") + '</div>'
        + '<div style="background:#f2f4f6;border-radius:12px;padding:12px 14px;font-size:13px;color:#4e5968;margin-bottom:16px">미리보기라서 실제 결제는 이루어지지 않아요.</div>'
        + '<div style="display:flex;gap:10px"><button id="dx" style="flex:1;padding:15px;border-radius:14px;background:#eceef8;color:#4E57A2;font-weight:700">취소</button><button id="dp" style="flex:2;padding:15px;border-radius:14px;background:#4E57A2;color:#fff;font-weight:700">결제하기</button></div></div>';
      document.body.appendChild(d);
      d.querySelector("#dx").onclick = function(){ d.remove(); reject(new Error("결제를 취소했어요")); };
      d.querySelector("#dp").onclick = function(){
        d.remove();
        fetch("/api/confirm", {method:"POST", body:JSON.stringify({paymentKey:"demo", orderId:opt.orderId, amount:opt.amount.value})})
          .then(function(r){ return r.json(); })
          .then(function(j){ window.__goto("#/done/" + encodeURIComponent(j.orderId || opt.orderId)); resolve(); });
      };
    });
  }}; }};
};

/* 관리자 화면 (실제로는 비공개 주소 + 3단 로그인) */
var CARR = {cj:"CJ대한통운", lotte:"롯데택배", hanjin:"한진택배", post:"우체국", logen:"로젠택배"};
var STL = {paid:"결제 완료", partial:"일부 발송", shipped:"발송 완료", canceled:"취소됨"};
window.DEMO_ADMIN = function(el, toast){
  var os = state.orders.filter(function(o){ return o.status !== "pending" && o.status !== "failed"; }).slice().reverse();
  var agg = {};
  os.filter(function(o){ return o.status !== "canceled"; }).forEach(function(o){ o.items.forEach(function(l){ var a = (agg[l.brand] = agg[l.brand] || {n:0, sales:0, name:(MAP[l.id] || {}).brandName || l.brand}); a.n += l.q; a.sales += l.unit * l.q; }); });
  var h = '<div class="sec"><h1>관리자 화면</h1><p class="sub">실제 사이트에서는 관리자 토큰으로만 열려요. 여기서는 흐름을 보기 위한 데모예요.</p></div><div class="band"></div><div class="sec"><h2>들어온 주문</h2>';
  if(!os.length) h += '<div class="empty" style="padding:32px 0">아직 주문이 없어요. 스토어에서 주문하면 여기에 나타나요.</div>';
  os.forEach(function(o){
    var by = {}, a = o.ship || {};
    o.items.forEach(function(l){ (by[l.brand] = by[l.brand] || []).push(l); });
    h += '<div class="ord"><div class="h"><span>' + esc(o.id) + '</span><span class="badge">' + (STL[o.status] || o.status) + ' · ' + won(o.total) + '</span></div>';
    Object.keys(by).forEach(function(k){
      var sh = o.shipments[k] || {}, nm = (MAP[by[k][0].id] || {}).brandName || k;
      h += '<div style="border-top:1px solid var(--line);padding:10px 0"><b>' + esc(nm) + '</b>'
        + '<details style="margin:6px 0"><summary style="color:var(--pri);font-weight:700;font-size:13px;cursor:pointer">브랜드에 전달되는 주문서 보기</summary><div class="note" style="margin-top:8px;font-size:13px;line-height:1.7">'
        + by[k].map(function(l){ return esc(l.name) + (l.optName ? ' (' + esc(l.optName) + ')' : '') + ' x ' + l.q; }).join('<br>') + '<br><br>받는 분 ' + esc(a.name) + '<br>연락처 ' + esc(a.phone) + '<br>주소 (' + esc(a.zip) + ') ' + esc(a.addr1) + ' ' + esc(a.addr2) + (a.memo ? '<br>메모 ' + esc(a.memo) : '') + '</div></details>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap"><select class="in2" style="width:auto" data-c="' + esc(o.id + "|" + k) + '">' + Object.keys(CARR).map(function(c){ return '<option value="' + c + '"' + (sh.carrier === c ? " selected" : "") + '>' + CARR[c] + '</option>'; }).join("") + '</select>'
        + '<input class="in2" style="flex:1;min-width:120px" data-t="' + esc(o.id + "|" + k) + '" placeholder="송장번호" value="' + esc(sh.tracking || "") + '"><button class="btn sub2" style="flex:none;padding:12px 16px" data-s="' + esc(o.id + "|" + k) + '">저장</button></div></div>';
    });
    h += '</div>';
  });
  h += '</div><div class="band"></div><div class="sec"><h2>이번 달 정산 (수수료율 ' + FEE + '%는 예시)</h2>';
  var ks = Object.keys(agg);
  if(!ks.length) h += '<p class="sub">주문이 생기면 브랜드별로 집계돼요.</p>';
  else {
    h += '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:13.5px"><tr style="text-align:left;color:#6b7684"><th style="padding:6px 4px">브랜드</th><th>수량</th><th>판매액</th><th>수수료</th><th>브랜드 정산</th></tr>';
    var T = 0;
    ks.forEach(function(k){ var c = Math.round(agg[k].sales * FEE / 100); T += c; h += '<tr style="border-top:1px solid var(--line)"><td style="padding:8px 4px">' + esc(agg[k].name) + '</td><td>' + agg[k].n + '</td><td>' + won(agg[k].sales) + '</td><td style="color:var(--pri);font-weight:700">' + won(c) + '</td><td>' + won(agg[k].sales - c) + '</td></tr>'; });
    h += '</table></div><div class="sum"><div class="tot"><span>우리 수수료 수익</span><span>' + won(T) + '</span></div></div>';
  }
  h += '</div><div class="sec"><button class="btn line" id="dr" style="width:100%">데모 데이터 초기화</button></div>';
  el.innerHTML = h;
  [].forEach.call(el.querySelectorAll("[data-s]"), function(b){ b.onclick = function(){
    var k = b.dataset.s, p = k.split("|"), o = state.orders.filter(function(x){ return x.id === p[0]; })[0];
    var tr = el.querySelector('[data-t="' + k + '"]').value.replace(/[^0-9A-Za-z\-]/g, "");
    if(!tr){ toast("송장번호를 입력해주세요"); return; }
    o.shipments[p[1]] = {carrier: el.querySelector('[data-c="' + k + '"]').value, tracking: tr, at: new Date().toISOString()};
    var brands = {}; o.items.forEach(function(l){ brands[l.brand] = 1; });
    var ks2 = Object.keys(brands), n = ks2.filter(function(x){ return o.shipments[x] && o.shipments[x].tracking; }).length;
    o.status = n === ks2.length ? "shipped" : n ? "partial" : "paid"; save(); toast("저장했어요. 고객 주문 내역에 배송 조회가 보여요."); window.DEMO_ADMIN(el, toast);
  }; });
  el.querySelector("#dr").onclick = function(){ state.orders = []; save(); window.DEMO_ADMIN(el, toast); };
};
})();

/* 진단 완료/전 화면 전환 (미리보기 전용) */
(function(){
  var K = "skinside_quiz_v2", R = "skinside_result", SMP = {key:"ORNT", desc:"지성 피부", p:{od:78, sr:30, pn:22, wt:18}, t:1};
  var done = true;
  try{ var m = localStorage.getItem("skd_diag"); if(m === null){ localStorage.setItem("skd_diag", "1"); m = "1"; } done = m === "1"; }catch(e){}
  try{ if(done){ if(!localStorage.getItem(K)){ localStorage.setItem(K, JSON.stringify({screen:"result"})); } if(!localStorage.getItem(R)) localStorage.setItem(R, JSON.stringify(SMP)); } else { localStorage.removeItem(K); localStorage.removeItem(R); } }catch(e){}  /* 이미 결과를 본 상태(K)는 덮어쓰지 않는다 */
  var b = document.getElementById("dm");
  if(b){ var a = document.createElement("a"); a.href = "#"; a.style.cssText = "display:block;margin-top:4px;font-weight:700;color:#8a5a00;text-decoration:underline"; a.textContent = done ? "진단 전 화면으로 보기" : "진단 완료 화면으로 보기";
    a.onclick = function(e){ e.preventDefault(); try{ localStorage.setItem("skd_diag", done ? "0" : "1"); }catch(x){} location.reload(); }; b.appendChild(a); }
})();

/* 미리보기: 피부 진단 링크는 바깥 화면(미리보기 틀)에 전환을 요청한다 */
document.addEventListener("click", function(e){ var a = e.target.closest && e.target.closest('a[href="#quiz"]'); if(!a) return; e.preventDefault(); try{ parent.postMessage({skgo:"quiz"}, "*"); }catch(x){} }, true);

/* 미리보기: 진단에서 스토어로 돌아오면 화면을 다시 그려 최신 결과 카드를 보여준다 */
window.addEventListener("message", function(e){ if(e.data && e.data.skrefresh && window.__skRoute) window.__skRoute(); });
