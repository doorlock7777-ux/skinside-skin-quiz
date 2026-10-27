/* 관리자 미리보기용 가짜 서버 (예시 데이터) */
(function(){
  var CATS = window.__CATS || {}, extra = [], hid = {on:true, text:"오늘만 특가 찬스", url:"https://example.com/event", useDefault:true, endAt:""}, kakao = {friends:8144, name:"문장군", updated:null};
  var TOP = [["엔젤 탄산 효소 세안제","본코리아",412,1380],["퍼펙트 콜라드그린 진정 올인원","MINIC",338,1190],["엔젤 비타민 앰플","본코리아",301,1024],["마데카소사이드 수분 선세럼","MEDIHEAL",244,880],["챕터3 율무 진정 앰플","LIVNA",207,760],["포어 올킬 원스텝 코팩","GRAFEN",181,702],["시티로버 레티놀 스킨부스터 세럼","본코리아",156,615],["원스탭 매트 왁스","GRAFEN",133,540],["시카 진정 시트팩","TORRIDEN",118,480],["선포켓 오일컷 스틱","GRAFEN",97,402]];
  var TYPES = {"ORNT":412,"CRNT-O":388,"OSNT":301,"CRNT-D":260,"DRNT":244,"OSPT":190,"CSNT":176,"ORPT":150,"DSNT":132,"ORNW":121,"CRPT":108,"OSPW":96,"DRNW":80,"CSNW":61,"DSPT":44,"DSPW":23};
  function res(o, s){ return Promise.resolve(new Response(JSON.stringify(o), {status:s || 200, headers:{"content-type":"application/json"}})); }
  var real = window.fetch, LOGGED = false, now = Date.now();
  var O = [
    {id:"SK2610180003", createdAt:new Date(now - 3600e3).toISOString(), paidAt:new Date(now - 3500e3).toISOString(), status:"paid", total:51500, items:[{brand:"minic", name:"퍼펙트 콜라드그린 진정 올인원", optName:"1개", q:1, unit:21500}, {brand:"grafen", name:"포어 올킬 원스텝 코팩", q:2, unit:15000}], ship:{name:"김민수", phone:"010-1234-5678", zip:"06236", addr1:"서울 강남구 테헤란로 123", addr2:"456호", memo:"문 앞에 놓아주세요"}},
    {id:"SK2610180002", createdAt:new Date(now - 5 * 3600e3).toISOString(), paidAt:new Date(now - 5 * 3600e3).toISOString(), status:"shipped", total:29900, sent:{bonkorea:new Date(now - 4 * 3600e3).toISOString()}, items:[{brand:"bonkorea", name:"엔젤 탄산 효소 세안제", q:1, unit:26900}], ship:{name:"이준호", phone:"010-9876-5432", zip:"13529", addr1:"경기 성남시 분당구 판교로 1", addr2:"", memo:""}, shipments:{bonkorea:{carrier:"cj", tracking:"123456789012"}}},
    {id:"SK2610170009", createdAt:new Date(now - 36 * 3600e3).toISOString(), paidAt:new Date(now - 36 * 3600e3).toISOString(), status:"paid", total:24400, sent:{minic:new Date(now - 27 * 3600e3).toISOString()}, items:[{brand:"minic", name:"퍼펙트 콜라드그린 장벽 크림", optName:"2개", q:1, unit:21400}], ship:{name:"최유진", phone:"010-2222-3333", zip:"03001", addr1:"서울 종로구 사직로 1", addr2:"", memo:""}},
    {id:"SK2610170007", createdAt:new Date(now - 30 * 3600e3).toISOString(), status:"canceled", total:21400, items:[{brand:"grafen", name:"팁 스케치 멀티 커버 파운데이션", q:1, unit:18400}], ship:{name:"박서준", phone:"010-5555-0000", zip:"04524", addr1:"서울 중구 세종대로 110", addr2:"", memo:""}}];
  var BR = {minic:{name:"MINIC"}, grafen:{name:"GRAFEN"}, bonkorea:{name:"본코리아"}};
  var PART = {minic:{issuedAt:new Date(now - 5 * 864e5).toISOString(), lastLogin:new Date(now - 3 * 3600e3).toISOString()}, bonkorea:{issuedAt:new Date(now - 2 * 864e5).toISOString(), lastLogin:null}};
  var FEE = {minic:15, grafen:12, bonkorea:10}, EM = {minic:"order@minic.example", grafen:"", bonkorea:"cs@bonkorea.example"};
  window.__FEE = FEE;
  function HM(){ var rs = [["minic", "MINIC", 702000 - 21500], ["bonkorea", "본코리아", 358500], ["grafen", "GRAFEN", 224000]].map(function(x){ var f = Math.round(x[2] * (FEE[x[0]] || 0) / 100); return {name:x[1], sales:x[2], fee:f, payout:x[2] - f}; }); var sa = 0, fe = 0; rs.forEach(function(r){ sa += r.sales; fe += r.fee; }); return {m:"2026-10", sales:sa, fee:fe, payout:sa - fe, rows:rs}; }
  var RV = [
    {id:"V1", photos:["data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27120%27 height=%27120%27%3E%3Crect width=%27120%27 height=%27120%27 fill=%27%23c9d3f5%27/%3E%3Ccircle cx=%2760%27 cy=%2750%27 r=%2722%27 fill=%27%235560ea%27/%3E%3Crect x=%2730%27 y=%2782%27 width=%2760%27 height=%2716%27 rx=%278%27 fill=%27%238d98ff%27/%3E%3C/svg%3E"], productId:"bonkorea-cl", productName:"엔젤 탄산 효소 세안제", brand:"bonkorea", brandName:"본코리아", orderId:"SK2610180002", userName:"이*호", rating:5, text:"거품이 부드럽고 세안 후에도 당기지 않아요.", createdAt:new Date(now - 2 * 3600e3).toISOString(), best:false, isNew:true, low:false, delReq:null},
    {id:"V2", productId:"minic-allinone", productName:"퍼펙트 콜라드그린 진정 올인원", brand:"minic", brandName:"MINIC", orderId:"SK2610170009", userName:"최*진", rating:1, text:"사용 후 트러블이 올라왔어요. 비추천합니다.", createdAt:new Date(now - 5 * 3600e3).toISOString(), best:false, isNew:true, low:true, delReq:null},
    {id:"V3", productId:"grafen-patch", productName:"포어 올킬 원스텝 코팩", brand:"grafen", brandName:"GRAFEN", orderId:"SK2610160005", userName:"박*준", rating:2, text:"다른 사이트 가세요 ㅋㅋ 여기 광고 아님 ㅋ", createdAt:new Date(now - 9 * 3600e3).toISOString(), best:false, isNew:true, low:true, delReq:{status:"pending", reason:"경쟁사로 보이는 악의적 광고성 리뷰예요", at:new Date(now - 3 * 3600e3).toISOString()}},
    {id:"V4", productId:"bonkorea-cl", productName:"엔젤 탄산 효소 세안제", brand:"bonkorea", brandName:"본코리아", orderId:"SK2610150001", userName:"정*아", rating:4, text:"무난하게 쓰기 좋아요.", createdAt:new Date(now - 30 * 3600e3).toISOString(), best:true, isNew:false, low:false, delReq:null}];
  var LAST = null, ADJ = [], UNA = [{orderId:"SK2610180077", index:0, amount:9900, at:"2026-10-17T05:00:00.000Z", note:"고객 요청", brands:[{key:"bonkorea", name:"본코리아"}, {key:"grafen", name:"GRAFEN"}]}];
  var CONF = null, TK = [
    {id:"C1", orderId:"SK2610170009", brand:"minic", brandName:"MINIC", type:"return", status:"open", escalated:true, customer:{name:"최유진", phone:"010-2222-3333"}, messages:[{from:"customer", text:"사이즈가 안 맞아서 반품하고 싶어요.", at:new Date(now - 6 * 3600e3).toISOString()}, {from:"customer", text:"브랜드 답변이 없어서 운영자 확인 요청드려요.", at:new Date(now - 3600e3).toISOString()}]},
    {id:"C2", orderId:"SK2610180002", brand:"bonkorea", brandName:"본코리아", type:"inquiry", status:"answered", escalated:false, customer:{name:"이준호", phone:"010-9876-5432"}, messages:[{from:"customer", text:"언제 도착하나요?", at:new Date(now - 4 * 3600e3).toISOString()}, {from:"partner", text:"내일 도착해요.", at:new Date(now - 3 * 3600e3).toISOString()}]}];
  function admin(u, b){
    if(u.indexOf("/api/admin/login") >= 0){ if(b.id && b.pw && b.pw2){ LOGGED = true; return res({ok:true}); } return res({error:"입력한 정보가 맞지 않아요"}, 401); }
    if(u.indexOf("/api/admin/logout") >= 0){ LOGGED = false; return res({ok:true}); }
    if(!LOGGED) return res({error:"unauthorized"}, 401);
    if(u.indexOf("/api/admin/me") >= 0) return res({ok:true});
    if(u.indexOf("/api/admin/home") >= 0) return res({
      today:{sales:80500, orders:2, yestSales:61200, yestOrders:3}, flow:{wait:3, done:5, canceled:1}, cs:{open:2, escalated:1, refundFail:0}, reviews:{total:7, new:3, low:2, delReq:1}, stock:{selling:28, soldOut:3},
      late:[{id:"SK2610170009", brand:"minic", name:"MINIC", hours:27, state:"wait"}],
      brands:[{brand:"minic", name:"MINIC", today:1, open:2, late:1, hasCode:true, hasEmail:true}, {brand:"grafen", name:"GRAFEN", today:1, open:1, late:0, hasCode:false, hasEmail:false}, {brand:"bonkorea", name:"본코리아", today:0, open:0, late:0, hasCode:true, hasEmail:true}, {brand:"livna", name:"LIVNA", today:0, open:0, late:0, hasCode:false, hasEmail:false}],
      todo:[{k:"late", label:"발송이 지연된 주문", n:1, tab:"orders"}, {k:"reviewDel", label:"리뷰 삭제 요청 승인·거부", n:1, tab:"reviews"}, {k:"escalated", label:"운영자 확인이 필요한 CS", n:1, tab:"cs"}, {k:"confirm", label:"9월 정산 확정 필요", n:1, tab:"settle"}, {k:"noemail", label:"이메일이 없어 알림을 못 받는 브랜드", n:1, tab:"brands"}, {k:"nocode", label:"접속 코드가 없는 주문 브랜드", n:1, tab:"brands"}],
      month:HM(),
      totals:{revenue:1263000 + 48200, orders:71, refunds:3, refundAmount:45900, csOpen:2},
      recent:O.slice().map(function(o){ return {id:o.id, at:o.paidAt || o.createdAt, name:o.ship.name, item:o.items[0].name + (o.items.length > 1 ? " 외 " + (o.items.length - 1) + "개" : ""), total:o.total, refund:o.status === "canceled" ? o.total : 0, status:o.status}; })});
    if(u.indexOf("/api/admin/live") >= 0){ var tk = Date.now(), base = [3,4,4,5,3,6,7,6,8,9,7,8,10,9,11,12,10,9,11,13,12,14,12,11,13,15,14,12,13,14]; return res({now:14 + (Math.floor(tk / 15000) % 3), pages:{store:9, quiz:5 + (Math.floor(tk / 15000) % 3)}, today:286, peak:15, series:base.map(function(v, i){ var t = new Date(tk + 9 * 36e5 - (29 - i) * 6e4).toISOString().slice(11, 16); return {t:t, n:v}; }), at:new Date(tk).toISOString()}); }
    if(u.indexOf("/api/admin/orders") >= 0) return res({orders:O, brands:BR});
    if(u.indexOf("/api/admin/ship") >= 0){ O.forEach(function(x){ if(x.id === b.orderId){ x.shipments = x.shipments || {}; x.shipments[b.brand] = {carrier:b.carrier, tracking:b.tracking}; x.status = "shipped"; } }); return res({ok:true}); }
    if(u.indexOf("/api/admin/cancel") >= 0){ O.forEach(function(x){ if(x.id === b.orderId) x.status = "canceled"; }); return res({ok:true}); }
    if(u.indexOf("/api/admin/partners/issue") >= 0){ var c = "K7QM-X2PD-R9WT-H4NB"; PART[b.brand] = {issuedAt:new Date().toISOString(), lastLogin:null}; return res({ok:true, code:c}); }
    if(u.indexOf("/api/admin/partners/add") >= 0){ var nn = String(b.name || "").trim(); if(!nn) return res({error:"브랜드 이름을 입력해주세요"}, 400); if(Object.keys(BR).some(function(k){ return BR[k].name.toLowerCase() === nn.toLowerCase(); })) return res({error:"이미 있는 브랜드예요"}, 400); var nk = nn.toLowerCase().replace(/[^a-z0-9]/g, "") || "b" + Date.now(); BR[nk] = {name:nn}; EM[nk] = b.email || ""; FEE[nk] = Number(b.fee) || 0; return res({ok:true, key:nk}); }
    if(u.indexOf("/api/admin/partners/save") >= 0){ var fe = Number(b.fee); if(b.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)) return res({error:"이메일 형식을 확인해주세요"}, 400); if(!(fe >= 0 && fe <= 100)) return res({error:"수수료율은 0~100 사이 숫자로 적어주세요 (15% = 15)"}, 400); if(fe > 0 && fe < 1) return res({error:"15%면 15로 적어주세요. 0.15는 0.15%로 계산돼요"}, 400); EM[b.brand] = b.email || ""; FEE[b.brand] = fe; return res({ok:true}); }
    if(u.indexOf("/api/admin/partners/revoke") >= 0){ delete PART[b.brand]; return res({ok:true}); }
    if(u.indexOf("/api/admin/partners") >= 0) return res({dir:"partner-k3x9m2", partners:Object.keys(BR).map(function(k){ return {key:k, name:BR[k].name, email:EM[k], fee:FEE[k], issuedAt:(PART[k] || {}).issuedAt || null, lastLogin:(PART[k] || {}).lastLogin || null}; })});
    if(u.indexOf("/api/admin/reconcile") >= 0){ LAST = {at:new Date().toISOString(), checked:42, recovered:1, external:9900, unassigned:0, mismatch:0, errors:0}; return res({ok:true, result:LAST}); }
    if(u.indexOf("/api/admin/settlement/confirm") >= 0){ if(UNA.length) return res({error:"어느 브랜드 몫인지 정해지지 않은 환불 " + UNA.length + "건이 있어요. 정산 탭에서 지정해주세요"}, 400); CONF = {at:new Date().toISOString(), paid:{}}; return res({ok:true, created:true}); }
    if(u.indexOf("/api/admin/settlement/paid") >= 0){ CONF.paid[b.brand] = new Date().toISOString(); return res({ok:true}); }
    if(u.indexOf("/api/admin/settlement/adjust/delete") >= 0){ ADJ = ADJ.filter(function(a){ return a.id !== b.id; }); return res({ok:true, adj:ADJ}); }
    if(u.indexOf("/api/admin/settlement/adjust") >= 0){ if(CONF) return res({error:"이미 확정된 달이에요. 확정 전인 달에 넣어주세요 (보통 다음 달)"}, 400); if(!Math.round(+b.amount) || String(b.memo || "").length < 2) return res({error:"월·브랜드·금액(0 제외)·사유(2자 이상)를 확인해주세요"}, 400); ADJ.push({id:"J" + (ADJ.length + 1), brand:b.brand, amount:Math.round(+b.amount), memo:b.memo, auto:false}); return res({ok:true, adj:ADJ}); }
    if(u.indexOf("/api/admin/refund/assign") >= 0){ UNA = UNA.filter(function(x){ return !(x.orderId === b.orderId && x.index === b.index); }); return res({ok:true}); }
    if(u.indexOf("/api/admin/settlement") >= 0){
      if(u.indexOf("format=json") < 0) return Promise.resolve(new Response("정산 예시", {status:200}));
      var rows = [{brand:"minic", name:"MINIC", n:36, sales:702000, refund:21500, feeRate:15, fee:102075, adj:0, payout:578425}, {brand:"bonkorea", name:"본코리아", n:12, sales:358500, refund:0, feeRate:10, fee:35850, adj:0, payout:322650}, {brand:"grafen", name:"GRAFEN", n:19, sales:224000, refund:0, feeRate:12, fee:26880, adj:0, payout:197120}];
      rows.forEach(function(r){ r.feeRate = FEE[r.brand]; r.fee = Math.round((r.sales - r.refund) * FEE[r.brand] / 100); r.payout = r.sales - r.refund - r.fee; });
      ADJ.forEach(function(a){ rows.forEach(function(r){ if(r.brand === a.brand){ r.adj += a.amount; r.payout += a.amount; } }); });
      var warns = []; if(UNA.length) warns.push({level:"bad", text:"브랜드가 정해지지 않은 환불 " + UNA.length + "건 — 아래에서 지정해야 정산을 확정할 수 있어요"}); warns.push({level:"warn", text:"본코리아: 이메일이 없어 정산서가 메일로 가지 않아요"}); warns.push({level:"info", text:"이 달 결제 주문 중 아직 발송 전이거나 일부만 발송된 주문 3건이 포함돼 있어요 (결제일 기준 정산)"});
      return res({month:"2026-10", confirmed:CONF, rows:rows, warns:warns, last:LAST, adj:ADJ, unassigned:UNA, brands:Object.keys(BR).map(function(k){ return {key:k, name:BR[k].name}; }), recon:{gross:1360000, ship:24000, pointsUsed:12000, pointsBack:1500, cashPaid:1348000, refundBrand:21500, refundShip:3000, refundUnassigned:UNA.reduce(function(a, x){ return a + x.amount; }, 0), cashRefund:24500, net:1323500}});
    }
    if(u.indexOf("/api/admin/reviews/") >= 0){ RV.forEach(function(r){ if(r.id === b.id){ if(u.indexOf("read") >= 0) RV.forEach(function(x){ x.isNew = false; }); if(u.indexOf("best") >= 0) r.best = b.on; if(u.indexOf("decide") >= 0){ if(b.action === "reject") r.delReq.status = "rejected"; else r.gone = true; } } }); if(u.indexOf("reviews/read") >= 0) RV.forEach(function(x){ x.isNew = false; }); return res({ok:true}); }
    if(u.indexOf("/api/admin/reviews") >= 0){ var vis = RV.filter(function(r){ return !r.gone; }); return res({counts:{total:vis.length, new:vis.filter(function(r){ return r.isNew; }).length, low:vis.filter(function(r){ return r.low; }).length, delReq:vis.filter(function(r){ return r.delReq && r.delReq.status === "pending"; }).length}, reviews:vis}); }
    if(u.indexOf("/api/admin/cs/templates") >= 0){ window.__TPL = window.__TPL || [{id:"d1", title:"배송 문의", text:"안녕하세요, {고객}님. {브랜드}입니다. 주문하신 상품은 영업일 기준 1~2일 안에 발송되고, 발송되면 주문내역에서 택배사와 송장번호를 바로 확인하실 수 있어요. 도착까지는 보통 1~3일 정도 걸려요. 기다려주셔서 감사합니다."}, {id:"d2", title:"교환·반품 안내", text:"안녕하세요, {고객}님. {브랜드}입니다. 상품 수령 후 7일 이내, 미개봉·미사용 상태라면 교환·반품이 가능해요. 주문내역의 판매자정보/문의에서 반품을 신청해 주세요."}, {id:"d3", title:"불량·오배송 사과", text:"안녕하세요, {고객}님. {브랜드}입니다. 불편을 드려 정말 죄송합니다. 제품과 박스, 라벨이 보이는 사진을 남겨주시면 확인 후 새 제품으로 교환하거나 환불해드릴게요."}, {id:"d4", title:"사용법·피부 트러블", text:"안녕하세요, {고객}님. {브랜드}입니다. 처음 쓰실 때는 팔 안쪽에 먼저 테스트해 보세요. 붉어짐·가려움이 있으면 사용을 멈추고 물로 씻어내 주세요."}];
      if(/templates\/add$/.test(u.split("?")[0])){ if(String(b.title || "").trim().length < 2 || String(b.text || "").trim().length < 5) return res({error:"제목(2자 이상)과 답변 내용(5자 이상)을 입력해주세요"}, 400); if(window.__TPL.length >= 12) return res({error:"자동 입력 문구는 12개까지 만들 수 있어요. 안 쓰는 걸 지워주세요"}, 400); window.__TPL.push({id:"t" + Date.now(), title:String(b.title).trim().slice(0, 20), text:String(b.text).trim().slice(0, 600)}); }
      if(/templates\/delete$/.test(u.split("?")[0])){ var n0 = window.__TPL.length; window.__TPL = window.__TPL.filter(function(x){ return x.id !== b.id; }); if(n0 === window.__TPL.length) return res({error:"없는 문구예요"}, 400); }
      return res({templates:window.__TPL}); }
    if(u.indexOf("/api/admin/cs/") >= 0){ TK.forEach(function(t){ if(t.id === b.id){ if(u.indexOf("reply") >= 0) t.messages.push({from:"admin", text:b.text, at:new Date().toISOString()}); if(u.indexOf("close") >= 0 || u.indexOf("refund") >= 0){ t.status = u.indexOf("refund") >= 0 ? "refunded" : "closed"; delete t.refundError; } if(u.indexOf("refund") >= 0 || u.indexOf("close") >= 0) t.escalated = false; } }); return res({ok:true}); }
    if(u.indexOf("/api/admin/cs") >= 0) return res({tickets:TK});
    return res({error:"not found"}, 404);
  }
  window.fetch = function(u, o){
    u = String(u); var b = {}; try{ b = JSON.parse((o && o.body) || "{}"); }catch(e){}
        if(u.indexOf("script.google.com") >= 0){ var t = 0; for(var k in TYPES) t += TYPES[k]; return res({total:t, types:TYPES}); }
    if(u.indexOf("/data/products.json") >= 0) return res({categories:CATS});
    if(u.indexOf("/api/admin/") >= 0) return admin(u, b);
    if(u.indexOf("/api/manage/") < 0) return real.apply(this, arguments);
    if(!LOGGED) return res({error:"unauthorized"}, 401);
    if(u.indexOf("/api/manage/dashboard") >= 0){ var d = +(u.split("days=")[1] || 7), f = d === 1 ? 0.16 : d === 30 ? 3.6 : 1; return res({days:d, types:(function(){ var o = {}; Object.keys(TYPES).forEach(function(k){ o[k] = Math.max(1, Math.round(TYPES[k] * f / 4)); }); return o; })(), top:TOP.map(function(x, i){ return {id:"p" + i, name:x[0], brand:x[1], clicks:Math.round(x[2] * f), views:Math.round(x[3] * f)}; }), events:{quiz_start:Math.round(1520 * f), quiz_done:Math.round(1204 * f), kakao_click:Math.round(980 * f), kakao_unlock:Math.round(871 * f)}, kakao:kakao}); }
    if(u.indexOf("/api/manage/hidden") >= 0){ if(o && o.method === "POST"){ hid = {on:!!b.on, text:String(b.text || "").slice(0, 30), url:b.url || "", useDefault:b.useDefault !== false, endAt:b.endAt || ""}; return res(hid); } var nw = Date.now(), k = new Date(nw + 9 * 3600e3), de = Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate() + ((8 - k.getUTCDay()) % 7 || 7), 0, 0) - 9 * 3600e3; return res(Object.assign({defaultEnd:de, now:nw}, hid)); }
    if(u.indexOf("/api/manage/notice") >= 0){ if(o && o.method === "POST"){ var tx = String(b.text || "").trim(); if(b.on && !tx) return res({error:"공지 문구를 입력해야 켤 수 있어요."}, 400); if(b.link && !/^(https:\/\/\S{3,}|\/\S*|#[\w-]*)$/i.test(b.link)) return res({error:"버튼 링크는 https:// 로 시작하는 주소나 /store 같은 사이트 안 주소만 쓸 수 있어요."}, 400); window.__NT = {on:!!b.on, text:tx.slice(0, 150), link:b.link || "", linkText:b.linkText || "", until:b.until || "", updatedAt:new Date().toISOString()}; } var x = window.__NT || (window.__NT = {on:true, text:"10월 31일까지 전 제품 무료배송이에요. 진단 결과에 맞는 제품을 확인해보세요.", link:"/store", linkText:"스토어 보기", until:"", updatedAt:new Date(Date.now() - 2 * 36e5).toISOString()}); return res({ok:true, notice:x, live:!!(x.on && x.text && (!x.until || Date.parse(x.until + "T23:59:59+09:00") >= Date.now()))}); }
    if(u.indexOf("/api/manage/kakao") >= 0){ kakao = {friends:Math.round(+b.friends || 0), name:b.name || "문장군", updated:new Date().toISOString()}; return res({ok:true, kakao:kakao}); }
    if(u.indexOf("/api/manage/brand-mail") >= 0) return res({results:[{brand:"minic", name:"MINIC", email:"order@minic.example", orders:2, late:1, cancels:0, sent:false}, {brand:"grafen", name:"GRAFEN", email:"", orders:1, late:0, cancels:0, sent:false}]});
    if(u.indexOf("/api/manage/products") >= 0) return res({products:extra});
    if(u.indexOf("/api/manage/product-delete") >= 0){ extra = extra.filter(function(x){ return x.id !== b.id; }); return res({ok:true}); }
    if(u.indexOf("/api/manage/product") >= 0){
      var list = Math.round(+b.list), price = Math.round(+b.price);
      if(!b.name || !b.brandName) return res({error:"제품명과 브랜드명을 입력해주세요"}, 400);
      if(!CATS[b.cat]) return res({error:"카테고리를 선택해주세요"}, 400);
      if(!(price > 0) || !(list >= price)) return res({error:"정가와 할인가를 확인해주세요 (정가는 할인가 이상)"}, 400);
      if(!/^https?:\/\/\S+$/.test(b.url || "")) return res({error:"바로가기 링크는 http(s)로 시작해야 해요"}, 400);
      var p = {id:"x" + Date.now().toString(36), cat:b.cat, name:b.name, brandName:b.brandName, price:price, list:list > price ? list : undefined, img:b.img, url:b.url}; extra.push(p); return res({ok:true, product:p});
    }
    return res({error:"not found"}, 404);
  };
})();


window.confirm = function(){ return true; }; window.alert = function(){};
