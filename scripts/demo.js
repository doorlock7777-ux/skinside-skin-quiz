/* 미리보기 전용 가짜 서버: 실제 서버 기능(로그인, 주문, 결제 승인, 송장, 정산)을 브라우저 안에서 흉내 낸다. 배포본에는 들어가지 않는다. */
(function(){
var P = window.__PRODUCTS, MAP = {}, FEE = 15;
P.products.forEach(function(p){ MAP[p.id] = p; });
var state = {user:null, orders:[], stats:{}};
/* 미리보기용 예시 집계: 실제 사이트에서는 방문자 행동으로 쌓인다 */
var SEED = {"bonkorea-cl":[420,70,31],"minic-allinone":[380,66,27],"bonkorea-vit":[350,52,22],"mediheal-sun":[300,48,19],"livna-calm":[260,40,15],"minic-cream":[240,35,12],"citirover-retinol":[210,30,11],"grafen-patch":[190,34,13],"numbuzin-4":[150,22,8],"hwapasa-shampoo":[140,20,7],"grafen-wax":[130,19,6],"torriden-cica":[120,15,5],"jmw-iron":[110,14,3],"grafen-sunstick":[100,16,4],"brdy-powder":[80,9,2]};
if(window.__NOSEED) SEED = {};
try{ var s = JSON.parse(localStorage.getItem("skd")); if(s) state = s; }catch(e){}
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
  if(u === "/api/track"){ state.stats = state.stats || {}; var s0 = state.stats[b.id] = state.stats[b.id] || {v:0, c:0, b:0, d:0}, inc = 0; if(b.e === "v") s0.v++; if(b.e === "c"){ var wk = s0.c + (SEED[b.id] ? SEED[b.id][1] : 0); inc = wk < 100 ? 4 + Math.floor(Math.random() * 6) : 10; s0.c++; s0.d = (s0.d || 0) + inc; } save(); return res({ok:true, inc:inc}); }
  if(u === "/api/me") return res({user: state.user});
  if(u === "/api/demo-login"){ state.user = {id:"n_demo", name:"홍길동", email:"demo@example.com", phone:"010-1234-5678"}; save(); return res({user: state.user}); }
  if(u === "/api/logout"){ state.user = null; save(); return res({ok:true}); }
  if(!state.user && /^\/api\/(order|confirm)/.test(u)) return res({error:"로그인이 필요해요"}, 401);
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
    var order = {id:id, userId:state.user.id, items:items, ship:sh, sub:sub, shipFee:fee, total:sub + fee, status:"pending", createdAt:new Date().toISOString(), shipments:{}};
    state.orders.push(order); save();
    return res({orderId:id, amount:order.total, orderName: items[0].name + (items.length > 1 ? " 외 " + (items.length - 1) + "건" : "")});
  }
  if(u === "/api/confirm"){
    var o2 = state.orders.filter(function(x){ return x.id === b.orderId; })[0];
    if(!o2) return res({error:"주문을 찾을 수 없어요"}, 404);
    if(Number(b.amount) !== o2.total) return res({error:"결제 금액이 달라요"}, 400);
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
        + '<div style="font-size:20px;font-weight:800;margin:8px 0 4px">' + won(opt.amount.value) + '</div><div style="color:#6b7684;font-size:14px;margin-bottom:18px">' + esc(opt.orderName) + ' · ' + (opt.method === "CARD" ? "카드·간편결제" : "계좌이체") + '</div>'
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

/* 관리자 화면 (실제로는 /admin/ + 관리자 토큰) */
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
